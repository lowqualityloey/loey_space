import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aucklandStamp,
  displayLogTime,
  insertAgentMilestone,
  logAreaHasSummary,
  migrateAgentMilestones,
  normalizeDailyLog,
} from '../src/lib/daily-log-time.ts';
import { insertDailyLogLine } from '../src/heyloey.ts';

test('Auckland calendar is independent of host timezone and crosses UTC midnight correctly', () => {
  assert.deepEqual(aucklandStamp(new Date('2026-10-17T12:05:00Z')), { date: '2026-10-18', time: '01:05' });
  assert.equal(displayLogTime('00:00'), '12:00 AM');
  assert.equal(displayLogTime('12:00'), '12:00 PM');
  assert.equal(displayLogTime('23:59'), '11:59 PM');
  assert.equal(displayLogTime('25:99'), '25:99');
});

test('mixed daily bullets and table rows sort stably, preserving text and surrounding sections', () => {
  const prefix = '---\nmood: calm\n---\n## 📝 Daily Log\n> introduction\n';
  const suffix = '\n---\n## Evening\n- **03:00**: untouched\n';
  const input = prefix + '- **16:04**: late $1 [[Link]]\n  continuation\n- **[11:10 AM]** early\n- **00:00**: midnight\n\n> [!NOTE]- Agent log\n> | Time | Summary |\n> | :--- | :--- |\n> | 12:00&nbsp;PM | noon |\n> | 09:00 AM | first |\n> | 09:00 | second |' + suffix;
  const result = normalizeDailyLog(input);
  assert.equal(result, prefix + '- **12:00 AM**: midnight\n- **[11:10 AM]** early\n- **04:04 PM**: late $1 [[Link]]\n  continuation\n\n> [!NOTE]- Agent log\n> | Time | Summary |\n> | :--- | :--- |\n> | 09:00&nbsp;AM | first |\n> | 09:00&nbsp;AM | second |\n> | 12:00&nbsp;PM | noon |' + suffix);
  assert.equal(normalizeDailyLog(result), result);
  assert.equal(normalizeDailyLog(input.replaceAll('\n', '\r\n')), result.replaceAll('\n', '\r\n'));
  assert.ok(normalizeDailyLog(result.replace('04:04 PM', '01:00 AM')).indexOf('late $1') < normalizeDailyLog(result.replace('04:04 PM', '01:00 AM')).indexOf('early'));
});

test('untimed anchors and fenced examples are preserved', () => {
  const content = '## 📝 Daily Log\n```md\n- **15:00**: example\n```\n- prose\n- **14:00**: real\n## Next\n';
  assert.equal(normalizeDailyLog(content), content.replace('**14:00**', '**02:00 PM**'));
});

test('the agent writer creates the one collapsed table, chronologically ordered and escaped', () => {
  let content = '## 📝 Daily Log\n> intro\n\n---\n## Evening\n';
  content = insertAgentMilestone(content, { stamp: '16:00', summary: 'later | with a pipe' }).content;
  const result = insertAgentMilestone(content, { stamp: '09:05', summary: 'earlier' });

  assert.equal(result.ok, true);
  assert.ok(!result.duplicate);
  assert.equal(
    result.content,
    [
      '## 📝 Daily Log',
      '> intro',
      '',
      '### 🤖 Agent Milestones',
      '',
      '> [!NOTE]- 🤖 Show entries (2)',
      '> | Time | Scope | Milestone |',
      '> | :--- | :--- | :--- |',
      '> | 09:05&nbsp;AM |  | earlier |',
      '> | 04:00&nbsp;PM |  | later \\| with a pipe |',
      '',
      '---',
      '## Evening',
      '',
    ].join('\n')
  );
  assert.equal(result.row, '| 09:05&nbsp;AM |  | earlier |');
});

