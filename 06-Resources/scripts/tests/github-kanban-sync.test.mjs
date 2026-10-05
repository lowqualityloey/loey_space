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

test('extractLocalKanbanTasks: extracts structured tasks from markdown and ignores nested subtasks', () => {
  const content = `---
github_project_number: 4
---

## Backlog

- [ ] Export personal library to JSON/CSV
- [ ] Configure Tailwind CSS #priority/p1

## In Progress

- [/] [#11](https://github.com/lowqualityloey/shelf/issues/11) Configure Supabase Auth client & route guards #priority/p1
  > 🌿 \`feat/issue-11-configure-supabase-auth\`
  - [ ] Install \`@supabase/supabase-js\`
  - [ ] Create authentication forms
  - [ ] Implement layout guard
  - [ ] Attach bearer token

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

  // Issue #48: the badge is decoration, not identity. This expectation previously
// asserted the badged string, which is what made an already-linked card miss its
// remote item and get re-created as a duplicate draft.
assert.strictEqual(tasks[2].title, 'Configure Supabase Auth client & route guards');
  assert.strictEqual(tasks[2].issueNumber, 11);
  assert.strictEqual(tasks[2].issueUrl, 'https://github.com/lowqualityloey/shelf/issues/11');
  assert.strictEqual(tasks[2].checkbox, '/');
  assert.strictEqual(tasks[2].priority, 'P1');

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
      read: async () => localMarkdown,
      modify: async () => {}
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

test('extractSubtasksFromIssueBody: extracts checked and unchecked criteria correctly', () => {
  const { extractSubtasksFromIssueBody } = syncGitHubKanban;
  const body = `## Overview
Some overview description.

## Tasks / Acceptance Criteria
- [x] Install \`@supabase/supabase-js\` and initialize client.
- [x] Create authentication forms/components (\`LoginForm\`, \`SignUpForm\`).
- [ ] Implement an authenticated layout guard.
- [ ] Attach bearer token header.
`;

  const subtasks = extractSubtasksFromIssueBody(body);
  assert.strictEqual(subtasks.length, 4);
  assert.strictEqual(subtasks[0].checked, true);
  assert.strictEqual(subtasks[0].cleanText, 'install supabase supabase js and initialize client');
  assert.strictEqual(subtasks[1].checked, true);
  assert.strictEqual(subtasks[2].checked, false);
  assert.strictEqual(subtasks[3].checked, false);
});

test('syncBoardSubtasksWithGitHubIssues: updates Kanban card nested checkboxes from GitHub issue body', () => {
  const { syncBoardSubtasksWithGitHubIssues } = syncGitHubKanban;
  const boardMarkdown = `## In Progress

- [/] [#11](https://github.com/lowqualityloey/shelf/issues/11) Configure Supabase Auth client & route guards #priority/p1
	  > 🌿 \`feat/issue-11-configure-supabase-auth\`
	  - [ ] Install \`@supabase/supabase-js\` and initialize client
	  - [ ] Create authentication forms/components (\`LoginForm\`, \`SignUpForm\`)
	  - [ ] Implement an authenticated layout guard
	  - [ ] Attach bearer token header
`;

  const issues = [
    {
      number: 11,
      title: 'Configure Supabase Auth client & route guards',
      url: 'https://github.com/lowqualityloey/shelf/issues/11',
      body: `## Tasks
- [x] Install \`@supabase/supabase-js\` and initialize client
- [x] Create authentication forms/components (\`LoginForm\`, \`SignUpForm\`)
- [ ] Implement an authenticated layout guard
- [ ] Attach bearer token header`
    }
  ];

  const { updatedContent, updatedCount } = syncBoardSubtasksWithGitHubIssues(boardMarkdown, issues, '2026-09-04');
  assert.strictEqual(updatedCount, 2);
  assert.ok(updatedContent.includes('- [x] Install `@supabase/supabase-js` and initialize client ✅ 2026-09-04'));
  assert.ok(updatedContent.includes('- [x] Create authentication forms/components (`LoginForm`, `SignUpForm`) ✅ 2026-09-04'));
  assert.ok(updatedContent.includes('- [ ] Implement an authenticated layout guard'));
  assert.ok(updatedContent.includes('- [ ] Attach bearer token header'));
});

