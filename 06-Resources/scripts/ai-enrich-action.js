// 06-Resources/scripts/src/lib/gemini.ts
var GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
function parseGeminiError(status, bodyText, model) {
  let message = "";
  let retrySeconds = 0;
  let quotaId = "";
  let quotaValue = "";
  try {
    const body = JSON.parse(bodyText);
    const error = body.error || {};
    message = error.message || "";
    const details = Array.isArray(error.details) ? error.details : [];
    for (const detail of details) {
      const type = String(detail["@type"] || "");
      if (type.includes("RetryInfo") && detail.retryDelay) {
        const seconds = String(detail.retryDelay).match(/([\d.]+)\s*s/);
        if (seconds)
          retrySeconds = Math.ceil(parseFloat(seconds[1]));
      }
      if (type.includes("QuotaFailure") && Array.isArray(detail.violations) && detail.violations.length) {
        quotaId = detail.violations[0].quotaId || "";
        quotaValue = detail.violations[0].quotaValue || "";
      }
    }
  } catch (e) {
    message = String(bodyText || "").slice(0, 200);
  }
  let kind = "unknown";
  if (status === 429) {
    if (/PerDay/i.test(quotaId))
      kind = "quotaPerDay";
    else if (/PerMinute/i.test(quotaId))
      kind = "quotaPerMinute";
    else if (/Token/i.test(quotaId))
      kind = "quotaTokens";
    else
      kind = retrySeconds > 120 ? "quotaPerDay" : "quotaPerMinute";
  } else if (status === 404)
    kind = "modelMissing";
  else if (status === 400)
    kind = "badRequest";
  else if (status === 401 || status === 403)
    kind = "auth";
  else if (status >= 500)
    kind = "serverError";
  return { status, kind, message, retrySeconds, quotaId, quotaValue, model };
}
function describeQuotaReset() {
  try {
    const now = /* @__PURE__ */ new Date();
    const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const msUntilReset = ((24 - pacific.getHours()) * 60 - pacific.getMinutes()) * 60 * 1e3;
    const resetLocal = new Date(now.getTime() + msUntilReset);
    const hours = Math.max(1, Math.round(msUntilReset / 36e5));
    const clock = resetLocal.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `in about ${hours}h (around ${clock} your time)`;
  } catch (e) {
    return "at midnight Pacific time";
  }
}
function formatGeminiFailure(failure) {
  if (!failure)
    return "the request failed";
  switch (failure.kind) {
    case "quotaPerMinute":
      return failure.retrySeconds ? `per-minute rate limit hit \u2014 Google says retry in about ${failure.retrySeconds}s` : "per-minute rate limit hit \u2014 wait about a minute and run it again";
    case "quotaPerDay":
      return `daily free-tier quota used up${failure.quotaValue ? ` (limit ${failure.quotaValue} requests/day on ${failure.model})` : ""} \u2014 resets ${describeQuotaReset()}, so waiting a few minutes will NOT help`;
    case "quotaTokens":
      return "tokens-per-minute quota hit \u2014 wait a minute, or shorten the note";
    case "auth":
      return `API key rejected (HTTP ${failure.status}) \u2014 check GEMINI_API_KEY in .env`;
    case "badRequest":
      return `request rejected (400): ${failure.message || "invalid request"}`;
    case "modelMissing":
      return "none of the configured models are available for this key (404)";
    case "serverError":
      return `Google server error (${failure.status}) \u2014 try again shortly`;
    case "network":
      return `network error: ${failure.message}`;
    case "emptyResponse":
      return `model returned no content${failure.message ? ` (${failure.message})` : ""}`;
    case "badJson":
      return "model returned text that was not valid JSON";
    case "noKey":
      return "GEMINI_API_KEY is missing from .env";
    default:
      return failure.message || "the request failed";
  }
}
async function postJson(url, payload) {
  const reqUrl = typeof window !== "undefined" ? window.requestUrl : globalThis.requestUrl;
  if (typeof reqUrl === "function") {
    const res2 = await reqUrl({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      throw: false,
      body: JSON.stringify(payload)
    });
    return { status: res2.status, text: res2.text };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  return { status: res.status, text };
}
async function callGeminiJson(apiKey, systemPrompt, userPrompt, label, temperature) {
  let failure = { status: 0, kind: "unknown", message: "request failed", retrySeconds: 0, model: "" };
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res = null;
      try {
        res = await postJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: typeof temperature === "number" ? temperature : 0.6
            }
          }
        );
      } catch (e) {
        failure = { status: 0, kind: "network", message: e?.message ? e.message : String(e), retrySeconds: 0, model };
        console.warn(`${label}: ${model} network error \u2014 ${failure.message}`);
        break;
      }
      if (res.status === 200) {
        try {
          const json = JSON.parse(res.text);
          const candidate = json.candidates && json.candidates[0];
          const parts = candidate && candidate.content && candidate.content.parts;
          const text = parts && parts[0] && parts[0].text ? parts[0].text.trim() : "";
          if (!text) {
            failure = {
              status: 200,
              kind: "emptyResponse",
              retrySeconds: 0,
              model,
              message: `finishReason: ${candidate ? candidate.finishReason : "none"}`
            };
            console.warn(`${label}: ${model} returned no usable content`, json);
            break;
          }
          const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
          return { data: JSON.parse(clean), model, failure: null };
        } catch (e) {
          failure = { status: 200, kind: "badJson", message: e?.message ? e.message : String(e), retrySeconds: 0, model };
          console.warn(`${label}: ${model} returned unparsable JSON \u2014 ${failure.message}`);
          break;
        }
      }
      failure = parseGeminiError(res.status, res.text, model);
      console.warn(
        `${label}: ${model} \u2192 HTTP ${res.status} [${failure.kind}]${failure.quotaId ? ` quotaId=${failure.quotaId}` : ""}${failure.retrySeconds ? ` retryDelay=${failure.retrySeconds}s` : ""} \u2014 ${failure.message}`
      );
      if (failure.kind === "quotaPerMinute" && attempt === 0) {
        const waitSeconds = Math.min(Math.max(failure.retrySeconds || 6, 5), 20);
        console.log(`${label}: waiting ${waitSeconds}s before retrying ${model}`);
        await new Promise((r) => setTimeout(r, waitSeconds * 1e3));
        continue;
      }
      break;
    }
    if (failure.kind === "auth" || failure.kind === "badRequest") {
      console.warn(`${label}: aborting model fallback \u2014 ${failure.kind} affects all models`);
      break;
    }
  }
  console.warn(`${label}: all models failed \u2014 ${formatGeminiFailure(failure)}`);
  return { data: null, model: "", failure };
}

