#!/usr/bin/env node
/*
 * heyloey — the repository-local command-line companion to the "hey loey" chat prefix.
 *
 * The vault's conversational prompts (`heyloey morning`, `heyloey sweep`, …) are instructions
 * to an AI assistant inside the chat. This file is something different on purpose: a
 * deterministic CLI an external script or a git hook can call without loading the whole vault.
 * The two share a name and nothing else, and the guide that ships beside this file says so.
 *
 * Design constraints, each chosen because the obvious alternative was unsafe:
 *
 *   1. NO MACHINE-SPECIFIC PATHS. The target is `--root <dir>` or the working directory, never
 *      this script's own location and never an upward search. There is no username, home
 *      directory or absolute path baked in, so the same bundle runs on every machine.
 *   2. READ-ONLY STAYS READ-ONLY. `brief` and `context` only ever read. They open no file for
 *      writing and create no directory, so running them can never mutate a vault.
 *   3. WRITES REFUSE RATHER THAN IMPROVISE. `done` refuses when today's daily note or the
 *      handoff is missing, and when either note lacks the heading it owns. It never scaffolds a
 *      replacement note: nothing in the vault expects an invented structure, and a wrong one is
 *      worse than a clear refusal.
 *   4. EVERY WRITE IS DRY-RUNNABLE. `--dry-run` prints the exact target paths and the lines that
 *      would be written, and writes nothing at all.
 *   5. COLLISIONS NEVER OVERWRITE. `learn` merges into a marked, reviewable region and preserves
 *      hand-written content, matching the concept-distillation collision rule (#39).
 *
 * Usage:
 *   npm run heyloey -- [--root <dir>] <command> [arguments] [--dry-run] [--show-paths]
 */
import * as fs from 'fs';
import {
  aucklandStamp,
  displayLogTime,
  normalizeDailyLog,
  insertDailyLogEntry,
  insertAgentMilestone,
  logAreaHasSummary,
  escapeCell,
  migrateAgentMilestones,
  DAILY_LOG_HEADING,
  LOG_AREA_HEADINGS,
  type LogArea,
} from './lib/daily-log-time';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { spawn, execSync } from 'child_process';

import {
  DEFAULT_DAILY_NOTES_CONFIG,
  DAILY_NOTES_CONFIG_PATH,
  resolveDailyNoteFile,
  type DailyNotesConfig,
} from './lib/daily-note';
import { parseDumpLines, sanitizeTitle } from './lib/triage';
import { formatDate, readFrontmatterValue, toSingleLine } from './lib/markdown';
import { extractWikilinks, parseAliases } from './lib/links';
import { isDone, isLifecycleActive, type TaskLike } from './lib/task-view';

/** A directory is a vault only if it carries the files every other path assumes. */
const REQUIRED_MARKERS = ['AGENTS.md', '99-Templates'];

/** The two records a session is told to read; both are git-ignored and created by init:vault. */
const MEMORY_RECORD = 'memory.md';
const HANDOFF_RECORD = 'handoff.md';

/** The handoff section `done` appends to, newest first. */
const HANDOFF_HEADING = '### Latest Updates';

/** Folders `context` routes across. Daily notes, the inbox and private records are excluded. */
const ROUTE_PREFIXES = ['02-Projects', '03-Dev', '04-Learning', '06-Resources', '08-Concepts'];

const SNIPPET_DIR = '03-Dev';
/** The Dev hub every learned snippet is connected to, when it exists. */
const DEV_HUB = '03-Dev/_Dev MOC.md';
const DEV_HUB_LINK = '[[_Dev MOC]]';
const LEARN_START = '<!-- heyloey:learn:start -->';
const LEARN_END = '<!-- heyloey:learn:end -->';
/**
 * The connectivity section of a generated snippet.
 *
 * The hub link lives here, at the END of the note, and never inside the marked learn region.
 * Bookkeeping a later pass may rewrite must not share a line with content a later pass has to
 * preserve: the region is compared byte-for-byte to decide whether a repeat is a no-op, so a link
 * managed inside it would make every repeat differ from itself.
 */
const HUB_HEADING = '## 🔗 Related Resources & Notes';
/** Any heading a hub link may sit under, so a curated note is connected where it already reads. */
const HUB_HEADING_PATTERN = /^#{2,6}\s+.*\bRelated\b/;

const COMMANDS = ['brief', 'context', 'done', 'learn', 'lock-state', 'migrate-log', 'personal'] as const;
type Command = (typeof COMMANDS)[number];

/** True when the command writes to the vault. Used by the help text and by validation. */
const WRITING_COMMANDS: ReadonlySet<Command> = new Set<Command>(['done', 'learn', 'migrate-log', 'personal']);

interface Options {
  root: string;
  rootExplicit: boolean;
  dryRun: boolean;
  /** `done --personal`: the entry is the owner's own log and never touches handoff.md. */
  personal: boolean;
  /** `migrate-log --date <YYYY-MM-DD>`: the note to separate. Defaults to today. */
  date: string | null;
  /** `migrate-log --select <HH:MM AM>`: explicit owner selection of a personal entry to move. */
  select: string[];
  /** `migrate-log --select-summary <text>`: the same, by a unique substring of the summary. */
  selectSummaries: string[];
  showPaths: boolean;
}

type Parsed =
  | { kind: 'help' }
  | { kind: 'error'; message: string }
  | { kind: 'command'; command: Command; args: string[]; options: Options };

function usage(): string {
  return [
    'heyloey — repository-local vault commands (the CLI, not the chat prefix)',
    '',
    'Usage:',
    '  npm run heyloey -- [--root <dir>] <command> [arguments] [--dry-run] [--show-paths]',
    '',
    'Commands:',
    '  brief                       Read-only. A condensed pulse: records present, today\'s focus,',
    '                              open tasks, habits, inbox count and active projects.',
    '  context "<query>"           Read-only. Routes the query to matching projects, snippets,',
    '                              notes and runbooks, printing paths only.',
    '  done "<summary>"            Records a completed milestone as a row in the one agent table',
    '                              under `### 🤖 Agent Milestones` in today\'s daily note and under',
    '                              `### Latest Updates` in handoff.md. Refuses if either record is',
    '                              absent. Milestones only — see the Hey Loey Guide. With --personal',
    '                              the entry lands under `### 🧍 Personal Log` as a bullet and',
    '                              handoff.md is left alone.',
    '  learn "<Title>" "<Pattern>" Indexes a reusable technical pattern in `03-Dev/` and',
    '                              links it to the existing Dev hub. A colliding title merges',
    '                              into a marked region instead of overwriting hand-written',
    '                              content.',
    '  personal "<entry>"          Shorthand for `done --personal`: the owner\'s own entry, under',
    '                              `### 🧍 Personal Log`, with handoff.md never touched.',
    '  migrate-log [--date <day>] [--select <time>]... [--select-summary <text>]...',
    '                              One note (today unless --date is given) gains its labelled areas',
    '                              and its one agent table. Existing agent bullets and the old',
    '                              agent callout are converted; nothing is classified by its',
    '                              wording. Personal entries move only when named with --select',
    '                              or --select-summary.',
    '  lock-state                  Read-only. Reports the vault, lock protocol, and kernel lock file.',
    '',
    'Options:',
    '  --root <dir>   Vault to act on. Defaults to the working directory. Never guessed from',
    '                 this script\'s location, so the same command works from anywhere.',
    '  --dry-run      For writing commands: print the target paths and the exact lines that',
    '                 would be written, and write nothing.',
    '  --personal     With `done`: write under `### 🧍 Personal Log` and skip handoff.md.',
    '  --date <day>   With `migrate-log`: the daily note to separate (YYYY-MM-DD).',
    '  --select <t>   With `migrate-log`: move exactly one personal entry with this time, e.g.',
    '                 "09:21 AM". Repeat for more. This is the ONLY way a personal entry is moved:',
    '                 the command never infers authorship from a verb or a capital letter.',
    '  --select-summary <text>',
    '                 With `migrate-log`: the same, selected by a unique substring of the summary.',
    '  --show-paths   Print the absolute target path (diagnostics). Output is relative by',
    '                 default, because it is routinely pasted into an issue.',
    '  -h, --help     This text.',
    '',
    'This is the deterministic CLI. The `"heyloey"` / `"hey loey"` chat prefix is a separate',
    'conversational interface handled by the assistant inside the chat; it is not this command.',
    'Installing the CLI globally is optional — `npm run heyloey` needs only Node.',
  ].join('\n');
}

