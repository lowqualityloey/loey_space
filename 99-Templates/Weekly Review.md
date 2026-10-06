---
created: <% tp.date.now("YYYY-MM-DD") %>
updated: <% tp.date.now("YYYY-MM-DD") %>
type: review
status: completed
area: reviews
tags:
  - type/review
  - area/reviews
  - status/completed
# Optional: pin this review to an explicit period. Declare BOTH or NEITHER —
# the statistics below prefer these two keys and otherwise read the ISO week out
# of the note's own name (`2026-W41` → 2026-10-05 to 2026-10-11).
# period_start: 2026-10-05
# period_end: 2026-10-11
---

# Weekly Review (<% tp.date.now("GGGG-[W]WW") %>)

> [!INFO] 📅 Which week these statistics cover
> Every number below is computed from **this review's own period**, never from the
> day you happen to open it: the ISO week in this note's name, or `period_start` /
> `period_end` from the frontmatter when they are declared. A review opened months
> later reports the week it was written for, and a review whose name is not
> `YYYY-Www` says so instead of showing empty statistics. The note's name uses
> `GGGG` (ISO week-year), not `YYYY`, so the week spanning New Year keeps its
> correct year: 2025-12-29 is `2026-W01`.

## 📊 Habit & Wellness Stats (Auto-Generated)

### Energy Average
```dataviewjs
// #59 period resolution — keep this block identical in every statistics block in
// this note; `tests/weekly-review-period.test.mjs` fails if they drift apart.
function isoDay(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[1] + "-" + match[2] + "-" + match[3] : null;
  }
  if (typeof value === "object") {
    // Luxon (Dataview's own date type), then Moment, then a plain Date. Each is
    // normalised to `YYYY-MM-DD` before anything is compared, because the two
    // libraries disagree about which of these are properties and which are
    // methods — reading `weekYear` off a Moment object yields a function.
    if (typeof value.toISODate === "function") {
      try { const out = isoDay(value.toISODate()); if (out) return out; } catch (error) {}
    }
    if (typeof value.format === "function") {
      try { const out = isoDay(value.format("YYYY-MM-DD")); if (out) return out; } catch (error) {}
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate());
    }
  }
  return null;
}

function isoWeekOf(name) {
  const match = String(name == null ? "" : name).match(/(?:^|[^0-9])(\d{4})-W(\d{2})(?!\d)/);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  // ISO week 1 is the week containing January 4th, so walk from that week's Monday.
  const jan4 = new Date(Number(match[1]), 0, 4);
  const monday = new Date(
    jan4.getFullYear(),
    jan4.getMonth(),
    jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7
  );
  return {
    start: key(monday),
    end: key(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)),
    source: "the note's name (" + match[1] + "-W" + match[2] + ")",
  };
}

function reviewPeriod(current) {
  const page = current || {};
  const start = isoDay(page.period_start);
  const end = isoDay(page.period_end);
  if (start && end && start <= end) {
    return { start: start, end: end, source: "this note's `period_start`/`period_end`" };
  }
  const named = isoWeekOf(page.file && page.file.name);
  if (named) return named;
  const singleDay = isoDay(page.file && page.file.day);
  if (singleDay) {
    return {
      start: singleDay,
      end: singleDay,
      singleDay: true,
      source: "`file.day` — a single day, not the week this note is named for",
    };
  }
  return null;
}

function periodLabel(period) {
  return period.start === period.end ? period.start : period.start + " to " + period.end;
}

function dailyNotesIn(period) {
  return dv.pages('"01-Daily"').where((page) => {
    const day = isoDay(page.file.day) || isoDay(page.file.name);
    return day !== null && day >= period.start && day <= period.end;
  });
}

function coverageLine(period, loggedDays) {
  const span = Math.round(
    (Date.parse(period.end + "T00:00:00Z") - Date.parse(period.start + "T00:00:00Z")) / 86400000
  ) + 1;
  const missing = span - loggedDays;
  const tail = missing === 0
    ? "every calendar day in the period has a daily note"
    : missing + " day(s) have no daily note, which is unknown rather than zero";
  return "**Coverage**: " + loggedDays + "/" + span + " calendar days logged (" +
    periodLabel(period) + ") — " + tail + ".";
}

const MISSING_PERIOD = "⚠️ **No review period.** This note declares no `period_start`/`period_end` " +
  "and its name carries no `YYYY-Www`, so there is no week to report on. Name the note for its " +
  "ISO week (for example `2026-W41`) or declare both `period_start` and `period_end` in the frontmatter — " +
  "until then this section stays empty on purpose rather than averaging the wrong days.";
// end #59 period resolution

const period = reviewPeriod(dv.current());
if (!period) {
  dv.paragraph(MISSING_PERIOD);
} else {
  const logged = dailyNotesIn(period);
  const values = logged.map((p) => Number(p.energy)).where((v) => !isNaN(v));
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : "—";
  dv.paragraph(`**Period**: ${periodLabel(period)} — ${period.source}.`);
  dv.paragraph(
    `⚡ Average energy: **${avg}** / 5${period.singleDay ? " (a single day, not a week)" : ""}`
  );
  dv.paragraph(coverageLine(period, logged.length));
}
```

