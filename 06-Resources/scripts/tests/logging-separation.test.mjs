/*
 * The daily log is ONE parent section with three labelled areas, and every logging path must route
 * into the area it owns: the owner's own words into `### 🧍 Personal Log`, automated outcomes into
 * the one table under `### 🤖 Agent Milestones`, and the synced GitHub table into
 * `### 🐙 GitHub Activity`.
 *
 * These tests drive the real interfaces — the bundled CLI against a temporary vault, and the GitHub
 * merge against a note — because routing that only holds in a unit fixture is exactly the separation
 * that drifts the first time somebody writes a real note. Nothing here touches the repository, its
 * private records or the owner's daily notes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeDailyLogTable } from '../src/lib/github-events.ts';
import {
  DISCOVERY_NOW, aucklandDate, clockEnv, freezeClock,
} from './helpers/auckland-clock.mjs';

// The test process and every writer child must share one frozen Auckland discovery instant.
freezeClock(DISCOVERY_NOW);

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const BUNDLE = path.join(REPO_ROOT, '06-Resources/scripts/heyloey.js');
const TEMPLATE = path.join(REPO_ROOT, '99-Templates/Daily.md');

const DAILY_HEADING = '## 📝 Daily Log';
const PERSONAL_AREA = '### 🧍 Personal Log';
const AGENT_AREA = '### 🤖 Agent Milestones';
const GITHUB_AREA = '### 🐙 GitHub Activity';
const AGENT_TABLE_HEADER = '| Time | Scope | Milestone |\n| :--- | :--- | :--- |';

const DAILY_SENTINEL = 'SENTINEL: the rest of the day must survive';
const HANDOFF_SENTINEL = 'SENTINEL: an objective the owner wrote';

/**
 * The production writer resolves "today" in Pacific/Auckland. The fixture note must use that same
 * calendar, not the host's local date; `now` is the frozen discovery instant shared with the child.
 */
function todayStr(now = DISCOVERY_NOW) {
  return aucklandDate(now);
}

function dailyRel(date = todayStr()) {
  return path.join('01-Daily', date.slice(0, 7), `${date}.md`);
}

function run(args, cwd, options = {}) {
  return spawnSync(process.execPath, [BUNDLE, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...clockEnv(options.now || DISCOVERY_NOW), ...options.env },
  });
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/**
 * The text of one area: from its heading to the next `###`/`##` heading or the divider. This is the
 * reader the separation depends on, written here independently of the code under test.
 */
