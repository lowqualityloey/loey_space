---
created: 2026-08-06
updated: 2026-08-06
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
last_reviewed: YYYY-MM-DD        # For evergreen notes
review_cycle: 7d/14d/30d/90d     # Review frequency
language: javascript/typescript  # For code snippets
energy: 1-5                      # For daily notes (energy level)
mood: 1-5                        # For daily notes (mood)
sleep_hours: number              # For daily notes
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
Urgency and importance levels

| Tag | Description | When to Use |
|-----|-------------|-------------|
| `priority/low` | Low urgency | Nice to have, background |
| `priority/medium` | Normal priority | Regular work items |
| `priority/high` | High urgency | Important, time-sensitive |
| `priority/critical` | Critical priority | Blockers, urgent issues |

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
tags:
  - type/learning
  - area/learning
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
- [ ] Update all templates with consistent properties
- [ ] Update Home.md with complete tag taxonomy
- [ ] Run audit to fix inconsistent existing notes
- [ ] Create validation scripts for property consistency

---

## 📚 Related Resources

- [[Standardized Vault Tag Taxonomy in Home]]
- [[Vault Security Policy]]
- [[Second Brain Guide]]
- [[Dataview Query Library]]