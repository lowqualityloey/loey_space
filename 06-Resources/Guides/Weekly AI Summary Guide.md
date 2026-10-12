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
  - topic/ai
  - topic/reviews
---

# Weekly AI Summary Guide

This guide explains how the weekly review system works, how to configure the QuickAdd action, and what data is transmitted when generating an AI summary.

## Overview

The weekly summary system scans your daily notes from the previous seven days, calculates habit and task statistics, and optionally requests a thematic review from Google Gemini.

The output is saved to `07-Reviews/YYYY-[W]WW.md` (for example, `2026-W32.md`). The file contains both local Dataview statistics and an AI-generated summary section.

## Configuration Steps

### 1. API Key Setup

1. Copy `.env.example` to `.env` if you have not already:
   ```bash
   cp .env.example .env
   ```
2. Add your Google Gemini API key to `.env`:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   ```
   You can generate a key in [Google AI Studio](https://aistudio.google.com/app/apikey). The `.env` file is git-ignored and never committed.

### 2. Configure the QuickAdd Action

To run the script from Obsidian:

1. Open **Settings → Community plugins → QuickAdd**.
2. Click **Manage Macros**, then click **Add Macro** and name it `Weekly Review`.
3. Click **Configure**, click **User Scripts**, and select `06-Resources/scripts/weekly-ai-summary.js`.
4. Return to the main QuickAdd settings screen.
5. Under **Add Choice**, name the choice `Weekly Review`, set the type to **Macro**, and select the `Weekly Review` macro you just created.
6. To match the registered choice ID documented in [Setup & Configuration](Setup%20&%20Configuration.md), set the choice ID to `e4f0a1b2-ffff-4000-8000-000000000103`.

### 3. Optional Shortcut

You can assign a hotkey to run the action:

1. Open **Settings → Hotkeys**.
2. Search for `QuickAdd: Weekly Review`.
3. Assign a shortcut, such as `Ctrl + Shift + W` (or `Cmd + Shift + W`).

## Running the Weekly Review

You can trigger the review in two ways:

- **Command Palette**: Press `Ctrl + P` (or `Cmd + P`), type `QuickAdd: Weekly Review`, and press Enter.
- **Configured Hotkey**: Press your assigned shortcut.

When triggered, the script:
1. Derives the seven-day review window ending today.
2. Selects all dated daily notes matching that window in `01-Daily/`.
3. Extracts task, habit, and reflection data from each note.
4. Calculates aggregate completion rates, distinct recorded mood values, and numerical averages for energy and sleep.
5. Sends the summary data to Google Gemini to generate thematic insights.
6. Writes or appends the results to `07-Reviews/YYYY-W[WW].md`.

## Data Sent to Google Gemini and Privacy

The weekly AI review is not a local model. When you run `Weekly Review`, extracted information from your daily notes is sent over HTTPS to Google's Gemini API endpoints (`generativelanguage.googleapis.com`).

### Extracted Content Included in the API Request

The prompt payload sent to Google includes:

- **Review Window Details**: Start date, end date, time zone, and observation coverage.
- **Computed Statistics**: Total completed and unfinished tasks, habit completion ratios, distinct recorded mood values (`moods`), plus numerical averages for energy and sleep.
- **Extracted Note Text**:
  - Daily mood (text), energy (number), and sleep hours (number).
  - Titles of completed and unfinished tasks.
  - Names of completed habits.
  - Full bullet points recorded under `### Wins`.
  - Full bullet points recorded under `### Blockers`.
  - Full bullet points recorded under `### Reflection`.
  - Full bullet points recorded under `### 💡 Ideas & Fleeting Notes`.
  - Daily focus intention bullets from `### 🎯 Today's Focus`.

### Privacy Boundaries

- **No Automatic Redaction**: The script does not filter or scrub personal names, employer names, project titles, or sensitive information from your task titles or reflection bullets. Whatever is written in those sections is sent to the API.
- **Sensitive Notes**: If you have private reflections or notes that should not be transmitted to third-party servers, do not run the AI review or remove that text prior to running.
- **Entirely Optional**: The AI review is completely optional. If you do not configure an API key, you can create your weekly note from `99-Templates/Weekly Review.md` and review your week using local Dataview queries in `07-Reviews/`.

## Offline and Failure Behavior

The weekly review script requires a valid `GEMINI_API_KEY` and active internet access:

- If `GEMINI_API_KEY` is missing in `.env`, the script shows an Obsidian notice (`⚠️ GEMINI_API_KEY missing in .env!`) and exits immediately.
- If the Gemini API returns an error (such as HTTP 429 quota limits or network errors), the script shows a failure notice and exits.
- **No Offline Fallback**: The weekly review script does not generate an offline summary. If the API request fails, no file is created or modified. (In contrast, the daily note enricher in `ai-enrich-action.js` provides a flat offline fallback for daily notes when Gemini is unavailable).

## Review Note Structure: Two Creation Paths

Depending on whether `07-Reviews/YYYY-W[WW].md` already exists when you run `Weekly Review`, the note takes one of two shapes:

### Path 1: Script Creates a New Review File

If `07-Reviews/YYYY-W[WW].md` does not exist yet, `weekly-ai-summary.js` creates the file directly with these sections:

1. **Frontmatter and Coverage Header**: Declares `type: review`, `kind: weekly`, `status: active`, `period_start`, and `period_end`, followed by coverage disclosures for logged days, vitals, and observed habit reviews.
2. **`## 🤖 AI Weekly Summary`**: The generated executive summary, key accomplishments, challenges faced, productivity patterns, mood and energy trends, habit analysis, top insights, recommendations, and weekly quote.
3. **`## 📈 Weekly Metrics`**: Local Dataview and DataviewJS blocks for `### Daily Notes Analyzed`, `### Task Completion Rate`, and `### Habit Consistency`.
4. **`## 📝 Manual Review Notes`**: Prompts for `What went well this week`, `What was challenging or needs adjustment`, `Key learnings`, and `Goals for next week`.
5. **`## 🔗 Related Content`**: Dataview tables for `### Projects Worked On` and `### Concepts Explored`.

### Path 2: Template Created First, Then AI Summary Appended

If you first create `07-Reviews/YYYY-W[WW].md` from the Templater blueprint (`99-Templates/Weekly Review.md`), that template provides the full manual and Dataview review layout:

1. **`## 🧭 Weekly Decision Record`**: Manual section for recording what the week's evidence covers, what advanced, what paused, selected commitments for next week, and awaiting items.
2. **`## 📊 Habit & Wellness Stats (Auto-Generated)`**: DataviewJS blocks for energy, sleep, and textual mood distributions anchored to the review period.
3. **`## 🎉 Completed Tasks This Week`**: In-period completed tasks.
4. **`## 🚀 Active Projects Progress` and `## ⚠️ Stale Projects (Due for Review)`**: Active project snapshots and projects overdue on their `review_cycle`.
5. **`## 📖 Learning Notes Added This Week`**: Learning notes created during the review period.
6. **`## 💡 Weekly Reflection`**: Manual reflection prompts.

When you subsequently run `Weekly Review` (`weekly-ai-summary.js`), the script detects the existing file and appends `## 🤖 AI Weekly Summary` to the end without overwriting your manual sections.

## Related Guides

- [Setup & Configuration](Setup%20&%20Configuration.md) — In-app setup instructions and QuickAdd action IDs.
- [Second Brain Guide](Second%20Brain%20Guide.md) — Everyday workflow and note organization.
- [Maintenance & Troubleshooting](Maintenance%20&%20Troubleshooting.md) — Resolving API quota errors and script issues.