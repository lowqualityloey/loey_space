---
created: 2026-08-09
updated: 2026-08-09
type: guide
status: active
area: system
tags:
  - type/guide
  - area/system
  - topic/quickadd
---

# 📥 QuickAdd Inbox Optimization Guide

> Step-by-step guide to configure QuickAdd for optimized inbox capture with auto-classification

## 🎯 Overview

This guide shows you how to set up QuickAdd to use the new **Enhanced Quick Capture** template, reducing inbox processing time from manual classification to under 30 seconds per note.

---

## 🔧 Configuration Steps

### Step 1: Open QuickAdd Settings
1. Open **Obsidian Settings** (`Ctrl + ,`)
2. Go to **Community Plugins** → **QuickAdd**
3. Click **Manage Macros**

### Step 2: Create New Capture Macro
1. Click **Add Macro** and name it: `📥 Enhanced Quick Capture`
2. Add these commands in order:

**Command 1: Template Capture**
- **Type**: Template
- **Template Path**: `99-Templates/Enhanced Quick Capture.md`
- **File Name Format**: `{{DATE:YYYY-MM-DD_HHmm}} {{VALUE}}`
- **Folder Path**: `00-Inbox/`
- **Open File**: Enabled

**Command 2: Prompt for Content**
- **Type**: Wait
- **Wait Type**: For user input
- **Prompt**: `Enter your quick capture content:`
- **Variable Name**: `content`

**Command 3: Insert Content**
- **Type**: User Script
- **Script**: 
```javascript
module.exports = async (params) => {
    const {quickAddApi: {inputPrompt, snippetPrompt, yesNoPrompt, infoPrompt}, variables} = params;
    
    // Get the active file (the template we just created)
    const activeFile = app.workspace.getActiveFile();
    if (activeFile) {
        // Insert the captured content into the template
        await app.vault.modify(activeFile, await app.vault.read(activeFile) + "\n\n" + variables.content);
    }
};
```

### Step 3: Configure Quick Access
1. Go back to QuickAdd main settings
2. Add a new **Choice** named `📥 Quick Capture`
3. Set **Type** to `Macro`
4. Select the `📥 Enhanced Quick Capture` macro you created
5. Enable **Show in ribbon** for one-click access

### Step 4: Set Keyboard Shortcut (Optional)
1. Go to **Obsidian Settings** → **Hotkeys**
2. Search for `QuickAdd: Run 📥 Quick Capture`
3. Set your preferred shortcut (suggested: `Ctrl+Shift+I` for Inbox)

---

## 🚀 Using the Optimized Capture

### Method 1: Ribbon Button
1. Click the **📥 Quick Capture** button in the ribbon
2. Enter your content in the prompt
3. The system auto-creates a classified note in `00-Inbox/`

### Method 2: Command Palette
1. Press `Ctrl+P`
2. Type `QuickAdd: Run 📥 Quick Capture`
3. Enter your content

### Method 3: Keyboard Shortcut
1. Press your configured hotkey (e.g., `Ctrl+Shift+I`)
2. Enter your content

---

## 🔍 How Auto-Classification Works

The **Enhanced Quick Capture** template uses keyword analysis to suggest:

### Type Detection
- **`idea`/`thought`/`concept`** → `type/concept`
- **`task`/`todo`/`do`/`complete`** → `type/task`
- **`learn`/`study`/`course`** → `type/learning`
- **`code`/`script`/`function`** → `type/snippet`
- **`http`/`www.`/`.com`/`resource`** → `type/resource`
- **`review`/`reflect`/`weekly`** → `type/review`

### Area Detection
- **Dev/tech keywords** → `area/dev`
- **Learning keywords** → `area/learning`
- **Project keywords** → `area/projects`
- **Personal/life keywords** → `area/personal`
- **Reference/guide keywords** → `area/resources`

### Priority Detection
- **`urgent`/`important`/`critical`** → `priority/high`
- **`low`/`background`/`nice-to-have`** → `priority/low`
- **Default** → `priority/medium`

---

## 📊 Benefits & Time Savings

### Before Optimization
- **Time per capture**: 2-3 minutes
- **Steps**: Capture → Create note → Add metadata → Classify → Triage
- **Manual work**: Full manual classification and tagging

### After Optimization
- **Time per capture**: < 30 seconds
- **Steps**: Capture → Auto-classification → Quick review
- **Manual work**: Just verify auto-suggestions

### Time Savings
- **Per capture**: ~2.5 minutes saved
- **Weekly (10 captures)**: ~25 minutes saved
- **Monthly (40 captures)**: ~100 minutes saved

---

## 🔗 Integration with Existing Workflow

