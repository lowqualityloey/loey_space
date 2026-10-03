// #36 drift guard: the HomePulse bundle ships as generated output, but its first
// lines are a locally owned prelude (habit + focus writers). If a future bundle
// update replaces that prelude, these assertions fail so the local patches are
// re-applied deliberately instead of silently disappearing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BUNDLE = ".obsidian/plugins/homepulse/main.js";
const source = readFileSync(BUNDLE, "utf8");

const PRELUDE_MARKERS = [
  "getLocalDateStr",
  "syncHabitsToFiles",
  "readTodayFocusFromNote",
  "saveTodayFocusToNote",
];

test("homepulse bundle keeps its locally owned prelude", () => {
  for (const marker of PRELUDE_MARKERS) {
    assert.ok(
      source.includes(marker),
      `prelude marker "${marker}" is missing from ${BUNDLE}; the locally owned ` +
        `prelude was replaced by a bundle update — re-apply the vault patches ` +
        `(see 06-Resources/Guides/Plugin Ownership.md) before trusting habit and ` +
        `focus sync`
    );
  }
});

test("homepulse bundle still parses", () => {
  // Catches a truncated or hand-mangled bundle that markers alone would not.
  execFileSync(process.execPath, ["--check", BUNDLE], { stdio: "pipe" });
});

test("homepulse manifest identity is recorded for provenance", () => {
  const manifest = JSON.parse(
    readFileSync(".obsidian/plugins/homepulse/manifest.json", "utf8")
  );
  assert.equal(manifest.id, "homepulse");
  assert.ok(manifest.version, "manifest must declare a version");
});