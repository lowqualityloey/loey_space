#!/usr/bin/env node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  validateConfig, validateState, scanSince, localStamp, normalizePullRequest,
  recordContains, requireReceipt, reconcileMilestones
} from './github-milestone-reconciliation.mjs';

const filename = fileURLToPath(import.meta.url);
const CONFIG = '.github-milestone-repositories.json';
const STATE = '.github-milestone-reconciliation.json';
const READY = '.github-milestone-reconciliation.ready.json';
const VERIFICATION_FILES = [
  '06-Resources/scripts/github-milestone-reconciliation.mjs',
  '06-Resources/scripts/reconcile-github-milestones.mjs',
  '.githooks/post-commit',
  '06-Resources/scripts/tests/github-milestone-reconciliation.test.mjs',
  '06-Resources/scripts/tests/github-milestone-lock-integration.test.mjs',
  '06-Resources/scripts/tests/post-commit-hook.test.mjs'
];

export function parseOptions(args) {
  const options = { root: process.env.LOEY_SPACE_DIR || path.resolve(path.dirname(filename), '../..'), dryRun: false, applyPlan: false, help: false, enable: false, recordSummary: undefined };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1] && !args[i + 1].startsWith('--')) options.root = args[++i];
    else if (args[i] === '--record' && args[i + 1] && !args[i + 1].startsWith('--')) options.recordSummary = args[++i];
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--enable') options.enable = true;
    else if (args[i] === '--apply-plan') options.applyPlan = true;
    else if (args[i] === '--help') options.help = true;
    else throw new Error('Unknown or incomplete option: ' + args[i]);
  }
  return options;
}

function safeFile(root, relative) {
  const target = path.resolve(root, relative);
  const inside = (candidate) => candidate === root || candidate.startsWith(root + path.sep);
  if (!inside(target)) throw new Error('Record path escapes the vault.');
  let existing = target;
  while (!fs.existsSync(existing) && existing !== root) existing = path.dirname(existing);
  if (!inside(fs.realpathSync(existing))) throw new Error('Record symlink escapes the vault.');
  return target;
}

function readText(root, relative) {
  const file = safeFile(root, relative);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

function readJson(root, relative, optional = false) {
  const text = readText(root, relative);
  if (text === null && optional) return null;
  if (text === null) throw new Error('Missing ' + relative + '; configure the repository allowlist first.');
  return JSON.parse(text);
}

function saveState(root, state, relative = STATE) {
  const file = safeFile(root, relative);
  const temporary = safeFile(root, relative + '.' + process.pid + '.tmp');
  try {
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', ['api', ...args], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024
  }));
}

function sourceHashes(root) {
  return Object.fromEntries(VERIFICATION_FILES.map((relative) => [relative,
    createHash('sha256').update(fs.readFileSync(safeFile(root, relative))).digest('hex')]));
}

function hashesMatch(expected, actual) {
  return expected && Object.keys(expected).length === Object.keys(actual).length &&
    Object.entries(actual).every(([name, hash]) => expected[name] === hash);
}

function requireReadiness(root) {
  const ready = readJson(root, READY, true);
  if (!ready || ready.schemaVersion !== 1 || !hashesMatch(ready.sourceHashes, sourceHashes(root))) {
    throw new Error('Native verification is not recorded for this source version; run with --enable from a working WSL runtime.');
  }
}

function verifySource(root) {
  const before = sourceHashes(root);
  // Verification must run the suites for real even when the reconciler itself was
  // started from a test runner. An inherited NODE_TEST_CONTEXT makes the nested
  // `node --test` refuse to run ("skipping running files: called recursively") and
  // exit 0, which would record readiness for tests that never executed.
  const verificationEnv = { ...process.env, LOEY_SPACE_SYNTHETIC: '0' };
  delete verificationEnv.NODE_TEST_CONTEXT;
  execFileSync(process.execPath, ['--test', ...VERIFICATION_FILES.filter((relative) => relative.endsWith('.test.mjs'))], {
    cwd: root, stdio: 'inherit', timeout: 180000,
    env: verificationEnv
  });
  const after = sourceHashes(root);
  if (!hashesMatch(before, after)) throw new Error('Source changed during verification; activation refused.');
  return after;
}

