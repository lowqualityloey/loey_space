/**
 * The daily log's structure, and the one clock every logging tool obeys.
 *
 * `## 📝 Daily Log` is the PARENT section. It owns three labelled areas, and each area heading is
 * an `###` so it stays *inside* the parent: any reader must treat the parent as ending at the next
 * `##` heading or horizontal rule, never at an area heading. A reader that stops at the first
 * heading silently loses everything the areas hold, which is exactly the defect this module exists
 * to make impossible.
 *
 *   - `### 🧍 Personal Log`     — anything the owner writes or dictates. Directly editable in
 *                                 Obsidian, and never copied into `handoff.md`.
 *   - `### 🤖 Agent Milestones` — automated outcomes: `heyloey done`, the MCP logger, the
 *                                 post-commit hook and the milestone reconciler.
 *   - `### 🐙 GitHub Activity`  — the synced GitHub callout table.
 *
 * Ordering is per area, oldest first, so one area's clock never reorders another's.
 */

export const DAILY_LOG_HEADING = '## 📝 Daily Log';
export const DAILY_LOG_INTRO = '> _A running timestamp of what happened today._';

export const LOG_AREA_HEADINGS = {
  personal: '### 🧍 Personal Log',
  agent: '### 🤖 Agent Milestones',
  github: '### 🐙 GitHub Activity',
} as const;

export type LogArea = keyof typeof LOG_AREA_HEADINGS;

/** The canonical order the areas are created in, independent of when each was first used. */
export const LOG_AREA_ORDER: readonly LogArea[] = ['personal', 'agent', 'github'];

const LOG_AREA_BY_HEADING = new Map<string, LogArea>(
  LOG_AREA_ORDER.map(area => [LOG_AREA_HEADINGS[area], area]),
);

/** The area a line opens, or null when the line is not an area heading. */
export function logAreaOf(line: string): LogArea | null {
  return LOG_AREA_BY_HEADING.get(line.trim()) ?? null;
}

/**
 * The callout a logging tool already writes for an area. A note written before the areas existed
 * can therefore already hold agent content, and the heading is created *above* that content
 * instead of below it, which is what keeps the personal area free of automated entries.
 */
const AREA_CALLOUT: Record<LogArea, RegExp> = {
  personal: /^> \[!NOTE\]-\s*🧍/,
  agent: /^> \[!NOTE\]-\s*🤖(?:\s+Show entries|\s+Agent Milestone Log)/,
  github: /^> \[!NOTE\]-\s*🐙 GitHub Activity Log/,
};

/**
 * The retired agent label. It stays recognised so an older note can be folded into the current
 * callout, but nothing writes it again — the current container is `🤖 Show entries (N)`.
 */
const LEGACY_AGENT_CALLOUT = /^> \[!NOTE\]-\s*🤖 Agent Milestone Log/;

/** The first index of an area's own callout inside `[from, to)`, or -1. */
function findAreaCallout(lines: string[], area: LogArea, from: number, to: number): number {
  for (let i = from; i < to; i += 1) if (AREA_CALLOUT[area].test(lines[i].trim())) return i;
  return -1;
}

/** A callout block: its header line, every quoted line under it, and one trailing blank line. */
function calloutBlockEnd(lines: string[], start: number, limit: number): number {
  let end = start + 1;
  while (end < limit && /^\s*>/.test(lines[end])) end += 1;
  if (end < limit && lines[end].trim() === '') end += 1;
  return end;
}

export interface LogBounds {
  start: number;
  end: number;
}

