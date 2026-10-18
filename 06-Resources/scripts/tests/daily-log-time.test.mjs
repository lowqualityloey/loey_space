import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aucklandStamp, displayLogTime, normalizeDailyLog } from '../src/lib/daily-log-time.ts';
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

test('repository writer inserts an earlier capture in timestamp order', () => {
  const result = insertDailyLogLine('## 📝 Daily Log\n- **16:00**: later\n---\n## Evening\n', '- **09:00 AM**: earlier');
  assert.equal(result.ok, true);
  assert.equal(result.content, '## 📝 Daily Log\n- **09:00 AM**: earlier\n- **04:00 PM**: later\n---\n## Evening\n');
});
