---
name: habit-trend-analyzer
description: >-
  Analyzes multi-day habit completion rates, mood, energy, and sleep correlations,
  identifying burnout indicators, consistency patterns, and generating data-driven weekly retrospectives.
---

# 📈 Habit Trend Analyzer Skill

This skill guides the agent in aggregating habit performance, detecting energy/sleep patterns, and summarizing weekly retrospectives into `07-Reviews/`.

---

## 🎯 When to Activate
- The user runs `hey loey weekly` or requests habit/productivity analytics.
- Reviewing 7-day or 30-day performance trends from daily notes.
- Generating the weekly retrospective note in `07-Reviews/YYYY-[W]WW.md`.

---

## 📋 Procedure

### Step 1: Data Extraction across Daily Notes
Inspect `01-Daily/YYYY-MM/` notes for the target period (e.g. last 7 or 30 days):
- **Metrics**: `mood`, `energy` (1–5), `sleep_hours`
- **Habits (6 Core)**: `water`, `prioritised`, `move`, `read`, `tidy`, `disconnect`
- **Tasks**: Count of completed (`[x]`), open (`[ ]`), and forwarded (`[>]`)
- **Qualitative**: Key logged wins and blockers

### Step 2: Trend & Correlation Analysis
1. **Habit Completion Ratio**: Calculate overall percentage and individual completion rates for each habit.
2. **Sleep vs. Energy Correlation**: Check if sleep < 6.5h corresponds to lower energy or dropped habits.
3. **Burnout Flagging**: Flag if energy <= 2 or mood in `[tired, stressed, exhausted, restless]` persists for $\ge 3$ consecutive days.
4. **Streak Calculation**: Identify active unbroken streaks for individual habits.

### Step 3: Generating Weekly Retrospective Note
1. Determine current ISO week format: `07-Reviews/YYYY-[W]WW.md` (e.g. `2026-W34.md`).
2. Write or update the review note using `99-Templates/Weekly Review.md`:
   - Summary of key wins and milestone completions (e.g. projects finished).
   - Habit performance bar charts and statistics.
   - Actionable recommendations for the upcoming week.
3. Update `07-Reviews/_Reviews MOC.md` with the new retrospective link.
