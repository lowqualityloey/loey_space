# 🧠 Loey's Second Brain (Obsidian Vault)

Welcome to **Loey's Second Brain**, a structured, automated personal knowledge management (PKM) system built in **Obsidian** and integrated with **Notion**.

---

## 🗂️ Vault Folder Structure

```text
loey_space/
├── 00-Inbox/             # Quick capture dump & raw unprocessed notes
├── 01-Daily/             # Daily logs (YYYY-MM-DD.md & timestamped daily notes)
├── 02-Projects/          # Active projects (Subfolder per project with Note & Kanban)
├── 03-Dev/               # Code snippets, debugging logs, & architecture notes
├── 04-Learning/          # Course notes, tutorials, & technical learning topics
├── 05-Personal/          # Life notes, gym & fitness, goals, & reflections
├── 06-Resources/         # Bookmarks, documentation links, cheatsheets, & Notion sync
├── 07-Reviews/          # Weekly (YYYY-[W]WW) & Monthly (YYYY-MM) review archives
├── 08-Concepts/         # Evergreen concepts & mental models (auto-linked backreferences)
├── 99-Attachments/      # Monthly subfolders (YYYY-MM/) for auto-renamed screenshots
└── 99-Templates/        # Templater & QuickAdd master note templates
```

---

## ⚙️ QuickAdd Workflows & Sidebar Buttons

The vault features **7 standardized Commander sidebar buttons** for instant note creation with automatic split-pane opening:

| Button Icon | Action Name | Destination | Naming Format | Features |
|---|---|---|---|---|
| 📥 `inbox` | **Quick Capture** | `00-Inbox` | `quick-capture-dump.md` | Appends under `## Captured Notes` |
| 📅 `calendar-plus` | **Append to Daily** | `01-Daily` | `YYYY-MM-DD.md` | Appends under `## 🧠 Notes / Thoughts` |
| ⏰ `calendar-clock` | **Timestamped Daily** | `01-Daily` | `YYYY-MM-DD_HHmm {{VALUE}}` | Creates timestamped daily entry |
| 🚀 `rocket` | **Create Project** | `02-Projects` | `02-Projects/{{VALUE}}/{{VALUE}}` | Creates subfolder + Project Note + Auto-Kanban |
| 📖 `book-open` | **Create Learning** | `04-Learning` | `YYYY-MM-DD_HHmm {{VALUE}}` | Learning template |
| 📚 `library` | **Create Resource** | `06-Resources` | `YYYY-MM-DD_HHmm {{VALUE}}` | Resource bookmark template |
| 💻 `code` | **Create Dev Note** | `03-Dev` | `YYYY-MM-DD_HHmm {{VALUE}}` | Developer snippet/notes template |
| 🧘 `heart` | **Create Personal** | `05-Personal` | `YYYY-MM-DD_HHmm {{VALUE}}` | Life reflection template |
| 💡 `lightbulb` | **Create Concept** | `08-Concepts` | `YYYY-MM-DD_HHmm {{VALUE}}` | Evergreen concept template with auto-backlinks |

---

## 🚀 Projects & Automated Kanban Setup

When you click **🚀 Create Project Note** and type `Weather Dashboard`:
1. Creates folder: `02-Projects/Weather Dashboard/`
2. Creates project note: `02-Projects/Weather Dashboard/Weather Dashboard.md`
3. Automatically generates Kanban board: `02-Projects/Weather Dashboard/Weather Dashboard Kanban.md`

---

## 💡 Evergreen Concept Auto-Routing

* **Default Location**: New uncreated wikilinks automatically route to `08-Concepts/`.
* **Templater Auto-Binding**: Clicking any concept link (e.g. `[[AI integration]]`) auto-applies `99-Templates/Concept.md`.
* **Dataview Auto-Backlinks**: Every concept note automatically queries and lists every note in your vault referencing that concept.

---

## 🔄 Notion → Obsidian Sync Engine

Located at `06-Resources/notion-sync.js`:
* **Strict One-Way Sync**: Notion pages sync directly into Obsidian.
* **In-Place Updates**: Matches `notion_id` in frontmatter so updates overwrite existing notes cleanly without duplicating files.

---

## 📸 Attachment Management

Powered by **Custom Attachment Location**:
* **Monthly Subfolders**: Images are automatically saved to `99-Attachments/YYYY-MM/`.
* **Auto-Renaming**: Screenshots auto-rename to `${noteFileName}-${date:YYYY-MM-DD_HHmm}.png`.
* **Dashboard**: Tracked via `99-Attachments/_Attachments MOC.md`.

---

## 🔑 Useful Shortcuts

* **Wrap in Link `[[ ]]`**: Highlight text and press `[` or `Ctrl + Shift + K`.
* **Open Note in Right Split Pane**: All QuickAdd buttons automatically focus new panes on the right.
