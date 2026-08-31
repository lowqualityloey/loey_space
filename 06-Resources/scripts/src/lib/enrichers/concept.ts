import type { App, TFile } from 'obsidian';
import { callGeminiJson, formatGeminiFailure } from '../gemini';
import { addFrontmatterTag, replaceSectionBody, normalizeWikiLink, wikiLinkTarget, toSingleLine } from '../markdown';

export async function enrichConceptNote(app: App, file: TFile): Promise<void> {
  const Notice = (window as any).Notice || (globalThis as any).Notice;
  let content = await app.vault.read(file);
  const conceptName = file.basename;

  new Notice(`🤖 Analyzing & enriching Concept: "${conceptName}"...`);

  // 1. Load Gemini API Key from .env
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

  // 2. Collect existing vault markdown notes to populate valid wikilinks
  const existingNotes = app.vault.getMarkdownFiles()
    .map((f: TFile) => f.basename)
    .filter((n: string) => n && !n.startsWith("_") && n !== conceptName && !n.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesStr = existingNotes.slice(0, 60).join(", ");

  // 3. Links the user already wrote in the note, including highlighted ones
  const existingLinksInNote: string[] = [];
  const linkMatches = content.match(/(?:==)?\[\[[^\[\]]+\]\](?:==)?/g) || [];
  for (const rawLink of linkMatches) {
    const normalized = normalizeWikiLink(rawLink);
    const target = wikiLinkTarget(normalized);
    if (target && !existingLinksInNote.includes(normalized)) existingLinksInNote.push(normalized);
  }

  const systemPrompt = [
    "You are a knowledge base curator who explains ideas clearly to a curious reader.",
    "You write in plain, natural English, in full sentences, with no jargon padding.",
    "You always answer with valid JSON only."
  ].join(" ");

  const userPrompt = `Explain and enrich the concept note "${conceptName}".

Existing notes in this vault (the ONLY valid link targets): [${existingNotesStr}]
Links already used in this note: ${existingLinksInNote.join(", ") || "none"}

Current note content:
${content.slice(0, 2000)}

HOW TO WRITE
1. Explain the concept properly, as if teaching someone who has not met it before. Be specific and concrete.
2. Ignore the template placeholder text in the note content, such as "What does this concept mean in one or two sentences?" and empty bullets or empty [[ ]] links. Replace them with real substance.
3. Plain sentences only. No markdown headings, no bullet characters, no line breaks inside any string value.
4. Do not mention JSON, fields, frontmatter, templates or this instruction.
5. For relatedConcepts, use ONLY names from the existing notes list above, formatted as [[Note Name]]. If none genuinely relate, return an empty array. Never invent a note name.

JSON format:
{
  "tags":["area/knowledge"],
  "summary":"2-3 sentences explaining what this concept actually is and what it is for",
  "whyItMatters":["specific reason it matters", "another specific reason"],
  "examples":["concrete, realistic example", "another concrete example"],
  "relatedConcepts":["[[Note Name]]"],
  "questions":["a genuine open question worth exploring?"],
  "nextSteps":["a concrete action to learn or apply this"]
}
`;

  const result = await callGeminiJson(geminiApiKey, systemPrompt, userPrompt, "Concept Enrich", 0.5);

  if (!result || !result.data) {
    new Notice(
      `⚠️ Concept not enriched: ${formatGeminiFailure(result && result.failure)}.\n\n` +
      `The note was left unchanged. See the console for the full response.`,
      12000
    );
    return;
  }

  try {
    const data = result.data;

    // Update tags in frontmatter
    if (Array.isArray(data.tags)) {
      data.tags.forEach((t: string) => { content = addFrontmatterTag(content, t); });
    }

    // Update Summary
    const summary = toSingleLine(data.summary);
    if (summary) content = replaceSectionBody(content, "## Summary", summary);

    // Update Why it matters
    if (Array.isArray(data.whyItMatters)) {
      const items = data.whyItMatters.map(toSingleLine).filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Why it matters", items.map((w: string) => `- ${w}`).join("\n"));
    }

    // Update Examples
    if (Array.isArray(data.examples)) {
      const items = data.examples.map(toSingleLine).filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Examples", items.map((e: string) => `- ${e}`).join("\n"));
    }

    // Update Questions
    if (Array.isArray(data.questions)) {
      const items = data.questions.map(toSingleLine).filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Questions", items.map((q: string) => `- ${q}`).join("\n"));
    }

    // Update Next steps
    if (Array.isArray(data.nextSteps)) {
      const items = data.nextSteps
        .map((s: any) => toSingleLine(s).replace(/^\[[ xX]\]\s*/, "").trim())
        .filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Next steps", items.map((s: string) => `- [ ] ${s}`).join("\n"));
    }

    // Update related links
    if (Array.isArray(data.relatedConcepts)) {
      const validTargets = new Map<string, string>();
      existingNotes.forEach((n: string) => validTargets.set(n.toLowerCase(), n));

      const links: string[] = [];
      const seen = new Set<string>();

      const addLink = (candidate: any) => {
        const normalized = normalizeWikiLink(candidate);
        const target = wikiLinkTarget(normalized);
        if (!target) return;
        const resolved = validTargets.get(target.toLowerCase());
        if (!resolved) {
          console.warn(`Concept Enrich: dropped link to non-existent note "${target}"`);
          return;
        }
        const key = resolved.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        links.push(normalized.startsWith("==") ? `==[[${resolved}]]==` : `[[${resolved}]]`);
      };

      existingLinksInNote.forEach(addLink);
      data.relatedConcepts.forEach(addLink);

      if (links.length) {
        const rcText = links.map(l => `- ${l}`).join("\n");
        if (/^## 🔗 Related References[ \t]*$/m.test(content)) {
          content = replaceSectionBody(content, "## 🔗 Related References", rcText);
        } else if (/^## Related concepts[ \t]*$/m.test(content)) {
          content = replaceSectionBody(content, "## Related concepts", rcText);
        }
      }
    }

    await app.vault.modify(file, content);
    new Notice(`✨ Concept note "${conceptName}" enriched with AI! (${result.model})`);

  } catch (err) {
    console.error("Failed to apply concept enrichment:", err);
    new Notice("⚠️ Failed to apply AI concept response.");
  }
}
