---
name: vault-concept-distiller
description: >-
  Extracts atomic evergreen mental models, principles, and concepts from daily notes,
  articles, dev snippets, or chat conversations, creating properly formatted notes in
  08-Concepts/ with 90-day review cycles, MOC updates, and bidirectional wikilinks.
---

# 💡 Vault Concept Distiller Skill

This skill guides the agent in identifying, synthesizing, and filing atomic evergreen concepts into `08-Concepts/` following the Zettelkasten / PARA principles of `loey_space`.

---

## 🎯 When to Activate
- The user runs `hey loey distill` or asks to extract/distill concepts from recent work or reading.
- A daily note or dev log contains a reusable insight, architectural pattern, or mental model.
- Clipped articles in `06-Resources/Articles/` need synthesis into evergreen knowledge.

---

## 📋 Procedure

### Step 1: Identify the Atomic Concept
- An atomic concept should represent **one core idea, mental model, or architectural principle**.
- Avoid omnibus notes; if an article discusses three distinct patterns, create three separate atomic notes.

### Step 2: Format Frontmatter & Metadata
Every concept note must adhere to `06-Resources/Tagging & Properties.md`:

```yaml
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: concept
area: dev | personal | learning | general | security | system
status: active
priority: medium
last_reviewed: YYYY-MM-DD
review_cycle: 90d
tags:
  - type/concept
  - area/<area>
  - topic/<topic>
---
```

### Step 3: Structure Note Body
Use the canonical structure:
```markdown
# 💡 [Concept Title]

> **One-sentence distillation of the core idea.**

---

## 🧠 Core Mental Model / Principle
Explain the concept concisely in plain language. Use visual Mermaid diagrams if helpful.

## 🛠️ Practical Application & Code / Examples
Concrete examples, real-world utility, or code patterns illustrating the concept.

## ⚠️ Nuances & Edge Cases
When *not* to use this, trade-offs, or common misunderstandings.

---

## 🔗 Related Concepts & Backreferences
- [[Related Concept Note]]
- [[Origin Daily Note or Article]]
```

### Step 4: File & Update MOC
1. Write the note to `08-Concepts/<Concept Title>.md` (or `YYYY-MM-DD_HHmm <Title>.md` if timestamped).
2. Check `08-Concepts/_Concepts MOC.md` and link the newly created concept note.
3. Update source notes with bidirectional wikilinks (`[[Concept Title]]`).