function vaultHookInFlight(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return false;
  const coordination = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-path', 'heyloey-milestones.lock'], {
    cwd: root, encoding: 'utf8', timeout: 5000
  }).trim();
  return fs.existsSync(coordination);
}

export function collectPlan(config, state, request = ghJson, now = new Date()) {
  const through = now.toISOString();
  const pullRequests = [];
  for (const repository of config.repositories) {
    const since = scanSince(config, state, repository);
    // One inclusive `merged:` range. GitHub's search silently drops the date filter when two
    // `merged:` qualifiers are ANDed (it then returns every merged PR, which needs one API call
    // per PR and eventually trips the 1000-result cap). A single range keeps the window server-side.
    const query = 'repo:' + repository + ' is:pr is:merged merged:' + since.slice(0, 10) + '..' + through.slice(0, 10);
    let fetched = 0;
    let total = 0;
    for (let page = 1; page <= 10; page++) {
      const result = request(['--method', 'GET', 'search/issues', '-f', 'q=' + query, '-f', 'per_page=100', '-f', 'page=' + page]);
      if (result.incomplete_results || !Array.isArray(result.items) || !Number.isSafeInteger(result.total_count) || result.total_count < 0) {
        throw new Error('GitHub returned an incomplete search; checkpoint will not advance.');
      }
      total = result.total_count;
      if (total > 1000) throw new Error('Search exceeds GitHub\'s 1000-result limit; narrow the configured startFrom.');
      fetched += result.items.length;
      for (const item of result.items) {
        if (!Number.isSafeInteger(item.number) || item.number < 1) throw new Error('Invalid PR search result.');
        const pr = normalizePullRequest(repository, request(['repos/' + repository + '/pulls/' + item.number]));
        if (pr && Date.parse(pr.mergedAt) >= Date.parse(since) && Date.parse(pr.mergedAt) <= Date.parse(through)) pullRequests.push(pr);
      }
      if (fetched >= total) break;
      if (result.items.length === 0) throw new Error('GitHub pagination ended before all results were retrieved.');
    }
    if (fetched < total) throw new Error('GitHub result limit reached; checkpoint will not advance.');
  }
  return { config, pullRequests, through };
}

function lockPaths(root) {
  const directory = process.env.LOEY_LOCK_DIR || (fs.existsSync('/tmp') ? '/tmp/heyloey-locks' : path.join(os.tmpdir(), 'heyloey-locks'));
  const key = createHash('sha1').update(fs.realpathSync(root)).digest('hex').slice(0, 20);
  return { directory, kernel: path.join(directory, 'vault-' + key + '.flock'), legacy: path.join(directory, 'vault-' + key + '.lock') };
}

function checkLock(root) {
  const impl = String(process.env.LOEY_LOCK_IMPL || 'auto').toLowerCase();
  if (!['auto', 'flock'].includes(impl) || ['LOEY_LOCK_RECOVERY', 'LOEY_LOCK_STALE_MS', 'LOEY_LOCK_RECLAIM_DELAY_MS'].some((key) => process.env[key])) {
    throw new Error('Removed lock configuration is present; no alternate lock protocol is allowed.');
  }
  if (process.platform === 'win32') throw new Error('Run this command inside WSL; kernel flock is required.');
  const locks = lockPaths(root);
  if (fs.existsSync(locks.legacy)) throw new Error('Legacy vault lock is present; nothing will be removed or written.');
  return locks;
}

function dailyPath(root, date) {
  const settings = readJson(root, '.obsidian/daily-notes.json', true) || {};
  const folder = settings.folder || '01-Daily';
  const format = settings.format || 'YYYY-MM/YYYY-MM-DD';
  if (typeof folder !== 'string' || typeof format !== 'string') throw new Error('Invalid daily-note configuration.');
  const [year, month, day] = date.split('-');
  const name = format.replace(/YYYY/g, year).replace(/YY/g, year.slice(2)).replace(/MM/g, month).replace(/DD/g, day);
  const relative = path.join(folder, name + '.md');
  safeFile(root, relative);
  return relative;
}

function dailyHistory(root, config, today, todayPath) {
  const history = new Map();
  const first = localStamp(config.startFrom, config.timeZone).date;
  const end = Date.parse(today + 'T00:00:00Z');
  for (let at = Date.parse(first + 'T00:00:00Z'); at <= end; at += 86400000) {
    const relative = dailyPath(root, new Date(at).toISOString().slice(0, 10));
    if (relative === todayPath || history.has(relative)) continue;
    const content = readText(root, relative);
    if (content !== null) history.set(relative, content);
  }
  return history;
}

