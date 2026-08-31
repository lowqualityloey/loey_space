import type { App, TFile } from 'obsidian';
import { callGeminiJson, formatGeminiFailure } from '../gemini';
import { addFrontmatterTag, readFrontmatterValue, replaceSectionBody, normalizeWikiLink, toSingleLine } from '../markdown';

export async function enrichLearningNote(app: App, file: TFile): Promise<void> {
  const Notice = (window as any).Notice || (globalThis as any).Notice;
  let content = await app.vault.read(file);
  const noteTitle = file.basename;

  new Notice(`🤖 Analyzing & enriching Learning Note: "${noteTitle}"...`);

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

  // 2. Collect existing markdown note titles for valid wikilinks
  const existingNotes = app.vault.getMarkdownFiles()
    .map((f: TFile) => f.basename)
    .filter((n: string) => n && !n.startsWith("_") && n !== noteTitle && !n.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesStr = existingNotes.slice(0, 60).join(", ");

  const systemPrompt = [
    "You are an expert curriculum curator and study coach.",
    "You help learners distill course materials, tutorials, and books into structured study notes, atomic evergreen concepts, and active recall quizzes.",
    "Always output valid JSON only."
  ].join(" ");

  const userPrompt = `Analyze and enrich this learning note titled "${noteTitle}".

Existing vault notes (valid link candidates): [${existingNotesStr}]

Note Content:
${content.slice(0, 3000)}

INSTRUCTIONS:
1. Objectives: Identify why someone would learn this and the concrete target outcome.
2. Extracted Concepts: Suggest 2-5 atomic evergreen concept titles worth creating in a Zettelkasten/second brain (format as [[Concept Name]]). Prioritize existing notes if relevant, or suggest clean new atomic concept names.
3. Active Recall: Generate 2-4 high-yield Q&A self-quiz questions based on the core mechanics/principles taught in this topic.
4. Topic Tag: Suggest a specific topic tag (e.g. "topic/typescript", "topic/react", "topic/architecture", "topic/algorithms", "topic/ai").

JSON format:
{
  "topicTag": "topic/...",
  "topicName": "...",
  "objectives": {
    "why": "1 sentence on why mastering this matters",
    "targetOutcome": "1 sentence on what capability the learner gains"
  },
  "extractedConcepts": ["[[Concept Name 1]]", "[[Concept Name 2]]"],
  "extractedSnippets": ["[[Code Snippet Name]]"],
  "activeRecall": [
    { "q": "Question 1?", "a": "Concise, precise answer." },
    { "q": "Question 2?", "a": "Concise, precise answer." }
  ]
}
`;

  const result = await callGeminiJson(geminiApiKey, systemPrompt, userPrompt, "Learning Enrich", 0.5);

  if (!result || !result.data) {
    new Notice(
      `⚠️ Learning note not enriched: ${formatGeminiFailure(result && result.failure)}.\n\n` +
      `The note was left unchanged. See the console for the full response.`,
      12000
    );
    return;
  }

  try {
    const data = result.data;

    // Update topic tag
    if (data.topicTag) {
      content = addFrontmatterTag(content, data.topicTag);
    }
    if (data.topicName && (readFrontmatterValue(content, "topic") === "general" || !readFrontmatterValue(content, "topic"))) {
      if (/^topic:\s*.*$/m.test(content)) {
        content = content.replace(/^topic:\s*.*$/m, `topic: ${toSingleLine(data.topicName)}`);
      }
    }

    // Update Learning Objectives & Motivation
    if (data.objectives) {
      const why = toSingleLine(data.objectives.why);
      const outcome = toSingleLine(data.objectives.targetOutcome);
      if (why || outcome) {
        const objText = `- **Why am I learning this?**: ${why || ""}\n- **Target Outcome**: ${outcome || ""}`;
        content = replaceSectionBody(content, "## 🎯 Learning Objectives & Motivation", objText);
      }
    }

    // Update Extracted Evergreen Concepts
    if (Array.isArray(data.extractedConcepts) && data.extractedConcepts.length > 0) {
      const links = data.extractedConcepts.map(normalizeWikiLink).filter(Boolean);
      if (links.length) {
        const text = "*Atomic concepts distilled into `08-Concepts/`:*\n" + links.map((l: string) => `- ${l}`).join("\n");
        content = replaceSectionBody(content, "## 💡 Extracted Evergreen Concepts", text);
      }
    }

    // Update Reusable Code Patterns
    if (Array.isArray(data.extractedSnippets) && data.extractedSnippets.length > 0) {
      const snippets = data.extractedSnippets.map(normalizeWikiLink).filter(Boolean);
      if (snippets.length) {
        const text = "*Practical snippets & solutions saved to `03-Dev/`:*\n" + snippets.map((s: string) => `- ${s}`).join("\n");
        content = replaceSectionBody(content, "## 💻 Reusable Code Patterns & Snippets", text);
      }
    }

    // Update Active Recall & Self-Quiz
    if (Array.isArray(data.activeRecall) && data.activeRecall.length > 0) {
      const quizLines: string[] = [];
      data.activeRecall.forEach((item: any) => {
        const q = toSingleLine(item.q);
        const a = toSingleLine(item.a);
        if (q && a) {
          quizLines.push(`- **Q**: ${q}\n  - **A**: ${a}`);
        }
      });
      if (quizLines.length) {
        content = replaceSectionBody(content, "## ❓ Active Recall & Self-Quiz", quizLines.join("\n"));
      }
    }

    await app.vault.modify(file, content);
    new Notice(`✨ Learning note "${noteTitle}" enriched with AI! (${result.model})`);

  } catch (err) {
    console.error("Failed to apply Learning enrichment:", err);
    new Notice("⚠️ Failed to apply AI Learning response.");
  }
}
