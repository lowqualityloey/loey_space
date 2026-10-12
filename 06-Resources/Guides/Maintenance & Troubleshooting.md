---
created: 2026-10-12
updated: 2026-10-13
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

Fixes for the problems this vault produces most often, written as **symptom → action → expected result**, followed by the command reference and the routine maintenance schedule.

## Symptoms, Actions and Expected Results

### API keys and AI notices

- **Symptom**: a `⚠️ GEMINI_API_KEY missing in .env!` notice appears.
  - **Action**: `cp .env.example .env`, then add a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
  - **Expected result**: the notice stops and the AI commands run. AI is optional; note creation, habits, task boards and search work without a key.
- **Symptom**: the AI summary reads flat, with a notice about quota limits (HTTP 429).
  - **Action**: wait for the quota to clear — per-minute limits reset after about a minute, daily limits at midnight Pacific Time — then re-run the command.
  - **Expected result**: the command completes normally. While the quota is exhausted the daily enricher writes a flat summary from your logged bullets, and the weekly review stops without creating or overwriting files.

### Plugins and the interface

- **Symptom**: changes to bundled plugins or CSS snippets have no effect.
  - **Action**: `Ctrl + P` (or `Cmd + P`) → **Reload app without saving**.
  - **Expected result**: Obsidian reloads plugin code and snippets, which it only reads at startup.
- **Symptom**: HomePulse loses habit sync, focus synchronization, or its tech tree views.
  - **Action**: the plugin was replaced by a Community Store update. Restore `.obsidian/plugins/homepulse/` from Git history, run `npm run patch-homepulse` to re-verify the locally owned prelude, and set **Settings → Community plugins → Auto-update plugins: OFF**.
  - **Expected result**: the dashboard regains habit and focus sync. See [Plugin Ownership](Plugin%20Ownership.md) for the patch procedure.
- **Symptom**: habit toggles in the dashboard do not update the daily note.
  - **Action**: confirm today's note exists at `01-Daily/YYYY-MM/YYYY-MM-DD.md` (or the legacy `01-Daily/YYYY-MM-DD.md`), that it has a `## 🔁 Habits` heading with checkboxes, and that Dataview is enabled.
  - **Expected result**: toggling a habit writes through to the note. Without the note or the heading there is nothing to sync.
- **Symptom**: the HomePulse dashboard looks cramped on a phone.
  - **Action**: **Settings → Appearance → CSS snippets** → enable `homepulse-mobile`.
  - **Expected result**: the dashboard reflows for the narrow screen.

### Platform and script errors

- **Symptom**: `npm run build` fails with `you installed esbuild for another platform`.
  - **Action**: `node_modules` was installed for a different operating system than the current shell (native Windows versus WSL, for example). Install it per platform instead of sharing one directory:
    ```bash
    rm -rf node_modules
    npm ci
    ```
  - **Expected result**: the build succeeds in that shell. Never share one `node_modules` directory between operating systems.
- **Symptom**: a DataviewJS block throws `TypeError: dv.load is not a function`.
  - **Action**: replace `dv.load` with one of the two supported methods — `await dv.io.load(path)` to read raw file text, or `await dv.view(path, input)` to execute a view script.
  - **Expected result**: the block renders.

### Git hooks and milestone logging

The `post-commit` hook records a milestone in today's daily note and in `handoff.md`. It is opt-in per commit, so most of the entries below only matter for a commit you expected to be logged. It never changes a commit's outcome: it reports what it could not do and the commit stands.

[Git Hooks Guide](Git%20Hooks%20Guide.md) documents the mechanism — activation, permissions, settings, coordination, duplicates and recovery. The entries here cover the symptoms themselves.

