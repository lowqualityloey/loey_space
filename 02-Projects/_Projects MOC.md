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

const projects = dv.pages('"02-Projects"')
    .where(p => p.type === "project" && !p.file.name.includes("Kanban") && !p.file.name.includes("MOC") && ACTIVE_STATUSES.includes(normalize(p.status)));

const rows = [];
const priorityWeight = { "critical": 4, "high": 3, "medium": 2, "low": 1, "none": 0 };

projects.forEach(p => {
    const folder = p.file.folder;
    let totalTasks = 0;
    let completedTasks = 0;

    // Aggregate tasks from all notes within the project's specific folder.
    // Backlog (not committed) and Archive (historical) are excluded so progress
    // reflects the work actually in flight, matching _Tasks MOC's scope.
    const folderPages = dv.pages(`"${folder}"`);
    folderPages.forEach(page => {
        if (page.file.tasks && page.file.tasks.length > 0) {
            const counted = page.file.tasks.where(t => {
                const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
                return !sec.includes("backlog") && !sec.includes("archive");
            });
            totalTasks += counted.length;
            completedTasks += counted.where(t => t.completed).length;
        }
    });

    let progressStr = "No tasks";
    if (totalTasks > 0) {
        const percent = Math.round((completedTasks / totalTasks) * 100);
        progressStr = `<progress value="${percent}" max="100"></progress> ${percent}% (${completedTasks}/${totalTasks})`;
    }
    
    rows.push({
        link: p.file.link,
        progress: progressStr,
        status: p.status,
        priority: p.priority || "none",
        weight: priorityWeight[p.priority] || 0
    });
});

// Sort by priority weight descending
rows.sort((a, b) => b.weight - a.weight);

dv.table(["Project", "Progress", "Status", "Priority"], rows.map(r => [r.link, r.progress, r.status, r.priority]));
```

---

## 📝 Planning & Backlog
```dataview
TABLE area AS "Area", priority AS "Priority"
FROM "02-Projects"
WHERE type = "project" AND status = "planning" AND !contains(file.name, "Kanban") AND !contains(file.name, "MOC")
SORT priority DESC
```

---

## ✅ Completed Projects
```dataview
TABLE choice(updated, updated, file.mtime) AS "Completed Date", area AS "Area"
FROM "02-Projects"
WHERE type = "project" AND status = "completed" AND !contains(file.name, "Kanban") AND !contains(file.name, "MOC")
SORT file.mtime DESC
```
