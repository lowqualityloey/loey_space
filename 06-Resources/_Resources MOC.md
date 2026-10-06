---
created: 2026-08-09
updated: 2026-09-01
type: moc
status: active
area: resources
cssclasses:
  - cards
tags:
  - type/moc
  - area/resources
---

# 📚 Resources & Reference Hub

> *Reference material, vault operating guides, API specifications, web-clipped articles, and automation tools. Things you refer to or run, not things you are actively building.*

---

## 🛡️ Vault Guides, Systems & Policies
*Internal operating manuals, system workflows, and security standards (from `06-Resources/Guides/`).*

```dataview
TABLE 
  type AS "Type",
  choice(updated, updated, file.mtime) AS "Last Updated"
FROM "06-Resources/Guides"
SORT file.name ASC
```

---

## 👤 Owner-Only Reference Notes
*Private handoff records, session telemetry, and owner-only reference material for external repositories (from `06-Resources/Guides/Owners/`).*

```dataview
TABLE 
  type AS "Type",
  choice(updated, updated, file.mtime) AS "Last Updated"
FROM "06-Resources/Guides/Owners"
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
FROM "06-Resources/Articles"
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

## ⚙️ Vault CLI & Automation Tooling
*Executable developer automation tools built with TypeScript & CommonJS in `06-Resources/scripts/`:*

| Command | Purpose |
| :--- | :--- |
| `npm test` | Run the complete automated test suite across parsers, tools, and documentation guards (reports the current count; not restated here because it changes with every added test) |
| `npm run audit-links` | Audit vault-wide wikilinks, attachments, and verify 0 broken links |
| `npm run validate-templates` | Validate all 19 Templater blueprints against schema standards |
| `npm run log-github` | Non-destructively sync today's GitHub commits & PRs to today's daily log |
| `npm run sync-kanban` | Synchronize project Kanban boards with GitHub Projects v2 |
| `npm run build` | Recompile TypeScript scripts to production CommonJS bundles via `esbuild` |

> [!NOTE] Not every bundled script is a CLI command
> A script is a CLI command only if it is **declared in `package.json`** and reads its
> arguments from `process.argv`. `weekly-ai-summary.js`, `triage-sweep.js`, and
> `ai-enrich-action.js` are declared nowhere and have no `process.argv` fallback: they
> read `app.vault` and the Obsidian `Notice` API, so `node` cannot run them. Reach them
> from the command palette (**QuickAdd**), not from a terminal. By contrast `distill`,
> `log-github`, `sync-kanban`, and `start-task` are declared scripts that guard for a
> missing Obsidian host and do work from a terminal.
>
> A `documented-commands` test enforces the first half of this rule: every npm script
> invocation promised in tracked documentation must be declared in `package.json`.

---

## 🔖 Developer & Reference Bookmarks
* [GitHub Repository — lowqualityloey/loey_space](https://github.com/lowqualityloey/loey_space) — Official source repository and backup.
* [OpenWeatherMap API Docs](https://openweathermap.org/api/one-call-4?collection=one_call_api) — API specifications for the weather dashboard project.
* [Obsidian Dataview Documentation](https://blacksmithgu.github.io/obsidian-dataview/) — Query language syntax reference.

