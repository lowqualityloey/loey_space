import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import clearCaptureDump from '../clear-capture-dump.js';
import { backupVault, verifySnapshotIntegrity } from '../backup-vault.js';
import weeklyAISummary from '../weekly-ai-summary.js';
import startTaskAction from '../start-task-action.js';
import { extractLocalKanbanTasks } from '../src/lib/github.ts';

globalThis.window = globalThis;
globalThis.Notice = class {
  constructor(msg) {
    this.message = msg;
  }
};

const DUMP_PATH = '00-Inbox/quick-capture-dump.md';

function makeMockVault(initialFiles) {
  const files = new Map(Object.entries(initialFiles));
  const folders = new Set();

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
      const next = fn(files.get(f.path));
      files.set(f.path, next);
      return next;
    },
    create: async (p, content) => {
      files.set(p, content);
      return { path: p, extension: 'md' };
    },
    createFolder: async (p) => {
      folders.add(p);
    },
  };

  return { app: { vault }, files, folders };
}

test('F01: clearCaptureDump preserves a capture appended or edited while archiving and preserves dump metadata/scaffold', async () => {
  const initialDump = [
    '---',
    'updated: 2026-10-12',
    'created: 2026-09-04',
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
    '> Quick capture thoughts, links, and temporary notes.',
    '',
    '## Captured Notes',
    '',
    '### 📅 2026-10-11',
    '- old capture to archive #ref',
    '- capture that gets edited mid-flight #concept',
    '',
    '---',
    '',
    '## ✅ Triaged',
    '> _Swept out of the inbox._',
    '',
    '### 📅 2026-10-11',
    '- ~~already triaged~~ → [[Note]] `#ref`',
    '',
  ].join('\n');

  const { app, files } = makeMockVault({
    [DUMP_PATH]: initialDump,
  });

  // Simulate concurrent capture arrival and edit while the archive file is being created
  const realCreate = app.vault.create;
  app.vault.create = async (p, content) => {
    await app.vault.process(app.vault.getAbstractFileByPath(DUMP_PATH), (cur) =>
      cur
        .replace(
          '- capture that gets edited mid-flight #concept',
          '- capture that gets edited mid-flight (UPDATED) #concept'
        )
        + '\n- newly arrived capture during archive #do\n'
    );
    return realCreate(p, content);
  };

  await clearCaptureDump({ app });

  const afterDump = files.get(DUMP_PATH);
  assert.ok(afterDump.startsWith('---\nupdated: 2026-10-12'), 'YAML frontmatter must be preserved');
  assert.ok(afterDump.includes('# 📥 Quick Capture Dump'), 'Dump heading must be preserved');
  assert.ok(afterDump.includes('## Captured Notes'), 'Captured Notes section scaffold must be preserved');
  assert.ok(afterDump.includes('## ✅ Triaged'), 'Triaged section scaffold must be preserved');
  assert.ok(
    afterDump.includes('- newly arrived capture during archive #do'),
    'Capture appended mid-archive must survive in the live dump'
  );
  assert.ok(
    afterDump.includes('- capture that gets edited mid-flight (UPDATED) #concept'),
    'Capture edited mid-archive must survive in the live dump'
  );
  assert.ok(
    !afterDump.includes('- old capture to archive #ref'),
    'Unchanged archived capture must be removed from the live dump'
  );

  const archiveKey = [...files.keys()].find((k) => k.startsWith('00-Inbox/Archives/Quick Capture Archive '));
  assert.ok(archiveKey, 'Archive file must be created');
  const archiveContent = files.get(archiveKey);
  assert.ok(archiveContent.includes('- old capture to archive #ref'), 'Archive must contain snapshot entries');
  assert.ok(
    !archiveContent.includes('newly arrived capture during archive'),
    'Archive must not claim entries that arrived after the snapshot'
  );
});

test('F01: clearCaptureDump leaves the dump completely untouched if the archive write fails', async () => {
  const initialDump = '# Quick Capture Dump\n\n- important capture that must not be lost\n';
  const { app, files } = makeMockVault({
    [DUMP_PATH]: initialDump,
  });

  app.vault.create = async () => {
    throw new Error('ENOSPC: simulated disk full');
  };

  await clearCaptureDump({ app });

  assert.equal(
    files.get(DUMP_PATH),
    initialDump,
    'Source dump must remain untouched when archive creation fails'
  );
});