function parseArgs(argv: string[]): Parsed {
  let root = process.env.LOEY_SPACE_DIR || process.cwd();
  let rootExplicit = false;
  let dryRun = false;
  let personal = false;
  let date: string | null = null;
  const select: string[] = [];
  const selectSummaries: string[] = [];
  let showPaths = false;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { kind: 'help' };
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--personal') {
      personal = true;
      continue;
    }
    if (arg === '--date') {
      const value = argv[i + 1];
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { kind: 'error', message: '--date requires YYYY-MM-DD, e.g. --date 2026-10-18' };
      }
      date = value;
      i += 1;
      continue;
    }
    if (arg === '--select' || arg.startsWith('--select=')) {
      const value = arg === '--select' ? argv[++i] : arg.slice('--select='.length);
      if (!value) return { kind: 'error', message: '--select requires a time, e.g. --select "09:21 AM"' };
      select.push(value);
      continue;
    }
    if (arg === '--select-summary' || arg.startsWith('--select-summary=')) {
      const value = arg === '--select-summary' ? argv[++i] : arg.slice('--select-summary='.length);
      if (!value) return { kind: 'error', message: '--select-summary requires a substring of the entry' };
      selectSummaries.push(value);
      continue;
    }
    if (arg === '--show-paths') {
      showPaths = true;
      continue;
    }
    if (arg === '--root') {
      const value = argv[i + 1];
      if (!value) return { kind: 'error', message: '--root requires a directory' };
      root = value;
      rootExplicit = true;
      i += 1;
      continue;
    }
    if (arg.startsWith('--root=')) {
      root = arg.slice('--root='.length);
      if (!root) return { kind: 'error', message: '--root requires a directory' };
      rootExplicit = true;
      continue;
    }
    if (arg.startsWith('-') && arg !== '-') {
      return { kind: 'error', message: `unknown option: ${arg}` };
    }
    positional.push(arg);
  }

  if (positional.length === 0) return { kind: 'help' };

  const command = positional[0];
  if (!(COMMANDS as readonly string[]).includes(command)) {
    return { kind: 'error', message: `unknown command: ${command}` };
  }
  if ((select.length > 0 || selectSummaries.length > 0) && command !== 'migrate-log') {
    return { kind: 'error', message: '--select and --select-summary are only valid with migrate-log' };
  }
  if (personal && command !== 'done') {
    return { kind: 'error', message: '--personal is only valid with done' };
  }
  if (date !== null && command !== 'migrate-log') {
    return { kind: 'error', message: '--date is only valid with migrate-log' };
  }

  return {
    kind: 'command',
    command: command as Command,
    args: positional.slice(1),
    options: { root: path.resolve(root), rootExplicit, dryRun, personal, date, select, selectSummaries, showPaths },
  };
}

/**
 * How a target is named in output. The absolute path is opt-in (`--show-paths`): the default
 * report is safe to paste into an issue because it never publishes the user's filesystem layout.
 */
function describeTarget(root: string, showPaths: boolean): string {
  if (showPaths) return root;
  const relative = path.relative(process.cwd(), root);
  if (relative === '') return '.';
  return path.isAbsolute(relative) ? path.basename(root) : relative;
}

type Refusal =
  | { reason: 'not a directory' }
  | { reason: 'refusing to act on the filesystem root' }
  | { reason: 'refusing to act on a Git directory' }
  | { reason: 'not a vault'; missing: string[] };

/** The same reachable, non-guessed safety check `vault-init` uses. No upward search. */
function validateTarget(root: string): Refusal | null {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { reason: 'not a directory' };
  }
  if (root === path.parse(root).root) {
    return { reason: 'refusing to act on the filesystem root' };
  }
  if (path.basename(root) === '.git') {
    return { reason: 'refusing to act on a Git directory' };
  }
  const missing = REQUIRED_MARKERS.filter((marker) => !fs.existsSync(path.join(root, marker)));
  if (missing.length > 0) {
    return { reason: 'not a vault', missing };
  }
  return null;
}

function refusalLine(failure: Refusal, root: string, showPaths: boolean): string {
  const detail =
    failure.reason === 'not a vault'
      ? `not a vault: missing ${failure.missing.join(', ')}`
      : failure.reason;
  return `heyloey: ${detail}: ${describeTarget(root, showPaths)}`;
}

// --- Vault write serialization (canonical flock protocol) ------------------
const LOCK_TIMEOUT_MS = Number(process.env.LOEY_LOCK_TIMEOUT_MS || 15000);
const LOCK_IMPL_REQUESTED = String(process.env.LOEY_LOCK_IMPL || 'auto').toLowerCase();
const LOCK_ALREADY_HELD = process.env.LOEY_LOCK_HELD === '1';
const LOCK_WRAPPER_PID = LOCK_ALREADY_HELD ? process.ppid : null;
const LOCK_HOLD_MS = Number(process.env.LOEY_LOCK_HOLD_MS || 0);

const RETIRED_LOCK_KNOBS = ['LOEY_LOCK_RECOVERY', 'LOEY_LOCK_STALE_MS', 'LOEY_LOCK_RECLAIM_DELAY_MS'];

function obsoleteLockConfig(): string[] {
  const problems: string[] = [];
  if (LOCK_IMPL_REQUESTED !== 'auto' && LOCK_IMPL_REQUESTED !== 'flock') {
    problems.push(
      LOCK_IMPL_REQUESTED === 'file'
        ? 'LOEY_LOCK_IMPL=file requests the removed metadata-file tier (only auto|flock remain)'
        : `LOEY_LOCK_IMPL=${LOCK_IMPL_REQUESTED} is not a supported value (only auto|flock remain)`
    );
  }
  for (const knob of RETIRED_LOCK_KNOBS) {
    const value = process.env[knob];
    if (value !== undefined && String(value) !== '') {
      problems.push(`${knob}=${value} configured the removed metadata-file tier`);
    }
  }
  return problems;
}

function lockDirPath(): string {
  return (
    process.env.LOEY_LOCK_DIR ||
    (fs.existsSync('/tmp') ? '/tmp/heyloey-locks' : path.join(os.tmpdir(), 'heyloey-locks'))
  );
}

function vaultLockKey(root: string): string {
  let identity = root;
  try {
    identity = fs.realpathSync(root);
  } catch (_) {}
  return crypto.createHash('sha1').update(identity).digest('hex').slice(0, 20);
}

function kernelLockPath(root: string): string {
  return path.join(lockDirPath(), `vault-${vaultLockKey(root)}.flock`);
}

function legacyLockPath(root: string): string {
  return path.join(lockDirPath(), `vault-${vaultLockKey(root)}.lock`);
}

let _flockChecked = false;
let _flockBin: string | null = null;

function flockBinPath(): string | null {
  if (process.env.FLOCK_BIN) return process.env.FLOCK_BIN;
  if (_flockChecked) return _flockBin;
  _flockChecked = true;
  if (process.platform === 'win32') return _flockBin;
  try {
    const p = execSync('command -v flock 2>/dev/null', { encoding: 'utf8', shell: '/bin/sh' }).trim();
    if (p) _flockBin = p;
  } catch (_) {}
  return _flockBin;
}

function kernelLockOwnerGone(): boolean {
  if (!LOCK_ALREADY_HELD) return false;
  if (LOCK_WRAPPER_PID !== 1 && process.ppid === 1) return true;
  if (LOCK_WRAPPER_PID && LOCK_WRAPPER_PID > 1) {
    try {
      process.kill(LOCK_WRAPPER_PID, 0);
    } catch (e: any) {
      if (e.code === 'ESRCH') return true;
    }
  }
  return false;
}

function assertKernelLockHeld(): void {
  if (!kernelLockOwnerGone()) return;
  console.error(
    '[heyloey] LOCK unavailable: the kernel lock wrapper is gone (it exited or was killed), so the kernel lock is no longer held; nothing written.'
  );
  process.exit(8);
}

