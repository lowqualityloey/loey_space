import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const driverSource = path.join(root, '06-Resources/scripts/reconcile-github-milestones.mjs');
const hookSource = path.join(root, '.githooks/post-commit');

function fixture(t) {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'loey gh hook fixture-'));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  const scripts = path.join(vault, '06-Resources/scripts');
  fs.mkdirSync(scripts, { recursive: true });
  for (const name of ['reconcile-github-milestones.mjs', 'github-milestone-reconciliation.mjs']) {
    fs.copyFileSync(path.join(root, '06-Resources/scripts', name), path.join(scripts, name));
  }
  fs.writeFileSync(path.join(scripts, 'heyloey.js'), "throw new Error('The portable logger must not bypass the shared lock');\n");
  fs.writeFileSync(path.join(vault, 'AGENTS.md'), '# Synthetic vault\n');
  fs.mkdirSync(path.join(vault, '99-Templates'));
  fs.writeFileSync(path.join(vault, '99-Templates/Daily.md'), '# Synthetic template marker\n');
  fs.writeFileSync(path.join(vault, '.github-milestone-repositories.json'), JSON.stringify({
    schemaVersion: 1, repositories: ['example-owner/example-project'],
    timeZone: 'Pacific/Auckland', startFrom: '2026-10-14T11:00:00Z'
  }));
  const verificationFiles = [
    '06-Resources/scripts/github-milestone-reconciliation.mjs',
    '06-Resources/scripts/reconcile-github-milestones.mjs',
    '.githooks/post-commit',
    '06-Resources/scripts/tests/github-milestone-reconciliation.test.mjs',
    '06-Resources/scripts/tests/github-milestone-lock-integration.test.mjs',
    '06-Resources/scripts/tests/post-commit-hook.test.mjs'
  ];
  for (const relative of verificationFiles) {
    fs.mkdirSync(path.dirname(path.join(vault, relative)), { recursive: true });
    fs.copyFileSync(path.join(root, relative), path.join(vault, relative));
  }
  const sourceHashes = Object.fromEntries(verificationFiles.map((relative) => [relative,
    createHash('sha256').update(fs.readFileSync(path.join(vault, relative))).digest('hex')]));
  fs.writeFileSync(path.join(vault, '.github-milestone-reconciliation.ready.json'), JSON.stringify({ schemaVersion: 1, sourceHashes }));
  const daily = path.join(vault, 'daily.md');
  const handoff = path.join(vault, 'handoff.md');
  fs.writeFileSync(daily, '## 📝 Daily Log\n');
  fs.writeFileSync(handoff, '### Latest Updates\n');
  const logger = path.join(vault, 'fixture logger.cjs');
  const loggerBody = [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const { createHash } = require("node:crypto");',
    'const { spawnSync } = require("node:child_process");',
    'const vault = process.env.LOEY_SPACE_DIR;',
    'const key = createHash("sha1").update(fs.realpathSync(vault)).digest("hex").slice(0, 20);',
    'const lock = path.join(process.env.LOEY_LOCK_DIR, "vault-" + key + ".flock");',
    'if (process.argv[2] === "lock-state") {',
    '  console.log("[heyloey] Vault: " + vault + " (source: LOEY_SPACE_DIR)");',
    '  console.log("[heyloey] LOCK protocol: kernel-managed flock");',
    '  console.log("[heyloey] LOCK kernel lock file: " + lock);',
    '} else {',
    '  const command = process.argv[2];',
    '  if (!["done", "log", "handoff"].includes(command)) throw new Error("Unexpected logger command");',
    '  if (spawnSync("flock", ["-n", lock, "true"]).status === 0) throw new Error("Writer did not hold the shared kernel lock");',
    '  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);',
    '  const summary = process.argv[3];',
    '  if (process.env.FIXTURE_ARGV) fs.appendFileSync(process.env.FIXTURE_ARGV, JSON.stringify(process.argv.slice(2)) + "\\n");',
    '  const flag = (name) => { const at = process.argv.indexOf(name); return at === -1 ? null : process.argv[at + 1]; };',
    '  const when = flag("--date");',
    '  const whenTime = flag("--time");',
    '  let target = process.env.FIXTURE_DAILY;',
    '  if (when) {',
    '    target = path.join(vault, "01-Daily", when.slice(0, 7), when + ".md");',
    '    if (!fs.existsSync(target)) {',
    '      console.error("[heyloey] REFUSED daily note: " + path.relative(vault, target) + " is absent; nothing written.");',
    '      process.exit(4);',
    '    }',
    '  }',
    '  // The real writer is idempotent on both records (logAreaHasSummary/handoffHasEntry).',
    '  // A fixture that appends unconditionally would invent the duplicate it claims to detect.',
    '  const appendOnce = (file, line) => {',
    '    const prior = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";',
    '    if (!prior.includes(summary)) fs.appendFileSync(file, line);',
    '  };',
    '  if (command !== "handoff") appendOnce(target, "- **" + (whenTime || "10:00") + "**: " + summary + "\\n");',
    '  if (process.env.FIXTURE_FAIL_HANDOFF === "1") throw new Error("Interrupted after daily write");',
    '  if (command !== "log") appendOnce(path.join(vault, "handoff.md"), "- [x] **[2026-10-15 10:00]** " + summary + "\\n");',
    '  console.log("RESULT " + command + " logged daily=written handoff=written lock=flock target=" + vault + " source=LOEY_SPACE_DIR verified=daily+handoff");',
    '}'
  ].join('\n');
  fs.writeFileSync(logger, '#!' + process.execPath + '\n' + loggerBody + '\n', { mode: 0o700 });
  const env = {
    ...process.env, HEYLOEY_BIN: logger, LOEY_SPACE_DIR: vault, LOEY_LOCK_DIR: path.join(vault, 'locks'),
    LOEY_LOCK_IMPL: 'flock', LOEY_SPACE_SYNTHETIC: '0', FIXTURE_DAILY: daily, HEYLOEY_LOG: 'on'
  };
  for (const name of ['LOEY_LOCK_HELD', 'LOEY_RECONCILE_LOCKED', 'LOEY_LOCK_RECOVERY', 'LOEY_LOCK_STALE_MS', 'LOEY_LOCK_RECLAIM_DELAY_MS']) delete env[name];
  return { vault, daily, handoff, env, driver: path.join(scripts, path.basename(driverSource)) };
}

