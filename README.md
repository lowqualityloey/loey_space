# 🧠 loey_space — Obsidian Vault Repository

A structured, automated personal knowledge management (PKM) vault built in **Obsidian**, configured with **QuickAdd**, **Templater**, **Dataview**, **Git backup**, and **Kiro automation**.

---

## 🗂️ Vault Structure

```text
loey_space/
├── Home.md               # Main dashboard (Navigation, vault health, Notion sync status)
├── 00-Inbox/             # Quick capture dump & triage
├── 01-Daily/             # Daily logs, habits, energy & sleep tracking
├── 02-Projects/          # Active development (Subfolder per project with Note & Kanban)
├── 03-Dev/               # Code snippets, debugging logs, & architecture notes
├── 04-Learning/          # Courses, tutorials, & technical learning topics
├── 05-Personal/          # Life notes, fitness, goals, & reflections
├── 06-Resources/         # Documentation, APIs, & automation scripts
│   ├── APIs/             # API specs & integration documentation
│   ├── notion-sync.js    # 1-way Notion → Obsidian sync (daemon: notion-daemon.js)
│   ├── scheduled-enrich.js  # AI enrichment scheduler
│   └── ai-enrich-action.js  # Manual AI enrichment for Daily/Concept/Dev notes
├── 07-Reviews/          # Weekly (YYYY-[W]WW) & Monthly (YYYY-MM) review archives
├── 08-Concepts/         # Evergreen concepts & mental models (auto-backlinked)
├── 99-Attachments/      # Monthly subfolders (YYYY-MM/) for auto-renamed screenshots
├── 99-Templates/        # Templater & QuickAdd master note templates
├── .kiro/               # [COMMITTED] Kiro hooks (Git safety, automation, review triggers)
├── .secrets/            # [GIT-IGNORED] Private human-readable sensitive notes
└── .env                 # [GIT-IGNORED] Real API keys and machine credentials
```

---

## 🚀 Getting Started

1. **Open in Obsidian**: Choose **Open folder as vault** in Obsidian and select this directory.
2. **Environment File Setup**:
   Copy `.env.example` to `.env` if running local integration scripts:
   ```bash
   cp .env.example .env
   ```
3. **Core Plugins**:
   Ensure community plugins are enabled (`Dataview`, `QuickAdd`, `Templater`, `Commander`, `Kanban`, `Custom Attachment Location`).
4. **Git Hooks**: The vault includes `.kiro/hooks/` for automated security checks and automation - commit these to share workflows.

---

## 💡 How to Use the Vault

* **Main Dashboard (`Home.md`)**: Start here daily. Surfaces active projects, Next Actions, daily habit logs, vault health, and Notion sync status.
* **1-Click Creation**: Use the **Commander sidebar buttons** to create notes instantly (Inbox, Daily, Project, Learning, Resource, Dev, Personal, Concept, API).
* **Auto-Routing Concepts**: Linking uncreated terms like `[[AI integration]]` routes them to `08-Concepts/` and applies the Concept template with live Dataview backreferences.
* **API Documentation**: Create API docs in `06-Resources/APIs/` using the `🔌 New API Note` action.
* **Triage System**: Capture to Inbox, then use `99-Templates/Triage.md` for 2-click triage to destination folders.

---

## 🤖 Automation & AI

* **AI Enrichment** (`Ctrl+Shift+A`): Manually enrich Daily, Concept, or Dev notes with Gemini AI (uses `gemini-2.0-flash-lite` for cost efficiency).
* **Scheduled Enrichment**: `06-Resources/scheduled-enrich.js` runs weekly, re-enriching notes every 7 days.
* **Notion Sync**: `notion-daemon.js` syncs daily notes from Notion every 5 minutes.
* **Kiro Hooks**: 
  - Git safety (pre-push, pre-commit, post-commit checks)
  - Daily auto-save triggers
  - Weekly review suggestions
  - Template versioning logging

---

## 🔒 Security & Conventions

* **No Hardcoded Secrets**: Never type real API keys, passwords, or tokens into normal Markdown notes.
* **Secrets Policy**:
  * **`.env`**: Store machine credentials loaded by scripts (`NOTION_API_KEY`, `VITE_OPENWEATHER_API_KEY`).
  * **`.secrets/`**: Store private human notes (passwords, banking, private logs).
  * Both `.env` and `.secrets/` are strictly excluded in `.gitignore`.
* **Kiro Hooks**: The `.kiro/` folder is committed to Git - it contains no secrets, only configuration for automation.
* **Security Spec**: Read [[06-Resources/Vault Security Policy|Vault Security Policy]] for complete details.

---

## 🛠️ Development Tools

| Tool | Purpose |
| :--- | :--- |
| **Notion → Obsidian Sync** | `node 06-Resources/notion-daemon.js` - Runs every 5 min |
| **AI Enrichment** | `Ctrl+Shift+A` - Manually enrich Daily/Concept/Dev notes |
| **Scheduled Enrichment** | `node 06-Resources/scheduled-enrich.js` - Weekly batch processing |
| **Triage Template** | `99-Templates/Triage.md` - 2-click capture → triage system |
| **Weekly Review** | `99-Templates/Weekly Review.md` - Auto-generated with stats |
| **Monthly Review** | `99-Templates/Monthly Review.md` - With habit trend visualization |