# Technical Design Document (RFC, Request for Comments): Vault Trust & Recovery

- **Author**: Jonell Balanay (owner) / Sisyphus (planner)
- **Status**: Draft
- **Created**: 2026-10-04
- **Target Release**: Milestone wave sequence Wave 0 → Wave 5 (privacy first, no bulk migration)

---

## Planning Record (PromptKit Adaptation)

<a id="PLAN-vault-trust-recovery"></a>

### Planning Record Metadata

- **Planning Record ID [Required]**: `PLAN-vault-trust-recovery`
- **Planning Depth [Required]**: `Full`
- **Owner [Required]**: Jonell Balanay
- **Record Status [Required]**: `draft`
- **Local Task Record Link [Required for Controlled Work once the record exists]**: `TBD — created by pk:tasks`
- **Workflow Links [Optional]**: `pk:tasks` (Task Record), `pk:grill` (pre-implementation probes), `pk:test` (fixture strategy)

### Planning Inputs

- **Requested Outcome [Required]**: Make `loey_space` operational memory private, recoverable, and trustworthy while preserving Markdown source-of-truth, PARA layout, and Backlog Shield — by resolving the 40 implementation issues (#29–#68) under tracker #69, organized by the ChatGPT architecture review findings F01–F13 (2026-10-04).
- **Observable Completion Condition [Required]**: Each wave lands as one-issue/one-commit PRs with synthetic-fixture reproduction + verification evidence recorded on the child issue; `Closes #N` only when that issue's acceptance criteria and evidence are met. No wave starts implementation from this spec alone — `pk:tasks` owns the Task Record and TDD mode.
- **Scope Boundary [Required]**: In scope — `.gitignore`, `.githooks/pre-commit`, `.obsidian/plugins/kanban-status-sync/main.js`, HomePulse behavior boundary (source discovery required), `06-Resources/scripts/src/` (triage-sweep, distill-concept-action, enrichers, sync-github-kanban, sync-github-activity, weekly-ai-summary, scheduled-enrich, validate-templates), `06-Resources/Guides/` (Security Policy, Tagging & Properties), `01-Daily/_Tasks MOC.md`, `Home.md`, `07-Reviews/` dashboards, `99-Templates/`, `AGENTS.md`/`CODEX.md`/`CLAUDE.md`/`GEMINI.md` startup chain, `memory.md`/`handoff.md`, project hubs/boards. Excluded — see Explicit Non-Goals.
- **TDD Enforcement Proposal (Reference Only) [Optional]**: `disabled`; proposal only. Canonical Local Task Record owns `TDD Enforcement Mode`; absent field defaults to `disabled`. Code defects still require failing-synthetic-fixture-first per tracker contract, recorded as milestone evidence, not as TDD Red activation.

### Full Planning

- **Explicit Non-Goals [Required in Full]**: No bulk folder migration; no new parallel task database; no Git history rewrite or repo-visibility flip inside this spec (decision + remediation procedure only, issue #31); no real credential/secret values in public issues, fixtures, or commits; no live Obsidian rendering claims; no provider-side rotation; no private backup endpoint/content in public records; no inventing Hermes repository/progress (locate-then-bridge only, #45); no inferred bulk migration of ambiguous legacy cards.
- **Affected Behavioral Components [Required in Full]**: QuickAdd triage-sweep + CLI; distill-concept (QuickAdd + CLI); enrich (concept/dev/learning/weekly); sync-github-kanban (2-way); sync-github-activity/log-github; weekly-ai-summary; HomePulse habit toggle + template sync; kanban-status-sync propagation; validate-templates + audit-links; Habit Analytics Dashboard + Tasks MOC/Home task views; daily carry-forward; pre-commit hook + CI; backup/restore docs; memory/handoff/project-hub checkpoint contract.
- **Externally Visible Contracts [Required in Full]**: GitHub Issues #29–#69 (public, generic descriptions + synthetic examples only); vault file contracts — daily path `01-Daily/YYYY-MM/YYYY-MM-DD.md`, habit `- [ ]`/`- [x]` + `## 🔁 Habits`, kanban lanes (Backlog/To Do/In Progress/Review-Test/Done/Archive) + checkbox semantics, frontmatter schema + `p0–p3` priority tags, `> [!QUOTE] 💡 Daily Spark` / AI Daily Summary blocks; CLI contracts `npm test`, `npm run typecheck`, `npm run build`, `npm run audit-links`, `npm run distill`, `npm run log-github`, `npm run sync-kanban`, `npm run validate-templates` (plus documented-but-missing `npm run weekly-summary`, #63). No network API contract changes.
- **Failure or Rollback Considerations [Required in Full]**: Privacy leak via staged plugin `data.json`/Kanban cache (F01–F02); history rewrite risk if remediation chosen (must stay a deliberate separate decision); destructive writes (template contamination, historical propagation, concept replacement, capture loss — F03–F04); sync duplication/phantom success (F08); invented-defaults lifestyle advice (F10); checkpoint staleness/contradiction (F05). Rollback: one-issue/one-revertible-commit per tracker contract; Markdown + Git revert; no destructive migration — Expand-Contract N/A (see §4.2).
- **Verification Approach [Required in Full]**: Per-issue synthetic fixtures in disposable repos (never real secrets/content); `git check-ignore` + safe index inspection for privacy; fixture pairs (template-defaults preserved, old-note untouched, collision retained, concurrent-append retained, idempotent re-sync with zero duplicates, failed-inventory blocks creation); sparse-date fixtures for calendar/streak/weekly; `npm run typecheck`, `npm test` (runner pin pending #66), `npm run validate-templates` (must fail nonzero on invalid, #51), `npm run audit-links -- --strict`; fresh-session resume drill per project (memory→handoff→hub→board→repo evidence yields one next action).

### Assumption Records

<a id="ASSUMPTION-vault-trust-recovery-001"></a>
- **Assumption ID [Required]**: `ASSUMPTION-vault-trust-recovery-001`
- **Unanswered Decision [Required]**: Public vs private repository boundary + historical exposure remediation (make private? rewrite history? accept + rotate?)
- **Provisional Answer [Required]**: Document boundary + remediation procedure first (#31); no visibility/history action until owner decides with exposure assessment.
- **Impact if Wrong [Required]**: Continued public exposure of caches/history or unnecessary destructive history operation.
- **Validation Action [Required]**: Owner decision on #31 before any Wave 1 cache work merges; record decision + evidence pointers.
- **Decision Owner [Required]**: Jonell Balanay
- **Status [Required]**: `accepted`
- **Supporting Evidence [Optional]**: None
- **Resolution Evidence [Not applicable until resolved]**: `Owner decisions 2026-10-03 in TASK-2026-10-04-wave1-privacy-hook (AC-31-2): keep public + harden; history assess-first; no rotation (rest-api data.json zero history). #30 merge gate satisfied once #31 doc lands.`

<a id="ASSUMPTION-vault-trust-recovery-002"></a>
- **Assumption ID [Required]**: `ASSUMPTION-vault-trust-recovery-002`
- **Unanswered Decision [Required]**: Actual private backup target, retention, and restore location (issue #42 local-only context).
- **Provisional Answer [Required]**: Spec defines generic coverage/retention/verification contract; owner confirms target locally; restore drill into separate folder.
- **Impact if Wrong [Required]**: Recovery docs untestable; ignored notes remain unrecoverable from clone.
- **Validation Action [Required]**: Owner confirms target during #42; record last-success date + restore evidence locally (never in public issue).
- **Decision Owner [Required]**: Jonell Balanay
- **Status [Required]**: `open`
- **Supporting Evidence [Optional]**: None
- **Resolution Evidence [Not applicable until resolved]**: `N/A - unresolved`

<a id="ASSUMPTION-vault-trust-recovery-003"></a>
- **Assumption ID [Required]**: `ASSUMPTION-vault-trust-recovery-003`
- **Unanswered Decision [Required]**: Hermes authoritative source (no Hermes-named Markdown found in review).
- **Provisional Answer [Required]**: Locate-then-bridge; do not invent repo/progress (#45).
- **Impact if Wrong [Required]**: Phantom bridge pointing at wrong repo/state.
- **Validation Action [Required]**: Owner names Hermes repo/record during #45 discovery; bridge records verified path + remote identity.
- **Decision Owner [Required]**: Jonell Balanay
- **Status [Required]**: `open`
- **Supporting Evidence [Optional]**: None
- **Resolution Evidence [Not applicable until resolved]**: `N/A - unresolved`

<a id="ASSUMPTION-vault-trust-recovery-004"></a>
- **Assumption ID [Required]**: `ASSUMPTION-vault-trust-recovery-004`
- **Unanswered Decision [Required]**: HomePulse buildable source + ownership path (declared local source absent per F13; runtime `main.js` pointers only).
- **Provisional Answer [Required]**: #36 establishes source/ownership before #37 behavior fix; no HomePulse code change on unverified bundle.
- **Impact if Wrong [Required]**: Patch applied to generated bundle, lost on rebuild, or wrong ownership.
- **Validation Action [Required]**: #36 discovery records source location + build/verify path; #37 blocked until then (dependency takes precedence).
- **Decision Owner [Required]**: Jonell Balanay
- **Status [Required]**: `open`
- **Supporting Evidence [Optional]**: None
- **Resolution Evidence [Not applicable until resolved]**: `N/A - unresolved`

<a id="ASSUMPTION-vault-trust-recovery-005"></a>
- **Assumption ID [Required]**: `ASSUMPTION-vault-trust-recovery-005`
- **Unanswered Decision [Required]**: Registry/handoff contradictions requiring human confirmation (Portfolio active-vs-planning + absent local path; PromptKit hub absent; FastDesk hub next-step ambiguity; profile facts memory-vs-career-hub; test-claim timestamps).
- **Provisional Answer [Required]**: #44 reconciles against verified sources; stale/unverifiable claims marked `unknown`, never inferred.
- **Impact if Wrong [Required]**: Checkpoint contract built on false resume state.
- **Validation Action [Required]**: Owner confirms durable facts during #44; fresh-session resume drill proves one evidence-backed next action per active project.
- **Decision Owner [Required]**: Jonell Balanay
- **Status [Required]**: `open`
- **Supporting Evidence [Optional]**: None
- **Resolution Evidence [Not applicable until resolved]**: `N/A - unresolved`

<a id="ASSUMPTION-vault-trust-recovery-006"></a>
- **Assumption ID [Required]**: `ASSUMPTION-vault-trust-recovery-006`
- **Unanswered Decision [Required]**: `PROMPTKIT.md` intake placeholders (`size`, `intake-status`, stack, commands) predate intake; brownfield estimate unresolved.
- **Provisional Answer [Required]**: Treat as `legacy-partial` per plan Step 0 rule 3 — codebase + docs are the intake record; gaps stay assumptions, no re-interview.
- **Impact if Wrong [Required]**: Over-ceremony (full re-interview) or under-scoped architecture.
- **Validation Action [Required]**: `pk:onboard` brownfield estimate or explicit intake update outside this spec; this spec proceeds.
- **Decision Owner [Required]**: Jonell Balanay
- **Status [Required]**: `open`
- **Supporting Evidence [Optional]**: None
- **Resolution Evidence [Not applicable until resolved]**: `N/A - unresolved`

### Technology and Vendor Decision Records

None. No new external technology, service, framework, library, or managed service is adopted, replaced, or versioned by this plan. Existing stack (Obsidian, Node scripts, GitHub Projects v2 via `gh`) is named as context only. Tooling pin (#66, `tsx`/esbuild platform) is a maintenance fix with version evidence recorded at implementation time, not a material decision in this Planning Record.

---

## 1. Executive Summary & Problem Statement

`loey_space` is a Markdown second brain (PARA + MOCs + Backlog Shield + `hey loey` routines) with real automation: triage, distillation, enrichment, GitHub sync, habit/task plugins, and CI-tested Node scripts. The 2026-10-04 architecture review (126 notes + 19 templates inventoried, 45 tests via isolated harness, production-logic fixtures) finds the foundation worth preserving but state untrustworthy: credential-bearing plugin config stageable (P0), public repo vs private policy + cache publication + journals in history, destructive plugin/script writes (template contamination, historical propagation, concept replacement, capture race), missing checkpoint authority, no verified private restore, sync duplication/phantom success, invisible personal/learning commitments, calendar-vs-observation analytics confusion, schema/validator disagreement, and incomplete automation paths.

This spec turns the 40 scoped issues + tracker into six dependency-ordered waves that each preserve one coherent behavior with its regression fixture, keeping public issues generic and private facts local.

## 2. Goals and Explicit Non-Goals

### Goals (In Scope)

- Wave 0 P0: plugin runtime config excluded from Git with verifiable boundary (`check-ignore` + index inspection) — #29.
- Privacy boundary made explicit: Kanban cache separated from distributables (#30), publication/remediation procedure decided (#31), hook hardened (placeholder-wording #32, renames/env-variants #33, reproducible activation #34, CI secret scan #35).
- Preservation: HomePulse source established (#36) then template writes fixed (#37); kanban propagation scoped to explicit identity (#38); distill collisions preserve curation (#39); triage preserves concurrent captures (#40); enrich preserves mid-request human edits (#41).
- Continuity: private backup/restore defined + drilled (#42); checkpoint/closeout contract defined (#43); registry/handoff reconciled (#44); Hermes bridge located-then-created (#45); selected personal/learning actions surfaced once (#46); carry-forward preserves hierarchy + `[/]` (#47).
- Sync correctness: identity-based matching (#48), complete-inventory-gate before creation + pagination + idempotent re-sync (#49).
- Correctness: canonical schema + exceptions (#50), nonzero-exit validation (#51), unclassified-note reporting (#52), `p0–p3` normalization (#53), template/board alignment (#54).
- Analytics: calendar windows + coverage disclosure (#55), calendar streaks with missing-day policy (#56), dated-interval weekly selection (#57), unknown-vitals + nested-heading preservation (#58), anchored weekly statistics (#59).
- Workflow completion: monthly daily-path resolver (#60), explicit non-mutating simulation (#61), link-target resolution before write (#62), weekly-command docs corrected (#63), scratch-vs-concept reconciliation (#64), lightweight weekly ritual defined (#65).
- Tooling: pinned runner + declared platform env (#66), bundle-vs-source equivalence (#67), typed AI-response boundaries (#68).
- One dated weekly decision review produced (#65) selecting work/personal/learning commitments.

### Non-Goals (Explicit Scope Boundary)

- No bulk migration of folders, metadata, or priorities; per-issue atomic commits only.
- No history rewrite, visibility flip, or credential rotation inside this spec — #31 decides; execution (if any) is a separate deliberate action.
- No real secrets, private note text, backup endpoints, or restore evidence in public issues/commits.
- No HomePulse code change before #36 source/ownership is established.
- No bulk inference over ambiguous legacy cards; leave-unchanged + actionable feedback.
- No lifestyle advice from invented defaults or incomplete records.
- No `latest`-style version defaults; #66 pins exact versions with evidence at implementation.

## 3. Architecture & System Context

```text
┌────────────┐  edit/toggle   ┌──────────────────────┐  read/write MD  ┌──────────────────┐
│ Obsidian   ├───────────────►│ Daily / Hub / Board  ├────────────────►│ Node scripts     │
│ UI +       │  Dataview/MOC  │ (Markdown truth)     │  (triage/distill │  (gh CLI, file IO)│
│ plugins    │◄───────────────┤                      │◄─────────────────┤                  │
└─────┬──────┘  render/sync   └──────────┬───────────┘                  └────────┬─────────┘
      │                                  │ pulls/pushes drafts                 │ backup (private)
      ▼                                  ▼                                     ▼
┌────────────┐                ┌──────────────────────┐              ┌──────────────────┐
│ HomePulse /│                │ GitHub Issues /      │              │ Private backup   │
│ Kanban     │                │ Projects v2          │              │ + restore drill  │
│ plugins    │                │ (remote mirror)      │              │ (local-only)     │
└────────────┘                └──────────────────────┘              └──────────────────┘
```

### Deep Module Decomposition & Seams

| Module / Seam | Public Interface / Boundary | Internal Complexity Hidden |
| :--- | :--- | :--- |
| **PrivacyBoundary** | `isIgnored(path)`, `isDistributable(path)` | `.gitignore` rules vs sanitized defaults vs runtime caches; `check-ignore` + index proof |
| **PreservationGuard** | `writeDatedNote(id, patch)`, `linkOrAppendConcept(title)` | Identity-scoped writes, collision append-not-replace, snapshot-vs-current reconciliation, human-edit conflict handling |
| **TaskIdentity** | `resolveTask(sourcePath, stableId)` | Badge-stripped matching eliminated; persisted remote ID → title fallback; ambiguous → leave + feedback |
| **CheckpointAuthority** | `readChain()`, `closeout(project)` | memory vs handoff vs hub vs board vs repo-evidence ownership; freshness/staleness; contradiction resolution; `unknown` default |
| **RecoveryDrill** | `backupScope()`, `restoreTo(dir)` | Ignored-note + attachment coverage, retention, last-success, separate secret handling |
| **CalendarAnalytics** | `window(Auckland, from, to)`, `coverage()` | Date-bounded intervals, observed-day/populated-value reporting, missing-day streak policy, anchored weekly stats |
| **SchemaValidator** | `validateNote(note) → fail-nonzero` | Canonical schema + explicit exceptions, mood/priority normalization, template/board conformance |

Deletion test: each module concentrates one failure class (leak, destructive write, mistaken identity, stale resume, unrecoverable loss, false certainty, silent invalid) behind a checkable seam; without them the logic scatters across plugins, scripts, and dashboards.

State ownership: daily notes own dated observations; boards own task identity/lane; hubs own outcome + checkpoint; repo state files own revision + verification evidence; `memory.md` owns human-confirmed durables; `handoff.md` owns current pointers. Invalidation: re-verify revision/timestamp before acting; contradiction → verify sources, record resolution, never infer.

## 4. Detailed Design & Contracts First

### 4.1 Data Models & Schemas

Canonical vault schema is defined in #50; this spec pins the seams implementations must conform to (exact field lists in #50–#54):

- Daily note: `01-Daily/YYYY-MM/YYYY-MM-DD.md` (resolver shared by triage #60, activity sync, weekly #57); frontmatter mood/energy/sleep single representation (text vs numeric resolved in #50); `## 🔁 Habits` checkboxes dated completion only.
- Task: stable identity = `sourcePath + stableId` (persisted remote issue/item ID where synced); display title ≠ identity (badge decoration excluded from matching, #48); lane ↔ checkbox mapping preserved incl. `[/]` + hierarchy on carry-forward (#47).
- Checkpoint block per hub (from review §Minimal architecture): outcome/criterion, authoritative sources, verified repo path + remote, last-verified (timestamp, revision, command+result), completed vs unfinished, one next action + acceptance, blockers/awaiting, decisions, resume check.
- Priority: single `p0–p3` + alias map with numeric weights (`p0` sorts first — fixes FastDesk `p0` weight-zero, #53).
- Weekly review: date-anchored interval + coverage header (observed days, populated vitals, unknown preserved), nested `###` reflection parsing (#58–#59).

### 4.2 Zero-Downtime Migration Plan (Expand-Contract)

`N/A - file-based Markdown vault with Git revert per atomic commit; no live service schema, no dual-write population, no backfill. Disposable/pre-deployment escape applies: each issue is independently revertible per tracker contract. The one irreversible-adjacent action (history/visibility remediation, #31) is procedure/decision only in this spec — execution, if approved, is a separate deliberate operation with its own RPO/RTO and rotation plan.`

### 4.3 API Endpoints & Contracts

No service API changes. Script/CLI contracts preserved; `#63` corrects docs to executable commands. Key seams (TypeScript/Zod-style intent, exact schemas at implementation):

- `resolveDailyPath(date: ISODate, tz='Pacific/Auckland') → '01-Daily/YYYY-MM/YYYY-MM-DD.md'` — shared by #60/#57/activity sync; missing note = explicit actionable feedback, never silent legacy-path miss.
- `matchRemote(card) → { kind: 'issue'|'item'|'none', id }` — persisted ID first, title fallback with badge stripped; `inventoryComplete == false → createBlocked` (#48/#49).
- `validateNote(note) → { ok: boolean }` with process exit nonzero on invalid (#51); unknown type rejected; blank ≠ present.
- `triageSweep.transform(currentContent)` — re-reads current dump at write time; archives only successfully-filed still-identifiable entries (#40).
- `distillConcept(title) → link-or-append` — existing note reused, curated text/created/links/provenance preserved, proposal in reviewable section (#39).

## 5. Security, Privacy & Failure Modes (FMEA)

- **Tenancy Boundary**: `N/A - single-owner vault; boundary is public-repo vs private-life. Enforced by PrivacyBoundary + #31 procedure, not multi-tenant isolation.`
- **Authentication & RBAC**: GitHub `gh` auth scopes for sync (existing); local REST API plugin `data.json` credential-bearing file excluded + rotation conditional on exposure evidence (#29 + review F01). No new auth flows.
- **Input Sanitization**: Runtime boundaries at file/CLI seams — shared date/path resolver, title-vs-identity separation, link-target verification before write (#62), typed AI-response parsing (#68). Pre-commit hook + CI scan as defense-in-depth (#32–#35).
- **Secrets & PII**: Never in public issues/fixtures/commits; `.env`/`.secrets/` untouched; backup secrets handled separately (#42); hook narrow-placeholder + rename/env-variant coverage.

### FMEA Resilience Matrix

| Failure Scenario | Probability / Severity | Detection Method | Mitigation / Fallback | Recovery Strategy |
| :--- | :--- | :--- | :--- | :--- |
| Credential-bearing `data.json` staged via `git add -A` | High / High | `check-ignore` + index inspection in #29 verification | Explicit ignore rules + sanitized defaults; docs distinguish code vs config | Remove from index (not history); rotate only on exposure evidence |
| Kanban cache publishes task text | High / High | Tracked-cache diff review | Separate runtime cache from distributables (#30) | Deliberate remediation decision (#31); no silent rewrite |
| Habit toggle contaminates template | Medium / High | Fixture: toggle → template diff | Dated-note-only writes; definitions vs completion split (#37) | Audit old notes; restore template defaults |
| Same-title propagation rewrites old daily | Medium / High | Fixture: `laundry` pair across dates | Identity-scoped propagation; ambiguous → untouched + feedback (#38) | Revert note from Git/private backup; audit streak stats |
| Distill collision replaces curation | Medium / High | Fixture: colliding title | Link-or-append + metadata preserved (#39) | Restore curated text from backup/history |
| Capture appended mid-sweep lost | Medium / Medium | Concurrent-append fixture | Current-content transform; archive only filed entries (#40) | Re-capture from source; reconcile ambiguous originals |
| Sync duplicates via badge mismatch | Medium / Medium | Repeated-sync fixture creates extra | ID-first matching; badge excluded from identity (#48) | Delete drafts; link existing; idempotency proof |
| Failed inventory triggers creation storm | Low / High | Injected inventory failure | Gate: failed read → zero creations + `errors>0` surfaced (#49) | Paginate + retry; manual reconciliation |
| Weekly invents vitals/defaults | Medium / Medium | Sparse-date fixture | Preserve unknown; coverage header; no advice from gaps (#58) | Re-run anchored review; label observation-vs-calendar views |
| Checkpoint contradiction resumes wrong work | Medium / Medium | Fresh-session drill mismatch | Ownership + freshness + `unknown` default; verify-then-record (#43/#44) | Re-resolve from hub/board/repo evidence |

## 6. Conditional Implementation Milestones

Task Record TDD mode defaults to `disabled` (absent field). Execution uses one Task Record per wave (6 total: Wave 0 P0 first); each links its child GitHub issues and closes wave-by-wave. Milestones are dependency-ordered; per-issue `Closes #N` only on criteria + evidence. HomePulse code (#37) waits on source (#36, time-boxed — fallback: vendored-bundle minimal diff + equivalence check); schema-dependent work (#51–#54) waits on canonical schema (#50); analytics fixes (#55–#59) parallelize after #50 with scripts owning interval math.

- [ ] **Wave 0 — Stop the leak (P0)**: #29 runtime-config exclusion with dual proof: `check-ignore` excludes `data.json`-class runtime files AND distributable manifests/code stay trackable + safe index inspection. Gate for all else. #31 boundary decision recorded before Wave 1 merges.
- [ ] **Wave 1 — Privacy procedure + hook**: #31 boundary/remediation decision doc → #30 cache separation (tracked sanitized example defaults + ignored local override; forward migration of existing settings; cache never on tracked path) → #32/#33 hook matching → #34 reproducible activation → #35 CI scan. Evidence: disposable-repo fixtures, synthetic `data.json`, hook bypass fixtures (example-allowlist, `.env.example` exemption preserved, rename-only, `service.env`, generic JSON keys).
- [ ] **Wave 2 — Preservation**: #36 source/ownership discovery, time-boxed (no code; fallback vendored-bundle diff if source never surfaces) → #37 template-write fix → #38 identity-scoped propagation → #39 collision append → #40 current-content sweep → #41 mid-request edit preservation. Evidence: pairwise fixtures (today-vs-template, cross-date same-title, colliding concept, concurrent capture, late human edit).
- [ ] **Wave 3 — Recovery + continuity**: #42 generic recovery guide + local target confirmation + separate-folder restore drill (hub/board + daily + attachment) → #43 checkpoint/closeout contract in AGENTS/startup chain + Project template → #44 registry/handoff reconciliation + resume drills → #45 Hermes locate-then-bridge → #46 selected commitments surfaced once → #47 hierarchy + `[/]` carry-forward. Evidence: fresh-session resume per active project; chosen commitments appear exactly once.
- [ ] **Wave 4 — Sync correctness**: #48 ID-first matching + badge-neutral identity → #49 inventory gate + pagination + idempotent re-sync proof. Evidence: intercepted CLI/API fixtures, retitle + repeat-sync with zero duplicates.
- [ ] **Wave 5 — Schema, analytics, workflow, tooling**: #50 canonical schema → #51 nonzero-exit validation → #52 unclassified reporting → #53 priority normalization (`p0` first) → #54 template/board conformance → #55 calendar windows + coverage → #56 calendar streaks → #57 dated-interval selection → #58 unknown-preserved parsing → #59 anchored stats (scripts own Auckland interval math via shared resolver; dashboards render anchored values) → #60 monthly resolver (shared) → #61 explicit simulation → #62 target-verified links → #63 command docs → #64 scratch reconciliation → #65 weekly ritual + first dated decision review → #66 pinned runner → #67 bundle equivalence → #68 typed boundaries. Evidence: invalid-fixture nonzero exits, sparse-date analytics fixtures, monthly-path fixture, bundle-diff check, single weekly review note.

Sign-off readiness: per-wave Task Record link, stable `AC-*` inputs from child issues, one verification command/check per issue, review path (single-issue PR), and verification condition recorded before implementation. Test-plan intent never authorizes implementation by itself.

## 7. Sign-off & Grilling Checklist

- [x] Architecture challenged via `pk:grill` (5/5 probes cleared 2026-10-04, all on recommended): (1) Wave 0 keeps order with dual proof + #31 gates Wave 1 — resolved in §6 Wave 0/1; (2) #36 time-boxed discovery with vendored-bundle fallback — resolved in §6 Wave 2; (3) one Task Record per wave (6 total), Wave 0 first — resolved in §6 intro; (4) tracked sanitized example + ignored local override with forward migration — resolved in §6 Wave 1; (5) scripts own interval math, dashboards render anchored values — resolved in §6 Wave 5.
- [ ] Zero-downtime database evolution verified — `N/A` with rationale recorded (§4.2).
- [ ] Non-goals agreed upon with stakeholders (owner confirms #31, #42-target, #45-identity, #44-facts).
- [ ] Ready for the selected Task Record milestone path: `disabled` Code Work milestones above + docs/config exception paths; `pk:tasks` to create Wave 0 Task Record in `docs/tasks/` before any implementation.