test('configured vault hook uses the central logger under the shared lock', (t) => {
  const f = fixture(t);
  const empty = path.join(f.vault, 'empty-hooks');
  fs.mkdirSync(empty);
  for (const args of [
    ['init', '--template=' + empty],
    ['config', 'user.name', 'Fixture'],
    ['config', 'user.email', 'fixture@example.invalid'],
    ['config', 'heyloey.log', 'true'],
    ['config', 'heyloey.timeout', '20'],
    ['-c', 'core.hooksPath=' + empty, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'Fixture seed', '-m', 'HeyLoey-Milestone: Hook integration milestone']
  ]) {
    const result = spawnSync('git', args, { cwd: f.vault, env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const result = spawnSync('bash', [hookSource], { cwd: f.vault, env: f.env, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /logged milestone/);
  assert.match(fs.readFileSync(f.daily, 'utf8'), /Hook integration milestone/);
  assert.match(fs.readFileSync(f.handoff, 'utf8'), /Hook integration milestone/);
  assert.equal(fs.existsSync(path.join(f.vault, '.github-milestone-reconciliation.json')), false);
});

test('concurrent manually-triggered milestones retain both entries in both records', async (t) => {
  const f = fixture(t);
  const run = (summary) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [f.driver, '--root', f.vault, '--record', summary], { cwd: f.vault, env: f.env });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
  const results = await Promise.all([run('Concurrent milestone one'), run('Concurrent milestone two')]);
  for (const result of results) {
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /RESULT done logged/);
  }
  for (const file of [f.daily, f.handoff]) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(content.split('Concurrent milestone one').length - 1, 1);
    assert.equal(content.split('Concurrent milestone two').length - 1, 1);
  }
});

test('missing readiness refuses a live writer without touching records', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.vault, '.github-milestone-reconciliation.ready.json'));
  const result = spawnSync(process.execPath, [f.driver, '--root', f.vault, '--record', 'Must remain unlogged'], {
    cwd: f.vault, env: f.env, encoding: 'utf8', timeout: 30000
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Native verification is not recorded/);
  assert.equal(fs.readFileSync(f.daily, 'utf8'), '## 📝 Daily Log\n');
  assert.equal(fs.readFileSync(f.handoff, 'utf8'), '### Latest Updates\n');
});

