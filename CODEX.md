# Codex & OpenCode / OmO Adapter for loey_space

`AGENTS.md` is the canonical vault rules and Chief of Staff router. Read it first and follow it —
this file only records what differs for Codex and the OpenCode / OmO clients, and it deliberately
does not restate the vault rules, because a second copy of a rule is a copy that can drift.

- The private records — `memory.md`, `handoff.md`, and the optional `00-Private/SOUL.md` — are
  absent in a fresh clone. If one is missing, run `npm run init:vault` and report what it created.
  Never invent their contents, and never pass a scaffold template's placeholder text off as the
  user's own words.
- Never invent wikilinks `[[Like This]]` unless the target note physically exists.
- Respect `.secrets/` and `.env` isolation policies.

### Short Trigger Commands (Zero Effort Logging)

- **`heyloey log`** / **`heyloey sync`** (or `hey loey log` / `sync`): Automatically summarize and
  record the current session's work, wins, blockers, and commits under `## 📝 Daily Log` in today's
  daily note (`01-Daily/YYYY-MM/YYYY-MM-DD.md`), adhering strictly to `99-Templates/Daily.md`.
- **`heyloey handoff`** / **`heyloey save`** (or `hey loey handoff` / `save`): Update `handoff.md`
  with in-flight objectives, completed milestones, and immediate next moves for the next session.