test('F02: backupVault backs up 00-Private, ignored resources, attachments, docs, PROMPTKIT.md, and plugin data.json, and skips pruning on git bundle failure', () => {
  const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-f02-vault-'));
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-f02-backups-'));

  const fixtureFiles = {
    'Home.md': '# Home\n',
    'memory.md': '# Memory\n',
    'handoff.md': '# Handoff\n',
    '.env': 'KEY=VAL\n',
    'PROMPTKIT.md': '# PromptKit Profile\n',
    '00-Private/SOUL.md': '# Kiwi Persona\n',
    '06-Resources/Guides/Local Guide.md': '# Local Guide\n',
    '06-Resources/Articles/Clipped Article.md': '# Clipped Article\n',
    '99-Attachments/2026-10/diagram.png': 'PNG-BYTES',
    'docs/STATE.md': '# State\n',
    '.obsidian/plugins/quickadd/data.json': '{"choices":[]}\n',
  };

  try {
    for (const [rel, content] of Object.entries(fixtureFiles)) {
      const abs = path.join(vaultRoot, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
    }

    execFileSync('git', ['init', '-q'], { cwd: vaultRoot });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: vaultRoot });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: vaultRoot });
    execFileSync('git', ['add', 'Home.md'], { cwd: vaultRoot });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: vaultRoot });

    const now = new Date('2026-10-12T00:00:00Z');
    const result = backupVault(vaultRoot, { backupRoot, now });

    assert.equal(result.verified, true);
    assert.equal(result.manifest.gitBundleStatus, 'included');
    assert.equal(verifySnapshotIntegrity(result.snapshotDir), true);

    const relPaths = new Set(result.manifest.entries.map((e) => e.relPath));
    for (const expected of [
      'repo.bundle',
      'owner-state/PROMPTKIT.md',
      'owner-state/00-Private/SOUL.md',
      'owner-state/06-Resources/Guides/Local Guide.md',
      'owner-state/06-Resources/Articles/Clipped Article.md',
      'owner-state/99-Attachments/2026-10/diagram.png',
      'owner-state/docs/STATE.md',
      'owner-state/.obsidian/plugins/quickadd/data.json',
    ]) {
      assert.ok(relPaths.has(expected), `Expected backup manifest to contain ${expected}`);
    }

    // Exercise git bundle failure separately from "no git HEAD": existing snapshots must NOT be pruned
    const oldSnapshot = path.join(backupRoot, 'snapshot-2026-09-01_120000');
    fs.mkdirSync(oldSnapshot, { recursive: true });

    const failedRun = backupVault(vaultRoot, {
      backupRoot,
      now: new Date('2026-10-13T00:00:00Z'),
      gitExecutable: 'nonexistent-git-binary-for-f02-test',
      retention: { daily: 1, weekly: 1, monthly: 1 },
    });

    assert.equal(failedRun.manifest.hasGitBundle, false);
    assert.equal(failedRun.manifest.gitBundleStatus, 'failed');
    assert.deepEqual(failedRun.pruned, [], 'Pruning must be skipped when git bundle creation fails');
    assert.ok(fs.existsSync(oldSnapshot), 'Prior good snapshot must not be deleted on failed bundle run');
  } finally {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
    fs.rmSync(backupRoot, { recursive: true, force: true });
  }
});

test('F03 & F04: weekly-ai-summary uses ISO-8601 week-year naming and emits comment-free valid YAML frontmatter', () => {
  const { getIsoWeekParts } = weeklyAISummary;
  assert.equal(typeof getIsoWeekParts, 'function');

  // F04 executed examples from the audit
  const oct11 = getIsoWeekParts(new Date(2026, 9, 11)); // 2026-10-11 (Sunday)
  assert.equal(oct11.weekKey, '2026-W41');
  assert.equal(oct11.isoYear, 2026);
  assert.equal(oct11.isoWeek, 41);

  const jan1 = getIsoWeekParts(new Date(2027, 0, 1)); // 2027-01-01 (Friday in ISO 2026-W53)
  assert.equal(jan1.weekKey, '2026-W53');
  assert.equal(jan1.isoYear, 2026);
  assert.equal(jan1.isoWeek, 53);

  const dec29 = getIsoWeekParts(new Date(2025, 11, 29)); // 2025-12-29 (Monday in ISO 2026-W01)
  assert.equal(dec29.weekKey, '2026-W01');

  // F03: verify the bundle's template literal contains no `//` comments inside the frontmatter block
  // and declares `kind: weekly`
  const bundleSrc = fs.readFileSync(
    new URL('../weekly-ai-summary.js', import.meta.url),
    'utf8'
  );
  assert.ok(bundleSrc.includes('kind: weekly'), 'Weekly review template must declare kind: weekly');
  assert.ok(
    !bundleSrc.includes('// The exact window this run analysed'),
    'Generated YAML frontmatter must not contain JS // comment lines'
  );
});

