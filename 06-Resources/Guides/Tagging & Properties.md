---
created: 2026-08-06
updated: 2026-08-09
type: guide
area: system
tags:
  - type/guide
  - area/system
  - topic/taxonomy
  - topic/metadata
status: active
---

# 🏷️ Tagging & Properties System

> **Consistent metadata structure for effective note organization and discovery**

## Core Principles

1. **Namespaced Tags**: Use `namespace/value` format for all tags
2. **Standardized Properties**: Consistent YAML frontmatter across all note types
3. **Hierarchical Organization**: Clear relationships between categories
4. **Minimal Required Fields**: Only essential properties for each note type
5. **Automation Ready**: Structure supports automated workflows and queries

---

## 🎯 Standard Properties (YAML Frontmatter)

### Universal Properties (All Notes)
```yaml
---
created: YYYY-MM-DD              # Auto-generated at creation
updated: YYYY-MM-DD              # Auto-updated on save
type: note_type                  # Primary classification (see Type taxonomy)
area: area_name                  # Knowledge domain (see Area taxonomy)
status: status_name              # Lifecycle state (see Status taxonomy)
tags:                            # Tag collection
  - type/note_type
  - area/area_name
  - topic/subject_topic
---
```

### Optional Properties (Type-Specific)
```yaml
priority: low/medium/high        # For projects, tasks, learning
last_reviewed: YYYY-MM-DD        # For evergreen and learning notes
review_cycle: 7d/14d/30d/90d     # Review frequency
language: javascript/typescript  # For code snippets
energy: 1-5                      # For daily notes (numeric energy level)
mood: calm/focused/anxious/...   # For daily notes (mood description)
sleep_hours: number              # For daily notes (sleep duration in hours)
source_url: string              # For learning notes & web references
platform_author: string         # Platform, instructor, or author for learning notes
progress: string                # Completion progress (e.g. "85%", "100%", "2/4 Weeks")
```

---

## 🏷️ Tag Taxonomy

### 1. Type Taxonomy (`type/*`)
Primary classification of note purpose and structure

| Tag | Description | When to Use |
|-----|-------------|-------------|
| `type/dashboard` | Central hub pages | Home, MOCs, dashboards |
| `type/project` | Active development projects | Software projects, initiatives |
| `type/learning` | Educational content | Course notes, tutorials |
| `type/snippet` | Code snippets & patterns | Reusable code examples |
| `type/resource` | External references | APIs, libraries, tools |
| `type/concept` | Evergreen concepts | Core ideas, mental models |
| `type/review` | Reflection & assessment | Weekly/monthly reviews |
| `type/daily` | Daily logs | Journal entries, daily notes |
| `type/moc` | Map of Content | Hub pages that link to related notes |
| `type/template` | Template files | Template definitions |
| `type/guide` | How-to guides | Process documentation |
| `type/personal` | Life management | Goals, habits, fitness |

### 2. Area Taxonomy (`area/*`)
Knowledge domains and functional areas

| Tag | Description | When to Use |
|-----|-------------|-------------|
| `area/general` | Cross-cutting topics | System-wide concepts |
| `area/dev` | Development | Code, architecture, tools |
| `area/learning` | Education & growth | Courses, skills, knowledge |
| `area/personal` | Personal life | Goals, fitness, life admin |
| `area/resources` | Reference materials | APIs, libraries, tools |
| `area/reviews` | Reflection & planning | Reviews, retrospectives |
| `area/security` | Security & safety | Secrets, access control |
| `area/system` | System management | Vault setup, workflows |
| `area/automation` | Automated workflows | Scripts, automation |
| `area/ai` | Artificial Intelligence | AI tools, prompts, models |

### 3. Topic Taxonomy (`topic/*`)
Specific subjects, technologies, and contexts

| Tag | Description | Examples |
|-----|-------------|----------|
| `topic/react` | React ecosystem | React, Next.js, hooks |
| `topic/typescript` | TypeScript | TS patterns, types |
| `topic/tailwind` | Tailwind CSS | Utility-first CSS |
| `topic/api` | API development | REST, GraphQL, endpoints |
| `topic/git` | Version control | Git workflows, commands |
| `topic/obsidian` | Obsidian features | Plugins, workflows, tips |
| `topic/ai` | Artificial Intelligence | Models, prompts, tools |
| `topic/fitness` | Health & fitness | Workouts, nutrition |
| `topic/productivity` | Productivity systems | GTD, time management |
| `topic/security` | Security practices | Secrets, authentication |
| `topic/automation` | Automation tools | Scripts, workflows |
| `topic/dataview` | Dataview queries | DV scripts, queries |
| `topic/notion` | Notion integration | Sync, databases |
| `topic/javascript` | JavaScript | JS patterns, features |
| `topic/python` | Python | Python libraries, scripts |

### 4. Status Taxonomy (`status/*`)
Lifecycle and workflow states

| Tag | Description | When to Use |
|-----|-------------|-------------|
| `status/planning` | Initial planning | Ideas, requirements |
| `status/in-progress` | Active work | Currently being worked on |
| `status/completed` | Finished work | Done, archived |
| `status/active` | Currently relevant | Ongoing, evergreen |
| `status/archived` | Historical reference | No longer active |
| `status/blocked` | Blocked by external factor | Waiting on dependencies |
| `status/idea` | Idea stage | Not yet planned |
| `status/review-needed` | Needs review | Requires peer/self-review |

### 5. Priority Taxonomy (`priority/*`)
Urgency and importance levels (aligned with Obsidian Kanban CSS & GitHub Projects v2)

