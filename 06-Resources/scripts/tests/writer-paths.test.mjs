/*
 * The separation is only real if EVERY writer lands in the same format. The repository bundle has
 * its own suite; this one covers the standalone canonical CLI that the MCP server and (after the
 * coordinated deployment) the installed `heyloey` command execute.
 *
 * The canonical source is pinned under tests/fixtures, so these tests execute on a clean checkout
 * with no private home-directory dependency. A deployment rehearsal separately applies the shipped
 * patch to the live canonical source and compares the result with the pinned fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AGENT_AREA, AGENT_TOGGLE, DAILY_HEADING, FIXTURE, GITHUB_AREA, INSTALLED, PERSONAL_AREA,
  SENTINEL, TABLE_HEADER, agentToggles, areaOf, canonicalCli, claimedCount, makeVault, rowsOf,
  runCli, sha256, writeDaily,
} from './helpers/canonical-fixture.mjs';

const PINNED_SHA256 = '8f77c4da28b2a5e883dd98867d07f938d38e1a49a71195d782538c090aeb4c00';

function fixtureVault(t, personal = []) {
  const root = makeVault(t);
  const file = writeDaily(root, [
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '',
    PERSONAL_AREA,
    ...personal,
    '',
    AGENT_AREA,
    '',
    GITHUB_AREA,
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    SENTINEL,
  ].join('\n'));
  return { root, file };
}

test('the pinned canonical test input is reproducibly present', () => {
  assert.ok(fs.existsSync(FIXTURE), 'the canonical fixture must ship with the repository');
  assert.equal(sha256(FIXTURE), PINNED_SHA256, 'update the fixture and this pin together');
  assert.match(fs.readFileSync(FIXTURE, 'utf8'), /AGENT_TABLE_HEADER/);
  assert.match(fs.readFileSync(FIXTURE, 'utf8'), /case 'personal'/);
});

test('the canonical writer (MCP and post-deployment installed logger) writes the agent table', (t) => {
  const cli = canonicalCli(t);
  const root = makeVault(t);
  const summary = 'fix the table writer';
  const file = writeDaily(root, [
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '',
    PERSONAL_AREA,
    '- **10:44 AM**: fix the table writer',
    '',
    AGENT_AREA,
    '',
    TABLE_HEADER,
    '| :--- | :--- | :--- |',
    '| 09:00&nbsp;AM | `loey_space` | existing row |',
    '',
    GITHUB_AREA,
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    SENTINEL,
  ].join('\n'));

  const first = runCli(root, cli, ['done', summary]);
  assert.equal(first.status, 0, `expected exit 0: ${first.stderr}`);
  assert.match(first.stdout, /daily=written/);
  assert.match(first.stdout, /verified=daily\+handoff/);

  const daily = fs.readFileSync(file, 'utf8');
  const personal = areaOf(daily, PERSONAL_AREA);
  const agent = areaOf(daily, AGENT_AREA);
  assert.equal((personal.match(new RegExp(summary, 'g')) ?? []).length, 1, 'the owner entry is untouched');
  assert.match(agent, new RegExp(`\\| \\d{2}:\\d{2}&nbsp;[AP]M \\|  \\| ${summary} \\|`), 'blank scope when none was supplied');
  assert.match(agent, /\| 09:00&nbsp;AM \| `loey_space` \| existing row \|/, 'an existing row is preserved');
  assert.equal(rowsOf(daily).length, 2, 'exactly one new row, not a duplicate');
  assert.equal((daily.match(new RegExp(TABLE_HEADER.replaceAll('|', '\\|'), 'g')) ?? []).length, 1, 'one table');
  assert.ok(daily.includes(SENTINEL));

  const before = fs.readFileSync(file, 'utf8');
  const retry = runCli(root, cli, ['done', summary]);
  assert.equal(retry.status, 0, `expected exit 0: ${retry.stderr}`);
  assert.match(retry.stdout, /daily=already-recorded/);
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'a repeat write must not duplicate the row');
});

test('the canonical writer adopts its legacy agent callout instead of leaving it behind', (t) => {
  const cli = canonicalCli(t);
  const root = makeVault(t);
  const summary = 'close the residual gap';
  const file = writeDaily(root, [
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '',
    PERSONAL_AREA,
    '- **10:00 AM**: Morning walk',
    '',
    '> [!NOTE]- 🤖 Agent Milestone Log (1 milestone — click to expand)',
    '> | Time | Scope | Milestone |',
    '> | :--- | :--- | :--- |',
    '> | 09:15&nbsp;AM | `loey_space` | reconciled from GitHub |',
    '',
    AGENT_AREA,
    '',
    GITHUB_AREA,
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    SENTINEL,
  ].join('\n'));

  const result = runCli(root, cli, ['done', summary]);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);

  const daily = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(daily, /Agent Milestone Log/, 'the redundant callout label must not survive a write');
  assert.doesNotMatch(areaOf(daily, PERSONAL_AREA), /GitHub|reconciled/, 'the callout leaves Personal Log');
  const agent = areaOf(daily, AGENT_AREA);
  assert.match(agent, /\| 09:15&nbsp;AM \| `loey_space` \| reconciled from GitHub \|/);
  assert.match(agent, new RegExp(`\\| \\d{2}:\\d{2}&nbsp;[AP]M \\|  \\| ${summary} \\|`));
  assert.ok(areaOf(daily, PERSONAL_AREA).includes('Morning walk'));
  assert.ok(daily.includes(SENTINEL));
});

test('a legacy callout merges into an existing agent table without creating a second table', (t) => {
  const cli = canonicalCli(t);
  const root = makeVault(t);
  const summary = 'merge the mixed representations';
  const file = writeDaily(root, [
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '',
    PERSONAL_AREA,
    '- **10:00 AM**: Morning walk',
    '',
    '> [!NOTE]- 🤖 Agent Milestone Log (1 milestone — click to expand)',
    '> | Time | Scope | Milestone |',
    '> | :--- | :--- | :--- |',
    '> | 09:15&nbsp;AM | `loey_space` | reconciled from GitHub |',
    '',
    AGENT_AREA,
    '',
    TABLE_HEADER,
    '| :--- | :--- | :--- |',
    '| 08:30&nbsp;AM | `loey_space` | existing table row |',
    '',
    GITHUB_AREA,
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    SENTINEL,
  ].join('\n'));

  const result = runCli(root, cli, ['done', summary]);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);

  const daily = fs.readFileSync(file, 'utf8');
  assert.equal((daily.match(new RegExp(TABLE_HEADER.replaceAll('|', '\\|'), 'g')) ?? []).length, 1, 'exactly one table header');
  assert.doesNotMatch(daily, /Agent Milestone Log/);
  const agent = areaOf(daily, AGENT_AREA);
  const times = rowsOf(daily).map((line) => line.split('|')[1].trim());
  assert.equal(times.length, 3, 'both existing rows and the new row survive');
  assert.deepEqual(times, ['01:00&nbsp;AM', '08:30&nbsp;AM', '09:15&nbsp;AM'], 'existing rows stay, chronologically');
  assert.match(agent, /existing table row/);
  assert.match(agent, /reconciled from GitHub/);
  assert.match(agent, new RegExp(`\\| \\d{2}:\\d{2}&nbsp;[AP]M \\|  \\| ${summary} \\|`));
  assert.ok(daily.includes(SENTINEL));

  const before = fs.readFileSync(file, 'utf8');
  const retry = runCli(root, cli, ['done', summary]);
  assert.equal(retry.status, 0);
  assert.match(retry.stdout, /daily=already-recorded/);
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'the merged table stays idempotent');
});

test('a second write updates the one collapsed container instead of creating another', (t) => {
  const cli = canonicalCli(t);
  const { root, file } = fixtureVault(t);

  for (const summary of ['first milestone of the morning', 'second milestone of the morning']) {
    const result = runCli(root, cli, ['done', summary]);
    assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
    assert.match(result.stdout, /daily=written/);

    const daily = fs.readFileSync(file, 'utf8');
    const agent = areaOf(daily, AGENT_AREA);
    assert.equal(agentToggles(daily).length, 1, 'exactly one agent container, never a second one');
    assert.match(agent, AGENT_TOGGLE, 'the container is a `Show entries (N)` toggle');
    assert.doesNotMatch(daily, /Agent Milestone Log/, 'no competing title survives');
    assert.ok(agent.includes(`> ${TABLE_HEADER}`), 'the header sits inside the container');
    assert.equal((agent.match(/> \| :--- \| :--- \| :--- \|/g) ?? []).length, 1, 'one separator row');
  }

  const daily = fs.readFileSync(file, 'utf8');
  assert.equal(rowsOf(daily).length, 2, 'both milestones are rows of the same container');
  assert.equal(claimedCount(daily), 2, 'the toggle count tracks the rows it holds');
});

test('a retry of the same summary changes nothing in the container', (t) => {
  const cli = canonicalCli(t);
  const { root, file } = fixtureVault(t);

  assert.equal(runCli(root, cli, ['done', 'retried milestone']).status, 0);
  const afterFirst = fs.readFileSync(file, 'utf8');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retry = runCli(root, cli, ['done', 'retried milestone']);
    assert.equal(retry.status, 0, `expected exit 0: ${retry.stderr}`);
    assert.match(retry.stdout, /daily=already-recorded/);
    assert.equal(fs.readFileSync(file, 'utf8'), afterFirst, 'a retry is byte-for-byte a no-op');
  }
  assert.equal(agentToggles(afterFirst).length, 1, 'the retry did not open a second container');
  assert.equal(claimedCount(afterFirst), 1);
});

test('the personal entry point writes a Personal Log bullet and never touches handoff', (t) => {
  const cli = canonicalCli(t);
  const { root, file } = fixtureVault(t);
  const handoff = fs.readFileSync(`${root}/handoff.md`, 'utf8');
  const entry = 'Went for a walk by the harbour';

  const first = runCli(root, cli, ['personal', entry]);
  assert.equal(first.status, 0, `expected exit 0: ${first.stderr}`);
  assert.match(first.stdout, /RESULT personal logged daily=written handoff=not-attempted/);
  assert.match(areaOf(fs.readFileSync(file, 'utf8'), PERSONAL_AREA), /^- \*\*\d{2}:\d{2} [AP]M\*\*: Went for a walk by the harbour$/m);
  assert.doesNotMatch(areaOf(fs.readFileSync(file, 'utf8'), AGENT_AREA), /Went for a walk/, 'personal text is not an agent entry');
  assert.equal(fs.readFileSync(`${root}/handoff.md`, 'utf8'), handoff, 'handoff must be byte-identical');

  const before = fs.readFileSync(file, 'utf8');
  const retry = runCli(root, cli, ['personal', entry]);
  assert.equal(retry.status, 0, `expected exit 0: ${retry.stderr}`);
  assert.match(retry.stdout, /already-recorded/);
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'a repeat personal entry must not duplicate');
});

test('personal flags that are not supported refuse instead of becoming agent milestones', (t) => {
  const cli = canonicalCli(t);
  const { root, file } = fixtureVault(t);
  const daily = fs.readFileSync(file, 'utf8');
  const handoff = fs.readFileSync(`${root}/handoff.md`, 'utf8');

  for (const args of [['personal', '--handoff', 'walk'], ['done', '--personal', 'walk']]) {
    const result = runCli(root, cli, args);
    assert.notEqual(result.status, 0, `${args.join(' ')} must refuse`);
    assert.equal(fs.readFileSync(file, 'utf8'), daily, 'no daily write');
    assert.equal(fs.readFileSync(`${root}/handoff.md`, 'utf8'), handoff, 'no handoff write');
  }
});

const installedPath = process.env.HEYLOEY_INSTALLED;

test('the installed writer passes the same behavior after the coordinated deployment', {
  skip: !installedPath
    ? 'set HEYLOEY_INSTALLED to the installed command after the coordinated deployment'
    : !fs.existsSync(installedPath)
      ? `${installedPath} is absent`
      : process.env.HEYLOEY_EXPECT_INSTALLED_UPDATED !== '1'
        ? 'set HEYLOEY_EXPECT_INSTALLED_UPDATED=1 after the coordinated deployment'
        : false,
}, (t) => {
  const { root, file } = fixtureVault(t, ['- **08:00 AM**: private entry']);
  const handoff = fs.readFileSync(`${root}/handoff.md`, 'utf8');

  const milestone = runCli(root, INSTALLED, ['done', 'installed writer milestone']);
  assert.equal(milestone.status, 0, `installed done failed: ${milestone.stderr}`);
  assert.match(areaOf(fs.readFileSync(file, 'utf8'), AGENT_AREA), /\| \d{2}:\d{2}&nbsp;[AP]M \|  \| installed writer milestone \|/);

  const personal = runCli(root, INSTALLED, ['personal', 'installed writer personal']);
  assert.equal(personal.status, 0, `installed personal failed: ${personal.stderr}`);
  assert.match(areaOf(fs.readFileSync(file, 'utf8'), PERSONAL_AREA), /^- \*\*\d{2}:\d{2} [AP]M\*\*: installed writer personal$/m);
  assert.equal(fs.readFileSync(`${root}/handoff.md`, 'utf8').includes('installed writer personal'), false);
  assert.ok(fs.readFileSync(`${root}/handoff.md`, 'utf8').includes('installed writer milestone'));
  assert.ok(fs.readFileSync(`${root}/handoff.md`, 'utf8') !== handoff);

  const rejected = runCli(root, INSTALLED, ['done', '--personal', 'silent agent write']);
  assert.notEqual(rejected.status, 0, 'the installed writer must reject done --personal');
  assert.equal(fs.readFileSync(file, 'utf8').includes('silent agent write'), false);
});
