/*
 * A milestone summary is arbitrary text from an external coding agent, and this vault renders in
 * Obsidian: one raw `<tag>` in a table row is an unclosed HTML element that swallows every
 * heading below it, which is exactly how the 2026-10-24 daily note broke. So `done` must land
 * tag-like input as entities in every surface it writes — the agent row via the cell codec, and
 * the handoff / personal bullets via the inline form — while round-tripping through its own
 * dedupe checks, and leaving pipes and deliberate `<br>` exactly as they were.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const BUNDLE = path.join(REPO_ROOT, "06-Resources/scripts/heyloey.js");

function todayStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dailyRel(date = todayStr()) {
  return path.join("01-Daily", date.slice(0, 7), `${date}.md`);
}

/** A vault whose daily note carries the one agent container and whose handoff accepts updates. */
function makeFullVault(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "heyloey-escaping-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "99-Templates"));
  fs.mkdirSync(path.join(root, ".obsidian"));
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# fixture vault\n");
  fs.writeFileSync(
    path.join(root, ".obsidian/daily-notes.json"),
    JSON.stringify({ folder: "01-Daily", format: "YYYY-MM/YYYY-MM-DD", template: "99-Templates/Daily" })
  );
  fs.writeFileSync(
    path.join(root, "handoff.md"),
    [
      "# Session Handoff",
      "",
      "## 🎯 Current Main Objectives",
      "",
      "### Latest Updates",
      "",
      "- [x] **[2026-01-01 09:00]** <what changed, and what it means for the next move>",
      "",
    ].join("\n")
  );
  const date = todayStr();
  const dailyPath = path.join(root, dailyRel());
  fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
  fs.writeFileSync(
    dailyPath,
    [
      "---",
      `created: ${date}`,
      `updated: ${date}`,
      "type: daily",
      "area: personal",
      "---",
      "# Fixture day",
      "",
      "### 🎯 Today's Focus",
      "",
      "### ✅ Tasks",
      "",
      "### 🔁 Habits",
      "- [ ] water",
      "",
      "## 📝 Daily Log",
      "",
      "### 🧍 Personal Log",
      "- ",
      "",
      "### 🤖 Agent Milestones",
      "",
      "> [!NOTE]- 🤖 Show entries (0)",
      "> | Time | Scope | Milestone |",
      "> | :--- | :--- | :--- |",
      "",
    ].join("\n")
  );
  return root;
}

function run(args) {
  return spawnSync(process.execPath, [BUNDLE, ...args], { encoding: "utf8" });
}

function readVault(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function agentRows(content) {
  return content.split("\n").filter((line) => /^> \| \d/.test(line));
}

test("an agent milestone lands tag-like input as entities in the row and the handoff", (t) => {
  const root = makeFullVault(t);
  const summary = "deal-radar: clickable cards (anchor to a.aspx?id=<tradeMeId> with a null-guard)";
  const result = run(["--root", root, "done", summary]);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);

  const daily = readVault(root, dailyRel());
  assert.ok(daily.includes("a.aspx?id=&lt;tradeMeId>"), `row must escape the tag:\n${daily}`);
  assert.ok(!daily.includes("a.aspx?id=<tradeMeId>"), "the raw tag must not survive in the daily note");

  const handoff = readVault(root, "handoff.md");
  assert.ok(handoff.includes("a.aspx?id=&lt;tradeMeId>"), `handoff must escape the tag:\n${handoff}`);
  assert.ok(!handoff.includes("a.aspx?id=<tradeMeId>"), "the raw tag must not survive in the handoff");
});

test("a rerun of the same summary dedupes against its own escaped row", (t) => {
  const root = makeFullVault(t);
  const summary = "shipped the <trademeid> null-guard";
  assert.equal(run(["--root", root, "done", summary]).status, 0);
  const rerun = run(["--root", root, "done", summary]);
  assert.equal(rerun.status, 0, `rerun must succeed: ${rerun.stderr}`);
  assert.match(rerun.stdout, /already-recorded|Milestone already recorded/);
  const daily = readVault(root, dailyRel());
  assert.equal(agentRows(daily).length, 1, `a rerun must not add a second row:\n${daily}`);
});

test("a pre-fix row holding a raw tag still dedupes (no migration duplicates)", (t) => {
  const root = makeFullVault(t);
  const dailyPath = path.join(root, dailyRel());
  const summary = "legacy row with a raw <old-tag> from the old writer";
  fs.writeFileSync(
    dailyPath,
    readVault(root, dailyRel()).replace(
      "> | :--- | :--- | :--- |",
      "> | :--- | :--- | :--- |\n> | 09:00&nbsp;AM |  | legacy row with a raw <old-tag> from the old writer |"
    )
  );
  const result = run(["--root", root, "done", summary]);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /already-recorded|Milestone already recorded/);
  assert.equal(agentRows(readVault(root, dailyRel())).length, 1);
});

test("a personal entry escapes tags in its plain bullet", (t) => {
  const root = makeFullVault(t);
  const result = run(["--root", root, "done", "--personal", "reading the <b> semantics doc"]);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  const daily = readVault(root, dailyRel());
  assert.ok(daily.includes("reading the &lt;b> semantics doc"), `bullet must escape:\n${daily}`);
  assert.ok(!daily.includes("reading the <b>"), "the raw tag must not survive in the personal log");
});

test("pipes keep their long-standing escaped form and <br> stays deliberate", (t) => {
  const root = makeFullVault(t);
  const result = run(["--root", root, "done", "validator VALID|RECORDS=15 with a <br> break"]);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  const daily = readVault(root, dailyRel());
  assert.ok(daily.includes("VALID\\|RECORDS=15"), `pipes must stay escaped:\n${daily}`);
  assert.ok(daily.includes("a <br> break"), "a deliberate <br> must not be entity-escaped");
});
