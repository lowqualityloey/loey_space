---
created: 2026-08-09
updated: 2026-09-02
type: dashboard
status: active
area: general
tags:
  - type/dashboard
  - area/general
---

# 🏠 Central Command Hub

> *Your Second Brain daily navigation, focus & habit command center.*

```dataviewjs
const todayStr = moment().format("YYYY-MM-DD");
const alerts = [];

// 1. Check Today's Daily Note & Habits
const dailyPages = dv.pages('"01-Daily"').where(p => p.file.name === todayStr);
if (dailyPages.length === 0) {
  alerts.push(`📅 **Today's daily note (${todayStr}) is not created yet.** Press \`Ctrl + P\` → \`QuickAdd: Create Daily Note\`.`);
} else {
  const todayNote = dailyPages[0];
  let habitTotal = 0;
  let habitDone = 0;
  if (todayNote.file.tasks) {
    for (let t of todayNote.file.tasks) {
      const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
      if (!sec.includes("habit")) continue;
      habitTotal++;
      if (t.completed || t.status === "x") habitDone++;
    }
  }
  if (habitTotal > 0 && habitDone < habitTotal) {
    const habitPercent = Math.round((habitDone / habitTotal) * 100);
    alerts.push(`🔁 **Daily Habits Incomplete**: ${habitDone}/${habitTotal} completed (${habitPercent}%).`);
  }
}

// 2. Check Open Captures in quick-capture-dump.md
let openCaptures = 0;
const dumpFile = app.vault.getAbstractFileByPath("00-Inbox/quick-capture-dump.md");
if (dumpFile) {
  const content = await app.vault.read(dumpFile);
  const lines = content.split("\n");
  let inTriaged = false;
  for (let line of lines) {
    if (line.startsWith("## ") && line.includes("Triaged")) {
      inTriaged = true;
      continue;
    }
    if (!inTriaged && /^\s*-\s+\S/.test(line) && !line.trim().startsWith("- [x]")) {
      const item = line.replace(/^\s*-\s+/, "").trim();
      if (item && !item.startsWith("[") && item !== "...") {
        openCaptures++;
      }
    }
  }
}

if (openCaptures > 0) {
  alerts.push(`📥 **${openCaptures} open capture(s)** in [[00-Inbox/quick-capture-dump|quick-capture-dump]]. Run \`QuickAdd: 🧹 Triage Sweep\` to file them.`);
}

// 3. Check Overdue Reviews in Concepts & Learning (90d / 30d cycle)
const overdue = dv.pages('"08-Concepts" or "04-Learning"')
  .where(p => !p.file.name.includes("MOC") && p.last_reviewed && p.review_cycle)
  .filter(p => {
    const days = parseInt(p.review_cycle) || 90;
    const diff = moment().diff(moment(p.last_reviewed), 'days');
    return diff > days;
  });

if (overdue.length > 0) {
  alerts.push(`💡 **${overdue.length} evergreen note(s) overdue for review**. Inspect them on [[00-Inbox/_Triage MOC|Triage MOC]].`);
}

// Render dynamic callout
if (alerts.length > 0) {
  let callout = `> [!WARNING] ⚡ Action Required\n`;
  for (let a of alerts) {
    callout += `> - ${a}\n`;
  }
  dv.paragraph(callout);
} else {
  dv.paragraph(`> [!NOTE] ✨ **All Caught Up!** Today's note is active, habits are complete, inbox is swept, and reviews are on track.`);
}
```

---

## ⚡ Quick Navigation

| Area | Hub Link | Purpose |
| :--- | :--- | :--- |
| 📥 **Inbox** | [[00-Inbox/_Inbox MOC\|Inbox MOC]] · [[00-Inbox/quick-capture-dump\|Quick Capture]] | Raw capture stream & triage processing |
| 📅 **Daily Logs** | [[01-Daily/_Daily MOC\|Daily MOC]] | Daily journal, habits, vitals & AI reflections |
| 📋 **Tasks Hub** | [[01-Daily/_Tasks MOC\|Tasks MOC]] · [[01-Daily/Tasks Kanban\|Tasks Kanban]] | Aggregated active tasks & drag-and-drop board |
| 🚀 **Projects** | [[02-Projects/_Projects MOC\|Projects MOC]] | Active software builds & project kanbans |
| 💻 **Dev Notes** | [[03-Dev/_Dev MOC\|Dev MOC]] | Code snippets, technical patterns & bug fixes |
| 📖 **Learning** | [[04-Learning/_Learning MOC\|Learning MOC]] | Active study notes, flashcards & courses |
| 🧘 **Personal** | [[05-Personal/_Personal MOC\|Personal MOC]] | Life admin, health, fitness, goals & lore |
| 📚 **Resources** | [[06-Resources/_Resources MOC\|Resources MOC]] | Reference guides, APIs, manuals & automation |
| 📊 **Reviews** | [[07-Reviews/_Reviews MOC\|Reviews MOC]] · [[07-Reviews/Habit Analytics Dashboard\|Habit Analytics]] | Weekly reviews, habit heatmap & retrospectives |
| 💡 **Concepts** | [[08-Concepts/_Concepts MOC\|Concepts MOC]] · [[00-Inbox/_Triage MOC\|Triage MOC]] | Evergreen mental models & spaced review |

---

## 🔁 Today's Habit Rituals

```dataviewjs
const todayStr = moment().format("YYYY-MM-DD");
const dailyPages = dv.pages('"01-Daily"').where(p => p.file.name === todayStr);

