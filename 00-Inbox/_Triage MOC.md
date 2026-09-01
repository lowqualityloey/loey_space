---
created: 2026-08-09
updated: 2026-09-01
type: moc
status: active
area: system
cssclasses:
  - cards
tags:
  - type/moc
  - area/system
---

# 🧹 Triage & Vault Maintenance Hub

> *Surfaces neglected inbox items, stale `in-progress` notes, and concepts past their 90-day `review_cycle` — so nothing rots quietly in the vault.*

---

## 📥 Neglected Inbox Items
Loose notes sitting in `00-Inbox/` for more than 7 days. Tag them with a destination token and run **Triage Sweep**, or bin them.

```dataview
TABLE file.ctime AS "Captured Date"
FROM "00-Inbox"
WHERE !startswith(file.name, "_")
  AND file.name != "quick-capture-dump"
  AND date(today) - file.ctime > dur(7 days)
SORT file.ctime ASC
```

---

## ⏳ Stale In-Progress Notes
Notes marked `in-progress` or `active` but untouched for over 30 days. Templates and dashboards are excluded.

```dataview
TABLE type AS "Type", area AS "Area", file.mtime AS "Last Touched"
FROM "" AND !"99-Templates"
WHERE (status = "in-progress" OR status = "doing" OR status = "wip") 
  AND !contains(file.name, "MOC") 
  AND !contains(file.name, "Kanban")
  AND date(today) - file.mtime > dur(30 days)
SORT file.mtime ASC
```

---

## 📅 Overdue Evergreen & Learning Reviews
Concepts in [[08-Concepts/_Concepts MOC|Concepts MOC]] and study notes in [[04-Learning/_Learning MOC|Learning MOC]] past their `review_cycle` (90d / 30d).

```dataview
TABLE type AS "Type", area AS "Area", last_reviewed AS "Last Reviewed", review_cycle AS "Cycle"
FROM "" AND !"99-Templates"
WHERE (type = "concept" OR type = "learning")
  AND last_reviewed AND review_cycle
  AND !contains(file.name, "MOC")
  AND date(today) - date(last_reviewed) > dur(review_cycle)
SORT last_reviewed ASC
```

