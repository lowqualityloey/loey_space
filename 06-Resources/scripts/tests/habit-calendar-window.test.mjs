// Issue #55: the vault's only calendar-labelled views selected the newest N note FILES, not a
// date range. `.slice(0, 30)` sat under a comment reading "from the last 30 days", so a gap in
// logging silently reached back past the window the heading advertises — an August note was
// counted as recent — and nothing disclosed how many days the 100% was computed from. The
// sharpest statement of the root cause: the dashboard performed **no date arithmetic at all**,
// so there was never a boundary that could be wrong.
//
// These cases run the SHIPPED DataviewJS through `helpers/habit-dashboard-harness.mjs` rather
// than a copy of it, for the reason `priority-contract` (#53) already established: a retyped
// copy proves nothing about what ships and keeps passing after the file regresses.
//
// Fixtures are relative to the harness's own `today`, which the test derives the same way
// (local calendar date of a pinned instant), so no case depends on the zone this process
// happens to run in. Zone dependence is asserted explicitly and separately, in a child process
// with `TZ` set, because that is the only way to observe it.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_SECTIONS,
  shippedBlocks,
  runBlock,
  dailyNote,
  daysBefore,
} from "./helpers/habit-dashboard-harness.mjs";

const HARNESS = fileURLToPath(new URL("./helpers/habit-dashboard-harness.mjs", import.meta.url));
const BLOCKS = shippedBlocks();

// A zone-independent "now": the window must follow the LOCAL calendar date, and this instant
// lands on a different one in different zones, which is why the fixtures below are built from
// it rather than hard-coded to a date.
const NOW = "2026-10-07T12:00:00Z";

