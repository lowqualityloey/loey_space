---
created: 2026-08-09
updated: 2026-10-08
type: moc
status: active
area: daily
tags:
  - type/moc
  - area/daily
---

# 📅 Daily Notes MOC & Journal Hub

> *The chronological source of truth for daily focus, vitals, habits, and AI reflections.*

---

## 📊 14-Day Vitals Rollup (Last 14 calendar days)

```dataviewjs
// A CALENDAR window, inclusive of today — the same fix the Habit Analytics Dashboard needed
// (#55). This used to be `.slice(0, 14)`, which selects the newest 14 note FILES: a gap in
// logging then reached back past the 14 days the heading advertises and an old note was
// averaged as recent. Fourteen calendar days is today and the 13 before it, which is why the
// subtraction is `windowDays - 1`. The boundary compares each note's own `YYYY-MM-DD` name,
// this vault's calendar key, and both ends derive from Luxon LOCAL time, so the window is a
// local-calendar window rather than a UTC one.
const windowDays = 14;
const today = dv.luxon.DateTime.now().startOf("day");
const windowStart = today.minus({ days: windowDays - 1 }).toISODate();
const windowEnd = today.toISODate();

const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/))
  .where(p => p.file.name >= windowStart && p.file.name <= windowEnd)
  .sort(p => p.file.name, "desc");

let totalSleep = 0, countSleep = 0;
let totalEnergy = 0, countEnergy = 0;

for (let p of pages) {
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

dv.paragraph(`📊 **14-Day Vitals Pulse**: Avg Sleep: **${avgSleep} hrs** · Avg Energy: **${avgEnergy}/5**`);

// Coverage before the averages, because an average over two of fourteen days and one over all
// fourteen are the same number and completely different facts. A day with no note is UNKNOWN,
// not zero; a note missing a field is unknown for THAT metric and is excluded from its average
// rather than counted as zero — which is why each metric reports its own populated coverage.
const observedDays = pages.length;
const unloggedDays = windowDays - observedDays;
dv.paragraph(
  `**Coverage**: ${observedDays}/${windowDays} calendar days logged ` +
  `(${Math.round((observedDays / windowDays) * 100)}%) · ${unloggedDays} unlogged day(s), which are unknown rather than zero`
);
dv.paragraph(
  `**Vitals coverage**: sleep recorded on ${countSleep}/${windowDays} · energy recorded on ${countEnergy}/${windowDays}`
);
```

---

## ⚡ Quick Links & Dashboards
- [[Home|🏠 Central Command Hub]] — Master vault dashboard.
- [[01-Daily/Tasks Kanban|📋 Live Tasks Kanban Board]] — Active daily & project task board.
- [[01-Daily/_Tasks MOC|📋 Tasks MOC & History]] — Central aggregated task analytics.
- [[07-Reviews/Habit Analytics Dashboard|📊 Habit Analytics Dashboard]] — 30-day consistency heatmap & streaks.
- [[07-Reviews/_Reviews MOC|📅 Weekly Reviews Hub]] — 7-day retrospective rollups.

---

## 🚀 Recent Daily Notes (Last 14 calendar days)

```dataviewjs
// The SAME calendar window as the pulse above, so both views describe the same fourteen days.
// The former DQL `LIMIT 14` had the same defect as `.slice(0, 14)`: it took the newest 14 note
// FILES, which with a logging gap reached back past the window the heading advertises.
const windowDays = 14;
const today = dv.luxon.DateTime.now().startOf("day");
const windowStart = today.minus({ days: windowDays - 1 }).toISODate();
const windowEnd = today.toISODate();

// A blank field is unknown, never zero — shown as an em dash so a missing vital is not read as
// a real value of 0.
const cell = (value) => (value === null || value === undefined || value === "" ? "—" : value);

const rows = dv.pages('"01-Daily"')
  .where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/))
  .where(p => p.file.name >= windowStart && p.file.name <= windowEnd)
  .sort(p => p.file.name, "desc")
  .map(p => [p.file.name, cell(p.mood), cell(p.energy), cell(p.sleep_hours), p.file.mtime]);

if (rows.length > 0) {
  dv.table(["Date", "Mood", "Energy", "Sleep (hrs)", "Last Updated"], rows);
} else {
  dv.paragraph("No daily notes in the last 14 calendar days.");
}

dv.paragraph(
  `**Coverage**: ${rows.length}/${windowDays} calendar days logged ` +
  `(${Math.round((rows.length / windowDays) * 100)}%) · ${windowDays - rows.length} unlogged day(s) are unknown rather than failures`
);
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
