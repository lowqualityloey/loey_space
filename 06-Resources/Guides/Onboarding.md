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
  - topic/setup
---

# Onboarding

How to get from a fresh clone to a working vault. Most of the time is spent in Obsidian's settings
screens, not in a terminal.

## Three rules

1. **The system is public; your journal is not.** Scripts, templates, plugins and documentation ship
   with the repository. Your notes do not: `01-Daily/`, `02-Projects/`, `05-Personal/` and the rest
   are git-ignored, and so are the records below.
2. **You own your records.** `memory.md`, `handoff.md` and `00-Private/SOUL.md` live on your machine.
   The repository ships empty templates for them, never content.
3. **Credentials go in `.env`.** Never in a Markdown file, not even a private one. `.env` is
   git-ignored, and `.env.example` lists the variable names.

## What you need

- **Obsidian.** Everything below except the command in step 2 works without anything else installed.
  The scripts are committed as built bundles, so there is no build step to run.
- **Node.js 18 or newer** — only if you want `npm run init:vault`. You can equally copy the four files
  by hand from `06-Resources/scaffold/`; the command exists to make sure the copies get the right
  destinations, not to do anything you could not do yourself.

## First run

1. **Clone, open, and trust.** Clone the repository, then in Obsidian choose **Open folder as
   vault** and select the clone. Obsidian does not trust a vault it has not seen before: it asks
   **"Do you trust the author of this vault?"**. Choose **Trust author and enable plugins** —
   **Restricted Mode** keeps every community plugin off, so none of the workflows below run. The
   decision is remembered per machine; step 3 shows where to change it.
2. **Create your records.**
   ```bash
   npm run init:vault -- --dry-run   # show the plan
   npm run init:vault                # create what is missing
   ```
   It creates only files that do not exist. Run it as often as you like; it will never overwrite
   something you have written. If you would rather not use Node, copy `memory.template.md`,
   `handoff.template.md` and `profile.template.md` from `06-Resources/scaffold/` to `memory.md`,
   `handoff.md` and `00-Private/SOUL.md` at the vault root.
3. **Enable community plugins.** In **Settings → Community plugins**, turn community plugins on,
   confirm **Auto-update plugins is OFF** (two plugins here are local builds), and make sure the nine
   plugins the workflows need are enabled: **QuickAdd**, **Templater**, **Dataview**, **Calendar**,
   **Kanban**, **Kanban Status Sync**, **HomePulse**, **Activity History** and **Custom Attachment
   Location**. The clone enables more than that; [Setup & Configuration](Setup%20&%20Configuration.md)
   separates the required nine from the optional rest — extra features outside the core workflow that
   you can leave on or turn off. The first time the vault opens, **HomePulse also runs a short 4-step
   setup wizard** (homepage name, project folder, areas folder, widgets) before the dashboard exists.
   Complete all four steps: the wizard has **Back**, **Next** and **Finish**, no Skip, and closing it
   early leaves HomePulse uninitialized, so it reopens.
4. **Configure Templater.** Set **Template folder location** to `99-Templates` and turn
   **Trigger Templater on new file creation** on.
5. **Register the QuickAdd actions.** The exact names, script paths and choice IDs are in
   [Setup & Configuration](Setup%20&%20Configuration.md) — the hotkeys are bound to choice IDs, so
   recreating an action under a different ID leaves the documented shortcut dead.
6. **Add an API key (optional).** AI features need a Gemini key. `cp .env.example .env`, then put the
   key in `.env`. Everything except those features works without it.
7. **Open today's note.** `Ctrl/Cmd + P` → **Daily notes: Open today's daily note**. The dashboard is
   **HomePulse: Open Dashboard View**.

### `.obsidian/app.json` will look modified

As soon as Obsidian saves a setting for the first time, it rewrites `.obsidian/app.json`. Obsidian
writes JSON without a trailing newline while the repository tracks the file with one, so Git shows a
whitespace-only change — the same five values, `}` where the tracked file has `}\n`. That is normal:

