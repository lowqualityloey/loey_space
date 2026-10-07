// Applies the vault's owned HomePulse prelude to a (possibly updated) plugin bundle.
//
// #117 taught the lesson this script encodes. The 1.0.6 store update replaced the bundle
// wholesale, and the drift guard went red only because the prelude *text* vanished. Had we
// re-injected the prelude straight away, the guard would have gone green while the
// integration stayed dead: the updated core contains **zero** call sites for
// `syncHabitsToFiles` / `readTodayFocusFromNote` / `saveTodayFocusToNote`, so the injected
// functions would never run. Presence is not integration.
//
// So the order of operations is: prove the target core still calls the bridge, and only
// then inject. If it does not, this exits 1 and names the finding instead of producing a
// green suite over a broken widget.
//
// Usage:
//   node 06-Resources/scripts/apply-homepulse-prelude.mjs [--bundle <path>] [--check]
//
//   exit 0  prelude present (no change needed), or injected
//   exit 1  the target bundle lost the call sites — the seam changed; do not inject
//   exit 2  usage error / missing files
//
// Documented procedure: 06-Resources/Guides/Plugin Ownership.md §4.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLUGIN_DIR = path.join(REPO_ROOT, ".obsidian", "plugins", "homepulse");
const PRELUDE = path.join(PLUGIN_DIR, "prelude.js");

// Each bridge symbol must appear at least once beyond its definition, i.e. the core calls
// it. Measured on the last known-good revision (1.0.2): habit 2, focus-read 2, focus-save 3.
const REQUIRED_CALL_SITES = [
  { symbol: "syncHabitsToFiles", minimum: 2, purpose: "habit toggle → dated daily note" },
  { symbol: "readTodayFocusFromNote", minimum: 2, purpose: "focus widget reads the note" },
  { symbol: "saveTodayFocusToNote", minimum: 3, purpose: "focus widget writes the note" },
];

const PRELUDE_MARKERS = ["getLocalDateStr", "syncHabitsToFiles", "readTodayFocusFromNote", "saveTodayFocusToNote"];

function usage(message) {
  if (message) console.error(`apply-homepulse-prelude: ${message}`);
  console.error("usage: node 06-Resources/scripts/apply-homepulse-prelude.mjs [--bundle <path>] [--check]");
}

const args = process.argv.slice(2);
let bundlePath = path.join(PLUGIN_DIR, "main.js");
let checkOnly = false;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--bundle") {
    bundlePath = path.resolve(args[++i] ?? "");
  } else if (args[i] === "--check") {
    checkOnly = true;
  } else {
    usage(`unknown argument: ${args[i]}`);
    process.exit(2);
  }
}

if (!existsSync(PRELUDE)) {
  usage(`owned prelude source is missing: ${path.relative(REPO_ROOT, PRELUDE)}`);
  process.exit(2);
}
if (!existsSync(bundlePath)) {
  usage(`bundle not found: ${bundlePath}`);
  process.exit(2);
}

const prelude = readFileSync(PRELUDE, "utf8");
const bundle = readFileSync(bundlePath, "utf8");
const label = path.relative(REPO_ROOT, bundlePath) || bundlePath;

// Idempotent: an already-injected bundle is a no-op, not a second copy.
const alreadyInjected = PRELUDE_MARKERS.every((marker) => bundle.includes(marker));
if (alreadyInjected) {
  console.log(`✓ ${label} already carries the owned prelude — nothing to do.`);
  process.exit(0);
}

// The gate that #117 was missing: does the updated core actually call the bridge?
const absent = [];
for (const { symbol, minimum, purpose } of REQUIRED_CALL_SITES) {
  const occurrences = bundle.split(symbol).length - 1;
  if (occurrences < minimum) {
    absent.push(`  • ${symbol}: found ${occurrences}, expected at least ${minimum} (${purpose})`);
  }
}
if (absent.length > 0) {
  console.error("");
  console.error(`✖ ${label} lost the integration seam — refusing to inject the prelude`);
  console.error("");
  for (const line of absent) console.error(line);
  console.error("");
  console.error("  The updated core no longer calls the owned bridge, so the prelude would be");
  console.error("  dead code: the drift guard would pass while habit/focus sync stayed broken.");
  console.error("  This is the false green #117 exists to prevent.");
  console.error("");
  console.error("  Options:");
  console.error("    1. Keep the last known-good bundle (restore the plugin directory from Git).");
  console.error("    2. Reconstruct the call sites — blocked: no authoritative HomePulse source");
  console.error("       exists (Plugin Ownership.md §2, owner decision 2026-10-03).");
  console.error("    3. Record the update as blocked on an upstream source, then decide.");
  console.error("");
  process.exit(1);
}

if (checkOnly) {
  console.log(`✓ ${label} calls the owned bridge; the prelude can be applied (--check made no change).`);
  process.exit(0);
}

// Inject immediately after `"use strict";` so the prelude stays the first readable block.
const anchor = bundle.indexOf('"use strict";');
if (anchor === -1) {
  usage(`${label} has no "use strict"; line to anchor the prelude to`);
  process.exit(2);
}
const insertAt = anchor + '"use strict";'.length;
const patched = `${bundle.slice(0, insertAt)}\n\n${prelude.trimEnd()}\n${bundle.slice(insertAt)}`;

writeFileSync(bundlePath, patched);
try {
  execFileSync(process.execPath, ["--check", bundlePath], { stdio: "pipe" });
} catch (error) {
  console.error(`✖ injected prelude does not parse; restoring the previous bundle`);
  writeFileSync(bundlePath, bundle);
  console.error(String(error.stderr ?? error));
  process.exit(1);
}

console.log(`✓ Injected the owned prelude into ${label} (call sites verified first); bundle parses.`);
