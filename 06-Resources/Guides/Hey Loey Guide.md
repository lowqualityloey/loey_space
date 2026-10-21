---
created: 2026-10-12
updated: 2026-10-21
type: guide
status: active
area: resources
tags:
  - type/guide
  - area/resources
  - status/active
  - topic/ai
  - topic/agents
---

# Hey Loey Guide

This guide covers how to use the built-in conversational assistant in `loey_space`, how automated logging works, and how conversational prompts differ from the command-line tool.

The conversational assistant acts as a digital Chief of Staff for your vault, guided by the instructions in [AGENTS.md](../../AGENTS.md).

## Conversational Prompts

When working inside an AI coding assistant (such as Google Antigravity, Claude Code, Cursor, or Windsurf), start a message with `"heyloey"` or `"hey loey"` to run specific vault routines:

| Prompt | Routine | What it does |
| :--- | :--- | :--- |
| `heyloey status` | Pulse check | Counts unprocessed lines in `quick-capture-dump.md`, checks today's habit completion in your daily note, and lists active project tasks. |
| `heyloey morning` | Morning kick-off | Opens or creates today's note, sets a quote from a notable thinker, surfaces in-flight tasks, and prompts you for 1–3 daily intentions and morning vitals (`mood`, `energy`, `sleep_hours`). |
| `heyloey evening` | Evening wind-down | Reconciles morning focus, prompts for habit checks and reflections, and writes the AI daily debrief and takeaway into today's note. |
| `heyloey log` / `sync` | Explicit daily log | Records your session work, wins, or blockers in the matching area of `## 📝 Daily Log` in today's daily note — automated outcomes in `### 🤖 Agent Milestones`, your own entries in `### 🧍 Personal Log`. |
| `heyloey handoff` | Session handoff | Updates `handoff.md` with in-flight objectives and immediate next moves for your next session. |
| `heyloey sweep` | Inbox triage | Inspects `quick-capture-dump.md`, adds category tags, and runs the triage sweep script. |
| `heyloey plan <name>` | Project planning | Creates a project folder in `02-Projects/<name>/`, scaffolds `<name>.md` and a companion visual Kanban board with backlog shielding. |
| `heyloey distill` | Knowledge distillation | Reviews recent daily notes, extracts evergreen ideas into `08-Concepts/`, and checks memory capacity. |
| `heyloey weekly` | Weekly review | Aggregates seven-day habit trends and project progress into `07-Reviews/YYYY-[W]WW.md`. |
| `heyloey health` | Vault hygiene | Validates frontmatter taxonomy, checks for broken wikilinks, runs anti-rot checks, and confirms no secrets exist in tracked files. |

## Milestone-Only Logging Policy

To prevent the daily note and handoff records from filling with conversational clutter, automated logging follows strict boundaries:

1. **Autonomous logging (`heyloey done`)**: When an agent finishes a task, it logs only concrete outcomes: shipped features, resolved bugs, or blockers requiring a user decision. Routine questions, brainstorming, reading steps, and health checks are not logged automatically.
2. **Consolidation**: Multiple review or test cycles on the same task are consolidated into a single milestone summary rather than several repetitive entries.
3. **Explicit user requests**: When you explicitly ask to log or save a discussion or brainstorm session, that explicit instruction authorizes the entry.

Daily work entries are written inside `## 📝 Daily Log` in `01-Daily/YYYY-MM/YYYY-MM-DD.md`, in the area that matches the writer: automated agent outcomes in `### 🤖 Agent Milestones`, your own entries in `### 🧍 Personal Log`, and synced events in `### 🐙 GitHub Activity`. Use the format `- **hh:mm AM/PM**: <summary>` (for example, `- **04:04 PM**: Shipped the fix`). Dates and times use `Pacific/Auckland`. Keep timestamped bullets and rows in chronological order, oldest first, within each area and table; when updating an entry's timestamp, move it to its new position. Preserve untimed prose and surrounding sections. Personal entries never reach `handoff.md`; agent milestones do. Handoff entries are written to `handoff.md` under `### Latest Updates` and retain their `YYYY-MM-DD HH:MM` format.

## Conversational Prompts vs. CLI Tool

The word "heyloey" names two different things, and they do not share an implementation. Tell them apart by where you type them:

- **Conversational Assistant (in chat)**: Start a message to your AI coding assistant with `"heyloey"` or `"hey loey"`. The agent reads [`AGENTS.md`](../../AGENTS.md) and runs the interactive routines in the table above — morning kick-offs, evening reviews, project planning, retrospectives. It is a conversation.
- **Deterministic CLI (`heyloey`)**: A Node command that ships inside the repository. It runs fixed subcommands, writes in fixed formats, and needs no AI session. Use it from terminal scripts, background workers, or a git hook.

### Running the CLI without a global install

The supported first path is the repository's own npm script. It needs only Node and runs the committed bundle (`06-Resources/scripts/heyloey.js`) directly:

```bash
npm run heyloey -- brief
npm run heyloey -- context "kanban sync"
npm run heyloey -- done "Ship the parser fix"
npm run heyloey -- learn "Debounce" "const debounce = (fn, ms) => setTimeout(fn, ms);"
```

Installing it globally is optional. `package.json` declares a `bin` entry, so `npm link` exposes the same bundle as `heyloey` on your `PATH`. Nothing else is required, and no binary is checked in.

### Vault targeting

The CLI never guesses where your vault is, and it hardcodes no username or machine path. It acts on the working directory, or on `--root <dir>`:

