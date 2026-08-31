import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTime12,
  formatGitHubEventToRow,
  buildGitHubCalloutTable,
  mergeDailyLogTable
} from '../src/lib/github-events.ts';

test('formatTime12: converts 24h dates to 12h AM/PM strings', () => {
  const d1 = new Date(2026, 7, 31, 18, 36);
  assert.strictEqual(formatTime12(d1), '06:36 PM');

  const d2 = new Date(2026, 7, 31, 9, 5);
  assert.strictEqual(formatTime12(d2), '09:05 AM');
});

test('formatGitHubEventToRow: maps PushEvent and PullRequestEvent to clean table rows', () => {
  const pushEv = {
    id: '123',
    type: 'PushEvent',
    repo: { name: 'lowqualityloey/loey_space' },
    created_at: '2026-08-31T06:36:00Z',
    payload: {
      ref: 'refs/heads/main',
      commits: [{ message: 'feat(distill): add automatic concept distiller engine' }]
    }
  };

  const r1 = formatGitHubEventToRow(pushEv);
  assert.ok(r1);
  assert.strictEqual(r1.repo, '`loey_space`');
  assert.strictEqual(r1.type, '🐙 Push (`main`)');
  assert.strictEqual(r1.details, 'feat(distill): add automatic concept distiller engine');

  const prEv = {
    id: '456',
    type: 'PullRequestEvent',
    repo: { name: 'lowqualityloey/shelf' },
    created_at: '2026-08-31T05:05:00Z',
    payload: {
      action: 'closed',
      number: 28,
      pull_request: {
        number: 28,
        title: 'TanStack Router Layouts',
        merged: true
      }
    }
  };

  const r2 = formatGitHubEventToRow(prEv);
  assert.ok(r2);
  assert.strictEqual(r2.repo, '`shelf`');
  assert.strictEqual(r2.type, '🔀 PR #28 Merged');
  assert.strictEqual(r2.details, 'TanStack Router Layouts');
});

test('buildGitHubCalloutTable: generates valid collapsible callout with table markdown', () => {
  const rows = [
    {
      id: '1',
      time: '06:36 PM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push (`main`)',
      details: 'feat: add distill engine',
      rawDate: new Date()
    }
  ];

  const callout = buildGitHubCalloutTable(rows);
  assert.ok(callout.includes('> [!NOTE]- 🐙 GitHub Activity Log (1 event — click to expand)'));
  assert.ok(callout.includes('> | Time | Repo | Type | Message / Details |'));
  assert.ok(callout.includes('> | 06:36 PM | `loey_space` | 🐙 Push (`main`) | feat: add distill engine |'));
});

test('mergeDailyLogTable: places table callout while preserving manual personal log area', () => {
  const original = `---
type: daily
---

## 📝 Daily Log
> _A running timestamp of what happened today._
- 08:30 AM Morning walk and breakfast 🍳
- 01:00 PM Had lunch with friends 🍱
- 

### 💡 Ideas & Fleeting Notes
`;

  const rows = [
    {
      id: '1',
      time: '06:36 PM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push (`main`)',
      details: 'feat: add distill engine',
      rawDate: new Date()
    }
  ];

  const { updatedContent, count } = mergeDailyLogTable(original, rows);
  assert.strictEqual(count, 1);

  // Manual entries preserved
  assert.ok(updatedContent.includes('08:30 AM Morning walk and breakfast 🍳'));
  assert.ok(updatedContent.includes('01:00 PM Had lunch with friends 🍱'));

  // Collapsible table callout present
  assert.ok(updatedContent.includes('> [!NOTE]- 🐙 GitHub Activity Log'));
  assert.ok(updatedContent.includes('> | 06:36 PM | `loey_space` | 🐙 Push (`main`) | feat: add distill engine |'));

  // Updating again replaces the callout cleanly
  const updatedRows = [
    ...rows,
    {
      id: '2',
      time: '06:50 PM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push (`main`)',
      details: 'feat: add start-task',
      rawDate: new Date()
    }
  ];

  const secondRun = mergeDailyLogTable(updatedContent, updatedRows);
  assert.strictEqual(secondRun.count, 2);
  assert.ok(secondRun.updatedContent.includes('06:50 PM'));
  // Should still have only ONE callout header
  const calloutHeaders = secondRun.updatedContent.match(/> \[!NOTE\]-\s*🐙 GitHub Activity Log/g);
  assert.strictEqual(calloutHeaders?.length, 1);
});
