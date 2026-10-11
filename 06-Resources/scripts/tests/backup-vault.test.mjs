import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { backupVault, verifySnapshotIntegrity, pruneSnapshots } from '../backup-vault.js';

const BUNDLE = fileURLToPath(new URL('../backup-vault.js', import.meta.url));

function makeVaultFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backup-vault-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return root;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('backupVault packages git bundle, owner-state files, RESTORE.md, and verifies SHA-256 manifest', () => {
  const vaultRoot = makeVaultFixture({
    'Home.md': '# Home\n',
    'memory.md': '# Core Memory Rule: durable facts only\nSECRET-MEMORY-SENTINEL-1122\n',
    'handoff.md': '# Handoff\n',
    '.env': 'FIXTURE_VAR=ENV-SENTINEL-9988\n',
    '.secrets/vault-keys.md': 'PRIVATE-SECRET-SENTINEL-5544\n',
  });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-out-'));

  try {
    execFileSync('git', ['init', '-q'], { cwd: vaultRoot });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: vaultRoot });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: vaultRoot });
    execFileSync('git', ['add', 'Home.md'], { cwd: vaultRoot });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: vaultRoot });

    const now = new Date('2026-10-11T12:00:00Z');
    const result = backupVault(vaultRoot, { backupRoot, now });

    assert.equal(result.verified, true);
    assert.equal(result.manifest.hasGitBundle, true);

    const relPaths = result.manifest.entries.map((e) => e.relPath).sort();
    assert.deepEqual(relPaths, [
      'RESTORE.md',
      'owner-state/.env',
      'owner-state/.secrets/vault-keys.md',
      'owner-state/handoff.md',
      'owner-state/memory.md',
      'repo.bundle',
    ]);

    // Corrupted file must fail integrity check
    fs.appendFileSync(path.join(result.snapshotDir, 'owner-state/memory.md'), 'corrupted');
    assert.equal(verifySnapshotIntegrity(result.snapshotDir), false);
  } finally {
    cleanup(vaultRoot);
    cleanup(backupRoot);
  }
});

test('backupVault CLI never echoes secret file contents to stdout or stderr', () => {
  const vaultRoot = makeVaultFixture({
    'Home.md': '# Home\n',
    'memory.md': 'MEM-SENTINEL-8877\n',
    '.env': 'ENV-SENTINEL-6655\n',
    '.secrets/token.txt': 'SEC-SENTINEL-4433\n',
  });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-cli-'));

  try {
    const spawned = spawnSync(process.execPath, [BUNDLE, '--out', backupRoot], {
      cwd: vaultRoot,
      encoding: 'utf8',
    });
    assert.equal(spawned.status, 0);
    const out = `${spawned.stdout}${spawned.stderr}`;
    for (const sentinel of ['MEM-SENTINEL-8877', 'ENV-SENTINEL-6655', 'SEC-SENTINEL-4433']) {
      assert.ok(!out.includes(sentinel), `CLI output must not leak ${sentinel}`);
    }
    assert.match(out, /Integrity verified/);
  } finally {
    cleanup(vaultRoot);
    cleanup(backupRoot);
  }
});

test('pruneSnapshots retains daily, weekly, and monthly snapshots and prunes excess', () => {
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-prune-'));
  try {
    // Create 5 snapshots on consecutive days with daily=2, weekly=1, monthly=1
    const names = [
      'snapshot-2026-10-01_120000',
      'snapshot-2026-10-02_120000',
      'snapshot-2026-10-03_120000',
      'snapshot-2026-10-04_120000',
      'snapshot-2026-10-05_120000',
    ];
    for (const name of names) {
      fs.mkdirSync(path.join(backupRoot, name), { recursive: true });
    }

    const pruned = pruneSnapshots(backupRoot, { daily: 2, weekly: 1, monthly: 1 });
    assert.deepEqual(pruned, [
      'snapshot-2026-10-01_120000',
      'snapshot-2026-10-02_120000',
      'snapshot-2026-10-03_120000',
    ]);
  } finally {
    cleanup(backupRoot);
  }
});
