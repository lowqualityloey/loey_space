// Issue #61: the scheduled-enrich scaffold logged "Would enrich" but then wrote timestamps
// anyway, so a dry-run left .enriched-timestamps.json changed. It also only read top-level
// entries in each folder, missing nested dated notes under e.g. 01-Daily/2026-10/.
//
// These cases run the SHIPPED scheduled-enrich.js against a temporary vault created by the
// harness helper, so the test controls the filesystem without touching the real vault.
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import child_process from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULED_ENRICH = path.join(HERE, "..", "scheduled-enrich.js");
const HARNESS = path.join(HERE, "helpers", "scheduled-enrich-harness.cjs");

function runScheduledEnrich(args, vaultLayout, existingTimestamps = {}) {
  const env = {
    ...process.env,
    SCHEDULED_ENRICH_VAULT: JSON.stringify(vaultLayout),
    SCHEDULED_ENRICH_TIMESTAMPS: JSON.stringify(existingTimestamps),
  };
  const result = child_process.spawnSync(process.execPath, [HARNESS, SCHEDULED_ENRICH, ...args], {
    env,
    encoding: "utf8",
  });
  if (!result.stdout.trim()) {
    throw new Error(`harness produced empty output; stderr: ${result.stderr}; status: ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

test("simulation mode is explicitly labeled", () => {
  const result = runScheduledEnrich(["--simulate"], {
    "01-Daily/note1.md": "content",
  }, {
    "01-Daily/note1.md": Date.now() - 1000 * 60 * 60 * 24 * 8,
  });

  assert.equal(result.status, 0, `scheduled-enrich failed: ${result.stderr}`);
  assert.ok(
    result.stdout.includes("SIMULATION MODE"),
    `expected SIMULATION MODE in output: ${result.stdout}`
  );
  assert.ok(
    result.stdout.includes("Would enrich"),
    `expected 'Would enrich' in output: ${result.stdout}`
  );
});

test("simulation mode does not mutate the timestamps file", () => {
  const timestamps = {
    "01-Daily/note1.md": Date.now() - 1000 * 60 * 60 * 24 * 8,
    "01-Daily/note2.md": Date.now() - 1000 * 60 * 60 * 24 * 8,
  };

  const result = runScheduledEnrich(["--simulate"], {
    "01-Daily/note1.md": "content",
    "01-Daily/note2.md": "content",
  }, timestamps);

  assert.equal(result.status, 0, `scheduled-enrich failed: ${result.stderr}`);
  assert.equal(
    result.timestampsUnchanged, true,
    `timestamps file was mutated during simulation: ${result.before} → ${result.after}`
  );
});

test("recursive discovery finds nested dated notes", () => {
  const result = runScheduledEnrich([], {
    "01-Daily/2026-10/2026-10-01.md": "content",
    "01-Daily/2026-10/2026-10-02.md": "content",
    "01-Daily/notes.md": "content",
  }, {});

  assert.equal(result.status, 0, `scheduled-enrich failed: ${result.stderr}`);
  assert.ok(
    result.stdout.includes("Found 3 notes"),
    `expected 3 notes (2 nested + 1 top-level), got: ${result.stdout}`
  );
});

test("structural files are excluded from discovery", () => {
  const result = runScheduledEnrich([], {
    "01-Daily/_Daily MOC.md": "content",
    "01-Daily/2026-10-01.md": "content",
  }, {});

  assert.equal(result.status, 0, `scheduled-enrich failed: ${result.stderr}`);
  assert.ok(
    result.stdout.includes("Found 1 notes"),
    `expected 1 note (MOC excluded), got: ${result.stdout}`
  );
});

test("recently enriched notes are skipped", () => {
  // Timestamps are in milliseconds (Date.now()), so 1 day = 86400000 ms.
  // Use a 10-day gap for old and 1-day for recent to avoid timing flakes around the 7-day boundary.
  const now = Date.now();
  const timestamps = {
    "01-Daily/recent.md": now - 86400000,     // 1 day ago
    "01-Daily/old.md": now - 86400000 * 10,  // 10 days ago
  };

  const result = runScheduledEnrich(["--simulate"], {
    "01-Daily/recent.md": "content",
    "01-Daily/old.md": "content",
  }, timestamps);

  assert.equal(result.status, 0, `scheduled-enrich failed: ${result.stderr}`);
  assert.ok(
    result.stdout.includes("Skipping (recently enriched)"),
    `expected skip message: ${result.stdout}`
  );
  assert.ok(
    result.stdout.includes("Would enrich: 01-Daily/old.md"),
    `expected old note to be flagged: ${result.stdout}`
  );
});
