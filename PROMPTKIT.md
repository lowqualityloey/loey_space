# Project Architectural Profile (`PROMPTKIT.md`)

> **Instructions for AI**: Read this file during every session. Adhere strictly to the project domain boundaries, commands, documentation targets, and non-negotiable architectural rules defined below. Placeholders marked `[e.g. ...]` are **intake questions, not defaults**: when a value is unknown, report it to the user via the bounded intake (`protocols/discovery-intake.md`) instead of inventing a value.

## 0. PromptKit OS Profile
- **Profile**: balanced
- **Installed**: [YYYY-MM-DD]
- **Engine**: `<kit>` (resolved kit root: `.promptkit/` recommended, `promptkit/` supported)
- **Description**:
  - `lite`: 6 utility workflows (route, debug, commit, checkpoint, sync, profile) <1,500 tok, 80% value — onboarding
  - `balanced`: the full 25-workflow set, Level 0-3 adaptive ceremony (default) — teams, production
  - `turbo`: experimental, Balanced + parallel subagent waves, up to ~2x measured token cost, still requires human L3 approval
- **Upgrade Path**: From your resolved kit root, run `./init.sh --balanced` for full, `--lite` for minimal, `--turbo --experimental` for parallel waves — or switch in-session with `pk:profile`


status-cards: on
> `status-cards: on` (default) emits the 3-line telemetry card on completion; `off` suppresses the decorative card only — `> [!IMPORTANT]` / `> [!WARNING]` halts still fire. A missing line means `on`.

card-style: framed
> `card-style: framed` (default) formats human callouts with ceiling-and-floor box borders (`╔═ ... ╚═`); `markdown` uses GFM blockquotes (`> [!TIP]`); `off` disables decorative framing while preserving text.

size: [small | medium | large]
intake-status: [unanswered | partial | legacy-partial | complete]
> `size:` and `intake-status:` are written by `pk:onboard` (greenfield Phase 0 interview, or a brownfield estimate marked `legacy-partial` when fields predate intake). `unanswered` or `partial` instructs `pk:plan` Step 0 to run the bounded intake in `protocols/discovery-intake.md` before proposing architecture. Never guess these values.

---

## 1. Project Overview & Domain
- **Project Name**: [e.g. Acme Dashboard]
- **Domain / Purpose**: [e.g. Multi-tenant B2B analytics platform for logistics tracking]
- **Primary Users**: [e.g. Fleet operators, dispatch managers]

---

## 2. Active Technology Stack
> Recorded by detection on 2026-10-04 (`pk:sync` profile drift audit). Unmeasured surfaces are marked `N/A - <reason>` rather than guessed.
- **Language & Runtime**: TypeScript 5.9 (ES2022 / CommonJS; `strict: false`, `noImplicitAny: true` — do not claim strict mode), Node.js v24, npm 12 (lockfile: `package-lock.json`, so **npm is canonical, not pnpm**)
- **Domain**: Obsidian Markdown vault (PARA + MOCs). Not a web application.
- **Frontend Framework**: `N/A - no web frontend; the UI is Obsidian plus bundled vanilla-JS plugins`
- **Styling & Design System**: `N/A - CSS snippets only (`.obsidian/snippets/`), no component framework`
- **State & Data Fetching**: `N/A - no client state layer`
- **Backend & Database**: `N/A - no server and no database; vault state is Markdown + Git`
- **Bundler**: esbuild 0.20.2 (`node build.mjs`) — native binary is per-platform, see §3 Cross-OS note
- **Testing**: `node --test` via the pinned `tsx` runner, suites in `06-Resources/scripts/tests/*.test.mjs`
- **GitHub Integration**: `gh` CLI for Projects v2 sync; pre-commit hook + CI share `.githooks/lib/secret-scan.sh`

---

## 3. Project Commands & Evidence-Gated Verification
PromptKit OS enforces Evidence-Gated Verification. Every completion claim requires executed evidence matching the task ceremony level. These are this project's native commands (npm, per §2):
- **Fast Tier (Level 0/1)**: `npm run typecheck`
- **Required Tier (Level 1/2)**: `npm test`
- **Extended Tier (Level 2/3)**: `npm run build && npm run validate-templates && npm run audit-links`
- **Secret scan (always, before any commit claim)**: `bash .githooks/lib/secret-scan.sh --tracked`
- **Cross-OS Execution Bridge (Optional)**: `wsl bash -c "<command>"`. **Required in practice, not optional.** The vault lives on a Windows drive (`/mnt/c/...`) and is shared with a Windows Obsidian install. `node_modules/` holds platform-specific native binaries, so a tree installed on Windows contains only `@esbuild/win32-x64` and every `npm run build` from WSL aborts. Never share `node_modules/` across operating systems: `rm -rf node_modules && npm ci` per platform, or verify from a Linux-side clone.

