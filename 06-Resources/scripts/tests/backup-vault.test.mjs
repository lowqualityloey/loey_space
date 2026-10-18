import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
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

/**
 * Fabricate a snapshot directory that retention must recognise.
 *
 * A real snapshot always carries the `manifest.json` written and verified inside staging before
 * publication, and retention treats a directory without one as an abandoned reservation rather
 * than a backup. Fixtures that only test ordering must therefore include the manifest; an empty
 * directory is a reservation, and the reservation cases are tested separately.
 */
function makePublishedSnapshot(backupRoot, name) {
  const dir = path.join(backupRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ entries: [], fixture: name }));
  return dir;
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
      makePublishedSnapshot(backupRoot, name);
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

test('backupVault enforces 0700 on directories and 0600 on files across POSIX filesystems', () => {
  if (process.platform === 'win32') return;

  const vaultRoot = makeVaultFixture({
    'Home.md': '# Home\n',
    'memory.md': 'SECRET-MEMORY\n',
    'handoff.md': '# Handoff\n',
    '.env': 'SECRET_KEY=1234\n',
    '.secrets/key.txt': 'SECRET_VAL\n',
  });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-perms-'));

  const prevUmask = process.umask(0o022);
  try {
    const now = new Date('2026-10-18T12:00:00Z');
    const result = backupVault(vaultRoot, { backupRoot, now });
    assert.equal(result.verified, true);

    const checkDirPerm = (dir) => {
      const mode = fs.statSync(dir).mode & 0o777;
      assert.equal(mode, 0o700, `Directory ${dir} must have mode 0700, got ${mode.toString(8)}`);
    };
    const checkFilePerm = (file) => {
      const mode = fs.statSync(file).mode & 0o777;
      assert.equal(mode, 0o600, `File ${file} must have mode 0600, got ${mode.toString(8)}`);
    };

    checkDirPerm(backupRoot);
    checkDirPerm(result.snapshotDir);
    checkDirPerm(path.join(result.snapshotDir, 'owner-state'));
    checkDirPerm(path.join(result.snapshotDir, 'owner-state/.secrets'));

    checkFilePerm(path.join(result.snapshotDir, 'manifest.json'));
    checkFilePerm(path.join(result.snapshotDir, 'RESTORE.md'));
    checkFilePerm(path.join(result.snapshotDir, 'owner-state/.env'));
    checkFilePerm(path.join(result.snapshotDir, 'owner-state/memory.md'));
    checkFilePerm(path.join(result.snapshotDir, 'owner-state/handoff.md'));
    checkFilePerm(path.join(result.snapshotDir, 'owner-state/.secrets/key.txt'));
  } finally {
    process.umask(prevUmask);
    cleanup(vaultRoot);
    cleanup(backupRoot);
  }
});

test('backupVault disambiguates same-second backups without collision or overwrite', () => {
  const vaultRoot = makeVaultFixture({
    'Home.md': '# Home\n',
    'memory.md': 'MEM-A\n',
  });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-collide-'));

  try {
    const fixedTime = new Date('2026-10-18T14:30:00.123Z');
    const result1 = backupVault(vaultRoot, { backupRoot, now: fixedTime });
    assert.equal(result1.verified, true);

    // Update memory file to verify content isolation
    fs.writeFileSync(path.join(vaultRoot, 'memory.md'), 'MEM-B\n', 'utf8');

    // Run a second backup with identical now Date
    const result2 = backupVault(vaultRoot, { backupRoot, now: fixedTime });
    assert.equal(result2.verified, true);

    // Verify distinct snapshot directories were created
    assert.notEqual(result1.snapshotDir, result2.snapshotDir);
    assert.ok(fs.existsSync(result1.snapshotDir));
    assert.ok(fs.existsSync(result2.snapshotDir));

    // Verify snapshot 1 still contains MEM-A and snapshot 2 contains MEM-B
    const content1 = fs.readFileSync(path.join(result1.snapshotDir, 'owner-state/memory.md'), 'utf8');
    const content2 = fs.readFileSync(path.join(result2.snapshotDir, 'owner-state/memory.md'), 'utf8');
    assert.equal(content1, 'MEM-A\n');
    assert.equal(content2, 'MEM-B\n');

    // Both snapshots pass integrity verification
    assert.equal(verifySnapshotIntegrity(result1.snapshotDir), true);
    assert.equal(verifySnapshotIntegrity(result2.snapshotDir), true);

    // Verify pruneSnapshots recognizes disambiguated directory formats on historical dates
    makePublishedSnapshot(backupRoot, 'snapshot-2026-10-01_100000');
    makePublishedSnapshot(backupRoot, 'snapshot-2026-10-01_100000-123-1');

    const pruned = pruneSnapshots(backupRoot, { daily: 1, weekly: 1, monthly: 1 });
    assert.ok(pruned.includes('snapshot-2026-10-01_100000'));
    assert.ok(pruned.includes('snapshot-2026-10-01_100000-123-1'));
  } finally {
    cleanup(vaultRoot);
    cleanup(backupRoot);
  }
});