test('each labelled area is ordered independently and the parent still ends at the divider', () => {
  const input = [
    '## 📝 Daily Log',
    '> introduction',
    '### 🧍 Personal Log',
    '- **09:00 PM**: personal late',
    '- **08:00 AM**: personal early',
    '### 🤖 Agent Milestones',
    '| Time | Scope | Milestone |',
    '| :--- | :--- | :--- |',
    '| 06:00&nbsp;PM |  | agent late |',
    '| 07:00&nbsp;AM |  | agent early |',
    '',
    '---',
    '## Evening',
    '- **11:00 PM**: untouched',
    '',
  ].join('\n');
  const expected = [
    '## 📝 Daily Log',
    '> introduction',
    '### 🧍 Personal Log',
    '- **08:00 AM**: personal early',
    '- **09:00 PM**: personal late',
    '### 🤖 Agent Milestones',
    '| Time | Scope | Milestone |',
    '| :--- | :--- | :--- |',
    '| 07:00&nbsp;AM |  | agent early |',
    '| 06:00&nbsp;PM |  | agent late |',
    '',
    '---',
    '## Evening',
    '- **11:00 PM**: untouched',
    '',
  ].join('\n');
  const result = normalizeDailyLog(input);
  assert.equal(result, expected, 'an `###` area heading must stay inside the parent section');
  assert.equal(normalizeDailyLog(result), result, 'normalising twice must change nothing');
});

test('each area is created on demand with the caller kept in place, in canonical order', () => {
  const legacy = '## 📝 Daily Log\n> intro\n- **10:00**: legacy bullet\n\n---\n## Evening\n';

  const personal = insertDailyLogLine(legacy, '- **09:00 AM**: personal entry', 'personal');
  assert.equal(
    personal.content,
    '## 📝 Daily Log\n> intro\n\n### 🧍 Personal Log\n- **09:00 AM**: personal entry\n- **10:00 AM**: legacy bullet\n\n---\n## Evening\n'
  );

  const agent = insertAgentMilestone(legacy, { stamp: '11:00', summary: 'agent entry' });
  assert.equal(
    agent.content,
    '## 📝 Daily Log\n> intro\n- **10:00 AM**: legacy bullet\n\n### 🤖 Agent Milestones\n\n> [!NOTE]- 🤖 Show entries (1)\n> | Time | Scope | Milestone |\n> | :--- | :--- | :--- |\n> | 11:00&nbsp;AM |  | agent entry |\n\n---\n## Evening\n'
  );

  const github = insertDailyLogLine(agent.content, '- **12:00 PM**: github entry', 'github');
  assert.ok(
    github.content.includes('### 🤖 Agent Milestones\n'),
    `the GitHub area belongs after the agent area:\n${github.content}`
  );
  assert.ok(github.content.indexOf('### 🐙 GitHub Activity') > github.content.indexOf('### 🤖 Agent Milestones'));
});

test('the same agent milestone is written once, so a retry is a byte-for-byte no-op', () => {
  const legacy = '## 📝 Daily Log\n> intro\n\n---\n## Evening\n';
  const once = insertAgentMilestone(legacy, { stamp: '11:00', summary: 'agent entry' });
  const again = insertAgentMilestone(once.content, { stamp: '11:05', summary: 'agent entry' });
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(again.content, once.content);
});

test('duplicate detection is scoped to the area that owns the entry, in both directions', () => {
  const content = [
    '## 📝 Daily Log',
    '',
    '### 🧍 Personal Log',
    '- **09:00 AM**: fixed my bicycle',
    '',
    '### 🤖 Agent Milestones',
    '',
    '| Time | Scope | Milestone |',
    '| :--- | :--- | :--- |',
    '| 10:00&nbsp;AM |  | fixed my bicycle |',
    '',
  ].join('\n');

  assert.equal(logAreaHasSummary(content, 'personal', 'fixed my bicycle'), true);
  assert.equal(logAreaHasSummary(content, 'agent', 'fixed my bicycle'), true);
  assert.equal(logAreaHasSummary(content, 'personal', 'fixed my bicycle today'), false);
});

test('migration moves nothing without an explicit owner selection, whatever the wording', () => {
  const input = [
    '## 📝 Daily Log',
    '> intro',
    '- **10:00 AM**: remediate the parser defect',
    '  continued detail',
    '- **11:00 AM**: Completed a review of the MCP server',
    '',
    '---',
    '## Evening',
    '',
  ].join('\n');

  const result = migrateAgentMilestones(input);
  assert.deepEqual(result.moved, [], 'lowercase outcome verbs are not an authorship signal');
  assert.deepEqual(result.kept, ['remediate the parser defect', 'Completed a review of the MCP server']);
  assert.deepEqual(result.selectionErrors, []);
  assert.equal(
    result.content,
    [
      '## 📝 Daily Log',
      '> intro',
      '',
      '### 🧍 Personal Log',
      '- **10:00 AM**: remediate the parser defect',
      '  continued detail',
      '- **11:00 AM**: Completed a review of the MCP server',
      '',
      '### 🤖 Agent Milestones',
      '',
      '### 🐙 GitHub Activity',
      '',
      '---',
      '## Evening',
      '',
    ].join('\n')
  );

  const again = migrateAgentMilestones(result.content);
  assert.deepEqual(again.moved, [], 'a second migration must move nothing');
  assert.equal(again.content, result.content, 'a second migration must not rewrite the note');
});