### 3a. Active Stack Playbooks (JIT Loaded)
> Candidate manifests detected by `pk:onboard` map to bounded playbooks in `docs/stacks/`. Loaded strictly just-in-time; never loaded all at once.
- **Active Playbooks**: `N/A - no playbook matches; this is a Markdown vault plus Node CLI scripts. Closest is docs/stacks/api-node.md, but there is no HTTP layer, so it does not apply.`

- **Standard Commands**:
  - **Install**: `npm ci` (never reuse a `node_modules/` across OSes — see Cross-OS note)
  - **Dev Server**: `N/A - no dev server; scripts run from Obsidian QuickAdd or the CLI`
  - **Rebuild bundles**: `npm run build` (required after editing anything under `06-Resources/scripts/src/`; the generated `06-Resources/scripts/*.js` bundles are committed)

---

## 4. Monorepo & Workspace Topology (If Applicable)
> Set to `N/A (Standalone Repository)` if not operating within a multi-package monorepo.

- **Workspace Manager**: [e.g. Turborepo, pnpm workspaces, Nx, Bun workspaces, or N/A]
- **Package Graph & Directory Map**:
  - `apps/web`: Next.js frontend application (`@repo/web`)
  - `apps/api`: Backend API service (`@repo/api`)
  - `packages/db`: Database client, migrations, and Drizzle/Prisma schemas (`@repo/db`)
  - `packages/ui`: Shared design system and Tailwind components (`@repo/ui`)
  - `packages/auth`: Shared authentication utilities and session policies (`@repo/auth`)

- **Scoped Workspace Commands (`--filter`)**:
  - **Dev Specific App**: `pnpm --filter web dev` (or `turbo run dev --filter=web`)
  - **Test Specific Package**: `pnpm --filter @repo/db test` (or `turbo run test --filter=@repo/db`)
  - **Typecheck Package**: `pnpm --filter web typecheck`
  - **Build Specific Target**: `pnpm --filter web build` (or `turbo run build --filter=web...`)

- **Strict Architectural Import Boundaries**:
  - [ ] **Presentation Isolation**: `packages/ui` must never import from application targets (`apps/*`) or server-only packages (`packages/db`).
  - [ ] **Client / Server Boundary**: Client components in `apps/web` (`"use client"`) must never import directly from `@repo/db` or internal server secrets.
  - [ ] **Public Package Exports Only**: Never reach across workspace boundaries using relative deep paths (for example `../../packages/db/src/internal.ts`). Always consume packages through exports declared in their `package.json` (`@repo/db`).
  - [ ] **Workspace Protocol**: Inter-package dependencies must declare explicit workspace protocols in `package.json` (e.g. `"@repo/ui": "workspace:*"`).

---

## 5. Active MCP Capabilities (Optional)
> Record detected or configured Model Context Protocol (MCP) servers (via Docker Desktop MCP, stdio `npx`, or native client configs). PromptKit OS follows a **Progressive Enhancement** model: MCP tools serve as optional accelerators. When available, assistants prioritize native MCP tool calls; when unavailable, assistants seamlessly fall back to structured Markdown and terminal CLI commands with zero errors.

- **Reasoning / Scratchpad MCP**: [e.g. `sequential-thinking` (`@modelcontextprotocol/server-sequential-thinking`) for `pk:debug` hypothesis branching & `pk:plan` tradeoffs | N/A]
- **Documentation / Web Reader MCP**: [e.g. `fetch` (`@modelcontextprotocol/server-fetch`) or Jina reader for clean primary doc lookups | N/A]
- **Task Tracking System**: [Local Markdown (docs/tasks/ + docs/STATE.md) | GitHub Issues | Jira (manual import, no auto-push) | Linear (manual import, no auto-push)]
- **Task Tracking Selector (machine-readable)**: `tracking: local` (options: `local|github|jira|linear`; Jira/Linear = manual import, board is projection only, Local Task Record authoritative)
- **GitHub MCP**: [e.g. `github-mcp-server` for PR creation, issue reading, commit search | N/A]
- **Database MCP**: [e.g. `postgres-mcp` or `sqlite-mcp` for read-only schema discovery & `pk:data` checks | N/A]
- **Browser / UI MCP**: [e.g. `playwright` for `pk:design` visual and E2E verification | N/A]
- **Execution Precedence**: Native MCP Tools $\rightarrow$ Native IDE Search/Edit Tools $\rightarrow$ Terminal CLI Commands $\rightarrow$ Structured Markdown Fallback