test('syncBoardSubtasksWithGitHubIssues: preserves existing completion date stamps on subtasks', () => {
  const { syncBoardSubtasksWithGitHubIssues } = syncGitHubKanban;
  const boardMarkdown = `## In Progress

- [/] [#11](https://github.com/lowqualityloey/shelf/issues/11) Configure Supabase Auth client & route guards #priority/p1
	  > 🌿 \`feat/issue-11-configure-supabase-auth\`
	  - [x] Install \`@supabase/supabase-js\` and initialize client ✅ 2026-09-03
	  - [ ] Create authentication forms/components (\`LoginForm\`, \`SignUpForm\`)
`;

  const issues = [
    {
      number: 11,
      title: 'Configure Supabase Auth client & route guards',
      url: 'https://github.com/lowqualityloey/shelf/issues/11',
      body: `## Tasks
- [x] Install \`@supabase/supabase-js\` and initialize client
- [x] Create authentication forms/components (\`LoginForm\`, \`SignUpForm\`)`
    }
  ];

  // Sync with date 2026-09-04: existing 2026-09-03 MUST be preserved, new check gets 2026-09-04
  const { updatedContent, updatedCount } = syncBoardSubtasksWithGitHubIssues(boardMarkdown, issues, '2026-09-04');
  assert.strictEqual(updatedCount, 1);
  assert.ok(updatedContent.includes('- [x] Install `@supabase/supabase-js` and initialize client ✅ 2026-09-03'));
  assert.ok(updatedContent.includes('- [x] Create authentication forms/components (`LoginForm`, `SignUpForm`) ✅ 2026-09-04'));
});

test('syncBoardSubtasksWithGitHubIssues: removes date stamp when subtask is unchecked', () => {
  const { syncBoardSubtasksWithGitHubIssues } = syncGitHubKanban;
  const boardMarkdown = `## In Progress

- [/] [#11](https://github.com/lowqualityloey/shelf/issues/11) Configure Supabase Auth client & route guards #priority/p1
	  > 🌿 \`feat/issue-11-configure-supabase-auth\`
	  - [x] Install \`@supabase/supabase-js\` and initialize client ✅ 2026-09-03
`;

  const issues = [
    {
      number: 11,
      title: 'Configure Supabase Auth client & route guards',
      url: 'https://github.com/lowqualityloey/shelf/issues/11',
      body: `## Tasks
- [ ] Install \`@supabase/supabase-js\` and initialize client`
    }
  ];

  const { updatedContent, updatedCount } = syncBoardSubtasksWithGitHubIssues(boardMarkdown, issues, '2026-09-04');
  assert.strictEqual(updatedCount, 1);
  assert.ok(updatedContent.includes('- [ ] Install `@supabase/supabase-js` and initialize client'));
  assert.ok(!updatedContent.includes('✅'));
});

// ---------------------------------------------------------------------------
// Issue #48 — outbound matching must use remote identity, not badged card text.
//
// `injectIssueBadgesIntoBoard` rewrites card lines to `[#N](url) Title` BEFORE
// `extractLocalKanbanTasks` parses them, so a card that is already linked stops
// matching its remote item and is manufactured again as a duplicate draft.
// ---------------------------------------------------------------------------

function makeGhStub({ items = [], issues = [] } = {}) {
  const calls = [];
  // `gh project item-list --format json` nests issue identity under `content`,
  // which is where sync-github-kanban reads `number` from.
  const ghItems = items.map((it) => ({
    id: it.id,
    title: it.title,
    status: it.status,
    content: it.number ? { title: it.title, number: it.number, url: it.url } : undefined
  }));

  const execFn = async (cmd) => {
    calls.push(cmd);
    if (cmd.includes('project view')) {
      return {
        stdout: JSON.stringify({
          id: 'proj_123',
          fields: [
            {
              id: 'f_status',
              name: 'Status',
              options: [
                { id: 'opt_todo', name: 'To Do' },
                { id: 'opt_progress', name: 'In Progress' },
                { id: 'opt_done', name: 'Done' }
              ]
            }
          ]
        })
      };
    }
    if (cmd.includes('project item-list')) {
      return { stdout: JSON.stringify({ items: ghItems }) };
    }
    if (cmd.includes('issue list')) {
      return { stdout: JSON.stringify(issues) };
    }
    if (cmd.includes('project item-create')) {
      return { stdout: JSON.stringify({ id: 'item_created' }) };
    }
    if (cmd.includes('project item-edit')) {
      return { stdout: 'Updated' };
    }
    return { stdout: '' };
  };
  return {
    execFn,
    calls,
    createCount: () => calls.filter((c) => c.includes('project item-create')).length
  };
}

const BADGED_BOARD = `---
github_project_number: 100
---

## In Progress

- [/] [#48](https://github.com/lowqualityloey/shelf/issues/48) Fix the thing #priority/p1
`;