function getVaultSource(root: string, options: Options): string {
  if (process.env.LOEY_SPACE_DIR && path.resolve(process.env.LOEY_SPACE_DIR) === path.resolve(root)) {
    return 'LOEY_SPACE_DIR';
  }
  if (options.rootExplicit) {
    return '--root';
  }
  return 'default';
}

function detectSynthetic(root: string): { synthetic: boolean; reason: string | null } {
  if (process.env.LOEY_SPACE_SYNTHETIC === '1') {
    return { synthetic: true, reason: 'LOEY_SPACE_SYNTHETIC=1' };
  }
  const candidates = [root, process.cwd()];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, '.loey-synthetic'))) {
      return { synthetic: true, reason: `.loey-synthetic in ${dir}` };
    }
  }
  return { synthetic: false, reason: null };
}

function atomicWriteFileSync(filePath: string, content: string): void {
  assertKernelLockHeld();
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
  );
  let targetMode: number | null = null;
  try {
    targetMode = fs.statSync(filePath).mode & 0o777;
  } catch (_) {}
  if (targetMode !== null) {
    fs.accessSync(filePath, fs.constants.W_OK);
  }
  let fd: number | null = null;
  try {
    fd = fs.openSync(tmp, 'wx', targetMode !== null ? targetMode : 0o644);
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    if (targetMode !== null) {
      try {
        fs.chmodSync(tmp, targetMode);
      } catch (_) {}
    }
    fs.renameSync(tmp, filePath);
  } catch (e) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {}
    }
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (_) {}
    throw e;
  }
}

function runUnderKernelLock(root: string): void {
  const bin = flockBinPath();
  if (!bin) {
    console.error('[heyloey] LOCK unavailable: flock binary not found; nothing written.');
    process.exit(8);
  }
  const p = kernelLockPath(root);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  } catch (_) {}
  const timeoutMs = Number(process.env.LOEY_LOCK_TIMEOUT_MS || 15000);
  const secs = Math.max(1, Math.ceil(timeoutMs / 1000));
  const scriptPath = path.resolve(process.argv[1] || __filename);
  const child = spawn(
    bin,
    [
      '-w',
      String(secs),
      '-E',
      '7',
      p,
      process.execPath,
      ...process.execArgv,
      scriptPath,
      ...process.argv.slice(2),
    ],
    {
      stdio: 'inherit',
      detached: true,
      env: {
        ...process.env,
        LOEY_LOCK_HELD: '1',
        LOEY_LOCK_IMPL_USED: 'flock',
      },
    }
  );

  const forwardSig = (sig: NodeJS.Signals): void => {
    try {
      if (child.pid) process.kill(-child.pid, sig);
    } catch (_) {
      try {
        child.kill(sig);
      } catch (__) {}
    }
  };

  const onSigInt = () => forwardSig('SIGINT');
  const onSigTerm = () => forwardSig('SIGTERM');
  const onSigHup = () => forwardSig('SIGHUP');

  process.once('SIGINT', onSigInt);
  process.once('SIGTERM', onSigTerm);
  process.once('SIGHUP', onSigHup);

  child.on('error', (e) => {
    console.error(`[heyloey] LOCK unavailable: kernel lock failed: ${e.message} (${p}); nothing written.`);
    process.exit(8);
  });

  child.on('exit', (code, signal) => {
    process.removeListener('SIGINT', onSigInt);
    process.removeListener('SIGTERM', onSigTerm);
    process.removeListener('SIGHUP', onSigHup);
    if (signal) process.exit(signal === 'SIGINT' ? 130 : 143);
    if (code === 7) {
      console.error(
        `[heyloey] LOCK contention: timed out after ${timeoutMs}ms waiting for ${p} (impl=flock, kernel-managed: the kernel releases the lock when its holder exits, so there is no stale state to recover); nothing written.`
      );
      process.exit(7);
    }
    process.exit(code === null ? 1 : code);
  });
}

function runLockState(root: string, options: Options): number {
  const problems = obsoleteLockConfig();
  const source = getVaultSource(root, options);
  if (problems.length > 0) {
    console.log(`[heyloey] Vault: ${root} (source: ${source})`);
    console.log('[heyloey] LOCK protocol: unavailable (removed configuration present)');
    for (const p of problems) console.error(`[heyloey] LOCK config error: ${p}`);
    return 8;
  }
  if (process.platform === 'win32') {
    console.log(`[heyloey] Vault: ${root} (source: ${source})`);
    console.log('[heyloey] LOCK protocol: unavailable (flock is not available on native Windows; run within WSL)');
    return 8;
  }
  const legacy = legacyLockPath(root);
  if (fs.existsSync(legacy)) {
    console.log(`[heyloey] Vault: ${root} (source: ${source})`);
    console.log(`[heyloey] LOCK legacy state: a metadata-file lock from the removed file tier exists at ${legacy}`);
    return 9;
  }
  const bin = flockBinPath();
  if (!bin) {
    console.log(`[heyloey] Vault: ${root} (source: ${source})`);
    console.log('[heyloey] LOCK protocol: unavailable (flock binary not found)');
    return 8;
  }
  const kPath = kernelLockPath(root);
  console.log(`[heyloey] Vault: ${root} (source: ${source})`);
  console.log('[heyloey] LOCK protocol: kernel-managed flock');
  console.log(`[heyloey] LOCK kernel lock file: ${kPath}`);
  return 0;
}

function readText(root: string, rel: string): string | null {
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute)) return null;
  return fs.readFileSync(absolute, 'utf8');
}

/** True when `candidate` is `root` itself or lives beneath it, with no `..` escape. */
function isInsideVault(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Resolve a vault-relative write target, or null when it would leave the vault.
 *
 * Two escapes are checked, because the daily-note config (`folder`/`format`) is vault data and a
 * directory can be a symlink out of the tree:
 *
 *   1. Lexical traversal (`../../etc`) is caught by resolving against the root and rejecting a
 *      `..` that escapes it — including an absolute `folder` from `.obsidian/daily-notes.json`.
 *   2. Symlink escape is caught by comparing the REAL path of the deepest path component that
 *      exists (the target itself when present, otherwise its nearest existing ancestor) against
 *      the real vault root. A note that is a symlink to somewhere else resolves outside and is
 *      refused before any write.
 *
 * The caller must validate EVERY target before writing any of them, so a refusal cannot leave
 * one file changed and another untouched.
 */
function resolveInsideVault(root: string, rel: string): string | null {
  const realRoot = fs.realpathSync(root);
  const absolute = path.resolve(root, rel);
  if (!isInsideVault(path.resolve(root), absolute)) return null;

  let probe = absolute;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const realProbe = fs.realpathSync(probe);
  return isInsideVault(realRoot, realProbe) ? absolute : null;
}

function todayStr(): string {
  return aucklandStamp().date;
}

function timeStr(date: Date = new Date()): string {
  return aucklandStamp(date).time;
}

function loadDailyNotesConfig(root: string): DailyNotesConfig {
  const raw = readText(root, DAILY_NOTES_CONFIG_PATH);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DailyNotesConfig>;
      return {
        folder:
          typeof parsed.folder === 'string' && parsed.folder
            ? parsed.folder
            : DEFAULT_DAILY_NOTES_CONFIG.folder,
        format:
          typeof parsed.format === 'string' && parsed.format
            ? parsed.format
            : DEFAULT_DAILY_NOTES_CONFIG.format,
      };
    } catch {
      // A malformed config must not stop the command; the defaults match this vault.
    }
  }
  return DEFAULT_DAILY_NOTES_CONFIG;
}

/**
 * The body of a `##`/`###` section, from its heading to the next heading of the same or a higher
 * level, or to a horizontal rule.
 *
 * Level-aware on purpose: the daily log's `###` areas belong to `## 📝 Daily Log`, so ending the
 * parent at the first `###` would hide every entry in an area from duplicate prevention — which is
 * exactly how a retry writes the same milestone twice.
 */
