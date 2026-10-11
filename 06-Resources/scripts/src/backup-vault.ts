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

export interface BackupManifest {
  createdAt: string;
  vaultRoot: string;
  hasGitBundle: boolean;
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
}

const OWNER_FILES = ['memory.md', 'handoff.md', '.env'];
const OWNER_DIRS = [
  '.secrets',
  '00-Inbox',
  '01-Daily',
  '02-Projects',
  '03-Dev',
  '04-Learning',
  '05-Personal',
  '07-Reviews',
  '08-Concepts',
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

function buildRestoreInstructions(snapshotName: string, hasGitBundle: boolean): string {
  return [
    `# 🔄 Self-Restore Instructions (${snapshotName})`,
    '',
    'This backup archive was generated deterministically (`no_agent`). Follow these steps to restore a fresh instance of `loey_space`:',
    '',
    '## 1. Verify Snapshot Integrity',
    '```bash',
    'node -e \'const fs=require("fs"),crypto=require("crypto"),m=JSON.parse(fs.readFileSync("manifest.json","utf8"));for(const e of m.entries){const h=crypto.createHash("sha256").update(fs.readFileSync(e.relPath)).digest("hex");if(h!==e.sha256)throw new Error("Checksum mismatch: "+e.relPath);}console.log("Integrity OK:",m.entries.length,"files");\'',
    '```',
    '',
    '## 2. Restore Git Repository',
    hasGitBundle
      ? [
          '```bash',
          'git clone ./repo.bundle loey_space',
          'cd loey_space',
          '```',
        ].join('\n')
      : '_No git bundle was present at snapshot time; clone from your remote origin first._',
    '',
    '## 3. Restore Owner-Only Ignored State',
    'Copy the contents of `owner-state/` (`memory.md`, `handoff.md`, `.env`, `.secrets/`) into the root of your restored `loey_space` working tree:',
    '```bash',
    'cp -rn ./owner-state/. /path/to/loey_space/',
    '```',
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
    .filter((e) => e.isDirectory() && /^snapshot-\d{4}-\d{2}-\d{2}_\d{6}$/.test(e.name))
    .map((e) => e.name)
    .sort()
    .reverse(); // newest first

  const keep = new Set<string>();
  const seenDays = new Set<string>();
  const seenWeeks = new Set<string>();
  const seenMonths = new Set<string>();

  // Always keep the newest snapshot from this run
  if (snapshots.length > 0) keep.add(snapshots[0]);

  for (const name of snapshots) {
    const datePart = name.slice('snapshot-'.length, 'snapshot-YYYY-MM-DD'.length);
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

export function backupVault(root: string, options: BackupOptions = {}): BackupResult {
  const now = options.now ?? new Date();
  const backupRoot = options.backupRoot ?? path.join(os.homedir(), '.loey_backups');
  const snapshotName = `snapshot-${formatTimestamp(now)}`;
  const snapshotDir = path.join(backupRoot, snapshotName);

  fs.mkdirSync(snapshotDir, { recursive: true });
  const recordedRelPaths: string[] = [];

  // 1. Create Git bundle if repository has commits
  let hasGitBundle = false;
  const bundleRel = 'repo.bundle';
  const bundleAbs = path.join(snapshotDir, bundleRel);
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    execFileSync('git', ['bundle', 'create', bundleAbs, '--all'], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    if (fs.existsSync(bundleAbs)) {
      hasGitBundle = true;
      recordedRelPaths.push(bundleRel);
    }
  } catch {
    // Not a git worktree with commits; skip bundle
  }

  // 2. Copy owner-only ignored files into owner-state/
  const ownerStateDir = path.join(snapshotDir, 'owner-state');
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

  // 3. Write RESTORE.md instructions
  const restoreRel = 'RESTORE.md';
  fs.writeFileSync(
    path.join(snapshotDir, restoreRel),
    buildRestoreInstructions(snapshotName, hasGitBundle),
    'utf8'
  );
  recordedRelPaths.push(restoreRel);

  // 4. Generate manifest.json with SHA-256 checksums
  const entries: ManifestEntry[] = recordedRelPaths.sort().map((relPath) => {
    const abs = path.join(snapshotDir, relPath);
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
    entries,
  };
  fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // 5. Verify integrity immediately after write
  const verified = verifySnapshotIntegrity(snapshotDir);
  if (!verified) {
    throw new Error(`Backup integrity verification failed for ${snapshotDir}`);
  }

  // 6. Prune old snapshots according to retention policy
  const pruned = pruneSnapshots(backupRoot, options.retention);

  return {
    snapshotDir,
    manifest,
    verified,
    pruned,
  };
}

export function main(): void {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  const backupRoot = outIdx !== -1 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : undefined;
  const root = process.cwd();

  const result = backupVault(root, { backupRoot });
  console.log('🛡️  Vault Deterministic Backup (`no_agent`)');
  console.log('='.repeat(40));
  console.log(`📦 Snapshot: ${result.snapshotDir}`);
  console.log(`🧬 Git Bundle: ${result.manifest.hasGitBundle ? '✅ included' : 'ℹ️ skipped (no git HEAD)'}`);
  console.log(`🔒 Verified Artifacts (${result.manifest.entries.length}):`);
  for (const entry of result.manifest.entries) {
    console.log(`   - ${entry.relPath} (${entry.bytes} bytes, sha256:${entry.sha256.slice(0, 12)})`);
  }
  if (result.pruned.length > 0) {
    console.log(`🧹 Pruned ${result.pruned.length} expired snapshot(s): ${result.pruned.join(', ')}`);
  }
  console.log('='.repeat(40));
  console.log('✅ Integrity verified. Restore guide written to RESTORE.md.');
}

if (require.main === module) {
  main();
}
