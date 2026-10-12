---
created: 2026-10-12
updated: 2026-10-12
type: guide
status: active
area: resources
tags:
  - type/guide
  - area/resources
  - status/active
  - topic/troubleshooting
  - topic/maintenance
---

# Maintenance and Troubleshooting

This guide consolidates troubleshooting steps and maintenance routines for `loey_space`. It also separates read-only verification commands from operations that modify files.

## Common Symptoms and Fixes

### API Key and AI Notices

- **Symptom**: `⚠️ GEMINI_API_KEY missing in .env!` notice appears.
  - **Fix**: Create `.env` by copying `.env.example` (`cp .env.example .env`) and add your API key from [Google AI Studio](https://aistudio.google.com/app/apikey). AI features are optional; all note creation, habits, task dashboards, and search work without an API key.
- **Symptom**: AI summary reads flat with a notice about quota limits (HTTP 429).
  - **Fix**: The Gemini API returned a rate limit error. Per-minute limits clear after about 60 seconds; daily limits reset at midnight Pacific Time. When a quota error occurs, the daily note enricher generates a flat summary from your logged bullets; the weekly review script stops without creating or overwriting files. Re-run the command once the quota resets.

### Plugin and UI Issues

- **Symptom**: Changes to bundled plugins or CSS snippets have no effect.
  - **Fix**: Obsidian loads plugin code and snippets at startup. Press `Ctrl + P` (or `Cmd + P`) and select **Reload app without saving**.
- **Symptom**: HomePulse loses habit sync, focus synchronization, or tech tree views.
  - **Fix**: The plugin was updated from the Community Store, replacing custom vault code. Restore `.obsidian/plugins/homepulse/` from Git history, run `npm run patch-homepulse` to re-verify the locally owned prelude, and ensure **Settings → Community plugins → Auto-update plugins: OFF** is set.
- **Symptom**: Habit toggles in the dashboard do not update the daily note.
  - **Fix**: Habit sync requires today's daily note to exist at `01-Daily/YYYY-MM/YYYY-MM-DD.md` (or the legacy fallback `01-Daily/YYYY-MM-DD.md`), a `## 🔁 Habits` heading with checkboxes, and Dataview enabled in Community plugins.
- **Symptom**: HomePulse dashboard appears cramped on mobile screens.
  - **Fix**: Go to **Settings → Appearance → CSS snippets** and enable `homepulse-mobile`.

### Platform and Script Errors

- **Symptom**: `npm run build` fails with `you installed esbuild for another platform`.
  - **Fix**: `node_modules` was installed on a different operating system than the current shell (for example, switching between native Windows and WSL). The `esbuild` compiler and `tsx` test runner include platform-specific native binaries. Never share a single `node_modules` folder across operating systems. In the shell you are building from, delete the folder and reinstall:
    ```bash
    rm -rf node_modules
    npm ci
    ```
- **Symptom**: DataviewJS block throws `TypeError: dv.load is not a function`.
  - **Fix**: `dv.load` is not a Dataview API method. Dataview provides two supported methods for loading external files:
    - `await dv.io.load(path)` — Reads raw file text from the vault. Used to evaluate bundles, such as `06-Resources/scripts/task-view.js`.
    - `await dv.view(path, input)` — Executes a custom Dataview view script.

### Git Hooks and Milestone Logging

The `post-commit` hook records a milestone in today's daily note and in `handoff.md`. It is fail-open:
it reports what it could not do and never changes the outcome of a commit. It is also opt-in per
commit, so most of what follows only matters for a commit you expected to be logged.

- **Symptom**: a commit that should have been logged left no entry.
  - **Check, in this order**:
    1. **Is the hook active?** `git config --get core.hooksPath` must print `.githooks`. Cloning does not activate hooks; nothing runs until this is set (`git config --local core.hooksPath .githooks`).
    2. **Did the message opt in?** `git log -1 --pretty=%B | grep '^HeyLoey-Milestone:'`. The trailer is the only opt-in; the subject line is never logged, and an empty trailer is not enough.
    3. **Is the file executable?** `test -x .githooks/post-commit && echo yes`. Git silently skips a hook it cannot execute. On Windows or WSL with `core.fileMode=false`, `chmod +x` is invisible to Git — record the bit with `git update-index --chmod=+x .githooks/post-commit`.
    4. **Can the hook find its tool?** `command -v node`. The hook runs the repository's own bundle (`06-Resources/scripts/heyloey.js`) and skips silently when Node is missing. There is nothing to install and no PATH to fix.
    5. **Do the records exist?** `npm run heyloey -- brief` reports `memory.md` and `handoff.md`, and whether today's daily note is present. `done` refuses without both a daily note and the handoff — it never scaffolds a note.
    6. **Was it already logged?** A summary that has *already been logged successfully* is not logged again on the same day by this clone, so an amend, a rebase or a second commit with the same trailer reports `milestone already logged today — skipped` instead of writing a duplicate. The keys are hashes of `YYYY-MM-DD|<summary>` — never the summary text — in the clone's Git directory, `.git/heyloey-milestones`; delete that file to allow a repeated summary again. This is a narrower promise than "once per day": a run that fails or is interrupted records no key, so a retry does write again (see the half-finished-entry symptom below).
    7. **Did the hook skip on purpose?** It skips rather than risk a lost or duplicated entry, and it names the case it hit:
       - `another invocation is already logging to this vault` — a live run holds the lock, which is never stolen at any age. If the notice adds `held for …s, longer than the …s a bounded run can hold it`, that pid is probably a reused one: if it is not this hook, remove the lock by hand (below).
       - `another invocation is reclaiming a stale coordination lock` — another hook is already clearing the dead lock. Re-run the commit in a moment, or log it directly.
       - `the coordination lock has no readable holder` — the lock cannot be proven stale, so nothing is removed. Inspect `…/heyloey-milestones.lock` and remove it by hand if no run is active.
       - `reclaimed a stale coordination lock left by an interrupted run` — a previous run died mid-write and its lock was cleared. The entry is attempted again; look for a partial write (below).
       - `sleep(1) is unavailable, so the logger cannot be bounded` — the platform cannot bound the run, so logging is skipped rather than run unbounded.
       - `mkdir(1), rm(1) and rmdir(1) are needed to serialise invocations` — the lock cannot be taken, so logging is skipped rather than run unsynchronised.
       - `logger exit 124` — the logger ignored the bound, was force-stopped, and the entry is incomplete.
  - **Fix**: when a record must be written now and the commit cannot be reworded, run the CLI directly — it is the same code path the hook uses: `npm run heyloey -- done "<summary>"`.
- **Symptom**: `post-commit: milestone not logged (logger exit 1) — the commit is unaffected` followed by `daily note is absent` or `handoff.md is absent`.
  - **Fix**: run `npm run init:vault` to create `handoff.md`, and open today's note from `99-Templates/Daily.md`. Until both exist there is nowhere established to write, and the hook deliberately refuses rather than inventing a structure.
- **Symptom**: the hook blocks or delays a commit.
  - **Fix**: it cannot block, and the wait is capped by a tested ladder. The commit object is written before the hook runs; an opted-in commit then waits for the logger, bounded by `heyloey.timeout` (10s): TERM at the bound, two seconds to exit, then KILL — and the logger is always reaped. The widest possible wait is therefore timeout + 2s + the one-second poll. `timeout(1)` is deliberately not used: measured on GNU coreutils 9.4, `timeout 3` against a logger that ignores TERM returned after **8757ms** (it waits for its child, it does not escalate), and only the GNU-only `-k` form forces the issue (`timeout -k 1 3` → 4003ms, exit 137). The only tool required is `sleep(1)`; where it is missing, logging is skipped with a notice — **there is no unbounded fallback.** Measured: with `timeout` removed from `PATH` a TERM-ignoring logger is force-killed near the bound, the commit still lands, the daily note is byte-identical, no key is recorded and no process survives. Neither the bound nor an interruption kills a process the logger started itself (the real logger is a single `node` process). Set `heyloey.log false` if you would rather not run it at all.
- **Symptom**: `post-commit: interrupted (signal 15): the logger was stopped and the entry was not completed`, and the shell reports exit 143 (or 130 for `SIGINT`).
  - **Why it happens**: something sent INT or TERM while the hook was still logging — `Ctrl-C` in a long commit loop, or a tool that kills the process group. The hook stops the logger first (TERM, then KILL after two seconds if it refuses to die), reaps it, and only then releases the lock, so a freed lock can never be handed to a second writer while the first is still alive. It exits with 128+signal; `git` ignores a post-commit exit status, so the commit itself is unaffected.
  - **Fix**: that commit logged nothing, and nothing is half-written unless the logger had already written the daily note (next symptom). Re-run the commit, or log it directly: `npm run heyloey -- done "<summary>"`.
- **Symptom**: today's daily note or `handoff.md` holds a half-finished entry, or the same milestone appears twice with different times.
  - **Why it happens**: the logger writes the daily note first and `handoff.md` second, so a failure *between* those writes leaves one record and not the other. A run killed at `heyloey.timeout` is exactly this case: the hook sees a non-zero exit, records no key, and reports `milestone not logged`, which keeps the entry retryable. Measured: a logger that died after writing the daily note left `daily 1 / handoff 0` and no key. Retrying then legitimately writes the missing half — and because the retry lands in a later minute, the day's entry can hold two lines for one summary (`23:13` and `23:14` in the measurement). A retry inside the *same* minute is suppressed, because the logger refuses a byte-identical line (measured: a second `done` with the same summary left the note unchanged). A *successful* run is protected too: a second commit with the same trailer reports `milestone already logged today — skipped` and writes nothing. So the once-per-day guarantee covers completed runs, not interrupted ones.
  - **Recovery**: finish the entry by hand; nothing reconciles the two records for you.
    1. Open today's daily note and `handoff.md` and remove the half-written line — the one with no counterpart in the other record.
    2. Re-run the logger and let it write both records in one pass: `npm run heyloey -- done "<summary>"`. Using the same summary text keeps the ledger consistent; a reworded summary records a second key and is no longer recognised as already logged.
    3. Only if the same summary should be logged again on purpose: `rm -f .git/heyloey-milestones`.
  - **Fix**: nothing to repair in the hook. A partial write is the honest cost of never holding a commit open; none of the two records is rewritten atomically because the daily note is the user's file and a rewrite would fight the editor. If this recurs, raise `heyloey.timeout` (`git config --get heyloey.timeout`).
- **Symptom**: `.git/heyloey-milestones.lock` is left behind, or a run keeps reporting that another invocation is logging.
  - **Fix**: only a run killed outright leaves the lock (`SIGKILL`, power loss) — INT and TERM are handled. Recovery is ownership-safe by design, and it takes **two** proofs, because the hook's death is not the end of the story: a `SIGKILL`ed hook runs no cleanup, so its logger can still be alive and writing to the records. The lock therefore records the writer as well as the hook — `none` written when the lock is taken and before any fork, `pending` immediately before the fork, the pid immediately after it — and it is reclaimed only when the hook pid **and** the writer are both provably gone (`kill -0` fails on both). A live holder is never stolen, at any age; a fixed 120s sweep would steal a live lock from a run whose `heyloey.timeout` is longer than 120s, which is the bug that rule removes. When safety cannot be established — holder alive or unreadable, writer alive, `pending`, or the record missing — the run **skips with a notice** instead of guessing, and the holder notice reports the longest a legitimate holder can hold the lock (`heyloey.timeout` + 2s + a margin) so a reused pid can be told from a live run.
  - Clearing it by hand is always available, and safe whenever nothing is running: `rm -rf .git/heyloey-milestones.lock`. A reclaim in flight may also leave `.git/heyloey-milestones.lock.reclaim`: that claim is what stops two reclaimers from deleting a lock a third run has just acquired, so remove it only together with the lock, and only when nothing is running.
  - The lock covers the duplicate check, the logger and the ledger update, so two invocations sharing a vault never interleave: one logs, the other skips with a notice and can be retried.
- **Symptom**: `post-commit: a milestone writer (pid 1234) from a killed hook is still running — not logged; stop that process, …`
  - **Why it happens**: something killed the hook with `SIGKILL`, so no trap could run and its logger was never stopped. That logger is still alive and can still write, so the lock is deliberately **not** reclaimed — reclaiming it would let a second invocation write while the first was mid-write.
  - **Recovery**, in order:
    1. Stop the writer the notice names: `kill <pid>` (add `-9` if it ignores TERM).
    2. Check what it managed to write: `## 📝 Daily Log` in today's note, and `### Latest Updates` in `handoff.md`. If the entry is already there in full, do **not** re-log it; just remove the lock: `rm -rf .git/heyloey-milestones.lock`.
    3. If it is not there, re-run the commit or log it directly: `npm run heyloey -- done "<summary>"`. Both the hook and its writer are now provably gone, so that run reclaims the lock (`reclaimed a stale coordination lock left by an interrupted run`), logs the entry and records its key.
    4. A `SIGKILL`ed hook cannot delete its capture file either: `.git/heyloey-postcommit.<pid>.out` is inert, holds whatever the logger printed, and is safe to remove (`rm -f .git/heyloey-postcommit.*.out`).
- **Symptom**: `post-commit: the coordination lock cannot be reclaimed safely: its writer is unaccounted for (… heyloey-milestones.lock/logger records 'pending' …)`.
  - **Why it happens**: the hook was killed in the interval between recording that it was about to start a writer and recording that writer's pid — the only window in which a writer can exist without being identifiable. Neither state can be ruled out, so nothing is reclaimed.
  - **Fix**: make sure no writer is running (look for a `node` process writing today's note, and for a recent `.git/heyloey-postcommit.*.out`), then remove the lock by hand: `rm -rf .git/heyloey-milestones.lock`. A lock carrying **no** writer record at all gets the same treatment — that is what a lock left by an older hook version looks like.
- **Symptom**: `npm run log-github` reports no GitHub activity on a day you worked.
  - **Fix**: this command needs an authenticated GitHub CLI. Verify with `gh auth status`; if it is not logged in, run `gh auth login` first. `gh api` refuses to run unauthenticated — measured: exit 4, nothing on stdout, and *"To get started with GitHub CLI, please run: gh auth login"* on stderr — which the command surfaces as "no activity" rather than an error. It is also a separate, manual step: the commit hook never calls it.

#### Why eligibility is the trailer alone

No tool judges whether a trailer describes a milestone. A model-based classifier was tried during
Milestone 3 and removed: on ordinary summaries it scored routine chores above real milestones as often
as below, and the same sentence scored differently from run to run, which makes it a way to lose a real
entry rather than a way to filter noise. The decision to keep or drop a classifier is recorded in the
repository's engineering history, not in this guide, and nothing in the hook consults a model today.

---

## Vault Commands Reference

The vault scripts in `package.json` are divided into read-only verification checks and mutating operations.

### Read-Only Verification Commands

These commands inspect your files, validate schemas, or run tests without modifying notes or pushing changes:

- `npm test`: Runs the automated test suite across parsers, guards, and contracts.
- `npm run typecheck`: Validates TypeScript source files in `06-Resources/scripts/src/`.
- `npm run validate-templates`: Validates all note blueprints and tracked files against the frontmatter schema and tag taxonomy.
- `npm run audit-links`: Audits all internal wikilinks and reports orphan notes. Use `npm run audit-links -- --strict` to exit with an error code if broken links exist.
- `npm run hygiene`: Checks for unclassified records, missing review metadata, and notes outside hub queries.
- `npm run check-rot -- --include-ignored`: Runs the anti-rot sensor across tracked and untracked notes, checking memory capacity, overdue review cycles, and skill regression tests.

### Mutating Operations

These commands write files, update notes, or modify GitHub state:

- `npm run build`: Compiles TypeScript files in `06-Resources/scripts/src/` into single-file CommonJS bundles in `06-Resources/scripts/`.
- `npm run backup`: Creates a timestamped local snapshot archive in `~/.loey_backups/` with a SHA-256 manifest.
- `npm run patch-homepulse`: Verifies call sites and injects the locally owned prelude into `.obsidian/plugins/homepulse/main.js`.
- `npm run distill -- <path>`: Extracts atomic evergreen concepts from the specified note and creates new files in `08-Concepts/`.
- `npm run log-github`: Fetches today's GitHub activity and appends a collapsible summary under `## 📝 Daily Log` in today's daily note. Requires an authenticated `gh` CLI (`gh auth login`) and is never invoked automatically; see the hook symptoms above.
- `npm run sync-kanban`: Runs two-way synchronization between Obsidian Kanban boards and GitHub Projects v2.
- `npm run start-task -- <project> "<title>"`: Converts a Kanban card to a GitHub issue, creates a Git branch, and moves the card to In Progress.

---

## Maintenance Rhythms

To keep the vault organized and performant over time, follow this schedule:

| Interval | Target | Recommended Actions |
| :--- | :--- | :--- |
| **Daily** | `Home.md` and `01-Daily/` | Check the dashboard, review carried tasks in today's daily note, and log evening habit completions. |
| **Weekly** | `00-Inbox/` and `07-Reviews/` | Tag unprocessed items in `quick-capture-dump.md` and run the `Triage Sweep` macro. Run `Weekly Review` to generate the week's retrospective. |
| **Monthly** | `07-Reviews/` and `02-Projects/` | Review `Habit Analytics Dashboard.md` for consistency trends. Move finished project cards to `## Archive`. |
| **Quarterly** | `08-Concepts/` | Open `00-Inbox/_Triage MOC.md` to find concepts past their 90-day review cycle (`review_cycle: 90d`). Refresh insights and update `last_reviewed`. |
