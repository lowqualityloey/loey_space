# Claude Adapter for loey_space

`AGENTS.md` is the canonical Chief of Staff router. Read it first and follow it — this file only
records what differs for Claude, and it deliberately does not restate the vault rules, because a
second copy of a rule is a copy that can drift.

- The private records — `memory.md`, `handoff.md`, and the optional `00-Private/SOUL.md` — are
  absent in a fresh clone. If one is missing, run `npm run init:vault` and report what it created.
  Never invent their contents, and never pass a scaffold template's placeholder text off as the
  user's own words.
- Do not read or output files inside `.secrets/` or `.env`.
- Never invent wikilinks `[[Like This]]` unless the target note physically exists.
- Follow the Johnny Decimal / PARA directory architecture strictly.


<!-- PROMPTKIT_START -->
## PromptKit OS: Engineering Operating System
PromptKit OS is active in this workspace (`./.promptkit`). Follow these protocols, workflows, and quality gates during pair-programming, design, code generation, and review:
Engine: v2.0.0-39-g2ecc74b (2ecc74b) — stamped at install time; run `pk:sync` to check for drift.

### Fast Shorthand Triggers (Collision-Free)
Activate workflows anytime with these namespaced triggers:
- `pk:route`: Lifecycle router + decision matrix.
- `pk:tutor` (or `pk:tutor beginner`, `pk:tutor architect`): Socratic mentorship, 3-tier hints.
- `pk:grill`: Staff Engineer architecture interview + defense drill.
- `pk:plan`: Spec-driven architecture + feature planning.
- `pk:onboard`: Project intake + PROMPTKIT.md scaffold.
- `pk:tasks` (or `pk:issue`, `pk:kanban`): Decompose specs into atomic issues.
- `pk:review`: Multi-dimensional PR + architecture review.
- `pk:commit`: Atomic commits, single-concern staging, secret-leak scan.
- `pk:pr`: PR descriptions, verification evidence, GitHub CLI.
- `pk:debug`: Hypothesis-driven debugging + root cause analysis.
- `pk:fix`: Surgical remediation, security-first ordering.
- `pk:refactor`: Structural debt remediation.
- `pk:perf`: Performance profiling, latency SLAs.
- `pk:data` (or `pk:db`): Relational modeling, indexing, RLS.
- `pk:auth`: Auth flows, cookie security, session, RBAC.
- `pk:api`: Frontend-backend handshake, unified envelopes.
- `pk:test`: Testing strategy, seam allocation, mock boundaries.
- `pk:ship`: Release engineering, migration sequencing.
- `pk:spike` (or `pk:research`): Technical spikes + benchmarks.
- `pk:design`: UI/UX, design tokens, WCAG 2.2 AA.
- `pk:retro` (or `pk:reflect`): Retrospective log + ADR extraction.
- `pk:checkpoint` (or `pk:handoff`): State compaction, STATE.md update, handover prompt.
- `pk:sync` (or `pk:update`, `pk:refresh`): Hot-reload protocols, sync to disk.
- `pk:profile`: Switch Lite/Balanced/Turbo profile at runtime.
- `pk:auto`: Autonomous SDLC pipeline, stop at review-ready.
- `pk:doctor`: Read-only installed-governance audit (hosts, engine version, install mode, ignore state, docs drift).

