---
type: moc
cssclasses:
  - cards
tags:
  - type/moc
  - area/reviews
updated: 2026-08-29
---

# 📊 Reviews & Analytics Hub

> Periodic reflection — weekly (`YYYY-[W]WW.md`) and monthly (`YYYY-MM.md`) reviews, retrospectives, and 30-day habit analytics. Your looking-backward lens.

---

## 📈 Performance & Habit Analytics
* [[07-Reviews/Habit Analytics Dashboard|📊 Habit Analytics Dashboard]] — 30-day completion rates, streak tracking, day-of-week heatmaps & trend insights.

---

## 📅 Past Weekly Reviews
```dataview
TABLE 
  file.ctime AS "Created Date",
  file.mtime AS "Last Modified"
FROM "07-Reviews"
WHERE file.name != "_Reviews MOC" 
  AND file.name != "Habit Analytics Dashboard" 
  AND (contains(file.name, "Weekly") OR contains(file.name, "W") OR type = "review")
  AND !contains(file.name, "Monthly")
SORT file.name DESC
```

---

## 🏆 Past Monthly Reviews
```dataview
TABLE 
  file.ctime AS "Created Date",
  file.mtime AS "Last Modified"
FROM "07-Reviews"
WHERE file.name != "_Reviews MOC" 
  AND file.name != "Habit Analytics Dashboard" 
  AND contains(file.name, "Monthly")
SORT file.name DESC
```
