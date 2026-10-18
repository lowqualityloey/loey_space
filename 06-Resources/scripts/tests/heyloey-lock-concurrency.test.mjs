import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const BUNDLE = path.join(REPO_ROOT, '06-Resources/scripts/heyloey.js');

function todayStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dailyRel(date = todayStr()) {
  return path.join('01-Daily', date.slice(0, 7), `${date}.md`);
}

function makeFixtureVault(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'heyloey-lock-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(root, '99-Templates'), { recursive: true });
  fs.mkdirSync(path.join(root, '.obsidian'), { recursive: true });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Fixture vault\n');
  fs.writeFileSync(
    path.join(root, '.obsidian/daily-notes.json'),
    JSON.stringify({ folder: '01-Daily', format: 'YYYY-MM/YYYY-MM-DD', template: '99-Templates/Daily' })
  );

  fs.writeFileSync(
    path.join(root, 'handoff.md'),
    '# Session Handoff\n\n### Latest Updates\n\n- [x] **[2026-01-01 09:00]** baseline\n'
  );

  const dailyPath = path.join(root, dailyRel());
  fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
  fs.writeFileSync(
    dailyPath,
    '---\ntype: daily\n---\n# Today\n\n## 📝 Daily Log\n- **09:00**: baseline\n\n---\n'
  );

  const lockDir = path.join(root, 'locks');
  fs.mkdirSync(lockDir, { recursive: true });

  const key = createHash('sha1').update(fs.realpathSync(root)).digest('hex').slice(0, 20);
  const kernelLock = path.join(lockDir, `vault-${key}.flock`);
  const legacyLock = path.join(lockDir, `vault-${key}.lock`);

  return { root, dailyPath, lockDir, kernelLock, legacyLock };
}

test('F02: concurrent heyloey done invocations serialize on flock and preserve all milestones', async (t) => {
  const f = makeFixtureVault(t);

  const summaries = [
    'Milestone Alpha: concurrent execution test',
    'Milestone Beta: concurrent execution test',
    'Milestone Gamma: concurrent execution test'
  ];

  // Run all 3 concurrently with LOCK_HOLD_MS=50 to widen the critical section
  const children = await Promise.all(
    summaries.map(
      (summary) =>
        new Promise((resolve) => {
          const child = spawn(
            process.execPath,
            [BUNDLE, '--root', f.root, 'done', summary],
            {
              env: {
                ...process.env,
                LOEY_LOCK_DIR: f.lockDir,
                LOEY_LOCK_HOLD_MS: '50',
                LOEY_SPACE_SYNTHETIC: '0',
              },
              stdio: ['ignore', 'pipe', 'pipe'],
            }
          );
          let stdout = '';
          let stderr = '';
          child.stdout.on('data', (c) => {
            stdout += c;
          });
          child.stderr.on('data', (c) => {
            stderr += c;
          });
          child.on('close', (code) => {
            resolve({ code, stdout, stderr });
          });
        })
    )
  );

  for (const res of children) {
    assert.equal(res.code, 0, `Expected exit 0 but got ${res.code}: ${res.stderr}`);
    assert.match(res.stdout, /RESULT done logged/);
    assert.match(res.stdout, /lock=flock/);
    assert.match(res.stdout, /verified=daily\+handoff/);
  }

  const dailyContent = fs.readFileSync(f.dailyPath, 'utf8');
  const handoffContent = fs.readFileSync(path.join(f.root, 'handoff.md'), 'utf8');

  for (const summary of summaries) {
    assert.ok(
      dailyContent.includes(summary),
      `Daily note must contain "${summary}"`
    );
    assert.ok(
      handoffContent.includes(summary),
      `Handoff must contain "${summary}"`
    );
  }
});

test('F02: repeated milestone reports already-recorded and creates no duplicate entries', (t) => {
  const f = makeFixtureVault(t);
  const summary = 'Deterministic milestone idempotency';

  const first = spawnSync(process.execPath, [BUNDLE, '--root', f.root, 'done', summary], {
    env: { ...process.env, LOEY_LOCK_DIR: f.lockDir, LOEY_SPACE_SYNTHETIC: '0' },
    encoding: 'utf8',
  });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /RESULT done logged/);

  const second = spawnSync(process.execPath, [BUNDLE, '--root', f.root, 'done', summary], {
    env: { ...process.env, LOEY_LOCK_DIR: f.lockDir, LOEY_SPACE_SYNTHETIC: '0' },
    encoding: 'utf8',
  });
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /RESULT done already-recorded/);
  assert.match(second.stdout, /lock=flock/);

  const dailyContent = fs.readFileSync(f.dailyPath, 'utf8');
  const count = dailyContent.split(summary).length - 1;
  assert.equal(count, 1, 'Milestone must appear exactly once in the daily note');
});

