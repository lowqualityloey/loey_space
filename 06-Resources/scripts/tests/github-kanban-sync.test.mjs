import test from 'node:test';
import assert from 'node:assert/strict';
import syncGitHubKanban from '../sync-github-kanban.js';

const { normalizeLaneName, parsePriorityTag, extractLocalKanbanTasks, syncSingleBoard } = syncGitHubKanban;

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

test('syncSingleBoard: executes asynchronously without blocking', async () => {
  assert.strictEqual(typeof syncSingleBoard, 'function');
  const mockApp = {
    vault: {
      read: async () => '## Backlog\n- [ ] Task 1\n'
    }
  };
  const mockFile = { basename: 'Test Board', path: '02-Projects/Test.md' };
  const mockConfig = { projectNumber: 9999, owner: 'testowner', title: 'Test Board', filePath: '02-Projects/Test.md' };

  // syncSingleBoard returns a Promise and catches gh CLI errors gracefully
  const result = await syncSingleBoard(mockApp, mockFile, mockConfig);
  assert.ok(typeof result.updated === 'number');
  assert.ok(typeof result.created === 'number');
  assert.ok(typeof result.errors === 'number');
});

test('syncSingleBoard: creates new project items safely with execFn array arguments', async () => {
  const executedCalls = [];
  const mockExecFn = async (cmd, opts) => {
    executedCalls.push(cmd);
    if (cmd.includes('project view')) {
      return {
        stdout: JSON.stringify({
          id: 'proj_123',
          fields: [
            { id: 'f_status', name: 'Status', options: [{ id: 'opt_todo', name: 'To Do' }] }
          ]
        })
      };
    }
    if (cmd.includes('project item-list')) {
      return {
        stdout: JSON.stringify({ items: [] })
      };
    }
    if (cmd.includes('project item-create')) {
      return {
        stdout: JSON.stringify({ id: 'item_new_123' })
      };
    }
    if (cmd.includes('project item-edit')) {
      return { stdout: 'Updated' };
    }
    return { stdout: '' };
  };

  const localMarkdown = `---
github_project_number: 100
---

## To Do

- [ ] New Task with "$(calc)" and \`whoami\`
`;

  const mockApp = {
    vault: {
      read: async () => localMarkdown
    }
  };
  const mockFile = { basename: 'Test Board', path: '02-Projects/Test.md' };
  const mockConfig = { filePath: '02-Projects/Test.md', title: 'Test Board', projectNumber: 100, owner: 'testowner' };

  const result = await syncSingleBoard(mockApp, mockFile, mockConfig, mockExecFn);
  assert.strictEqual(result.created, 1);
  assert.strictEqual(result.errors, 0);

  const createCall = executedCalls.find((c) => c.includes('item-create'));
  assert.ok(createCall);
  assert.ok(createCall.includes('New Task with "$(calc)" and `whoami`'));
});

test('syncSingleBoard: handles tasks with shell injection payloads safely', async () => {
  const executedCalls = [];
  const mockExecFn = async (cmd, opts) => {
    executedCalls.push(cmd);
    if (cmd.includes('project view')) {
      return {
        stdout: JSON.stringify({
          id: 'proj_123',
          fields: [
            { id: 'f_status', name: 'Status', options: [{ id: 'opt_todo', name: 'To Do' }, { id: 'opt_done', name: 'Done' }] }
          ]
        })
      };
    }
    if (cmd.includes('project item-list')) {
      return {
        stdout: JSON.stringify({
          items: [
            { id: 'item_injection', title: 'Injection Task $(whoami) `id` ; rm -rf /', status: 'To Do' }
          ]
        })
      };
    }
    if (cmd.includes('project item-edit')) {
      return { stdout: 'Updated' };
    }
    return { stdout: '' };
  };

  const localMarkdown = `---
github_project_number: 100
---

## Done

- [x] Injection Task $(whoami) \`id\` ; rm -rf /
`;

  const mockApp = {
    vault: {
      read: async () => localMarkdown
    }
  };
  const mockFile = { basename: 'Test Board', path: '02-Projects/Test.md' };
  const mockConfig = { filePath: '02-Projects/Test.md', title: 'Test Board', projectNumber: 100, owner: 'testowner' };

  const result = await syncSingleBoard(mockApp, mockFile, mockConfig, mockExecFn);
  assert.strictEqual(result.updated, 1);
  assert.strictEqual(result.errors, 0);

  const editCall = executedCalls.find((c) => c.includes('item-edit'));
  assert.ok(editCall);
  assert.ok(editCall.includes('--id item_injection'));
  assert.ok(editCall.includes('--single-select-option-id opt_done'));
});
