---
type: moc
tags:
  - type/moc
  - area/learning
---

# 📖 Learning MOC

> Course notes, tutorials, React concepts, and interview prep.

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
