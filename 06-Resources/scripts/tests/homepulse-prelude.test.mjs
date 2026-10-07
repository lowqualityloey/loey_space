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

// #117: the marker check above was not enough. The 1.0.6 store update deleted the prelude
// *and* every call site, so re-injecting the prelude text would have restored the markers
// — and turned this guard green — while habit and focus sync stayed dead, because nothing
// called the functions any more. Presence is not integration: assert the minified core
// still calls each bridge symbol, with the counts measured on the last known-good build.
const REQUIRED_CALL_SITES = [
  ["syncHabitsToFiles", 2],
  ["readTodayFocusFromNote", 2],
  ["saveTodayFocusToNote", 3],
];

test("homepulse core still calls the owned bridge (presence is not integration)", () => {
  for (const [symbol, minimum] of REQUIRED_CALL_SITES) {
    const occurrences = source.split(symbol).length - 1;
    assert.ok(
      occurrences >= minimum,
      `bundle references "${symbol}" ${occurrences} time(s), expected at least ${minimum}: ` +
        `the prelude text may be present while nothing calls it. A store update replaces the ` +
        `whole bundle, call sites included — see 06-Resources/Guides/Plugin Ownership.md §4 ` +
        `and run 06-Resources/scripts/apply-homepulse-prelude.mjs, which refuses to inject ` +
        `the prelude into a bundle that lost the seam`
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