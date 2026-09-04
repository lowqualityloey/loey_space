---
created: <% tp.date.now("YYYY-MM-DD", 0, tp.file.title, "YYYY-MM-DD") %>
updated: <% tp.date.now("YYYY-MM-DD") %>
type: daily
area: personal
mood: 
energy: 
sleep_hours: 
tags:
  - type/daily
  - area/personal
---
# <% tp.date.now("dddd, MMMM D, YYYY", 0, tp.file.title, "YYYY-MM-DD") %>

> [!INFO] 💡 Daily Properties Reference
> | Property | Allowed Options / Range | Example |
> | :--- | :--- | :--- |
> | **mood** | calm, good, okay, tired, stressed, low, focused, grateful, energized, productive, peaceful, overwhelmed, anxious, creative, restless, exhausted, unmotivated, reflective | `mood: good` |
> | **energy** | Scale 1 (lowest) to 5 (highest) | `energy: 4` |
> | **sleep_hours** | Hours slept (e.g. 7 or 6.5) | `sleep_hours: 7.5` |

> [!QUOTE] 💡 Daily Spark
> 

### 🎯 Today's Focus
> _What's the 1-3 things I want to accomplish today?_


### ✅ Tasks
>*Things I need or want to get done today.*
<%*
let titleDate = window.moment(tp.file.title.substring(0, 10), "YYYY-MM-DD");
if (!titleDate.isValid()) {
  titleDate = window.moment(tp.date.now("YYYY-MM-DD"), "YYYY-MM-DD");
}
const currentDateStr = titleDate.format("YYYY-MM-DD");

// Find all daily files in 01-Daily/ except _Daily MOC and active file
const dailyFiles = app.vault.getMarkdownFiles()
  .filter(f => f.path.startsWith("01-Daily/") && !f.name.startsWith("_") && f.name !== tp.file.title + ".md");

// Match most recent previous daily note (date < currentDateStr)
let prevFile = null;
let latestPrevDate = "";

for (const file of dailyFiles) {
  const match = file.name.match(/^(\d{4}-\d{2}-\d{2})/);
  const fileDate = match ? match[1] : null;
  if (fileDate && fileDate < currentDateStr && fileDate > latestPrevDate) {
    latestPrevDate = fileDate;
    prevFile = file;
  }
}

let carried = [];

if (prevFile) {
  const content = await app.vault.read(prevFile);
  const lines = content.split("\n");
  let inTargetSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Accepts ## or ### headings — the Tasks heading is "### ✅ Tasks", so an
    // h2-only pattern silently carried nothing forward.
    if (/^#{2,3}\s+.*(Tomorrow Setup|Tasks)/i.test(line)) {
      inTargetSection = true;
      continue;
    } else if (/^#{2,3}\s+/.test(line)) {
      inTargetSection = false;
    }

    if (inTargetSection && /^\s*- \[ \]\s+/.test(line)) {
      const itemText = line.replace(/^\s*-\s*\[ \]\s*/, "").trim();
      if (itemText && itemText !== "[ ]" && itemText !== "..." && !carried.includes(`- [ ] ${itemText}`)) {
        carried.push(`- [ ] ${itemText}`);
      }
    }
  }

  // Mark the carried tasks in the previous note as forwarded ([>]) so the same
  // task is never open in two notes at once. Without this, every carry-over
  // duplicates the task in the Open Tasks widget, _Tasks MOC and the analytics.
  // The old note still records that the work moved on instead of vanishing.
  if (carried.length > 0) {
    const updatedLines = [];
    let inForwardSection = false;
    let didForward = false;

    for (const line of lines) {
      if (/^#{2,3}\s+.*(Tomorrow Setup|Tasks)/i.test(line)) {
        inForwardSection = true;
        updatedLines.push(line);
        continue;
      } else if (/^#{2,3}\s+/.test(line)) {
        inForwardSection = false;
      }

      // Only real tasks are forwarded; the empty "- [ ]" placeholder is left alone.
      if (inForwardSection && /^\s*- \[ \]\s+\S/.test(line)) {
        updatedLines.push(line.replace(/^(\s*-\s*)\[ \]/, "$1[>]"));
        didForward = true;
        continue;
      }

      updatedLines.push(line);
    }

    if (didForward) await app.vault.modify(prevFile, updatedLines.join("\n"));
  }
}

if (carried.length > 0) {
  tR += carried.join("\n") + "\n";
} else {
  tR += "- [ ] \n";
}
-%>

#### 🎯 In Progress from Projects
> _Live from your project boards._

```dataviewjs
// Shows project cards that are in progress (on today's note only), plus any completed on this note's
// date so a task you tick stays visible as done. Tasks are pushed unmodified so
// their checkboxes still write back to the Kanban card.
const noteDate = String(dv.current() && dv.current().file ? dv.current().file.name : "").slice(0, 10);
const todayStr = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().slice(0, 10);
const isToday = noteDate === todayStr;
const tasks = [];

for (const page of dv.pages('"02-Projects"')) {
  if (!page.file.tasks) continue;
  for (const t of page.file.tasks) {
    if (!t.text || !t.text.trim()) continue;

    const section = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    if (section.includes("backlog") || section.includes("archive")) continue;
    if (t.parent !== undefined && t.parent !== null) continue;

    const inProgress = isToday && t.status === "/";
    const hasSubtaskFinishedToday = Boolean(
      noteDate &&
      t.children &&
      t.children.some(c => c.text && c.text.includes("✅ " + noteDate))
    );
    const finishedToday = ((t.completed || t.status === "x") && noteDate && t.text.includes("✅ " + noteDate)) || hasSubtaskFinishedToday;

    if (inProgress || finishedToday) tasks.push(t);
  }
}

// Class hook for the CSS snippet that renders [/] as an empty checkbox here.
dv.container.addClass("project-task-mirror");

if (tasks.length > 0) dv.taskList(tasks, false);
else dv.paragraph("No project tasks in progress.");
```

---
### 🔁 Habits
> _Daily rituals I'm building. Track consistency, not perfection._
- [ ] water
- [ ] prioritised
- [ ] move
- [ ] read
- [ ] tidy
- [ ] disconnect

## 📝 Daily Log
> _A running timestamp of what happened today._
- 

---

## 🌇 End of the Day...

### Wins
> *Something positive from today, even if small.*
- 

### Blockers
> _What got in my way? Distractions, low energy, unclear priorities, external delays?_
- 

### Reflection
> _What did I learn? What could I have done better? What surprised me today?_
- 

### 💡 Ideas & Fleeting Notes
> _Spark: What random idea popped into my head today?_
- 

---

## 🤖 AI Daily Summary

### 📖 Daily Debrief
> _What did I do today? The day's story and key outcomes._

- 

### 🧠 Chief of Staff Takeaway
> _What's the high-signal lesson, pattern, or blind spot from today?_

- 

### 🎯 Tomorrow's Move
> _Based on today, what's the smartest priority to tackle first?_

- 


---
##### 🔗 Connected Notes
- [[ ]]