test('pruneSnapshots orders collision counters numerically, not as text', () => {
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-counter-'));
  try {
    // Ten same-second backups on 2026-10-17, then one on the next day. Retention keeps two daily
    // snapshots, so the prior day must retain its NEWEST state — counter 10 — even though `-9`
    // sorts after `-10` as text.
    for (let counter = 1; counter <= 10; counter += 1) {
      makePublishedSnapshot(backupRoot, `snapshot-2026-10-17_120000-123-${counter}`);
    }
    makePublishedSnapshot(backupRoot, 'snapshot-2026-10-18_120000');

    const pruned = pruneSnapshots(backupRoot, { daily: 2, weekly: 0, monthly: 0 });

    assert.ok(
      fs.existsSync(path.join(backupRoot, 'snapshot-2026-10-17_120000-123-10')),
      'the newest prior-day snapshot (counter 10) must survive'
    );
    assert.ok(
      !fs.existsSync(path.join(backupRoot, 'snapshot-2026-10-17_120000-123-9')),
      'the older counter 9 snapshot must be the one pruned'
    );
    assert.ok(fs.existsSync(path.join(backupRoot, 'snapshot-2026-10-18_120000')));
    assert.equal(pruned.length, 9);
  } finally {
    cleanup(backupRoot);
  }
});

test('two processes publishing into the same second both keep their snapshot', async (t) => {
  const vaultRoot = makeVaultFixture({
    'Home.md': '# Home\n',
    'memory.md': 'MEM-RACE\n',
    'handoff.md': '# Handoff\n',
  });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-race-'));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-race-work-'));
  const barrier = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-race-barrier-'));
  t.after(() => {
    cleanup(vaultRoot);
    cleanup(backupRoot);
    cleanup(work);
    cleanup(barrier);
  });

  const driver = path.join(work, 'driver.cjs');
  fs.writeFileSync(
    driver,
    [
      "const { backupVault } = require(process.env.FIXTURE_BUNDLE);",
      'const result = backupVault(process.env.FIXTURE_VAULT, {',
      '  backupRoot: process.env.FIXTURE_OUT,',
      '  now: new Date(process.env.FIXTURE_NOW),',
      '});',
      'console.log(result.snapshotDir);',
      '',
    ].join('\n')
  );

  // The barrier sits on the promotion `rename` into a `snapshot-*` name: the one step BOTH the
  // current reservation protocol and the previous `existsSync`-then-rename protocol perform, so
  // this regression is implementation-agnostic rather than shaped around today's code. Both
  // processes therefore decide while the destination is still free — the exact interleaving that
  // let the old check/rename race fail one backup and discard its verified staging tree.
  const preload = path.join(work, 'barrier.cjs');
  fs.writeFileSync(
    preload,
    [
      "const fs = require('fs');",
      "const path = require('path');",
      'const rename = fs.renameSync;',
      'const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);',
      'let waited = false;',
      'fs.renameSync = function (from, to) {',
      "  const base = path.basename(String(to));",
      "  if (!waited && /^snapshot-\\d{4}-\\d{2}-\\d{2}_\\d{6}(?:-\\d{1,3}(?:-\\d+)?)?$/.test(base)) {",
      '    waited = true;',
      '    const dir = process.env.FIXTURE_BARRIER;',
      "    fs.writeFileSync(path.join(dir, 'ready-' + process.pid), '');",
      '    const deadline = Date.now() + 20000;',
      '    const want = Number(process.env.FIXTURE_BARRIER_N);',
      '    while (Date.now() < deadline) {',
      "      const ready = fs.readdirSync(dir).filter((n) => n.startsWith('ready-')).length;",
      '      if (ready >= want) break;',
      '      sleep(5);',
      '    }',
      '  }',
      '  return rename.apply(fs, arguments);',
      '};',
      '',
    ].join('\n')
  );

  const now = '2026-10-18T03:04:05.678Z';
  const env = {
    ...process.env,
    FIXTURE_BUNDLE: BUNDLE,
    FIXTURE_VAULT: vaultRoot,
    FIXTURE_OUT: backupRoot,
    FIXTURE_NOW: now,
    FIXTURE_BARRIER: barrier,
    FIXTURE_BARRIER_N: '2',
    NODE_OPTIONS: `--require ${preload}`,
  };

  // Genuine concurrency: `spawn` + `Promise.all`. `spawnSync` would run them one after the other,
  // leaving no race to test at all.
  const runChild = () =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [driver], { env });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ status: code, stderr });
      });
    });

  const children = await Promise.all([runChild(), runChild()]);

  const ready = fs.readdirSync(barrier).filter((n) => n.startsWith('ready-')).length;
  assert.equal(ready, 2, 'both processes must reach the publication barrier (anti-vacuity)');

  for (const child of children) {
    assert.equal(child.status, 0, `both backups must publish: ${child.stderr}`);
  }

  const snapshots = fs
    .readdirSync(backupRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('snapshot-'))
    .map((e) => e.name)
    .sort();
  assert.equal(snapshots.length, 2, `two distinct snapshots must exist, got ${snapshots.join(', ')}`);
  for (const name of snapshots) {
    assert.equal(verifySnapshotIntegrity(path.join(backupRoot, name)), true, `${name} must verify`);
  }
  assert.deepEqual(
    fs.readdirSync(backupRoot).filter((n) => n.startsWith('.')),
    [],
    'no staging directory may be left behind'
  );
});