test('source changes invalidate readiness before any record write', (t) => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.vault, '06-Resources/scripts/github-milestone-reconciliation.mjs'), '\n// Changed source version\n');
  const result = spawnSync(process.execPath, [f.driver, '--root', f.vault, '--record', 'Must remain unlogged'], {
    cwd: f.vault, env: f.env, encoding: 'utf8', timeout: 30000
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Native verification is not recorded/);
  assert.equal(fs.readFileSync(f.daily, 'utf8'), '## 📝 Daily Log\n');
  assert.equal(fs.readFileSync(f.handoff, 'utf8'), '### Latest Updates\n');
});

test('failing native verification cannot create a readiness receipt', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.vault, '.github-milestone-reconciliation.ready.json'));
  // These deliberately failing tests live only in the disposable fixture.
  // The production suites and their assertions remain unchanged.
  for (const name of ['github-milestone-reconciliation', 'github-milestone-lock-integration', 'post-commit-hook']) {
    fs.writeFileSync(path.join(f.vault, '06-Resources/scripts/tests', name + '.test.mjs'),
      'import test from "node:test"; test("forced fixture gate failure", () => { throw new Error("verification must refuse"); });\n');
  }
  const result = spawnSync(process.execPath, [f.driver, '--root', f.vault, '--enable'], {
    cwd: f.vault, env: f.env, encoding: 'utf8', timeout: 30000
  });
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(path.join(f.vault, '.github-milestone-reconciliation.ready.json')), false);
  assert.equal(fs.readFileSync(f.daily, 'utf8'), '## 📝 Daily Log\n');
  assert.equal(fs.readFileSync(f.handoff, 'utf8'), '### Latest Updates\n');
});

