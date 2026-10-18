import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPlan, parseOptions } from '../reconcile-github-milestones.mjs';
import {
  validateConfig, validateState, scanSince, localStamp, normalizePullRequest,
  milestoneSummary, recordContains, requireReceipt, reconcileMilestones
} from '../github-milestone-reconciliation.mjs';

const config = validateConfig({
  schemaVersion: 1, repositories: ['owner/project'], timeZone: 'Pacific/Auckland',
  startFrom: '2026-10-14T11:00:00Z'
});
const through = '2026-10-15T00:00:00Z';
const raw = (number = 638) => ({
  number, merged: true, title: 'Clarify portable CLI selection',
  html_url: 'https://github.com/owner/project/pull/' + number,
  merged_at: '2026-10-14T20:34:02Z', merge_commit_sha: 'a'.repeat(40)
});
const pr = normalizePullRequest('owner/project', raw());

function fixture() {
  const files = {
    daily: '---\nmood: calm\nenergy: 3\n---\n## 📝 Daily Log\n\n## 🌇 End of the Day...\n- Keep reflection.\n',
    handoff: '# Handoff\n### Latest Updates\n\n### Immediate Next Moves\n- Keep next move.\n',
    archive: ''
  };
  const calls = [];
  let saved;
  const io = {
    root: '/fixture/vault',
    inspect(candidate, receipt, allowShortScope) {
      return {
        daily: recordContains(files.daily, candidate, 'daily', allowShortScope),
        handoff: recordContains(files.handoff, candidate, 'handoff', allowShortScope) || recordContains(files.archive, candidate, 'archive', allowShortScope),
        dailyPath: '01-Daily/2026-10/2026-10-15.md'
      };
    },
    requireRecords() {
      if (!files.daily.includes('## 📝 Daily Log') || !files.handoff.includes('### Latest Updates')) throw new Error('Missing records');
    },
    log(command, summary) {
      calls.push(command);
      if (command === 'done' || command === 'log') files.daily = files.daily.replace('## 📝 Daily Log\n', '## 📝 Daily Log\n- **10:00**: ' + summary + '\n');
      if (command === 'done' || command === 'handoff') files.handoff = files.handoff.replace('### Latest Updates\n', '### Latest Updates\n- [x] **[2026-10-15 10:00]** ' + summary + '\n');
      return 'RESULT ' + command + ' logged lock=flock target=/fixture/vault source=LOEY_SPACE_DIR verified=daily+handoff';
    },
    saveState(value) { saved = structuredClone(value); }
  };
  const run = (state = null, pullRequests = [pr], cfg = config) => reconcileMilestones({ config: cfg, state, pullRequests, through }, io);
  return { files, calls, io, run, saved: () => saved };
}

test('Auckland date and time cross the UTC day correctly', () => {
  assert.deepEqual(localStamp('2026-10-14T20:34:02Z', 'Pacific/Auckland'), { date: '2026-10-15', time: '09:34' });
});

test('one merged PR writes both records and verifies before checkpointing', () => {
  const f = fixture();
  const result = f.run();
  assert.equal(result.logged, 1);
  assert.deepEqual(f.calls, ['done']);
  assert.ok(f.saved().receipts[pr.url]);
  assert.equal(f.saved().scans['owner/project'], through);
  assert.ok(f.files.daily.includes('mood: calm\nenergy: 3'));
  assert.ok(f.files.daily.includes('- Keep reflection.'));
  assert.ok(f.files.handoff.includes('- Keep next move.'));
});

test('repeat scans do not duplicate daily or handoff records', () => {
  const f = fixture();
  const first = f.run();
  const before = structuredClone(f.files);
  assert.equal(f.run(first.state).outcome, 'unchanged');
  assert.deepEqual(f.files, before);
  assert.deepEqual(f.calls, ['done']);
});

test('duplicate API items are reconciled once', () => {
  const f = fixture();
  assert.equal(f.run(null, [pr, pr]).logged, 1);
  assert.equal(f.calls.length, 1);
});

test('an existing agent merge summary is reused without another write', () => {
  const f = fixture();
  f.files.daily = '## 📝 Daily Log\n- **09:34**: [project/main] PR #638 merged, verified.\n';
  f.files.handoff = '### Latest Updates\n- [x] **[2026-10-15 09:34]** [project/main] PR #638 merged, verified.\n';
  assert.equal(f.run().alreadyRecorded, 1);
  assert.equal(f.calls.length, 0);
});

test('an opened PR does not stand in for a merged milestone', () => {
  const f = fixture();
  f.files.daily = '## 📝 Daily Log\n- **09:00**: [project/main] PR #638 opened.\n';
  assert.equal(f.run().logged, 1);
  assert.deepEqual(f.calls, ['done']);
});

