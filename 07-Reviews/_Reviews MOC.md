---
type: moc
tags:
  - type/moc
  - area/reviews
---

# 📊 Reviews MOC

> Periodic reflection — weekly (`YYYY-[W]WW.md`) and monthly (`YYYY-MM.md`) reviews, post-mortems, and AI-generated summaries. Your looking-backward lens.

## 📅 Past Weekly Reviews
```dataview
TABLE file.ctime AS "Created Date"
FROM "07-Reviews"
WHERE file.name != "_Reviews MOC" AND (contains(file.name, "Weekly") OR contains(file.name, "W"))
SORT file.name DESC
```

## 🏆 Past Monthly Reviews
```dataview
TABLE file.ctime AS "Created Date"
FROM "07-Reviews"
WHERE file.name != "_Reviews MOC" AND contains(file.name, "Monthly")
SORT file.name DESC
```
