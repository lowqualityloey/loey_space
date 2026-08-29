---
type: moc
cssclasses:
  - cards
tags:
  - type/moc
  - area/learning
---

# 📖 Learning Hub

> Knowledge acquisition in progress — active courses, study topics, certifications, tutorials, and reading notes. Once completed, distill insights into [[08-Concepts/_Concepts MOC|08-Concepts]] or code patterns into [[03-Dev/_Dev MOC|03-Dev]].

---

## 🎯 Active & In-Progress Learning

```dataview
TABLE 
  topic AS "Topic",
  platform_author AS "Platform / Author",
  progress AS "Progress",
  status AS "Status",
  source_url AS "Source",
  file.mtime AS "Last Active"
FROM "04-Learning"
WHERE file.name != "_Learning MOC" AND (status = "in-progress" OR status = "planning")
SORT file.mtime DESC
```

---

## ✅ Completed Topics & References

```dataview
TABLE 
  topic AS "Topic",
  platform_author AS "Platform / Author",
  updated AS "Date Completed"
FROM "04-Learning"
WHERE file.name != "_Learning MOC" AND status = "completed"
SORT file.name ASC
```
