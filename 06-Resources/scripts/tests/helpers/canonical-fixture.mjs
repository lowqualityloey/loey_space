/*
 * Shared fixture for the standalone canonical writer that the MCP server and the installed
 * `heyloey` command execute. The copy under tests/fixtures is pinned in-repository so a clean
 * checkout can run the writer tests without the owner's private MCP checkout. The deployment
 * plan applies the shipped patch to the live canonical source and compares the result with this
 * fixture before installing it.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DISCOVERY_NOW, aucklandDate, clockEnv, freezeClock,
} from './auckland-clock.mjs';

// Freeze the test process at the same discovery instant that runCli() gives each child writer.
freezeClock(DISCOVERY_NOW);

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
export const TESTS_DIR = path.resolve(TEST_DIR, '..');
export const REPO_ROOT = path.resolve(TESTS_DIR, '..', '..', '..');
export const FIXTURE = path.join(TESTS_DIR, 'fixtures', 'canonical-heyloey.cjs');
export const PATCH = path.join(REPO_ROOT, '06-Resources/scripts/patches/canonical-heyloey-agent-table.patch');
export const INSTALLED = process.env.HEYLOEY_INSTALLED || 'heyloey';

export const DAILY_HEADING = '## 📝 Daily Log';
export const PERSONAL_AREA = '### 🧍 Personal Log';
export const AGENT_AREA = '### 🤖 Agent Milestones';
export const GITHUB_AREA = '### 🐙 GitHub Activity';
export const TABLE_HEADER = '| Time | Scope | Milestone |';
/** The one collapsed toggle the agent area holds; there is never a second competing title. */
export const AGENT_TOGGLE = /^> \[!NOTE\]- 🤖 Show entries \(\d+\)$/m;
export const SENTINEL = 'SENTINEL: the day around the log must survive';

export function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * The writer chooses the note by its Auckland date. The fixture must use the same rule, including
 * on a host whose own timezone is still on the previous calendar day. `now` is the frozen discovery
 * instant; a PR merge timestamp is a different input and never picks this path.
 */
export function todayStr(now = DISCOVERY_NOW) {
  return aucklandDate(now);
}

export function dailyRel(date = todayStr()) {
  return path.join('01-Daily', date.slice(0, 7), `${date}.md`);
}

/** A disposable patched-canonical CLI. The fixture is the reproducible test input. */
export function canonicalCli(t) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-canonical-writer-'));
  t.after(() => fs.rmSync(work, { recursive: true, force: true }));
  const cli = path.join(work, 'heyloey.cjs');
  fs.copyFileSync(FIXTURE, cli);
  return cli;
}

export function makeVault(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-canonical-vault-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '99-Templates'), { recursive: true });
  fs.mkdirSync(path.join(root, '.obsidian'), { recursive: true });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# fixture vault\n');
  fs.writeFileSync(path.join(root, 'handoff.md'), '# Session Handoff\n\n### Latest Updates\n\n');
  return root;
}

export function writeDaily(root, body, now = DISCOVERY_NOW) {
  const date = aucklandDate(now);
  const file = path.join(root, dailyRel(date));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, ['---', 'type: daily', '---', `# ${date}`, '', body, ''].join('\n'));
  return file;
}

export function areaOf(content, heading) {
  const lines = content.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) throw new Error(`missing ${heading}`);
  let end = start + 1;
  while (end < lines.length && !/^#{1,3}\s/.test(lines[end]) && lines[end].trim() !== '---') end++;
  return lines.slice(start + 1, end).join('\n');
}

/**
 * Data rows of the one agent table, quoted inside the collapsible container or plain (the previous
 * layout). Header and separator rows are never returned: only a line whose first cell is a time.
 */
export function rowsOf(content) {
  return areaOf(content, AGENT_AREA)
    .split('\n')
    .filter((line) => /^(?:>\s*)?\|\s*\d{1,2}:\d{2}/.test(line.trim()));
}

/** Every `> [!NOTE]- 🤖 …` toggle in the agent area — the area must never hold more than one. */
export function agentToggles(content) {
  return areaOf(content, AGENT_AREA)
    .split('\n')
    .filter((line) => /^>\s*\[!NOTE\]-\s*🤖/.test(line.trim()));
}

/** The row count a `Show entries (N)` toggle claims, or -1 when the area holds no such toggle. */
export function claimedCount(content) {
  const toggles = agentToggles(content);
  if (toggles.length !== 1) return -1;
  const match = toggles[0].trim().match(/Show entries \((\d+)\)/);
  return match ? Number(match[1]) : -1;
}

/**
 * Run from a non-repository directory: no Git scope may be inferred for the fixture. The writer
 * inherits the frozen discovery instant, so its Auckland date and the fixture note cannot diverge.
 */
export function runCli(root, cli, args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: options.cwd || os.tmpdir(),
    encoding: 'utf8',
    env: {
      ...clockEnv(options.now || DISCOVERY_NOW),
      ...options.env,
      LOEY_SPACE_DIR: root,
      LOEY_SPACE_SYNTHETIC: '',
    },
  });
}
