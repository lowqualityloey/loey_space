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

test('Heyloey Agent Alignment: fresh-clone safe instruction check (tracked files + sanitized fixtures, plus owner-local check when present)', () => {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

  function verifyTrackedInstructions({ agentsMd, distillerSkill, habitSkill }) {
    assert.ok(agentsMd.includes('00-Private/SOUL.md'), 'AGENTS.md startup instructions must reference 00-Private/SOUL.md');
    assert.ok(
      agentsMd.includes('06-Resources/scripts/tests/daily-carry-forward.test.mjs'),
      'AGENTS.md must cite the actual daily-carry-forward.test.mjs test file'
    );
    assert.ok(
      !agentsMd.includes('daily-task-carryover.test.mjs'),
      'AGENTS.md must not cite nonexistent daily-task-carryover.test.mjs'
    );
    assert.ok(
      agentsMd.includes('Three-Commitment Triage') &&
        agentsMd.includes('propose the top $\\le 3$ commitments for today') &&
        agentsMd.includes('05-Personal/'),
      'AGENTS.md must enforce the 3-commitment daily selection cap and appropriate homes for deferred tasks'
    );
    assert.ok(
      agentsMd.includes('Milestone-Only Logging Policy (Autonomous Anti-Noise)') &&
        agentsMd.includes('Explicit User Request (`heyloey log` / direct ask)'),
      'AGENTS.md must scope milestone-only filtering to autonomous logging while honoring explicit requests'
    );
    assert.ok(
      agentsMd.includes('textual `mood`') &&
        agentsMd.includes('free-form text with a suggested vocabulary') &&
        habitSkill.includes('free-form text with a suggested vocabulary'),
      'AGENTS.md and habit-trend-analyzer must describe mood as free-form text with a suggested vocabulary'
    );
    assert.ok(
      agentsMd.includes('Proportionate Approval (Propose-First vs. Explicit Request)') &&
        distillerSkill.includes('Proportionate Approval Gate') &&
        distillerSkill.includes('Propose-First'),
      'AGENTS.md and vault-concept-distiller must enforce Propose-First for autonomous sweeps and direct execution for explicit requests'
    );
    assert.ok(
      habitSkill.includes('observed_days / window_days') &&
        habitSkill.includes('Unobserved / Pending Notes vs. Missed Habits') &&
        habitSkill.includes('completed_days / observed_days') &&
        habitSkill.includes('completed_habit_checks / (6 * observed_days)') &&
        habitSkill.includes('consecutive calendar days'),
      'habit-trend-analyzer skill must report observation coverage, distinguish unobserved scaffolded notes from missed habits, define per-habit and 6x overall denominators, and require consecutive calendar days'
    );
    assert.ok(
      agentsMd.includes('Decision-Oriented Briefing Standard'),
      'AGENTS.md must define the Decision-Oriented Briefing Standard'
    );
  }

  function verifyOwnerLocalOverlays({ geminiMd, soulMd }) {
    assert.ok(geminiMd.includes('AGENTS.md'), 'GEMINI.md must reference AGENTS.md for Chief-of-Staff routing');
    assert.ok(geminiMd.includes('00-Private/SOUL.md'), 'GEMINI.md must reference 00-Private/SOUL.md for Kiwi persona');
    assert.ok(
      soulMd.includes('at most **3 active commitments**') &&
        soulMd.includes('05-Personal/') &&
        soulMd.includes('free-form text') &&
        soulMd.includes('Milestone-Only Logging') &&
        soulMd.includes('explicitly asks to log') &&
        soulMd.includes('Decision-Oriented Briefings'),
      'SOUL.md must align with AGENTS.md on 3-commitment cap, appropriate homes, free-form mood, autonomous milestone-only logging, and decision-oriented briefings'
    );
  }

  function runAlignmentCheckForRoot(rootDir, fallbackOverlays) {
    const agentsMd = fs.readFileSync(path.join(rootDir, 'AGENTS.md'), 'utf8');
    const distillerSkill = fs.readFileSync(
      path.join(rootDir, '.agents/skills/vault-concept-distiller/SKILL.md'),
      'utf8'
    );
    const habitSkill = fs.readFileSync(
      path.join(rootDir, '.agents/skills/habit-trend-analyzer/SKILL.md'),
      'utf8'
    );
    verifyTrackedInstructions({ agentsMd, distillerSkill, habitSkill });

    const geminiPath = path.join(rootDir, 'GEMINI.md');
    const soulPath = path.join(rootDir, '00-Private/SOUL.md');
    const geminiMd = fs.existsSync(geminiPath) ? fs.readFileSync(geminiPath, 'utf8') : fallbackOverlays.geminiMd;
    const soulMd = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, 'utf8') : fallbackOverlays.soulMd;
    verifyOwnerLocalOverlays({ geminiMd, soulMd });
  }

  const sanitizedOverlays = {
    geminiMd: [
      '# 🧠 `loey_space` — Chief of Staff & Engineering Routing',
      '- Follow [`AGENTS.md`](AGENTS.md) and [`00-Private/SOUL.md`](00-Private/SOUL.md).',
    ].join('\n'),
    soulMd: [
      '# 🥝 Kiwi (`SOUL.md`)',
      '1. **Morning Triage**: select at most **3 active commitments**; route deferred tasks to `02-Projects/<name>/<name> Kanban.md` or `05-Personal/`.',
      '2. **Habit Check & Vitals**: Log `mood` as free-form text with a suggested vocabulary.',
      '3. **Milestone-Only Logging**: For autonomous logging, log only milestones; when the owner explicitly asks to log a discussion, honor it.',
      '4. **Decision-Oriented Briefings**: 1 clear next action, blockers, <= 3 commitments.',
    ].join('\n'),
  };

  // 1. Simulate a fresh public clone where git-ignored GEMINI.md and 00-Private/SOUL.md do NOT exist on disk
  const freshCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-fresh-clone-'));
  try {
    fs.copyFileSync(path.join(repoRoot, 'AGENTS.md'), path.join(freshCloneDir, 'AGENTS.md'));
    fs.mkdirSync(path.join(freshCloneDir, '.agents/skills/vault-concept-distiller'), { recursive: true });
    fs.mkdirSync(path.join(freshCloneDir, '.agents/skills/habit-trend-analyzer'), { recursive: true });
    fs.copyFileSync(
      path.join(repoRoot, '.agents/skills/vault-concept-distiller/SKILL.md'),
      path.join(freshCloneDir, '.agents/skills/vault-concept-distiller/SKILL.md')
    );
    fs.copyFileSync(
      path.join(repoRoot, '.agents/skills/habit-trend-analyzer/SKILL.md'),
      path.join(freshCloneDir, '.agents/skills/habit-trend-analyzer/SKILL.md')
    );

    assert.equal(fs.existsSync(path.join(freshCloneDir, 'GEMINI.md')), false);
    assert.equal(fs.existsSync(path.join(freshCloneDir, '00-Private/SOUL.md')), false);
    runAlignmentCheckForRoot(freshCloneDir, sanitizedOverlays);
  } finally {
    fs.rmSync(freshCloneDir, { recursive: true, force: true });
  }

  // 2. Run against the actual workspace root (uses live GEMINI.md and 00-Private/SOUL.md when present locally)
  runAlignmentCheckForRoot(repoRoot, sanitizedOverlays);
});

