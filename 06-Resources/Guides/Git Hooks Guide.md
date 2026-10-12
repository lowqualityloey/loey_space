---
created: 2026-10-13
updated: 2026-10-13
type: guide
status: active
area: resources
tags:
  - type/guide
  - area/resources
  - status/active
  - topic/git
  - topic/automation
---

# Git Hooks Guide

The repository ships two Git hooks in `.githooks/`:

| Hook | Behaviour | Job |
| :--- | :--- | :--- |
| `pre-commit` | Blocking | Refuses a commit that stages a secret-shaped string, a forbidden path, or a declared private record |
| `post-commit` | Non-blocking, opt-in | Records a milestone in today's daily note and `handoff.md` |

This guide covers activation, the permission bit Git needs, the logging settings, coordination, duplicates and recovery.
[Onboarding](Onboarding.md) places activation in the first-run sequence, and [Maintenance & Troubleshooting](Maintenance%20&%20Troubleshooting.md) lists the symptoms each failure produces.

## Activation

Hooks are inactive in a fresh clone, because Git only reads hooks from the directory named by `core.hooksPath`:

```bash
git config --local core.hooksPath .githooks
```

Check that it took:

```bash
git config --get core.hooksPath    # prints .githooks
```

`--local` writes the setting to this clone's `.git/config`. Without it, neither hook runs and nothing warns you.
The `pre-commit` checks also run in CI, so skipping activation only moves the feedback later.

## Executable permissions

Git runs a hook only if the file is executable, and it records that bit when the file is added. Check it:

```bash
test -x .githooks/post-commit && echo yes
```

If that prints nothing, Git skips the hook silently. On Windows or WSL with `core.fileMode = false`, `chmod +x` is invisible to Git, so the bit has to be recorded in the index:

```bash
git update-index --chmod=+x .githooks/post-commit
```

Both hooks are recorded in the repository as mode `100755`, so a normal clone is already correct. The rule matters when you edit a hook on one of those platforms and commit it yourself.

## Opt-in logging

The `post-commit` hook logs a milestone only for a commit that says so. The opt-in is a trailer on its own line in the commit message:

```bash
git commit -m "$(cat <<'EOF'
feat(hooks): make the logger portable

HeyLoey-Milestone: Make the post-commit logger portable and opt-in
EOF
)"
```

The trailer's text becomes the entry, so write it as the sentence you would want to read in the log tomorrow.
An empty trailer is not an opt-in. Eligibility is the trailer and nothing else: nothing is inferred from the subject line, and no tool judges the sentence for you.
A commit without the trailer logs nothing, so the hook is never a copy of `git log`.

## Settings

| Setting | Default | Effect |
| :--- | :--- | :--- |
| `heyloey.log` | `true` | `false` disables the hook entirely |
| `heyloey.timeout` | `10` | Hard bound on the logger, in seconds |
| `HEYLOEY_LOG` | — | Environment variable for a one-off commit: `HEYLOEY_LOG=off git commit …` |

Reading a value and changing it are different commands:

```bash
git config --get heyloey.timeout          # read the current bound
git config --local heyloey.timeout 30     # change it to 30 seconds
```

`git config --get heyloey.timeout` only reads. Adding `--local` and a value is what writes the setting.

At `heyloey.timeout` the logger is sent `TERM`, given two seconds to exit, then sent `KILL`, and it is always reaped.
The widest a commit can wait is therefore the bound, plus two seconds, plus the one-second poll.
Where `sleep(1)` is missing the hook skips logging with a notice: there is no unbounded fallback, because an unbounded logger is worse than a missing entry.

## Coordination

Two invocations sharing one checkout are serialised by a lock beside the ledger. Both files live in that
checkout's Git directory, so resolve them instead of assuming `.git` is a directory — in a linked
worktree `.git` is a file and the real directory is `.git/worktrees/<name>`:

```bash
git rev-parse --git-path heyloey-milestones         # the ledger
git rev-parse --git-path heyloey-milestones.lock    # the lock
```

Run every command in this section from inside the checkout: each path is resolved for the checkout you
are in, so a lock belonging to another worktree is never mistaken for this one.
The second invocation does not wait for the first — it skips with a notice, because waiting is what turns a slow lock into a stalled commit.

The lock is released when its run ends, including on `SIGINT` and `SIGTERM`. Only a run killed outright — `SIGKILL`, a power loss — leaves one behind.
Reclaiming a stale lock takes two proofs, because the hook's death is not the end of its writer:

- The lock records the writer as well as the hook: `none` when the lock is taken and before any fork, `pending` immediately before the fork, and the writer's pid immediately after it.
- It is reclaimed only when the hook pid **and** the recorded writer are both gone. A `SIGKILL`ed hook runs no cleanup, so its logger can still be alive and writing.
- A live holder is never stolen, at any age. An age-based sweep would steal the lock of a run whose `heyloey.timeout` is longer than the sweep.
- When safety cannot be established — holder alive, writer alive, `pending`, or no record at all — the run skips with a notice instead of guessing.