function sectionSlice(lines: string[], heading: string): { start: number; end: number } | null {
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;
  const level = (heading.match(/^#+/)?.[0].length ?? 2);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const found = trimmed.match(/^(#{1,6})\s/);
    if ((found && found[1].length <= level) || trimmed === '---') {
      end = i;
      break;
    }
  }
  return { start, end };
}

interface InsertResult {
  content: string;
  ok: boolean;
  /** True when the exact line was already present, so the write is a no-op. */
  duplicate?: boolean;
}

/**
 * Append one bullet to one labelled area of `## 📝 Daily Log`.
 *
 * The area is created when it is absent, in canonical order, so every writer routes to its own
 * area without asking the caller to prepare the note. An entry already present in that area is a
 * no-op rather than a duplicate, which is what makes a retry after a partial write safe. An
 * untouched template leaves an empty `- ` placeholder; it is reused rather than preceded, so the
 * first real entry does not sit above a stray bullet.
 */
function insertDailyLogLine(content: string, line: string, area: LogArea = 'agent'): InsertResult {
  return insertDailyLogEntry(content, line, area);
}

/** Insert one bullet directly under `### Latest Updates`, newest first. */
function insertLatestUpdate(content: string, line: string): InsertResult {
  const lines = content.split('\n');
  const section = sectionSlice(lines, HANDOFF_HEADING);
  if (!section) return { content, ok: false };

  const body = lines.slice(section.start + 1, section.end);
  if (body.some((entry) => entry.trim() === line.trim())) {
    return { content, ok: true, duplicate: true };
  }

  let insertAt = section.start + 1;
  while (insertAt < section.end && lines[insertAt].trim() === '') insertAt += 1;
  lines.splice(insertAt, 0, line);
  return { content: lines.join('\n'), ok: true };
}

/** Count `- [x]` / total checkboxes in a section, for the brief's summary. */
function countCheckboxes(lines: string[], heading: string): { done: number; total: number } {
  const section = sectionSlice(lines, heading);
  if (!section) return { done: 0, total: 0 };
  let done = 0;
  let total = 0;
  for (let i = section.start + 1; i < section.end; i += 1) {
    const match = lines[i].match(/^\s*-\s*\[(.)\]/);
    if (!match) continue;
    total += 1;
    // Reuse the shared task-status rule rather than re-implementing "checked".
    const task: TaskLike = { text: lines[i], status: match[1], path: '' };
    if (isDone(task)) done += 1;
  }
  return { done, total };
}

/** Count plain (non-checkbox) bullets in a section, used for Today's Focus intentions. */
function countBullets(lines: string[], heading: string): number {
  const section = sectionSlice(lines, heading);
  if (!section) return 0;
  let count = 0;
  for (let i = section.start + 1; i < section.end; i += 1) {
    if (/^\s*-\s+\S/.test(lines[i]) && !/^\s*-\s*\[/.test(lines[i])) count += 1;
  }
  return count;
}

/** Projects whose master note declares an active lifecycle, read through the shared rule. */
function activeProjects(root: string): string[] {
  const dir = path.join(root, '02-Projects');
  if (!fs.existsSync(dir)) return [];
  const active: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const hub = readText(root, path.join('02-Projects', entry.name, `${entry.name}.md`));
    if (!hub) continue;
    if (isLifecycleActive(readFrontmatterValue(hub, 'status'))) active.push(entry.name);
  }
  return active.sort();
}

interface StaleTask {
  text: string;
  days: number;
}

/** Check open tasks in text for explicit 📅 YYYY-MM-DD tags older than 7 days. */
function findStaleTasks(dailyContent: string | null, handoffContent: string | null, todayDate: string): StaleTask[] {
  const stale: StaleTask[] = [];
  const dateRegex = /(?:📅|created:)\s*(\d{4}-\d{2}-\d{2})/;
  const todayMs = new Date(todayDate).getTime();

  function checkLine(line: string) {
    const trimmed = line.trim();
    if (!/^- \[[ \/]\] /.test(trimmed)) return;
    const match = trimmed.match(dateRegex);
    if (!match) return;
    const taskDate = match[1];
    const taskMs = new Date(taskDate).getTime();
    if (isNaN(taskMs)) return;
    const days = Math.floor((todayMs - taskMs) / (1000 * 60 * 60 * 24));
    if (days >= 7) {
      const clean = trimmed
        .replace(/^- \[[ \/]\]\s*/, '')
        .replace(dateRegex, '')
        .trim();
      const snippet = clean.length > 40 ? clean.slice(0, 37) + '...' : clean;
      stale.push({ text: snippet, days });
    }
  }

  if (dailyContent) {
    for (const line of dailyContent.split('\n')) checkLine(line);
  }
  if (handoffContent) {
    for (const line of handoffContent.split('\n')) checkLine(line);
  }
  return stale;
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

function runBrief(root: string, options: Options): number {
  const label = describeTarget(root, options.showPaths);
  const lines: string[] = [];
  lines.push(`🌅 Hey Loey brief · Vault root: ${label}`);

  const memory = fs.existsSync(path.join(root, MEMORY_RECORD));
  const handoff = fs.existsSync(path.join(root, HANDOFF_RECORD));
  lines.push(
    `Records: ${MEMORY_RECORD} ${memory ? 'present' : 'missing'}, ` +
      `${HANDOFF_RECORD} ${handoff ? 'present' : 'missing'}`
  );

  const config = loadDailyNotesConfig(root);
  const dailyRel = resolveDailyNoteFile(todayStr(), config);
  // A traversal in the daily-notes config is reported rather than followed: reading outside the
  // vault is the same escape as writing outside it, just quieter.
  const dailyInside = resolveInsideVault(root, dailyRel) !== null;
  const daily = dailyInside ? readText(root, dailyRel) : null;
  lines.push(
    `Today (${todayStr()}): ${dailyRel} ` +
      `${dailyInside ? (daily ? 'present' : 'missing') : 'outside the vault — ignored'}`
  );

  if (daily) {
    const dailyLines = daily.split('\n');
    const focus = countBullets(dailyLines, "### 🎯 Today's Focus");
    const tasks = countCheckboxes(dailyLines, '### ✅ Tasks');
    const habits = countCheckboxes(dailyLines, '### 🔁 Habits');
    const mood = readFrontmatterValue(daily, 'mood') || '—';
    const energy = readFrontmatterValue(daily, 'energy') || '—';
    const sleep = readFrontmatterValue(daily, 'sleep_hours') || '—';
    lines.push(`  Focus: ${focus} intention${focus === 1 ? '' : 's'}`);
    lines.push(`  Tasks: ${tasks.total - tasks.done} open / ${tasks.done} done`);
    lines.push(`  Habits: ${habits.done}/${habits.total}`);
    lines.push(`  Vitals: mood=${mood}, energy=${energy}, sleep_hours=${sleep}`);
  }

  // Inbox: counted through the triage parser so "unprocessed" means the same thing here as it
  // does during a sweep. Only the count is printed — never a capture's words.
  const dump = readText(root, '00-Inbox/quick-capture-dump.md');
  const inbox = dump ? parseDumpLines(dump.split('\n')).length : 0;
  lines.push(`Inbox: ${inbox} unprocessed capture${inbox === 1 ? '' : 's'}`);

  const projects = activeProjects(root);
  lines.push(
    `Active projects: ${projects.length}${projects.length ? ` (${projects.join(', ')})` : ''}`
  );

  // Maintenance alerts (0 lines when everything is clean)
  const alerts: string[] = [];
  if (inbox >= 5) {
    alerts.push(`⚠️ INBOX: ${inbox} unprocessed captures in 00-Inbox/quick-capture-dump.md`);
  }
  const auckland = aucklandStamp();
  const currentHour = parseInt(auckland.time.split(':')[0], 10);
  if (daily) {
    const habits = countCheckboxes(daily.split('\n'), '### 🔁 Habits');
    if (currentHour >= 18 && habits.total > 0 && habits.done === 0) {
      alerts.push(`⚠️ HABITS: 0/${habits.total} completed today (Local time: ${auckland.time})`);
    }
  }
  const handoffText = handoff ? readText(root, HANDOFF_RECORD) : null;
  const staleTasks = findStaleTasks(daily, handoffText, auckland.date);
  for (const stale of staleTasks.slice(0, 2)) {
    alerts.push(`⚠️ STALE TASK: "${stale.text}" (${stale.days}d old)`);
  }

  if (alerts.length > 0) {
    lines.push('Alerts:');
    for (const alert of alerts) {
      lines.push(`  ${alert}`);
    }
  }

  console.log(lines.join('\n'));
  return 0;
}

interface RouteCandidate {
  rel: string;
  aliases: Set<string>;
  headings: Set<string>;
}

/** Index the non-private, non-daily knowledge folders for query routing. */
function indexRouteCandidates(root: string): RouteCandidate[] {
  const candidates: RouteCandidate[] = [];

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const rel = path.relative(root, absolute).split(path.sep).join('/');
      const content = fs.readFileSync(absolute, 'utf8');
      const aliases = new Set(parseAliases(content).map((alias) => alias.toLowerCase()));
      const headings = new Set(
        content
          .split('\n')
          .map((line) => line.match(/^#{1,6}\s+(.*)$/))
          .filter((match): match is RegExpMatchArray => match !== null)
          .map((match) => match[1].trim().toLowerCase())
      );
      // Touch the link reader so this routing stays on the shared parser rather than a second
      // regex; the targets are not needed for scoring but keeping one parser prevents drift.
      extractWikilinks(content);
      candidates.push({ rel, aliases, headings });
    }
  };

  for (const prefix of ROUTE_PREFIXES) {
    const dir = path.join(root, prefix);
    if (fs.existsSync(dir)) walk(dir);
  }
  return candidates;
}

function runContext(root: string, args: string[], options: Options): number {
  const query = args.join(' ').trim();
  if (!query) {
    console.error('heyloey: context requires a query, e.g. `context "kanban sync"`');
    return 2;
  }

  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2);

  if (tokens.length === 0) {
    console.log('No usable query tokens (each must be at least two characters).');
    return 0;
  }

  const scored: Array<{ rel: string; score: number; because: string[] }> = [];
  for (const candidate of indexRouteCandidates(root)) {
    const base = path.basename(candidate.rel, '.md').toLowerCase();
    let score = 0;
    const because: string[] = [];
    for (const token of tokens) {
      if (base === token) {
        score += 8;
        if (!because.includes('name')) because.push('name');
      } else if (base.includes(token)) {
        score += 5;
        if (!because.includes('name')) because.push('name');
      }
      if ([...candidate.aliases].some((alias) => alias.includes(token))) {
        score += 6;
        if (!because.includes('alias')) because.push('alias');
      }
      if ([...candidate.headings].some((heading) => heading.includes(token))) {
        score += 3;
        if (!because.includes('heading')) because.push('heading');
      }
    }
    if (score > 0) scored.push({ rel: candidate.rel, score, because });
  }

  scored.sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel));

  console.log(`🔎 context "${query}" · Vault root: ${describeTarget(root, options.showPaths)}`);
  if (scored.length === 0) {
    console.log('No matching notes.');
    return 0;
  }
  for (const hit of scored.slice(0, 5)) {
    console.log(`  ${hit.rel}  — matches ${hit.because.join(', ')}`);
  }
  return 0;
}

