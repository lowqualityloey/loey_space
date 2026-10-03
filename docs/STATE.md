# Project State & Living Execution Tracker

## 1. Executive Summary & Current Position
- **Project Name**: loey_space
- **Current Milestone / Epic**: Wave 2 Group D — #38 kanban task identity (awaiting the owner's identity decision). Group C2 shipped on `fix/wave2-runner-and-write-preservation`
- **Overall Status**: ACTIVE
- **Target Release / Deadline**: Waves 0→5 per `docs/specs/2026-10-04-spec-vault-trust-recovery.md`; tracker [#69](https://github.com/lowqualityloey/loey_space/issues/69)
- **Current Working Branch**: `fix/wave2-runner-and-write-preservation` — 3 commits ahead of `origin/main` @ `e038f6f`, not yet pushed or PR'd. Canonical base is `origin/main`; local `main` is divergent and must never be pushed (see §5)
- **Last Updated**: `2026-10-04`

---

## 2. Milestone & Task Progress

### Milestone Roadmap
- [x] **Wave 0**: P0 #29 runtime-config exclusion (completed 6cf9bf2 → 👉 [PR #70](https://github.com/lowqualityloey/loey_space/pull/70) merged; main synced)
- [x] **Wave 1**: Privacy procedure + hook (COMPLETE — #30 PR #71, #32 PR #72, #33 PR #73, #31+#34+#35 PR #74; all merged, CI green)
- [x] **Wave 2 Group B**: HomePulse ownership + template-write preservation (#36, #37 — 👉 [PR #75](https://github.com/lowqualityloey/loey_space/pull/75) merged)
- [x] **Wave 2 Group C1**: #60 daily-note resolver + #39 concept collisions (👉 [PR #76](https://github.com/lowqualityloey/loey_space/pull/76) merged)
- [x] **Wave 2 Group C2**: #66 tooling (pinned runner + WSL build), #40 triage race, #41 enrich edits — 3 commits on `fix/wave2-runner-and-write-preservation` (`75a724c`, `d0667ba`, `d88a9cf`); suite 69 → 81; PR not yet opened
- [ ] **Wave 2 Group D**: #38 kanban task identity (needs an identity-design decision)
- [ ] **Wave 3**: Recovery + continuity (#42–#47)
- [ ] **Wave 4**: Sync correctness (#48–#49)
- [ ] **Wave 5**: Schema, analytics, workflow, tooling (#50–#68)

### Active Milestone Task Breakdown
Track tasks using atomic checklists (`[x]` Done, `[/]` In Progress, `[ ]` Queued, `[!]` Blocked):

- [x] TASK-2026-10-04-wave0-p0-runtime-config: exclude plugin runtime config (AC-1/2/3 pass; `completed` 6cf9bf2 → 👉 [PR #70](https://github.com/lowqualityloey/loey_space/pull/70) MERGED)
- [x] TASK-2026-10-04-wave1-privacy-hook: privacy procedure + hook (COMPLETE — 7/7 ACs; PRs #71–#74 merged)
- [x] TASK-2026-10-04-wave2-homepulse: HomePulse ownership + template preservation (COMPLETE — 5/5 ACs; PR #75 merged)
- [x] TASK-2026-10-04-wave2-group-c2: #66 pinned runner + WSL build, #40 mid-sweep capture preservation, #41 mid-request edit preservation (COMPLETE — 3 commits, 81/81 tests, PR pending)
- [ ] Wave 2 Group D (#38 kanban identity) — blocked on an identity-design decision from the owner
- [ ] Wave 3 (#42–#47) — blocked: #45 needs the Hermes repo, #46 needs chosen commitments, #42 needs the backup target

---

## 3. Active Working Set
- **Target Workspace / Package (if Monorepo)**: `N/A - standalone repository`
- **Active RFC / Spec**: `docs/specs/2026-10-04-spec-vault-trust-recovery.md` (Draft, grill 5/5 cleared)
- **Active Task Spec**: `None — Wave 2 Group C2 shipped without a Task Record (divergence recorded in §5); Group D record pending (pk:tasks)`
- **Key Source Files in Flight**: `None in flight (checkpoint). Group C2 touched: 06-Resources/scripts/src/lib/{markdown,triage}.ts, src/lib/enrichers/{daily,concept,dev,learning}.ts, src/triage-sweep.ts, plus regenerated bundles ai-enrich-action.js / distill-concept-action.js / triage-sweep.js`
- **Verification Commands (Scoped)**:
  - Secret scan: `bash .githooks/lib/secret-scan.sh --tracked` (exit 0 required) — also `--stdin` for staged content
  - Hook matrices: disposable-repo fixtures for rename/env-variant + placeholder cases
  - Unit Tests: `npm test` — **81 pass** on `fix/wave2-runner-and-write-preservation`; 69 on `origin/main` @ `e038f6f`
  - Bundle build: `npm run build` — **works in WSL after #66**, provided `node_modules` holds this platform's binary. Never share `node_modules` across Windows/WSL; use `rm -rf node_modules && npm ci` per platform, or verify from a Linux-side clone
  - Typecheck: `npm run typecheck`
  - **Clean-clone gate for any bundle change**: `git clone --recurse-submodules --branch <b> . /tmp/x && cd /tmp/x && npm ci && npm run typecheck && npm run build && npm test`, then confirm `git status --short` is empty (committed bundles must be byte-identical to a fresh build)

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
- **Resolved this session**:
  - ~~#66 tooling~~ — pinned `tsx` as a locked devDependency (`npx tsx` was downloading on demand) and documented the per-platform `npm ci`. `npm run build` now succeeds under WSL; verified from a clean linux-x64 clone.
  - ~~`.gitmodules` + `.promptkit/` untracked~~ — registered as a real submodule pinned to release `v1.11.0` (`ae00507`), so the engine is a single gitlink instead of 627 stageable files. Engine content unchanged.
- **Architectural Questions**:
  - Local `main` is divergent: it carries the owner's unpushed commits (`1e885df`, `ed106f0`) plus duplicate re-implementations of already-merged PRs, and omits #75's HomePulse work. Do NOT reset it (that would destroy the owner's unpushed commits). Treat `origin/main` as canonical and branch from it.
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
1. Open a PR for `fix/wave2-runner-and-write-preservation` closing #66, #40 and #41 as one Wave 2 Group C2 unit (precedent: PR #74 carried three issues, PR #76 carried two). The branch is local-only — nothing has been pushed.
2. Ask the owner for the four decisions that gate the rest: **#38** identity scheme (also gates #48), **#45** Hermes repo, **#46** commitments, **#42** backup target.
3. Merge the PromptKit infrastructure branch `chore/promptkit-engine-and-state` (`ae00507` submodule registration, `89e83de` profile + directives) plus the `docs/` tracking commit. Both are independent of the C2 PR and can merge in either order.
4. Create the Wave 2 Group D Task Record before implementing #38, to close the §5 divergence noted for Group C2.
5. Unblocked and ready to start without owner input: **#47** (carry-forward preserves hierarchy + `[/]`), then **#43/#44** (checkpoint contract + registry reconciliation, now that `docs/` is tracked).

---

## 8. Session Continuity Log
Compact record of pairing sessions to enable instant chat resumption:
<!-- Table Invariant: Keep rows strictly contiguous without blank lines; escape literal pipes as \|; use <br> for multi-line cells -->

| Date | Engineer / Agent | Milestone / Focus | Key Changes & Artifacts |
| :--- | :--- | :--- | :--- |
| 2026-10-04 | Sisyphus (agent) | Waves 0–2 Group C1 — vault trust & recovery | Planned #29–#68 as 6 waves after `pk:plan` + 5-probe `pk:grill`; shipped 9 issues across 7 merged PRs (#70–#76): runtime-config exclusion, kanban cache defaults, hook placeholder-wording + rename/env-variant coverage, hook mode 100755, publication-boundary policy, shared CI secret scanner, HomePulse ownership + drift guard, habit-template preservation, daily-note path resolver, curated-concept collision merge. Test suite 45 → 69. Two latent bugs found: a local merge silently reverted #33's hook coverage, and case-insensitive credential matching flagged minified vendor JS. Owner decisions recorded: repo stays public + hardened; no credential rotation; HomePulse vendor path; delete merged branches after merge. |
| 2026-10-04 | Sisyphus (agent) | Wave 2 Group C2 — #66 tooling, #40 triage race, #41 enrich edits | Closed the tracker contract for Group C2 in three atomic commits on `fix/wave2-runner-and-write-preservation` (`75a724c` #66, `d0667ba` #40, `d88a9cf` #41), branched from `origin/main` @ `e038f6f`; nothing pushed. Each fix preceded a failing reproduction: #40 had 2 of 5 new cases fail, #41 had 6 of 6 fail across all four enrichers. Suite 69 to 81, verified from a clean linux-x64 clone with committed bundles byte-identical to a fresh build. Root causes: #40 discarded `vault.process` current content and tracked swept captures by snapshot line index; #41 transformed the pre-request snapshot and wrote the whole file back, so unowned sections and Dataview blocks were lost. Infrastructure: registered `.promptkit` as a submodule pinned to `v1.11.0` (`ae00507`) after finding it declared in `.gitmodules` but never registered, which left 627 engine files stageable by `git add -A`; recorded the real stack in `PROMPTKIT.md` (`89e83de`). Owner decisions honoured: repo stays public and hardened, no history rewrite, no rotation, feature branches only. Two owner-only items still open: the vendored plugin store update and `handoff.md` / `_Reviews MOC` edits were left uncommitted. |

---

## 9. Session Spend Ledger
<!-- Table Invariant: Keep rows strictly contiguous without blank lines; escape literal pipes as \|; use <br> for multi-line cells -->

| Session | Turns | Measured in/out | Estimated context payload | Note |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-04 (waves 0–2 C1) | ~95 | host telemetry unavailable | ~760k–1425k heuristic context payload | duration=~4h wall clock across two sessions; repairs=3 (index.lock clears, one mis-scoped commit recovered, one bundle-regen toolchain failure); interventions=6 owner decisions + 4 branch/PR authorizations; verification=69/69 tests on origin/main @ e038f6f, CI green on 7 PRs; outcome=accepted |
| 2026-10-04 (waves 0-2 C2) | ~6 | host telemetry unavailable | ~48k-90k heuristic context payload | duration=not tracked; repairs=4 (one mis-scoped staged file, one secret-scanner block on a synthetic fixture, one stale .git/modules/.promptkit, one index.lock collision); interventions=1 owner authorisation for the four recommendations; verification=81/81 tests + typecheck exit 0 + build 25ms from a clean clone, shared scanner exit 0, PromptKit reference and token gates pass; outcome=accepted |

- **Running total**: heuristic context payload 808k–1515k tok across 2 rows (lower and upper bounds summed independently; no measured-token total exists — host telemetry unavailable). Avoided rework: not measured. Refreshed by `pk:checkpoint`; keep measured tokens and heuristic context-payload ranges as separate totals and never add them together. One row per real work session (trivial sessions under ~5 turns with no workflow usage write nothing). When host metering is unavailable, compute the lower and upper bounds independently via the heuristic (`turns × 8k` through `turns × 15k tok/turn`) rather than emitting a midpoint or `not measured`.
- **Note evidence**: use `duration=<value>; repairs=<count or not tracked>; interventions=<count or not tracked>; verification=<result or not tracked>; outcome=<accepted | rejected | incomplete | blocked | not tracked>`. Never infer `0`, `passed`, or `accepted` from missing evidence.
- **Evidence boundary**: this ledger is operational telemetry, not CPAC benchmark evidence. Heuristic context payload is not provider billing telemetry or actual spend; avoided rework remains `not measured` without comparative evidence. Preserve historical rows and the five-column shape without silent backfill.
