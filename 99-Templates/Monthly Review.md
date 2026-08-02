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
const currentDay = dv.current().file.day || moment();
const pages = dv.pages('"01-Daily"').where(p => {
  if (!p.file.day) return false;
  const d = p.file.day;
  return d.year === currentDay.year && d.month === currentDay.month;
});

const energyVals = pages.where(p => p.energy != null).map(p => Number(p.energy)).where(v => !isNaN(v));
const energyAvg = energyVals.length ? (energyVals.reduce((a, b) => a + b, 0) / energyVals.length).toFixed(2) : "—";

const sleepVals = pages.where(p => p.sleep_hours != null).map(p => Number(p.sleep_hours)).where(v => !isNaN(v));
const sleepAvg = sleepVals.length ? (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(2) : "—";

const monthLabel = currentDay.monthLong ? `${currentDay.monthLong} ${currentDay.year}` : "This Month";
dv.paragraph(`⚡ Average Energy (${monthLabel}): **${energyAvg}** / 5`);
dv.paragraph(`😴 Average Sleep (${monthLabel}): **${sleepAvg}** hours`);
```

### Mood Distribution
```dataviewjs
const moods = ["calm", "good", "okay", "tired", "stressed", "low"];
const currentDay = dv.current().file.day || moment();
const pages = dv.pages('"01-Daily"').where(p => {
  if (!p.file.day || !p.mood) return false;
  const d = p.file.day;
  return d.year === currentDay.year && d.month === currentDay.month;
});

const counts = Object.fromEntries(moods.map(m => [m, 0]));
for (const p of pages) {
  const mood = String(p.mood).toLowerCase().trim();
  if (counts[mood] != null) counts[mood]++;
}

dv.table(["Mood", "Days Logged"], moods.map(m => [m, counts[m]]));
```

---

## 🏆 Completed Projects This Month
```dataview
TABLE WITHOUT ID
file.link AS "Project",
area AS "Area",
updated AS "Date Completed"
FROM "02-Projects"
WHERE status = "completed" AND !contains(file.name, "Kanban") AND !contains(file.name, "MOC")
SORT file.mtime DESC
```

---

## 📚 Topics Mastered / Completed
```dataview
TABLE WITHOUT ID
file.link AS "Learning Note",
topic AS "Topic",
updated AS "Completed Date"
FROM "04-Learning"
WHERE status = "completed" AND !contains(file.name, "MOC")
SORT file.mtime DESC
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
