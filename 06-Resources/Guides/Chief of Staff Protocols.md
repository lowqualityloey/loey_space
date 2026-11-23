---
created: 2026-11-24
updated: 2026-11-24
type: guide
status: active
area: resources
tags:
  - type/guide
  - area/resources
  - status/active
  - topic/agents
  - topic/workflow
---

# Chief of Staff Protocols

These are the per-command protocols behind the `"Hey Loey"` dispatcher in [`AGENTS.md`](../../AGENTS.md). The router keeps the dispatcher table, the directory architecture, the metadata standard, the security policy, and the Morning Kick-off and Fast Daily Log protocols. The five longer protocols live here so the router stays under the 24,000-byte rule-file limit that Antigravity enforces on `AGENTS.md`.

Read the matching section before running the command it governs. Nothing here is optional guidance: each section is the contract for that command.

## 🌇 Evening Wind-down Protocol (`heyloey evening` / `hey loey evening`)

When executing `heyloey evening` or `hey loey evening`:
1. **GitHub Activity Auto-Sync**: Automatically execute `npm run log-github` in the background to non-destructively merge today's commits/PRs with 12h timestamps into the `### 🐙 GitHub Activity` area of `## 📝 Daily Log`.
2. **Focus Reconciliation & Briefing**:
   - Recall this morning's intentions from `### 🎯 Today's Focus`.
   - Surface today's GitHub achievements, closed issues, and merged PRs for quick celebration.
3. **Interactive Evening Check-In**:
   - Prompt the user for:
     1. **Focus & Reflections**: How did morning focus go? Any specific wins, blockers/friction, or lessons?
     2. **💡 Sparks & Fleeting Ideas**: Did any random thoughts, technical sparks, or new project ideas pop up today?
     3. **Habit Checks**: Which habits were kept today? (`water`, `move`, `read`, `tidy`, `disconnect`)
     4. **Sign-off Status**: Are you knocking off for the night, or still hacking?
4. **Post-Response Finalization**:
   - Write reflections into `### Wins`, `### Blockers`, and `### Reflection` as clean bullets.
   - Write any captured ideas into `### 💡 Ideas & Fleeting Notes` inside `## 🌇 End of the Day...` as clean polished bullets.
   - Update `## 🔁 Habits` checkboxes (`- [x]`) and calculate total kept (e.g. `5/6`). Auto-tick `disconnect` if the user is signing off.
   - Directly synthesize and write the **AI Daily Summary** into today's note in authentic Kiwi Chief of Staff style (ALWAYS separate the blockquote prompt from the body text with an empty blank line so the theme's green quote line does not stretch across the paragraph):
     - `### 📖 Daily Debrief`: Narrative prose of the day's events, friction, and outcomes.
     - `### 🧠 Chief of Staff Takeaway`: High-signal pattern, architectural insight, or blind spot.
     - `### 🎯 Tomorrow's Move`: Priority-first anchor recommending the top `#priority/p0` or `#priority/p1` task for tomorrow morning.
     - `##### 🔗 Connected Notes`: Relevant wikilinks to touched projects/notes.
   - Provide warm sign-off and pacing advice, acknowledging late sessions (>9 PM) to protect sleep.

---

## 🏗️ Project Planning Protocol (`heyloey plan` / `hey loey plan`)

When executing `heyloey plan <name>` / `hey loey plan <name>` or `heyloey project <name>` / `hey loey project <name>`:
1. **Interactive Scoping & Architecture**:
   - Extract the project name, core outcome, target domain (`dev` or `personal`), and proposed tech stack.
   - If key constraints or requirements are missing, ask at most 1–2 high-signal questions; otherwise proceed with pragmatic, battle-tested defaults.
2. **Vault Scaffolding (PARA Standard)**:
   - Create the project folder: `02-Projects/<name>/`.
   - Create the project master note: `02-Projects/<name>/<name>.md` using the [`99-Templates/Project.md`](../../99-Templates/Project.md) blueprint with `status: planning`, `type: project`, `priority: medium`, and `area: dev|personal`.
   - Create the companion visual board: `02-Projects/<name>/<name> Kanban.md` with standard lanes (`## Backlog`, `## To Do`, `## In Progress`, `## Review / Test`, `## Done`, `## Archive`).
3. **Backlog Decomposition & Sizing**:
   - Decompose project deliverables into bite-sized tasks (1–4 hours each) tagged `#priority/p0` to `#priority/p3`.
   - Break complex features into nested subtask criteria checklists.
   - Populate tasks into **`## Backlog`** by default.
4. **The Three Core Principles**:
   - **The Graduation Rule (`planning` $\rightarrow$ `active`)**: Newly scaffolded projects remain in `status: planning` (indexed under `## 📝 Planning & Backlog` in `_Projects MOC.md`) until active development starts. When ready to build, switch to `status: active` and promote initial foundation cards to `## To Do`.
   - **The Backlog Shield**: Tasks in `## Backlog` are completely shielded from Daily Note mirror blocks, `_Tasks MOC.md`, and `Tasks Kanban.md`, protecting daily headspace from clutter.
   - **The GitHub Projects Hook**: If a GitHub repository is specified, inject `github_project_number`, `github_owner`, and `github_repo` into Kanban frontmatter for seamless two-way sync via `npm run sync-kanban`.

---

