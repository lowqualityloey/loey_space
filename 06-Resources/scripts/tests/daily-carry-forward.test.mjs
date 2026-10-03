// #47: daily task carry-forward must preserve hierarchy and in-progress work.
//
// The carry block in 99-Templates/Daily.md matched only `- [ ]`. Two losses
// followed: an in-progress `[/]` task vanished from every dashboard overnight,
// and `replace(/^\s*-.../)` stripped indentation, so nested acceptance criteria
// arrived as independent top-level commitments. Completed children were dropped
// too, so a partly-done parent looked untouched.
//
// This test extracts the real Templater block from the template and executes it
// against synthetic notes, so it tracks the template instead of duplicating it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const TEMPLATE = "99-Templates/Daily.md";

/** Pull the Templater code block that builds the Tasks list out of the Daily template. */
function carryBlock() {
  const src = readFileSync(TEMPLATE, "utf8");
  const start = src.indexOf("<%*");
  assert.notStrictEqual(start, -1, "Daily template must contain a Templater block");
  const bodyStart = src.indexOf("\n", start) + 1;
  const end = src.indexOf("%>", bodyStart);
  assert.notStrictEqual(end, -1, "Templater block must be terminated");
  // Slice to the start of the terminator line: it is written `-%>`, and cutting
  // at the `%>` would leave a dangling `-` before the appended return.
  const terminatorLine = src.lastIndexOf("\n", end) + 1;
  return src.slice(bodyStart, terminatorLine);
}

const PREV_DATE = "2026-10-03";
const TODAY = "2026-10-04";

/** Run the template's carry block against a synthetic previous note. */
async function runCarry(prevContent) {
  const files = new Map();
  files.set(`01-Daily/2026-10/${PREV_DATE}.md`, { path: `01-Daily/2026-10/${PREV_DATE}.md`, name: `${PREV_DATE}.md` });

  const block = carryBlock();
  // The block uses top-level await, so it needs an async function body.
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const factory = new AsyncFunction("app", "tp", "window", "tR", block + "\nreturn tR;");

  const tR = "";
  const app = {
    vault: {
      getMarkdownFiles: () => [...files.values()],
      read: async (f) => files.get(f.path).content ?? prevContent,
      modify: async (f, c) => { files.get(f.path).content = c; }
    }
  };
  const tp = {
    file: { title: TODAY },
    date: { now: () => TODAY }
  };
  const win = {
    moment: (input, fmt) => {
      const iso = typeof input === "string" ? input : String(input);
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(iso);
      return {
        isValid: () => valid,
        format: (f) => (f === "YYYY-MM-DD" ? iso : iso)
      };
    }
  };

  const out = await factory(app, tp, win, tR);
  return {
    carried: out.split("\n").filter(l => l.trim().length),
    prevAfter: files.get(`01-Daily/2026-10/${PREV_DATE}.md`).content
  };
}

const HIERARCHY_NOTE = `---
type: daily
---

### ✅ Tasks
- [ ] Ship the release
    - [x] write the changelog
    - [ ] tag the version
- [ ] Untouched top-level task

### 🔁 Habits
- [ ] water
- [ ] move
`;

test("carry-forward: nested criteria keep their hierarchy and completed context", async () => {
  const { carried } = await runCarry(HIERARCHY_NOTE);

  assert.ok(carried.some(l => /^\s*- \[ \] Ship the release$/.test(l)),
    "the parent task carries forward");
  assert.ok(carried.some(l => /^\s+- \[x\] write the changelog$/.test(l)),
    "a completed child is retained as context, not dropped");
  assert.ok(carried.some(l => /^\s+- \[ \] tag the version$/.test(l)),
    "the unchecked child keeps its indentation, so it is not a new top-level task");
});

test("carry-forward: an in-progress task survives the night", async () => {
  const note = `---
type: daily
---

### ✅ Tasks
- [/] Half-finished refactor
- [ ] Not started
- [x] Already done
- [>] Already forwarded
`;
  const { carried } = await runCarry(note);

  assert.ok(carried.some(l => /Half-finished refactor/.test(l)),
    "an in-progress [/] task must carry forward");
  assert.ok(!carried.some(l => /Already done/.test(l)), "a completed task stays done");
  assert.ok(!carried.some(l => /Already forwarded/.test(l)), "an already-forwarded task is not re-carried");
});

test("carry-forward: habits and placeholders are excluded", async () => {
  const { carried } = await runCarry(HIERARCHY_NOTE);
  assert.ok(!carried.some(l => /water|move/.test(l)), "habits must never be carried as tasks");
});

test("carry-forward: the previous note marks every carried task as forwarded", async () => {
  const note = `---
type: daily
---

### ✅ Tasks
- [ ] One
- [/] Two
- [ ] Three
`;
  const { prevAfter } = await runCarry(note);

  const taskLines = prevAfter.split("\n").filter(l => /^\s*- \[[ /x>]\]/.test(l));
  assert.strictEqual(taskLines.length, 3, "no task is removed from the previous note");
  assert.ok(taskLines.every(l => /\[>\]/.test(l)),
    "unchecked AND in-progress tasks are both marked [>] so none stays open in two notes");
});