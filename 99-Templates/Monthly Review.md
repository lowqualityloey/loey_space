---
created: <% tp.date.now("YYYY-MM-DD") %>
type: review
status: completed
area: general
tags:
  - type/review
---

# Monthly Review (<% tp.date.now("MMMM YYYY") %>)

## 📊 Monthly Habit & Wellness Summary

### Energy & Sleep Averages
```dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day && p.file.day >= date(today) - dur(30 days));

const energyVals = pages.where(p => p.energy != null).map(p => Number(p.energy)).where(v => !isNaN(v));
const energyAvg = energyVals.length ? (energyVals.reduce((a, b) => a + b, 0) / energyVals.length).toFixed(2) : "—";

const sleepVals = pages.where(p => p.sleep_hours != null).map(p => Number(p.sleep_hours)).where(v => !isNaN(v));
const sleepAvg = sleepVals.length ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(2) : "—";

dv.paragraph(`⚡ Average Energy (Last 30 Days): **${energyAvg}** / 5`);
dv.paragraph(`😴 Average Sleep (Last 30 Days): **${sleepAvg}** hours`);
```

### Mood Distribution
```dataviewjs
const moods = ["calm", "good", "okay", "tired", "stressed", "low"];
const pages = dv.pages('"01-Daily"').where(p => p.file.day && p.file.day >= date(today) - dur(30 days) && p.mood);

const counts = Object.fromEntries(moods.map(m => [m, 0]));
for (const p of pages) {
  const mood = String(p.mood).toLowerCase().trim();
  if (counts[mood] != null) counts[mood]++;
}

dv.table(["Mood", "Days (Past 30 Days)"], moods.map(m => [m, counts[m]]));
```

---

## 🏆 Completed Projects This Month
```dataview
TABLE area AS "Area", updated AS "Date Completed"
FROM "02-Projects"
WHERE type = "project" AND status = "completed" AND (updated >= date(today) - dur(30 days) OR file.mtime >= date(today) - dur(30 days))
```

---

## 📚 Topics Mastered / Completed
```dataview
TABLE topic AS "Topic", updated AS "Completed Date"
FROM "04-Learning"
WHERE type = "learning" AND status = "completed" AND (updated >= date(today) - dur(30 days) OR file.mtime >= date(today) - dur(30 days))
```

---

## 🧠 Monthly Retrospective

### 🚀 Big Accomplishments
- 

### 📊 System & Habits Audit
- **What worked smoothly?**
- **What needs friction removed?**

### 🎯 Strategic Focus for Next Month
- 
