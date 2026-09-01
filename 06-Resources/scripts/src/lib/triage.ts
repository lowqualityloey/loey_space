import type { TFile } from 'obsidian';
import type { RouteConfig } from '../types';

export const DUMP_PATH = "00-Inbox/quick-capture-dump.md";
export const ARCHIVE_SWEPT_LINES = true;
export const TRIAGED_HEADING = "## ✅ Triaged";

export const ROUTES: Record<string, RouteConfig> = {
  do: { kind: "task" },
  bin: { kind: "drop" },
  dev: { kind: "note", folder: "03-Dev", type: "snippet", area: "dev", status: "active" },
  concept: { kind: "note", folder: "08-Concepts", type: "concept", area: "general", status: "active", review: "90d" },
  learn: { kind: "note", folder: "04-Learning", type: "learning", area: "learning", status: "in-progress", review: "30d" },
  ref: { kind: "note", folder: "06-Resources", type: "resource", area: "resources", status: "active" },
  personal: { kind: "note", folder: "05-Personal", type: "personal", area: "personal", status: "active" },
  project: { kind: "project", folder: "02-Projects", type: "project", area: "dev", status: "planning", review: "14d" }
};

export const TOKEN_RE = new RegExp("#(" + Object.keys(ROUTES).join("|") + ")\\b", "i");
export const TIME_CODE_RE = /`\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\s*`/gi;

export interface TriageCandidate {
  index: number;
  token: string;
  text: string;
  capturedDate: string;
}

export interface TriageResult {
  item: TriageCandidate;
  destination?: string;
  ok: boolean;
  reason?: string;
  extra?: string;
}

export function isTFile(file: any): file is TFile {
  return Boolean(file && typeof file === 'object' && 'extension' in file && 'path' in file);
}

export function getTodayStr(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Windows and Obsidian both reject these in filenames; # ^ [ ] break wikilinks.
export function sanitizeTitle(text: string): string {
  let clean = String(text)
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:\-–—]+$/, "")
    .trim();
  if (clean.length > 60) clean = clean.slice(0, 60).trim();
  return clean;
}

// A bare link becomes a readable title; anything else keeps its own words.
export function deriveTitle(text: string, todayStr: string = getTodayStr()): string {
  const urlMatch = text.match(/https?:\/\/\S+/);
  const withoutUrl = urlMatch ? text.replace(urlMatch[0], "") : text;
  const hasWords = withoutUrl.replace(/[^\p{L}\p{N}]/gu, "").length >= 4;

  if (urlMatch && !hasWords) {
    try {
      const url = new URL(urlMatch[0]);
      const host = url.hostname.replace(/^www\./, "");
      const segment = url.pathname.split("/").filter(Boolean)[0] || "";
      const readable = segment && segment.length <= 24 ? " " + segment.replace(/[-_]+/g, " ") : "";
      return sanitizeTitle(host + readable);
    } catch (e) {
      // fall through to text handling
    }
  }

  return sanitizeTitle(hasWords ? withoutUrl : text) || "Capture " + todayStr;
}

export function buildNote(route: RouteConfig, title: string, text: string, noteCapturedDate?: string, todayStr: string = getTodayStr()): string {
  const url = (text.match(/https?:\/\/\S+/) || [])[0] || "";
  const tags = [`type/${route.type}`, `area/${route.area}`];
  if (route.status) tags.push(`status/${route.status}`);

  const front = [
    "---",
    `created: ${todayStr}`,
    `updated: ${todayStr}`
  ];
  if (route.review) {
    front.push(`last_reviewed: ${todayStr}`);
    front.push(`review_cycle: ${route.review}`);
  }
  front.push(`type: ${route.type}`);
  front.push(`status: ${route.status}`);
  front.push(`area: ${route.area}`);
  if (route.type === "project") front.push("priority: medium");
  front.push(`source: quick-capture`);
  if (noteCapturedDate) front.push(`captured: ${noteCapturedDate}`);
  front.push("tags:");
  tags.forEach(t => front.push(`  - ${t}`));
  front.push("---");

  const body = [
    "",
    `# ${title}`,
    ""
  ];

  if (route.type === "resource") {
    body.push(`**Resource URL**: ${url}`);
    body.push("");
  }

  body.push("## Capture");
  body.push(`- ${text}`);
  body.push("");
  body.push("## Notes");
  body.push("- ");
  body.push("");
  body.push("## 🔗 Related References");
  body.push("- [[ ]]");
  body.push("");
  body.push(`> [!NOTE] Triaged from quick capture${noteCapturedDate ? " on " + noteCapturedDate : ""}. Expand when you next touch this.`);
  body.push("");

  return front.join("\n") + body.join("\n");
}