### Smart Auto-Route & Guardrails (Triggers Are Optional)
You do not need to memorize triggers. If a prompt lacks an explicit `pk:` trigger, apply this triage:
- **Fast-Path (Zero Overhead)**: For simple questions, lookups, formatting, or single-line tweaks, answer directly. No heavy ceremony. **Risk-before-size**: 1-line security or data edits escalate immediately.
- **TL;DR-First Output**: Start substantive turns with TL;DR 1-3 bullets (≤40w: outcome+next) → Details (tables/lines) → Next. Grade-8 plain. No paragraph >3 lines, no essay walls. L0 exempt. L2/L3 evidence never shortened. `TL;DR` live only; `Session Summary` checkpoint-only.
- **Absolute Secret Hygiene**: Never output or request raw secrets/keys; mandate `.env.example` templates and local `.env`.
- **Context Economy**: Lowest-cost context first; escalate on Hard Triggers (auth, DB, APIs, shared state). Anti-Starvation: halt/escalate before guessing.
- **Search Circuit Breaker (advisory)**: 1 unit=1 read/search call (parallel batch=1). Halt past **≤6 (L0/L1)/≤12 (L2/L3)** with no task-advancing edit/test: HALT, ask for paths. Trivial edits do not reset. Read-only tasks exempt.
- **Session Endurance**: Nudge ~15 substantive turns, hard checkpoint ~30 turns (L2/L3 hard, L1 adv). If unable to recite invariants from a fresh `docs/STATE.md` read, run `pk:checkpoint` for fresh session.
- **STATE.md Untrusted Until Read**: Quote milestone/task values only from the current turn's read of `docs/STATE.md`; template placeholder fields must be reported as `not tracked`, never as computed-looking facts.
- **Telemetry Card Provenance & Oracle Integrity**: Every number in a status card must trace to a command executed or file read in this turn; otherwise emit `not measured`. Never claim a green Quality Gate without an executed check this turn, and never modify, weaken, or delete tests or write vacuous assertions to force `exit code 0`.
- **Native MCP & Interactive Turn Prompts**: Auto-detect active MCP servers and prioritize structured tools over shell commands. Format discretionary Type A/B choices per `card-style:` in `PROMPTKIT.md` (framed box default; `> [!TIP]` when markdown) only when no `[!IMPORTANT]` or `[!WARNING]` halt is active. Route Type C/D decisions through their decision card, and suppress TIP whenever a higher-priority halt is present. When a Type A/B choice has a supported native picker, use it; otherwise format at most 3-4 priced options under `### 💡NEXT STEPS (Type number & Enter):` with Option 1 `(Recommended + why)`. A numeric reply selects only that stated option; it does not authorize a separate protected action.
- **Telemetry Cards & Single Callout**: Emit card and callouts per `card-style:` (`.promptkit/protocols/telemetry-cards.md`: framed ceiling/floor box default; GFM alert when markdown; `[■■■■■■■■□□]`). Max 1 callout/turn (IMPORTANT > WARNING > TIP). Suppress cards on `status-cards: off` (halts fire); silent on empty state.
- **Disk-First Protocol Loading & Hot-Reload (`pk:sync`)**: Never rely on conversational memory or past turn habits for workflows or quality gates. Always read `.promptkit/workflows/<trigger>.md` freshly from disk. When receiving `pk:sync` or after engine updates, immediately refresh context from disk.
- **Context Recovery**: After handover, compaction/continuation, task-invariant loss, or status interruption that displaced active work, pause writes; read `.promptkit/workflows/sync.md` before resuming.
- **Pre-Response Check**: Before replying, confirm stop state, the highest-priority unresolved human action with its concrete action + `👉 Reply:` hint, retained suppressed actions, honest evidence, and TL;DR on substantive turns (L0 exempt); see `.promptkit/protocols/telemetry-cards.md`.
- **Project Database & Harness Isolation**: Integration tests and DB verification must use dedicated project-scoped containers (e.g. `./docker-compose.yml`). Never run destructive queries against foreign project containers or credentials.
- **Strict Milestone Git Boundaries**: A milestone boundary is the turn after a `pk:plan`/`pk:tasks` milestone or Task Record closes. Never cross it carrying **this task's** uncommitted changes; pre-existing dirt (e.g. init output) is surfaced and recommended for `pk:commit`, never a stall reason. At milestone end: stage atomically (`pk:commit`), update `docs/STATE.md`, request human sign-off (`> [!IMPORTANT]`).
- **Protocol Auto-Route (Substantive Tasks)**: For multi-file changes or architecture, announce briefly (e.g. `[PromptKit OS: Auto-routed to pk:plan]`) and adopt the matching workflow from the Fast Shorthand Triggers above (`pk:auto` for unattended execution).

### Workflows & Protocols Reference
Load lazily by convention — never preload:
- Workflow: `.promptkit/workflows/<trigger>.md` (e.g. `pk:plan` -> `workflows/plan.md`, `pk:design` -> `workflows/design-system.md`)
- Trigger-to-file exceptions (the convention alone would misresolve these): `pk:spike` -> `research.md`, `pk:retro` -> `reflect.md`, `pk:grill` -> `tutor.md`, `pk:design` -> `design-system.md`; parenthesized aliases inherit: `pk:db` -> `data.md`, `pk:handoff` -> `checkpoint.md`, `pk:issue`/`pk:kanban` -> `tasks.md`, `pk:update`/`pk:refresh` -> `sync.md`; all other triggers match their file name.
- Protocols: `.promptkit/protocols/{setup,context-sync,code-quality-gate,subagent-delegation}.md`
- Router: load `.promptkit/workflows/route.md` only when routing is ambiguous or Level 3 escalation/downgrade rules are needed
- Project files: `./PROMPTKIT.md`, `./DESIGN.md`, `./docs/STATE.md` (if present)

### Task Ceremony Levels (classify here — do not load route.md to decide)
Declare on line 1 of Turn 1 (no banner for informational L0 fast-path): `[PromptKit OS: Level <0-3> (<Name>) — <1-line reason>]`
- **L0 Direct**: questions, lookups, doc typos, formatting, non-risky 1-line edits. `understand -> change -> verify`. No task record. Risk-before-size: 1-line security/data edits escalate.
- **L1 Standard**: localized bug fix, small self-contained feature, no schema/auth/breaking contract. Inline planning; no Task Record file.
- **L2 Controlled**: schema/migrations, auth, permissions, public contracts, multi-component. Requires `docs/tasks/<task-id>.md` + spec before implementation.
- **L3 Release-Critical**: release, tag, deploy, high-impact contract change. Requires L2 evidence + `pk:ship` + explicit human approval.
- **Escalate** immediately if scope grows into persistent data, auth, public contracts, or multiple components. **Ties take the higher level.** Downgrades must be announced with a one-line reason; silent downgrade is a protocol violation. `workflows/route.md` remains the canonical authority for these rules and for downgrade guardrails.

### Project Artifact Output Paths
Save generated project documentation to host `./docs/` per `PROMPTKIT.md` (State: `docs/STATE.md`, Tasks: `docs/tasks/`, Specs: `docs/specs/`, ADRs: `docs/adrs/`, Releases: `docs/releases/`). Specialized directories (`data/`, `auth/`, `api/`, `tests/`, `design/`, `perf/`, `rca/`, `spikes/`, `reviews/`) are created on-demand.
<!-- PROMPTKIT_END -->
