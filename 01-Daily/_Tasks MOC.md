---
type: moc
cssclasses:
  - cards
tags:
  - type/moc
  - area/tasks
updated: 2026-08-06
---

# 📋 Tasks MOC & History Dashboard

Central dashboard for tracking active tasks, in-progress items, and completed task history across your daily notes and projects.

---

> [!INFO] 💡 How Task Tracking Works
> - **Source of Truth**: Tasks stay inside your **Daily Notes (`01-Daily`)** and **Projects (`02-Projects`)**.
> - **Habit Exclusion**: Routine checkboxes under `## 🔁 Habits` are strictly excluded.
> - **Source Links**: Each task is reformatted with a direct link to its source note (e.g., `task name [[note_name]]`).

---

## 🔄 Currently In Progress (`[/]`)

```dataviewjs
const pages = dv.pages('"01-Daily" or "02-Projects"');
let tasks = [];
for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit")) continue;

    if (t.status === "/") {
      const fileName = p.file.name;
      const formattedText = `${t.text} ${dv.fileLink(p.file.path, false, fileName)}`;
      tasks.push(Object.assign({}, t, { text: formattedText }));
    }
  }
}
if (tasks.length > 0) dv.taskList(tasks, false);
else dv.paragraph("No tasks currently in progress.");
```

---

## 📌 Active To-Dos (`[ ]`)

```dataviewjs
const pages = dv.pages('"01-Daily" or "02-Projects"');
let tasks = [];
for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit")) continue;
    // Exclude tasks under Backlog, Done, and Archive sections in project kanbans
    if (sec.includes("backlog") || sec.includes("archive")) continue;

    if (t.status === " ") {
      const fileName = p.file.name;
      const formattedText = `${t.text} ${dv.fileLink(p.file.path, false, fileName)}`;
      tasks.push(Object.assign({}, t, { text: formattedText }));
    }
  }
}
if (tasks.length > 0) dv.taskList(tasks, false);
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
      let rawText = t.text;

      // Reformat ISO completion date ✅ 2026-08-08 -> ✅ 08 Aug 2026, 3:00 PM
      rawText = rawText.replace(/✅\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/g, (match, dateStr, timeStr) => {
        const m = window.moment(dateStr + (timeStr ? " " + timeStr : ""), timeStr ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD");
        if (m.isValid()) {
          return "✅ " + m.format("DD MMM YYYY, h:mm A");
        }
        return match;
      });

      const formattedText = `${rawText} ${dv.fileLink(p.file.path, false, fileName)}`;
      tasks.push(Object.assign({}, t, { text: formattedText }));
    }
  }
}
tasks.sort((a, b) => b.line - a.line);
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
const pages = dv.pages('"01-Daily" or "02-Projects"');

let totalOpen = 0;
let totalDoing = 0;
let totalDone = 0;

for (let p of pages) {
  if (!p.file.tasks) continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    if (t.header && t.header.subpath && t.header.subpath.toLowerCase().includes("habit")) continue;

    if (t.status === " ") totalOpen++;
    else if (t.status === "/") totalDoing++;
    else if (t.completed || t.status === "x") totalDone++;
  }
}

dv.paragraph(`
- 📌 **Active Open Tasks**: **${totalOpen}**
- 🔄 **Currently In Progress**: **${totalDoing}**
- ✅ **Total Tasks Completed**: **${totalDone}**
`);
```
