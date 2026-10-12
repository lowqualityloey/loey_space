---
created: 2026-08-09
updated: 2026-10-12
type: guide
status: active
area: system
tags:
  - type/guide
  - area/system
  - status/active
  - topic/mobile
---

# Mobile Workflow Guide

This guide covers setting up fast mobile capture in Obsidian Mobile and batch-processing those items later on desktop.

---

## Mobile Capture Approach

On mobile, capture thoughts quickly into `00-Inbox/` without stopping to organize or format them. Each mobile capture carries a `📱` marker and a `source/mobile` tag so you can review and file them on desktop using `Triage Sweep`.

---

## One-Time Setup

### 1. Install Obsidian Mobile
- Install Obsidian from the App Store or Google Play and open the synced vault directory.

### 2. Enable Required Plugins
In **Settings → Community plugins**, ensure **QuickAdd** and **Templater** are enabled.

### 3. Add Mobile Toolbar Shortcuts
In **Settings → Mobile → Manage toolbar**, add the QuickAdd capture commands you use most often:
1. `Mobile Capture` — Appends a timestamped line to `00-Inbox/quick-capture-dump.md`.
2. `Mobile Task` — Appends a task checkbox to `00-Inbox/quick-capture-dump.md`.
3. `Mobile Idea` — Creates a note in `00-Inbox/` from `99-Templates/Mobile Idea.md`.
4. `Mobile Add to Daily` — Appends a task directly under `### ✅ Tasks` in today's daily note.

---

## Capture Commands

| Command | Template or Target | Format Written |
| :--- | :--- | :--- |
| **Mobile Capture** | `00-Inbox/quick-capture-dump.md` | `- 📱 <text> (YYYY-MM-DD HH:mm)` |
| **Mobile Task** | `00-Inbox/quick-capture-dump.md` | `- [ ] 📱 <task> (YYYY-MM-DD HH:mm)` |
| **Mobile Idea** | `99-Templates/Mobile Idea.md` → `00-Inbox/` | Structured note with `source/mobile` tag |
| **Mobile Add to Daily** | `01-Daily/YYYY-MM/YYYY-MM-DD.md` | `- [ ] <task>` under `### ✅ Tasks` |

---

## Processing Captures on Desktop

1. Open `00-Inbox/quick-capture-dump.md`.
2. Review captured lines and append a destination token (`#do`, `#dev`, `#concept`, `#learn`, `#ref`, `#personal`, `#project`, `#bin`) to each line you are ready to file.
3. Run `Ctrl + P` → **QuickAdd: Triage Sweep** to route all tagged lines in one pass.

To list standalone mobile notes in `00-Inbox/` via Dataview:

```dataview
LIST
FROM "00-Inbox"
WHERE contains(tags, "source/mobile")
SORT file.ctime DESC
```

---

## Mobile Dashboard Styling

If the HomePulse dashboard looks cramped on a phone screen, go to **Settings → Appearance → CSS snippets** and enable `homepulse-mobile`.

---

## Related Guides

- [Second Brain Guide](Second%20Brain%20Guide.md) — Inbox token triage and daily note workflows
- [Setup & Configuration](Setup%20&%20Configuration.md) — Core QuickAdd and Templater configuration
- [00-Inbox/_Inbox MOC](../../00-Inbox/_Inbox%20MOC.md) — Unprocessed inbox dashboard
