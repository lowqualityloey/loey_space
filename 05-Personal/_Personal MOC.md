---
type: moc
tags:
  - type/moc
  - area/personal
---

# 🏋️ Personal MOC

> Private life administration — health and fitness logs, finances, goals, and personal reflections. Truly sensitive material belongs in `.secrets/`, never here.

## 📌 Notes & Reflections
```dataview
TABLE tags AS "Tags", file.mtime AS "Last Modified"
FROM "05-Personal"
WHERE file.name != "_Personal MOC"
SORT file.mtime DESC
```