function areaOf(content, heading) {
  const lines = content.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  assert.notEqual(start, -1, `the note must carry ${heading}:\n${content}`);
  let end = start + 1;
  while (end < lines.length && !/^#{1,3}\s/.test(lines[end]) && lines[end].trim() !== '---') end++;
  return lines.slice(start + 1, end).join('\n');
}

function rowsOf(content, heading) {
  return areaOf(content, heading)
    .split('\n')
    .filter((line) => /^(?:>\s*)?\|\s*\d{1,2}:\d{2}/.test(line.trim()));
}

/** Every `> [!NOTE]- 🤖 …` toggle in an area: an area may hold at most one. */
function agentToggles(content, heading) {
  return areaOf(content, heading)
    .split('\n')
    .filter((line) => /^>\s*\[!NOTE\]-\s*🤖/.test(line.trim()));
}

function makeVault(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-log-separation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '99-Templates'));
  fs.mkdirSync(path.join(root, '.obsidian'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# fixture vault\n');
  fs.writeFileSync(
    path.join(root, '.obsidian/daily-notes.json'),
    JSON.stringify({ folder: '01-Daily', format: 'YYYY-MM/YYYY-MM-DD', template: '99-Templates/Daily' })
  );
  fs.writeFileSync(
    path.join(root, 'handoff.md'),
    [
      '# Session Handoff',
      '',
      '## 🎯 Current Main Objectives',
      '',
      `- ${HANDOFF_SENTINEL}`,
      '',
      '## Session Log',
      '',
      '### Latest Updates',
      '',
      '- [x] **[2026-01-01 09:00]** <what changed, and what it means for the next move>',
      '',
    ].join('\n')
  );
  return root;
}

/** `now` is the frozen discovery instant; PR merge timestamps never pick the daily-note date. */
function writeDaily(root, body, now = DISCOVERY_NOW) {
  const date = aucklandDate(now);
  const dailyPath = path.join(root, dailyRel(date));
  fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
  fs.writeFileSync(
    dailyPath,
    [
      '---',
      `created: ${date}`,
      `updated: ${date}`,
      'type: daily',
      '---',
      '# Fixture day',
      '',
      body,
      '',
    ].join('\n')
  );
}

/** A vault whose daily note carries the labelled areas, shaped like the template. */
function makeAreaVault(t, now = DISCOVERY_NOW) {
  const root = makeVault(t);
  writeDaily(root, [
    '### 🎯 Today\'s Focus',
    '- Ship the parser fix',
    '',
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '',
    PERSONAL_AREA,
    '- ',
    '',
    AGENT_AREA,
    '',
    '> [!NOTE]- 🤖 Show entries (0)',
    '> | Time | Scope | Milestone |',
    '> | :--- | :--- | :--- |',
    '',
    GITHUB_AREA,
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    '',
    DAILY_SENTINEL,
  ].join('\n'), now);
  return root;
}

/** A vault whose daily note is still an unseparated legacy log. */
function makeLegacyVault(t) {
  const root = makeVault(t);
  writeDaily(root, [
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '- **10:00 AM**: remediate the parser defect',
    '  continued detail',
    '- **11:30 AM**: Completed a review of the MCP server',
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    '',
    DAILY_SENTINEL,
  ].join('\n'));
  return root;
}

/** A vault whose note already carries the areas, but a tool left its callout in Personal Log. */
function makeStrandedVault(t) {
  const root = makeVault(t);
  writeDaily(root, [
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '',
    PERSONAL_AREA,
    '- **10:00 AM**: Morning walk and breakfast',
    '',
    '> [!NOTE]- 🤖 Agent Milestone Log (1 milestone — click to expand)',
    '> | Time | Scope | Milestone |',
    '> | :--- | :--- | :--- |',
    '> | 09:15&nbsp;AM | `loey_space` | reconciled from GitHub |',
    '',
    AGENT_AREA,
    '- **09:30 AM**: resolve the parser defect',
    '',
    GITHUB_AREA,
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    '',
    DAILY_SENTINEL,
  ].join('\n'));
  return root;
}

test('the daily template declares the parent section and its three labelled areas', () => {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const parent = template.indexOf(DAILY_HEADING);
  const personal = template.indexOf(PERSONAL_AREA);
  const agent = template.indexOf(AGENT_AREA);
  const github = template.indexOf(GITHUB_AREA);

  assert.notEqual(parent, -1, 'the template must keep the parent Daily Log heading');
  assert.ok(parent < personal, 'Personal Log is the first area under the parent');
  assert.ok(personal < agent, 'Agent Milestones follows Personal Log');
  assert.ok(agent < github, 'GitHub Activity is the last area');
  assert.ok(template.includes(`> ${AGENT_TABLE_HEADER.split('\n').join('\n> ')}`),
    'the agent area declares the one table, quoted inside its collapsed container');
  assert.match(template, /^> \[!NOTE\]- 🤖 Show entries \(0\)$/m,
    'the agent container is collapsed by default with a short toggle');
  assert.doesNotMatch(template, /Agent Milestone Log/, 'there is no second label or parallel list');

  // The areas are `###`, so the parent must not end at one of them: it ends at the divider after
  // the GitHub area, which is what keeps every area inside the log.
  const divider = template.indexOf('\n---\n', parent);
  assert.ok(github < divider, 'every area must sit inside the parent section, above the divider');
});

test('done routes an automated outcome into the agent table and still records the handoff', (t) => {
  const root = makeAreaVault(t);
  const summary = 'fix the parser regression';

  const result = run(['done', summary], root);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /^RESULT done logged daily=written handoff=written lock=flock/m);
  assert.match(result.stdout, /verified=daily\+handoff/);

  const daily = read(root, dailyRel());
  assert.match(areaOf(daily, AGENT_AREA), new RegExp(`> \\| \\d{2}:\\d{2}&nbsp;[AP]M \\|  \\| ${summary} \\|`));
  assert.equal(rowsOf(daily, AGENT_AREA).length, 1, 'one row, not a row plus a bullet');
  assert.equal(agentToggles(daily, AGENT_AREA).length, 1, 'the outcome lands in the one collapsed container');
  assert.match(areaOf(daily, AGENT_AREA), /^> \[!NOTE\]- 🤖 Show entries \(1\)$/m);
  assert.doesNotMatch(areaOf(daily, PERSONAL_AREA), new RegExp(summary), 'an automated outcome is not a personal entry');
  assert.ok(daily.includes(DAILY_SENTINEL), 'the rest of the daily note must survive');

  const handoff = read(root, 'handoff.md');
  assert.match(handoff, new RegExp(`- \\[x\\] \\*\\*\\[\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}\\]\\*\\* ${summary}`));
  assert.ok(handoff.includes(HANDOFF_SENTINEL));
});

