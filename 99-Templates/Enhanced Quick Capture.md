---
created: <% tp.date.now("YYYY-MM-DD") %> <% tp.date.now("HH:mm") %>
updated: <% tp.date.now("YYYY-MM-DD") %>
type: capture
status: active
area: inbox
priority: medium
tags:
  - type/capture
  - area/inbox
  - status/active
  - priority/medium
---

# 📥 Quick Capture: <% tp.file.title %>

## 🎯 Quick Classification

**Capture Time**: `= this.created`  
**Source**: Quick capture via QuickAdd

### 🏷️ Auto-Detected Classification
> [!TIP] *Based on content analysis, this appears to be:*
> <%*
// Auto-classification logic based on keywords
let content = await tp.file.selection();
let title = tp.file.title;

// Type detection
let detectedType = "type/capture";
let typeSuggestion = "capture";

if (title.toLowerCase().includes("idea") || content.includes("thought") || content.includes("concept")) {
    detectedType = "type/concept";
    typeSuggestion = "concept";
} else if (title.toLowerCase().includes("task") || content.includes("todo") || content.includes("do") || content.includes("complete")) {
    detectedType = "type/task";
    typeSuggestion = "task";
} else if (title.toLowerCase().includes("learn") || content.includes("study") || content.includes("course") || content.includes("tutorial")) {
    detectedType = "type/learning";
    typeSuggestion = "learning";
} else if (content.includes("code") || content.includes("script") || content.includes("function") || content.includes("api")) {
    detectedType = "type/snippet";
    typeSuggestion = "snippet";
} else if (content.includes("http") || content.includes("www.") || content.includes(".com") || content.includes("resource")) {
    detectedType = "type/resource";
    typeSuggestion = "resource";
} else if (content.includes("review") || content.includes("reflect") || content.includes("weekly") || content.includes("monthly")) {
    detectedType = "type/review";
    typeSuggestion = "review";
}

// Area detection
let detectedArea = "area/inbox";
let areaSuggestion = "inbox";

if (detectedType === "type/snippet" || content.includes("code") || content.includes("dev") || content.includes("tech")) {
    detectedArea = "area/dev";
    areaSuggestion = "dev";
} else if (detectedType === "type/learning" || content.includes("learn") || content.includes("study")) {
    detectedArea = "area/learning";
    areaSuggestion = "learning";
} else if (content.includes("project") || content.includes("build") || content.includes("develop")) {
    detectedArea = "area/projects";
    areaSuggestion = "projects";
} else if (content.includes("personal") || content.includes("life") || content.includes("goal") || content.includes("fitness")) {
    detectedArea = "area/personal";
    areaSuggestion = "personal";
} else if (detectedType === "type/resource" || content.includes("reference") || content.includes("guide") || content.includes("doc")) {
    detectedArea = "area/resources";
    areaSuggestion = "resources";
}

// Priority detection
let detectedPriority = "priority/medium";
let prioritySuggestion = "medium";

if (content.includes("urgent") || content.includes("important") || content.includes("critical") || content.includes("asap")) {
    detectedPriority = "priority/high";
    prioritySuggestion = "high";
} else if (content.includes("low") || content.includes("background") || content.includes("nice-to-have")) {
    detectedPriority = "priority/low";
    prioritySuggestion = "low";
}

_%>
- **Type**: `[[<% detectedType %>|<% typeSuggestion %>]]`
- **Area**: `[[<% detectedArea %>|<% areaSuggestion %>]]`
- **Priority**: `[[<% detectedPriority %>|<% prioritySuggestion %>]]`

### ✏️ Manual Adjustment
If auto-detection missed the mark, update classifications:
- [ ] `type/project` - Active development project
- [ ] `type/learning` - Educational content  
- [ ] `type/snippet` - Code pattern/example
- [ ] `type/resource` - External reference
- [ ] `type/concept` - Evergreen idea
- [ ] `type/personal` - Life management item
- [ ] `type/review` - Reflection/assessment

- [ ] `area/dev` - Development related
- [ ] `area/learning` - Educational focus
- [ ] `area/personal` - Life management
- [ ] `area/resources` - Reference material
- [ ] `area/system` - Vault/system related

- [ ] `priority/critical` - Needs immediate attention (today)
- [ ] `priority/high` - Important, schedule soon (this week)
- [ ] `priority/medium` - Regular priority (when time allows)
- [ ] `priority/low` - Background item (nice-to-have)

---

## 📝 Content

<% tp.file.selection() %>

---

## 🎯 Decision & Action Plan

### Final Destination
**Move to**: `00-Inbox/` *(default - requires triage)*
- [ ] **02-Projects/** - Active development project
- [ ] **03-Dev/** - Code snippet/technical pattern
- [ ] **04-Learning/** - Educational content
- [ ] **05-Personal/** - Life management/goals
- [ ] **06-Resources/** - Reference material
- [ ] **07-Reviews/** - Reflection notes
- [ ] **08-Concepts/** - Evergreen concepts
- [ ] **Already triaged** - Keep in current location
- [ ] **Delete** - Not worth keeping

**Action Required**:
- [ ] Convert to structured note using appropriate template
- [ ] Extract key insights to relevant MOC/hub
- [ ] Link to related projects/notes
- [ ] Set follow-up reminder/review date
- [ ] Archive original inbox note after processing

### Next Steps
1. Review auto-classification accuracy
2. Adjust tags if needed
3. Move to appropriate folder
4. Add to relevant MOCs

### Follow-up Date
**Review by**: `date(now) + dur(3d)` *(default: 3 days for inbox items)*

---

## 🔗 Context & Connections

### Related Projects
- [[ ]]
- [[ ]]

### Related Concepts
- [[ ]]
- [[ ]]

### People Involved
- 

---

## 📊 Processing Status

**Captured**: `= this.created`  
**Last Updated**: `= this.updated`  
**Processing Stage**: Quick capture → Auto-classification → Awaiting triage  
**Estimated Processing Time**: < 2 minutes with auto-classification

---

## 🎨 Template Features

### Auto-Detection Logic
- **Keyword Analysis**: Scans title and content for classification clues
- **Smart Tagging**: Suggests appropriate type, area, and priority tags
- **Context Preservation**: Maintains original content while adding structure

### Workflow Integration
- **QuickAdd Ready**: Designed for 1-click capture via QuickAdd macros
- **Triage Compatible**: Works with token triage — tag the capture and run **Triage Sweep** (`triage-sweep.js`)
- **MOC Auto-linking**: Can be extended to auto-link to relevant MOCs

### Performance
- **Fast Processing**: Classification completes in < 1 second
- **Minimal Overhead**: Lightweight template with smart defaults
- **Fallback Safe**: Manual classification always available if auto-detection fails