test('a lost publication race advances to the next name instead of discarding the snapshot', () => {
  const vaultRoot = makeVaultFixture({ 'Home.md': '# Home\n', 'memory.md': 'MEM-EEXIST\n' });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-eexist-'));
  try {
    const now = new Date('2026-10-18T05:06:07.089Z');
    // A verified snapshot already occupies the name this run would pick first.
    const first = backupVault(vaultRoot, { backupRoot, now });
    const firstRel = path.basename(first.snapshotDir);
    const firstManifest = fs.readFileSync(path.join(first.snapshotDir, 'manifest.json'), 'utf8');

    const second = backupVault(vaultRoot, { backupRoot, now });
    assert.notEqual(path.basename(second.snapshotDir), firstRel, 'the occupied name must not be reused');
    assert.equal(verifySnapshotIntegrity(second.snapshotDir), true);
    assert.equal(
      fs.readFileSync(path.join(first.snapshotDir, 'manifest.json'), 'utf8'),
      firstManifest,
      'the earlier snapshot must be left byte-identical'
    );
  } finally {
    cleanup(vaultRoot);
    cleanup(backupRoot);
  }
});

test('an interrupted reservation never occupies a retention slot or displaces a real backup', () => {
  const vaultRoot = makeVaultFixture({ 'Home.md': '# Home\n', 'memory.md': 'MEM-KEEP\n' });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-reserve-'));
  try {
    // One genuine backup on the 17th.
    const real = backupVault(vaultRoot, { backupRoot, now: new Date('2026-10-17T12:00:00.000Z') });
    const realName = path.basename(real.snapshotDir);

    // An interrupted run on the 18th: it reserved the destination name, then died before the
    // promotion rename, leaving an empty directory that looks like the newest snapshot.
    const orphanName = 'snapshot-2026-10-18_120000';
    fs.mkdirSync(path.join(backupRoot, orphanName), { mode: 0o700 });

    const pruned = pruneSnapshots(backupRoot, { daily: 1, weekly: 0, monthly: 0 });

    assert.deepEqual(pruned, [], 'nothing may be pruned on behalf of an unfinished reservation');
    assert.ok(
      fs.existsSync(path.join(backupRoot, realName)),
      'the only verified snapshot must survive a reservation that outranks it by name'
    );
    assert.equal(verifySnapshotIntegrity(path.join(backupRoot, realName)), true);
    assert.ok(
      fs.existsSync(path.join(backupRoot, orphanName)),
      'the reservation is left alone: a live publisher may still own it'
    );
  } finally {
    cleanup(vaultRoot);
    cleanup(backupRoot);
  }
});

test('an interrupted reservation does not consume an intraday slot on a kept day', () => {
  const vaultRoot = makeVaultFixture({ 'Home.md': '# Home\n', 'memory.md': 'MEM-INTRADAY\n' });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-reserve-day-'));
  try {
    const first = backupVault(vaultRoot, { backupRoot, now: new Date('2026-10-18T08:00:00.000Z') });
    const second = backupVault(vaultRoot, { backupRoot, now: new Date('2026-10-18T09:00:00.000Z') });
    // A third run reserved a later name that second and died before promoting it.
    fs.mkdirSync(path.join(backupRoot, 'snapshot-2026-10-18_100000'), { mode: 0o700 });

    const pruned = pruneSnapshots(backupRoot, { daily: 1, weekly: 0, monthly: 0 });

    assert.deepEqual(pruned, []);
    for (const result of [first, second]) {
      assert.ok(fs.existsSync(result.snapshotDir), `${result.snapshotDir} must survive`);
    }
  } finally {
    cleanup(vaultRoot);
    cleanup(backupRoot);
  }
});

test('a directory with an unreadable manifest is not a retention candidate either', () => {
  const vaultRoot = makeVaultFixture({ 'Home.md': '# Home\n', 'memory.md': 'MEM-FRAGMENT\n' });
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-backups-fragment-'));
  try {
    const real = backupVault(vaultRoot, { backupRoot, now: new Date('2026-10-17T12:00:00.000Z') });
    // A published tree always carries a complete manifest. A truncated one means the directory was
    // never a restore point, so it must not outrank the verified snapshot by name alone.
    const fragment = path.join(backupRoot, 'snapshot-2026-10-18_120000');
    fs.mkdirSync(fragment, { mode: 0o700 });
    fs.writeFileSync(path.join(fragment, 'manifest.json'), '{"entries": [');

    const pruned = pruneSnapshots(backupRoot, { daily: 1, weekly: 0, monthly: 0 });

    assert.deepEqual(pruned, []);
    assert.ok(fs.existsSync(real.snapshotDir), 'the verified snapshot must survive');
    assert.equal(verifySnapshotIntegrity(real.snapshotDir), true);
  } finally {
    cleanup(vaultRoot);
    cleanup(backupRoot);
  }
});
