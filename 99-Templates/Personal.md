---
created: <% tp.date.now("YYYY-MM-DD") %>
updated: <% tp.date.now("YYYY-MM-DD") %>
last_reviewed: <% tp.date.now("YYYY-MM-DD") %>
review_cycle: 90d
type: personal
status: active
area: personal
category: hobbies
tags:
  - type/personal
  - area/personal
  - status/active
---

# <% tp.file.title %>

> **Category**: <% tp.frontmatter.category %> | **Status**: active | **Last Reviewed**: <% tp.date.now("YYYY-MM-DD") %>

---

## 🎯 Overview & Context
What is this note about? What is the goal, background, or context?

## 📝 Core Details & Content
- 

## ✅ Action Items & Next Steps
- [ ] 

## 🔗 Related References & Media
- [[ ]]

## 🔄 Auto-Backlinks
```dataview
LIST
FROM [[]] AND !"99-Templates"
WHERE file.name != this.file.name
SORT file.mtime DESC
```
