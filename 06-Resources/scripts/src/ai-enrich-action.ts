export = async function aiEnrichAction(params: any) {
  const app = (params && params.app) ? params.app : ((window as any).app || (globalThis as any).app);
  const file = app.workspace.getActiveFile();

  if (!file) {
    new Notice("⚠️ Please open a note first!");
    return;
  }

  const isDaily = file.path.startsWith("01-Daily");
  const isConcept = file.path.startsWith("08-Concepts");
  const isDev = file.path.startsWith("03-Dev");
  const isLearning = file.path.startsWith("04-Learning");

  if (!isDaily && !isConcept && !isDev && !isLearning) {
    new Notice("⚠️ Please open a Daily, Concept, Dev, or Learning note first!");
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

/* ==========================================================================
   SHARED HELPERS
   ========================================================================== */

// Model order matters for output quality. gemini-1.5-flash was retired and now
// answers 404, and the 2.0 series is legacy, so 2.5 is tried first and the
// cheaper/higher-quota models are used only as fallbacks.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

// Reads one single-line YAML scalar from the frontmatter block.
// The character class deliberately excludes line breaks: with /\s*(.*)/ a blank
// property captures the NEXT property name, which is what produced the
// "energy:", "sleep_hours:/5" and "tags:h" text in generated summaries.
function readFrontmatterValue(content, key) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const scope = fm ? fm[1] : content;
  const match = scope.match(new RegExp("^" + key + ":[ \\t]*([^\\r\\n]*)$", "m"));
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "").trim();
}

