// Stub harness for scheduled-enrich tests.
// Creates a temp vault with the given layout and timestamps, runs the scaffold from the
// vault root, and reports whether the timestamps file was mutated.
//
// Usage: node helpers/scheduled-enrich-harness.cjs <scaffold.js> [--simulate]
//
// Env vars:
//   SCHEDULED_ENRICH_VAULT  - JSON map of relative path -> content
//   SCHEDULED_ENRICH_TIMESTAMPS - JSON map of relative path -> timestamp
const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sched-enrich-"));
const vaultRoot = path.join(tmpDir, "vault");
const scriptsDir = path.join(tmpDir, "scripts");

fs.mkdirSync(vaultRoot, { recursive: true });
fs.mkdirSync(scriptsDir, { recursive: true });

// Copy scaffold into temp scripts dir
const [_, __, scaffoldPath, ...args] = process.argv;
fs.copyFileSync(scaffoldPath, path.join(scriptsDir, "scheduled-enrich.js"));

// Write vault layout
const vaultLayout = JSON.parse(process.env.SCHEDULED_ENRICH_VAULT || "{}");
for (const [relPath, content] of Object.entries(vaultLayout)) {
  const full = path.join(vaultRoot, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// Write timestamps next to the scaffold since __dirname will be scriptsDir.
const timestamps = JSON.parse(process.env.SCHEDULED_ENRICH_TIMESTAMPS ?? "{}");
const tsFile = path.join(scriptsDir, ".enriched-timestamps.json");
fs.writeFileSync(tsFile, JSON.stringify(timestamps, null, 2));

// Read timestamps before
const before = fs.readFileSync(tsFile, "utf8");

// Run scaffold from vault root so resolveVaultPath finds 01-Daily
const result = cp.spawnSync(process.execPath, [path.join(scriptsDir, "scheduled-enrich.js"), ...args], {
  cwd: vaultRoot,
  env: { ...process.env, HOME: process.env.HOME },
  encoding: "utf8",
});

// Read timestamps after
let after = null;
try {
  after = fs.readFileSync(tsFile, "utf8");
} catch (e) {
  after = null;
}

console.log(JSON.stringify({
  stdout: result.stdout,
  stderr: result.stderr,
  status: result.status,
  timestampsUnchanged: before === after,
  before,
  after,
}));