### Sleep Average
```dataviewjs
// #59 period resolution — keep this block identical in every statistics block in
// this note; `tests/weekly-review-period.test.mjs` fails if they drift apart.
function isoDay(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[1] + "-" + match[2] + "-" + match[3] : null;
  }
  if (typeof value === "object") {
    // Luxon (Dataview's own date type), then Moment, then a plain Date. Each is
    // normalised to `YYYY-MM-DD` before anything is compared, because the two
    // libraries disagree about which of these are properties and which are
    // methods — reading `weekYear` off a Moment object yields a function.
    if (typeof value.toISODate === "function") {
      try { const out = isoDay(value.toISODate()); if (out) return out; } catch (error) {}
    }
    if (typeof value.format === "function") {
      try { const out = isoDay(value.format("YYYY-MM-DD")); if (out) return out; } catch (error) {}
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate());
    }
  }
  return null;
}

function isoWeekOf(name) {
  const match = String(name == null ? "" : name).match(/(?:^|[^0-9])(\d{4})-W(\d{2})(?!\d)/);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  // ISO week 1 is the week containing January 4th, so walk from that week's Monday.
  const jan4 = new Date(Number(match[1]), 0, 4);
  const monday = new Date(
    jan4.getFullYear(),
    jan4.getMonth(),
    jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7
  );
  return {
    start: key(monday),
    end: key(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)),
    source: "the note's name (" + match[1] + "-W" + match[2] + ")",
  };
}

function reviewPeriod(current) {
  const page = current || {};
  const start = isoDay(page.period_start);
  const end = isoDay(page.period_end);
  if (start && end && start <= end) {
    return { start: start, end: end, source: "this note's `period_start`/`period_end`" };
  }
  const named = isoWeekOf(page.file && page.file.name);
  if (named) return named;
  const singleDay = isoDay(page.file && page.file.day);
  if (singleDay) {
    return {
      start: singleDay,
      end: singleDay,
      singleDay: true,
      source: "`file.day` — a single day, not the week this note is named for",
    };
  }
  return null;
}

function periodLabel(period) {
  return period.start === period.end ? period.start : period.start + " to " + period.end;
}

function dailyNotesIn(period) {
  return dv.pages('"01-Daily"').where((page) => {
    const day = isoDay(page.file.day) || isoDay(page.file.name);
    return day !== null && day >= period.start && day <= period.end;
  });
}

function coverageLine(period, loggedDays) {
  const span = Math.round(
    (Date.parse(period.end + "T00:00:00Z") - Date.parse(period.start + "T00:00:00Z")) / 86400000
  ) + 1;
  const missing = span - loggedDays;
  const tail = missing === 0
    ? "every calendar day in the period has a daily note"
    : missing + " day(s) have no daily note, which is unknown rather than zero";
  return "**Coverage**: " + loggedDays + "/" + span + " calendar days logged (" +
    periodLabel(period) + ") — " + tail + ".";
}

const MISSING_PERIOD = "⚠️ **No review period.** This note declares no `period_start`/`period_end` " +
  "and its name carries no `YYYY-Www`, so there is no week to report on. Name the note for its " +
  "ISO week (for example `2026-W41`) or declare both `period_start` and `period_end` in the frontmatter — " +
  "until then this section stays empty on purpose rather than averaging the wrong days.";
// end #59 period resolution

const period = reviewPeriod(dv.current());
if (!period) {
  dv.paragraph(MISSING_PERIOD);
} else {
  const logged = dailyNotesIn(period);
  const values = logged.where((p) => p.sleep_hours != null).map((p) => Number(p.sleep_hours)).where((v) => !isNaN(v));
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : "—";
  dv.paragraph(`**Period**: ${periodLabel(period)} — ${period.source}.`);
  dv.paragraph(
    `😴 Average sleep: **${avg}** hours${period.singleDay ? " (a single day, not a week)" : ""}`
  );
  dv.paragraph(coverageLine(period, logged.length));
}
```