// Local YYYY-MM-DD (never UTC, which can shift the date near midnight).
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The day before a YYYY-MM-DD string, used for the daily-note chain link.
function previousDateStr(dateStr) {
  const parts = String(dateStr).split("-").map(Number);
  const date = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  if (isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

// Collapses model output into one clean line so generated text can never break
// the bullet layout of a template section or inject extra headings.
function toSingleLine(value) {
  if (value === undefined || value === null) return "";
  const raw = Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value);
  return raw
    .replace(/\r?\n+/g, " ")
    .replace(/^\s*>+\s*/, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// "$&", "$1" etc. are replacement patterns for String.replace, so AI text must
// be escaped before it is ever used as a replacement value.
function escapeReplacement(text) {
  return String(text).replace(/\$/g, "$$$$");
}

// Accepts "React", "[[React]]", "==[[React]]==", "**[[React]]**", "- [[React]]"
// or "[[React|alias]]" and returns one well-formed link, keeping the highlight
// when the source used one.
function normalizeWikiLink(raw) {
  let text = toSingleLine(raw).replace(/^-?\s*\[[ xX]\]\s*/, "").trim();
  if (!text) return "";

  let highlighted = false;
  for (let i = 0; i < 4; i++) {
    const wrapped = text.match(/^(==|\*\*|__|\*|_)([\s\S]+)\1$/);
    if (!wrapped) break;
    if (wrapped[1] === "==") highlighted = true;
    text = wrapped[2].trim();
  }

  const inner = text.match(/^\[\[([^\[\]]+)\]\]$/);
  const target = (inner ? inner[1] : text.replace(/^\[+|\]+$/g, "")).trim();
  if (!target || target === "|" || target === "#") return "";

  const link = `[[${target}]]`;
  return highlighted ? `==${link}==` : link;
}

// The note name a link points at, ignoring alias and heading parts.
function wikiLinkTarget(link) {
  const inner = String(link).match(/\[\[([^\[\]]+)\]\]/);
  if (!inner) return "";
  return inner[1].split("|")[0].split("#")[0].trim();
}

// Replaces only a section body: from its heading to the next heading, code
// fence, horizontal rule or true end of file. Never swallows the rest of a note.
function replaceSectionBody(content, headingLiteral, bodyText) {
  const heading = headingLiteral.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    "(^" + heading + "[ \\t]*\\r?\\n)[\\s\\S]*?(?=^#{1,6} |^```|^---[ \\t]*$|(?![\\s\\S]))",
    "m"
  );
  if (!re.test(content)) return content;
  // A replacer function returns literal text, so bodyText must NOT be escaped
  // here — escaping would turn a real "$1" in the text into "$$1".
  return content.replace(re, (match, headingLine) => headingLine + bodyText + "\n\n");
}

// Adds a tag under the frontmatter "tags:" key, checking for duplicates inside
// the frontmatter only (a body mention must not suppress a real tag).
function addFrontmatterTag(content, tag) {
  const clean = toSingleLine(tag).replace(/^#/, "").trim();
  if (!clean) return content;
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return content;
  if (new RegExp("^\\s*-\\s*" + clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "m").test(fm[1])) return content;
  return content.replace(/(^tags:[ \t]*\r?\n)/m, (m, key) => key + "  - " + clean + "\n");
}

// Strips Tasks-plugin metadata (✅ 2026-08-09, 📅 dates, priorities, recurrence)
// so logged items read as plain language in generated text.
function stripTaskMetadata(text) {
  return String(text)
    .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ")
    .replace(/\s*\^[A-Za-z0-9]+\s*$/, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Ends a fragment with exactly one period.
function asSentence(text) {
  const clean = String(text).trim().replace(/[.,;:\s]+$/, "");
  if (!clean) return "";
  return /[!?]$/.test(clean) ? clean : clean + ".";
}

// Classifies a Gemini error response. Google puts the useful information in the
// response body: a RetryInfo entry with retryDelay, and a QuotaFailure entry
// whose quotaId says whether the limit was per-minute or per-day.
function parseGeminiError(status: any, bodyText: any, model: any): any {
  let message = "";
  let retrySeconds = 0;
  let quotaId: any = "";
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
        if (seconds) retrySeconds = Math.ceil(parseFloat(seconds[1]));
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
    if (/PerDay/i.test(quotaId)) kind = "quotaPerDay";
    else if (/PerMinute/i.test(quotaId)) kind = "quotaPerMinute";
    else if (/Token/i.test(quotaId)) kind = "quotaTokens";
    else kind = retrySeconds > 120 ? "quotaPerDay" : "quotaPerMinute"; // no QuotaFailure detail
  } else if (status === 404) kind = "modelMissing";
  else if (status === 400) kind = "badRequest";
  else if (status === 401 || status === 403) kind = "auth";
  else if (status >= 500) kind = "serverError";

  return { status, kind, message, retrySeconds, quotaId, quotaValue, model };
}

// Free-tier daily quotas reset at midnight Pacific, expressed in local time.
function describeQuotaReset() {
  try {
    const now = new Date();
    const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const msUntilReset = ((24 - pacific.getHours()) * 60 - pacific.getMinutes()) * 60 * 1000;
    const resetLocal = new Date(now.getTime() + msUntilReset);
    const hours = Math.max(1, Math.round(msUntilReset / 3600000));
    const clock = resetLocal.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `in about ${hours}h (around ${clock} your time)`;
  } catch (e) {
    return "at midnight Pacific time";
  }
}

// Turns a failure into one plain-language sentence for the Obsidian notice.
function formatGeminiFailure(failure) {
  if (!failure) return "the request failed";

  switch (failure.kind) {
    case "quotaPerMinute":
      return failure.retrySeconds
        ? `per-minute rate limit hit — Google says retry in about ${failure.retrySeconds}s`
        : "per-minute rate limit hit — wait about a minute and run it again";
    case "quotaPerDay":
      return `daily free-tier quota used up${failure.quotaValue ? ` (limit ${failure.quotaValue} requests/day on ${failure.model})` : ""} — resets ${describeQuotaReset()}, so waiting a few minutes will NOT help`;
    case "quotaTokens":
      return "tokens-per-minute quota hit — wait a minute, or shorten the note";
    case "auth":
      return `API key rejected (HTTP ${failure.status}) — check GEMINI_API_KEY in .env`;
    case "badRequest":
      return `request rejected (400): ${failure.message || "invalid request"}`;
    case "modelMissing":
      return "none of the configured models are available for this key (404)";
    case "serverError":
      return `Google server error (${failure.status}) — try again shortly`;
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

// One Gemini request with model fallback and quota-aware retries.
// requestUrl throws on non-2xx and discards the response body, so "throw: false"
// is required to read the status and the quota details Google sends back.
async function callGeminiJson(apiKey, systemPrompt, userPrompt, label, temperature) {
  let failure: any = { status: 0, kind: "unknown", message: "request failed", retrySeconds: 0, model: "" };

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res = null;

      try {
        res = await requestUrl({
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          throw: false,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: typeof temperature === "number" ? temperature : 0.6
            }
          })
        });
      } catch (e) {
        failure = { status: 0, kind: "network", message: e && e.message ? e.message : String(e), retrySeconds: 0, model };
        console.warn(`${label}: ${model} network error — ${failure.message}`);
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
              status: 200, kind: "emptyResponse", retrySeconds: 0, model,
              message: `finishReason: ${candidate ? candidate.finishReason : "none"}`
            };
            console.warn(`${label}: ${model} returned no usable content`, json);
            break;
          }

          const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
          return { data: JSON.parse(clean), model, failure: null };
        } catch (e) {
          failure = { status: 200, kind: "badJson", message: e && e.message ? e.message : String(e), retrySeconds: 0, model };
          console.warn(`${label}: ${model} returned unparsable JSON — ${failure.message}`);
          break;
        }
      }

      failure = parseGeminiError(res.status, res.text, model) as any;
      console.warn(`${label}: ${model} → HTTP ${res.status} [${failure.kind}]${failure.quotaId ? ` quotaId=${failure.quotaId}` : ""}${failure.retrySeconds ? ` retryDelay=${failure.retrySeconds}s` : ""} — ${failure.message}`);

      // Only a per-minute limit is worth waiting out mid-run. A daily limit will
      // not clear in seconds, so retrying the same model just wastes time.
      if (failure.kind === "quotaPerMinute" && attempt === 0) {
        const waitSeconds = Math.min(Math.max(failure.retrySeconds || 6, 5), 20);
        console.log(`${label}: waiting ${waitSeconds}s before retrying ${model}`);
        await new Promise(r => setTimeout(r, waitSeconds * 1000));
        continue;
      }
      break;
    }

    // A bad key or malformed request fails identically on every model.
    if (failure.kind === "auth" || failure.kind === "badRequest") {
      console.warn(`${label}: aborting model fallback — ${failure.kind} affects all models`);
      break;
    }
  }

  console.warn(`${label}: all models failed — ${formatGeminiFailure(failure)}`);
  return { data: null, model: "", failure };
}

/* ==========================================================================
   DEV NOTE AI ENRICHER
   ========================================================================== */