const BOARD_CONFIG = {
  filePath: '02-Projects/shelf/shelf Kanban.md',
  title: 'shelf Kanban',
  projectNumber: 100,
  owner: 'lowqualityloey',
  repo: 'shelf'
};

const BOARD_FILE = { basename: 'shelf Kanban', path: '02-Projects/shelf/shelf Kanban.md' };

test('extractLocalKanbanTasks: strips the issue badge and keeps identity (AC-1, AC-2)', () => {
  const { tasks } = extractLocalKanbanTasks(BADGED_BOARD);

  assert.strictEqual(tasks.length, 1);
  // Badge text is decoration, never identity: it must not leak into the title.
  assert.strictEqual(tasks[0].title, 'Fix the thing');
  assert.strictEqual(tasks[0].priority, 'P1');
  assert.strictEqual(tasks[0].issueNumber, 48);
  assert.strictEqual(tasks[0].issueUrl, 'https://github.com/lowqualityloey/shelf/issues/48');
});

test('syncSingleBoard: an already-linked card is matched, not re-created (AC-1, AC-2, AC-3)', async () => {
  const gh = makeGhStub({
    items: [
      {
        id: 'item_48',
        title: 'Fix the thing',
        number: 48,
        url: 'https://github.com/lowqualityloey/shelf/issues/48',
        status: 'In Progress',
        priority: 'P1'
      }
    ],
    issues: [
      {
        number: 48,
        title: 'Fix the thing',
        url: 'https://github.com/lowqualityloey/shelf/issues/48',
        state: 'OPEN',
        body: 'No subtasks yet.'
      }
    ]
  });

  const mockApp = { vault: { read: async () => BADGED_BOARD, modify: async () => {} } };
  const result = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(result.created, 0);
  assert.strictEqual(result.errors, 0);
  assert.strictEqual(gh.createCount(), 0);
});

test('syncSingleBoard: a retitled but linked card keeps its remote item (AC-1, AC-4)', async () => {
  const gh = makeGhStub({
    items: [
      {
        id: 'item_48',
        title: 'Original issue title',
        number: 48,
        url: 'https://github.com/lowqualityloey/shelf/issues/48',
        status: 'In Progress',
        priority: 'P1'
      }
    ],
    issues: [
      {
        number: 48,
        title: 'Original issue title',
        url: 'https://github.com/lowqualityloey/shelf/issues/48',
        state: 'OPEN',
        body: 'No subtasks yet.'
      }
    ]
  });

  const retitledBoard = `---
github_project_number: 100
---

## In Progress

- [/] [#48](https://github.com/lowqualityloey/shelf/issues/48) Rewritten locally after the fact #priority/p1
`;

  const mockApp = { vault: { read: async () => retitledBoard, modify: async () => {} } };
  const result = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(result.created, 0);
  assert.strictEqual(result.errors, 0);
  assert.strictEqual(gh.createCount(), 0);
});

test('syncSingleBoard: repeated syncs of a linked board create no duplicates (AC-4)', async () => {
  const gh = makeGhStub({
    items: [
      {
        id: 'item_48',
        title: 'Fix the thing',
        number: 48,
        url: 'https://github.com/lowqualityloey/shelf/issues/48',
        status: 'In Progress',
        priority: 'P1'
      }
    ],
    issues: [
      {
        number: 48,
        title: 'Fix the thing',
        url: 'https://github.com/lowqualityloey/shelf/issues/48',
        state: 'OPEN',
        body: 'No subtasks yet.'
      }
    ]
  });

  const mockApp = { vault: { read: async () => BADGED_BOARD, modify: async () => {} } };

  const first = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);
  const second = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(first.created, 0);
  assert.strictEqual(second.created, 0);
  assert.strictEqual(gh.createCount(), 0);
});

test('syncSingleBoard: title fallback still links unbadged cards and still creates new ones (AC-1, AC-3)', async () => {
  const gh = makeGhStub({
    items: [
      {
        id: 'item_unbadged',
        title: 'Unbadged but matching',
        status: 'In Progress'
      }
    ]
  });

  const mixedBoard = `---
github_project_number: 100
---

## In Progress

- [/] Unbadged but matching
- [/] Genuinely new card
`;

  const mockApp = { vault: { read: async () => mixedBoard, modify: async () => {} } };
  const result = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(result.created, 1);
  assert.strictEqual(result.errors, 0);
  assert.strictEqual(gh.createCount(), 1);

  const createCall = gh.calls.find((c) => c.includes('project item-create'));
  assert.ok(createCall.includes('Genuinely new card'));
  assert.ok(!createCall.includes('Unbadged but matching'));
});

