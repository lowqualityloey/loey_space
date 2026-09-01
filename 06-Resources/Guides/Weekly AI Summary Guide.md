---
created: 2026-08-09
updated: 2026-08-09
type: guide
status: active
area: system
tags:
  - type/guide
  - area/system
  - topic/ai
  - topic/reviews
---

# 📊 Weekly AI Summary Guide

> Step-by-step guide to configure and use the automated weekly AI summary system

## 🎯 Overview

The **Weekly AI Summary** system analyzes your daily notes from the past 7 days and generates comprehensive insights, patterns, and recommendations using Google Gemini AI.

---

## 🔧 Configuration Steps

### Step 1: Verify API Key
1. Ensure your `.env` file contains a valid `GEMINI_API_KEY`
2. The script automatically reads this key for AI processing

### Step 2: Add QuickAdd Macro
1. Open **Obsidian Settings** (`Ctrl + ,`)
2. Go to **Community Plugins** → **QuickAdd**
3. Click **Manage Macros**
4. Click **Add Macro** and name it: `📊 Generate Weekly AI Summary`

### Step 3: Configure Macro Command
Add this single command:

**Command: Weekly AI Summary Script**
- **Type**: User Script
- **Script Path**: `06-Resources/scripts/weekly-ai-summary.js`

### Step 4: Set Quick Access
1. Go back to QuickAdd main settings
2. Add a new **Choice** named `📊 Weekly AI Summary`
3. Set **Type** to `Macro`
4. Select the `📊 Generate Weekly AI Summary` macro
5. Enable **Show in ribbon** for easy access

### Step 5: Set Weekly Reminder (Optional)
1. Go to **Obsidian Settings** → **Hotkeys**
2. Search for `QuickAdd: Run 📊 Weekly AI Summary`
3. Set a memorable shortcut (suggested: `Ctrl+Shift+W` for Weekly)

---

## 🚀 Using the Weekly Summary

### Method 1: Ribbon Button (Recommended)
1. Click the **📊 Weekly AI Summary** button in the ribbon
2. Wait for processing (typically 10-30 seconds)
3. Review the generated weekly summary in `07-Reviews/`

### Method 2: Command Palette
1. Press `Ctrl+P`
2. Type `QuickAdd: Run 📊 Weekly AI Summary`
3. Execute and review results

### Method 3: Keyboard Shortcut
1. Press your configured hotkey (e.g., `Ctrl+Shift+W`)
2. Wait for processing to complete

---

## 🔍 What Gets Analyzed

The system extracts and analyzes:

### 📅 Daily Metrics
- **Mood**: Overall emotional state each day
- **Energy**: Energy levels (1-5 scale)
- **Sleep**: Hours of sleep recorded
- **Tasks**: Completion rates and patterns
- **Habits**: Consistency and completion rates

### 📊 Patterns Detected
- **Productivity trends**: When you're most effective
- **Mood cycles**: Emotional patterns throughout the week
- **Sleep impact**: How sleep affects productivity
- **Habit consistency**: Which habits stick and which don't
- **Task completion**: What types of tasks get done vs. postponed

### 💡 Insights Generated
- **Key accomplishments**: What went well
- **Challenges faced**: What was difficult
- **Patterns identified**: Recurring themes
- **Recommendations**: Actionable advice for next week
- **Inspirational quotes**: Relevant motivation

---

## 📁 Output Structure

The system creates/updates files in `07-Reviews/`:

### File Naming
- `YYYY-W[week_number].md` (e.g., `2026-W32.md`)

### Content Sections
1. **🤖 AI Weekly Summary**: AI-generated insights and recommendations
2. **📈 Weekly Metrics**: Dataview queries showing actual data
3. **📝 Manual Review Notes**: Space for your personal reflections
4. **🔗 Related Content**: Links to projects and concepts from the week
5. **📊 Visual Analytics**: Charts and metrics (if configured)

---

## ⚡ Performance & Requirements

### Processing Time
- **Data extraction**: 2-5 seconds
- **AI processing**: 5-15 seconds
- **File creation**: 1-2 seconds
- **Total**: Typically 10-30 seconds

### Data Requirements
- **Minimum**: At least 1 daily note from the past 7 days
- **Optimal**: 5-7 daily notes with completed tasks/habits
- **Best results**: Daily notes with mood, energy, sleep, and task data

### API Usage
- **Tokens per week**: ~500-1000 tokens
- **Cost estimate**: ~$0.0005-$0.001 per weekly summary
- **Monthly cost**: ~$0.02-$0.04 at weekly usage

---

## 🎨 Customization Options

### Modify Analysis Focus
Edit `weekly-ai-summary.js` to change what gets analyzed:

```javascript
// Add custom metrics
const customPrompt = `Analyze these additional metrics: focusTime, breaksTaken, deepWorkSessions`;
```

### Adjust Output Format
Modify the `formatWeeklySummary` function to change how insights are displayed:

