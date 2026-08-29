---
type: dashboard
status: active
area: general
tags:
  - type/dashboard
updated: 2026-08-11
---

# 🏠 Central Command Hub

> *Your Second Brain daily navigation & focus dashboard.*

```dataviewjs
const todayStr = moment().format("YYYY-MM-DD");
const alerts = [];

// 1. Check Today's Daily Note
const dailyPages = dv.pages('"01-Daily"').where(p => p.file.name === todayStr);
if (dailyPages.length === 0) {
  alerts.push(`📅 **Today's daily note (${todayStr}) is not created yet.** Press \`Ctrl + P\` → \`QuickAdd: Create Daily Note\`.`);
}

// 2. Check Overdue Reviews in Concepts & Learning
const overdue = dv.pages('"08-Concepts" or "04-Learning"')
  .where(p => !p.file.name.includes("MOC") && p.last_reviewed && p.review_cycle)
  .filter(p => {
    const days = parseInt(p.review_cycle) || 90;
    const diff = moment().diff(moment(p.last_reviewed), 'days');
    return diff > days;
  });

if (overdue.length > 0) {
  alerts.push(`💡 **${overdue.length} evergreen note(s) overdue for review**. Review them on [[00-Inbox/_Triage MOC|Triage MOC]].`);
}

// Render dynamic callout
if (alerts.length > 0) {
  let callout = `> [!WARNING] ⚡ Action Required\n`;
  for (let a of alerts) {
    callout += `> - ${a}\n`;
  }
  dv.paragraph(callout);
} else {
  dv.paragraph(`> [!NOTE] ✨ **All Caught Up!** Vault is in sync, habits and reviews are up to date.`);
}
```

---

## ⚡ Quick Navigation

| Area            | Hub Link                                       | Purpose                                        |
| :-------------- | :--------------------------------------------- | :--------------------------------------------- |
| 📅 Daily Logs   | [[01-Daily/_Daily MOC\|Daily MOC]]             | Daily journal, habits & reflections            |
| 📋 Tasks Hub    | [[01-Daily/_Tasks MOC\|Tasks MOC]] · [[01-Daily/Tasks Kanban\|Kanban]] | Active tasks, in-progress & drag-and-drop board |
| 🚀 Projects     | [[02-Projects/_Projects MOC\|Projects MOC]]    | Active development & project builds            |
| 💻 Dev Notes    | [[03-Dev/_Dev MOC\|Dev MOC]]                   | Code snippets & technical patterns             |
| 💡 Concepts     | [[08-Concepts/_Concepts MOC\|Concepts MOC]]    | Evergreen knowledge & technical concepts       |
| 📖 Learning     | [[04-Learning/_Learning MOC\|Learning MOC]]    | Courses & study notes                          |
| 📚 Resources    | [[06-Resources/_Resources MOC\|Resources MOC]] | Reference links & cheatsheets                  |
| 📥 Inbox        | [[00-Inbox/_Inbox MOC\|Inbox MOC]]             | Quick capture & inbox                          |
| 🧹 Triage       | [[00-Inbox/_Triage MOC\|Triage MOC]]           | Stale notes & overdue reviews                  |

---
## 📌 Daily Focus & Active Tasks

### 🔄 Currently In Progress
```dataviewjs
const pages = dv.pages('"01-Daily" or "02-Projects"');
let tasks = [];
for (let p of pages) {
  if (!p.file.tasks || p.file.name === "Tasks Kanban") continue;
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

### 📋 Priority To-Dos
```dataviewjs
const pages = dv.pages('"01-Daily" or "02-Projects"');
let tasks = [];
for (let p of pages) {
  if (!p.file.tasks || p.file.name === "Tasks Kanban") continue;
  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit")) continue;

    if (t.status === " ") {
      const fileName = p.file.name;
      const formattedText = `${t.text} ${dv.fileLink(p.file.path, false, fileName)}`;
      tasks.push(Object.assign({}, t, { text: formattedText }));
    }
  }
}
if (tasks.length > 0) dv.taskList(tasks.slice(0, 10), false);
else dv.paragraph("No active open tasks.");
```
---
## 🚀 Active Projects & Recent Work

### Active Projects
```dataview
TABLE status AS "Status", priority AS "Priority", file.mtime AS "Updated"
FROM "02-Projects"
WHERE !contains(file.name, "Kanban") AND !contains(file.name, "MOC")
SORT file.mtime DESC
LIMIT 5
```

### Recent Dev Snippets & Concepts
```dataview
TABLE language AS "Language / Category", file.mtime AS "Updated"
FROM "03-Dev" OR "08-Concepts"
WHERE !contains(file.name, "MOC")
SORT file.mtime DESC
LIMIT 5
```
---
## 📅 Daily Logs Overview

```dataview
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)"
FROM "01-Daily"
WHERE file.name != "_Daily MOC" AND file.name != "_Tasks MOC"
SORT file.name DESC
LIMIT 5
```

---
## 📥 Inbox Triage

```dataviewjs
const pages = dv.pages('"00-Inbox"').where(p => !p.file.name.includes("MOC") && !p.file.name.includes("quick-capture"));
if (pages.length > 0) {
  dv.table(["Note", "Captured Date"], pages.map(p => [p.file.link, p.file.ctime]));
} else {
  dv.paragraph("🎉 **Inbox is clean!** No unprocessed notes.");
}
```
