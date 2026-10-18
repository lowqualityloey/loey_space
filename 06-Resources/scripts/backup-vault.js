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
  OWNER_DIRS: () => OWNER_DIRS,
  OWNER_FILES: () => OWNER_FILES,
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
var OWNER_FILES = ["memory.md", "handoff.md", ".env", "PROMPTKIT.md"];
var OWNER_DIRS = [
  ".secrets",
  "00-Private",
  "00-Inbox",
  "01-Daily",
  "02-Projects",
  "03-Dev",
  "04-Learning",
  "05-Personal",
  "06-Resources/Guides",
  "06-Resources/Articles",
  "07-Reviews",
  "08-Concepts",
  "99-Attachments",
  "docs"
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
  fs.mkdirSync(destDir, { recursive: true, mode: 448 });
  try {
    fs.chmodSync(destDir, 448);
  } catch (_) {
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const srcAbs = path.join(srcDir, entry.name);
    const destAbs = path.join(destDir, entry.name);
    const rel = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      copyDirRecursive(srcAbs, destAbs, rel, recorded);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcAbs, destAbs);
      try {
        fs.chmodSync(destAbs, 384);
      } catch (_) {
      }
      recorded.push(rel);
    }
  }
}
function copyPluginRuntimeSettings(root, ownerStateDir, recorded) {
  const pluginsDir = path.join(root, ".obsidian", "plugins");
  if (!fs.existsSync(pluginsDir) || !fs.statSync(pluginsDir).isDirectory())
    return;
  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory())
      continue;
    const dataSrc = path.join(pluginsDir, entry.name, "data.json");
    if (fs.existsSync(dataSrc) && fs.statSync(dataSrc).isFile()) {
      const rel = `.obsidian/plugins/${entry.name}/data.json`;
      const dataDest = path.join(ownerStateDir, rel);
      fs.mkdirSync(path.dirname(dataDest), { recursive: true, mode: 448 });
      try {
        fs.chmodSync(path.dirname(dataDest), 448);
      } catch (_) {
      }
      fs.copyFileSync(dataSrc, dataDest);
      try {
        fs.chmodSync(dataDest, 384);
      } catch (_) {
      }
      recorded.push(`owner-state/${rel}`);
    }
  }
}
function buildRestoreInstructions(snapshotName, gitBundleStatus) {
  return [
    `# \u{1F504} Self-Restore Instructions (${snapshotName})`,
    "",
    "This backup archive was generated deterministically (`no_agent`). Run these steps from inside this snapshot directory to restore a fresh instance of `loey_space`:",
    "",
    "## 1. Verify Snapshot Integrity",
    "```bash",
    `node -e 'const fs=require("fs"),crypto=require("crypto"),m=JSON.parse(fs.readFileSync("manifest.json","utf8"));for(const e of m.entries){const h=crypto.createHash("sha256").update(fs.readFileSync(e.relPath)).digest("hex");if(h!==e.sha256)throw new Error("Checksum mismatch: "+e.relPath);}console.log("Integrity OK:",m.entries.length,"files");'`,
    "```",
    "",
    "## 2. Restore Git Repository",
    gitBundleStatus === "included" ? [
      "```bash",
      'SNAPSHOT_DIR="$(pwd)"',
      'RESTORE_DIR="${RESTORE_DIR:-./loey_space}"',
      'git clone "$SNAPSHOT_DIR/repo.bundle" "$RESTORE_DIR"',
      "```"
    ].join("\n") : gitBundleStatus === "failed" ? '_\u26A0\uFE0F Git bundle creation failed during this snapshot; clone from your remote origin or a prior snapshot bundle into `"$RESTORE_DIR"` first._' : '_No git bundle was present at snapshot time (no git HEAD); clone from your remote origin into `"$RESTORE_DIR"` first._',
    "",
    "## 3. Restore Owner-Only & Working-Tree State",
    "Overlay `owner-state/` (`memory.md`, `handoff.md`, `.env`, `PROMPTKIT.md`, `.secrets/`, `00-Private/`, knowledge folders, `06-Resources/Guides/` & `Articles/`, `99-Attachments/`, `docs/`, and `.obsidian/plugins/*/data.json`) onto the restored working tree. Conflict policy: `cp -r` overwrites files checked out from `repo.bundle` so uncommitted working-tree edits captured in `owner-state/` take precedence over older committed versions:",
    "```bash",
    'SNAPSHOT_DIR="${SNAPSHOT_DIR:-$(pwd)}"',
    'RESTORE_DIR="${RESTORE_DIR:-./loey_space}"',
    'mkdir -p "$RESTORE_DIR"',
    'cp -r "$SNAPSHOT_DIR/owner-state/." "$RESTORE_DIR/"',
    'cd "$RESTORE_DIR"',
    "git status -s",
    "```",
    "_Explicit exclusions (regenerated on setup): `node_modules/`, `.git/`, and transient OS/editor caches._",
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
function parseSnapshotName(name) {
  const match = name.match(/^snapshot-(\d{4}-\d{2}-\d{2})_(\d{6})(?:-(\d{1,3}))?(?:-(\d+))?$/);
  if (!match)
    return null;
  return {
    name,
    stamp: `${match[1]}_${match[2]}`,
    ms: match[3] === void 0 ? -1 : Number(match[3]),
    counter: match[4] === void 0 ? 0 : Number(match[4])
  };
}
function compareSnapshotKeys(a, b) {
  if (a.stamp !== b.stamp)
    return a.stamp < b.stamp ? -1 : 1;
  if (a.ms !== b.ms)
    return a.ms - b.ms;
  if (a.counter !== b.counter)
    return a.counter - b.counter;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
function isPublishedSnapshot(dir) {
  try {
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.statSync(manifestPath).isFile())
      return false;
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return Array.isArray(parsed.entries);
  } catch {
    return false;
  }
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
  const snapshots = entries.filter((e) => e.isDirectory()).map((e) => parseSnapshotName(e.name)).filter((key) => key !== null).filter((key) => isPublishedSnapshot(path.join(backupRoot, key.name))).sort(compareSnapshotKeys).reverse().map((key) => key.name);
  const keep = /* @__PURE__ */ new Set();
  const seenDays = /* @__PURE__ */ new Set();
  const seenWeeks = /* @__PURE__ */ new Set();
  const seenMonths = /* @__PURE__ */ new Set();
  const latestDate = snapshots.length > 0 ? snapshots[0].slice("snapshot-".length, "snapshot-YYYY-MM-DD".length) : null;
  for (const name of snapshots) {
    const datePart = name.slice("snapshot-".length, "snapshot-YYYY-MM-DD".length);
    const monthKey = datePart.slice(0, 7);
    const weekKey = isoWeekKey(datePart);
    if (datePart === latestDate) {
      keep.add(name);
      seenDays.add(datePart);
      seenWeeks.add(weekKey);
      seenMonths.add(monthKey);
      continue;
    }
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
function candidateSnapshotName(baseTimestamp, now, attempt) {
  if (attempt <= 1)
    return `snapshot-${baseTimestamp}`;
  const ms = String(now.getUTCMilliseconds()).padStart(3, "0");
  if (attempt === 2)
    return `snapshot-${baseTimestamp}-${ms}`;
  return `snapshot-${baseTimestamp}-${ms}-${attempt - 2}`;
}
function reserveAndPublish(backupRoot, stagingDir, baseTimestamp, now) {
  const limit = 200;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const name = candidateSnapshotName(baseTimestamp, now, attempt);
    const dir = path.join(backupRoot, name);
    try {
      fs.mkdirSync(dir, { mode: 448 });
    } catch (error) {
      if (error.code === "EEXIST")
        continue;
      throw error;
    }
    try {
      fs.renameSync(stagingDir, dir);
      return { name, dir };
    } catch (error) {
      try {
        fs.rmdirSync(dir);
      } catch (_) {
      }
      throw error;
    }
  }
  throw new Error(`Backup publication failed: no free snapshot name at ${baseTimestamp} (${limit} attempts).`);
}
function backupVault(root, options = {}) {
  const now = options.now ?? /* @__PURE__ */ new Date();
  const backupRoot = options.backupRoot ?? path.join(os.homedir(), ".loey_backups");
  const gitBin = options.gitExecutable ?? "git";
  fs.mkdirSync(backupRoot, { recursive: true, mode: 448 });
  try {
    fs.chmodSync(backupRoot, 448);
  } catch (_) {
  }
  const baseTimestamp = formatTimestamp(now);
  let snapshotName = `snapshot-${baseTimestamp}`;
  let snapshotDir = path.join(backupRoot, snapshotName);
  if (fs.existsSync(snapshotDir)) {
    const ms = String(now.getUTCMilliseconds()).padStart(3, "0");
    snapshotName = `snapshot-${baseTimestamp}-${ms}`;
    snapshotDir = path.join(backupRoot, snapshotName);
    let counter = 1;
    while (fs.existsSync(snapshotDir)) {
      snapshotName = `snapshot-${baseTimestamp}-${ms}-${counter++}`;
      snapshotDir = path.join(backupRoot, snapshotName);
    }
  }
  const stagingDir = path.join(
    backupRoot,
    `.${snapshotName}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
  );
  fs.mkdirSync(stagingDir, { recursive: true, mode: 448 });
  try {
    fs.chmodSync(stagingDir, 448);
  } catch (_) {
  }
  const recordedRelPaths = [];
  try {
    let hasGitBundle = false;
    let gitBundleStatus = "no-head";
    const bundleRel = "repo.bundle";
    const bundleAbs = path.join(stagingDir, bundleRel);
    let hasGitHead = false;
    try {
      (0, import_child_process.execFileSync)("git", ["rev-parse", "--verify", "HEAD"], {
        cwd: root,
        stdio: ["ignore", "ignore", "ignore"]
      });
      hasGitHead = true;
    } catch {
      hasGitHead = false;
    }
    if (hasGitHead) {
      try {
        (0, import_child_process.execFileSync)(gitBin, ["bundle", "create", bundleAbs, "--all"], {
          cwd: root,
          stdio: ["ignore", "ignore", "ignore"]
        });
        if (fs.existsSync(bundleAbs)) {
          try {
            fs.chmodSync(bundleAbs, 384);
          } catch (_) {
          }
          hasGitBundle = true;
          gitBundleStatus = "included";
          recordedRelPaths.push(bundleRel);
        } else {
          gitBundleStatus = "failed";
        }
      } catch {
        gitBundleStatus = "failed";
      }
    }
    const ownerStateDir = path.join(stagingDir, "owner-state");
    fs.mkdirSync(ownerStateDir, { recursive: true, mode: 448 });
    try {
      fs.chmodSync(ownerStateDir, 448);
    } catch (_) {
    }
    for (const file of OWNER_FILES) {
      const srcAbs = path.join(root, file);
      if (fs.existsSync(srcAbs) && fs.statSync(srcAbs).isFile()) {
        const destAbs = path.join(ownerStateDir, file);
        fs.mkdirSync(path.dirname(destAbs), { recursive: true, mode: 448 });
        try {
          fs.chmodSync(path.dirname(destAbs), 448);
        } catch (_) {
        }
        fs.copyFileSync(srcAbs, destAbs);
        try {
          fs.chmodSync(destAbs, 384);
        } catch (_) {
        }
        recordedRelPaths.push(`owner-state/${file}`);
      }
    }
    for (const dir of OWNER_DIRS) {
      const srcAbs = path.join(root, dir);
      if (fs.existsSync(srcAbs) && fs.statSync(srcAbs).isDirectory()) {
        copyDirRecursive(srcAbs, path.join(ownerStateDir, dir), `owner-state/${dir}`, recordedRelPaths);
      }
    }
    copyPluginRuntimeSettings(root, ownerStateDir, recordedRelPaths);
    const restoreRel = "RESTORE.md";
    const restoreAbs = path.join(stagingDir, restoreRel);
    fs.writeFileSync(
      restoreAbs,
      buildRestoreInstructions(snapshotName, gitBundleStatus),
      { encoding: "utf8", mode: 384 }
    );
    try {
      fs.chmodSync(restoreAbs, 384);
    } catch (_) {
    }
    recordedRelPaths.push(restoreRel);
    const entries = recordedRelPaths.sort().map((relPath) => {
      const abs = path.join(stagingDir, relPath);
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
      gitBundleStatus,
      entries
    };
    const manifestAbs = path.join(stagingDir, "manifest.json");
    fs.writeFileSync(manifestAbs, JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 384 });
    try {
      fs.chmodSync(manifestAbs, 384);
    } catch (_) {
    }
    const verified = verifySnapshotIntegrity(stagingDir);
    if (!verified) {
      throw new Error(`Backup integrity verification failed for staging snapshot`);
    }
    const published = reserveAndPublish(backupRoot, stagingDir, baseTimestamp, now);
    snapshotName = published.name;
    snapshotDir = published.dir;
    try {
      fs.chmodSync(snapshotDir, 448);
    } catch (_) {
    }
    const pruned = gitBundleStatus === "failed" ? [] : pruneSnapshots(backupRoot, options.retention);
    return {
      snapshotDir,
      manifest,
      verified,
      pruned
    };
  } catch (err) {
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    throw err;
  }
}
function main() {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf("--out");
  const backupRoot = outIdx !== -1 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : void 0;
  const root = process.cwd();
  const result = backupVault(root, { backupRoot });
  const bundleLabel = result.manifest.gitBundleStatus === "included" ? "\u2705 included" : result.manifest.gitBundleStatus === "failed" ? "\u26A0\uFE0F failed (git bundle creation error; pruning skipped)" : "\u2139\uFE0F skipped (no git HEAD)";
  console.log("\u{1F6E1}\uFE0F  Vault Deterministic Backup (`no_agent`)");
  console.log("=".repeat(40));
  console.log(`\u{1F4E6} Snapshot: ${result.snapshotDir}`);
  console.log(`\u{1F9EC} Git Bundle: ${bundleLabel}`);
  console.log(`\u{1F512} Verified Artifacts (${result.manifest.entries.length}):`);
  for (const entry of result.manifest.entries) {
    console.log(`   - ${entry.relPath} (${entry.bytes} bytes, sha256:${entry.sha256.slice(0, 12)})`);
  }
  if (result.pruned.length > 0) {
    console.log(`\u{1F9F9} Pruned ${result.pruned.length} expired snapshot(s): ${result.pruned.join(", ")}`);
  }
  console.log("=".repeat(40));
  console.log("\u2705 Integrity verified. Restore guide written to RESTORE.md.");
  if (result.manifest.gitBundleStatus === "failed") {
    process.exitCode = 1;
  }
}
if (require.main === module) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OWNER_DIRS,
  OWNER_FILES,
  backupVault,
  main,
  pruneSnapshots,
  verifySnapshotIntegrity
});