function discoveryFixture(t) {
  const f = fixture(t);
  const put = (relative, content) => {
    const target = path.join(f.vault, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    return target;
  };
  const clock = put('clock.cjs', 'const RealDate=Date; global.Date=class extends RealDate { constructor(...args) { super(...(args.length ? args : [process.env.FIXTURE_NOW])); } static now() { return RealDate.parse(process.env.FIXTURE_NOW); } };\n');
  const raw = { number: 638, merged: true, title: 'Discovery retry fixture', html_url: 'https://github.com/example-owner/example-project/pull/638', merged_at: '2026-10-15T01:00:00Z', merge_commit_sha: 'a'.repeat(40) };
  const gh = put('bin/gh', '#!' + process.execPath + '\nconsole.log(JSON.stringify(process.argv.includes("search/issues") ? {total_count:1,incomplete_results:false,items:[{number:638}]} : ' + JSON.stringify(raw) + '));\n');
  fs.chmodSync(gh, 0o700);
  const dailyRelative = day => `01-Daily/${day.slice(0, 7)}/${day}.md`;
  // The milestone merged on 2026-10-15 (01:00Z is 14:00 Pacific/Auckland), so that is the note a
  // correct back-dated write must land in — not whichever day the scan happened to run.
  put(dailyRelative('2026-10-15'), '## 📝 Daily Log\n');
  put(dailyRelative('2026-10-16'), '## 📝 Daily Log\n');
  put(dailyRelative('2026-10-17'), '## 📝 Daily Log\n');
  const env = { ...f.env, PATH: path.join(f.vault, 'bin') + path.delimiter + process.env.PATH,
    NODE_OPTIONS: '--require=' + JSON.stringify(clock), FIXTURE_NOW: '2026-10-16T01:00:00Z',
    FIXTURE_DAILY: path.join(f.vault, dailyRelative('2026-10-16')) };
  const run = overrides => spawnSync(process.execPath, [f.driver, '--root', f.vault], {
    cwd: f.vault, encoding: 'utf8', timeout: 30000, env: { ...env, ...overrides }
  });
  return { ...f, env, run, dailyRelative, put };
}

test('a retry on another discovery day repairs handoff without duplicating the interrupted daily entry', t => {
  const f = discoveryFixture(t);
  const mergeDay = path.join(f.vault, f.dailyRelative('2026-10-15'));
  const first = f.run({ FIXTURE_FAIL_HANDOFF: '1', FIXTURE_DAILY: mergeDay, FIXTURE_ARGV: path.join(f.vault, 'argv.log') });
  assert.notEqual(first.status, 0, first.stdout + first.stderr);
  const original = fs.readFileSync(mergeDay, 'utf8');
  assert.match(original, /loey-github:example-owner\/example-project#638/);
  // The flag pair is what makes a back-dated write possible at all; assert it on the wire, not
  // just in the source, because a logger that silently ignores an extra argument looks green.
  const argv = fs.readFileSync(path.join(f.vault, 'argv.log'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(argv.length, 1, 'one write attempt before the interruption: ' + JSON.stringify(argv));
  assert.equal(argv[0][0], 'done', 'only `done` can back-date a milestone');
  assert.deepEqual(argv[0].slice(2), ['--date', '2026-10-15', '--time', '14:00']);
  assert.ok(argv[0][1].includes('loey-github:example-owner/example-project#638'), argv[0][1]);
  const statePath = path.join(f.vault, '.github-milestone-reconciliation.json');
  assert.equal(fs.existsSync(statePath), false);
  const nextDaily = path.join(f.vault, f.dailyRelative('2026-10-17'));
  const retry = f.run({ FIXTURE_NOW: '2026-10-17T01:00:00Z', FIXTURE_DAILY: nextDaily });
  assert.equal(retry.status, 0, retry.stdout + retry.stderr);
  assert.equal(fs.readFileSync(mergeDay, 'utf8'), original);
  assert.equal(fs.readFileSync(nextDaily, 'utf8'), '## 📝 Daily Log\n');
  assert.equal(fs.readFileSync(f.handoff, 'utf8').split('loey-github:example-owner/example-project#638').length - 1, 1);
  assert.equal(JSON.parse(fs.readFileSync(statePath)).receipts['https://github.com/example-owner/example-project/pull/638'].dailyPath, f.dailyRelative('2026-10-15'));
});

test('an earlier agent discovery without a checkpoint is reused on the next day', t => {
  const f = discoveryFixture(t);
  const entry = '[example-owner/example-project] PR #638 merged, verified by agent.';
  const original = '## 📝 Daily Log\n- **10:00 AM**: ' + entry + '\n';
  f.put(f.dailyRelative('2026-10-16'), original);
  fs.writeFileSync(f.handoff, '### Latest Updates\n- [x] **[2026-10-16 10:00]** ' + entry + '\n');
  const nextDaily = path.join(f.vault, f.dailyRelative('2026-10-17'));
  const result = f.run({ FIXTURE_NOW: '2026-10-17T01:00:00Z', FIXTURE_DAILY: nextDaily });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /RESULT reconcile unchanged logged=0 already-recorded=1/);
  assert.equal(fs.readFileSync(f.env.FIXTURE_DAILY, 'utf8'), original);
  assert.equal(fs.readFileSync(nextDaily, 'utf8'), '## 📝 Daily Log\n');
});

// A run scans the daily window once and reuses that snapshot for every candidate. That cache is
// only valid before the run writes: serving the post-write proof from it made a successful write
// look unverifiable, so an hourly tick logged one milestone and then reported failure forever.
test('post-write verification reads the note from disk, not the pre-write snapshot', t => {
  const f = discoveryFixture(t);
  const mergeDay = path.join(f.vault, f.dailyRelative('2026-10-15'));
  // The snapshot taken at the start of the run holds this note with no row, so a cached read
  // cannot satisfy the proof — only a fresh read of what the writer just produced can.
  assert.equal(fs.readFileSync(mergeDay, 'utf8'), '## 📝 Daily Log\n');
  const first = f.run({});
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.match(first.stdout, /RESULT reconcile logged logged=1 already-recorded=0/);
  assert.match(fs.readFileSync(mergeDay, 'utf8'), /loey-github:example-owner\/example-project#638/);
  const state = JSON.parse(fs.readFileSync(path.join(f.vault, '.github-milestone-reconciliation.json'), 'utf8'));
  assert.equal(state.receipts['https://github.com/example-owner/example-project/pull/638'].dailyPath,
    f.dailyRelative('2026-10-15'));
  // A saved receipt is what proves the run got past its own verification. Before the fix the
  // first run threw, no receipt was written, and every later tick retried the same milestone.
  const second = f.run({});
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /RESULT reconcile unchanged logged=0 already-recorded=1/);
});

// ---------------------------------------------------------------------------------------------
// Staleness diagnostics. The receipt says "verified" or it says nothing useful; these pin that it
// now says WHY, that it can be asked without any of the machinery a write needs, and that the
// commit hook asks the reconciler instead of routing around a refusal.
// ---------------------------------------------------------------------------------------------

const READY_REL = '.github-milestone-reconciliation.ready.json';

function statusOf(f, overrides = {}) {
  return spawnSync(process.execPath, [f.driver, '--root', f.vault, '--status'], {
    cwd: f.vault, encoding: 'utf8', timeout: 30000, env: { ...f.env, ...overrides }
  });
}

test('--status reports per-file readiness and exits 0 on a certified source', (t) => {
  const f = fixture(t);
  const result = statusOf(f);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const lines = result.stdout.trim().split('\n');
  const fileLines = lines.filter((line) => /^(ok|drifted|missing)  /.test(line));
  assert.equal(fileLines.length, 6, 'one line per verification file: ' + result.stdout);
  assert.ok(fileLines.every((line) => line.startsWith('ok  ')), result.stdout);
  assert.match(result.stdout, /RESULT reconcile status=ok target=/);
  assert.equal(result.stderr, '');
});

test('--status names the drifted files and exits 4 without writing anything', (t) => {
  const f = fixture(t);
  const target = path.join(f.vault, '06-Resources/scripts/github-milestone-reconciliation.mjs');
  fs.appendFileSync(target, '\n// Drifted source\n');
  const before = fs.readFileSync(path.join(f.vault, READY_REL), 'utf8');
  const result = statusOf(f);

  assert.equal(result.status, 4, result.stdout + result.stderr);
  assert.match(result.stdout, /drifted  06-Resources\/scripts\/github-milestone-reconciliation\.mjs/);
  assert.match(result.stdout, /RESULT reconcile status=drift target=/);
  assert.match(result.stderr, /Native verification is not recorded/);
  assert.match(result.stderr, /Cause: hash drift in `06-Resources\/scripts\/github-milestone-reconciliation\.mjs` \(last changed \(commit unknown\)\)/);
  assert.equal(fs.readFileSync(path.join(f.vault, READY_REL), 'utf8'), before, 'a status read must not rewrite the receipt');
  assert.equal(fs.readFileSync(f.daily, 'utf8'), '## 📝 Daily Log\n');
  assert.equal(fs.readFileSync(f.handoff, 'utf8'), '### Latest Updates\n');
});

test('--status reports an absent receipt as absent, not as drift', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.vault, READY_REL));
  const result = statusOf(f);
  assert.equal(result.status, 4);
  assert.match(result.stdout, /RESULT reconcile status=absent target=/);
  assert.match(result.stderr, /Cause: \.github-milestone-reconciliation\.ready\.json is absent/);
});

