import test from 'node:test';
import assert from 'node:assert/strict';
import quickCaptureAction from '../quick-capture-action.js';
import clearCaptureDump from '../clear-capture-dump.js';

globalThis.window = globalThis;
const notices = [];
globalThis.Notice = class {
  constructor(msg) {
    this.message = msg;
    notices.push(msg);
  }
};

const DUMP_PATH = '00-Inbox/quick-capture-dump.md';

function makeMockVault(initialFiles = {}) {
  const files = new Map(Object.entries(initialFiles));
  const folders = new Set();
  // Queue to simulate real Obsidian vault.process mutual exclusion
  let processQueue = Promise.resolve();

  const vault = {
    getAbstractFileByPath: (p) => (files.has(p) ? { path: p, extension: 'md' } : folders.has(p) ? { path: p } : null),
    read: async (f) => {
      if (!files.has(f.path)) throw new Error(`ENOENT: ${f.path}`);
      return files.get(f.path);
    },
    modify: async (f, content) => {
      files.set(f.path, content);
    },
    process: async (f, fn) => {
      const nextOp = processQueue.then(async () => {
        if (!files.has(f.path)) throw new Error(`ENOENT: ${f.path}`);
        const current = files.get(f.path);
        const next = await fn(current);
        files.set(f.path, next);
        return next;
      });
      processQueue = nextOp.catch(() => {});
      return nextOp;
    },
    create: async (p, content) => {
      if (files.has(p)) throw new Error(`File already exists: ${p}`);
      files.set(p, content);
      return { path: p, extension: 'md' };
    },
    createFolder: async (p) => {
      folders.add(p);
    },
  };

  return { app: { vault }, files, folders };
}

