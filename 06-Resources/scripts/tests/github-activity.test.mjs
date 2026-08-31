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

test('formatGitHubEventToRow: maps PushEvent and PullRequestEvent to clean table rows with links', () => {
  const pushEv = {
    id: '123',
    type: 'PushEvent',
    repo: { name: 'lowqualityloey/loey_space' },
    created_at: '2026-08-31T06:36:00Z',
    payload: {
      ref: 'refs/heads/main',
      commits: [{ message: 'feat(distill): add automatic concept distiller engine', sha: '4e1e355' }]
    }
  };

  const r1 = formatGitHubEventToRow(pushEv);
  assert.ok(r1);
  assert.strictEqual(r1.repo, '`loey_space`');
  assert.strictEqual(r1.type, '🐙 Push');
  assert.strictEqual(r1.details, '`main`: [feat(distill): add automatic concept distiller engine](https://github.com/lowqualityloey/loey_space/commit/4e1e355)');

  const commitMap = new Map([
    ['38418ad54a8dfb267bf6a18ace5ee82bfc1ffaf5', {
      message: 'feat(kanban): add start-task-action for GitHub Issue',
      url: 'https://github.com/lowqualityloey/loey_space/commit/38418ad54a8dfb267bf6a18ace5ee82bfc1ffaf5'
    }]
  ]);
  const pushHeadEv = {
    id: '789',
    type: 'PushEvent',
    repo: { name: 'lowqualityloey/loey_space' },
    created_at: '2026-08-31T07:52:00Z',
    payload: {
      ref: 'refs/heads/main',
      head: '38418ad54a8dfb267bf6a18ace5ee82bfc1ffaf5'
    }
  };
  const rPushHead = formatGitHubEventToRow(pushHeadEv, commitMap);
  assert.ok(rPushHead);
  assert.strictEqual(rPushHead.details, '`main`: [feat(kanban): add start-task-action for GitHub Issue](https://github.com/lowqualityloey/loey_space/commit/38418ad54a8dfb267bf6a18ace5ee82bfc1ffaf5)');

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
        merged: true,
        html_url: 'https://github.com/lowqualityloey/shelf/pull/28'
      }
    }
  };

  const r2 = formatGitHubEventToRow(prEv);
  assert.ok(r2);
  assert.strictEqual(r2.repo, '`shelf`');
  assert.strictEqual(r2.type, '🔀 PR #28 Merged');
  assert.strictEqual(r2.details, '[TanStack Router Layouts](https://github.com/lowqualityloey/shelf/pull/28)');
});

test('buildGitHubCalloutTable: generates valid collapsible callout and sorts rows from AM to PM', () => {
  const rows = [
    {
      id: '2',
      time: '07:40&nbsp;PM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push',
      details: '`main`',
      rawDate: new Date('2026-08-31T19:40:00Z')
    },
    {
      id: '1',
      time: '06:33&nbsp;AM',
      dateKey: '2026-08-31',
      repo: '`loey_space`',
      type: '🐙 Push',
      details: '`main`',
      rawDate: new Date('2026-08-31T06:33:00Z')
    },
    {
      id: '3',
      time: '02:46&nbsp;PM',
      dateKey: '2026-08-31',
      repo: '`shelf`',
      type: '🐙 Push',
      details: '`feature/library-api`',
      rawDate: new Date('2026-08-31T14:46:00Z')
    }
  ];

  const callout = buildGitHubCalloutTable(rows);
  assert.ok(callout.includes('> [!NOTE]- 🐙 GitHub Activity Log (3 events — click to expand)'));
  assert.ok(callout.includes('> | Time | Repo | Action | Details / Branch |'));

  const lines = callout.split('\n').filter(l => l.includes('| `'));
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].includes('06:33&nbsp;AM'));
  assert.ok(lines[1].includes('02:46&nbsp;PM'));
  assert.ok(lines[2].includes('07:40&nbsp;PM'));
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
