// Issue #57: the weekly summary selected the newest seven note FILES, not the
// dates of a week.
//
// The shipped selector was:
//   getMarkdownFiles()
//     .filter(path startsWith "01-Daily/" && !name.includes("MOC"))
//     .sort((a, b) => b.name.localeCompare(a.name))
//     .slice(0, 7)
//
// Reproduced verbatim against the owner's real `01-Daily` on 2026-10-06, the
// seven it selected were:
//   1. 01-Daily/Tasks Kanban.md          <- a task board, in slot one
//   2. 01-Daily/2026-10/2026-10-06.md
//   3. 01-Daily/2026-10/2026-10-05.md
//   4. 01-Daily/2026-10/2026-10-04.md
//   5. 01-Daily/2026-09/2026-09-13.md
//   6. 01-Daily/2026-09/2026-09-12.md
//   7. 01-Daily/2026-09/2026-09-11.md
// 6 date-named notes in 7 slots, spanning 2026-09-11 to 2026-10-06 — 26 days
// under a heading that says seven. Two independent defects, not one:
//
//   * the window was a count of files, so a gap in logging reached backwards;
//   * the name blocklist admitted anything without "MOC" in it, and a
//     descending `localeCompare` puts a letter above a digit, so the task
//     board sorted FIRST rather than being filtered out.
//
// These tests drive the pure window module with a synthetic vault laid out the
// way the real one is (`01-Daily/YYYY-MM/YYYY-MM-DD.md`, per #60), so no test
// reads the owner's notes. Dates are built from local components, which makes
// every assertion independent of the machine's timezone.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_WEEK_DAYS,
  buildWeeklyWindow,
  describeCoverage,
  selectWeeklyNotes,
  windowPaths,
} from "../src/lib/weekly-window.ts";

const TZ = "Pacific/Auckland";
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");

/** A local-noon Date, so the calendar key is the same in every timezone. */
function localDay(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0);
}

function f(path) {
  return { path, name: path.split("/").pop(), basename: path.split("/").pop().replace(/\.md$/, "") };
}

// Eight dates across a week boundary (2026-09-30 .. 2026-10-06 is the window
// for 2026-10-06), plus the non-note files that share the folder.
const FILES = [
  f("01-Daily/Tasks Kanban.md"),
  f("01-Daily/_Daily MOC.md"),
  f("01-Daily/_Tasks MOC.md"),
  f("01-Daily/2026-09/2026-09-29.md"), // one day before the window starts
  f("01-Daily/2026-09/2026-09-30.md"), // window start
  f("01-Daily/2026-10/2026-10-01.md"),
  f("01-Daily/2026-10/2026-10-03.md"), // 2026-10-02 missing: a sparse week
  f("01-Daily/2026-10/2026-10-06.md"), // today
  f("01-Daily/2026-08/2026-08-31.md"), // far outside the window
  f("02-Projects/2026-10-05.md"), // right date, wrong folder
];

const TODAY = localDay(2026, 10, 6);
const WINDOW = buildWeeklyWindow(TODAY, DEFAULT_WEEK_DAYS, TZ);

test("the window is seven consecutive calendar days, ending today", () => {
  assert.deepEqual(WINDOW.dateKeys, [
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
    "2026-10-06",
  ]);
  assert.equal(WINDOW.startDate, "2026-09-30");
  assert.equal(WINDOW.endDate, "2026-10-06");
  assert.equal(WINDOW.days, 7);
  assert.equal(WINDOW.timeZone, TZ);
});

test("seven days means today plus the six before it, not seven before it", () => {
  // The subtraction is `days - 1`; an off-by-one here would silently widen
  // every review by one day and still look like a week.
  const w = buildWeeklyWindow(TODAY, 1, TZ);
  assert.deepEqual(w.dateKeys, ["2026-10-06"]);
  assert.equal(buildWeeklyWindow(TODAY, 2, TZ).startDate, "2026-10-05");
});

test("only the dates inside the window are selected, newest first", () => {
  const selected = selectWeeklyNotes(FILES, WINDOW).map((file) => file.path);
  assert.deepEqual(selected, [
    "01-Daily/2026-10/2026-10-06.md",
    "01-Daily/2026-10/2026-10-03.md",
    "01-Daily/2026-10/2026-10-01.md",
    "01-Daily/2026-09/2026-09-30.md",
  ]);
});