```bash
npm run heyloey -- --root ~/vaults/my-vault brief
```

Run it from the vault root and the path is implicit. Output names the target relative to your working directory so it stays safe to paste; add `--show-paths` for the absolute path.

### Commands

| CLI command | Reads / writes | What it does |
| :--- | :--- | :--- |
| `npm run heyloey -- brief` | Read-only | Condensed pulse: records present, today's focus and vitals, open tasks, habit count, inbox count, active projects. |
| `npm run heyloey -- context "<query>"` | Read-only | Routes the query to matching projects, snippets, notes and runbooks, printing paths only. |
| `npm run heyloey -- done "<summary>"` | Writes | Adds a milestone under `### 🤖 Agent Milestones` in today's daily note and under `### Latest Updates` in `handoff.md`. Refuses if either record, or the heading it owns, is missing — it never scaffolds a note. |
| `npm run heyloey -- personal "<entry>"` | Writes | Records your own entry under `### 🧍 Personal Log`. `handoff.md` is never touched. |
| `npm run heyloey -- migrate-log [--date <day>]` | Writes | One note (today unless `--date` names another) gains its labelled areas: entries whose summary has the automated outcome shape move to `### 🤖 Agent Milestones`, everything else stays exactly where it is. `--dry-run` prints the plan and writes nothing. |
| `npm run heyloey -- learn "<Title>" "<Pattern>"` | Writes | Indexes a reusable pattern in `03-Dev/` and links it to the existing Dev hub (`[[_Dev MOC]]`); no link is written when the hub is absent. A colliding title merges into a marked, reviewable region; hand-written content is never overwritten, and the hub link is never duplicated. |

Every writing command supports `--dry-run`, which prints the target paths and the exact lines it would write and writes nothing:

```bash
npm run heyloey -- done "Ship the parser fix" --dry-run
```

`done` follows the milestone-only logging policy above: record shipped outcomes and decisions, not routine questions or health checks.

### The commit hook logs the same way — when you ask it to

The `post-commit` hook calls exactly this command, so the failure behaviour described above applies to
it too: it refuses rather than inventing a note. Git hooks are inactive in a fresh clone until
`git config --local core.hooksPath .githooks`, and even then a commit is logged **only** when its
message carries the trailer `HeyLoey-Milestone: <summary>`. Every other commit is a silent no-op, in
keeping with the milestone-only policy — the hook is never a copy of `git log`. It never changes the
commit's outcome, it is always bounded, and a summary that has already been logged successfully is not
repeated on the same day.
Eligibility is the trailer alone — nothing infers it, and no tool judges the sentence for you.
[Git Hooks Guide](Git%20Hooks%20Guide.md) documents activation, the trailer, the settings and how to turn the hook off.

## External Agents & Model Context Protocol (MCP)

When working in external codebases or containerized AI environments (such as DeepSeek Harness, Claude Code, or Google Antigravity), agents cannot always execute local Node CLI scripts or directly access host filesystems (e.g. sandboxed environments mounting host paths read-only with `EROFS`).

The `loey-space` Model Context Protocol (MCP) server bridges external agents into the host vault with strict security boundaries, path sanitization, and kernel lock serialization.

### The 5 MCP Tools

| MCP Tool | Mode | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `heyloey_brief` | Read-only | `show_paths?: boolean`, `kiwi?: boolean` | Returns a lightweight orientation summary (~400 tokens) containing present records, daily habits, active tasks, inbox count, and active projects. Set `kiwi: true` to include `SOUL.md` persona instructions. |
| `heyloey_context` | Read-only | `query: string`, `limit?: number` | Queries project hubs and `03-Dev/` runbooks via Laya scoring, returning relevant paths and scores for fast context injection without token bloat. |
| `heyloey_done` | Mutating | `summary: string`, `scope?: string`, `dry_run?: boolean` | Records an autonomous milestone outcome into `### 🤖 Agent Milestones` in today's daily note and `### Latest Updates` in `handoff.md`. If `scope` is provided (e.g. `dsh-web`, `supplywatch`), the entry is prefixed with `[<scope>]`. Serialized via `flock`. |
| `heyloey_learn` | Mutating | `title: string`, `fix: string`, `lang?: string`, `dry_run?: boolean` | Crystallizes a reusable engineering pattern or bug fix into an atomic runbook note under `03-Dev/<title>.md` and links it to `[[_Dev MOC]]`. Merges safely if the title already exists. |
| `heyloey_lock_state` | Read-only | _none_ | Audits the vault kernel locking protocol (`flock`), verifying lock file health and flagging any legacy lock files. |

### Sandboxed & Containerized Environments (9p Read-Only Mounts)

Sandboxed AI environments (such as DeepSeek Harness containers running under Bubblewrap/Landlock) mount Windows/WSL host directories like `/mnt/c` via 9p in read-only mode (`EROFS`), and lack elevated permissions (`sudo`) to remount. 

Direct filesystem write tools (`write_file`, `edit_file`) fail inside these containers. By running the `loey-space` MCP server on the host, sandboxed agents call `heyloey_done` and `heyloey_learn` through standard stdio JSON-RPC. The host server holds the kernel `flock` lock and executes the write safely on the host filesystem.

Use conversational prompts when you want an interactive discussion or planning session. Use the CLI in automated scripts or terminal sessions where fast, deterministic execution is needed, and use the MCP server when delegating vault context and milestone recording to external or sandboxed coding agents.
