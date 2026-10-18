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
  kernelLockPath: () => kernelLockPath,
  legacyLockPath: () => legacyLockPath,
  lockDirPath: () => lockDirPath,
  mergeLearnNote: () => mergeLearnNote,
  parseArgs: () => parseArgs,
  resolveInsideVault: () => resolveInsideVault,
  validateTarget: () => validateTarget
});
module.exports = __toCommonJS(heyloey_exports);
var fs = __toESM(require("fs"));

// 06-Resources/scripts/src/lib/daily-log-time.ts
function aucklandStamp(date = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const part = (name) => parts.find((value) => value.type === name).value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}
function minuteOfDay(value) {
  const match = value.replace(/&nbsp;|\u00a0/g, " ").trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match)
    return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23))
    return null;
  if (match[3])
    hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return hour * 60 + minute;
}
function displayLogTime(value, separator = " ") {
  const minutes = minuteOfDay(value);
  if (minutes === null)
    return value;
  const hour = Math.floor(minutes / 60);
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}${separator}${hour >= 12 ? "PM" : "AM"}`;
}
function normalizeDailyLog(content) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(newline);
  const start = lines.findIndex((line) => /^## 📝 Daily Log\s*$/.test(line));
  if (start < 0)
    return content;
  let end = start + 1;
  while (end < lines.length && !/^#{1,6}\s|^---\s*$/.test(lines[end]))
    end++;
  let fenced = false;
  for (let i = start + 1; i < end; ) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fenced = !fenced;
      i++;
      continue;
    }
    if (fenced) {
      i++;
      continue;
    }
    const bullet = (line) => line.match(/^(- \*\*\[?)([^\]*]+)(\]?\*\*(?::|\s).*)$/);
    const table = (line) => line.match(/^(> \|\s*)([^|]+?)(\s*\|.*)$/);
    const kind = bullet(lines[i]) ? bullet : table;
    const first = kind(lines[i]);
    if (!first || minuteOfDay(first[2]) === null) {
      i++;
      continue;
    }
    const entries = [];
    let cursor = i;
    while (cursor < end) {
      const match = kind(lines[cursor]);
      const minutes = match ? minuteOfDay(match[2]) : null;
      if (!match || minutes === null)
        break;
      const entry = [match[1] + displayLogTime(match[2], kind === table ? "&nbsp;" : " ") + match[3]];
      cursor++;
      if (kind === bullet) {
        while (cursor < end && /^(?: {2,}|\t)\S/.test(lines[cursor]))
          entry.push(lines[cursor++]);
      }
      entries.push({ minutes, lines: entry });
    }
    const sorted = entries.sort((a, b) => a.minutes - b.minutes).flatMap((entry) => entry.lines);
    lines.splice(i, cursor - i, ...sorted);
    i = cursor;
  }
  return lines.join(newline);
}

// 06-Resources/scripts/src/heyloey.ts
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var crypto = __toESM(require("crypto"));
var import_child_process = require("child_process");

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
var COMMANDS = ["brief", "context", "done", "learn", "lock-state"];
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
    "  lock-state                  Read-only. Reports the vault, lock protocol, and kernel lock file.",
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
  let root = process.env.LOEY_SPACE_DIR || process.cwd();
  let rootExplicit = false;
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
      rootExplicit = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--root=")) {
      root = arg.slice("--root=".length);
      if (!root)
        return { kind: "error", message: "--root requires a directory" };
      rootExplicit = true;
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
    options: { root: path.resolve(root), rootExplicit, dryRun, showPaths }
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
var LOCK_TIMEOUT_MS = Number(process.env.LOEY_LOCK_TIMEOUT_MS || 15e3);
var LOCK_IMPL_REQUESTED = String(process.env.LOEY_LOCK_IMPL || "auto").toLowerCase();
var LOCK_ALREADY_HELD = process.env.LOEY_LOCK_HELD === "1";
var LOCK_WRAPPER_PID = LOCK_ALREADY_HELD ? process.ppid : null;
var LOCK_HOLD_MS = Number(process.env.LOEY_LOCK_HOLD_MS || 0);
var RETIRED_LOCK_KNOBS = ["LOEY_LOCK_RECOVERY", "LOEY_LOCK_STALE_MS", "LOEY_LOCK_RECLAIM_DELAY_MS"];
function obsoleteLockConfig() {
  const problems = [];
  if (LOCK_IMPL_REQUESTED !== "auto" && LOCK_IMPL_REQUESTED !== "flock") {
    problems.push(
      LOCK_IMPL_REQUESTED === "file" ? "LOEY_LOCK_IMPL=file requests the removed metadata-file tier (only auto|flock remain)" : `LOEY_LOCK_IMPL=${LOCK_IMPL_REQUESTED} is not a supported value (only auto|flock remain)`
    );
  }
  for (const knob of RETIRED_LOCK_KNOBS) {
    const value = process.env[knob];
    if (value !== void 0 && String(value) !== "") {
      problems.push(`${knob}=${value} configured the removed metadata-file tier`);
    }
  }
  return problems;
}
function lockDirPath() {
  return process.env.LOEY_LOCK_DIR || (fs.existsSync("/tmp") ? "/tmp/heyloey-locks" : path.join(os.tmpdir(), "heyloey-locks"));
}
function vaultLockKey(root) {
  let identity = root;
  try {
    identity = fs.realpathSync(root);
  } catch (_) {
  }
  return crypto.createHash("sha1").update(identity).digest("hex").slice(0, 20);
}
function kernelLockPath(root) {
  return path.join(lockDirPath(), `vault-${vaultLockKey(root)}.flock`);
}
function legacyLockPath(root) {
  return path.join(lockDirPath(), `vault-${vaultLockKey(root)}.lock`);
}
var _flockChecked = false;
var _flockBin = null;
function flockBinPath() {
  if (process.env.FLOCK_BIN)
    return process.env.FLOCK_BIN;
  if (_flockChecked)
    return _flockBin;
  _flockChecked = true;
  if (process.platform === "win32")
    return _flockBin;
  try {
    const p = (0, import_child_process.execSync)("command -v flock 2>/dev/null", { encoding: "utf8", shell: "/bin/sh" }).trim();
    if (p)
      _flockBin = p;
  } catch (_) {
  }
  return _flockBin;
}
function kernelLockOwnerGone() {
  if (!LOCK_ALREADY_HELD)
    return false;
  if (LOCK_WRAPPER_PID !== 1 && process.ppid === 1)
    return true;
  if (LOCK_WRAPPER_PID && LOCK_WRAPPER_PID > 1) {
    try {
      process.kill(LOCK_WRAPPER_PID, 0);
    } catch (e) {
      if (e.code === "ESRCH")
        return true;
    }
  }
  return false;
}
function assertKernelLockHeld() {
  if (!kernelLockOwnerGone())
    return;
  console.error(
    "[heyloey] LOCK unavailable: the kernel lock wrapper is gone (it exited or was killed), so the kernel lock is no longer held; nothing written."
  );
  process.exit(8);
}
function getVaultSource(root, options) {
  if (process.env.LOEY_SPACE_DIR && path.resolve(process.env.LOEY_SPACE_DIR) === path.resolve(root)) {
    return "LOEY_SPACE_DIR";
  }
  if (options.rootExplicit) {
    return "--root";
  }
  return "default";
}
function detectSynthetic(root) {
  if (process.env.LOEY_SPACE_SYNTHETIC === "1") {
    return { synthetic: true, reason: "LOEY_SPACE_SYNTHETIC=1" };
  }
  const candidates = [root, process.cwd()];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, ".loey-synthetic"))) {
      return { synthetic: true, reason: `.loey-synthetic in ${dir}` };
    }
  }
  return { synthetic: false, reason: null };
}
function atomicWriteFileSync(filePath, content) {
  assertKernelLockHeld();
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
  );
  let targetMode = null;
  try {
    targetMode = fs.statSync(filePath).mode & 511;
  } catch (_) {
  }
  if (targetMode !== null) {
    fs.accessSync(filePath, fs.constants.W_OK);
  }
  let fd = null;
  try {
    fd = fs.openSync(tmp, "wx", targetMode !== null ? targetMode : 420);
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    if (targetMode !== null) {
      try {
        fs.chmodSync(tmp, targetMode);
      } catch (_) {
      }
    }
    fs.renameSync(tmp, filePath);
  } catch (e) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {
      }
    }
    try {
      if (fs.existsSync(tmp))
        fs.unlinkSync(tmp);
    } catch (_) {
    }
    throw e;
  }
}
function runUnderKernelLock(root) {
  const bin = flockBinPath();
  if (!bin) {
    console.error("[heyloey] LOCK unavailable: flock binary not found; nothing written.");
    process.exit(8);
  }
  const p = kernelLockPath(root);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  } catch (_) {
  }
  const timeoutMs = Number(process.env.LOEY_LOCK_TIMEOUT_MS || 15e3);
  const secs = Math.max(1, Math.ceil(timeoutMs / 1e3));
  const scriptPath = path.resolve(process.argv[1] || __filename);
  const child = (0, import_child_process.spawn)(
    bin,
    [
      "-w",
      String(secs),
      "-E",
      "7",
      p,
      process.execPath,
      ...process.execArgv,
      scriptPath,
      ...process.argv.slice(2)
    ],
    {
      stdio: "inherit",
      detached: true,
      env: {
        ...process.env,
        LOEY_LOCK_HELD: "1",
        LOEY_LOCK_IMPL_USED: "flock"
      }
    }
  );
  const forwardSig = (sig) => {
    try {
      if (child.pid)
        process.kill(-child.pid, sig);
    } catch (_) {
      try {
        child.kill(sig);
      } catch (__) {
      }
    }
  };
  const onSigInt = () => forwardSig("SIGINT");
  const onSigTerm = () => forwardSig("SIGTERM");
  const onSigHup = () => forwardSig("SIGHUP");
  process.once("SIGINT", onSigInt);
  process.once("SIGTERM", onSigTerm);
  process.once("SIGHUP", onSigHup);
  child.on("error", (e) => {
    console.error(`[heyloey] LOCK unavailable: kernel lock failed: ${e.message} (${p}); nothing written.`);
    process.exit(8);
  });
  child.on("exit", (code, signal) => {
    process.removeListener("SIGINT", onSigInt);
    process.removeListener("SIGTERM", onSigTerm);
    process.removeListener("SIGHUP", onSigHup);
    if (signal)
      process.exit(signal === "SIGINT" ? 130 : 143);
    if (code === 7) {
      console.error(
        `[heyloey] LOCK contention: timed out after ${timeoutMs}ms waiting for ${p} (impl=flock, kernel-managed: the kernel releases the lock when its holder exits, so there is no stale state to recover); nothing written.`
      );
      process.exit(7);
    }
    process.exit(code === null ? 1 : code);
  });
}
function runLockState(root, options) {
  const problems = obsoleteLockConfig();
  const source = getVaultSource(root, options);
  if (problems.length > 0) {
    console.log(`[heyloey] Vault: ${root} (source: ${source})`);
    console.log("[heyloey] LOCK protocol: unavailable (removed configuration present)");
    for (const p of problems)
      console.error(`[heyloey] LOCK config error: ${p}`);
    return 8;
  }
  if (process.platform === "win32") {
    console.log(`[heyloey] Vault: ${root} (source: ${source})`);
    console.log("[heyloey] LOCK protocol: unavailable (flock is not available on native Windows; run within WSL)");
    return 8;
  }
  const legacy = legacyLockPath(root);
  if (fs.existsSync(legacy)) {
    console.log(`[heyloey] Vault: ${root} (source: ${source})`);
    console.log(`[heyloey] LOCK legacy state: a metadata-file lock from the removed file tier exists at ${legacy}`);
    return 9;
  }
  const bin = flockBinPath();
  if (!bin) {
    console.log(`[heyloey] Vault: ${root} (source: ${source})`);
    console.log("[heyloey] LOCK protocol: unavailable (flock binary not found)");
    return 8;
  }
  const kPath = kernelLockPath(root);
  console.log(`[heyloey] Vault: ${root} (source: ${source})`);
  console.log("[heyloey] LOCK protocol: kernel-managed flock");
  console.log(`[heyloey] LOCK kernel lock file: ${kPath}`);
  return 0;
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
  return aucklandStamp().date;
}
function timeStr(date = /* @__PURE__ */ new Date()) {
  return aucklandStamp(date).time;
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
  return { content: normalizeDailyLog(lines.join("\n")), ok: true };
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
function hasSummaryInSection(content, heading, summary) {
  const lines = content.split("\n");
  const section = sectionSlice(lines, heading);
  if (!section)
    return false;
  return lines.slice(section.start + 1, section.end).some((line) => line.includes(summary));
}
var DONE_EXIT = {
  logged: 0,
  "already-recorded": 0,
  skipped: 3,
  refused: 4,
  partial: 5,
  failed: 6
};
function runDone(root, args, options) {
  const summary = toSingleLine(args.join(" ")).trim();
  if (!summary) {
    console.error('heyloey: done requires a one-line summary, e.g. `done "Ship the parser fix"`');
    return 2;
  }
  const source = getVaultSource(root, options);
  const receipt = (outcome2, daily2, handoff2, verified2) => {
    console.log(
      `RESULT done ${outcome2} daily=${daily2} handoff=${handoff2} lock=flock target=${root} source=${source} verified=${verified2 || "none"}`
    );
  };
  const synthetic = detectSynthetic(root);
  if (synthetic.synthetic) {
    console.log(`[heyloey] SKIPPED done - explicit synthetic opt-out (${synthetic.reason}); nothing written.`);
    console.log(
      `RESULT done skipped lock=flock target=${root} source=${source} reason=synthetic`
    );
    return DONE_EXIT.skipped;
  }
  const config = loadDailyNotesConfig(root);
  const dailyRel = resolveDailyNoteFile(todayStr(), config);
  const dailyTarget = resolveInsideVault(root, dailyRel);
  const handoffTarget = resolveInsideVault(root, HANDOFF_RECORD);
  if (!dailyTarget || !handoffTarget) {
    const escaping = !dailyTarget ? dailyRel : HANDOFF_RECORD;
    console.error(`heyloey: refusing to write outside the vault: ${escaping}`);
    console.error("   Nothing was written.");
    receipt("refused", "not-attempted", "not-attempted", "");
    return DONE_EXIT.refused;
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
    receipt("refused", daily ? "present" : "missing", handoff ? "present" : "missing", "");
    return DONE_EXIT.refused;
  }
  const stamp = timeStr();
  const dailyLine = `- **${displayLogTime(stamp)}**: ${summary}`;
  const handoffLine = `- [x] **[${todayStr()} ${stamp}]** ${summary}`;
  const dailyResult = insertDailyLogLine(daily, dailyLine);
  if (!dailyResult.ok) {
    console.error(
      `heyloey: ${dailyRel} has no \`${DAILY_LOG_HEADING}\` section, so there is nowhere established to write. Nothing was written.`
    );
    receipt("refused", "section-missing", "not-attempted", "");
    return DONE_EXIT.refused;
  }
  const handoffResult = insertLatestUpdate(handoff, handoffLine);
  if (!handoffResult.ok) {
    console.error(
      `heyloey: ${HANDOFF_RECORD} has no \`${HANDOFF_HEADING}\` section, so there is nowhere established to write. Nothing was written.`
    );
    receipt("refused", "not-attempted", "section-missing", "");
    return DONE_EXIT.refused;
  }
  const dailyRecorded = hasSummaryInSection(daily, DAILY_LOG_HEADING, summary);
  const handoffRecorded = hasSummaryInSection(handoff, HANDOFF_HEADING, summary);
  if (options.dryRun) {
    console.log(`\u{1F50E} Dry run \u2014 nothing was written. Vault: ${describeTarget(root, options.showPaths)}`);
    console.log(`   ${dailyRel}${dailyRecorded ? " (already recorded)" : ""}`);
    if (!dailyRecorded)
      console.log(`     + ${dailyLine}`);
    console.log(`   ${HANDOFF_RECORD}${handoffRecorded ? " (already recorded)" : ""}`);
    if (!handoffRecorded)
      console.log(`     + ${handoffLine}`);
    return 0;
  }
  if (LOCK_HOLD_MS > 0) {
    const waitBuf = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(waitBuf, 0, 0, LOCK_HOLD_MS);
  }
  let dailyStatus = dailyRecorded ? "already-recorded" : "failed";
  if (!dailyRecorded) {
    try {
      atomicWriteFileSync(dailyTarget, dailyResult.content);
      dailyStatus = readText(root, dailyRel)?.includes(summary) ? "written" : "failed";
      if (dailyStatus === "failed") {
        console.error(`heyloey: post-write verification failed for ${dailyRel}; the entry is not there.`);
      }
    } catch (error) {
      console.error(`heyloey: could not write ${dailyRel}: ${error.message}`);
    }
  }
  let handoffStatus = handoffRecorded ? "already-recorded" : "failed";
  if (!handoffRecorded) {
    try {
      atomicWriteFileSync(handoffTarget, handoffResult.content);
      handoffStatus = readText(root, HANDOFF_RECORD)?.includes(summary) ? "written" : "failed";
      if (handoffStatus === "failed") {
        console.error(`heyloey: post-write verification failed for ${HANDOFF_RECORD}; the entry is not there.`);
      }
    } catch (error) {
      console.error(`heyloey: could not write ${HANDOFF_RECORD}: ${error.message}`);
    }
  }
  const verified = [
    dailyStatus !== "failed" ? "daily" : "",
    handoffStatus !== "failed" ? "handoff" : ""
  ].filter(Boolean).join("+");
  const okCount = [dailyStatus, handoffStatus].filter((status) => status !== "failed").length;
  const writtenCount = [dailyStatus, handoffStatus].filter((status) => status === "written").length;
  if (okCount === 2) {
    const outcome2 = writtenCount === 0 ? "already-recorded" : "logged";
    if (writtenCount === 0) {
      console.log(`\u21A9\uFE0E  Milestone already recorded in ${dailyRel} and ${HANDOFF_RECORD}; nothing changed.`);
    } else {
      console.log(`\u270D\uFE0F  Logged milestone to ${dailyRel} and ${HANDOFF_RECORD}.`);
      console.log(`   ${dailyLine}`);
    }
    receipt(outcome2, dailyStatus, handoffStatus, verified);
    return DONE_EXIT[outcome2];
  }
  const outcome = writtenCount > 0 ? "partial" : "failed";
  console.error(
    `heyloey: ${outcome} \u2014 daily=${dailyStatus}, handoff=${handoffStatus}. Re-run \`done\` to complete the missing half; the recorded half will not be duplicated.`
  );
  receipt(outcome, dailyStatus, handoffStatus, verified);
  return DONE_EXIT[outcome];
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
  if (LOCK_HOLD_MS > 0) {
    const waitBuf = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(waitBuf, 0, 0, LOCK_HOLD_MS);
  }
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  atomicWriteFileSync(targetAbs, content);
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
  if (command === "lock-state") {
    process.exitCode = runLockState(options.root, options);
    return;
  }
  if (WRITING_COMMANDS.has(command) && !options.dryRun) {
    const problems = obsoleteLockConfig();
    if (problems.length > 0) {
      console.error("[heyloey] LOCK unavailable: " + problems.join("; ") + "; nothing written.");
      process.exitCode = 8;
      return;
    }
    if (process.platform === "win32") {
      console.error(
        "[heyloey] LOCK unavailable: flock is not available on native Windows; run within WSL; nothing written."
      );
      process.exitCode = 8;
      return;
    }
    const legacy = legacyLockPath(options.root);
    if (fs.existsSync(legacy)) {
      console.error(
        `[heyloey] LOCK legacy state: a metadata-file lock from the removed file tier exists at ${legacy}; nothing written.`
      );
      process.exitCode = 9;
      return;
    }
    const flockBin = flockBinPath();
    if (!flockBin) {
      console.error("[heyloey] LOCK unavailable: flock binary not found; nothing written.");
      process.exitCode = 8;
      return;
    }
    if (process.env.LOEY_LOCK_HELD !== "1") {
      runUnderKernelLock(options.root);
      return;
    }
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
  kernelLockPath,
  legacyLockPath,
  lockDirPath,
  mergeLearnNote,
  parseArgs,
  resolveInsideVault,
  validateTarget
});
