---
created: 2026-10-12
updated: 2026-10-12
type: moc
status: active
area: resources
tags:
  - type/moc
  - area/resources
  - topic/scaffold
---

# 🧱 Scaffold MOC

Templates that `npm run init:vault` copies into the vault root on a first run. They exist so a
fresh clone can create the private records the instructions refer to, instead of describing
files that do not exist yet.

Every other folder in this vault has a hub; this one does too, which is why the templates
below sit inside a declared `FROM` scope rather than showing up as unreachable notes.

> [!WARNING] This folder is public
> `06-Resources/scaffold/` is tracked and published. These files are the SYSTEM, not the
> journal: use placeholder text only. Never paste a real home path, account name, private
> project name or personal note into a scaffold file. The records these templates create
> (`memory.md`, `handoff.md`, `00-Private/SOUL.md`) are git-ignored and stay on your machine.

## 📄 Scaffold Templates

```dataview
TABLE type AS "Type", updated AS "Last Updated"
FROM "06-Resources/scaffold"
WHERE file.name != "_Scaffold MOC"
SORT file.name ASC
```

## What each one becomes

- `memory.template.md` → `memory.md` — durable facts only, at the vault root.
- `handoff.template.md` → `handoff.md` — in-flight objectives and the next move. Its two
  top-level headings are linked from `Home.md`, so renaming them breaks the dashboard panel.
- `profile.template.md` → `00-Private/SOUL.md` — optional assistant voice and boundaries.

Run `npm run init:vault -- --dry-run` to see what would be created. The command never
overwrites an existing file.
