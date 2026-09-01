---
created: 2026-08-09
updated: 2026-09-01
type: moc
status: active
area: daily
tags:
  - type/moc
  - area/daily
---

# 📅 Daily Notes MOC & Journal Hub

> *The chronological source of truth for daily focus, vitals, habits, and AI reflections.*

```dataviewjs
// 14-Day Vitals Rollup
const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/))
  .sort(p => p.file.name, "desc");

const recent = pages.slice(0, 14);
let totalSleep = 0, countSleep = 0;
let totalEnergy = 0, countEnergy = 0;

for (let p of recent) {
  if (p.sleep_hours != null && !isNaN(Number(p.sleep_hours))) { 
    totalSleep += Number(p.sleep_hours); 
    countSleep++; 
  }
  if (p.energy != null && !isNaN(Number(p.energy))) { 
    totalEnergy += Number(p.energy); 
    countEnergy++; 
  }
}

const avgSleep = countSleep > 0 ? (totalSleep / countSleep).toFixed(1) : "N/A";
const avgEnergy = countEnergy > 0 ? (totalEnergy / countEnergy).toFixed(1) : "N/A";

dv.paragraph(`📊 **14-Day Vitals Pulse**: Avg Sleep: **${avgSleep} hrs** · Avg Energy: **${avgEnergy}/5** · Total Logged Days: **${pages.length}**`);
```

---

## ⚡ Quick Links & Dashboards
- [[Home|🏠 Central Command Hub]] — Master vault dashboard.
- [[01-Daily/Tasks Kanban|📋 Live Tasks Kanban Board]] — Active daily & project task board.
- [[01-Daily/_Tasks MOC|📋 Tasks MOC & History]] — Central aggregated task analytics.
- [[07-Reviews/Habit Analytics Dashboard|📊 Habit Analytics Dashboard]] — 30-day consistency heatmap & streaks.
- [[07-Reviews/_Reviews MOC|📅 Weekly Reviews Hub]] — 7-day retrospective rollups.

---

## 🚀 Recent Daily Notes (Last 14 Days)

```dataview
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)", file.mtime AS "Last Updated"
FROM "01-Daily"
WHERE regexmatch("^\d{4}-\d{2}-\d{2}$", file.name)
SORT file.name DESC
LIMIT 14
```

---

## 🗂️ Monthly Archives

```dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/));
const months = {};

for (let p of pages) {
  const m = p.file.name.slice(0, 7); // YYYY-MM
  if (!months[m]) months[m] = { count: 0, latest: p.file.name };
  months[m].count++;
}

const sortedMonths = Object.keys(months).sort().reverse();
const rows = sortedMonths.map(m => [
  `📁 **${m}**`,
  `${months[m].count} notes`,
  dv.fileLink(`01-Daily/${m}/${months[m].latest}`, false, `Latest: ${months[m].latest}`)
]);

dv.table(["Month", "Logged Days", "Latest Entry"], rows);
```

---

## 💡 Daily Workflows & Shortcuts

- `Ctrl + P` → **QuickAdd: Create Daily Note** — Initializes today's note with carry-over tasks and habit templates.
- `Ctrl + Shift + A` → **QuickAdd: AI Enrich Note** — Runs multi-domain Gemini enrichment on the active daily log.
- `Ctrl + P` → **QuickAdd: Sync GitHub Activity to Daily Log** — Pulls today's commits and PRs with 12h timestamps.
- `hey loey morning` / `hey loey evening` — Trigger AI Chief of Staff routines directly in your agent terminal.
