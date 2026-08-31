import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTime12,
  cleanBranchName,
  formatGitHubEventToRow,
  buildGitHubCalloutTable,
  mergeDailyLogTable
} from '../src/lib/github-events.ts';

test('cleanBranchName: strips refs/heads and trailing long timestamps', () => {
  assert.strictEqual(cleanBranchName('refs/heads/main'), 'main');
  assert.strictEqual(cleanBranchName('ts-migration-assessment-1650511599458480235'), 'ts-migration-assessment');
  assert.strictEqual(cleanBranchName('feature/library-api'), 'feature/library-api');
});

test('formatTime12: converts 24h dates to non-breaking 12h AM/PM strings', () => {
  const d1 = new Date(2026, 7, 31, 18, 36);
  assert.strictEqual(formatTime12(d1), '06:36&nbsp;PM');

  const d2 = new Date(2026, 7, 31, 9, 5);
  assert.strictEqual(formatTime12(d2), '09:05&nbsp;AM');
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
  assert.strictEqual(r1.type, '🐙 Push');
  assert.strictEqual(r1.details, '`main`: feat(distill): add automatic concept distiller engine');

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
      time: '06:36&nbsp;PM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push',
      details: '`main`: feat: add distill engine',
      rawDate: new Date()
    }
  ];

  const callout = buildGitHubCalloutTable(rows);
  assert.ok(callout.includes('> [!NOTE]- 🐙 GitHub Activity Log (1 event — click to expand)'));
  assert.ok(callout.includes('> | Time | Repo | Action | Details / Branch |'));
  assert.ok(callout.includes('> | 06:36&nbsp;PM | `loey_space` | 🐙 Push | `main`: feat: add distill engine |'));
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
      time: '06:36&nbsp;PM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push',
      details: '`main`: feat: add distill engine',
      rawDate: new Date()
    }
  ];

  const { updatedContent, count } = mergeDailyLogTable(original, rows);
  assert.strictEqual(count, 1);

  assert.ok(updatedContent.includes('08:30 AM Morning walk and breakfast 🍳'));
  assert.ok(updatedContent.includes('01:00 PM Had lunch with friends 🍱'));
  assert.ok(updatedContent.includes('> [!NOTE]- 🐙 GitHub Activity Log'));
  assert.ok(updatedContent.includes('> | 06:36&nbsp;PM | `loey_space` | 🐙 Push | `main`: feat: add distill engine |'));
});
