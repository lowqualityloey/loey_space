---
type: moc
cssclasses:
  - cards
tags:
  - type/moc
  - area/resources
updated: 2026-08-29
---

# 📚 Resources & Reference Hub

> Reference material, system documentation, API specifications, web-clipped articles, and automation tools. Things you *refer to* or *run*, not things you are *working on*.

---

## 🛡️ Vault Guides, Systems & Policies
*Internal operating manuals, system workflows, and security standards.*

```dataview
TABLE 
  type AS "Type",
  choice(updated, updated, file.mtime) AS "Last Updated"
FROM "06-Resources"
WHERE file.name != "_Resources MOC" 
  AND !contains(file.path, "Articles")
  AND !contains(file.path, "APIs")
  AND (type = "guide" OR contains(tags, "topic/guide") OR file.name = "Vault Security Policy" OR file.name = "Second Brain Guide" OR file.name = "Tagging & Properties" OR file.name = "CONTRIBUTING")
SORT file.name ASC
```

---

## 📰 Clipped Web Articles & Technical Reads
*Articles, tutorials, and technical insights captured via Obsidian Web Clipper or `#ref` triage.*

```dataview
TABLE 
  author AS "Author / Source",
  source AS "URL",
  choice(published, published, file.ctime) AS "Published / Clipped"
FROM "06-Resources"
WHERE file.name != "_Resources MOC" 
  AND !contains(file.path, "APIs")
  AND (contains(file.path, "Articles") OR type = "resource" OR source != null)
  AND type != "guide"
  AND !contains(file.name, "Policy")
  AND !contains(file.name, "Guide")
  AND !contains(file.name, "CONTRIBUTING")
  AND !contains(file.name, "Tagging")
SORT file.ctime DESC
```

---

## 🔌 APIs & Technical Specifications
*Live API documentation and integration endpoints (from `06-Resources/APIs/`).*

```dataview
TABLE 
  auth_type AS "Auth",
  rate_limit AS "Rate Limit",
  choice(updated, updated, file.mtime) AS "Updated"
FROM "06-Resources/APIs"
WHERE file.name != "_APIs MOC" AND !contains(file.name, "MOC")
SORT file.name ASC
```

---

## ⚙️ Automation Scripts & Clipper Blueprints
*Vault automation tools in `scripts/` and browser clipping profiles in `clipper-templates/`.*

* **Automation Scripts**: `ai-enrich-action.js`, `triage-sweep.js`, `validate-templates.js`, `weekly-ai-summary.js`
* **Web Clipper Profiles**: `resource-article.json`, `youtube-video.json`, `github-repo.json`, `dev-guide.json`

---

## 🔖 Web Bookmarks
* [github.com/lowqualityloey/loey_space](https://github.com/lowqualityloey/loey_space)
* [openweathermap.org](https://openweathermap.org/api/one-call-4?collection=one_call_api)

