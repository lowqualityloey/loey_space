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
  - topic/quickadd
---

# QuickAdd Inbox Optimization Guide

## Overview

The vault's default capture workflow is stream-based: the canonical **Quick Capture** action (`06-Resources/scripts/quick-capture-action.js`) appends timestamped lines directly to `00-Inbox/quick-capture-dump.md` (see [Setup & Configuration](Setup%20&%20Configuration.md)).

This guide documents an optional alternative: configuring QuickAdd with the **Enhanced Quick Capture** template (`99-Templates/Enhanced Quick Capture.md`) when you prefer to create individual notes in `00-Inbox/` with keyword-based type suggestions.

---

## Configuration Steps

### Step 1: Open QuickAdd Settings
1. Open **Obsidian Settings** (`Ctrl + ,` or `Cmd + ,`).
2. Go to **Community Plugins → QuickAdd**.
3. Click **Manage Macros**.

### Step 2: Create the Capture Macro
1. Click **Add Macro** and name it `Enhanced Quick Capture`.
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
    const { variables } = params;
    const activeFile = app.workspace.getActiveFile();
    if (activeFile && variables.content) {
        await app.vault.modify(activeFile, await app.vault.read(activeFile) + "\n\n" + variables.content);
    }
};
```

### Step 3: Register the Choice
1. Return to the main QuickAdd settings screen.
2. Add a new **Choice** named `Enhanced Quick Capture` (keep this distinct from the stream-based `Quick Capture` action).
3. Set **Type** to `Macro` and select the `Enhanced Quick Capture` macro.
4. Optionally enable the lightning-bolt icon to show it in the command palette or ribbon.

---

## How Keyword Classification Works

The `99-Templates/Enhanced Quick Capture.md` template inspects the captured text and suggests frontmatter tags based on simple keyword matching:

### Type Detection
- `idea` / `thought` / `concept` → `type/concept`
- `task` / `todo` / `do` / `complete` → `type/task`
- `learn` / `study` / `course` → `type/learning`
- `code` / `script` / `function` → `type/snippet`
- `http` / `www.` / `.com` / `resource` → `type/resource`
- `review` / `reflect` / `weekly` → `type/review`

### Area Detection
- Dev and technical keywords → `area/dev`
- Study and course keywords → `area/learning`
- Project keywords → `area/projects`
- Personal and life keywords → `area/personal`
- Reference keywords → `area/resources`

### Priority Detection
- `urgent` / `important` / `critical` → `priority/high`
- `low` / `background` / `nice-to-have` → `priority/low`
- Default → `priority/medium`

---

## Customizing Keyword Rules

You can edit `99-Templates/Enhanced Quick Capture.md` to match your own vocabulary:

```javascript
if (content.includes("meeting") || content.includes("call")) {
    detectedType = "type/meeting";
    typeSuggestion = "meeting";
}

if (content.includes("health") || content.includes("fitness")) {
    detectedArea = "area/personal";
    areaSuggestion = "personal";
}
```

---

## Troubleshooting

- **Template not loading**: Confirm the template path in QuickAdd is set to `99-Templates/Enhanced Quick Capture.md` and Templater is enabled.
- **Content not inserting**: Check that Command 2 uses the exact variable name `content` expected by Command 3.
- **Prefer single-file inbox triage**: Use the default `Quick Capture` and `Triage Sweep` workflow described in [Second Brain Guide](Second%20Brain%20Guide.md).

---

## Related Guides

- [Setup & Configuration](Setup%20&%20Configuration.md) — Canonical `Quick Capture` and `Triage Sweep` setup
- [Second Brain Guide](Second%20Brain%20Guide.md) — Inbox token triage workflow
- [00-Inbox/_Triage MOC](../../00-Inbox/_Triage%20MOC.md) — Inbox and overdue review dashboard