// 06-Resources/scripts/src/lib/markdown.ts
function readFrontmatterValue(content, key) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const scope = fm ? fm[1] : content;
  const match = scope.match(new RegExp("^" + key + ":[ \\t]*([^\\r\\n]*)$", "m"));
  if (!match)
    return "";
  return match[1].trim().replace(/^["']|["']$/g, "").trim();
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function previousDateStr(dateStr) {
  const parts = String(dateStr).split("-").map(Number);
  const date = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  if (isNaN(date.getTime()))
    return dateStr;
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}
function toSingleLine(value) {
  if (value === void 0 || value === null)
    return "";
  const raw = Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value);
  return raw.replace(/\r?\n+/g, " ").replace(/^\s*>+\s*/, "").replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/^\s*#{1,6}\s*/, "").replace(/\s{2,}/g, " ").trim();
}
function escapeReplacement(text) {
  return String(text).replace(/\$/g, "$$$$");
}
function normalizeWikiLink(raw) {
  let text = toSingleLine(raw).replace(/^-?\s*\[[ xX]\]\s*/, "").trim();
  if (!text)
    return "";
  let highlighted = false;
  for (let i = 0; i < 4; i++) {
    const wrapped = text.match(/^(==|\*\*|__|\*|_)([\s\S]+)\1$/);
    if (!wrapped)
      break;
    if (wrapped[1] === "==")
      highlighted = true;
    text = wrapped[2].trim();
  }
  const inner = text.match(/^\[\[([^\[\]]+)\]\]$/);
  const target = (inner ? inner[1] : text.replace(/^\[+|\]+$/g, "")).trim();
  if (!target || target === "|" || target === "#")
    return "";
  const link = `[[${target}]]`;
  return highlighted ? `==${link}==` : link;
}
function wikiLinkTarget(link) {
  const inner = String(link).match(/\[\[([^\[\]]+)\]\]/);
  if (!inner)
    return "";
  return inner[1].split("|")[0].split("#")[0].trim();
}
function replaceSectionBody(content, headingLiteral, bodyText) {
  const heading = headingLiteral.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    "(^" + heading + "[ \\t]*\\r?\\n)[\\s\\S]*?(?=^#{1,6} |^```|^---[ \\t]*$|(?![\\s\\S]))",
    "m"
  );
  if (!re.test(content))
    return content;
  return content.replace(re, (match, headingLine) => headingLine + bodyText + "\n\n");
}
function addFrontmatterTag(content, tag) {
  const clean = toSingleLine(tag).replace(/^#/, "").trim();
  if (!clean)
    return content;
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm)
    return content;
  if (new RegExp("^\\s*-\\s*" + clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "m").test(fm[1]))
    return content;
  return content.replace(/(^tags:[ \t]*\r?\n)/m, (m, key) => key + "  - " + clean + "\n");
}
function stripTaskMetadata(text) {
  return String(text).replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ").replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ").replace(/\s*\^[A-Za-z0-9]+\s*$/, " ").replace(/\s{2,}/g, " ").trim();
}