function loggerSession(root, config) {
  const installedLogger = path.join(os.homedir(), '.local', 'bin', 'heyloey');
  const logger = process.env.HEYLOEY_BIN || (fs.existsSync(installedLogger) ? installedLogger : 'heyloey');
  const loggerEnvironment = { ...process.env, TZ: config.timeZone, LOEY_SPACE_DIR: root, LOEY_LOCK_HELD: '1', LOEY_LOCK_IMPL_USED: 'flock' };
  const lockReport = execFileSync(logger, ['lock-state'], {
    cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024, env: loggerEnvironment
  });
  if (!lockReport.includes('LOCK protocol: kernel-managed flock') ||
      !lockReport.includes('[heyloey] Vault: ' + root + ' (source: LOEY_SPACE_DIR)') ||
      !lockReport.includes('LOCK kernel lock file: ' + lockPaths(root).kernel)) {
    throw new Error('The installed logger does not confirm the intended vault and shared kernel lock.');
  }
  return { logger, loggerEnvironment };
}


function executePlan(root, plan) {
  checkLock(root);
  const config = validateConfig(readJson(root, CONFIG));
  if (JSON.stringify(config) !== JSON.stringify(plan.config)) throw new Error('Configuration changed during retrieval; retry the scan.');
  const { logger, loggerEnvironment } = loggerSession(root, config);
  if (plan.enable === true) {
    if (!hashesMatch(plan.sourceHashes, sourceHashes(root))) throw new Error('Source changed after verification; activation refused.');
    if (vaultHookInFlight(root)) throw new Error('A vault commit hook is active; retry activation after it finishes.');
    const previousReady = readJson(root, READY, true);
    saveState(root, { schemaVersion: 1, verifiedAtUTC: new Date().toISOString(), sourceHashes: plan.sourceHashes }, READY);
    if (vaultHookInFlight(root)) {
      if (previousReady) saveState(root, previousReady, READY);
      else fs.unlinkSync(safeFile(root, READY));
      throw new Error('A vault hook overlapped activation; readiness restored, retry after it finishes.');
    }
    console.log('RESULT reconcile enabled native-tests=passed source=verified lock=flock target=' + root);
    return;
  }
  requireReadiness(root);
  if (typeof plan.recordSummary === 'string') {
    if (!plan.recordSummary.trim() || /[\r\n]/.test(plan.recordSummary)) throw new Error('A milestone must be a nonempty single line.');
    const output = execFileSync(logger, ['done', plan.recordSummary], {
      cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024, env: loggerEnvironment
    });
    const receipt = requireReceipt(output, 'done', root);
    if (!receipt.includes('verified=daily+handoff')) throw new Error('The logger did not verify both milestone records.');
    console.log(receipt);
    return;
  }
  const state = validateState(readJson(root, STATE, true));
  const today = localStamp(new Date().toISOString(), config.timeZone).date;
  const todayPath = dailyPath(root, today);
  const history = dailyHistory(root, config, today, todayPath);
  const archiveDir = safeFile(root, '07-Reviews');
  const archives = () => fs.existsSync(archiveDir) ? fs.readdirSync(archiveDir)
    .filter((name) => /^handoff-archive-\d{4}-\d{2}\.md$/.test(name))
    .map((name) => path.join('07-Reviews', name)) : [];
  const result = reconcileMilestones({ ...plan, config, state }, {
    root,
    inspect(pr, receipt, allowShortScope) {
      const possible = [...new Set([receipt?.dailyPath, todayPath, ...history.keys()].filter(Boolean))];
      const matched = possible.find((relative) => recordContains(history.has(relative) ? history.get(relative) : readText(root, relative), pr, 'daily', allowShortScope));
      const handoff = recordContains(readText(root, 'handoff.md'), pr, 'handoff', allowShortScope) ||
        archives().some((relative) => recordContains(readText(root, relative), pr, 'archive', allowShortScope));
      return { daily: Boolean(matched), dailyPath: matched || todayPath, handoff };
    },
    requireRecords() {
      if (!readText(root, todayPath)?.split(/\r?\n/).some((line) => line.trim() === '## 📝 Daily Log') ||
          !readText(root, 'handoff.md')?.split(/\r?\n/).some((line) => line.trim() === '### Latest Updates')) {
        throw new Error('Today\'s canonical daily note or handoff section is absent. Neither will be invented.');
      }
      if (localStamp(new Date().toISOString(), config.timeZone).date !== today) throw new Error('Date changed during reconciliation; retry.');
    },
    log(command, summary) {
      return execFileSync(logger, [command, summary], {
        cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
        env: loggerEnvironment
      });
    },
    saveState(value) { saveState(root, value); }
  });
  console.log('RESULT reconcile ' + result.outcome + ' logged=' + result.logged + ' already-recorded=' + result.alreadyRecorded +
    ' milestones-verified=' + (result.logged + result.alreadyRecorded) + ' lock=flock target=' + root);
}

