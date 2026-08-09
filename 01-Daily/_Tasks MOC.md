---
type: moc
cssclasses:
  - cards
tags:
  - type/moc
  - area/tasks
updated: 2026-08-10
---

# 📋 Tasks MOC & History Dashboard

Central dashboard for active tasks, in-progress items, and completed task history across your daily notes and project Kanban boards.

---

> [!INFO] 💡 How Task Tracking Works
> - **Source of Truth**: Tasks stay inside your **Daily Notes (`01-Daily`)** and **Projects (`02-Projects`)**.
> - **Kanban Scope**: Only the **To Do**, **In Progress**, and **Review / Test** columns feed this dashboard. **Backlog** (not committed yet) and **Archive** (already finished) are excluded.
> - **Lane-Driven Status**: Card markers are set automatically from the lane — `To Do` → `[ ]`, `In Progress` / `Review / Test` → `[/]`, `Done` → `[x]` + `✅ date`. Drag the card; don't edit the checkbox by hand.
> - **Habit Exclusion**: Routine checkboxes under `## 🔁 Habits` are strictly excluded.
> - **Source Links**: Each task is reformatted with a direct link to its source note (e.g., `task name [[note_name]]`).

---

## 🔄 Currently In Progress (`[/]`)
```dataviewjs
// Daily tasks are scoped to the current daily note (today, or the most recent
// day before today). Unfinished tasks are carried forward, so older notes hold
// the same text and would otherwise be listed twice. Project tasks are not
// date-scoped — a board card is open until the card itself moves.
const todayStr = window.moment().format("YYYY-MM-DD");
let currentDailyDate = "";
for (const p of dv.pages('"01-Daily"')) {
  const m = p.file.name.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m || m[1] > todayStr) continue;
  if (m[1] > currentDailyDate) currentDailyDate = m[1];
}
const inScope = (p) => !p.file.path.startsWith("01-Daily") ||
  (currentDailyDate !== "" && p.file.name.startsWith(currentDailyDate));

const pages = dv.pages('"01-Daily" or "02-Projects"');
let tasks = [];
for (let p of pages) {
  if (!p.file.tasks) continue;
  if (!inScope(p)) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit")) continue;

    // Push the task unchanged. Rewriting t.text (e.g. appending a file link)
    // breaks Dataview's write-back, leaving checkboxes that look clickable but
    // never update the source note. Grouping by file gives the same source
    // attribution while keeping the checkbox live.
    if (t.status === "/") {
      tasks.push(t);
    }
  }
}
if (tasks.length > 0) dv.taskList(tasks, true);
else dv.paragraph("No tasks currently in progress.");
```

---

## 📌 Active To-Dos (`[ ]`)
```dataviewjs
// Same date scoping as the In Progress list above: only the current daily note
// contributes, so carried-forward tasks are not counted twice.
const todayStr = window.moment().format("YYYY-MM-DD");
let currentDailyDate = "";
for (const p of dv.pages('"01-Daily"')) {
  const m = p.file.name.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m || m[1] > todayStr) continue;
  if (m[1] > currentDailyDate) currentDailyDate = m[1];
}
const inScope = (p) => !p.file.path.startsWith("01-Daily") ||
  (currentDailyDate !== "" && p.file.name.startsWith(currentDailyDate));

const pages = dv.pages('"01-Daily" or "02-Projects"');
let tasks = [];
for (let p of pages) {
  if (!p.file.tasks) continue;
  if (!inScope(p)) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit")) continue;
    // Exclude tasks under Backlog, Done, and Archive sections in project kanbans
    if (sec.includes("backlog") || sec.includes("archive")) continue;

    // Unmodified task objects keep the checkbox write-back working; grouping by
    // file supplies the source note instead.
    if (t.status === " ") {
      tasks.push(t);
    }
  }
}
if (tasks.length > 0) dv.taskList(tasks, true);
else dv.paragraph("No active open tasks.");
```

---

## ✅ Recently Completed Tasks

