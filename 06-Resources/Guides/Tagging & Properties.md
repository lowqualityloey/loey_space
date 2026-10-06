---
created: 2026-08-06
updated: 2026-10-06
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

## 📌 Authority of This Document

This guide is the **single source of truth** for the vault's metadata schema. Types,
areas, statuses, required fields, and review metadata are defined here once, and
every table below is the contract that templates, MOCs, and scripts are checked
against.

Where the machine disagrees with this document, that disagreement is recorded
explicitly in [Enforcement Status](#enforcement-status). A schema
that silently disagrees with its own tooling is worse than one that names the
disagreement, so this document states both sides rather than picking a winner and
hoping nobody runs the validator.

---

## Core Principles

1. **Namespaced Tags**: Use `namespace/value` format for all tags
2. **Standardized Properties**: Consistent YAML frontmatter across all note types
3. **Hierarchical Organization**: Clear relationships between categories
4. **Explicit Required Fields**: Every type has a fixed required-field list, stated in
   [Required Fields by Type](#required-fields-by-type), not left to interpretation
5. **Automation Ready**: Structure supports automated workflows and queries

---

## 🎯 Standard Properties (YAML Frontmatter)

### Baseline Required Properties (All Notes)

Every note carries these five fields, without exception:

```yaml
---
created: YYYY-MM-DD              # Date the note was created
updated: YYYY-MM-DD              # Date the note's CONTENT last changed (see below)
type: note_type                  # Primary classification (see Type taxonomy)
area: area_name                  # Knowledge domain (see Area taxonomy)
tags:                            # Tag collection, see Tag Rules
  - type/note_type
  - area/area_name
  - topic/subject_topic
---
```

`status` is required on every type **except `daily`** (see the exceptions table).

> [!NOTE] `updated` and `last_reviewed` are different things
> They are not interchangeable, and conflating them is a recurring metadata bug:
>
> | Field | Meaning | Moves when |
> |-------|---------|-----------|
> | `updated` | The note's **content** last changed | You edit, retitle, or restructure the note |
> | `last_reviewed` | The note was last **re-validated against this schema** | You confirm the taxonomy, links, and claims still hold |
>
> Rewriting a typo bumps `updated` and leaves `last_reviewed` alone. Re-checking a
> 90-day concept for accuracy bumps `last_reviewed` even if not one character of prose
> changed. Types that carry review metadata: `concept`, `learning`, `personal`,
> `project`. A review is **due** when `today − last_reviewed > review_cycle`.

### Required Fields by Type

The baseline applies to every row. The two columns below extend it. "Required
(extended)" is enforced by `npm run validate-templates`; optional fields are never
required and may be blank.

| Type | Required (extended) | Optional | Review metadata |
|------|--------------------|----------|-----------------|
| `project` | `status`, `priority` | `github_project_number`, `github_owner`, `github_repo` | `last_reviewed` + `review_cycle: 14d` |
| `learning` | `status` | `topic`, `source_url`, `platform_author`, `progress` | `last_reviewed` + `review_cycle: 30d` |
| `concept` | `status` | _(none)_ | `last_reviewed` + `review_cycle: 90d` |
| `personal` | `status` | `category` | `last_reviewed` + `review_cycle: 90d` |
| `snippet` | `status` | `language` | none |
| `resource` | `status` | `source`, `author`, `published` | none |
| `review` | `status` | _(none)_ | none |
| `daily` | *(none; `status` is not required)* | `topic`, `mood`, `energy`, `sleep_hours` | none |
| `capture` † | `status` | `priority` | none |
| `task` † | `status` | `priority`, `source` | none |
| `template` † | `status` | _(none)_ | none |
| `dashboard` ‡ | `status` | _(none)_ | none |
| `guide` ‡ | `status` | _(none)_ | none |
| `moc` ‡ | `status` | _(none)_ | none |

† Documented exception: see [Capture and Software-Document Exceptions](#capture-and-software-document-exceptions).
‡ Documented exception: real and widely used. Registered in the validator by #93; see
[Enforcement Status](#enforcement-status).

`review_cycle` accepts exactly three values: `14d`, `30d`, `90d`. `7d` appeared in
earlier drafts of this guide but **no template and no script emits it**, so it is not
part of the schema. If a future type genuinely needs weekly review, add the value here
and in the code together. Do not introduce it in one place only.

### Optional Properties (Type-Specific)

```yaml
priority: p0/p1/p2/p3            # Required on project; conventional on capture and task
                               # critical/high/medium/low are accepted equivalents — see § 5
last_reviewed: YYYY-MM-DD        # See "updated vs last_reviewed" above
review_cycle: 14d/30d/90d        # Required whenever last_reviewed is present
language: javascript/typescript  # For code snippets
energy: 1-5                      # For daily notes (numeric, 1 = lowest)
mood: good                       # For daily notes (TEXT, see Mood Representation)
sleep_hours: 7.5                 # For daily notes (numeric hours)
topic: typescript                # Subject slug; must exist in the Topic taxonomy
source_url: "https://example.com/..."   # For learning notes and web references
platform_author: "Platform / Author"    # Course platform, instructor, or author
progress: "40%"                  # Completion progress (e.g. "40%", "2/4 Weeks")
category: hobbies                # personal: health-fitness | goals | hobbies | finance | travel | reflection
source: mobile                   # capture and task: where the item entered the vault
```

### Mood Representation

`mood` is **textual**. `energy` is **numeric, 1 to 5**. They are not interchangeable, and
the earlier version of this guide contradicted itself by documenting `mood` as text in
one section and `mood: 3` in another.

| Property | Canonical form | Example | Why |
|----------|---------------|---------|-----|
| `mood` | text, free-form from a suggested vocabulary | `mood: focused` | A mood is a word. `06-Resources/scripts/src/types/index.ts` declares it as `mood: string`, and the summary scripts read it as a string and interpolate it verbatim into prose |
| `energy` | integer, `1` to `5` | `energy: 4` | A magnitude, so it can be averaged. The summary scripts apply `parseInt` to it, proving the numeric contract |
| `sleep_hours` | number, may be fractional | `sleep_hours: 6.5` | Same reasoning; fractional hours are real |

A suggested `mood` vocabulary is documented inline in the daily template. Use one of
those words where it fits; the field stays open so the note is never blocked by a
missing enum entry.

> [!IMPORTANT] Migration policy: tolerate, do not rewrite
> Treat numeric `mood` as **legacy, read-only**. Do not bulk-convert existing daily
> notes.
>
> - **New or edited notes**: write textual `mood`.
> - **Consumers** must accept both. A numeric value is legal input and should be
>   rendered as-is; do not treat it as a schema violation.
> - **Why no rewrite**: this repository tracks only a small fraction of the vault's
>   notes, so the existing values cannot be inspected in advance. A migration that
>   required reading first, or that rewrote blindly, would risk corrupting data
>   nobody has seen. A reader that accepts both forms is correct immediately and
>   becomes fully canonical as notes are touched naturally.
> - Numeric `mood` was never load-bearing: `mood` is only ever rendered as text, so
>   accepting both forms loses no capability.

### Tag Rules

`tags` must contain at least one tag per applicable namespace:

- `type/*` and `area/*`: required on **every** note, including `daily`
- `status/*`: required on every type **except `daily`**

This mirrors the validator's namespace check exactly. A tag namespace beyond these
(`topic/*`, `priority/*`, `source/*`) is allowed but never required.

---

## 🏷️ Tag Taxonomy

### 1. Type Taxonomy (`type/*`)
Primary classification of note purpose and structure.

The table is the **union** of everything the vault actually uses and everything the
validator accepts. Nothing is silently dropped: each row carries a status saying
whether it is canonical, an explicit exception, or reserved.

| Type | Description | Status | Enforced by | Rationale |
|------|-------------|--------|-------------|-----------|
| `concept` | Evergreen ideas, mental models | canonical | validator | Knowledge refined from captures by the concept distiller |
| `learning` | Courses, tutorials, study notes | canonical | validator | Material still being worked through; carries `progress` |
| `snippet` | Reusable code and patterns | canonical | validator | Extractable code with a `language` |
| `resource` | External references, APIs, libraries | canonical | validator | Points at something outside the vault |
| `project` | A body of work with an outcome | canonical | validator | The only type that requires `priority` |
| `review` | Weekly and monthly retrospectives | canonical | validator | Point-in-time reflection over a period |
| `personal` | Goals, habits, fitness, life admin | canonical | validator | Outside the dev/resources axis |
| `daily` | One note per day | canonical | validator | The only type that does not require `status` |
| `template` | A template file under the templates folder | canonical | validator | Blueprint, not content |
| `capture` | Raw, unprocessed inbound item | documented exception | validator | Adopts `type`/`area` naming it was given. Not a knowledge type; it is a queue entry |
| `task` | A single actionable item | documented exception | validator | Adopts `type`/`area` naming it was given. A task is not yet a project |
| `dashboard` | Central command pages | documented exception | validator | Real and load-bearing (the vault's home page is one). Registered by #93, which also widened the scan so it is actually reached |
| `guide` | How-to and process documentation | documented exception | validator | Real, widely used; this file is one. Registered by #93 |
| `moc` | Map of Content, a hub that links a section together | documented exception | validator | The highest-volume type in the vault. Registered by #93 |

`triage` was previously a registry key that no template and no note ever declared. It
was removed as a dead entry by #93, so it is now neither used nor accepted; see the
enforcement section.

**Which component enforces what.** `npm run validate-templates` enumerates every
tracked markdown file with `git ls-files -z -- '*.md'` and checks each one that declares
a `type` against its registered type. It is no longer template-only, so `dashboard`,
`guide`, and `moc` are enforced like every other type, as are `capture` and `task`.
Two paths are exempt by explicit declaration rather than by prefix: `memory.md` and
`handoff.md`, the owner's private records, whose types are not in this taxonomy. Both
exemptions are printed on every run, so an exempt note is never mistaken for a passing
one.

> [!NOTE] A typo in `type` now fails
> The registry is keyed on the raw string, so `type: triag` was indistinguishable from
> the dead `type: triage` — both validated. `triage` has been removed as a dead entry,
> so a typo in that position is a failure rather than a silent pass.

### 2. Area Taxonomy (`area/*`)
Knowledge domains and functional areas.

| Tag | Description | Status | When to Use |
|-----|-------------|--------|-------------|
| `area/dev` | Development | canonical | Code, architecture, tools |
| `area/system` | System management | canonical | Vault setup, workflows |
| `area/resources` | Reference materials | canonical | APIs, libraries, tools |
| `area/reviews` | Reflection & planning | canonical | Reviews, retrospectives |
| `area/personal` | Personal life | canonical | Goals, fitness, life admin |
| `area/general` | Cross-cutting topics | canonical | System-wide concepts |
| `area/learning` | Education & growth | canonical | Courses, skills, knowledge |
| `area/inbox` | Unsorted inbound queue | canonical | Items awaiting triage, **see below** |
| `area/security` | Security & safety | canonical | Secrets, access control |
| `area/automation` | Automated workflows | canonical | Scripts, automation |
| `area/ai` | Artificial Intelligence | canonical | AI tools, prompts, models |
| `area/daily` | The daily-notes section | documented exception | Section index only |
| `area/projects` | The projects section | documented exception | Section index only |
| `area/concepts` | The concepts section | documented exception | Section index only |
| `area/tasks` | The task-query section | documented exception | Section index only |

**Why `area/inbox` is canonical.** Four templates (the enhanced quick-capture
template, the mobile capture template, the mobile idea template, and the mobile task
template) declare `area: inbox`, and the inbox MOC declares it too. A dedicated
pre-triage area is genuinely useful: it makes "everything waiting to be sorted" a
single query, and it is the state a capture occupies before triage routes it
somewhere else. `area/general` cannot express that, and overloading
`area/personal` would misreport unfinished items as life-admin notes. It is listed as
canonical rather than an exception because it names a real domain, not a folder.

**Why four section-index areas are exceptions.** `area/daily`, `area/projects`,
`area/concepts`, and `area/tasks` each appear in exactly one tracked file: the MOC
that indexes that numbered section. They mirror a folder name rather than naming a
knowledge domain, which is why they are exceptions and not canonical areas.

They are also **inconsistent with each other, and that inconsistency is not resolved
here.** The dev, personal, and reviews MOCs use their domain area (`area/dev`,
`area/personal`, `area/reviews`), while the inbox, daily, projects, concepts, and
tasks MOCs use the folder noun. Reconciling them means editing those MOC files, which
is outside the scope of this documentation change. Until then, treat these four as
deprecated-but-tolerated, and prefer the domain area on any new note.

The three canonical areas `area/security`, `area/automation`, and `area/ai` are
declared for completeness but currently carry no tracked notes. They are part of the
schema and available to use; they are not evidence of a working convention.

### 3. Topic Taxonomy (`topic/*`)
Specific subjects, technologies, and contexts. Open-ended by design: the topic
namespace accepts any slug, and this table is a starter set rather than an
enumerated list.

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
| `topic/taxonomy` | This schema | Metadata conventions |
| `topic/metadata` | Frontmatter mechanics | Properties, tags |
| `topic/javascript` | JavaScript | JS patterns, features |
| `topic/python` | Python | Python libraries, scripts |

### 4. Status Taxonomy (`status/*`)
Lifecycle and workflow states. All eight values are canonical; templates currently
use the four marked **in use**.

| Tag | Description | Usage | When to Use |
|-----|-------------|-------|-------------|
| `status/active` | Currently relevant | **in use** | Ongoing, evergreen |
| `status/in-progress` | Active work under way | **in use** | Currently being worked on |
| `status/planning` | Scoped, not yet started | **in use** | Ideas, requirements |
| `status/completed` | Finished | **in use** | Done |
| `status/archived` | Historical reference | reserved | No longer active. Preferred over deletion |
| `status/blocked` | Waiting on an external factor | reserved | Blocked by dependencies |
| `status/idea` | Not yet planned | reserved | Captured possibility |
| `status/review-needed` | Awaiting review | reserved | Requires self or peer review |

`status/idea` and `status/blocked` overlap with the `capture` and `task` types and are
kept reserved rather than folded into them, so an item can change status as it matures
without changing type. `status/archived` is reserved but policy-level: the maintenance
guidelines below require archiving over deletion.

`daily` notes are the one type that carries no `status`. A day cannot be
"in-progress", and giving it a status would only invite a value nobody could act on.

### 5. Priority Taxonomy (`priority/*`)
Urgency and importance levels. Available for any type that declares `priority`, and
required on `project`.

| Tag / Code | Level | Description | Color Standard |
| :--- | :--- | :--- | :--- |
| `priority/p0` / `priority/critical` | Critical | Blockers, urgent P0 issues | 🔴 Red (`#ef4444`) |
| `priority/p1` / `priority/high` | High | High urgency, key deliverables | 🟡 Yellow (`#f59e0b`) |
| `priority/p2` / `priority/medium` | Medium | Normal priority work items | 🔵 Blue (`#3b82f6`) |
| `priority/p3` / `priority/low` | Low | Background, nice-to-have items | 🟢 Emerald Green (`#10b981`) |

> [!TIP] 🎨 Keeping the board colours aligned
> If your task board renders these levels with colour, define the single-select option
> colours once in your own board's field settings and reuse these four values there.
> The hex values above are the reference: red, yellow, blue, green. Point the board at
> this document rather than duplicating the mapping, so the two cannot drift.

---

## 📋 Template Property Specifications

Each example below is internally consistent with
[Required Fields by Type](#required-fields-by-type). Dates and handles are
illustrative placeholders.

### Project Template (`type/project`)
```yaml
---
created: 2026-10-06
updated: 2026-10-06
last_reviewed: 2026-10-06
review_cycle: 14d
type: project
status: planning
priority: medium
area: dev
github_project_number: 2           # Board number for auto-sync
github_owner: your-org             # Board owner login
github_repo: your-repo             # Board repository slug
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
created: 2026-10-06
updated: 2026-10-06
last_reviewed: 2026-10-06
review_cycle: 30d
type: learning
status: in-progress
area: learning
topic: typescript
source_url: "https://example.com/course"
platform_author: "Platform / Author"
progress: "40%"
tags:
  - type/learning
  - area/learning
  - topic/typescript
  - status/in-progress
---
```

> [!NOTE] One Learning example, deliberately
> Earlier revisions of this guide carried two conflicting Learning examples, one
> claiming `area: learning` and another `area: dev`, with different source fields and
> the same heading. Only one survives. The single example above matches the learning
> template's actual area.

### Dev/Snippet Template (`type/snippet`)
```yaml
---
created: 2026-10-06
updated: 2026-10-06
type: snippet
status: active
area: dev
language: typescript              # Replace with actual language
tags:
  - type/snippet
  - area/dev
  - status/active
  - topic/typescript               # Replace with actual topic
---
```

### Resource Template (`type/resource`)
```yaml
---
created: 2026-10-06
updated: 2026-10-06
type: resource
status: active
area: resources
source: "https://example.com/docs"
author: "Author Name"
published: "2026-01-15"
tags:
  - type/resource
  - area/resources
  - status/active
  - topic/api                      # Replace with actual topic
---
```

### Concept Template (`type/concept`)
```yaml
---
created: 2026-10-06
updated: 2026-10-06
last_reviewed: 2026-10-06
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
created: 2026-10-06
updated: 2026-10-06
type: daily
area: personal
mood:                             # Left blank in the template; filled at check-in
energy:
sleep_hours:
tags:
  - type/daily
  - area/personal
---
```

No `status`, and that is correct. `mood` is textual when filled; `energy` and
`sleep_hours` are numeric. The three fields ship blank on purpose: they are
owner-entered at check-in, so they are not required fields.

### Personal Template (`type/personal`)
```yaml
---
created: 2026-10-06
updated: 2026-10-06
last_reviewed: 2026-10-06
review_cycle: 90d
type: personal
status: active
area: personal
category: hobbies                 # health-fitness | goals | hobbies | finance | travel | reflection
tags:
  - type/personal
  - area/personal
  - status/active
---
```

### Capture Template (`type/capture`), an exception
```yaml
---
created: 2026-10-06 09:30
updated: 2026-10-06
type: capture
status: active
area: inbox
priority: medium
tags:
  - type/capture
  - area/inbox
  - status/active
  - priority/medium
---
```

---

## Capture and Software-Document Exceptions

Three classes of note do not fit the "a note is a classified thing with a lifecycle"
model. Each is a deliberate, justified exception rather than an oversight.

### Raw captures (`type: capture`, `type: task`, and `area: inbox`)

A capture is a **queue entry, not content**. It exists to be sorted, and its whole
purpose is to be replaced by a properly typed note later. Three consequences follow,
and all three are load-bearing:

1. **It carries a full, valid type/area/status set anyway.** It would be easy to argue
   captures should skip the metadata ceremony. They do not: a capture that cannot be
   queried is a capture that is lost. So `capture` and `task` are registered types with
   required fields, and the capture templates declare them.
2. **It is never given review metadata.** Captures are transient by design. Reviewing a
   capture is meaningless; the note it becomes is what gets reviewed.
3. **`area: inbox` is its normal state.** A capture outside the inbox means triage has
   already run. The area tells you whether triage has happened.

`type: task` is the same class. A task is an actionable item that has been captured but
not yet promoted into a project; both are pre-destinations.

### Software documents (`type: template`)

A template is a **blueprint that the vault executes**, not a note the vault reasons
about. It deserves a proper type because it needs its own review rhythm, but it has no
`status` lifecycle of its own: `active` means "this blueprint is current", and the only
meaningful transition is when the template's own contents change. Templates therefore
carry the baseline fields and nothing more.

### Section hubs (`type: moc`, `type: dashboard`)

A MOC or dashboard is **structure, not knowledge**. It earns its type because it must
be distinguishable from the notes it links, and it has no review cycle because a hub
goes stale by having dead links, not by having wrong ideas. Link health is checked by
the link audit instead. These types are real and heavily used; the problem is that
the validator does not know them yet. That is recorded below.

---

## Enforcement Status

`06-Resources/scripts/src/validate-templates.ts` implements the canonical list in this
document. The registry is keyed by `type`, and every tracked markdown file that
declares a `type` is checked against it.

Coverage, as measured by running `npm run validate-templates` on this repository:

```
Inspected 43 note(s); 45 of 87 tracked markdown file(s) declare a `type`, 2 exempted.
```

**Closed by #93.** These were the gaps this section previously recorded as open, and
they are listed here so the change is auditable rather than silent:

| Previously open | Now |
|-----------------|-----|
| `dashboard`, `guide`, and `moc` absent from the registry, leaving 21 of 43 typed notes (~48%) unchecked | All three registered with their required fields and enforced |
| The scan read only `99-Templates/*.md`, so most of the vault was never inspected | The scan enumerates all tracked markdown; the type registry and the scan were widened as one change, because either half alone is useless |
| `triage` was a registry key no template declared, so `type: triag` validated | `triage` removed as a dead entry; an unregistered type is a failure |
| A typo in `type` was silently accepted | An unknown `type` fails validation and sets a nonzero exit code |

Widening the scan surfaced **two genuine violations that the type-only census could not
see**, because they were missing required fields rather than an unregistered type:
`06-Resources/APIs/_APIs MOC.md` and `99-Attachments/_Attachments MOC.md`. Both are now
conformant. This is the argument for enforcing the contract rather than documenting it
— a census of *types* would have reported both as fine.

### Still open

| Gap | Detail | Impact |
|-----|--------|--------|
| **Two other copies of the schema** | `AGENTS.md` (lines 68-70) carries its own type, area, and status lists | Two further descriptions of the taxonomy that can drift from both this file and the registry. The `AGENTS.md` lists omit `moc`, `capture`, `task`, `area/inbox`, and `status/review-needed` — all defined above |
| **Duration syntax** | Compact durations such as `dur(7d)` and `dur(review_cycle)` appear in templates and one MOC; the working form is `dur(7 days)` | Those expressions do not evaluate. See the query section |
| **Numeric `mood`** | The daily-note readers do not implement the numeric-mood tolerance rule | Either implement it or state plainly that legacy numeric values are unsupported |

### Declared exemptions

`memory.md` and `handoff.md` are the owner's private cross-session records. Their types
(`memory`, `handoff`) are not in this taxonomy and they are not vault notes. They are
exempt **by explicit path with a stated reason**, printed on every run — not skipped by
prefix and not silently tolerated. A note that declares no `type` at all is likewise not
a contract violation, since the contract binds notes that declare metadata.

> [!NOTE] Not every tracked note is validated
> `CONTRIBUTING.md` sits in `Guides/` and declares no `type`, so the contract does not
> bind it. That is a real hole in coverage rather than an exemption, and is worth a
> follow-up.

---

## 🔍 Query Examples

> [!WARNING] `review_cycle` is not a duration literal
> `review_cycle: 90d` is the **string** `"90d"`. Dataview's `dur()` accepts a
> duration literal such as `90 days`, not a compact `Nd` string, so
> `dur(review_cycle)` on a `90d` value yields an invalid duration and the comparison is
> silently false, so the query returns nothing and looks like "nothing is due". The
> working form is `dur(90 days)`, which is also the form already used elsewhere in
> this vault.

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
TABLE type, area, review_cycle, last_reviewed
FROM ""
WHERE contains(list("concept", "learning", "personal", "project"), type)
WHERE (review_cycle = "90d" AND date(today) - date(last_reviewed) > dur(90 days))
   OR (review_cycle = "30d" AND date(today) - date(last_reviewed) > dur(30 days))
   OR (review_cycle = "14d" AND date(today) - date(last_reviewed) > dur(14 days))
SORT last_reviewed ASC
```

Why this shape:

- **Each cycle is compared explicitly.** `review_cycle` is matched as a plain string,
  and the threshold is a duration literal written out in full. This avoids parsing
  `"90d"` at query time, which is the original bug.
- **Only the three canonical values appear**, so the query cannot drift from the
  schema. Adding a fourth `review_cycle` value means adding a line here too.
- **Each clause is parenthesised.** Dataview gives `AND` and `OR` equal precedence and
  associates left to right, so an unparenthesised mix of the two misgroups. Explicit
  parentheses remove the ambiguity.
- **`date(today) - date(last_reviewed)` returns a duration**, which compares directly
  against `dur(...)`. This is the same shape already working in this vault's triage and
  weekly-review queries.

A note whose `last_reviewed` is blank is simply not listed. That is intended: an
unreviewed note has no interval to be overdue against.

> [!TIP] Unlisted is not the same as fine
> A blank `review_cycle` is invisible to exactly the same clause, and a note whose `type`
> is missing is not reached by any of the type-filtered MOCs either. `npm run hygiene`
> reports all three — the four review types above with a blank `last_reviewed` or
> `review_cycle`, and records that declare no `type` at all — naming the path and the
> missing field and nothing else. Run it when this query comes back clean.

> [!NOTE] Confidence, stated plainly
> This query is **not executed by any test** in this repository. The validator checks
> frontmatter fields, not Dataview output, so this query has not been machine-verified.
> The parts considered reliable are `dur(90 days)`-style duration literals (used
> elsewhere in this vault), string equality against a frontmatter value, duration
> subtraction and comparison, and explicit parenthesisation. A generic alternative
> using `replace(review_cycle, "d", " days")` would be shorter, but its exact string
> handling is less certain, so the explicit form above is preferred. If you rewrite it,
> open the rendered query and confirm it returns the expected rows rather than trusting
> it to look right.

---

## 🔄 Maintenance Guidelines

1. **When Creating Notes**: Use a template, so required fields cannot be forgotten
2. **When Tagging**: Add 1-2 topic tags maximum, focus on relevance
3. **When Editing**: Bump `updated`, and only `updated`. Change `last_reviewed` when
   you re-validate, not when you touch a typo
4. **Review Cycle**: Only `concept`, `learning`, `personal`, and `project` carry review
   metadata. Do not add it to a capture or a snippet
5. **Archiving**: Change `status` to `archived` instead of deleting
6. **When Changing This Schema**: Update the tables, the examples, and the validator
   registry together, in one change

---

## 🚀 Implementation Checklist

- [x] Create this documentation
- [x] Update all templates with consistent properties
- [x] Update the home page with the tag taxonomy
- [x] Create validation scripts for property consistency
- [x] Define one canonical type table as the union of documented and registered types
- [x] State required fields per type, including the `daily` exception
- [x] Give `mood` a single representation and a migration policy that needs no rewrite
- [x] Separate `updated` from `last_reviewed`
- [x] Correct the review-due query and record the duration-syntax trap
- [x] Add `dashboard`, `guide`, and `moc` to the validator registry, and widen the scan
      beyond `99-Templates/` (#93; see [Enforcement Status](#enforcement-status))
- [x] Remove or implement the dead `triage` type (removed by #93)
- [ ] Reconcile the four section-index areas with their MOC files
- [ ] Bring the schema copy in `AGENTS.md` in line with this file
- [ ] Audit existing notes for consistency, without bulk-migrating their content

---

## 📚 Related Resources

- [[Home|Home (Central Command Hub)]]
- [[Vault Security Policy]]
- [[Second Brain Guide]]