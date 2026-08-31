import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime12, formatGitHubEvent, mergeDailyLog } from '../src/lib/github-events.ts';

test('formatTime12: correctly converts 24h dates to 12h AM/PM strings', () => {
  const d1 = new Date(2026, 7, 31, 18, 36); // 18:36
  assert.strictEqual(formatTime12(d1), '06:36 PM');

  const d2 = new Date(2026, 7, 31, 9, 5); // 09:05
  assert.strictEqual(formatTime12(d2), '09:05 AM');

  const d3 = new Date(2026, 7, 31, 0, 15); // 00:15
  assert.strictEqual(formatTime12(d3), '12:15 AM');

  const d4 = new Date(2026, 7, 31, 12, 0); // 12:00
  assert.strictEqual(formatTime12(d4), '12:00 PM');
});

test('formatGitHubEvent: formats PushEvent and PullRequestEvent correctly', () => {
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

  const res1 = formatGitHubEvent(pushEv);
  assert.ok(res1);
  assert.ok(res1.markdown.includes('🐙 **Push** (`loey_space` → `main`)'));
  assert.ok(res1.markdown.includes('feat(distill): add automatic concept distiller engine'));

  const prEv = {
    id: '456',
    type: 'PullRequestEvent',
    repo: { name: 'lowqualityloey/shelf' },
    created_at: '2026-08-31T05:05:00Z',
    payload: {
      action: 'closed',
      number: 4,
      pull_request: {
        number: 4,
        title: 'TanStack Router Layouts',
        merged: true
      }
    }
  };

  const res2 = formatGitHubEvent(prEv);
  assert.ok(res2);
  assert.ok(res2.markdown.includes('🔀 **PR Merged** (`shelf` #4): TanStack Router Layouts'));
});

test('mergeDailyLog: non-destructive merge preserving IRL notes and preventing duplicates', () => {
  const original = `---
type: daily
---

## 📝 Daily Log
A running timestamp of what happened today.

- 08:30 AM Morning walk and breakfast 🍳
- 10:15 AM Gym session: Upper body workout 🏋️

## 🎯 Notes
`;

  const newBullets = [
    '- 05:05 PM 🔀 **PR Merged** (`loey_space` #4): TypeScript Migration Feasibility Assessment',
    '- 06:36 PM 🐙 **Push** (`loey_space` → `main`): feat(distill): add automatic concept distiller engine'
  ];

  const { updatedContent, addedCount } = mergeDailyLog(original, newBullets);
  assert.strictEqual(addedCount, 2);

  // Check IRL entries preserved
  assert.ok(updatedContent.includes('08:30 AM Morning walk and breakfast 🍳'));
  assert.ok(updatedContent.includes('10:15 AM Gym session: Upper body workout 🏋️'));

  // Check GitHub entries added
  assert.ok(updatedContent.includes('05:05 PM 🔀 **PR Merged**'));
  assert.ok(updatedContent.includes('06:36 PM 🐙 **Push**'));

  // Second run: should add 0 new entries
  const secondRun = mergeDailyLog(updatedContent, newBullets);
  assert.strictEqual(secondRun.addedCount, 0);
  assert.strictEqual(secondRun.updatedContent, updatedContent);
});