### Mood Distribution
```dataviewjs
// #59 period resolution — keep this block identical in every statistics block in
// this note; `tests/weekly-review-period.test.mjs` fails if they drift apart.
function isoDay(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[1] + "-" + match[2] + "-" + match[3] : null;
  }
  if (typeof value === "object") {
    // Luxon (Dataview's own date type), then Moment, then a plain Date. Each is
    // normalised to `YYYY-MM-DD` before anything is compared, because the two
    // libraries disagree about which of these are properties and which are
    // methods — reading `weekYear` off a Moment object yields a function.
    if (typeof value.toISODate === "function") {
      try { const out = isoDay(value.toISODate()); if (out) return out; } catch (error) {}
    }
    if (typeof value.format === "function") {
      try { const out = isoDay(value.format("YYYY-MM-DD")); if (out) return out; } catch (error) {}
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate());
    }
  }
  return null;
}

function isoWeekOf(name) {
  const match = String(name == null ? "" : name).match(/(?:^|[^0-9])(\d{4})-W(\d{2})(?!\d)/);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  // ISO week 1 is the week containing January 4th, so walk from that week's Monday.
  const jan4 = new Date(Number(match[1]), 0, 4);
  const monday = new Date(
    jan4.getFullYear(),
    jan4.getMonth(),
    jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7
  );
  return {
    start: key(monday),
    end: key(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)),
    source: "the note's name (" + match[1] + "-W" + match[2] + ")",
  };
}

function reviewPeriod(current) {
  const page = current || {};
  const start = isoDay(page.period_start);
  const end = isoDay(page.period_end);
  if (start && end && start <= end) {
    return { start: start, end: end, source: "this note's `period_start`/`period_end`" };
  }
  const named = isoWeekOf(page.file && page.file.name);
  if (named) return named;
  const singleDay = isoDay(page.file && page.file.day);
  if (singleDay) {
    return {
      start: singleDay,
      end: singleDay,
      singleDay: true,
      source: "`file.day` — a single day, not the week this note is named for",
    };
  }
  return null;
}

function periodLabel(period) {
  return period.start === period.end ? period.start : period.start + " to " + period.end;
}

function dailyNotesIn(period) {
  return dv.pages('"01-Daily"').where((page) => {
    const day = isoDay(page.file.day) || isoDay(page.file.name);
    return day !== null && day >= period.start && day <= period.end;
  });
}

function coverageLine(period, loggedDays) {
  const span = Math.round(
    (Date.parse(period.end + "T00:00:00Z") - Date.parse(period.start + "T00:00:00Z")) / 86400000
  ) + 1;
  const missing = span - loggedDays;
  const tail = missing === 0
    ? "every calendar day in the period has a daily note"
    : missing + " day(s) have no daily note, which is unknown rather than zero";
  return "**Coverage**: " + loggedDays + "/" + span + " calendar days logged (" +
    periodLabel(period) + ") — " + tail + ".";
}

const MISSING_PERIOD = "⚠️ **No review period.** This note declares no `period_start`/`period_end` " +
  "and its name carries no `YYYY-Www`, so there is no week to report on. Name the note for its " +
  "ISO week (for example `2026-W41`) or declare both `period_start` and `period_end` in the frontmatter — " +
  "until then this section stays empty on purpose rather than averaging the wrong days.";
// end #59 period resolution

const period = reviewPeriod(dv.current());
if (!period) {
  dv.paragraph(MISSING_PERIOD);
} else {
  const logged = dailyNotesIn(period);
  // Counted from the moods that were actually written. `Tagging & Properties.md`
  // calls `mood` "text, free-form from a suggested vocabulary", so a fixed list here
  // silently dropped every value it did not name — the shipped table listed six
  // words against a daily template that suggests eighteen, and four of the ten
  // moods recorded in this vault were not among the six.
  const counts = new Map();
  let recorded = 0;
  for (const page of logged) {
    if (page.mood == null) continue;
    const mood = String(page.mood).toLowerCase().trim();
    if (mood === "") continue;
    counts.set(mood, (counts.get(mood) || 0) + 1);
    recorded++;
  }
  dv.paragraph(`**Period**: ${periodLabel(period)} — ${period.source}.`);
  if (recorded === 0) {
    dv.paragraph("No moods were recorded in this period.");
  } else {
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    dv.table(["Mood", "Days"], rows);
    dv.paragraph(
      `${recorded} day(s) recorded a mood, across ${rows.length} distinct value(s) — every value written is counted, ` +
      `not only the ones the daily template suggests.`
    );
  }
  dv.paragraph(coverageLine(period, logged.length));
}
```

---

