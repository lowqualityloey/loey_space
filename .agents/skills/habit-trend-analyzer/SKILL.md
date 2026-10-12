---
name: habit-trend-analyzer
version: "1.0"
pinned: true
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

### Step 1: Data Extraction & Observation Coverage across Daily Notes
Inspect `01-Daily/YYYY-MM/` notes for the target calendar window (e.g. last 7 or 30 calendar days):
- **Observation Coverage**: Always report `observed_days / window_days` (e.g., `4/7 days observed`).
- **Unobserved / Pending Notes vs. Missed Habits**: Every newly scaffolded daily note starts with all 6 habits unchecked (`- [ ]`). Explicitly distinguish:
  1. **Missing daily notes** (no file for that date $\to$ unknown).
  2. **Unobserved / pending daily notes** (scaffolded note where no check-in occurred—e.g. all habits `- [ ]` with blank vitals/reflections, or today's in-progress note prior to `heyloey evening` $\to$ pending/unknown).
  3. **Confirmed missed habits** (unchecked `- [ ]` on a day where a check-in actually took place). Never count missing or unobserved scaffolded notes as `0/6` failed habits.
- **Metrics**: `mood` (free-form text with a suggested vocabulary per `Tagging & Properties.md`; tolerate legacy numeric values as read-only), `energy` (1–5), `sleep_hours`
- **Habits (6 Core)**: `water`, `prioritised`, `move`, `read`, `tidy`, `disconnect`
- **Tasks**: Count of completed (`[x]`), open (`[ ]`), and forwarded (`[>]`)
- **Qualitative**: Key logged wins and blockers

### Step 2: Evidence-Proportional Trend & Correlation Analysis
1. **Habit Completion Denominators**:
   - **Per-Habit Completion Rate**: `completed_days / observed_days` for each individual habit.
   - **Overall Completion Rate (6 Habits)**: `completed_habit_checks / (6 * observed_days)` (i.e. `completed_habit_checks / observed_habit_opportunities`), reported alongside window coverage (`observed_days / window_days`).
2. **Sleep vs. Energy Correlation**: Check if `sleep_hours < 6.5` corresponds to lower energy or dropped habits across days where both fields are recorded.
3. **Burnout Flagging (Consecutive Calendar Days)**: Flag if `energy <= 2`, `sleep_hours < 6`, or low/depleted textual `mood` (e.g. `tired`, `stressed`, `exhausted`, `restless`) persists for $\ge 3$ **consecutive calendar days** (e.g. Oct 9, Oct 10, Oct 11—never 3 non-adjacent notes across unlogged date gaps).
4. **Streak Calculation**: Require unbroken **consecutive calendar days** for streak claims; unlogged or unobserved calendar dates pause certainty rather than bridging silently.
5. **Sparse-Data Humility**: When observation coverage is sparse (`observed_days < 4` in a 7-day window), frame patterns as **tentative observations** rather than definitive trend claims.

### Step 3: Generating Weekly Retrospective Note
1. Determine current ISO week format: `07-Reviews/YYYY-[W]WW.md` (e.g. `2026-W34.md`).
2. Write or update the review note using `99-Templates/Weekly Review.md`:
   - Observation coverage summary (`observed_days / 7`) and key milestone completions.
   - Habit performance bar charts and statistics (using `completed_days / observed_days` per habit and `completed_habit_checks / (6 * observed_days)` overall, distinguishing confirmed misses from missing/unobserved days).
   - Evidence-proportional recommendations for the upcoming week.
3. Update `07-Reviews/_Reviews MOC.md` with the new retrospective link.

---

## 🧪 Regression Cases

| Case | Trigger / Input | Expected Invariant |
| :--- | :--- | :--- |
| **RC-1: Burnout Detection (Calendar Continuity)** | 3 consecutive **calendar days** have `energy <= 2` or `sleep_hours < 6` (vs. 3 sparse notes separated by missing dates). | Flags burnout risk on 3 consecutive calendar days; treats non-adjacent notes with missing dates between them as tentative, not a consecutive streak. |
| **RC-2: 6-Habit Denominators & Unobserved Notes** | `heyloey weekly` runs on a week with 4 checked-in notes, 1 untouched scaffolded note (all `- [ ]`, blank vitals), and 2 missing dates. | Reports `4/7` observation coverage, treats the untouched scaffolded note as unobserved (not `0/6` missed), computes per-habit rate over `4` observed days, and computes overall rate over `24` (`6 × 4`) observed habit opportunities. |
| **RC-3: MOC Registration** | Weekly review `07-Reviews/YYYY-WXX.md` created. | Links the new review note in `07-Reviews/_Reviews MOC.md`. |

