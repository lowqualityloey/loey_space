---
type: moc
tags:
  - type/moc
  - area/resources
  - topic/api
---

# 🔌 API & Integration Documentation MOC

Central catalog of API documentation, technical specs, rate limits, and setup guides — a `06-Resources/` subfolder for anything you integrate against.

> ⚠️ **Security Notice**: Actual API keys and credentials are **NEVER** stored in these notes. Refer to `.env` (for scripts) or `.secrets/` (for human-readable private credentials). See [[Vault Security Policy]].

---

## 📡 API Integrations Catalog
```dataview
TABLE category AS "Category", status AS "Status", updated AS "Last Updated"
FROM "06-Resources/APIs"
WHERE file.name != "_APIs MOC"
SORT file.name ASC
```
