---
type: moc
tags:
  - type/moc
  - area/resources
updated: 2026-08-09
---

# 📚 Resources MOC

> Reference material **and** working automation — cheatsheets, guides, policies, bookmarks, API specs in `APIs/`, and live scripts in `scripts/`. Things you *refer to* or *run*, not things you're *working on*.

## 🛡️ System Guides & Security Policies
* [[06-Resources/Second Brain Guide|🧠 Second Brain Guide]] — System usage, routines, & architecture
* [[06-Resources/Vault Security Policy|🛡️ Vault Security Policy]] — Secret management, `.secrets/`, `.env`, & Git safety

---

## 🔖 Web Bookmarks
* [github.com](https://github.com/lowqualityloey/loey_space)
* [openweathermap.org](https://openweathermap.org/api/one-call-4?collection=one_call_api)
## 📂 Resource Index & Documentation Catalog

```dataview
TABLE 
  type AS "Type", 
  choice(category, category, area) AS "Category", 
  choice(updated, updated, file.mtime) AS "Last Updated"
FROM "06-Resources"
WHERE file.name != "_Resources MOC" AND !contains(file.name, "MOC")
SORT updated DESC, file.mtime DESC
```