// ---------------------------------------------------------------------------
// Issue #49 — an unreadable or truncated remote inventory must never be mistaken
// for an empty one.
//
// Every local card is only provably new when its absence from the remote
// inventory is trustworthy. A failed read, a non-JSON body, or a `--limit` window
// that cut the board short all leave cards looking "missing", so the old code
// re-created the whole board as duplicate drafts and still summarised
// `created: N, errors: 0`.
// ---------------------------------------------------------------------------

const INVENTORY_VIEW = JSON.stringify({
  id: 'proj_123',
  fields: [
    {
      id: 'f_status',
      name: 'Status',
      options: [
        { id: 'opt_todo', name: 'To Do' },
        { id: 'opt_progress', name: 'In Progress' },
        { id: 'opt_done', name: 'Done' }
      ]
    }
  ]
});

// A project of `size` real items, numbered 1..size.
function inventoryOfSize(size) {
  return Array.from({ length: size }, (_, i) => ({
    id: `item_${i + 1}`,
    title: `Card ${i + 1}`,
    number: i + 1,
    url: `https://github.com/lowqualityloey/shelf/issues/${i + 1}`,
    status: 'To Do'
  }));
}

// Emulates the real `gh project item-list --format json` contract, which #48's
// stub did not model:
//   * the command has no offset — `gh` returns only the first `--limit` items and
//     pages internally up to that limit, so past the window items are simply absent;
//   * issue identity is nested under `content`, and there is no top-level `title`;
//   * `totalCount` always reports the project's real item count and ignores `--limit`.
function makeInventoryStub({
  remoteItems = [],
  issues = [],
  itemListRejects = false,
  itemListBody = null // overrides the generated body when set
} = {}) {
  const calls = [];
  const execFn = async (cmd) => {
    calls.push(cmd);
    if (cmd.includes('project view')) {
      return { stdout: INVENTORY_VIEW };
    }
    if (cmd.includes('project item-list')) {
      if (itemListRejects) {
        throw new Error('gh: could not fetch project items (HTTP 502)');
      }
      if (itemListBody !== null) {
        return { stdout: itemListBody };
      }
      const limit = Number(cmd.match(/--limit (\d+)/)?.[1] ?? remoteItems.length);
      return {
        stdout: JSON.stringify({
          items: remoteItems.slice(0, limit).map((it) => ({
            id: it.id,
            content: { title: it.title, number: it.number, url: it.url },
            status: it.status
          })),
          totalCount: remoteItems.length
        })
      };
    }
    if (cmd.includes('issue list')) {
      return { stdout: JSON.stringify(issues) };
    }
    if (cmd.includes('project item-create')) {
      return { stdout: JSON.stringify({ id: 'item_created' }) };
    }
    if (cmd.includes('project item-edit')) {
      return { stdout: 'Updated' };
    }
    return { stdout: '' };
  };
  return {
    execFn,
    calls,
    itemListLimits: () => calls.filter((c) => c.includes('project item-list')).map((c) => Number(c.match(/--limit (\d+)/)?.[1])),
    createCount: () => calls.filter((c) => c.includes('project item-create')).length
  };
}

const TWO_CARD_BOARD = `---
github_project_number: 100
---

## To Do

- [ ] Alpha card
- [ ] Beta card
`;

test('syncSingleBoard: a failed inventory read creates nothing and is reported as a sync failure (AC-1)', async () => {
  const gh = makeInventoryStub({ itemListRejects: true });
  const mockApp = { vault: { read: async () => TWO_CARD_BOARD, modify: async () => {} } };

  const result = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(gh.createCount(), 0, 'an unreadable inventory must not create anything');
  assert.strictEqual(result.created, 0);
  assert.strictEqual(result.updated, 0);
  assert.ok(result.errors >= 1, 'an unreadable inventory must be reported as a sync failure');
});

test('syncSingleBoard: a valid empty inventory still creates, so it stays distinct from a read failure (AC-4)', async () => {
  const gh = makeInventoryStub({ remoteItems: [] });
  const mockApp = { vault: { read: async () => TWO_CARD_BOARD, modify: async () => {} } };

  const result = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(result.created, 2, 'a genuinely empty project must still accept new cards');
  assert.strictEqual(result.errors, 0);
  assert.strictEqual(gh.createCount(), 2);
});

