---
updated: 2026-08-10
---
# 🧠 `loey_space` — Personal Knowledge Management & Second Brain Architecture

[![Obsidian](https://img.shields.io/badge/Obsidian-v1.5+-purple.svg?style=flat-square&logo=obsidian)](https://obsidian.md)
[![AI Powered](https://img.shields.io/badge/AI-Google%20Gemini%20Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Dashboard](https://img.shields.io/badge/Dashboard-HomePulse%20v2-emerald.svg?style=flat-square)](#-homepulse-command-center)

> A modular, automated, and secure **Personal Knowledge Management (PKM)** system built inside **Obsidian**. Engineered around the PARA/MOC methodology, real-time 2-way habit tracking, automated multi-domain AI enrichment, and a unified `#0C0D13` ultra-dark command center interface.

---

## 📚 Table of Contents

- [✨ Main Features](#-main-features)
- [⚡ HomePulse Command Center](#-homepulse-command-center)
- [🗂️ Vault Directory Architecture](#️-vault-directory-architecture)
- [🛠️ Installation \& Setup Guide](#️-installation--setup-guide)
- [💡 Daily Workflows \& Keyboard Shortcuts](#-daily-workflows--keyboard-shortcuts)
- [📱 Mobile Workflow](#-mobile-workflow)
- [📊 Habit Analytics](#-habit-analytics)
- [📋 Task System Rules \& Conventions](#-task-system-rules--conventions)
- [🎨 Styling \& Aesthetics](#-styling--aesthetics)
- [🔒 Security \& Git Safety](#-security--git-safety)

---

## ✨ Main Features

| Feature | Description |
| :--- | :--- |
| **HomePulse Dashboard** | Custom native plugin with real-time widgets — habits, tasks, pomodoro, focus, projects, tech tree, activity heatmap, all in one view |
| **2-Way Habit Sync** | Toggle habits in the dashboard and they instantly update in today's daily note (and vice versa) |
| **Multi-Domain AI Enrichment** | One shortcut (`Ctrl+Shift+A`) analyzes any note — generates summaries for daily notes, explanations for concepts, code breakdowns for dev notes |
| **Weekly AI Summaries** | Automated 7-day analysis of mood, energy, tasks, and habits with actionable recommendations |
| **Habit Analytics Dashboard** | 30-day rolling metrics, streak tracking, day-of-week patterns, and improvement recommendations |
| **Smart Task Management** | Tasks live in daily notes and project kanbans, aggregated in real-time via `_Tasks MOC.md` with status indicators (`[ ]`, `[/]`, `[x]`) |
| **Project Kanban Integration** | Each project gets a visual kanban board; tasks from To Do/In Progress/Review flow into the central task hub (Backlog excluded) |
| **GitHub Project Sync** | Bi-directional 2-way sync between Obsidian Kanbans and GitHub Projects v2 (`github_project_number`) via QuickAdd & `gh` CLI |
| **Kanban Status Sync** | Drag a card between lanes and its checkbox follows automatically — To Do `[ ]`, In Progress `[/]`, Done `[x]` with a completion date |
| **Mobile Quick Capture** | 4 mobile-optimized commands for instant capture on the go — process later on desktop |
| **Inbox Auto-Classification** | Quick captures tagged with type/area/priority suggestions based on content analysis |
| **Dynamic Tech Tree** | Auto-generated capability map scanning projects, concepts, and resources across the vault |
| **Execution Pulse** | Live productivity analytics — habit %, focus minutes, note rhythm, task completion ratios |
| **PARA/MOC Architecture** | Clean folder separation with Maps of Content for navigation — scales without friction |
| **Ultra-Dark Command Center** | Glassmorphic `#0C0D13` theme with JetBrains Mono, Inter, and custom CSS snippets |

---

## ⚡ HomePulse Command Center

The heart of `loey_space` is **HomePulse** (`.obsidian/plugins/homepulse`), a high-performance native dashboard plugin:

* **🔄 2-Way Real-Time Habit Sync**: Toggling habit checkboxes inside the **Habits** widget instantly updates `- [ ]` / `- [x]` in today's active daily note (`01-Daily/YYYY-MM-DD.md`) and `99-Templates/Daily.md`.
* **⚡ Execution Pulse**: Live productivity analytics tracking daily habit completion percentage, focus/pomodoro minutes, 7-day note creation rhythm, and task completion ratios.
* **📊 Knowledge Profile**: Real-time vault metric counter displaying total Notes, Areas, Projects, and Tags.
* **🎯 Today's Focus**: Editable focus widget that live-syncs with your daily note's Focus section (supports multiple focus items).
* **🛠️ System Quick Actions**: 1-click execution shortcuts for timestamped daily note generation, quick capture, new projects, and dev snippets.
* **📌 Open Tasks Widget**: Live active task feed with Lucide status icons — In Progress tasks sorted to top, Backlog/Archive excluded.
* **🌳 Tech Tree**: Dynamic capability map auto-generated from your vault's projects, concepts, and resources.
* **📅 Activity History**: GitHub-style contribution heatmap showing your vault activity over the year.

---

## 🗂️ Vault Directory Architecture

```text
loey_space/
├── Home.md                      # Central Command Dashboard (Navigation, Active Tasks, Projects, Inbox)
├── 00-Inbox/                    # Quick capture dump & triage
│   ├── _Inbox MOC.md            # Unprocessed notes dashboard
│   └── _Triage MOC.md           # Stale notes & overdue reviews
├── 01-Daily/                    # Daily logs, habits, energy/sleep tracking, AI reflections
│   ├── _Daily MOC.md            # Daily notes navigation & monthly overview
│   ├── _Tasks MOC.md            # Task command center, in-progress, completion history & analytics
│   └── Habit Analytics Dashboard.md  # 30-day habit metrics, streaks, trends
├── 02-Projects/                 # Active development projects & build specifications
│   ├── _Projects MOC.md         # Project dashboard with progress bars
│   └── weather-dashboard/       # Example project (notes + Kanban board)
├── 03-Dev/                      # Code snippets, technical patterns, debugging notes
├── 04-Learning/                 # Courses, tutorials, & study notes
├── 05-Personal/                 # Personal goals, life & fitness logs
├── 06-Resources/                # Technical documentation, API specs, & system scripts
│   ├── APIs/                    # API specs & integration documentation
│   ├── scripts/                 # Automation scripts (AI enricher, weekly summary, etc.)
│   ├── Mobile Workflow Guide.md # Mobile capture setup & usage
│   ├── Second Brain Guide.md    # System usage, folder guidelines & workflow rules
│   └── Vault Security Policy.md # Secret management & Git safety rules
├── 07-Reviews/                  # Weekly & Monthly retrospectives (AI-generated)
├── 08-Concepts/                 # Evergreen technical & domain concepts
├── 99-Attachments/              # Monthly subfolders (YYYY-MM/) for screenshots and media
├── 99-Templates/                # Master Templater & QuickAdd note blueprints
│   ├── Daily.md                 # Daily note template (habits, tasks, reflections)
│   ├── Mobile Capture.md        # Mobile quick capture template
│   ├── Mobile Task.md           # Mobile task capture template
│   ├── Mobile Idea.md           # Mobile idea capture template
│   └── Triage.md                # Inbox processing & classification template
├── .obsidian/                   # Vault configuration, custom plugins, snippets & themes
│   ├── plugins/homepulse/       # Custom HomePulse dashboard plugin
│   ├── plugins/kanban-status-sync/  # Syncs kanban card checkboxes to their lane
│   └── snippets/                # CSS snippets (dashboard-cards, fonts, project-tasks, homepulse-mobile)
├── .kiro/                       # Kiro IDE hooks (env validation, git safety, triage suggestions)
├── .secrets/                    # [GIT-IGNORED] Private human-readable sensitive notes
└── .env                         # [GIT-IGNORED] Real API keys and machine credentials
```

---

## 🛠️ Installation & Setup Guide

### Step 1: Clone or Open Vault in Obsidian
1. Download or clone this repository to your local computer:
   ```bash
   git clone https://github.com/lowqualityloey/loey_space.git
   ```
2. Open **Obsidian**, click **Open folder as vault**, and select the `loey_space` directory.

### Step 2: Environment Credentials Setup (`.env`)

Copy the example file and fill in your API keys:
```bash
cp .env.example .env
```

Then edit `.env` with your real credentials:
```env
# Required for AI enrichment (daily summaries, concept analysis, dev note analysis)
GEMINI_API_KEY=your_google_gemini_api_key_here

# Optional - Weather Dashboard project
VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here

# Optional - OpenAI fallback
OPENAI_API_KEY=sk-your_openai_api_key_here
```

> [!IMPORTANT]
> **Getting a Gemini API Key** (required for AI features):
> 1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
> 2. Click **Create API Key**
> 3. Copy the key and paste it into your `.env` file
>
> The `.env` file is listed in `.gitignore` and will never be pushed to version control.

> [!WARNING]
> **If `.env` is missing or `GEMINI_API_KEY` is not set:**
> - AI Daily Summary (`Ctrl+Shift+A`) will show an error notice
> - Weekly AI Summary generation will fail
> - Concept and Dev note enrichment will not work
> - All other vault features (tasks, habits, navigation, dataview queries) work normally without an API key

### Step 3: Enable Core Community Plugins
Go to **Obsidian Settings -> Community Plugins** and ensure the following plugins are enabled:
* **HomePulse** — Dashboard command center & 2-way habit synchronization.
* **QuickAdd** — Automation macros & 1-click note generation blueprints.
* **Templater** — Dynamic date calculation & variable expansion.
* **Dataview** — Real-time indexer queries for MOCs & task tracking.
* **Kanban** — Visual board view for project workflows.
* **Kanban Status Sync** — Keeps card checkboxes in step with their lane (bundled in this vault, not from the store).
* **Calendar** — Visual daily note navigator.
* **Activity History** — Contribution heatmap for the dashboard.

> [!IMPORTANT]
> **Pre-Configured HomePulse Plugin**:
> This vault comes pre-configured with an enhanced build of the HomePulse plugin located in `.obsidian/plugins/homepulse/` (featuring 2-way real-time habit file sync, dynamic Tech Tree scanner, deferred dashboard refresh, and QuickAdd daily note macro integration).
> **Do not re-install or auto-update HomePulse from the Obsidian Community Store**, as doing so will overwrite these custom integrations with standard plugin code. Disable automatic plugin updates in Obsidian (**Settings -> Community plugins -> Auto-update plugins: OFF**).

### Step 4: Launch HomePulse Dashboard
* Click the **HomePulse** icon on the ribbon action bar or press `Ctrl + P` and execute **HomePulse: Open Dashboard View**.

---

## 💡 Daily Workflows & Keyboard Shortcuts

### 1-Click Note Creation Shortcuts
Use QuickAdd ribbon buttons or command palette (`Ctrl + P` -> `QuickAdd: Run...`):
* `⏳ Create Daily Note` — Generates today's daily log (`01-Daily/YYYY-MM-DD.md`) with habits, energy tracking, and task lists.
* `💡 Create Concept Note` — Creates a structured evergreen note in `08-Concepts/`.
* `💻 Create Dev Note` — Creates a technical code pattern in `03-Dev/`.
* `📥 Quick Capture to Inbox` — Appends a quick note to the inbox dump.
* `🚀 Create Project Note` — Scaffolds a new project with folder and kanban.
* `🔄 Sync GitHub Project Kanban` — Bi-directionally syncs the active project board with GitHub Projects v2 (via left ribbon button `lucide-github` or QuickAdd).

### Multi-Domain AI Enricher (`Ctrl + Shift + A`)
Position your cursor inside any active note and press `Ctrl + Shift + A` (or run `QuickAdd: AI Enrich Note`):
1. **Daily Notes (`01-Daily/`)**: Generates a narrative summary, AI reflection, inspirational quote, and suggested next step.
2. **Concept Notes (`08-Concepts/`)**: Detects topic domain and generates technical explanations, examples, and related concept links.
3. **Dev Notes (`03-Dev/`)**: Analyzes code snippets and updates tags, context, explanation, and wikilink references.

### Weekly AI Summary
Run `QuickAdd: 📊 Weekly AI Summary` (or bind to `Ctrl+Shift+W`):
- Aggregates 7 days of daily notes (mood, energy, tasks, habits, wins, blockers)
- Generates executive summary, patterns, and recommendations via Gemini AI
- Creates a structured review note in `07-Reviews/YYYY-W[week].md`

---

## 📱 Mobile Workflow

Designed for **capture fast, triage later**. All mobile commands land in inbox with `📱` marker.

### Mobile Commands (add to Obsidian Mobile toolbar)
| Command | What it does |
| :--- | :--- |
| `📱 Mobile Capture` | Appends thought to inbox with timestamp |
| `📱 Mobile Task` | Appends as checkbox to inbox |
| `📱 Mobile Idea` | Creates structured idea note in inbox |
| `📱 Mobile Add to Daily` | Adds task directly to today's daily note |

### Setup
1. Install Obsidian Mobile and sync the vault
2. Go to **Settings -> Mobile -> Manage toolbar**
3. Add the `📱` QuickAdd commands
4. Capture in < 10 seconds, batch-process on desktop

See [`06-Resources/Mobile Workflow Guide.md`](06-Resources/Mobile%20Workflow%20Guide.md) for full setup instructions.

---

## 📊 Habit Analytics

The **Habit Analytics Dashboard** (`01-Daily/Habit Analytics Dashboard.md`) provides:

* **Overall Completion Rate** — 30-day rolling percentage with per-habit progress bars
* **Daily Heatmap** — Last 14 days showing which habits were completed each day
* **Day-of-Week Patterns** — Which days you're most/least consistent
* **Streak Analysis** — Current and longest streaks for each habit
* **Trend Analysis** — 7-day moving average with trend indicators
* **Improvement Recommendations** — Identifies habits below 70% and suggests fixes

All data is automatically pulled from daily notes — no manual tracking required.

---

## 📋 Task System Rules & Conventions

* **Source of Truth**: All tasks are logged directly inside daily notes (`01-Daily`) or project notes (`02-Projects`).
* **Task Status Hierarchy**:
  * `- [ ] task` => **Active To-Do** (Visible in Open Tasks widget & `_Tasks MOC.md`)
  * `- [/] task` => **In Progress** (Sorted to top, focus anchor)
  * `- [x] task` => **Completed** (Logged in task analytics)
* **Habit Isolation**: Routine checkboxes under `## 🔁 Habits` are strictly isolated from task command centers.
* **Kanban Filtering**: Tasks under `## Backlog` and `## Archive` in project kanbans are excluded from the Open Tasks widget and `_Tasks MOC.md`.
* **Lane-Driven Status**: Card markers are set automatically from the lane a card sits in (`To Do` -> `[ ]`, `In Progress` / `Review / Test` -> `[/]`, `Done` -> `[x]` + `✅ date`). Cancelled/forwarded markers (`[-]`, `[>]`, `[<]`) are preserved.
* **Tick Anywhere to Complete**: Ticking a project card from the board, `_Tasks MOC.md`, or the daily note's project query moves that card to the **Done** lane with today's date.
* **Project Tasks in Daily Notes**: Daily notes show in-progress project work through a live Dataview query (`#### 🎯 In Progress from Projects`), not copied text — so nothing is double-counted in the Open Tasks widget and nothing leaks into the next day's carry-over. A CSS snippet (`project-tasks.css`) draws these `[/]` cards as empty checkboxes inside daily notes, so they read as ordinary open tasks you can tick; cards completed that day stay listed, checked.
* **Project Status Matching**: `_Projects MOC.md` accepts `in progress`, `in-progress`, `active`, `doing` and `wip` as active, so a space instead of a hyphen no longer hides a project. Progress bars count committed work only — Backlog and Archive are excluded.
* **Daily Carry-Over**: Unfinished `- [ ]` tasks under `### ✅ Tasks` roll forward into tomorrow's daily note. Completed and in-progress items do not.
* **Forwarded, Not Duplicated**: When tasks carry forward, the previous note marks its copies `- [>]` (forwarded, shown as a faint `→`). Each task is therefore open in exactly one note, so it is counted once in the Open Tasks widget, `_Tasks MOC.md`, and the analytics.
* **GitHub Project v2 Sync**: Project Kanbans with `github_project_number` frontmatter sync cards, status columns, and priority tags (`#priority/p0` Red 🔴, `#priority/p1` Yellow 🟡, `#priority/p2` Blue 🔵, `#priority/p3` Green 🟢) bi-directionally with GitHub Projects v2.
* **Today-Scoped Dashboards**: `_Tasks MOC.md` counts daily tasks from the current daily note only; project board tasks are always included. Completed totals stay all-time.

---

## 🎨 Styling & Aesthetics

* **Ultra-Dark Palette**: Designed around a high-contrast `#0C0D13` background, sleek card containers, and glassmorphic borders (`.obsidian/snippets/dashboard-cards.css`).
* **Mobile HomePulse**: `homepulse-mobile.css` overrides the dashboard's fixed 5-column grid and 132px row height on phones, so cards go full width and grow to fit. Execution Pulse and Knowledge Profile drop to 2×2, the calendar's weekday labels centre over their columns, and tap targets are raised to 32px.
* **Typography System**: Custom Google Fonts hierarchy (`.obsidian/snippets/fonts.css`):
  * **Body / UI**: `Inter`, `Plus Jakarta Sans`, `Outfit`
  * **Code / Monospace**: `JetBrains Mono`

---

## 🔒 Security & Git Safety

* **No Hardcoded API Keys**: All machine credentials and API tokens strictly reside in `.env` (git-ignored).
* **Private Notes Directory**: The `.secrets/` directory is strictly excluded from Git tracking for storing sensitive personal documents.
* **Session Validation**: Kiro IDE hooks check `.env` presence on startup and warn if API keys are missing.
* **Git Guards**: Pre-commit hooks prevent accidental staging of `.env`, `.secrets/`, or files containing API key patterns.
* **Vault Security Policy**: Read the official [Vault Security Policy](06-Resources/Vault%20Security%20Policy.md) for complete guidelines.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for complete details.
