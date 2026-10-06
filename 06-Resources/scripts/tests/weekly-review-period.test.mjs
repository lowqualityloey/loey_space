// Issue #59: the Weekly template's statistics were unavailable to any gate, and they
// had three defects wearing one symptom.
//
//   1. `dv.current().file.day || moment()` fell back to Moment, whose `weekYear`,
//      `weekNumber` and `year` are METHODS. Read as properties they are truthy
//      functions, so `wy === targetYear` compared a number to a function, every note
//      failed the test, and the review rendered `—` and a zero table rather than
//      failing. A weekly review that Dataview cannot give `file.day` (the name
//      `2026-W41` is not an ISO *date*) hit exactly that path.
//   2. Nothing used the review's own period: `date(today)` and `moment()` meant a
//      historical review reported the days around the day it was opened, so the same
//      note said different things on different days.
//   3. A note with no usable date produced silence — misleading empty statistics
//      instead of saying which week it could not work out.
//
// These cases run the SHIPPED DataviewJS through `helpers/weekly-review-harness.mjs`
// rather than a copy of it, for the reason `priority-contract` (#53) and
// `habit-calendar-window` (#55) already established: a retyped copy proves nothing
// about what ships and keeps passing after the file regresses.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  TEMPLATE,
  STATISTICS_SECTIONS,
  RESOLVER_START,
  RESOLVER_END,
  shippedBlocks,
  requireSection,
  resolverSource,
  runBlock,
  reviewNote,
  dailyNote,
  learningNote,
  task,
  luxonLike,
  momentLike,
  isoWeekParts,
  localDate,
} from "./helpers/weekly-review-harness.mjs";

const BLOCKS = shippedBlocks();

// A review whose own week is 2026-10-05 to 2026-10-11, opened in November.
const NOTE = "2026-W41";
const PERIOD = ["2026-10-05", "2026-10-11"];
const LATER = "2026-11-20T12:00:00Z";

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|\s)\/\/.*$/, "$1"))
    .join("\n");
}

const statistics = STATISTICS_SECTIONS.map((prefix) => requireSection(BLOCKS, prefix));

test("the harness reads shipped source and finds every statistics block", () => {
  for (const prefix of STATISTICS_SECTIONS) {
    assert.ok(
      [...BLOCKS.keys()].some((heading) => heading.startsWith(prefix)),
      `no section starting ${prefix}; found ${[...BLOCKS.keys()].join(" | ")}`
    );
  }
});

test("every statistics block carries the same period resolver, verbatim", () => {
  // DataviewJS blocks cannot import, so the resolver is repeated. That repetition is
  // the risk this test exists to remove: one block resolving the period differently
  // would be invisible in review and wrong only in the rendered note.
  const sources = statistics.map(({ heading, code }) => [heading, resolverSource(code)]);
  for (const [heading, source] of sources) {
    assert.ok(source, `${heading} carries no ${RESOLVER_START} … ${RESOLVER_END} block`);
    assert.ok(
      source.includes("function reviewPeriod"),
      `${heading}'s resolver block does not define reviewPeriod — the markers must bracket the resolver itself`
    );
  }
  for (const [heading, source] of sources.slice(1)) {
    assert.equal(
      source,
      sources[0][1],
      `${heading}'s resolver differs from ${sources[0][0]}'s; the copies must stay identical`
    );
  }
});

