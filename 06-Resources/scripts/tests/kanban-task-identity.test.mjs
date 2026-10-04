// Public regression suite for GitHub issue #38 (kanban-status-sync propagation).
//
// #38: task propagation derived identity from card text alone, so a card titled
// `read` rewrote `- [ ] read` in every daily note. The fix introduces kind-scoped
// identity: tasks resolve by stated block ID (`id:`), habit slots by
// (`slot:`, note date), and an ambiguous legacy card is left untouched with one
// actionable feedback instead of a guessed bulk migration.
//
// Two layers, both required:
//   Layer 1 — pure identity helpers, no vault. Pins the namespace contract.
//   Layer 2 — stub-driven propagateBoard run. Pins the write/feedback contract.
//
// Bodies passed to identityKey are the plugin's own line bodies: text AFTER the
// checkbox marker, never the `- [ ]` prefix (main.js passes tMatch[4]).
//
// Non-vacuity: point KANBAN_MAIN_JS at a pre-fix copy of main.js and this suite
// fails (the pre-fix build exports no identityKey and rewrites same-titled
// notes). Defaults to the repo-root plugin build.
//
// Paths resolve from this file's own location, never process.cwd().

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const stub = require("./helpers/kanban-obsidian-stub.cjs");

const {
  MAIN_JS,
  SIX_SLOTS,
  createLog,
  installStubs,
  makeVault,
  newPlugin,
  fileByPath,
  withCapturedConsole,
  boardText,
  dailyText,
  countChangedLines,
  countBlockIds,
} = stub;

const NOTE_A = "01-Daily/2026-10/2026-10-03.md";
const NOTE_B = "01-Daily/2026-10/2026-10-04.md";

// The remedy the plugin prints for an ambiguous card. Exact string, because it
// is the user-facing half of AC-4: naming the fix makes the feedback actionable.
const REMEDY = "Resolve by giving the intended line a unique ^id";

function loadExports() {
  return installStubs(createLog());
}

/** The identity API #38 introduces; absent entirely on a pre-fix build. */
function identityApi() {
  const ex = loadExports();
  for (const name of ["identityKey", "cardKey", "extractBlockId", "noteDateFromPath", "sectionKind", "adoptBlockId"]) {
    assert.equal(
      typeof ex[name],
      "function",
      `main.js (${MAIN_JS}) must export ${name}() — issue #38 kind-scoped identity`
    );
  }
  return ex;
}

const prefix = (key) => String(key).split(":")[0];

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- layer 1

test("AC-1: a task carrying ^id keys by id, a task without one keys by text", () => {
  const { identityKey } = identityApi();
  assert.equal(identityKey("task", NOTE_A, "Ship the release ^a1b2"), "id:^a1b2");
  assert.equal(identityKey("task", NOTE_A, "Ship the release"), "text:ship the release");
  assert.notEqual(identityKey("task", NOTE_A, "Ship the release ^a1b2"), identityKey("task", NOTE_A, "Ship the release"));
});

test("AC-1: id:, text: and slot: are disjoint namespaces", () => {
  const { identityKey } = identityApi();
  const byId = identityKey("task", NOTE_A, "read ^a1b2");
  const byText = identityKey("task", NOTE_A, "read");
  const bySlot = identityKey("habit", NOTE_A, "read");
  assert.deepEqual([prefix(byId), prefix(byText), prefix(bySlot)], ["id", "text", "slot"]);
  assert.equal(new Set([byId, byText, bySlot]).size, 3);
});

test("AC-1: no identityKey result is ever a bare, unprefixed key", () => {
  const { identityKey } = identityApi();
  const corpus = [
    ["task", NOTE_A, "Ship the release ^a1b2"],
    ["task", NOTE_A, "Ship the release"],
    ["task", NOTE_A, "read"],
    ["habit", NOTE_A, "read"],
    ["habit", NOTE_B, "read ^zzz9"],
    ["habit", NOTE_A, "water"],
  ];
  for (const [kind, notePath, body] of corpus) {
    const key = identityKey(kind, notePath, body);
    assert.match(
      key,
      /^(id|slot|text):/,
      `identityKey(${kind}, ${notePath}, ${JSON.stringify(body)}) returned a bare key: ${key}`
    );
  }
});

test("AC-1: a legacy task without ^id stays in text: and never becomes an id:", () => {
  const { identityKey, adoptBlockId } = identityApi();
  assert.equal(prefix(identityKey("task", NOTE_A, "Ship the release")), "text");
  assert.equal(prefix(adoptBlockId("task", NOTE_A, "Ship the release")), "text");
});

test("AC-1: cardKey strips the ^id for text matching while identityKey scopes by it", () => {
  const { cardKey, identityKey } = identityApi();
  assert.equal(cardKey("Ship the release ^a1b2"), "ship the release");
  assert.equal(cardKey("Ship the release ✅ 2026-10-04 [[Wiki]] ^a1b2"), "ship the release");
  // Same text, two distinct stated ^ids: cardKey collapses them, identityKey does not.
  assert.notEqual(identityKey("task", NOTE_A, "Ship the release ^a1b2"), identityKey("task", NOTE_A, "Ship the release ^c3d4"));
});

test("AC-2: a habit slot is scoped to its note date, so it never propagates across days", () => {
  const { identityKey } = identityApi();
  assert.notEqual(
    identityKey("habit", NOTE_A, "read"),
    identityKey("habit", NOTE_B, "read"),
    "the same slot on two dates must be two identities"
  );
  assert.equal(prefix(identityKey("habit", NOTE_A, "read")), "slot");
  assert.equal(prefix(identityKey("habit", NOTE_A, "read ^zzz9")), "slot", "a habit line never keys as id:");
});