test('F08: start-task-action filters out already-linked and completed cards across Obsidian and CLI modes', () => {
  const { selectEligibleStartTasks, resolveCliStartCandidate } = startTaskAction;
  const board = [
    '## Backlog',
    '- [ ] [#17](https://github.com/lowqualityloey/shelf/issues/17) Export personal library to JSON/CSV',
    '- [ ] Unlinked backlog card #priority/p2',
    '',
    '## To Do',
    '- [ ] Unlinked todo card #priority/p1',
    '',
    '## In Progress',
    '- [/] [#16](https://github.com/lowqualityloey/shelf/issues/16) Build book details view with notes editor #priority/p2',
    '- [/] Unlinked in-progress card',
    '',
    '## Done',
    '- [x] [#2](https://github.com/lowqualityloey/shelf/issues/2) Configure Tailwind CSS and design tokens ✅ 2026-09-06',
    '- [x] Completed unlinked task ✅ 2026-09-06',
  ].join('\n');

  const { tasks } = extractLocalKanbanTasks(board);
  const eligible = selectEligibleStartTasks(tasks);
  assert.deepEqual(
    eligible.map((t) => ({ title: t.title, priority: t.priority })),
    [
      { title: 'Unlinked backlog card', priority: 'P2' },
      { title: 'Unlinked todo card', priority: 'P1' },
    ]
  );

  // Already-linked card returns already-linked instead of creating a duplicate issue
  const linkedRes = resolveCliStartCandidate(tasks, 'Export personal library');
  assert.equal(linkedRes.status, 'already-linked');
  assert.equal(linkedRes.task.issueNumber, 17);

  // Completed unlinked card returns not-open
  const doneRes = resolveCliStartCandidate(tasks, 'Completed unlinked task');
  assert.equal(doneRes.status, 'not-open');

  // Eligible card returns eligible
  const okRes = resolveCliStartCandidate(tasks, 'Unlinked todo card');
  assert.equal(okRes.status, 'eligible');
});

test('R01: overlapping clearCaptureDump runs serialize safely and never lose a capture from both dump and archive', async () => {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const archivePath = `00-Inbox/Archives/Quick Capture Archive ${yearMonth}.md`;

  const { app, files } = makeMockVault({
    [DUMP_PATH]: '# Quick Capture Dump\n\n- capture A #ref\n',
    [archivePath]: `---\ntype: archive\n---\n\n# 📦 Quick Capture Archive — ${yearMonth}\n`,
  });

  // Pause Run A right when it writes to the archive, while Capture B arrives and Run B is triggered concurrently
  let releaseRunA;
  const runAPaused = new Promise((resolve) => {
    releaseRunA = resolve;
  });
  let pausedOnce = false;
  const origProcess = app.vault.process;

  app.vault.process = async (file, fn) => {
    if (file.path === archivePath && !pausedOnce) {
      pausedOnce = true;
      // Capture B arrives while Run A is in flight
      files.set(DUMP_PATH, `${files.get(DUMP_PATH)}- capture B #do\n`);
      await runAPaused;
    }
    return origProcess(file, fn);
  };

  const runAPromise = clearCaptureDump({ app });
  // Trigger overlapping Run B while Run A is paused mid-archive
  const runBPromise = clearCaptureDump({ app });

  releaseRunA();
  await Promise.all([runAPromise, runBPromise]);

  const finalArchive = files.get(archivePath);
  const finalDump = files.get(DUMP_PATH);

  assert.ok(finalArchive.includes('- capture A #ref'), 'Capture A must be preserved in the archive');
  assert.ok(
    finalArchive.includes('- capture B #do') || finalDump.includes('- capture B #do'),
    'Capture B must never be lost from both the archive and the dump'
  );
  assert.ok(finalArchive.includes('- capture B #do'), 'Serialized Run B must archive Capture B');
});

