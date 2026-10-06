// Issue #56: the streak analysis let a run bridge across logged days where the habit was absent,
// so "current streak" could mean observations spread across a gap rather than a real consecutive
// run. The previous code also left the running streak intact when a habit was missing, and the
// comment said "unlogged days neither extend nor break a streak" while the code treated a logged
// day without the habit the same way.
//
// These cases run the SHIPPED DataviewJS through `helpers/habit-dashboard-harness.mjs` rather
// than a copy of it, for the reason `priority-contract` (#53) already established: a retyped
// copy proves nothing about what ships and keeps passing after the file regresses.
import test from "node:test";
import assert from "node:assert/strict";
import { shippedBlocks, runBlock, dailyNote, daysBefore } from "./helpers/habit-dashboard-harness.mjs";

const NOW = "2026-10-07T12:00:00Z";

function localDate(instant) {
  const at = new Date(instant);
  const pad = (n) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

const TODAY = localDate(NOW);

function noteWithHabits(date, habitsDone, habitsTotal = 2) {
  const names = ["water", "read"];
  return dailyNote(date, names, habitsDone);
}

test("a streak cannot bridge a logged day where the habit is absent", () => {
  // three consecutive days done, then a logged day with the habit NOT done, then one more done.
  // The old code would have reported current streak = 5 across the gap; the fix reports 1 (just
  // today), with best streak = 3 from the first run.
  const pages = [
    noteWithHabits(daysBefore(TODAY, 4), 2), // both habits done
    noteWithHabits(daysBefore(TODAY, 3), 2),
    noteWithHabits(daysBefore(TODAY, 2), 2),
    noteWithHabits(daysBefore(TODAY, 1), 0), // logged day, but habit not done
    noteWithHabits(TODAY, 2),
  ];
  const { tables } = runBlock("🔄 Streak Analysis", { now: NOW, pages });

  // Find the streak table — the only one with "Current Streak" in its headers.
  const streakTable = tables.find((t) => t.headers.includes("Current Streak"));
  assert.ok(streakTable, "no streak table found");

  const waterRow = streakTable.rows.find((row) => row[0] === "water");
  assert.ok(waterRow, "no water row");
  assert.equal(waterRow[1], "1 days", `current streak should be 1 (just today), got ${waterRow[1]}`);
  assert.equal(waterRow[2], "3 days", `best streak should be 3, got ${waterRow[2]}`);
});

test("a logged day without the habit breaks the current streak", () => {
  // two done, one logged day with no habit line at all, then one more done. Current streak
  // after the gap is 1 (just today), not 3.
  const pages = [
    noteWithHabits(daysBefore(TODAY, 2), 2),
    noteWithHabits(daysBefore(TODAY, 1), 0), // logged, but no habit recorded
    noteWithHabits(TODAY, 2),
  ];
  const { tables } = runBlock("🔄 Streak Analysis", { now: NOW, pages });

  const streakTable = tables.find((t) => t.headers.includes("Current Streak"));
  const waterRow = streakTable.rows.find((row) => row[0] === "water");
  assert.equal(waterRow[1], "1 days", `current streak should be 1 (just today), got ${waterRow[1]}`);
  assert.equal(waterRow[2], "1 days", `best streak should be 1, got ${waterRow[2]}`);
});

test("a calendar gap ends the current streak run", () => {
  // two done on consecutive days, then no note for a day, then one more done. The calendar gap
  // ends the first run; current streak is 1 (just today), not 3.
  const pages = [
    noteWithHabits(daysBefore(TODAY, 3), 2),
    noteWithHabits(daysBefore(TODAY, 2), 2),
    // no note for yesterday (gap)
    noteWithHabits(TODAY, 2),
  ];
  const { tables } = runBlock("🔄 Streak Analysis", { now: NOW, pages });

  const streakTable = tables.find((t) => t.headers.includes("Current Streak"));
  const waterRow = streakTable.rows.find((row) => row[0] === "water");
  assert.equal(waterRow[1], "1 days", `current streak should be 1 (just today), got ${waterRow[1]}`);
  assert.equal(waterRow[2], "2 days", `best streak should be 2, got ${waterRow[2]}`);
});


test("the streak coverage line states the rule explicitly", () => {
  const pages = [dailyNote(TODAY, ["water"], 1)];
  const { text } = runBlock("🔄 Streak Analysis", { now: NOW, pages });

  assert.match(
    text,
    /a logged day without the habit breaks the streak/,
    `streak coverage line must state the breakage rule: ${text}`
  );
});