export function aucklandStamp(date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (name: string): string => parts.find(value => value.type === name)!.value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

function minuteOfDay(value: string): number | null {
  const match = value.replace(/&nbsp;|\u00a0/g, ' ').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + minute;
}

export function displayLogTime(value: string, separator = ' '): string {
  const minutes = minuteOfDay(value);
  if (minutes === null) return value;
  const hour = Math.floor(minutes / 60);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${separator}${hour >= 12 ? 'PM' : 'AM'}`;
}

/** The parent section: its heading, up to the next `##`/`#` heading or horizontal rule. */
export function dailyLogBounds(lines: string[]): LogBounds | null {
  const start = lines.findIndex(line => line.trim() === DAILY_LOG_HEADING);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length) {
    const trimmed = lines[end].trim();
    if (/^#{1,2}\s/.test(trimmed) || /^---\s*$/.test(trimmed)) break;
    end++;
  }
  return { start, end };
}

/**
 * Where the parent's preamble ends: the intro quote and blank lines directly under the heading
 * belong to the section, not to the first area, so a new `### 🧍 Personal Log` belongs here — above
 * any bullet already written, which therefore stays exactly where it is.
 */
export function dailyLogPreambleEnd(lines: string[], parent: LogBounds): number {
  let index = parent.start + 1;
  while (index < parent.end && (lines[index].trim() === '' || lines[index].trim().startsWith('>'))) index++;
  return index;
}

/** One labelled area inside the parent: its heading and the body up to the next `###` heading. */
export function logAreaBounds(lines: string[], area: LogArea): LogBounds | null {
  const parent = dailyLogBounds(lines);
  if (!parent) return null;
  const heading = LOG_AREA_HEADINGS[area];
  let start = -1;
  for (let i = parent.start + 1; i < parent.end; i++) {
    if (lines[i].trim() === heading) { start = i; break; }
  }
  if (start < 0) return null;
  let end = start + 1;
  while (end < parent.end && !/^#{3,}\s/.test(lines[end].trim())) end++;
  return { start, end };
}

/** True once the note has been structured into areas (new template, or after `migrate-log`). */
export function hasLogAreas(lines: string[]): boolean {
  const parent = dailyLogBounds(lines);
  if (!parent) return false;
  for (let i = parent.start + 1; i < parent.end; i++) if (logAreaOf(lines[i])) return true;
  return false;
}

/** Insert a heading block, keeping exactly one blank line between it and its neighbours. */
function insertHeading(lines: string[], at: number, heading: string): number {
  const block: string[] = [];
  if (at > 0 && lines[at - 1].trim() !== '') block.push('');
  block.push(heading);
  lines.splice(at, 0, ...block);
  const after = at + block.length;
  if (lines[after] !== undefined && lines[after].trim() !== '') lines.splice(after, 0, '');
  return at + block.length - 1;
}

/**
 * Move an area's own callout under its heading when an earlier write left it in another area.
 *
 * The milestone reconciler and the GitHub sync write their tables as callouts, so a note that
 * predates the headings can hold agent content inside the personal area. Adopting the block is a
 * positional move only: not one of its lines is rewritten.
 */
function adoptAreaCallout(lines: string[], area: LogArea): boolean {
  const parent = dailyLogBounds(lines);
  const heading = logAreaBounds(lines, area);
  if (!parent || !heading) return false;
  const start = findAreaCallout(lines, area, parent.start + 1, parent.end);
  if (start === -1) return false;
  if (start > heading.start && start < heading.end) return false;
  const block = lines.splice(start, calloutBlockEnd(lines, start, parent.end) - start);
  while (block.length > 1 && block[block.length - 1].trim() === '') block.pop();
  const target = logAreaBounds(lines, area);
  if (!target) return false;
  let at = target.end;
  while (at > target.start + 1 && lines[at - 1].trim() === '') at -= 1;
  const insert = [...block];
  if (at > 0 && lines[at - 1].trim() !== '') insert.unshift('');
  if (lines[at] !== undefined && lines[at].trim() !== '') insert.push('');
  lines.splice(at, 0, ...insert);
  return true;
}

/** Give every callout already present the area heading it belongs under; returns how many moved. */
function adoptCalloutAreas(lines: string[]): number {
  let adopted = 0;
  for (const area of LOG_AREA_ORDER) {
    const parent = dailyLogBounds(lines);
    if (!parent) break;
    if (findAreaCallout(lines, area, parent.start + 1, parent.end) === -1) continue;
    if (!logAreaBounds(lines, area)) ensureLogArea(lines, area);
    if (adoptAreaCallout(lines, area)) adopted += 1;
  }
  return adopted;
}

/**
 * Create an area heading when it is absent, in canonical order, and return its heading index.
 * Existing entries are never moved: an unlabelled bullet already under the parent ends up inside
 * the area created above it.
 */
export function ensureLogArea(lines: string[], area: LogArea): number | null {
  const existing = logAreaBounds(lines, area);
  if (existing) return existing.start;
  const parent = dailyLogBounds(lines);
  if (!parent) return null;
  const heading = LOG_AREA_HEADINGS[area];
  const callout = findAreaCallout(lines, area, parent.start + 1, parent.end);
  if (callout !== -1) return insertHeading(lines, callout, heading);
  if (area === 'personal') return insertHeading(lines, dailyLogPreambleEnd(lines, parent), heading);
  // A later area already present is the earliest position that keeps the canonical order.
  for (let index = LOG_AREA_ORDER.indexOf(area) + 1; index < LOG_AREA_ORDER.length; index++) {
    const later = logAreaBounds(lines, LOG_AREA_ORDER[index]);
    if (later) return insertHeading(lines, later.start, heading);
  }
  return insertHeading(lines, parent.end, heading);
}

export interface InsertLogResult {
  content: string;
  ok: boolean;
  /** True when the exact line was already present in the target area, so the write is a no-op. */
  duplicate?: boolean;
}

/**
 * Append one bullet to one area.
 *
 * The area is created when it is absent, so every writer routes to its own labelled area without
 * asking the caller to prepare the note. An untouched template leaves an empty `- ` placeholder in
 * the personal area; that placeholder is reused rather than preceded, so the first real entry does
 * not sit above a stray bullet.
 */
export function insertDailyLogEntry(content: string, line: string, area: LogArea): InsertLogResult {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(newline);
  if (!dailyLogBounds(lines)) return { content, ok: false };

  if (ensureLogArea(lines, area) === null) return { content, ok: false };
  adoptCalloutAreas(lines);
  const bounds = logAreaBounds(lines, area)!;
  const bodyStart = bounds.start + 1;

  if (lines.slice(bodyStart, bounds.end).some(entry => entry.trim() === line.trim())) {
    return { content, ok: true, duplicate: true };
  }

  let lastBullet = -1;
  let emptyBullet = -1;
  for (let i = bodyStart; i < bounds.end; i += 1) {
    if (/^\s*-\s+\S/.test(lines[i])) lastBullet = i;
    else if (/^\s*-\s*$/.test(lines[i])) emptyBullet = i;
  }

  if (emptyBullet !== -1) {
    lines[emptyBullet] = line;
  } else if (lastBullet === -1 && bodyStart < bounds.end && lines[bodyStart].trim() === '') {
    // A freshly created area leaves one blank line under its heading; the first real entry takes
    // that line, so it sits directly beneath the heading that labels it.
    lines[bodyStart] = line;
  } else {
    const insertAt = lastBullet !== -1 ? lastBullet + 1 : bodyStart;
    lines.splice(insertAt, 0, line);
  }
  // Keep one blank line between the area's last entry and whatever follows it — the next area
  // heading or the divider — the way the template spaces them.
  const lastBody = logAreaBounds(lines, area)!.end - 1;
  if (lastBody >= 0 && lines[lastBody].trim() !== '' && lines[lastBody + 1] !== undefined) {
    lines.splice(lastBody + 1, 0, '');
  }
  // An area that gained a heading above an existing bullet can carry a spacer directly under that
  // heading; once it holds a real entry the spacer is only a gap.
  tidyAreaSpacer(lines, area);
  return { content: normalizeDailyLog(lines.join(newline)), ok: true };
}

/**
 * Drop the spacer that can sit directly under an area heading once the area holds an entry.
 *
 * Every blank line there goes, not just the first: when a migration moves one block out of an
 * area it can leave a doubled spacer, and removing a single blank would make a second pass produce
 * yet another layout — a rewrite on every read instead of one on first migration.
 */
function tidyAreaSpacer(lines: string[], area: LogArea): void {
  const body = logAreaBounds(lines, area);
  if (!body) return;
  let spacer = body.start + 1;
  while (spacer < body.end && lines[spacer].trim() === '') spacer += 1;
  if (spacer === body.start + 1) return;
  if (!lines.slice(spacer, body.end).some(entry => /^\s*-\s+\S/.test(entry))) return;
  lines.splice(body.start + 1, spacer - body.start - 1);
}

/* ------------------------------------------------------------------------------------------------
 * The agent table
 *
 * `### 🤖 Agent Milestones` holds exactly one chronological table:
 *
 *   | Time | Scope | Milestone |
 *   | :--- | :--- | :--- |
 *   | 09:21&nbsp;AM | `loey_space` (`main`) | ... |
 *
 * The table replaces the old labelled callout and the parallel bullet list, so every agent writer
 * — `heyloey done`, the MCP logger, the post-commit hook and the milestone reconciler — has one
 * destination and one representation. Scope is a cell, not part of the summary: it may be left
 * blank when nobody established one, and it is never guessed.
 * ---------------------------------------------------------------------------------------------- */

export const AGENT_TABLE_HEADER = ['| Time | Scope | Milestone |', '| :--- | :--- | :--- |'] as const;

/**
 * The single collapsible container the agent table lives in.
 *
 * The area holds one `> [!NOTE]-` callout whose toggle reads `🤖 Show entries (N)`, so the table is
 * hidden until the reader asks for it and the row count is always visible. There is deliberately no
 * second title such as "Agent Milestone Log": one area, one container, one label.
 */
export function agentCalloutLabel(count: number): string {
  return `> [!NOTE]- 🤖 Show entries (${count})`;
}

const AGENT_CALLOUT = /^> \[!NOTE\]-\s*🤖\s*Show entries/;

/** Quote a plain table line so it belongs to the callout instead of the surrounding note. */
function quoted(line: string): string {
  return `> ${line}`;
}

/** Split one Markdown table row (plain or inside a callout), honouring `\|` escapes. */
function tableCellsOf(line: string): string[] | null {
  const match = line.trim().match(/^(?:>\s*)?\|(.*)\|\s*$/);
  if (!match) return null;
  const body = match[1];
  const cells: string[] = [];
  let cell = '';
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === '\\' && body[index + 1] === '|') {
      cell += '\\|';
      index += 1;
      continue;
    }
    if (character === '|') {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

function unescapeCell(cell: string): string {
  return cell.replace(/\\\|/g, '|');
}

export function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function isAgentHeader(cells: string[]): boolean {
  return cells.length >= 3 && cells[0].toLowerCase() === 'time' && cells[1].toLowerCase() === 'scope';
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

export interface AgentTableRow {
  stamp: string;
  scope: string;
  summary: string;
}

/** Read one table row; null for a header, a separator or a line that is not a row. */
export function readAgentTableRow(line: string): AgentTableRow | null {
  const cells = tableCellsOf(line);
  if (!cells || cells.length < 3 || isAgentHeader(cells) || isSeparatorRow(cells)) return null;
  if (minuteOfDay(cells[0]) === null) return null;
  return {
    stamp: cells[0],
    scope: cells[1],
    summary: cells.slice(2).map(unescapeCell).join(' | '),
  };
}

/** Every timestamped entry in one area, in file order, whatever representation holds it. */
export function logAreaEntries(content: string, area: LogArea): AgentTableRow[] {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(newline);
  const bounds = logAreaBounds(lines, area);
  if (!bounds) return [];
  const entries: AgentTableRow[] = [];
  for (let index = bounds.start + 1; index < bounds.end; index += 1) {
    const bullet = readLogEntry(lines[index]);
    if (bullet) {
      entries.push({ stamp: bullet.stamp, scope: '', summary: bullet.summary });
      continue;
    }
    const row = readAgentTableRow(lines[index]);
    if (row) entries.push(row);
  }
  return entries;
}

/** True when `summary` is already recorded in that area — the only duplicate rule a writer needs. */
export function logAreaHasSummary(content: string, area: LogArea, summary: string): boolean {
  const needle = unescapeCell(summary.trim());
  return logAreaEntries(content, area).some(entry => entry.summary.includes(needle));
}

/** Stable chronological sort of one agent table, leaving header and non-rows in place. */
function sortAgentTable(lines: string[], header: number, limit: number): void {
  let first = header + 1;
  const separator = tableCellsOf(lines[first] ?? '');
  if (separator && isSeparatorRow(separator)) first += 1;

  let end = first;
  while (end < limit) {
    const cells = tableCellsOf(lines[end]);
    if (!cells || isSeparatorRow(cells) || minuteOfDay(cells[0]) === null) break;
    end += 1;
  }
  if (end - first < 2) return;

  const rows = lines.slice(first, end);
  rows.sort((left, right) => {
    const leftMinutes = minuteOfDay(tableCellsOf(left)![0])!;
    const rightMinutes = minuteOfDay(tableCellsOf(right)![0])!;
    return leftMinutes - rightMinutes;
  });
  lines.splice(first, end - first, ...rows);
}

/**
 * The one collapsible container for the agent area.
 *
 * The agent area holds exactly one callout: a `> [!NOTE]- 🤖 Show entries (N)` toggle with the whole
 * `| Time | Scope | Milestone |` table quoted inside it. The area heading plus that single toggle is
 * the entire presentation — there is no second table, no parallel bullet list and no competing
 * "Agent Milestone Log" title. Every writer updates this container, so a second write extends the
 * existing one instead of creating another.
 */
interface AgentContainer {
  /** Index of the callout's toggle line, or -1 when the area has no container yet. */
  start: number;
  /** Index one past the last quoted line of the callout block. */
  end: number;
  /** Index of the header row inside the callout, or -1. */
  header: number;
}

function findAgentContainer(lines: string[], area: LogBounds): AgentContainer {
  const container: AgentContainer = { start: -1, end: -1, header: -1 };
  for (let index = area.start + 1; index < area.end; index += 1) {
    if (!AGENT_CALLOUT.test(lines[index].trim())) continue;
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

/** Stable chronological sort of the area's single agent table, wherever it is currently kept. */
function sortAgentAreaTable(lines: string[]): void {
  const bounds = logAreaBounds(lines, 'agent');
  if (!bounds) return;
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
  if (header === -1) return;
  if (container.start !== -1) {
    // Older writers could strand data before the header or between it and the separator.
    let separator = -1;
    for (let index = container.start + 1; index < container.end; index += 1) {
      const cells = tableCellsOf(lines[index]);
      if (cells && isSeparatorRow(cells)) { separator = index; break; }
    }
    if (separator !== -1 && (header !== container.start + 1 || separator !== header + 1)) {
      const structure = [lines[header], lines[separator]];
      for (const index of [header, separator].sort((left, right) => right - left)) lines.splice(index, 1);
      lines.splice(container.start + 1, 0, ...structure);
      header = container.start + 1;
    }
    lines[container.start] = agentCalloutLabel(countAgentRows(lines, { ...container, header }));
  }
  sortAgentTable(lines, header, limit);
}

/**
 * Append rows to the area's single table, creating the collapsible container when absent.
 *
 * `preferredAt` is used by the migration: the container takes the place of the first construct it
 * replaced, so unrelated prose above and below it keeps its position.
 */
function appendAgentRows(lines: string[], rows: string[], preferredAt = -1): void {
  ensureLogArea(lines, 'agent');
  let area = logAreaBounds(lines, 'agent')!;
  let container = findAgentContainer(lines, area);

  if (container.start === -1) {
    const anchor = preferredAt > area.start && preferredAt < area.end ? preferredAt : area.start + 1;
    const block = [agentCalloutLabel(rows.length), ...AGENT_TABLE_HEADER.map(quoted), ...rows.map(quoted)];
    if (anchor > 0 && lines[anchor - 1].trim() !== '') block.unshift('');
    lines.splice(anchor, 0, ...block);
    // Exactly one blank line after the container, whatever spacing the line it displaced left.
    let after = anchor + block.length;
    while (after < lines.length && lines[after].trim() === '') after += 1;
    const blanks = after - (anchor + block.length);
    if (blanks === 0) lines.splice(after, 0, '');
    else if (blanks > 1) lines.splice(anchor + block.length, blanks - 1);
  } else if (container.header === -1) {
    lines.splice(container.start + 1, 0, ...AGENT_TABLE_HEADER.map(quoted), ...rows.map(quoted));
  } else {
    let end = container.end;
    while (end > container.header + 1 && !readAgentTableRow(lines[end - 1])) end -= 1;
    const separator = tableCellsOf(lines[container.header + 1] ?? '');
    const firstData = container.header + (separator && isSeparatorRow(separator) ? 2 : 1);
    lines.splice(Math.max(end, firstData), 0, ...rows.map(quoted));
  }

  area = logAreaBounds(lines, 'agent')!;
  container = findAgentContainer(lines, area);
  if (container.start !== -1) {
    const count = countAgentRows(lines, container);
    lines[container.start] = agentCalloutLabel(count);
    // One blank line between the callout and whatever follows it.
    if (container.end < area.end && lines[container.end]?.trim() !== '') {
      lines.splice(container.end, 0, '');
    }
  }
  sortAgentAreaTable(lines);
}

/** How many data rows the container holds — the number in its `Show entries (N)` label. */
function countAgentRows(lines: string[], container: AgentContainer): number {
  if (container.header === -1) return 0;
  let count = 0;
  for (let index = container.header + 1; index < container.end; index += 1) {
    if (readAgentTableRow(lines[index])) count += 1;
  }
  return count;
}

/**
 * Convert one agent area's legacy representations into its single collapsible table: timestamped
 * bullets and the retired `🤖 Agent Milestone Log` callout become rows. Existing rows stay as they
 * are, and text that is not a timestamped entry is left untouched.
 *
 * This is representation migration only. It never decides authorship: everything here is already
 * inside `### 🤖 Agent Milestones`, which is the provenance signal.
 */
function convertAgentArea(lines: string[]): number {
  const bounds = logAreaBounds(lines, 'agent');
  if (!bounds) return 0;

  const removals: Array<{ start: number; end: number }> = [];
  const added: string[] = [];
  let anchor = -1;

  // Whatever the one container already holds is current format. Skipping it is what keeps a second
  // write from re-reading the container as a previous plain table, which would duplicate its rows.
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
        if (parsed) added.push(`| ${parsed.stamp} | ${parsed.scope} | ${escapeCell(parsed.summary)} |`);
      }
      if (anchor === -1) anchor = index;
      removals.push({ start: index, end });
      index = end;
      continue;
    }

    const entry = readLogEntry(lines[index]);
    if (entry) {
      let cursor = index + 1;
      while (cursor < bounds.end && /^(?: {2,}|\t)\S/.test(lines[cursor])) cursor += 1;
      const continuation = lines.slice(index + 1, cursor).map(line => line.trim()).filter(Boolean).join('<br>');
      const summary = escapeCell(entry.summary + (continuation ? `<br>${continuation}` : ''));
      added.push(`| ${displayLogTime(entry.stamp, '&nbsp;')} |  | ${summary} |`);
      if (anchor === -1) anchor = index;
      removals.push({ start: index, end: cursor });
      index = cursor;
      continue;
    }

    // A plain (unquoted) table from the previous layout: its rows join the one container.
    const cells = tableCellsOf(lines[index]);
    if (cells && isAgentHeader(cells)) {
      let cursor = index + 2;
      const rowStart = cursor;
      while (cursor < bounds.end && readAgentTableRow(lines[cursor])) cursor += 1;
      for (let row = rowStart; row < cursor; row += 1) {
        const parsed = readAgentTableRow(lines[row])!;
        added.push(`| ${parsed.stamp} | ${parsed.scope} | ${escapeCell(parsed.summary)} |`);
      }
      if (anchor === -1) anchor = index;
      removals.push({ start: index, end: cursor });
      index = cursor;
      continue;
    }

    index += 1;
  }

  if (added.length === 0) return 0;
  for (let index = removals.length - 1; index >= 0; index -= 1) {
    const removal = removals[index];
    lines.splice(removal.start, removal.end - removal.start);
  }
  appendAgentRows(lines, added, anchor === -1 ? -1 : anchor);
  return added.length;
}

/**
 * Append one agent milestone to the table, creating it when the note predates the table.
 *
 * The duplicate check is scoped to the agent area: an identical sentence the owner wrote under
 * `### 🧍 Personal Log` must not suppress the agent entry, and vice versa.
 */
export interface AgentMilestoneInput {
  stamp: string;
  scope?: string;
  summary: string;
}

export interface InsertAgentMilestoneResult {
  content: string;
  ok: boolean;
  duplicate?: boolean;
  row?: string;
}

export function insertAgentMilestone(
  content: string,
  entry: AgentMilestoneInput,
): InsertAgentMilestoneResult {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(newline);
  if (!dailyLogBounds(lines)) return { content, ok: false };

  ensureLogArea(lines, 'agent');
  adoptCalloutAreas(lines);
  convertAgentArea(lines);

  if (logAreaHasSummary(lines.join(newline), 'agent', entry.summary)) {
    return { content, ok: true, duplicate: true };
  }

  const row = `| ${displayLogTime(entry.stamp, '&nbsp;')} | ${entry.scope?.trim() ?? ''} | ${escapeCell(entry.summary)} |`;
  appendAgentRows(lines, [row]);
  return { content: normalizeDailyLog(lines.join(newline)), ok: true, row };
}

interface TimedEntry {
  minutes: number;
  lines: string[];
}

/** Sort timestamped bullets and callout rows inside one slice, oldest first, stably. */
function sortTimedEntries(lines: string[], start: number, end: number): void {
  let fenced = false;
  for (let i = start; i < end;) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; i++; continue; }
    if (fenced) { i++; continue; }
    const bullet = (line: string): RegExpMatchArray | null => line.match(/^(- \*\*\[?)([^\]*]+)(\]?\*\*(?::|\s).*)$/);
    const table = (line: string): RegExpMatchArray | null => line.match(/^(> \|\s*)([^|]+?)(\s*\|.*)$/);
    const kind = bullet(lines[i]) ? bullet : table;
    const first = kind(lines[i]);
    if (!first || minuteOfDay(first[2]) === null) { i++; continue; }
    const entries: TimedEntry[] = [];
    let cursor = i;
    while (cursor < end) {
      const match = kind(lines[cursor]);
      const minutes = match ? minuteOfDay(match[2]) : null;
      if (!match || minutes === null) break;
      const entry = [match[1] + displayLogTime(match[2], kind === table ? '&nbsp;' : ' ') + match[3]];
      cursor++;
      if (kind === bullet) {
        while (cursor < end && /^(?: {2,}|\t)\S/.test(lines[cursor])) entry.push(lines[cursor++]);
      }
      entries.push({ minutes, lines: entry });
    }
    const sorted = entries.sort((a, b) => a.minutes - b.minutes).flatMap(entry => entry.lines);
    lines.splice(i, cursor - i, ...sorted);
    i = cursor;
  }
}

/**
 * Normalise every timestamp in the daily log and order each area independently, oldest first.
 * An unlabelled (legacy) note stays a single slice, so its previous behaviour is unchanged.
 */
export function normalizeDailyLog(content: string): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(newline);
  const parent = dailyLogBounds(lines);
  if (!parent) return content;

  const boundaries: Array<{ index: number; area: LogArea }> = [];
  for (let i = parent.start + 1; i < parent.end; i++) {
    const area = logAreaOf(lines[i]);
    if (area) boundaries.push({ index: i, area });
  }

  const slices: Array<LogBounds & { area: LogArea | null }> = [];
  let cursor = parent.start + 1;
  for (const boundary of boundaries) {
    slices.push({ start: cursor, end: boundary.index, area: null });
    cursor = boundary.index + 1;
  }
  slices.push({ start: cursor, end: parent.end, area: boundaries.at(-1)?.area ?? null });

  // Back to front: sorting splices lines, which would shift every later slice.
  for (let index = slices.length - 1; index >= 0; index -= 1) {
    const slice = slices[index];
    // The agent area is owned by its one container: `sortTimedEntries` reads quoted rows as a loose
    // run and could reorder them in place, so only `sortAgentAreaTable` sorts that area.
    if (slice.area === 'agent') continue;
    sortTimedEntries(lines, slice.start, slice.end);
  }
  // The agent table is sorted separately: `sortTimedEntries` understands bullets and callout
  // rows, while this understands the plain header/separator/row shape.
  sortAgentAreaTable(lines);
  return lines.join(newline);
}

