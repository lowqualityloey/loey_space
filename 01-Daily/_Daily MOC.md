---
type: moc
tags:
  - type/moc
  - area/daily
---

# 📅 Daily Notes MOC

Time-stamped chronological notes — and the source of truth for tasks and habits. Tracks `mood`, `energy`, `sleep_hours`, habit consistency, wellness, and AI-generated daily summaries.

---

## 🚀 Recent Daily Notes
```dataview
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)"
FROM "01-Daily"
WHERE file.name != "_Daily MOC" AND file.name != "All daily notes live here"
SORT file.name DESC
LIMIT 14
```

---

## 📊 Habit Analytics & Trends
* [[07-Reviews/Habit Analytics Dashboard|📊 30-Day Habit Analytics Dashboard]] — Rolling completion rates, streaks & day-of-week patterns.

```dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day);
dv.paragraph(`Total logged daily notes: **${pages.length}**`);
```
