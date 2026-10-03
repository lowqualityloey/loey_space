---
created: 2026-10-04
updated: 2026-10-04
type: resource
area: resources
status: active
tags:
  - type/resource
  - area/resources
  - topic/obsidian
  - topic/plugins
---

# 🔌 Plugin Ownership & Provenance

Which bundled plugin code this vault owns, which comes from upstream, and how to re-apply local changes after a plugin update. Written for [#36](https://github.com/lowqualityloey/loey_space/issues/36); enforced by a drift guard in the test suite.

> [!IMPORTANT]
> Read this before updating any bundled plugin. Updating from a store or upstream repo replaces files wholesale and will silently drop local changes unless you re-apply them here.

---

## 1. Provenance

| Plugin | Source of truth | Local build possible | Ownership |
| :--- | :--- | :--- | :--- |
| `homepulse` | ⚠️ **No authoritative source available** (see §2) | ❌ No | Prelude only — see §3 |
| `kanban-status-sync` | This repository | ✅ Yes, plain JS, no build step | Fully local |
| All other `.obsidian/plugins/*` | Upstream plugin stores | ❌ No | None — vendor as-is |

`homepulse` is derived from [jukkau/HomePulse](https://github.com/jukkau/HomePulse); its manifest declares `author: Yuki`. Treat the upstream project — not this vault — as the maintainer of record for the plugin itself.

---

## 2. Recorded blocker: no authoritative HomePulse source

The bundle's first line reads `THIS FILE IS GENERATED FROM src/main.ts. DO NOT EDIT main.js DIRECTLY.`, but **no such source exists anywhere on the maintainer's machine**. Discovery on 2026-10-03 found:

| Check | Result |
| :--- | :--- |
| Source files in the plugin folder (`.ts`, `src/`, bundler config) | None — only `main.js`, `manifest.json`, `styles.css`, plus ignored `data.json` |
| HomePulse source under `/home/heyloey` (searched to depth 6, excluding `node_modules`) | Not found |
| Declared build config (`tsconfig`, `rollup`, `esbuild`) in the plugin folder | None |
| Prior guidance in `CONTRIBUTING.md` | "ships as a built, minified `main.js` with no source in this repo … open an issue instead of a PR" |

**Owner decision (2026-10-03):** proceed on the **vendor path** — the readable prelude is the locally owned seam. No upstream source was reconstructed or invented, and no upstream PR was filed.

**Consequence:** local changes to `homepulse` are made against generated output. They are therefore kept minimal, isolated to the prelude, and covered by a test so a future bundle update cannot drop them unnoticed.

---

## 3. The locally owned prelude

Everything before the first minified line of `.obsidian/plugins/homepulse/main.js` is readable, hand-maintained JavaScript that this vault owns and patches:

| Symbol | Purpose | Vault patch |
| :--- | :--- | :--- |
| `getLocalDateStr()` | Local `YYYY-MM-DD` date key | — |
| `syncHabitsToFiles()` | Mirrors a habit toggle into the **dated** daily note | [#37](https://github.com/lowqualityloey/loey_space/issues/37) — must never write the template |
| `readTodayFocusFromNote()` / `saveTodayFocusToNote()` | "Today's Focus" widget ↔ daily note bridge | — |

**Rule:** dated observations go in the dated note. `99-Templates/Daily.md` holds *defaults* only and must always stay unchecked, so a new day starts clean.

The minified core after the prelude is upstream-generated and must not be hand-edited.

---

## 4. After a plugin update

1. Run `npm test`. The `homepulse bundle keeps its locally owned prelude` guard fails if the prelude markers are gone.
2. If it fails, re-apply the patches listed in §3 against the new bundle. Keep them in the prelude; never touch the minified core.
3. Re-run `npm test` until green, then record the new version in §1.

The guard is `06-Resources/scripts/tests/homepulse-prelude.test.mjs`. It asserts the prelude symbols exist, the bundle still parses (`node --check`), and the manifest identity is readable.

> [!WARNING]
> The guard detects a *lost* prelude, not a *changed* one. If an update ships a prelude with the same symbol names but different behaviour, review `syncHabitsToFiles` by hand against §3 before trusting the habit widget.

---

## 🔗 Related

* [[06-Resources/Guides/CONTRIBUTING]]
* [[06-Resources/Guides/Vault Security Policy]]
* [[06-Resources/scripts/tests/homepulse-prelude.test.mjs]]