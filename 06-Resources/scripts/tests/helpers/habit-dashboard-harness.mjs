// Harness for `07-Reviews/Habit Analytics Dashboard.md`, the vault's only calendar-labelled
// view. Its logic lives in DataviewJS blocks, which Obsidian executes and a shell cannot, so
// nothing in the suite could see this class of defect — the same reason `priority-contract`
// (#53) extracts the SHIPPED source text and evaluates it instead of retyping a copy. A copy
// would prove nothing about what ships and would keep passing after the file regressed.
//
// Issue #55: the two calendar-labelled views selected the newest N note FILES —
// `.slice(0, 30)` under a comment reading "from the last 30 days" — so a gap in logging
// silently reached back past the labelled window and old observations were counted as recent.
// The sharpest way to say the root cause: the dashboard performs NO date arithmetic at all,
// so there was never a boundary that could be wrong.
//
// Scope of this harness, deliberately narrow:
//   * The `dv` surface the shipped file actually uses is tiny — `pages`, `paragraph`, `table`
//     — and the data surface is `p.file.{name,day,tasks}` and
//     `t.{text,completed,status,header.subpath}`. The stub below covers exactly that and
//     nothing more, so it cannot quietly diverge from Dataview by supporting more than the
//     view uses.
//   * `dv.luxon.DateTime` is faked, not bundled. That is the one place the harness is not
//     Dataview: the fake implements `now`/`startOf`/`minus`/`toISODate` over JS `Date` using
//     LOCAL getters, which is what makes the boundary observably timezone-dependent — the
//     property the issue's first acceptance criterion is about. It deliberately does not
//     implement the rest of Luxon, so the shipped code cannot lean on anything untested.
//   * A fixture's date lives in `file.name`, because that is the calendar key in this vault:
//     daily notes are named `YYYY-MM-DD` and the MOCs match on that name.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  ".."
);
export const DASHBOARD = path.join(REPO_ROOT, "07-Reviews", "Habit Analytics Dashboard.md");

// The sections the guards below rely on. Pinned so that renaming or deleting one fails loudly
// instead of leaving a guard that silently matches nothing.
export const EXPECTED_SECTIONS = [
  "📈 Overall Habit Performance",
  "📊 Daily Habit Heatmap",
  "📅 Completion by Day of Week",
  "🔄 Streak Analysis",
  "📊 Trend Analysis",
  "🎯 Areas for Improvement",
];

