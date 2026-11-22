---
created: 2026-10-12
updated: 2026-10-22
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
| `heyloey dream` | Nightly dream loop | The only CLI verb here: prunes `handoff.md` overflow past 10 items into `07-Reviews/`, carries up to 3 unfinished tasks into today's **existing** note, and prints the `memory.md` budget. It does not read daily notes or write concepts. |
| `heyloey distill` | Knowledge distillation *(agent protocol, not a CLI verb)* | Run on request: reviews recent daily notes, proposes evergreen concepts for `08-Concepts/`, and checks memory capacity. `heyloey distill` itself falls through to the usage block. |
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
| `npm run heyloey -- done "<summary>" [--date <day>] [--time <HH:MM>]` | Writes | Adds a milestone under `### 🤖 Agent Milestones` in today's daily note and under `### Latest Updates` in `handoff.md`. Refuses if either record, or the heading it owns, is missing — it never scaffolds a note. `--date` names the day the milestone happened (a milestone replayed after midnight is filed in its own day's note), `--time` names the clock time; without `--time` the current clock time is used, and the handoff's `updated:` field always names today because it describes when the file was touched. |
| `npm run heyloey -- personal "<entry>"` | Writes | Records your own entry under `### 🧍 Personal Log`. `handoff.md` is never touched. |
| `npm run heyloey -- migrate-log [--date <day>]` | Writes | One note (today unless `--date` names another) gains its labelled areas: entries whose summary has the automated outcome shape move to `### 🤖 Agent Milestones`, everything else stays exactly where it is. `--dry-run` prints the plan and writes nothing. |
| `npm run heyloey -- learn "<Title>" "<Pattern>"` | Writes | Indexes a reusable pattern in `03-Dev/` and links it to the existing Dev hub (`[[_Dev MOC]]`); no link is written when the hub is absent. A colliding title merges into a marked, reviewable region; hand-written content is never overwritten, and the hub link is never duplicated. |

Every writing command supports `--dry-run`, which prints the target paths and the exact lines it would write and writes nothing:

```bash
npm run heyloey -- done "Ship the parser fix" --dry-run
```

`done` follows the milestone-only logging policy above: record shipped outcomes and decisions, not routine questions or health checks.

`--date` and `--time` are accepted by `done` only (plus `--date` on `migrate-log`). Another command refuses them by name instead of swallowing them as part of the text, and an impossible day such as `2026-02-31` is rejected before anything is written.

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

### The 9 MCP Tools

Every schema is `.strict()`, so an unknown parameter is rejected rather than ignored. Four tools read notes; five wrap the canonical CLI, and only two of those can write.

| MCP Tool | Mode | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `list_allowed_directories` | Read-only | _none_ | Returns the fixed vault root and the note access policy. MCP client roots cannot expand it. |
| `list_directory` | Read-only | `path?: string` (default `"."`) | Lists up to 200 permitted note entries; hidden and private entries are omitted. |
| `read_text_file` | Read-only | `path: string`, `head?: number` (1–300, default 150), `offset?: number`, `char_offset?: number` | Reads an ordinary Markdown note, at most 300 lines / 24,000 characters. Private paths and symlink escapes are denied. Windowed paging reconstructs long lines and blank-line boundaries losslessly. |
| `get_file_info` | Read-only | `path: string` | Returns metadata only (bytes, modified) for a permitted Markdown note. |
| `heyloey_brief` | Read-only | _none_ | Returns a lightweight orientation summary (~400 tokens) containing present records, daily habits, active tasks, inbox count, and active projects. Private Kiwi/`SOUL.md` mode is **not** available over MCP. |
| `heyloey_context` | Read-only | `query: string` (max 300) | Dependency-free hybrid retrieval: a single-pass keyword scorer plus a pure-JS BM25 ranker with a Porter English stemmer and technical synonym expansion. Matches `02-Projects/` hubs and ranks `03-Dev/` and `08-Concepts/` notes, returning procedural fix snippets. There is no Laya call and no external classifier — the router is in-memory JavaScript. |
| `heyloey_done` | **Mutating** | `summary: string` (5–600), `scope?: string` (1–80) | Records a milestone into the one collapsed agent table under `### 🤖 Agent Milestones` in today's daily note and into `### Latest Updates` in `handoff.md`. `scope` fills the table's Scope column (e.g. `loey_space`); it is not a prefix on the summary. Serialized via kernel `flock`. |
| `heyloey_learn` | **Mutating** | `title: string` (3–120), `fix: string` (10–4000), `lang?: "bash" \| "typescript" \| "python" \| "yaml"` (default `bash`) | Crystallizes a reusable engineering pattern or bug fix into an atomic runbook under `03-Dev/<title>.md` and links it to `[[_Dev MOC]]`. A colliding title merges into a marked, reviewable region instead of overwriting hand-written content. |
| `heyloey_lock_state` | Read-only | _none_ | Audits the vault kernel locking protocol (`flock`), verifying lock file health and flagging any legacy lock files. |

There is no `dry_run` parameter on any MCP tool: a preview belongs to the CLI (`--dry-run`), not to this interface.

### Sandboxed & Containerized Environments

A sandboxed agent may be unable to run the vault's Node CLI or reach the vault filesystem at all, depending on how its sandbox is configured. Whether it can write is a property of that sandbox, not of the mount type: a DeepSeek Harness session whose workspace *is* the vault can write to it directly, while a session confined to a read-only mount cannot.

The MCP server exists so the write path does not depend on the caller's sandbox. Run `loey-space-mcp` on the host and the agent calls `heyloey_done` and `heyloey_learn` over stdio JSON-RPC; the host process holds the kernel `flock` lock and performs the write on the host filesystem. That is the reason to prefer it over a direct CLI call from inside a container — not a claim that every container is read-only.

Use conversational prompts when you want an interactive discussion or planning session. Use the CLI in automated scripts or terminal sessions where fast, deterministic execution is needed, and use the MCP server when delegating vault context and milestone recording to external or sandboxed coding agents.