test("AC-3: a renamed task carrying the same ^id keeps its identity", () => {
  const { identityKey } = identityApi();
  const original = identityKey("task", NOTE_A, "Ship the release ^a1b2");
  assert.equal(identityKey("task", NOTE_A, "Ship the release notes ^a1b2"), original, "rename must not change identity");
  assert.equal(identityKey("task", NOTE_B, "Ship the release notes ^a1b2"), original, "identity travels across notes");
});

test("AC-4: adoption refuses the habit kind outright", () => {
  const { adoptBlockId } = identityApi();
  assert.equal(adoptBlockId("habit", NOTE_A, "read"), null);
  assert.equal(adoptBlockId("task", NOTE_A, "Ship the release ^a1b2"), "id:^a1b2");
});

test("sectionKind pins its documented pre-lowercased input contract", () => {
  const { sectionKind } = identityApi();
  // Fragile by contract: main.js calls this only on values already lower-cased by
  // its capture sites. Pinned as-is; no case-insensitive behaviour is claimed.
  assert.equal(sectionKind("🔁 habits"), "habit");
  assert.equal(sectionKind("✅ tasks"), "task");
});

// ---------------------------------------------------------------- layer 2

/** Run one propagateBoard pass over a synthetic vault and report the writes. */
async function propagate(initial, boardPath) {
  const log = createLog();
  const ex = installStubs(log);
  const { vault, files } = makeVault(initial, log);
  const before = new Map(files);
  const plugin = newPlugin(ex, vault);
  await withCapturedConsole(log, () => plugin.propagateBoard(fileByPath(vault, boardPath)));
  return { log, files, before };
}

const touched = (files, before) => [...files.keys()].filter((p) => files.get(p) !== before.get(p));

test("AC-2/AC-4: an ambiguous legacy card writes nothing and reports one remedy", async () => {
  const board = "02-Projects/Sprint/Sprint Kanban.md";
  const { log, files, before } = await propagate(
    {
      [board]: boardText([
        ["To Do", []],
        ["Done", ["- [x] Buy milk"]],
      ]),
      [NOTE_A]: dailyText(["- [ ] Buy milk"]),
      [NOTE_B]: dailyText(["- [ ] Buy milk"]),
    },
    board
  );

  assert.deepEqual(touched(files, before), [], "an ambiguous card must rewrite no note");
  assert.equal(log.modify.length, 0);
  assert.equal(countBlockIds(files), 0, "no ^id may be adopted for an ambiguous card");

  assert.equal(log.notices.length, 1, "exactly one Notice, never one per candidate");
  assert.match(log.notices[0], /ambiguous task "Buy milk" matches 2 notes/);
  const feedback = log.logs.filter((l) => l.includes(REMEDY));
  assert.equal(feedback.length, 1, `exactly one console entry carrying the remedy: ${JSON.stringify(REMEDY)}`);
});

test("AC-2: the ambiguous card leaves every unrelated line byte-identical", async () => {
  const board = "02-Projects/Sprint/Sprint Kanban.md";
  const { files, before } = await propagate(
    {
      [board]: boardText([
        ["To Do", []],
        ["Done", ["- [x] Buy milk"]],
      ]),
      [NOTE_A]: dailyText(["- [ ] Buy milk", "- [ ] Unrelated task"]),
      [NOTE_B]: dailyText(["- [ ] Buy milk"]),
    },
    board
  );

  for (const p of [NOTE_A, NOTE_B]) {
    assert.equal(countChangedLines(before.get(p), files.get(p)), 0, `${p} must be untouched`);
  }
  for (const slot of SIX_SLOTS) {
    assert.ok(
      new RegExp(`^- \\[ \\] ${slot}$`, "m").test(files.get(NOTE_A)),
      `habit slot ${slot} must survive an ambiguous propagation`
    );
  }
});

test("AC-1/AC-2/AC-3: an identified mirror updates with a completion date; a same-titled legacy task does not", async () => {
  const board = "02-Projects/Release/Release Kanban.md";
  const { log, files, before } = await propagate(
    {
      [board]: boardText([
        ["To Do", []],
        ["Done", ["- [x] Refresh docs ^a1b2"]],
      ]),
      [NOTE_A]: dailyText(["- [ ] Refresh docs ^a1b2"]),
      [NOTE_B]: dailyText(["- [ ] Refresh docs"]),
    },
    board
  );

  const today = localToday();
  assert.ok(
    files.get(NOTE_A).includes(`- [x] Refresh docs ✅ ${today} ^a1b2`),
    `the identified mirror takes today's completion date; got:\n${files.get(NOTE_A)}`
  );
  // Strict, not decorative: the unrelated same-titled legacy note must be
  // byte-identical AND its task must still be open. A regex guard was removed
  // here because it matched any line and therefore asserted nothing.
  assert.equal(
    countChangedLines(before.get(NOTE_B), files.get(NOTE_B)),
    0,
    `an unrelated same-titled legacy note must be untouched; got:\n${files.get(NOTE_B)}`
  );
  assert.ok(
    files.get(NOTE_B).includes("- [ ] Refresh docs\n"),
    "an unrelated same-titled legacy task must stay open (no completion mark, no date)"
  );
  assert.deepEqual(log.modify, [NOTE_A], "only the identified mirror is written");
  assert.equal(countBlockIds(files), 2, "the card and the mirror already state ^a1b2; none may be minted");
});