# Task Record: Wave 2 Group B — HomePulse ownership + template-write preservation

<a id="TASK-2026-10-04-wave2-homepulse"></a>

## 1. Identity and Authority

- **Record Type**: `Task Record`
- **Task ID**: `TASK-2026-10-04-wave2-homepulse`
- **PromptKit Adaptation Profile**: `none`
- **Work Type**: `Code Work`
- **Planning Record Link**: `N/A`
- **Planning Depth Reference**: `N/A`
- **Assumption Record Links**: `ASSUMPTION-vault-trust-recovery-004` (HomePulse buildable source — resolved by owner decision 2026-10-03: vendor path)
- **Specification**: `docs/specs/2026-10-04-spec-vault-trust-recovery.md`
- **External Reference (Optional)**: `👉 [#36 — establish a buildable source and ownership path](https://github.com/lowqualityloey/loey_space/issues/36) · 👉 [#37 — keep dated habit completion out of the daily template](https://github.com/lowqualityloey/loey_space/issues/37) (tracker 👉 [#69](https://github.com/lowqualityloey/loey_space/issues/69))`
- **Owner / Actor**: `Jonell Balanay (owner) / implementing agent (TBD at start)`
- **Execution Scope**: `loey_space repository working tree; synthetic fixtures only`
- **Approval Boundary**: `Owner authorizes implementation start and PR creation/merge; owner supplied the #36 source-location decision (2026-10-03: vendor path). No upstream PR is authorized.`
- **Created**: `2026-10-03 15:40 UTC`

> This Local Task Source is authoritative for Controlled Work. Planning Record and Assumption Record links provide context only; they do not control readiness, execution state, active ownership, completion, or approval.

## 2. Objective and Boundaries

- **Objective**: HomePulse's provenance and ownership are documented with a drift guard (#36), and toggling a today habit stops mutating `99-Templates/Daily.md` while still updating the dated note (#37).
- **In Scope**:
  - #36: `06-Resources/Guides/CONTRIBUTING.md` ownership rule; new ownership/provenance doc; prelude marker + drift guard test
  - #37: remove the template-write block from the HomePulse prelude; behavioral regression test with a synthetic vault
- **Explicit Non-Goals**:
  - No attempt to reconstruct `src/main.ts` or an authoritative upstream build (source access unavailable; recorded, not invented)
  - No changes to the minified upstream core of `main.js`
  - No upstream PR or issue filed on the owner's behalf
  - No change to habit definitions, completions storage, or HomePulse widgets beyond the template write
  - No fix for #38 (kanban propagation) — separate wave/PR
- **Dependencies**: `#37 depends on #36` (per issue dependency; satisfied by the ownership decision + doc landing first)`
- **Risk**: `Medium` - patching a generated artifact; mitigated by editing only the readable, documented prelude seam and proving behavior with an extracted-function fixture rather than a string check. Risk that a future upstream update silently drops the patch — mitigated by the drift guard.`
- **Verification Condition**: `npm test exits 0 including the new HomePulse tests; the #37 test fails against the pre-fix bundle and passes after the patch; node --check on main.js`

## 3. Acceptance Criteria

- [x] **AC-36-1**: Authoritative source location, upstream provenance, and maintainer are verified or recorded as unavailable, with the search evidence that proves it.
  - **Result**: `Pass`
  - **Evidence**: `Recorded as unavailable (never invented): no .ts/src/build config in the plugin folder; no HomePulse under /home/heyloey to depth 6 (node_modules excluded); bundle declares generation from src/main.ts. Upstream named as jukkau/HomePulse (manifest author Yuki, v1.0.2). Owner decision 2026-10-03: vendor path. Evidence table in 06-Resources/Guides/Plugin Ownership.md §2.`
  - *Gherkin*: `Given the vault and machine, When source discovery runs, Then the outcome is a verified location or an explicit recorded blocker, never an invented source.`
- [x] **AC-36-2**: An ownership and update procedure is documented for the locally owned prelude versus the upstream minified core.
  - **Result**: `Pass`
  - **Evidence**: `Plugin Ownership.md: provenance table, blocker record, owned-symbol table (getLocalDateStr/syncHabitsToFiles/focus helpers), post-update 4-step procedure, limitation note (detects lost prelude, not changed one). CONTRIBUTING.md ownership bullet updated to point at it.`
  - *Gherkin*: `Given a future bundle update, When a maintainer reads the doc, Then they know what is owned locally, what is upstream, and how to re-apply local changes.`
- [x] **AC-36-3**: A drift guard fails when the locally owned prelude is replaced.
  - **Result**: `Pass`
  - **Evidence**: `06-Resources/scripts/tests/homepulse-prelude.test.mjs — 3/3 pass on the current bundle; on a marker-stripped copy in /tmp it fails 2/3 with the "re-apply the vault patches" message, so the guard is proven to fail, not just pass.`
  - *Gherkin*: `Given a bundle whose prelude markers are gone, When the test suite runs, Then the HomePulse test fails.`
