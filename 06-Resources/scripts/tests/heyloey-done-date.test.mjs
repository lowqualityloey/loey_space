/*
 * `done --date` exists so a milestone that happened before midnight is filed in the day it
 * happened, instead of landing in whatever note the clock says when the entry is finally
 * written. The failure mode that matters is silent: the run succeeds, reports success, and
 * files the entry under the wrong day. So these tests drive the BUNDLE (the interface a user
 * actually gets) and then read the notes back, rather than trusting stdout.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aucklandToday } from "./helpers/auckland-clock.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const BUNDLE = path.join(REPO_ROOT, "06-Resources/scripts/heyloey.js");

function shiftDay(day, delta) {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + delta);
  return at.toISOString().slice(0, 10);
}

function dailyRel(day) {
  return path.join("01-Daily", day.slice(0, 7), `${day}.md`);
}

function makeVault(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "heyloey-date-"));
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
    ["# Session Handoff", "", "### Latest Updates", "", "- [x] **[2026-01-01 09:00]** earlier work", ""].join("\n")
  );
  return root;
}

function writeDaily(root, day) {
  const target = path.join(root, dailyRel(day));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, ["---", "type: daily", "---", "# Fixture day", "", "## 📝 Daily Log", ""].join("\n"));
  return target;
}

function run(args, cwd = REPO_ROOT) {
  return spawnSync(process.execPath, [BUNDLE, ...args], { cwd, encoding: "utf8" });
}

test("done --date files the milestone in the named day, not today", (t) => {
  const root = makeVault(t);
  const today = aucklandToday();
  const earlier = shiftDay(today, -1);
  writeDaily(root, today);
  const earlierNote = writeDaily(root, earlier);
  const todayBefore = fs.readFileSync(path.join(root, dailyRel(today)), "utf8");

  const result = run(["--root", root, "done", "--date", earlier, "--time", "23:50", "back-dated vault milestone"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RESULT done logged/);

  const filed = fs.readFileSync(earlierNote, "utf8");
  assert.ok(filed.includes("back-dated vault milestone"), "the entry lands in the named day");
  assert.match(filed, /11:50&nbsp;PM/);
  assert.equal(
    fs.readFileSync(path.join(root, dailyRel(today)), "utf8"),
    todayBefore,
    "today's note must be untouched"
  );

  const handoff = fs.readFileSync(path.join(root, "handoff.md"), "utf8");
  assert.ok(handoff.includes(`**[${earlier} 23:50]**`), "the handoff stamp names the milestone day");
});

test("done --date does not back-date the handoff updated field", (t) => {
  const root = makeVault(t);
  const today = aucklandToday();
  const earlier = shiftDay(today, -4);
  writeDaily(root, today);
  writeDaily(root, earlier);
  const handoffPath = path.join(root, "handoff.md");
  fs.writeFileSync(handoffPath, ["---", "type: handoff", "updated: 2020-01-01", "---", "# Handoff", "", "### Latest Updates", ""].join("\n"));

  const result = run(["--root", root, "done", "--date", earlier, "--time", "22:05", "updated field probe"]);
  assert.equal(result.status, 0, result.stderr);
  const handoff = fs.readFileSync(handoffPath, "utf8");
  assert.ok(handoff.includes("updated: 2020-01-01"), "an untouched updated field is left alone");
  assert.ok(
    !handoff.includes(`updated: ${earlier}`),
    "the milestone day must never become the file's updated stamp"
  );
});

test("done --date refuses an absent day and writes neither record", (t) => {
  const root = makeVault(t);
  const today = aucklandToday();
  const missing = shiftDay(today, -6);
  writeDaily(root, today);
  const before = fs.readFileSync(path.join(root, dailyRel(today)), "utf8");
  const handoffBefore = fs.readFileSync(path.join(root, "handoff.md"), "utf8");

  const result = run(["--root", root, "done", "--date", missing, "absent day milestone"]);
  assert.equal(result.status, 4, "an absent record is a refusal, not a generic failure");
  assert.match(result.stderr, /daily note is absent/);
  assert.match(result.stderr, new RegExp(missing));
  assert.equal(fs.readFileSync(path.join(root, dailyRel(today)), "utf8"), before);
  assert.equal(fs.readFileSync(path.join(root, "handoff.md"), "utf8"), handoffBefore);
});

test("the flags are validated before anything is written", (t) => {
  const root = makeVault(t);
  const today = aucklandToday();
  writeDaily(root, today);
  const before = fs.readFileSync(path.join(root, dailyRel(today)), "utf8");

  const impossible = run(["--root", root, "done", "--date", "2026-02-31", "impossible day"]);
  assert.equal(impossible.status, 2);
  assert.match(impossible.stderr, /must be a real YYYY-MM-DD day/);

  const badTime = run(["--root", root, "done", "--date", today, "--time", "24:30", "bad time"]);
  assert.equal(badTime.status, 2);
  assert.match(badTime.stderr, /--time requires 24-hour HH:MM/);

  const wrongCommand = run(["--root", root, "learn", "--date", today, "Title", "pattern"]);
  assert.equal(wrongCommand.status, 2);
  assert.match(wrongCommand.stderr, /--date is only valid with done or migrate-log/);

  assert.equal(
    fs.readFileSync(path.join(root, dailyRel(today)), "utf8"),
    before,
    "a rejected flag combination writes nothing"
  );
});

test("--time is refused without done, and --dry-run previews the back-dated note", (t) => {
  const root = makeVault(t);
  const today = aucklandToday();
  const earlier = shiftDay(today, -2);
  writeDaily(root, today);
  const earlierNote = writeDaily(root, earlier);
  const before = fs.readFileSync(earlierNote, "utf8");

  const misused = run(["--root", root, "migrate-log", "--time", "10:00"]);
  assert.equal(misused.status, 2);
  assert.match(misused.stderr, /--time is only valid with done/);

  const preview = run(["--root", root, "--dry-run", "done", "--date", earlier, "--time", "23:50", "dry back-dated"]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /back-dated/);
  assert.ok(preview.stdout.includes(earlier), "the preview names the note it would write");
  assert.equal(fs.readFileSync(earlierNote, "utf8"), before, "a preview changes no bytes");
});

test("done --date without --time still records a real clock time", (t) => {
  const root = makeVault(t);
  const today = aucklandToday();
  const earlier = shiftDay(today, -3);
  writeDaily(root, today);
  const earlierNote = writeDaily(root, earlier);

  const result = run(["--root", root, "done", "--date", earlier, "day without a time"]);
  assert.equal(result.status, 0, result.stderr);
  const filed = fs.readFileSync(earlierNote, "utf8");
  assert.ok(filed.includes("day without a time"));
  assert.match(filed, /[01]?\d:[0-5]\d&nbsp;[AP]M/, "an unspecified time still gets a clock stamp");
});