test('a different PR merging does not suppress the requested merge', () => {
  const f = fixture();
  const text = '[owner/project] PR #638 opened; PR #639 merged.';
  f.files.daily = '## 📝 Daily Log\n- **09:00 AM**: ' + text + '\n';
  f.files.handoff = '### Latest Updates\n- [x] **[2026-10-15 09:00]** ' + text + '\n';
  assert.equal(f.run().logged, 1);
  assert.deepEqual(f.calls, ['done']);
});

test('negated, conditional and future merge statements are not merge evidence', () => {
  for (const text of ['PR #638 not merged', 'PR #638 was not merged', 'not merged PR #638', "PR #638 hasn't merged", 'PR #638 will be merged', 'if PR #638 merged', 'PR #638 merged?']) {
    assert.equal(recordContains('## 📝 Daily Log\n- **09:00 AM**: [owner/project] ' + text, pr, 'daily'), false, text);
  }
});

test('affirmative merge clauses keep their PR and repository identities together', () => {
  for (const text of ['[owner/project] PR #638 merged; PR #639 opened.', '[owner/project] PR #639 opened; PR #638 was merged.', '[other/project] PR #638 opened; [owner/project] merged PR #638.', '[owner/project] PR #638 has been merged.']) {
    assert.equal(recordContains('## 📝 Daily Log\n- **09:00 AM**: ' + text, pr, 'daily'), true, text);
  }
  assert.equal(recordContains('## 📝 Daily Log\n- **09:00 AM**: [owner/project] PR #638 opened; [other/project] PR #638 merged.', pr, 'daily'), false);
});

test('an existing daily entry repairs only the missing handoff entry', () => {
  const f = fixture();
  f.files.daily = '## 📝 Daily Log\n- **09:34**: [project/main] PR #638 merged.\n';
  const before = f.files.daily;
  f.run();
  assert.deepEqual(f.calls, ['handoff']);
  assert.equal(f.files.daily, before);
});

test('an existing handoff entry repairs only the missing daily entry', () => {
  const f = fixture();
  f.files.handoff = '### Latest Updates\n- [x] **[2026-10-15 09:34]** [project/main] PR #638 merged.\n';
  const before = f.files.handoff;
  f.run();
  assert.deepEqual(f.calls, ['log']);
  assert.equal(f.files.handoff, before);
});

test('handoff overflow into its archive still counts as recorded', () => {
  const f = fixture();
  const first = f.run();
  f.files.archive = f.files.handoff;
  f.files.handoff = '### Latest Updates\n';
  assert.equal(f.run(first.state).alreadyRecorded, 1);
  assert.deepEqual(f.calls, ['done']);
});

test('a partial logger failure can be retried without duplicating its first write', () => {
  const f = fixture();
  const original = f.io.log;
  f.io.log = (command, summary) => {
    f.files.daily = f.files.daily.replace('## 📝 Daily Log\n', '## 📝 Daily Log\n- **10:00**: ' + summary + '\n');
    throw new Error('Interrupted between record writes');
  };
  assert.throws(() => f.run(), /Interrupted/);
  assert.equal(f.saved(), undefined);
  const before = f.files.daily;
  f.io.log = original;
  f.run();
  assert.deepEqual(f.calls, ['handoff']);
  assert.equal(f.files.daily, before);
});

test('missing canonical records refuse without checkpointing', () => {
  const f = fixture();
  f.files.daily = '';
  assert.throws(() => f.run(), /Missing records/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.saved(), undefined);
});

test('exit-zero output without a RESULT receipt is not accepted', () => {
  assert.throws(() => requireReceipt('', 'done', '/fixture/vault'), /receipt/);
});

test('a receipt naming the wrong vault is rejected', () => {
  assert.throws(() => requireReceipt('RESULT done logged lock=flock target=/other source=LOEY_SPACE_DIR', 'done', '/fixture/vault'), /receipt/);
});

test('a success claim with unchanged records is rejected without checkpointing', () => {
  const f = fixture();
  f.io.log = () => 'RESULT done logged lock=flock target=/fixture/vault source=LOEY_SPACE_DIR';
  assert.throws(() => f.run(), /Post-write verification failed/);
  assert.equal(f.saved(), undefined);
});

test('a damaged previously verified receipt refuses rather than inventing a replacement', () => {
  const f = fixture();
  const first = f.run();
  f.files.daily = '## 📝 Daily Log\n';
  assert.throws(() => f.run(first.state), /Previously verified daily entry is absent/);
  assert.deepEqual(f.calls, ['done']);
});

test('records outside Daily Log or inside code fences do not satisfy deduplication', () => {
  assert.equal(recordContains('## 📝 Daily Log\n\n## Reflection\n- **10:00**: [project] PR #638 merged.\n', pr, 'daily'), false);
  assert.equal(recordContains('## 📝 Daily Log\n~~~\n- **10:00**: [project] PR #638 merged.\n~~~\n', pr, 'daily'), false);
});

