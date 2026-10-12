---
created: 2026-10-12
updated: 2026-10-12
type: resource
status: active
area: resources
tags:
  - type/resource
  - area/resources
  - topic/scaffold
  - status/active
---

# Long-Term Memory

This file is yours. It is git-ignored, it never leaves your machine, and nothing in it is
published when you share or fork the vault system itself.

It holds **durable truths only** — facts that stay true across sessions and that an
assistant would otherwise have to re-derive or get wrong. Daily detail belongs in
`01-Daily/`; in-flight work belongs in `handoff.md`.

## Core Memory Rule: durable facts only

Write something here when all three are true:

1. It stays true for weeks or longer.
2. An assistant would get it wrong without being told.
3. It cannot be worked out from the repository or the notes it already reads.

Everything else belongs somewhere else. When this file grows past its budget, move the
infrastructure and system detail into `06-Resources/` and leave a pointer.

## Budget

- Target: under 150 lines and 6 KB.
- Hard limit: 200 lines and 8 KB. `npm run hygiene -- --check-rot` warns at 75% of that.
- If a section is only context for one active task, move it to `handoff.md` instead.

## Profile

Who you are, in the terms an assistant actually needs:

- Name and how you want to be addressed: `<name>`
- Timezone and working hours: `<timezone, e.g. UTC+12, 09:00-18:00>`
- Role and the kind of work you do: `<role>`
- Languages, editors and platforms you work in: `<for example: TypeScript, Python, Obsidian, Linux>`
- Communication preferences: `<for example: terse, no preamble, show the command you ran>`

## Preferences and standing decisions

Rules you want followed without being re-explained. One line each, with the reason if the
reason is not obvious.

- `<preference>` — `<why, if it is not self-evident>`
- `<preference>`

## Active external repositories

Repositories outside this vault that you work in, and what they contain. Keep the table
short; a repository that is finished does not need a row.

| Name | Location | Purpose |
| :--- | :--- | :--- |
| `<repo>` | `<path or URL>` | `<one line>` |

## Notes on this file

- Private by construction: `memory.md` is declared in `.githooks/lib/private-records.txt`
  and excluded by `.gitignore`, so it cannot be committed by accident.
- Edit it by hand. An assistant may propose changes, but it should not rewrite this file
  without being asked.
- If an entry turns out to be wrong, delete it rather than appending a correction. A memory
  file that argues with itself is worse than a short one.
