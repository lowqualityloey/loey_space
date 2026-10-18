// Deterministic `no_agent` backup utility for `loey_space`.
//
// `git push` protects tracked notes, but the owner's durable memory (`memory.md`),
// session handoff (`handoff.md`), machine environment (`.env`), and private records
// (`.secrets/`) are git-ignored by design. If the local disk or WSL mount fails, a
// fresh clone alone cannot recover them.
//
// This script runs with zero LLM involvement:
//   1. Bundles the Git repository (`git bundle create`) when commits exist.
//   2. Copies present owner-only ignored files (`memory.md`, `handoff.md`, `.env`,
//      `.secrets/`) into an isolated `owner-state/` subfolder.
//   3. Writes self-contained `RESTORE.md` instructions into the snapshot.
//   4. Computes and re-verifies SHA-256 checksums (`manifest.json`) after copy.
//   5. Enforces a 7-daily / 4-weekly / 6-monthly retention policy on `snapshot-*`
//      directories under the backup root.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';

export interface ManifestEntry {
  relPath: string;
  bytes: number;
  sha256: string;
}

export type GitBundleStatus = 'included' | 'no-head' | 'failed';

export interface BackupManifest {
  createdAt: string;
  vaultRoot: string;
  hasGitBundle: boolean;
  gitBundleStatus?: GitBundleStatus;
  entries: ManifestEntry[];
}

export interface BackupResult {
  snapshotDir: string;
  manifest: BackupManifest;
  verified: boolean;
  pruned: string[];
}

export interface RetentionOptions {
  daily?: number;
  weekly?: number;
  monthly?: number;
}

export interface BackupOptions {
  backupRoot?: string;
  now?: Date;
  retention?: RetentionOptions;
  gitExecutable?: string;
}

export const OWNER_FILES = ['memory.md', 'handoff.md', '.env', 'PROMPTKIT.md'];
export const OWNER_DIRS = [
  '.secrets',
  '00-Private',
  '00-Inbox',
  '01-Daily',
  '02-Projects',
  '03-Dev',
  '04-Learning',
  '05-Personal',
  '06-Resources/Guides',
  '06-Resources/Articles',
  '07-Reviews',
  '08-Concepts',
  '99-Attachments',
  'docs',
];

function sha256File(absPath: string): string {
  const bytes = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function copyDirRecursive(srcDir: string, destDir: string, relPrefix: string, recorded: string[]): void {
  fs.mkdirSync(destDir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(destDir, 0o700);
  } catch (_) {}
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
        fs.chmodSync(destAbs, 0o600);
      } catch (_) {}
      recorded.push(rel);
    }
  }
}

function copyPluginRuntimeSettings(root: string, ownerStateDir: string, recorded: string[]): void {
  const pluginsDir = path.join(root, '.obsidian', 'plugins');
  if (!fs.existsSync(pluginsDir) || !fs.statSync(pluginsDir).isDirectory()) return;

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const dataSrc = path.join(pluginsDir, entry.name, 'data.json');
    if (fs.existsSync(dataSrc) && fs.statSync(dataSrc).isFile()) {
      const rel = `.obsidian/plugins/${entry.name}/data.json`;
      const dataDest = path.join(ownerStateDir, rel);
      fs.mkdirSync(path.dirname(dataDest), { recursive: true, mode: 0o700 });
      try {
        fs.chmodSync(path.dirname(dataDest), 0o700);
      } catch (_) {}
      fs.copyFileSync(dataSrc, dataDest);
      try {
        fs.chmodSync(dataDest, 0o600);
      } catch (_) {}
      recorded.push(`owner-state/${rel}`);
    }
  }
}

