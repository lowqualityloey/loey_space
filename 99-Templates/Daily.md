---
created: <% tp.date.now("YYYY-MM-DD") %>
updated: <% tp.date.now("YYYY-MM-DD") %>
type: daily
status: active
area: general
notion_id: 
tags:
  - type/daily
  - area/general
mood: okay
energy: 3
sleep_hours: 7
---

# <% tp.date.now("dddd, MMMM D") %>

> Mood: calm | good | okay | tired | stressed | low
> Energy: 1–5
> Sleep: hours slept, e.g. 7 or 6.5

## ✨ Motivation
- 

## ↪ Carry Forward
<%*
let titleDate = window.moment(tp.file.title, "YYYY-MM-DD");
if (!titleDate.isValid()) {
  titleDate = window.moment(tp.date.now("YYYY-MM-DD"), "YYYY-MM-DD");
}
const yesterday = titleDate.subtract(1, "day").format("YYYY-MM-DD");
const yesterdayFile = app.vault.getAbstractFileByPath(`01-Daily/${yesterday}.md`);
let carried = [];

if (yesterdayFile) {
  const content = await app.vault.read(yesterdayFile);
  const lines = content.split("\n");
  let inTargetSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^##\s+.*(Tasks|Tomorrow Setup)/i.test(line)) {
      inTargetSection = true;
      continue;
    } else if (/^##\s+/.test(line)) {
      inTargetSection = false;
    }

    if (inTargetSection && /^\s*- \[ \]\s+/.test(line)) {
      const itemText = line.replace(/^\s*-\s*\[ \]\s*/, "").trim();
      if (itemText && itemText !== "[ ]" && !carried.includes(`- [ ] ${itemText}`)) {
        carried.push(`- [ ] ${itemText}`);
      }
    }
  }
}

if (carried.length > 0) {
  tR += carried.join("\n");
} else {
  tR += "- None";
}
-%>

## 🎯 Focus 3 (Daily Goals)
What 3 main outcomes would make today feel successful?
1. 
2. 
3. 

## ✅ Tasks
Things I need or want to get done today.
- [ ] 
- [ ] 
- [ ] 

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
- 

## 🌙 Tomorrow Setup
What I want to carry or prepare for tomorrow.
- [ ] 