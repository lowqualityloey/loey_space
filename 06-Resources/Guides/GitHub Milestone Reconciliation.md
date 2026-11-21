---
created: 2026-10-15
updated: 2026-11-21
type: guide
area: resources
status: active
tags:
  - type/guide
  - area/resources
  - status/active
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

A single milestone can be recorded through the same locked writer, without a GitHub scan:

```bash
npm run reconcile-github -- --record "One line describing the milestone"
npm run reconcile-github -- --record "Queued overnight milestone" --date 2026-11-20 --time 23:50
```

`--date` files the entry under the day the work happened, which is what a replayed record needs: a milestone queued at 23:50 and drained after midnight would otherwise land in the wrong note. Without `--time` the current clock time is kept on the named day, matching `done --date` exactly. Both values are validated before the lock is taken, so a malformed day costs nothing and writes nothing. `--date` and `--time` are refused unless `--record` is present.

The central logger at `~/.local/bin/heyloey` is preferred over PATH. `HEYLOEY_BIN` can name a different installed logger. Its read-only `lock-state` must identify the intended vault and the same kernel lock before any logging occurs; the repository's portable CLI is not substituted silently.

Today's canonical daily note and `handoff.md` must exist with `## 📝 Daily Log` (reconciled rows land in `### 🤖 Agent Milestones`) and `### Latest Updates`. Missing records cause refusal, never fabricated vitals, habits or focus. Create the daily note through the canonical template or morning flow, then retry.

## What is recorded

A milestone includes the repository, PR number, title, merge SHA, original merge time in the configured timezone, and canonical GitHub URL. It is written into the daily note for the day the pull request merged, using `done --date <merge day> --time <merge time>`, so a scan that notices a merge late still files the milestone under the correct date. Only `done` accepts those flags, which is why it is the command the reconciler uses for a live write.

The writer uses the installed logger under its existing kernel lock. That logger remains responsible for daily-note formatting and handoff overflow into monthly archives. No external repository, Git history, PR, issue or project status is changed.

The `--enable` command runs the native reconciliation, lock-integration and existing post-commit tests before writing a readiness receipt for their source hashes. Source changes invalidate that receipt. Activation refuses while a vault hook is in flight and restores prior readiness if a hook overlaps the cutover. It never removes the hook's coordination lock.

The vault's post-commit hook uses the same locked writer through the reconciler's internal recording route whenever the vault declares `.github-milestone-repositories.json`. That selection is deliberately made on the allowlist rather than on the readiness receipt: a receipt that is stale or deleted must surface the refusal, not silently fall through to the portable logger, because the fallback writes without verification and looks identical to success. Clones that declare no allowlist keep the portable hook path. The hook still requires the canonical milestone trailer. A dry run requires no readiness receipt; live reconciliation refuses without one.

An existing timestamped merged-PR entry in both records counts as already recorded. Opened-PR entries, negated merge statements and ambiguous multi-PR prose do not count. Legacy summaries must associate the repository, PR number and an affirmative merge action in the same clause; stable reconciliation markers identify their PR directly. If only one record contains the milestone, the missing record alone is repaired. Handoff archives count as retained records. Repository scopes and exact PR identities prevent cross-project collisions.

Before writing, reconciliation checks canonical daily notes from the configured starting date through today, following the daily-note folder and filename settings. That reach covers both the PR's merge day and any later day where an interrupted run may have written. An interrupted writer can therefore recover an already-written daily entry even when its checkpoint was never saved. A successful retry saves that original daily path in its verified receipt and repairs only a missing record. Historical notes remain unchanged.

A writer refusal is scoped to the milestone that caused it. If the target daily note is absent, that milestone is reported as `[reconcile] SKIPPED <url> (<date>): <reason>`, no receipt is saved for it, and the scan continues with the rest. The next run retries it once the note exists. Only an ordinary (non-refusal) write failure aborts the scan, because that is a fault in the integration rather than missing input.

A stable marker and private checkpoint make repeated scans idempotent even if a PR title is edited. The checkpoint advances only after GitHub retrieval is complete and both record entries have been read back. Authentication failures, incomplete searches, pagination limits, failed logger receipts and partial writes do not advance it past unverified work. Each repository's next scan overlaps one day to catch delayed indexing.

Expected output after reconciliation:

```text
RESULT reconcile logged logged=2 already-recorded=0 milestones-verified=2 lock=flock target=<vault>
RESULT reconcile unchanged logged=0 already-recorded=2 milestones-verified=2 lock=flock target=<vault>
RESULT reconcile logged logged=1 already-recorded=3 milestones-verified=4 skipped=1 lock=flock target=<vault>
```

The `skipped=<n>` tail appears only when a milestone was refused, and each refusal is printed on its own line above the result.

A process exit code alone is not evidence that entries were written.

## Diagnose a refusal

A live run refuses with `Native verification is not recorded for this source version` when the working tree no longer matches the certified receipt. The refusal now names the cause rather than only the verdict:

- `Cause: .github-milestone-reconciliation.ready.json is absent` — this clone has never certified a source version.
- `Cause: .github-milestone-reconciliation.ready.json does not record schemaVersion 1` — the receipt is from an older format.
- Cause: hash drift — `hash drift in '<file>' (last changed <sha> <date>)`; the listed files changed after certification. At most two are named, with a `(+N more)` count. When the vault is not a Git work tree the label degrades to `(commit unknown)`; the refusal itself is unaffected.

Ask the same question without any of the machinery a write needs:

```bash
npm run reconcile-github -- --status
```

`--status` is read-only. It needs no `gh` authentication, no logger, no `flock` and no allowlist; it prints one `ok` / `drifted` / `missing` line per verification file, then `RESULT reconcile status=<ok|drift|absent|schema> target=<vault>`. Exit codes: `0` ready, `4` not ready, `1` error. It never rewrites the receipt.

Re-certifying is always an explicit act: run `npm run reconcile-github -- --enable`. No mode refreshes readiness automatically, because certification is the one step that must stay reviewable.

## Scheduling

An hourly cron entry runs this from the vault, so a merged pull request is normally recorded within the hour rather than at the next interactive session. Check the installed line with `crontab -l`. It should remain quiet on unchanged scans and report new recorded milestones or a new actionable blocker. A saved schedule is not evidence of a successful runtime execution: verify the first live receipt and both actual records before calling the integration operational.

Cron runs with a minimal environment: the entry therefore sets `PATH` explicitly (so `gh` resolves) and `LOEY_SPACE_DIR`, and runs the script directly instead of through a login shell. Before the first live run of a source version, complete the repository gates and run `npm run reconcile-github -- --enable`.

Run the focused regression suite with:

```bash
node --test 06-Resources/scripts/tests/github-milestone-reconciliation.test.mjs
node --test 06-Resources/scripts/tests/github-milestone-lock-integration.test.mjs 06-Resources/scripts/tests/post-commit-hook.test.mjs
```
