// #118 guard — the setup contract must stay true and stay findable.
//
// The defect: a fresh clone registered **none** of the named QuickAdd actions (0 choices,
// 0 macros, and no saved Templater configuration), while the README advertised Create Daily
// Note, Quick Capture, Triage Sweep, Weekly Review and an AI action. Runtime plugin state
// is git-ignored by design, so the repository cannot ship the choices — but it can and must
// ship their definitions, the values that already work, and a check that the two agree.
//
// Two ways this rots, both silent: someone edits `.obsidian/daily-notes.json` and the
// documented monthly path becomes wrong, or a script is renamed and the guide keeps
// pointing at the old path. Neither shows up in any other test.
//
// It also pins the dangling reference the audit found: `.obsidian/hotkeys.json` binds
// Mod+Shift+A to a QuickAdd *choice ID*. QuickAdd resolves a hotkey by ID, not by name, so
// a setup procedure that invents a different ID leaves the documented shortcut dead.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const GUIDE = "06-Resources/Guides/Setup & Configuration.md";
const DAILY_NOTES = ".obsidian/daily-notes.json";
const TEMPLATES = ".obsidian/templates.json";
const HOTKEYS = ".obsidian/hotkeys.json";

const guide = readFileSync(GUIDE, "utf8");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

test("tracked core config puts daily notes on the monthly path with the daily template", () => {
  const daily = readJson(DAILY_NOTES);
  assert.equal(daily.folder, "01-Daily", "daily notes folder changed; update the setup guide too");
  assert.equal(daily.format, "YYYY-MM/YYYY-MM-DD", "the documented monthly daily path must be what ships");
  assert.equal(daily.template, "99-Templates/Daily", "the daily template path must match the tracked template");

  assert.equal(readJson(TEMPLATES).folder, "99-Templates", "Templater and core must agree on the template folder");
  assert.equal(
    readJson(".obsidian/app.json").attachmentFolderPath,
    "99-Attachments",
    "attachment folder is part of the placement policy the guide documents"
  );
});

test("every script the setup guide names exists on disk", () => {
  const referenced = [...guide.matchAll(/`(06-Resources\/scripts\/[A-Za-z0-9._-]+)`/g)].map((m) => m[1]);
  assert.ok(referenced.length >= 4, `expected the guide to name the required scripts, found ${referenced.length}`);
  for (const script of new Set(referenced)) {
    assert.ok(existsSync(script), `${GUIDE} names ${script}, which does not exist — a renamed script makes setup fail silently`);
  }
});

test("the setup guide registers all five required actions", () => {
  for (const action of ["Create Daily Note", "Quick Capture", "Triage Sweep", "Weekly Review", "AI Enrich Note"]) {
    assert.ok(guide.includes(action), `the guide must define the "${action}" action a fresh clone is promised`);
  }
});

test("the tracked hotkey resolves to a choice ID the setup guide declares", () => {
  const hotkeys = readJson(HOTKEYS);
  const bound = Object.keys(hotkeys).filter((key) => key.startsWith("quickadd:choice:"));
  assert.ok(bound.length > 0, "the vault ships a QuickAdd hotkey; if that changed, update this guard");

  for (const key of bound) {
    const choiceId = key.slice("quickadd:choice:".length);
    assert.ok(
      guide.includes(choiceId),
      `hotkeys.json binds a shortcut to QuickAdd choice ${choiceId}, but the setup guide never ` +
        `mentions that ID. QuickAdd resolves hotkeys by ID, not by name, so recreating the choice ` +
        `under a new ID leaves the documented shortcut dangling — the exact state a fresh clone is in.`
    );
  }
});

test("no runtime plugin state is tracked (the setup guide cannot leak configuration)", () => {
  const tracked = execFileSync("git", ["ls-files", "--", ".obsidian/plugins/*/data.json"], {
    encoding: "utf8",
  }).trim();
  assert.equal(
    tracked,
    "",
    `runtime plugin data.json must never be tracked — it holds per-machine settings and, for some ` +
      `plugins, credentials. Tracked: ${tracked}`
  );
});