test('different PR numbers and different repositories stay distinct', () => {
  assert.equal(recordContains('## 📝 Daily Log\n- **10:00**: [project] PR #6380 merged.\n', pr, 'daily'), false);
  assert.equal(recordContains('## 📝 Daily Log\n- **10:00**: [other/project] PR #638 merged.\n', pr, 'daily', false), false);
});

test('ambiguous short repository scopes are not treated as proof', () => {
  const f = fixture();
  f.files.daily = '## 📝 Daily Log\n- **09:34**: [project] PR #638 merged.\n';
  const cfg = validateConfig({ ...config, repositories: ['owner/project', 'other/project'] });
  f.run(null, [pr], cfg);
  assert.deepEqual(f.calls, ['done']);
});

test('unmerged and inconsistent API metadata cannot create milestones', () => {
  assert.equal(normalizePullRequest('owner/project', { ...raw(), merged: false }), null);
  assert.throws(() => normalizePullRequest('owner/project', { ...raw(), html_url: 'https://github.com/other/project/pull/638' }), /metadata/);
});

test('startFrom prevents historical backfill before the configured boundary', () => {
  const f = fixture();
  const old = normalizePullRequest('owner/project', { ...raw(), merged_at: '2026-10-13T20:00:00Z' });
  assert.equal(f.run(null, [old]).logged, 0);
  assert.equal(f.calls.length, 0);
});

test('checkpoints overlap one day while respecting the configured start', () => {
  const state = validateState(null);
  state.scans['owner/project'] = '2026-10-17T00:00:00Z';
  assert.equal(scanSince(config, state, 'owner/project'), '2026-10-16T00:00:00.000Z');
  assert.equal(scanSince(config, state, 'other/project'), '2026-10-14T11:00:00.000Z');
});

test('corrupt state is not silently reset', () => {
  assert.throws(() => validateState({ schemaVersion: 0, scans: {}, receipts: {} }), /checkpoint/);
});

test('conflicting metadata refuses before any record write', () => {
  const f = fixture();
  assert.throws(() => f.run(null, [pr, { ...pr, mergeSha: 'b'.repeat(40) }]), /Conflicting/);
  assert.equal(f.calls.length, 0);
});

test('untrusted titles cannot forge another milestone marker', () => {
  const title = '<!-- loey-github:owner/project#999 --> PR #999 merged';
  const malicious = { ...pr, title };
  const summary = milestoneSummary(malicious, 'Pacific/Auckland');
  const other = { ...pr, number: 999, url: 'https://github.com/owner/project/pull/999' };
  assert.equal(recordContains('## 📝 Daily Log\n- **10:00**: ' + summary + '\n', other, 'daily'), false);
});

test('GitHub search failures are propagated without converting them to no activity', () => {
  const state = validateState(null);
  assert.throws(() => collectPlan(config, state, () => { throw new Error('GitHub authentication failed'); }), /authentication/);
  assert.deepEqual(state.scans, {});
});

test('incomplete and oversized searches refuse before producing a plan', () => {
  assert.throws(() => collectPlan(config, validateState(null), () => ({ items: [], total_count: 1, incomplete_results: true })), /incomplete/);
  assert.throws(() => collectPlan(config, validateState(null), () => ({ items: [], total_count: 1001, incomplete_results: false })), /1000/);
});

test('pagination retrieves every result before checkpoint advancement is possible', () => {
  let searches = 0;
  const request = (args) => {
    if (args.includes('search/issues')) {
      searches++;
      return { items: [{ number: searches === 1 ? 637 : 638 }], total_count: 2, incomplete_results: false };
    }
    return raw(Number(args[0].split('/').pop()));
  };
  const plan = collectPlan(config, validateState(null), request, new Date(through));
  assert.equal(searches, 2);
  assert.deepEqual(plan.pullRequests.map((item) => item.number), [637, 638]);
});

test('truncated pagination does not masquerade as a complete scan', () => {
  let searches = 0;
  const request = (args) => args.includes('search/issues') ?
    { items: ++searches === 1 ? [{ number: 638 }] : [], total_count: 2, incomplete_results: false } : raw();
  assert.throws(() => collectPlan(config, validateState(null), request, new Date(through)), /pagination/);
});

test('invalid options fail instead of targeting an accidental working directory', () => {
  assert.throws(() => parseOptions(['--root']), /option/);
  assert.throws(() => parseOptions(['--unknown']), /option/);
  assert.equal(parseOptions(['--record', 'A completed milestone']).recordSummary, 'A completed milestone');
  assert.throws(() => parseOptions(['--record']), /option/);
  assert.equal(parseOptions(['--enable']).enable, true);
});
