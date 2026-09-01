import test from 'node:test';
import assert from 'node:assert/strict';
import syncGitHubKanban from '../sync-github-kanban.js';

test('benchmark syncSingleBoard concurrent execution vs sequential', async () => {
  // Mock delayed exec function simulating gh CLI latency (e.g. 50ms per network call)
  const simulatedLatencyMs = 50;
  let callCount = 0;

  const mockExecFn = async (cmd, opts) => {
    callCount++;
    await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs));

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
            { id: 'item_1', title: 'Task 1', status: 'To Do' },
            { id: 'item_2', title: 'Task 2', status: 'To Do' },
            { id: 'item_3', title: 'Task 3', status: 'To Do' },
            { id: 'item_4', title: 'Task 4', status: 'To Do' },
            { id: 'item_5', title: 'Task 5', status: 'To Do' },
            { id: 'item_6', title: 'Task 6', status: 'To Do' },
            { id: 'item_7', title: 'Task 7', status: 'To Do' },
            { id: 'item_8', title: 'Task 8', status: 'To Do' },
            { id: 'item_9', title: 'Task 9', status: 'To Do' },
            { id: 'item_10', title: 'Task 10', status: 'To Do' }
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

- [x] Task 1
- [x] Task 2
- [x] Task 3
- [x] Task 4
- [x] Task 5
- [x] Task 6
- [x] Task 7
- [x] Task 8
- [x] Task 9
- [x] Task 10
`;

  const mockApp = {
    vault: {
      read: async () => localMarkdown
    }
  };

  const mockFile = { basename: 'Test Board', path: '02-Projects/Test.md' };
  const mockConfig = { filePath: '02-Projects/Test.md', title: 'Test Board', projectNumber: 100, owner: 'testowner' };

  if (typeof syncGitHubKanban.syncSingleBoard === 'function') {
    const start = performance.now();
    const res = await syncGitHubKanban.syncSingleBoard(mockApp, mockFile, mockConfig, mockExecFn);
    const duration = performance.now() - start;

    console.log(`\n📊 Sync Benchmark Duration: ${duration.toFixed(2)} ms for 10 updates (Total exec calls: ${callCount})`);
    assert.strictEqual(res.updated, 10);
  }
});