test('a UTC host writes the Auckland discovery date, not its own previous calendar day', (t) => {
  // Required boundary: 12:00Z is 18 October in Auckland but still 17 October in UTC. The fixture
  // note and the writer subprocess both use DISCOVERY_NOW, so no host-local date can pick the path.
  assert.equal(aucklandDate(DISCOVERY_NOW), '2026-10-18');
  assert.equal(aucklandDate('2026-10-17T10:59:59.000Z'), '2026-10-17');

  const root = makeAreaVault(t);
  const summary = 'cross the date boundary without a host-local shortcut';
  const result = run(['done', summary], root, { now: DISCOVERY_NOW, env: { TZ: 'UTC' } });
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /daily=written/);

  const aucklandNote = path.join(root, dailyRel('2026-10-18'));
  assert.ok(fs.existsSync(aucklandNote), 'the writer must create the 18 October Auckland note');
  assert.equal(
    fs.existsSync(path.join(root, dailyRel('2026-10-17'))),
    false,
    'the UTC host must not create a 17 October note'
  );
  const row = areaOf(read(root, dailyRel('2026-10-18')), AGENT_AREA);
  assert.match(row, /\| 01:00&nbsp;AM \|  \| cross the date boundary without a host-local shortcut \|/,
    'the child must see the same frozen instant that produced the Auckland date');
});


test('personal routes an owner entry into Personal Log and never touches the handoff', (t) => {
  const root = makeAreaVault(t);
  const entry = 'Bought new running shoes';
  const handoffBefore = sha256(path.join(root, 'handoff.md'));

  const result = run(['personal', entry], root);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /^RESULT done logged daily=written handoff=not-applicable lock=flock/m);
  assert.match(result.stdout, /verified=daily\b/);

  const daily = read(root, dailyRel());
  assert.match(areaOf(daily, PERSONAL_AREA), new RegExp(`- \\*\\*\\d{2}:\\d{2} [AP]M\\*\\*: ${entry}`));
  assert.doesNotMatch(areaOf(daily, AGENT_AREA), new RegExp(entry), 'a personal entry is not an agent milestone');
  assert.equal(sha256(path.join(root, 'handoff.md')), handoffBefore, 'a personal entry must not enter the handoff');
});

test('a repeated milestone is reported as already recorded and changes nothing', (t) => {
  const root = makeAreaVault(t);
  const summary = 'close the residual gap';

  const first = run(['done', summary], root);
  assert.equal(first.status, 0, `expected exit 0: ${first.stderr}`);
  const dailyAfterFirst = read(root, dailyRel());
  const handoffAfterFirst = read(root, 'handoff.md');

  const retry = run(['done', summary], root);
  assert.equal(retry.status, 0, `expected exit 0: ${retry.stderr}`);
  assert.match(retry.stdout, /^RESULT done already-recorded/m);
  assert.equal(read(root, dailyRel()), dailyAfterFirst, 'a retry must not duplicate the daily entry');
  assert.equal(read(root, 'handoff.md'), handoffAfterFirst, 'a retry must not duplicate the handoff entry');
});

test('identical text in Personal Log does not suppress the agent milestone', (t) => {
  const root = makeAreaVault(t);
  const text = 'fix the parser regression';

  const owner = run(['personal', text], root);
  assert.equal(owner.status, 0, `expected exit 0: ${owner.stderr}`);

  const agent = run(['done', text], root);
  assert.equal(agent.status, 0, `expected exit 0: ${agent.stderr}`);
  assert.match(agent.stdout, /^RESULT done logged daily=written handoff=written/m);
  assert.match(agent.stdout, /verified=daily\+handoff/);

  const daily = read(root, dailyRel());
  assert.equal(rowsOf(daily, AGENT_AREA).length, 1, 'the agent row is written');
  assert.equal((areaOf(daily, PERSONAL_AREA).match(new RegExp(text, 'g')) ?? []).length, 1, 'the personal entry survives');
  assert.match(areaOf(daily, AGENT_AREA), new RegExp(text));
  assert.match(read(root, 'handoff.md'), new RegExp(text));
});