test('migration moves only the entries the owner names, preserving text, time and continuation', () => {
  const input = [
    '## 📝 Daily Log',
    '> intro',
    '- **10:44 AM**: Completed MCP hardening review',
    '  with detail',
    '- **11:10 AM**: Completed MCP migration review',
    '- **11:36 AM**: Completed cutover review',
    '',
    '---',
    '## Evening',
    '',
  ].join('\n');

  const result = migrateAgentMilestones(input, { selectStamps: ['10:44 AM', '11:10 AM'] });
  assert.deepEqual(result.moved, ['Completed MCP hardening review', 'Completed MCP migration review']);
  assert.deepEqual(result.kept, ['Completed cutover review']);
  assert.deepEqual(result.selectionErrors, []);
  assert.equal(
    result.content,
    [
      '## 📝 Daily Log',
      '> intro',
      '',
      '### 🧍 Personal Log',
      '- **11:36 AM**: Completed cutover review',
      '',
      '### 🤖 Agent Milestones',
      '',
      '> [!NOTE]- 🤖 Show entries (2)',
      '> | Time | Scope | Milestone |',
      '> | :--- | :--- | :--- |',
      '> | 10:44&nbsp;AM |  | Completed MCP hardening review<br>with detail |',
      '> | 11:10&nbsp;AM |  | Completed MCP migration review |',
      '',
      '### 🐙 GitHub Activity',
      '',
      '---',
      '## Evening',
      '',
    ].join('\n')
  );

  const again = migrateAgentMilestones(result.content, { selectStamps: ['10:44 AM'] });
  assert.deepEqual(again.moved, [], 'an already-moved entry is not selected twice');
  assert.equal(again.content, result.content);
});

test('migration selection by summary is explicit, and an unmatched or ambiguous selection is refused', () => {
  const input = [
    '## 📝 Daily Log',
    '',
    '### 🧍 Personal Log',
    '- **09:00 AM**: planted the tomatoes',
    '- **09:30 AM**: planted the basil',
    '- **10:00 AM**: fixed my bicycle',
    '',
  ].join('\n');

  const bySummary = migrateAgentMilestones(input, { selectSummaries: ['fixed my bicycle'] });
  assert.deepEqual(bySummary.moved, ['fixed my bicycle']);
  assert.match(bySummary.content, /\| 10:00&nbsp;AM \|  \| fixed my bicycle \|/);

  const unmatched = migrateAgentMilestones(input, { selectStamps: ['11:00 PM'] });
  assert.match(unmatched.selectionErrors[0], /matches no timestamped personal entry/);
  assert.equal(unmatched.content, input, 'a refused selection writes nothing');

  const ambiguous = migrateAgentMilestones(input, { selectSummaries: ['planted the'] });
  assert.match(ambiguous.selectionErrors[0], /matches 2 personal entries; name one/);
  assert.equal(ambiguous.content, input);

  const invalidTime = migrateAgentMilestones(input, { selectStamps: ['not-a-time'] });
  assert.match(invalidTime.selectionErrors[0], /is not a time/);
  assert.equal(invalidTime.content, input);
});

test('a stranded agent callout is adopted, then converted into the one table', () => {
  const stranded = [
    '## 📝 Daily Log',
    '> intro',
    '',
    '### 🧍 Personal Log',
    '- **10:00 AM**: Morning walk',
    '',
    '> [!NOTE]- 🤖 Agent Milestone Log (1 milestone — click to expand)',
    '> | Time | Scope | Milestone |',
    '> | :--- | :--- | :--- |',
    '> | 09:15&nbsp;AM | `loey_space` | reconciled from GitHub |',
    '',
    '### 🤖 Agent Milestones',
    '- **09:30 AM**: resolve the defect',
    '',
    '### 🐙 GitHub Activity',
    '',
    '---',
    '## Evening',
    '',
  ].join('\n');

  const result = migrateAgentMilestones(stranded);
  assert.equal(result.adopted, 1, 'the inherited callout is adopted rather than left behind');
  assert.deepEqual(result.moved, [], 'no bullet changes area');
  assert.deepEqual(result.kept, ['Morning walk']);

  const personal = result.content.slice(
    result.content.indexOf('### 🧍 Personal Log'),
    result.content.indexOf('### 🤖 Agent Milestones'),
  );
  assert.doesNotMatch(personal, /Agent Milestone Log/, 'the callout leaves the personal area');
  assert.doesNotMatch(result.content, /Agent Milestone Log/, 'the redundant label is gone');
  assert.match(result.content, /\| 09:15&nbsp;AM \| `loey_space` \| reconciled from GitHub \|/);
  assert.match(result.content, /\| 09:30&nbsp;AM \|  \| resolve the defect \|/);
  assert.match(result.content, /- \*\*10:00 AM\*\*: Morning walk/, 'the owner entry stays in place');

  const again = migrateAgentMilestones(result.content);
  assert.equal(again.adopted, 0, 'adoption is idempotent');
  assert.equal(again.content, result.content);
});

