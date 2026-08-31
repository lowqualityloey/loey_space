import type { App, TFile } from 'obsidian';
import { callGeminiJson, formatGeminiFailure } from '../gemini';
import { addFrontmatterTag, replaceSectionBody, normalizeWikiLink, wikiLinkTarget, toSingleLine } from '../markdown';

export async function enrichDevNote(app: App, file: TFile): Promise<void> {
  const Notice = (window as any).Notice || (globalThis as any).Notice;
  let content = await app.vault.read(file);
  const noteTitle = file.basename;

  new Notice(`🤖 Analyzing & enriching Dev Note: "${noteTitle}"...`);

  // 1. Load Gemini API Key
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes("your_gemini")) geminiApiKey = match[1].trim();
  } catch (e) {}

  if (!geminiApiKey) {
    new Notice("⚠️ GEMINI_API_KEY missing in .env!");
    return;
  }

  // 2. Collect existing markdown notes for wikilinks
  const existingNotes = app.vault.getMarkdownFiles()
    .map((f: TFile) => f.basename)
    .filter((n: string) => n && !n.startsWith("_") && n !== noteTitle && !n.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesStr = existingNotes.slice(0, 60).join(", ");

  const systemPrompt = `You are a senior software engineer. Enrich dev notes with frontmatter and sections.`;

  const userPrompt = `Analyze this dev note. Provide JSON only.

Title: "${noteTitle}"
Existing Notes: [${existingNotesStr}]

Content:
${content}

JSON format:
{
  "type":"snippet",
  "area":"dev",
  "language":"JavaScript ES6",
  "tags":["type/dev","area/dev"],
  "context":{"system":"[[second brain]]","stack":"JavaScript ES6+","whereItFits":""},
  "codeExplanation":[],
  "related":[]
}
`;

  const devResult = await callGeminiJson(geminiApiKey, systemPrompt, userPrompt, "Dev Enrich", 0.4);

  if (!devResult || !devResult.data) {
    new Notice(
      `⚠️ Dev note not enriched: ${formatGeminiFailure(devResult && devResult.failure)}.\n\n` +
      `The note was left unchanged. See the console for the full response.`,
      12000
    );
    return;
  }

  try {
    const data = devResult.data;

    // Update frontmatter properties
    if (data.type) content = content.replace(/^type:\s*.*$/m, `type: ${data.type}`);
    if (data.area) content = content.replace(/^area:\s*.*$/m, `area: ${data.area}`);
    if (data.language) content = content.replace(/^language:\s*.*$/m, `language: ${data.language}`);

    if (Array.isArray(data.tags)) {
      data.tags.forEach((t: string) => { content = addFrontmatterTag(content, t); });
    }

    // Update Context
    if (data.context) {
      const ctxLines: string[] = [];
      const system = toSingleLine(data.context.system);
      const stack = toSingleLine(data.context.stack);
      const fits = toSingleLine(data.context.whereItFits);
      if (system) ctxLines.push(`- System: ${system}`);
      if (stack) ctxLines.push(`- Stack: ${stack}`);
      if (fits) ctxLines.push(`- Where this fits: ${fits}`);
      if (ctxLines.length) content = replaceSectionBody(content, "## Context", ctxLines.join("\n"));
    }

    // Update Code Explanation
    if (Array.isArray(data.codeExplanation)) {
      const items = data.codeExplanation.map(toSingleLine).filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Code Explanation", items.map((e: string) => `- ${e}`).join("\n"));
    }

    // Update Related
    if (Array.isArray(data.related)) {
      const seen = new Set<string>();
      const links: string[] = [];
      data.related.forEach((r: any) => {
        const normalized = normalizeWikiLink(r);
        const target = wikiLinkTarget(normalized);
        if (!target || seen.has(target.toLowerCase())) return;
        seen.add(target.toLowerCase());
        links.push(normalized);
      });
      if (links.length) content = replaceSectionBody(content, "## Related", links.map((l: string) => `- ${l}`).join("\n"));
    }

    await app.vault.modify(file, content);
    new Notice(`✨ Dev note "${noteTitle}" enriched with AI! (${devResult.model})`);

  } catch (err) {
    console.error("Failed to apply Dev enrichment:", err);
    new Notice("⚠️ Failed to apply AI Dev response.");
  }
}