// 06-Resources/scripts/src/lib/enrichers/concept.ts
async function enrichConceptNote(app, file) {
  const Notice = window.Notice || globalThis.Notice;
  let content = await app.vault.read(file);
  const conceptName = file.basename;
  new Notice(`\u{1F916} Analyzing & enriching Concept: "${conceptName}"...`);
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes("your_gemini"))
      geminiApiKey = match[1].trim();
  } catch (e) {
  }
  if (!geminiApiKey) {
    new Notice("\u26A0\uFE0F GEMINI_API_KEY missing in .env!");
    return;
  }
  const existingNotes = app.vault.getMarkdownFiles().map((f) => f.basename).filter((n) => n && !n.startsWith("_") && n !== conceptName && !n.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesStr = existingNotes.slice(0, 60).join(", ");
  const existingLinksInNote = [];
  const linkMatches = content.match(/(?:==)?\[\[[^\[\]]+\]\](?:==)?/g) || [];
  for (const rawLink of linkMatches) {
    const normalized = normalizeWikiLink(rawLink);
    const target = wikiLinkTarget(normalized);
    if (target && !existingLinksInNote.includes(normalized))
      existingLinksInNote.push(normalized);
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
${content.slice(0, 2e3)}

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
      `\u26A0\uFE0F Concept not enriched: ${formatGeminiFailure(result && result.failure)}.

The note was left unchanged. See the console for the full response.`,
      12e3
    );
    return;
  }
  try {
    const data = result.data;
    if (Array.isArray(data.tags)) {
      data.tags.forEach((t) => {
        content = addFrontmatterTag(content, t);
      });
    }
    const summary = toSingleLine(data.summary);
    if (summary)
      content = replaceSectionBody(content, "## Summary", summary);
    if (Array.isArray(data.whyItMatters)) {
      const items = data.whyItMatters.map(toSingleLine).filter(Boolean);
      if (items.length)
        content = replaceSectionBody(content, "## Why it matters", items.map((w) => `- ${w}`).join("\n"));
    }
    if (Array.isArray(data.examples)) {
      const items = data.examples.map(toSingleLine).filter(Boolean);
      if (items.length)
        content = replaceSectionBody(content, "## Examples", items.map((e) => `- ${e}`).join("\n"));
    }
    if (Array.isArray(data.questions)) {
      const items = data.questions.map(toSingleLine).filter(Boolean);
      if (items.length)
        content = replaceSectionBody(content, "## Questions", items.map((q) => `- ${q}`).join("\n"));
    }
    if (Array.isArray(data.nextSteps)) {
      const items = data.nextSteps.map((s) => toSingleLine(s).replace(/^\[[ xX]\]\s*/, "").trim()).filter(Boolean);
      if (items.length)
        content = replaceSectionBody(content, "## Next steps", items.map((s) => `- [ ] ${s}`).join("\n"));
    }
    if (Array.isArray(data.relatedConcepts)) {
      const validTargets = /* @__PURE__ */ new Map();
      existingNotes.forEach((n) => validTargets.set(n.toLowerCase(), n));
      const links = [];
      const seen = /* @__PURE__ */ new Set();
      const addLink = (candidate) => {
        const normalized = normalizeWikiLink(candidate);
        const target = wikiLinkTarget(normalized);
        if (!target)
          return;
        const resolved = validTargets.get(target.toLowerCase());
        if (!resolved) {
          console.warn(`Concept Enrich: dropped link to non-existent note "${target}"`);
          return;
        }
        const key = resolved.toLowerCase();
        if (seen.has(key))
          return;
        seen.add(key);
        links.push(normalized.startsWith("==") ? `==[[${resolved}]]==` : `[[${resolved}]]`);
      };
      existingLinksInNote.forEach(addLink);
      data.relatedConcepts.forEach(addLink);
      if (links.length) {
        const rcText = links.map((l) => `- ${l}`).join("\n");
        if (/^## 🔗 Related References[ \t]*$/m.test(content)) {
          content = replaceSectionBody(content, "## \u{1F517} Related References", rcText);
        } else if (/^## Related concepts[ \t]*$/m.test(content)) {
          content = replaceSectionBody(content, "## Related concepts", rcText);
        }
      }
    }
    await app.vault.modify(file, content);
    new Notice(`\u2728 Concept note "${conceptName}" enriched with AI! (${result.model})`);
  } catch (err) {
    console.error("Failed to apply concept enrichment:", err);
    new Notice("\u26A0\uFE0F Failed to apply AI concept response.");
  }
}

// 06-Resources/scripts/src/lib/enrichers/dev.ts
async function enrichDevNote(app, file) {
  const Notice = window.Notice || globalThis.Notice;
  let content = await app.vault.read(file);
  const noteTitle = file.basename;
  new Notice(`\u{1F916} Analyzing & enriching Dev Note: "${noteTitle}"...`);
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes("your_gemini"))
      geminiApiKey = match[1].trim();
  } catch (e) {
  }
  if (!geminiApiKey) {
    new Notice("\u26A0\uFE0F GEMINI_API_KEY missing in .env!");
    return;
  }
  const existingNotes = app.vault.getMarkdownFiles().map((f) => f.basename).filter((n) => n && !n.startsWith("_") && n !== noteTitle && !n.match(/^\d{4}-\d{2}-\d{2}/));
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
      `\u26A0\uFE0F Dev note not enriched: ${formatGeminiFailure(devResult && devResult.failure)}.

The note was left unchanged. See the console for the full response.`,
      12e3
    );
    return;
  }
  try {
    const data = devResult.data;
    if (data.type)
      content = content.replace(/^type:\s*.*$/m, `type: ${data.type}`);
    if (data.area)
      content = content.replace(/^area:\s*.*$/m, `area: ${data.area}`);
    if (data.language)
      content = content.replace(/^language:\s*.*$/m, `language: ${data.language}`);
    if (Array.isArray(data.tags)) {
      data.tags.forEach((t) => {
        content = addFrontmatterTag(content, t);
      });
    }
    if (data.context) {
      const ctxLines = [];
      const system = toSingleLine(data.context.system);
      const stack = toSingleLine(data.context.stack);
      const fits = toSingleLine(data.context.whereItFits);
      if (system)
        ctxLines.push(`- System: ${system}`);
      if (stack)
        ctxLines.push(`- Stack: ${stack}`);
      if (fits)
        ctxLines.push(`- Where this fits: ${fits}`);
      if (ctxLines.length)
        content = replaceSectionBody(content, "## Context", ctxLines.join("\n"));
    }
    if (Array.isArray(data.codeExplanation)) {
      const items = data.codeExplanation.map(toSingleLine).filter(Boolean);
      if (items.length)
        content = replaceSectionBody(content, "## Code Explanation", items.map((e) => `- ${e}`).join("\n"));
    }
    if (Array.isArray(data.related)) {
      const seen = /* @__PURE__ */ new Set();
      const links = [];
      data.related.forEach((r) => {
        const normalized = normalizeWikiLink(r);
        const target = wikiLinkTarget(normalized);
        if (!target || seen.has(target.toLowerCase()))
          return;
        seen.add(target.toLowerCase());
        links.push(normalized);
      });
      if (links.length)
        content = replaceSectionBody(content, "## Related", links.map((l) => `- ${l}`).join("\n"));
    }
    await app.vault.modify(file, content);
    new Notice(`\u2728 Dev note "${noteTitle}" enriched with AI! (${devResult.model})`);
  } catch (err) {
    console.error("Failed to apply Dev enrichment:", err);
    new Notice("\u26A0\uFE0F Failed to apply AI Dev response.");
  }
}

