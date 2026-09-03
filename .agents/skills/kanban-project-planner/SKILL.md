---
name: kanban-project-planner
description: >-
  Decomposes project goals and features into actionable subtasks with priority tags (#priority/p0-p3),
  maintains Kanban board lanes (To Do, In Progress, Done), preserves Kanban Status Sync conventions,
  and reconciles cards with GitHub Projects v2.
---

# 🚀 Kanban Project Planner Skill

This skill guides the agent in breaking down project specifications into actionable tasks, managing Kanban board states, and syncing with GitHub Projects v2.

---

## 🎯 When to Activate
- The user asks to plan, breakdown, or add new tasks/features for a project in `02-Projects/`.
- The user asks to reorganize Kanban lanes or check task statuses across active boards.
- The user requests synchronizing Obsidian Kanban cards with GitHub Projects v2.

---

## 📋 Procedure

### Step 1: Feature Decomposition & Task Sizing
- Break large features into independent, deliverable sub-tasks taking 1–4 hours of work.
- Tag tasks with standard priorities:
  - `#priority/p0`: Blocker / critical path
  - `#priority/p1`: High priority / core functionality
  - `#priority/p2`: Medium priority / enhancements
  - `#priority/p3`: Nice-to-have / polish

### Step 2: Kanban Card Formatting & Status Markers
Strictly adhere to the **Kanban Status Sync** conventions:
- **`## Backlog`**: `- [ ] <Task description> #priority/pX`
- **`## To Do`**: `- [ ] <Task description> #priority/pX`
- **`## In Progress`**: `- [/] <Task description> #priority/pX`
- **`## Review / Test`**: `- [/] <Task description> #priority/pX`
- **`## Done`**: `- [x] <Task description> #priority/pX ✅ YYYY-MM-DD`
- **`## Archive`**: Deprecated or historic tasks.

### Step 3: Inserting into Project Kanban Board
1. Open the project's Kanban note (e.g. `02-Projects/<name>/<name> Kanban.md`).
2. Insert new task items under the appropriate lane heading without modifying unrelated cards.
3. Ensure task text remains clean and uncorrupted so DataviewJS mirrors in daily notes continue functioning.

### Step 4: GitHub Projects v2 Sync (Optional)
If the board contains frontmatter for GitHub Projects:
```yaml
---
kanban-plugin: board
github_project_number: 4
github_owner: lowqualityloey
---
```
Run or simulate `06-Resources/scripts/sync-github-kanban.js` to push newly created cards to GitHub Issues/Projects v2 or pull remote state.
