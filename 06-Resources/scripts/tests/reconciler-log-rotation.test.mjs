import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rotateReconcileLog, reconcileLogPath, main } from '../reconcile-github-milestones.mjs';

// The hourly cron line appends to one file forever. These pin that the writer rotates it,
// that the archive is complete, and that the live file keeps the newest RESULT so the
// brief's health alert does not go blind immediately after a rotation.

function workdir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-log-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function logWith(dir, lines, bytes) {
  const file = path.join(dir, 'reconcile.log');
  const body = [];
  for (let i = 0; i < lines; i++) body.push('RESULT reconcile unchanged logged=0 already-recorded=1 milestones-verified=1 tick=' + i);
  fs.writeFileSync(file, body.join('\n') + '\n');
  assert.ok(fs.statSync(file).size > bytes, 'fixture must exceed the threshold');
  return file;
}

test('a log under the threshold is left exactly as it is', (t) => {
  const dir = workdir(t);
  const file = path.join(dir, 'reconcile.log');
  fs.writeFileSync(file, 'RESULT reconcile unchanged logged=0\n');
  const result = rotateReconcileLog(file, 512 * 1024);
  assert.equal(result.rotated, false);
  assert.equal(fs.readFileSync(file, 'utf8'), 'RESULT reconcile unchanged logged=0\n');
  assert.equal(fs.existsSync(file + '.1'), false);
});

test('a log over the threshold is archived whole and keeps its newest lines live', (t) => {
  const dir = workdir(t);
  const file = logWith(dir, 400, 1024);
  const before = fs.readFileSync(file, 'utf8');
  const result = rotateReconcileLog(file, 1024);
  assert.equal(result.rotated, true);
  assert.equal(fs.readFileSync(file + '.1', 'utf8'), before, 'the archive must be the complete log');
  const live = fs.readFileSync(file, 'utf8');
  assert.ok(fs.statSync(file).size < before.length, 'the live file must shrink');
  assert.match(live.trimEnd().split('\n').at(-1), /tick=399$/, 'the newest line must survive rotation');
  assert.match(live, /^RESULT reconcile unchanged /, 'the live file must not start with a torn line');
});

test('rotation keeps the newest RESULT line for the health alert', (t) => {
  const dir = workdir(t);
  const file = path.join(dir, 'reconcile.log');
  const filler = [];
  for (let i = 0; i < 300; i++) filler.push('noise line ' + i + ' ' + 'x'.repeat(40));
  fs.writeFileSync(file, filler.join('\n') + '\nRESULT reconcile failed: the last word\n');
  rotateReconcileLog(file, 1024);
  const live = fs.readFileSync(file, 'utf8');
  assert.match(live, /RESULT reconcile failed: the last word/);
});

test('an absent log is not an error and creates nothing', (t) => {
  const dir = workdir(t);
  const file = path.join(dir, 'never-written.log');
  const result = rotateReconcileLog(file, 1024);
  assert.equal(result.rotated, false);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(file + '.1'), false);
});

test('a second rotation replaces the previous archive instead of growing the set', (t) => {
  const dir = workdir(t);
  const file = logWith(dir, 400, 1024);
  rotateReconcileLog(file, 1024);
  const firstArchive = fs.readFileSync(file + '.1', 'utf8');
  fs.appendFileSync(file, 'RESULT reconcile unchanged logged=0\n'.repeat(60));
  rotateReconcileLog(file, 1024);
  assert.notEqual(fs.readFileSync(file + '.1', 'utf8'), firstArchive);
  assert.equal(fs.existsSync(file + '.2'), false, 'one archive is enough for an hourly tick');
});

