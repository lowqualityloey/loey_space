---
type: moc
tags:
  - type/moc
  - area/projects
---

# 🚀 Projects MOC

> Dashboard of active development, planning, and completed projects.

## 🟢 Active Projects
```dataview
TABLE status AS "Status", last_reviewed AS "Last Reviewed", priority AS "Priority"
FROM "02-Projects"
WHERE type = "project" AND (status = "in-progress" OR status = "active")
SORT priority DESC
```

## 📝 Planning & Backlog
```dataview
TABLE area AS "Area", priority AS "Priority"
FROM "02-Projects"
WHERE type = "project" AND status = "planning"
SORT priority DESC
```

## ✅ Completed Projects
```dataview
TABLE updated AS "Completed Date", area AS "Area"
FROM "02-Projects"
WHERE type = "project" AND status = "completed"
SORT file.mtime DESC
```