test("#57 regression: a task board is never selected, though it sorts above every date", () => {
  // The measured real-vault failure. Under the old comparator
  // `"Tasks Kanban.md".localeCompare("2026-10-06.md") > 0`, so descending put
  // the board first and it consumed one of the seven slots.
  const selected = selectWeeklyNotes(FILES, WINDOW).map((file) => file.path);
  assert.ok(
    !selected.includes("01-Daily/Tasks Kanban.md"),
    "a task board is not a day; it must not be summarised as one"
  );
  // This assertion is what makes the one above non-vacuous: the board really
  // does outrank the newest date under the old ordering, so a name blocklist
  // that forgets it selects it.
  assert.ok(
    "01-Daily/Tasks Kanban.md".localeCompare("01-Daily/2026-10/2026-10-06.md") > 0,
    "the fixture no longer reproduces the sort order that caused the defect"
  );
});

test("#57 regression: a sparse week selects fewer notes rather than older ones", () => {
  const selected = selectWeeklyNotes(FILES, WINDOW).map((file) => file.path);
  assert.equal(selected.length, 4, "the window has 3 unlogged days and must not pad them");
  assert.ok(
    !selected.includes("01-Daily/2026-09/2026-09-29.md"),
    "a note one day outside the window exists and must not be borrowed to fill a slot"
  );
  assert.ok(!selected.includes("01-Daily/2026-08/2026-08-31.md"));
});

test("MOCs and date-named files outside the daily folder are excluded", () => {
  const selected = selectWeeklyNotes(FILES, WINDOW).map((file) => file.path);
  for (const excluded of ["01-Daily/_Daily MOC.md", "01-Daily/_Tasks MOC.md", "02-Projects/2026-10-05.md"]) {
    assert.ok(!selected.includes(excluded), `${excluded} must not be selected`);
  }
});

test("coverage is disclosed, and missing days are unknown rather than zero", () => {
  assert.equal(
    describeCoverage(WINDOW, 4),
    "**Coverage**: 4/7 calendar days logged (2026-09-30 to 2026-10-06, Pacific/Auckland) " +
      "\u2014 3 day(s) have no daily note, which is unknown rather than zero."
  );
  assert.match(describeCoverage(WINDOW, 7), /every calendar day in the window has a daily note/);
});

test("a full week selects all seven dates", () => {
  const full = WINDOW.dateKeys.map((key) => f(windowPaths(WINDOW)[WINDOW.dateKeys.indexOf(key)]));
  const selected = selectWeeklyNotes(full, WINDOW).map((file) => file.path);
  assert.deepEqual(selected, [...windowPaths(WINDOW)].reverse());
  assert.equal(describeCoverage(WINDOW, selected.length).includes("7/7"), true);
});

test("the window is inclusive of today and never reaches into the future", () => {
  const keys = buildWeeklyWindow(TODAY, 30, TZ).dateKeys;
  assert.equal(keys.includes("2026-10-07"), false, "a future date must not be in the window");
  assert.equal(keys[keys.length - 1], "2026-10-06");
});

test("the local walk holds across a month boundary and a DST change", () => {
  // 2026-09-27 is a DST transition where the offset changes by an hour.
  // Millisecond arithmetic drops or repeats a day here; rebuilding each date
  // from local components does not. Asserted as "7 distinct consecutive keys"
  // so the case means the same thing in any timezone the suite runs in.
  const keys = buildWeeklyWindow(localDay(2026, 10, 1), DEFAULT_WEEK_DAYS, TZ).dateKeys;
  assert.equal(keys.length, 7);
  assert.equal(new Set(keys).size, 7, "no day may repeat across a DST change");
  assert.deepEqual(keys, ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
});

test("a non-positive window is rejected rather than silently empty", () => {
  assert.throws(() => buildWeeklyWindow(TODAY, 0, TZ), /days must be a positive integer/);
  assert.throws(() => buildWeeklyWindow(TODAY, 2.5, TZ), /days must be a positive integer/);
});

test("selecting does not mutate the caller's file list", () => {
  const input = [...FILES];
  selectWeeklyNotes(input, WINDOW);
  assert.deepEqual(input.map((file) => file.path), FILES.map((file) => file.path));
});

test("the shipped entry point delegates selection to this module", () => {
  // The module passing its own tests proves nothing about what ships. This is
  // the half that would rot: the old filter and the seven-file slice are
  // asserted ABSENT, so restoring either fails here rather than silently
  // returning to a 26-day "week".
  const source = readFileSync(
    path.join(REPO_ROOT, "06-Resources/scripts/src/weekly-ai-summary.ts"),
    "utf8"
  );
  assert.match(source, /from '\.\/lib\/weekly-window'/, "the entry must import the window module");
  assert.match(source, /selectWeeklyNotes\(/, "the entry must select through the window");
  assert.match(source, /describeCoverage\(/, "the entry must disclose coverage");
  assert.equal(source.includes("!f.name.includes(\"MOC\")"), false, "the name blocklist must be gone");
  assert.equal(/\.slice\(0,\s*7\)/.test(source), false, "the seven-file slice must be gone");
});