test('identical text in Agent Milestones does not suppress the personal entry', (t) => {
  const root = makeAreaVault(t);
  const text = 'close the residual gap';

  const agent = run(['done', text], root);
  assert.equal(agent.status, 0, `expected exit 0: ${agent.stderr}`);
  const handoffBefore = sha256(path.join(root, 'handoff.md'));

  const owner = run(['personal', text], root);
  assert.equal(owner.status, 0, `expected exit 0: ${owner.stderr}`);
  assert.match(owner.stdout, /^RESULT done logged daily=written handoff=not-applicable/m);

  const daily = read(root, dailyRel());
  assert.equal(rowsOf(daily, AGENT_AREA).length, 1, 'the agent row is not duplicated');
  assert.equal((areaOf(daily, PERSONAL_AREA).match(new RegExp(text, 'g')) ?? []).length, 1, 'the personal entry is written');
  assert.equal(sha256(path.join(root, 'handoff.md')), handoffBefore, 'the personal entry leaves the handoff alone');
});

test('migrate-log never classifies a personal entry by its wording', (t) => {
  const root = makeAreaVault(t);
  const text = 'fixed my bicycle';
  assert.equal(run(['personal', text], root).status, 0);

  const untouched = run(['migrate-log'], root);
  assert.equal(untouched.status, 0, `expected exit 0: ${untouched.stderr}`);
  assert.match(untouched.stdout, /migrated=0 kept=1 adopted=0/);
  assert.match(areaOf(read(root, dailyRel()), PERSONAL_AREA), new RegExp(`- \\*\\*\\d{2}:\\d{2} [AP]M\\*\\*: ${text}`));

  const moved = run(['migrate-log', '--select-summary', text], root);
  assert.equal(moved.status, 0, `expected exit 0: ${moved.stderr}`);
  assert.match(moved.stdout, /migrated=1 kept=0 adopted=0/);

  const daily = read(root, dailyRel());
  assert.match(areaOf(daily, AGENT_AREA), new RegExp(`\\| \\d{2}:\\d{2}&nbsp;[AP]M \\|  \\| ${text} \\|`));
  assert.doesNotMatch(areaOf(daily, PERSONAL_AREA), new RegExp(text), 'the moved entry leaves Personal Log');
});

test('migrate-log on a legacy note is explicit about selection and preserves everything it cannot prove', (t) => {
  const root = makeLegacyVault(t);
  const dailyBefore = read(root, dailyRel());
  const moved = 'remediate the parser defect';
  const kept = 'Completed a review of the MCP server';

  const dry = run(['migrate-log', '--dry-run'], root);
  assert.equal(dry.status, 0, `expected exit 0: ${dry.stderr}`);
  assert.match(dry.stdout, /Dry run — nothing was written/);
  assert.match(dry.stdout, new RegExp(`left in place: ${moved}`));
  assert.match(dry.stdout, new RegExp(`left in place: ${kept}`));
  assert.equal(read(root, dailyRel()), dailyBefore, 'a dry run must write nothing');

  const separated = run(['migrate-log'], root);
  assert.equal(separated.status, 0, `expected exit 0: ${separated.stderr}`);
  assert.match(separated.stdout, /^RESULT migrate-log logged migrated=0 kept=2 adopted=0/m);

  const daily = read(root, dailyRel());
  assert.ok(areaOf(daily, PERSONAL_AREA).includes(moved), 'without a selection it stays personal');
  assert.ok(areaOf(daily, PERSONAL_AREA).includes(kept));
  assert.match(daily, /- \*\*10:00 AM\*\*: remediate the parser defect/, 'its timestamp and text are preserved');
  assert.ok(daily.includes(DAILY_SENTINEL));

  const selected = run(['migrate-log', '--select', '10:00 AM'], root);
  assert.equal(selected.status, 0, `expected exit 0: ${selected.stderr}`);
  assert.match(selected.stdout, /^RESULT migrate-log logged migrated=1 kept=1 adopted=0/m);

  const migrated = read(root, dailyRel());
  assert.match(areaOf(migrated, AGENT_AREA), /\| 10:00&nbsp;AM \|  \| remediate the parser defect<br>continued detail \|/);
  assert.ok(areaOf(migrated, PERSONAL_AREA).includes(kept));
  assert.doesNotMatch(areaOf(migrated, AGENT_AREA), /Agent Milestone Log/, 'the redundant label is gone');

  const again = run(['migrate-log'], root);
  assert.equal(again.status, 0, `expected exit 0: ${again.stderr}`);
  assert.match(again.stdout, /migrated=0 kept=1 adopted=0/);
  assert.equal(read(root, dailyRel()), migrated, 'a second migration must not rewrite the note');
});

