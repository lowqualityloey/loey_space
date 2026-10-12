---
created: 2026-10-12
updated: 2026-10-12
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
| `heyloey log` / `sync` | Explicit daily log | Records your session work, wins, or blockers directly into `## 📝 Daily Log` in today's daily note. |
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

Daily work entries are written under `## 📝 Daily Log` in `01-Daily/YYYY-MM/YYYY-MM-DD.md` using the format `- **HH:MM**: <summary>`. Handoff entries are written to `handoff.md` under `### Latest Updates`.

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
| `npm run heyloey -- done "<summary>"` | Writes | Adds a milestone under `## 📝 Daily Log` in today's daily note and under `### Latest Updates` in `handoff.md`. Refuses if either record, or the heading it owns, is missing — it never scaffolds a note. |
| `npm run heyloey -- learn "<Title>" "<Pattern>"` | Writes | Indexes a reusable pattern in `03-Dev/` and links it to the existing Dev hub (`[[_Dev MOC]]`); no link is written when the hub is absent. A colliding title merges into a marked, reviewable region; hand-written content is never overwritten, and the hub link is never duplicated. |

Every writing command supports `--dry-run`, which prints the target paths and the exact lines it would write and writes nothing:

```bash
npm run heyloey -- done "Ship the parser fix" --dry-run
```

`done` follows the milestone-only logging policy above: record shipped outcomes and decisions, not routine questions or health checks.

Use conversational prompts when you want an interactive discussion or planning session. Use the CLI in automated scripts or terminal sessions where fast, deterministic execution is needed.
