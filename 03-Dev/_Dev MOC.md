---
created: 2026-08-09
updated: 2026-09-01
type: moc
status: active
area: dev
cssclasses:
  - cards
tags:
  - type/moc
  - area/dev
---

# 💻 Dev MOC & Code Snippet Library

> *Technical repository — reusable code snippets, architectural patterns, debugging notes, and language tricks.*

---

## 🛠️ Code Snippets Library

```dataview
TABLE 
  language AS "Language", 
  tags AS "Tags", 
  choice(updated, updated, file.mtime) AS "Last Updated"
FROM "03-Dev"
WHERE type = "snippet" OR contains(tags, "type/snippet")
SORT language ASC, file.name ASC
```

---

## 📚 Architecture Notes & Technical Patterns

```dataview
TABLE 
  tags AS "Tags", 
  choice(updated, updated, file.mtime) AS "Last Modified"
FROM "03-Dev"
WHERE file.name != "_Dev MOC" AND type != "snippet" AND !contains(tags, "type/snippet")
SORT file.mtime DESC
```

---

## 💡 How to Add & Index Snippets

- `Ctrl + P` → **QuickAdd: 💻 Create Snippet** — Generates a new code snippet with syntax highlighting templates.
- **Inbox Quick Capture**: Append `#dev` to any line in [[00-Inbox/quick-capture-dump.md|quick-capture-dump]] and run `QuickAdd: 🧹 Triage Sweep`.
- `hey loey snippet` — Ask your AI assistant to format and index any code pattern into `03-Dev/`.