// 06-Resources/scripts/src/lib/enrichers/learning.ts
async function enrichLearningNote(app, file) {
  const Notice = window.Notice || globalThis.Notice;
  let content = await app.vault.read(file);
  const noteTitle = file.basename;
  new Notice(`\u{1F916} Analyzing & enriching Learning Note: "${noteTitle}"...`);
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes("your_gemini"))
      geminiApiKey = match[1].trim();
  } catch (e) {
  }
  if (!geminiApiKey) {
    new Notice("\u26A0\uFE0F GEMINI_API_KEY missing in .env!");
    return;
  }
  const existingNotes = app.vault.getMarkdownFiles().map((f) => f.basename).filter((n) => n && !n.startsWith("_") && n !== noteTitle && !n.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesStr = existingNotes.slice(0, 60).join(", ");
  const systemPrompt = [
    "You are an expert curriculum curator and study coach.",
    "You help learners distill course materials, tutorials, and books into structured study notes, atomic evergreen concepts, and active recall quizzes.",
    "Always output valid JSON only."
  ].join(" ");
  const userPrompt = `Analyze and enrich this learning note titled "${noteTitle}".

Existing vault notes (valid link candidates): [${existingNotesStr}]

Note Content:
${content.slice(0, 3e3)}

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
      `\u26A0\uFE0F Learning note not enriched: ${formatGeminiFailure(result && result.failure)}.

The note was left unchanged. See the console for the full response.`,
      12e3
    );
    return;
  }
  try {
    const data = result.data;
    if (data.topicTag) {
      content = addFrontmatterTag(content, data.topicTag);
    }
    if (data.topicName && (readFrontmatterValue(content, "topic") === "general" || !readFrontmatterValue(content, "topic"))) {
      if (/^topic:\s*.*$/m.test(content)) {
        content = content.replace(/^topic:\s*.*$/m, `topic: ${toSingleLine(data.topicName)}`);
      }
    }
    if (data.objectives) {
      const why = toSingleLine(data.objectives.why);
      const outcome = toSingleLine(data.objectives.targetOutcome);
      if (why || outcome) {
        const objText = `- **Why am I learning this?**: ${why || ""}
- **Target Outcome**: ${outcome || ""}`;
        content = replaceSectionBody(content, "## \u{1F3AF} Learning Objectives & Motivation", objText);
      }
    }
    if (Array.isArray(data.extractedConcepts) && data.extractedConcepts.length > 0) {
      const links = data.extractedConcepts.map(normalizeWikiLink).filter(Boolean);
      if (links.length) {
        const text = "*Atomic concepts distilled into `08-Concepts/`:*\n" + links.map((l) => `- ${l}`).join("\n");
        content = replaceSectionBody(content, "## \u{1F4A1} Extracted Evergreen Concepts", text);
      }
    }
    if (Array.isArray(data.extractedSnippets) && data.extractedSnippets.length > 0) {
      const snippets = data.extractedSnippets.map(normalizeWikiLink).filter(Boolean);
      if (snippets.length) {
        const text = "*Practical snippets & solutions saved to `03-Dev/`:*\n" + snippets.map((s) => `- ${s}`).join("\n");
        content = replaceSectionBody(content, "## \u{1F4BB} Reusable Code Patterns & Snippets", text);
      }
    }
    if (Array.isArray(data.activeRecall) && data.activeRecall.length > 0) {
      const quizLines = [];
      data.activeRecall.forEach((item) => {
        const q = toSingleLine(item.q);
        const a = toSingleLine(item.a);
        if (q && a) {
          quizLines.push(`- **Q**: ${q}
  - **A**: ${a}`);
        }
      });
      if (quizLines.length) {
        content = replaceSectionBody(content, "## \u2753 Active Recall & Self-Quiz", quizLines.join("\n"));
      }
    }
    await app.vault.modify(file, content);
    new Notice(`\u2728 Learning note "${noteTitle}" enriched with AI! (${result.model})`);
  } catch (err) {
    console.error("Failed to apply Learning enrichment:", err);
    new Notice("\u26A0\uFE0F Failed to apply AI Learning response.");
  }
}

// 06-Resources/scripts/src/lib/enrichers/daily.ts
function parseGitHubCalloutFromNote(content) {
  const match = content.match(/> \[!NOTE\]-\s*🐙 GitHub Activity Log[\s\S]*?(?=\r?\n\r?\n|\r?\n#{1,6} |\r?\n---[ \t]*\r?\n|(?![\s\S]))/);
  if (!match)
    return [];
  const rows = [];
  const lines = match[0].split("\n");
  for (const line of lines) {
    if (!line.includes("|") || line.includes(":---") || line.includes("Message / Details") || line.includes("[!NOTE]"))
      continue;
    const parts = line.replace(/^>\s*\|?/, "").replace(/\|?\s*$/, "").split("|").map((s) => s.trim());
    if (parts.length >= 4) {
      rows.push({
        time: parts[0],
        repo: parts[1].replace(/`/g, ""),
        type: parts[2],
        details: parts[3]
      });
    }
  }
  return rows;
}
function extractGitHubSummary(rows, dailyLog) {
  const repoActivity = {};
  for (const r of rows) {
    const repo = r.repo;
    if (!repoActivity[repo])
      repoActivity[repo] = { pushes: 0, prs: 0, issues: 0, highlights: [] };
    if (r.type.includes("Push")) {
      repoActivity[repo].pushes++;
      if (r.details && !r.details.startsWith("Pushed commits"))
        repoActivity[repo].highlights.push(r.details);
    } else if (r.type.includes("PR")) {
      repoActivity[repo].prs++;
      if (r.details && !r.details.startsWith("Pull Request"))
        repoActivity[repo].highlights.push(`PR: ${r.details}`);
    } else if (r.type.includes("Issue")) {
      repoActivity[repo].issues++;
      if (r.details)
        repoActivity[repo].highlights.push(`Issue: ${r.details}`);
    }
  }
  if (rows.length === 0) {
    for (const entry of dailyLog) {
      const pushMatch = entry.match(/🐙\s*\*\*Push\*\*\s*\(`([^`]+)`\s*→\s*`([^`]+)`\)(?::\s*(.*))?/i);
      const prMatch = entry.match(/🔀\s*\*\*PR\s*([^*]+)\*\*\s*\(`([^`]+)`(?:\s*#(\d+))?\)(?::\s*(.*))?/i);
      const issueMatch = entry.match(/🎯\s*\*\*Issue\s*([^*]+)\*\*\s*\(`([^`]+)`(?:\s*#(\d+))?\)(?::\s*(.*))?/i);
      if (pushMatch) {
        const repo = pushMatch[1];
        if (!repoActivity[repo])
          repoActivity[repo] = { pushes: 0, prs: 0, issues: 0, highlights: [] };
        repoActivity[repo].pushes++;
        if (pushMatch[3])
          repoActivity[repo].highlights.push(pushMatch[3]);
      } else if (prMatch) {
        const repo = prMatch[2];
        if (!repoActivity[repo])
          repoActivity[repo] = { pushes: 0, prs: 0, issues: 0, highlights: [] };
        repoActivity[repo].prs++;
        if (prMatch[4])
          repoActivity[repo].highlights.push(`PR: ${prMatch[4]}`);
      } else if (issueMatch) {
        const repo = issueMatch[2];
        if (!repoActivity[repo])
          repoActivity[repo] = { pushes: 0, prs: 0, issues: 0, highlights: [] };
        repoActivity[repo].issues++;
        if (issueMatch[4])
          repoActivity[repo].highlights.push(`Issue: ${issueMatch[4]}`);
      }
    }
  }
  const repoNames = Object.keys(repoActivity);
  if (repoNames.length === 0)
    return "";
  return repoNames.map((r) => {
    const act = repoActivity[r];
    const parts = [];
    if (act.pushes)
      parts.push(`${act.pushes} push(es)`);
    if (act.prs)
      parts.push(`${act.prs} PR(s)`);
    if (act.issues)
      parts.push(`${act.issues} issue(s)`);
    const hl = act.highlights.slice(0, 3).join("; ");
    return `- \`${r}\`: ${parts.join(", ")}${hl ? ` (${hl})` : ""}`;
  }).join("\n");
}
function detectLateSession(dailyLog, gitRows, checkedHabits) {
  let isLate = false;
  let latestTime = "";
  const allTimeStrings = [];
  for (const entry of dailyLog) {
    const m = entry.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m)
      allTimeStrings.push(`${m[1]}:${m[2]} ${m[3]}`);
  }
  for (const r of gitRows) {
    if (r.time)
      allTimeStrings.push(r.time);
  }
  for (const tStr of allTimeStrings) {
    const match = tStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === "PM" && hour < 12)
        hour += 12;
      if (ampm === "AM" && hour === 12)
        hour = 0;
      if (hour > 19 || hour === 19 && minute >= 30) {
        isLate = true;
        latestTime = `${match[1]}:${match[2]} ${ampm}`;
      }
    }
  }
  const missedDisconnect = !checkedHabits.some((h) => h.toLowerCase().includes("disconnect"));
  return { isLate, latestTime, missedDisconnect };
}
var REAL_FALLBACK_QUOTES = [
  { quote: "Give me six hours to chop down a tree and I will spend the first four sharpening the axe.", author: "Abraham Lincoln" },
  { quote: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { quote: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { quote: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { quote: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" },
  { quote: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { quote: "Never let the future disturb you. You will meet it with the same weapons of reason which today arm you against the present.", author: "Marcus Aurelius" }
];
function buildDailyFallback(d) {
  const done = d.completedTasks.length;
  const open = d.unfinishedTasks.length;
  const highPriority = d.unfinishedTasks.find((t) => /#priority\/(p0|p1|high)/i.test(t));
  let p1 = "Bit of a rough start to the day, aye \u2014 running pretty knackered on short sleep, with a few worries hanging over your head and losing time early on.";
  if (d.sleepDebt) {
    p1 = `Bit of a heavy start to the day, aye \u2014 pretty knackered on ${d.sleepHours || 5} hours of sleep, with a few real-life worries creating some drag early on.`;
  }
  let p2 = "Turned it right around in the arvo though. Smashed out key tasks, sorted the code, and kept momentum going strong.";
  if (d.gitRows?.length > 0) {
    p2 = `Turned it right around in the arvo though. Properly got stuck in and smashed out code across ${d.gitRows.length} GitHub events, sorting key milestones and knocking off cleanly.`;
  } else if (done) {
    p2 = `Turned it right around in the arvo though. Got stuck in and sorted ${d.completedTasks.slice(0, 2).join(" and ")}, finishing the day on a solid note.`;
  }
  const debrief = `${p1}

${p2}`;
  const takeaway = "Planning the work before jumping straight into code was the real lifesaver today. Even when energy was a bit low, having the blueprint ready meant zero muck-around and straight execution.";
  let tomorrowMove = "Pick one clear priority first thing in the morning and get it sorted while your head is fresh.";
  if (highPriority) {
    tomorrowMove = `Get stuck into **${highPriority}** first thing in the morning while your head is fresh. Don't leave heavy logic for late in the arvo.`;
  } else if (open) {
    tomorrowMove = `Get stuck into **${d.unfinishedTasks[0]}** first thing tomorrow before opening anything else.`;
  }
  const selectedQuote = REAL_FALLBACK_QUOTES[Math.floor(Math.random() * REAL_FALLBACK_QUOTES.length)];
  return {
    quote: selectedQuote.quote,
    author: selectedQuote.author,
    debrief,
    takeaway,
    tomorrowMove,
    connectedNotes: [`[[${d.yesterdayDate}]]`]
  };
}
async function enrichDailyNote(app, file) {
  const Notice = window.Notice || globalThis.Notice;
  let content = await app.vault.read(file);
  new Notice("\u{1F916} Gemini is analyzing your day with Kiwi Dev Chief of Staff vibes...");
  const mood = readFrontmatterValue(content, "mood");
  const energy = readFrontmatterValue(content, "energy");
  const sleepHours = readFrontmatterValue(content, "sleep_hours");
  const moodText = mood || "not logged";
  const energyText = energy ? `${energy} out of 5` : "not logged";
  const sleepText = sleepHours ? `${sleepHours} hours` : "not logged";
  const existingNoteNames = app.vault.getMarkdownFiles().map((f) => f.basename).filter((name) => name && !name.startsWith("_") && name.length > 2 && !name.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesListStr = existingNoteNames.slice(0, 60).join(", ");
  const gitRows = parseGitHubCalloutFromNote(content);
  const lines = content.split("\n");
  const focusItems = [];
  const completedTasks = [];
  const unfinishedTasks = [];
  const forwardedTasks = [];
  const checkedHabits = [];
  const dailyLog = [];
  const ideas = [];
  const winsLog = [];
  const blockersLog = [];
  const userReflectionLog = [];
  const HABIT_RITUALS = ["water", "prioritised", "move", "read", "tidy", "disconnect"];
  let currentSec = "";
  let inFrontmatter = false;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (i === 0 && trimmed === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === "---")
        inFrontmatter = false;
      continue;
    }
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    if (/^#{1,6}\s+/.test(trimmed)) {
      currentSec = trimmed;
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      currentSec = "";
      continue;
    }
    if (!trimmed || /^[-*+]$/.test(trimmed) || /^[-*+]\s*\[[ xX]\]$/.test(trimmed))
      continue;
    if (trimmed.startsWith(">") || trimmed.startsWith("|"))
      continue;
    if (trimmed.startsWith("Define your focus") || trimmed.startsWith("Things I need") || trimmed.startsWith("Daily basics") || trimmed.startsWith("Something positive") || trimmed.startsWith("What got in my way") || trimmed.startsWith("What did I learn") || trimmed.startsWith("What did I do today") || trimmed.startsWith("What patterns do I notice") || trimmed.startsWith("Based on today") || trimmed.startsWith("What's the 1-3 things")) {
      continue;
    }
    if (currentSec.includes("Focus")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").replace(/^\[[ xX]\]\s*/, "").trim();
      if (cleanItem && !focusItems.includes(cleanItem))
        focusItems.push(cleanItem);
    } else if (currentSec.includes("Tasks")) {
      const doneMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
      const fwdMatch = trimmed.match(/^\s*-\s*\[>\]\s+(.*)$/);
      const openMatch = trimmed.match(/^\s*-\s*\[ \]\s+(.*)$/);
      if (doneMatch && stripTaskMetadata(doneMatch[1])) {
        const itemText = stripTaskMetadata(doneMatch[1]);
        if (!completedTasks.includes(itemText))
          completedTasks.push(itemText);
      } else if (fwdMatch && stripTaskMetadata(fwdMatch[1])) {
        const itemText = stripTaskMetadata(fwdMatch[1]);
        if (!forwardedTasks.includes(itemText))
          forwardedTasks.push(itemText);
      } else if (openMatch && stripTaskMetadata(openMatch[1]) && stripTaskMetadata(openMatch[1]) !== "..." && stripTaskMetadata(openMatch[1]) !== "None") {
        const itemText = stripTaskMetadata(openMatch[1]);
        if (!unfinishedTasks.includes(itemText))
          unfinishedTasks.push(itemText);
      }
    } else if (currentSec.includes("Ideas")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, ""))
        ideas.push(cleanItem);
    } else if (currentSec.includes("Log") && !currentSec.includes("Blockers")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, ""))
        dailyLog.push(cleanItem);
    } else if (currentSec.includes("Habits")) {
      const habitMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
      if (habitMatch && stripTaskMetadata(habitMatch[1])) {
        const habitText = stripTaskMetadata(habitMatch[1]);
        if (!checkedHabits.includes(habitText))
          checkedHabits.push(habitText);
      }
    } else if (currentSec.includes("Wins")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, ""))
        winsLog.push(cleanItem);
    } else if (currentSec.includes("Blockers")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, ""))
        blockersLog.push(cleanItem);
    } else if (currentSec.includes("Reflection") && !currentSec.includes("AI Reflection")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, ""))
        userReflectionLog.push(cleanItem);
    }
  }
  const filledSectionCount = [
    focusItems.length,
    completedTasks.length + unfinishedTasks.length + forwardedTasks.length,
    checkedHabits.length,
    dailyLog.length + gitRows.length,
    ideas.length,
    winsLog.length,
    blockersLog.length,
    userReflectionLog.length
  ].filter((count) => count > 0).length;
  if (filledSectionCount < 1) {
    new Notice("\u26A0\uFE0F Daily note is mostly empty! Log something in Focus, Tasks, Daily Log, Wins, Blockers or Reflection before generating the AI summary.", 7e3);
    return;
  }
  const githubSummary = extractGitHubSummary(gitRows, dailyLog);
  const highPriorityTasks = unfinishedTasks.filter((t) => /#priority\/(p0|p1|high)/i.test(t));
  const lateSession = detectLateSession(dailyLog, gitRows, checkedHabits);
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const geminiMatch = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (geminiMatch && !geminiMatch[1].includes("your_gemini"))
      geminiApiKey = geminiMatch[1].trim();
  } catch (e) {
  }
  const noteDate = (file.basename.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || formatDate(/* @__PURE__ */ new Date());
  const yesterdayDate = previousDateStr(noteDate);
  const sleepNum = parseFloat(sleepHours);
  const energyNum = parseFloat(energy);
  const sleepDebt = !isNaN(sleepNum) && sleepNum < 6;
  const isDepleted = sleepDebt && !isNaN(energyNum) && energyNum < 3;
  const systemPrompt = [
    "You are this person's Kiwi Chief of Staff & Dev Mate.",
    "You write in casual, authentic Kiwi English (New Zealand dev vibe) \u2014 relaxed, conversational, grounded, sharp, friendly, and honest.",
    "Use natural Kiwi expressions and cadence (e.g. 'aye', 'arvo', 'knackered', 'proper shift', 'sorted', 'sweet as', 'chur', 'muck-around', 'knocked off', 'get stuck in') naturally without overdoing it.",
    "CRITICAL FOR QUOTE: You must pick a REAL, famous, verified quote from a real-world philosopher, author, engineer, scientist, leader, or thinker (e.g. Marcus Aurelius, Seneca, James Clear, Linus Torvalds, Abraham Lincoln, Edsger Dijkstra, Alan Kay, Epictetus, Steve Jobs). NEVER make up a fake quote or attribute to 'Daily Spark'.",
    "Never sound corporate, clinical, robotic, or like a LinkedIn performance review. Never use bullet points inside debrief \u2014 write natural, engaging narrative prose.",
    "You never invent facts. You always answer with valid JSON only."
  ].join(" ");
  const userPromptText = `Analyse this day and fill the AI Daily Summary in Kiwi English.

METADATA
Mood: ${moodText}
Energy: ${energyText}
Sleep: ${sleepText}

TODAY'S FOCUS (intentions)
${focusItems.length ? focusItems.map((f) => "- " + f).join("\n") : "- none written"}

TASKS
Completed: ${completedTasks.join(" | ") || "none"}
Still open: ${unfinishedTasks.join(" | ") || "none"}
High Priority Open Tasks: ${highPriorityTasks.join(" | ") || "none"}
Forwarded from an earlier day: ${forwardedTasks.join(" | ") || "none"}

DAILY LOG (personal notes)
${dailyLog.length ? dailyLog.map((l) => "- " + l).join("\n") : "- none logged"}

GITHUB DEVELOPER ACTIVITY (grouped by project)
${githubSummary || "- no GitHub events logged"}

PACING & RECOVERY SIGNALS
Late evening coding session (>7:30 PM): ${lateSession.isLate ? `YES (latest at ${lateSession.latestTime})` : "NO"}
Disconnect habit kept: ${!lateSession.missedDisconnect ? "YES" : "NO"}

HABITS
Kept ${checkedHabits.length} of ${HABIT_RITUALS.length}: ${checkedHabits.join(", ") || "none"}

IDEAS & FLEETING NOTES
${ideas.length ? ideas.map((i) => "- " + i).join("\n") : "- none"}

END OF DAY (written by them)
Wins: ${winsLog.join(" | ") || "none"}
Blockers: ${blockersLog.join(" | ") || "none"}
Reflection: ${userReflectionLog.join(" | ") || "none"}

EXISTING VAULT NOTES (valid link targets)
[${existingNotesListStr}]
Yesterday's daily note: ${yesterdayDate}

WHAT TO PRODUCE
"quote": "A REAL, verified quote from a famous real-world philosopher, author, engineer, scientist, or thinker (e.g. Marcus Aurelius, Seneca, James Clear, Linus Torvalds, Edsger Dijkstra, Epictetus, Steve Jobs) that fits the theme of the day (e.g. preparation, systems over willpower, resilience, rest, code craftsmanship).",
"author": "The REAL author's full name (e.g. 'Marcus Aurelius', 'James Clear', 'Linus Torvalds') \u2014 NEVER 'Daily Spark'.",
"debrief": "2 short narrative paragraphs capturing the day's full story in Kiwi English:
  - Paragraph 1: The morning reality, sleep, and friction (knackered on short sleep, stress, wait times).
  - Paragraph 2: The afternoon turnaround (getting stuck in, shipping code across repositories, sorting milestones, and knocking off on time / keeping habits).
  Be specific about project names (loey_space, shelf) and features built. Never use bullet points inside debrief \u2014 write natural prose.",
"takeaway": "ONE sharp Kiwi Chief of Staff takeaway paragraph on why the system worked (e.g. why planning before coding saved the day, preventing muck-around and decision fatigue even when knackered).",
"tomorrowMove": "ONE clear, regular paragraph (1-2 sentences) anchored on high priority open tasks (#priority/p0 or p1). Phrased in Kiwi English: 'Get stuck into [[Task]] first thing...'.${sleepDebt ? ` Acknowledge the sleep debt honestly.` : ""}",
"connectedNotes": "start with '[[${yesterdayDate}]]' (always). Then 2-4 notes explicitly named in tasks, log, or ideas."

HARD RULES
1. Never invent meetings, people, projects or tasks that are not written above.
2. Never use clinical or therapy language. Banned: 'emotional distress', 'interpersonal conflict', 'significant impact', 'well-being', 'wellbeing', 'restorative', 'process your emotions', 'process the conflict'.
3. DO NOT repeat identical words or phrases across paragraphs.
4. Balance friction with resilience.
5. ${isDepleted ? `Sleep was under 6 hours AND energy under 3 \u2014 say plainly that capacity was capped, without turning it into a lecture.` : `Do not speculate about sleep or energy unless the numbers are notable.`}
6. Conversational, warm, sharp Kiwi English. No corporate jargon.
7. Always provide a REAL, historical/famous author for the quote.

JSON format:
{
  "quote": "Real quote from a real thinker",
  "author": "Real Author Name",
  "debrief": "paragraph 1

paragraph 2",
  "takeaway": "one sharp paragraph",
  "tomorrowMove": "Get stuck into [[Task]] ...",
  "connectedNotes": ["[[${yesterdayDate}]]"]
}
`;
  let responseData = null;
  let usedFallback = false;
  let failureReason = "";
  if (geminiApiKey) {
    const result = await callGeminiJson(geminiApiKey, systemPrompt, userPromptText, "Daily Enrich", 0.7);
    if (result && result.data && (result.data.debrief || result.data.takeaway || result.data.vibe)) {
      responseData = result.data;
      console.log(`Daily Enrich: generated with ${result.model}`);
    } else {
      failureReason = formatGeminiFailure(result && result.failure);
    }
  } else {
    failureReason = formatGeminiFailure({ status: 0, kind: "noKey", message: "GEMINI_API_KEY is missing from .env", retrySeconds: 0, model: "" });
  }
  if (!responseData) {
    usedFallback = true;
    responseData = buildDailyFallback({
      mood,
      energy,
      sleepHours,
      sleepDebt,
      isDepleted,
      focusItems,
      completedTasks,
      unfinishedTasks,
      forwardedTasks,
      checkedHabits,
      habitTotal: HABIT_RITUALS.length,
      dailyLog,
      ideas,
      winsLog,
      blockersLog,
      userReflectionLog,
      yesterdayDate,
      gitRows,
      gitSummary: githubSummary,
      lateSession
    });
  }
  const debriefText = (responseData.debrief || responseData.vibe || "").trim();
  const takeawayText = (responseData.takeaway || responseData.insight || responseData.pattern || "").trim();
  const tomorrowMoveText = (responseData.tomorrowMove || responseData.nextStep || "").trim();
  responseData.quote = toSingleLine(responseData.quote) || "You do not rise to the level of your goals. You fall to the level of your systems.";
  responseData.author = toSingleLine(responseData.author) || "James Clear";
  const validTargets = /* @__PURE__ */ new Map();
  app.vault.getMarkdownFiles().forEach((f) => validTargets.set(f.basename.toLowerCase(), f.basename));
  const userCorpus = [].concat(
    focusItems,
    completedTasks,
    unfinishedTasks,
    forwardedTasks,
    dailyLog,
    ideas,
    winsLog,
    blockersLog,
    userReflectionLog
  ).join(" \n ").toLowerCase();
  const isNamedByUser = (target) => {
    const lower = target.toLowerCase();
    if (validTargets.has(lower) && userCorpus.includes(lower))
      return true;
    const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4);
    if (tokens.length === 0)
      return false;
    const hits = tokens.filter((word) => userCorpus.includes(word)).length;
    return hits >= 2;
  };
  const connectedLinks = [];
  const seenLinks = /* @__PURE__ */ new Set();
  const addConnected = (rawLink, force) => {
    const target = wikiLinkTarget(normalizeWikiLink(rawLink));
    if (!target)
      return;
    const key = target.toLowerCase();
    if (key === file.basename.toLowerCase() || seenLinks.has(key))
      return;
    if (!force && !isNamedByUser(target)) {
      console.warn(`Daily Enrich: dropped link "[[${target}]]" \u2014 not named anywhere in the note`);
      return;
    }
    seenLinks.add(key);
    connectedLinks.push(`[[${validTargets.get(key) || target}]]`);
  };
  addConnected(`[[${yesterdayDate}]]`, true);
  (Array.isArray(responseData.connectedNotes) ? responseData.connectedNotes : []).forEach((link) => addConnected(link, false));
  while (connectedLinks.length > 5)
    connectedLinks.pop();
  const authorText = responseData.author ? `
> \u2014 **${responseData.author}**` : "";
  const quoteCallout = `> [!QUOTE] \u{1F4A1} Daily Spark
> *"${responseData.quote}"*${authorText}`;
  if (content.includes("> [!QUOTE] \u{1F4A1} Daily Spark")) {
    content = content.replace(
      /> \[!QUOTE\] 💡 Daily Spark[\s\S]*?(?=\r?\n\r?\n#{1,6} |\r?\n---[ \t]*\r?\n|(?![\s\S]))/,
      escapeReplacement(quoteCallout)
    );
  }
  const aiSummaryBlock = `## \u{1F916} AI Daily Summary

### \u{1F4D6} Daily Debrief
${debriefText || "Bit of a quiet one today \u2014 not much made it into the log."}

### \u{1F9E0} Chief of Staff Takeaway
${takeawayText || "Keep things simple and plan before you build."}

### \u{1F3AF} Tomorrow's Move
${tomorrowMoveText || "Pick your main target first thing in the morning."}
`;
  const aiSectionRe = /^## 🤖 AI Daily Summary[\s\S]*?(?=^## |^---[ \t]*$|(?![\s\S]))/m;
  if (aiSectionRe.test(content)) {
    content = content.replace(aiSectionRe, escapeReplacement(aiSummaryBlock));
  } else {
    content = content.replace(/\s*$/, "") + "\n\n" + aiSummaryBlock;
  }
  const connectedBlock = connectedLinks.map((link) => `- ${link}`).join("\n");
  if (/^##### 🔗 Connected Notes[ \t]*$/m.test(content)) {
    content = replaceSectionBody(content, "##### \u{1F517} Connected Notes", connectedBlock);
  } else {
    content = content.replace(/\s*$/, "") + `

---

##### \u{1F517} Connected Notes
${connectedBlock}
`;
  }
  await app.vault.modify(file, content);
  if (usedFallback) {
    new Notice(
      `\u26A0\uFE0F No AI writing this time: ${failureReason}.

A basic offline summary was assembled from your logged items instead. Re-run the enricher once the limit clears to replace it with real AI analysis.`,
      12e3
    );
  } else {
    new Notice("\u2728 Daily Note enriched with Kiwi Chief of Staff vibes & real quote!");
  }
}

// 06-Resources/scripts/src/ai-enrich-action.ts
module.exports = async function aiEnrichAction(params) {
  const app = params?.app || window.app || globalThis.app;
  const Notice = window.Notice || globalThis.Notice;
  const file = app.workspace.getActiveFile();
  if (!file) {
    new Notice("\u26A0\uFE0F Please open a note first!");
    return;
  }
  const isDaily = file.path.startsWith("01-Daily");
  const isConcept = file.path.startsWith("08-Concepts");
  const isDev = file.path.startsWith("03-Dev");
  const isLearning = file.path.startsWith("04-Learning");
  if (!isDaily && !isConcept && !isDev && !isLearning) {
    new Notice("\u26A0\uFE0F Please open a Daily, Concept, Dev, or Learning note first!");
    return;
  }
  if (isConcept) {
    await enrichConceptNote(app, file);
  } else if (isDev) {
    await enrichDevNote(app, file);
  } else if (isLearning) {
    await enrichLearningNote(app, file);
  } else {
    await enrichDailyNote(app, file);
  }
};