test('syncSingleBoard: a malformed inventory body creates nothing and is reported as a sync failure (AC-1)', async () => {
  const gh = makeInventoryStub({ itemListBody: '<html>502 Bad Gateway</html>' });
  const mockApp = { vault: { read: async () => TWO_CARD_BOARD, modify: async () => {} } };

  const result = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(gh.createCount(), 0, 'an unparseable inventory must not create anything');
  assert.strictEqual(result.created, 0);
  assert.ok(result.errors >= 1, 'an unparseable inventory must be reported as a sync failure');
});

test('syncSingleBoard: a card beyond the first page of items is recognised as existing (AC-3)', async () => {
  // 120 items with the card of interest last, so anything capped at the old fixed
  // window of 100 cannot see it.
  const gh = makeInventoryStub({ remoteItems: inventoryOfSize(120) });

  const tailBoard = `---
github_project_number: 100
---

## In Progress

- [/] [#120](https://github.com/lowqualityloey/shelf/issues/120) Card 120 #priority/p2
`;

  const mockApp = { vault: { read: async () => tailBoard, modify: async () => {} } };
  const result = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(
    gh.itemListLimits().length,
    1,
    'one read only — gh has no offset, so repeat calls cannot reach past the window'
  );
  assert.ok(
    gh.itemListLimits()[0] >= 120,
    `the requested window must cover all 120 items, got ${gh.itemListLimits()[0]}`
  );
  assert.strictEqual(result.created, 0, 'item 120 exists remotely and must not be re-created');
  assert.strictEqual(result.errors, 0);
  assert.strictEqual(gh.createCount(), 0);
});

test('syncSingleBoard: the item-list window must not stay capped at the old fixed 100 (AC-2)', async () => {
  const gh = makeInventoryStub({ remoteItems: inventoryOfSize(300) });
  const mockApp = { vault: { read: async () => TWO_CARD_BOARD, modify: async () => {} } };

  await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(gh.itemListLimits().length, 1);
  assert.ok(
    gh.itemListLimits()[0] > 100,
    `item-list window must exceed the old fixed 100, got ${gh.itemListLimits()[0]}`
  );
});

test('syncSingleBoard: a window that still cuts the board short is marked incomplete and refuses to create (AC-2)', async () => {
  // 1200 items: any sane window truncates this, and the card of interest sits in
  // the part no window can reach.
  const gh = makeInventoryStub({ remoteItems: inventoryOfSize(1200) });

  const tailBoard = `---
github_project_number: 100
---

## In Progress

- [/] [#1200](https://github.com/lowqualityloey/shelf/issues/1200) Card 1200 #priority/p2
`;

  const mockApp = { vault: { read: async () => tailBoard, modify: async () => {} } };
  const result = await syncSingleBoard(mockApp, BOARD_FILE, BOARD_CONFIG, gh.execFn);

  assert.strictEqual(gh.createCount(), 0, 'a truncated inventory cannot prove a card is new');
  assert.strictEqual(result.created, 0);
  assert.ok(result.errors >= 1, 'a truncated inventory must be reported as a sync failure');
});

test('syncBoardLanesWithRemoteItems: moves card from In Progress to Done when remote status is Done', () => {
  const { syncBoardLanesWithRemoteItems } = syncGitHubKanban;
  const boardMarkdown = `---
github_project_number: 4
---

## In Progress

- [/] [#11](https://github.com/lowqualityloey/shelf/issues/11) Configure Supabase Auth client & route guards #priority/p1
	  > 🌿 \`feat/issue-11-configure-supabase-auth\`
	  - [x] Install \`@supabase/supabase-js\`
	  - [ ] Implement layout guard

## Done

- [x] Previous Done Task ✅ 2026-08-24
`;

  const remoteItems = [
    {
      id: 'item_11',
      title: 'Configure Auth0 React SDK & auth route guards',
      contentTitle: 'Configure Supabase Auth client & route guards',
      number: 11,
      status: 'Done',
      priority: 'P1'
    }
  ];

  const repoIssues = [
    {
      number: 11,
      title: 'Configure Supabase Auth client & route guards',
      url: 'https://github.com/lowqualityloey/shelf/issues/11',
      state: 'OPEN'
    }
  ];

  const { updatedContent, movedCount } = syncBoardLanesWithRemoteItems(boardMarkdown, remoteItems, repoIssues, '2026-09-03');
  assert.strictEqual(movedCount, 1);
  assert.ok(!updatedContent.includes('## In Progress\n\n- [/] [#11]'));
  assert.ok(updatedContent.includes('## Done'));
  assert.ok(updatedContent.includes('- [x] [#11](https://github.com/lowqualityloey/shelf/issues/11) Configure Supabase Auth client & route guards #priority/p1 ✅ 2026-09-03'));
  assert.ok(updatedContent.includes('- [x] Implement layout guard'));
});
