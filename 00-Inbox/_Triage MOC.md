---
type: moc
cssclasses:
  - cards
tags:
  - type/moc
  - area/system
---

# 🧹 Triage & Maintenance MOC

> Surfaces neglected inbox items, stale `in-progress` notes, and concepts past their 90-day `review_cycle` — so nothing rots quietly in the vault.

## 📥 Neglected Inbox Items
Loose notes sitting in the inbox for more than 7 days. Tag them with a destination token and run **Triage Sweep**, or bin them.

Dashboards (`_*`) and the capture dump are excluded — they live here permanently and were drowning out the real items.

```dataview
TABLE file.ctime AS "Captured Date"
FROM "00-Inbox"
WHERE !startswith(file.name, "_")
  AND file.name != "quick-capture-dump"
  AND date(today) - file.ctime > dur(7 days)
SORT file.ctime ASC
```

## ⏳ Stale In-Progress Notes
Notes marked `in-progress` but untouched for over 30 days. Templates are excluded, since their frontmatter is a blueprint rather than real state.

```dataview
TABLE type AS "Type", area AS "Area", file.mtime AS "Last Touched"
FROM "" AND !"99-Templates"
WHERE status = "in-progress" AND date(today) - file.mtime > dur(30 days)
SORT file.mtime ASC
```

## 📅 Overdue Reviews
Evergreen concepts or learning materials past their `review_cycle`. Notes without a `last_reviewed` date are skipped rather than counted as overdue.

```dataview
TABLE type AS "Type", area AS "Area", last_reviewed AS "Last Reviewed", review_cycle AS "Cycle"
FROM "" AND !"99-Templates"
WHERE (type = "concept" OR type = "learning")
  AND last_reviewed AND review_cycle
  AND date(today) - date(last_reviewed) > dur(review_cycle)
SORT last_reviewed ASC
```
