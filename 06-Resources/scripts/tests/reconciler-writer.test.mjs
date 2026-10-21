/*
 * RR1 regression: reconciliation must inspect the SAME formats the deployed writers produce.
 * This test drives the pinned patched canonical writer through the reconciler, proving that the
 * plain Agent Milestones table is verified, a checkpoint is saved, and a repeat scan is a no-op.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  localStamp, milestoneSummary, normalizePullRequest, reconcileMilestones, recordContains, validateConfig,
} from '../github-milestone-reconciliation.mjs';
import {
  AGENT_AREA, DAILY_HEADING, GITHUB_AREA, PERSONAL_AREA, agentToggles, canonicalCli, claimedCount,
  makeVault, runCli, writeDaily,
} from './helpers/canonical-fixture.mjs';
import {
  DISCOVERY_NOW, MIDNIGHT_DISCOVERY_NOW, MIDNIGHT_MERGE_AT, aucklandDate, freezeClock,
} from './helpers/auckland-clock.mjs';

// This scenario discovers at 11:03Z; freeze the test process at that instant too.
freezeClock(MIDNIGHT_DISCOVERY_NOW);

test('the actual patched writer satisfies reconciliation and checkpoints once', (t) => {
  const cli = canonicalCli(t);
  const root = makeVault(t);
  const now = Date.parse(MIDNIGHT_DISCOVERY_NOW);
  const pr = normalizePullRequest('owner/project', {
    number: 638,
    merged: true,
    title: 'Clarify portable CLI selection',
    html_url: 'https://github.com/owner/project/pull/638',
    merged_at: MIDNIGHT_MERGE_AT,
    merge_commit_sha: 'a'.repeat(40),
  });
  const config = validateConfig({
    schemaVersion: 1,
    repositories: ['owner/project'],
    timeZone: 'Pacific/Auckland',
    startFrom: new Date(now - 24 * 60 * 60_000).toISOString(),
  });
  const through = new Date(now + 60_000).toISOString();
  // The discovery instant is 00:03 on 18 October in Auckland; the PR merged five minutes earlier at
  // 23:58 on 17 October. The daily note follows discovery, while the merge stays inside the summary.
  const date = aucklandDate(MIDNIGHT_DISCOVERY_NOW);
  const mergeDate = localStamp(pr.mergedAt, config.timeZone).date;
  assert.equal(date, '2026-10-18');
  assert.equal(mergeDate, '2026-10-17');
  const dailyPath = path.join('01-Daily', date.slice(0, 7), `${date}.md`);
  assert.equal(path.join('01-Daily', mergeDate.slice(0, 7), `${mergeDate}.md`), '01-Daily/2026-10/2026-10-17.md');

  const file = writeDaily(root, [
    DAILY_HEADING,
    '> _A running timestamp of what happened today._',
    '',
    PERSONAL_AREA,
    '',
    AGENT_AREA,
    '',
    GITHUB_AREA,
    '',
    '---',
    '',
    '## 🌇 End of the Day...',
    '- Keep this reflection.',
  ].join('\n'), MIDNIGHT_DISCOVERY_NOW);
  assert.equal(file, path.join(root, dailyPath));
  assert.equal(fs.existsSync(path.join(root, '01-Daily/2026-10/2026-10-17.md')), false,
    'the merge date must not create a second daily note');
  const handoffBefore = fs.readFileSync(path.join(root, 'handoff.md'), 'utf8');

  const calls = [];
  let saved;
  const io = {
    root,
    inspect(candidate) {
      const daily = fs.readFileSync(path.join(root, dailyPath), 'utf8');
      const handoff = fs.readFileSync(path.join(root, 'handoff.md'), 'utf8');
      return {
        daily: recordContains(daily, candidate, 'daily', true),
        handoff: recordContains(handoff, candidate, 'handoff', true),
        dailyPath,
      };
    },
    requireRecords() {
      const daily = fs.readFileSync(path.join(root, dailyPath), 'utf8');
      const handoff = fs.readFileSync(path.join(root, 'handoff.md'), 'utf8');
      assert.ok(daily.includes(DAILY_HEADING));
      assert.ok(handoff.includes('### Latest Updates'));
    },
    log(command, summary) {
      calls.push(command);
      const result = runCli(root, cli, [command, summary], { now: MIDNIGHT_DISCOVERY_NOW });
      assert.equal(result.status, 0, `writer failed: ${result.stderr}`);
      return result.stdout;
    },
    saveState(value) { saved = structuredClone(value); },
  };

  const first = reconcileMilestones({ config, state: null, pullRequests: [pr], through }, io);
  assert.equal(first.logged, 1);
  assert.equal(first.alreadyRecorded, 0);
  assert.deepEqual(calls, ['done']);
  assert.ok(saved, 'a verified checkpoint must be saved');
  assert.ok(saved.receipts[pr.url], 'the PR receipt must be recorded');
  assert.equal(saved.scans['owner/project'], through);
  assert.ok(saved.receipts[pr.url].dailyPath.includes(date));
  assert.ok(!saved.receipts[pr.url].dailyPath.includes(mergeDate));

  const dailyAfter = fs.readFileSync(path.join(root, dailyPath), 'utf8');
  assert.match(dailyAfter, /^> \| 12:03&nbsp;AM \| .+ \| PR #638 merged:/m,
    'the writer subprocess must also be frozen at the discovery instant');
  assert.match(dailyAfter, /2026-10-17 23:58 Pacific\/Auckland/, 'merge metadata keeps its own date');
  assert.equal(dailyAfter.split('PR #638 merged:').length - 1, 1, 'exactly one table row');
  assert.equal(agentToggles(dailyAfter).length, 1, 'the reconciled milestone lands in the one container');
  assert.equal(claimedCount(dailyAfter), 1, 'the toggle count matches the single row');
  assert.ok(dailyAfter.includes('<!-- loey-github:owner/project#638 -->'));
  assert.ok(dailyAfter.includes('- Keep this reflection.'));
  assert.notEqual(fs.readFileSync(path.join(root, 'handoff.md'), 'utf8'), handoffBefore);

  // (d) The checkpoint is saved on the verified write and reused by the next scan.
  const snapshot = {
    daily: dailyAfter,
    handoff: fs.readFileSync(path.join(root, 'handoff.md'), 'utf8'),
  };
  const second = reconcileMilestones({ config, state: first.state, pullRequests: [pr], through }, io);
  assert.equal(second.outcome, 'unchanged');
  assert.equal(second.alreadyRecorded, 1);
  assert.deepEqual(calls, ['done'], 'the saved checkpoint means the writer is never called again');
  assert.deepEqual({
    daily: fs.readFileSync(path.join(root, dailyPath), 'utf8'),
    handoff: fs.readFileSync(path.join(root, 'handoff.md'), 'utf8'),
  }, snapshot, 'a repeat scan must be byte-identical');
  assert.deepEqual(
    saved.receipts[pr.url],
    first.state.receipts[pr.url],
    'the reused checkpoint is the one saved by the verified write',
  );
});

test('discovery and merge dates stay separate across the Auckland midnight boundary', () => {
  const pr = normalizePullRequest('owner/project', {
    number: 639, merged: true, title: 'Boundary PR',
    html_url: 'https://github.com/owner/project/pull/639', merged_at: MIDNIGHT_MERGE_AT,
    merge_commit_sha: 'b'.repeat(40),
  });
  assert.equal(aucklandDate(MIDNIGHT_DISCOVERY_NOW), '2026-10-18', 'discovery belongs to 18 October');
  assert.equal(localStamp(pr.mergedAt, 'Pacific/Auckland').date, '2026-10-17', 'merge belongs to 17 October');
  assert.match(milestoneSummary(pr, 'Pacific/Auckland'), /2026-10-17 23:58 Pacific\/Auckland/);
  assert.equal(aucklandDate(DISCOVERY_NOW), '2026-10-18');
});

test('reconciliation ignores an identical personal entry when the agent table is empty', () => {
  const now = MIDNIGHT_DISCOVERY_NOW;
  const pr = normalizePullRequest('owner/project', {
    number: 638, merged: true, title: 'Clarify portable CLI selection',
    html_url: 'https://github.com/owner/project/pull/638', merged_at: now,
    merge_commit_sha: 'a'.repeat(40),
  });
  const summary = milestoneSummary(pr, 'Pacific/Auckland');
  const daily = [
    DAILY_HEADING, '', PERSONAL_AREA, '- **09:00 AM**: ' + summary, '',
    AGENT_AREA, '', '| Time | Scope | Milestone |', '| :--- | :--- | :--- |', '',
  ].join('\n');
  assert.equal(recordContains(daily, pr, 'daily'), false, 'Personal Log must not satisfy agent deduplication');
});
