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
const APP = ".obsidian/app.json";
const CONCEPT_TEMPLATE = "99-Templates/Concept.md";
const DAILY_NOTES = ".obsidian/daily-notes.json";
const TEMPLATES = ".obsidian/templates.json";
const HOTKEYS = ".obsidian/hotkeys.json";

const guide = readFileSync(GUIDE, "utf8");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

// #124 — the placement policy is prose plus one machine-readable sanitized block.
// Parsing the block (rather than grepping the prose) keeps the contract true even if the
// surrounding wording is rewritten: the pattern and the root must actually agree.
function jsonBlockAfter(headingPattern) {
  const lines = guide.split("\n");
  const start = lines.findIndex((line) => headingPattern.test(line));
  assert.ok(start >= 0, `the guide must carry a heading matching ${headingPattern}`);
  const fence = lines.findIndex((line, i) => i > start && line.trim() === "```json");
  assert.ok(fence >= 0, "the guide must carry a sanitized ```json block after that heading");
  const end = lines.findIndex((line, i) => i > fence && line.trim() === "```");
  assert.ok(end >= 0, "the sanitized ```json block is never closed");
  return JSON.parse(lines.slice(fence + 1, end).join("\n"));
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

// #124 — one capture policy: raw material must not be born inside the evergreen folder.
// Generic new notes used to default to `08-Concepts`, so an unprocessed capture was filed as
// a finished concept; the concept template is the *deliberate* door into that folder.
test("generic capture defaults to the inbox, never directly into concepts", () => {
  const app = readJson(APP);
  assert.equal(app.newFileLocation, "folder", "generic new notes must use the tracked folder default");
  assert.equal(
    app.newFileFolderPath,
    "00-Inbox",
    "a generic new note must land in 00-Inbox; raw capture must never be created straight into 08-Concepts"
  );
  assert.ok(
    guide.includes("99-Templates/Concept"),
    "the guide must name the Concept template as the explicit concept workflow"
  );
  assert.ok(
    readFileSync(CONCEPT_TEMPLATE, "utf8").includes("type: concept"),
    "the concept workflow's blueprint must declare type: concept"
  );
});

// #124 — one attachment authority. The plugin can express the monthly architecture; core
// only supplies the root. If the two ever diverge, attachments land in two different places
// depending on whether the plugin is loaded, which is the defect the audit found.
test("the guide declares one attachment placement authority under the tracked core root", () => {
  const app = readJson(APP);
  const policy = jsonBlockAfter(/attachment placement authority/i);
  assert.equal(
    policy.plugin,
    "obsidian-custom-attachment-location",
    "the single authority must be the plugin that can express the monthly subfolder architecture"
  );
  assert.ok(
    policy.attachmentFolderPath.startsWith(`${app.attachmentFolderPath}/`),
    `the authority's pattern (${policy.attachmentFolderPath}) must live under the tracked core root ` +
      `(${app.attachmentFolderPath}) so the two can never disagree`
  );
  assert.ok(
    policy.attachmentFolderPath.includes("${date:{momentJsFormat:'YYYY-MM'}}"),
    "the authority must express the declared monthly YYYY-MM subfolder architecture"
  );
});

// #124 — drawings are Markdown notes, not binary media, and migration must preserve links.
test("drawing and Markdown exceptions and link-preserving migration are documented", () => {
  assert.ok(guide.includes(".excalidraw.md"), "the guide must name the Excalidraw drawing exception");
  assert.match(guide, /Markdown/i, "the guide must state that Markdown files are notes, not media");
  assert.match(guide, /link-preserving/i, "the optional migration must be documented as link-preserving");
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
