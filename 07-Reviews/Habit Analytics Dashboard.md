---
created: 2026-08-09
updated: 2026-10-07
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

## 📈 Overall Habit Performance (Last 30 calendar days)

```dataviewjs
const cleanHabit = (text) => String(text || "")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ")
  .replace(/\s*\^[A-Za-z0-9]+\s*$/, " ")
  .replace(/#[\w/-]+/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();

// A CALENDAR window, inclusive of today. This used to be `.slice(0, 30)` under a comment
// claiming "from the last 30 days" — but slicing a name-sorted list picks the newest 30 note
// FILES, so a gap in logging silently reached back past the 30 days the heading advertises and
// an old note was counted as recent. Thirty calendar days is today and the 29 before it, which
// is why the subtraction is `windowDays - 1`.
//
// The boundary compares the note's own `YYYY-MM-DD` name, which is this vault's calendar key:
// daily notes are named that way and the MOCs match on the name. `file.day` is Dataview's parse
// of the same string in the local zone, so routing the boundary through a DateTime could only
// add a step where a timezone error becomes possible. Both ends are still derived from Luxon
// local time, so the window is a local-calendar window rather than a UTC one.
const windowDays = 30;
const today = dv.luxon.DateTime.now().startOf("day");
const windowStart = today.minus({ days: windowDays - 1 }).toISODate();
const windowEnd = today.toISODate();

const dailyNotes = dv.pages('"01-Daily"')
  .where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/));
const pages = dailyNotes
  .where(p => p.file.name >= windowStart && p.file.name <= windowEnd)
  .sort(p => p.file.name, "asc");

let totalHabits = 0;
let completedHabits = 0;
let habitStats = {};
let habitDays = 0;

for (let p of pages) {
  let dayHabits = 0;
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;

    const name = cleanHabit(t.text);
    if (!name) continue;

    if (!habitStats[name]) habitStats[name] = { done: 0, total: 0 };
    habitStats[name].total++;
    totalHabits++;
    dayHabits++;

    if (t.completed || t.status === "x") {
      habitStats[name].done++;
      completedHabits++;
    }
  }
  if (dayHabits > 0) habitDays++;
}

// Coverage before rate, because the rate alone cannot be read correctly without it: a 100% over
// two logged days and a 100% over thirty are the same number and completely different facts.
// Days with no note are UNKNOWN, not zero — they are counted here and excluded from the rate,
// which is computed over recorded habit lines only.
const observedDays = pages.length;
const unloggedDays = windowDays - observedDays;
dv.paragraph(
  `**Coverage**: ${observedDays}/${windowDays} calendar days logged ` +
  `(${Math.round((observedDays / windowDays) * 100)}%) · ${habitDays} day(s) recorded a habit line · ` +
  `${unloggedDays} unlogged day(s), which are unknown rather than failures`
);

const rate = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;
dv.paragraph(`**Overall Completion Rate**: ${rate}% (${completedHabits}/${totalHabits} habits completed on ${habitDays} logged day(s))`);

const entries = Object.entries(habitStats).sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total) || b[1].total - a[1].total);

if (entries.length > 0) {
  const rows = entries.map(([name, s]) => {
    const r = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
    return [name, `<progress value="${r}" max="100"></progress> ${r}%`, `${s.done}/${s.total}`];
  });
  dv.table(["Habit", "Progress", "Completed/Total"], rows);
} else {
  dv.paragraph("No habit data found.");
}
```

---

## 📊 Daily Habit Heatmap (Last 14 calendar days)

```dataviewjs
const cleanHabit = (text) => String(text || "")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ")
  .replace(/\s*\^[A-Za-z0-9]+\s*$/, " ")
  .replace(/#[\w/-]+/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();

// A CALENDAR window, inclusive of today — see the note above the 30-day view. `.slice(0, 14)`
// selected the newest 14 note FILES, so a week with no entries pulled older notes into a chart
// labelled as the last 14 days. Each DataviewJS block is its own scope, so this preamble is
// repeated per view by necessity rather than by preference; they must be changed together.
const windowDays = 14;
const today = dv.luxon.DateTime.now().startOf("day");
const windowStart = today.minus({ days: windowDays - 1 }).toISODate();
const windowEnd = today.toISODate();

const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/))
  .where(p => p.file.name >= windowStart && p.file.name <= windowEnd)
  .sort(p => p.file.name, "asc");

const preferredOrder = ["water", "prioritised", "move", "read", "tidy", "disconnect"];

// Collect unique cleaned habit names
let habitNames = [];
for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;
    const name = cleanHabit(t.text);
    if (name && !habitNames.includes(name)) habitNames.push(name);
  }
}

// Sort habit names with standard ones first
habitNames.sort((a, b) => {
  const ia = preferredOrder.indexOf(a);
  const ib = preferredOrder.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
});

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
        const name = cleanHabit(t.text);
        if (name) {
          dayMap[name] = t.completed || t.status === "x";
        }
      }
    }

    for (let h of habitNames) {
      row.push(dayMap[h] === true ? "✅" : (dayMap[h] === false ? "❌" : "—"));
    }
    rows.push(row);
  }

  dv.table(["Date", ...habitNames], rows);
}

// The chart shows only days that have a note: a blank cell means the day was not logged and is
// unknown, not that every habit failed. Stated so the empty rows are not read as zeroes.
dv.paragraph(
  `**Coverage**: ${pages.length}/${windowDays} calendar days logged ` +
  `(${Math.round((pages.length / windowDays) * 100)}%) · ${windowDays - pages.length} unlogged day(s) ` +
  `are not shown and are unknown rather than failures`
);
```