if (dailyPages.length === 0) {
  dv.paragraph(`*No daily note created for today (${todayStr}). Create today's note to start logging habits.*`);
} else {
  const todayNote = dailyPages[0];
  const habitTasks = [];
  
  if (todayNote.file.tasks) {
    for (let t of todayNote.file.tasks) {
      const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
      if (sec.includes("habit")) {
        habitTasks.push(t);
      }
    }
  }

  if (habitTasks.length > 0) {
    const done = habitTasks.filter(t => t.completed || t.status === "x").length;
    const total = habitTasks.length;
    const percent = Math.round((done / total) * 100);
    
    dv.paragraph(`**Completion**: ${done}/${total} habits completed (${percent}%)`);
    dv.taskList(habitTasks, false);
  } else {
    dv.paragraph("*No habits section found in today's daily note.*");
  }
}
```

---

## 📌 Daily Focus & Active Tasks

```dataviewjs
const todayStr = moment().format("YYYY-MM-DD");
const pages = dv.pages('"01-Daily" or "02-Projects"');
let inProgressTasks = [];
let priorityTasks = [];

for (let p of pages) {
  if (!p.file.tasks || p.file.name === "Tasks Kanban") continue;
  
  // For daily notes, only pull from TODAY's note to avoid historical clutter
  const isDaily = p.file.name.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isDaily && p.file.name !== todayStr) continue;

  for (let t of p.file.tasks) {
    if (!t.text || t.text.trim() === "") continue;
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (sec.includes("habit") || sec.includes("backlog") || sec.includes("archive")) continue;

    const fileName = p.file.name;
    const formattedText = `${t.text} ${dv.fileLink(p.file.path, false, fileName)}`;
    const taskObj = Object.assign({}, t, { text: formattedText });

    if (t.status === "/") {
      inProgressTasks.push(taskObj);
    } else if (t.status === " ") {
      if (t.text.includes("#priority/p0") || t.text.includes("#priority/p1") || t.text.includes("#priority/high") || isDaily) {
        priorityTasks.push(taskObj);
      }
    }
  }
}

dv.header(3, "🔄 Currently In Progress");
if (inProgressTasks.length > 0) dv.taskList(inProgressTasks, false);
else dv.paragraph("No tasks currently in progress.");

dv.header(3, "🎯 Today's Priority Focus");
if (priorityTasks.length > 0) dv.taskList(priorityTasks.slice(0, 8), false);
else dv.paragraph("No priority tasks pending.");
```

---

## 📥 Inbox & Quick Capture Status

```dataviewjs
// 1. Standalone inbox notes
const pages = dv.pages('"00-Inbox"').where(p => !p.file.name.includes("MOC") && !p.file.name.includes("quick-capture"));

// 2. Lines in quick-capture-dump.md
let captureItems = [];
const dumpFile = app.vault.getAbstractFileByPath("00-Inbox/quick-capture-dump.md");
if (dumpFile) {
  const content = await app.vault.read(dumpFile);
  const lines = content.split("\n");
  let inTriaged = false;
  for (let line of lines) {
    if (line.startsWith("## ") && line.includes("Triaged")) {
      inTriaged = true;
      continue;
    }
    if (!inTriaged && /^\s*-\s+\S/.test(line) && !line.trim().startsWith("- [x]")) {
      const item = line.replace(/^\s*-\s+/, "").trim();
      if (item && !item.startsWith("[") && item !== "...") {
        captureItems.push(item);
      }
    }
  }
}

if (pages.length === 0 && captureItems.length === 0) {
  dv.paragraph("🎉 **Inbox is clean!** No unprocessed notes or pending capture lines.");
} else {
  if (captureItems.length > 0) {
    dv.paragraph(`📝 **${captureItems.length} open line(s) in [[00-Inbox/quick-capture-dump.md|quick-capture-dump]]**:`);
    dv.list(captureItems.slice(0, 5).map(c => `\`${c}\``));
    if (captureItems.length > 5) {
      dv.paragraph(`*...and ${captureItems.length - 5} more in quick-capture-dump*`);
    }
  }
  
  if (pages.length > 0) {
    dv.paragraph(`📂 **${pages.length} unprocessed note file(s) in \`00-Inbox/\`**:`);
    dv.table(["Note", "Captured Date"], pages.map(p => [p.file.link, p.file.ctime]));
  }
}
```

---

## 🚀 Active Projects & Recent Work

### Active Projects
```dataview
TABLE status AS "Status", priority AS "Priority", file.mtime AS "Last Updated"
FROM "02-Projects"
WHERE !contains(file.name, "Kanban") AND !contains(file.name, "MOC") AND (status = "active" OR status = "in-progress" OR status = "planning")
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
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)", file.mtime AS "Updated"
FROM "01-Daily"
WHERE regexmatch("^\d{4}-\d{2}-\d{2}$", file.name)
SORT file.name DESC
LIMIT 5
```
