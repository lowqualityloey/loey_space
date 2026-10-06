// Issue #58: the weekly extractor invented missing vitals and read almost no
// structure out of a real note.
//
// It was a private function inside `weekly-ai-summary.ts`, so the tests here
// import the shipped module rather than a retyped copy, following the pattern
// #53 and #62 established. Two measured defects, reproduced against the owner's
// real daily notes on 2026-10-06 and 2026-09-13:
//
//   1. **Nothing was extracted but the date.** The extractor advanced its
//      "current section" only on `## ` headings, and this vault's sections are
//      `### ` — `### ✅ Tasks`, `### 🔁 Habits`, `### Wins`, `### Blockers`,
//      `### Reflection`. Measured on both real notes: `completedTasks`,
//      `unfinishedTasks`, `completedHabits`, `wins` and `blockers` were **all
//      zero** and `taskCompletionRate` was 0. The summary was being fed dates
//      and vitals and nothing else.
//   2. **A blank vital was read as the next key's name.** `mood: ` (blank, the
//      template default) was matched by `/^mood:\s*(.*)$/m`, and `\s` matches
//      newlines, so the capture ran onto the following line and `mood` parsed as
//      the literal string `"energy:"`. Absent readings were then replaced by
//      `parseInt(energy) || 3` and `parseFloat(sleepHours) || 7`.
//
// Fixtures are synthetic and template-shaped. The layout they imitate is the
// vault's own — `### ✅ Tasks` above `#### 🎯 In Progress from Projects`, with
// `### Wins` / `### Blockers` / `### Reflection` sitting under
// `## 🌇 End of the Day...` — because heading *levels* are the subject here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractDailyData,
  frontmatterValue,
  summarizeWeek,
  describeWeekCoverage,
} from "../src/lib/weekly-extract.ts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");

/** A template-shaped daily note, with vitals as supplied. */
function note({ mood = "", energy = "", sleep = "", body = "" } = {}) {
  return `---
created: 2026-10-06
updated: 2026-10-06
type: daily
area: personal
mood: ${mood}
energy: ${energy}
sleep_hours: ${sleep}
tags:
  - type/daily
  - area/personal
---

# Tuesday, October 6, 2026

> [!INFO] 💡 Daily Properties Reference
> | Property | Allowed Options |
> | :--- | :--- |
> | **energy** | Scale 1 to 5 |

### 🎯 Today's Focus

- Ship the extractor fix
- Review the boundary guard

### ✅ Tasks

- [x] Fix the window selector
- [ ] Write the reconcile record
- [...]

#### 🎯 In Progress from Projects

- [x] Hand off the kanban sync

### 🔁 Habits

- [x] water
- [x] move
- [ ] read

## 📝 Daily Log

- [x] this is not a task, it is a log entry

## 🌇 End of the Day...

### Wins

- The window fix held under a DST change

### Blockers

- No Obsidian in CI to run the action

### Reflection

- The second defect was the one worth finding

### 💡 Ideas & Fleeting Notes

- Move the dashboard out of the reviews folder

## 🤖 AI Daily Summary

### 📖 Daily Debrief

- Wednesday was productive

### 🎯 Tomorrow's Move

- Finish the extractor
${body}`;
}

test("blank vitals stay null, and are never read as the next key's name", () => {
  const entry = extractDailyData(note(), "2026-10-06");
  // The measured regression: `mood` used to come back as the literal string
  // "energy:", which is the name of the key on the following line.
  assert.equal(entry.mood, null);
  assert.equal(entry.energy, null);
  assert.equal(entry.sleepHours, null);
});

test("a note with no vitals keys at all yields null, not a default", () => {
  const entry = extractDailyData(`---\ncreated: 2026-10-06\ntype: daily\n---\n\n# A day\n`, "2026-10-06");
  assert.deepEqual(
    [entry.mood, entry.energy, entry.sleepHours],
    [null, null, null],
    "absent readings must not be replaced by neutral/3/7"
  );
});

test("real vitals are read, including zero and a decimal", () => {
  const entry = extractDailyData(note({ mood: "good", energy: "4", sleep: "7.5" }), "2026-10-06");
  assert.equal(entry.mood, "good");
  assert.equal(entry.energy, 4);
  assert.equal(entry.sleepHours, 7.5);
});

test("#58 regression: energy 0 is a reading, not a missing value", () => {
  // `parseInt(energy) || 3` promoted a real 0 to 3, because 0 is falsy.
  const entry = extractDailyData(note({ energy: "0" }), "2026-10-06");
  assert.equal(entry.energy, 0);
});

