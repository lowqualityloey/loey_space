---
type: moc
tags:
  - type/moc
  - area/reviews
---

# 📊 Reviews MOC

> Archive of weekly and monthly reviews.

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