## ✍️ Communication & Note Polishing Policy

1. **Effortless Input**: Accept user prompts and replies with casual phrasing, typos, shorthand, and imperfect grammar with zero friction or unsolicited correction. Understand intent natively.
2. **Automatic Polishing on Write**: When recording user focus intentions, wins, blockers, reflections, or fleeting ideas into markdown notes, automatically polish and refine the phrasing into clear, concise, well-structured bullets while strictly preserving the user's authentic meaning and personal tone.

---

## 🌙 Dream Loop & Distillation Protocol

Two different things share this name, and conflating them is how this section drifted from the code. **`heyloey dream` is a CLI verb that does three mechanical things. Distillation is an agent protocol you run on request.** The verb never reads a daily note's reflections and never writes a concept or snippet.

### 1. `heyloey dream` — the CLI verb (mechanical, no agent)

Runs nightly at 02:00 from cron (`0 2 * * * /home/heyloey/.local/bin/heyloey dream`). It does exactly three things, and nothing else:

1. **Prune `handoff.md` overflow** past `MAX_HANDOFF_UPDATES` (10) into `07-Reviews/handoff-archive-YYYY-MM.md`. This is redundant with `done`, which already prunes on every write.
2. **Carry up to 3 unfinished tasks** from yesterday's `### ✅ Tasks` into today's note. It only matches `- [ ] <text>` with text after the box, and it **never creates today's note** — an absent note is reported and skipped.
3. **Print the `memory.md` budget** (lines/bytes against 200 / 8192). It reports; it does not act.

It does **not** run `check-rot`, does **not** read `Blockers`/`Reflection`/`Ideas`, and does **not** write any note other than the handoff prune. `heyloey distill` is **not a CLI verb** — it falls through to the usage block. `--dry-run` prints what would be pruned and carried without writing.

### 2. Distillation — the agent protocol (on request, Propose-First)

When the owner asks for a distillation pass (`heyloey distill`, `heyloey dream` in conversation, or during `heyloey weekly` consolidation), the agent does the work the CLI does not:

1. **Deterministic anti-rot scan**: run `npm run check-rot` (the alias carries `--include-ignored`, so private-plane hubs are scanned) to inspect:
   - **Memory Capacity**: whether `memory.md` exceeds 75% of its budget, and whether the Core Memory Routing Rule header is present. Budget is 200 lines / 8 KB, so the warning fires at 150 lines / 6 KB.
   - **Overdue Reviews**: notes in `02-Projects/`, `04-Learning/`, `05-Personal/`, and `08-Concepts/` where `last_reviewed + review_cycle < today`.
   - **Skill Library Health**: `.agents/skills/*/SKILL.md` carry `pinned`, `version`, and `## 🧪 Regression Cases`; a deprecated skill declares `absorbed_by`.
2. **Read-only synthesis**: inspect the last 7 days of `01-Daily/YYYY-MM/*.md` (`### Blockers`, `### Reflection`, `### 💡 Ideas & Fleeting Notes`) and the milestone tables, then identify repeated friction, solved debugging patterns, and recurring mental models.
3. **Proportionate Approval (Propose-First vs. Explicit Request)**: present a structured proposal before mutating evergreen or system files:
   - **Candidate Concepts (`08-Concepts/`)**: atomic mental models (`review_cycle: 90d`).
   - **Candidate Snippets (`03-Dev/`)**: reusable code patterns (`type: snippet`).
   - **Memory Offload (`memory.md` $\rightarrow$ `06-Resources/`)**: specific infra/system details to move out of core memory if usage is high.
   - **Explicit User Request**: when the owner directly asks to create a specific concept or snippet, that request already authorizes the write — create the note and update its MOC without an extra confirmation prompt.
   - **Never autonomously delete skills or notes.** Archive stale notes via `status: archived` only after explicit user sign-off.
   - **Never invent the owner's own record.** An empty `Reflection` or `Ideas` section is empty; do not fill it with inferred content to make a distillation pass look productive.

---

## 🛠️ Specialized Vault Skills & Lifecycle Guardrails

The agent has 5 custom skills available in `.agents/skills/`:

1. **`vault-concept-distiller`** (`pinned: true`): Extracts atomic evergreen concepts into `08-Concepts/` with 90d review cycles.
2. **`kanban-project-planner`** (`pinned: true`): Decomposes features into priority-tagged Kanban cards (`#priority/p0-p3`) and manages GitHub Project sync.
3. **`vault-hygiene-auditor`** (`pinned: true`): Validates frontmatter taxonomy, scans for broken wikilinks, checks for secret leaks, and runs `--check-rot`.
4. **`habit-trend-analyzer`** (`pinned: true`): Correlates multi-day mood/energy/sleep metrics with habits and generates weekly retrospectives in `07-Reviews/`.
5. **`dev-snippet-indexer`** (`pinned: true`): Formats reusable technical snippets into `03-Dev/` with syntax highlighting and language tags.

**Skill Anti-Rot Invariants**:
- Every skill must define `version`, `pinned`, and a `## 🧪 Regression Cases` table.
- Pinned skills (`pinned: true`) are protected from deletion; they may only be patched if all regression cases continue to pass.
- Any deprecated or merged skill must declare `absorbed_by: <target-skill>` in frontmatter and have its regression cases verified against the absorbing skill before removal.
