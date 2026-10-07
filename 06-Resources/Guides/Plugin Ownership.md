---
created: 2026-10-04
updated: 2026-10-08
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

**Recorded version (2026-10-08, [#117](https://github.com/lowqualityloey/loey_space/issues/117)):** the vendored bundle in the index is **`1.0.2` plus the owned prelude** — the last known-good integration. A store update to **`1.0.6` was rejected, not merged**: it removed the prelude *and* every call site, so the widget's habit/focus bridge was dead code in it. The rejected files are kept out of Git at `.tmp.homepulse-1.0.6/` for reference. Re-run `npm run patch-homepulse` before trusting any future update (it refuses when the seam is gone).
| `kanban-status-sync` | This repository | ✅ Yes, plain JS, no build step | Fully local |
| All other `.obsidian/plugins/*` | Upstream plugin stores | ❌ No | None — vendor as-is |

`homepulse` is derived from [jukkau/HomePulse](https://github.com/jukkau/HomePulse); its manifest declares `author: Yuki`. Treat the upstream project — not this vault — as the maintainer of record for the plugin itself.

---

## 2. Recorded blocker: no authoritative HomePulse source

The bundle's first line reads `THIS FILE IS GENERATED FROM src/main.ts. DO NOT EDIT main.js DIRECTLY.`, but **no such source exists anywhere on the maintainer's machine**. Discovery on 2026-10-03 found:

| Check | Result |
| :--- | :--- |
| Source files in the plugin folder (`.ts`, `src/`, bundler config) | None — only `main.js`, `manifest.json`, `styles.css`, plus ignored `data.json` |
| HomePulse source under the owner's home directory (searched to depth 6, excluding `node_modules`) | Not found |
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

**Canonical source:** `.obsidian/plugins/homepulse/prelude.js` holds both owned blocks (habit sync at the top, the `Today's Focus` bridge below) as readable source. It is injected into `main.js` by [`06-Resources/scripts/apply-homepulse-prelude.mjs`](06-Resources/scripts/apply-homepulse-prelude.mjs) (`npm run patch-homepulse`), so a lost prelude is re-applied from one reviewed file instead of recovered by hand out of Git history.

---

## 4. After a plugin update

1. Run `npm test`. Two guards fail if the bundle lost the prelude *or* the call sites: `homepulse bundle keeps its locally owned prelude` and `homepulse core still calls the owned bridge`.
2. Run `npm run patch-homepulse`. It verifies the call sites **before** writing anything:
   - **call sites intact →** it injects `.obsidian/plugins/homepulse/prelude.js` right after `"use strict";`, checks the result with `node --check`, and rolls the file back if the result does not parse.
   - **call sites gone →** it exits 1 and injects nothing. The seam changed; adding the prelude would produce a green guard over a dead bridge.
3. Re-run `npm test` until green, then record the tested version in §1 — including when the outcome is *not* adopting the update.

### Why the call-site gate exists (#117)

The 1.0.6 store update deleted the prelude and all three call sites (`syncHabitsToFiles`, `readTodayFocusFromNote`, `saveTodayFocusToNote` → 0 occurrences each). The original guard only asserted the markers, so re-injecting the prelude text would have restored those markers, turned the suite green, and left habit and focus sync broken — a false green produced by the very check meant to catch the loss. The guard now asserts the core still references each symbol at the counts measured on the known-good build (2 / 2 / 3).

> [!WARNING]
> The guard still detects a *lost* or *unwired* prelude, not a *changed* one. If an update ships a prelude with the same symbol names but different behaviour, or calls it from a different path, review `syncHabitsToFiles` and the focus bridge against §3 by hand before trusting the widgets.

---

## 🔗 Related

* [[06-Resources/Guides/CONTRIBUTING]]
* [[06-Resources/Guides/Vault Security Policy]]
* [[06-Resources/scripts/tests/homepulse-prelude.test.mjs]]