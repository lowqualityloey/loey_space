var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// 06-Resources/scripts/src/distill-concept-action.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

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
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function toSingleLine(value) {
  if (value === void 0 || value === null)
    return "";
  const raw = Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value);
  return raw.replace(/\r?\n+/g, " ").replace(/^\s*>+\s*/, "").replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/^\s*#{1,6}\s*/, "").replace(/\s{2,}/g, " ").trim();
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

// 06-Resources/scripts/src/lib/distiller.ts
function buildConceptNoteMarkdown(concept, sourceNoteBasename, createdDate) {
  const today = createdDate || formatDate(/* @__PURE__ */ new Date());
  const area = concept.area || "dev";
  const topicTag = concept.topicTag || "topic/concept";
  const tags = [
    "type/concept",
    `area/${area}`,
    topicTag.startsWith("topic/") ? topicTag : `topic/${topicTag}`,
    "status/active"
  ];
  const aliasesFormatted = Array.isArray(concept.aliases) && concept.aliases.length > 0 ? `aliases:
${concept.aliases.map((a) => `  - "${toSingleLine(a).replace(/"/g, '\\"')}"`).join("\n")}` : "aliases: []";
  const summary = toSingleLine(concept.summary);
  const mentalModel = concept.mentalModel ? concept.mentalModel.trim() : "";
  const whyItMattersLines = Array.isArray(concept.whyItMatters) && concept.whyItMatters.length > 0 ? concept.whyItMatters.map((w) => `- ${toSingleLine(w)}`).join("\n") : `- Core architectural principle that improves codebase maintainability and correctness.`;
  const examplesLines = Array.isArray(concept.examples) && concept.examples.length > 0 ? concept.examples.map((e) => `- ${toSingleLine(e)}`).join("\n") : `- Standard application in system design.`;
  const sourceSection = sourceNoteBasename ? `## \u{1F517} Source & References
- Extracted from: [[${sourceNoteBasename}]]

` : "";
  return `---
created: ${today}
updated: ${today}
last_reviewed: ${today}
review_cycle: 90d
type: concept
status: active
area: ${area}
tags:
${tags.map((t) => `  - ${t}`).join("\n")}
${aliasesFormatted}
---

# \u{1F4A1} ${concept.title}

> **${summary}**

---

## \u{1F9E0} Core Mental Model
${mentalModel || summary}

## \u{1F3AF} Why It Matters
${whyItMattersLines}

## \u{1F6E0}\uFE0F Practical Examples
${examplesLines}

${sourceSection}## \u{1F504} Related Notes (Auto-Backlinks)
\`\`\`dataview
LIST
FROM [[]] AND !"99-Templates"
WHERE file.name != this.file.name
SORT file.mtime DESC
\`\`\`
`;
}
async function distillConceptsFromContent(apiKey, content, sourceTitle, existingConcepts) {
  const existingStr = existingConcepts.slice(0, 60).join(", ");
  const systemPrompt = [
    "You are a senior knowledge architect and Zettelkasten curator.",
    "You extract atomic, evergreen mental models and principles from articles, dev logs, and tutorials.",
    "An atomic concept represents ONE standalone idea that is timeless, generalizable, and not tied solely to this one specific article.",
    "Always output valid JSON only."
  ].join(" ");
  const userPrompt = `Analyze this document and distill 1 to 3 atomic evergreen concepts from it.

Document Title: "${sourceTitle}"
Existing Vault Concepts: [${existingStr}]

Content:
${content.slice(0, 5e3)}

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
  const result = await callGeminiJson(apiKey, systemPrompt, userPrompt, "Distill Concepts", 0.4);
  if (!result || !result.data || !Array.isArray(result.data.concepts)) {
    return { concepts: [], model: result?.model || "", failure: result?.failure };
  }
  return { concepts: result.data.concepts, model: result.model, failure: null };
}

// 06-Resources/scripts/src/distill-concept-action.ts
function isTFile(file) {
  return Boolean(file && typeof file === "object" && "extension" in file && "path" in file);
}
function resolveVaultPath() {
  const fromCwd = process.cwd();
  if (fs.existsSync(path.join(fromCwd, "08-Concepts")) || fs.existsSync(path.join(fromCwd, "06-Resources"))) {
    return fromCwd;
  }
  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, "08-Concepts")) || fs.existsSync(path.join(current, "06-Resources"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current)
      break;
    current = parent;
  }
  return process.cwd();
}
async function distillConceptAction(params) {
  const app = params?.app || (typeof window !== "undefined" ? window.app : globalThis.app);
  const Notice = typeof window !== "undefined" ? window.Notice : globalThis.Notice;
  if (!app) {
    runCli();
    return;
  }
  const file = app.workspace.getActiveFile();
  if (!file || !isTFile(file)) {
    if (Notice)
      new Notice("\u26A0\uFE0F Please open an article or note to distill!");
    return;
  }
  if (Notice)
    new Notice(`\u{1F9E0} Distilling evergreen concepts from "${file.basename}"...`);
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes("your_gemini"))
      geminiApiKey = match[1].trim();
  } catch (e) {
  }
  if (!geminiApiKey) {
    if (Notice)
      new Notice("\u26A0\uFE0F GEMINI_API_KEY missing in .env!");
    return;
  }
  const existingConcepts = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith("08-Concepts") && !f.basename.startsWith("_")).map((f) => f.basename);
  let content = await app.vault.read(file);
  const { concepts, model, failure } = await distillConceptsFromContent(
    geminiApiKey,
    content,
    file.basename,
    existingConcepts
  );
  if (!concepts || concepts.length === 0) {
    if (Notice) {
      new Notice(`\u26A0\uFE0F Could not distill concepts: ${formatGeminiFailure(failure)}`, 8e3);
    }
    return;
  }
  const createdLinks = [];
  for (const concept of concepts) {
    const safeTitle = concept.title.replace(/[\\/:*?"<>|]/g, "").trim();
    if (!safeTitle)
      continue;
    const notePath = `08-Concepts/${safeTitle}.md`;
    const noteMarkdown = buildConceptNoteMarkdown(concept, file.basename);
    const existingAbstract = app.vault.getAbstractFileByPath(notePath);
    if (existingAbstract && isTFile(existingAbstract)) {
      await app.vault.modify(existingAbstract, noteMarkdown);
    } else {
      await app.vault.create(notePath, noteMarkdown);
    }
    createdLinks.push(`[[${safeTitle}]]`);
  }
  if (createdLinks.length > 0) {
    const linksBody = `*Atomic evergreen concepts distilled from this note:*
` + createdLinks.map((l) => `- ${l}`).join("\n");
    if (/^## 💡 Extracted (?:Evergreen )?Concepts/m.test(content)) {
      content = replaceSectionBody(content, "## \u{1F4A1} Extracted Evergreen Concepts", linksBody);
    } else {
      content = content.replace(/\s*$/, "") + `

---

## \u{1F4A1} Extracted Evergreen Concepts
${linksBody}
`;
    }
    await app.vault.modify(file, content);
  }
  if (Notice) {
    new Notice(`\u2728 Distilled ${createdLinks.length} concept(s) into 08-Concepts/ with ${model}!`, 6e3);
  }
}
function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const targetRelPath = args.find((a) => !a.startsWith("-"));
  console.log("\u{1F9E0} Automatic Concept Distiller (CLI Mode)...");
  console.log(`\u{1F4C2} Vault Root: ${vaultRoot}
`);
  let geminiApiKey = "";
  try {
    const envContent = fs.readFileSync(path.join(vaultRoot, ".env"), "utf8");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes("your_gemini"))
      geminiApiKey = match[1].trim();
  } catch (e) {
  }
  if (!geminiApiKey) {
    console.error("\u274C GEMINI_API_KEY missing in .env!");
    process.exit(1);
  }
  let targetFile = targetRelPath;
  if (!targetFile) {
    const articlesDir = path.join(vaultRoot, "06-Resources/Articles");
    if (fs.existsSync(articlesDir)) {
      const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
      if (files.length > 0) {
        targetFile = path.join("06-Resources/Articles", files[0]).replace(/\\/g, "/");
      }
    }
  }
  if (!targetFile) {
    console.error("\u26A0\uFE0F No target file specified. Usage: node distill-concept-action.js <path/to/note.md>");
    process.exit(1);
  }
  const fullPath = path.isAbsolute(targetFile) ? targetFile : path.join(vaultRoot, targetFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`\u274C Target file does not exist: ${fullPath}`);
    process.exit(1);
  }
  const basename2 = path.basename(fullPath, ".md");
  let content = fs.readFileSync(fullPath, "utf8");
  console.log(`\u{1F4D6} Analyzing: "${basename2}" (${targetFile})...
`);
  const conceptsDir = path.join(vaultRoot, "08-Concepts");
  if (!fs.existsSync(conceptsDir)) {
    fs.mkdirSync(conceptsDir, { recursive: true });
  }
  const existingConcepts = fs.readdirSync(conceptsDir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => path.basename(f, ".md"));
  (async () => {
    const { concepts, model, failure } = await distillConceptsFromContent(
      geminiApiKey,
      content,
      basename2,
      existingConcepts
    );
    if (!concepts || concepts.length === 0) {
      console.error(`\u274C Could not distill concepts: ${formatGeminiFailure(failure)}`);
      process.exit(1);
    }
    console.log(`\u{1F389} Distilled ${concepts.length} atomic concept(s) using ${model}:
`);
    const createdLinks = [];
    for (const concept of concepts) {
      const safeTitle = concept.title.replace(/[\\/:*?"<>|]/g, "").trim();
      const notePath = path.join(conceptsDir, `${safeTitle}.md`);
      const noteMarkdown = buildConceptNoteMarkdown(concept, basename2);
      fs.writeFileSync(notePath, noteMarkdown, "utf8");
      console.log(`  \u{1F4A1} Created: 08-Concepts/${safeTitle}.md`);
      console.log(`     Summary: ${concept.summary}`);
      createdLinks.push(`[[${safeTitle}]]`);
    }
    const linksBody = `*Atomic evergreen concepts distilled from this note:*
` + createdLinks.map((l) => `- ${l}`).join("\n");
    if (/^## 💡 Extracted (?:Evergreen )?Concepts/m.test(content)) {
      content = replaceSectionBody(content, "## \u{1F4A1} Extracted Evergreen Concepts", linksBody);
    } else {
      content = content.replace(/\s*$/, "") + `

---

## \u{1F4A1} Extracted Evergreen Concepts
${linksBody}
`;
    }
    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`
\u2705 Updated source note with backlinks!`);
  })();
}
if (require.main === module) {
  runCli();
}
module.exports = Object.assign(distillConceptAction, {
  buildConceptNoteMarkdown
});
