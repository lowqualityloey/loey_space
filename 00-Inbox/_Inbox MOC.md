---
type: moc
tags:
  - type/moc
updated: 2026-08-02
---

# 📥 Inbox Dashboard

> Quick capture notes to be processed and filed into Projects, Dev, Learning, Personal, or Resources.

## 📌 Unprocessed Notes

```dataview
TABLE file.ctime AS "Created", tags AS "Tags"
FROM "00-Inbox"
WHERE file.name != "_Inbox MOC" AND !contains(file.name, "Quick capture dump")
SORT file.ctime DESC
```

## 📝 Quick Notes Dump
- 
