// Harness for `99-Templates/Weekly Review.md`, whose statistics live in DataviewJS
// blocks that only Obsidian executes — the same reason `priority-contract` (#53) and
// `habit-calendar-window` (#55) extract the SHIPPED text and evaluate it instead of
// retyping a copy. A copy proves nothing about what ships.
//
// Issue #59: the weekly template resolved its week from
// `dv.current().file.day || moment()` and then read `.weekYear` / `.weekNumber` /
// `.year` as PROPERTIES. Dataview's `file.day` is a Luxon `DateTime`, where those
// are getters — but the `moment()` fallback is a Moment, where all three are
// METHODS. So the fallback made `targetYear` a truthy function, the comparison
// `wy === targetYear` was false for every note, and a review rendered empty
// statistics rather than failing. Compounding it, the note's own period was never
// the source: `date(today)` and `moment()` meant a review opened later reported the
// days around the *viewing* date.
//
// The `moment` stub below is therefore deliberately TRAPPED rather than friendly:
// every accessor that Moment exposes as a method is a method here, so a block that
// reads one as a property receives a function and its output goes wrong in the
// tests rather than in someone's vault.
//
// Scope, deliberately narrow:
//   * The `dv` surface the shipped file uses is `current`, `pages`, `paragraph`,
//     `table` and `luxon.DateTime`. Anything else throws rather than returning
//     undefined, so the day the note starts using a new API this harness says so
//     instead of the note quietly rendering nothing.
//   * `dv.luxon.DateTime` and `moment` are fakes, not bundles. `DateTime` is only
//     used for its `toISODate()`, and the fake returns the calendar date it was
//     built from — which is what Luxon does for a date parsed out of a file name.
//     Nothing here implements more of either library than the note uses.
//   * A fixture's date lives in `file.name`, because that is the calendar key in
//     this vault: daily notes are named `YYYY-MM-DD`, reviews `YYYY-Www`.
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
export const TEMPLATE = path.join(REPO_ROOT, "99-Templates", "Weekly Review.md");
export const REVIEWS_MOC = path.join(REPO_ROOT, "07-Reviews", "_Reviews MOC.md");

// The statistics blocks, by the heading above the fence. Pinned so that renaming or
// deleting one fails loudly instead of leaving a guard that matches nothing.
export const STATISTICS_SECTIONS = [
  "Energy Average",
  "Sleep Average",
  "Mood Distribution",
  "🎉 Completed Tasks This Week",
  "📖 Learning Notes Added This Week",
];

// The marker the note uses to delimit the resolver it repeats in each block. The
// repetition is unavoidable — DataviewJS blocks run in separate scopes and cannot
// import — so the copies are pinned against each other instead, which is what makes
// the duplication safe rather than a standing invitation to drift.
export const RESOLVER_START = "#59 period resolution";
export const RESOLVER_END = "// end #59 period resolution";

