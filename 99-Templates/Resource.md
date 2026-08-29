---
created: <% tp.date.now("YYYY-MM-DD") %>
updated: <% tp.date.now("YYYY-MM-DD") %>
type: resource
status: active
area: resources
source: ""
author: ""
published: ""
tags:
  - type/resource
  - area/resources
  - status/active
---

# <% tp.file.title %>

**Resource URL**: <% tp.frontmatter.source %>
**Author / Source**: <% tp.frontmatter.author %>
**Published Date**: <% tp.frontmatter.published %>

## 💡 Overview & TL;DR
Short description of the resource and what it offers.

## ✍️ Key Takeaways & Highlights
- 
- 
- 

## 📖 Content / Notes
- 

## 🔗 Related References
- [[ ]]

## 🔄 Auto-Backlinks
```dataview
LIST
FROM [[]] AND !"99-Templates"
WHERE file.name != this.file.name
SORT file.mtime DESC
```
