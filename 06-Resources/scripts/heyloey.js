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
var DAILY_LOG_HEADING = "## \u{1F4DD} Daily Log";
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
var LEGACY_AGENT_CALLOUT = /^> \[!NOTE\]-\s*🤖 Agent Milestone Log/;
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
function adoptAreaCallout(lines, area) {
  const parent = dailyLogBounds(lines);
  const heading = logAreaBounds(lines, area);
  if (!parent || !heading)
    return false;
  const start = findAreaCallout(lines, area, parent.start + 1, parent.end);
  if (start === -1)
    return false;
  if (start > heading.start && start < heading.end)
    return false;
  const block = lines.splice(start, calloutBlockEnd(lines, start, parent.end) - start);
  while (block.length > 1 && block[block.length - 1].trim() === "")
    block.pop();
  const target = logAreaBounds(lines, area);
  if (!target)
    return false;
  let at = target.end;
  while (at > target.start + 1 && lines[at - 1].trim() === "")
    at -= 1;
  const insert = [...block];
  if (at > 0 && lines[at - 1].trim() !== "")
    insert.unshift("");
  if (lines[at] !== void 0 && lines[at].trim() !== "")
    insert.push("");
  lines.splice(at, 0, ...insert);
  return true;
}
function adoptCalloutAreas(lines) {
  let adopted = 0;
  for (const area of LOG_AREA_ORDER) {
    const parent = dailyLogBounds(lines);
    if (!parent)
      break;
    if (findAreaCallout(lines, area, parent.start + 1, parent.end) === -1)
      continue;
    if (!logAreaBounds(lines, area))
      ensureLogArea(lines, area);
    if (adoptAreaCallout(lines, area))
      adopted += 1;
  }
  return adopted;
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
function insertDailyLogEntry(content, line, area) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(newline);
  if (!dailyLogBounds(lines))
    return { content, ok: false };
  if (ensureLogArea(lines, area) === null)
    return { content, ok: false };
  adoptCalloutAreas(lines);
  const bounds = logAreaBounds(lines, area);
  const bodyStart = bounds.start + 1;
  if (lines.slice(bodyStart, bounds.end).some((entry) => entry.trim() === line.trim())) {
    return { content, ok: true, duplicate: true };
  }
  let lastBullet = -1;
  let emptyBullet = -1;
  for (let i = bodyStart; i < bounds.end; i += 1) {
    if (/^\s*-\s+\S/.test(lines[i]))
      lastBullet = i;
    else if (/^\s*-\s*$/.test(lines[i]))
      emptyBullet = i;
  }
  if (emptyBullet !== -1) {
    lines[emptyBullet] = line;
  } else if (lastBullet === -1 && bodyStart < bounds.end && lines[bodyStart].trim() === "") {
    lines[bodyStart] = line;
  } else {
    const insertAt = lastBullet !== -1 ? lastBullet + 1 : bodyStart;
    lines.splice(insertAt, 0, line);
  }
  const lastBody = logAreaBounds(lines, area).end - 1;
  if (lastBody >= 0 && lines[lastBody].trim() !== "" && lines[lastBody + 1] !== void 0) {
    lines.splice(lastBody + 1, 0, "");
  }
  tidyAreaSpacer(lines, area);
  return { content: normalizeDailyLog(lines.join(newline)), ok: true };
}
function tidyAreaSpacer(lines, area) {
  const body = logAreaBounds(lines, area);
  if (!body)
    return;
  let spacer = body.start + 1;
  while (spacer < body.end && lines[spacer].trim() === "")
    spacer += 1;
  if (spacer === body.start + 1)
    return;
  if (!lines.slice(spacer, body.end).some((entry) => /^\s*-\s+\S/.test(entry)))
    return;
  lines.splice(body.start + 1, spacer - body.start - 1);
}
var AGENT_TABLE_HEADER = ["| Time | Scope | Milestone |", "| :--- | :--- | :--- |"];
function agentCalloutLabel(count) {
  return `> [!NOTE]- \u{1F916} Show entries (${count})`;
}
var AGENT_CALLOUT = /^> \[!NOTE\]-\s*🤖\s*Show entries/;
function quoted(line) {
  return `> ${line}`;
}
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
function escapeCell(text) {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
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
function logAreaEntries(content, area) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(newline);
  const bounds = logAreaBounds(lines, area);
  if (!bounds)
    return [];
  const entries = [];
  for (let index = bounds.start + 1; index < bounds.end; index += 1) {
    const bullet = readLogEntry(lines[index]);
    if (bullet) {
      entries.push({ stamp: bullet.stamp, scope: "", summary: bullet.summary });
      continue;
    }
    const row = readAgentTableRow(lines[index]);
    if (row)
      entries.push(row);
  }
  return entries;
}
function logAreaHasSummary(content, area, summary) {
  const needle = unescapeCell(summary.trim());
  return logAreaEntries(content, area).some((entry) => entry.summary.includes(needle));
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
function appendAgentRows(lines, rows, preferredAt = -1) {
  ensureLogArea(lines, "agent");
  let area = logAreaBounds(lines, "agent");
  let container = findAgentContainer(lines, area);
  if (container.start === -1) {
    const anchor = preferredAt > area.start && preferredAt < area.end ? preferredAt : area.start + 1;
    const block = [agentCalloutLabel(rows.length), ...AGENT_TABLE_HEADER.map(quoted), ...rows.map(quoted)];
    if (anchor > 0 && lines[anchor - 1].trim() !== "")
      block.unshift("");
    lines.splice(anchor, 0, ...block);
    let after = anchor + block.length;
    while (after < lines.length && lines[after].trim() === "")
      after += 1;
    const blanks = after - (anchor + block.length);
    if (blanks === 0)
      lines.splice(after, 0, "");
    else if (blanks > 1)
      lines.splice(anchor + block.length, blanks - 1);
  } else if (container.header === -1) {
    lines.splice(container.start + 1, 0, ...AGENT_TABLE_HEADER.map(quoted), ...rows.map(quoted));
  } else {
    let end = container.end;
    while (end > container.header + 1 && !readAgentTableRow(lines[end - 1]))
      end -= 1;
    const separator = tableCellsOf(lines[container.header + 1] ?? "");
    const firstData = container.header + (separator && isSeparatorRow(separator) ? 2 : 1);
    lines.splice(Math.max(end, firstData), 0, ...rows.map(quoted));
  }
  area = logAreaBounds(lines, "agent");
  container = findAgentContainer(lines, area);
  if (container.start !== -1) {
    const count = countAgentRows(lines, container);
    lines[container.start] = agentCalloutLabel(count);
    if (container.end < area.end && lines[container.end]?.trim() !== "") {
      lines.splice(container.end, 0, "");
    }
  }
  sortAgentAreaTable(lines);
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
function convertAgentArea(lines) {
  const bounds = logAreaBounds(lines, "agent");
  if (!bounds)
    return 0;
  const removals = [];
  const added = [];
  let anchor = -1;
  const container = findAgentContainer(lines, bounds);
  for (let index = bounds.start + 1; index < bounds.end; ) {
    if (container.start !== -1 && index >= container.start && index < container.end) {
      index = container.end;
      continue;
    }
    const trimmed = lines[index].trim();
    if (LEGACY_AGENT_CALLOUT.test(trimmed)) {
      const end = calloutBlockEnd(lines, index, bounds.end);
      for (let row = index + 1; row < end; row += 1) {
        const parsed = readAgentTableRow(lines[row]);
        if (parsed)
          added.push(`| ${parsed.stamp} | ${parsed.scope} | ${escapeCell(parsed.summary)} |`);
      }
      if (anchor === -1)
        anchor = index;
      removals.push({ start: index, end });
      index = end;
      continue;
    }
    const entry = readLogEntry(lines[index]);
    if (entry) {
      let cursor = index + 1;
      while (cursor < bounds.end && /^(?: {2,}|\t)\S/.test(lines[cursor]))
        cursor += 1;
      const continuation = lines.slice(index + 1, cursor).map((line) => line.trim()).filter(Boolean).join("<br>");
      const summary = escapeCell(entry.summary + (continuation ? `<br>${continuation}` : ""));
      added.push(`| ${displayLogTime(entry.stamp, "&nbsp;")} |  | ${summary} |`);
      if (anchor === -1)
        anchor = index;
      removals.push({ start: index, end: cursor });
      index = cursor;
      continue;
    }
    const cells = tableCellsOf(lines[index]);
    if (cells && isAgentHeader(cells)) {
      let cursor = index + 2;
      const rowStart = cursor;
      while (cursor < bounds.end && readAgentTableRow(lines[cursor]))
        cursor += 1;
      for (let row = rowStart; row < cursor; row += 1) {
        const parsed = readAgentTableRow(lines[row]);
        added.push(`| ${parsed.stamp} | ${parsed.scope} | ${escapeCell(parsed.summary)} |`);
      }
      if (anchor === -1)
        anchor = index;
      removals.push({ start: index, end: cursor });
      index = cursor;
      continue;
    }
    index += 1;
  }
  if (added.length === 0)
    return 0;
  for (let index = removals.length - 1; index >= 0; index -= 1) {
    const removal = removals[index];
    lines.splice(removal.start, removal.end - removal.start);
  }
  appendAgentRows(lines, added, anchor === -1 ? -1 : anchor);
  return added.length;
}
function insertAgentMilestone(content, entry) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(newline);
  if (!dailyLogBounds(lines))
    return { content, ok: false };
  ensureLogArea(lines, "agent");
  adoptCalloutAreas(lines);
  convertAgentArea(lines);
  if (logAreaHasSummary(lines.join(newline), "agent", entry.summary)) {
    return { content, ok: true, duplicate: true };
  }
  const row = `| ${displayLogTime(entry.stamp, "&nbsp;")} | ${entry.scope?.trim() ?? ""} | ${escapeCell(entry.summary)} |`;
  appendAgentRows(lines, [row]);
  return { content: normalizeDailyLog(lines.join(newline)), ok: true, row };
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
function readLogEntry(line) {
  const match = line.match(/^- \*\*(?:\[)?([^\]*]+?)(?:\])?\*\*(?::\s*|\s+)(.*)$/);
  if (!match)
    return null;
  const stamp = match[1].trim();
  if (minuteOfDay(stamp) === null)
    return null;
  return { stamp, summary: match[2].trim() };
}
function timedBlocks(lines, bounds) {
  const blocks = [];
  for (let index = bounds.start + 1; index < bounds.end; index += 1) {
    const entry = readLogEntry(lines[index]);
    if (!entry)
      continue;
    let cursor = index + 1;
    while (cursor < bounds.end && /^(?: {2,}|\t)\S/.test(lines[cursor]))
      cursor += 1;
    blocks.push({
      start: index,
      end: cursor,
      stamp: entry.stamp,
      summary: entry.summary,
      continuation: lines.slice(index + 1, cursor).map((line) => line.trim()).filter(Boolean).join("<br>")
    });
    index = cursor - 1;
  }
  return blocks;
}
function migrationRow(block) {
  const summary = escapeCell(block.continuation ? `${block.summary}<br>${block.continuation}` : block.summary);
  return `| ${displayLogTime(block.stamp, "&nbsp;")} |  | ${summary} |`;
}
function migrateAgentMilestones(content, selection = {}) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(newline);
  if (!dailyLogBounds(lines)) {
    return { content, moved: [], kept: [], adopted: 0, selectionErrors: [], ok: false };
  }
  for (const area of LOG_AREA_ORDER)
    ensureLogArea(lines, area);
  const adopted = adoptCalloutAreas(lines);
  const personal = logAreaBounds(lines, "personal");
  const blocks = timedBlocks(lines, personal);
  const chosen = /* @__PURE__ */ new Map();
  const selectionErrors = [];
  const select = (label, matches) => {
    const chosenMatches = matches.filter((block) => chosen.has(block.start));
    if (chosenMatches.length === matches.length && matches.length > 0)
      return;
    if (matches.length === 0) {
      selectionErrors.push(`${label} matches no timestamped personal entry`);
      return;
    }
    if (matches.length > 1) {
      selectionErrors.push(`${label} matches ${matches.length} personal entries; name one`);
      return;
    }
    chosen.set(matches[0].start, matches[0]);
  };
  for (const stamp of selection.selectStamps ?? []) {
    const minutes = minuteOfDay(stamp);
    if (minutes === null) {
      selectionErrors.push(`--select "${stamp}" is not a time (use e.g. "09:21 AM")`);
      continue;
    }
    select(`--select "${stamp}"`, blocks.filter((block) => minuteOfDay(block.stamp) === minutes));
  }
  for (const text of selection.selectSummaries ?? []) {
    const needle = text.trim();
    if (!needle) {
      selectionErrors.push("--select-summary requires some text");
      continue;
    }
    select(`--select-summary "${needle}"`, blocks.filter((block) => block.summary.includes(needle)));
  }
  if (selectionErrors.length > 0) {
    return {
      content,
      moved: [],
      kept: blocks.map((block) => block.summary),
      adopted: 0,
      selectionErrors,
      ok: true
    };
  }
  const ordered = [...chosen.values()].sort((left, right) => left.start - right.start);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const block = ordered[index];
    lines.splice(block.start, block.end - block.start);
  }
  convertAgentArea(lines);
  if (ordered.length > 0)
    appendAgentRows(lines, ordered.map(migrationRow));
  for (const area of LOG_AREA_ORDER)
    tidyAreaSpacer(lines, area);
  const migrated = normalizeDailyLog(lines.join(newline));
  return {
    content: migrated,
    moved: ordered.map((block) => block.summary),
    kept: logAreaEntries(migrated, "personal").map((entry) => entry.summary),
    adopted,
    selectionErrors: [],
    ok: true
  };
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
var HANDOFF_HEADING = "### Latest Updates";
var ROUTE_PREFIXES = ["02-Projects", "03-Dev", "04-Learning", "06-Resources", "08-Concepts"];
var SNIPPET_DIR = "03-Dev";
var DEV_HUB = "03-Dev/_Dev MOC.md";
var DEV_HUB_LINK = "[[_Dev MOC]]";
var LEARN_START = "<!-- heyloey:learn:start -->";
var LEARN_END = "<!-- heyloey:learn:end -->";
var HUB_HEADING = "## \u{1F517} Related Resources & Notes";
var HUB_HEADING_PATTERN = /^#{2,6}\s+.*\bRelated\b/;
var COMMANDS = ["brief", "context", "done", "learn", "lock-state", "migrate-log", "personal"];
var WRITING_COMMANDS = /* @__PURE__ */ new Set(["done", "learn", "migrate-log", "personal"]);
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
    '  done "<summary>"            Records a completed milestone as a row in the one agent table',
    "                              under `### \u{1F916} Agent Milestones` in today's daily note and under",
    "                              `### Latest Updates` in handoff.md. Refuses if either record is",
    "                              absent. Milestones only \u2014 see the Hey Loey Guide. With --personal",
    "                              the entry lands under `### \u{1F9CD} Personal Log` as a bullet and",
    "                              handoff.md is left alone.",
    '  learn "<Title>" "<Pattern>" Indexes a reusable technical pattern in `03-Dev/` and',
    "                              links it to the existing Dev hub. A colliding title merges",
    "                              into a marked region instead of overwriting hand-written",
    "                              content.",
    '  personal "<entry>"          Shorthand for `done --personal`: the owner\'s own entry, under',
    "                              `### \u{1F9CD} Personal Log`, with handoff.md never touched.",
    "  migrate-log [--date <day>] [--select <time>]... [--select-summary <text>]...",
    "                              One note (today unless --date is given) gains its labelled areas",
    "                              and its one agent table. Existing agent bullets and the old",
    "                              agent callout are converted; nothing is classified by its",
    "                              wording. Personal entries move only when named with --select",
    "                              or --select-summary.",
    "  lock-state                  Read-only. Reports the vault, lock protocol, and kernel lock file.",
    "",
    "Options:",
    "  --root <dir>   Vault to act on. Defaults to the working directory. Never guessed from",
    "                 this script's location, so the same command works from anywhere.",
    "  --dry-run      For writing commands: print the target paths and the exact lines that",
    "                 would be written, and write nothing.",
    "  --personal     With `done`: write under `### \u{1F9CD} Personal Log` and skip handoff.md.",
    "  --date <day>   With `migrate-log`: the daily note to separate (YYYY-MM-DD).",
    "  --select <t>   With `migrate-log`: move exactly one personal entry with this time, e.g.",
    '                 "09:21 AM". Repeat for more. This is the ONLY way a personal entry is moved:',
    "                 the command never infers authorship from a verb or a capital letter.",
    "  --select-summary <text>",
    "                 With `migrate-log`: the same, selected by a unique substring of the summary.",
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
  let personal = false;
  let date = null;
  const select = [];
  const selectSummaries = [];
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
    if (arg === "--personal") {
      personal = true;
      continue;
    }
    if (arg === "--date") {
      const value = argv[i + 1];
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { kind: "error", message: "--date requires YYYY-MM-DD, e.g. --date 2026-10-18" };
      }
      date = value;
      i += 1;
      continue;
    }
    if (arg === "--select" || arg.startsWith("--select=")) {
      const value = arg === "--select" ? argv[++i] : arg.slice("--select=".length);
      if (!value)
        return { kind: "error", message: '--select requires a time, e.g. --select "09:21 AM"' };
      select.push(value);
      continue;
    }
    if (arg === "--select-summary" || arg.startsWith("--select-summary=")) {
      const value = arg === "--select-summary" ? argv[++i] : arg.slice("--select-summary=".length);
      if (!value)
        return { kind: "error", message: "--select-summary requires a substring of the entry" };
      selectSummaries.push(value);
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
  if ((select.length > 0 || selectSummaries.length > 0) && command !== "migrate-log") {
    return { kind: "error", message: "--select and --select-summary are only valid with migrate-log" };
  }
  if (personal && command !== "done") {
    return { kind: "error", message: "--personal is only valid with done" };
  }
  if (date !== null && command !== "migrate-log") {
    return { kind: "error", message: "--date is only valid with migrate-log" };
  }
  return {
    kind: "command",
    command,
    args: positional.slice(1),
    options: { root: path.resolve(root), rootExplicit, dryRun, personal, date, select, selectSummaries, showPaths }
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
  const level = heading.match(/^#+/)?.[0].length ?? 2;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const found = trimmed.match(/^(#{1,6})\s/);
    if (found && found[1].length <= level || trimmed === "---") {
      end = i;
      break;
    }
  }
  return { start, end };
}
function insertDailyLogLine(content, line, area = "agent") {
  return insertDailyLogEntry(content, line, area);
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
function findStaleTasks(dailyContent, handoffContent, todayDate) {
  const stale = [];
  const dateRegex = /(?:📅|created:)\s*(\d{4}-\d{2}-\d{2})/;
  const todayMs = new Date(todayDate).getTime();
  function checkLine(line) {
    const trimmed = line.trim();
    if (!/^- \[[ \/]\] /.test(trimmed))
      return;
    const match = trimmed.match(dateRegex);
    if (!match)
      return;
    const taskDate = match[1];
    const taskMs = new Date(taskDate).getTime();
    if (isNaN(taskMs))
      return;
    const days = Math.floor((todayMs - taskMs) / (1e3 * 60 * 60 * 24));
    if (days >= 7) {
      const clean = trimmed.replace(/^- \[[ \/]\]\s*/, "").replace(dateRegex, "").trim();
      const snippet = clean.length > 40 ? clean.slice(0, 37) + "..." : clean;
      stale.push({ text: snippet, days });
    }
  }
  if (dailyContent) {
    for (const line of dailyContent.split("\n"))
      checkLine(line);
  }
  if (handoffContent) {
    for (const line of handoffContent.split("\n"))
      checkLine(line);
  }
  return stale;
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
  const alerts = [];
  if (inbox >= 5) {
    alerts.push(`\u26A0\uFE0F INBOX: ${inbox} unprocessed captures in 00-Inbox/quick-capture-dump.md`);
  }
  const auckland = aucklandStamp();
  const currentHour = parseInt(auckland.time.split(":")[0], 10);
  if (daily) {
    const habits = countCheckboxes(daily.split("\n"), "### \u{1F501} Habits");
    if (currentHour >= 18 && habits.total > 0 && habits.done === 0) {
      alerts.push(`\u26A0\uFE0F HABITS: 0/${habits.total} completed today (Local time: ${auckland.time})`);
    }
  }
  const handoffText = handoff ? readText(root, HANDOFF_RECORD) : null;
  const staleTasks = findStaleTasks(daily, handoffText, auckland.date);
  for (const stale of staleTasks.slice(0, 2)) {
    alerts.push(`\u26A0\uFE0F STALE TASK: "${stale.text}" (${stale.days}d old)`);
  }
  if (alerts.length > 0) {
    lines.push("Alerts:");
    for (const alert of alerts) {
      lines.push(`  ${alert}`);
    }
  }
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
function stemRouteToken(word) {
  if (word.length <= 2)
    return word;
  let w = word.toLowerCase();
  const isConsonant = (str, i) => {
    const c = str[i];
    if ("aeiou".includes(c))
      return false;
    if (c === "y")
      return i === 0 ? true : !isConsonant(str, i - 1);
    return true;
  };
  const measure = (str) => {
    let count = 0, i = 0, len = str.length;
    while (i < len && isConsonant(str, i))
      i++;
    while (i < len) {
      while (i < len && !isConsonant(str, i))
        i++;
      if (i < len) {
        count++;
        while (i < len && isConsonant(str, i))
          i++;
      }
    }
    return count;
  };
  const hasVowel = (str) => {
    for (let i = 0; i < str.length; i++) {
      if (!isConsonant(str, i))
        return true;
    }
    return false;
  };
  const endsWithDoubleConsonant = (str) => {
    if (str.length < 2)
      return false;
    return str[str.length - 1] === str[str.length - 2] && isConsonant(str, str.length - 1);
  };
  const endsCvc = (str) => {
    const l = str.length;
    if (l < 3)
      return false;
    return isConsonant(str, l - 1) && !isConsonant(str, l - 2) && isConsonant(str, l - 3) && !"wxy".includes(str[l - 1]);
  };
  if (w.endsWith("sses"))
    w = w.slice(0, -2);
  else if (w.endsWith("ies"))
    w = w.slice(0, -2);
  else if (!w.endsWith("ss") && w.endsWith("s"))
    w = w.slice(0, -1);
  let extra1b = false;
  if (w.endsWith("eed")) {
    const stemPart = w.slice(0, -3);
    if (measure(stemPart) > 0)
      w = stemPart + "ee";
  } else if (w.endsWith("ed")) {
    const stemPart = w.slice(0, -2);
    if (hasVowel(stemPart)) {
      w = stemPart;
      extra1b = true;
    }
  } else if (w.endsWith("ing")) {
    const stemPart = w.slice(0, -3);
    if (hasVowel(stemPart)) {
      w = stemPart;
      extra1b = true;
    }
  }
  if (extra1b) {
    if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) {
      w += "e";
    } else if (endsWithDoubleConsonant(w) && !w.endsWith("l") && !w.endsWith("s") && !w.endsWith("z")) {
      w = w.slice(0, -1);
    } else if (measure(w) === 1 && endsCvc(w)) {
      w += "e";
    }
  }
  if (w.endsWith("y")) {
    const stemPart = w.slice(0, -1);
    if (hasVowel(stemPart))
      w = stemPart + "i";
  }
  const step2Pairs = [
    ["ational", "ate"],
    ["tional", "tion"],
    ["enci", "ence"],
    ["anci", "ance"],
    ["izer", "ize"],
    ["abli", "able"],
    ["alli", "al"],
    ["entli", "ent"],
    ["eli", "e"],
    ["ousli", "ous"],
    ["ization", "ize"],
    ["ation", "ate"],
    ["ator", "ate"],
    ["alism", "al"],
    ["iveness", "ive"],
    ["fulness", "ful"],
    ["ousness", "ous"],
    ["aliti", "al"],
    ["iviti", "ive"],
    ["biliti", "ble"]
  ];
  for (const [suf, rep] of step2Pairs) {
    if (w.endsWith(suf)) {
      const stemPart = w.slice(0, -suf.length);
      if (measure(stemPart) > 0)
        w = stemPart + rep;
      break;
    }
  }
  const step3Pairs = [
    ["icate", "ic"],
    ["ative", ""],
    ["alize", "al"],
    ["iciti", "ic"],
    ["ical", "ic"],
    ["ful", ""],
    ["ness", ""]
  ];
  for (const [suf, rep] of step3Pairs) {
    if (w.endsWith(suf)) {
      const stemPart = w.slice(0, -suf.length);
      if (measure(stemPart) > 0)
        w = stemPart + rep;
      break;
    }
  }
  const step4Suffixes = [
    "al",
    "ance",
    "ence",
    "er",
    "ic",
    "able",
    "ible",
    "ant",
    "ement",
    "ment",
    "ent",
    "ou",
    "ism",
    "ate",
    "iti",
    "ous",
    "ive",
    "ize"
  ];
  for (const suf of step4Suffixes) {
    if (w.endsWith(suf)) {
      const stemPart = w.slice(0, -suf.length);
      if (measure(stemPart) > 1)
        w = stemPart;
      break;
    }
  }
  if (w.endsWith("ion")) {
    const stemPart = w.slice(0, -3);
    if (measure(stemPart) > 1 && (stemPart.endsWith("s") || stemPart.endsWith("t"))) {
      w = stemPart;
    }
  }
  if (w.endsWith("e")) {
    const stemPart = w.slice(0, -1);
    const m = measure(stemPart);
    if (m > 1 || m === 1 && !endsCvc(stemPart)) {
      w = stemPart;
    }
  }
  if (w.endsWith("ll") && measure(w.slice(0, -1)) > 1) {
    w = w.slice(0, -1);
  }
  return w;
}
var ROUTE_DEV_SYNONYMS = {
  desync: ["stale", "unhealthy", "corrupt", "disconnect"],
  stale: ["desync", "outdated", "unhealthy"],
  docker: ["container", "wsl", "mount", "daemon"],
  container: ["docker", "podman", "wsl", "image"],
  wsl: ["docker", "windows", "mount", "drvfs", "vhdx"],
  mount: ["bind", "volume", "wsl", "disk"],
  auth: ["jwt", "token", "session", "guard", "oauth"],
  jwt: ["auth", "token", "bearer", "header"],
  guard: ["middleware", "auth", "protect", "policy"],
  perm: ["permission", "accessdenied", "eaccessdenied", "chmod"],
  k8s: ["kubernetes", "cluster", "pod"],
  db: ["database", "postgres", "postgresql", "sqlite", "mysql"],
  sync: ["reconcile", "mirror", "parity"]
};
function runContext(root, args, options) {
  const query = args.join(" ").trim();
  if (!query) {
    console.error('heyloey: context requires a query, e.g. `context "kanban sync"`');
    return 2;
  }
  const rawTokens = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
  if (rawTokens.length === 0) {
    console.log("No usable query tokens (each must be at least two characters).");
    return 0;
  }
  const tokenMap = /* @__PURE__ */ new Map();
  for (const token of rawTokens) {
    const s = stemRouteToken(token);
    tokenMap.set(token, { weight: 1, isSynonym: false });
    if (s !== token) {
      tokenMap.set(s, { weight: 1, isSynonym: false });
    }
    const syns = ROUTE_DEV_SYNONYMS[token] || ROUTE_DEV_SYNONYMS[s];
    if (syns) {
      for (const syn of syns) {
        if (!tokenMap.has(syn))
          tokenMap.set(syn, { weight: 0.7, isSynonym: true });
        const sSyn = stemRouteToken(syn);
        if (!tokenMap.has(sSyn))
          tokenMap.set(sSyn, { weight: 0.7, isSynonym: true });
      }
    }
  }
  const scored = [];
  for (const candidate of indexRouteCandidates(root)) {
    const base = path.basename(candidate.rel, ".md").toLowerCase();
    const baseStem = stemRouteToken(base);
    let score = 0;
    const because = [];
    for (const [token, meta] of tokenMap.entries()) {
      const w = meta.weight;
      if (base === token || baseStem === token) {
        score += 8 * w;
        if (!because.includes("name"))
          because.push("name");
      } else if (base.includes(token)) {
        score += 5 * w;
        if (!because.includes("name"))
          because.push("name");
      }
      if ([...candidate.aliases].some((alias) => alias.includes(token))) {
        score += 6 * w;
        if (!because.includes("alias"))
          because.push("alias");
      }
      if ([...candidate.headings].some((heading) => heading.includes(token))) {
        score += 3 * w;
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
  const personal = options.personal;
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
  const handoff = personal ? "" : readText(root, HANDOFF_RECORD);
  const problems = [];
  if (!daily)
    problems.push(`today's daily note is absent (${dailyRel})`);
  if (!handoff && !personal)
    problems.push(`${HANDOFF_RECORD} is absent`);
  if (problems.length > 0) {
    console.error(`heyloey: ${problems.join("; ")}.`);
    console.error(
      `   Create the missing record with \`npm run init:vault\` (for ${HANDOFF_RECORD}) and open today's daily note from 99-Templates/Daily.md. Nothing was written.`
    );
    receipt(
      "refused",
      daily ? "present" : "missing",
      personal ? "not-applicable" : handoff ? "present" : "missing",
      ""
    );
    return DONE_EXIT.refused;
  }
  const stamp = timeStr();
  const area = personal ? "personal" : "agent";
  const dailyLine = personal ? `- **${displayLogTime(stamp)}**: ${summary}` : `| ${displayLogTime(stamp, "&nbsp;")} |  | ${escapeCell(summary)} |`;
  const handoffLine = `- [x] **[${todayStr()} ${stamp}]** ${summary}`;
  const dailyResult = personal ? insertDailyLogLine(daily, dailyLine, "personal") : insertAgentMilestone(daily, { stamp, scope: "", summary });
  if (!dailyResult.ok) {
    console.error(
      `heyloey: ${dailyRel} has no \`${DAILY_LOG_HEADING}\` section, so there is nowhere established to write. Nothing was written.`
    );
    receipt("refused", "section-missing", "not-attempted", "");
    return DONE_EXIT.refused;
  }
  const handoffResult = personal ? null : insertLatestUpdate(handoff, handoffLine);
  if (handoffResult && !handoffResult.ok) {
    console.error(
      `heyloey: ${HANDOFF_RECORD} has no \`${HANDOFF_HEADING}\` section, so there is nowhere established to write. Nothing was written.`
    );
    receipt("refused", "not-attempted", "section-missing", "");
    return DONE_EXIT.refused;
  }
  const dailyRecorded = logAreaHasSummary(daily, area, summary);
  const handoffRecorded = personal ? true : hasSummaryInSection(handoff, HANDOFF_HEADING, summary);
  if (options.dryRun) {
    console.log(`\u{1F50E} Dry run \u2014 nothing was written. Vault: ${describeTarget(root, options.showPaths)}`);
    const area2 = personal ? LOG_AREA_HEADINGS.personal : LOG_AREA_HEADINGS.agent;
    console.log(`   ${dailyRel} [${area2}]${dailyRecorded ? " (already recorded)" : ""}`);
    if (!dailyRecorded)
      console.log(`     + ${dailyLine}`);
    if (!personal) {
      console.log(`   ${HANDOFF_RECORD}${handoffRecorded ? " (already recorded)" : ""}`);
      if (!handoffRecorded)
        console.log(`     + ${handoffLine}`);
    }
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
      const written = readText(root, dailyRel);
      dailyStatus = written && logAreaHasSummary(written, area, summary) ? "written" : "failed";
      if (dailyStatus === "failed") {
        console.error(`heyloey: post-write verification failed for ${dailyRel}; the entry is not there.`);
      }
    } catch (error) {
      console.error(`heyloey: could not write ${dailyRel}: ${error.message}`);
    }
  }
  let handoffStatus = personal ? "not-applicable" : handoffRecorded ? "already-recorded" : "failed";
  if (!personal && !handoffRecorded) {
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
    personal ? "" : handoffStatus !== "failed" ? "handoff" : ""
  ].filter(Boolean).join("+");
  const okCount = [dailyStatus, handoffStatus].filter((status) => status !== "failed").length;
  const writtenCount = [dailyStatus, handoffStatus].filter((status) => status === "written").length;
  if (okCount === 2) {
    const outcome2 = writtenCount === 0 ? "already-recorded" : "logged";
    if (writtenCount === 0) {
      console.log(
        personal ? `\u21A9\uFE0E  Personal entry already recorded in ${dailyRel}; nothing changed.` : `\u21A9\uFE0E  Milestone already recorded in ${dailyRel} and ${HANDOFF_RECORD}; nothing changed.`
      );
    } else if (personal) {
      console.log(`\u270D\uFE0F  Logged personal entry to ${dailyRel} (${LOG_AREA_HEADINGS.personal}).`);
      console.log(`   ${dailyLine}`);
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
function runMigrateLog(root, args, options) {
  const source = getVaultSource(root, options);
  const receipt = (outcome, moved, kept, adopted, daily2, verified) => {
    console.log(
      `RESULT migrate-log ${outcome} migrated=${moved} kept=${kept} adopted=${adopted} daily=${daily2} lock=flock target=${root} source=${source} verified=${verified || "none"}`
    );
  };
  if (args.length > 0) {
    console.error(`heyloey: migrate-log does not take the argument "${args[0]}"; use --date <YYYY-MM-DD>.`);
    return 2;
  }
  const synthetic = detectSynthetic(root);
  if (synthetic.synthetic) {
    console.log(
      `[heyloey] SKIPPED migrate-log - explicit synthetic opt-out (${synthetic.reason}); nothing written.`
    );
    console.log(
      `RESULT migrate-log skipped migrated=0 kept=0 adopted=0 lock=flock target=${root} source=${source} reason=synthetic`
    );
    return DONE_EXIT.skipped;
  }
  const config = loadDailyNotesConfig(root);
  const dailyRel = resolveDailyNoteFile(options.date ?? todayStr(), config);
  const dailyTarget = resolveInsideVault(root, dailyRel);
  if (!dailyTarget) {
    console.error(`heyloey: refusing to write outside the vault: ${dailyRel}`);
    console.error("   Nothing was written.");
    receipt("refused", 0, 0, 0, "not-attempted", "");
    return DONE_EXIT.refused;
  }
  const daily = readText(root, dailyRel);
  if (!daily) {
    console.error(`heyloey: the daily note is absent (${dailyRel}). Nothing was written.`);
    receipt("refused", 0, 0, 0, "missing", "");
    return DONE_EXIT.refused;
  }
  const migrated = migrateAgentMilestones(daily, {
    selectStamps: options.select,
    selectSummaries: options.selectSummaries
  });
  if (!migrated.ok) {
    console.error(
      `heyloey: ${dailyRel} has no \`${DAILY_LOG_HEADING}\` section, so there is nothing to separate. Nothing was written.`
    );
    receipt("refused", 0, 0, 0, "section-missing", "");
    return DONE_EXIT.refused;
  }
  if (migrated.selectionErrors.length > 0) {
    for (const message of migrated.selectionErrors)
      console.error(`heyloey: ${message}`);
    console.error(
      "   Nothing was written. Name exactly one personal entry per --select/--select-summary; an ambiguous or unmatched selection is refused rather than guessed."
    );
    receipt("refused", 0, migrated.kept.length, 0, "selection-invalid", "");
    return DONE_EXIT.refused;
  }
  if (options.dryRun) {
    console.log(`\u{1F50E} Dry run \u2014 nothing was written. Vault: ${describeTarget(root, options.showPaths)}`);
    console.log(`   ${dailyRel} [${LOG_AREA_HEADINGS.personal} \u2192 ${LOG_AREA_HEADINGS.agent}]`);
    for (const summary of migrated.moved)
      console.log(`     \u2192 ${summary}`);
    if (migrated.adopted > 0) {
      console.log(`     \u21D2 ${migrated.adopted} existing callout(s) already present are adopted by their area`);
    }
    for (const summary of migrated.kept)
      console.log(`     \xB7 left in place: ${summary}`);
    return 0;
  }
  if (migrated.content === daily) {
    console.log(
      `\u21A9\uFE0E  ${dailyRel} is already separated: ${migrated.moved.length} moved, ${migrated.kept.length} left in place; nothing changed.`
    );
    receipt("already-recorded", migrated.moved.length, migrated.kept.length, migrated.adopted, dailyRel, "daily");
    return 0;
  }
  try {
    atomicWriteFileSync(dailyTarget, migrated.content);
  } catch (error) {
    console.error(`heyloey: could not write ${dailyRel}: ${error.message}`);
    receipt("failed", migrated.moved.length, migrated.kept.length, migrated.adopted, dailyRel, "");
    return DONE_EXIT.failed;
  }
  if (readText(root, dailyRel) !== migrated.content) {
    console.error(`heyloey: post-write verification failed for ${dailyRel}; the note is not as written.`);
    receipt("failed", migrated.moved.length, migrated.kept.length, migrated.adopted, dailyRel, "");
    return DONE_EXIT.failed;
  }
  console.log(
    `\u{1F9F9} Separated ${dailyRel}: ${migrated.moved.length} agent milestone(s) moved to ${LOG_AREA_HEADINGS.agent}, ${migrated.adopted} callout(s) adopted, ${migrated.kept.length} entry(ies) left in place.`
  );
  receipt("logged", migrated.moved.length, migrated.kept.length, migrated.adopted, dailyRel, "daily");
  return 0;
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
    case "personal":
      code = runDone(options.root, args, { ...options, personal: true });
      break;
    case "migrate-log":
      code = runMigrateLog(options.root, args, options);
      break;
    case "learn":
      code = runLearn(options.root, args, options);
      break;
  }
  process.exitCode = code;
}
if (typeof require !== "undefined" && require.main === module) {
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
