---
created: 2026-08-02
updated: 2026-09-01
type: moc
status: active
area: concepts
cssclasses:
  - cards
tags:
  - type/moc
  - area/concepts
---

# 💡 Concepts MOC & Evergreen Knowledge Hub

> *Permanent, atomic mental models and engineering principles. Each note is self-contained, deeply linked, and maintained on a 90-day review cycle.*

```dataviewjs
// 90-Day Review Radar
const concepts = dv.pages('"08-Concepts"').where(p => p.type === "concept" && !p.file.name.includes("MOC"));
let dueCount = 0;
for (let c of concepts) {
  const cycle = parseInt(c.review_cycle) || 90;
  const lastRev = c.last_reviewed ? moment(c.last_reviewed) : moment(c.file.cday);
  if (moment().diff(lastRev, 'days') > cycle) dueCount++;
}
if (dueCount > 0) {
  dv.paragraph(`⚠️ **${dueCount} concept(s) past their 90-day review cycle!** Review them on [[00-Inbox/_Triage MOC|Triage MOC]].`);
} else {
  dv.paragraph(`✨ **All ${concepts.length} evergreen concepts are fresh and up to date within their 90-day review cycle.**`);
}
```

---

## 💻 Software Architecture & Engineering Principles
*Atomic principles across type-driven design, compilers, state machines, and system architecture.*

```dataview
TABLE 
  choice(aliases, aliases[0], "—") AS "Core Principle / Alias",
  choice(last_reviewed, last_reviewed, choice(updated, updated, file.mtime)) AS "Last Reviewed"
FROM "08-Concepts"
WHERE type = "concept" AND (area = "dev" OR contains(tags, "area/dev")) AND !contains(file.name, "MOC")
SORT file.name ASC
```

---

## 🧘 Mental Models & Psychology
*Cognitive principles, support dynamics, emotional models, and personal resilience.*

```dataview
TABLE 
  choice(aliases, aliases[0], "—") AS "Core Principle / Alias",
  choice(last_reviewed, last_reviewed, choice(updated, updated, file.mtime)) AS "Last Reviewed"
FROM "08-Concepts"
WHERE type = "concept" AND area != "dev" AND !contains(tags, "area/dev") AND !contains(file.name, "MOC")
SORT file.name ASC
```

---

## 💡 Concept Workflows & Tooling

- `Ctrl + P` → **QuickAdd: 💡 Distill Evergreen Concepts** — Distills raw notes or dev logs into atomic principles with backlinks.
- `Ctrl + Shift + A` → **QuickAdd: AI Enrich Note** — Analyzes the active concept, generates technical explanations, utility, and code examples.
- `npm run distill -- <file>` — Distills concepts via CLI using Gemini Flash.
- `hey loey distill` — Ask AI Chief of Staff to synthesize recent daily logs or dev patterns into permanent concepts.