test('R02: editing any part of a multiline capture block during archiving preserves the entire block intact', async () => {
  const initialDump = [
    '# 📥 Quick Capture Dump',
    '',
    '> Quick capture thoughts, links, and temporary notes.',
    '',
    '## Captured Notes',
    '',
    '- untouched multiline #ref',
    '  - untouched detail line',
    '- parent headline to edit #concept',
    '  - important detail that must survive',
    '- parent with detail to edit #dev',
    '  - detail before edit',
    '- parent with continuation appended #do',
    '  - existing child detail',
    '',
  ].join('\n');

  const { app, files } = makeMockVault({
    [DUMP_PATH]: initialDump,
  });

  const realCreate = app.vault.create;
  app.vault.create = async (p, content) => {
    await app.vault.process(app.vault.getAbstractFileByPath(DUMP_PATH), (cur) =>
      cur
        .replace('- parent headline to edit #concept', '- edited headline #concept')
        .replace('  - detail before edit', '  - detail after edit')
        .replace(
          '- parent with continuation appended #do\n  - existing child detail',
          '- parent with continuation appended #do\n  - existing child detail\n  - newly added continuation'
        )
    );
    return realCreate(p, content);
  };

  await clearCaptureDump({ app });

  const afterDump = files.get(DUMP_PATH);

  // Unchanged multiline block is removed
  assert.ok(!afterDump.includes('- untouched multiline #ref'));
  assert.ok(!afterDump.includes('  - untouched detail line'));

  // 1. Parent line edited -> both edited parent and unchanged child detail survive
  assert.ok(
    afterDump.includes('- edited headline #concept\n  - important detail that must survive'),
    'Editing parent headline must keep its unchanged detail lines intact'
  );

  // 2. Nested detail edited -> both unchanged parent and edited detail survive
  assert.ok(
    afterDump.includes('- parent with detail to edit #dev\n  - detail after edit'),
    'Editing nested detail must keep its parent and updated detail intact'
  );

  // 3. Continuation line appended -> full block survives
  assert.ok(
    afterDump.includes(
      '- parent with continuation appended #do\n  - existing child detail\n  - newly added continuation'
    ),
    'Appending a continuation line must keep the entire multiline block intact'
  );
});

test('R03: generated RESTORE.md commands execute cleanly and restore both ignored files and uncommitted tracked file edits', () => {
  const vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-r03-vault-'));
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-r03-backups-'));
  const restoreParent = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-r03-restore-'));

  try {
    // 1. Create and commit initial tracked files
    const guideRel = '06-Resources/Guides/Local Guide.md';
    fs.mkdirSync(path.join(vaultRoot, path.dirname(guideRel)), { recursive: true });
    fs.writeFileSync(path.join(vaultRoot, 'Home.md'), '# Home\n', 'utf8');
    fs.writeFileSync(path.join(vaultRoot, guideRel), '# Local Guide v1 (committed)\n', 'utf8');

    execFileSync('git', ['init', '-q'], { cwd: vaultRoot });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: vaultRoot });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: vaultRoot });
    execFileSync('git', ['add', 'Home.md', guideRel], { cwd: vaultRoot });
    execFileSync('git', ['commit', '-q', '-m', 'initial commit'], { cwd: vaultRoot });

    // 2. Modify tracked guide in working tree (uncommitted) and add ignored owner files
    fs.writeFileSync(path.join(vaultRoot, guideRel), '# Local Guide v2 (uncommitted working copy)\n', 'utf8');
    fs.writeFileSync(path.join(vaultRoot, 'memory.md'), '# Core Memory\n', 'utf8');
    fs.writeFileSync(path.join(vaultRoot, '.env'), 'TEST_KEY=123\n', 'utf8');

    const result = backupVault(vaultRoot, {
      backupRoot,
      now: new Date('2026-10-12T12:00:00Z'),
    });

    const restoreMd = fs.readFileSync(path.join(result.snapshotDir, 'RESTORE.md'), 'utf8');
    const bashBlocks = [...restoreMd.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1].trim());
    assert.ok(bashBlocks.length >= 3, 'RESTORE.md must contain executable bash blocks for steps 1-3');

    // Execute Step 1 (integrity), Step 2 (git clone), and Step 3 (overlay owner-state) in a single shell
    const restoreTarget = path.join(restoreParent, 'loey_space_restored');
    const script = [
      'set -euo pipefail',
      bashBlocks[0],
      bashBlocks[1],
      bashBlocks[2],
    ].join('\n');

    execFileSync('bash', ['-c', script], {
      cwd: result.snapshotDir,
      env: { ...process.env, RESTORE_DIR: restoreTarget },
      stdio: 'pipe',
    });

    assert.equal(
      fs.readFileSync(path.join(restoreTarget, 'memory.md'), 'utf8'),
      '# Core Memory\n',
      'Ignored owner file must be restored'
    );
    assert.equal(
      fs.readFileSync(path.join(restoreTarget, '.env'), 'utf8'),
      'TEST_KEY=123\n',
      'Ignored .env file must be restored'
    );
    assert.equal(
      fs.readFileSync(path.join(restoreTarget, guideRel), 'utf8'),
      '# Local Guide v2 (uncommitted working copy)\n',
      'Saved working-tree edit in owner-state must overwrite older committed version from repo.bundle'
    );
  } finally {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
    fs.rmSync(backupRoot, { recursive: true, force: true });
    fs.rmSync(restoreParent, { recursive: true, force: true });
  }
});

