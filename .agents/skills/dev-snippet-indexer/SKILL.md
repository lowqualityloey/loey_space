---
name: dev-snippet-indexer
description: >-
  Extracts, documents, and formats reusable code patterns, debugging solutions, and architecture
  snippets into 03-Dev/ with language metadata, syntax tags, complexity notes, and MOC links.
---

# 💻 Dev Snippet Indexer Skill

This skill guides the agent in turning real-world code snippets, debugging fixes, and technical patterns into structured, reusable dev notes in `03-Dev/`.

---

## 🎯 When to Activate
- The user requests saving or documenting a code pattern, algorithm, regex, or architectural recipe.
- During or after a coding task where a reusable helper or configuration was created.
- Reviewing dev logs for extraction into permanent technical reference.

---

## 📋 Procedure

### Step 1: Format Note Frontmatter
Every dev note must adhere to `06-Resources/Tagging & Properties.md`:

```yaml
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: snippet
area: dev
status: active
language: typescript | javascript | python | rust | bash | sql | css
tags:
  - type/snippet
  - area/dev
  - topic/<framework-or-tool>
---
```

### Step 2: Structure Note Body
Use the canonical structure:
```markdown
# 💻 [Snippet / Pattern Title]

> **One-sentence description of what this code pattern accomplishes.**

---

## ⚡ The Code / Implementation
\```<language>
// Clean, documented code implementation
\```

## 🔍 How It Works & Key Highlights
- Bullet points explaining key mechanisms, flags, or edge cases.

## ⚙️ Usage Example
\```<language>
// Example demonstrating invocation and expected output
\```

## ⚠️ Gotchas & Performance Considerations
- Performance, browser compatibility, or security nuances.

---

## 🔗 Related Resources & Notes
- [[Related API Note or Concept]]
```

### Step 3: File & Update Dev MOC
1. Save the file to `03-Dev/<Title>.md` (or `YYYY-MM-DD_HHmm <Title>.md`).
2. Add a link under the appropriate language category in `03-Dev/_Dev MOC.md`.
3. If the pattern relies on an external API or fundamental concept, add bidirectional links to `06-Resources/APIs/` or `08-Concepts/`.
