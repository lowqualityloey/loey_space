---
type: moc
tags:
  - type/moc
  - area/projects
---

# 🚀 Projects MOC

> Dashboard of active development, planning, and completed projects.

## 🟢 Active Projects
```dataviewjs
const projects = dv.pages('"02-Projects"').where(p => p.type === "project" && (p.status === "in-progress" || p.status === "active"));
const rows = [];

const priorityWeight = { "critical": 4, "high": 3, "medium": 2, "low": 1, "none": 0 };

projects.forEach(p => {
    const folder = p.file.folder;
    let totalTasks = 0;
    let completedTasks = 0;
    
    // Aggregate tasks from all notes within the project's specific folder
    const folderPages = dv.pages(`"${folder}"`);
    folderPages.forEach(page => {
        if (page.file.tasks && page.file.tasks.length > 0) {
            totalTasks += page.file.tasks.length;
            completedTasks += page.file.tasks.where(t => t.completed).length;
        }
    });

    let progressStr = "No tasks";
    if (totalTasks > 0) {
        const percent = Math.round((completedTasks / totalTasks) * 100);
        const filled = Math.floor(percent / 10);
        const empty = 10 - filled;
        const bar = "█".repeat(filled) + "░".repeat(empty);
        progressStr = `\`[${bar}] ${percent}%\` (${completedTasks}/${totalTasks})`;
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

## 📝 Planning & Backlog
```dataview
TABLE area AS "Area", priority AS "Priority"
FROM "02-Projects"
WHERE type = "project" AND status = "planning"
SORT priority DESC
```

## ✅ Completed Projects
```dataview
TABLE updated AS "Completed Date", area AS "Area"
FROM "02-Projects"
WHERE type = "project" AND status = "completed"
SORT file.mtime DESC
```
