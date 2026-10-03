# Task Record: Wave 1 — Privacy procedure + hook hardening

<a id="TASK-2026-10-04-wave1-privacy-hook"></a>

## 1. Identity and Authority

- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-10-04-wave1-privacy-hook`
- **PromptKit Adaptation Profile** *(Optional; choose `none` for the legacy contract or `sdlc-overlay-v1` to validate the Adaptation fields below)*: `none`
- **Work Type** *(Required for `sdlc-overlay-v1`; choose Code Work, Documentation Work, Configuration Work, or Research Work)*: `Code Work`
- **Planning Record Link** *(Required for `sdlc-overlay-v1`; use the stable planning ID and matching explicit anchor)*: `N/A`
- **Planning Depth Reference** *(Optional for `sdlc-overlay-v1`; use Minimal, Full, or N/A)*: `N/A`
- **Assumption Record Links** *(Optional for `sdlc-overlay-v1`; use comma-separated stable links, None, or N/A)*: `ASSUMPTION-vault-trust-recovery-001` (public/private boundary + history remediation decision, owner-open)
- **Specification**: `docs/specs/2026-10-04-spec-vault-trust-recovery.md`
- **External Reference (Optional)**: `👉 [Tracking issue #69](https://github.com/lowqualityloey/loey_space/issues/69) · children 👉 [#31](https://github.com/lowqualityloey/loey_space/issues/31), [#30](https://github.com/lowqualityloey/loey_space/issues/30), [#32](https://github.com/lowqualityloey/loey_space/issues/32), [#33](https://github.com/lowqualityloey/loey_space/issues/33), [#34](https://github.com/lowqualityloey/loey_space/issues/34), [#35](https://github.com/lowqualityloey/loey_space/issues/35)`
- **Owner / Actor**: `Jonell Balanay (owner) / implementing agent (TBD at start)`
- **Execution Scope**: `loey_space repository working tree; disposable scratch repos for fixtures`
- **Approval Boundary**: `Owner records #31 boundary/remediation decisions (visibility flip, history rewrite, rotation — authorized nowhere in this wave); owner authorizes implementation start, PR creation/merge`
- **Created**: `2026-10-03 14:28 UTC`

> This Local Task Source is authoritative for Controlled Work. Planning Record and Assumption Record links provide context only; they do not control readiness, execution state, active ownership, completion, or approval. Existing records remain valid when these optional traceability fields are absent.
>
> The optional `PromptKit Adaptation Profile` selects validation scope: absent or `none` preserves the legacy dated Task ID and existing contract; `sdlc-overlay-v1` requires the Adaptation fields and link targets shown above. The validator checks local evidence only and never authorizes remote, release, deployment, commit, or rollback actions.

## 2. Objective and Boundaries

- **Objective**: Publication boundary is explicit and owner-decided (#31), Kanban runtime cache is separated from distributables (#30), and the pre-commit hook + CI catch credential shapes across placeholder wording, renames, and env variants (#32–#35) — Wave 0 gate already landed (6d721a1).
- **In Scope**:
  - #31: boundary/remediation decision doc (Vault Security Policy + README); owner-only exposure checklist stays local
  - #30: tracked sanitized example defaults + ignored local override; forward migration of existing settings; cache never on tracked path
  - #32: placeholder-wording credential matches validated (allowlist narrowed, `.env.example` exemption preserved)
  - #33: renamed files + env-file variants inspected
  - #34: reproducible hook activation on fresh clones (executable bit + setup docs)
  - #35: CI secret-scan step for tracked artifacts
- **Explicit Non-Goals**:
  - No visibility flip, history rewrite, or credential rotation (owner decisions recorded, never executed here)
  - No real secrets, private inventories, journal content, or remediation evidence in public issues/fixtures/commits
  - No HomePulse/Kanban behavior changes (Wave 2); no backup/restore work (Wave 3)
  - No bulk `.obsidian/` re-ignoring beyond what #30 authorizes
- **Dependencies**: `#31 owner decision gates #30 merge (grill disposition); #35 may land any time; none — Wave 0 complete`
- **Risk**: `High` - History/visibility misstep is irreversible by commit-revert; hook over-blocking breaks legit commits (`.env.example`, docs quoting patterns). Mitigation: decisions recorded not executed; bypass fixtures must stay green (example-allowlist, exemption paths).
- **Verification Condition**: Per-issue synthetic fixtures exit 0 (hook bypass matrix, rename/env-variant matrix, disposable cache-separation repo) + `npm run typecheck` where scripts change + pre-commit hook passes on the patch itself.

## 3. Acceptance Criteria

- [x] **AC-31-1**: Documentation distinguishes public system infrastructure from private content and runtime state.
  - **Result**: `Pass`
  - **Evidence**: `Vault Security Policy updated (18+/4-): public-remote statement, public/private/runtime table rows, §3a boundary + assess-first procedure + 2026-10-03 decision log. Cross-checked: gh repo visibility = public; .gitignore plugin rule live (check-ignore match); README has no private-remote claim (grep). Added-lines credential-shape scan clean.`
  - *Gherkin*: `Given the published guide and read-only repo metadata, When the boundary procedure is exercised with synthetic files, Then public/private/runtime classes are unambiguous and no private inventory is published.`
- [x] **AC-31-2**: History rewrite, visibility change, and rotation are recorded as separate owner decisions, not executed.
  - **Result**: `Pass`
  - **Evidence**: `Owner decisions 2026-10-03: (1) visibility = keep public + harden; (2) history = private assess-first, no rewrite yet; (3) credential = no rotation (rest-api data.json zero git history, verified). Zero rewrite/rotation/visibility commands run.`
  - *Gherkin*: `Given the remediation checklist, When reviewed, Then each irreversible action has an explicit owner decision and none ran automatically.`
- [x] **AC-30-1**: Runtime lane/task state is not distributed through tracked configuration; sanitized defaults supply settings without cached task names or source paths.
  - **Result**: `Pass`
  - **Evidence**: `data.example.json tracked (3 booleans, no laneState/strings) + boundary comment in main.js; disposable node fixture 8/8 pass (keys==DEFAULT_SETTINGS, fresh-load + legacy-migration paths); node --check clean; data.json check-ignore match. Local data.json files untouched on disk (merge had already removed ignored-class copies; defaults take over). Commit eab9294 (2 files, +18) → 👉 [PR #71](https://github.com/lowqualityloey/loey_space/pull/71).`
  - *Gherkin*: `Given synthetic cards cycled through save/reload, When the tracked defaults are inspected, Then no cached task names or source paths appear and existing local settings survive.`
- [x] **AC-32-1**: Credential matches validate despite placeholder-adjacent wording; placeholder values still pass and `.env.example` is content-scanned (path stays committable).
  - **Result**: `Pass`
  - **Evidence**: `Hook patch: token scrub (your_*/<...>/xxxx/whole-word markers) replaces whole-line allowlist; .env.example content-scanned (path still committable); carve-outs for hook file, themes, blob lines; masking kept. Disposable per-case fixture 7/7 (2 holes reproduced pre-fix); real .env.example passes; bash -n clean. Commit 1b12989 (1 file, +18/-6) → 👉 [PR #72](https://github.com/lowqualityloey/loey_space/pull/72).`
  - *Gherkin*: `Given staged synthetic lines spanning real shapes and placeholders, When the hook runs, Then real shapes block, placeholders and .env.example pass.`
- [x] **AC-33-1**: Renamed files and environment-file variants are inspected.
  - **Result**: `Pass`
  - **Evidence**: `Hook patch: ACMR + --find-renames selection; *.env/*.env.* parity clause (.env.example still continued first, content-scanned). Disposable per-case fixture 8/8 (rename + 2 path holes reproduced pre-fix; harness fixed mid-run: clean exempted from .githooks wipe). Real .env.example passes. Commit 67e6cce (1 file, +8/-1) → 👉 [PR #73](https://github.com/lowqualityloey/loey_space/pull/73).`
  - *Gherkin*: `Given staged renames, env variants, spaced names, and mixed statuses, When the hook runs, Then renames and variants block, clean renames and examples pass.`
- [x] **AC-34-1**: Hook activation is reproducible on fresh clones.
  - **Result**: `Pass`
  - **Evidence**: `git update-index --chmod=+x → git ls-tree HEAD .githooks/pre-commit = 100755 (was 100644); README bootstrap simplified to core.hooksPath with chmod kept as a repair note. Commit e3ce163 (README 5+/8-, mode change) on codex/wave1-group-a → 👉 [PR #74](https://github.com/lowqualityloey/loey_space/pull/74).`
  - *Gherkin*: `Given a fresh clone, When the documented setup runs, Then the hook is active and executable without manual chmod archaeology.`
- [x] **AC-35-1**: CI scans tracked artifacts for secret candidates using the same scanner as the hook.
  - **Result**: `Pass`
  - **Evidence**: `.githooks/lib/secret-scan.sh` extracted (single source of truth) + CI step added (YAML parses, 9 steps); hook fails closed if lib missing (verified exit 1). Latent case-insensitivity bug fixed (was matching minified vendor JS). Evidence: tracked scan exit 0; synthetic Gemini+AWS positives exit 1 with values masked and never echoed; safe examples exit 0; #33 matrix 8/8 retained. Commit 1ba8672 (4 files, +141/-43) → 👉 [PR #74](https://github.com/lowqualityloey/loey_space/pull/74).`
  - *Gherkin*: `Given synthetic secret-shaped and clean fixtures, When CI runs, Then positives fail the step and clean trees pass.`

## 4. Execution Policy

- **Mode**: `Gated Mode`
- **TDD Enforcement Mode** *(Required for `sdlc-overlay-v1`; choose disabled or enabled. An absent field defaults to disabled only for legacy records)*: `disabled`
- **Batch Authorization**: `N/A`
- **Soft Checkpoint**: `Around 60 minutes or per-issue completion, whichever comes first`
- **Hard Checkpoint**: `At or before 90 minutes`
- **Event-Driven Checkpoints**: `Milestone, task switch, scope expansion, handoff, compaction, or context drift`
- **Stop Conditions**: `Missing approval/context, failed verification/CI/invariant, blocker, hard checkpoint, or developer stop`
- **Host Timer Capability**: `Not measured — no mechanical enforcement claimed; agent stops at checkpoints and awaits owner`

## 5. State and Active Ownership

- **Execution State**: `completed`
- **Mapped `pk:tasks` Status**: `Done`
- **Active Task Pointer**: `None`
- **Start Time**: `2026-10-03 14:32 UTC`
- **Current Actor**: `Sisyphus (implementer, owner-authorized)`
- **Next Action**: `Wave 2 / Group B: #36 HomePulse source discovery → #37 template-write fix`

### Transition History

| Previous State | New State | Timestamp | Actor | Reason | Supporting Evidence |
|---|---|---|---|---|---|
| `N/A` | `planned` | `2026-10-03 14:28 UTC` | `Sisyphus (planner)` | `Wave 1 record created post-#70-merge on synced main; #31-first per grill` | `N/A` |
| `planned` | `in_progress` | `2026-10-03 14:32 UTC` | `Sisyphus (implementer)` | `Owner authorized start ("1") incl. recording #31 decisions` | `N/A` |
| `in_progress` | `completed` | `2026-10-03 15:31 UTC` | `Sisyphus (implementer)` | `#30/#32/#33 merged (#71–#73); #31/#34/#35 merged as PR #74 with CI green; all 7 ACs pass` | `Verification Evidence above` |

Canonical transition graph (enforced by `scripts/validate-execution-control.sh` / `.ps1`; every history row must be one of these edges): `N/A`/`None`→`planned`; `planned`→`ready`/`in_progress`/`aborted`; `ready`→`in_progress`/`blocked`/`paused`/`aborted`; `in_progress`→`checkpoint_due`/`blocked`/`paused`/`handoff_ready`/`awaiting_review`/`completed`/`aborted`; `checkpoint_due`→`in_progress`/`blocked`/`paused`/`handoff_ready`/`aborted`; `blocked`→`ready`/`in_progress`/`paused`/`aborted`; `paused`→`ready`/`in_progress`/`aborted`; `handoff_ready`→`in_progress`/`checkpoint_due`/`blocked`/`aborted`; `awaiting_review`→`planned`/`in_progress`/`completed`/`blocked`.

A task cannot enter `ready` until its objective, scope, non-goals, acceptance criteria, dependencies, verification condition, owner/approval boundary, and execution policy are complete. It cannot enter `in_progress` until readiness, start time, execution scope, and active ownership are recorded. Only one task may hold the active pointer in this Execution Scope.

## 6. Evidence and Completion Gate

- **Changed Files**:
  - `06-Resources/Guides/Vault Security Policy.md` - `public-remote correction, runtime-config row, §3a boundary + remediation procedure + decision log (18+/4-) — #31, UNCOMMITTED`
  - `.obsidian/plugins/kanban-status-sync/data.example.json` - `new tracked sanitized seed — #30, committed eab9294 → PR #71`
  - `.obsidian/plugins/kanban-status-sync/main.js` - `runtime-boundary comment (necessary: security boundary per file banner convention) — #30, committed eab9294 → PR #71`
  - `.githooks/pre-commit` - `token-scrub matching, .env.example content scan, blob-line carve-out (18+/6-) — #32, committed 1b12989 → PR #72; renames (ACMR) + env-variant parity (8+/1-) — #33, committed 67e6cce → PR #73`
- **Scope Change Records**: `None`
- **Checkpoint Records**: `None`
- **Handoff Records**: `None`
- **Verification Evidence**: `#31: guide-vs-metadata comparison (repo public per gh; plugin rule live per check-ignore; README clean per grep) + added-lines credential-shape scan clean + owner decisions 2026-10-03 recorded with zero rewrite/rotation/visibility commands run. #30: disposable node fixture 8/8 (keys==DEFAULT_SETTINGS, fresh-load + legacy-migration), node --check clean, data.json check-ignore match, eab9294 (2 files, +18). #32: disposable per-case fixture 7/7 with 2 pre-fix reproductions, real .env.example passes, bash -n clean, 1b12989 (1 file, +18/-6). #33: disposable per-case fixture 8/8 with 3 pre-fix reproductions, real .env.example passes, bash -n clean, 67e6cce (1 file, +8/-1). Stale index.lock cleared repeatedly (no writer active; background git watchers observed).`
- **Commit Evidence**: `On codex/wave1-group-a (branched from origin/main, 3 atomic commits): e3ce163 (#34) + 9ae56fe (#31) + 1ba8672 (#35). Local main additionally carries dac8321 (restore of #33 hook coverage that a local merge had silently dropped) — deliberately NOT cherry-picked here because this branch already has that content; local main stays unpublished.`
- **Pull Request Evidence**: `👉 [PR #74 — Wave 1 Group A](https://github.com/lowqualityloey/loey_space/pull/74) (base main, Closes #31/#34/#35). Earlier PRs: #71 (#30), #72 (#32), #73 (#33) — all merged.`
- **Behavior IDs [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **TDD Intent Register [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **TDD Execution Evidence [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **TDD Exception Verification [Required for Documentation, Configuration, or Research Work; Not applicable for Code Work]**: `N/A - Code Work`
- **CI Evidence**: `N/A`
- **Review Evidence**: `N/A`
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
<a id="TDD-EXEC-2026-10-04-wave1-privacy-hook-001"></a>
<a id="BEHAVIOR-2026-10-04-wave1-privacy-hook-001"></a>

- **Execution ID [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **Behavior ID [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **Task Record Link [Required]**: `[TASK-2026-10-04-wave1-privacy-hook](#TASK-2026-10-04-wave1-privacy-hook)`
- **Red Result [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **Green Result [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **Refactor Result [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **Commands and Results [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **Execution Status [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **Exception Verification [Not applicable for enabled Code Work]**: `N/A - Code Work`



- **Acceptance Results**: `AC-31-1/31-2/30-1/32-1/33-1/34-1/35-1 all pass — Wave 1 complete pending PR #74 merge`
- **Changed-File Summary**: `PR #71 (#30: 2 files, +18) · PR #72 (#32: hook +18/-6) · PR #73 (#33: hook +8/-1) · PR #74 (#34+#31+#35: lib new, hook, ci.yml, policy doc, README) · local-only dac8321 restore commit on unpublished local main`
- **Completion State**: `awaiting_review`
- **Completion Decision and Timestamp**: `Completed — Sisyphus 2026-10-03 15:31 UTC. Wave 1 fully landed: PRs #71/#72/#73/#74 merged, CI green on each. Notable finds: a local merge silently dropped #33's hook coverage (restored locally as dac8321, and re-proven 8/8); the hook's case-insensitive match was a latent false-positive source against minified vendor JS (fixed in the shared scanner).`
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: `Pending`

A task may be marked `completed` only after acceptance results, verification evidence, changed-file summary, and required commit evidence are linked. Major milestones also require pull-request evidence or an explicit human-confirmed not-applicable exception. A passing validator does not authorize remote, release, deployment, or rollback actions.
