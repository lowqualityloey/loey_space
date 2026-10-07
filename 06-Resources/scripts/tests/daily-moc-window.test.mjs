// Issue #122: the Daily MOC's two vitals views announced a 14-day window but selected the
// newest 14 note FILES — `.slice(0, 14)` in the pulse and `LIMIT 14` in the table. That is the
// same defect #55 fixed on the Habit Analytics Dashboard: with a gap in logging, the newest 14
// files reach back past the window the heading advertises, so an August note is averaged as
// recent. The pulse also reported `Total Logged Days` for the WHOLE VAULT rather than the
// window, and neither view disclosed a denominator — an average over two days and one over
// fourteen rendered as the same number.
//
// These cases run the SHIPPED DataviewJS through `helpers/habit-dashboard-harness.mjs` rather
// than a copy, for the reason #53/#55 established: a retyped copy proves nothing about what
// ships and keeps passing after the file regresses.
//
// Fixtures are relative to the harness's own pinned `now`, from which this test derives the same
// LOCAL calendar date, so no case depends on the zone the suite runs in. Zone dependence is
// asserted separately, in a child process with `TZ` set, because that is the only way to see it.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  DAILY_MOC,
  shippedBlocks,
  runBlock,
  vitalsNote,
  daysBefore,
} from "./helpers/habit-dashboard-harness.mjs";

const HARNESS = fileURLToPath(new URL("./helpers/habit-dashboard-harness.mjs", import.meta.url));
const BLOCKS = shippedBlocks(DAILY_MOC);

// A zone-independent "now": the window must follow the LOCAL calendar date, and this instant
// lands on a different one in different zones, which is why fixtures are built from it rather
// than hard-coded to a date.
const NOW = "2026-10-07T12:00:00Z";

