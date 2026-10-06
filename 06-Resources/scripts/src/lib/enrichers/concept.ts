import type { App, TFile } from 'obsidian';
import { callGeminiJson, formatGeminiFailure } from '../gemini';
import { addFrontmatterTag, replaceSectionBody, resolveWikiLinks, normalizeWikiLink, wikiLinkTarget, toSingleLine, applyEnrichmentToCurrentContent, formatConflictNotice } from '../markdown';

const CONCEPT_OWNED_SECTIONS = [
  "## Summary",
  "## Why it matters",
  "## Examples",
  "## Questions",
  "## Next steps",
  "## 🔗 Related References",
  "## Related concepts"
];

function applyConceptEnrichment(source: string, data: any, existingNotes: string[], existingLinksInNote: string[]): string {
  let content = source;

  if (Array.isArray(data.tags)) {
    data.tags.forEach((t: string) => { content = addFrontmatterTag(content, t); });
  }

  const summary = toSingleLine(data.summary);
  if (summary) content = replaceSectionBody(content, "## Summary", summary);

  if (Array.isArray(data.whyItMatters)) {
    const items = data.whyItMatters.map(toSingleLine).filter(Boolean);
    if (items.length) content = replaceSectionBody(content, "## Why it matters", items.map((w: string) => `- ${w}`).join("\n"));
  }

  if (Array.isArray(data.examples)) {
    const items = data.examples.map(toSingleLine).filter(Boolean);
    if (items.length) content = replaceSectionBody(content, "## Examples", items.map((e: string) => `- ${e}`).join("\n"));
  }

  if (Array.isArray(data.questions)) {
    const items = data.questions.map(toSingleLine).filter(Boolean);
    if (items.length) content = replaceSectionBody(content, "## Questions", items.map((q: string) => `- ${q}`).join("\n"));
  }

  if (Array.isArray(data.nextSteps)) {
    const items = data.nextSteps
      .map((s: any) => toSingleLine(s).replace(/^\[[ xX]\]\s*/, "").trim())
      .filter(Boolean);
    if (items.length) content = replaceSectionBody(content, "## Next steps", items.map((s: string) => `- [ ] ${s}`).join("\n"));
  }

  if (Array.isArray(data.relatedConcepts)) {
    // #62: this was the only path that already resolved targets. It now shares
    // the vault-wide resolver so all four enrichers apply one rule. Concept
    // keeps the strictest reading of it: a Related References entry is a claim
    // that the link works, so an unresolvable suggestion is dropped and logged
    // rather than shown as plain text.
    const candidates = [...existingLinksInNote, ...data.relatedConcepts];
    const resolvedItems = resolveWikiLinks(candidates, existingNotes);
    const links = resolvedItems.filter((item) => item.resolved).map((item) => item.text);
    resolvedItems.filter((item) => !item.resolved).forEach((item) => {
      console.warn(`Concept Enrich: dropped link to non-existent note "${item.text}"`);
    });

    if (links.length) {
      const rcText = links.map(l => `- ${l}`).join("\n");
      if (/^## 🔗 Related References[ \t]*$/m.test(content)) {
        content = replaceSectionBody(content, "## 🔗 Related References", rcText);
      } else if (/^## Related concepts[ \t]*$/m.test(content)) {
        content = replaceSectionBody(content, "## Related concepts", rcText);
      }
    }
  }

  return content;
}

export async function enrichConceptNote(app: App, file: TFile): Promise<void> {
  const Notice = (window as any).Notice || (globalThis as any).Notice;
  const snapshot = await app.vault.read(file);
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
  const linkMatches = snapshot.match(/(?:==)?\[\[[^\[\]]+\]\](?:==)?/g) || [];
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
${snapshot.slice(0, 2000)}

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

  if (result.success === false) {
    const failure = result.failure;
    new Notice(
      `⚠️ Concept not enriched: ${formatGeminiFailure(failure)}.\n\n` +
      `The note was left unchanged. See the console for the full response.`,
      12000
    );
    return;
  }
  const conceptData = result.data;

try {
    const conflicts = await applyEnrichmentToCurrentContent(
      app.vault, file, snapshot, CONCEPT_OWNED_SECTIONS,
      (current) => applyConceptEnrichment(current, conceptData, existingNotes, existingLinksInNote)
    );

    new Notice(`✨ Concept note "${conceptName}" enriched with AI! (${result.model})${formatConflictNotice(conflicts)}`);

  } catch (err) {
    console.error("Failed to apply concept enrichment:", err);
    new Notice("⚠️ Failed to apply AI concept response.");
  }
}
