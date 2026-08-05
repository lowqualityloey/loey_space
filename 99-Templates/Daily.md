---
created: <% tp.date.now("YYYY-MM-DD") %>
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
# <% tp.date.now("dddd, MMMM D, YYYY") %>

> [!INFO] 💡 Daily Properties Reference
> | Property | Allowed Options / Range | Example |
> | :--- | :--- | :--- |
> | **mood** | calm, good, okay, tired, stressed, low, focused, grateful, energized, productive, peaceful, overwhelmed, anxious, creative, restless, exhausted, unmotivated, reflective | `mood: good` |
> | **energy** | Scale 1 (lowest) to 5 (highest) | `energy: 4` |
> | **sleep_hours** | Hours slept (e.g. 7 or 6.5) | `sleep_hours: 7.5` |

> [!QUOTE] 💡 Daily Spark
> 

## ✅ Tasks
Things I need or want to get done today.
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

    if (/^##\s+.*(Tomorrow Setup|Tasks)/i.test(line)) {
      inTargetSection = true;
      continue;
    } else if (/^##\s+/.test(line)) {
      inTargetSection = false;
    }

    if (inTargetSection && /^\s*- \[ \]\s+/.test(line)) {
      const itemText = line.replace(/^\s*-\s*\[ \]\s*/, "").trim();
      if (itemText && itemText !== "[ ]" && itemText !== "..." && !carried.includes(`- [ ] ${itemText}`)) {
        carried.push(`- [ ] ${itemText}`);
      }
    }
  }
}

if (carried.length > 0) {
  tR += carried.join("\n") + "\n";
} else {
  tR += "- [ ] \n";
}
-%>

## 🔁 Habits
Daily basics (keep it flexible, not perfect).
- [ ] exercise
- [ ] meditate
- [ ] coding
- [ ] clean
- [ ] hydrate
- [ ] sleep

## 💻 Work / Study / Dev
Progress from today across coding, study, or problem-solving.
- Worked on:
- Learned:
- Challenges:

## 🎮 Leisure / Fun
What I played, watched, or enjoyed today.
- 

## 🧠 Notes / Thoughts
Anything on my mind — ideas, reflections, random thoughts.
- 

## ⚡ Small Wins
Something positive from today, even if small.
- 

## 🤖 AI Daily Summary

### Summary
- 

### AI Reflection
- 

## 🌙 Tomorrow Setup
What I want to carry or prepare for tomorrow.
- [ ] 