- Do **not** git-ignore the file or strip its defaults; `attachmentFolderPath`, `newFileFolderPath`,
  `alwaysUpdateLinks`, `promptDelete` and `tabSize` are the settings the setup contract verifies.
- Only that newline changed? Restore the tracked form with `git checkout -- .obsidian/app.json`.
- A real setting changed? Keep it and commit it on its own, not mixed in with the newline noise.

## What step 2 created

| File | What it is | Visibility |
| :--- | :--- | :--- |
| `memory.md` | Durable facts: who you are, preferences, repositories you work in | Private, git-ignored |
| `handoff.md` | What is in flight and the next move. `Home.md` links two of its headings | Private, git-ignored |
| `00-Private/SOUL.md` | Optional assistant voice and boundaries | Private, git-ignored |
| `00-Inbox/quick-capture-dump.md` | Where quick captures land before triage | Private, git-ignored |

They are starting points with placeholder text. Rewrite them; deleting a section that does not
apply to you is expected.

The templates themselves are published in `06-Resources/scaffold/`. Treat them as the system, not as
notes: never put real private content in them.

## Optional: activate the git hooks

Git hooks are **inactive in a fresh clone** and stay inactive until you point Git at them:

```bash
git config --local core.hooksPath .githooks
```

That enables two hooks with different jobs:

- **`pre-commit` — blocking.** It refuses a commit that stages a secret-shaped string, a forbidden
  path (`.env`, `.secrets/`, `00-Private/`), or a declared owner-only record. It fails closed: if its
  scan library is missing it refuses the commit rather than reporting a partial pass.
  `git commit --no-verify` overrides it deliberately.
- **`post-commit` — non-blocking.** It logs the commit message when the `heyloey` CLI is installed
  and does nothing when it is not. Only this hook is fail-open.

The pre-commit checks also run in CI, so skipping this step does not leave the repository
unprotected — it only moves the feedback later.

## Working with an assistant

[`AGENTS.md`](../../AGENTS.md) is the canonical description of how an assistant should operate in this
vault: the routine commands, the logging policy, and the folder rules. Claude and Codex/OpenCode read
thin adapters ([`CLAUDE.md`](../../CLAUDE.md), [`CODEX.md`](../../CODEX.md)) that point at it. Any other
assistant can be pointed at `AGENTS.md` directly.

If an assistant reports that `memory.md` or `handoff.md` is missing, that is the expected state before
step 2 — run the command above rather than letting it improvise.

## Checks automation cannot make

The automated checks stop at the edge of the app. They can open files, assert command IDs and
exercise plugin APIs, but they cannot press a key, click a Settings toggle, or read a rendered widget
in a headless environment. Treat these as **unverified by automation** and confirm them by hand once,
in a disposable clone:

- [ ] **Keyboard** — `Ctrl/Cmd + P` opens the command palette; `Ctrl/Cmd + Shift + A` runs *AI Enrich
      Note*; the quick-capture shortcut appends a line to `00-Inbox/quick-capture-dump.md`.
- [ ] **Settings** — enabling community plugins sticks after a restart; **Templater → Trigger on new
      file creation** is on; the QuickAdd choices exist under the exact names and IDs in
      [Setup & Configuration](Setup%20&%20Configuration.md).
- [ ] **Rendered widgets** — the HomePulse dashboard opens with habits and Today's Focus; Dataview
      queries in the MOCs return rows; dragging a project Kanban card updates its `[/]` marker in
      today's note.
- [ ] **First-open flow** — a fresh clone shows the trust prompt, then the HomePulse 4-step wizard,
      and creating today's note leaves no `<% %>` markers behind.

## Verifying a clone

For maintainers checking that onboarding still works end to end:

```bash
npm ci
npm run init:vault
npm run init:vault          # second run must be a no-op
npm test                    # includes the clean-clone suite
```

The clean-clone suite builds its fixture from the working tree, so run it before committing; the
published artifact is verified by cloning the repository and repeating the two `init:vault` runs.