---

## 📅 Completion by Day of Week (All logged days)

```dataviewjs
const cleanHabit = (text) => String(text || "")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ")
  .replace(/\s*\^[A-Za-z0-9]+\s*$/, " ")
  .replace(/#[\w/-]+/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();

// No calendar window here on purpose — every logged day is included, which the heading now
// says. A bounded view would need a window; an unbounded one needs to disclose its size.
const pages = dv.pages('"01-Daily"').where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/) && p.file.day);
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
    const name = cleanHabit(t.text);
    if (!name) continue;

    stats[dayName].total++;
    if (t.completed || t.status === "x") stats[dayName].done++;
  }
}

const rows = dayNames.map(d => {
  const s = stats[d];
  const r = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
  return [d, `${r}%`, `${s.done}/${s.total}`];
});

// Weekday averages pool every logged day, so the denominator is logged days, not calendar days.
// A weekday with no entries is unknown and is not averaged as zero.
dv.paragraph(`**Coverage**: ${pages.length} logged day(s), pooled across weekdays; weekdays with no entries are unknown rather than 0%`);
dv.table(["Day", "Rate", "Done/Total"], rows);
```

---

## 🔄 Streak Analysis (All logged days)

```dataviewjs
const cleanHabit = (text) => String(text || "")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ")
  .replace(/\s*\^[A-Za-z0-9]+\s*$/, " ")
  .replace(/#[\w/-]+/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();

const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/))
  .sort(p => p.file.name, "asc");

const preferredOrder = ["water", "prioritised", "move", "read", "tidy", "disconnect"];

// Collect unique cleaned habit names
let habitNames = [];
for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;
    const name = cleanHabit(t.text);
    if (name && !habitNames.includes(name)) habitNames.push(name);
  }
}

habitNames.sort((a, b) => {
  const ia = preferredOrder.indexOf(a);
  const ib = preferredOrder.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
});

if (habitNames.length === 0) {
  dv.paragraph("No habits found for streak analysis.");
} else {
  const streakRows = [];

  for (let habit of habitNames) {
    let longestStreak = 0;
    let tempStreak = 0;
    let currentStreak = 0;
    let previousDate = null;

    // Walk through pages chronologically. A streak is a run of CONSECUTIVE calendar days on
    // which the habit was observed AND completed — a logged day with the habit absent, a day
    // with no note at all, or a gap in the calendar breaks it. The previous code let a streak
    // bridge across days where the habit was not recorded, so "5 days" could mean five
    // observations spread over two weeks with gaps in between.
    for (let i = 0; i < pages.length; i++) {
      const p = pages.at(i);
      const pageDate = p.file.name;

      // Parse the page date to check for calendar gaps.
      const pageDateObj = new Date(pageDate + "T00:00:00");

      if (previousDate !== null) {
        const diffTime = pageDateObj.getTime() - previousDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays > 1) {
          // Gap in the calendar — the streak breaks.
          tempStreak = 0;
        }
      }
      previousDate = pageDateObj;

      if (!p.file.tasks) {
        // No note at all on this day — the current streak ends here.
        tempStreak = 0;
        continue;
      }

      let found = false;
      let completed = false;
      for (let t of p.file.tasks) {
        if (!t.text || t.text.trim() === "") continue;
        const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
        if (!sec.includes("habit")) continue;
        if (cleanHabit(t.text) === habit) {
          found = true;
          completed = t.completed || t.status === "x";
          break;
        }
      }

      if (found && completed) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        currentStreak = tempStreak;
      } else {
        // habit absent on a logged day, or present but not done — the streak ends.
        tempStreak = 0;
      }
    }
    streakRows.push([habit, currentStreak + " days", longestStreak + " days"]);
  }

  // Streaks are computed over logged days only, and a logged day without the habit breaks the
  // run — so the number is only meaningful next to how many days it was computed from.
  dv.paragraph(`**Coverage**: streaks computed over ${pages.length} logged day(s); a logged day without the habit breaks the streak, and unlogged days end the current run`);
  dv.table(["Habit", "Current Streak", "Best Streak"], streakRows);
}
```

---

## 📊 Trend Analysis (7-Observation Moving Average)

Renamed from "7-Day": the average is taken over the last **seven logged days**, not seven
calendar days, so a gap stretches it further back than a week. Retained as an
observation-based view rather than converted, because that is the useful reading for a series
with missing days — but it is labelled for what it is, and the coverage line states how many
days actually back it.

```dataviewjs
const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/))
  .sort(p => p.file.name, "asc");

dv.paragraph(`**Coverage**: ${pages.length} logged day(s) form this series; the 7-observation average spans the last 7 of them, which may reach further back than 7 calendar days`);

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

## 🎯 Areas for Improvement (All logged days)

```dataviewjs
const cleanHabit = (text) => String(text || "")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ")
  .replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ")
  .replace(/\s*\^[A-Za-z0-9]+\s*$/, " ")
  .replace(/#[\w/-]+/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();

const pages = dv.pages('"01-Daily"')
  .where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/));

dv.paragraph(`**Coverage**: ${pages.length} logged day(s) in the vault; a habit absent on a logged day counts as not done, and days with no note are unknown rather than 0%`);

let habitStats = {};

for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (!sec.includes("habit")) continue;

    const name = cleanHabit(t.text);
    if (!name) continue;

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
