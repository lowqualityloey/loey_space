---
created: 2026-08-09
updated: 2026-09-05
type: moc
status: active
area: projects
cssclasses:
  - cards
tags:
  - type/moc
  - area/projects
---
	
# 🚀 Projects MOC & Engineering Hub

> *Outcomes with deadlines or defined endpoints. One subfolder per project, each with a project note and a Kanban board. Finished cards move to the board's own `## Archive` column — retrospectives live in `07-Reviews/`.*

---

## ⚡ Quick Navigation & Boards
- [[Home|🏠 Central Command Hub]] — Master dashboard.
- [[01-Daily/Tasks Kanban|📋 Live Tasks Kanban Board]] — Active drag-and-drop task board across all projects.
- [[01-Daily/_Tasks MOC|📋 Tasks MOC & History]] — Central task matrix & completion analytics.

---

## 🟢 Active Projects
```dataviewjs
// Status is matched loosely: "in progress", "in-progress", "active" and "doing"
const ACTIVE_STATUSES = ["in progress", "active", "doing", "wip"];
const normalize = (value) => String(value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

// Commitments and criteria come from the shared authority, never from a local count.
new Function("module", "exports", await dv.io.load("06-Resources/scripts/task-view.js"))({}, {});
const TV = globalThis.TaskView;
if (!TV) throw new Error("task-view.js did not load — run `npm run build` and commit the bundle.");

const projects = dv.pages('"02-Projects"')
    .where(p => p.type === "project" && !p.file.name.includes("Kanban") && !p.file.name.includes("MOC") && ACTIVE_STATUSES.includes(normalize(p.status)));

const rows = [];
// Canonical priority ranks, from `Tagging & Properties.md` § 5. That taxonomy
// sanctions TWO vocabularies for the same four levels — p0-p3 and the equivalent
// critical/high/medium/low — and project notes in the wild carry either. This map
// used to hold only the word forms, so the `|| 0` at the consumption site below
// scored every `p0` note as 0 and silently ranked 7 real projects least important.
const priorityWeight = {
  p0: 4, critical: 4,
  p1: 3, high: 3,
  p2: 2, medium: 2,
  p3: 1, low: 1,
  none: 0
};

projects.forEach(p => {
    const folder = p.file.folder;

    // Collect every task in the project folder and let the shared authority
    // classify it: board cards are commitments, master-note checklist items are
    // the project's criteria. Backlog and Archive stay shielded inside the
    // authority, so this still reflects work in flight — but the two levels are
    // reported apart rather than as one blended ratio, and a planning project
    // therefore reports zero commitment progress.
    const items = [];
    dv.pages(`"${folder}"`).forEach(page => {
        if (!page.file.tasks || page.file.tasks.length === 0) return;
        for (const t of page.file.tasks) {
            items.push(TV.normalizeTask(t, page.file.path));
        }
    });

    const summary = TV.summarizeProgress(items, { projectLifecycle: p.status });

    let progressStr = "No commitments";
    if (summary.commitments.total > 0) {
        const percent = Math.round((summary.commitments.done / summary.commitments.total) * 100);
        progressStr = `<progress value="${percent}" max="100"></progress> ${percent}% (${summary.commitments.done}/${summary.commitments.total})`;
    }
    const criteriaStr = summary.criteria.total > 0
        ? `${summary.criteria.done}/${summary.criteria.total}`
        : "—";

    rows.push({
        link: p.file.link,
        progress: progressStr,
        criteria: criteriaStr,
        status: p.status,
        priority: p.priority || "none",
        weight: priorityWeight[String(p.priority || "").toLowerCase()] || 0
    });
});

// Sort by priority weight descending
rows.sort((a, b) => b.weight - a.weight);

dv.table(["Project", "Commitments", "Criteria", "Status", "Priority"], rows.map(r => [r.link, r.progress, r.criteria, r.status, r.priority]));
```

---

## 📝 Planning & Backlog
```dataview
TABLE area AS "Area", priority AS "Priority", choice(updated, updated, created) AS "Last Touched"
FROM "02-Projects"
WHERE type = "project" AND status = "planning" AND !contains(file.name, "Kanban") AND !contains(file.name, "MOC")
SORT priority DESC, file.mtime DESC
```

---

## ✅ Completed Projects
```dataview
TABLE choice(updated, updated, file.mtime) AS "Completed Date", area AS "Area"
FROM "02-Projects"
WHERE type = "project" AND status = "completed" AND !contains(file.name, "Kanban") AND !contains(file.name, "MOC")
SORT file.mtime DESC
```
