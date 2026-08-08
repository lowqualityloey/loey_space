# 🧠 `loey_space` — Personal Knowledge Management & Second Brain Architecture

[![Obsidian](https://img.shields.io/badge/Obsidian-v1.5+-purple.svg?style=flat-square&logo=obsidian)](https://obsidian.md)
[![AI Powered](https://img.shields.io/badge/AI-Google%20Gemini%20Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Dashboard](https://img.shields.io/badge/Dashboard-HomePulse%20v2-emerald.svg?style=flat-square)](#-homepulse-command-center)

> A modular, automated, and secure **Personal Knowledge Management (PKM)** system built inside **Obsidian**. Engineered around the PARA/MOC methodology, real-time 2-way habit tracking, automated multi-domain AI enrichment, and a unified `#0C0D13` ultra-dark command center interface.

---

## 📚 Table of Contents

- [⚡ HomePulse Command Center](#-homepulse-command-center)
- [🗂️ Vault Directory Architecture](#️-vault-directory-architecture)
- [🛠️ Installation \& Setup Guide](#️-installation--setup-guide)
  - [Step 1: Clone or Open Vault in Obsidian](#step-1-clone-or-open-vault-in-obsidian)
  - [Step 2: Environment Credentials Setup (`.env`)](#step-2-environment-credentials-setup-env)
  - [Step 3: Enable Core Community Plugins](#step-3-enable-core-community-plugins)
  - [Step 4: Launch HomePulse Dashboard](#step-4-launch-homepulse-dashboard)
- [💡 Daily Workflows \& Keyboard Shortcuts](#-daily-workflows--keyboard-shortcuts)
  - [1-Click Note Creation Shortcuts](#1-click-note-creation-shortcuts)
  - [Multi-Domain AI Enricher (`Ctrl + Shift + A`)](#multi-domain-ai-enricher-ctrl--shift--a)
- [📋 Task System Rules \& Conventions](#-task-system-rules--conventions)
- [🎨 Styling \& Aesthetics](#-styling--aesthetics)
- [🔒 Security \& Git Safety](#-security--git-safety)

---

## ⚡ HomePulse Command Center

The heart of `loey_space` is **HomePulse** (`.obsidian/plugins/homepulse`), a high-performance native dashboard plugin:

* **🔄 2-Way Real-Time Habit Sync**: Toggling habit checkboxes inside the **Habits** widget instantly updates `- [ ]` / `- [x]` in today's active daily note (`01-Daily/YYYY-MM-DD*.md`) and `99-Templates/Daily.md`.
* **⚡ Execution Pulse**: Live productivity analytics tracking daily habit completion percentage, focus/pomodoro minutes, 7-day note creation rhythm, and task completion ratios.
* **📊 Knowledge Profile**: Real-time vault metric counter displaying total **Notes** (`41`), **Areas** (`6`), **Projects** (`2`), and **Tags** (`34`).
* **🛠️ System Quick Actions**: 1-click execution shortcuts for timestamped daily note generation (`⏳ Create Timestamped Daily Note`), quick capture, new projects, and dev snippets.
* **📌 Open Tasks Widget**: Live active task feed mirroring `01-Daily/_Tasks MOC.md` across `01-Daily` and `02-Projects`, automatically excluding routine habit checkboxes.

---

## 🗂️ Vault Directory Architecture

```text
loey_space/
├── Home.md                  # Central Command Dashboard (Navigation, Active Tasks, Projects, Inbox)
├── 00-Inbox/                # Quick capture dump & triage (_Inbox MOC.md)
├── 01-Daily/                # Daily logs, habits, energy/sleep tracking, AI reflections
│   ├── _Daily MOC.md        # Daily notes navigation & monthly habit overview
│   └── _Tasks MOC.md        # Task command center, in-progress items, completion history & analytics
├── 02-Projects/             # Active development projects & build specifications (_Projects MOC.md)
│   ├── spotify project/     # Spotify app project notes & Kanban
│   └── weather-dashboard/   # Weather dashboard project notes & Kanban
├── 03-Dev/                  # Code snippets, technical patterns, debugging notes (_Dev MOC.md)
├── 04-Learning/             # Courses, tutorials, & study notes (_Learning MOC.md)
├── 05-Personal/             # Personal goals, life & fitness logs (_Personal MOC.md)
├── 06-Resources/            # Technical documentation, API specs, & system scripts
│   ├── APIs/                # API specs & integration documentation (_APIs MOC.md)
│   ├── ai-enrich-action.js  # Universal Multi-Domain AI Enricher (Daily / Concept / Dev)
│   └── Second Brain Guide.md# System usage, folder guidelines & workflow rules
├── 07-Reviews/              # Weekly & Monthly retrospectives (_Reviews MOC.md)
├── 08-Concepts/             # Evergreen technical & domain concepts (_Concepts MOC.md)
├── 99-Attachments/          # Monthly subfolders (YYYY-MM/) for screenshots and media
├── 99-Templates/            # Master Templater & QuickAdd note blueprints
├── .obsidian/               # Vault configuration, custom HomePulse plugin, snippets & themes
│   ├── plugins/homepulse/   # Custom HomePulse dashboard plugin (Habit sync, Execution Pulse, Widgets)
│   └── snippets/            # CSS snippets (dashboard-cards.css, fonts.css)
├── .secrets/                # [GIT-IGNORED] Private human-readable sensitive notes
└── .env                     # [GIT-IGNORED] Real API keys and machine credentials
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
Create a `.env` file in the root of `loey_space` to store your Google Gemini API key securely:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```
> 💡 *Note: The `.env` file is listed in `.gitignore` and will never be pushed to version control.*

### Step 3: Enable Core Community Plugins
Go to **Obsidian Settings -> Community Plugins** and ensure the following plugins are enabled:
* **HomePulse** — Dashboard command center & 2-way habit synchronization.
* **QuickAdd** — Automation macros & 1-click note generation blueprints.
* **Templater** — Dynamic date calculation & variable expansion.
* **Dataview** — Real-time indexer queries for MOCs & task tracking.
* **Kanban** — Visual board view for project workflows.
* **Calendar** — Visual daily note navigator.

> [!IMPORTANT]
> **Pre-Configured HomePulse Plugin**:
> This vault comes pre-configured with an enhanced build of the HomePulse plugin located in `.obsidian/plugins/homepulse/` (featuring 2-way real-time habit file sync, custom Tech Tree PARA scanner, 1:1 Pomodoro timer fix, and QuickAdd daily note macro integration).
> **Do not re-install or auto-update HomePulse from the Obsidian Community Store**, as doing so will overwrite these custom integrations with standard plugin code. We recommend disabling automatic plugin updates in Obsidian (**Settings ⚙️ -> Community plugins -> Auto-update plugins: OFF**).

### Step 4: Launch HomePulse Dashboard
* Click the **HomePulse** icon on the ribbon action bar or press `Ctrl + P` and execute **HomePulse: Open Dashboard View**.


---

## 💡 Daily Workflows & Keyboard Shortcuts

### 1-Click Note Creation Shortcuts
Use QuickAdd ribbon buttons or command palette (`Ctrl + P` -> `QuickAdd: Run...`):
* `⏳ Create Timestamped Daily Note` — Generates today's daily log (`01-Daily/YYYY-MM-DD_HHmm.md`) with habits, energy tracking, and task lists.
* `💡 Create Concept Note` — Creates a structured evergreen note in `08-Concepts/`.
* `💻 Create Dev Snippet` — Creates a technical code pattern in `03-Dev/`.

### Multi-Domain AI Enricher (`Ctrl + Shift + A`)
Position your cursor inside any active note and press `Ctrl + Shift + A` (or run `QuickAdd: AI Enrich Note`):
1. **Daily Notes (`01-Daily/`)**: Generates a 2-paragraph narrative summary, 1-paragraph AI reflection, quote callout, and automatically migrates unfinished tasks.
2. **Concept Notes (`08-Concepts/`)**: Detects topic domain (Tech, Entertainment, Wellness) and generates technical explanations, runnable code snippets, or lore definitions.
3. **Dev Notes (`03-Dev/`)**: Analyzes code snippets and updates tags, context, explanation, and wikilink references.

---

## 📋 Task System Rules & Conventions

* **Source of Truth**: All tasks are logged directly inside daily notes (`01-Daily`) or project notes (`02-Projects`).
* **Task Status Hierarchy**:
  * `- [ ] task` => **Active To-Do** (Visible in Open Tasks widget & `_Tasks MOC.md`)
  * `- [/] task` => **In Progress** (Immediate focus anchor)
  * `- [x] task` => **Completed** (Logged in task analytics)
* **Habit Isolation**: Routine checkboxes under `## 🔁 Habits` are strictly isolated from task command centers.

---

## 🎨 Styling & Aesthetics

* **Ultra-Dark Palette**: Designed around a high-contrast `#0C0D13` background, sleek card containers, and glassmorphic borders ([`.obsidian/snippets/dashboard-cards.css`](file:///C:/Users/jonel/OneDrive%20-%20雪玲团队/Documents/loey_space/.obsidian/snippets/dashboard-cards.css)).
* **Typography System**: Custom Google Fonts hierarchy ([`.obsidian/snippets/fonts.css`](file:///C:/Users/jonel/OneDrive%20-%20雪玲团队/Documents/loey_space/.obsidian/snippets/fonts.css)):
  * **Body / UI**: `Inter`, `Plus Jakarta Sans`, `Outfit`
  * **Code / Monospace**: `JetBrains Mono`

---

## 🔒 Security & Git Safety

* **No Hardcoded API Keys**: All machine credentials and API tokens strictly reside in `.env` (git-ignored).
* **Private Notes Directory**: The `.secrets/` directory is strictly excluded from Git tracking for storing sensitive personal documents.
* **Vault Security Policy**: Read the official [Vault Security Policy](https://github.com/lowqualityloey/loey_space/blob/main/06-Resources/Vault%20Security%20Policy.md) for complete guidelines.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for complete details.