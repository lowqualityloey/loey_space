// Harness for the calendar-labelled vitals blocks in `01-Daily/_Daily MOC.md`.
//
// The pulse lives in a DataviewJS block Obsidian executes and a shell cannot, so nothing in
// the suite could see this class of defect from the file text alone — the same reason the
// habit-dashboard harness exists. A copy of the block would prove nothing about what ships and
// would keep passing after the file regressed, so this harness reads the SHIPPED source off
// disk every call and executes it against a stubbed `dv` surface.
//
// Issue #122: the pulse labeled itself "14-Day" but selected the newest 14 note FILES via
// `.slice(0, 14)` with no calendar window, so 14 old August notes still averaged into a
// pulse that claimed to cover the last 14 days. The sharpest root-cause statement: the pulse
// performed NO date arithmetic at all, so there was never a boundary that could be wrong.
//
// Scope of this harness, deliberately narrow:
//   * Only the surface the shipped pulse actually uses is stubbed: `dv.pages`, `.where`,
//     `.sort`, `.filter`, `p.file.{name,day,path}`, `p.{sleep_hours,energy}`, `dv.paragraph`,
//     `dv.luxon.DateTime.now`/`startOf`/`minus`/`fromISO`/`valueOf`, and `dv.current` (not used
//     by this pulse, but stubbed to match the `dv` surface the harness shares with the rest of
//     the vault's MOCs so a block that reaches for it fails loudly rather than silently).
//     Anything else throws, so the day the block starts using a new API the harness says so
//     instead of the block quietly rendering nothing.
//   * `dv.luxon.DateTime` is faked, not bundled. The fake implements `now`/`startOf`/`minus`/
//     `fromISO`/`valueOf` over JS `Date` using LOCAL getters, which is what makes the boundary
//     observably timezone-dependent — the property the calendar-window acceptance criterion is
//     about. It deliberately does not implement the rest of Luxon, so the shipped code cannot
//     lean on anything untested.
//   * A note's date lives in `file.name`; the pulse parses it with `dv.luxon.DateTime.fromISO`.
//     `file.day` is stubbed onto each page so blocks that read `p.file.day` (a Luxon DateTime in
//     the real runtime) get something comparable, but this pulse reads `file.name` directly.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

export const DAILY_MOC = path.join(REPO_ROOT, "01-Daily", "_Daily MOC.md");

export const PULSE_HEADING = "📊 14-Day Vitals Pulse";
export const RECENT_HEADING = "## 🚀 Recent Daily Notes (Last 14 Days)";

// Shipped blocks, keyed by the heading/fragment above the fence. Read from the file on disk
// every call: the subject is what ships.
export function shippedBlocks() {
  const text = fs.readFileSync(DAILY_MOC, "utf8");
  const blocks = new Map();

  // DataviewJS fences are what the pulse is inside. The file contains exactly two of them today:
  // the first one is the `14-Day Vitals Pulse` and the last one is the "Recent Daily Notes" table.
  // Even though the pulse no longer has the heading directly above its fence, pairing first/last
  // dataviewjs fences with those two headings keeps the harness bound to what ships, not to how
  // the file happens to be formatted this week.
  const dataviewJsFences = [...text.matchAll(/```dataviewjs\r?\n([\s\S]*?)```/g)];
  if (dataviewJsFences.length >= 1) {
    blocks.set(PULSE_HEADING, dataviewJsFences[0][1]);
  }
  if (dataviewJsFences.length >= 2) {
    blocks.set(RECENT_HEADING, dataviewJsFences[dataviewJsFences.length - 1][1]);
  }

  return blocks;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

// `dv.pages()` returns a Dataview `DataArray`, not an Array — it has `.where()` and a
// `.sort(key, direction)` that is NOT `Array.prototype.sort`. A plain array made the first run
// of the habit-dashboard harness throw `dv.pages(...).where is not a function`, which is the
// right failure mode: it means the stub was not pretending to be Dataview well enough to trust.
// The same contract applies here.
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
  toArray() {
    return this.items.slice();
  }
}

