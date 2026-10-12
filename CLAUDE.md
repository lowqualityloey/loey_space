# Claude Adapter for loey_space

`AGENTS.md` is the canonical Chief of Staff router. Read it first and follow it — this file only
records what differs for Claude, and it deliberately does not restate the vault rules, because a
second copy of a rule is a copy that can drift.

- The private records — `memory.md`, `handoff.md`, and the optional `00-Private/SOUL.md` — are
  absent in a fresh clone. If one is missing, run `npm run init:vault` and report what it created.
  Never invent their contents, and never pass a scaffold template's placeholder text off as the
  user's own words.
- Do not read or output files inside `.secrets/` or `.env`.
- Never invent wikilinks `[[Like This]]` unless the target note physically exists.
- Follow the Johnny Decimal / PARA directory architecture strictly.