test('Heyloey Executable Behavior: analyzeHabitTrends and triageDailyCommitments enforce coverage, denominators, calendar continuity, and 3-commitment routing', async () => {
  const {
    extractDailyData,
    analyzeHabitTrends,
    triageDailyCommitments,
  } = await import('../src/lib/weekly-extract.ts');

  function makeDailyNote(date, { mood = '', energy = '', sleep = '', habits = [], focus = [] } = {}) {
    const habitLines = ['water', 'prioritised', 'move', 'read', 'tidy', 'disconnect'].map(
      (h) => `- [${habits.includes(h) ? 'x' : ' '}] ${h}`
    );
    const focusLines = focus.map((f) => `- ${f}`);
    return {
      date,
      content: [
        '---',
        `created: ${date}`,
        `updated: ${date}`,
        'type: daily',
        'area: personal',
        `mood: ${mood}`,
        `energy: ${energy}`,
        `sleep_hours: ${sleep}`,
        '---',
        '',
        '### 🎯 Today\'s Focus',
        ...focusLines,
        '',
        '### 🔁 Habits',
        ...habitLines,
        '',
      ].join('\n'),
    };
  }

  // 4 observed check-in notes + 1 morning-only note + 1 untouched scaffolded note in a 7-day window (1 missing date)
  const rawNotes = [
    makeDailyNote('2026-10-05', { mood: 'tired', energy: '2', sleep: '5.5', habits: ['water', 'prioritised', 'move'] }),
    makeDailyNote('2026-10-07', { mood: 'stressed', energy: '2', sleep: '5.8', habits: ['water', 'prioritised', 'read', 'tidy'] }),
    makeDailyNote('2026-10-09', { mood: 'exhausted', energy: '2', sleep: '5.5', habits: ['water', 'move'] }),
    makeDailyNote('2026-10-10', { mood: 'focused', energy: '4', sleep: '7.5', habits: ['water', 'prioritised', 'move', 'read', 'tidy', 'disconnect'] }),
    // Untouched scaffolded note on 2026-10-11: all habits `- [ ]` and blank vitals -> unobserved, NOT 0/6 failed
    makeDailyNote('2026-10-11', {}),
    // Morning-only note on 2026-10-12: morning vitals + focus + auto-checked `prioritised`, no evening review yet -> unobserved for habit review, NOT 1/6 (17%)
    makeDailyNote('2026-10-12', { mood: 'focused', energy: '4', sleep: '7.5', habits: ['prioritised'], focus: ['Ship audit fixes'] }),
  ];

  // Explicit check of the exact case ChatGPT reproduced: a single morning-only note (with and without pendingTodayDate)
  const morningOnlyEntry = extractDailyData(rawNotes[5].content, rawNotes[5].date);
  for (const opts of [undefined, { pendingTodayDate: '2026-10-12' }]) {
    const morningReport = analyzeHabitTrends([morningOnlyEntry], 7, opts);
    assert.equal(
      morningReport.observedDays,
      0,
      'A note with only morning vitals and auto-checked prioritised must NOT count as a completed habit review day'
    );
    assert.equal(morningReport.unobservedNotes, 1);
    assert.equal(morningReport.overall.observedOpportunities, 0);
    assert.equal(morningReport.overall.rate, null, 'Morning-only note must not report 17% (1/6) habit completion');
  }

  const entries = rawNotes.map((n) => extractDailyData(n.content, n.date));
  const report = analyzeHabitTrends(entries, 7);

  assert.equal(report.observedDays, 4, 'Only the 4 habit-reviewed notes count as observed');
  assert.equal(report.unobservedNotes, 2, 'Both untouched scaffold and morning-only note must be classified as unobserved');
  assert.equal(report.missingDays, 1, '1 date in the 7-day window had no file');
  assert.equal(report.coverage, '4/7');

  // Per-habit rate uses observedDays (4) as denominator: water was completed on all 4 observed days -> 4/4 = 1.0
  assert.deepEqual(report.perHabit.water, { completedDays: 4, observedDays: 4, rate: 1 });
  // Overall rate uses 6 * observedDays (24) as denominator: 3 + 4 + 2 + 6 = 15 checks / 24 opportunities = 0.63
  assert.deepEqual(report.overall, {
    completedChecks: 15,
    observedOpportunities: 24,
    rate: 0.63,
  });

  // Burnout continuity: 2026-10-05, 2026-10-07, and 2026-10-09 all had energy=2, but had missing dates between them!
  assert.equal(
    report.burnoutRisk.flagged,
    false,
    'Non-adjacent low-energy notes separated by missing dates must not trigger a 3-consecutive-calendar-day burnout flag'
  );
  assert.equal(report.burnoutRisk.maxConsecutiveCalendarDays, 1);

  // Now test 3 consecutive calendar days of low energy/sleep (2026-10-08, 2026-10-09, 2026-10-10) — even if only morning vitals were logged!
  const consecutiveEntries = [
    makeDailyNote('2026-10-08', { mood: 'tired', energy: '2', sleep: '5.5', habits: ['prioritised'] }),
    makeDailyNote('2026-10-09', { mood: 'stressed', energy: '2', sleep: '5.5', habits: ['prioritised'] }),
    makeDailyNote('2026-10-10', { mood: 'custom-drained-word', energy: '2', sleep: '5.0', habits: ['prioritised'] }),
  ].map((n) => extractDailyData(n.content, n.date));

  const burnoutReport = analyzeHabitTrends(consecutiveEntries, 7);
  assert.equal(burnoutReport.burnoutRisk.flagged, true, '3 consecutive calendar days of morning energy <= 2 must flag burnout');
  assert.equal(burnoutReport.burnoutRisk.maxConsecutiveCalendarDays, 3);
  assert.deepEqual(burnoutReport.burnoutRisk.streakDates, ['2026-10-08', '2026-10-09', '2026-10-10']);
  assert.equal(burnoutReport.tentative, true, '< 4 observed habit-review days must be marked tentative');

  // Test end-to-end production execution of weeklyAISummary({ app }) writing 07-Reviews/YYYY-WXX.md
  const { buildWeeklyWindow } = await import('../src/lib/weekly-window.ts');
  const liveWindow = buildWeeklyWindow(new Date());
  const windowDates = liveWindow.dateKeys; // 7 dates in the current review window
  const vaultFiles = {};
  // Populate 4 habit-reviewed notes, 1 untouched scaffold, 1 morning-only note (and leave 1 date missing)
  vaultFiles[`01-Daily/${windowDates[0].slice(0, 7)}/${windowDates[0]}.md`] = makeDailyNote(windowDates[0], {
    mood: 'focused',
    energy: '4',
    sleep: '7.5',
    habits: ['water', 'prioritised', 'move'],
  }).content;
  vaultFiles[`01-Daily/${windowDates[1].slice(0, 7)}/${windowDates[1]}.md`] = makeDailyNote(windowDates[1], {
    mood: 'good',
    energy: '4',
    sleep: '7.0',
    habits: ['water', 'prioritised', 'read', 'tidy'],
  }).content;
  vaultFiles[`01-Daily/${windowDates[2].slice(0, 7)}/${windowDates[2]}.md`] = makeDailyNote(windowDates[2], {
    mood: 'calm',
    energy: '3',
    sleep: '6.8',
    habits: ['water', 'move'],
  }).content;
  vaultFiles[`01-Daily/${windowDates[3].slice(0, 7)}/${windowDates[3]}.md`] = makeDailyNote(windowDates[3], {
    mood: 'focused',
    energy: '5',
    sleep: '8.0',
    habits: ['water', 'prioritised', 'move', 'read', 'tidy', 'disconnect'],
  }).content;
  vaultFiles[`01-Daily/${windowDates[4].slice(0, 7)}/${windowDates[4]}.md`] = makeDailyNote(windowDates[4], {}).content;
  vaultFiles[`01-Daily/${windowDates[5].slice(0, 7)}/${windowDates[5]}.md`] = makeDailyNote(windowDates[5], {
    mood: 'focused',
    energy: '4',
    sleep: '7.5',
    habits: ['prioritised'],
    focus: ['Morning focus only'],
  }).content;

  const { app, files } = makeMockVault(vaultFiles);
  app.vault.getMarkdownFiles = () =>
    [...files.keys()].map((p) => ({
      path: p,
      name: path.basename(p),
      basename: path.basename(p, '.md'),
    }));
  app.vault.adapter = {
    read: async (p) => (p === '.env' ? 'GEMINI_API_KEY=test-stub\n' : ''),
  };

  const origNotice = globalThis.Notice;
  const origRequestUrl = globalThis.requestUrl;
  let capturedPrompt = '';
  globalThis.Notice = function () {};
  globalThis.requestUrl = async (req) => {
    const parsedBody = JSON.parse(req.body);
    capturedPrompt = parsedBody.contents[0].parts[0].text;
    return {
      status: 200,
      text: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    weeklyTitle: 'Steady Execution',
                    executiveSummary: 'Solid 4-day observed habit run.',
                    keyAccomplishments: ['Completed audit'],
                    challengesFaced: ['None'],
                    productivityPatterns: ['Consistent mornings'],
                    moodEnergyTrends: ['Stable energy'],
                    habitAnalysis: ['15/24 checks across 4 observed days'],
                    topInsights: ['Keep momentum'],
                    recommendations: ['Maintain sleep'],
                    weeklyQuote: 'Stay steady.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    };
  };

  try {
    await weeklyAISummary({ app });
    const createdReviewEntry = [...files.entries()].find(([k]) => k.startsWith('07-Reviews/') && k.endsWith('.md'));
    assert.ok(createdReviewEntry, 'weeklyAISummary must create a 07-Reviews/YYYY-WXX.md note');
    const [, reviewContent] = createdReviewEntry;
    assert.ok(
      reviewContent.includes('**Habit review coverage**: 4/7 day(s) with completed habit review; 15/24 habit checks (63%); 2 morning-only/unobserved note(s) excluded from denominator; 1 unlogged day(s)'),
      'Generated weekly review note must contain the evidence-proportional habit coverage summary'
    );
    assert.ok(
      reviewContent.includes('**Per-habit completion (over 4 observed day(s))**: `water` 4/4 (100%)'),
      'Generated weekly review note must include per-habit rates over observed days'
    );
    assert.ok(
      capturedPrompt.includes('"observedOpportunities": 24') && capturedPrompt.includes('"unobservedNotes": 2'),
      'Gemini prompt must receive the computed habitTrends from summarizeWeek'
    );

    // Verify the generated live Dataview/DataviewJS blocks use reviewWindow.startDate..endDate (7 days, not today - 7d = 8 days)
    // and use the exact same observation rule (including evening reflection with only `prioritised` checked).
    assert.ok(
      reviewContent.includes(`WHERE file.day >= date(${liveWindow.startDate}) AND file.day <= date(${liveWindow.endDate})`),
      'Daily Notes Dataview query must use reviewWindow.startDate..endDate instead of 8-day dur(7 days)'
    );

    const dvJsBlocks = [...reviewContent.matchAll(/```dataviewjs\n([\s\S]*?)```/g)].map((m) => m[1]);
    assert.equal(dvJsBlocks.length, 2, 'Weekly review must contain Task and Habit dataviewjs blocks');
    const habitDvJs = dvJsBlocks[1];

    // Execute the generated Habit Consistency dataviewjs block against a mock dv environment containing:
    // 1. An 8th day just before startDate (must be excluded by the window filter)
    // 2. A day inside the window where only `prioritised` was checked AND an evening reflection was logged (must count as 1 observed day, 1/6 = 17%)
    // 3. A morning-only day inside the window where only `prioritised` was checked and NO evening reflection was logged (must be excluded)
    const dayBeforeStart = '1999-01-01';
    const mockPages = [
      {
        file: {
          day: dayBeforeStart,
          tasks: [{ text: 'water', completed: true, status: 'x', header: { subpath: '🔁 Habits' } }],
          lists: [],
        },
      },
      {
        file: {
          day: liveWindow.startDate,
          tasks: [
            { text: 'prioritised', completed: true, status: 'x', header: { subpath: '🔁 Habits' } },
            { text: 'water', completed: false, status: ' ', header: { subpath: '🔁 Habits' } },
          ],
          lists: [
            { text: 'Shipped audit fixes', task: false, header: { subpath: 'Wins' } },
          ],
        },
      },
      {
        file: {
          day: liveWindow.endDate,
          tasks: [
            { text: 'prioritised', completed: true, status: 'x', header: { subpath: '🔁 Habits' } },
            { text: 'water', completed: false, status: ' ', header: { subpath: '🔁 Habits' } },
          ],
          lists: [
            { text: '', task: false, header: { subpath: 'Wins' } },
          ],
        },
      },
    ];

    let renderedParagraph = '';
    const mockDv = {
      date: (s) => s,
      pages: () => ({
        where: (fn) => mockPages.filter(fn),
      }),
      paragraph: (text) => {
        renderedParagraph = text;
      },
    };

    new Function('dv', habitDvJs)(mockDv);
    assert.equal(
      renderedParagraph,
      '**Live Habit Completion Rate**: 17% (1/6 habit opportunities across 1 observed day(s))',
      'Live DataviewJS block must exclude the 8th day outside reviewWindow, exclude the morning-only note, and count the evening-reflected day as 1/6 (17%) matching the saved summary'
    );
  } finally {
    globalThis.Notice = origNotice;
    globalThis.requestUrl = origRequestUrl;
  }

  // Test 3-commitment morning triage & appropriate homes for deferred tasks
  const carriedTasks = [
    '- [ ] Buy groceries and renew gym pass #personal #priority/p2',
    '- [/] Finish vault audit follow-up #priority/p1',
    '- [ ] Refactor shelf book details editor [[shelf Kanban]] #priority/p2',
    '- [ ] Fix critical security hook #priority/p0',
    '- [ ] Clean up desktop downloads folder #priority/p3',
  ];

  const triage = triageDailyCommitments(carriedTasks, 3);
  assert.equal(triage.selected.length, 3, 'At most 3 active commitments are selected for today');
  assert.equal(triage.deferred.length, 2, 'Remaining tasks are preserved and routed to their homes');
  assert.ok(
    triage.selected.includes('- [/] Finish vault audit follow-up #priority/p1') &&
      triage.selected.includes('- [ ] Fix critical security hook #priority/p0'),
    'In-progress and P0 tasks are prioritized into the 3 selected commitments'
  );

  // Verify deferred tasks route to their appropriate homes (personal -> 05-Personal/, standalone -> 01-Daily/Tasks Kanban.md, project -> 02-Projects/<name>/<name> Kanban.md)
  const deferredProject = triageDailyCommitments(
    [
      '- [ ] Task 1 #priority/p0',
      '- [ ] Task 2 #priority/p0',
      '- [ ] Task 3 #priority/p0',
      '- [ ] Project card [[shelf Kanban]] #priority/p2',
      '- [ ] Personal chore #personal #priority/p2',
      '- [ ] Standalone task #priority/p3',
    ],
    3
  );
  assert.deepEqual(deferredProject.deferred, [
    {
      task: '- [ ] Project card [[shelf Kanban]] #priority/p2',
      destinationKind: 'project',
      destination: '02-Projects/shelf/shelf Kanban.md',
    },
    {
      task: '- [ ] Personal chore #personal #priority/p2',
      destinationKind: 'personal',
      destination: '05-Personal/',
    },
    {
      task: '- [ ] Standalone task #priority/p3',
      destinationKind: 'standalone',
      destination: '01-Daily/Tasks Kanban.md',
    },
  ]);
});

