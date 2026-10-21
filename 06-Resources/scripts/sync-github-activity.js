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

// 06-Resources/scripts/src/sync-github-activity.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_child_process = require("child_process");

// 06-Resources/scripts/src/lib/daily-log-time.ts
var DAILY_LOG_HEADING = "## \u{1F4DD} Daily Log";
var DAILY_LOG_INTRO = "> _A running timestamp of what happened today._";
var LOG_AREA_HEADINGS = {
  personal: "### \u{1F9CD} Personal Log",
  agent: "### \u{1F916} Agent Milestones",
  github: "### \u{1F419} GitHub Activity"
};
var LOG_AREA_ORDER = ["personal", "agent", "github"];
var LOG_AREA_BY_HEADING = new Map(
  LOG_AREA_ORDER.map((area) => [LOG_AREA_HEADINGS[area], area])
);
function logAreaOf(line) {
  return LOG_AREA_BY_HEADING.get(line.trim()) ?? null;
}
var AREA_CALLOUT = {
  personal: /^> \[!NOTE\]-\s*🧍/,
  agent: /^> \[!NOTE\]-\s*🤖(?:\s+Show entries|\s+Agent Milestone Log)/,
  github: /^> \[!NOTE\]-\s*🐙 GitHub Activity Log/
};
function findAreaCallout(lines, area, from, to) {
  for (let i = from; i < to; i += 1)
    if (AREA_CALLOUT[area].test(lines[i].trim()))
      return i;
  return -1;
}
function calloutBlockEnd(lines, start, limit) {
  let end = start + 1;
  while (end < limit && /^\s*>/.test(lines[end]))
    end += 1;
  if (end < limit && lines[end].trim() === "")
    end += 1;
  return end;
}
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
function dailyLogBounds(lines) {
  const start = lines.findIndex((line) => line.trim() === DAILY_LOG_HEADING);
  if (start < 0)
    return null;
  let end = start + 1;
  while (end < lines.length) {
    const trimmed = lines[end].trim();
    if (/^#{1,2}\s/.test(trimmed) || /^---\s*$/.test(trimmed))
      break;
    end++;
  }
  return { start, end };
}
function dailyLogPreambleEnd(lines, parent) {
  let index = parent.start + 1;
  while (index < parent.end && (lines[index].trim() === "" || lines[index].trim().startsWith(">")))
    index++;
  return index;
}
function logAreaBounds(lines, area) {
  const parent = dailyLogBounds(lines);
  if (!parent)
    return null;
  const heading = LOG_AREA_HEADINGS[area];
  let start = -1;
  for (let i = parent.start + 1; i < parent.end; i++) {
    if (lines[i].trim() === heading) {
      start = i;
      break;
    }
  }
  if (start < 0)
    return null;
  let end = start + 1;
  while (end < parent.end && !/^#{3,}\s/.test(lines[end].trim()))
    end++;
  return { start, end };
}
function insertHeading(lines, at, heading) {
  const block = [];
  if (at > 0 && lines[at - 1].trim() !== "")
    block.push("");
  block.push(heading);
  lines.splice(at, 0, ...block);
  const after = at + block.length;
  if (lines[after] !== void 0 && lines[after].trim() !== "")
    lines.splice(after, 0, "");
  return at + block.length - 1;
}
function ensureLogArea(lines, area) {
  const existing = logAreaBounds(lines, area);
  if (existing)
    return existing.start;
  const parent = dailyLogBounds(lines);
  if (!parent)
    return null;
  const heading = LOG_AREA_HEADINGS[area];
  const callout = findAreaCallout(lines, area, parent.start + 1, parent.end);
  if (callout !== -1)
    return insertHeading(lines, callout, heading);
  if (area === "personal")
    return insertHeading(lines, dailyLogPreambleEnd(lines, parent), heading);
  for (let index = LOG_AREA_ORDER.indexOf(area) + 1; index < LOG_AREA_ORDER.length; index++) {
    const later = logAreaBounds(lines, LOG_AREA_ORDER[index]);
    if (later)
      return insertHeading(lines, later.start, heading);
  }
  return insertHeading(lines, parent.end, heading);
}
function agentCalloutLabel(count) {
  return `> [!NOTE]- \u{1F916} Show entries (${count})`;
}
var AGENT_CALLOUT = /^> \[!NOTE\]-\s*🤖\s*Show entries/;
function tableCellsOf(line) {
  const match = line.trim().match(/^(?:>\s*)?\|(.*)\|\s*$/);
  if (!match)
    return null;
  const body = match[1];
  const cells = [];
  let cell = "";
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "\\" && body[index + 1] === "|") {
      cell += "\\|";
      index += 1;
      continue;
    }
    if (character === "|") {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  return cells;
}
function unescapeCell(cell) {
  return cell.replace(/\\\|/g, "|");
}
function isAgentHeader(cells) {
  return cells.length >= 3 && cells[0].toLowerCase() === "time" && cells[1].toLowerCase() === "scope";
}
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}
function readAgentTableRow(line) {
  const cells = tableCellsOf(line);
  if (!cells || cells.length < 3 || isAgentHeader(cells) || isSeparatorRow(cells))
    return null;
  if (minuteOfDay(cells[0]) === null)
    return null;
  return {
    stamp: cells[0],
    scope: cells[1],
    summary: cells.slice(2).map(unescapeCell).join(" | ")
  };
}
function sortAgentTable(lines, header, limit) {
  let first = header + 1;
  const separator = tableCellsOf(lines[first] ?? "");
  if (separator && isSeparatorRow(separator))
    first += 1;
  let end = first;
  while (end < limit) {
    const cells = tableCellsOf(lines[end]);
    if (!cells || isSeparatorRow(cells) || minuteOfDay(cells[0]) === null)
      break;
    end += 1;
  }
  if (end - first < 2)
    return;
  const rows = lines.slice(first, end);
  rows.sort((left, right) => {
    const leftMinutes = minuteOfDay(tableCellsOf(left)[0]);
    const rightMinutes = minuteOfDay(tableCellsOf(right)[0]);
    return leftMinutes - rightMinutes;
  });
  lines.splice(first, end - first, ...rows);
}
function findAgentContainer(lines, area) {
  const container = { start: -1, end: -1, header: -1 };
  for (let index = area.start + 1; index < area.end; index += 1) {
    if (!AGENT_CALLOUT.test(lines[index].trim()))
      continue;
    container.start = index;
    container.end = calloutBlockEnd(lines, index, area.end);
    for (let row = index + 1; row < container.end; row += 1) {
      const cells = tableCellsOf(lines[row]);
      if (cells && isAgentHeader(cells)) {
        container.header = row;
        break;
      }
    }
    return container;
  }
  return container;
}
function sortAgentAreaTable(lines) {
  const bounds = logAreaBounds(lines, "agent");
  if (!bounds)
    return;
  const container = findAgentContainer(lines, bounds);
  const limit = container.start !== -1 ? container.end : bounds.end;
  let header = container.header;
  if (header === -1) {
    for (let index = bounds.start + 1; index < limit; index += 1) {
      const cells = tableCellsOf(lines[index]);
      if (cells && isAgentHeader(cells)) {
        header = index;
        break;
      }
    }
  }
  if (header === -1)
    return;
  if (container.start !== -1) {
    let separator = -1;
    for (let index = container.start + 1; index < container.end; index += 1) {
      const cells = tableCellsOf(lines[index]);
      if (cells && isSeparatorRow(cells)) {
        separator = index;
        break;
      }
    }
    if (separator !== -1 && (header !== container.start + 1 || separator !== header + 1)) {
      const structure = [lines[header], lines[separator]];
      for (const index of [header, separator].sort((left, right) => right - left))
        lines.splice(index, 1);
      lines.splice(container.start + 1, 0, ...structure);
      header = container.start + 1;
    }
    lines[container.start] = agentCalloutLabel(countAgentRows(lines, { ...container, header }));
  }
  sortAgentTable(lines, header, limit);
}
function countAgentRows(lines, container) {
  if (container.header === -1)
    return 0;
  let count = 0;
  for (let index = container.header + 1; index < container.end; index += 1) {
    if (readAgentTableRow(lines[index]))
      count += 1;
  }
  return count;
}
function sortTimedEntries(lines, start, end) {
  let fenced = false;
  for (let i = start; i < end; ) {
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
}
function normalizeDailyLog(content) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(newline);
  const parent = dailyLogBounds(lines);
  if (!parent)
    return content;
  const boundaries = [];
  for (let i = parent.start + 1; i < parent.end; i++) {
    const area = logAreaOf(lines[i]);
    if (area)
      boundaries.push({ index: i, area });
  }
  const slices = [];
  let cursor = parent.start + 1;
  for (const boundary of boundaries) {
    slices.push({ start: cursor, end: boundary.index, area: null });
    cursor = boundary.index + 1;
  }
  slices.push({ start: cursor, end: parent.end, area: boundaries.at(-1)?.area ?? null });
  for (let index = slices.length - 1; index >= 0; index -= 1) {
    const slice = slices[index];
    if (slice.area === "agent")
      continue;
    sortTimedEntries(lines, slice.start, slice.end);
  }
  sortAgentAreaTable(lines);
  return lines.join(newline);
}

// 06-Resources/scripts/src/lib/github-events.ts
function cleanBranchName(raw) {
  if (!raw)
    return "main";
  const branch = raw.replace(/^refs\/heads\//, "").trim();
  return branch.replace(/-\d{10,}$/, "");
}
function formatTime12(date) {
  return displayLogTime(aucklandStamp(date).time, "&nbsp;");
}
function formatDateKey(date) {
  return aucklandStamp(date).date;
}
function escapeTablePipes(text) {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
async function fetchCommitDetailsMap(pushes, execFn) {
  const commitMap = /* @__PURE__ */ new Map();
  const uniqueItems = /* @__PURE__ */ new Map();
  for (const p of pushes) {
    if (p.head && !uniqueItems.has(p.head)) {
      uniqueItems.set(p.head, p.repo);
    }
  }
  if (uniqueItems.size === 0)
    return commitMap;
  let runner = execFn;
  if (!runner) {
    try {
      const cp = require("child_process");
      const util = require("util");
      const execFileAsync = util.promisify(cp.execFile);
      runner = async (cmd) => {
        if (Array.isArray(cmd)) {
          const [file, ...args] = cmd;
          return execFileAsync(file, args, { encoding: "utf8" });
        }
        return util.promisify(cp.exec)(cmd, { encoding: "utf8" });
      };
    } catch {
      return commitMap;
    }
  }
  const tasks = Array.from(uniqueItems.entries()).map(async ([head, repo]) => {
    try {
      const cmd = ["gh", "api", `repos/${repo}/commits/${head}`, "-q", "{message: .commit.message, url: .html_url}"];
      const { stdout } = await runner(cmd);
      const data = JSON.parse(stdout);
      commitMap.set(head, {
        message: data.message ? data.message.split("\n")[0].trim() : "",
        url: data.url || `https://github.com/${repo}/commit/${head}`
      });
    } catch {
      commitMap.set(head, {
        message: "",
        url: `https://github.com/${repo}/commit/${head}`
      });
    }
  });
  await Promise.all(tasks);
  return commitMap;
}
function formatGitHubEventToRow(event, commitMap) {
  const date = new Date(event.created_at);
  const time = formatTime12(date);
  const dateKey = formatDateKey(date);
  const repoShort = event.repo.name.split("/")[1] || event.repo.name;
  const repo = `\`${repoShort}\``;
  let eventType = "";
  let details = "";
  if (event.type === "PushEvent") {
    eventType = `\u{1F419} Push`;
    const branch = cleanBranchName(event.payload?.ref || "main");
    const head = event.payload?.head;
    const commits = event.payload?.commits || [];
    if (commits.length > 0) {
      const commitItems = commits.slice(0, 2).map((c) => {
        const msg = escapeTablePipes(c.message.split("\n")[0].trim());
        const url = c.url || (c.sha ? `https://github.com/${event.repo.name}/commit/${c.sha}` : head ? `https://github.com/${event.repo.name}/commit/${head}` : "");
        return url ? `[${msg}](${url})` : msg;
      }).filter(Boolean);
      details = `\`${branch}\`: ${commitItems.join("; ")}`;
    } else if (head) {
      const info = commitMap?.get(head);
      if (info && info.message) {
        const msg = escapeTablePipes(info.message.split("\n")[0].trim());
        const url = info.url || `https://github.com/${event.repo.name}/commit/${head}`;
        details = `\`${branch}\`: [${msg}](${url})`;
      } else {
        const shortHead = head.slice(0, 7);
        const url = `https://github.com/${event.repo.name}/commit/${head}`;
        details = `\`${branch}\`: [\`${shortHead}\`](${url})`;
      }
    } else {
      details = `\`${branch}\``;
    }
  } else if (event.type === "PullRequestEvent") {
    const action = event.payload?.action;
    const pr = event.payload?.pull_request;
    const number = pr?.number || event.payload?.number;
    const isMerged = action === "closed" && pr?.merged;
    const url = pr?.html_url || (number ? `https://github.com/${event.repo.name}/pull/${number}` : "");
    if (isMerged) {
      eventType = `\u{1F500} PR #${number} Merged`;
    } else if (action === "opened") {
      eventType = `\u{1F500} PR #${number} Opened`;
    } else {
      eventType = `\u{1F500} PR #${number} ${action}`;
    }
    const title = pr?.title ? escapeTablePipes(pr.title) : "";
    const headBranch = cleanBranchName(pr?.head?.ref);
    const baseBranch = cleanBranchName(pr?.base?.ref || "main");
    if (title && title !== "Pull Request") {
      if (url) {
        if (headBranch && headBranch !== "main") {
          details = `[${title}](${url}) (\`${headBranch}\` \u2192 \`${baseBranch}\`)`;
        } else {
          details = `[${title}](${url})`;
        }
      } else {
        details = title;
      }
    } else if (headBranch && headBranch !== "main") {
      details = url ? `[\`${headBranch}\` \u2192 \`${baseBranch}\`](${url})` : `\`${headBranch}\` \u2192 \`${baseBranch}\``;
    } else {
      details = url ? `[\`${baseBranch}\`](${url})` : `\`${baseBranch}\``;
    }
  } else if (event.type === "IssuesEvent") {
    const action = event.payload?.action;
    const issue = event.payload?.issue;
    const rawTitle = issue?.title || "Issue";
    const title = escapeTablePipes(rawTitle);
    const number = issue?.number;
    const url = issue?.html_url || (number ? `https://github.com/${event.repo.name}/issues/${number}` : "");
    eventType = `\u{1F3AF} Issue #${number} ${action}`;
    details = url ? `[${title}](${url})` : title;
  } else if (event.type === "CreateEvent") {
    const refType = event.payload?.ref_type;
    const ref = cleanBranchName(event.payload?.ref);
    if (refType === "branch" || refType === "tag") {
      eventType = `\u{1F33F} New ${refType === "branch" ? "Branch" : "Tag"}`;
      details = `\`${ref}\``;
    } else {
      return null;
    }
  } else if (event.type === "ReleaseEvent") {
    const release = event.payload?.release;
    const releaseName = escapeTablePipes(release?.name || release?.tag_name || "Release");
    const url = release?.html_url || `https://github.com/${event.repo.name}/releases`;
    eventType = `\u{1F680} Release`;
    details = url ? `[${releaseName}](${url})` : releaseName;
  } else {
    return null;
  }
  return {
    id: event.id,
    time,
    dateKey,
    repo,
    type: eventType,
    details,
    rawDate: date
  };
}
function buildGitHubCalloutTable(rows) {
  if (rows.length === 0)
    return "";
  const sortedRows = [...rows].sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  const header = `> [!NOTE]- \u{1F419} GitHub Activity Log (${sortedRows.length} event${sortedRows.length === 1 ? "" : "s"} \u2014 click to expand)
> | Time | Repo | Action | Details / Branch |
> | :--- | :--- | :--- | :--- |`;
  const tableLines = sortedRows.map((r) => `> | ${r.time} | ${r.repo} | ${r.type} | ${r.details} |`);
  return `${header}
${tableLines.join("\n")}`;
}
function mergeDailyLogTable(existingContent, rows) {
  if (rows.length === 0) {
    return { updatedContent: existingContent, count: 0 };
  }
  const calloutBlock = buildGitHubCalloutTable(rows);
  const newline = existingContent.includes("\r\n") ? "\r\n" : "\n";
  const lines = existingContent.split(newline);
  const parent = dailyLogBounds(lines);
  if (!parent) {
    const newSection = `${newline}${DAILY_LOG_HEADING}${newline}${DAILY_LOG_INTRO}${newline}- ${newline}${newline}${LOG_AREA_HEADINGS.github}${newline}${newline}${calloutBlock}${newline}`;
    return { updatedContent: existingContent + newSection, count: rows.length };
  }
  ensureLogArea(lines, "github");
  const calloutStart = lines.findIndex((line) => /^\s*> \[!NOTE\]-\s*🐙 GitHub Activity Log/.test(line));
  const areaBefore = logAreaBounds(lines, "github");
  if (!areaBefore) {
    return { updatedContent: existingContent, count: 0 };
  }
  if (calloutStart >= 0) {
    let calloutEnd = calloutStart + 1;
    while (calloutEnd < lines.length && /^\s*>/.test(lines[calloutEnd]))
      calloutEnd += 1;
    if (calloutStart > areaBefore.start && calloutStart < areaBefore.end) {
      lines.splice(calloutStart, calloutEnd - calloutStart, ...calloutBlock.split(newline));
      return { updatedContent: normalizeDailyLog(lines.join(newline)), count: rows.length };
    }
    lines.splice(calloutStart, calloutEnd - calloutStart);
    if (lines[calloutStart - 1]?.trim() === "" && lines[calloutStart]?.trim() === "") {
      lines.splice(calloutStart, 1);
    }
  }
  const area = logAreaBounds(lines, "github");
  if (!area) {
    return { updatedContent: existingContent, count: rows.length };
  }
  let insertIdx = area.start + 1;
  while (insertIdx < area.end && lines[insertIdx].trim() === "")
    insertIdx++;
  lines.splice(insertIdx, 0, ...calloutBlock.split(newline), "");
  return { updatedContent: normalizeDailyLog(lines.join(newline)), count: rows.length };
}

// 06-Resources/scripts/src/sync-github-activity.ts
function isTFile(file) {
  return Boolean(file && typeof file === "object" && "extension" in file && "path" in file);
}
function resolveVaultPath() {
  const fromCwd = process.cwd();
  if (fs.existsSync(path.join(fromCwd, "01-Daily")) || fs.existsSync(path.join(fromCwd, "06-Resources"))) {
    return fromCwd;
  }
  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, "01-Daily")) || fs.existsSync(path.join(current, "06-Resources"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current)
      break;
    current = parent;
  }
  return process.cwd();
}
function fetchUserEvents(username = "lowqualityloey") {
  try {
    const raw = (0, import_child_process.execFileSync)("gh", ["api", `users/${username}/events`, "-q", "."], {
      encoding: "utf8",
      timeout: 15e3
    });
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to fetch GitHub events via gh CLI:", err?.message || err);
    return [];
  }
}
async function syncGithubActivityAction(params) {
  const app = params?.app || (typeof window !== "undefined" ? window.app : globalThis.app);
  const Notice = typeof window !== "undefined" ? window.Notice : globalThis.Notice;
  if (!app) {
    await runCli();
    return;
  }
  let targetFile = app.workspace.getActiveFile();
  const todayDateKey = formatDateKey(/* @__PURE__ */ new Date());
  if (!targetFile || !targetFile.path.startsWith("01-Daily/") || targetFile.basename.startsWith("_")) {
    const todayPath = `01-Daily/${todayDateKey.slice(0, 7)}/${todayDateKey}.md`;
    const abstractFile = app.vault.getAbstractFileByPath(todayPath);
    if (abstractFile && isTFile(abstractFile)) {
      targetFile = abstractFile;
    }
  }
  if (!targetFile || !isTFile(targetFile)) {
    if (Notice)
      new Notice(`\u26A0\uFE0F Daily note for today (${todayDateKey}) does not exist. Create it first!`, 5e3);
    return;
  }
  const noteDateKey = targetFile.basename;
  if (Notice)
    new Notice("\u{1F419} Fetching GitHub activity...", 3e3);
  const events = fetchUserEvents("lowqualityloey");
  if (!events.length) {
    if (Notice)
      new Notice("\u26A0\uFE0F No GitHub activity found or gh CLI not authenticated.", 4e3);
    return;
  }
  const targetDateEvents = events.filter((ev) => {
    const d = new Date(ev.created_at);
    return formatDateKey(d) === noteDateKey;
  });
  const pushesToFetch = [];
  for (const ev of targetDateEvents) {
    if (ev.type === "PushEvent" && ev.payload?.head && (!ev.payload.commits || ev.payload.commits.length === 0)) {
      pushesToFetch.push({ repo: ev.repo.name, head: ev.payload.head });
    }
  }
  const commitMap = await fetchCommitDetailsMap(pushesToFetch);
  const rows = [];
  for (const ev of targetDateEvents) {
    const r = formatGitHubEventToRow(ev, commitMap);
    if (r) {
      rows.push(r);
    }
  }
  if (rows.length === 0) {
    if (Notice)
      new Notice(`\u2139\uFE0F No GitHub events found for ${noteDateKey}.`, 4e3);
    return;
  }
  const content = await app.vault.read(targetFile);
  const { updatedContent, count } = mergeDailyLogTable(content, rows);
  await app.vault.modify(targetFile, updatedContent);
  if (Notice)
    new Notice(`\u{1F389} Synced ${count} GitHub event(s) into table callout for ${targetFile.basename}!`, 5e3);
}
async function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const targetDateKey = args[0] || formatDateKey(/* @__PURE__ */ new Date());
  console.log("\u{1F419} Sync GitHub Activity to Daily Log (Table Callout Mode)...");
  console.log(`\u{1F4C2} Vault Root: ${vaultRoot}`);
  console.log(`\u{1F4C5} Target Date: ${targetDateKey}
`);
  const monthFolder = targetDateKey.slice(0, 7);
  const dailyPath = path.join(vaultRoot, "01-Daily", monthFolder, `${targetDateKey}.md`);
  if (!fs.existsSync(dailyPath)) {
    console.error(`\u274C Daily note not found: ${dailyPath}`);
    process.exit(1);
  }
  console.log(`\u{1F50D} Fetching GitHub events for lowqualityloey...`);
  const events = fetchUserEvents("lowqualityloey");
  const targetDateEvents = events.filter((ev) => {
    const d = new Date(ev.created_at);
    return formatDateKey(d) === targetDateKey;
  });
  const pushesToFetch = [];
  for (const ev of targetDateEvents) {
    if (ev.type === "PushEvent" && ev.payload?.head && (!ev.payload.commits || ev.payload.commits.length === 0)) {
      pushesToFetch.push({ repo: ev.repo.name, head: ev.payload.head });
    }
  }
  if (pushesToFetch.length > 0) {
    console.log(`\u26A1 Resolving commit details for ${pushesToFetch.length} push event(s)...`);
  }
  const commitMap = await fetchCommitDetailsMap(pushesToFetch);
  const rows = [];
  for (const ev of targetDateEvents) {
    const r = formatGitHubEventToRow(ev, commitMap);
    if (r) {
      rows.push(r);
    }
  }
  if (rows.length === 0) {
    console.log(`\u2139\uFE0F No GitHub activity found for date ${targetDateKey}.`);
    return;
  }
  console.log(`\u{1F4CB} Found ${rows.length} activity item(s) for table callout:`);
  rows.slice(0, 5).forEach((r) => console.log(`  | ${r.time} | ${r.repo} | ${r.type} | ${r.details.slice(0, 50)}... |`));
  const content = fs.readFileSync(dailyPath, "utf8");
  const { updatedContent, count } = mergeDailyLogTable(content, rows);
  fs.writeFileSync(dailyPath, updatedContent, "utf8");
  console.log(`
\u{1F389} Successfully formatted ${count} event(s) into collapsible table callout in ${dailyPath}!`);
}
if (require.main === module) {
  runCli();
}
module.exports = Object.assign(syncGithubActivityAction, {
  fetchUserEvents,
  syncGithubActivityAction
});