test('the log path honours LOEY_RECONCILE_LOG and otherwise lives under the state home', () => {
  const previous = { log: process.env.LOEY_RECONCILE_LOG, state: process.env.XDG_STATE_HOME };
  try {
    process.env.LOEY_RECONCILE_LOG = '/tmp/explicit.log';
    assert.equal(reconcileLogPath(), '/tmp/explicit.log');
    delete process.env.LOEY_RECONCILE_LOG;
    process.env.XDG_STATE_HOME = '/tmp/state-home';
    assert.equal(reconcileLogPath(), path.join('/tmp/state-home', 'heyloey', 'reconcile.log'));
  } finally {
    if (previous.log === undefined) delete process.env.LOEY_RECONCILE_LOG; else process.env.LOEY_RECONCILE_LOG = previous.log;
    if (previous.state === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = previous.state;
  }
});

test('a real run rotates before it refuses, so an oversized log never blocks the tick', async (t) => {
  const dir = workdir(t);
  const vault = path.join(dir, 'vault');
  fs.mkdirSync(path.join(vault, '99-Templates'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'AGENTS.md'), '# Manual\n');
  fs.writeFileSync(path.join(vault, '99-Templates', 'Daily.md'), '# Daily\n');
  fs.writeFileSync(path.join(vault, '.github-milestone-repositories.json'), JSON.stringify({schemaVersion: 1, repositories: ['owner/repo'], startFrom: '2026-01-01T00:00:00Z'}));
  // main() rotates at the real production threshold, so the fixture log must genuinely exceed it.
  const file = path.join(dir, 'reconcile.log');
  const line = 'RESULT reconcile unchanged logged=0 already-recorded=1 milestones-verified=1 tick=';
  const body = [];
  for (let i = 0; body.join('\n').length < 620 * 1024; i++) body.push(line + i);
  fs.writeFileSync(file, body.join('\n') + '\n');
  assert.ok(fs.statSync(file).size > 512 * 1024, 'fixture must exceed the production threshold');

  const previous = process.env.LOEY_RECONCILE_LOG;
  process.env.LOEY_RECONCILE_LOG = file;
  t.after(() => {
    if (previous === undefined) delete process.env.LOEY_RECONCILE_LOG; else process.env.LOEY_RECONCILE_LOG = previous;
  });

  // No readiness receipt in this fixture, so the run must refuse - after rotating.
  await assert.rejects(() => main(['--root', vault]), /Native verification is not recorded/);
  assert.equal(fs.existsSync(file + '.1'), true, 'rotation must happen before the readiness gate');
});

test('--dry-run and --status never rotate', async (t) => {
  const dir = workdir(t);
  const vault = path.join(dir, 'vault');
  fs.mkdirSync(path.join(vault, '99-Templates'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'AGENTS.md'), '# Manual\n');
  fs.writeFileSync(path.join(vault, '99-Templates', 'Daily.md'), '# Daily\n');
  fs.writeFileSync(path.join(vault, '.github-milestone-repositories.json'), JSON.stringify({schemaVersion: 1, repositories: ['owner/repo'], startFrom: '2026-01-01T00:00:00Z'}));
  const file = logWith(dir, 400, 1024);
  const before = fs.readFileSync(file, 'utf8');

  const previous = process.env.LOEY_RECONCILE_LOG;
  process.env.LOEY_RECONCILE_LOG = file;
  t.after(() => {
    if (previous === undefined) delete process.env.LOEY_RECONCILE_LOG; else process.env.LOEY_RECONCILE_LOG = previous;
  });

  await main(['--root', vault, '--status']).catch(() => 0);

  // A dry run reaches the GitHub query, so the test hides gh instead of going to the network:
  // the point is only that the reader never rotated, and failing on a missing gh proves the
  // run got past every rotation site without writing.
  const previousPath = process.env.PATH;
  process.env.PATH = path.join(dir, 'no-such-bin');
  t.after(() => { process.env.PATH = previousPath; });
  await assert.rejects(() => main(['--root', vault, '--dry-run']), /gh|ENOENT|Command failed/);
  process.env.PATH = previousPath;

  assert.equal(fs.readFileSync(file, 'utf8'), before, 'a reader must never touch the run log');
  assert.equal(fs.existsSync(file + '.1'), false);
});