test('F02: lock-state reports flock protocol, resolved vault, and matching kernel lock path', (t) => {
  const f = makeFixtureVault(t);

  const res = spawnSync(process.execPath, [BUNDLE, '--root', f.root, 'lock-state'], {
    env: { ...process.env, LOEY_LOCK_DIR: f.lockDir },
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /LOCK protocol: kernel-managed flock/);
  assert.ok(res.stdout.includes(`LOCK kernel lock file: ${f.kernelLock}`));
  assert.ok(res.stdout.includes(`Vault: ${f.root}`));
});

test('F02: lock contention exits 7 and writes nothing', (t) => {
  const f = makeFixtureVault(t);

  // Hold the lock with flock in a background process
  const holder = spawn('flock', [f.kernelLock, 'sleep', '2'], {
    detached: true,
    stdio: 'ignore',
  });
  t.after(() => {
    try {
      if (holder.pid) process.kill(-holder.pid, 'SIGKILL');
    } catch (_) {}
  });

  // Give flock a brief moment to take the lock
  const waitBuf = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(waitBuf, 0, 0, 50);

  const summary = 'Contended milestone attempt';
  const start = Date.now();
  const contender = spawnSync(
    process.execPath,
    [BUNDLE, '--root', f.root, 'done', summary],
    {
      env: {
        ...process.env,
        LOEY_LOCK_DIR: f.lockDir,
        LOEY_LOCK_TIMEOUT_MS: '200', // 200ms timeout -> round up to 1s in flock
        LOEY_SPACE_SYNTHETIC: '0',
      },
      encoding: 'utf8',
    }
  );

  assert.equal(contender.status, 7, `Expected exit code 7 for contention, got ${contender.status}: ${contender.stderr}`);
  assert.match(contender.stderr, /LOCK contention: timed out/);

  const dailyContent = fs.readFileSync(f.dailyPath, 'utf8');
  assert.ok(!dailyContent.includes(summary), 'Contended write must not mutate daily note');
});

test('F02: retired lock configuration is refused with exit code 8', (t) => {
  const f = makeFixtureVault(t);
  const summary = 'Retired lock knob attempt';

  for (const envKey of ['LOEY_LOCK_RECOVERY', 'LOEY_LOCK_STALE_MS', 'LOEY_LOCK_RECLAIM_DELAY_MS']) {
    const res = spawnSync(process.execPath, [BUNDLE, '--root', f.root, 'done', summary], {
      env: {
        ...process.env,
        LOEY_LOCK_DIR: f.lockDir,
        [envKey]: '1',
      },
      encoding: 'utf8',
    });
    assert.equal(res.status, 8, `Expected exit 8 for ${envKey}, got ${res.status}`);
    assert.match(res.stderr, /LOCK unavailable/);
  }

  const badImpl = spawnSync(process.execPath, [BUNDLE, '--root', f.root, 'done', summary], {
    env: {
      ...process.env,
      LOEY_LOCK_DIR: f.lockDir,
      LOEY_LOCK_IMPL: 'file',
    },
    encoding: 'utf8',
  });
  assert.equal(badImpl.status, 8, `Expected exit 8 for LOEY_LOCK_IMPL=file, got ${badImpl.status}`);
  assert.match(badImpl.stderr, /LOCK unavailable/);
});

test('F02: legacy metadata lock (.lock) presence is refused with exit code 9', (t) => {
  const f = makeFixtureVault(t);
  const summary = 'Legacy lock attempt';

  // Create legacy lock file
  fs.writeFileSync(f.legacyLock, JSON.stringify({ pid: 12345, started: '2026-01-01' }));

  const res = spawnSync(process.execPath, [BUNDLE, '--root', f.root, 'done', summary], {
    env: { ...process.env, LOEY_LOCK_DIR: f.lockDir, LOEY_SPACE_SYNTHETIC: '0' },
    encoding: 'utf8',
  });
  assert.equal(res.status, 9, `Expected exit 9 for legacy lock, got ${res.status}`);
  assert.match(res.stderr, /LOCK legacy state/);

  // Assert legacy lock was NOT deleted
  assert.ok(fs.existsSync(f.legacyLock), 'Legacy lock must not be removed by heyloey');
  const dailyContent = fs.readFileSync(f.dailyPath, 'utf8');
  assert.ok(!dailyContent.includes(summary), 'No milestone must be written');
});

test('F02: synthetic opt-out exits 3 and leaves records unchanged', (t) => {
  const f = makeFixtureVault(t);
  const summary = 'Synthetic opt-out milestone';

  const res = spawnSync(process.execPath, [BUNDLE, '--root', f.root, 'done', summary], {
    env: { ...process.env, LOEY_LOCK_DIR: f.lockDir, LOEY_SPACE_SYNTHETIC: '1' },
    encoding: 'utf8',
  });
  assert.equal(res.status, 3, `Expected exit 3 for synthetic opt-out, got ${res.status}`);
  assert.match(res.stdout, /RESULT done skipped/);

  const dailyContent = fs.readFileSync(f.dailyPath, 'utf8');
  assert.ok(!dailyContent.includes(summary), 'Synthetic run must not mutate daily note');
});