async function runLocked(root, plan) {
  const locks = checkLock(root);
  fs.mkdirSync(locks.directory, { recursive: true });
  return new Promise((resolve, reject) => {
    // --no-fork makes the reconciler itself hold the lock. A logger child sees
    // this live holder as its parent and retains heyloey's orphan-write guard.
    const child = spawn('flock', ['--no-fork', '-w', '15', '-E', '7', locks.kernel,
      process.execPath, filename, '--root', root, '--apply-plan'], {
      stdio: ['pipe', 'inherit', 'inherit'], detached: true,
      env: { ...process.env, LOEY_RECONCILE_LOCKED: '1' }
    });
    const forward = (signal) => { try { process.kill(-child.pid, signal); } catch {} };
    const onInt = () => forward('SIGINT');
    const onTerm = () => forward('SIGTERM');
    process.once('SIGINT', onInt);
    process.once('SIGTERM', onTerm);
    child.stdin.on('error', () => {});
    child.on('error', reject);
    child.on('close', (code, signal) => {
      process.removeListener('SIGINT', onInt);
      process.removeListener('SIGTERM', onTerm);
      if (code === 7) console.error('RESULT reconcile lock-contended; nothing was written by this run.');
      resolve(signal ? (signal === 'SIGINT' ? 130 : 143) : (code ?? 8));
    });
    child.stdin.end(JSON.stringify(plan));
  });
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.log('Usage: npm run reconcile-github -- [--root <vault>] [--dry-run | --enable]\nRequires gh authentication, the installed central heyloey CLI, and kernel flock (WSL on Windows).');
    return 0;
  }
  const root = fs.realpathSync(path.resolve(options.root));
  if (!fs.existsSync(path.join(root, 'AGENTS.md')) || !fs.existsSync(path.join(root, '99-Templates', 'Daily.md'))) throw new Error('Target is not a vault.');
  if (options.applyPlan) {
    if (process.env.LOEY_RECONCILE_LOCKED !== '1') throw new Error('Internal apply mode requires the kernel-lock launcher.');
    executePlan(root, JSON.parse(fs.readFileSync(0, 'utf8')));
    return 0;
  }
  const config = validateConfig(readJson(root, CONFIG));
  if (options.enable) {
    if (options.dryRun || options.recordSummary !== undefined) throw new Error('--enable must run on its own.');
    return runLocked(root, { config, enable: true, sourceHashes: verifySource(root) });
  }
  if (options.recordSummary !== undefined) {
    if (options.dryRun) throw new Error('--record cannot be combined with --dry-run.');
    return runLocked(root, { config, recordSummary: options.recordSummary });
  }
  const state = validateState(readJson(root, STATE, true));
  if (!options.dryRun) requireReadiness(root);
  const plan = collectPlan(config, state);
  if (options.dryRun) {
    console.log(JSON.stringify({ outcome: 'dry-run', through: plan.through, repositories: config.repositories, milestones: plan.pullRequests.map((pr) => pr.url) }, null, 2));
    return 0;
  }
  if (process.env.LOEY_SPACE_SYNTHETIC === '1' || fs.existsSync(path.join(root, '.loey-synthetic'))) {
    console.log('RESULT reconcile skipped; explicit synthetic opt-out, nothing written.');
    return 3;
  }
  return runLocked(root, plan);
}

if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error('RESULT reconcile failed: ' + error.message + ' (checkpoint not advanced past unverified work).');
    process.exitCode = 1;
  });
}