// Shipped blocks, keyed by the heading above the fence, read from disk every call:
// the subject is what ships.
export function shippedBlocks(file = TEMPLATE) {
  const text = fs.readFileSync(file, "utf8");
  const blocks = new Map();
  const sections = text.split(/^#{2,3} /m).slice(1);
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

/** The resolver text each statistics block is supposed to carry, verbatim. */
export function resolverSource(code) {
  const start = code.indexOf(RESOLVER_START);
  const end = code.indexOf(RESOLVER_END);
  if (start < 0 || end < 0 || end < start) return null;
  return code.slice(start, end + RESOLVER_END.length);
}

const pad = (value) => String(value).padStart(2, "0");
const isoKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** A date-only instant, built from local components so the harness is zone-free. */
export function localDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** ISO week-year and week number of a date — the math Moment hides behind methods. */
export function isoWeekParts(date) {
  const at = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = (at.getUTCDay() + 6) % 7; // Monday = 0
  at.setUTCDate(at.getUTCDate() - weekday + 3); // the Thursday of this ISO week
  const isoYear = at.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  return { year: isoYear, week: 1 + Math.round((at - firstThursday) / (7 * 86400000)) };
}

/** A Luxon-like date: the shape Dataview puts in `file.day`. */
export function luxonLike(key) {
  return {
    toISODate: () => key,
    toFormat: (format) => format.replace("yyyy", key.slice(0, 4)).replace("MM", key.slice(5, 7)).replace("dd", key.slice(8, 10)),
    valueOf: () => localDate(key).getTime(),
  };
}

/** A Moment-like date, without `toISODate` — the other library the note may meet. */
export function momentLike(key) {
  return {
    format: (format) => (format === "YYYY-MM-DD" ? key : `${key} (${format})`),
    toString: () => key,
    valueOf: () => localDate(key).getTime(),
  };
}

/**
 * `moment` as Templater and Dataview actually provide it.
 *
 * `weekYear`, `isoWeekYear`, `weekNumber`, `isoWeek`, `year`, `month`, `date` and
 * `day` are METHODS. This is the whole point of the stub: issue #59 was a block
 * reading one of these as a property, receiving a function, comparing it to a
 * number and rendering nothing.
 */
export function makeMoment(nowIso) {
  const at = (value) => {
    if (value == null) return new Date(nowIso);
    if (value instanceof Date) return value;
    if (typeof value === "object" && typeof value.toISODate === "function") return localDate(value.toISODate());
    if (typeof value === "object" && typeof value.valueOf === "function") return new Date(value.valueOf());
    return localDate(String(value).slice(0, 10));
  };

  const call = (value) => {
    const date = at(value);
    const parts = () => isoWeekParts(date);
    const self = {
      weekYear: () => parts().year,
      isoWeekYear: () => parts().year,
      weekNumber: () => parts().week,
      isoWeek: () => parts().week,
      year: () => date.getFullYear(),
      month: () => date.getMonth(),
      date: () => date.getDate(),
      day: () => date.getDay(),
      isoWeekday: () => ((date.getDay() + 6) % 7) + 1,
      format: (format) => (format === "YYYY-MM-DD" ? isoKey(date) : format),
      toString: () => isoKey(date),
      toISOString: () => date.toISOString(),
      isValid: () => !isNaN(date.getTime()),
      valueOf: () => date.getTime(),
      diff: (other) =>
        Math.floor((date.getTime() - at(other).getTime()) / 86400000),
    };
    return self;
  };
  return call;
}

// `dv.pages()` returns a Dataview `DataArray`, not an Array: it has `.where()` and a
// `.sort(key, direction)` that is not `Array.prototype.sort`. Only the surface the
// shipped file uses is implemented.
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
  flatMap(transform) {
    return new DataArray(this.items.flatMap(transform));
  }
  forEach(each) {
    this.items.forEach(each);
  }
  some(predicate) {
    return this.items.some(predicate);
  }
  every(predicate) {
    return this.items.every(predicate);
  }
  find(predicate) {
    return this.items.find(predicate);
  }
  // Dataview's DataArray implements the Array interface rather than a subset of it,
  // so `reduce` and friends are part of the real surface a view may use.
  reduce(each, initial) {
    return this.items.reduce(each, initial);
  }
  includes(value) {
    return this.items.includes(value);
  }
  indexOf(value) {
    return this.items.indexOf(value);
  }
  join(separator) {
    return this.items.join(separator);
  }
  concat(other) {
    return new DataArray(this.items.concat(other instanceof DataArray ? other.items : other));
  }
  slice(start, end) {
    return new DataArray(this.items.slice(start, end));
  }
  reverse() {
    return new DataArray(this.items.slice().reverse());
  }
  array() {
    return this.items.slice();
  }
  sort(key, direction = "asc") {
    const next = this.items.slice();
    if (typeof key === "function" && key.length >= 2) return new DataArray(next.sort(key));
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
}

const KNOWN_DV = new Set(["current", "pages", "paragraph", "table", "list", "luxon"]);

export function makeDv({ now, current, pages }) {
  const output = [];
  const tables = [];
  const render = (value) => (typeof value === "string" ? value : JSON.stringify(value));

  const base = {
    current: () => current,
    paragraph: (value) => {
      output.push(render(value));
    },
    list: (values) => {
      for (const value of values ?? []) output.push(render(value));
    },
    table: (headers, rows) => {
      tables.push({ headers, rows });
      output.push(headers.join(" | "));
      for (const row of rows ?? []) output.push(row.map(render).join(" | "));
    },
    pages: (source) => {
      const folders = [...String(source ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]);
      return new DataArray(
        pages.filter(
          (page) =>
            folders.length === 0 ||
            folders.some(
              (folder) =>
                page.file.path === folder || page.file.path.startsWith(`${folder}/`)
            )
        )
      );
    },
    luxon: { DateTime: { now: () => luxonLike(isoKey(at(now))) } },
  };

  // Anything the note starts using that the harness does not model throws, rather
  // than returning `undefined` and letting a view render an empty table.
  const dv = new Proxy(base, {
    get(target, property) {
      if (property in target || typeof property !== "string") return target[property];
      if (KNOWN_DV.has(property)) return target[property];
      throw new Error(`the harness' dv stub has no ${String(property)} — teach it, do not guess`);
    },
  });

  return { dv, output, tables };
}

function at(instant) {
  return instant instanceof Date ? instant : new Date(instant);
}

/**
 * Run one shipped block against a fixture.
 *
 * `file.day` is supplied per fixture, so the same note can be run with a
 * Luxon-like date, a Moment-like one, an ISO string, or none at all.
 */
export function runBlock(headingPrefix, { now, current, pages, file = TEMPLATE }) {
  const blocks = shippedBlocks(file);
  const { heading, code } = requireSection(blocks, headingPrefix);
  const { dv, output, tables } = makeDv({ now, current, pages });
  new Function("dv", "moment", code)(dv, makeMoment(now));
  return { heading, output, tables, text: output.join("\n"), code };
}

/** A daily note as the review sees it. */
export function dailyNote(date, { energy, sleep, mood, tasks = [], day = luxonLike(date) } = {}) {
  return {
    file: {
      name: date,
      path: `01-Daily/${date.slice(0, 7)}/${date}.md`,
      day,
      ctime: luxonLike(date),
      mtime: luxonLike(date),
      tasks,
    },
    energy,
    sleep_hours: sleep,
    mood,
  };
}

// A completed task. `completedOn` null is the real case the tasks plugin leaves
// behind: `- [x] text` with no `✅ YYYY-MM-DD`, so there is no completion date to
// filter on and the containing file's touch is all the query has.
export function task(text, completedOn) {
  return {
    text,
    completed: true,
    completion: completedOn === null ? null : luxonLike(completedOn),
    path: "01-Daily",
    line: 1,
  };
}

export function openTask(text) {
  return { text, completed: false, completion: null, path: "01-Daily", line: 1 };
}

export function learningNote(date, { topic = "Topic", status = "active" } = {}) {
  return {
    file: {
      name: date,
      path: `04-Learning/${date}.md`,
      ctime: luxonLike(date),
      mtime: luxonLike(date),
      link: `[[${date}]]`,
      tasks: [],
    },
    created: date,
    topic,
    status,
  };
}

export function projectNote(name, { last_reviewed = null, review_cycle = "14d" } = {}) {
  return {
    file: {
      name,
      path: `02-Projects/${name}/${name}.md`,
      ctime: luxonLike("2026-01-01"),
      mtime: luxonLike("2026-01-01"),
      link: `[[${name}]]`,
      tasks: [],
    },
    type: "project",
    status: "in-progress",
    last_reviewed,
    review_cycle,
  };
}

/** A review note: its own period comes from its name (or its frontmatter). */
export function reviewNote(name, frontmatter = {}) {
  return Object.assign({ file: { name, path: `07-Reviews/${name}.md`, day: null } }, frontmatter);
}

/**
 * A review record as the `_Reviews MOC` history selectors see it (#126). `kind` is
 * what the selectors classify on; omit it to exercise the legacy name-only path.
 */
export function reviewRecord(name, { kind, updated = null, ctime = "2026-01-01", mtime = "2026-01-01" } = {}) {
  return {
    file: {
      name,
      path: `07-Reviews/${name}.md`,
      link: `[[${name}]]`,
      ctime: luxonLike(ctime),
      mtime: luxonLike(mtime),
      day: null,
    },
    kind,
    updated,
  };
}

export function daysBetween(startKey, endKey) {
  return Math.round((localDate(endKey) - localDate(startKey)) / 86400000);
}

// Direct execution prints what the SHIPPED blocks resolve for a given note, which is
// how the real-vault and rollover probes are taken without a second code path.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const now = process.argv[2] ?? "2026-11-20T12:00:00Z";
  const name = process.argv[3] ?? "2026-W41";
  const current = reviewNote(name);
  const result = runBlock("Energy Average", { now, current, pages: [] });
  process.stdout.write(JSON.stringify({ now, name, text: result.text }, null, 2));
}