```javascript
function formatWeeklySummary(data) {
  // Custom formatting logic
  return `# Custom Weekly Report\n\n${data.executiveSummary}`;
}
```

### Change Review Frequency
Create variations for different timeframes:
1. **Bi-weekly**: Modify to analyze 14 days
2. **Monthly**: Modify to analyze 30 days
3. **Quarterly**: Modify to analyze 90 days

---

## 🧪 Testing Your Setup

### Test 1: Basic Functionality
1. Ensure you have at least 1 daily note from the past week
2. Run the weekly summary
3. Verify a file is created in `07-Reviews/`

### Test 2: Data Accuracy
1. Check that metrics match your actual daily notes
2. Verify task completion rates are correct
3. Confirm habit tracking is accurate

### Test 3: AI Insights Quality
1. Review if insights are relevant and actionable
2. Check if patterns identified match your experience
3. Verify recommendations are practical

### Test 4: Performance
1. Time the complete process
2. Ensure it completes within 30 seconds
3. Verify no errors in console

---

## 🔄 Integration with Workflow

### Weekly Review Routine
1. **Friday afternoon/evening**: Run weekly AI summary
2. **Saturday morning**: Review AI insights
3. **Add manual notes**: Personal reflections and adjustments
4. **Set next week goals**: Based on recommendations

### Connection to Daily System
- **Auto-updates**: Weekly summaries reference daily notes
- **Progressive insights**: Patterns emerge across weeks
- **Continuous improvement**: Weekly recommendations inform daily planning

### Integration with Other Systems
- **Project tracking**: Links to active projects
- **Concept development**: References new concepts learned
- **Habit formation**: Tracks habit consistency over time

---

## 📈 Benefits & Impact

### Time Savings
- **Manual review time**: 30-60 minutes reduced to 5-10 minutes
- **Insight generation**: Instant pattern detection vs. manual analysis
- **Recommendation creation**: AI suggestions vs. brainstorming

### Quality Improvements
- **Objective analysis**: Data-driven insights vs. subjective memory
- **Pattern recognition**: Identifies trends you might miss
- **Actionable recommendations**: Specific, tailored advice

### Consistency Benefits
- **Regular reviews**: Automated prompts for weekly reflection
- **Historical tracking**: Consistent format across weeks
- **Progress measurement**: Comparable metrics week-to-week

---

## 🛠️ Troubleshooting

### Issue: No daily notes found
**Solution**: Ensure you have daily notes in `01-Daily/` from the past 7 days

### Issue: API key missing
**Solution**: Verify `.env` contains `GEMINI_API_KEY=your_key_here`

### Issue: Slow processing
**Solution**: Reduce number of days analyzed or simplify prompt

### Issue: Inaccurate insights
**Solution**: Ensure daily notes have complete data (mood, energy, tasks, habits)

### Issue: File not created
**Solution**: Check console for errors and verify write permissions

---

## 🔒 Privacy & Data Security

### Local Processing
- **All data stays local**: Daily notes never leave your computer
- **Only metadata to API**: Summary data sent to Gemini, not full notes
- **API terms compliance**: Uses Google Gemini within terms of service

### Data Minimization
- **Aggregated data only**: Sends summaries, not raw daily notes
- **No personal identifiers**: Names, locations, sensitive info excluded
- **Opt-out possible**: Can use without AI (manual summary only)

### Security Best Practices
- **API key protection**: Stored in `.env` (git-ignored)
- **Regular audits**: Review what data gets sent to API
- **Transparency**: Full source code available for inspection

---

## 📊 Success Metrics Tracking

Track these to measure system effectiveness:

1. **Weekly Review Completion Rate**: % of weeks with completed reviews
2. **Insight Action Rate**: % of AI recommendations implemented
3. **Time Saved**: Minutes reduced from manual review process
4. **Productivity Impact**: Correlation with weekly task completion rates
5. **User Satisfaction**: Self-assessment of review quality

---

## 🔗 Related Resources
- [[_Reviews MOC|📋 Reviews MOC]]
- `06-Resources/scripts/weekly-ai-summary.js` (Weekly AI Summary Automation Script)
- `06-Resources/scripts/ai-enrich-action.js` (Multi-Domain AI Daily Enricher)

---

## 🎯 Best Practices

### For Best Results
1. **Consistent daily logging**: Complete mood, energy, sleep, tasks daily
2. **Friday execution**: Run weekly summary at end of work week
3. **Saturday review**: Reflect on insights with fresh mind
4. **Monday implementation**: Apply recommendations starting new week
5. **Quarterly audit**: Review and adjust system every 3 months

### Continuous Improvement
1. **Monthly**: Review AI insight quality and adjust prompts
2. **Quarterly**: Update metrics based on what matters most
3. **Bi-annually**: Consider new AI models or analysis techniques
4. **Annually**: Complete system review and major updates

### Integration Tips
1. **Link to projects**: Connect weekly insights to project progress
2. **Share with team**: If collaborative, share relevant insights
3. **Track long-term**: Use yearly reviews to see annual patterns
4. **Adjust workflow**: Let weekly insights inform daily habits

---

> [!TIP] Pro Tip
> Set a **weekly calendar reminder** for your weekly review. Consistency is key to getting the most value from this system!