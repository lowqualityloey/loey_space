/*
 * CI runs on a UTC host. These suites pair a fixture daily note with a writer that decides "today"
 * in Pacific/Auckland, so a fixture that falls back to the host calendar can pass on a laptop and
 * fail in CI once the two calendars are on different dates.
 *
 * This lane pins the host clock to UTC, the same timezone CI uses, and runs only the suites that
 * resolve today from the live Auckland clock. Frozen-clock suites are already host-independent and
 * stay in the regular `npm test` run.
 *
 * Time is deliberately NOT frozen here. The post-commit hook asserts on real elapsed time and lock
 * ages, so a frozen Date makes those assertions vacuous — measured at 0 ms and a lock "held for"
 * tens of thousands of seconds. The production clock is the variable under test, not a simulation.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, '..', '..', '..');
const TSX_CLI = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const DATE_SENSITIVE_SUITES = [
  'heyloey-cli.test.mjs',
  'heyloey-lock-concurrency.test.mjs',
  'heyloey-partial-write.test.mjs',
  'milestone-escaping.test.mjs',
  'post-commit-hook.test.mjs',
];

function fail(message) {
  console.error(`[timezone-lane] ${message}`);
  process.exit(1);
}

// Keep the list from going stale: a new suite that adopts the live Auckland clock belongs here.
const missingFromLane = fs
  .readdirSync(TESTS_DIR)
  .filter((file) => file.endsWith('.test.mjs'))
  .filter((file) => {
    const source = fs.readFileSync(path.join(TESTS_DIR, file), 'utf8');
    return /\baucklandToday\b/.test(source);
  })
  .filter((file) => !DATE_SENSITIVE_SUITES.includes(file))
  .sort();

if (missingFromLane.length > 0) {
  fail(`live-clock suites missing from this lane: ${missingFromLane.join(', ')}`);
}

// The lane needs a POSIX host: the suites it runs exercise the production kernel lock protocol,
// and native Windows Node deliberately refuses that path. WSL is the supported local runtime.
if (process.platform === 'win32') {
  fail(
    'this lane needs a POSIX host with kernel flock; run `npm run test:timezone` from WSL ' +
      '(or from Linux), the same shell used for `npm test`.'
  );
}

if (!fs.existsSync(TSX_CLI)) {
  fail(`tsx is missing at ${path.relative(REPO_ROOT, TSX_CLI)}; run \`npm ci\` for this platform.`);
}

const suites = DATE_SENSITIVE_SUITES.map((file) => {
  const absolute = path.join(TESTS_DIR, file);
  if (!fs.existsSync(absolute)) {
    fail(`expected suite is missing: ${path.relative(REPO_ROOT, absolute)}`);
  }
  return absolute;
});

// Inherit PATH, credentials and CI flags from the caller, but force the host calendar and drop a
// caller's test-clock override: this lane must exercise the live day boundary, not a frozen one.
const env = { ...process.env, TZ: 'UTC' };
delete env.LOEY_TEST_NOW;

const probe = spawnSync(
  process.execPath,
  ['-e', 'process.stdout.write(String(new Date("2026-01-15T12:00:00Z").getTimezoneOffset()))'],
  { env, encoding: 'utf8' }
);

if (probe.error) fail(`could not probe the host timezone: ${probe.error.message}`);
if (probe.status !== 0) fail(`timezone probe exited ${probe.status}`);

const offsetMinutes = probe.stdout.trim();
if (offsetMinutes !== '0') {
  fail(
    `TZ=UTC did not take effect (observed UTC offset ${offsetMinutes} minutes); ` +
      'refusing a false green.'
  );
}

console.log(
  `[timezone-lane] TZ=UTC (offset ${offsetMinutes} min) — ${suites.length} live Auckland-clock suites`
);

const result = spawnSync(process.execPath, [TSX_CLI, '--test', ...suites], {
  cwd: REPO_ROOT,
  env,
  stdio: 'inherit',
});

if (result.error) fail(`could not start the test runner: ${result.error.message}`);
process.exit(result.status ?? 1);
