# Feature request

<!-- Check the scope rules first — this saves everyone a round trip. -->

## Is this in scope?

- [ ] It improves the **shared system**: the `homepulse` or `kanban-status-sync`
      plugin, automation scripts (`06-Resources/scripts/`), CSS snippets, the
      pre-commit hook, templates, or documentation.
- [ ] It is **not** about personal-note content. The numbered folders
      (`00-Inbox/` … `08-Concepts/`, `99-Attachments/`) are your notes, not shared
      artefacts, and are not something a public PR can change.

If the second box does not apply, open a bug report instead.

## Problem

<!-- What is hard or missing today? Describe the situation, not the solution. -->

## Proposed change

<!-- What you'd like to happen. If you have a specific approach, say so — but
     explain the problem first, because it may be solvable a different way. -->

## Alternatives considered

<!-- Other approaches, including doing nothing. -->

## Compatibility

- [ ] Works with the **bundled custom builds** of `homepulse` and
      `kanban-status-sync` (not the Community Store versions)
- [ ] Does not require re-enabling plugin auto-updates
- [ ] Does not need secrets outside `.env`
- [ ] Keeps `npm test` green, and adds tests if behaviour changes