/** One entry's timestamp and summary, read from either bullet form the log uses. */
export function readLogEntry(line: string): { stamp: string; summary: string } | null {
  const match = line.match(/^- \*\*(?:\[)?([^\]*]+?)(?:\])?\*\*(?::\s*|\s+)(.*)$/);
  if (!match) return null;
  const stamp = match[1].trim();
  if (minuteOfDay(stamp) === null) return null;
  return { stamp, summary: match[2].trim() };
}

/** One timestamped bullet and its continuation lines, with the range it occupies. */
interface PersonalBlock {
  start: number;
  end: number;
  stamp: string;
  summary: string;
  continuation: string;
}

/** Read the timestamped bullets inside one area, with their continuation lines. */
function timedBlocks(lines: string[], bounds: LogBounds): PersonalBlock[] {
  const blocks: PersonalBlock[] = [];
  for (let index = bounds.start + 1; index < bounds.end; index += 1) {
    const entry = readLogEntry(lines[index]);
    if (!entry) continue;
    let cursor = index + 1;
    while (cursor < bounds.end && /^(?: {2,}|\t)\S/.test(lines[cursor])) cursor += 1;
    blocks.push({
      start: index,
      end: cursor,
      stamp: entry.stamp,
      summary: entry.summary,
      continuation: lines.slice(index + 1, cursor).map(line => line.trim()).filter(Boolean).join('<br>'),
    });
    index = cursor - 1;
  }
  return blocks;
}

