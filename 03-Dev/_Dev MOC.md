---
type: moc
tags:
  - type/moc
  - area/dev
---

# 💻 Dev MOC

> Technical work and code-related knowledge — snippets, patterns, debugging tips, and architecture decisions. ✨ AI-enrichable with `Ctrl + Shift + A`.

## 🛠️ Code Snippets
```dataview
TABLE language AS "Language", tags AS "Tags", updated AS "Last Updated"
FROM "03-Dev"
WHERE type = "snippet" OR contains(tags, "type/snippet")
SORT file.name ASC
```

## 📚 Technical Notes & Architecture
```dataview
TABLE tags AS "Tags", file.mtime AS "Modified"
FROM "03-Dev"
WHERE file.name != "_Dev MOC" AND type != "snippet" AND !contains(tags, "type/snippet")
SORT file.mtime DESC
```
