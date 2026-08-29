---
created: 2026-08-09
updated: 2026-08-29
type: dashboard
status: active
area: reviews
tags:
  - type/dashboard
  - area/reviews
  - topic/habits
  - topic/analytics
---

# 📊 Habit Analytics Dashboard

> Comprehensive habit tracking, streaks, and trend insights

---

## 📈 Overall Habit Performance (Last 30 Days)

```dataviewjs
const pages = dv.pages('"01-Daily"');
let totalHabits = 0;
let completedHabits = 0;
let habitStats = {};

for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;

    const name = t.text.trim();
    if (!habitStats[name]) habitStats[name] = { done: 0, total: 0 };
    habitStats[name].total++;
    totalHabits++;

    if (t.completed || t.status === "x") {
      habitStats[name].done++;
      completedHabits++;
    }
  }
}

const rate = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;
dv.paragraph(`**Overall Completion Rate**: ${rate}% (${completedHabits}/${totalHabits} habits completed)`);

const entries = Object.entries(habitStats).sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total));

if (entries.length > 0) {
  const rows = entries.map(([name, s]) => {
    const r = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
    const filled = Math.floor(r / 10);
    const empty = 10 - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    return [name, `[${bar}] ${r}%`, `${s.done}/${s.total}`];
  });
  dv.table(["Habit", "Progress", "Completed/Total"], rows);
} else {
  dv.paragraph("No habit data found.");
}
```

---

## 📊 Daily Habit Heatmap (Last 14 Days)

```dataviewjs
const allPages = dv.pages('"01-Daily"')
  .where(p => p.file.name !== "_Daily MOC" && p.file.name !== "_Tasks MOC" && p.file.name !== "Habit Analytics Dashboard")
  .sort(p => p.file.name, "desc");

// Take only last 14 days
const pages = [];
let count = 0;
for (let p of allPages) {
  if (count >= 14) break;
  pages.push(p);
  count++;
}

// Collect all habit names
let habitNames = [];
for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;
    const name = t.text.trim();
    if (!habitNames.includes(name)) habitNames.push(name);
  }
}

if (habitNames.length === 0) {
  dv.paragraph("No habits found in recent daily notes.");
} else {
  const rows = [];
  for (let p of pages) {
    const dayLabel = p.file.name;
    const row = [dayLabel];

    // Build habit completion map for this day
    const dayMap = {};
    if (p.file.tasks) {
      for (let t of p.file.tasks) {
        if (!t.text || t.text.trim() === "") continue;
        const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
        if (!sec.includes("habit")) continue;
        const name = t.text.trim();
        dayMap[name] = t.completed || t.status === "x";
      }
    }

    for (let h of habitNames) {
      row.push(dayMap[h] === true ? "✅" : (dayMap[h] === false ? "❌" : "—"));
    }
    rows.push(row);
  }

  dv.table(["Date", ...habitNames], rows);
}
```

---

## 📅 Completion by Day of Week

```dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day);
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const stats = {};
for (let d of dayNames) stats[d] = { done: 0, total: 0 };

for (let p of pages) {
  if (!p.file.tasks || !p.file.day) continue;
  const wd = p.file.day.weekday; // Luxon: 1=Mon, 7=Sun
  const dayName = dayNames[wd - 1];
  if (!dayName) continue;

  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;

    stats[dayName].total++;
    if (t.completed || t.status === "x") stats[dayName].done++;
  }
}

const rows = dayNames.map(d => {
  const s = stats[d];
  const r = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
  return [d, `${r}%`, `${s.done}/${s.total}`];
});

dv.table(["Day", "Rate", "Done/Total"], rows);
```

---

## 🔄 Streak Analysis