function migrationRow(block: PersonalBlock): string {
  const summary = escapeCell(block.continuation ? `${block.summary}<br>${block.continuation}` : block.summary);
  return `| ${displayLogTime(block.stamp, '&nbsp;')} |  | ${summary} |`;
}

export interface MigrationSelection {
  /** `--select <HH:MM AM>`: explicit owner selection of a personal bullet as an agent outcome. */
  selectStamps?: string[];
  /** `--select-summary <text>`: the same, by a unique substring of the summary. */
  selectSummaries?: string[];
}

export interface MigrationResult {
  content: string;
  /** Summaries moved from the personal area into the agent table. */
  moved: string[];
  /** Timestamped entries left in place; nothing was inferred about their authorship. */
  kept: string[];
  /** Callouts a tool had already written, moved under the area heading that owns them. */
  adopted: number;
  /** Explicit selections that did not identify exactly one personal entry. */
  selectionErrors: string[];
  /** False when the note has no `## 📝 Daily Log` section at all. */
  ok: boolean;
}

/**
 * Put one note into the canonical shape, and never guess who wrote what.
 *
 * Format migration is safe and automatic: every area heading is created, agent bullets and the old
 * agent callout become the one agent table, and an area's callout that a writer stranded elsewhere
 * is moved under its own heading. Entries already in `### 🧍 Personal Log` are moved to the agent
 * table **only when the caller names them explicitly** (`--select`, `--select-summary`). No verb,
 * capitalisation or tone is treated as evidence of authorship, so an ambiguous personal entry stays
 * exactly where it is and is reported in `kept`.
 */