### Works with Existing Templates
- **Triage Sweep**: The processing route — tag a capture line with a destination token (`#do`, `#dev`, `#concept`, `#learn`, `#ref`, `#personal`, `#project`, `#bin`) and run the sweep. The old `Triage.md` form has been removed; items needing real thought get swept to their destination note and developed there
- **Daily notes**: Capture content can reference daily contexts
- **Projects**: Auto-links to project tags when detected

### Compatible with HomePulse
- **Dashboard updates**: New captures appear in inbox widget
- **Task detection**: Tasks in captures auto-appear in task MOC
- **Habit exclusion**: Habit-related content properly filtered

### AI Enrichment Ready
- **AI trigger**: Content ready for `Ctrl+Shift+A` enrichment
- **Multi-domain**: Auto-detects if content needs tech/wellness/entertainment AI

---

## 🛠️ Customization Options

### Modify Keyword Detection
Edit `99-Templates/Enhanced Quick Capture.md` to add your own keywords:

```javascript
// Add custom type detection
if (content.includes("meeting") || content.includes("call")) {
    detectedType = "type/meeting";
    typeSuggestion = "meeting";
}

// Add custom area detection  
if (content.includes("health") || content.includes("fitness")) {
    detectedArea = "area/health";
    areaSuggestion = "health";
}
```

### Adjust Destination Folders
Modify the template to suggest different destinations based on content:

```javascript
// Custom destination logic
if (detectedType === "type/meeting") {
    destinationSuggestion = "05-Personal/Meetings/";
}
```

### Add Custom Prompts
Extend the QuickAdd macro with additional prompts:

1. **Context prompt**: Ask "What project is this related to?"
2. **Priority prompt**: Ask "How urgent is this?"
3. **Follow-up prompt**: Ask "When should this be reviewed?"

---

## 🧪 Testing Your Setup

### Test 1: Basic Capture
1. Use the capture button
2. Enter: "Need to fix the login bug in weather app"
3. Verify auto-detection: `type/task`, `area/dev`, `priority/medium`

### Test 2: Learning Capture
1. Use the capture button
2. Enter: "Study React hooks tutorial on YouTube"
3. Verify auto-detection: `type/learning`, `area/learning`, `priority/medium`

### Test 3: Resource Capture
1. Use the capture button
2. Enter: "Bookmark: https://docs.github.com/en/rest"
3. Verify auto-detection: `type/resource`, `area/resources`, `priority/medium`

### Test 4: Urgent Capture
1. Use the capture button
2. Enter: "URGENT: Server down, need to restart ASAP"
3. Verify auto-detection: `type/task`, `area/dev`, `priority/high`

---

## 🔄 Maintenance & Updates

### Regular Review
- **Weekly**: Check auto-classification accuracy
- **Monthly**: Update keyword lists based on usage patterns
- **Quarterly**: Review time savings and adjust workflow

### Performance Monitoring
- **Capture time**: Should remain under 30 seconds
- **Accuracy rate**: Aim for > 90% correct auto-classification
- **User satisfaction**: Adjust based on feedback

### Version Updates
When updating the template:
1. **Backup**: Save current template version
2. **Test**: Try new version with sample captures
3. **Rollout**: Update template in `99-Templates/`
4. **Verify**: Test with real captures

---

## 🆘 Troubleshooting

### Issue: Template not loading
**Solution**: Verify template path is `99-Templates/Enhanced Quick Capture.md`

### Issue: Auto-classification inaccurate
**Solution**: Add your frequently used keywords to the template

### Issue: Content not inserting
**Solution**: Check QuickAdd script syntax and variable names

### Issue: Performance slow
**Solution**: Reduce template complexity or disable non-essential features

---

## 📈 Success Metrics Tracking

Track these metrics to measure optimization success:

1. **Capture Time**: Time from trigger to classified note
2. **Classification Accuracy**: % of correctly auto-classified notes
3. **Triage Time**: Time from capture to final filing
4. **Inbox Size**: Number of unprocessed notes in inbox
5. **User Satisfaction**: Self-assessment of workflow improvement

---

## 🔗 Related Resources

- [[Enhanced Quick Capture|📥 Enhanced Quick Capture Template]]
- [[00-Inbox/_Triage MOC|🧹 Triage & Maintenance MOC]]
- [[Second Brain Guide|🧠 Second Brain Workflow Guide]]

---

## 🎯 Next Steps After Setup

1. **Test thoroughly** with different capture types
2. **Customize keywords** for your specific workflow
3. **Train muscle memory** with your chosen shortcut
4. **Monitor metrics** for continuous improvement
5. **Share feedback** for future enhancements