async function enrichDevNote(app, file) {
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
    .map(f => f.basename)
    .filter(n => n && !n.startsWith("_") && n !== noteTitle && !n.match(/^\d{4}-\d{2}-\d{2}/));
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
      data.tags.forEach(t => { content = addFrontmatterTag(content, t); });
    }

    // Update Context
    if (data.context) {
      let ctxLines = [];
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
      if (items.length) content = replaceSectionBody(content, "## Code Explanation", items.map(e => `- ${e}`).join("\n"));
    }

    // Update Related — normalized links, bounded replacement so the rest of the
    // note (including any dataview block) is preserved.
    if (Array.isArray(data.related)) {
      const seen = new Set();
      const links = [];
      data.related.forEach(r => {
        const normalized = normalizeWikiLink(r);
        const target = wikiLinkTarget(normalized);
        if (!target || seen.has(target.toLowerCase())) return;
        seen.add(target.toLowerCase());
        links.push(normalized);
      });
      if (links.length) content = replaceSectionBody(content, "## Related", links.map(l => `- ${l}`).join("\n"));
    }

    await app.vault.modify(file, content);
    new Notice(`✨ Dev note "${noteTitle}" enriched with AI! (${devResult.model})`);

  } catch (err) {
    console.error("Failed to apply Dev enrichment:", err);
    new Notice("⚠️ Failed to apply AI Dev response.");
  }
}

/* ==========================================================================
   CONCEPT NOTE AI ENRICHER
   ========================================================================== */