test("no statistics block reaches for a date library's method as a property", () => {
  // The static half of the guard. The dynamic half is the harness's Moment stub,
  // which exposes these as methods so a property read yields a function.
  const patterns = [/\bmoment\s*\(/, /\.(weekYear|weekNumber|isoWeek|isoWeekYear)\b(?!\s*\()/];
  for (const { heading, code } of statistics) {
    const bare = stripComments(code);
    for (const pattern of patterns) {
      assert.doesNotMatch(bare, pattern, `${heading} still uses ${pattern} — see issue #59`);
    }
  }

  // And the deliberate exception, so this guard cannot be read as "moment is banned":
  // staleness is a question about now, and a historical review should show the
  // projects that were overdue the day it was read.
  const stale = requireSection(BLOCKS, "⚠️ Stale Projects");
  assert.match(stale.code, /\bmoment\s*\(/, "the staleness view is deliberately now-relative");
});

test("the period comes from the note's own name, not from the viewing date", () => {
  const pages = [
    dailyNote("2026-10-06", { energy: 4 }),
    dailyNote("2026-10-07", { energy: 2 }),
    dailyNote("2026-11-18", { energy: 5 }),
  ];
  const { text, tables } = runBlock("Energy Average", {
    now: LATER,
    current: reviewNote(NOTE),
    pages,
  });

  assert.match(text, new RegExp(`\\*\\*Period\\*\\*: ${PERIOD[0]} to ${PERIOD[1]}`), text);
  assert.match(text, /Average energy: \*\*3\.00\*\*/, `expected the mean of 4 and 2:\n${text}`);
  assert.match(text, /2\/7 calendar days logged/, `coverage must disclose the denominator:\n${text}`);
  assert.match(text, /5 day\(s\) have no daily note, which is unknown rather than zero/);
  assert.equal(tables.length, 0);
});

test("the same note reports the same week whenever it is opened", () => {
  // The defect stated as a test: `date(today)` and `moment()` made the answer depend
  // on the calendar, so a review meant something different every day it was read.
  const pages = [
    dailyNote("2026-10-06", { energy: 4, sleep: 7.5, mood: "good" }),
    dailyNote("2026-10-07", { energy: 2, sleep: 6, mood: "tired" }),
  ];
  const stamps = ["2026-10-08T09:00:00Z", "2026-11-20T12:00:00Z", "2027-06-01T23:00:00Z"];
  const runs = stamps.map((now) => {
    const out = {};
    for (const prefix of STATISTICS_SECTIONS.slice(0, 3)) {
      out[prefix] = runBlock(prefix, { now, current: reviewNote(NOTE), pages }).text;
    }
    return out;
  });

  for (const prefix of Object.keys(runs[0])) {
    for (const run of runs.slice(1)) {
      assert.equal(
        run[prefix],
        runs[0][prefix],
        `${prefix} changed with the viewing date — a historical review must not drift`
      );
    }
  }
  // Non-vacuity: the three runs are not all empty for unrelated reasons.
  assert.match(runs[0]["Energy Average"], /3\.00/, "the fixtures must produce a real average");
});

test("a Moment-shaped or absent file.day cannot change the period", () => {
  // The exact fallback that broke: `file.day` present and Luxon-shaped, `file.day`
  // missing (which is the normal case for a note named `2026-W41`, since that is not
  // an ISO date), and `file.day` shaped like the other library.
  const shapes = [
    ["Luxon-like", luxonLike("2026-10-06")],
    ["Moment-like", momentLike("2026-10-06")],
    ["plain Date", localDate("2026-10-06")],
    ["ISO string", "2026-10-06"],
    ["absent", null],
  ];
  const texts = shapes.map(([label, day]) => {
    const pages = [dailyNote("2026-10-06", { energy: 4, day }), dailyNote("2026-10-07", { energy: 2 })];
    const { text } = runBlock("Energy Average", { now: LATER, current: reviewNote(NOTE), pages });
    assert.match(text, new RegExp(`${PERIOD[0]} to ${PERIOD[1]}`), `${label} lost the period:\n${text}`);
    assert.match(text, /3\.00/, `${label} changed the average:\n${text}`);
    return text;
  });

  for (const text of texts.slice(1)) assert.equal(text, texts[0], "file.day must not steer the period");
});

test("the review week keeps its year across a year boundary", () => {
  // 2025-12-29 is a Monday in ISO week 1 of 2026. A note named with the calendar year
  // (`2025-W01`) would resolve to the wrong week entirely, which is why the blueprint
  // names notes with `GGGG`, not `YYYY`.
  const { text } = runBlock("Energy Average", {
    now: "2026-02-01T12:00:00Z",
    current: reviewNote("2026-W01"),
    pages: [dailyNote("2025-12-29", { energy: 3 }), dailyNote("2026-01-04", { energy: 5 })],
  });

  assert.match(text, /\*\*Period\*\*: 2025-12-29 to 2026-01-04/, text);
  assert.match(text, /Average energy: \*\*4\.00\*\*/, text);

  // The date the calendar year would have named.
  const wrong = runBlock("Energy Average", {
    now: "2026-02-01T12:00:00Z",
    current: reviewNote("2025-W01"),
    pages: [],
  }).text;
  assert.match(wrong, /2024-12-30 to 2025-01-05/, "ISO 2025-W01 resolves a year earlier");

  // And 2026 really does have an ISO week 53, so the boundary is not hypothetical.
  const fiftyThree = runBlock("Energy Average", {
    now: "2027-02-01T12:00:00Z",
    current: reviewNote("2026-W53"),
    pages: [dailyNote("2026-12-28", { energy: 1 })],
  }).text;
  assert.match(fiftyThree, /2026-12-28 to 2027-01-03/, fiftyThree);
});

test("the resolved period round-trips through the ISO week it was named for", () => {
  // The bounds are asserted literally above; this pins the other direction, so a
  // change to the week arithmetic has to satisfy both.
  for (const [name, start, end] of [
    ["2026-W41", "2026-10-05", "2026-10-11"],
    ["2026-W01", "2025-12-29", "2026-01-04"],
    ["2026-W53", "2026-12-28", "2027-01-03"],
    ["2025-W20", "2025-05-12", "2025-05-18"],
  ]) {
    const text = runBlock("Energy Average", {
      now: LATER,
      current: reviewNote(name),
      pages: [],
    }).text;
    assert.match(text, new RegExp(`\\*\\*Period\\*\\*: ${start} to ${end}`), `${name}:\n${text}`);

    const parts = isoWeekParts(localDate(start));
    assert.equal(`${parts.year}-W${String(parts.week).padStart(2, "0")}`, name, `${start} is not ${name}`);
    assert.equal(Math.round((localDate(end) - localDate(start)) / 86400000), 6, `${name} must span 7 days`);
  }
});

test("a declared period_start/period_end wins over the note's name", () => {
  const declared = reviewNote(NOTE, { period_start: "2026-09-01", period_end: "2026-09-07" });
  const { text } = runBlock("Energy Average", {
    now: LATER,
    current: declared,
    pages: [dailyNote("2026-09-02", { energy: 4 }), dailyNote("2026-10-06", { energy: 1 })],
  });

  assert.match(text, /\*\*Period\*\*: 2026-09-01 to 2026-09-07/, text);
  assert.match(text, /`period_start`\/`period_end`/, text);
  assert.match(text, /Average energy: \*\*4\.00\*\*/, "only the declared period may be averaged");

  // Half a period is not a period: with only one key declared the note falls back to
  // its name rather than inventing a boundary.
  const half = reviewNote(NOTE, { period_start: "2026-09-01" });
  const halfText = runBlock("Energy Average", { now: LATER, current: half, pages: [] }).text;
  assert.match(halfText, /2026-10-05 to 2026-10-11/, halfText);

  // And an unparseable declaration is not trusted either.
  const bad = reviewNote(NOTE, { period_start: "2026-09-01", period_end: "not a date" });
  const badText = runBlock("Energy Average", { now: LATER, current: bad, pages: [] }).text;
  assert.match(badText, /2026-10-05 to 2026-10-11/, badText);
});

test("a note with no usable period says so instead of showing empty statistics", () => {
  const { text, output } = runBlock("Energy Average", {
    now: LATER,
    current: reviewNote("Untitled", { period_start: "", period_end: "" }),
    pages: [dailyNote("2026-10-06", { energy: 4 })],
  });

  assert.equal(output.length, 1, `exactly one message is expected:\n${text}`);
  assert.match(text, /No review period/, text);
  assert.match(text, /YYYY-Www/, "the message must name the shape it needs");
  assert.doesNotMatch(text, /Average energy/, "no statistic may be rendered from an unknown period");
  assert.doesNotMatch(text, /Coverage/, "a coverage line over an unknown period would be a lie");
});

test("a lone file.day is used as a single day, and says that is what it is", () => {
  const current = { file: { name: "Untitled", path: "07-Reviews/Untitled.md", day: luxonLike("2026-10-06") } };
  const { text } = runBlock("Energy Average", { now: LATER, current, pages: [dailyNote("2026-10-06", { energy: 4 })] });

  assert.match(text, /\*\*Period\*\*: 2026-10-06 — `file\.day`/, text);
  assert.match(text, /single day, not the week/, "a day must not be presented as a week");
  assert.match(text, /a single day, not a week/, "the statistic itself must carry the caveat");
  assert.match(text, /1\/1 calendar days logged/, text);
});

test("completed-task statistics are read from the period, not from today", () => {
  const inside = dailyNote("2026-10-06", {
    tasks: [task("ship #59", "2026-10-06"), task("open a PR", "2026-10-09")],
  });
  const outside = dailyNote("2026-11-18", { tasks: [task("next month's work", "2026-11-18")] });
  const undated = dailyNote("2026-10-07", { tasks: [task("undated legacy line", null)] });

  const { text, tables } = runBlock("🎉 Completed Tasks This Week", {
    now: LATER,
    current: reviewNote(NOTE),
    pages: [inside, outside, undated],
  });

  assert.match(text, /\*\*Period\*\*: 2026-10-05 to 2026-10-11/, text);
  assert.match(text, /ship #59/);
  assert.match(text, /open a PR/);
  assert.match(text, /undated legacy line/, "a completion with no date falls back to the file's touch");
  assert.doesNotMatch(text, /next month's work/, "a task completed outside the period must not appear");
  assert.match(text, /1 of these carry no completion date/, text);
  assert.equal(tables[0].rows.length, 3);
});

test("learning notes are counted for the period, not for the last seven days", () => {
  const { text, tables } = runBlock("📖 Learning Notes Added This Week", {
    now: LATER,
    current: reviewNote(NOTE),
    pages: [
      learningNote("2026-10-06", { topic: "ISO weeks" }),
      learningNote("2026-11-18", { topic: "Something later" }),
    ],
  });

  assert.match(text, /\*\*Period\*\*: 2026-10-05 to 2026-10-11/, text);
  assert.match(text, /ISO weeks/);
  assert.doesNotMatch(text, /Something later/, "a note added outside the period must not appear");
  assert.match(text, /1 note\(s\) added in this period/);
  assert.equal(tables[0].rows.length, 1);
});

test("every statistics block reports the same period, and says where it came from", () => {
  const pages = [dailyNote("2026-10-06", { energy: 4, sleep: 7, mood: "good", tasks: [task("x", "2026-10-06")] })];
  const periodLines = new Set();
  for (const prefix of STATISTICS_SECTIONS) {
    const { text } = runBlock(prefix, { now: LATER, current: reviewNote(NOTE), pages });
    const line = text.split("\n").find((entry) => entry.startsWith("**Period**:"));
    assert.ok(line, `${prefix} reports no period:\n${text}`);
    assert.match(line, /the note's name \(2026-W41\)/, `${prefix} does not say where its period came from`);
    periodLines.add(line);
  }
  assert.equal(periodLines.size, 1, `blocks disagree about the period: ${[...periodLines].join(" | ")}`);
});

test("the blueprint names each review with the ISO week-year, not the calendar year", () => {
  const source = fs.readFileSync(TEMPLATE, "utf8");
  assert.match(source, /<% tp\.date\.now\("GGGG-\[W\]WW"\) %>/, "the title must use the ISO week-year token");
  assert.doesNotMatch(
    source,
    /<% tp\.date\.now\("YYYY-\[W\]WW"\) %>/,
    "`YYYY-[W]WW` pairs a calendar year with an ISO week, which is wrong at a year boundary"
  );
});

test("the mood distribution counts every value written, not a fixed vocabulary", () => {
  // `Tagging & Properties.md` calls `mood` "text, free-form from a suggested
  // vocabulary" and the daily template suggests eighteen words. The shipped table
  // listed six of them, so four of the ten moods recorded in the owner's vault never
  // appeared in it — a statistic that misreports without ever erroring.
  const { text, tables } = runBlock("Mood Distribution", {
    now: LATER,
    current: reviewNote(NOTE),
    pages: [
      dailyNote("2026-10-05", { mood: "restless" }),
      dailyNote("2026-10-06", { mood: "reflective" }),
      dailyNote("2026-10-07", { mood: "okay" }),
      dailyNote("2026-10-08", { mood: "" }),
      dailyNote("2026-10-09", {}),
    ],
  });

  const rows = Object.fromEntries(tables[0].rows.map(([mood, days]) => [mood, days]));
  assert.equal(rows.restless, 1, `"restless" is a real mood and was dropped:\n${text}`);
  assert.equal(rows.reflective, 1, `"reflective" was dropped:\n${text}`);
  assert.equal(rows.okay, 1);
  assert.equal(Object.keys(rows).length, 3, "only values that were actually written belong in the table");
  assert.match(text, /3 day\(s\) recorded a mood, across 3 distinct value\(s\)/);
  assert.match(text, /5\/7 calendar days logged/);
});

test("a period with no moods says so rather than showing a table of zeros", () => {
  const { text, tables } = runBlock("Mood Distribution", {
    now: LATER,
    current: reviewNote(NOTE),
    pages: [dailyNote("2026-10-06", { energy: 4 })],
  });

  assert.match(text, /No moods were recorded in this period/, text);
  assert.equal(tables.length, 0, "an all-zero table implies the moods were looked for and not found");
});

test("the generated review declares the window it analysed as its period", () => {
  // The template's resolver reads an explicit period first, so the one automated
  // producer has to supply it — otherwise a script-written review is anchored by a
  // file name that is not a reliable week (see the divergence note below).
  const bundle = fs.readFileSync(
    path.join(REPO_ROOT, "06-Resources", "scripts", "weekly-ai-summary.js"),
    "utf8"
  );
  assert.match(
    bundle,
    /^period_start: \$\{reviewWindow\.startDate\}$/m,
    "the shipped bundle must declare the analysed window's start as the note's period"
  );
  assert.match(
    bundle,
    /^period_end: \$\{reviewWindow\.endDate\}$/m,
    "the shipped bundle must declare the analysed window's end as the note's period"
  );

  // Non-vacuity: these keys only matter because the template reads them.
  assert.match(fs.readFileSync(TEMPLATE, "utf8"), /page\.period_start/, "nothing reads period_start");
});

test("the weekly summary's file name is not a reliable week, which is why the period is declared", () => {
  // Measured, not asserted from memory: the script numbers its notes with
  // `Math.ceil((daysIntoYear + weekdayOfJan1 + 1) / 7)`, which is not an ISO week.
  // Extracted from the shipped bundle rather than retyped, the way
  // `homepulse-habit-sync` reads its prelude.
  const bundle = fs.readFileSync(
    path.join(REPO_ROOT, "06-Resources", "scripts", "weekly-ai-summary.js"),
    "utf8"
  );
  const start = bundle.indexOf("function getWeekNumber");
  assert.ok(start > 0, "the shipped bundle no longer defines getWeekNumber");
  const source = bundle.slice(start, bundle.indexOf("\n}", start) + 2);
  const getWeekNumber = new Function(`${source}\nreturn getWeekNumber;`)();

  const disagreeing = [];
  for (const day of ["2026-09-06", "2026-11-01", "2026-03-01"]) {
    const date = localDate(day);
    const iso = isoWeekParts(date);
    if (getWeekNumber(date) !== iso.week) disagreeing.push(`${day}: name says W${getWeekNumber(date)}, ISO is W${iso.week}`);
  }
  assert.ok(
    disagreeing.length > 0,
    "if the script has become ISO-correct, delete this case and the period declaration may become optional"
  );
});

test("running the shipped blocks changes nothing on disk", () => {
  const before = fs.readFileSync(TEMPLATE, "utf8");
  for (const prefix of STATISTICS_SECTIONS) {
    runBlock(prefix, { now: LATER, current: reviewNote(NOTE), pages: [dailyNote("2026-10-06", { energy: 4 })] });
  }
  assert.equal(fs.readFileSync(TEMPLATE, "utf8"), before);
});