test('--status needs no repository allowlist, no gh and no logger', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.vault, '.github-milestone-repositories.json'));
  const result = statusOf(f, {
    HEYLOEY_BIN: path.join(f.vault, 'no-such-logger'),
    PATH: path.join(f.vault, 'empty-bin'),
    LOEY_LOCK_DIR: path.join(f.vault, 'never-created-locks')
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /RESULT reconcile status=ok target=/);
  assert.equal(fs.existsSync(path.join(f.vault, 'never-created-locks')), false, 'status must not take the kernel lock');
});

test('a drift refusal names the drifted file and the cause, not just the verdict', (t) => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.vault, '06-Resources/scripts/github-milestone-reconciliation.mjs'), '\n// Changed source version\n');
  const result = spawnSync(process.execPath, [f.driver, '--root', f.vault, '--record', 'Must remain unlogged'], {
    cwd: f.vault, env: f.env, encoding: 'utf8', timeout: 30000
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Native verification is not recorded/, 'the verbatim first sentence must survive: callers match on it');
  assert.match(result.stderr, /Cause: hash drift in `06-Resources\/scripts\/github-milestone-reconciliation\.mjs`/);
  assert.match(result.stderr, /last changed \(commit unknown\)/, 'a non-repository root degrades the label, never the refusal');
  assert.equal(fs.readFileSync(f.daily, 'utf8'), '## 📝 Daily Log\n');
  assert.equal(fs.readFileSync(f.handoff, 'utf8'), '### Latest Updates\n');
});

