---
created: 2026-08-09
updated: 2026-09-03
type: moc
status: active
area: personal
cssclasses:
  - cards
tags:
  - type/moc
  - area/personal
---

# 🧘 Personal Life Command Hub

> Private life administration — health & fitness, personal goals, hobbies, travel, and deep reflections. Truly sensitive credentials and confidential records belong in `.secrets/`.

---

## 🎮 Hobbies, Gaming & Media
```dataview
TABLE category AS "Category", file.mtime AS "Last Touched"
FROM "05-Personal"
WHERE file.name != "_Personal MOC" AND (category = "hobbies" OR contains(tags, "topic/gaming") OR contains(file.name, "lore"))
SORT file.mtime DESC
```

---

## 🏋️ Health, Fitness & Wellness
```dataview
TABLE status AS "Status", file.mtime AS "Updated"
FROM "05-Personal"
WHERE file.name != "_Personal MOC" AND (category = "health-fitness" OR contains(tags, "topic/fitness"))
SORT file.mtime DESC
```

---

## 🎯 Goals, Habits & Long-Term Vision
```dataview
TABLE status AS "Status", last_reviewed AS "Reviewed"
FROM "05-Personal"
WHERE file.name != "_Personal MOC" AND (category = "goals" OR category = "reflection")
SORT file.mtime DESC
```

---

## 📂 All Other Personal Notes
```dataview
TABLE category AS "Category", file.mtime AS "Last Touched"
FROM "05-Personal"
WHERE file.name != "_Personal MOC" 
  AND category != "hobbies" 
  AND category != "health-fitness" 
  AND category != "goals"
  AND category != "reflection"
  AND !contains(file.name, "lore")
SORT file.mtime DESC
```
