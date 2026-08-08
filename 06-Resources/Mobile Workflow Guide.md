---
created: 2026-08-09
updated: 2026-08-09
type: guide
status: active
area: system
tags:
  - type/guide
  - area/system
  - topic/mobile
---

# 📱 Mobile Workflow Guide

> Quick capture on the go — process on desktop

---

## 🎯 Mobile Capture Philosophy

**Mobile = Capture fast, don't organize.**
**Desktop = Triage, organize, enrich.**

The mobile workflow is designed for speed. Every capture lands in the inbox with a `📱` marker and `source/mobile` tag so you can batch-process them on desktop.

---

## 📲 Setup (One-Time)

### 1. Install Obsidian Mobile
- Download from [App Store](https://apps.apple.com/app/obsidian/id1557175442) or [Google Play](https://play.google.com/store/apps/details?id=md.obsidian)
- Open the same vault (sync via OneDrive, iCloud, or Obsidian Sync)

### 2. Enable Required Plugins
Go to **Settings → Community Plugins** and ensure these are enabled:
- **QuickAdd** — Powers all mobile capture commands
- **Templater** — Template variable expansion

### 3. Add Mobile Toolbar Shortcuts
Go to **Settings → Mobile → Manage toolbar**. Add these QuickAdd commands:
1. `📱 Mobile Capture` — General quick capture
2. `📱 Mobile Task` — Capture as a to-do
3. `📱 Mobile Add to Daily` — Add task to today's daily note

---

## 🚀 Mobile Capture Commands

### 📱 Mobile Capture (General)
**Use for**: Random thoughts, links, snippets, anything
**What it does**: Appends to `00-Inbox/quick-capture-dump.md` with timestamp
**Format**: `- 📱 your text (2026-08-09 14:30)`
**Opens file**: No (stays where you are)

### 📱 Mobile Task
**Use for**: Tasks you think of on the go
**What it does**: Appends as a checkbox to inbox
**Format**: `- [ ] 📱 your task (2026-08-09 14:30)`
**Opens file**: No

### 📱 Mobile Idea
**Use for**: Ideas worth expanding later
**What it does**: Creates a new note in `00-Inbox/` from Mobile Idea template
**Format**: Structured note with title, idea section, related links
**Opens file**: No (capture and move on)

### 📱 Mobile Add to Daily
**Use for**: Tasks for today specifically
**What it does**: Adds a task to today's daily note under `### ✅ Tasks`
**Format**: `- [ ] your task`
**Opens file**: No (instant capture)

---

## 📋 Mobile Capture Workflow

### On Mobile (capture)
```
See/think something → Open Obsidian → Tap 📱 command → Type → Done
```
Total time: **< 10 seconds**

### On Desktop (process)
1. Open `00-Inbox/quick-capture-dump.md`
2. Review items marked with `📱`
3. Triage each: move to project, create full note, or delete
4. Use `99-Templates/Triage.md` for complex items

---

## 🏷️ How Mobile Captures Are Tagged

All mobile captures include:
- **`source/mobile`** tag — Filter these in Dataview queries
- **`📱` prefix** — Visual indicator in the inbox
- **Timestamp** — Know exactly when you captured it

### Find All Mobile Captures
```dataview
LIST
FROM "00-Inbox"
WHERE contains(tags, "source/mobile")
SORT file.ctime DESC
```

---

## ⚡ Tips for Fast Mobile Capture

1. **Keep it short** — One sentence is fine, expand on desktop
2. **Don't organize** — That's desktop work, just dump it
3. **Use Mobile Task** for anything actionable — easier to find later
4. **Use Mobile Add to Daily** for today-specific items — they go straight to your task list
5. **Batch process on desktop** — Review inbox once per day

---

## 🔗 Related

- [[00-Inbox/_Inbox MOC|📥 Inbox MOC]]
- [[99-Templates/Triage|🧹 Triage Template]]
- [[06-Resources/Second Brain Guide|🧠 Second Brain Guide]]
