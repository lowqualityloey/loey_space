---
type: moc
tags:
  - type/moc
updated: 2026-08-02
---

# 📥 Inbox Dashboard

> Capture everything here before sorting. Process each item with `99-Templates/Triage.md`, then file it into Projects, Dev, Learning, Personal, Concepts, or Resources. **Rule: empty this weekly.**

## 📌 Unprocessed Notes

```dataview
TABLE file.ctime AS "Created", tags AS "Tags"
FROM "00-Inbox"
WHERE file.name != "_Inbox MOC" AND !contains(file.name, "Quick capture dump")
SORT file.ctime DESC
```

## 📝 Quick Notes Dump

![[quick-capture-dump]]
