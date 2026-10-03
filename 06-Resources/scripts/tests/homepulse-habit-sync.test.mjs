// #37 regression: a today-habit toggle must update the dated daily note only.
// 99-Templates/Daily.md holds *defaults*; writing completion into it makes every
// future day start pre-checked. The habit-sync helper is extracted from the
// bundle and exercised against a synthetic vault, so this asserts behaviour
// rather than the presence of a string.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const BUNDLE = ".obsidian/plugins/homepulse/main.js";
const TEMPLATE = "99-Templates/Daily.md";

function loadHabitSync() {
  const source = readFileSync(BUNDLE, "utf8");
  const start = source.indexOf("function getLocalDateStr");
  const end = source.indexOf("var mt=Object.defineProperty");
  assert.ok(start !== -1 && end > start, "could not locate the owned prelude in the bundle");
  const prelude = source.slice(start, end);
  return new Function(`${prelude}\nreturn { getLocalDateStr, syncHabitsToFiles };`)();
}

function localDateStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function fakeVault(files) {
  const store = new Map(Object.entries(files));
  const vault = {
    getAbstractFileByPath: (path) => (store.has(path) ? { path } : null),
    read: async (file) => store.get(file.path),
    modify: async (file, content) => void store.set(file.path, content),
    getMarkdownFiles: () =>
      [...store.keys()]
        .filter((p) => p.endsWith(".md"))
        .map((p) => ({ path: p, name: p.split("/").pop() })),
  };
  return { vault, store };
}

const HABIT_LINE_UNCHECKED = "## 🔁 Habits\n\n- [ ] water\n- [ ] move\n";
const HABIT_LINE_CHECKED = "## 🔁 Habits\n\n- [x] water\n- [ ] move\n";

test("checking a habit writes the dated note, never the template", async () => {
  const { syncHabitsToFiles } = loadHabitSync();
  const today = localDateStr();
  const [y, m, d] = today.split("-");
  const todayPath = `01-Daily/${y}-${m}/${today}.md`;
  const futurePath = `01-Daily/${y}-${m}/2099-01-01.md`;

  const { vault, store } = fakeVault({
    [TEMPLATE]: HABIT_LINE_UNCHECKED,
    [todayPath]: HABIT_LINE_UNCHECKED,
    [futurePath]: HABIT_LINE_UNCHECKED,
  });

  await syncHabitsToFiles("water", true, { vault });

  assert.equal(store.get(todayPath), HABIT_LINE_CHECKED, "today's note must record the completion");
  assert.equal(
    store.get(futurePath),
    HABIT_LINE_UNCHECKED,
    "other days' notes must not change"
  );
  assert.equal(
    store.get(TEMPLATE),
    HABIT_LINE_UNCHECKED,
    "the daily template must keep unchecked defaults"
  );
});

test("unchecking a habit also leaves the template untouched", async () => {
  const { syncHabitsToFiles } = loadHabitSync();
  const today = localDateStr();
  const [y, m] = today.split("-");
  const todayPath = `01-Daily/${y}-${m}/${today}.md`;

  const { vault, store } = fakeVault({
    [TEMPLATE]: HABIT_LINE_UNCHECKED,
    [todayPath]: HABIT_LINE_CHECKED,
  });

  await syncHabitsToFiles("water", false, { vault });

  assert.equal(store.get(todayPath), HABIT_LINE_UNCHECKED, "today's note must clear the habit");
  assert.equal(store.get(TEMPLATE), HABIT_LINE_UNCHECKED, "template defaults stay unchecked");
});

test("a newly created daily note starts with unchecked habits", () => {
  // The template is the seed for every new day, so it must never carry a
  // completion forward. This asserts the invariant the bug violated.
  const template = readFileSync(TEMPLATE, "utf8");
  const habits = template.split(/^##\s+.*Habits.*$/m)[1] ?? "";
  const checked = habits.split("\n").filter((line) => /^- \[x\]/i.test(line.trim()));
  assert.deepEqual(checked, [], `daily template must ship habits unchecked, found: ${checked}`);
});