---
type: moc
tags:
  - type/moc
  - area/learning
---

# 📖 Learning MOC

> Knowledge acquisition in progress — course notes, tutorials, study topics, and interview prep. Once something is learned, move the idea to `08-Concepts/` or the reference to `06-Resources/`.

## 🎯 Active Learning
```dataview
TABLE status AS "Status", topic AS "Topic", source_url AS "Source"
FROM "04-Learning"
WHERE status = "in-progress" OR status = "planning"
SORT file.mtime DESC
```

## ✅ Completed Topics & Reference
```dataview
TABLE topic AS "Topic", updated AS "Date Completed"
FROM "04-Learning"
WHERE file.name != "_Learning MOC" AND (status = "completed" OR (status != "in-progress" AND status != "planning"))
SORT file.name ASC
```
