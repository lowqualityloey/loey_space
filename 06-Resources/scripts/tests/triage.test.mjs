import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeTitle,
  deriveTitle,
  buildNote,
  buildKanban,
  insertTask,
  parseDumpLines,
  updateDumpContent,
  ROUTES
} from "../src/lib/triage.ts";

test("sanitizeTitle: removes invalid filename/wikilink characters and truncates long titles", () => {
  assert.strictEqual(sanitizeTitle("Hello: World? #tag [test] / path"), "Hello World tag test path");
  const longTitle = "a".repeat(100);
  assert.strictEqual(sanitizeTitle(longTitle).length, 60);
});

test("deriveTitle: extracts domain and path segment from bare URL", () => {
  assert.strictEqual(deriveTitle("https://boot.dev/courses", "2026-08-31"), "boot.dev courses");
  assert.strictEqual(deriveTitle("some regular note title", "2026-08-31"), "some regular note title");
  assert.strictEqual(deriveTitle("---", "2026-08-31"), "Capture 2026-08-31");
});

test("buildNote: creates valid frontmatter and markdown body", () => {
  const route = ROUTES.concept;
  const note = buildNote(route, "Semantic Commit Messages", "semantic commit messages #concept", "2026-08-30", "2026-08-31");
  assert.ok(note.includes("created: 2026-08-31"));
  assert.ok(note.includes("captured: 2026-08-30"));
  assert.ok(note.includes("# Semantic Commit Messages"));
  assert.ok(note.includes("## Capture"));
  assert.ok(note.includes("- semantic commit messages #concept"));
});

test("buildKanban: generates valid kanban board structure", () => {
  const kanban = buildKanban("2026-08-31");
  assert.ok(kanban.includes("kanban-plugin: board"));
  assert.ok(kanban.includes("## To Do"));
  assert.ok(kanban.includes("## In Progress"));
  assert.ok(kanban.includes("## Done"));
});

test("insertTask: places task in Tasks section or replaces empty task checkbox", () => {
  const contentWithEmpty = `## ✅ Tasks\n- [ ] \n- [ ] existing task\n`;
  const res1 = insertTask(contentWithEmpty, "do laundry");
  assert.strictEqual(res1.ok, true);
  assert.ok(res1.content.includes("- [ ] do laundry"));

  const contentWithoutTasks = `## 📝 Notes\nsome notes`;
  const res2 = insertTask(contentWithoutTasks, "do laundry");
  assert.strictEqual(res2.ok, false);
});

test("parseDumpLines & updateDumpContent: parses dump lines and updates dump history", () => {
  const dumpLines = [
    "### 📅 2026-08-31",
    "- laundry #do",
    "- https://boot.dev/ #learn",
    "- unhandled note"
  ];
  const items = parseDumpLines(dumpLines);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].token, "do");
  assert.strictEqual(items[1].token, "learn");

  const results = [
    { item: items[0], destination: "01-Daily/2026-08-31.md", ok: true },
    { item: items[1], destination: "04-Learning/boot.dev.md", ok: true }
  ];

  const { content: nextDump, archived, unresolved } = updateDumpContent(
    dumpLines.join("\n"),
    results,
    "2026-08-31"
  );

  assert.ok(nextDump.includes("## ✅ Triaged"));
  assert.ok(nextDump.includes("~~laundry~~ → [[2026-08-31]] `#do`"));
  assert.ok(nextDump.includes("~~https://boot.dev/~~ → [[boot.dev]] `#learn`"));
  assert.ok(nextDump.includes("- unhandled note"));
  assert.deepStrictEqual(archived, results);
  assert.deepStrictEqual(unresolved, []);
});

test("updateDumpContent: archives captures that survive to the current content and leaves reworded ones", () => {
  const dumpLines = [
    "### 📅 2026-08-31",
    "- laundry #do",
    "- https://boot.dev/ #learn"
  ];
  const items = parseDumpLines(dumpLines);
  const results = [
    { item: items[0], destination: "01-Daily/2026-08-31.md", ok: true },
    { item: items[1], destination: "04-Learning/boot.dev.md", ok: true },
    { item: { index: 99, token: "concept", text: "gone already", capturedDate: "" }, destination: "08-Concepts/x.md", ok: true }
  ];

  // "laundry" was reworded mid-sweep; the third capture was deleted outright.
  const current = [
    "### 📅 2026-08-31",
    "- do the laundry now #do",
    "- https://boot.dev/ #learn",
    "- appended mid sweep #concept"
  ].join("\n");

  const { content, archived, unresolved } = updateDumpContent(current, results, "2026-08-31");

  assert.ok(content.includes("- do the laundry now #do"), "a reworded capture is left alone");
  assert.ok(content.includes("- appended mid sweep #concept"), "an appended capture is left alone");
  assert.ok(!content.includes("- https://boot.dev/ #learn"), "an untouched filed capture is swept");
  assert.strictEqual(archived.length, 1);
  assert.strictEqual(archived[0].item.text, "https://boot.dev/");
  assert.strictEqual(unresolved.length, 2, "reworded and deleted captures are reported, not dropped");
});
