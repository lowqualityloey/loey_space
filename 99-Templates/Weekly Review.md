---
created: <% tp.date.now("YYYY-MM-DD") %>
type: review
status: completed
area: general
tags:
  - type/review
---

# Weekly Review (<% tp.date.now("YYYY-[W]WW") %>)

## 📊 Habit & Wellness Stats

### Energy Average
```dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day && p.energy != null);
const currentDay = dv.current().file.day || moment();
const targetYear = currentDay.weekYear || currentDay.year;
const targetWeek = currentDay.weekNumber || currentDay.week;

const weekPages = pages.where(p => {
  const d = p.file.day;
  const wy = d.weekYear || d.year;
  const wn = d.weekNumber || d.week;
  return wy === targetYear && wn === targetWeek;
});
const vals = weekPages.map(p => Number(p.energy)).where(v => !isNaN(v));
const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "—";
dv.paragraph(`Average energy: **${avg}** / 5`);
```

### Sleep Average
```dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day && p.sleep_hours != null);
const currentDay = dv.current().file.day || moment();
const targetYear = currentDay.weekYear || currentDay.year;
const targetWeek = currentDay.weekNumber || currentDay.week;

const weekPages = pages.where(p => {
  const d = p.file.day;
  const wy = d.weekYear || d.year;
  const wn = d.weekNumber || d.week;
  return wy === targetYear && wn === targetWeek;
});
const vals = weekPages.map(p => Number(p.sleep_hours)).where(v => !isNaN(v));
const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "—";
dv.paragraph(`Average sleep: **${avg}** hours`);
```

### Mood Counts
```dataviewjs
const moods = ["calm", "good", "okay", "tired", "stressed", "low"];
const pages = dv.pages('"01-Daily"').where(p => p.file.day && p.mood);
const currentDay = dv.current().file.day || moment();
const targetYear = currentDay.weekYear || currentDay.year;
const targetWeek = currentDay.weekNumber || currentDay.week;

const weekPages = pages.where(p => {
  const d = p.file.day;
  const wy = d.weekYear || d.year;
  const wn = d.weekNumber || d.week;
  return wy === targetYear && wn === targetWeek;
});

const counts = Object.fromEntries(moods.map(m => [m, 0]));
for (const p of weekPages) {
  const mood = String(p.mood).toLowerCase().trim();
  if (counts[mood] != null) counts[mood]++;
}

dv.table(["Mood", "Days"], moods.map(m => [m, counts[m]]));
```

---

## 🎉 Completed Tasks This Week
```dataview
TASK
FROM "01-Daily" OR "02-Projects" OR "04-Learning"
WHERE completed AND (completionDate >= date(today) - dur(7 days) OR file.mtime >= date(today) - dur(7 days))
LIMIT 15
```

---

## 🚀 Active Projects Progress
```dataview
TABLE status AS "Status", last_reviewed AS "Last Reviewed", review_cycle AS "Cycle"
FROM "02-Projects"
WHERE type = "project" AND status != "completed" AND status != "archived"
SORT priority DESC
```

## ⚠️ Stale Projects (Due for Review)
```dataviewjs
const pages = dv.pages('"02-Projects"').where(p => p.type === "project" && p.status !== "completed" && p.status !== "archived");
const stale = pages.where(p => {
  if (!p.last_reviewed) return true;
  const cycleDays = parseInt(p.review_cycle) || 14;
  const lastRev = moment(p.last_reviewed.toString());
  return moment().diff(lastRev, 'days') >= cycleDays;
});
if (stale.length > 0) {
  dv.table(["Project", "Status", "Last Reviewed", "Cycle"], stale.map(p => [p.file.link, p.status, p.last_reviewed, p.review_cycle || "14d"]));
} else {
  dv.paragraph("✅ All active projects are up to date!");
}
```

---

## 📖 Learning Notes Added This Week
```dataview
TABLE topic AS "Topic", status AS "Status"
FROM "04-Learning"
WHERE file.ctime >= date(today) - dur(7 days) OR created >= date(today) - dur(7 days)
```

---

## 💡 Weekly Reflection

### 🌟 What went well?
- 

### 🛑 What was challenging or needs adjustment?
- 

### 🎯 Key Focus for Next Week
- 