test('a milestone callout left in Personal Log is adopted into the agent table', (t) => {
  const root = makeStrandedVault(t);

  const migrated = run(['migrate-log'], root);
  assert.equal(migrated.status, 0, `expected exit 0: ${migrated.stderr}`);
  assert.match(migrated.stdout, /^RESULT migrate-log logged migrated=0 kept=1 adopted=1/m);

  const daily = read(root, dailyRel());
  const personal = areaOf(daily, PERSONAL_AREA);
  assert.doesNotMatch(personal, /Agent Milestone Log/, 'the callout must leave the personal area');
  assert.ok(personal.includes('Morning walk and breakfast'), 'the owner entry stays where it was');

  const agent = areaOf(daily, AGENT_AREA);
  assert.doesNotMatch(agent, /Agent Milestone Log/, 'the redundant label is removed during conversion');
  assert.match(agent, /\| 09:15&nbsp;AM \| `loey_space` \| reconciled from GitHub \|/, 'its rows are preserved');
  assert.match(agent, /\| 09:30&nbsp;AM \|  \| resolve the parser defect \|/, 'the existing milestone is converted');
  assert.equal(rowsOf(daily, AGENT_AREA).length, 2, 'the callout rows and the bullet merge into one table');

  const again = run(['migrate-log'], root);
  assert.equal(again.status, 0, `expected exit 0: ${again.stderr}`);
  assert.match(again.stdout, /migrated=0 kept=1 adopted=0/);
  assert.equal(read(root, dailyRel()), daily, 'adoption is idempotent');
});

test('the GitHub merge writes its table into the GitHub Activity area', () => {
  const original = [
    '---',
    'type: daily',
    '---',
    '',
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '- **08:30 AM**: Morning walk and breakfast',
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    '',
  ].join('\n');

  const rows = [
    {
      id: '1',
      time: '06:36&nbsp;PM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push',
      details: '`main`: feat: add distill engine',
      rawDate: new Date(),
    },
  ];

  const { updatedContent, count } = mergeDailyLogTable(original, rows);
  assert.strictEqual(count, 1);
  assert.ok(updatedContent.includes('- **08:30 AM**: Morning walk and breakfast'), 'the existing log survives');
  assert.ok(
    areaOf(updatedContent, GITHUB_AREA).includes('> [!NOTE]- 🐙 GitHub Activity Log'),
    `the callout belongs in the GitHub area:\n${updatedContent}`
  );
  assert.ok(
    updatedContent.indexOf('> [!NOTE]- 🐙 GitHub Activity Log') > updatedContent.indexOf(GITHUB_AREA),
    'the callout must sit below its own heading'
  );
  const dividerAfterLog = updatedContent.indexOf('\n---\n', updatedContent.indexOf(DAILY_HEADING));
  assert.ok(
    updatedContent.indexOf('> [!NOTE]- 🐙 GitHub Activity Log') < dividerAfterLog,
    'the callout must stay inside the daily log'
  );
});

test('a GitHub callout stranded under Personal Log is adopted into its own area', () => {
  const original = [
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '',
    PERSONAL_AREA,
    '- **08:30 AM**: Morning walk and breakfast',
    '',
    '> [!NOTE]- 🐙 GitHub Activity Log (1 event — click to expand)',
    '> | Time | Repo | Action | Details / Branch |',
    '> | :--- | :--- | :--- | :--- |',
    '> | 08:00&nbsp;AM | `old` | 🐙 Push | stale |',
    '',
    GITHUB_AREA,
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
  ].join('\n');

  const rows = [
    {
      id: '1',
      time: '06:36&nbsp;PM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push',
      details: '`main`: feat: add distill engine',
      rawDate: new Date(),
    },
  ];

  const { updatedContent } = mergeDailyLogTable(original, rows);
  assert.doesNotMatch(areaOf(updatedContent, PERSONAL_AREA), /GitHub Activity Log/, 'the callout leaves Personal Log');
  assert.ok(areaOf(updatedContent, PERSONAL_AREA).includes('Morning walk and breakfast'));
  assert.match(areaOf(updatedContent, GITHUB_AREA), /\[!NOTE\]- 🐙 GitHub Activity Log/);
  assert.equal(
    (updatedContent.match(/> \[!NOTE\]- 🐙 GitHub Activity Log/g) ?? []).length,
    1,
    'adoption must not leave a second callout behind'
  );
});