```dataviewjs
const pages = dv.pages('"01-Daily" or "02-Projects"');
let tasks = [];

for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit")) continue;

    if (t.completed || t.status === "x") {
      const fileName = p.file.name;

      // Sort by when the work was actually finished, newest first.
      const stamp = t.text.match(/✅\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
      const sortKey = stamp
        ? window.moment(
            stamp[1] + (stamp[2] ? " " + stamp[2] : ""),
            stamp[2] ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD"
          ).valueOf()
        : 0;

      // Reformat the ✅ stamp for reading. A bare date carries no time, so only
      // add a clock when the stamp actually has one — formatting a date-only
      // value with "h:mm A" is what made every row read "12:00 AM".
      let rawText = t.text.replace(/✅\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/g, (match, dateStr, timeStr) => {
        const m = window.moment(dateStr + (timeStr ? " " + timeStr : ""), timeStr ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD");
        if (!m.isValid()) return match;
        return "✅ " + (timeStr ? m.format("DD MMM YYYY, h:mm A") : m.format("DD MMM YYYY"));
      });

      // Drop block ids — they add noise and never read as useful.
      rawText = rawText.replace(/\s*\^[A-Za-z0-9-]+\s*$/, "").trim();

      const formattedText = `${rawText} ${dv.fileLink(p.file.path, false, fileName)}`;
      tasks.push(Object.assign({}, t, { text: formattedText, sortKey: sortKey }));
    }
  }
}

tasks.sort((a, b) => (b.sortKey - a.sortKey) || (b.line - a.line));
if (tasks.length > 0) dv.taskList(tasks.slice(0, 15), false);
else dv.paragraph("No completed tasks yet.");
```

---

## 📜 Daily Task History Log

```dataviewjs
const dailyPages = dv.pages('"01-Daily"').where(p => p.file.name !== "_Daily MOC" && p.file.name !== "_Tasks MOC");

const rows = [];
for (let p of dailyPages) {
  if (!p.file.tasks || p.file.tasks.length === 0) continue;

  let doneCount = 0;
  let openCount = 0;

  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    if (t.header && t.header.subpath && t.header.subpath.toLowerCase().includes("habit")) continue;

    if (t.completed || t.status === "x") doneCount++;
    else if (t.status === " " || t.status === "/") openCount++;
  }

  if (doneCount > 0 || openCount > 0) {
    rows.push([p.file.link, openCount, doneCount]);
  }
}

rows.sort((a, b) => b[0].path.localeCompare(a[0].path));
dv.table(["Daily Note", "Open Tasks", "Completed Tasks"], rows.slice(0, 20));
```

---

## 📊 Task Completion Analytics

```dataviewjs
// Open and in-progress counts use only the current daily note, so carried-forward
// tasks are counted once. Completed totals stay all-time — that is the history.
const todayStr = window.moment().format("YYYY-MM-DD");
let currentDailyDate = "";
for (const p of dv.pages('"01-Daily"')) {
  const m = p.file.name.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m || m[1] > todayStr) continue;
  if (m[1] > currentDailyDate) currentDailyDate = m[1];
}
const inScope = (p) => !p.file.path.startsWith("01-Daily") ||
  (currentDailyDate !== "" && p.file.name.startsWith(currentDailyDate));

const pages = dv.pages('"01-Daily" or "02-Projects"');

let totalOpen = 0;
let totalDoing = 0;
let totalDone = 0;

for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    if (t.header && t.header.subpath && t.header.subpath.toLowerCase().includes("habit")) continue;

    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    const counted = inScope(p) && !sec.includes("backlog") && !sec.includes("archive");

    if (t.completed || t.status === "x") totalDone++;
    else if (!counted) continue;
    else if (t.status === " ") totalOpen++;
    else if (t.status === "/") totalDoing++;
  }
}

dv.paragraph(`
- 📌 **Active Open Tasks**: **${totalOpen}**
- 🔄 **Currently In Progress**: **${totalDoing}**
- ✅ **Total Tasks Completed**: **${totalDone}**
`);
```