- [x] **AC-37-1**: A today-habit toggle changes only the dated note; the daily template keeps unchecked defaults.
  - **Result**: `Pass`
  - **Evidence`: Behavioral test extracts the helper from the bundle and runs a synthetic vault. RED against pre-fix bundle (template became - [x], assertion "the daily template must keep unchecked defaults"), GREEN after the patch: 3/3. npm test 51/51. node --check clean.`
  - *Gherkin*: `Given an unchecked template plus a today note and a tomorrow note, When a habit is checked, Then only the today note changes and tomorrow's new note starts unchecked.`
- [x] **AC-37-2**: Global habit definitions stay distinct from dated completion.
  - **Result**: `Pass`
  - **Evidence**: `Habit identity still comes from the widget's own habit list and completion key habit|date; the patch removed only the template write, leaving the dated write intact (proven by the today-note assertion). Third test asserts the shipped template has zero checked habits, so a new day cannot inherit completion.`
  - *Gherkin*: `Given the patched prelude, When inspected, Then habit identity is read from the widget config while completion stays in the dated note.`

## 4. Execution Policy

- **Mode**: `Gated Mode`
- **TDD Enforcement Mode**: `disabled`
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
- **Start Time**: `2026-10-03 15:40 UTC`
- **Current Actor**: `Sisyphus (implementer, owner-authorized)`
- **Next Action**: `Wave 2 Group C: #38 kanban propagation identity (same plugin family), #39/#40/#41 preservation, #60 monthly path`

### Transition History

| Previous State | New State | Timestamp | Actor | Reason | Supporting Evidence |
|---|---|---|---|---|---|
| `N/A` | `planned` | `2026-10-03 15:40 UTC` | `Sisyphus (planner)` | `Wave 2 Group B record created after Wave 1 completion; owner chose vendor path for #36` | `N/A` |
| `planned` | `in_progress` | `2026-10-03 15:40 UTC` | `Sisyphus (implementer)` | `Owner authorized Wave 2 start ("1") + vendor-path decision` | `N/A` |
| `in_progress` | `completed` | `2026-10-03 15:53 UTC` | `Sisyphus (implementer)` | `#36 + #37 merged via PR #75, CI green; 5/5 ACs pass` | `Verification Evidence above` |

## 6. Evidence and Completion Gate

- **Changed Files**:
  - `06-Resources/Guides/Plugin Ownership.md` - `new: provenance, blocker record, owned seam, update procedure — #36`
  - `06-Resources/Guides/CONTRIBUTING.md` - `homepulse bullet now points at the ownership doc — #36`
  - `06-Resources/scripts/tests/homepulse-prelude.test.mjs` - `new: drift guard — #36`
  - `.obsidian/plugins/homepulse/main.js` - `removed the template write from the habit-sync prelude (8 lines) — #37`
  - `06-Resources/scripts/tests/homepulse-habit-sync.test.mjs` - `new: behavioral regression — #37`
- **Scope Change Records**: `None`
- **Checkpoint Records**: `None`
- **Handoff Records**: `None`
- **Verification Evidence**: `#36: 3/3 guard tests pass; proven to fail 2/3 on a marker-stripped copy. #37: RED against pre-fix bundle (template flipped to - [x]) then GREEN 3/3 after removing the template write. Full suite npm test 51/51 (was 45); node --check on the bundle; tracked secret scan exit 0.`
- **Behavior IDs [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **TDD Intent Register [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **TDD Execution Evidence [Required when enabled]**: `N/A - TDD Enforcement Mode disabled`
- **TDD Exception Verification [Required for Documentation, Configuration, or Research Work; Not applicable for Code Work]**: `N/A - Code Work`
- **CI Evidence**: `👉 [PR #75 run](https://github.com/lowqualityloey/loey_space/actions/runs/37134744309) — Build, Typecheck & Validate: pass`
- **Review Evidence**: `N/A`
- **Release Evidence**: `N/A`
- **Blocker and Resume Condition**: `None`

- **Commit Evidence**: `codex/wave2-homepulse: 520073a (#36) + 3bfc5d8 (#37), 5 files total, branched from main daba65b`
- **Pull Request Evidence**: `👉 [PR #75 — Wave 2 Group B](https://github.com/lowqualityloey/loey_space/pull/75) (base main, merged 2026-10-03T15:52:58Z, Closes #36/#37)`
- **Completion State**: `completed`
- **Acceptance Results**: `AC-36-1/36-2/36-3/37-1/37-2 all pass`
- **Changed-File Summary**: `2 docs + 2 tests added, 1 test + 1 guide + 1 bundle edited — 5 files, 2 atomic commits`
- **Completion Exception**: `None`
- **Completion Decision and Timestamp**: `Completed — Sisyphus 2026-10-03 15:53 UTC. Note: local main still carries an unpublished duplicate of these commits (531315b/e3d1f3f on codex/wave1-group-a) plus merge commits; push only feature branches, never local main.`

A task may be marked `completed` only after acceptance results, verification evidence, changed-file summary, and required commit evidence are linked. A passing validator does not authorize remote, release, deployment, or rollback actions.