async function enrichConceptNote(app, file) {
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
    .map(f => f.basename)
    .filter(n => n && !n.startsWith("_") && n !== conceptName && !n.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesStr = existingNotes.slice(0, 60).join(", ");

  // 3. Links the user already wrote in the note, including highlighted ones
  //    like ==[[React]]==, so existing connections are kept rather than wiped.
  const existingLinksInNote = [];
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
      data.tags.forEach(t => { content = addFrontmatterTag(content, t); });
    }

    // Update Summary
    const summary = toSingleLine(data.summary);
    if (summary) content = replaceSectionBody(content, "## Summary", summary);

    // Update Why it matters
    if (Array.isArray(data.whyItMatters)) {
      const items = data.whyItMatters.map(toSingleLine).filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Why it matters", items.map(w => `- ${w}`).join("\n"));
    }

    // Update Examples
    if (Array.isArray(data.examples)) {
      const items = data.examples.map(toSingleLine).filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Examples", items.map(e => `- ${e}`).join("\n"));
    }

    // Update Questions
    if (Array.isArray(data.questions)) {
      const items = data.questions.map(toSingleLine).filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Questions", items.map(q => `- ${q}`).join("\n"));
    }

    // Update Next steps
    if (Array.isArray(data.nextSteps)) {
      const items = data.nextSteps
        .map(s => toSingleLine(s).replace(/^\[[ xX]\]\s*/, "").trim())
        .filter(Boolean);
      if (items.length) content = replaceSectionBody(content, "## Next steps", items.map(s => `- [ ] ${s}`).join("\n"));
    }

    // Update related links. Each candidate is normalized (handles ==[[x]]==,
    // **[[x]]**, bare names) and must resolve to a note that really exists.
    if (Array.isArray(data.relatedConcepts)) {
      const validTargets = new Map();
      existingNotes.forEach(n => validTargets.set(n.toLowerCase(), n));

      const links = [];
      const seen = new Set();

      const addLink = (candidate) => {
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

      // Keep the user's own links first, then add whatever the model suggested.
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

/* ==========================================================================
   LEARNING NOTE AI ENRICHER
   ========================================================================== */
async function enrichLearningNote(app, file) {
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
    .map(f => f.basename)
    .filter(n => n && !n.startsWith("_") && n !== noteTitle && !n.match(/^\d{4}-\d{2}-\d{2}/));
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

    // Update Learning Objectives & Motivation if placeholder exists
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
        const text = "*Atomic concepts distilled into `08-Concepts/`:*\n" + links.map(l => `- ${l}`).join("\n");
        content = replaceSectionBody(content, "## 💡 Extracted Evergreen Concepts", text);
      }
    }

    // Update Reusable Code Patterns if provided
    if (Array.isArray(data.extractedSnippets) && data.extractedSnippets.length > 0) {
      const snippets = data.extractedSnippets.map(normalizeWikiLink).filter(Boolean);
      if (snippets.length) {
        const text = "*Practical snippets & solutions saved to `03-Dev/`:*\n" + snippets.map(s => `- ${s}`).join("\n");
        content = replaceSectionBody(content, "## 💻 Reusable Code Patterns & Snippets", text);
      }
    }

    // Update Active Recall & Self-Quiz
    if (Array.isArray(data.activeRecall) && data.activeRecall.length > 0) {
      const quizLines = [];
      data.activeRecall.forEach(item => {
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

/* ==========================================================================
   DAILY NOTE AI ENRICHER
   ========================================================================== */
async function enrichDailyNote(app, file) {
  let content = await app.vault.read(file);
  new Notice("🤖 Gemini Flash is analyzing note & generating summary + reflection...");

  // 1. Extract Frontmatter Properties (mood, energy, sleep_hours)
  // Blank properties stay blank instead of silently inheriting the next YAML key.
  const mood = readFrontmatterValue(content, "mood");
  const energy = readFrontmatterValue(content, "energy");
  const sleepHours = readFrontmatterValue(content, "sleep_hours");

  // Human-readable versions for the prompt. "not logged" is an instruction to
  // the model to stay silent about the value, never text to be echoed.
  const moodText = mood || "not logged";
  const energyText = energy ? `${energy} out of 5` : "not logged";
  const sleepText = sleepHours ? `${sleepHours} hours` : "not logged";

  // 2. Collect existing markdown note titles for valid wikilinks
  const existingNoteNames = app.vault.getMarkdownFiles()
    .map(f => f.basename)
    .filter(name => name && !name.startsWith('_') && name.length > 2 && !name.match(/^\d{4}-\d{2}-\d{2}/));

  const existingNotesListStr = existingNoteNames.slice(0, 60).join(", ");

  // 3. Extract clean structured user data from Daily.md template sections
  const lines = content.split('\n');
  let focusItems = [];
  let completedTasks = [];
  let unfinishedTasks = [];
  let forwardedTasks = [];
  let checkedHabits = [];
  let dailyLog = [];
  let ideas = [];
  let winsLog = [];
  let blockersLog = [];
  let userReflectionLog = [];

  // Habits defined by the template, used to report consistency as "n of 6".
  const HABIT_RITUALS = ["water", "prioritised", "move", "read", "tidy", "disconnect"];

  let currentSec = "";
  let inFrontmatter = false;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip the YAML frontmatter block entirely; it is parsed separately.
    if (i === 0 && trimmed === "---") { inFrontmatter = true; continue; }
    if (inFrontmatter) {
      if (trimmed === "---") inFrontmatter = false;
      continue;
    }

    // Skip fenced blocks (templater / dataview) so code never becomes "user data".
    if (trimmed.startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;

    if (/^#{1,6}\s+/.test(trimmed)) {
      currentSec = trimmed;
      continue;
    }

    // A horizontal rule closes the current section, otherwise "---" was being
    // collected as a Reflection entry.
    if (/^---+$/.test(trimmed)) { currentSec = ""; continue; }

    // Blank lines, empty template bullets, callout prompts and tables.
    if (!trimmed || /^[-*+]$/.test(trimmed) || /^[-*+]\s*\[[ xX]\]$/.test(trimmed)) continue;
    if (trimmed.startsWith(">") || trimmed.startsWith("|")) continue;
    if (trimmed.startsWith("Define your focus") || trimmed.startsWith("Things I need") ||
        trimmed.startsWith("Daily basics") || trimmed.startsWith("Something positive") ||
        trimmed.startsWith("What got in my way") || trimmed.startsWith("What did I learn") ||
        trimmed.startsWith("What did I do today") || trimmed.startsWith("What patterns do I notice") ||
        trimmed.startsWith("Based on today") || trimmed.startsWith("What's the 1-3 things")) {
      continue;
    }

    if (currentSec.includes("Focus")) {
      // Kept as separate items so multiple focus lines stay distinct instead of
      // being concatenated into one run-on string.
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").replace(/^\[[ xX]\]\s*/, "").trim();
      if (cleanItem && !focusItems.includes(cleanItem)) focusItems.push(cleanItem);
    } else if (currentSec.includes("Tasks")) {
      const doneMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
      const fwdMatch = trimmed.match(/^\s*-\s*\[>\]\s+(.*)$/);
      const openMatch = trimmed.match(/^\s*-\s*\[ \]\s+(.*)$/);

      if (doneMatch && stripTaskMetadata(doneMatch[1])) {
        const itemText = stripTaskMetadata(doneMatch[1]);
        if (!completedTasks.includes(itemText)) completedTasks.push(itemText);
      } else if (fwdMatch && stripTaskMetadata(fwdMatch[1])) {
        // [>] means the task was moved to a later day. It is neither open here
        // nor done, but the count is a useful signal of slippage.
        const itemText = stripTaskMetadata(fwdMatch[1]);
        if (!forwardedTasks.includes(itemText)) forwardedTasks.push(itemText);
      } else if (openMatch && stripTaskMetadata(openMatch[1]) && stripTaskMetadata(openMatch[1]) !== "..." && stripTaskMetadata(openMatch[1]) !== "None") {
        const itemText = stripTaskMetadata(openMatch[1]);
        if (!unfinishedTasks.includes(itemText)) unfinishedTasks.push(itemText);
      }
    } else if (currentSec.includes("Ideas")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) ideas.push(cleanItem);
    } else if (currentSec.includes("Log") && !currentSec.includes("Blockers")) {
      // Timestamped running log, e.g. "- 09:30 started the enricher rewrite".
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) dailyLog.push(cleanItem);
    } else if (currentSec.includes("Habits")) {
      const habitMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
      if (habitMatch && stripTaskMetadata(habitMatch[1])) {
        const habitText = stripTaskMetadata(habitMatch[1]);
        if (!checkedHabits.includes(habitText)) checkedHabits.push(habitText);
      }
    } else if (currentSec.includes("Wins")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) winsLog.push(cleanItem);
    } else if (currentSec.includes("Blockers")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) blockersLog.push(cleanItem);
    } else if (currentSec.includes("Reflection") && !currentSec.includes("AI Reflection")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) userReflectionLog.push(cleanItem);
    }
  }

  // 4. Content completeness check
  const filledSectionCount = [
    focusItems.length,
    completedTasks.length + unfinishedTasks.length + forwardedTasks.length,
    checkedHabits.length,
    dailyLog.length,
    ideas.length,
    winsLog.length,
    blockersLog.length,
    userReflectionLog.length
  ].filter(count => count > 0).length;

  if (filledSectionCount < 1) {
    new Notice("⚠️ Daily note is mostly empty! Log something in Focus, Tasks, Daily Log, Wins, Blockers or Reflection before generating the AI summary.", 7000);
    return;
  }

  // 5. Load Gemini API Key from .env
  let geminiApiKey = "";
  let openAiApiKey = "";

  try {
    const envContent = await app.vault.adapter.read(".env");
    const geminiMatch = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    const openAiMatch = envContent.match(/OPENAI_API_KEY\s*=\s*([^\s]+)/);

    if (geminiMatch && !geminiMatch[1].includes("your_gemini")) geminiApiKey = geminiMatch[1].trim();
    if (openAiMatch && !openAiMatch[1].includes("your_openai")) openAiApiKey = openAiMatch[1].trim();
  } catch (e) {}

  // The note's own date drives the yesterday link, so enriching an older note
  // still chains correctly instead of pointing at today.
  const noteDate = (file.basename.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || formatDate(new Date());
  const yesterdayDate = previousDateStr(noteDate);

  // Physiological flags the prompt must respect.
  const sleepNum = parseFloat(sleepHours);
  const energyNum = parseFloat(energy);
  const sleepDebt = !isNaN(sleepNum) && sleepNum < 6;
  const isDepleted = sleepDebt && !isNaN(energyNum) && energyNum < 3;

  const systemPrompt = [
    "You are this person's Daily Note Analyst.",
    "You write like you're texting a smart friend who had a rough day: conversational and sharp, never clinical or therapeutic.",
    "You use their own words for what happened, you name the coping that worked, and you never psychoanalyse.",
    "You never invent facts. You always answer with valid JSON only."
  ].join(" ");

  const userPromptText = `Analyse this day and fill the AI Daily Summary.

METADATA
Mood: ${moodText}
Energy: ${energyText}
Sleep: ${sleepText}

TODAY'S FOCUS (intentions)
${focusItems.length ? focusItems.map(f => "- " + f).join("\n") : "- none written"}

TASKS
Completed: ${completedTasks.join(" | ") || "none"}
Still open: ${unfinishedTasks.join(" | ") || "none"}
Forwarded from an earlier day: ${forwardedTasks.join(" | ") || "none"}

DAILY LOG (timestamped, what actually happened)
${dailyLog.length ? dailyLog.map(l => "- " + l).join("\n") : "- nothing logged"}

HABITS
Kept ${checkedHabits.length} of ${HABIT_RITUALS.length}: ${checkedHabits.join(", ") || "none"}

IDEAS & FLEETING NOTES
${ideas.length ? ideas.map(i => "- " + i).join("\n") : "- none"}

END OF DAY (written by them)
Wins: ${winsLog.join(" | ") || "none"}
Blockers: ${blockersLog.join(" | ") || "none"}
Reflection: ${userReflectionLog.join(" | ") || "none"}

EXISTING VAULT NOTES (the only valid link targets)
[${existingNotesListStr}]
Yesterday's daily note: ${yesterdayDate}

WHAT TO PRODUCE
"vibe": ONE casual sentence catching the day's vibe, in their register — e.g. "A day that started with matcha and ended with dinuguan, with a boss fight in between" or "Shipped code through tears". Name the real things they logged (the food, the fight, the crying), not abstractions.
"moved": at most 2 short bullets on what actually moved forward — tasks closed, something learned, output shipped.
"coping": ONE bullet on how they coped or self-regulated (food, habits, rituals). Only if it is actually in the log; otherwise return an empty string.
"pattern": the repeated behaviour across tasks, log and habits. Do not stop at "fight = bad day" — connect mood and energy to output, and ask why some habits got ticked while others were not.
"friction": where the day lost momentum. Use their Blockers if given; otherwise infer it from gaps between timestamps in the log.
"insight": one non-obvious connection, e.g. "You still shipped at 4pm, so the fight cost attention rather than capacity".
"nextStep": ONE small tactical move, phrased "Try [action] because [reason from today]". Never "process your feelings" or anything therapeutic.${sleepDebt ? ` Sleep was under 6 hours, so this MUST acknowledge the sleep debt.` : ""}
"connectedNotes": start with "[[${yesterdayDate}]]" (always). Then ONLY notes explicitly named in their tasks, log or ideas. If they logged a URL or gist, suggest a note title describing its content (e.g. "[[Semantic Commit Messages]]"). Never invent a project name out of an API or error message. 2-5 links total.

HARD RULES
1. Never invent meetings, people, projects or tasks that are not written above.
2. Never use clinical or therapy language. Banned: "emotional distress", "interpersonal conflict", "significant impact", "well-being", "restorative", "process your emotions". Use the words they used — if they cried, say "rough morning"; if they ate sushi, mention the sushi.
3. Balance friction with resilience. Every bad day has at least one coping mechanism in the log — find it and name it.
4. ${isDepleted ? `Sleep was under 6 hours AND energy under 3 — say plainly that capacity was capped, without turning it into a lecture.` : `Do not speculate about sleep or energy unless the numbers are notable.`}
5. Keep the WHOLE output under 150 words. Conversational and sharp, not clinical.
6. Never mention property names (mood, energy, sleep_hours, tags, frontmatter, JSON) or the words "template" or "section".
7. If a field above says "none" or "nothing logged", stay silent about it. Never point out that something is empty.
8. Every string is one single line: no bullets, headings or line breaks inside a value.

JSON format:
{
  "quote": "short original line that fits this specific day",
  "author": "Daily Spark",
  "vibe": "one casual sentence",
  "moved": ["...", "..."],
  "coping": "...",
  "pattern": "...",
  "friction": "...",
  "insight": "...",
  "nextStep": "Try ... because ...",
  "connectedNotes": ["[[${yesterdayDate}]]"]
}
`;

  let responseData = null;
  let usedFallback = false;
  let failureReason = "";

  if (geminiApiKey) {
    const result = await callGeminiJson(geminiApiKey, systemPrompt, userPromptText, "Daily Enrich", 0.7);
    if (result && result.data && (result.data.vibe || result.data.pattern)) {
      responseData = result.data;
      console.log(`Daily Enrich: generated with ${result.model}`);
    } else {
      failureReason = formatGeminiFailure(result && result.failure);
    }
  } else {
    failureReason = formatGeminiFailure({ kind: "noKey" });
  }

  // Offline fallback. This is assembled text, not AI writing, so it is built from
  // the logged data only and is announced clearly in the notice below.
  if (!responseData) {
    usedFallback = true;
    responseData = buildDailyFallback({
      mood, energy, sleepHours, sleepDebt, isDepleted, focusItems, completedTasks,
      unfinishedTasks, forwardedTasks, checkedHabits, habitTotal: HABIT_RITUALS.length,
      dailyLog, ideas, winsLog, blockersLog, userReflectionLog, yesterdayDate
    });
  }

  // Normalize everything to single clean lines so the bullet layout holds even if
  // the model returns markdown or multi-line text.
  const vibeText = toSingleLine(responseData.vibe);
  const movedLines = (Array.isArray(responseData.moved) ? responseData.moved : [])
    .map(toSingleLine).filter(Boolean).slice(0, 2);
  const copingText = toSingleLine(responseData.coping);
  const patternText = toSingleLine(responseData.pattern);
  const frictionText = toSingleLine(responseData.friction);
  const insightText = toSingleLine(responseData.insight);
  const nextStepText = toSingleLine(responseData.nextStep);

  responseData.quote = toSingleLine(responseData.quote) || "Small steps, taken today, are what tomorrow is built on.";
  responseData.author = toSingleLine(responseData.author) || "Daily Spark";

  // Clinical register slips past prompts sometimes; flag it rather than silently ship it.
  const BANNED_PHRASES = [
    "emotional distress", "interpersonal conflict", "significant impact",
    "well-being", "wellbeing", "restorative", "process your emotions", "process the conflict"
  ];
  const generatedProse = [vibeText, movedLines.join(" "), copingText, patternText, frictionText, insightText, nextStepText]
    .join(" ").toLowerCase();
  const slips = BANNED_PHRASES.filter(phrase => generatedProse.includes(phrase));
  if (slips.length) console.warn(`Daily Enrich: clinical phrasing slipped through — ${slips.join(", ")}`);

  /* Connected notes.
     Only three things earn a link: yesterday's note, a note whose name the user
     actually wrote, or a suggested title whose words appear in what they wrote
     (so a logged gist can become [[Semantic Commit Messages]]). This is what
     stops invented links like [[API]] or [[Tasks Kanban]] appearing. */
  const validTargets = new Map();
  app.vault.getMarkdownFiles().forEach(f => validTargets.set(f.basename.toLowerCase(), f.basename));

  // Only the user's own words — never headings or template prompts.
  const userCorpus = [].concat(
    focusItems, completedTasks, unfinishedTasks, forwardedTasks,
    dailyLog, ideas, winsLog, blockersLog, userReflectionLog
  ).join(" \n ").toLowerCase();

  const isNamedByUser = (target) => {
    const lower = target.toLowerCase();
    if (validTargets.has(lower) && userCorpus.includes(lower)) return true;
    const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 4);
    if (tokens.length === 0) return false;
    const hits = tokens.filter(word => userCorpus.includes(word)).length;
    return hits >= 2;
  };

  const connectedLinks = [];
  const seenLinks = new Set();

  const addConnected = (rawLink, force) => {
    const target = wikiLinkTarget(normalizeWikiLink(rawLink));
    if (!target) return;
    const key = target.toLowerCase();
    if (key === file.basename.toLowerCase() || seenLinks.has(key)) return;
    if (!force && !isNamedByUser(target)) {
      console.warn(`Daily Enrich: dropped link "[[${target}]]" — not named anywhere in the note`);
      return;
    }
    seenLinks.add(key);
    connectedLinks.push(`[[${validTargets.get(key) || target}]]`);
  };

  // Yesterday is always first, whether or not that note exists yet.
  addConnected(`[[${yesterdayDate}]]`, true);
  (Array.isArray(responseData.connectedNotes) ? responseData.connectedNotes : []).forEach(link => addConnected(link, false));
  while (connectedLinks.length > 5) connectedLinks.pop();

  // Prepare quote callout
  const authorText = responseData.author ? `\n> — **${responseData.author}**` : "";
  const quoteCallout = `> [!QUOTE] 💡 Daily Spark\n> *"${responseData.quote}"*${authorText}`;

  // Update Daily Spark quote
  if (content.includes("> [!QUOTE] 💡 Daily Spark")) {
    content = content.replace(
      /> \[!QUOTE\] 💡 Daily Spark[\s\S]*?(?=\r?\n\r?\n#{1,6} |\r?\n---[ \t]*\r?\n|(?![\s\S]))/,
      escapeReplacement(quoteCallout)
    );
  }

  // Update AI Daily Summary section
  const summaryLines = [vibeText].concat(movedLines).concat(copingText ? [copingText] : [])
    .filter(Boolean).map(line => `- ${line}`).join("\n");

  const reflectionLines = [
    patternText ? `- **Pattern:** ${patternText}` : "",
    frictionText ? `- **Friction:** ${frictionText}` : "",
    insightText ? `- **Insight:** ${insightText}` : ""
  ].filter(Boolean).join("\n");

  const nextStepLines = nextStepText ? `- ${nextStepText}` : "";

  const aiSummaryBlock = `## 🤖 AI Daily Summary

### Summary
>_What did I do today? Key activities, progress, and outcomes._
${summaryLines || "- "}

### AI Reflection
>_What patterns do I notice? What could I improve? Any insights or blind spots?_
${reflectionLines || "- "}

### **Suggested Next Step**
>_Based on today, what's the smartest move for tomorrow?_
${nextStepLines || "- "}`;

  // Bounded to the AI section: stops at the next level-2 heading or horizontal
  // rule so anything after it in the note survives.
  const aiSectionRe = /^## 🤖 AI Daily Summary[\s\S]*?(?=^## |^---[ \t]*$|(?![\s\S]))/m;

  if (aiSectionRe.test(content)) {
    content = content.replace(aiSectionRe, escapeReplacement(aiSummaryBlock + "\n"));
  } else {
    content = content.replace(/\s*$/, "") + "\n\n" + aiSummaryBlock + "\n";
  }

  // Update Connected Notes (its own section after the AI block)
  const connectedBlock = connectedLinks.map(link => `- ${link}`).join("\n");

  if (/^##### 🔗 Connected Notes[ \t]*$/m.test(content)) {
    content = replaceSectionBody(content, "##### 🔗 Connected Notes", connectedBlock);
  } else {
    content = content.replace(/\s*$/, "") + `\n\n---\n##### 🔗 Connected Notes\n${connectedBlock}\n`;
  }

  await app.vault.modify(file, content);

  const wordCount = generatedProse.split(/\s+/).filter(Boolean).length;
  console.log(`Daily Enrich: ${wordCount} words, ${connectedLinks.length} connected note(s)`);
  if (wordCount > 150) console.warn(`Daily Enrich: output ran to ${wordCount} words, over the 150-word target.`);

  if (usedFallback) {
    new Notice(
      `⚠️ No AI writing this time: ${failureReason}.\n\n` +
      `A basic offline summary was assembled from your logged items instead. Re-run the enricher once the limit clears to replace it with real AI analysis.`,
      12000
    );
  } else {
    new Notice("✨ Daily Note enriched: summary, reflection, next step & connected notes.");
  }
}

/* Offline daily summary, assembled only from logged data.
   Mirrors the AI output structure (arc / activities / pattern / friction /
   insight / next step) so the note looks the same either way. It stays
   diagnostic, never mentions property names, and never remarks on empty
   sections. */
function buildDailyFallback(d) {
  const energyNum = parseFloat(d.energy);
  const done = d.completedTasks.length;
  const open = d.unfinishedTasks.length;
  const logged = d.dailyLog.length;
  const plural = (n, one, many) => (n === 1 ? one : many);

  // Words that read like coping rather than work, used to find the day's anchor.
  const COMFORT_HINTS = ["coffee", "matcha", "tea", "lunch", "dinner", "breakfast", "sushi", "ate", "eating",
    "food", "walk", "nap", "rest", "shower", "music", "game", "played"];
  const comfort = d.dailyLog.find(entry => COMFORT_HINTS.some(word => entry.toLowerCase().includes(word))) || "";

  // Vibe, built from what was logged rather than from sentiment guessing.
  let vibe;
  if (logged >= 2) {
    const first = stripTimestamp(d.dailyLog[0]);
    const last = stripTimestamp(d.dailyLog[d.dailyLog.length - 1]);
    vibe = asSentence(`A day that went from ${first} to ${last}`);
  } else if (d.isDepleted) {
    vibe = "Running on fumes today — short sleep, low energy.";
  } else if (done && open) {
    vibe = asSentence(`Closed ${done} thing${done === 1 ? "" : "s"}, left ${open} on the table`);
  } else if (done) {
    vibe = "Quiet day, but things actually got finished.";
  } else {
    vibe = "A thin day on the record — not much made it into the log.";
  }

  const moved = [];
  if (done) moved.push(asSentence(`Closed ${d.completedTasks.slice(0, 2).join(" and ")}`));
  if (d.userReflectionLog.length) moved.push(asSentence(`Took something away: ${d.userReflectionLog[0]}`));
  else if (d.winsLog.length) moved.push(asSentence(d.winsLog[0]));
  if (!moved.length && logged) moved.push(asSentence(stripTimestamp(d.dailyLog[0])));

  const coping = comfort ? asSentence(stripTimestamp(comfort)) : "";

  // Pattern: which habits survived the day and which didn't.
  const missedHabits = ["water", "prioritised", "move", "read", "tidy", "disconnect"]
    .filter(habit => !d.checkedHabits.some(kept => kept.toLowerCase().includes(habit)));

  let pattern;
  if (d.checkedHabits.length && missedHabits.length) {
    pattern = asSentence(`${d.checkedHabits.join(", ")} got ticked; ${missedHabits.join(", ")} didn't — the ones needing a clear head are the ones that slipped${d.energy ? `, even at energy ${d.energy}` : ""}`);
  } else if (d.checkedHabits.length === d.habitTotal) {
    pattern = asSentence(`All ${d.habitTotal} habits held${done ? ` and ${done} task${done === 1 ? "" : "s"} closed` : ""}`);
  } else if (open) {
    pattern = asSentence(`${open} ${plural(open, "task", "tasks")} still open and no habit ticked — the day never found a rhythm`);
  } else {
    pattern = "Not enough logged to read a pattern yet.";
  }

  // Friction: their own blockers first, then the biggest untracked gap.
  const gap = largestLogGap(d.dailyLog);
  let friction;
  if (d.blockersLog.length) {
    friction = asSentence(d.blockersLog[0]);
  } else if (gap) {
    friction = `Nothing logged between ${gap.from} and ${gap.to} — about ${gap.hours} ${gap.hours === 1 ? "hour" : "hours"} that went untracked.`;
  } else if (d.isDepleted) {
    friction = asSentence(`Under 6 hours of sleep with energy at ${d.energy} of 5 caps what was available`);
  } else if (d.forwardedTasks.length) {
    friction = asSentence(`${d.forwardedTasks.length} ${plural(d.forwardedTasks.length, "task", "tasks")} showed up already forwarded from an earlier day`);
  } else if (!logged) {
    friction = "The log is empty, so there's no trace of where the day went.";
  } else {
    friction = "Nothing obvious got in the way today.";
  }

  // Insight: one non-obvious connection.
  let insight;
  if (d.isDepleted) {
    insight = "Short sleep and low energy together mean the ceiling was physical, not a discipline problem.";
  } else if (comfort && done) {
    insight = asSentence(`${capitalise(stripTimestamp(comfort))} held the day together more than the task list did`);
  } else if (!isNaN(energyNum) && energyNum >= 4 && done === 0) {
    insight = asSentence(`Energy at ${d.energy} of 5 with nothing closed points to a missing target, not missing capacity`);
  } else if (open > done && done > 0) {
    insight = "More was left open than closed, which usually means the tasks were scoped too big for one sitting.";
  } else if (gap && done) {
    insight = `You still closed something after that ${gap.hours}-hour gap, so the day cost attention rather than capacity.`;
  } else if (d.ideas.length) {
    insight = asSentence(`An idea got captured ("${d.ideas[0]}") but never scheduled, so it'll fade unless it becomes a task`);
  } else {
    insight = "Not enough signal today to draw a non-obvious connection.";
  }

  let nextStep;
  if (open) {
    nextStep = `Try starting with "${d.unfinishedTasks[0]}" first thing because it's still open after today.`;
  } else if (d.focusItems.length) {
    nextStep = "Try picking one outcome with a clear finish line because today's intentions had none.";
  } else {
    nextStep = "Try writing one target before you start because today had nothing to steer by.";
  }
  if (d.sleepDebt) {
    nextStep += ` And on ${d.sleepHours} hours, keep tomorrow's list to one thing.`;
  }

  return {
    quote: "Small steps, taken today, are what tomorrow is built on.",
    author: "Daily Spark",
    vibe: vibe,
    moved: moved.slice(0, 2),
    coping: coping,
    pattern: pattern,
    friction: friction,
    insight: insight,
    nextStep: nextStep,
    connectedNotes: [`[[${d.yesterdayDate}]]`]
  };
}

// Sentence-cases a fragment without touching the rest of its capitalisation.
function capitalise(text) {
  const clean = String(text).trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}

// Drops a leading clock time so a log line can be dropped into a sentence.
function stripTimestamp(entry) {
  return String(entry)
    .replace(/^\s*\d{1,2}[:.]?\d{0,2}\s*(am|pm|nn|hrs?)?\s*[:\-–]?\s*/i, "")
    .trim() || String(entry).trim();
}

// Finds the largest untracked gap between timestamped log entries.
function largestLogGap(entries) {
  const times = [];

  for (const entry of entries) {
    const match = String(entry).match(/(\d{1,2})[:.](\d{2})\s*(am|pm|nn)?|(\d{1,2})\s*(am|pm|nn)/i);
    if (!match) continue;

    let hour, minute, suffix;
    if (match[1] !== undefined) {
      hour = parseInt(match[1], 10);
      minute = parseInt(match[2], 10);
      suffix = (match[3] || "").toLowerCase();
    } else {
      hour = parseInt(match[4], 10);
      minute = 0;
      suffix = (match[5] || "").toLowerCase();
    }
    if (isNaN(hour)) continue;

    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "nn" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;

    times.push({ minutes: hour * 60 + minute, label: `${String(hour % 12 === 0 ? 12 : hour % 12)}${minute ? ":" + String(minute).padStart(2, "0") : ""}${hour >= 12 ? "pm" : "am"}` });
  }

  if (times.length < 2) return null;
  times.sort((a, b) => a.minutes - b.minutes);

  let widest = null;
  for (let i = 1; i < times.length; i++) {
    const span = times[i].minutes - times[i - 1].minutes;
    if (span >= 120 && (!widest || span > widest.span)) {
      widest = { span: span, from: times[i - 1].label, to: times[i].label };
    }
  }

  if (!widest) return null;
  return { from: widest.from, to: widest.to, hours: Math.round(widest.span / 60) };
}
