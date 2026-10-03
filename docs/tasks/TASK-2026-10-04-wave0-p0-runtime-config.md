# Task Record: Wave 0 P0 — Exclude plugin runtime configuration from Git

<a id="TASK-2026-10-04-wave0-p0-runtime-config"></a>

## 1. Identity and Authority

- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-10-04-wave0-p0-runtime-config`
- **PromptKit Adaptation Profile** *(Optional; choose `none` for the legacy contract or `sdlc-overlay-v1` to validate the Adaptation fields below)*: `none`
- **Work Type** *(Required for `sdlc-overlay-v1`; choose Code Work, Documentation Work, Configuration Work, or Research Work)*: `Configuration Work`
- **Planning Record Link** *(Required for `sdlc-overlay-v1`; use the stable planning ID and matching explicit anchor)*: `N/A`
- **Planning Depth Reference** *(Optional for `sdlc-overlay-v1`; use Minimal, Full, or N/A)*: `N/A`
- **Assumption Record Links** *(Optional for `sdlc-overlay-v1`; use comma-separated stable links, None, or N/A)*: `N/A`
- **Specification**: `docs/specs/2026-10-04-spec-vault-trust-recovery.md`
- **External Reference (Optional)**: `👉 [GitHub issue #29 — P0 runtime configuration exclusion](https://github.com/lowqualityloey/loey_space/issues/29)`
- **Owner / Actor**: `Jonell Balanay (owner) / implementing agent (TBD at start)`
- **Execution Scope**: `loey_space repository working tree (Obsidian vault); disposable scratch repo for fixture verification`
- **Approval Boundary**: `Owner authorizes implementation start, PR creation/merge, and any history/visibility-adjacent action (none in this task — #31 decides separately)`
- **Created**: `2026-10-04 02:30 UTC`

> This Local Task Source is authoritative for Controlled Work. Planning Record and Assumption Record links provide context only; they do not control readiness, execution state, active ownership, completion, or approval. Existing records remain valid when these optional traceability fields are absent.
>
> The optional `PromptKit Adaptation Profile` selects validation scope: absent or `none` preserves the legacy dated Task ID and existing contract; `sdlc-overlay-v1` requires the Adaptation fields and link targets shown above. The validator checks local evidence only and never authorizes remote, release, deployment, commit, or rollback actions.

## 2. Objective and Boundaries

- **Objective**: Plugin runtime configuration (`data.json`-class files, including credential-bearing and machine-specific state) is excluded from Git by an explicit documented rule, while distributable manifests, plugin code, and sanitized example defaults stay trackable.
- **In Scope**:
  - `.gitignore` runtime-config rules (grill disposition: dual proof — excluded files ignored AND code/manifests trackable)
  - Representative synthetic `data.json` fixtures in a disposable repo for `git check-ignore` + index inspection
  - Docs note distinguishing distributable plugin code vs local runtime config (in-guide or `.gitignore` comment)
- **Explicit Non-Goals**:
  - No repo visibility flip, history rewrite, or credential rotation (owner decision under #31, separate action)
  - No real secrets, private note text, or live `data.json` values in fixtures, commits, or public comments
  - No Kanban cache separation (Wave 1, #30) and no hook-logic changes (#32–#34) in this task
  - No bulk `.obsidian/` re-ignoring beyond the runtime-config rule this issue authorizes
- **Dependencies**: `None` — Wave 0 has no prerequisite issue; grill gate: #31 boundary decision recorded before Wave 1 merges (not before this task).
- **Risk**: `Medium` - Over-broad rule could untrack distributable defaults; under-broad rule keeps leaking config. Mitigation: dual-proof fixture (ignored set + trackable set) before and after the change.
- **Verification Condition**: Disposable-repo fixture script exits 0: synthetic runtime `data.json` paths report ignored via `git check-ignore`, and manifest/code/example paths report NOT ignored; plus `git status --short` in vault shows no live secrets staged.

## 3. Acceptance Criteria

- [x] **AC-1**: Runtime data/configuration for plugins is ignored through an explicit, documented rule.
  - **Result**: `Pass`
  - **Evidence**: `Disposable repo /tmp/wave0-fixture: git check-ignore -v matched .gitignore:2 for synthetic data.json and :3 for cache.json (exit 0); vault: rest-api + kanban data.json match .gitignore:11`
  - *Gherkin*: `Given a disposable repo with representative plugin paths, When I run the fixture check, Then runtime data.json paths are ignored and the rule text documents the boundary.`
- [x] **AC-2**: Distributable manifests, plugin code, and sanitized example defaults remain trackable.
  - **Result**: `Pass`
  - **Evidence**: `Disposable repo: check-ignore on main.js/manifest.json/styles.css/data.example.json → exit 1 (none ignored); vault: git ls-files still lists main.js/manifest.json/styles.css across plugins`
  - *Gherkin*: `Given the same disposable repo, When I check manifest/code/sanitized-example paths, Then none are ignored and all stay eligible for staging.`
- [x] **AC-3**: Tests use synthetic data; no real configuration values enter the patch.
  - **Result**: `Pass`
  - **Evidence**: `Fixture used SYNTHETIC-FAKE-KEY-0000 only, built in /tmp (removed after run); patch = .gitignore rule + index untracking, zero new credential-shaped content`
  - *Gherkin*: `Given the patch diff and fixtures, When scanned for credential shapes and real paths, Then no real values appear and all names are synthetic.`

## 4. Execution Policy

- **Mode**: `Gated Mode`
- **TDD Enforcement Mode** *(Required for `sdlc-overlay-v1`; choose disabled or enabled. An absent field defaults to disabled only for legacy records)*: `disabled`
- **Batch Authorization**: `N/A`
- **Soft Checkpoint**: `Around 60 minutes or at fixture-proof completion, whichever comes first`
- **Hard Checkpoint**: `At or before 90 minutes`
- **Event-Driven Checkpoints**: `Milestone, task switch, scope expansion, handoff, compaction, or context drift`
- **Stop Conditions**: `Missing approval/context, failed verification/CI/invariant, blocker, hard checkpoint, or developer stop`
- **Host Timer Capability**: `Not measured — no mechanical enforcement claimed; agent stops at checkpoints and awaits owner`

## 5. State and Active Ownership

- **Execution State**: `completed`
- **Mapped `pk:tasks` Status**: `Done`
- **Active Task Pointer**: `None`
- **Start Time**: `2026-10-03 14:05 UTC`
- **Current Actor**: `Sisyphus (implementer, owner-authorized)`
- **Next Action**: `Owner decides push/PR for codex/29-runtime-config-exclusion; then Wave 1 Task Record (#31 boundary decision first)`

### Transition History

| Previous State | New State | Timestamp | Actor | Reason | Supporting Evidence |
|---|---|---|---|---|---|
| `N/A` | `planned` | `2026-10-04 02:30 UTC` | `Sisyphus (planner)` | `Wave 0 Task Record created from spec + GH #29; ready for owner start authorization` | `N/A` |
| `planned` | `in_progress` | `2026-10-03 14:05 UTC` | `Sisyphus (implementer)` | `Owner authorized start ("1"); start time + active pointer recorded` | `N/A` |
| `in_progress` | `awaiting_review` | `2026-10-03 14:20 UTC` | `Sisyphus (implementer)` | `Rule + untracking + dual-proof fixture pass (AC-1/2/3); pointer released for review` | `Verification Evidence above` |
| `awaiting_review` | `completed` | `2026-10-03 14:40 UTC` | `Sisyphus (implementer)` | `Owner authorized commit; 6cf9bf2 landed (26 files, pure deletions); detour via but-teardown recovered exactly, see Evidence` | `Commit Evidence above` |

Canonical transition graph (enforced by `scripts/validate-execution-control.sh` / `.ps1`; every history row must be one of these edges): `N/A`/`None`→`planned`; `planned`→`ready`/`in_progress`/`aborted`; `ready`→`in_progress`/`blocked`/`paused`/`aborted`; `in_progress`→`checkpoint_due`/`blocked`/`paused`/`handoff_ready`/`awaiting_review`/`completed`/`aborted`; `checkpoint_due`→`in_progress`/`blocked`/`paused`/`handoff_ready`/`aborted`; `blocked`→`ready`/`in_progress`/`paused`/`aborted`; `paused`→`ready`/`in_progress`/`aborted`; `handoff_ready`→`in_progress`/`checkpoint_due`/`blocked`/`aborted`; `awaiting_review`→`planned`/`in_progress`/`completed`/`blocked`.

A task cannot enter `ready` until its objective, scope, non-goals, acceptance criteria, dependencies, verification condition, owner/approval boundary, and execution policy are complete. It cannot enter `in_progress` until readiness, start time, execution scope, and active ownership are recorded. Only one task may hold the active pointer in this Execution Scope.

## 6. Evidence and Completion Gate

- **Changed Files**:
  - `.gitignore` - `replaced homepulse-only data.json line with documented generic runtime-config rule + example allowlist`
  - `25× .obsidian/plugins/*/data.json|cache.json (index only)` - `untracked via git rm --cached; working-tree files preserved on disk`
- **Scope Change Records**: `None`
- **Checkpoint Records**: `None`
- **Handoff Records**: `None`
- **Verification Evidence**: `Disposable repo /tmp/wave0-fixture (git init, synthetic files only, removed after run): check-ignore -v matched data.json (:2) + cache.json (:3), exit 0; main.js/manifest.json/styles.css/data.example.json unmatched, exit 1. Vault: check-ignore -v matches rest-api + kanban data.json at .gitignore:11. Removed blobs already exist in history — history remediation stays with #31 per non-goals.`
- **Behavior IDs [Required when enabled]**: `N/A - exception work type`
- **TDD Intent Register [Required when enabled]**: `N/A - exception work type`
- **TDD Execution Evidence [Required when enabled]**: `N/A - exception work type`
- **TDD Exception Verification [Required for Documentation, Configuration, or Research Work; Not applicable for Code Work]**: `Exception verification: disposable-repo dual-proof fixture (AC-1/AC-2/AC-3) — reason: Configuration Work has no code behavior to Red/Green/Refactor; fixture pass (exit 0) plus diff inspection is the verification`
- **CI Evidence**: `N/A`
- **Review Evidence**: `N/A`
- **Commit Evidence**: `6cf9bf2 chore(security): exclude plugin runtime configuration from Git — 26 files: .gitignore rule + 25 pure deletions, Closes #29 in message (branch codex/29 squashed as 6d721a1 via PR #70, merged; local main synced at 4ca4f3a)`
- **Pull Request Evidence**: `👉 [PR #70 — chore(security): exclude plugin runtime configuration from Git](https://github.com/lowqualityloey/loey_space/pull/70) (base main, pushed 2026-10-03, Closes #29 in body)`
- **Release Evidence**: `N/A`
- **Blocker and Resume Condition**: `None`

### TDD Mode Branches

Select exactly one branch from the canonical Local Task Record fields:

- **Enabled Code Work [Required]:** Create one intent and one execution block per Behavior ID. Link the test-plan intent to the Local Task Record and record Red, Green, and Refactor results there.
- **Disabled Code Work [Required]:** Record both the TDD Intent Register and TDD Execution Evidence as `N/A - TDD Enforcement Mode disabled`. Do not use the exception path. Normal dependency-ordered milestones, acceptance criteria, test strategy, review, and verification remain required.
- **Documentation, Configuration, or Research Work [Required]:** Record TDD fields as `N/A - exception work type` and provide the TDD Exception Verification link, reason, acceptance, evidence, review, and verification.
- **Ambiguous Work [Required]:** Follow the Code Work branch until Work Type and TDD mode are clarified; do not record an automatic exception.

### TDD Execution Evidence Shape

Use one block per enabled Code Work behavior. The Local Task Record is authoritative for execution evidence; the test plan is a supporting intent reference.

<!-- Replace the example anchors with each immutable execution and behavior ID. -->
<a id="TDD-EXEC-2026-10-04-wave0-p0-runtime-config-001"></a>
<a id="BEHAVIOR-2026-10-04-wave0-p0-runtime-config-001"></a>

- **Execution ID [Required when enabled]**: `N/A - exception work type`
- **Behavior ID [Required when enabled]**: `N/A - exception work type`
- **Task Record Link [Required]**: `[TASK-2026-10-04-wave0-p0-runtime-config](#TASK-2026-10-04-wave0-p0-runtime-config)`
- **Red Result [Required when enabled]**: `N/A - exception work type`
- **Green Result [Required when enabled]**: `N/A - exception work type`
- **Refactor Result [Required when enabled]**: `N/A - exception work type`
- **Commands and Results [Required when enabled]**: `N/A - exception work type`
- **Execution Status [Required when enabled]**: `N/A - exception work type`
- **Exception Verification [Not applicable for enabled Code Work]**: `Disposable-repo dual-proof fixture per AC-1/AC-2/AC-3 (exit 0 required); Configuration Work exception`



- **Completion State**: `completed`
- **Acceptance Results**: `AC-1 pass; AC-2 pass; AC-3 pass`
- **Changed-File Summary**: `.gitignore: documented generic plugin runtime-config rule (data.json, cache.json, reference-files/, example allowlist); index: 24 data.json + 1 cache.json untracked, working-tree preserved; commit 6cf9bf2, 20 insertions / 4047 deletions`
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: `Completed — Sisyphus 2026-10-03 14:40 UTC. Process note: first commit attempt via pathspec mis-scoped (captured 2 worktree content-mods); recovered via soft-reset on the unpushed branch and recommitted atomically. GitButler setup/teardown in this repo proved unusable (diff timeout, index reset, branch switch) — restored provisioner index entries byte-identical (gitlink sha verified against earlier ls-files output + remote HEAD). No push, no PR per authorization boundary.`

A task may be marked `completed` only after acceptance results, verification evidence, changed-file summary, and required commit evidence are linked. Major milestones also require pull-request evidence or an explicit human-confirmed not-applicable exception. A passing validator does not authorize remote, release, deployment, or rollback actions.
