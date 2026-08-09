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
Notes sitting in the inbox for more than 7 days. Time to classify or delete them!
```dataview
TABLE file.ctime AS "Captured Date"
FROM "00-Inbox"
WHERE file.name != "_Triage MOC" AND date(today) - file.ctime > dur(7 days)
SORT file.ctime ASC
```

## ⏳ Stale In-Progress Notes
Notes actively marked as `in-progress` but haven't been touched in over 30 days.
```dataview
TABLE type AS "Type", area AS "Area", file.mtime AS "Last Touched"
FROM ""
WHERE status = "in-progress" AND date(today) - file.mtime > dur(30 days)
SORT file.mtime ASC
```

## 📅 Overdue Reviews
Evergreen concepts or learning materials that are past their review cycle.
```dataview
TABLE type AS "Type", area AS "Area", last_reviewed AS "Last Reviewed"
FROM ""
WHERE (type = "concept" OR type = "learning") AND date(today) - date(last_reviewed) > dur(review_cycle)
SORT last_reviewed ASC
```