test("a non-numeric reading is unknown rather than coerced", () => {
  const entry = extractDailyData(note({ energy: "high", sleep: "ages" }), "2026-10-06");
  assert.equal(entry.energy, null);
  assert.equal(entry.sleepHours, null);
});

test("the reference table's own values are not read as the day's vitals", () => {
  // The template's `> [!INFO]` block quotes the allowed energy scale; the value
  // must come from frontmatter, not from prose about frontmatter.
  const entry = extractDailyData(note(), "2026-10-06");
  assert.equal(entry.energy, null);
  assert.equal(frontmatterValue(note(), "energy"), null);
});

test("#58 regression: ### sections are classified, not just ##", () => {
  const entry = extractDailyData(note(), "2026-10-06");
  assert.deepEqual(entry.completedTasks, ["Fix the window selector", "Hand off the kanban sync"]);
  assert.deepEqual(entry.unfinishedTasks, ["Write the reconcile record"]);
  assert.deepEqual(entry.completedHabits, ["water", "move"]);
});

test("a #### section inherits the nearest ancestor that names a bucket", () => {
  const entry = extractDailyData(note(), "2026-10-06");
  // `#### 🎯 In Progress from Projects` names no bucket, so it belongs to
  // `### ✅ Tasks` above it. It also must not be classified as "focus" merely
  // for containing the word "Progress".
  assert.ok(entry.completedTasks.includes("Hand off the kanban sync"));
  assert.equal(entry.intentions.includes("Hand off the kanban sync"), false);
});

test("focus intentions are their own bucket, not tasks", () => {
  const entry = extractDailyData(note(), "2026-10-06");
  assert.deepEqual(entry.intentions, ["Ship the extractor fix", "Review the boundary guard"]);
  assert.equal(entry.completedTasks.includes("Ship the extractor fix"), false);
});

test("Wins, Blockers and Reflection are separated from their parent ## section", () => {
  const entry = extractDailyData(note(), "2026-10-06");
  assert.deepEqual(entry.wins, ["The window fix held under a DST change"]);
  assert.deepEqual(entry.blockers, ["No Obsidian in CI to run the action"]);
  assert.deepEqual(entry.reflection, ["The second defect was the one worth finding"]);
});

test("nested headings do not leak into each other", () => {
  const entry = extractDailyData(note(), "2026-10-06");
  // `## 🌇 End of the Day...` must not swallow the three sections under it, and
  // `💡 Ideas & Fleeting Notes` must not be read as a reflection.
  assert.deepEqual(entry.ideas, ["Move the dashboard out of the reviews folder"]);
  assert.equal(entry.reflection.includes("Move the dashboard out of the reviews folder"), false);
});

test("the log and the AI summary are not read as tasks, wins or reflections", () => {
  const entry = extractDailyData(note(), "2026-10-06");
  const everything = [
    ...entry.completedTasks, ...entry.unfinishedTasks, ...entry.wins,
    ...entry.blockers, ...entry.reflection, ...entry.ideas,
  ];
  for (const leaked of ["this is not a task, it is a log entry", "Wednesday was productive", "Finish the extractor"]) {
    assert.equal(everything.includes(leaked), false, `"${leaked}" must not be extracted`);
  }
});

test("an unticked habit is not a failure, and the frontmatter tag list is not an entry", () => {
  const entry = extractDailyData(note(), "2026-10-06");
  assert.equal(entry.completedHabits.includes("read"), false, "an unticked habit is unknown, not done");
  assert.equal(
    [...entry.wins, ...entry.blockers, ...entry.reflection, ...entry.ideas].includes("type/daily"),
    false,
    "the frontmatter tag list must never be read as a section entry"
  );
});

test("a fenced block under a bucket heading is not read as bullets", () => {
  const fenced = note({ body: "\n### Wins\n\n```dataviewjs\ndv.list([\"not a win\"])\n```\n\n- A real win\n" });
  const entry = extractDailyData(fenced, "2026-10-06");
  assert.deepEqual(entry.wins, ["The window fix held under a DST change", "A real win"]);
  assert.equal(entry.wins.some((w) => w.includes("not a win")), false);
});

test("a horizontal rule in the body is not mistaken for a second frontmatter block", () => {
  const withRule = note({ body: "\n---\n\n### Wins\n\n- A win after a rule\n" });
  const entry = extractDailyData(withRule, "2026-10-06");
  assert.deepEqual(entry.wins, ["The window fix held under a DST change", "A win after a rule"]);
});

test("a note with no tasks has no completion rate rather than 0%", () => {
  const entry = extractDailyData(`---\ntype: daily\n---\n\n# Nothing done\n\n### Reflection\n\n- A quiet day\n`, "2026-10-06");
  assert.equal(entry.taskCompletionRate, null);
  assert.deepEqual(entry.reflection, ["A quiet day"]);
});