function localDate(instant) {
  const at = new Date(instant);
  const pad = (n) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

const TODAY = localDate(NOW);

function habits(done) {
  return ["water", "read"].map((name, index) => ({ name, done: index < done }));
}

function note(date, donePerDay) {
  return dailyNote(date, ["water", "read"], donePerDay);
}

function probe(zone, now, dates) {
  const result = spawnSync(process.execPath, [HARNESS, now, ...dates], {
    env: { ...process.env, TZ: zone },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `harness probe under TZ=${zone} failed:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

test("the harness reads shipped source and finds every section", () => {
  // Non-vacuity, and it has already earned its place: the first extraction required the fence
  // to sit immediately under the heading, so the Trend section vanished from the map as soon as
  // a paragraph of prose was added above it, and four guards would have passed over a section
  // they never read.
  assert.ok(
    BLOCKS.size >= EXPECTED_SECTIONS.length,
    `expected at least ${EXPECTED_SECTIONS.length} shipped dataviewjs sections, found ${BLOCKS.size}: ` +
      `${[...BLOCKS.keys()].join(" | ")}`
  );
  for (const prefix of EXPECTED_SECTIONS) {
    assert.ok(
      [...BLOCKS.keys()].some((heading) => heading.startsWith(prefix)),
      `no section starting ${prefix}; found ${[...BLOCKS.keys()].join(" | ")}`
    );
  }
});

test("observations older than the window are excluded from the 30-day view", () => {
  // Three recent days fully done, three days from six weeks ago not done at all. Counting the
  // old notes drags the rate to 50%; the window's answer is 100% over three logged days.
  const pages = [
    note(TODAY, 2),
    note(daysBefore(TODAY, 1), 2),
    note(daysBefore(TODAY, 2), 2),
    note(daysBefore(TODAY, 40), 0),
    note(daysBefore(TODAY, 41), 0),
    note(daysBefore(TODAY, 42), 0),
  ];
  const { text } = runBlock("📈 Overall Habit Performance", { now: NOW, pages });

  assert.match(
    text,
    /\(6\/6 habits completed on 3 logged day\(s\)\)/,
    `old observations leaked into the 30-day window:\n${text}`
  );
  assert.match(text, /100%/);
});

test("the window is a calendar range inclusive of today, not a count of files", () => {
  // today-29 is the last day inside "30 calendar days"; today-30 and today-31 are outside it.
  // With six files and `slice(0, 30)` all of them were inside, so the old code reports 2/6.
  const pages = [
    note(daysBefore(TODAY, 29), 2),
    note(daysBefore(TODAY, 30), 0),
    note(daysBefore(TODAY, 31), 0),
  ];
  const { text } = runBlock("📈 Overall Habit Performance", { now: NOW, pages });

  assert.match(
    text,
    /\(2\/2 habits completed on 1 logged day\(s\)\)/,
    `the 30-day boundary is not a calendar day:\n${text}`
  );
});

test("the heatmap window is 14 calendar days, and shows only logged days", () => {
  const inside = daysBefore(TODAY, 13);
  const outside = daysBefore(TODAY, 14);
  const pages = [note(TODAY, 2), note(inside, 2), note(outside, 2)];
  const { text, tables } = runBlock("📊 Daily Habit Heatmap", { now: NOW, pages });

  const dates = tables.flatMap((table) => table.rows.map((row) => row[0]));
  assert.ok(dates.includes(inside), `expected ${inside} inside the 14-day window`);
  assert.ok(
    !dates.includes(outside),
    `${outside} is 14 days back and must be outside the window; rows were ${dates.join(", ")}`
  );
  assert.ok(!dates.includes(daysBefore(TODAY, 20)), "a note from three weeks ago must not appear");
});

test("unlogged days are disclosed as unknown, and never counted as failures", () => {
  // Two logged days complete, one logged day with nothing done, and 27 days with no note at
  // all. The rate must be over recorded habit lines (4/6), and the 27 missing days must be
  // stated as unknown rather than folded in as zeroes.
  const pages = [note(TODAY, 2), note(daysBefore(TODAY, 1), 2), note(daysBefore(TODAY, 2), 0)];
  const { text } = runBlock("📈 Overall Habit Performance", { now: NOW, pages });

  assert.match(text, /3\/30 calendar days logged/);
  assert.match(text, /27 unlogged day\(s\), which are unknown rather than failures/);
  assert.match(
    text,
    /\(4\/6 habits completed on 3 logged day\(s\)\)/,
    `the rate must be over recorded habit lines only:\n${text}`
  );
  assert.match(
    text,
    /1 day\(s\) recorded a habit line|3 day\(s\) recorded a habit line/,
    "the count of days that actually recorded a habit line must be disclosed"
  );
});

test("every view states a coverage line, so no view hides its denominator", () => {
  const pages = [note(TODAY, 2), note(daysBefore(TODAY, 1), 1)];
  for (const prefix of EXPECTED_SECTIONS) {
    const { text } = runBlock(prefix, { now: NOW, pages });
    assert.match(text, /Coverage/, `${prefix} reports no coverage:\n${text}`);
  }
});

test("the calendar windows are labelled as calendar days", () => {
  assert.ok(
    [...BLOCKS.keys()].some((heading) => /Last 30 calendar days/.test(heading)),
    "the 30-day heading must say calendar days, because that is what it now selects"
  );
  assert.ok(
    [...BLOCKS.keys()].some((heading) => /Last 14 calendar days/.test(heading)),
    "the 14-day heading must say calendar days"
  );
});

test("the observation-based view is labelled by observations, not by days", () => {
  // AC-4: a retained latest-N-observations view is allowed, but it must not claim a period.
  // The moving average spans the last seven LOGGED days, which a gap stretches past a week.
  const heading = [...BLOCKS.keys()].find((key) => key.startsWith("📊 Trend Analysis"));
  assert.ok(heading, "the trend section must exist");
  assert.match(heading, /Observation/, `the heading still claims a period: ${heading}`);
  assert.doesNotMatch(heading, /7-Day/, `the heading still claims seven days: ${heading}`);

  const { text } = runBlock("📊 Trend Analysis", {
    now: NOW,
    pages: [note(TODAY, 2), note(daysBefore(TODAY, 1), 2)],
  });
  assert.match(text, /7-observation average spans the last 7 of them/);
  assert.match(text, /may reach further back than 7 calendar days/);
});

test("the window follows the local calendar date, not UTC", () => {
  // A pin at 11:30Z on 2026-10-07 is already 2026-10-08 in Auckland (+13) and still 2026-10-07
  // in Los Angeles (-7). A note dated 2026-10-08 is therefore inside the window in Auckland and
  // a day in the future in Los Angeles, and the two runs must disagree.
  const instant = "2026-10-07T11:30:00Z";
  const dates = ["2026-10-08"];

  const auckland = probe("Pacific/Auckland", instant, dates);
  const losAngeles = probe("America/Los_Angeles", instant, dates);
  const utc = probe("UTC", instant, dates);

  assert.match(
    auckland.thirtyDay,
    /1\/30 calendar days logged/,
    `Auckland is already 2026-10-08, so the note is inside the window:\n${auckland.thirtyDay}`
  );
  assert.match(
    losAngeles.thirtyDay,
    /0\/30 calendar days logged/,
    `Los Angeles is still 2026-10-07, so the note is a day ahead:\n${losAngeles.thirtyDay}`
  );
  assert.match(
    utc.thirtyDay,
    /0\/30 calendar days logged/,
    "UTC is 2026-10-07, so the note is outside the window"
  );

  // And the zone is genuinely being varied, rather than all three runs sharing one answer.
  assert.notEqual(auckland.zone, losAngeles.zone);
});

test("running the view changes nothing on disk", () => {
  // The harness only reads: every block is evaluated with a stub `dv`, so a view that acquired
  // a write would fail here rather than in someone's vault.
  const before = JSON.stringify([...BLOCKS.keys()]);
  runBlock("📈 Overall Habit Performance", {
    now: NOW,
    pages: [note(TODAY, 2), note(daysBefore(TODAY, 40), 0)],
  });
  assert.equal(JSON.stringify([...shippedBlocks().keys()]), before);
});
