# Project State & Living Execution Tracker

## 1. Executive Summary & Current Position
- **Project Name**: loey_space
- **Current Milestone / Epic**: Wave 3 — #43 checkpoint contract, #44 registry reconciliation, #45 Hermes bridge, #46 commitments, #47 carry-forward (**#47 shipped**). Wave 2 Group D (#38) remains blocked on the owner's identity decision
- **Overall Status**: ACTIVE
- **Target Release / Deadline**: Waves 0→5 per `docs/specs/2026-10-04-spec-vault-trust-recovery.md`; tracker [#69](https://github.com/lowqualityloey/loey_space/issues/69)
- **Current Working Branch**: `chore/promptkit-engine-and-state` — PromptKit infrastructure, 4 commits, rebased onto `24fc3f3`, **awaiting review** as 👉 [PR #79](https://github.com/lowqualityloey/loey_space/pull/79) (MERGEABLE CLEAN; read the head SHA from the PR — a recorded SHA here would go stale on every amend). `origin/main` is at `24fc3f3` (PRs #77 and #78 squash-merged). Canonical base is `origin/main`; local `main` is divergent and must never be pushed (see §5)
- **Last Updated**: `2026-10-04`

---

## 2. Milestone & Task Progress

### Milestone Roadmap
- [x] **Wave 0**: P0 #29 runtime-config exclusion (completed 6cf9bf2 → 👉 [PR #70](https://github.com/lowqualityloey/loey_space/pull/70) merged; main synced)
- [x] **Wave 1**: Privacy procedure + hook (COMPLETE — #30 PR #71, #32 PR #72, #33 PR #73, #31+#34+#35 PR #74; all merged, CI green)
- [x] **Wave 2 Group B**: HomePulse ownership + template-write preservation (#36, #37 — 👉 [PR #75](https://github.com/lowqualityloey/loey_space/pull/75) merged)
- [x] **Wave 2 Group C1**: #60 daily-note resolver + #39 concept collisions (👉 [PR #76](https://github.com/lowqualityloey/loey_space/pull/76) merged)
- [x] **Wave 2 Group C2**: #66 tooling (pinned runner + WSL build), #40 triage race, #41 enrich edits — merged as [PR #77](https://github.com/lowqualityloey/loey_space/pull/77) (`dc3aa98`); suite 69 → 81
- [x] **Wave 3 (partial)**: #47 hierarchy + `[/]` carry-forward — merged as [PR #78](https://github.com/lowqualityloey/loey_space/pull/78) (`24fc3f3`); suite 81 → 85. #42–#46 remain
- [ ] **Wave 2 Group D**: #38 kanban task identity (needs an identity-design decision)
- [ ] **Wave 3**: Recovery + continuity (#42–#47)
- [ ] **Wave 4**: Sync correctness (#48–#49)
- [ ] **Wave 5**: Schema, analytics, workflow, tooling (#50–#68)

### Active Milestone Task Breakdown
Track tasks using atomic checklists (`[x]` Done, `[/]` In Progress, `[ ]` Queued, `[!]` Blocked):

- [x] TASK-2026-10-04-wave0-p0-runtime-config: exclude plugin runtime config (AC-1/2/3 pass; `completed` 6cf9bf2 → 👉 [PR #70](https://github.com/lowqualityloey/loey_space/pull/70) MERGED)
- [x] TASK-2026-10-04-wave1-privacy-hook: privacy procedure + hook (COMPLETE — 7/7 ACs; PRs #71–#74 merged)
- [x] TASK-2026-10-04-wave2-homepulse: HomePulse ownership + template preservation (COMPLETE — 5/5 ACs; PR #75 merged)
- [x] TASK-2026-10-04-wave2-group-c2: #66 pinned runner + WSL build, #40 mid-sweep capture preservation, #41 mid-request edit preservation (COMPLETE — 3 commits, 81/81 tests, 👉 [PR #77](https://github.com/lowqualityloey/loey_space/pull/77) merged)
- [ ] Wave 2 Group D (#38 kanban identity) — blocked on an identity-design decision from the owner
- [ ] Wave 3 (#42–#47) — blocked: #45 needs the Hermes repo, #46 needs chosen commitments, #42 needs the backup target

---

## 3. Active Working Set
- **Target Workspace / Package (if Monorepo)**: `N/A - standalone repository`
- **Active RFC / Spec**: `docs/specs/2026-10-04-spec-vault-trust-recovery.md` (Draft, grill 5/5 cleared)
- **Active Task Spec**: `None — Group C2 and #47 shipped without a Task Record (divergence recorded in §5); the next unit needs one before implementation (pk:tasks)`
- **Key Source Files in Flight**: `None in flight (checkpoint). In flight for the infrastructure branch: .gitmodules, .promptkit (gitlink → v1.11.0), PROMPTKIT.md §2/§3, AGENTS.md/CLAUDE.md/GEMINI.md directives, .github/ templates, docs/STATE.md`
- **Verification Commands (Scoped)**:
  - Secret scan: `bash .githooks/lib/secret-scan.sh --tracked` (exit 0 required) — also `--stdin` for staged content
  - Hook matrices: disposable-repo fixtures for rename/env-variant + placeholder cases
  - Unit Tests: `npm test` — **85 pass** on `origin/main` @ `24fc3f3`; 69 at the pre-merge base `e038f6f`
  - Bundle build: `npm run build` — **works in WSL after #66**, provided `node_modules` holds this platform's binary. Never share `node_modules` across Windows/WSL; use `rm -rf node_modules && npm ci` per platform, or verify from a Linux-side clone
  - Typecheck: `npm run typecheck`
  - Templates: `npm run validate-templates` — 19/19
  - **Clean-clone gate for any bundle change**: `git clone --recurse-submodules --branch <b> . /tmp/x && cd /tmp/x && npm ci && npm run typecheck && npm run build && npm test`, then confirm `git status --short` is empty (committed bundles must be byte-identical to a fresh build)
  - **Test counts are per-branch**: a PR branched off `main` reads N, but N+gain after its dependency merges. Quote the isolated number in the PR and the combined number only for the merged state

---

## 3A. Execution-Control Projection (Optional)

> This section is a synchronized projection for checkpoint continuity when the host project uses Controlled Work. The canonical authority remains `docs/tasks/<task-id>.md`; disagreement with that record is a validation failure and leaves execution blocked or `checkpoint_due` until reconciled.

- **Local Task Source**: `docs/tasks/<task-id>.md`
- **Task ID**: `TASK-<task-slug>` (preserve `TASK-YYYY-MM-DD-<slug>` for legacy/`none`-profile records)
- **Task Record**: `docs/tasks/<task-id>.md`
- **Specification**: `docs/specs/[specification].md`
- **Execution Scope**: `[Repository, workspace, package, or session boundary]`
- **Execution State**: `[planned | ready | in_progress | checkpoint_due | blocked | paused | handoff_ready | awaiting_review | completed | aborted]`
- **Mapped `pk:tasks` Status**: `[To Do | In Progress | In Review | Done]`
- **Active Task Pointer**: `[Task ID while active, otherwise None]`
- **Owner / Current Actor**: `[Person, role, agent, or session]`
- **Start Time**: `[YYYY-MM-DD HH:MM UTC or N/A]`
- **Current Branch**: `[Branch name]`
- **Current Revision**: `[Exact commit or revision]`
- **Checkpoint Policy**: `[Soft/hard intervals, event triggers, and host timer capability/limitation]`
- **Blockers and Resume Condition**: `[Blocker, owner, evidence, and precise condition, or None]`
- **Verification Status**: `[Commands, results, and timestamp]`
- **CI Evidence**: `[Provider, workflow/job, run, revision, result, or N/A]`
- **Changed-File Summary**: `[Current working set summary]`
- **Latest Checkpoint**: `[Record path or None]`
- **Latest Handoff**: `[Record path or None]`
- **Next Action**: `[Exactly one prioritized action]`

---

## 3B. Release-Evaluation Handoff (Optional)

> Use this projection only when PromptKit OS release evaluation is being handed from QA/Reviewer to a Release Coordinator. It is a durable handoff, not approval, and the canonical evaluation or Task Record remains authoritative.

- **Evaluation ID**: `[evaluation ID or N/A]`
- **Release Candidate Commit**: `[exact candidate revision or N/A]`
- **Preliminary SemVer Candidate**: `[preliminary version, including prerelease identifier when applicable, or N/A]`
- **QA/Reviewer Result**: `[Pass | Fail | Pending | N/A]`
- **Unresolved Blockers**: `[blocker, owner, and resolution condition, or None]`
- **Requested Release Coordinator Decision / Next Approval Action**: `[exact human decision requested, or N/A]`
- **Handoff Status**: `[Ready for Coordinator Review | Blocked | Deferred | N/A]`
- **Approval Boundary**: `This projection does not approve a candidate or version and does not authorize tag creation, hosted release creation, changelog publication, remote operations, deployment, or rollback.`
- **Source Evaluation / Task Record**: `[authoritative record path or N/A]`

---

## 4. Locked Technical Invariants (Do Not Undo)
Document non-negotiable architectural decisions agreed upon during pairing sessions:
- **Repository stays public**; the publication boundary is hardened and documented rather than the repo being made private (owner decision 2026-10-03, issue #31).
- **Irreversible git/credential actions are owner-only decisions**: history rewrites, visibility changes, and credential rotation are recorded, never executed automatically by an agent or script.
- **Work lands on feature branches, never `main`**: `origin/main` is canonical; local `main` is divergent and must never be pushed (see §5).
- **A credential scanner is one shared implementation**: `.githooks/lib/secret-scan.sh` serves both the local hook and CI so they cannot drift; the hook fails closed if the library is missing.
- **Credential matching is case-sensitive** — the shapes are case-sensitive in reality, and case-insensitive matching false-positives on minified vendor JS.
- **Dated observations live in dated notes only**: habit/checkbox completion never writes `99-Templates/*`; templates hold unchecked defaults.
- **HomePulse's readable prelude is the locally owned seam**; the minified core is upstream and must not be hand-edited. Provenance is recorded in `06-Resources/Guides/Plugin Ownership.md`.
- **Preserve-before-write for generated knowledge**: concept distillation merges into an existing note inside a marked region instead of replacing it.
- **Never invent missing source or state**: absent HomePulse source was recorded as a blocker with search evidence rather than reconstructed.

---

## 4A. Candidate Learnings (Unpromoted)

Staging area for rules observed during sessions but not yet approved as invariants. Entries here are **never pre-filled** and are non-authoritative: agents must not treat them as policy, quote them as invariants, or copy them into project guardrails. Promotion requires a recorded human decision (`approved` / `rejected` / `deferred`) with approver, date, evidence reference, and destination (see `protocols/context-sync.md` §3.1).

| Date | Proposed Rule | Source / Evidence | Scope | Status | Human Decision (approver, date, destination) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| not tracked | not tracked | not tracked | not tracked | not tracked | not tracked |

---

## 5. Known Blockers, Risks & Open Questions
- **Blockers**:
  - [#38 kanban identity](https://github.com/lowqualityloey/loey_space/issues/38) — needs an owner decision on the task-identity scheme; a wrong scheme silently stops syncing existing board cards and daily tasks. This also gates #48 (Wave 4), which matches cards to remote items.
  - [#45](https://github.com/lowqualityloey/loey_space/issues/45) — no Hermes-named record exists in the vault; needs the owner to name the authoritative repo/record.
  - [#46](https://github.com/lowqualityloey/loey_space/issues/46) — needs the owner to choose which personal/learning commitments to promote.
  - [#42](https://github.com/lowqualityloey/loey_space/issues/42) — needs the owner's actual private backup target to run a real restore drill.
- **Resolved**:
  - ~~#66 tooling~~ — pinned `tsx` as a locked devDependency (`npx tsx` was downloading on demand) and documented the per-platform `npm ci`. `npm run build` now succeeds under WSL; verified from a clean linux-x64 clone. Merged in #77.
  - ~~#40 / #41~~ — triage identity moved off snapshot line indexes and both rewrite against current content; all four enrichers share one current-content seam and one conflict policy. Merged in #77.
  - ~~#47 carry-forward~~ — `[/]` tasks and nested criteria now survive the night. Merged in #78.
  - ~~`.gitmodules` + `.promptkit/` untracked~~ — registered as a real submodule pinned to release `v1.11.0` (engine SHA `69ce4fc`; registering commit `ae00507` on the infra branch, replayed as `6058f9b`), so the engine is a single gitlink instead of 627 stageable files. Engine content unchanged.
- **Architectural Questions**:
  - Local `main` is divergent: it carries the owner's unpushed commits (`1e885df`, `ed106f0`) plus duplicate re-implementations of already-merged PRs, and omits #75's HomePulse work. Do NOT reset it (that would destroy the owner's unpushed commits). Treat `origin/main` as canonical and branch from it.
  - **Operational consequence — never let Git tooling build a base on local `main`.** `but setup` did exactly that: it based its workspace on this divergent line (workspace commit `8634c60`, parent `ed106f0`), not on `origin/main` and not on the checked-out branch. The workspace tree lost `.gitmodules` and 60 files' worth of merged work, and a `but push` from there would have published the owner's unpushed commits. Reverted with `but teardown --checkout-to <branch>`. For this repo, rebase with plain `git rebase origin/main`; verify `git merge-base --is-ancestor origin/main HEAD` before continuing.
  - Group C2 shipped without the `docs/tasks/` Task Record that L2 Controlled work calls for. Accepted for now because the tracker contract supplied the per-issue acceptance criteria and one-commit-per-issue boundary; record the Task Record before Group D.
  - `PROMPTKIT.md` §2/§3 held intake placeholders (naming `pnpm` where the lockfile makes npm canonical). Now recorded from detection per ASSUMPTION-006 `legacy-partial` (`89e83de`). Note `tsconfig.json` is `strict: false` with `noImplicitAny: true` — do not describe the project as strict TypeScript.
- **Technical Debt & Risks**:
  - Vendored plugin files (~10 plugins, incl. QuickAdd 2.24.2 → 2.30.0) are modified-but-uncommitted in the working tree from a store update; unrelated to agent work and must not ride along in an agent commit.
  - `.obsidian/plugins/obsidian-local-rest-api/` is installed but untracked. `data.json` is correctly excluded by `.gitignore:11` and the tracked tree scans clean, but `main.js` (4.2 MB) is stageable — keep it out of agent commits unless the owner asks.
  - A background process outside WSL repeatedly leaves a stale `index.lock`, forcing lock clears before index writes. It cost one failed `git -C .promptkit checkout` this session; clear only after confirming no live git process.
  - `06-Resources/scripts/tests/triage-parsing.test.mjs` re-implements the capture parser locally instead of importing `src/lib/triage.ts`, so it tests a copy with a different token regex. It gives false confidence and should be repointed or deleted (not done — outside the #40 scope).

---

## 6. Recent Architectural Decisions (ADR Log)
| Date | Title & Scope | Decision Summary | ADR File |
| :--- | :--- | :--- | :--- |
| not tracked | not tracked | not tracked | not tracked |

---

## 7. Next Immediate Actions (Queued)
1. **Review and merge the PromptKit infrastructure branch** — 👉 [PR #79](https://github.com/lowqualityloey/loey_space/pull/79) (`chore/promptkit-engine-and-state`, 4 commits, MERGEABLE CLEAN): submodule registration, project profile + agent directives, `docs/` tracking, post-merge checkpoint. Rebased onto `24fc3f3`; its single README troubleshooting collision with #77 resolved as a **union** — both sides only *added* a row at the same insertion point, so both rows are kept. A human merges; nothing else is blocked on it.
2. **Four owner decisions gate the rest**: **#38** identity scheme (also gates #48), **#42** private backup target, **#45** Hermes authoritative repo, **#46** which commitments to promote.
3. **Create a Task Record before the next implementation unit.** #47 and Group C2 both shipped without one (§5). Recommended order once unblocked: **#43** (checkpoint/closeout contract — roughly half is already satisfied by this checkpoint and the `docs/` tracking), then **#44** (registry reconciliation + resume drills), then #47's siblings #42/#45/#46.
4. **Housekeeping, owner-run**: `fix/wave2-runner-and-write-preservation` and `fix/daily-carry-forward` were **squash-merged**, so their commits are not ancestors of `main` and `git branch -d` will refuse. Prune with `git branch -D` if wanted; the content is verified present in `origin/main`.

---

## 8. Session Continuity Log
Compact record of pairing sessions to enable instant chat resumption:
<!-- Table Invariant: Keep rows strictly contiguous without blank lines; escape literal pipes as \|; use <br> for multi-line cells -->

| Date | Engineer / Agent | Milestone / Focus | Key Changes & Artifacts |
| :--- | :--- | :--- | :--- |
| 2026-10-04 | Sisyphus (agent) | Waves 0–2 Group C1 — vault trust & recovery | Planned #29–#68 as 6 waves after `pk:plan` + 5-probe `pk:grill`; shipped 9 issues across 7 merged PRs (#70–#76): runtime-config exclusion, kanban cache defaults, hook placeholder-wording + rename/env-variant coverage, hook mode 100755, publication-boundary policy, shared CI secret scanner, HomePulse ownership + drift guard, habit-template preservation, daily-note path resolver, curated-concept collision merge. Test suite 45 → 69. Two latent bugs found: a local merge silently reverted #33's hook coverage, and case-insensitive credential matching flagged minified vendor JS. Owner decisions recorded: repo stays public + hardened; no credential rotation; HomePulse vendor path; delete merged branches after merge. |
| 2026-10-04 | Sisyphus (agent) | Wave 2 Group C2 — #66 tooling, #40 triage race, #41 enrich edits | Closed the tracker contract for Group C2 in three atomic commits on `fix/wave2-runner-and-write-preservation` (`75a724c` #66, `d0667ba` #40, `d88a9cf` #41), branched from `origin/main` @ `e038f6f`; nothing pushed. Each fix preceded a failing reproduction: #40 had 2 of 5 new cases fail, #41 had 6 of 6 fail across all four enrichers. Suite 69 to 81, verified from a clean linux-x64 clone with committed bundles byte-identical to a fresh build. Root causes: #40 discarded `vault.process` current content and tracked swept captures by snapshot line index; #41 transformed the pre-request snapshot and wrote the whole file back, so unowned sections and Dataview blocks were lost. Infrastructure: registered `.promptkit` as a submodule pinned to `v1.11.0` (`ae00507`) after finding it declared in `.gitmodules` but never registered, which left 627 engine files stageable by `git add -A`; recorded the real stack in `PROMPTKIT.md` (`89e83de`). Owner decisions honoured: repo stays public and hardened, no history rewrite, no rotation, feature branches only. Two owner-only items still open: the vendored plugin store update and `handoff.md` / `_Reviews MOC` edits were left uncommitted. |
| 2026-10-04 | Sisyphus (agent) | Wave 2 Group C2 close-out, #47, PromptKit infrastructure | Shipped four issues as two PRs, both squash-merged: PR #77 (#66 pinned runner, #40 triage identity, #41 enricher writes) and PR #78 (#47 carry-forward). Suite 69 to 85 on merged main @ `24fc3f3`, verified from a clean clone with bundles byte-identical to a fresh build. Each fix preceded a failing reproduction (#47: 3 of 4 new cases failed; #40: 2 of 5; #41: 6 of 6). PromptKit infrastructure on `chore/promptkit-engine-and-state`: engine registered as a submodule pinned to `v1.11.0` with zero content change after a stale partial registration was found; project profile corrected from `pnpm` to npm and from `strict: false` recorded honestly; `docs/` now tracked. Corrections made against my own work this session: predicted the two PromptKit branches would merge in any order (they do not - README collides), and quoted 85 tests on PR #78 when that branch alone reads 73. Owner-only items untouched: vendored plugin store update (28 files), `handoff.md`, `_Reviews MOC`, and the divergent local `main` @ `e96e4f3`. |
| 2026-10-04 | Sisyphus (agent) | Rebase + PR for the PromptKit infrastructure branch | Rebased `chore/promptkit-engine-and-state` onto `24fc3f3` and opened 👉 [PR #79](https://github.com/lowqualityloey/loey_space/pull/79) (4 commits, MERGEABLE CLEAN). The predicted single README conflict landed exactly as scoped and resolved as a **union** — both sides only added a troubleshooting row at the same insertion point, so both rows were kept and the `CONTRIBUTING.md#clean-install-first` anchor verified. Two hazards found and reverted before any damage. First, `but setup` built its workspace on the **divergent local `main`** (workspace commit `8634c60`, parent `ed106f0`) rather than on `origin/main` or the checked-out branch: the workspace tree lost `.gitmodules` and 60 files of merged work, and `but pull` would have rebased the owner's unpushed commits instead of the target branch. Reverted with `but teardown --checkout-to`; the rebase was then done with plain `git rebase origin/main` and linearity proven with `git merge-base --is-ancestor`. Second, `.promptkit` could not be `rmdir`'d on `/mnt/c`, so the base checkout aborted mid-way and produced a phantom "local changes to README.md" error; fixed by parking the disposable worktree copy (content preserved in `.git/modules/.promptkit`) and restoring with `git submodule update --init --recursive`. Verified from a clean `git clone --recurse-submodules` at the final SHA: 85/85 tests, typecheck exit 0, build 37ms, `git status` 0 lines (bundles byte-identical), shared scanner exit 0, templates pass, PromptKit reference + token gates pass (Balanced 2350/2500, Lite 1286/1500). Corrected four `docs/STATE.md` inaccuracies (commit count 3→4 in §1 and §7, Group C2 "PR pending" → PR #77 merged, submodule engine SHA `69ce4fc` disambiguated from the registering commit) and recorded the GitButler trap in §5. Local `main` never reset and never pushed; `origin/main` still `24fc3f3`. Owner-only items left uncommitted: vendored plugin store update (29 files), `handoff.md`, `07-Reviews/_Reviews MOC.md`. Corrections made against my own claims this session: I first attributed the GitButler hazard to a stale `gitbutler/target`, then disproved that by checking the workspace commit's parent and corrected it to the local-`main` base. |

---

## 9. Session Spend Ledger
<!-- Table Invariant: Keep rows strictly contiguous without blank lines; escape literal pipes as \|; use <br> for multi-line cells -->

| Session | Turns | Measured in/out | Estimated context payload | Note |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-04 (waves 0–2 C1) | ~95 | host telemetry unavailable | ~760k–1425k heuristic context payload | duration=~4h wall clock across two sessions; repairs=3 (index.lock clears, one mis-scoped commit recovered, one bundle-regen toolchain failure); interventions=6 owner decisions + 4 branch/PR authorizations; verification=69/69 tests on origin/main @ e038f6f, CI green on 7 PRs; outcome=accepted |
| 2026-10-04 (waves 0-2 C2) | ~6 | host telemetry unavailable | ~48k-90k heuristic context payload | duration=not tracked; repairs=4 (one mis-scoped staged file, one secret-scanner block on a synthetic fixture, one stale .git/modules/.promptkit, one index.lock collision); interventions=1 owner authorisation for the four recommendations; verification=81/81 tests + typecheck exit 0 + build 25ms from a clean clone, shared scanner exit 0, PromptKit reference and token gates pass; outcome=accepted |
| 2026-10-04 (merge + #47 + promptkit infra) | ~4 | host telemetry unavailable | ~32k-60k heuristic context payload | duration=not tracked; repairs=3 (two test-harness bugs caught before trusting a reproduction, one stale submodule registration); interventions=1 owner authorisation for the four recommendations; verification=85/85 tests + typecheck exit 0 + build 28ms on merged main @ 24fc3f3 from a clean clone, shared scanner exit 0, PromptKit reference and token gates pass; outcome=accepted |
| 2026-10-04 (rebase + promptkit infra PR) | ~30 | host telemetry unavailable | ~240k-450k heuristic context payload | duration=not tracked; repairs=2 (one `but setup` that based the workspace on the divergent local `main` instead of `origin/main`, caught before any commit or push and reverted with `but teardown --checkout-to`; one `.promptkit` rmdir permission denial on `/mnt/c` that aborted the base checkout and produced a phantom "local changes" error, fixed by parking the disposable worktree copy and restoring with `git submodule update`); interventions=1 owner authorisation for the recommended path + 1 continuation directive; verification=85/85 tests + typecheck exit 0 + build 37ms from a clean `git clone --recurse-submodules` at the branch tip with `git status --short` 0 lines, shared scanner exit 0, templates pass, PromptKit reference and token gates pass, PR #79 MERGEABLE CLEAN; outcome=not tracked (PR #79 open, awaiting owner review) |

- **Running total**: heuristic context payload 1080k–2025k tok across 4 rows (lower and upper bounds summed independently; no measured-token total exists — host telemetry unavailable). Avoided rework: not measured. Refreshed by `pk:checkpoint`; keep measured tokens and heuristic context-payload ranges as separate totals and never add them together. One row per real work session (trivial sessions under ~5 turns with no workflow usage write nothing). When host metering is unavailable, compute the lower and upper bounds independently via the heuristic (`turns × 8k` through `turns × 15k tok/turn`) rather than emitting a midpoint or `not measured`.
- **Note evidence**: use `duration=<value>; repairs=<count or not tracked>; interventions=<count or not tracked>; verification=<result or not tracked>; outcome=<accepted | rejected | incomplete | blocked | not tracked>`. Never infer `0`, `passed`, or `accepted` from missing evidence.
- **Evidence boundary**: this ledger is operational telemetry, not CPAC benchmark evidence. Heuristic context payload is not provider billing telemetry or actual spend; avoided rework remains `not measured` without comparative evidence. Preserve historical rows and the five-column shape without silent backfill.
