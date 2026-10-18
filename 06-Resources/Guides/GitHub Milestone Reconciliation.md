---
created: 2026-10-15
updated: 2026-10-18
type: guide
area: resources
status: active
tags:
  - type/guide
  - area/resources
  - topic/github
---

# GitHub Milestone Reconciliation

This fallback records merged pull requests independently of the agent that completed the work. It supplements explicit agent milestones: local-only work, reviews, decisions and blockers still need `heyloey done`.

## Configure repositories

Create the owner-only root file `.github-milestone-repositories.json`:

```json
{
  "schemaVersion": 1,
  "repositories": ["example-owner/example-project"],
  "timeZone": "Pacific/Auckland",
  "startFrom": "2026-10-14T11:00:00.000Z"
}
```

Use the repository's exact GitHub owner and name. Only listed repositories are queried. Choose an explicit starting timestamp; this example is midnight on October 15 in Auckland. Merges before that boundary are excluded. Adding a repository gives it its own scan checkpoint starting at this boundary.

The configuration, `.github-milestone-reconciliation.json` checkpoint and `.github-milestone-reconciliation.ready.json` verification receipt are ignored and declared private. None contains credentials. Authenticate the GitHub CLI normally; keep credentials out of these files.

## Preview and run

Requirements: Node.js 18+, authenticated `gh` with access to each configured repository, the installed central `heyloey` logger with `RESULT` receipts, and util-linux `flock`. Use WSL on Windows.

```bash
npm run reconcile-github -- --dry-run
npm run reconcile-github -- --enable
npm run reconcile-github
```

The target defaults to this script's vault, independently of the working directory. `LOEY_SPACE_DIR` or `--root <vault>` selects another vault explicitly.

The central logger at `~/.local/bin/heyloey` is preferred over PATH. `HEYLOEY_BIN` can name a different installed logger. Its read-only `lock-state` must identify the intended vault and the same kernel lock before any logging occurs; the repository's portable CLI is not substituted silently.

Today's canonical daily note and `handoff.md` must exist with `## 📝 Daily Log` and `### Latest Updates`. Missing records cause refusal, never fabricated vitals, habits or focus. Create the daily note through the canonical template or morning flow, then retry.

## What is recorded

A milestone includes the repository, PR number, title, merge SHA, original merge time in the configured timezone, and canonical GitHub URL. It is logged on the day it is discovered; the original merge time remains in its text.

The writer uses the installed logger under its existing kernel lock. That logger remains responsible for daily-note formatting and handoff overflow into monthly archives. No external repository, Git history, PR, issue or project status is changed.

The `--enable` command runs the native reconciliation, lock-integration and existing post-commit tests before writing a readiness receipt for their source hashes. Source changes invalidate that receipt. Activation refuses while a vault hook is in flight and restores prior readiness if a hook overlaps the cutover. It never removes the hook's coordination lock.

Once that readiness receipt exists, the vault's post-commit hook uses the same locked writer through the reconciler's internal recording route. This keeps a local vault commit from racing a scheduled scan. Clones without a readiness receipt retain the portable hook path. The hook still requires the canonical milestone trailer. A dry run requires no readiness receipt; live reconciliation refuses without one.

An existing timestamped merged-PR entry in both records counts as already recorded. Opened-PR entries, negated merge statements and ambiguous multi-PR prose do not count. Legacy summaries must associate the repository, PR number and an affirmative merge action in the same clause; stable reconciliation markers identify their PR directly. If only one record contains the milestone, the missing record alone is repaired. Handoff archives count as retained records. Repository scopes and exact PR identities prevent cross-project collisions.

Before writing, reconciliation checks canonical daily notes from the configured starting date through today, following the daily-note folder and filename settings. This includes earlier discovery days, not just the PR's merge day. An interrupted writer can therefore recover an already-written daily entry even when its checkpoint was never saved. A successful retry saves that original daily path in its verified receipt and repairs only a missing record. Historical notes remain unchanged.

A stable marker and private checkpoint make repeated scans idempotent even if a PR title is edited. The checkpoint advances only after GitHub retrieval is complete and both record entries have been read back. Authentication failures, incomplete searches, pagination limits, failed logger receipts and partial writes do not advance it past unverified work. Each repository's next scan overlaps one day to catch delayed indexing.

Expected output after reconciliation:

```text
RESULT reconcile logged logged=2 already-recorded=0 milestones-verified=2 lock=flock target=<vault>
RESULT reconcile unchanged logged=0 already-recorded=2 milestones-verified=2 lock=flock target=<vault>
```

A process exit code alone is not evidence that entries were written.

## Scheduling

A scheduler can run `npm run reconcile-github` hourly from the vault. Before the first live run of a source version, complete the repository gates and run `npm run reconcile-github -- --enable`. It should remain quiet on unchanged scans and report new recorded milestones or a new actionable blocker. A saved schedule is not evidence of a successful runtime execution: verify the first live receipt and both actual records before calling the integration operational.

Run the focused regression suite with:

```bash
node --test 06-Resources/scripts/tests/github-milestone-reconciliation.test.mjs
node --test 06-Resources/scripts/tests/github-milestone-lock-integration.test.mjs 06-Resources/scripts/tests/post-commit-hook.test.mjs
```
