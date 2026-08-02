# 🧠 loey_space — Obsidian Vault Repository

A structured, automated personal knowledge management (PKM) vault built in **Obsidian**, configured with **QuickAdd**, **Templater**, **Dataview**, and **Git backup**.

---

## 🗂️ Vault Structure

```text
loey_space/
├── Home.md               # Main dashboard (Quick navigation, tasks, active projects)
├── 00-Inbox/             # Quick capture dump & unprocessed notes
├── 01-Daily/             # Daily logs, habits, energy & sleep tracking
├── 02-Projects/          # Active projects (Subfolder per project with Note & Kanban)
├── 03-Dev/               # Code snippets, debugging logs, & architecture notes
├── 04-Learning/          # Courses, tutorials, & technical learning topics
├── 05-Personal/          # Life notes, fitness, goals, & reflections
├── 06-Resources/         # Bookmarks, documentation links, cheatsheets, & Notion sync
│   ├── APIs/             # API specs & integration documentation
│   └── notion-sync.js    # Strict 1-way Notion → Obsidian sync script
├── 07-Reviews/          # Weekly (YYYY-[W]WW) & Monthly (YYYY-MM) review archives
├── 08-Concepts/         # Evergreen concepts & mental models (auto-backlinked)
├── 99-Attachments/      # Monthly subfolders (YYYY-MM/) for auto-renamed screenshots
├── 99-Templates/        # Templater & QuickAdd master note templates
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

---

## 💡 How to Use the Vault

* **Main Dashboard (`Home.md`)**: Start here daily. Surfaces active projects, Next Actions, daily habit logs, and folder hubs.
* **1-Click Creation**: Use the **Commander sidebar buttons** to create notes instantly (Inbox, Daily, Project, Learning, Resource, Dev, Personal, Concept, API).
* **Auto-Routing Concepts**: Linking uncreated terms like `[[AI integration]]` routes them to `08-Concepts/` and applies the Concept template with live Dataview backreferences.
* **API Documentation**: Create API docs in `06-Resources/APIs/` using the `🔌 New API Note` action.

---

## 🔒 Security & Conventions

* **No Hardcoded Secrets**: Never type real API keys, passwords, or tokens into normal Markdown notes.
* **Secrets Policy**:
  * **`.env`**: Store machine credentials loaded by scripts (`NOTION_API_KEY`, `VITE_OPENWEATHER_API_KEY`).
  * **`.secrets/`**: Store private human notes (passwords, banking, private logs).
  * Both `.env` and `.secrets/` are strictly excluded in `.gitignore`.
* **Security Spec**: Read [[06-Resources/Vault Security Policy|Vault Security Policy]] for complete details.