test('R04: editing a multiline capture with a blank line separating parent and indented details preserves the entire block', async () => {
  const initialDump = [
    '# 📥 Quick Capture Dump',
    '',
    '> Quick capture thoughts, links, and temporary notes.',
    '',
    '## Captured Notes',
    '',
    '- untouched blank-separated parent #ref',
    '',
    '  - untouched blank-separated detail',
    '',
    '- headline before edit #concept',
    '',
    '  - important detail separated by blank line',
    '',
  ].join('\n');

  const { app, files } = makeMockVault({
    [DUMP_PATH]: initialDump,
  });

  const realCreate = app.vault.create;
  app.vault.create = async (p, content) => {
    await app.vault.process(app.vault.getAbstractFileByPath(DUMP_PATH), (cur) =>
      cur.replace('- headline before edit #concept', '- headline after edit #concept')
    );
    return realCreate(p, content);
  };

  await clearCaptureDump({ app });

  const afterDump = files.get(DUMP_PATH);

  // Untouched blank-separated block is removed cleanly
  assert.ok(!afterDump.includes('- untouched blank-separated parent #ref'));
  assert.ok(!afterDump.includes('  - untouched blank-separated detail'));

  // Edited blank-separated block retains both its edited parent and its unchanged detail
  assert.ok(
    afterDump.includes('- headline after edit #concept\n\n  - important detail separated by blank line'),
    'Blank-separated detail line must survive when its parent headline is edited during archiving'
  );
});

test('R05: separately evaluated QuickAdd script instances share the per-vault serialization queue and do not duplicate captures', async () => {
  const bundleCode = fs.readFileSync(
    new URL('../clear-capture-dump.js', import.meta.url),
    'utf8'
  );
  function loadQuickAddInstance() {
    const mod = { exports: {} };
    const fn = new Function('require', 'module', 'exports', bundleCode);
    fn(() => ({}), mod, mod.exports);
    return mod.exports;
  }

  const instanceA = loadQuickAddInstance();
  const instanceB = loadQuickAddInstance();

  const yearMonth = new Date().toISOString().slice(0, 7);
  const archivePath = `00-Inbox/Archives/Quick Capture Archive ${yearMonth}.md`;

  const { app, files } = makeMockVault({
    [DUMP_PATH]: '# Quick Capture Dump\n\n- capture A #ref\n',
    [archivePath]: `---\ntype: archive\n---\n\n# 📦 Quick Capture Archive — ${yearMonth}\n`,
  });

  let releaseRunA;
  const runAPaused = new Promise((resolve) => {
    releaseRunA = resolve;
  });
  let pausedOnce = false;
  const origProcess = app.vault.process;

  app.vault.process = async (file, fn) => {
    if (file.path === archivePath && !pausedOnce) {
      pausedOnce = true;
      files.set(DUMP_PATH, `${files.get(DUMP_PATH)}- capture B #do\n`);
      await runAPaused;
    }
    return origProcess(file, fn);
  };

  const runA = instanceA({ app });
  const runB = instanceB({ app });

  releaseRunA();
  await Promise.all([runA, runB]);

  const finalArchive = files.get(archivePath);
  const countA = finalArchive.split('- capture A #ref').length - 1;
  const countB = finalArchive.split('- capture B #do').length - 1;

  assert.equal(countA, 1, 'Capture A must be archived exactly once across separately loaded QuickAdd instances');
  assert.equal(countB, 1, 'Capture B must be archived exactly once');
});