### 5a. LSP Capabilities (Optional)
> Record detected language-server capabilities for range-accurate diagnostics (`file:line:col`) consumed by `pk:review`. Progressive Enhancement applies: LSP is an optional accelerator, disabled by default, with zero token overhead for Lite-profile users. When unavailable, assistants fall back to the Section 3 typecheck/lint commands with zero errors. The assistant never starts or enables a language server; humans configure in-host.

- **LSP Enabled**: [false (default) | true | not measured]
- **LSP Servers**: [e.g. `tsserver`, `pyright`, `rust-analyzer` | none]
- **Evidence Source**: [lsp-mcp | tsc-cli | not measured]

---

## 6. Documentation & Artifact Storage Paths
All artifacts generated by PromptKit workflows must be saved to these host project paths:
- **Architectural Decision Records (ADRs)**: `docs/adrs/`
- **Technical RFC Specs**: `docs/specs/`
- **Incident Post-Mortems (RCAs)**: `docs/rca/`
- **Technical Spikes & Benchmarks**: `docs/spikes/`
- **Design Tokens & UI Specs**: `docs/design/`
- **Data Models & Schemas**: `docs/data/`
- **Authentication & RBAC Matrices**: `docs/auth/`
- **API Contracts & Envelopes**: `docs/api/`
- **Test Strategy & Plans**: `docs/tests/`
- **Release Checklists & Reports**: `docs/releases/`

### Standard Root Documentation (Optional / Detected)
> Pre-existing repository documentation detected during `pk:onboard` or `context-sync`. PromptKit respects these as authoritative references. Set to `N/A` if not present.
- **Architecture Blueprint**: [e.g. `./ARCHITECTURE.md` or N/A]
- **Strategic Roadmap**: [e.g. `./ROADMAP.md` or N/A]
- **Operations Runbook**: [e.g. `./RUNBOOK.md` or `./OPERATIONS.md` or N/A]
- **Code Style Guide**: [e.g. `./STYLE.md` or `./STYLEGUIDE.md` or N/A]

---

## 7. Non-Negotiable Architecture Rules & Guardrails (scope each item to the applicable stack; mark `N/A - <reason>` where not applicable)
- [ ] **Zero `any` / Loose Casting** (TypeScript projects): Strict TypeScript at all times. Use native validation (e.g. Zod/Valibot for TypeScript) for boundary parsing; otherwise `N/A - <reason>`.
- [ ] **No Business Logic in UI** (projects with a UI layer): Presentation components only render props and dispatch intents; business logic lives in domain hooks or service layers; otherwise `N/A - <reason>`.
- [ ] **Database Invariants First** (projects with a relational database): Foreign keys, unique constraints, and check constraints live in the database schema, not just application code; otherwise `N/A - <reason>`.
- [ ] **WCAG 2.2 AA Compliance** (projects with a user-facing UI): All interactive elements must support keyboard navigation, visible focus rings, and proper ARIA labels; otherwise `N/A - <reason>`.
- [ ] **Deterministic Error Handling**: No silent `catch {}` blocks. Use typed `Result<T, E>` or centralized error boundaries.
- [ ] **Anti-Slop & Structured Scannable Output**: Output all status updates, plans, and diffs in structured scannable markdown (tables, checklists, short bullets). Prohibit long narrative conversational essays.
- [ ] **Absolute Secret Hygiene & `.env.example`**: Never paste, expose, or request secrets, API keys, or credentials in chat. Maintain `.env.example` with placeholder keys and instruct developers to manage `.env` locally.
- [ ] **Context Window Reset Threshold (~30 Turns)**: When conversation approaches ~30 turns or high token saturation, run `pk:checkpoint` to synchronize `docs/STATE.md` and recommend continuing in a fresh session via `pk:route`.
- [ ] **Standardized Human Action Callouts**: When terminating a turn that requires user decision, approval, or local action (e.g. merging PR, editing `.env`), terminate with a high-contrast `> [!IMPORTANT]` block titled `### 🛑ACTION REQUIRED:`. If blocked, terminate with `> [!WARNING]` titled `### 🚫BLOCKED:`.
- [ ] **Strict Milestone Git Boundaries**: Never start a new milestone or major task phase carrying this task's own uncommitted changes (pre-existing dirt — including fresh `init.sh` scaffold output — is surfaced and recommended for commit, never a stall reason). working tree. Upon completing a milestone, run test verification, prompt for or execute atomic staging (`pk:commit`), update `docs/STATE.md`, and obtain human confirmation with `> [!IMPORTANT]` before proceeding.
<!-- Optional: Uncomment if using GitHub Issues or external issue tracker -->
<!-- - [ ] **Issue Tracker Synchronization**: Decompose all feature milestones and bugs into atomic issues with Gherkin AC via `pk:tasks` before active coding. Commits must reference issue IDs (`Closes #N`). -->

profile: balanced
tracking: local
projection: github