```dataviewjs
const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name !== "_Daily MOC" && p.file.name !== "_Tasks MOC" && p.file.name !== "Habit Analytics Dashboard")
  .sort(p => p.file.name, "asc");

// Collect all habit names
let habitNames = [];
for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;
    const name = t.text.trim();
    if (!habitNames.includes(name)) habitNames.push(name);
  }
}

if (habitNames.length === 0) {
  dv.paragraph("No habits found for streak analysis.");
} else {
  const streakRows = [];

  for (let habit of habitNames) {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Walk through pages chronologically
    for (let p of pages) {
      if (!p.file.tasks) {
        tempStreak = 0;
        continue;
      }

      let found = false;
      let completed = false;
      for (let t of p.file.tasks) {
        if (!t.text || t.text.trim() === "") continue;
        const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
        if (!sec.includes("habit")) continue;
        if (t.text.trim() === habit) {
          found = true;
          completed = t.completed || t.status === "x";
          break;
        }
      }

      if (found && completed) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else if (found && !completed) {
        tempStreak = 0;
      }
      // If habit not found on this day, don't break streak (note might just be missing)
    }

    // Current streak = tempStreak at the end of the loop (most recent consecutive)
    currentStreak = tempStreak;

    streakRows.push([habit, currentStreak + " days", longestStreak + " days"]);
  }

  dv.table(["Habit", "Current Streak", "Best Streak"], streakRows);
}
```

---

## 📊 Trend Analysis (7-Day Moving Average)

```dataviewjs
const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name !== "_Daily MOC" && p.file.name !== "_Tasks MOC" && p.file.name !== "Habit Analytics Dashboard")
  .sort(p => p.file.name, "asc");

if (pages.length === 0) {
  dv.paragraph("No daily notes found for trend analysis.");
} else {
  const rates = [];

  for (let p of pages) {
    if (!p.file.tasks) continue;
    let dayTotal = 0;
    let dayDone = 0;

    for (let t of p.file.tasks) {
      if (!t.text || t.text.trim() === "") continue;
      const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
      if (!sec.includes("habit")) continue;
      dayTotal++;
      if (t.completed || t.status === "x") dayDone++;
    }

    if (dayTotal > 0) {
      rates.push({ date: p.file.name, rate: Math.round((dayDone / dayTotal) * 100) });
    }
  }

  if (rates.length === 0) {
    dv.paragraph("No habit data found for trend analysis.");
  } else {
    // Show last 14 days of rates
    const recent = rates.slice(-14);
    const rows = recent.map((r, i) => {
      // Calculate 7-day moving average
      const start = Math.max(0, rates.indexOf(r) - 6);
      const avgWindow = rates.slice(start, rates.indexOf(r) + 1);
      const avg = Math.round(avgWindow.reduce((sum, x) => sum + x.rate, 0) / avgWindow.length);
      return [r.date, r.rate + "%", avg + "%"];
    });

    dv.table(["Date", "Daily Rate", "7-Day Avg"], rows);

    // Trend indicator
    if (rates.length >= 2) {
      const latest = rates[rates.length - 1].rate;
      const previous = rates[rates.length - 2].rate;
      const diff = latest - previous;

      let trend = "➡️ Stable";
      if (diff > 10) trend = "📈 Strong improvement";
      else if (diff > 3) trend = "↗️ Improving";
      else if (diff < -10) trend = "📉 Significant decline";
      else if (diff < -3) trend = "↘️ Slight decline";

      dv.paragraph(`**Current Trend**: ${trend} | **Latest**: ${latest}%`);
    }
  }
}
```

---

## 🎯 Areas for Improvement

```dataviewjs
const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name !== "_Daily MOC" && p.file.name !== "_Tasks MOC" && p.file.name !== "Habit Analytics Dashboard");

let habitStats = {};

for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;

    const name = t.text.trim();
    if (!habitStats[name]) habitStats[name] = { done: 0, total: 0 };
    habitStats[name].total++;
    if (t.completed || t.status === "x") habitStats[name].done++;
  }
}

const weak = Object.entries(habitStats)
  .filter(([, s]) => s.total >= 3)
  .map(([name, s]) => ({ name, rate: Math.round((s.done / s.total) * 100), done: s.done, total: s.total }))
  .filter(h => h.rate < 70)
  .sort((a, b) => a.rate - b.rate);

if (weak.length > 0) {
  dv.paragraph("Habits below 70% completion — consider adjusting timing, reducing friction, or bundling with stronger habits:");
  dv.table(["Habit", "Rate", "Done/Total"],
    weak.map(h => [h.name, h.rate + "%", `${h.done}/${h.total}`])
  );
} else {
  dv.paragraph("🎉 All habits are at 70%+ completion rate!");
}
```

---

## 🔗 Related

- [[01-Daily/_Daily MOC|📅 Daily MOC]]
- [[01-Daily/_Tasks MOC|📋 Tasks MOC]]
- [[Home|🏠 Home]]
