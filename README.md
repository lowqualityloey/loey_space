# 🧠 loey_space — Obsidian Vault Architecture & Knowledge System

A clean, highly automated personal knowledge management (PKM) vault built in **Obsidian**, powered by **QuickAdd**, **Templater**, **Dataview**, **Gemini AI Automation**, custom typography, and security policies.

---

## 🗂️ Vault Directory Structure

```text
loey_space/
├── Home.md                  # Central Command Dashboard (Navigation, Active Tasks, Projects, Inbox)
├── 00-Inbox/                # Quick capture dump & triage (_Inbox MOC.md)
├── 01-Daily/                # Daily logs, habits, energy/sleep tracking, AI reflections
│   ├── _Daily MOC.md        # Daily notes navigation & monthly habit overview
│   └── _Tasks MOC.md        # Task command center, in-progress items, completion history & analytics
├── 02-Projects/             # Active development projects & build specifications (_Projects MOC.md)
├── 03-Dev/                  # Code snippets, technical patterns, debugging notes (_Dev MOC.md)
├── 04-Learning/             # Courses, tutorials, & study notes (_Learning MOC.md)
├── 05-Personal/             # Personal goals, life & gym logs (_Personal MOC.md)
├── 06-Resources/            # Technical documentation, API specs, & system scripts
│   ├── APIs/                # API specs & integration documentation (_APIs MOC.md)
│   ├── ai-enrich-action.js  # Universal Multi-Domain AI Enricher (Daily / Concept / Dev)
│   └── Second Brain Guide.md# System usage, folder guidelines & workflow rules
├── 07-Reviews/              # Weekly & Monthly retrospectives (_Reviews MOC.md)
├── 08-Concepts/             # Evergreen technical & domain concepts (_Concepts MOC.md)
├── 99-Attachments/         # Monthly subfolders (YYYY-MM/) for screenshots and media
├── 99-Templates/           # Master Templater & QuickAdd note blueprints
├── .obsidian/               # Vault configuration, enabled plugins, & snippets/fonts.css
├── .secrets/                # [GIT-IGNORED] Private human-readable sensitive notes
└── .env                    # [GIT-IGNORED] Real API keys and machine credentials
```

---

## 🚀 Getting Started

1. **Open in Obsidian**: Click **Open folder as vault** in Obsidian and select `loey_space`.
2. **Environment File Setup**:
   Ensure `.env` exists in the vault root with your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. **Core Community Plugins**:
   Ensure the following plugins are enabled in `.obsidian/community-plugins.json`:
   - `dataview` — Dynamic task lists, tables, and MOC queries.
   - `quickadd` — Commander macros & 1-click note creation.
   - `templater-obsidian` — Template variable expansion & date calculation.
   - `obsidian-tasks-plugin` — Task metadata indexing.
   - `cmdr` / `obsidian-kanban` / `obsidian-style-settings` / `colored-tags`.

---

## 🏠 Main Dashboard & Navigation

* **Central Command Hub (`Home.md`)**: Reorganized for fast daily use. Features quick navigation to all MOCs, `🔄 Currently In Progress` items, `📌 Priority To-Dos`, active projects, recent dev snippets, and inbox status.
* **Tasks Hub (`_Tasks MOC.md`)**: Consolidates active tasks across daily notes and projects, tracks `[/]` In Progress items, provides recent completion history, and excludes habit checkboxes.
* **1-Click Creation Buttons**: Use the sidebar buttons to create Daily, Concept, Dev, Project, or Learning notes instantly.

---

## 🤖 Multi-Domain AI Enricher (`✨` / `Ctrl + Shift + A`)

The vault features a single, intelligent **AI Enricher macro** ([`06-Resources/ai-enrich-action.js`](file:///C:/Users/jonel/OneDrive%20-%20雪玲团队/Documents/loey_space/06-Resources/ai-enrich-action.js)) powered by Google Gemini (`gemini-flash-latest` with fallback models):

### 1. 📅 Daily Notes Mode (`01-Daily/...`)
- Parses mood, energy, sleep hours, tasks, dev progress, leisure, notes, and small wins.
- Generates a **1–2 paragraph concise narrative summary** and **1-paragraph AI reflection**.
- Excludes template prompt noise and enforces a **strict ban on corporate buzzwords** (`operational baseline`, `steady execution`).
- Generates a grounded quote callout (`> [!QUOTE] 💡 Daily Spark`) with author attribution.
- Carries unfinished tasks directly into yesterday's `Tomorrow Setup`.

### 2. 💡 Concept Notes Mode (`08-Concepts/...`)
- **Domain-Adaptive Classifier**: Automatically detects the topic domain:
  - **Tech / Programming**: Generates technical definitions, real-world utility, and runnable JavaScript code snippets.
  - **Media / Entertainment** (e.g., *House of the Dragon*): Generates real story premises, themes, and faction lore (no fake code blocks!).
  - **Wellness / Personal**: Generates core principles and practical exercises.
- **Wikilink Grounding**: Only links to existing vault notes (`[[Note Title]]`) to prevent broken link clutter.

### 3. 💻 Dev Notes Mode (`03-Dev/...`)
- Analyzes code snippets and note titles to populate `language`, `tags`, `Context`, `Code Explanation`, and `Related` reference links (mixing existing vault notes + new reference concept links).

---

## 📋 Task System Rules & Conventions

- **Daily Notes as Source of Truth**: Write tasks inside your daily notes (`01-Daily`). No duplicate task notes required.
- **Task States**:
  - `- [ ] task` => **Active To-Do**
  - `- [/] task` => **In Progress** (Immediate focus anchor)
  - `- [x] task` => **Completed**
- **Habit Isolation**: Routine habit checkboxes under `## 🔁 Habits` are strictly excluded from task dashboards.

---

## 🎨 Typography & Visual Styling

- **Custom Font Overrides**: Loaded via [`.obsidian/snippets/fonts.css`](file:///C:/Users/jonel/OneDrive%20-%20雪玲团队/Documents/loey_space/.obsidian/snippets/fonts.css) importing Google Fonts:
  - Body / UI: `Inter`, `Plus Jakarta Sans`, `Outfit`
  - Code / Snippets: `JetBrains Mono`
- **High Specificity Overrides**: Forced CSS specificity overrides Isinglass theme serif defaults for high-contrast reading.
- **Info Callout Tables**: Daily templates use non-overlapping Markdown Info Callouts (`> [!INFO] 💡 Daily Properties Reference`).

---

## 🔒 Security & Git Safety

- **No Hardcoded Credentials**: API keys and tokens must stay in `.env` (git-ignored).
- **Private Data Folder**: Use `.secrets/` for private human notes (passwords, private logs) — strictly excluded from Git.
- **Security Policy**: Refer to [[06-Resources/Vault Security Policy|Vault Security Policy]] for full guidelines.