## 🎉 Completed Tasks This Week
```dataviewjs
// #59 period resolution — keep this block identical in every statistics block in
// this note; `tests/weekly-review-period.test.mjs` fails if they drift apart.
function isoDay(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[1] + "-" + match[2] + "-" + match[3] : null;
  }
  if (typeof value === "object") {
    // Luxon (Dataview's own date type), then Moment, then a plain Date. Each is
    // normalised to `YYYY-MM-DD` before anything is compared, because the two
    // libraries disagree about which of these are properties and which are
    // methods — reading `weekYear` off a Moment object yields a function.
    if (typeof value.toISODate === "function") {
      try { const out = isoDay(value.toISODate()); if (out) return out; } catch (error) {}
    }
    if (typeof value.format === "function") {
      try { const out = isoDay(value.format("YYYY-MM-DD")); if (out) return out; } catch (error) {}
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate());
    }
  }
  return null;
}

function isoWeekOf(name) {
  const match = String(name == null ? "" : name).match(/(?:^|[^0-9])(\d{4})-W(\d{2})(?!\d)/);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  // ISO week 1 is the week containing January 4th, so walk from that week's Monday.
  const jan4 = new Date(Number(match[1]), 0, 4);
  const monday = new Date(
    jan4.getFullYear(),
    jan4.getMonth(),
    jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7
  );
  return {
    start: key(monday),
    end: key(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)),
    source: "the note's name (" + match[1] + "-W" + match[2] + ")",
  };
}

function reviewPeriod(current) {
  const page = current || {};
  const start = isoDay(page.period_start);
  const end = isoDay(page.period_end);
  if (start && end && start <= end) {
    return { start: start, end: end, source: "this note's `period_start`/`period_end`" };
  }
  const named = isoWeekOf(page.file && page.file.name);
  if (named) return named;
  const singleDay = isoDay(page.file && page.file.day);
  if (singleDay) {
    return {
      start: singleDay,
      end: singleDay,
      singleDay: true,
      source: "`file.day` — a single day, not the week this note is named for",
    };
  }
  return null;
}

function periodLabel(period) {
  return period.start === period.end ? period.start : period.start + " to " + period.end;
}

function dailyNotesIn(period) {
  return dv.pages('"01-Daily"').where((page) => {
    const day = isoDay(page.file.day) || isoDay(page.file.name);
    return day !== null && day >= period.start && day <= period.end;
  });
}

function coverageLine(period, loggedDays) {
  const span = Math.round(
    (Date.parse(period.end + "T00:00:00Z") - Date.parse(period.start + "T00:00:00Z")) / 86400000
  ) + 1;
  const missing = span - loggedDays;
  const tail = missing === 0
    ? "every calendar day in the period has a daily note"
    : missing + " day(s) have no daily note, which is unknown rather than zero";
  return "**Coverage**: " + loggedDays + "/" + span + " calendar days logged (" +
    periodLabel(period) + ") — " + tail + ".";
}

const MISSING_PERIOD = "⚠️ **No review period.** This note declares no `period_start`/`period_end` " +
  "and its name carries no `YYYY-Www`, so there is no week to report on. Name the note for its " +
  "ISO week (for example `2026-W41`) or declare both `period_start` and `period_end` in the frontmatter — " +
  "until then this section stays empty on purpose rather than averaging the wrong days.";
// end #59 period resolution

const period = reviewPeriod(dv.current());
if (!period) {
  dv.paragraph(MISSING_PERIOD);
} else {
  const inside = (day) => day !== null && day >= period.start && day <= period.end;
  const dated = [];
  const byFileTouch = [];
  for (const page of dv.pages('"01-Daily" or "02-Projects" or "04-Learning"')) {
    const touched = isoDay(page.file.mtime) || isoDay(page.file.ctime);
    for (const task of page.file.tasks || []) {
      if (!task.completed) continue;
      const done = isoDay(task.completion) || isoDay(task.completionDate);
      if (done !== null) { if (inside(done)) dated.push(task); }
      else if (inside(touched)) byFileTouch.push(task);
    }
  }
  dv.paragraph(`**Period**: ${periodLabel(period)} — ${period.source}.`);
  if (dated.length === 0 && byFileTouch.length === 0) {
    dv.paragraph("No task completions are recorded inside this period.");
  } else {
    dv.table(
      ["Completed task", "Completed", "Source note"],
      dated.map((t) => [t.text, isoDay(t.completion) || isoDay(t.completionDate) || "—", t.path])
        .concat(byFileTouch.map((t) => [t.text, "no completion date (file touched in the period)", t.path]))
    );
    if (byFileTouch.length > 0) {
      dv.paragraph(
        `${byFileTouch.length} of these carry no completion date and were placed by their file's ` +
        `last modification instead — the same weaker route the query this replaced used for every task.`
      );
    }
  }
}
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
// Deliberately relative to today, unlike every statistic above: "due for review" is
// a question about now, not about the week this note covers. A historical review
// SHOULD show the projects that were overdue the day it was read.
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
```dataviewjs
// #59 period resolution — keep this block identical in every statistics block in
// this note; `tests/weekly-review-period.test.mjs` fails if they drift apart.
function isoDay(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[1] + "-" + match[2] + "-" + match[3] : null;
  }
  if (typeof value === "object") {
    // Luxon (Dataview's own date type), then Moment, then a plain Date. Each is
    // normalised to `YYYY-MM-DD` before anything is compared, because the two
    // libraries disagree about which of these are properties and which are
    // methods — reading `weekYear` off a Moment object yields a function.
    if (typeof value.toISODate === "function") {
      try { const out = isoDay(value.toISODate()); if (out) return out; } catch (error) {}
    }
    if (typeof value.format === "function") {
      try { const out = isoDay(value.format("YYYY-MM-DD")); if (out) return out; } catch (error) {}
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate());
    }
  }
  return null;
}

function isoWeekOf(name) {
  const match = String(name == null ? "" : name).match(/(?:^|[^0-9])(\d{4})-W(\d{2})(?!\d)/);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  // ISO week 1 is the week containing January 4th, so walk from that week's Monday.
  const jan4 = new Date(Number(match[1]), 0, 4);
  const monday = new Date(
    jan4.getFullYear(),
    jan4.getMonth(),
    jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7
  );
  return {
    start: key(monday),
    end: key(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)),
    source: "the note's name (" + match[1] + "-W" + match[2] + ")",
  };
}

function reviewPeriod(current) {
  const page = current || {};
  const start = isoDay(page.period_start);
  const end = isoDay(page.period_end);
  if (start && end && start <= end) {
    return { start: start, end: end, source: "this note's `period_start`/`period_end`" };
  }
  const named = isoWeekOf(page.file && page.file.name);
  if (named) return named;
  const singleDay = isoDay(page.file && page.file.day);
  if (singleDay) {
    return {
      start: singleDay,
      end: singleDay,
      singleDay: true,
      source: "`file.day` — a single day, not the week this note is named for",
    };
  }
  return null;
}

function periodLabel(period) {
  return period.start === period.end ? period.start : period.start + " to " + period.end;
}

function dailyNotesIn(period) {
  return dv.pages('"01-Daily"').where((page) => {
    const day = isoDay(page.file.day) || isoDay(page.file.name);
    return day !== null && day >= period.start && day <= period.end;
  });
}

function coverageLine(period, loggedDays) {
  const span = Math.round(
    (Date.parse(period.end + "T00:00:00Z") - Date.parse(period.start + "T00:00:00Z")) / 86400000
  ) + 1;
  const missing = span - loggedDays;
  const tail = missing === 0
    ? "every calendar day in the period has a daily note"
    : missing + " day(s) have no daily note, which is unknown rather than zero";
  return "**Coverage**: " + loggedDays + "/" + span + " calendar days logged (" +
    periodLabel(period) + ") — " + tail + ".";
}

const MISSING_PERIOD = "⚠️ **No review period.** This note declares no `period_start`/`period_end` " +
  "and its name carries no `YYYY-Www`, so there is no week to report on. Name the note for its " +
  "ISO week (for example `2026-W41`) or declare both `period_start` and `period_end` in the frontmatter — " +
  "until then this section stays empty on purpose rather than averaging the wrong days.";
// end #59 period resolution

const period = reviewPeriod(dv.current());
if (!period) {
  dv.paragraph(MISSING_PERIOD);
} else {
  const notes = dv.pages('"04-Learning"').where((p) => {
    const created = isoDay(p.created) || isoDay(p.file.ctime);
    return created !== null && created >= period.start && created <= period.end;
  });
  dv.paragraph(`**Period**: ${periodLabel(period)} — ${period.source}.`);
  if (notes.length === 0) {
    dv.paragraph("No learning notes were added inside this period.");
  } else {
    dv.table(
      ["Note", "Topic", "Status"],
      notes.map((p) => [p.file.link, p.topic != null ? p.topic : "—", p.status != null ? p.status : "—"])
    );
    dv.paragraph(`${notes.length} note(s) added in this period.`);
  }
}
```

---

## 💡 Weekly Reflection

### 🌟 What went well?
- 

### 🛑 What was challenging or needs adjustment?
- 

### 🎯 Key Focus for Next Week
- 