function localDate(instant) {
  const at = new Date(instant);
  const pad = (n) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

const TODAY = localDate(NOW);

function probe(zone, now, dates) {
  const result = spawnSync(process.execPath, [HARNESS, "--moc", now, ...dates], {
    env: { ...process.env, TZ: zone },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `harness probe under TZ=${zone} failed:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function pulse(pages) {
  return runBlock("📊 14-Day Vitals Rollup", { now: NOW, pages, file: DAILY_MOC }).text;
}

function table(pages) {
  return runBlock("🚀 Recent Daily Notes", { now: NOW, pages, file: DAILY_MOC }).text;
}

test("the harness reads the shipped Daily MOC and finds both vitals sections", () => {
  // Non-vacuity: the pulse block sits directly under the document title with no `## ` heading of
  // its own, so a section-splitting reader finds nothing and every guard below would pass over
  // text it never read. The heading was added with the fix; this asserts it is there.
  for (const prefix of ["📊 14-Day Vitals Rollup", "🚀 Recent Daily Notes"]) {
    assert.ok(
      [...BLOCKS.keys()].some((heading) => heading.startsWith(prefix)),
      `no section starting ${prefix}; found ${[...BLOCKS.keys()].join(" | ")}`
    );
  }
});

test("observations older than the window are excluded from the vitals pulse", () => {
  // Three recent days at 8h/4 and three days from six weeks ago at 2h/1. Counting the old notes
  // drags the averages to 5.0h/2.5; the window's answer is 8.0h/4.0 over three logged days.
  const pages = [
    vitalsNote(TODAY, { sleep_hours: 8, energy: 4 }),
    vitalsNote(daysBefore(TODAY, 1), { sleep_hours: 8, energy: 4 }),
    vitalsNote(daysBefore(TODAY, 2), { sleep_hours: 8, energy: 4 }),
    vitalsNote(daysBefore(TODAY, 40), { sleep_hours: 2, energy: 1 }),
    vitalsNote(daysBefore(TODAY, 41), { sleep_hours: 2, energy: 1 }),
    vitalsNote(daysBefore(TODAY, 42), { sleep_hours: 2, energy: 1 }),
  ];
  const text = pulse(pages);

  assert.match(text, /Avg Sleep: \*\*8\.0 hrs\*\*/, `old notes leaked in:\n${text}`);
  assert.match(text, /Avg Energy: \*\*4\.0\/5\*\*/, `old notes leaked in:\n${text}`);
  assert.match(text, /3\/14 calendar days logged/, `the window size must be disclosed:\n${text}`);
});

test("an old-only set yields N/A rather than an average over stale notes", () => {
  const pages = [
    vitalsNote(daysBefore(TODAY, 40), { sleep_hours: 2, energy: 1 }),
    vitalsNote(daysBefore(TODAY, 50), { sleep_hours: 3, energy: 2 }),
  ];
  const text = pulse(pages);

  assert.match(text, /Avg Sleep: \*\*N\/A hrs\*\*/, `a stale note was averaged:\n${text}`);
  assert.match(text, /Avg Energy: \*\*N\/A\/5\*\*/, `a stale note was averaged:\n${text}`);
  assert.match(text, /0\/14 calendar days logged/, `no logged day should be reported:\n${text}`);
});

test("the window is 14 calendar days inclusive of today, not a count of files", () => {
  const inside = daysBefore(TODAY, 13);
  const outside = daysBefore(TODAY, 14);
  const both = [vitalsNote(TODAY, { sleep_hours: 7, energy: 3 }), vitalsNote(inside, { sleep_hours: 7, energy: 3 })];

  const two = pulse(both);
  assert.match(two, /2\/14 calendar days logged/, `today-13 is inside the window:\n${two}`);

  const one = pulse([both[0], vitalsNote(outside, { sleep_hours: 7, energy: 3 })]);
  assert.match(
    one,
    /1\/14 calendar days logged/,
    `today-14 is outside the window; the boundary is not a calendar day:\n${one}`
  );
});

test("missing vitals stay unknown, not zero, and each metric discloses its own coverage", () => {
  // One logged day carries sleep but not energy; another carries energy but not sleep. A missing
  // field must be excluded from that metric's average (so energy is 4.0, not 0) and must be
  // disclosed per metric rather than folded in as a zero.
  const pages = [
    vitalsNote(TODAY, { sleep_hours: 8 }),
    vitalsNote(daysBefore(TODAY, 1), { energy: 4 }),
  ];
  const text = pulse(pages);

  assert.match(text, /Avg Sleep: \*\*8\.0 hrs\*\*/, `missing sleep must not be zero:\n${text}`);
  assert.match(text, /Avg Energy: \*\*4\.0\/5\*\*/, `missing energy must not be zero:\n${text}`);
  assert.match(text, /sleep recorded on 1\/14/, `per-metric sleep coverage missing:\n${text}`);
  assert.match(text, /energy recorded on 1\/14/, `per-metric energy coverage missing:\n${text}`);
});

test("the recent-notes table shares the same 14-day calendar window", () => {
  const inside = daysBefore(TODAY, 13);
  const outside = daysBefore(TODAY, 14);
  const far = daysBefore(TODAY, 40);
  const text = table([
    vitalsNote(TODAY, { mood: 4, energy: 3, sleep_hours: 7 }),
    vitalsNote(inside, { mood: 3, energy: 3, sleep_hours: 6 }),
    vitalsNote(outside, { mood: 2, energy: 2, sleep_hours: 5 }),
    vitalsNote(far, { mood: 1, energy: 1, sleep_hours: 4 }),
  ]);

  assert.ok(text.includes(TODAY), `today must be listed:\n${text}`);
  assert.ok(text.includes(inside), `today-13 must be listed:\n${text}`);
  assert.ok(!text.includes(outside), `today-14 is outside the window:\n${text}`);
  assert.ok(!text.includes(far), `a six-week-old note must not appear:\n${text}`);
  assert.match(text, /2\/14 calendar days logged/, `the table must disclose its window:\n${text}`);
});

test("both vitals headings are labelled as calendar days", () => {
  assert.ok(
    [...BLOCKS.keys()].some((heading) => /Last 14 calendar days/.test(heading)),
    "the headings must say calendar days, because that is what the views now select"
  );
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
    auckland.pulse,
    /1\/14 calendar days logged/,
    `Auckland is already 2026-10-08, so the note is inside the window:\n${auckland.pulse}`
  );
  assert.match(
    losAngeles.pulse,
    /0\/14 calendar days logged/,
    `Los Angeles is still 2026-10-07, so the note is a day ahead:\n${losAngeles.pulse}`
  );
  assert.match(utc.pulse, /0\/14 calendar days logged/, "UTC is 2026-10-07, so the note is outside");

  // And the zone is genuinely being varied, rather than all three runs sharing one answer.
  assert.notEqual(auckland.zone, losAngeles.zone);
});

test("running the views changes nothing on disk", () => {
  const before = JSON.stringify([...BLOCKS.keys()]);
  pulse([vitalsNote(TODAY, { sleep_hours: 7 }), vitalsNote(daysBefore(TODAY, 40), { sleep_hours: 4 })]);
  table([vitalsNote(TODAY, { mood: 3 })]);
  assert.equal(JSON.stringify([...shippedBlocks(DAILY_MOC).keys()]), before);
});
