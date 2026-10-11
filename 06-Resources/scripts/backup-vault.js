var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// 06-Resources/scripts/src/backup-vault.ts
var backup_vault_exports = {};
__export(backup_vault_exports, {
  backupVault: () => backupVault,
  main: () => main,
  pruneSnapshots: () => pruneSnapshots,
  verifySnapshotIntegrity: () => verifySnapshotIntegrity
});
module.exports = __toCommonJS(backup_vault_exports);
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var crypto = __toESM(require("crypto"));
var import_child_process = require("child_process");
var OWNER_FILES = ["memory.md", "handoff.md", ".env"];
var OWNER_DIRS = [
  ".secrets",
  "00-Inbox",
  "01-Daily",
  "02-Projects",
  "03-Dev",
  "04-Learning",
  "05-Personal",
  "07-Reviews",
  "08-Concepts"
];
function sha256File(absPath) {
  const bytes = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}
function formatTimestamp(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}
function copyDirRecursive(srcDir, destDir, relPrefix, recorded) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const srcAbs = path.join(srcDir, entry.name);
    const destAbs = path.join(destDir, entry.name);
    const rel = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      copyDirRecursive(srcAbs, destAbs, rel, recorded);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcAbs, destAbs);
      recorded.push(rel);
    }
  }
}
function buildRestoreInstructions(snapshotName, hasGitBundle) {
  return [
    `# \u{1F504} Self-Restore Instructions (${snapshotName})`,
    "",
    "This backup archive was generated deterministically (`no_agent`). Follow these steps to restore a fresh instance of `loey_space`:",
    "",
    "## 1. Verify Snapshot Integrity",
    "```bash",
    `node -e 'const fs=require("fs"),crypto=require("crypto"),m=JSON.parse(fs.readFileSync("manifest.json","utf8"));for(const e of m.entries){const h=crypto.createHash("sha256").update(fs.readFileSync(e.relPath)).digest("hex");if(h!==e.sha256)throw new Error("Checksum mismatch: "+e.relPath);}console.log("Integrity OK:",m.entries.length,"files");'`,
    "```",
    "",
    "## 2. Restore Git Repository",
    hasGitBundle ? [
      "```bash",
      "git clone ./repo.bundle loey_space",
      "cd loey_space",
      "```"
    ].join("\n") : "_No git bundle was present at snapshot time; clone from your remote origin first._",
    "",
    "## 3. Restore Owner-Only Ignored State",
    "Copy the contents of `owner-state/` (`memory.md`, `handoff.md`, `.env`, `.secrets/`) into the root of your restored `loey_space` working tree:",
    "```bash",
    "cp -rn ./owner-state/. /path/to/loey_space/",
    "```",
    "",
    "## 4. Verify Vault Health",
    "```bash",
    "npm install",
    "npm run hygiene -- --check-rot",
    "npm run audit-links",
    "```",
    ""
  ].join("\n");
}
function isoWeekKey(dateStr) {
  const d = /* @__PURE__ */ new Date(`${dateStr}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function pruneSnapshots(backupRoot, retention = {}) {
  const dailyMax = retention.daily ?? 7;
  const weeklyMax = retention.weekly ?? 4;
  const monthlyMax = retention.monthly ?? 6;
  let entries;
  try {
    entries = fs.readdirSync(backupRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const snapshots = entries.filter((e) => e.isDirectory() && /^snapshot-\d{4}-\d{2}-\d{2}_\d{6}$/.test(e.name)).map((e) => e.name).sort().reverse();
  const keep = /* @__PURE__ */ new Set();
  const seenDays = /* @__PURE__ */ new Set();
  const seenWeeks = /* @__PURE__ */ new Set();
  const seenMonths = /* @__PURE__ */ new Set();
  if (snapshots.length > 0)
    keep.add(snapshots[0]);
  for (const name of snapshots) {
    const datePart = name.slice("snapshot-".length, "snapshot-YYYY-MM-DD".length);
    const monthKey = datePart.slice(0, 7);
    const weekKey = isoWeekKey(datePart);
    if (seenDays.size < dailyMax && !seenDays.has(datePart)) {
      seenDays.add(datePart);
      keep.add(name);
    }
    if (seenWeeks.size < weeklyMax && !seenWeeks.has(weekKey)) {
      seenWeeks.add(weekKey);
      keep.add(name);
    }
    if (seenMonths.size < monthlyMax && !seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      keep.add(name);
    }
  }
  const pruned = [];
  for (const name of snapshots) {
    if (!keep.has(name)) {
      fs.rmSync(path.join(backupRoot, name), { recursive: true, force: true });
      pruned.push(name);
    }
  }
  return pruned.sort();
}
function verifySnapshotIntegrity(snapshotDir) {
  const manifestPath = path.join(snapshotDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const entry of manifest.entries) {
    const abs = path.join(snapshotDir, entry.relPath);
    if (!fs.existsSync(abs))
      return false;
    const stat = fs.statSync(abs);
    if (stat.size !== entry.bytes)
      return false;
    if (sha256File(abs) !== entry.sha256)
      return false;
  }
  return true;
}
function backupVault(root, options = {}) {
  const now = options.now ?? /* @__PURE__ */ new Date();
  const backupRoot = options.backupRoot ?? path.join(os.homedir(), ".loey_backups");
  const snapshotName = `snapshot-${formatTimestamp(now)}`;
  const snapshotDir = path.join(backupRoot, snapshotName);
  fs.mkdirSync(snapshotDir, { recursive: true });
  const recordedRelPaths = [];
  let hasGitBundle = false;
  const bundleRel = "repo.bundle";
  const bundleAbs = path.join(snapshotDir, bundleRel);
  try {
    (0, import_child_process.execFileSync)("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: root,
      stdio: ["ignore", "ignore", "ignore"]
    });
    (0, import_child_process.execFileSync)("git", ["bundle", "create", bundleAbs, "--all"], {
      cwd: root,
      stdio: ["ignore", "ignore", "ignore"]
    });
    if (fs.existsSync(bundleAbs)) {
      hasGitBundle = true;
      recordedRelPaths.push(bundleRel);
    }
  } catch {
  }
  const ownerStateDir = path.join(snapshotDir, "owner-state");
  fs.mkdirSync(ownerStateDir, { recursive: true });
  for (const file of OWNER_FILES) {
    const srcAbs = path.join(root, file);
    if (fs.existsSync(srcAbs) && fs.statSync(srcAbs).isFile()) {
      const destAbs = path.join(ownerStateDir, file);
      fs.copyFileSync(srcAbs, destAbs);
      recordedRelPaths.push(`owner-state/${file}`);
    }
  }
  for (const dir of OWNER_DIRS) {
    const srcAbs = path.join(root, dir);
    if (fs.existsSync(srcAbs) && fs.statSync(srcAbs).isDirectory()) {
      copyDirRecursive(srcAbs, path.join(ownerStateDir, dir), `owner-state/${dir}`, recordedRelPaths);
    }
  }
  const restoreRel = "RESTORE.md";
  fs.writeFileSync(
    path.join(snapshotDir, restoreRel),
    buildRestoreInstructions(snapshotName, hasGitBundle),
    "utf8"
  );
  recordedRelPaths.push(restoreRel);
  const entries = recordedRelPaths.sort().map((relPath) => {
    const abs = path.join(snapshotDir, relPath);
    const stat = fs.statSync(abs);
    return {
      relPath,
      bytes: stat.size,
      sha256: sha256File(abs)
    };
  });
  const manifest = {
    createdAt: now.toISOString(),
    vaultRoot: root,
    hasGitBundle,
    entries
  };
  fs.writeFileSync(path.join(snapshotDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  const verified = verifySnapshotIntegrity(snapshotDir);
  if (!verified) {
    throw new Error(`Backup integrity verification failed for ${snapshotDir}`);
  }
  const pruned = pruneSnapshots(backupRoot, options.retention);
  return {
    snapshotDir,
    manifest,
    verified,
    pruned
  };
}
function main() {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf("--out");
  const backupRoot = outIdx !== -1 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : void 0;
  const root = process.cwd();
  const result = backupVault(root, { backupRoot });
  console.log("\u{1F6E1}\uFE0F  Vault Deterministic Backup (`no_agent`)");
  console.log("=".repeat(40));
  console.log(`\u{1F4E6} Snapshot: ${result.snapshotDir}`);
  console.log(`\u{1F9EC} Git Bundle: ${result.manifest.hasGitBundle ? "\u2705 included" : "\u2139\uFE0F skipped (no git HEAD)"}`);
  console.log(`\u{1F512} Verified Artifacts (${result.manifest.entries.length}):`);
  for (const entry of result.manifest.entries) {
    console.log(`   - ${entry.relPath} (${entry.bytes} bytes, sha256:${entry.sha256.slice(0, 12)})`);
  }
  if (result.pruned.length > 0) {
    console.log(`\u{1F9F9} Pruned ${result.pruned.length} expired snapshot(s): ${result.pruned.join(", ")}`);
  }
  console.log("=".repeat(40));
  console.log("\u2705 Integrity verified. Restore guide written to RESTORE.md.");
}
if (require.main === module) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  backupVault,
  main,
  pruneSnapshots,
  verifySnapshotIntegrity
});