export function migrateAgentMilestones(
  content: string,
  selection: MigrationSelection = {},
): MigrationResult {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(newline);
  if (!dailyLogBounds(lines)) {
    return { content, moved: [], kept: [], adopted: 0, selectionErrors: [], ok: false };
  }

  for (const area of LOG_AREA_ORDER) ensureLogArea(lines, area);
  const adopted = adoptCalloutAreas(lines);

  const personal = logAreaBounds(lines, 'personal')!;
  const blocks = timedBlocks(lines, personal);
  const chosen = new Map<number, PersonalBlock>();
  const selectionErrors: string[] = [];

  const select = (label: string, matches: PersonalBlock[]): void => {
    const chosenMatches = matches.filter(block => chosen.has(block.start));
    if (chosenMatches.length === matches.length && matches.length > 0) return; // already selected
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
    select(`--select "${stamp}"`, blocks.filter(block => minuteOfDay(block.stamp) === minutes));
  }
  for (const text of selection.selectSummaries ?? []) {
    const needle = text.trim();
    if (!needle) {
      selectionErrors.push('--select-summary requires some text');
      continue;
    }
    select(`--select-summary "${needle}"`, blocks.filter(block => block.summary.includes(needle)));
  }

  if (selectionErrors.length > 0) {
    return {
      content,
      moved: [],
      kept: blocks.map(block => block.summary),
      adopted: 0,
      selectionErrors,
      ok: true,
    };
  }

  const ordered = [...chosen.values()].sort((left, right) => left.start - right.start);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const block = ordered[index];
    lines.splice(block.start, block.end - block.start);
  }

  // Existing agent bullets/callout become the table before the selected rows join it, so the
  // result is one table regardless of which representations the note arrived with.
  convertAgentArea(lines);
  if (ordered.length > 0) appendAgentRows(lines, ordered.map(migrationRow));

  for (const area of LOG_AREA_ORDER) tidyAreaSpacer(lines, area);
  const migrated = normalizeDailyLog(lines.join(newline));
  return {
    content: migrated,
    moved: ordered.map(block => block.summary),
    kept: logAreaEntries(migrated, 'personal').map(entry => entry.summary),
    adopted,
    selectionErrors: [],
    ok: true,
  };
}