test('mixed previous and current representations consolidate into the one collapsed table', () => {
  // A note that arrived with all three representations at once: the retired callout, the previous
  // plain table and timestamped bullets. One container must hold every row, and the count on the
  // toggle must match.
  const mixed = [
    '## 📝 Daily Log',
    '> intro',
    '',
    '### 🧍 Personal Log',
    '- **10:00 AM**: Morning walk',
    '',
    '### 🤖 Agent Milestones',
    '',
    '> [!NOTE]- 🤖 Agent Milestone Log (1 milestone — click to expand)',
    '> | Time | Scope | Milestone |',
    '> | :--- | :--- | :--- |',
    '> | 09:15&nbsp;AM | `loey_space` | reconciled from GitHub |',
    '',
    '| Time | Scope | Milestone |',
    '| :--- | :--- | :--- |',
    '| 08:30&nbsp;AM | `loey_space` | existing table row |',
    '',
    '- **06:07 AM**: shipped the first pass',
    '',
    '### 🐙 GitHub Activity',
    '',
    '---',
    '## Evening',
    '',
  ].join('\n');

  const migrated = migrateAgentMilestones(mixed, { selectSummaries: ['Morning walk'] });
  assert.equal(migrated.adopted, 0, 'the retired callout already sits in its own area, so nothing moves');
  assert.deepEqual(migrated.moved, ['Morning walk'], 'only the entry the owner named moves');

  const agent = migrated.content.slice(
    migrated.content.indexOf('### 🤖 Agent Milestones'),
    migrated.content.indexOf('### 🐙 GitHub Activity'),
  );
  assert.doesNotMatch(agent, /Agent Milestone Log/, 'the retired label is gone');
  assert.doesNotMatch(agent, /^-(?! )/m, 'no parallel bullet list survives');
  assert.equal((agent.match(/^> \[!NOTE\]-\s*🤖/gm) ?? []).length, 1, 'exactly one container');
  assert.equal((agent.match(/^> \| :--- \| :--- \| :--- \|$/gm) ?? []).length, 1, 'exactly one separator');
  assert.match(agent, /^> \[!NOTE\]- 🤖 Show entries \(4\)$/m, 'the toggle counts every consolidated row');

  const rows = agent.split('\n').filter(line => /^> \| \d{2}:\d{2}/.test(line));
  assert.deepEqual(
    rows.map(row => row.split('|')[1].trim()),
    ['06:07&nbsp;AM', '08:30&nbsp;AM', '09:15&nbsp;AM', '10:00&nbsp;AM'],
    'no row is lost and the order is chronological',
  );
  assert.match(migrated.content, /> \| 09:15&nbsp;AM \| `loey_space` \| reconciled from GitHub \|/);
  assert.match(migrated.content, /> \| 08:30&nbsp;AM \| `loey_space` \| existing table row \|/);
  assert.match(migrated.content, /> \| 10:00&nbsp;AM \|  \| Morning walk \|/, 'scope stays blank, never invented');

  const again = migrateAgentMilestones(migrated.content);
  assert.equal(again.content, migrated.content, 'consolidation is idempotent');
  const later = insertAgentMilestone(migrated.content, { stamp: '18:00', summary: 'a later milestone' });
  assert.equal(later.ok, true);
  const updated = later.content.slice(
    later.content.indexOf('### 🤖 Agent Milestones'),
    later.content.indexOf('### 🐙 GitHub Activity'),
  );
  assert.equal((updated.match(/^> \[!NOTE\]-\s*🤖/gm) ?? []).length, 1, 'a later write reuses that container');
  assert.match(updated, /^> \[!NOTE\]- 🤖 Show entries \(5\)$/m);
});