- **Symptom**: a commit that should have been logged left no entry.
  - **Action**: check these, in order.
    1. **Is the hook active?** `git config --get core.hooksPath` must print `.githooks`. Cloning does not activate hooks; set it with `git config --local core.hooksPath .githooks`.
    2. **Did the message opt in?** `git log -1 --pretty=%B | grep '^HeyLoey-Milestone:'`. The subject line is never logged, and an empty trailer is not enough.
    3. **Is the file executable?** `test -x .githooks/post-commit && echo yes`. Git skips a hook it cannot execute; the [Git Hooks Guide](Git%20Hooks%20Guide.md#executable-permissions) covers the Windows and WSL case.
    4. **Can the hook find its tool?** `command -v node`. The hook runs the repository's own bundle and skips silently without Node; there is nothing to install and no PATH to fix.
    5. **Do the records exist?** `npm run heyloey -- brief` reports `memory.md`, `handoff.md` and today's daily note. `done` refuses without both records — it never scaffolds a note.
    6. **Was it already logged?** A summary already logged today by this clone is skipped rather than duplicated. The ledger holds those keys (`git rev-parse --git-path heyloey-milestones`); deleting it allows a repeat, and the [Git Hooks Guide](Git%20Hooks%20Guide.md#duplicate-handling) explains the boundary of that promise.
  - **Expected result**: once a step fails, its fix is the action; when all six pass, the next opted-in commit writes the entry. If the hook printed a skip notice instead, the notice names the case, and the [Git Hooks Guide](Git%20Hooks%20Guide.md#coordination) explains each one.
- **Symptom**: `post-commit: milestone not logged (logger exit 1) — the commit is unaffected`, followed by `daily note is absent` or `handoff.md is absent`.
  - **Action**: `npm run init:vault` to create `handoff.md`, and open today's note from `99-Templates/Daily.md`.
  - **Expected result**: the next commit logs normally. Until both records exist there is nowhere established to write, so the hook refuses rather than inventing a structure.
- **Symptom**: the commit was delayed, or the hook reported an interruption and the shell shows exit 130 or 143.
  - **Action**: nothing is broken. The commit object is written before the hook runs, and an opted-in commit waits for the logger only up to `heyloey.timeout`. If a slow run keeps recurring, raise the bound:
    ```bash
    git config --get heyloey.timeout       # read the current value
    git config --local heyloey.timeout 30  # set it to 30 seconds
    ```
  - **Expected result**: the commit lands either way, and the wait stays capped by the value you set. `git config --get` only reads a value; the `--local` form with a value is what changes it.
- **Symptom**: today's note or `handoff.md` holds a half-finished entry, or the same milestone appears twice with different times.
  - **Action**: the logger writes the daily note first and `handoff.md` second, so a run stopped between the two writes leaves one record and not the other. Finish the entry by hand: remove the line that has no counterpart in the other record, then write the missing half with `npm run heyloey -- done "<summary>"`.
  - **Expected result**: both records hold one entry. Note that `heyloey done` writes those two records and nothing else — it neither reads nor updates the hook's ledger, so the summary is not marked as logged and a later hook invocation carrying the same trailer may log it again. Re-run the hook (`git commit --amend --no-edit`) instead if you want the ledger to record it. A retry in a later minute can add a second, differently-timestamped line; a retry inside the same minute is suppressed. [Git Hooks Guide](Git%20Hooks%20Guide.md#partial-write-recovery) has the ordered procedure.
- **Symptom**: the coordination lock is left behind, or runs keep reporting that another invocation is logging.
  - **Action**: only a run killed outright (`SIGKILL`, power loss) leaves a lock; `SIGINT` and `SIGTERM` are handled. Resolve the path instead of hardcoding it — `.git` is a file, not a directory, in a linked worktree — and run this from inside the checkout:
    ```bash
    lock="$(git rev-parse --git-path heyloey-milestones.lock)"
    rm -rf "$lock"
    ```
    Confirm no writer is running before you remove anything. Remove the `.reclaim` claim only together with the lock, and only when nothing is running: `rm -rf "$(git rev-parse --git-path heyloey-milestones.lock.reclaim)"`.
  - **Expected result**: the next commit logs normally. A live holder's lock is never stolen, at any age, so if the notice says the lock is held, that run is still active and the next attempt should be made later. [Git Hooks Guide](Git%20Hooks%20Guide.md#coordination) explains why reclaiming takes two proofs.
- **Symptom**: `post-commit: a milestone writer (pid 1234) from a killed hook is still running — not logged; stop that process, …`
  - **Action**: stop the writer the notice names (`kill <pid>`), then check `## 📝 Daily Log` in today's note and `### Latest Updates` in `handoff.md` for what it managed to write.
  - **Expected result**: if the entry is complete in both records, remove the lock and stop; nothing needs re-logging. If it is missing, re-run the commit or run `npm run heyloey -- done "<summary>"` — the CLI does not touch the hook's ledger, so the summary stays eligible for a later hook run. A `SIGKILL`ed hook also leaves an inert capture file beside the lock, which is safe to remove:
    ```bash
    gitdir="$(dirname "$(git rev-parse --git-path heyloey-milestones)")"
    rm -f "$gitdir"/heyloey-postcommit.*.out
    ```
- **Symptom**: `post-commit: the coordination lock cannot be reclaimed safely: its writer is unaccounted for (… records 'pending' …)`.
  - **Action**: the hook was killed in the interval between announcing a writer and recording its pid, so no writer can be ruled out. Confirm no writer is running (a `node` process writing today's note, or a recent capture file in the lock's directory), then remove the lock by hand as above.
  - **Expected result**: the next commit logs normally. A lock with no writer record at all — what an older hook version leaves — is treated the same way.
- **Symptom**: `npm run log-github` reports no GitHub activity on a day you worked.
  - **Action**: `gh auth status`, then `gh auth login` if it is not authenticated. This is a manual step: the commit hook never calls it.
  - **Expected result**: the command lists today's commits and pull requests under `## 📝 Daily Log`. Unauthenticated, it reports no activity rather than an error worth acting on.

---

## Vault Commands Reference

The scripts in `package.json` divide into read-only verification checks and mutating operations.

### Read-Only Verification Commands

These inspect files, validate schemas, or run tests without modifying notes or pushing changes:

- `npm test`: Runs the automated suite across parsers, guards, and contracts.
- `npm run typecheck`: Validates TypeScript sources in `06-Resources/scripts/src/`.
- `npm run validate-templates`: Validates note blueprints and tracked files against the frontmatter schema and tag taxonomy.
- `npm run audit-links`: Audits internal wikilinks and reports orphan notes. Add `-- --strict` to exit with an error code when links are broken.
- `npm run hygiene`: Checks for unclassified records, missing review metadata, and notes outside hub queries.
- `npm run check-rot -- --include-ignored`: Runs the anti-rot check across tracked and untracked notes: memory capacity, overdue review cycles, and skill regression tests.

### Mutating Operations

These write files, update notes, or modify GitHub state:

- `npm run build`: Compiles TypeScript sources into single-file CommonJS bundles in `06-Resources/scripts/`.
- `npm run backup`: Creates a timestamped snapshot in `~/.loey_backups/` with a SHA-256 manifest.
- `npm run patch-homepulse`: Verifies call sites and injects the locally owned prelude into `.obsidian/plugins/homepulse/main.js`.
- `npm run distill -- <path>`: Extracts evergreen concepts from a note into `08-Concepts/`.
- `npm run log-github`: Appends today's GitHub activity under `## 📝 Daily Log` in today's note. Requires an authenticated `gh` CLI and is never invoked automatically.
- `npm run sync-kanban`: Runs two-way synchronization between Obsidian Kanban boards and GitHub Projects v2.
- `npm run start-task -- <project> "<title>"`: Converts a Kanban card to a GitHub issue, creates a Git branch, and moves the card to In Progress.

---

## Maintenance Rhythms

| Interval | Target | Recommended Actions |
| :--- | :--- | :--- |
| **Daily** | `Home.md` and `01-Daily/` | Check the dashboard, review carried tasks in today's note, and log evening habit completions. |
| **Weekly** | `00-Inbox/` and `07-Reviews/` | Tag unprocessed items in `quick-capture-dump.md` and run the `Triage Sweep` macro. Run `Weekly Review` to generate the week's retrospective. |
| **Monthly** | `07-Reviews/` and `02-Projects/` | Review `Habit Analytics Dashboard.md` for consistency trends. Move finished project cards to `## Archive`. |
| **Quarterly** | `08-Concepts/` | Open `00-Inbox/_Triage MOC.md` to find concepts past their 90-day review cycle (`review_cycle: 90d`). Refresh them and update `last_reviewed`. |
