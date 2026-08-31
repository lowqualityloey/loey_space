// Reads one single-line YAML scalar from the frontmatter block.
export function readFrontmatterValue(content: string, key: string): string {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const scope = fm ? fm[1] : content;
  const match = scope.match(new RegExp("^" + key + ":[ \\t]*([^\\r\\n]*)$", "m"));
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "").trim();
}

// Local YYYY-MM-DD (never UTC, which can shift the date near midnight).
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The day before a YYYY-MM-DD string, used for the daily-note chain link.
export function previousDateStr(dateStr: string): string {
  const parts = String(dateStr).split("-").map(Number);
  const date = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  if (isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

// Collapses model output into one clean line so generated text can never break
// the bullet layout of a template section or inject extra headings.
export function toSingleLine(value: any): string {
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
export function escapeReplacement(text: string): string {
  return String(text).replace(/\$/g, "$$$$");
}

// Accepts "React", "[[React]]", "==[[React]]==", "**[[React]]**", "- [[React]]"
// or "[[React|alias]]" and returns one well-formed link, keeping the highlight
// when the source used one.
export function normalizeWikiLink(raw: any): string {
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
export function wikiLinkTarget(link: any): string {
  const inner = String(link).match(/\[\[([^\[\]]+)\]\]/);
  if (!inner) return "";
  return inner[1].split("|")[0].split("#")[0].trim();
}

// Replaces only a section body: from its heading to the next heading, code
// fence, horizontal rule or true end of file. Never swallows the rest of a note.
export function replaceSectionBody(content: string, headingLiteral: string, bodyText: string): string {
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
export function addFrontmatterTag(content: string, tag: string): string {
  const clean = toSingleLine(tag).replace(/^#/, "").trim();
  if (!clean) return content;
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return content;
  if (new RegExp("^\\s*-\\s*" + clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "m").test(fm[1])) return content;
  return content.replace(/(^tags:[ \t]*\r?\n)/m, (m, key) => key + "  - " + clean + "\n");
}

// Strips Tasks-plugin metadata (✅ 2026-08-09, 📅 dates, priorities, recurrence)
// so logged items read as plain language in generated text.
export function stripTaskMetadata(text: string): string {
  return String(text)
    .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ")
    .replace(/\s*\^[A-Za-z0-9]+\s*$/, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Ends a fragment with exactly one period.
export function asSentence(text: string): string {
  const clean = String(text).trim().replace(/[.,;:\s]+$/, "");
  if (!clean) return "";
  return /[!?]$/.test(clean) ? clean : clean + ".";
}

// Sentence-cases a fragment without touching the rest of its capitalisation.
export function capitalise(text: string): string {
  const clean = String(text).trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}
