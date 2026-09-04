---
created: 2026-08-09
updated: 2026-09-04
type: moc
status: active
area: learning
cssclasses:
  - cards
tags:
  - type/moc
  - area/learning
---

# 📖 Learning Hub & Study Matrix

> *Knowledge acquisition in progress — active deep-dives, multi-week engineering cohorts, and reference courses. Once mastered, distill principles into [[08-Concepts/_Concepts MOC|08-Concepts]] or code patterns into [[03-Dev/_Dev MOC|03-Dev]].*

```dataviewjs
// 30-Day Learning Review Radar
const studies = dv.pages('"04-Learning"').where(p => p.type === "learning" && !p.file.name.includes("MOC"));
let dueCount = 0;
for (let s of studies) {
  const cycle = parseInt(s.review_cycle) || 30;
  const lastRev = s.last_reviewed ? moment(s.last_reviewed) : moment(s.file.cday);
  if (moment().diff(lastRev, 'days') > cycle) dueCount++;
}
if (dueCount > 0) {
  dv.paragraph(`⚠️ **${dueCount} learning topic(s) past their review cycle!** Review them to reinforce active recall.`);
} else {
  dv.paragraph(`✨ **All active study topics are fresh and up to date within their review cycle.**`);
}
```

---

## 🎯 Technical Deep-Dives & Applied Studies
*Standalone architectural and database studies applied across active production repositories.*

```dataview
TABLE 
  topic AS "Topic",
  platform_author AS "Platform / Author",
  progress AS "Progress",
  source_url AS "Source",
  choice(last_reviewed, last_reviewed, file.mtime) AS "Last Reviewed"
FROM "04-Learning"
WHERE file.name != "_Learning MOC" AND file.folder = "04-Learning" AND status = "in-progress"
SORT file.mtime DESC
```

---

## 🚀 Multi-Week Programs & Cohorts
*Intensive acceleration tracks, cohort syllabi, and multi-sprint engineering curricula.*

```dataview
LIST WITHOUT ID "🤖 **Program Cockpit**: " + file.link + " (" + choice(status, status, "active") + ")"
FROM "04-Learning"
WHERE contains(file.name, "MOC") AND file.name != "_Learning MOC"
```

```dataview
TABLE 
  topic AS "Topic / Module",
  status AS "Status",
  progress AS "Progress",
  review_cycle AS "Cadence",
  choice(last_reviewed, last_reviewed, updated) AS "Last Reviewed"
FROM "04-Learning"
WHERE !contains(file.name, "MOC") AND file.folder != "04-Learning"
SORT file.folder ASC, file.name ASC
```

---

## ✅ Completed Studies & Reference Archive
*Mastered topics, completed RFC implementations, and production reference materials.*

```dataview
TABLE 
  topic AS "Topic",
  platform_author AS "Platform / Author",
  source_url AS "Source",
  choice(last_reviewed, last_reviewed, updated) AS "Date Completed"
FROM "04-Learning"
WHERE file.name != "_Learning MOC" AND status = "completed"
SORT choice(last_reviewed, last_reviewed, updated) DESC
```

---

## 💡 Learning Workflows & Capture

- **Inbox Quick Capture**: Append `#learn` to any line or link in [[00-Inbox/quick-capture-dump|quick-capture-dump.md]] and run `QuickAdd: 🧹 Triage Sweep`.
- `Ctrl + P` → **QuickAdd: 📖 Create Learning Note** — Scaffolds a new study topic using [`99-Templates/Learning.md`](file:///c:/Users/jonel/Documents/loey_space/99-Templates/Learning.md).
- **Distillation to Second Brain**:
  - Distill mental models & principles into [[08-Concepts/_Concepts MOC|08-Concepts]] using `npm run distill` or `hey loey distill`.
  - Extract reusable utilities and middleware into [[03-Dev/_Dev MOC|03-Dev]] using Chief of Staff commands.
