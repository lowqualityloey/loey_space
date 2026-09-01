---
created: 2026-08-09
updated: 2026-09-01
type: moc
status: active
area: tasks
cssclasses:
  - cards
tags:
  - type/moc
  - area/tasks
---

# 📋 Tasks MOC & History Dashboard

Central dashboard for active tasks, in-progress items, and completed task history across your daily notes and project Kanban boards.

> [!TIP] 📌 Dedicated Kanban Board View
> Prefer a multi-column visual board? Open the **[[01-Daily/Tasks Kanban|📋 Live Tasks Kanban Board]]**

---

> [!INFO] 💡 How Task Tracking Works
> - **Source of Truth**: Tasks stay inside your **Daily Notes (`01-Daily`)** and **Projects (`02-Projects`)**.
> - **Kanban Scope**: Only the **To Do**, **In Progress**, and **Review / Test** columns feed this dashboard. **Backlog** (not committed yet) and **Archive** (already finished) are excluded.
> - **Lane-Driven Status**: Card markers are set automatically from the lane — `To Do` → `[ ]`, `In Progress` / `Review / Test` → `[/]`, `Done` → `[x]` + `✅ date`.
> - **Habit Exclusion**: Routine checkboxes under `## 🔁 Habits` are strictly excluded.
> - **Source Links**: Each task is reformatted with a direct link to its source note (e.g., `task name [[note_name]]`).

---

## 🔄 Currently In Progress (`[/]`)

```dataviewjs
const todayStr = window.moment().format("YYYY-MM-DD");
let currentDailyDate = "";
for (const p of dv.pages('"01-Daily"')) {
  const m = p.file.name.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m || m[1] > todayStr) continue;
  if (m[1] > currentDailyDate) currentDailyDate = m[1];
}
const inScope = (p) => p.file.name !== "Tasks Kanban" && (!p.file.path.startsWith("01-Daily") ||
  (currentDailyDate !== "" && p.file.name.startsWith(currentDailyDate)));

function getTaskKey(txt) {
  return String(txt || "").toLowerCase().replace(/#priority\/[^\s]+/gi, "").replace(/\[\[[^\]]+\]\]/g, "").replace(/[^\w\s]/g, "").trim();
}

const pages = dv.pages('"02-Projects" or "01-Daily"');
let tasks = [];
let seen = new Set();

for (let p of pages) {
  if (!p.file.tasks || p.file.name === "Tasks Kanban") continue;
  if (!inScope(p)) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit") || sec.includes("backlog") || sec.includes("archive")) continue;
    if (t.parent !== undefined && t.parent !== null) continue;

    if (t.status === "/") {
      const key = getTaskKey(t.text);
      if (!seen.has(key)) {
        seen.add(key);
        tasks.push(t);
      }
    }
  }
}
if (tasks.length > 0) dv.taskList(tasks, true);
else dv.paragraph("No tasks currently in progress.");
```

---

## 📌 Active To-Dos (`[ ]`)

```dataviewjs
const todayStr = window.moment().format("YYYY-MM-DD");
let currentDailyDate = "";
for (const p of dv.pages('"01-Daily"')) {
  const m = p.file.name.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m || m[1] > todayStr) continue;
  if (m[1] > currentDailyDate) currentDailyDate = m[1];
}
const inScope = (p) => p.file.name !== "Tasks Kanban" && (!p.file.path.startsWith("01-Daily") ||
  (currentDailyDate !== "" && p.file.name.startsWith(currentDailyDate)));

function getPriorityRank(text) {
  if (/#priority\/(p0|urgent|high)/i.test(text)) return 0;
  if (/#priority\/(p1|medium)/i.test(text)) return 1;
  if (/#priority\/(p2|normal)/i.test(text)) return 2;
  if (/#priority\/(p3|low)/i.test(text)) return 3;
  return 4;
}

function getTaskKey(txt) {
  return String(txt || "").toLowerCase().replace(/#priority\/[^\s]+/gi, "").replace(/\[\[[^\]]+\]\]/g, "").replace(/[^\w\s]/g, "").trim();
}

const pages = dv.pages('"02-Projects" or "01-Daily"');
let tasks = [];
let seen = new Set();

for (let p of pages) {
  if (!p.file.tasks || p.file.name === "Tasks Kanban") continue;
  if (!inScope(p)) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit") || sec.includes("backlog") || sec.includes("archive")) continue;
    if (t.parent !== undefined && t.parent !== null) continue;

    if (t.status === " ") {
      const key = getTaskKey(t.text);
      if (!seen.has(key)) {
        seen.add(key);
        tasks.push(t);
      }
    }
  }
}

tasks.sort((a, b) => getPriorityRank(a.text) - getPriorityRank(b.text));

if (tasks.length > 0) dv.taskList(tasks, true);
else dv.paragraph("No active open tasks.");
```

---

## ✅ Recently Completed Tasks

```dataviewjs
const pages = dv.pages('"01-Daily" or "02-Projects"');
let tasks = [];

for (let p of pages) {
  if (!p.file.tasks || p.file.name === "Tasks Kanban") continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit")) continue;
    if (t.parent !== undefined && t.parent !== null) continue;

    if (t.completed || t.status === "x") {
      const fileName = p.file.name;
      const stamp = t.text.match(/✅\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
      const sortKey = stamp
        ? window.moment(
            stamp[1] + (stamp[2] ? " " + stamp[2] : ""),
            stamp[2] ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD"
          ).valueOf()
        : 0;

      let rawText = t.text.replace(/✅\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/g, (match, dateStr, timeStr) => {
        const m = window.moment(dateStr + (timeStr ? " " + timeStr : ""), timeStr ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD");
        if (!m.isValid()) return match;
        return "✅ " + (timeStr ? m.format("DD MMM YYYY, h:mm A") : m.format("DD MMM YYYY"));
      });

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

## 📊 Task Completion Analytics

```dataviewjs
const todayStr = window.moment().format("YYYY-MM-DD");
let currentDailyDate = "";
for (const p of dv.pages('"01-Daily"')) {
  const m = p.file.name.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m || m[1] > todayStr) continue;
  if (m[1] > currentDailyDate) currentDailyDate = m[1];
}
const inScope = (p) => p.file.name !== "Tasks Kanban" && (!p.file.path.startsWith("01-Daily") ||
  (currentDailyDate !== "" && p.file.name.startsWith(currentDailyDate)));

const pages = dv.pages('"01-Daily" or "02-Projects"');

let totalOpen = 0;
let totalDoing = 0;
let totalDone = 0;

for (let p of pages) {
  if (!p.file.tasks || p.file.name === "Tasks Kanban") continue;
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

const totalCommitted = totalOpen + totalDoing + totalDone;
const rate = totalCommitted > 0 ? Math.round((totalDone / totalCommitted) * 100) : 0;

dv.paragraph(`
- 📌 **Active Open Tasks**: **${totalOpen}**
- 🔄 **Currently In Progress**: **${totalDoing}**
- ✅ **Total Tasks Completed**: **${totalDone}**
- 📈 **All-Time Completion Ratio**: **${rate}%** (${totalDone}/${totalCommitted})
`);
```

---

## 📜 Daily Task History Log

```dataviewjs
const dailyPages = dv.pages('"01-Daily"').where(p => p.file.name.match(/^\d{4}-\d{2}-\d{2}$/));

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
