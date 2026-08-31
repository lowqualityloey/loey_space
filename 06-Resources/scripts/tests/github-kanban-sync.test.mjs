import test from 'node:test';
import assert from 'node:assert/strict';
import syncGitHubKanban from '../sync-github-kanban.js';

const { normalizeLaneName, parsePriorityTag, extractLocalKanbanTasks } = syncGitHubKanban;

test('normalizeLaneName: normalizes lane variations and icons', () => {
  assert.strictEqual(normalizeLaneName('## Backlog'), 'backlog');
  assert.strictEqual(normalizeLaneName('## 📋 To Do'), 'to do');
  assert.strictEqual(normalizeLaneName('## ⏳ In Progress'), 'in progress');
  assert.strictEqual(normalizeLaneName('## 🔍 Review / Test'), 'review / test');
  assert.strictEqual(normalizeLaneName('## ✅ Done'), 'done');
  assert.strictEqual(normalizeLaneName('Active To-Dos'), 'to do');
});

test('parsePriorityTag: parses priority tokens correctly', () => {
  const t1 = parsePriorityTag('Build TanStack Router layouts #priority/p1');
  assert.strictEqual(t1.cleanText, 'Build TanStack Router layouts');
  assert.strictEqual(t1.priority, 'P1');

  const t0 = parsePriorityTag('Urgent security patch #priority/p0');
  assert.strictEqual(t0.cleanText, 'Urgent security patch');
  assert.strictEqual(t0.priority, 'P0');

  const tNone = parsePriorityTag('Regular task without priority');
  assert.strictEqual(tNone.cleanText, 'Regular task without priority');
  assert.strictEqual(tNone.priority, null);
});

test('extractLocalKanbanTasks: extracts structured tasks from markdown', () => {
  const content = `---
github_project_number: 4
---

## Backlog

- [ ] Export personal library to JSON/CSV
- [ ] Configure Tailwind CSS #priority/p1

## In Progress

- [/] Configure Auth0 React SDK #priority/p1

## Done

- [x] Initial project setup ✅ 2026-08-24
`;

  const { tasks, sections } = extractLocalKanbanTasks(content);

  assert.strictEqual(sections.length, 3);
  assert.strictEqual(tasks.length, 4);

  assert.strictEqual(tasks[0].title, 'Export personal library to JSON/CSV');
  assert.strictEqual(tasks[0].checkbox, ' ');

  assert.strictEqual(tasks[1].title, 'Configure Tailwind CSS');
  assert.strictEqual(tasks[1].priority, 'P1');

  assert.strictEqual(tasks[2].title, 'Configure Auth0 React SDK');
  assert.strictEqual(tasks[2].checkbox, '/');

  assert.strictEqual(tasks[3].title, 'Initial project setup');
  assert.strictEqual(tasks[3].completionDate, '2026-08-24');
  assert.strictEqual(tasks[3].checkbox, 'x');
});
