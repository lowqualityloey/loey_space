// Red test for #122 — the shipped `14-Day Vitals Pulse` in `01-Daily/_Daily MOC.md`
// selects the newest 14 note FILES via `.slice(0, 14)` with no calendar window, so 14 old
// notes still average into a pulse that claims to cover the last 14 days.
//
// This test runs the SHIPPED block off disk through the harness, so a copy would not prove
// anything about what ships and would keep passing after the file regressed. That is the same
// reason the habit-dashboard harness exists.
//
// TDD order: this file started as the RED failure against the shipped block. After the fix to
// `_Daily MOC.md`, the regression suite below asserts the bug is absent (it was RED-failing on
// the shipped block and GREEN-passing after the fix), and the GREEN suite asserts the corrected
// behavior is present. Do not weaken these assertions to make the suite pass; if the block
// regresses, the regression suite must fail.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  runPulse,
  dailyNote,
} from "./helpers/daily-moc-pulse-harness.mjs";

// A pinned instant the window can be computed from. Chosen so that 2026-09-20 is clearly more
// than 14 days before it.
const NOW = "2026-10-07T12:00:00Z";

// 14 old daily notes, all dated 2026-09-15 .. 2026-09-28 — every one of them is outside the
// last-14-calendar-days window ending on 2026-10-07. Each carries sleep/energy so the bug shows
// up as "14 logged days averaged" rather than as missing data.
const OLD_NOTES = [
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  "2026-09-28",
];

function oldNote(date) {
  return dailyNote(date, 7, 4);
}