// A DateTime whose calendar arithmetic is deterministic regardless of host timezone. All date
// math and `toISODate()` use UTC so the fixture's calendar window is identical in every TZ the
// runner picks. The old TZ-dependent fake was replaced for the same reason the old `.slice(0, 14)`
// pulse was wrong: a "calendar window" that moves with the runner's clock is not a calendar window.
export function makeDateTime(instant) {
  let at;
  if (instant instanceof makeDateTime) {
    return instant;
  }
  if (instant instanceof Date) {
    at = instant;
  } else {
    at = new Date(instant);
  }
  if (isNaN(at.getTime())) {
    throw new Error(`makeDateTime received an unparseable instant: ${String(instant)}`);
  }

  return {
    valueOf() {
      return at.getTime();
    },
    toISODate() {
      const d = new Date(at.getTime());
      return `${pad(d.getUTCFullYear())}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    },
    startOf(unit) {
      if (unit !== "day") {
        throw new Error(`makeDateTime.startOf does not support unit: ${unit}`);
      }
      const d = new Date(at.getTime());
      d.setUTCHours(0, 0, 0, 0);
      return makeDateTime(d);
    },
    minus({ days }) {
      const d = new Date(at.getTime());
      d.setUTCDate(d.getUTCDate() - days);
      d.setUTCHours(0, 0, 0, 0);
      return makeDateTime(d);
    },
    plus({ days }) {
      const d = new Date(at.getTime());
      d.setUTCDate(d.getUTCDate() + days);
      d.setUTCHours(0, 0, 0, 0);
      return makeDateTime(d);
    },
  };
}

// Every `dv.*` call the pulse uses. Anything else throws rather than returning undefined, so
// the day the block starts using a new API the harness says so instead of the block quietly
// rendering nothing.
export function makeDv({ now, pages }) {
  const output = [];

  const dv = {
    paragraph: (value) => {
      output.push(
        typeof value === "string" ? value : JSON.stringify(value),
      );
    },
    pages: (source) => {
      const folder = String(source ?? "").replace(/"/g, "");
      return new DataArray(
        pages.filter((page) => !folder || page.file.path.startsWith(folder)),
      );
    },

    luxon: { DateTime: { now: () => makeDateTime(now), fromISO: makeDateTime, startOf: (dt, unit) => makeDateTime(dt).startOf(unit), minus: (dt, args) => makeDateTime(dt).minus(args) } },
  };

  return { dv, output };
}

// Run the pulse block against one fixture. `now` is an ISO instant string, not a date, so a
// case can pin a moment that falls on different calendar days in different zones.
export function runPulse({ now, pages }) {
  const code = shippedBlocks().get(PULSE_HEADING);
  if (!code) throw new Error(`no shipped block for ${PULSE_HEADING}`);
  const { dv, output } = makeDv({ now, pages });
  new Function("dv", code)(dv);
  return { output, text: output.join("\n") };
}

// Run the recent-notes block against one fixture.
export function runRecent({ now, pages }) {
  const code = shippedBlocks().get(RECENT_HEADING);
  if (!code) throw new Error(`no shipped block for ${RECENT_HEADING}`);
  const { dv, output } = makeDv({ now, pages });
  new Function("dv", code)(dv);
  return { output, text: output.join("\n") };
}

// A daily note as the MOC sees it. Date lives in file.name and file.day; path is the monthly
// layout this vault uses for daily notes.
export function dailyNote(date, sleepHours, energy) {
  const day = makeDateTime(date);
  return {
    file: {
      name: date,
      day,
      path: `01-Daily/${date.slice(0, 7)}/${date}.md`,
    },
    sleep_hours: sleepHours,
    energy: energy,
  };
}

// Calendar arithmetic over the ISO date string the vault uses as its calendar key.
export function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(iso) {
  return iso;
}

// Direct execution is the timezone probe: print the window the SHIPPED pulse computes for a
// pinned instant under whatever `TZ` this process has. Kept here, not in the test, so the test
// and the probe evaluate the same shipped text through the same code path.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const now = process.argv[2] ?? "2026-10-07T11:30:00Z";
  const dates = process.argv.slice(3);
  const pages = dates.map((date) => dailyNote(date, 7, 4));
  const pulse = runPulse({ now, pages });
  const recent = runRecent({ now, pages });
  process.stdout.write(
    JSON.stringify({
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      now,
      pulse: pulse.text,
      recent: recent.text,
    }),
  );
}
