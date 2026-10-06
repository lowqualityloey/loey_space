import type { App, TFile } from 'obsidian';
import { callGeminiJson, formatGeminiFailure } from '../gemini';
import { addFrontmatterTag, replaceSectionBody, resolveWikiLinks, degradeUnresolvableLinks, toSingleLine, applyEnrichmentToCurrentContent, formatConflictNotice } from '../markdown';

const DEV_OWNED_SECTIONS = ["## Context", "## Code Explanation", "## Related"];

function applyDevEnrichment(source: string, data: any, existingNotes: string[]): string {
  let content = source;

  if (data.type) content = content.replace(/^type:\s*.*$/m, `type: ${data.type}`);
  if (data.area) content = content.replace(/^area:\s*.*$/m, `area: ${data.area}`);
  if (data.language) content = content.replace(/^language:\s*.*$/m, `language: ${data.language}`);

  if (Array.isArray(data.tags)) {
    data.tags.forEach((t: string) => { content = addFrontmatterTag(content, t); });
  }

  if (data.context) {
    const ctxLines: string[] = [];
    // #62: these are free-text fields, and the model's own example returns a
    // wikilink for `system`. Degrade the unresolvable ones rather than let the
    // Context section carry a link that leads nowhere.
    const system = degradeUnresolvableLinks(toSingleLine(data.context.system), existingNotes);
    const stack = degradeUnresolvableLinks(toSingleLine(data.context.stack), existingNotes);
    const fits = degradeUnresolvableLinks(toSingleLine(data.context.whereItFits), existingNotes);
    if (system) ctxLines.push(`- System: ${system}`);
    if (stack) ctxLines.push(`- Stack: ${stack}`);
    if (fits) ctxLines.push(`- Where this fits: ${fits}`);
    if (ctxLines.length) content = replaceSectionBody(content, "## Context", ctxLines.join("\n"));
  }

  if (Array.isArray(data.codeExplanation)) {
    const items = data.codeExplanation.map(toSingleLine).filter(Boolean);
    if (items.length) content = replaceSectionBody(content, "## Code Explanation", items.map((e: string) => `- ${e}`).join("\n"));
  }

  if (Array.isArray(data.related)) {
    // #62: a related note that does not exist is written as plain text, not as
    // a wikilink — this path normalised the syntax but never checked the target.
    const items = resolveWikiLinks(data.related, existingNotes);
    if (items.length) content = replaceSectionBody(content, "## Related", items.map((i) => `- ${i.text}`).join("\n"));
  }

  return content;
}

export async function enrichDevNote(app: App, file: TFile): Promise<void> {
  const Notice = (window as any).Notice || (globalThis as any).Notice;
  const snapshot = await app.vault.read(file);
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
${snapshot}

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

  if (devResult.success === false) {
    const failure = devResult.failure;
    new Notice(
      `⚠️ Dev note not enriched: ${formatGeminiFailure(failure)}.\n\n` +
      `The note was left unchanged. See the console for the full response.`,
      12000
    );
    return;
  }
  const devData = devResult.data;

try {
    const conflicts = await applyEnrichmentToCurrentContent(
      app.vault, file, snapshot, DEV_OWNED_SECTIONS,
      (current) => applyDevEnrichment(current, devData, existingNotes)
    );

    new Notice(`✨ Dev note "${noteTitle}" enriched with AI! (${devResult.model})${formatConflictNotice(conflicts)}`);

  } catch (err) {
    console.error("Failed to apply Dev enrichment:", err);
    new Notice("⚠️ Failed to apply AI Dev response.");
  }
}
