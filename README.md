# 🧠 loey_space — Obsidian Vault Architecture & Knowledge System

A clean, highly automated personal knowledge management (PKM) vault and second brain built in **Obsidian**, powered by **HomePulse Dashboard**, **QuickAdd**, **Templater**, **Dataview**, **Gemini AI Automation**, custom dark typography, and strict security rules.

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

## 🚀 Key Features & Architecture

### ⚡ 1. HomePulse Command Center
The vault features **HomePulse**, a custom high-performance dashboard plugin configured with an `#0C0D13` ultra-dark theme:
- 🔄 **Real-Time 2-Way Habit Sync**: Toggling habit checkboxes in the HomePulse **Habits** widget immediately updates `- [ ]` / `- [x]` in today's active daily note (`01-Daily/YYYY-MM-DD*.md`) and `99-Templates/Daily.md`.
- ⚡ **Execution Pulse**: Live analytics tracking habit completion rates, focus minutes, 7-day note rhythm, and task completion ratios.
- 📊 **Knowledge Profile**: Dynamic real-time vault metrics displaying total **Notes**, **Areas**, **Projects**, and **Tags**.
- 🛠️ **System Quick Actions**: 1-click shortcuts for timestamped daily note creation (`⏳ Create Timestamped Daily Note`), quick capture, project creation, and dev snippets.
- 📌 **Open Tasks Widget**: Live task feed mirroring `01-Daily/_Tasks MOC.md` (`01-Daily` and `02-Projects` active tasks), automatically excluding routine habits.

---

### 🤖 2. Multi-Domain AI Enricher (`✨` / `Ctrl + Shift + A`)

Powered by Google Gemini (`gemini-flash-latest`), the universal AI Enricher macro ([`06-Resources/ai-enrich-action.js`](file:///C:/Users/jonel/OneDrive%20-%20雪玲团队/Documents/loey_space/06-Resources/ai-enrich-action.js)) enriches notes based on location and context:

#### 📅 Daily Notes Mode (`01-Daily/...`)
- Parses mood, energy, sleep hours, tasks, dev progress, leisure, and wins.
- Generates a **1–2 paragraph concise narrative summary** and **1-paragraph AI reflection**.
- Enforces a **strict ban on corporate buzzwords** (`operational baseline`, `steady execution`).
- Generates a grounded quote callout (`> [!QUOTE] 💡 Daily Spark`) with author attribution.

#### 💡 Concept Notes Mode (`08-Concepts/...`)
- **Domain-Adaptive Classifier**: Automatically detects topic domain:
  - **Tech / Programming**: Generates technical definitions, utility, and runnable code snippets.
  - **Media / Entertainment**: Generates real story premises, themes, and lore (no fake code blocks!).
  - **Wellness / Personal**: Generates core principles and practical exercises.
- **Wikilink Grounding**: Only links to existing vault notes (`[[Note Title]]`) to prevent broken link clutter.

#### 💻 Dev Notes Mode (`03-Dev/...`)
- Analyzes code snippets and titles to populate `language`, `tags`, `Context`, `Code Explanation`, and `Related` reference links.

---

### 📋 3. Task System Rules & Conventions

- **Daily Notes & Projects as Source of Truth**: Tasks are written directly inside daily notes (`01-Daily`) or project notes (`02-Projects`).
- **Task Statuses**:
  - `- [ ] task` => **Active To-Do**
  - `- [/] task` => **In Progress** (Immediate focus anchor)
  - `- [x] task` => **Completed**
- **Habit Isolation**: Routine habit checkboxes under `## 🔁 Habits` are strictly isolated from task command centers.

---

## 🎨 Design & Aesthetics

- **Ultra-Dark Mode**: Theme styling centered around `#0C0D13` with glassmorphic borders and responsive card grids ([`.obsidian/snippets/dashboard-cards.css`](file:///C:/Users/jonel/OneDrive%20-%20雪玲团队/Documents/loey_space/.obsidian/snippets/dashboard-cards.css)).
- **Typography**: Custom font hierarchy via [`.obsidian/snippets/fonts.css`](file:///C:/Users/jonel/OneDrive%20-%20雪玲团队/Documents/loey_space/.obsidian/snippets/fonts.css):
  - **Body / UI**: `Inter`, `Plus Jakarta Sans`, `Outfit`
  - **Code / Monospace**: `JetBrains Mono`

---

## 🔒 Security & Git Safety

- **No Hardcoded Credentials**: API keys and tokens strictly reside in `.env` (git-ignored).
- **Private Vault Data**: `.secrets/` contains private human notes and is excluded from Git tracking.
- **Security Policy**: Refer to [[06-Resources/Vault Security Policy|Vault Security Policy]] for full operational guidelines.