test('F01: two concurrent quick captures both survive and group under today date header', async () => {
  const today = '2026-10-18';
  const initial = [
    '# 📥 Quick Capture Dump',
    '',
    '> Append quick thoughts here.',
    '',
    '## Captured Notes',
    '',
  ].join('\n');

  const { app, files } = makeMockVault({
    [DUMP_PATH]: initial,
  });

  const now = new Date(`${today}T12:00:00Z`);

  // Launch two concurrent quick capture actions
  await Promise.all([
    quickCaptureAction({ app, variables: { value: 'First concurrent thought #idea' } }),
    quickCaptureAction({ app, variables: { value: 'Second concurrent thought #dev' } }),
  ]);

  const after = files.get(DUMP_PATH);
  assert.ok(after.includes('- First concurrent thought #idea'), 'First capture must survive');
  assert.ok(after.includes('- Second concurrent thought #dev'), 'Second capture must survive');
  assert.ok(after.includes('## Captured Notes'), 'Section header must exist');

  // Verify there is only one date header for today under Captured Notes
  const dateHeaderCount = (after.match(/###\s*📅\s*\d{4}-\d{2}-\d{2}/g) || []).length;
  assert.equal(dateHeaderCount, 1, 'Should have exactly one date header grouping both captures');
});

test('F01: concurrent capture and archive interleaving preserves newly arrived capture', async () => {
  const initial = [
    '---',
    'updated: 2026-10-18',
    '---',
    '',
    '# 📥 Quick Capture Dump',
    '',
    '## Captured Notes',
    '',
    '### 📅 2026-10-17',
    '- yesterday capture to archive #ref',
    '',
  ].join('\n');

  const { app, files } = makeMockVault({
    [DUMP_PATH]: initial,
  });

  // Interleave quick capture while clearCaptureDump is running
  const realCreateFolder = app.vault.createFolder;
  let captureFired = false;
  app.vault.createFolder = async (p) => {
    if (!captureFired) {
      captureFired = true;
      // Mid-archive, a quick capture arrives
      await quickCaptureAction({
        app,
        variables: { value: 'urgent capture arrived during archive #concept' },
      });
    }
    return realCreateFolder(p);
  };

  await clearCaptureDump({ app });

  const afterDump = files.get(DUMP_PATH);
  assert.ok(
    afterDump.includes('urgent capture arrived during archive #concept'),
    'Capture arrived mid-archive must survive in the live dump'
  );
  assert.ok(
    !afterDump.includes('yesterday capture to archive #ref'),
    'Processed capture should be cleared from live dump'
  );
});

test('F01: concurrent initial file creation forces a collision, recovers, and preserves both captures', async () => {
  let content;
  let creates = 0;
  let collisions = 0;
  let release;
  let queue = Promise.resolve();
  const barrier = new Promise((resolve) => { release = resolve; });

  const file = { path: DUMP_PATH, extension: 'md' };
  const vault = {
    getAbstractFileByPath: (p) => (p === DUMP_PATH && content !== undefined ? file : null),
    create: async (p, data) => {
      if (++creates === 2) release();
      await barrier;
      if (content !== undefined) {
        collisions++;
        throw new Error(`File already exists: ${p}`);
      }
      content = data;
      return file;
    },
    process: async (_file, transform) => {
      const next = queue.then(async () => {
        content = await transform(content);
      });
      queue = next.catch(() => {});
      return next;
    },
  };

  await Promise.all([
    quickCaptureAction({ app: { vault }, variables: { value: 'Capture on fresh vault A' } }),
    quickCaptureAction({ app: { vault }, variables: { value: 'Capture on fresh vault B' } }),
  ]);

  assert.equal(creates, 2, 'Both concurrent callers must attempt creation');
  assert.equal(collisions, 1, 'Exactly one caller must experience and recover from create collision');
  assert.ok(content.includes('Capture on fresh vault A'), 'Capture A must survive');
  assert.ok(content.includes('Capture on fresh vault B'), 'Capture B must survive');
});

test('F01: refuses to write and reports actionable error when vault.process is absent', async () => {
  let modifyCalled = false;
  let readCalled = false;
  const file = { path: DUMP_PATH, extension: 'md' };
  const vault = {
    getAbstractFileByPath: () => file,
    read: async () => {
      readCalled = true;
      return '# Dump\n\n## Captured Notes\n\n';
    },
    modify: async () => {
      modifyCalled = true;
    },
    // process is deliberately undefined
  };

  await assert.rejects(
    async () => {
      await quickCaptureAction({ app: { vault }, variables: { value: 'Untrusted fallback capture' } });
    },
    {
      message: /Atomic vault\.process is required/,
    }
  );

  assert.equal(modifyCalled, false, 'vault.modify must never be called on unsafe fallback');
  assert.equal(readCalled, false, 'vault.read must never be called on unsafe fallback');
});

test('F01: date header in Triaged section is never confused with Captured Notes date header', async () => {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const initial = [
    '# 📥 Quick Capture Dump',
    '',
    '## Captured Notes',
    '',
    '---',
    '',
    '## ✅ Triaged',
    '> _Swept out of the inbox._',
    '',
    `### 📅 ${dateStr}`,
    '- ~~already triaged note~~ → [[Some Note]] `#ref`',
    '',
  ].join('\n');

  const { app, files } = makeMockVault({
    [DUMP_PATH]: initial,
  });

  await quickCaptureAction({ app, variables: { value: 'New untriaged capture' } });

  const after = files.get(DUMP_PATH);
  const capturedIdx = after.indexOf('## Captured Notes');
  const triagedIdx = after.indexOf('## ✅ Triaged');

  assert.ok(capturedIdx !== -1 && triagedIdx !== -1, 'Both sections must exist');
  const capturedSection = after.slice(capturedIdx, triagedIdx);
  const triagedSection = after.slice(triagedIdx);

  assert.ok(
    capturedSection.includes('New untriaged capture'),
    'New capture must be placed inside ## Captured Notes'
  );
  assert.ok(
    !triagedSection.includes('New untriaged capture'),
    'New capture must NOT be placed inside ## ✅ Triaged'
  );
  assert.ok(
    triagedSection.includes('- ~~already triaged note~~ → [[Some Note]] `#ref`'),
    'Existing triaged items must be preserved untouched'
  );
});

test('F01: sequential captures on the same day accumulate under single header without duplicates', async () => {
  const { app, files } = makeMockVault({
    [DUMP_PATH]: '# 📥 Quick Capture Dump\n\n## Captured Notes\n\n',
  });

  await quickCaptureAction({ app, variables: { value: 'First capture' } });
  await quickCaptureAction({ app, variables: { value: 'Second capture' } });
  await quickCaptureAction({ app, variables: { value: 'Third capture' } });

  const after = files.get(DUMP_PATH);
  assert.ok(after.includes('- First capture'), 'First capture must be present');
  assert.ok(after.includes('- Second capture'), 'Second capture must be present');
  assert.ok(after.includes('- Third capture'), 'Third capture must be present');

  const headers = after.match(/###\s*📅\s*\d{4}-\d{2}-\d{2}/g) || [];
  assert.equal(headers.length, 1, 'Only one date header must exist for today');
});

test('F01: user cancellation in inputPrompt leaves dump file completely untouched', async () => {
  const initial = [
    '---',
    'updated: 2026-10-18',
    'type: capture',
    '---',
    '',
    '# 📥 Quick Capture Dump',
    '',
    '## Captured Notes',
    '',
    '### 📅 2026-10-18',
    '- existing capture `10:00 AM`',
    '',
  ].join('\n');

  const { app, files } = makeMockVault({
    [DUMP_PATH]: initial,
  });

  const quickAddApi = {
    inputPrompt: async () => undefined, // User pressed Escape or Cancel
  };

  await quickCaptureAction({ app, quickAddApi });
  assert.equal(files.get(DUMP_PATH), initial, 'File content must not change when prompt cancelled');
});

test('F01: YAML frontmatter and surrounding content are strictly preserved', async () => {
  const initial = [
    '---',
    'updated: 2026-10-18',
    'type: capture',
    'area: inbox',
    'status: active',
    'tags:',
    '  - type/capture',
    '  - area/inbox',
    '---',
    '',
    '# 📥 Quick Capture Dump',
    '',
    '> Pinned instruction block.',
    '',
    '## Captured Notes',
    '',
    '### 📅 2026-10-17',
    '- yesterday capture `08:00 PM`',
    '',
    '---',
    '',
    '## ✅ Triaged',
    '> _Swept out of the inbox._',
    '',
  ].join('\n');

  const { app, files } = makeMockVault({
    [DUMP_PATH]: initial,
  });

  await quickCaptureAction({ app, variables: { value: 'New pristine capture' } });

  const after = files.get(DUMP_PATH);
  assert.ok(after.startsWith('---\nupdated: 2026-10-18\ntype: capture'), 'Frontmatter must be preserved');
  assert.ok(after.includes('> Pinned instruction block.'), 'Instruction callout must be preserved');
  assert.ok(after.includes('- yesterday capture `08:00 PM`'), 'Yesterday note must be preserved');
  assert.ok(after.includes('- New pristine capture'), 'New capture must be added');
  assert.ok(after.includes('## ✅ Triaged'), 'Triaged section must be preserved');
});