/** Seed a real repository so the hook can read the commit it is asked to log. */
function seedCommit(f, summary) {
  const empty = path.join(f.vault, 'empty-hooks');
  fs.mkdirSync(empty, { recursive: true });
  for (const args of [
    ['init', '--template=' + empty],
    ['config', 'user.name', 'Fixture'],
    ['config', 'user.email', 'fixture@example.invalid'],
    ['config', 'heyloey.log', 'true'],
    ['config', 'heyloey.timeout', '20'],
    ['-c', 'core.hooksPath=' + empty, '-c', 'commit.gpgsign=false',
      'commit', '--allow-empty', '-m', 'Fixture seed', '-m', 'HeyLoey-Milestone: ' + summary]
  ]) {
    const result = spawnSync('git', args, { cwd: f.vault, env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
}

/** Run the tracked hook with a controlled PATH so the reconciler branch is the one under test. */
function runHookInFixture(f, env = {}) {
  const toolbox = path.join(f.vault, 'toolbox');
  fs.mkdirSync(toolbox, { recursive: true });
  for (const tool of ['node', 'git', 'bash', 'env', 'timeout', 'mkdir', 'rmdir', 'rm', 'sleep', 'dirname',
    'basename', 'awk', 'sed', 'grep', 'head', 'tail', 'date', 'tr', 'cut', 'sort', 'wc', 'cat']) {
    const found = spawnSync('bash', ['-c', 'command -v ' + tool], { encoding: 'utf8' }).stdout.trim();
    if (found) fs.symlinkSync(found, path.join(toolbox, tool));
  }
  return spawnSync('bash', [hookSource], {
    cwd: f.vault, encoding: 'utf8', timeout: 30000,
    env: { ...f.env, ...env, PATH: toolbox + path.delimiter + path.dirname(process.execPath) + ':/usr/bin:/bin' }
  });
}

test('the hook asks the reconciler even when the readiness receipt is gone', (t) => {
  const f = fixture(t);
  seedCommit(f, 'Receipt-free milestone');
  fs.unlinkSync(path.join(f.vault, READY_REL));
  const result = runHookInFixture(f);
  assert.equal(result.status, 0, 'a failing logger never changes the commit outcome');
  assert.match(result.stderr, /milestone not logged/);
  assert.match(result.stderr, /Native verification is not recorded/,
    'a vault that owns the reconciler must surface a refused certification, not route around it');
  assert.equal(fs.readFileSync(f.daily, 'utf8'), '## 📝 Daily Log\n', 'the refusal must not be papered over by another writer');
});

test('the hook keeps the portable path when the vault declares no reconciler configuration', (t) => {
  const f = fixture(t);
  seedCommit(f, 'Allowlist-free milestone');
  fs.unlinkSync(path.join(f.vault, '.github-milestone-repositories.json'));
  const result = runHookInFixture(f);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /milestone not logged/);
  assert.ok(!/Native verification is not recorded/.test(result.stderr),
    'without the allowlist the reconciler must not be consulted at all: public clones keep the bundle path');
});