describe("TASK-2026-10-08-daily-moc-vitals-pulse (#122)", () => {
  describe("regression — corrected pulse does not average old notes by file count", () => {
    it("does not report 14 logged days from 14 old notes outside the window", () => {
      const pages = OLD_NOTES.map(oldNote);
      const { text } = runPulse({ now: NOW, pages });

      // Harness sanity: the block must have actually run. If the harness failed to extract the
      // block, the output would be empty and these assertions would vacuously pass — the exact
      // failure mode this test exists to avoid.
      assert(text.length > 0, "regression harness sanity: the pulse block produced non-empty output (harness must have extracted the block)");
      assert(
        !text.includes("Total Logged Days: 14"),
        "regression: corrected pulse must not report 14 logged days from 14 old notes outside the window",
      );
    });

    it("does not average sleep/energy across 14 old notes outside the window", () => {
      const pages = OLD_NOTES.map(oldNote);
      const { text } = runPulse({ now: NOW, pages });

      assert(
        !text.includes("Avg Sleep: 7.0 hrs"),
        "regression: corrected pulse must not average sleep across 14 old notes outside the window",
      );
      assert(
        !text.includes("Avg Energy: 4.0/5"),
        "regression: corrected pulse must not average energy across 14 old notes outside the window",
      );
    });
  });

  describe("GREEN — corrected pulse selects by calendar window and discloses coverage", () => {
    it("reports 14 in-window logged days for a fixture entirely inside the window", () => {
      // All 14 notes dated 2026-09-24 .. 2026-10-07 fall inside the window ending 2026-10-07,
      // so the corrected pulse should count all 14.
      // Window is 2026-09-24 .. 2026-10-07 inclusive (14 days). Use exactly those 14 dates.
      // Window is 2026-09-24 .. 2026-10-07 inclusive (14 days). The last 14 dates ending on
      // 2026-10-07 are 2026-09-24 .. 2026-10-07.
      const inWindowNotes = [
        "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28",
        "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
        "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
      ];
      // Sanity: every date in the list must be in the window ending 2026-10-07 and starting
      // 2026-09-24. 2026-09-23 would be out (14 days before); 2026-10-08 would be out (after).
      const expectedEveryInWindow =
        inWindowNotes.length === 14 &&
        inWindowNotes[0] === "2026-09-24" &&
        inWindowNotes[inWindowNotes.length - 1] === "2026-10-07";
      assert(
        expectedEveryInWindow,
        "test fixture setup: the 'all in-window' list must be exactly the 14 dates 2026-09-24 .. 2026-10-07",
      );
      const pages = inWindowNotes.map((date) => dailyNote(date, 7, 4));
      const { text } = runPulse({ now: NOW, pages });

      assert(
        text.includes("**Coverage**: 14/14 calendar days logged"),
        `GREEN: corrected pulse reports 14 in-window logged days for 14 notes dated 2026-09-24 .. 2026-10-07 — got: ${text}`,
      );
    });

    it("reports 4 in-window logged days for 14 notes dated 2026-09-15 .. 2026-09-28 (the last 4 are inside the window)", () => {
      const pages = OLD_NOTES.map(oldNote);
      const { text } = runPulse({ now: NOW, pages });

      assert(
        text.includes("**Coverage**: 5/14 calendar days logged") &&
          !text.includes("**Coverage**: 4/14 calendar days logged") &&
          !text.includes("**Coverage**: 0/14 calendar days logged") &&
          !text.includes("**Coverage**: 14/14 calendar days logged"),
        `GREEN: corrected pulse reports 5 in-window logged days for 14 notes dated 2026-09-15 .. 2026-09-28 (the last 5 are inside the window) — got: ${text}`,
      );
    });

    it("reports 1 in-window logged day when only today is present", () => {
      const pages = [dailyNote("2026-10-07", 7, 4)];
      const { text } = runPulse({ now: NOW, pages });

      assert(
        text.includes("**Coverage**: 1/14 calendar days logged"),
        `GREEN: corrected pulse reports 1 in-window logged day when only today is present — got: ${text}`,
      );
    });

    it("reports N/A averages when no in-window note has the metric", () => {
      const pages = [
        dailyNote("2026-10-05", null, null),
        dailyNote("2026-10-06", null, null),
        dailyNote("2026-10-07", null, null),
      ];
      const { text } = runPulse({ now: NOW, pages });

      assert(
        text.includes("Avg Sleep: **N/A hrs**") && text.includes("Avg Energy: **N/A/5**"),
        "GREEN: corrected pulse reports N/A for both averages when no in-window note has either metric",
      );
    });

    it("averages only in-window populated values for the sparse fixture", () => {
      const pages = [
        dailyNote("2026-10-01", 7, null),
        dailyNote("2026-10-02", null, 4),
        dailyNote("2026-10-03", null, null),
        dailyNote("2026-10-04", 6, 3),
        dailyNote("2026-10-05", 7.5, 4),
        dailyNote("2026-10-06", null, 5),
        dailyNote("2026-10-07", 8, null),
      ];
      const { text } = runPulse({ now: NOW, pages });

      // In-window sleep: 7 (10-01), 6 (10-04), 7.5 (10-05), 8 (10-07) = 28.5 / 4 = 7.1
      // In-window energy: 4 (10-02), 3 (10-04), 4 (10-05), 5 (10-06) = 16 / 4 = 4.0
      assert(
        text.includes("Avg Sleep: **7.1 hrs**") &&
          text.includes("Avg Energy: **4.0/5**"),
        "GREEN: corrected pulse averages only in-window populated values for the sparse fixture",
      );
    });

    it("discloses per-metric coverage for the sparse fixture", () => {
      const pages = [
        dailyNote("2026-10-01", 7, null),
        dailyNote("2026-10-02", null, 4),
        dailyNote("2026-10-03", null, null),
        dailyNote("2026-10-04", 6, 3),
        dailyNote("2026-10-05", 7.5, 4),
        dailyNote("2026-10-06", null, 5),
        dailyNote("2026-10-07", 8, null),
      ];
      const { text } = runPulse({ now: NOW, pages });

      assert(
        text.includes("**Coverage**: 7/14 calendar days logged"),
        "GREEN: corrected pulse discloses 7 in-window logged days for the sparse fixture",
      );
    });

    it("splits the boundary notes correctly", () => {
      const pages = [
        dailyNote("2026-09-23", 6, 3),
        dailyNote("2026-09-24", 8, 5),
        dailyNote("2026-10-06", 7, 4),
        dailyNote("2026-10-07", 6.5, 4.5),
      ];
      const { text } = runPulse({ now: NOW, pages });

      // In-window notes: 2026-09-24, 2026-10-06, 2026-10-07 = 3 notes.
      // Out-of-window: 2026-09-23 must not be counted.
      assert(
        text.includes("**Coverage**: 3/14 calendar days logged") &&
          !text.includes("**Coverage**: 4/14 calendar days logged") &&
          !text.includes("**Coverage**: 0/14 calendar days logged"),
        `GREEN: corrected pulse includes 2026-09-24 and excludes 2026-09-23 at the window boundary — got: ${text}`,
      );

      // In-window sleep: 8 (09-24) + 7 (10-06) + 6.5 (10-07) = 21.5 / 3 = 7.2
      // In-window energy: 5 (09-24) + 4 (10-06) + 4.5 (10-07) = 13.5 / 3 = 4.5
      assert(
        text.includes("Avg Sleep: **7.2 hrs**") &&
          text.includes("Avg Energy: **4.5/5**"),
        "GREEN: corrected pulse averages only the 3 in-window boundary notes",
      );
    });
  });
});