function buildRestoreInstructions(snapshotName: string, gitBundleStatus: GitBundleStatus): string {
  return [
    `# 🔄 Self-Restore Instructions (${snapshotName})`,
    '',
    'This backup archive was generated deterministically (`no_agent`). Run these steps from inside this snapshot directory to restore a fresh instance of `loey_space`:',
    '',
    '## 1. Verify Snapshot Integrity',
    '```bash',
    'node -e \'const fs=require("fs"),crypto=require("crypto"),m=JSON.parse(fs.readFileSync("manifest.json","utf8"));for(const e of m.entries){const h=crypto.createHash("sha256").update(fs.readFileSync(e.relPath)).digest("hex");if(h!==e.sha256)throw new Error("Checksum mismatch: "+e.relPath);}console.log("Integrity OK:",m.entries.length,"files");\'',
    '```',
    '',
    '## 2. Restore Git Repository',
    gitBundleStatus === 'included'
      ? [
          '```bash',
          'SNAPSHOT_DIR="$(pwd)"',
          'RESTORE_DIR="${RESTORE_DIR:-./loey_space}"',
          'git clone "$SNAPSHOT_DIR/repo.bundle" "$RESTORE_DIR"',
          '```',
        ].join('\n')
      : gitBundleStatus === 'failed'
      ? '_⚠️ Git bundle creation failed during this snapshot; clone from your remote origin or a prior snapshot bundle into `"$RESTORE_DIR"` first._'
      : '_No git bundle was present at snapshot time (no git HEAD); clone from your remote origin into `"$RESTORE_DIR"` first._',
    '',
    '## 3. Restore Owner-Only & Working-Tree State',
    'Overlay `owner-state/` (`memory.md`, `handoff.md`, `.env`, `PROMPTKIT.md`, `.secrets/`, `00-Private/`, knowledge folders, `06-Resources/Guides/` & `Articles/`, `99-Attachments/`, `docs/`, and `.obsidian/plugins/*/data.json`) onto the restored working tree. Conflict policy: `cp -r` overwrites files checked out from `repo.bundle` so uncommitted working-tree edits captured in `owner-state/` take precedence over older committed versions:',
    '```bash',
    'SNAPSHOT_DIR="${SNAPSHOT_DIR:-$(pwd)}"',
    'RESTORE_DIR="${RESTORE_DIR:-./loey_space}"',
    'mkdir -p "$RESTORE_DIR"',
    'cp -r "$SNAPSHOT_DIR/owner-state/." "$RESTORE_DIR/"',
    'cd "$RESTORE_DIR"',
    'git status -s',
    '```',
    '_Explicit exclusions (regenerated on setup): `node_modules/`, `.git/`, and transient OS/editor caches._',
    '',
    '## 4. Verify Vault Health',
    '```bash',
    'npm install',
    'npm run hygiene -- --check-rot',
    'npm run audit-links',
    '```',
    '',
  ].join('\n');
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * A snapshot directory name split into the parts that decide which snapshot is newer.
 *
 * The disambiguation suffix is numeric (`-<ms>` then `-<ms>-<counter>`), so a lexical sort of the
 * names is wrong: `-123-9` sorts after `-123-10` as text even though it is older. Ordering is done
 * on these parsed numbers instead, and a name this parser does not recognise is not a snapshot
 * this code may prune.
 */
interface SnapshotKey {
  name: string;
  /** `YYYY-MM-DD_HHMMSS` — the second-precision identity shared by every name at one instant. */
  stamp: string;
  /** Collision millisecond, or -1 when the name carries no suffix (the first snapshot that second). */
  ms: number;
  /** Collision counter, or 0 when absent. */
  counter: number;
}

function parseSnapshotName(name: string): SnapshotKey | null {
  const match = name.match(/^snapshot-(\d{4}-\d{2}-\d{2})_(\d{6})(?:-(\d{1,3}))?(?:-(\d+))?$/);
  if (!match) return null;
  return {
    name,
    stamp: `${match[1]}_${match[2]}`,
    ms: match[3] === undefined ? -1 : Number(match[3]),
    counter: match[4] === undefined ? 0 : Number(match[4]),
  };
}

/** Oldest first. Numeric on every component so counters roll over 9 → 10 in the right order. */
function compareSnapshotKeys(a: SnapshotKey, b: SnapshotKey): number {
  if (a.stamp !== b.stamp) return a.stamp < b.stamp ? -1 : 1;
  if (a.ms !== b.ms) return a.ms - b.ms;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/**
 * Whether a `snapshot-*` directory holds a published snapshot rather than an abandoned reservation.
 *
 * Publication reserves the destination with an exclusive `mkdir` and then renames the verified
 * staging tree into it, so a process killed between those two steps leaves an empty directory
 * carrying a perfect snapshot name. Such a directory holds nothing to keep: counting it as a
 * snapshot would let it consume a retention slot — and, because it is the newest name, the whole
 * slot for its day — and prune away the last real backup.
 *
 * `manifest.json` is written and verified inside staging before the rename, so a readable manifest
 * that declares its entry list is the marker of a completed publication. A missing, truncated or
 * unparseable manifest means the tree was never a restore point, and retention may not spend a
 * quota slot on it. The full SHA-256 check stays where it belongs — on the freshly published
 * snapshot (`verifySnapshotIntegrity`) — because re-hashing every retained snapshot on every backup
 * would cost the whole backup set on each run to answer a question this marker already answers.
 *
 * Reservations are deliberately left on disk rather than reclaimed here: a live publisher holds one
 * between `mkdir` and `rename`, and deleting it would turn that publisher's atomic promotion into a
 * lost backup. Reclaiming abandoned ones safely needs proof that no peer is mid-publish, which a
 * pruning pass cannot obtain, so this pass never touches them.
 */
function isPublishedSnapshot(dir: string): boolean {
  try {
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.statSync(manifestPath).isFile()) return false;
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { entries?: unknown };
    return Array.isArray(parsed.entries);
  } catch {
    return false;
  }
}

export function pruneSnapshots(backupRoot: string, retention: RetentionOptions = {}): string[] {
  const dailyMax = retention.daily ?? 7;
  const weeklyMax = retention.weekly ?? 4;
  const monthlyMax = retention.monthly ?? 6;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(backupRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const snapshots = entries
    .filter((e) => e.isDirectory())
    .map((e) => parseSnapshotName(e.name))
    .filter((key): key is SnapshotKey => key !== null)
    .filter((key) => isPublishedSnapshot(path.join(backupRoot, key.name)))
    .sort(compareSnapshotKeys)
    .reverse() // newest first
    .map((key) => key.name);

  const keep = new Set<string>();
  const seenDays = new Set<string>();
  const seenWeeks = new Set<string>();
  const seenMonths = new Set<string>();

  // Always keep all snapshots from the current/newest date (intraday snapshots of active session)
  const latestDate =
    snapshots.length > 0 ? snapshots[0].slice('snapshot-'.length, 'snapshot-YYYY-MM-DD'.length) : null;

  for (const name of snapshots) {
    const datePart = name.slice('snapshot-'.length, 'snapshot-YYYY-MM-DD'.length);
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

  const pruned: string[] = [];
  for (const name of snapshots) {
    if (!keep.has(name)) {
      fs.rmSync(path.join(backupRoot, name), { recursive: true, force: true });
      pruned.push(name);
    }
  }
  return pruned.sort();
}

export function verifySnapshotIntegrity(snapshotDir: string): boolean {
  const manifestPath = path.join(snapshotDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
  for (const entry of manifest.entries) {
    const abs = path.join(snapshotDir, entry.relPath);
    if (!fs.existsSync(abs)) return false;
    const stat = fs.statSync(abs);
    if (stat.size !== entry.bytes) return false;
    if (sha256File(abs) !== entry.sha256) return false;
  }
  return true;
}

/** The first candidate keeps the historical name; collisions add `-<ms>` then `-<ms>-<counter>`. */
function candidateSnapshotName(baseTimestamp: string, now: Date, attempt: number): string {
  if (attempt <= 1) return `snapshot-${baseTimestamp}`;
  const ms = String(now.getUTCMilliseconds()).padStart(3, '0');
  if (attempt === 2) return `snapshot-${baseTimestamp}-${ms}`;
  return `snapshot-${baseTimestamp}-${ms}-${attempt - 2}`;
}

/**
 * Publish a verified staging tree under the first name that can be reserved.
 *
 * The reservation is `mkdir` (atomic and exclusive), not `existsSync`, so two concurrent backups
 * ending in the same second cannot both claim one destination: the loser advances to the next
 * candidate and still publishes. The reservation is removed again if the promotion itself fails,
 * so a failed publish leaves no empty snapshot directory behind.
 */
function reserveAndPublish(
  backupRoot: string,
  stagingDir: string,
  baseTimestamp: string,
  now: Date
): { name: string; dir: string } {
  const limit = 200;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const name = candidateSnapshotName(baseTimestamp, now, attempt);
    const dir = path.join(backupRoot, name);
    try {
      fs.mkdirSync(dir, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw error;
    }
    try {
      // POSIX `rename` atomically replaces the empty directory this process just reserved.
      fs.renameSync(stagingDir, dir);
      return { name, dir };
    } catch (error) {
      try {
        fs.rmdirSync(dir);
      } catch (_) {}
      throw error;
    }
  }
  throw new Error(`Backup publication failed: no free snapshot name at ${baseTimestamp} (${limit} attempts).`);
}

export function backupVault(root: string, options: BackupOptions = {}): BackupResult {
  const now = options.now ?? new Date();
  const backupRoot = options.backupRoot ?? path.join(os.homedir(), '.loey_backups');
  const gitBin = options.gitExecutable ?? 'git';

  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(backupRoot, 0o700);
  } catch (_) {}

  // Determine non-colliding snapshot directory name
  const baseTimestamp = formatTimestamp(now);
  let snapshotName = `snapshot-${baseTimestamp}`;
  let snapshotDir = path.join(backupRoot, snapshotName);

  if (fs.existsSync(snapshotDir)) {
    const ms = String(now.getUTCMilliseconds()).padStart(3, '0');
    snapshotName = `snapshot-${baseTimestamp}-${ms}`;
    snapshotDir = path.join(backupRoot, snapshotName);
    let counter = 1;
    while (fs.existsSync(snapshotDir)) {
      snapshotName = `snapshot-${baseTimestamp}-${ms}-${counter++}`;
      snapshotDir = path.join(backupRoot, snapshotName);
    }
  }

  // Build inside an isolated staging directory to ensure partial/interrupted backups are never published
  const stagingDir = path.join(
    backupRoot,
    `.${snapshotName}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
  );
  fs.mkdirSync(stagingDir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(stagingDir, 0o700);
  } catch (_) {}

  const recordedRelPaths: string[] = [];

  try {
    // 1. Create Git bundle if repository has commits, separating "no HEAD" from bundle creation failure
    let hasGitBundle = false;
    let gitBundleStatus: GitBundleStatus = 'no-head';
    const bundleRel = 'repo.bundle';
    const bundleAbs = path.join(stagingDir, bundleRel);
    let hasGitHead = false;
    try {
      execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
        cwd: root,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      hasGitHead = true;
    } catch {
      hasGitHead = false;
    }

    if (hasGitHead) {
      try {
        execFileSync(gitBin, ['bundle', 'create', bundleAbs, '--all'], {
          cwd: root,
          stdio: ['ignore', 'ignore', 'ignore'],
        });
        if (fs.existsSync(bundleAbs)) {
          try {
            fs.chmodSync(bundleAbs, 0o600);
          } catch (_) {}
          hasGitBundle = true;
          gitBundleStatus = 'included';
          recordedRelPaths.push(bundleRel);
        } else {
          gitBundleStatus = 'failed';
        }
      } catch {
        gitBundleStatus = 'failed';
      }
    }

    // 2. Copy owner-only ignored files into owner-state/
    const ownerStateDir = path.join(stagingDir, 'owner-state');
    fs.mkdirSync(ownerStateDir, { recursive: true, mode: 0o700 });
    try {
      fs.chmodSync(ownerStateDir, 0o700);
    } catch (_) {}
    for (const file of OWNER_FILES) {
      const srcAbs = path.join(root, file);
      if (fs.existsSync(srcAbs) && fs.statSync(srcAbs).isFile()) {
        const destAbs = path.join(ownerStateDir, file);
        fs.mkdirSync(path.dirname(destAbs), { recursive: true, mode: 0o700 });
        try {
          fs.chmodSync(path.dirname(destAbs), 0o700);
        } catch (_) {}
        fs.copyFileSync(srcAbs, destAbs);
        try {
          fs.chmodSync(destAbs, 0o600);
        } catch (_) {}
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

    // 3. Write RESTORE.md instructions
    const restoreRel = 'RESTORE.md';
    const restoreAbs = path.join(stagingDir, restoreRel);
    fs.writeFileSync(
      restoreAbs,
      buildRestoreInstructions(snapshotName, gitBundleStatus),
      { encoding: 'utf8', mode: 0o600 }
    );
    try {
      fs.chmodSync(restoreAbs, 0o600);
    } catch (_) {}
    recordedRelPaths.push(restoreRel);

    // 4. Generate manifest.json with SHA-256 checksums
    const entries: ManifestEntry[] = recordedRelPaths.sort().map((relPath) => {
      const abs = path.join(stagingDir, relPath);
      const stat = fs.statSync(abs);
      return {
        relPath,
        bytes: stat.size,
        sha256: sha256File(abs),
      };
    });

    const manifest: BackupManifest = {
      createdAt: now.toISOString(),
      vaultRoot: root,
      hasGitBundle,
      gitBundleStatus,
      entries,
    };
    const manifestAbs = path.join(stagingDir, 'manifest.json');
    fs.writeFileSync(manifestAbs, JSON.stringify(manifest, null, 2), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(manifestAbs, 0o600);
    } catch (_) {}

    // 5. Verify integrity immediately in staging before publishing
    const verified = verifySnapshotIntegrity(stagingDir);
    if (!verified) {
      throw new Error(`Backup integrity verification failed for staging snapshot`);
    }

    // 6. Publish: reserve a destination name exclusively, then promote the verified staging tree
    //    into it. `existsSync` cannot reserve a name — two processes can both observe it free — so
    //    the reservation is an exclusive `mkdir`, and a lost race simply tries the next candidate
    //    instead of discarding a completed, verified snapshot.
    const published = reserveAndPublish(backupRoot, stagingDir, baseTimestamp, now);
    snapshotName = published.name;
    snapshotDir = published.dir;
    try {
      fs.chmodSync(snapshotDir, 0o700);
    } catch (_) {}

    // 7. Prune old snapshots according to retention policy — skip pruning if git bundle creation failed
    const pruned = gitBundleStatus === 'failed' ? [] : pruneSnapshots(backupRoot, options.retention);

    return {
      snapshotDir,
      manifest,
      verified,
      pruned,
    };
  } catch (err) {
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    throw err;
  }
}

export function main(): void {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  const backupRoot = outIdx !== -1 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : undefined;
  const root = process.cwd();

  const result = backupVault(root, { backupRoot });
  const bundleLabel =
    result.manifest.gitBundleStatus === 'included'
      ? '✅ included'
      : result.manifest.gitBundleStatus === 'failed'
      ? '⚠️ failed (git bundle creation error; pruning skipped)'
      : 'ℹ️ skipped (no git HEAD)';
  console.log('🛡️  Vault Deterministic Backup (`no_agent`)');
  console.log('='.repeat(40));
  console.log(`📦 Snapshot: ${result.snapshotDir}`);
  console.log(`🧬 Git Bundle: ${bundleLabel}`);
  console.log(`🔒 Verified Artifacts (${result.manifest.entries.length}):`);
  for (const entry of result.manifest.entries) {
    console.log(`   - ${entry.relPath} (${entry.bytes} bytes, sha256:${entry.sha256.slice(0, 12)})`);
  }
  if (result.pruned.length > 0) {
    console.log(`🧹 Pruned ${result.pruned.length} expired snapshot(s): ${result.pruned.join(', ')}`);
  }
  console.log('='.repeat(40));
  console.log('✅ Integrity verified. Restore guide written to RESTORE.md.');
  if (result.manifest.gitBundleStatus === 'failed') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