test("averages exclude unknown readings and report the coverage they rest on", () => {
  const entries = [
    extractDailyData(note({ energy: "2", sleep: "6" }), "2026-10-04"),
    extractDailyData(note({ energy: "4" }), "2026-10-05"),
    extractDailyData(note(), "2026-10-06"),
  ];
  const summary = summarizeWeek(entries);

  assert.equal(summary.notes, 3);
  assert.equal(summary.energy.known, 2);
  assert.equal(summary.energy.unknown, 1);
  assert.equal(summary.energy.average, 3, "the mean of 2 and 4, with the unknown excluded");
  assert.equal(summary.energy.coverage, "2/3 note(s) declared energy");
  assert.equal(summary.sleepHours.known, 1);
  assert.equal(summary.sleepHours.average, 6);
  assert.equal(summary.moods.length, 0);
  assert.match(describeWeekCoverage(summary), /energy 2\/3 note\(s\) declared energy/);
  assert.match(describeWeekCoverage(summary), /no mood recorded/);
});

test("a week with no readings at all averages to null, not to zero", () => {
  // A note with neither vitals nor tasks: every derived number is absent, and
  // none of them may be reported as 0.
  const bare = `---\ntype: daily\n---\n\n# A day with nothing logged\n`;
  const summary = summarizeWeek([extractDailyData(bare, "2026-10-06")]);
  assert.equal(summary.energy.average, null);
  assert.equal(summary.sleepHours.average, null);
  assert.equal(summary.energy.unknown, 1);
  assert.equal(summary.energy.coverage, "0/1 note(s) declared energy");
  assert.equal(summary.tasks.completionRate, null);
  assert.equal(summary.habits.completed, 0);
});

test("the week's task and habit totals come from the notes, not from a baseline", () => {
  const summary = summarizeWeek([extractDailyData(note(), "2026-10-06")]);
  // Rates are rounded to two decimals, the same presentation as the vitals
  // averages, so a rate and a mean are read at the same precision.
  assert.deepEqual(summary.tasks, { completed: 2, unfinished: 1, completionRate: 0.67 });
  assert.equal(summary.habits.completed, 2);
  assert.deepEqual(summary.entries, { wins: 1, blockers: 1, reflection: 1 });
});

test("an unfilled template scaffold yields empty buckets, not garbage", () => {
  // This is the state most of the owner's notes are actually in, and it is the
  // case that nearly read as a bug in this change: the sections exist, hold
  // only the template's empty placeholders (`- [ ] `, `- `), and therefore
  // contribute NOTHING. Asserting it keeps a later "fix" from counting a
  // placeholder as an entry — which would invent work that was never done.
  const scaffold = `---
created: 2026-10-06
type: daily
mood: 
energy: 
sleep_hours: 
---

# A day

### ✅ Tasks

- [ ] 

### 🔁 Habits

- [ ] water
- [ ] read

### Wins

- 

### Blockers

- 

### Reflection

- 
`;
  const entry = extractDailyData(scaffold, "2026-10-06");
  assert.equal(entry.energy, null);
  assert.equal(entry.mood, null);
  assert.deepEqual(
    [
      entry.completedTasks, entry.unfinishedTasks, entry.completedHabits,
      entry.wins, entry.blockers, entry.reflection, entry.intentions,
    ],
    [[], [], [], [], [], [], []],
    "empty placeholders are not entries"
  );
  assert.equal(entry.taskCompletionRate, null);
});

test("the shipped entry point delegates extraction to this module", () => {
  // The module passing its own tests says nothing about what ships. This is the
  // half that would rot: the private copy is asserted GONE, so restoring it
  // fails here rather than silently reverting to a summary with no tasks.
  const source = readFileSync(
    path.join(REPO_ROOT, "06-Resources/scripts/src/weekly-ai-summary.ts"),
    "utf8"
  );
  assert.match(source, /from '\.\/lib\/weekly-extract'/, "the entry must import the extractor");
  assert.match(source, /summarizeWeek\(/, "the entry must summarise the week");
  assert.match(source, /describeWeekCoverage\(/, "the entry must disclose vitals coverage");
  assert.equal(
    source.includes("function extractDailyData("),
    false,
    "the private extractor must not come back — a second copy would drift from this one"
  );
  assert.equal(/\|\|\s*3\b/.test(source), false, "no energy default may be reintroduced");
  assert.equal(/\|\|\s*7\b/.test(source), false, "no sleep default may be reintroduced");
});
