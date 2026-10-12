#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// 06-Resources/scripts/src/heyloey.ts
var heyloey_exports = {};
__export(heyloey_exports, {
  DEV_HUB_LINK: () => DEV_HUB_LINK,
  LEARN_END: () => LEARN_END,
  LEARN_START: () => LEARN_START,
  buildSnippetNote: () => buildSnippetNote,
  detectLanguage: () => detectLanguage,
  insertDailyLogLine: () => insertDailyLogLine,
  insertLatestUpdate: () => insertLatestUpdate,
  mergeLearnNote: () => mergeLearnNote,
  parseArgs: () => parseArgs,
  resolveInsideVault: () => resolveInsideVault,
  validateTarget: () => validateTarget
});
module.exports = __toCommonJS(heyloey_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// 06-Resources/scripts/src/lib/daily-note.ts
var DEFAULT_DAILY_NOTES_CONFIG = {
  folder: "01-Daily",
  format: "YYYY-MM/YYYY-MM-DD"
};
var DAILY_NOTES_CONFIG_PATH = ".obsidian/daily-notes.json";
function formatDate(date, format) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return format.replace(/YYYY/g, yyyy).replace(/YY/g, yyyy.slice(2)).replace(/MM/g, mm).replace(/DD/g, dd);
}
function resolveDailyNotePath(dateStr, config = DEFAULT_DAILY_NOTES_CONFIG) {
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`resolveDailyNotePath: expected YYYY-MM-DD, received "${dateStr}"`);
  }
  const formatted = formatDate(new Date(year, month - 1, day), config.format);
  const folder = config.folder.replace(/\/+$/, "");
  return `${folder}/${formatted}`;
}
function resolveDailyNoteFile(dateStr, config = DEFAULT_DAILY_NOTES_CONFIG) {
  return `${resolveDailyNotePath(dateStr, config)}.md`;
}