| Tag / Code | Level | Description | Color Standard |
| :--- | :--- | :--- | :--- |
| `priority/p0` / `priority/critical` | Critical | Blockers, urgent P0 issues | 🔴 Red (`#ef4444`) |
| `priority/p1` / `priority/high` | High | High urgency, key deliverables | 🟡 Yellow (`#f59e0b`) |
| `priority/p2` / `priority/medium` | Medium | Normal priority work items | 🔵 Blue (`#3b82f6`) |
| `priority/p3` / `priority/low` | Low | Background, nice-to-have items | 🟢 Emerald Green (`#10b981`) |

> [!TIP] 🎨 GitHub Projects v2 Color Alignment
> Set single-select option colors on [`https://github.com/users/lowqualityloey/projects/2/settings/fields/Priority`](https://github.com/users/lowqualityloey/projects/2/settings/fields/Priority):
> - **P0** → **Red** 🔴
> - **P1** → **Yellow** 🟡
> - **P2** → **Blue** 🔵
> - **P3** → **Green** 🟢

---

## 📋 Template Property Specifications

### Project Template (`type/project`)
```yaml
---
created: 2026-08-06
updated: 2026-08-06
last_reviewed: 2026-08-06
review_cycle: 14d
type: project
status: planning
priority: medium
area: dev
github_project_number: 2           # GitHub Project v2 number for auto-sync
github_owner: lowqualityloey        # GitHub owner login
tags:
  - type/project
  - area/dev
  - status/planning
  - priority/medium
---
```

### Learning Template (`type/learning`)
```yaml
---
created: 2026-08-06
updated: 2026-08-06
last_reviewed: 2026-08-06
review_cycle: 30d
type: learning
status: in-progress
area: learning
topic: typescript
source_url: "https://frontendmasters.com/courses/..."
platform_author: "Frontend Masters / Matt Pocock"
progress: "40%"
tags:
  - type/learning
  - area/learning
  - topic/typescript
  - status/in-progress
---
```

### Dev/Snippet Template (`type/snippet`)
```yaml
---
created: 2026-08-06
updated: 2026-08-06
type: snippet
status: active
area: dev
language: javascript/typescript/python
tags:
  - type/snippet
  - area/dev
  - status/active
  - topic/javascript  # Replace with actual topic
---
```

### Resource Template (`type/resource`)
```yaml
---
created: 2026-08-06
updated: 2026-08-06
type: resource
status: active
area: resources
tags:
  - type/resource
  - area/resources
  - status/active
  - topic/api  # Replace with actual topic
---
```

### Concept Template (`type/concept`)
```yaml
---
created: 2026-08-06
updated: 2026-08-06
last_reviewed: 2026-08-06
review_cycle: 90d
type: concept
status: active
area: general
tags:
  - type/concept
  - area/general
  - status/active
---
```

### Learning Template (`type/learning`)
```yaml
---
created: 2026-08-06
updated: 2026-08-06
last_reviewed: 2026-08-06
review_cycle: 30d
type: learning
status: in-progress
area: dev
topic: routing
source_url: "https://example.com/docs"
platform_author: "Platform / Author"
progress: "50%"
tags:
  - type/learning
  - area/dev
  - status/in-progress
  - topic/routing
---
```

### Daily Template (`type/daily`)
```yaml
---
created: 2026-08-06
updated: 2026-08-06
type: daily
area: personal
mood: 3
energy: 3
sleep_hours: 7
tags:
  - type/daily
  - area/personal
---
```

### Personal Template (`type/personal`)
```yaml
---
created: 2026-08-06
updated: 2026-08-06
last_reviewed: 2026-08-06
review_cycle: 90d
type: personal
status: active
area: personal
category: hobbies # health-fitness | goals | hobbies | finance | travel | reflection
tags:
  - type/personal
  - area/personal
  - status/active
---
```

---

## 🔍 Query Examples

### Find Active Projects
```dataview
TABLE priority, status, file.mtime AS "Last Modified"
FROM "02-Projects"
WHERE type = "project" AND status = "in-progress"
SORT priority DESC, file.mtime DESC
```

### Find Learning Resources by Topic
```dataview
TABLE summary, file.ctime AS "Created"
FROM "04-Learning"
WHERE contains(tags, "topic/react") AND type = "learning"
SORT file.ctime DESC
```

### Find Code Snippets by Language
```dataview
TABLE language, file.mtime AS "Updated"
FROM "03-Dev"
WHERE type = "snippet" AND language = "typescript"
SORT file.mtime DESC
```

### Find Notes Needing Review
```dataview
TABLE type, area, last_reviewed
FROM ""
WHERE type = "concept" OR type = "learning"
WHERE date(today) - date(last_reviewed) > dur(review_cycle)
SORT last_reviewed ASC
```

---

## 🔄 Maintenance Guidelines

1. **When Creating Notes**: Always use appropriate templates
2. **When Tagging**: Add 1-2 topic tags maximum, focus on relevance
3. **When Updating**: Update `updated` property and review status
4. **Review Cycle**: Set appropriate review frequency based on note type
5. **Archiving**: Change status to `archived` instead of deleting

---

## 🚀 Implementation Checklist

- [x] Create this documentation
- [x] Update all templates with consistent properties
- [x] Update Home.md with complete tag taxonomy
- [x] Run audit to fix inconsistent existing notes
- [x] Create validation scripts for property consistency

---

## 📚 Related Resources

- [[Home|Home (Central Command Hub)]]
- [[Vault Security Policy]]
- [[Second Brain Guide]]