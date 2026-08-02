---
type: moc
tags:
  - type/moc
  - area/resources
---

# 📚 Resources MOC

> Bookmarks, cheatsheets, external documentation links, policies, and reference material.

## 🛡️ System Guides & Security Policies
* [[06-Resources/Second Brain Guide|🧠 Second Brain Guide]] — System usage, routines, & architecture
* [[06-Resources/Vault Security Policy|🛡️ Vault Security Policy]] — Secret management, `.secrets/`, `.env`, & Git safety

---

## 🔗 Bookmarks & Reference Links
```dataview
TABLE source_type AS "Medium", category AS "Category", url AS "URL"
FROM "06-Resources"
WHERE file.name != "_Resources MOC" AND file.name != "Second Brain Guide" AND file.name != "Vault Security Policy"
SORT file.name ASC
```
