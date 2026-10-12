---
created: 2026-10-12
updated: 2026-10-12
type: guide
status: active
area: resources
tags:
  - type/guide
  - area/resources
  - status/active
  - topic/troubleshooting
  - topic/maintenance
---

# Maintenance and Troubleshooting

This guide consolidates troubleshooting steps and maintenance routines for `loey_space`. It also separates read-only verification commands from operations that modify files.

## Common Symptoms and Fixes

### API Key and AI Notices

- **Symptom**: `⚠️ GEMINI_API_KEY missing in .env!` notice appears.
  - **Fix**: Create `.env` by copying `.env.example` (`cp .env.example .env`) and add your API key from [Google AI Studio](https://aistudio.google.com/app/apikey). AI features are optional; all note creation, habits, task dashboards, and search work without an API key.
- **Symptom**: AI summary reads flat with a notice about quota limits (HTTP 429).
  - **Fix**: The Gemini API returned a rate limit error. Per-minute limits clear after about 60 seconds; daily limits reset at midnight Pacific Time. When a quota error occurs, the daily note enricher generates a flat summary from your logged bullets; the weekly review script stops without creating or overwriting files. Re-run the command once the quota resets.

### Plugin and UI Issues

- **Symptom**: Changes to bundled plugins or CSS snippets have no effect.
  - **Fix**: Obsidian loads plugin code and snippets at startup. Press `Ctrl + P` (or `Cmd + P`) and select **Reload app without saving**.
- **Symptom**: HomePulse loses habit sync, focus synchronization, or tech tree views.
  - **Fix**: The plugin was updated from the Community Store, replacing custom vault code. Restore `.obsidian/plugins/homepulse/` from Git history, run `npm run patch-homepulse` to re-verify the locally owned prelude, and ensure **Settings → Community plugins → Auto-update plugins: OFF** is set.
- **Symptom**: Habit toggles in the dashboard do not update the daily note.
  - **Fix**: Habit sync requires today's daily note to exist at `01-Daily/YYYY-MM/YYYY-MM-DD.md` (or the legacy fallback `01-Daily/YYYY-MM-DD.md`), a `## 🔁 Habits` heading with checkboxes, and Dataview enabled in Community plugins.
- **Symptom**: HomePulse dashboard appears cramped on mobile screens.
  - **Fix**: Go to **Settings → Appearance → CSS snippets** and enable `homepulse-mobile`.

### Platform and Script Errors

- **Symptom**: `npm run build` fails with `you installed esbuild for another platform`.
  - **Fix**: `node_modules` was installed on a different operating system than the current shell (for example, switching between native Windows and WSL). The `esbuild` compiler and `tsx` test runner include platform-specific native binaries. Never share a single `node_modules` folder across operating systems. In the shell you are building from, delete the folder and reinstall:
    ```bash
    rm -rf node_modules
    npm ci
    ```
- **Symptom**: DataviewJS block throws `TypeError: dv.load is not a function`.
  - **Fix**: `dv.load` is not a Dataview API method. Dataview provides two supported methods for loading external files:
    - `await dv.io.load(path)` — Reads raw file text from the vault. Used to evaluate bundles, such as `06-Resources/scripts/task-view.js`.
    - `await dv.view(path, input)` — Executes a custom Dataview view script.

---

## Vault Commands Reference

The vault scripts in `package.json` are divided into read-only verification checks and mutating operations.

### Read-Only Verification Commands

These commands inspect your files, validate schemas, or run tests without modifying notes or pushing changes:

- `npm test`: Runs the automated test suite across parsers, guards, and contracts.
- `npm run typecheck`: Validates TypeScript source files in `06-Resources/scripts/src/`.
- `npm run validate-templates`: Validates all note blueprints and tracked files against the frontmatter schema and tag taxonomy.
- `npm run audit-links`: Audits all internal wikilinks and reports orphan notes. Use `npm run audit-links -- --strict` to exit with an error code if broken links exist.
- `npm run hygiene`: Checks for unclassified records, missing review metadata, and notes outside hub queries.
- `npm run check-rot -- --include-ignored`: Runs the anti-rot sensor across tracked and untracked notes, checking memory capacity, overdue review cycles, and skill regression tests.

### Mutating Operations

These commands write files, update notes, or modify GitHub state:

- `npm run build`: Compiles TypeScript files in `06-Resources/scripts/src/` into single-file CommonJS bundles in `06-Resources/scripts/`.
- `npm run backup`: Creates a timestamped local snapshot archive in `~/.loey_backups/` with a SHA-256 manifest.
- `npm run patch-homepulse`: Verifies call sites and injects the locally owned prelude into `.obsidian/plugins/homepulse/main.js`.
- `npm run distill -- <path>`: Extracts atomic evergreen concepts from the specified note and creates new files in `08-Concepts/`.
- `npm run log-github`: Fetches today's GitHub activity and appends a collapsible summary under `## 📝 Daily Log` in today's daily note.
- `npm run sync-kanban`: Runs two-way synchronization between Obsidian Kanban boards and GitHub Projects v2.
- `npm run start-task -- <project> "<title>"`: Converts a Kanban card to a GitHub issue, creates a Git branch, and moves the card to In Progress.

---

## Maintenance Rhythms

To keep the vault organized and performant over time, follow this schedule:

| Interval | Target | Recommended Actions |
| :--- | :--- | :--- |
| **Daily** | `Home.md` and `01-Daily/` | Check the dashboard, review carried tasks in today's daily note, and log evening habit completions. |
| **Weekly** | `00-Inbox/` and `07-Reviews/` | Tag unprocessed items in `quick-capture-dump.md` and run the `Triage Sweep` macro. Run `Weekly Review` to generate the week's retrospective. |
| **Monthly** | `07-Reviews/` and `02-Projects/` | Review `Habit Analytics Dashboard.md` for consistency trends. Move finished project cards to `## Archive`. |
| **Quarterly** | `08-Concepts/` | Open `00-Inbox/_Triage MOC.md` to find concepts past their 90-day review cycle (`review_cycle: 90d`). Refresh insights and update `last_reviewed`. |