// 06-Resources/scripts/src/lib/triage.ts
var ROUTES = {
  do: { kind: "task" },
  bin: { kind: "drop" },
  dev: { kind: "note", folder: "03-Dev", type: "snippet", area: "dev", status: "active" },
  concept: { kind: "note", folder: "08-Concepts", type: "concept", area: "general", status: "active", review: "90d" },
  learn: { kind: "note", folder: "04-Learning", type: "learning", area: "learning", status: "in-progress", review: "30d" },
  ref: { kind: "note", folder: "06-Resources", type: "resource", area: "resources", status: "active" },
  personal: { kind: "note", folder: "05-Personal", type: "personal", area: "personal", status: "active" },
  project: { kind: "project", folder: "02-Projects", type: "project", area: "dev", status: "planning", review: "14d" }
};
var TOKEN_RE = new RegExp("#(" + Object.keys(ROUTES).join("|") + ")\\b", "i");
var TIME_CODE_RE = /`\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\s*`/gi;
function sanitizeTitle(text) {
  let clean = String(text).replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().replace(/[.,;:\-–—]+$/, "").trim();
  if (clean.length > 60)
    clean = clean.slice(0, 60).trim();
  return clean;
}
function parseCaptureLine(line) {
  if (!/^\s*-\s+\S/.test(line))
    return null;
  const token = line.match(TOKEN_RE);
  if (!token)
    return null;
  const text = line.replace(/^\s*-\s+/, "").replace(TOKEN_RE, "").replace(TIME_CODE_RE, "").replace(/\s+/g, " ").trim();
  if (!text)
    return null;
  return { token: token[1].toLowerCase(), text };
}
function parseDumpLines(dumpLines) {
  const picked = [];
  let inTriaged = false;
  let capturedDate = "";
  for (let i = 0; i < dumpLines.length; i++) {
    const line = dumpLines[i];
    if (/^##\s+.*Triaged/i.test(line)) {
      inTriaged = true;
      continue;
    } else if (/^##\s+/.test(line)) {
      inTriaged = false;
    }
    if (inTriaged)
      continue;
    const heading = line.match(/^###\s+.*?(\d{4}-\d{2}-\d{2})/);
    if (heading) {
      capturedDate = heading[1];
      continue;
    }
    const parsed = parseCaptureLine(line);
    if (!parsed)
      continue;
    picked.push({ index: i, token: parsed.token, text: parsed.text, capturedDate });
  }
  return picked;
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
function formatDate2(date) {
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

// 06-Resources/scripts/src/lib/links.ts
function parseAliases(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch)
    return [];
  const fm = fmMatch[1];
  const aliasesMatch = fm.match(/^aliases:\s*(.*)$/m);
  if (!aliasesMatch)
    return [];
  const raw = aliasesMatch[1].trim();
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  const listMatches = fm.match(/^aliases:\s*\r?\n((?:\s*-\s*.*(?:\r?\n|$))+)/m);
  if (listMatches) {
    return listMatches[1].split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  return raw ? [raw.replace(/^["']|["']$/g, "")] : [];
}
function extractWikilinks(content) {
  const links = [];
  const lines = content.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    const strippedLine = line.replace(/`[^`]+`/g, " ");
    const matches = strippedLine.matchAll(/!?\[\[([^\[\]]+)\]\]/g);
    for (const match of matches) {
      const raw = match[0];
      const inner = match[1].trim();
      const cleanInner = inner.replace(/\\\|/g, "|");
      const targetOnly = cleanInner.split("|")[0].split("#")[0].trim();
      if (targetOnly && targetOnly !== "|" && targetOnly !== "#") {
        links.push({
          target: targetOnly.replace(/\.md$/i, ""),
          raw,
          line: i + 1
        });
      }
    }
  }
  return links;
}

// 06-Resources/scripts/src/lib/task-view.ts
var CORE_SHIELD_KEYWORDS = ["habit", "backlog", "archive"];
var OPT_IN_SHIELD_KEYWORDS = [
  ...CORE_SHIELD_KEYWORDS,
  "syllabus",
  "reference",
  "auto-backlink",
  "module",
  "example"
];
var ACTIVE_LIFECYCLES = [
  "active",
  "in progress",
  "in-progress",
  "doing",
  "wip"
];
function normalizeLifecycle(value) {
  return String(value ?? "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
function isLifecycleActive(value) {
  const normalized = normalizeLifecycle(value);
  if (normalized === "")
    return true;
  return ACTIVE_LIFECYCLES.includes(normalized);
}
function isDone(task) {
  return String(task.status ?? "").toLowerCase() === "x";
}

// 06-Resources/scripts/src/heyloey.ts
var REQUIRED_MARKERS = ["AGENTS.md", "99-Templates"];
var MEMORY_RECORD = "memory.md";
var HANDOFF_RECORD = "handoff.md";
var DAILY_LOG_HEADING = "## \u{1F4DD} Daily Log";
var HANDOFF_HEADING = "### Latest Updates";
var ROUTE_PREFIXES = ["02-Projects", "03-Dev", "04-Learning", "06-Resources", "08-Concepts"];
var SNIPPET_DIR = "03-Dev";
var DEV_HUB = "03-Dev/_Dev MOC.md";
var DEV_HUB_LINK = "[[_Dev MOC]]";
var LEARN_START = "<!-- heyloey:learn:start -->";
var LEARN_END = "<!-- heyloey:learn:end -->";
var HUB_HEADING = "## \u{1F517} Related Resources & Notes";
var HUB_HEADING_PATTERN = /^#{2,6}\s+.*\bRelated\b/;
var COMMANDS = ["brief", "context", "done", "learn"];
var WRITING_COMMANDS = /* @__PURE__ */ new Set(["done", "learn"]);
function usage() {
  return [
    "heyloey \u2014 repository-local vault commands (the CLI, not the chat prefix)",
    "",
    "Usage:",
    "  npm run heyloey -- [--root <dir>] <command> [arguments] [--dry-run] [--show-paths]",
    "",
    "Commands:",
    "  brief                       Read-only. A condensed pulse: records present, today's focus,",
    "                              open tasks, habits, inbox count and active projects.",
    '  context "<query>"           Read-only. Routes the query to matching projects, snippets,',
    "                              notes and runbooks, printing paths only.",
    '  done "<summary>"            Records a completed milestone under `## \u{1F4DD} Daily Log` in',
    "                              today's daily note and under `### Latest Updates` in",
    "                              handoff.md. Refuses if either record is absent. Milestones",
    "                              only \u2014 see the Hey Loey Guide.",
    '  learn "<Title>" "<Pattern>" Indexes a reusable technical pattern in `03-Dev/` and',
    "                              links it to the existing Dev hub. A colliding title merges",
    "                              into a marked region instead of overwriting hand-written",
    "                              content.",
    "",
    "Options:",
    "  --root <dir>   Vault to act on. Defaults to the working directory. Never guessed from",
    "                 this script's location, so the same command works from anywhere.",
    "  --dry-run      For writing commands: print the target paths and the exact lines that",
    "                 would be written, and write nothing.",
    "  --show-paths   Print the absolute target path (diagnostics). Output is relative by",
    "                 default, because it is routinely pasted into an issue.",
    "  -h, --help     This text.",
    "",
    'This is the deterministic CLI. The `"heyloey"` / `"hey loey"` chat prefix is a separate',
    "conversational interface handled by the assistant inside the chat; it is not this command.",
    "Installing the CLI globally is optional \u2014 `npm run heyloey` needs only Node."
  ].join("\n");
}
function parseArgs(argv) {
  let root = process.cwd();
  let dryRun = false;
  let showPaths = false;
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help")
      return { kind: "help" };
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--show-paths") {
      showPaths = true;
      continue;
    }
    if (arg === "--root") {
      const value = argv[i + 1];
      if (!value)
        return { kind: "error", message: "--root requires a directory" };
      root = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--root=")) {
      root = arg.slice("--root=".length);
      if (!root)
        return { kind: "error", message: "--root requires a directory" };
      continue;
    }
    if (arg.startsWith("-") && arg !== "-") {
      return { kind: "error", message: `unknown option: ${arg}` };
    }
    positional.push(arg);
  }
  if (positional.length === 0)
    return { kind: "help" };
  const command = positional[0];
  if (!COMMANDS.includes(command)) {
    return { kind: "error", message: `unknown command: ${command}` };
  }
  return {
    kind: "command",
    command,
    args: positional.slice(1),
    options: { root: path.resolve(root), dryRun, showPaths }
  };
}
function describeTarget(root, showPaths) {
  if (showPaths)
    return root;
  const relative2 = path.relative(process.cwd(), root);
  if (relative2 === "")
    return ".";
  return path.isAbsolute(relative2) ? path.basename(root) : relative2;
}
function validateTarget(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { reason: "not a directory" };
  }
  if (root === path.parse(root).root) {
    return { reason: "refusing to act on the filesystem root" };
  }
  if (path.basename(root) === ".git") {
    return { reason: "refusing to act on a Git directory" };
  }
  const missing = REQUIRED_MARKERS.filter((marker) => !fs.existsSync(path.join(root, marker)));
  if (missing.length > 0) {
    return { reason: "not a vault", missing };
  }
  return null;
}
function refusalLine(failure, root, showPaths) {
  const detail = failure.reason === "not a vault" ? `not a vault: missing ${failure.missing.join(", ")}` : failure.reason;
  return `heyloey: ${detail}: ${describeTarget(root, showPaths)}`;
}
function readText(root, rel) {
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute))
    return null;
  return fs.readFileSync(absolute, "utf8");
}
function isInsideVault(root, candidate) {
  const relative2 = path.relative(root, candidate);
  return relative2 === "" || !relative2.startsWith("..") && !path.isAbsolute(relative2);
}
function resolveInsideVault(root, rel) {
  const realRoot = fs.realpathSync(root);
  const absolute = path.resolve(root, rel);
  if (!isInsideVault(path.resolve(root), absolute))
    return null;
  let probe = absolute;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe)
      break;
    probe = parent;
  }
  const realProbe = fs.realpathSync(probe);
  return isInsideVault(realRoot, realProbe) ? absolute : null;
}
function todayStr() {
  return formatDate2(/* @__PURE__ */ new Date());
}
function timeStr(date = /* @__PURE__ */ new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function loadDailyNotesConfig(root) {
  const raw = readText(root, DAILY_NOTES_CONFIG_PATH);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        folder: typeof parsed.folder === "string" && parsed.folder ? parsed.folder : DEFAULT_DAILY_NOTES_CONFIG.folder,
        format: typeof parsed.format === "string" && parsed.format ? parsed.format : DEFAULT_DAILY_NOTES_CONFIG.format
      };
    } catch {
    }
  }
  return DEFAULT_DAILY_NOTES_CONFIG;
}
function sectionSlice(lines, heading) {
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1)
    return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (/^#{2,6}\s/.test(trimmed) || trimmed === "---") {
      end = i;
      break;
    }
  }
  return { start, end };
}
function insertDailyLogLine(content, line) {
  const lines = content.split("\n");
  const section = sectionSlice(lines, DAILY_LOG_HEADING);
  if (!section)
    return { content, ok: false };
  const body = lines.slice(section.start + 1, section.end);
  if (body.some((entry) => entry.trim() === line.trim())) {
    return { content, ok: true, duplicate: true };
  }
  let lastBullet = -1;
  let emptyBullet = -1;
  for (let i = section.start + 1; i < section.end; i += 1) {
    if (/^\s*-\s+\S/.test(lines[i]))
      lastBullet = i;
    else if (/^\s*-\s*$/.test(lines[i]))
      emptyBullet = i;
  }
  if (emptyBullet !== -1) {
    lines[emptyBullet] = line;
  } else {
    const insertAt = lastBullet !== -1 ? lastBullet + 1 : section.start + 1;
    lines.splice(insertAt, 0, line);
  }
  return { content: lines.join("\n"), ok: true };
}
function insertLatestUpdate(content, line) {
  const lines = content.split("\n");
  const section = sectionSlice(lines, HANDOFF_HEADING);
  if (!section)
    return { content, ok: false };
  const body = lines.slice(section.start + 1, section.end);
  if (body.some((entry) => entry.trim() === line.trim())) {
    return { content, ok: true, duplicate: true };
  }
  let insertAt = section.start + 1;
  while (insertAt < section.end && lines[insertAt].trim() === "")
    insertAt += 1;
  lines.splice(insertAt, 0, line);
  return { content: lines.join("\n"), ok: true };
}
function countCheckboxes(lines, heading) {
  const section = sectionSlice(lines, heading);
  if (!section)
    return { done: 0, total: 0 };
  let done = 0;
  let total = 0;
  for (let i = section.start + 1; i < section.end; i += 1) {
    const match = lines[i].match(/^\s*-\s*\[(.)\]/);
    if (!match)
      continue;
    total += 1;
    const task = { text: lines[i], status: match[1], path: "" };
    if (isDone(task))
      done += 1;
  }
  return { done, total };
}
function countBullets(lines, heading) {
  const section = sectionSlice(lines, heading);
  if (!section)
    return 0;
  let count = 0;
  for (let i = section.start + 1; i < section.end; i += 1) {
    if (/^\s*-\s+\S/.test(lines[i]) && !/^\s*-\s*\[/.test(lines[i]))
      count += 1;
  }
  return count;
}
function activeProjects(root) {
  const dir = path.join(root, "02-Projects");
  if (!fs.existsSync(dir))
    return [];
  const active = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue;
    const hub = readText(root, path.join("02-Projects", entry.name, `${entry.name}.md`));
    if (!hub)
      continue;
    if (isLifecycleActive(readFrontmatterValue(hub, "status")))
      active.push(entry.name);
  }
  return active.sort();
}
function runBrief(root, options) {
  const label = describeTarget(root, options.showPaths);
  const lines = [];
  lines.push(`\u{1F305} Hey Loey brief \xB7 Vault root: ${label}`);
  const memory = fs.existsSync(path.join(root, MEMORY_RECORD));
  const handoff = fs.existsSync(path.join(root, HANDOFF_RECORD));
  lines.push(
    `Records: ${MEMORY_RECORD} ${memory ? "present" : "missing"}, ${HANDOFF_RECORD} ${handoff ? "present" : "missing"}`
  );
  const config = loadDailyNotesConfig(root);
  const dailyRel = resolveDailyNoteFile(todayStr(), config);
  const dailyInside = resolveInsideVault(root, dailyRel) !== null;
  const daily = dailyInside ? readText(root, dailyRel) : null;
  lines.push(
    `Today (${todayStr()}): ${dailyRel} ${dailyInside ? daily ? "present" : "missing" : "outside the vault \u2014 ignored"}`
  );
  if (daily) {
    const dailyLines = daily.split("\n");
    const focus = countBullets(dailyLines, "### \u{1F3AF} Today's Focus");
    const tasks = countCheckboxes(dailyLines, "### \u2705 Tasks");
    const habits = countCheckboxes(dailyLines, "### \u{1F501} Habits");
    const mood = readFrontmatterValue(daily, "mood") || "\u2014";
    const energy = readFrontmatterValue(daily, "energy") || "\u2014";
    const sleep = readFrontmatterValue(daily, "sleep_hours") || "\u2014";
    lines.push(`  Focus: ${focus} intention${focus === 1 ? "" : "s"}`);
    lines.push(`  Tasks: ${tasks.total - tasks.done} open / ${tasks.done} done`);
    lines.push(`  Habits: ${habits.done}/${habits.total}`);
    lines.push(`  Vitals: mood=${mood}, energy=${energy}, sleep_hours=${sleep}`);
  }
  const dump = readText(root, "00-Inbox/quick-capture-dump.md");
  const inbox = dump ? parseDumpLines(dump.split("\n")).length : 0;
  lines.push(`Inbox: ${inbox} unprocessed capture${inbox === 1 ? "" : "s"}`);
  const projects = activeProjects(root);
  lines.push(
    `Active projects: ${projects.length}${projects.length ? ` (${projects.join(", ")})` : ""}`
  );
  console.log(lines.join("\n"));
  return 0;
}
function indexRouteCandidates(root) {
  const candidates = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith("."))
        continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md"))
        continue;
      const rel = path.relative(root, absolute).split(path.sep).join("/");
      const content = fs.readFileSync(absolute, "utf8");
      const aliases = new Set(parseAliases(content).map((alias) => alias.toLowerCase()));
      const headings = new Set(
        content.split("\n").map((line) => line.match(/^#{1,6}\s+(.*)$/)).filter((match) => match !== null).map((match) => match[1].trim().toLowerCase())
      );
      extractWikilinks(content);
      candidates.push({ rel, aliases, headings });
    }
  };
  for (const prefix of ROUTE_PREFIXES) {
    const dir = path.join(root, prefix);
    if (fs.existsSync(dir))
      walk(dir);
  }
  return candidates;
}
function runContext(root, args, options) {
  const query = args.join(" ").trim();
  if (!query) {
    console.error('heyloey: context requires a query, e.g. `context "kanban sync"`');
    return 2;
  }
  const tokens = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
  if (tokens.length === 0) {
    console.log("No usable query tokens (each must be at least two characters).");
    return 0;
  }
  const scored = [];
  for (const candidate of indexRouteCandidates(root)) {
    const base = path.basename(candidate.rel, ".md").toLowerCase();
    let score = 0;
    const because = [];
    for (const token of tokens) {
      if (base === token) {
        score += 8;
        if (!because.includes("name"))
          because.push("name");
      } else if (base.includes(token)) {
        score += 5;
        if (!because.includes("name"))
          because.push("name");
      }
      if ([...candidate.aliases].some((alias) => alias.includes(token))) {
        score += 6;
        if (!because.includes("alias"))
          because.push("alias");
      }
      if ([...candidate.headings].some((heading) => heading.includes(token))) {
        score += 3;
        if (!because.includes("heading"))
          because.push("heading");
      }
    }
    if (score > 0)
      scored.push({ rel: candidate.rel, score, because });
  }
  scored.sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel));
  console.log(`\u{1F50E} context "${query}" \xB7 Vault root: ${describeTarget(root, options.showPaths)}`);
  if (scored.length === 0) {
    console.log("No matching notes.");
    return 0;
  }
  for (const hit of scored.slice(0, 5)) {
    console.log(`  ${hit.rel}  \u2014 matches ${hit.because.join(", ")}`);
  }
  return 0;
}
function runDone(root, args, options) {
  const summary = toSingleLine(args.join(" "));
  if (!summary) {
    console.error('heyloey: done requires a one-line summary, e.g. `done "Ship the parser fix"`');
    return 2;
  }
  const config = loadDailyNotesConfig(root);
  const dailyRel = resolveDailyNoteFile(todayStr(), config);
  const dailyTarget = resolveInsideVault(root, dailyRel);
  const handoffTarget = resolveInsideVault(root, HANDOFF_RECORD);
  if (!dailyTarget || !handoffTarget) {
    const escaping = !dailyTarget ? dailyRel : HANDOFF_RECORD;
    console.error(`heyloey: refusing to write outside the vault: ${escaping}`);
    console.error("   Nothing was written.");
    return 1;
  }
  const daily = readText(root, dailyRel);
  const handoff = readText(root, HANDOFF_RECORD);
  const problems = [];
  if (!daily)
    problems.push(`today's daily note is absent (${dailyRel})`);
  if (!handoff)
    problems.push(`${HANDOFF_RECORD} is absent`);
  if (problems.length > 0) {
    console.error(`heyloey: ${problems.join("; ")}.`);
    console.error(
      `   Create the missing record with \`npm run init:vault\` (for ${HANDOFF_RECORD}) and open today's daily note from 99-Templates/Daily.md. Nothing was written.`
    );
    return 1;
  }
  const stamp = timeStr();
  const dailyLine = `- **${stamp}**: ${summary}`;
  const handoffLine = `- [x] **[${todayStr()} ${stamp}]** ${summary}`;
  const dailyResult = insertDailyLogLine(daily, dailyLine);
  if (!dailyResult.ok) {
    console.error(
      `heyloey: ${dailyRel} has no \`${DAILY_LOG_HEADING}\` section, so there is nowhere established to write. Nothing was written.`
    );
    return 1;
  }
  const handoffResult = insertLatestUpdate(handoff, handoffLine);
  if (!handoffResult.ok) {
    console.error(
      `heyloey: ${HANDOFF_RECORD} has no \`${HANDOFF_HEADING}\` section, so there is nowhere established to write. Nothing was written.`
    );
    return 1;
  }
  if (options.dryRun) {
    console.log(`\u{1F50E} Dry run \u2014 nothing was written. Vault: ${describeTarget(root, options.showPaths)}`);
    console.log(`   ${dailyRel}`);
    console.log(`     + ${dailyLine}`);
    console.log(`   ${HANDOFF_RECORD}`);
    console.log(`     + ${handoffLine}`);
    return 0;
  }
  fs.writeFileSync(dailyTarget, dailyResult.content);
  fs.writeFileSync(handoffTarget, handoffResult.content);
  console.log(`\u270D\uFE0F  Logged milestone to ${dailyRel} and ${HANDOFF_RECORD}.`);
  console.log(`   ${dailyLine}`);
  return 0;
}
function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match)
    return { fm: "", body: content };
  return { fm: match[1], body: content.slice(match[0].length) };
}
function detectLanguage(pattern) {
  if (/(^|\n)\s*(interface|type)\s+\w+|:\s*(string|number|boolean)\b|<[A-Za-z]\w*>(\s*\(|\s*:)|as\s+const/.test(pattern)) {
    return "typescript";
  }
  if (/(^|\n)\s*(function|const|let|var)\s+\w+|=>|console\.log\(/.test(pattern))
    return "javascript";
  if (/(^|\n)\s*def\s+\w+\(|print\(|elif\s|self\./.test(pattern))
    return "python";
  if (/(^|\n)\s*(SELECT|INSERT|UPDATE|CREATE TABLE)\b/i.test(pattern))
    return "sql";
  if (/(^|\n)\s*#!.*\b(bash|sh)\b|(^|\n)\s*(echo|export|set -e)\b/.test(pattern))
    return "bash";
  return "text";
}
function buildSnippetCore(title, pattern, created) {
  const language = detectLanguage(pattern);
  const fence = pattern.includes("```") ? "````" : "```";
  return [
    "---",
    `created: ${created}`,
    `updated: ${created}`,
    "type: snippet",
    "area: dev",
    "status: active",
    `language: ${language}`,
    "tags:",
    "  - type/snippet",
    "  - area/dev",
    "  - status/active",
    "---",
    "",
    `# \u{1F4BB} ${title}`,
    "",
    `> **Reusable ${language} pattern indexed by \`heyloey learn\`.**`,
    "",
    "---",
    "",
    "## \u26A1 The Code / Implementation",
    `${fence}${language}`,
    pattern,
    fence,
    "",
    "## \u{1F50D} How It Works & Key Highlights",
    "- ",
    "",
    "## \u2699\uFE0F Usage Example",
    "- ",
    "",
    "## \u26A0\uFE0F Gotchas & Performance Considerations",
    "- ",
    ""
  ].join("\n");
}
function connectivitySection(hubLink) {
  return ["---", "", HUB_HEADING, hubLink ? `- ${hubLink}` : "- ", ""].join("\n");
}
function buildSnippetNote(title, pattern, created, hubLink) {
  return `${buildSnippetCore(title, pattern, created)}
${connectivitySection(hubLink)}`;
}
function generatedBody(markdown) {
  return splitFrontmatter(markdown).body.replace(/^\s*#\s+.*\n+/, "").trim();
}
function mergeLearnNote(existing, core) {
  const incoming = generatedBody(core);
  const { fm, body } = splitFrontmatter(existing);
  const curated = body.trimEnd();
  const region = new RegExp(
    `\\n*${escapeRegExp(LEARN_START)}[\\s\\S]*?${escapeRegExp(LEARN_END)}\\n*`
  );
  const existingRegion = curated.match(region);
  if (existingRegion) {
    if (existingRegion[0].includes(incoming))
      return { content: existing, action: "unchanged" };
  } else if (curated.includes(incoming)) {
    return { content: existing, action: "unchanged" };
  }
  const block = `${LEARN_START}

> [!NOTE] Auto-appended by \`heyloey learn\`. Review, then keep or delete.

${incoming}

${LEARN_END}`;
  const merged = existingRegion ? curated.replace(region, () => `

${block}
`) : `${curated}

---

${block}
`;
  const content = fm ? `---
${fm}
---

${merged.trimStart()}` : merged;
  return { content, action: "merged" };
}
function fencedLines(lines) {
  const fenced = [];
  let open = null;
  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (open === null) {
      const usable = fence !== null && !(fence[1][0] === "`" && fence[2].includes("`"));
      if (usable)
        open = fence[1];
      fenced.push(usable);
      continue;
    }
    fenced.push(true);
    if (fence && fence[1][0] === open[0] && fence[1].length >= open.length && fence[2].trim() === "") {
      open = null;
    }
  }
  return fenced;
}
function ensureHubLink(content, canonical) {
  const lines = content.split("\n");
  const fenced = fencedLines(lines);
  const isHubLine = (index) => !fenced[index] && lines[index].trim() === canonical;
  const found = lines.filter((_, index) => isHubLine(index)).length;
  if (found === 1)
    return content;
  if (found > 1) {
    let kept = false;
    return lines.filter((_, index) => {
      if (!isHubLine(index))
        return true;
      if (kept)
        return false;
      kept = true;
      return true;
    }).join("\n");
  }
  const heading = lines.findIndex(
    (line, index) => !fenced[index] && HUB_HEADING_PATTERN.test(line)
  );
  if (heading < 0) {
    return `${content.replace(/\s+$/, "")}

---

${HUB_HEADING}
${canonical}
`;
  }
  let at = heading + 1;
  while (at < lines.length && lines[at].trim() === "")
    at++;
  return [...lines.slice(0, at), canonical, ...lines.slice(at)].join("\n");
}
function findExistingSnippet(root, safeTitle) {
  const dir = path.join(root, SNIPPET_DIR);
  if (!fs.existsSync(dir))
    return null;
  const wanted = `${safeTitle}.md`.toLowerCase();
  for (const entry of fs.readdirSync(dir)) {
    if (entry.toLowerCase() === wanted)
      return path.join(SNIPPET_DIR, entry);
  }
  return null;
}
function runLearn(root, args, options) {
  const title = toSingleLine(args[0] ?? "");
  const pattern = args.slice(1).join("\n").replace(/\s+$/, "");
  if (!title || !pattern) {
    console.error(
      'heyloey: learn requires a title and a pattern, e.g. `learn "Debounce" "const d = ..."`'
    );
    return 2;
  }
  const safeTitle = sanitizeTitle(title);
  if (!safeTitle) {
    console.error(`heyloey: "${title}" has no usable filename characters.`);
    return 2;
  }
  const created = todayStr();
  const hubLink = fs.existsSync(path.join(root, DEV_HUB)) ? DEV_HUB_LINK : "";
  const connection = hubLink ? `${hubLink} (existing Dev hub)` : "no hub link \u2014 no existing Dev hub to connect to";
  const core = buildSnippetCore(safeTitle, pattern, created);
  const generated = `${core}
${connectivitySection(hubLink)}`;
  const existingRel = findExistingSnippet(root, safeTitle);
  const targetRel = existingRel ?? path.join(SNIPPET_DIR, `${safeTitle}.md`);
  const targetAbs = resolveInsideVault(root, targetRel);
  if (!targetAbs) {
    console.error(`heyloey: refusing to write outside the vault: ${targetRel.replace(/\\/g, "/")}`);
    console.error("   Nothing was written.");
    return 1;
  }
  let content = generated;
  let action = "created";
  let original = null;
  if (existingRel) {
    original = fs.readFileSync(path.join(root, existingRel), "utf8");
    const merged = mergeLearnNote(original, core);
    content = merged.content;
    action = merged.action;
  }
  if (hubLink)
    content = ensureHubLink(content, `- ${hubLink}`);
  if (original !== null) {
    if (content === original) {
      content = original;
      action = "unchanged";
    } else if (action === "unchanged") {
      action = "merged";
    }
  }
  if (options.dryRun) {
    console.log(`\u{1F50E} Dry run \u2014 nothing was written. Vault: ${describeTarget(root, options.showPaths)}`);
    console.log(`   ${targetRel.replace(/\\/g, "/")} (${action === "created" ? "would create" : `would ${action}`})`);
    console.log(`   connects: ${connection}`);
    console.log("");
    console.log(content);
    return 0;
  }
  if (action === "unchanged") {
    console.log(`\u21A9\uFE0E  ${targetRel.replace(/\\/g, "/")} already carries this pattern; nothing changed.`);
    console.log(`   connects: ${connection}`);
    return 0;
  }
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.writeFileSync(targetAbs, content);
  console.log(
    `${action === "created" ? "\u270D\uFE0F  Created" : "\u{1F500} Merged"} ${targetRel.replace(/\\/g, "/")}${action === "merged" ? " (hand-written content preserved; new material is marked for review)" : ""}.`
  );
  console.log(`   connects: ${connection}`);
  return 0;
}
function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.kind === "help") {
    console.log(usage());
    return;
  }
  if (parsed.kind === "error") {
    console.error(`heyloey: ${parsed.message}`);
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  const { command, args, options } = parsed;
  const failure = validateTarget(options.root);
  if (failure) {
    console.error(refusalLine(failure, options.root, options.showPaths));
    console.error("   Nothing was written. Point --root at a vault, or run this from one.");
    process.exitCode = 1;
    return;
  }
  if (!WRITING_COMMANDS.has(command) && options.dryRun) {
    console.log("(read-only command: --dry-run has no effect)");
  }
  let code = 0;
  switch (command) {
    case "brief":
      code = runBrief(options.root, options);
      break;
    case "context":
      code = runContext(options.root, args, options);
      break;
    case "done":
      code = runDone(options.root, args, options);
      break;
    case "learn":
      code = runLearn(options.root, args, options);
      break;
  }
  process.exitCode = code;
}
if (require.main === module) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEV_HUB_LINK,
  LEARN_END,
  LEARN_START,
  buildSnippetNote,
  detectLanguage,
  insertDailyLogLine,
  insertLatestUpdate,
  mergeLearnNote,
  parseArgs,
  resolveInsideVault,
  validateTarget
});
