// #60: the daily-note path resolver. The vault's Obsidian config puts dated
// notes in 01-Daily/YYYY-MM/YYYY-MM-DD.md, so task routing must resolve that
// path rather than a flat 01-Daily/YYYY-MM-DD.md.
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveDailyNotePath,
  resolveDailyNoteFile,
  formatDate,
  readDailyNotesConfig,
  DEFAULT_DAILY_NOTES_CONFIG,
} from "../src/lib/daily-note.ts";

test("resolves the vault's monthly daily-note path", () => {
  assert.equal(
    resolveDailyNoteFile("2026-10-04"),
    "01-Daily/2026-10/2026-10-04.md"
  );
});

test("does not use the legacy flat path", () => {
  const resolved = resolveDailyNoteFile("2026-10-04");
  assert.notEqual(resolved, "01-Daily/2026-10-04.md");
});

test("pads single-digit months and days", () => {
  assert.equal(resolveDailyNoteFile("2026-01-05"), "01-Daily/2026-01/2026-01-05.md");
});

test("honours an observed config over the default", () => {
  assert.equal(
    resolveDailyNoteFile("2026-10-04", { folder: "Journal", format: "YYYY-MM-DD" }),
    "Journal/2026-10-04.md"
  );
});

test("tolerates a trailing slash on the folder", () => {
  assert.equal(
    resolveDailyNotePath("2026-10-04", { folder: "01-Daily/", format: "YYYY-MM/YYYY-MM-DD" }),
    "01-Daily/2026-10/2026-10-04"
  );
});

test("rejects a malformed date instead of building a junk path", () => {
  assert.throws(() => resolveDailyNotePath("not-a-date"), /YYYY-MM-DD/);
});

test("formatDate expands Obsidian tokens", () => {
  const d = new Date(2026, 9, 4);
  assert.equal(formatDate(d, "YYYY-MM-DD"), "2026-10-04");
  assert.equal(formatDate(d, "YYYY/MM/DD"), "2026/10/04");
  assert.equal(formatDate(d, "DD-MM-YYYY"), "04-10-2026");
});

test("reads the live vault config when available", async () => {
  const cfg = await readDailyNotesConfig(async (p) => {
    assert.equal(p, ".obsidian/daily-notes.json");
    return { folder: "01-Daily", format: "YYYY-MM/YYYY-MM-DD" };
  });
  assert.deepEqual(cfg, { folder: "01-Daily", format: "YYYY-MM/YYYY-MM-DD" });
});

test("falls back to defaults when the config is missing or broken", async () => {
  assert.deepEqual(await readDailyNotesConfig(async () => undefined), DEFAULT_DAILY_NOTES_CONFIG);
  assert.deepEqual(
    await readDailyNotesConfig(async () => { throw new Error("unreadable"); }),
    DEFAULT_DAILY_NOTES_CONFIG
  );
  assert.deepEqual(
    await readDailyNotesConfig(async () => ({ folder: 42 })),
    DEFAULT_DAILY_NOTES_CONFIG
  );
});

test("the resolver agrees with the vault's real daily-notes config", async () => {
  const { readFileSync } = await import("node:fs");
  const live = JSON.parse(readFileSync(".obsidian/daily-notes.json", "utf8"));
  assert.equal(
    resolveDailyNoteFile("2026-10-04", { folder: live.folder, format: live.format }),
    "01-Daily/2026-10/2026-10-04.md",
    "resolver must match the vault's configured daily-note layout"
  );
});