type RecordStatus = 'written' | 'already-recorded' | 'failed' | 'not-applicable';

/** True when `summary` already appears in the body of `heading` — a per-record check, not a file-wide one. */
function hasSummaryInSection(content: string, heading: string, summary: string): boolean {
  const lines = content.split('\n');
  const section = sectionSlice(lines, heading);
  if (!section) return false;
  return lines.slice(section.start + 1, section.end).some((line) => line.includes(summary));
}

/** Canonical outcome → exit code contract, shared with the installed `heyloey` writer. */
const DONE_EXIT: Record<string, number> = {
  logged: 0,
  'already-recorded': 0,
  skipped: 3,
  refused: 4,
  partial: 5,
  failed: 6,
};

function runDone(root: string, args: string[], options: Options): number {
  const summary = toSingleLine(args.join(' ')).trim();
  if (!summary) {
    console.error('heyloey: done requires a one-line summary, e.g. `done "Ship the parser fix"`');
    return 2;
  }

  // A personal entry is the owner's own log. It shares the daily note, the lock and the
  // duplicate rule with a milestone, and deliberately shares nothing else: no handoff half.
  const personal = options.personal;

  const source = getVaultSource(root, options);
  const receipt = (outcome: string, daily: string, handoff: string, verified: string): void => {
    console.log(
      `RESULT done ${outcome} daily=${daily} handoff=${handoff} lock=flock target=${root} ` +
        `source=${source} verified=${verified || 'none'}`
    );
  };

  const synthetic = detectSynthetic(root);
  if (synthetic.synthetic) {
    console.log(`[heyloey] SKIPPED done - explicit synthetic opt-out (${synthetic.reason}); nothing written.`);
    console.log(
      `RESULT done skipped lock=flock target=${root} source=${source} reason=synthetic`
    );
    return DONE_EXIT.skipped;
  }

  const config = loadDailyNotesConfig(root);
  const dailyRel = resolveDailyNoteFile(todayStr(), config);

  // Validate BOTH write targets before reading or writing anything. A traversal in the daily-notes
  // config, or a symlink pointing out of the tree, must refuse the whole command — never write the
  // daily note and then discover the handoff target escapes, which would leave the two disagreeing.
  const dailyTarget = resolveInsideVault(root, dailyRel);
  const handoffTarget = resolveInsideVault(root, HANDOFF_RECORD);
  if (!dailyTarget || !handoffTarget) {
    const escaping = !dailyTarget ? dailyRel : HANDOFF_RECORD;
    console.error(`heyloey: refusing to write outside the vault: ${escaping}`);
    console.error('   Nothing was written.');
    receipt('refused', 'not-attempted', 'not-attempted', '');
    return DONE_EXIT.refused;
  }

  const daily = readText(root, dailyRel);
  const handoff = personal ? '' : readText(root, HANDOFF_RECORD);

  // Refusals come before any write, and they name what is missing and how to create it. The
  // command never scaffolds a note: an invented structure is not what the vault expects.
  const problems: string[] = [];
  if (!daily) problems.push(`today's daily note is absent (${dailyRel})`);
  if (!handoff && !personal) problems.push(`${HANDOFF_RECORD} is absent`);
  if (problems.length > 0) {
    console.error(`heyloey: ${problems.join('; ')}.`);
    console.error(
      `   Create the missing record with \`npm run init:vault\` (for ${HANDOFF_RECORD}) and ` +
        `open today's daily note from 99-Templates/Daily.md. Nothing was written.`
    );
    receipt(
      'refused',
      daily ? 'present' : 'missing',
      personal ? 'not-applicable' : handoff ? 'present' : 'missing',
      ''
    );
    return DONE_EXIT.refused;
  }

  const stamp = timeStr();
  const area: LogArea = personal ? 'personal' : 'agent';
  const dailyLine = personal
    ? `- **${displayLogTime(stamp)}**: ${summary}`
    : `| ${displayLogTime(stamp, '&nbsp;')} |  | ${escapeCell(summary)} |`;
  const handoffLine = `- [x] **[${todayStr()} ${stamp}]** ${summary}`;

  // Both insertions are computed before either write, so a heading this command cannot honour
  // refuses the whole run instead of leaving one record updated and the other untouched.
  const dailyResult = personal
    ? insertDailyLogLine(daily as string, dailyLine, 'personal')
    : insertAgentMilestone(daily as string, { stamp, scope: '', summary });
  if (!dailyResult.ok) {
    console.error(
      `heyloey: ${dailyRel} has no \`${DAILY_LOG_HEADING}\` section, so there is nowhere ` +
        `established to write. Nothing was written.`
    );
    receipt('refused', 'section-missing', 'not-attempted', '');
    return DONE_EXIT.refused;
  }

  const handoffResult = personal ? null : insertLatestUpdate(handoff as string, handoffLine);
  if (handoffResult && !handoffResult.ok) {
    console.error(
      `heyloey: ${HANDOFF_RECORD} has no \`${HANDOFF_HEADING}\` section, so there is nowhere ` +
        `established to write. Nothing was written.`
    );
    receipt('refused', 'not-attempted', 'section-missing', '');
    return DONE_EXIT.refused;
  }

  // Each half is decided independently: a retry after a partial write must add only what is
  // missing, never a second copy of the half that already landed. The daily check is scoped to
  // the area that owns the entry, so identical text in the other area never counts as this one.
  const dailyRecorded = logAreaHasSummary(daily as string, area, summary);
  const handoffRecorded = personal ? true : hasSummaryInSection(handoff as string, HANDOFF_HEADING, summary);

  if (options.dryRun) {
    console.log(`🔎 Dry run — nothing was written. Vault: ${describeTarget(root, options.showPaths)}`);
    const area = personal ? LOG_AREA_HEADINGS.personal : LOG_AREA_HEADINGS.agent;
    console.log(`   ${dailyRel} [${area}]${dailyRecorded ? ' (already recorded)' : ''}`);
    if (!dailyRecorded) console.log(`     + ${dailyLine}`);
    if (!personal) {
      console.log(`   ${HANDOFF_RECORD}${handoffRecorded ? ' (already recorded)' : ''}`);
      if (!handoffRecorded) console.log(`     + ${handoffLine}`);
    }
    return 0;
  }

  if (LOCK_HOLD_MS > 0) {
    const waitBuf = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(waitBuf, 0, 0, LOCK_HOLD_MS);
  }

  let dailyStatus: RecordStatus = dailyRecorded ? 'already-recorded' : 'failed';
  if (!dailyRecorded) {
    try {
      atomicWriteFileSync(dailyTarget, dailyResult.content);
      const written = readText(root, dailyRel);
      // Verify inside the owning area, at the position the writer claims to own. A text that
      // landed in the other area is not this writer's record, and saying otherwise is the bug
      // this check exists to catch.
      dailyStatus = written && logAreaHasSummary(written, area, summary) ? 'written' : 'failed';
      if (dailyStatus === 'failed') {
        console.error(`heyloey: post-write verification failed for ${dailyRel}; the entry is not there.`);
      }
    } catch (error) {
      console.error(`heyloey: could not write ${dailyRel}: ${(error as Error).message}`);
    }
  }

  let handoffStatus: RecordStatus = personal
    ? 'not-applicable'
    : handoffRecorded
      ? 'already-recorded'
      : 'failed';
  if (!personal && !handoffRecorded) {
    try {
      atomicWriteFileSync(handoffTarget, handoffResult.content);
      handoffStatus = readText(root, HANDOFF_RECORD)?.includes(summary) ? 'written' : 'failed';
      if (handoffStatus === 'failed') {
        console.error(`heyloey: post-write verification failed for ${HANDOFF_RECORD}; the entry is not there.`);
      }
    } catch (error) {
      console.error(`heyloey: could not write ${HANDOFF_RECORD}: ${(error as Error).message}`);
    }
  }

  const verified = [
    dailyStatus !== 'failed' ? 'daily' : '',
    personal ? '' : handoffStatus !== 'failed' ? 'handoff' : '',
  ]
    .filter(Boolean)
    .join('+');

  const okCount = [dailyStatus, handoffStatus].filter((status) => status !== 'failed').length;
  const writtenCount = [dailyStatus, handoffStatus].filter((status) => status === 'written').length;

  if (okCount === 2) {
    const outcome = writtenCount === 0 ? 'already-recorded' : 'logged';
    if (writtenCount === 0) {
      console.log(
        personal
          ? `↩︎  Personal entry already recorded in ${dailyRel}; nothing changed.`
          : `↩︎  Milestone already recorded in ${dailyRel} and ${HANDOFF_RECORD}; nothing changed.`
      );
    } else if (personal) {
      console.log(`✍️  Logged personal entry to ${dailyRel} (${LOG_AREA_HEADINGS.personal}).`);
      console.log(`   ${dailyLine}`);
    } else {
      console.log(`✍️  Logged milestone to ${dailyRel} and ${HANDOFF_RECORD}.`);
      console.log(`   ${dailyLine}`);
    }
    receipt(outcome, dailyStatus, handoffStatus, verified);
    return DONE_EXIT[outcome];
  }

  // One half landed. Report which, so a caller never has to guess what a retry must complete.
  const outcome = writtenCount > 0 ? 'partial' : 'failed';
  console.error(
    `heyloey: ${outcome} — daily=${dailyStatus}, handoff=${handoffStatus}. ` +
      `Re-run \`done\` to complete the missing half; the recorded half will not be duplicated.`
  );
  receipt(outcome, dailyStatus, handoffStatus, verified);
  return DONE_EXIT[outcome];
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitFrontmatter(content: string): { fm: string; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { fm: '', body: content };
  return { fm: match[1], body: content.slice(match[0].length) };
}

/** Detects a likely fence language for the snippet, defaulting to plain text. */
function detectLanguage(pattern: string): string {
  // TypeScript-only constructs first: a `=>` or a `const` alone is JavaScript, so the broad
  // syntax cues must not be allowed to claim a snippet that is actually plain JS.
  if (/(^|\n)\s*(interface|type)\s+\w+|:\s*(string|number|boolean)\b|<[A-Za-z]\w*>(\s*\(|\s*:)|as\s+const/.test(pattern)) {
    return 'typescript';
  }
  if (/(^|\n)\s*(function|const|let|var)\s+\w+|=>|console\.log\(/.test(pattern)) return 'javascript';
  if (/(^|\n)\s*def\s+\w+\(|print\(|elif\s|self\./.test(pattern)) return 'python';
  if (/(^|\n)\s*(SELECT|INSERT|UPDATE|CREATE TABLE)\b/i.test(pattern)) return 'sql';
  if (/(^|\n)\s*#!.*\b(bash|sh)\b|(^|\n)\s*(echo|export|set -e)\b/.test(pattern)) return 'bash';
  return 'text';
}

/**
 * The generated note MINUS its connectivity section: frontmatter, title and the working sections.
 *
 * Split out from `buildSnippetNote` because the merge path needs this text on its own — it is what
 * goes inside the marked learn region — while the hub link is bookkeeping applied to the note as a
 * whole by `ensureHubLink`.
 */
function buildSnippetCore(title: string, pattern: string, created: string): string {
  const language = detectLanguage(pattern);
  // A pattern that already contains a triple backtick must not close its own fence early.
  const fence = pattern.includes('```') ? '````' : '```';

  return [
    '---',
    `created: ${created}`,
    `updated: ${created}`,
    'type: snippet',
    'area: dev',
    'status: active',
    `language: ${language}`,
    'tags:',
    '  - type/snippet',
    '  - area/dev',
    '  - status/active',
    '---',
    '',
    `# 💻 ${title}`,
    '',
    `> **Reusable ${language} pattern indexed by \`heyloey learn\`.**`,
    '',
    '---',
    '',
    '## ⚡ The Code / Implementation',
    `${fence}${language}`,
    pattern,
    fence,
    '',
    '## 🔍 How It Works & Key Highlights',
    '- ',
    '',
    '## ⚙️ Usage Example',
    '- ',
    '',
    '## ⚠️ Gotchas & Performance Considerations',
    '- ',
    '',
  ].join('\n');
}

/**
 * The trailing connectivity section of a generated snippet.
 *
 * The vault's connectivity rule: a new note in `03-Dev/` must link to its hub. The link is only
 * emitted when the hub exists — a wikilink to a note that is not there is exactly the phantom link
 * the vault forbids.
 */
function connectivitySection(hubLink: string): string {
  return ['---', '', HUB_HEADING, hubLink ? `- ${hubLink}` : '- ', ''].join('\n');
}

function buildSnippetNote(title: string, pattern: string, created: string, hubLink: string): string {
  return `${buildSnippetCore(title, pattern, created)}\n${connectivitySection(hubLink)}`;
}

/** Body of a generated note with its frontmatter and duplicate H1 removed. */
function generatedBody(markdown: string): string {
  return splitFrontmatter(markdown)
    .body.replace(/^\s*#\s+.*\n+/, '')
    .trim();
}

/**
 * Merge a regenerated snippet into an existing note without replacing hand-written content.
 *
 * Mirrors the concept-collision rule (#39): the human body and original `created` date survive,
 * new material lands in a marked, reviewable region, and re-running the identical pattern is a
 * no-op rather than an accumulating block.
 *
 * `core` is the generated snippet WITHOUT its connectivity section (`buildSnippetCore`). The hub
 * link is note-level bookkeeping, so it must not ride inside the region: a link inside it would
 * make an identical repeat differ from the note it produced, and the next pass would have to edit
 * content it is required to preserve.
 *
 * Two details are deliberate:
 *
 *   - The region is written with a REPLACER FUNCTION, never a replacement string. The snippet
 *     body is user input and can contain `$&`, `$$`, `$'` or `` $` ``, all of which a string
 *     replacement would interpret as its own patterns and corrupt the text (or reinsert the
 *     matched region). A function replacement is inserted literally.
 *   - A note created by a previous `learn` carries the whole body but no marked region. Rewriting
 *     it would duplicate everything, so an exact body match is treated as already present.
 */
function mergeLearnNote(
  existing: string,
  core: string
): { content: string; action: 'merged' | 'unchanged' } {
  const incoming = generatedBody(core);
  const { fm, body } = splitFrontmatter(existing);
  const curated = body.trimEnd();

  const region = new RegExp(
    `\\n*${escapeRegExp(LEARN_START)}[\\s\\S]*?${escapeRegExp(LEARN_END)}\\n*`
  );
  const existingRegion = curated.match(region);

  if (existingRegion) {
    if (existingRegion[0].includes(incoming)) return { content: existing, action: 'unchanged' };
  } else if (curated.includes(incoming)) {
    // No marked region, but the body already carries this pattern (a note this command created).
    return { content: existing, action: 'unchanged' };
  }

  const block =
    `${LEARN_START}\n\n` +
    '> [!NOTE] Auto-appended by `heyloey learn`. Review, then keep or delete.\n\n' +
    `${incoming}\n\n${LEARN_END}`;

  const merged = existingRegion
    ? curated.replace(region, () => `\n\n${block}\n`)
    : `${curated}\n\n---\n\n${block}\n`;

  const content = fm ? `---\n${fm}\n---\n\n${merged.trimStart()}` : merged;
  return { content, action: 'merged' };
}

/**
 * Mark every line that belongs to a fenced code block, delimiters included.
 *
 * Snippet patterns live inside fences, and a snippet may legitimately be a line of markdown: a
 * `- [[_Dev MOC]]` inside a code sample is content, not connectivity. Any note-level edit that
 * searches for a line must tell fenced content from note structure, or it deletes the user's code.
 */
function fencedLines(lines: string[]): boolean[] {
  const fenced: boolean[] = [];
  let open: string | null = null;
  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (open === null) {
      // A backtick fence's info string may not itself contain a backtick (CommonMark), so "```js"
      // opens a fence while "```js`" is ordinary content.
      const usable = fence !== null && !(fence[1][0] === '`' && fence[2].includes('`'));
      if (usable) open = fence[1];
      fenced.push(usable);
      continue;
    }
    fenced.push(true);
    // A closing fence is the same character, at least as long, and carries no info string.
    if (fence && fence[1][0] === open[0] && fence[1].length >= open.length && fence[2].trim() === '') {
      open = null;
    }
  }
  return fenced;
}

/**
 * Keep exactly one real link to the Dev hub — outside every code fence.
 *
 * The hub link is bookkeeping, so it is managed on the note as a whole and never inside the
 * generated region, where a rewrite would have to pull a link out of content it must preserve.
 * The three branches are deliberate:
 *
 *   - Exactly one real link: the note is returned untouched, byte for byte. That is what makes a
 *     repeat run a true no-op rather than a rewrite that happens to look the same.
 *   - More than one: the later copies go, the first one stays where it is. Nothing moves, so no
 *     pass has to be run twice to settle.
 *   - None: a link is added under the note's existing "Related" heading when it has one, and
 *     otherwise in a connectivity section appended at the end. Only occurrences outside a fence
 *     count, so a fenced literal never satisfies the link and never gets deleted for it.
 */
function ensureHubLink(content: string, canonical: string): string {
  const lines = content.split('\n');
  const fenced = fencedLines(lines);
  const isHubLine = (index: number): boolean => !fenced[index] && lines[index].trim() === canonical;

  const found = lines.filter((_, index) => isHubLine(index)).length;
  if (found === 1) return content;
  if (found > 1) {
    let kept = false;
    return lines
      .filter((_, index) => {
        if (!isHubLine(index)) return true;
        if (kept) return false;
        kept = true;
        return true;
      })
      .join('\n');
  }

  const heading = lines.findIndex(
    (line, index) => !fenced[index] && HUB_HEADING_PATTERN.test(line)
  );
  if (heading < 0) {
    return `${content.replace(/\s+$/, '')}\n\n---\n\n${HUB_HEADING}\n${canonical}\n`;
  }
  let at = heading + 1;
  while (at < lines.length && lines[at].trim() === '') at++;
  return [...lines.slice(0, at), canonical, ...lines.slice(at)].join('\n');
}

/** Find an existing note whose name matches case-insensitively, for case-folding filesystems. */
function findExistingSnippet(root: string, safeTitle: string): string | null {
  const dir = path.join(root, SNIPPET_DIR);
  if (!fs.existsSync(dir)) return null;
  const wanted = `${safeTitle}.md`.toLowerCase();
  for (const entry of fs.readdirSync(dir)) {
    if (entry.toLowerCase() === wanted) return path.join(SNIPPET_DIR, entry);
  }
  return null;
}

/**
 * Separate one daily note's personal entries from its automated agent milestones.
 *
 * Only the note named (`--date`, today by default) is touched. The agent area is always
 * normalised into its one table; a personal entry moves only when the owner names it with
 * `--select` or `--select-summary`, because the note stores no provenance and this command
 * refuses to guess authorship from wording. Re-running is a no-op.
 */
function runMigrateLog(root: string, args: string[], options: Options): number {
  const source = getVaultSource(root, options);
  const receipt = (
    outcome: string, moved: number, kept: number, adopted: number, daily: string, verified: string
  ): void => {
    console.log(
      `RESULT migrate-log ${outcome} migrated=${moved} kept=${kept} adopted=${adopted} daily=${daily} ` +
        `lock=flock target=${root} source=${source} verified=${verified || 'none'}`
    );
  };

  if (args.length > 0) {
    console.error(`heyloey: migrate-log does not take the argument "${args[0]}"; use --date <YYYY-MM-DD>.`);
    return 2;
  }

  const synthetic = detectSynthetic(root);
  if (synthetic.synthetic) {
    console.log(
      `[heyloey] SKIPPED migrate-log - explicit synthetic opt-out (${synthetic.reason}); nothing written.`
    );
    console.log(
      `RESULT migrate-log skipped migrated=0 kept=0 adopted=0 lock=flock target=${root} source=${source} reason=synthetic`
    );
    return DONE_EXIT.skipped;
  }

  const config = loadDailyNotesConfig(root);
  const dailyRel = resolveDailyNoteFile(options.date ?? todayStr(), config);
  const dailyTarget = resolveInsideVault(root, dailyRel);
  if (!dailyTarget) {
    console.error(`heyloey: refusing to write outside the vault: ${dailyRel}`);
    console.error('   Nothing was written.');
    receipt('refused', 0, 0, 0, 'not-attempted', '');
    return DONE_EXIT.refused;
  }

  const daily = readText(root, dailyRel);
  if (!daily) {
    console.error(`heyloey: the daily note is absent (${dailyRel}). Nothing was written.`);
    receipt('refused', 0, 0, 0, 'missing', '');
    return DONE_EXIT.refused;
  }

  const migrated = migrateAgentMilestones(daily, {
    selectStamps: options.select,
    selectSummaries: options.selectSummaries,
  });
  if (!migrated.ok) {
    console.error(
      `heyloey: ${dailyRel} has no \`${DAILY_LOG_HEADING}\` section, so there is nothing to ` +
        `separate. Nothing was written.`
    );
    receipt('refused', 0, 0, 0, 'section-missing', '');
    return DONE_EXIT.refused;
  }

  if (migrated.selectionErrors.length > 0) {
    for (const message of migrated.selectionErrors) console.error(`heyloey: ${message}`);
    console.error(
      '   Nothing was written. Name exactly one personal entry per --select/--select-summary; ' +
        'an ambiguous or unmatched selection is refused rather than guessed.'
    );
    receipt('refused', 0, migrated.kept.length, 0, 'selection-invalid', '');
    return DONE_EXIT.refused;
  }

  if (options.dryRun) {
    console.log(`🔎 Dry run — nothing was written. Vault: ${describeTarget(root, options.showPaths)}`);
    console.log(`   ${dailyRel} [${LOG_AREA_HEADINGS.personal} → ${LOG_AREA_HEADINGS.agent}]`);
    for (const summary of migrated.moved) console.log(`     → ${summary}`);
    if (migrated.adopted > 0) {
      console.log(`     ⇒ ${migrated.adopted} existing callout(s) already present are adopted by their area`);
    }
    for (const summary of migrated.kept) console.log(`     · left in place: ${summary}`);
    return 0;
  }

  if (migrated.content === daily) {
    console.log(
      `↩︎  ${dailyRel} is already separated: ${migrated.moved.length} moved, ` +
        `${migrated.kept.length} left in place; nothing changed.`
    );
    receipt('already-recorded', migrated.moved.length, migrated.kept.length, migrated.adopted, dailyRel, 'daily');
    return 0;
  }

  try {
    atomicWriteFileSync(dailyTarget, migrated.content);
  } catch (error) {
    console.error(`heyloey: could not write ${dailyRel}: ${(error as Error).message}`);
    receipt('failed', migrated.moved.length, migrated.kept.length, migrated.adopted, dailyRel, '');
    return DONE_EXIT.failed;
  }

  if (readText(root, dailyRel) !== migrated.content) {
    console.error(`heyloey: post-write verification failed for ${dailyRel}; the note is not as written.`);
    receipt('failed', migrated.moved.length, migrated.kept.length, migrated.adopted, dailyRel, '');
    return DONE_EXIT.failed;
  }

  console.log(
    `🧹 Separated ${dailyRel}: ${migrated.moved.length} agent milestone(s) moved to ` +
      `${LOG_AREA_HEADINGS.agent}, ${migrated.adopted} callout(s) adopted, ` +
      `${migrated.kept.length} entry(ies) left in place.`
  );
  receipt('logged', migrated.moved.length, migrated.kept.length, migrated.adopted, dailyRel, 'daily');
  return 0;
}

function runLearn(root: string, args: string[], options: Options): number {
  const title = toSingleLine(args[0] ?? '');
  const pattern = args.slice(1).join('\n').replace(/\s+$/, '');
  if (!title || !pattern) {
    console.error(
      'heyloey: learn requires a title and a pattern, e.g. `learn "Debounce" "const d = ..."`'
    );
    return 2;
  }

  const safeTitle = sanitizeTitle(title);
  if (!safeTitle) {
    console.error(`heyloey: "${title}" has no usable filename characters.`);
    return 2;
  }

  const created = todayStr();
  // Connectivity: link the snippet to the existing Dev hub. The link is real only because the hub
  // exists — when it does not, no link is written, so the vault is never handed a phantom wikilink.
  const hubLink = fs.existsSync(path.join(root, DEV_HUB)) ? DEV_HUB_LINK : '';
  const connection = hubLink
    ? `${hubLink} (existing Dev hub)`
    : 'no hub link — no existing Dev hub to connect to';
  // The region payload and the whole note are built from one core, so the two can never drift:
  // the note adds the hub link at the end, the region never carries it.
  const core = buildSnippetCore(safeTitle, pattern, created);
  const generated = `${core}\n${connectivitySection(hubLink)}`;

  const existingRel = findExistingSnippet(root, safeTitle);
  const targetRel = existingRel ?? path.join(SNIPPET_DIR, `${safeTitle}.md`);

  // Validate the write target before touching anything: a symlinked `03-Dev/` (or a symlinked
  // existing note) must refuse rather than write outside the vault.
  const targetAbs = resolveInsideVault(root, targetRel);
  if (!targetAbs) {
    console.error(`heyloey: refusing to write outside the vault: ${targetRel.replace(/\\/g, '/')}`);
    console.error('   Nothing was written.');
    return 1;
  }

  let content = generated;
  let action: 'created' | 'merged' | 'unchanged' = 'created';
  let original: string | null = null;
  if (existingRel) {
    original = fs.readFileSync(path.join(root, existingRel), 'utf8');
    const merged = mergeLearnNote(original, core);
    content = merged.content;
    action = merged.action;
  }
  // Connectivity is note-level bookkeeping, never part of the region: the link is added only when
  // the note has no real (unfenced) one, and a note that already has one is returned byte for byte.
  if (hubLink) content = ensureHubLink(content, `- ${hubLink}`);

  // The bytes decide, not the merge report. Whatever bookkeeping ran above, an identical result
  // means nothing is written and nothing is claimed as written; a different result caused by
  // bookkeeping alone is still a real change and must be reported as one.
  if (original !== null) {
    if (content === original) {
      content = original;
      action = 'unchanged';
    } else if (action === 'unchanged') {
      action = 'merged';
    }
  }

  if (options.dryRun) {
    console.log(`🔎 Dry run — nothing was written. Vault: ${describeTarget(root, options.showPaths)}`);
    console.log(`   ${targetRel.replace(/\\/g, '/')} (${action === 'created' ? 'would create' : `would ${action}`})`);
    console.log(`   connects: ${connection}`);
    console.log('');
    console.log(content);
    return 0;
  }

  if (action === 'unchanged') {
    console.log(`↩︎  ${targetRel.replace(/\\/g, '/')} already carries this pattern; nothing changed.`);
    console.log(`   connects: ${connection}`);
    return 0;
  }

  if (LOCK_HOLD_MS > 0) {
    const waitBuf = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(waitBuf, 0, 0, LOCK_HOLD_MS);
  }

  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  atomicWriteFileSync(targetAbs, content);
  console.log(
    `${action === 'created' ? '✍️  Created' : '🔀 Merged'} ${targetRel.replace(/\\/g, '/')}` +
      `${action === 'merged' ? ' (hand-written content preserved; new material is marked for review)' : ''}.`
  );
  console.log(`   connects: ${connection}`);
  return 0;
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.kind === 'help') {
    console.log(usage());
    return;
  }
  if (parsed.kind === 'error') {
    console.error(`heyloey: ${parsed.message}`);
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  const { command, args, options } = parsed;
  const failure = validateTarget(options.root);
  if (failure) {
    console.error(refusalLine(failure, options.root, options.showPaths));
    console.error('   Nothing was written. Point --root at a vault, or run this from one.');
    process.exitCode = 1;
    return;
  }

  if (command === 'lock-state') {
    process.exitCode = runLockState(options.root, options);
    return;
  }

  if (WRITING_COMMANDS.has(command) && !options.dryRun) {
    const problems = obsoleteLockConfig();
    if (problems.length > 0) {
      console.error('[heyloey] LOCK unavailable: ' + problems.join('; ') + '; nothing written.');
      process.exitCode = 8;
      return;
    }
    if (process.platform === 'win32') {
      console.error(
        '[heyloey] LOCK unavailable: flock is not available on native Windows; run within WSL; nothing written.'
      );
      process.exitCode = 8;
      return;
    }
    const legacy = legacyLockPath(options.root);
    if (fs.existsSync(legacy)) {
      console.error(
        `[heyloey] LOCK legacy state: a metadata-file lock from the removed file tier exists at ${legacy}; nothing written.`
      );
      process.exitCode = 9;
      return;
    }
    const flockBin = flockBinPath();
    if (!flockBin) {
      console.error('[heyloey] LOCK unavailable: flock binary not found; nothing written.');
      process.exitCode = 8;
      return;
    }

    if (process.env.LOEY_LOCK_HELD !== '1') {
      runUnderKernelLock(options.root);
      return;
    }
  }

  if (!WRITING_COMMANDS.has(command) && options.dryRun) {
    // A read-only command has nothing to dry-run. Say so rather than implying it wrote.
    console.log('(read-only command: --dry-run has no effect)');
  }

  let code = 0;
  switch (command) {
    case 'brief':
      code = runBrief(options.root, options);
      break;
    case 'context':
      code = runContext(options.root, args, options);
      break;
    case 'done':
      code = runDone(options.root, args, options);
      break;
    case 'personal':
      code = runDone(options.root, args, { ...options, personal: true });
      break;
    case 'migrate-log':
      code = runMigrateLog(options.root, args, options);
      break;
    case 'learn':
      code = runLearn(options.root, args, options);
      break;
  }
  process.exitCode = code;
}

if (typeof require !== 'undefined' && require.main === module) {
  main();
}

export {
  buildSnippetNote,
  mergeLearnNote,
  insertDailyLogLine,
  insertLatestUpdate,
  parseArgs,
  validateTarget,
  resolveInsideVault,
  detectLanguage,
  LEARN_START,
  LEARN_END,
  DEV_HUB_LINK,
  kernelLockPath,
  legacyLockPath,
  lockDirPath,
};
