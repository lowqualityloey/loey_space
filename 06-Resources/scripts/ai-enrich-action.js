module.exports = async function aiEnrichAction(params) {
  const app = (params && params.app) ? params.app : (window.app || app);
  const file = app.workspace.getActiveFile();

  if (!file) {
    new Notice("⚠️ Please open a note first!");
    return;
  }

  const isDaily = file.path.startsWith("01-Daily");
  const isConcept = file.path.startsWith("08-Concepts");
  const isDev = file.path.startsWith("03-Dev");

  if (!isDaily && !isConcept && !isDev) {
    new Notice("⚠️ Please open a Daily, Concept, or Dev note first!");
    return;
  }

  if (isConcept) {
    await enrichConceptNote(app, file);
  } else if (isDev) {
    await enrichDevNote(app, file);
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
  let failure = { status: 0, kind: "unknown", message: "request failed", retrySeconds: 0, model: "" };

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

      failure = parseGeminiError(res.status, res.text, model);
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
  let checkedHabits = [];
  let winsLog = [];
  let blockersLog = [];
  let userReflectionLog = [];

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
      const openMatch = trimmed.match(/^\s*-\s*\[ \]\s+(.*)$/);
      if (doneMatch && stripTaskMetadata(doneMatch[1])) {
        const itemText = stripTaskMetadata(doneMatch[1]);
        if (!completedTasks.includes(itemText)) completedTasks.push(itemText);
      } else if (openMatch && stripTaskMetadata(openMatch[1]) && stripTaskMetadata(openMatch[1]) !== "..." && stripTaskMetadata(openMatch[1]) !== "None") {
        const itemText = stripTaskMetadata(openMatch[1]);
        if (!unfinishedTasks.includes(itemText)) unfinishedTasks.push(itemText);
      }
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
  let sectionCounts = {
    focus: focusItems.length ? 1 : 0,
    tasks: completedTasks.length + unfinishedTasks.length,
    habitsChecked: checkedHabits.length,
    wins: winsLog.length,
    blockers: blockersLog.length,
    userRef: userReflectionLog.length
  };

  let filledSectionCount = sectionCounts.focus + (sectionCounts.tasks ? 1 : 0) + (sectionCounts.habitsChecked ? 1 : 0) + 
                           (sectionCounts.wins ? 1 : 0) + (sectionCounts.blockers ? 1 : 0) + (sectionCounts.userRef ? 1 : 0);

  if (filledSectionCount < 1) {
    new Notice("⚠️ Daily note is mostly empty! Log items in Focus, Tasks, Wins, Blockers, or Reflection before generating AI Daily Summary.", 7000);
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

  const systemPrompt = [
    "You are a thoughtful personal coach reviewing someone's daily journal.",
    "You write in warm, plain, natural English, speaking to the person as \"you\".",
    "You reason about what actually happened and say something specific and useful.",
    "You always answer with valid JSON only."
  ].join(" ");

  const userPromptText = `Review this person's day and write their daily summary.

WHAT THEY LOGGED TODAY
Mood: ${moodText}
Energy: ${energyText}
Sleep: ${sleepText}
Intentions for the day: ${focusItems.join(" | ") || "none written"}
Finished: ${completedTasks.join(" | ") || "none"}
Still open: ${unfinishedTasks.join(" | ") || "none"}
Habits kept: ${checkedHabits.join(", ") || "none"}
Wins: ${winsLog.join(" | ") || "none"}
What got in the way: ${blockersLog.join(" | ") || "none"}
Their own reflection: ${userReflectionLog.join(" | ") || "none"}
Notes that exist in their vault (only for optional [[links]]): [${existingNotesListStr}]

HOW TO WRITE
1. Use only what is logged above. Never invent activities, numbers or feelings.
2. Never mention field or property names. Do not write words like mood:, energy:, sleep_hours:, tags, frontmatter, metadata, JSON or "log entry".
3. If a value says "not logged" or "none", just leave it out silently. Never point out that something is missing or empty.
4. Refer to real items by their actual wording, lightly rephrased so it reads like a sentence, not a copied list.
5. Write full, natural sentences. No bullet points, no headings, no line breaks, no markdown lists inside any value.
6. Sound like a person talking, not a status report. Avoid corporate filler such as "core daily routines", "operational baseline", "maintained basic execution", "unlock smoother flow".

JSON format (each value must be one single-line string):
{
  "quote": "short original line that fits the mood of this specific day",
  "author": "Daily Spark",
  "summary": "2-3 sentences on what they actually did today and what came out of it",
  "reflection": "2-3 sentences naming one real pattern from today plus one concrete thing to adjust",
  "nextStep": "1-2 sentences with one specific, doable action for tomorrow"
}
`;

  let responseData = null;
  let usedFallback = false;
  let failureReason = "";

  if (geminiApiKey) {
    const result = await callGeminiJson(geminiApiKey, systemPrompt, userPromptText, "Daily Enrich", 0.7);
    if (result && result.data && result.data.summary) {
      responseData = result.data;
      console.log(`Daily Enrich: generated with ${result.model}`);
    } else {
      failureReason = formatGeminiFailure(result && result.failure);
    }
  } else {
    failureReason = formatGeminiFailure({ kind: "noKey" });
  }

  // Offline fallback. This is template text, not AI writing, so it is built from
  // the logged data only and is announced clearly in the notice below.
  if (!responseData || !responseData.summary) {
    usedFallback = true;
    responseData = buildDailyFallback({
      mood, energy, sleepHours, focusItems, completedTasks,
      unfinishedTasks, checkedHabits, winsLog, blockersLog, userReflectionLog
    });
  }

  // Normalize every value to a single clean line so the bullet layout holds even
  // if the model returns markdown or multi-line text.
  const summaryText = toSingleLine(responseData.summary);
  const reflectionText = toSingleLine(responseData.reflection);
  const nextStepText = toSingleLine(responseData.nextStep);
  responseData.quote = toSingleLine(responseData.quote) || "Small steps, taken today, are what tomorrow is built on.";
  responseData.author = toSingleLine(responseData.author) || "Daily Spark";

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
  const aiSummaryBlock = `## 🤖 AI Daily Summary

### Summary
>_What did I do today? Key activities, progress, and outcomes._
- ${summaryText}

### AI Reflection
>_What patterns do I notice? What could I improve? Any insights or blind spots?_
- ${reflectionText}

### **Suggested Next Step**
>_Based on today, what's the smartest move for tomorrow?_
- ${nextStepText}`;

  // Bounded to the AI section: stops at the next level-2 heading or horizontal
  // rule so anything after it in the note survives.
  const aiSectionRe = /^## 🤖 AI Daily Summary[\s\S]*?(?=^## |^---[ \t]*$|(?![\s\S]))/m;

  if (aiSectionRe.test(content)) {
    content = content.replace(aiSectionRe, escapeReplacement(aiSummaryBlock + "\n"));
  } else {
    content = content.replace(/\s*$/, "") + "\n\n" + aiSummaryBlock + "\n";
  }

  await app.vault.modify(file, content);

  if (usedFallback) {
    new Notice(
      `⚠️ No AI writing this time: ${failureReason}.\n\n` +
      `A basic offline summary was written from your logged items instead. Re-run the enricher once the limit clears to replace it with real AI text.`,
      12000
    );
  } else {
    new Notice("✨ Daily Note enriched with AI Summary, Reflection & Suggested Next Step!");
  }
}

/* Offline daily summary built only from logged data.
   Deliberately avoids property names and never comments on missing values. */
function buildDailyFallback(d) {
  const summaryParts = [];
  if (d.focusItems.length) {
    summaryParts.push(asSentence(`Your plan for today was ${d.focusItems.slice(0, 3).map(f => asSentence(f).replace(/\.$/, "")).join("; ")}`));
  }
  if (d.completedTasks.length) {
    summaryParts.push(asSentence(`You finished ${d.completedTasks.length} of them, including ${d.completedTasks.slice(0, 2).map(t => asSentence(t).replace(/\.$/, "")).join(" and ")}`));
  }
  if (d.checkedHabits.length) summaryParts.push(asSentence(`You also kept up with ${d.checkedHabits.join(", ")}`));
  if (d.winsLog.length) summaryParts.push(asSentence(`The part worth keeping was ${d.winsLog[0]}`));
  if (!summaryParts.length) summaryParts.push("Today was captured lightly, with only a few notes written down.");

  const reflectionParts = [];
  const conditions = [];
  if (d.mood) conditions.push(`you felt ${d.mood}`);
  if (d.energy) conditions.push(`your energy sat around ${d.energy} out of 5`);
  if (d.sleepHours) conditions.push(`you slept about ${d.sleepHours} hours`);
  if (conditions.length) reflectionParts.push(asSentence(`Looking at the shape of the day, ${conditions.join(" and ")}`));
  if (d.blockersLog.length) reflectionParts.push(asSentence(`What held you back most was ${d.blockersLog[0]}`));
  if (d.userReflectionLog.length) reflectionParts.push(asSentence(`In your own words, ${d.userReflectionLog[0]}`));
  if (d.unfinishedTasks.length) {
    reflectionParts.push(`${d.unfinishedTasks.length} ${d.unfinishedTasks.length > 1 ? "items are" : "item is"} still open, which usually means the day was asked to hold more than it could.`);
  }
  if (!reflectionParts.length) reflectionParts.push("Nothing stood out as a blocker today, so the rhythm looks steady.");

  const nextStep = d.unfinishedTasks.length
    ? asSentence(`Start tomorrow with ${asSentence(d.unfinishedTasks[0]).replace(/\.$/, "")} before anything else, while your attention is still fresh`)
    : (d.focusItems.length
      ? `Pick one outcome for tomorrow and give it your first block of time.`
      : `Write down a single thing you want tomorrow to be about before you start the day.`);

  return {
    quote: "Small steps, taken today, are what tomorrow is built on.",
    author: "Daily Spark",
    summary: summaryParts.join(" "),
    reflection: reflectionParts.join(" "),
    nextStep: nextStep
  };
}
