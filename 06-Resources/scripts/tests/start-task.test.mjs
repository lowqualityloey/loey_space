import test from 'node:test';
import assert from 'node:assert/strict';
import startTaskAction from '../start-task-action.js';

const { createBranchSlug, formatCardWithIssue, moveCardToInProgress } = startTaskAction;

test('createBranchSlug: generates clean kebab-case branch names', () => {
  const b1 = createBranchSlug(14, 'Build TanStack Router layouts #priority/p1');
  assert.strictEqual(b1, 'feat/issue-14-build-tanstack-router-layouts');

  const b2 = createBranchSlug(22, 'Fix memory leak in web worker', 'fix');
  assert.strictEqual(b2, 'fix/issue-22-fix-memory-leak-in-web-worker');

  const b3 = createBranchSlug(5, 'UI: Dark mode toggle with persisted preference! #priority/p2');
  assert.strictEqual(b3, 'feat/issue-5-ui-dark-mode-toggle-with-persisted');
});

test('formatCardWithIssue: formats markdown badge with link and priority', () => {
  const card = formatCardWithIssue(
    14,
    'https://github.com/lowqualityloey/shelf/issues/14',
    'Build TanStack Router layouts',
    'P1'
  );

  assert.strictEqual(
    card,
    '- [/] [#14](https://github.com/lowqualityloey/shelf/issues/14) Build TanStack Router layouts #priority/p1'
  );
});

test('moveCardToInProgress: moves card from To Do to In Progress', () => {
  const original = `---
github_project_number: 4
---

## To Do

- [ ] Build TanStack Router layouts #priority/p1
- [ ] Implement debounced search hook

## In Progress

- [/] Configure Auth0 React SDK

## Done
`;

  const updatedCard = '- [/] [#14](https://github.com/lowqualityloey/shelf/issues/14) Build TanStack Router layouts #priority/p1';
  const result = moveCardToInProgress(original, 'Build TanStack Router layouts', updatedCard);

  // Card removed from To Do
  const lines = result.split('\n');
  const todoIdx = lines.findIndex(l => l === '## To Do');
  const inProgressIdx = lines.findIndex(l => l === '## In Progress');

  const todoSection = lines.slice(todoIdx, inProgressIdx).join('\n');
  assert.ok(!todoSection.includes('Build TanStack Router layouts'));

  const inProgressSection = lines.slice(inProgressIdx).join('\n');
  assert.ok(inProgressSection.includes('[#14](https://github.com/lowqualityloey/shelf/issues/14)'));
});