// A project needs its board too, or _Projects MOC's progress query has nothing to read.
export function buildKanban(todayStr: string = getTodayStr()): string {
  return [
    "---",
    "",
    "kanban-plugin: board",
    `updated: ${todayStr}`,
    "",
    "---",
    "",
    "## Backlog",
    "",
    "## To Do",
    "",
    "## In Progress",
    "",
    "## Review / Test",
    "",
    "## Done",
    "",
    "## Archive",
    "",
    "%% kanban:settings",
    "```",
    '{"kanban-plugin":"board"}',
    "```",
    "%%",
    ""
  ].join("\n");
}

/* Inserts a task into the daily note's Tasks section only, so the project
   query block and Habits section below it are never disturbed. */
export function insertTask(content: string, text: string): { content: string; ok: boolean } {
  const lines = content.split("\n");

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{2,4}\s+.*\bTasks\b/i.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return { content: content, ok: false };

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,6}\s+/.test(lines[i]) || /^---+\s*$/.test(lines[i])) { end = i; break; }
  }

  // Reuse the empty "- [ ]" placeholder if the template left one behind.
  for (let i = start + 1; i < end; i++) {
    if (/^\s*-\s*\[\s?\]\s*$/.test(lines[i])) {
      lines[i] = `- [ ] ${text}`;
      return { content: lines.join("\n"), ok: true };
    }
  }

  let insertAt = start + 1;
  for (let i = start + 1; i < end; i++) {
    if (/^\s*-\s*\[/.test(lines[i])) insertAt = i + 1;
    else if (/^\s*>/.test(lines[i]) && insertAt === start + 1) insertAt = i + 1;
  }

  lines.splice(insertAt, 0, `- [ ] ${text}`);
  return { content: lines.join("\n"), ok: true };
}

export function parseDumpLines(dumpLines: string[]): TriageCandidate[] {
  const picked: TriageCandidate[] = [];
  let inTriaged = false;
  let capturedDate = "";

  for (let i = 0; i < dumpLines.length; i++) {
    const line = dumpLines[i];

    if (/^##\s+.*Triaged/i.test(line)) { inTriaged = true; continue; }
    else if (/^##\s+/.test(line)) { inTriaged = false; }
    if (inTriaged) continue;

    const heading = line.match(/^###\s+.*?(\d{4}-\d{2}-\d{2})/);
    if (heading) { capturedDate = heading[1]; continue; }

    if (!/^\s*-\s+\S/.test(line)) continue;

    const token = line.match(TOKEN_RE);
    if (!token) continue;

    const text = line
      .replace(/^\s*-\s+/, "")
      .replace(TOKEN_RE, "")
      .replace(TIME_CODE_RE, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) continue;

    picked.push({ index: i, token: token[1].toLowerCase(), text: text, capturedDate: capturedDate });
  }

  return picked;
}

export function updateDumpContent(
  dumpLines: string[],
  results: TriageResult[],
  sweptIndexes: Set<number>,
  todayStr: string = getTodayStr(),
  archiveSwept: boolean = ARCHIVE_SWEPT_LINES
): string {
  const kept: string[] = [];
  const logEntries: string[] = [];

  for (let i = 0; i < dumpLines.length; i++) {
    if (!sweptIndexes.has(i)) { kept.push(dumpLines[i]); continue; }

    const result = results.find(r => r.item.index === i && r.ok);
    if (!result) { kept.push(dumpLines[i]); continue; }

    if (archiveSwept) {
      const target = result.destination === "dropped"
        ? "dropped"
        : `[[${(result.destination || '').replace(/^.*\//, "").replace(/\.md$/, "")}]]`;
      logEntries.push(`- ~~${result.item.text}~~ → ${target} \`#${result.item.token}\``);
    }
  }

  // Drop date headings whose items were all swept.
  const pruned: string[] = [];
  for (let i = 0; i < kept.length; i++) {
    const isDateHeading = /^###\s+.*?\d{4}-\d{2}-\d{2}/.test(kept[i]);
    if (!isDateHeading) { pruned.push(kept[i]); continue; }

    let hasItems = false;
    for (let j = i + 1; j < kept.length; j++) {
      if (/^#{2,3}\s+/.test(kept[j])) break;
      if (/^\s*-\s+\S/.test(kept[j])) { hasItems = true; break; }
    }
    if (hasItems) pruned.push(kept[i]);
  }

  let nextDump = pruned.join("\n").replace(/\n{4,}/g, "\n\n\n");

  if (archiveSwept && logEntries.length > 0) {
    const block = `### 📅 ${todayStr}\n${logEntries.join("\n")}`;

    if (nextDump.includes(TRIAGED_HEADING)) {
      nextDump = nextDump.replace(/\s*$/, "") + "\n\n" + block + "\n";
    } else {
      nextDump = nextDump.replace(/\s*$/, "") +
        `\n\n---\n\n${TRIAGED_HEADING}\n> _Swept out of the inbox. Kept as a record of where things went._\n\n` +
        block + "\n";
    }
  }

  return nextDump;
}
