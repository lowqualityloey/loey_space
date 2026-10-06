import { callGeminiJson, formatGeminiFailure } from './gemini';
import { formatDate, readFrontmatterValue, toSingleLine } from './markdown';

export interface DistilledConcept {
  title: string;
  summary: string;
  whyItMatters?: string[];
  mentalModel?: string;
  examples: string[];
  area?: string;
  topicTag?: string;
  aliases?: string[];
}

export function buildConceptNoteMarkdown(
  concept: DistilledConcept,
  sourceNoteBasename?: string,
  createdDate?: string
): string {
  const today = createdDate || formatDate(new Date());
  const area = concept.area || 'dev';
  const topicTag = concept.topicTag || 'topic/concept';

  const tags = [
    'type/concept',
    `area/${area}`,
    topicTag.startsWith('topic/') ? topicTag : `topic/${topicTag}`,
    'status/active'
  ];

  const aliasesFormatted = Array.isArray(concept.aliases) && concept.aliases.length > 0
    ? `aliases:\n${concept.aliases.map(a => `  - "${toSingleLine(a).replace(/"/g, '\\"')}"`).join('\n')}`
    : 'aliases: []';

  const summary = toSingleLine(concept.summary);
  const mentalModel = concept.mentalModel ? concept.mentalModel.trim() : '';

  const whyItMattersLines = Array.isArray(concept.whyItMatters) && concept.whyItMatters.length > 0
    ? concept.whyItMatters.map(w => `- ${toSingleLine(w)}`).join('\n')
    : `- Core architectural principle that improves codebase maintainability and correctness.`;

  const examplesLines = Array.isArray(concept.examples) && concept.examples.length > 0
    ? concept.examples.map(e => `- ${toSingleLine(e)}`).join('\n')
    : `- Standard application in system design.`;

  const sourceSection = sourceNoteBasename
    ? `## 🔗 Source & References\n- Extracted from: [[${sourceNoteBasename}]]\n\n`
    : '';

  return `---
created: ${today}
updated: ${today}
last_reviewed: ${today}
review_cycle: 90d
type: concept
status: active
area: ${area}
tags:
${tags.map(t => `  - ${t}`).join('\n')}
${aliasesFormatted}
---

# 💡 ${concept.title}

> **${summary}**

---

## 🧠 Core Mental Model
${mentalModel || summary}

## 🎯 Why It Matters
${whyItMattersLines}

## 🛠️ Practical Examples
${examplesLines}

${sourceSection}## 🔄 Related Notes (Auto-Backlinks)
\`\`\`dataview
LIST
FROM [[]] AND !"99-Templates"
WHERE file.name != this.file.name
SORT file.mtime DESC
\`\`\`
`;
}

/** Markers delimiting the auto-generated region of a concept note. */
export const DISTILLED_START = '<!-- distilled:auto:start -->';
export const DISTILLED_END = '<!-- distilled:auto:end -->';

export type ConceptMergeAction = 'created' | 'merged' | 'unchanged';

function splitFrontmatter(content: string): { fm: string; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: '', body: content };
  return { fm: m[1], body: content.slice(m[0].length) };
}

/** Body of generated markdown, with its own frontmatter removed. */
function generatedBody(markdown: string): string {
  // The generated H1 duplicates the existing note's title, so the merged region
  // carries substance only.
  return splitFrontmatter(markdown)
    .body.replace(/^\s*#\s+.*\n+/, "")
    .trim();
}

/**
 * Collision policy (#39): never replace a curated concept note.
 *
 * A regenerated note is merged into the existing one: the human body, the
 * original `created` date, manual links and provenance all survive, and the new
 * material lands inside a clearly marked, reviewable region. Re-running the
 * same distillation is a no-op instead of duplicating the block.
 */
export function mergeConceptNote(
  existingContent: string,
  generatedMarkdown: string
): { content: string; action: ConceptMergeAction } {
  const incoming = generatedBody(generatedMarkdown);
  const { fm, body } = splitFrontmatter(existingContent);
  const curated = body.trimEnd();

  // Preserve the original creation date; only refresh `updated` when present.
  const created = readFrontmatterValue(existingContent, 'created');
  const fmOut = created && !/^created:/m.test(fm) ? `created: ${created}\n${fm}` : fm;

  const existingSection = curated.match(
    new RegExp(`\\n*${DISTILLED_START}[\\s\\S]*?${DISTILLED_END}\\n*`)
  );

  if (existingSection && existingSection[0].includes(incoming)) {
    return { content: existingContent, action: 'unchanged' };
  }

  const block = `${DISTILLED_START}\n\n> [!NOTE] Auto-appended by distillation. Review, then keep or delete.\n\n${incoming}\n\n${DISTILLED_END}`;

  const merged = existingSection
    ? curated.replace(existingSection[0], `\n\n${block}\n`)
    : `${curated}\n\n---\n\n${block}\n`;

  const content = fmOut ? `---\n${fmOut}\n---\n\n${merged.trimStart()}` : merged;

  return { content, action: 'merged' };
}

export async function distillConceptsFromContent(
  apiKey: string,
  content: string,
  sourceTitle: string,
  existingConcepts: string[]
): Promise<{ concepts: DistilledConcept[]; model: string; failure: import('./gemini').GeminiFailure | null }> {
  const existingStr = existingConcepts.slice(0, 60).join(', ');

  const systemPrompt = [
    'You are a senior knowledge architect and Zettelkasten curator.',
    'You extract atomic, evergreen mental models and principles from articles, dev logs, and tutorials.',
    'An atomic concept represents ONE standalone idea that is timeless, generalizable, and not tied solely to this one specific article.',
    'Always output valid JSON only.'
  ].join(' ');

  const userPrompt = `Analyze this document and distill 1 to 3 atomic evergreen concepts from it.

Document Title: "${sourceTitle}"
Existing Vault Concepts: [${existingStr}]

Content:
${content.slice(0, 5000)}

RULES:
1. Extract 1 to 3 standalone mental models or principles. Never create an omnibus summary of the article as a concept.
2. Title: Clean, clear, specific noun phrase (e.g. "Type-Driven Design", "Compile-Time Reactive Memoization", "Parse Don't Validate", "Eventual Consistency in Distributed Systems").
3. Summary: ONE clear definition sentence.
4. Mental Model: 2-3 sentences explaining the underlying mechanic.
5. Examples: 2-3 concrete, practical applications.
6. Area: Choose one of ["dev", "learning", "personal", "system", "general"].
7. TopicTag: Specific topic tag (e.g. "topic/typescript", "topic/architecture", "topic/react", "topic/data-structures").

JSON format:
{
  "concepts": [
    {
      "title": "Concept Name",
      "summary": "One clear definition sentence.",
      "whyItMatters": ["Why this principle matters in practice."],
      "mentalModel": "Explanation of the core mechanism.",
      "examples": ["Concrete example 1", "Concrete example 2"],
      "area": "dev",
      "topicTag": "topic/architecture",
      "aliases": ["Alternative Name"]
    }
  ]
}
`;

  const result = await callGeminiJson(apiKey, systemPrompt, userPrompt, 'Distill Concepts', 0.4);

  if (result.success === false) {
    return { concepts: [], model: '', failure: result.failure };
  }
  const data = result.data as { concepts?: unknown[] };
  if (!Array.isArray(data.concepts)) {
    return { concepts: [], model: result.model, failure: null };
  }

  return { concepts: data.concepts as DistilledConcept[], model: result.model, failure: null };
}
