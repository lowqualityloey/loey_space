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

There are two distinct ways to interact with the assistant:

- **Conversational Assistant (in chat)**: Operates inside your AI coding assistant. The agent reads `AGENTS.md` and coordinates interactive routines like morning kick-offs, project planning, and retrospectives.
- **Deterministic CLI (`heyloey`)**: A standalone shell command installed at `~/.local/bin/heyloey`. It is used by external terminal scripts or background workers to read vault context quickly without loading multiple Markdown files:
  - `heyloey brief` — Outputs a condensed summary of today's focus, active projects, and system status (~400 tokens).
  - `heyloey context "<query>"` — Routes to matching project hubs or runbooks.
  - `heyloey done "<1-line summary>"` — Records a completed milestone to today's daily log and `handoff.md`.
  - `heyloey learn "<Title>" "<Pattern>"` — Indexes a reusable technical pattern in `03-Dev/`.

Use conversational prompts when you want an interactive discussion or planning session. Use the CLI tool in automated scripts or terminal sessions where fast, deterministic execution is needed.
