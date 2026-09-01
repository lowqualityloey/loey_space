---
created: 2026-08-09
updated: 2026-09-01
type: moc
status: active
area: reviews
cssclasses:
  - cards
tags:
  - type/moc
  - area/reviews
---

# 📊 Reviews & Analytics Hub

> *Periodic retrospectives and longitudinal health tracking — weekly (`YYYY-[W]WW.md`) and monthly (`YYYY-MM.md`) reviews, retrospectives, and 30-day habit analytics.*

---

## 📈 Performance & Habit Analytics
- [[07-Reviews/Habit Analytics Dashboard|📊 Habit Analytics Dashboard]] — 30-day completion rates, streak tracking, day-of-week heatmaps & trend insights.
- [[Home|🏠 Central Command Hub]] — Master vault dashboard.
- [[01-Daily/_Daily MOC|📅 Daily Notes MOC]] — Daily journal entries and 14-day vitals pulse.

---

## 📅 Past Weekly Reviews
```dataview
TABLE 
  choice(updated, updated, file.mtime) AS "Last Modified",
  file.ctime AS "Created Date"
FROM "07-Reviews"
WHERE file.name != "_Reviews MOC" 
  AND file.name != "Habit Analytics Dashboard" 
  AND (regexmatch("^\d{4}-W\d{1,2}$", file.name) OR (type = "review" AND !contains(file.name, "Monthly")))
SORT file.name DESC
```

---

## 🏆 Past Monthly Reviews
```dataview
TABLE 
  choice(updated, updated, file.mtime) AS "Last Modified",
  file.ctime AS "Created Date"
FROM "07-Reviews"
WHERE file.name != "_Reviews MOC" 
  AND file.name != "Habit Analytics Dashboard" 
  AND (regexmatch("^\d{4}-\d{2}$", file.name) OR contains(file.name, "Monthly"))
SORT file.name DESC
```

---

## 💡 Review Workflows & Automation

- `Ctrl + P` → **QuickAdd: 📊 Weekly AI Summary** — Automatically aggregates the last 7 daily notes, GitHub pushes, and habit data into a structured weekly retrospective.
- `npm run weekly-summary` — Re-runs the automated weekly aggregation script via CLI.
- `hey loey weekly` — Directs the AI Chief of Staff to synthesize this week's highlights and milestones.
