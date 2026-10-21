/*
 * R23-1: the two milestone writes are separate renames, so a run can end with one half recorded.
 *
 * The canonical contract answers two questions a caller always has after a failure: WHICH record
 * changed, and what must a retry do. This suite pins both:
 *   - a failed second write exits 5 (`partial`) and says so in a RESULT receipt, instead of
 *     exiting 1 with no receipt and leaving the caller to guess;
 *   - a retry against a valid partial state completes only the missing half, never duplicating the
 *     half that already landed under an earlier timestamp.
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

/** A vault whose daily note and handoff both carry the headings `done` writes into. */
function makeVault(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "heyloey-partial-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(root, "99-Templates"), { recursive: true });
  fs.mkdirSync(path.join(root, ".obsidian"), { recursive: true });
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# fixture vault\n");
  fs.writeFileSync(
    path.join(root, ".obsidian/daily-notes.json"),
    JSON.stringify({ folder: "01-Daily", format: "YYYY-MM/YYYY-MM-DD" })
  );
  fs.writeFileSync(
    path.join(root, "handoff.md"),
    ["# Session Handoff", "", "### Latest Updates", "", "- [x] **[2026-01-01 09:00]** baseline", ""].join("\n")
  );

  const dailyPath = path.join(root, dailyRel());
  fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
  fs.writeFileSync(
    dailyPath,
    [
      "---",
      "type: daily",
      "---",
      "# Fixture day",
      "",
      "## 📝 Daily Log",
      "",
      "### 🤖 Agent Milestones",
      "",
      "| Time | Scope | Milestone |",
      "| :--- | :--- | :--- |",
      "| 09:00&nbsp;AM |  | baseline |",
      "",
      "---",
      "",
    ].join("\n")
  );
  return root;
}

/** Run the bundle, optionally with a preload that injects a filesystem fault. */
function run(root, args, { env = {} } = {}) {
  return spawnSync(process.execPath, [BUNDLE, "--root", root, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

test("a failed handoff write reports `partial`, exit 5, and names the record that changed", (t) => {
  const root = makeVault(t);
  const preload = path.join(root, "inject-eio.cjs");
  // Fault only the handoff rename: the daily write is the one that must be seen to have landed.
  fs.writeFileSync(
    preload,
    [
      "const fs = require('fs');",
      "const rename = fs.renameSync;",
      "fs.renameSync = function (from, to) {",
      "  if (String(to).endsWith('handoff.md')) {",
      "    const error = new Error('EIO: injected handoff rename failure');",
      "    error.code = 'EIO';",
      "    throw error;",
      "  }",
      "  return rename.apply(fs, arguments);",
      "};",
      "",
    ].join("\n")
  );

  // NODE_OPTIONS, not `--require`: the writer re-executes itself under flock, and only the
  // environment survives that re-exec, so the injection must travel this way.
  const result = run(root, ["done", "Ship the parser fix"], {
    env: { NODE_OPTIONS: `--require ${preload}` },
  });

  assert.equal(result.status, 5, `a partial write is exit 5, got ${result.status}: ${result.stderr}`);
  assert.match(result.stdout, /RESULT done partial /, "the receipt must name the partial outcome");
  assert.match(result.stdout, /daily=written/, "the receipt must say the daily entry landed");
  assert.match(result.stdout, /handoff=failed/, "the receipt must say the handoff did not");
  assert.match(result.stderr, /partial/);

  assert.equal(countOf(fs.readFileSync(path.join(root, dailyRel()), "utf8"), "Ship the parser fix"), 1);
  assert.equal(
    countOf(fs.readFileSync(path.join(root, "handoff.md"), "utf8"), "Ship the parser fix"),
    0,
    "the handoff must be untouched by a failed write"
  );
});

test("a retry from a valid partial state completes the missing half without duplicating the other", (t) => {
  const root = makeVault(t);
  const summary = "Complete the reconciliation sweep";
  // The exact state a partial run leaves: the daily entry landed at 09:00, the handoff never did.
  fs.writeFileSync(
    path.join(root, dailyRel()),
    [
      "---",
      "type: daily",
      "---",
      "# Fixture day",
      "",
      "## 📝 Daily Log",
      "",
      "### 🤖 Agent Milestones",
      "",
      "| Time | Scope | Milestone |",
      "| :--- | :--- | :--- |",
      `| 09:00&nbsp;AM |  | ${summary} |`,
      "",
      "---",
      "",
    ].join("\n")
  );

  const result = run(root, ["done", summary]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RESULT done logged /);
  assert.match(result.stdout, /daily=already-recorded/, "the recorded half must not be written again");
  assert.match(result.stdout, /handoff=written/);

  const daily = fs.readFileSync(path.join(root, dailyRel()), "utf8");
  assert.equal(countOf(daily, summary), 1, "a retry must not duplicate the earlier daily entry");
  assert.equal(countOf(fs.readFileSync(path.join(root, "handoff.md"), "utf8"), summary), 1);
});

test("a milestone already in both records is a byte-for-byte no-op", (t) => {
  const root = makeVault(t);
  const summary = "Already everywhere";
  fs.writeFileSync(
    path.join(root, dailyRel()),
    [
      "---",
      "type: daily",
      "---",
      "# Fixture day",
      "",
      "## 📝 Daily Log",
      "",
      "### 🤖 Agent Milestones",
      "",
      "| Time | Scope | Milestone |",
      "| :--- | :--- | :--- |",
      `| 08:15&nbsp;AM |  | ${summary} |`,
      "",
      "---",
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "handoff.md"),
    ["# Session Handoff", "", "### Latest Updates", "", `- [x] **[2026-01-01 08:15]** ${summary}`, ""].join("\n")
  );
  const beforeDaily = fs.readFileSync(path.join(root, dailyRel()));
  const beforeHandoff = fs.readFileSync(path.join(root, "handoff.md"));

  const result = run(root, ["done", summary]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RESULT done already-recorded /);
  assert.deepEqual(fs.readFileSync(path.join(root, dailyRel())), beforeDaily);
  assert.deepEqual(fs.readFileSync(path.join(root, "handoff.md")), beforeHandoff);
});

test("a required-record refusal is `refused` (exit 4) and carries a receipt", (t) => {
  const root = makeVault(t);
  fs.rmSync(path.join(root, "handoff.md"));

  const result = run(root, ["done", "Nothing to write to"]);
  assert.equal(result.status, 4, "refused must be distinguishable from a write failure");
  assert.match(result.stdout, /RESULT done refused /);
  assert.match(result.stdout, /handoff=missing/);
});