Two further files can appear in the same directory: `heyloey-milestones.lock.reclaim`, a claim that
stops two reclaimers from deleting a lock a third run has just taken, and `heyloey-postcommit.<pid>.out`,
the capture file holding whatever the logger printed. A `SIGKILL`ed hook cannot delete either one.

Clearing a stale lock by hand is always available, and safe whenever nothing is running. **Confirm no
writer is active first** — look for a `node` process writing today's note and for a recent capture
file — then, from inside the checkout:

```bash
lock="$(git rev-parse --git-path heyloey-milestones.lock)"
rm -rf "$lock"
```

Remove the `.reclaim` claim only together with the lock, and only when nothing is running:

```bash
rm -rf "$(git rev-parse --git-path heyloey-milestones.lock.reclaim)"
```

Capture files share the lock's directory, so they are resolved the same way:

```bash
gitdir="$(dirname "$(git rev-parse --git-path heyloey-milestones)")"
rm -f "$gitdir"/heyloey-postcommit.*.out
```

## Duplicate handling

After a run that exits 0, the hook appends a hash of the date and the summary to its ledger, at
`git rev-parse --git-path heyloey-milestones`. A later invocation that finds that key skips the entry and says so:

```
post-commit: milestone already logged today — skipped
```

The keys are hashes of `YYYY-MM-DD|<summary>`, never the summary text. This is what makes amending, rebasing, cherry-picking and re-running a commit safe.
To allow the same summary again on purpose, delete the ledger:

```bash
rm -f "$(git rev-parse --git-path heyloey-milestones)"
```

The promise is narrower than "once per day": a run that fails or is interrupted records no key, so a retry does write again.

## Partial-write recovery

`done` writes today's daily note first and `handoff.md` second. There is no atomic write across two files — the daily note is your file, and rewriting it would fight the editor — so a run stopped between the two writes leaves one record and not the other.
The hook reports `milestone not logged`, records no key, and leaves the summary retryable.

To recover:

1. Look at both records: `## 📝 Daily Log` in today's note, and `### Latest Updates` in `handoff.md`.
2. If the entry is complete in both, do nothing.
3. If one is missing, finish it: re-run the commit, or log it directly with the CLI (below).
4. A retry in a later minute writes a second, differently-timestamped daily line, so delete one of the two by hand. A retry inside the same minute is suppressed, because the logger refuses a byte-identical line.

The CLI writes the two records and nothing else. It does **not** read or update the hook's ledger, so a
summary you re-log by hand is not marked as logged, and a later hook invocation carrying the same
trailer may log it again. Re-run the hook (`git commit --amend --no-edit`) instead when you want the
ledger to record the entry and keep the once-per-day guarantee described above.

## Re-running the hook versus running the CLI

Both write the same two records, and they are not the same operation:

| | `git commit --amend --no-edit` (re-runs the hook) | `npm run heyloey -- done "<summary>"` (runs the CLI) |
| :--- | :--- | :--- |
| Takes the hook's lock | Yes — one logging run per vault at a time | **No** |
| Reads and writes the ledger | Yes — skips a summary already logged today | **No** |
| Records a key on success | Yes | **No** |
| Needs a commit | Yes | No |

The CLI does not manage the hook's lock or its ledger. It writes the records and nothing else, so it will log a summary the hook already logged today, and it is not serialised against a hook run that may be writing at the same moment.
Use it when the commit cannot be reworded, and prefer it when nothing else is running. `--dry-run` prints the target paths and the exact lines without writing:

```bash
npm run heyloey -- done "Ship the parser fix" --dry-run
```

## Limitations

- **No atomic two-file write.** A killed run can leave one record written and the other not, and recovery is manual.
- **A partial entry is possible.** A logger stopped at the bound exits non-zero; the hook reports `milestone not logged` and whatever the logger wrote first remains in the note.
- **A reused writer pid blocks reclaim** conservatively. The notice names the pid, so you can tell a live run from a reused one and remove the lock by hand.
- **Escalation reaps the logger, not processes the logger starts itself.** The logger is a single `node` process today, so this does not bite in practice.
- **The hook is bash and is developed and tested on Linux.** Windows and WSL behaviour, including the executable bit above, is not covered by the automated checks; verify it by hand.
- **Eligibility is the trailer alone.** A commit whose message omits it is never logged, however significant the change.

## Related

- [Onboarding](Onboarding.md) — activation inside the first-run sequence
- [Maintenance & Troubleshooting](Maintenance%20&%20Troubleshooting.md) — symptom, action, expected result
- [Vault Security Policy](Vault%20Security%20Policy.md) — what the blocking hook protects
- [Hey Loey Guide](Hey%20Loey%20Guide.md) — the `heyloey` CLI itself
- [Documentation Index](Documentation%20Index.md) — every guide, grouped by reader goal