// Shipped blocks, keyed by the heading above the fence. Read from the file on disk every call:
// the subject is what ships.
//
// Split by `## ` section rather than matching `heading` + blank line + fence. The stricter
// shape was the original, and it failed the first time a section gained a paragraph of prose
// between its heading and its code: the block vanished from this map and four of the five
// guards would have passed over a section they never read. `requireSection` is what caught it,
// which is exactly why it exists.
export function shippedBlocks() {
  const text = fs.readFileSync(DASHBOARD, "utf8");
  const blocks = new Map();
  const sections = text.split(/^## /m).slice(1);
  for (const section of sections) {
    const newline = section.indexOf("\n");
    if (newline < 0) continue;
    const heading = section.slice(0, newline).trim();
    const code = [...section.slice(newline).matchAll(/```dataviewjs\r?\n([\s\S]*?)```/g)]
      .map((match) => match[1])
      .join("\n");
    if (code.length > 0) blocks.set(heading, code);
  }
  return blocks;
}

export function requireSection(blocks, prefix) {
  const key = [...blocks.keys()].find((heading) => heading.startsWith(prefix));
  if (!key) {
    throw new Error(
      `no dataviewjs block under a heading starting ${JSON.stringify(prefix)} — this harness ` +
        `reads shipped source, so a renamed or moved section would otherwise pass vacuously. ` +
        `Found: ${[...blocks.keys()].join(" | ")}`
    );
  }
  return { heading: key, code: blocks.get(key) };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

// `dv.pages()` returns a Dataview `DataArray`, not an Array — it has `.where()` and a
// `.sort(key, direction)` that is NOT `Array.prototype.sort`. A plain array made the first run
// of this harness throw `dv.pages(...).where is not a function`, which is the right kind of
// failure: it means the stub was not pretending to be Dataview well enough to be trusted.
//
// Only the surface the shipped file uses is implemented. `sort` handles both forms Dataview
// accepts — a key extractor with a direction, and a plain comparator — and distinguishes them
// by arity, which is the one approximation here and is stated rather than assumed.
class DataArray {
  constructor(items) {
    this.items = items;
  }
  get length() {
    return this.items.length;
  }
  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  }
  at(index) {
    return this.items.at(index);
  }
  where(predicate) {
    return new DataArray(this.items.filter(predicate));
  }
  filter(predicate) {
    return new DataArray(this.items.filter(predicate));
  }
  map(transform) {
    return new DataArray(this.items.map(transform));
  }
  sort(key, direction = "asc") {
    const next = this.items.slice();
    if (typeof key === "function" && key.length >= 2) {
      return new DataArray(next.sort(key));
    }
    const extract = typeof key === "function" ? key : (value) => value;
    next.sort((a, b) => {
      const left = extract(a);
      const right = extract(b);
      if (left < right) return direction === "desc" ? 1 : -1;
      if (left > right) return direction === "desc" ? -1 : 1;
      return 0;
    });
    return new DataArray(next);
  }
  slice(start, end) {
    return new DataArray(this.items.slice(start, end));
  }
}

// A DateTime whose local-calendar behaviour is real. `toISODate()` goes through the local
// getters, so the answer depends on `process.env.TZ` exactly as Luxon's would.
function makeDateTime(instant) {
  const at = instant instanceof Date ? instant : new Date(instant);
  return {
    startOf() {
      const day = new Date(at);
      day.setHours(0, 0, 0, 0);
      return makeDateTime(day);
    },
    minus({ days }) {
      const day = new Date(at);
      day.setDate(day.getDate() - days);
      return makeDateTime(day);
    },
    plus({ days }) {
      const day = new Date(at);
      day.setDate(day.getDate() + days);
      return makeDateTime(day);
    },
    toISODate() {
      return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
    },
    toFormat(format) {
      return format
        .replace("yyyy", String(at.getFullYear()))
        .replace("MM", pad(at.getMonth() + 1))
        .replace("dd", pad(at.getDate()));
    },
    valueOf() {
      return at.getTime();
    },
  };
}

// Every `dv.*` call the dashboard makes. Anything else throws rather than returning undefined,
// so the day the view starts using a new API the harness says so instead of the view quietly
// rendering nothing.
export function makeDv({ now, pages }) {
  const output = [];
  const tables = [];
  const render = (value) => (typeof value === "string" ? value : JSON.stringify(value));

  const dv = {
    paragraph: (value) => {
      output.push(render(value));
    },
    table: (headers, rows) => {
      tables.push({ headers, rows });
      output.push(headers.join(" | "));
      for (const row of rows ?? []) output.push(row.map(render).join(" | "));
    },
    pages: (source) => {
      const folder = String(source ?? "").replace(/"/g, "");
      return new DataArray(
        pages.filter((page) => !folder || page.file.path.startsWith(folder))
      );
    },
    luxon: { DateTime: { now: () => makeDateTime(now) } },
  };

  return { dv, output, tables };
}

// Run one shipped block against a fixture. `now` is an ISO instant string, not a date, so a
// case can pin a moment that falls on different calendar days in different zones.
export function runBlock(headingPrefix, { now, pages }) {
  const blocks = shippedBlocks();
  const { heading, code } = requireSection(blocks, headingPrefix);
  const { dv, output, tables } = makeDv({ now, pages });
  new Function("dv", code)(dv);
  return { heading, output, tables, text: output.join("\n") };
}

// A daily note as the dashboard sees it. `habits` is a list of names; `done` is optional and
// defaults to all done, because a case that is about MISSING days should not also be a case
// about unchecked habits.
export function dailyNote(date, habits, done = habits.length) {
  return {
    file: {
      name: date,
      path: `01-Daily/${date.slice(0, 7)}/${date}.md`,
      day: date,
      tasks: habits.map((name, index) => ({
        text: name,
        completed: index < done,
        status: index < done ? "x" : " ",
        header: { subpath: "🔁 Habits" },
      })),
    },
  };
}

export function daysBefore(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString().slice(0, 10);
}

// Direct execution is the timezone probe: print the window the SHIPPED view computes for a
// pinned instant under whatever `TZ` this process has. Kept here, not in the test, so the test
// and the probe evaluate the same shipped text through the same code path.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const now = process.argv[2] ?? "2026-10-07T11:30:00Z";
  const dates = process.argv.slice(3);
  const pages = dates.map((date) => dailyNote(date, ["water", "read"]));
  const thirty = runBlock("📈 Overall Habit Performance", { now, pages });
  const fourteen = runBlock("📊 Daily Habit Heatmap", { now, pages });
  process.stdout.write(
    JSON.stringify({
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      now,
      thirtyDay: thirty.text,
      fourteenDay: fourteen.text,
    })
  );
}
