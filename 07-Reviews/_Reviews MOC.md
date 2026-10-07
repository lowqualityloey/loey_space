---
created: 2026-08-09
updated: 2026-10-08
type: moc
status: active
area: reviews
cssclasses:
  - cards
tags:
  - type/moc
  - area/reviews
---

# 📊 Reviews & Analytics Hub

> *Periodic retrospectives and longitudinal health tracking — weekly (`YYYY-[W]WW.md`) and monthly (`YYYY-MM.md`) reviews, retrospectives, and 30-day habit analytics.*

> [!INFO] How a review is classified (#126)
> Each review declares its **`kind`** in frontmatter — `weekly`, `monthly`, or `audit`.
> Weekly history below shows only genuine weekly records, so an architecture review or a
> vault audit can never be counted as a weekly retrospective. A review written before
> `kind` existed is classified by its **name** (`YYYY-Www` → weekly, `YYYY-MM` → monthly)
> and a note matching neither stays out of both histories. The full rule and the legacy
> compatibility table live in [[06-Resources/Guides/Tagging & Properties|Tagging & Properties]].

---

## 📈 Performance & Habit Analytics
- [[07-Reviews/Habit Analytics Dashboard|📊 Habit Analytics Dashboard]] — 30-day completion rates, streak tracking, day-of-week heatmaps & trend insights.
- [[Home|🏠 Central Command Hub]] — Master vault dashboard.
- [[01-Daily/_Daily MOC|📅 Daily Notes MOC]] — Daily journal entries and 14-day vitals pulse.

---

## 📅 Past Weekly Reviews

```dataviewjs
// #126 review classification — keep this block identical in every review selector
// below; `tests/weekly-review-period.test.mjs` fails if the copies drift apart.
function reviewKind(page) {
  const declared = page && page.kind != null ? String(page.kind).toLowerCase().trim() : "";
  if (declared) return declared;
  // Legacy compatibility (see `06-Resources/Guides/Tagging & Properties.md`): a
  // review written before `kind` existed is classified by its NAME only.
  const name = page && page.file ? String(page.file.name) : "";
  if (/^\d{4}-W\d{1,2}$/.test(name)) return "weekly";
  if (/^\d{4}-\d{2}$/.test(name)) return "monthly";
  return "";
}

function isReviewRecord(page) {
  if (!page || !page.file) return false;
  return !/^(?:_Reviews MOC|Habit Analytics Dashboard|Tasks Kanban)$/.test(page.file.name);
}
// end #126 review classification

const rows = dv.pages('"07-Reviews"')
  .where((p) => isReviewRecord(p) && reviewKind(p) === "weekly")
  .sort((p) => p.file.name, "desc")
  .map((p) => [p.file.link, p.updated != null ? p.updated : p.file.mtime, p.file.ctime]);

if (rows.length === 0) {
  dv.paragraph("No weekly reviews found.");
} else {
  dv.table(["Weekly Review", "Last Modified", "Created Date"], rows);
}
```

---

## 🏆 Past Monthly Reviews

```dataviewjs
// #126 review classification — keep this block identical in every review selector
// below; `tests/weekly-review-period.test.mjs` fails if the copies drift apart.
function reviewKind(page) {
  const declared = page && page.kind != null ? String(page.kind).toLowerCase().trim() : "";
  if (declared) return declared;
  // Legacy compatibility (see `06-Resources/Guides/Tagging & Properties.md`): a
  // review written before `kind` existed is classified by its NAME only.
  const name = page && page.file ? String(page.file.name) : "";
  if (/^\d{4}-W\d{1,2}$/.test(name)) return "weekly";
  if (/^\d{4}-\d{2}$/.test(name)) return "monthly";
  return "";
}

function isReviewRecord(page) {
  if (!page || !page.file) return false;
  return !/^(?:_Reviews MOC|Habit Analytics Dashboard|Tasks Kanban)$/.test(page.file.name);
}
// end #126 review classification

const rows = dv.pages('"07-Reviews"')
  .where((p) => isReviewRecord(p) && reviewKind(p) === "monthly")
  .sort((p) => p.file.name, "desc")
  .map((p) => [p.file.link, p.updated != null ? p.updated : p.file.mtime, p.file.ctime]);

if (rows.length === 0) {
  dv.paragraph("No monthly reviews found.");
} else {
  dv.table(["Monthly Review", "Last Modified", "Created Date"], rows);
}
```

---

## 🗂️ System & Architecture Audits

> Distinct from the retrospective histories above: a system or architecture audit is
> point-in-time evidence about the vault itself, not a weekly/monthly retrospective. It
> is selected by `kind: audit`, so it is reachable here and excluded from both histories.

```dataviewjs
// #126 review classification — keep this block identical in every review selector
// below; `tests/weekly-review-period.test.mjs` fails if the copies drift apart.
function reviewKind(page) {
  const declared = page && page.kind != null ? String(page.kind).toLowerCase().trim() : "";
  if (declared) return declared;
  // Legacy compatibility (see `06-Resources/Guides/Tagging & Properties.md`): a
  // review written before `kind` existed is classified by its NAME only.
  const name = page && page.file ? String(page.file.name) : "";
  if (/^\d{4}-W\d{1,2}$/.test(name)) return "weekly";
  if (/^\d{4}-\d{2}$/.test(name)) return "monthly";
  return "";
}

function isReviewRecord(page) {
  if (!page || !page.file) return false;
  return !/^(?:_Reviews MOC|Habit Analytics Dashboard|Tasks Kanban)$/.test(page.file.name);
}
// end #126 review classification

const rows = dv.pages('"07-Reviews"')
  .where((p) => isReviewRecord(p) && reviewKind(p) === "audit")
  .sort((p) => p.file.name, "desc")
  .map((p) => [p.file.link, p.updated != null ? p.updated : p.file.mtime]);

if (rows.length === 0) {
  dv.paragraph("No system or architecture audits found.");
} else {
  dv.table(["System / Architecture Review", "Last Modified"], rows);
}
```

---

## 💡 Review Workflows & Automation

- `Ctrl + P` → **QuickAdd: 📊 Weekly AI Summary** — Automatically aggregates the last 7 daily notes, GitHub pushes, and habit data into a structured weekly retrospective. Runs **inside Obsidian** and needs both the QuickAdd plugin and a valid `GEMINI_API_KEY` in `.env`; see [`Weekly AI Summary Guide.md`](../06-Resources/Guides/Weekly%20AI%20Summary%20Guide.md) to register the macro.
- `hey loey weekly` — Directs the AI Chief of Staff to synthesize this week's highlights and milestones.

---

## Architecture & System Reviews

Pinned links to the narrative audits (kept explicit so they stay reachable even before a
`kind: audit` field is added to their frontmatter):

- [[2026-10-04 Vault Architecture Review]] — Second brain structure, project continuity, workflows, privacy, recovery, and improvement priorities.
- [[2026-10-04 Vault Improvement Issue Register]] — GitHub implementation backlog, priorities, dependencies, and local-only follow-through.

> [!NOTE] The weekly summary has no CLI entry point
> The weekly aggregation is an Obsidian action, not an npm script. `weekly-ai-summary.js` reads `app.vault` and the Obsidian `Notice` API, so it cannot run under plain `node`. Invoke it through QuickAdd as described above.
