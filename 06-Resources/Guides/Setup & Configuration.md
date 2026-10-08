---
created: 2026-10-08
updated: 2026-10-08
type: guide
area: resources
status: active
tags:
  - type/guide
  - area/resources
  - topic/obsidian
  - topic/quickadd
---

# 🧰 Setup & Configuration Contract

What a fresh clone gets **from the repository**, what it must be given **in the app**, and how to prove the difference was closed. Written for [#118](https://github.com/lowqualityloey/loey_space/issues/118).

> [!IMPORTANT]
> Runtime plugin state (`.obsidian/plugins/*/data.json`) is **git-ignored on purpose**. That is the privacy boundary, not an oversight — but it also means a clone cannot ship the named actions by itself. This file is the missing half: the exact definitions, so setup is a checklist rather than an archaeology exercise.

---

## 1. What the repository already provides (verified in CI)

These are tracked, so they work in a fresh clone before any in-app step:

| Setting | File | Value |
| :--- | :--- | :--- |
| Daily note folder | `.obsidian/daily-notes.json` | `01-Daily` |
| Daily note format | `.obsidian/daily-notes.json` | `YYYY-MM/YYYY-MM-DD` (the monthly path) |
| Daily note template | `.obsidian/daily-notes.json` | `99-Templates/Daily` |
| Template folder | `.obsidian/templates.json` | `99-Templates` |
| Attachment root (fallback) | `.obsidian/app.json` | `99-Attachments` |
| New-note default (generic capture) | `.obsidian/app.json` | `00-Inbox` |

`06-Resources/scripts/tests/setup-contract.test.mjs` asserts every row above, so this table cannot rot silently.

### 1.1 Capture & attachment placement policy (one authority each)

**Capture.** Generic note creation (the core *New note* command, `Ctrl/Cmd + N`) lands in `00-Inbox`. Raw, unprocessed material stays there and out of `08-Concepts`, and because `00-Inbox/*` is git-ignored it also stays private until it is deliberately promoted. Nothing generic is ever created straight into `08-Concepts`.

A concept is created **deliberately**, through the concept workflow: either the **Concept** template (`99-Templates/Concept.md`, rendered by Templater) or the distill action (`06-Resources/scripts/distill-concept-action.js`). Both set `type: concept` and file the note under `08-Concepts/` — that is the only door into the evergreen folder.

**Attachment placement authority.** The **Custom Attachment Location** plugin (`obsidian-custom-attachment-location`) is the single authority for where a new attachment lands. It is the only component that can express the vault's declared monthly `YYYY-MM/` subfolder architecture, so it owns the pattern. Runtime plugin state (`.obsidian/plugins/*/data.json`) is git-ignored on purpose, so enter these sanitized values by hand:

```json
{
  "plugin": "obsidian-custom-attachment-location",
  "attachmentFolderPath": "99-Attachments/${date:{momentJsFormat:'YYYY-MM'}}",
  "attachmentRenameMode": "Only pasted images"
}
```

Obsidian's core setting (`.obsidian/app.json`, tracked) keeps `attachmentFolderPath` at the same root — `99-Attachments` — so an attachment never lands outside the media root even when the plugin is disabled. The core setting is a **root, never a second pattern**: the plugin's pattern must always start with the core value, which is what ties the two into one policy.

**Drawing / Markdown exceptions.** Excalidraw drawings are Markdown notes (`.excalidraw.md`), and every Markdown file is a note, not binary media. They are excluded from attachment collection (the plugin's path exclusions) so they stay beside their peers instead of being pulled into `99-Attachments`. Their hygiene is note hygiene — frontmatter, wikilinks, and the normal review cycle — not the unused-attachment sweep that applies to binary media.

**Optional migration.** If you move existing files to match this policy, back the vault up first, use link-preserving moves (Obsidian's own file move, or `git mv` on a clean tree), and re-resolve every link afterwards. Applying these documented defaults never moves existing attachments on its own.

**Guides, resources and code snippets stay distinct.** Long operational guides (`06-Resources/Guides/`) and reference material (`06-Resources/`) are notes; reusable code lives in `03-Dev/` (`type: snippet`). Do not bulk-move private records (`memory.md`, `handoff.md`, `01-Daily/`, `07-Reviews/`) as part of a placement change.

## 2. What must be configured once, in the app (~5 minutes)

Enable the required plugins first (**Settings → Community plugins**): **QuickAdd**, **Templater**, **Dataview**, **Calendar**, **Kanban**, **Kanban Status Sync**, **HomePulse**. Of these, `homepulse` and `kanban-status-sync` are local builds — never install or auto-update them from the store (`Plugin Ownership.md`).

### 2.1 QuickAdd — the five required actions

Create each as a **Macro** choice (**Settings → QuickAdd → Manage Macros → new macro → Add User Script**), then add it under **Add Choice → Macro**. Use these exact names, because the docs, `AGENTS.md` and the hotkeys reference them.

| # | Choice name | Type | Script or template | Settings that matter | Choice ID |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Create Daily Note** | Template | `99-Templates/Daily` — or the core command instead | Prefer the core **Daily notes: Open today's daily note**; it already applies the tracked monthly path | — |
| 2 | **Quick Capture** | Macro → User Script | `06-Resources/scripts/quick-capture-action.js` | Appends a timestamped line; no prompt required | `e4f0a1b2-ffff-4000-8000-000000000101` |
| 3 | **Triage Sweep** | Macro → User Script | `06-Resources/scripts/triage-sweep.js` | Requires **today's** daily note to exist; sweeps then logs, never silently deletes | `e4f0a1b2-ffff-4000-8000-000000000102` |
| 4 | **Weekly Review** | Macro → User Script | `06-Resources/scripts/weekly-ai-summary.js` | Needs `GEMINI_API_KEY` in `.env` for AI text; falls back offline otherwise | `e4f0a1b2-ffff-4000-8000-000000000103` |
| 5 | **AI Enrich Note** | Macro → User Script | `06-Resources/scripts/ai-enrich-action.js` | Explicitly invoked only — it never runs on its own | `e4f0a1b2-ffff-4000-8000-000000000100` |

> [!IMPORTANT]
> Choice #5's ID is **load-bearing**: `.obsidian/hotkeys.json` is tracked and already binds `Mod+Shift+A` to `quickadd:choice:e4f0a1b2-ffff-4000-8000-000000000100`. QuickAdd matches a hotkey by choice ID, not by name, so recreating that choice under a different ID leaves the documented `Ctrl/Cmd + Shift + A` shortcut dangling — which is exactly the state a fresh clone is in today. Keep the ID above, or update the hotkey to match the ID you actually created.

### 2.2 Templater

**Settings → Templater**:

| Setting | Value | Why |
| :--- | :--- | :--- |
| Template folder location | `99-Templates` | Same folder as the core `templates.json`; templates use `<% tp.date.now(…) %>` |
| Trigger Templater on new file creation | **On** | The daily template resolves `tp.date.now()` markers at creation |
| Enable folder templates | **Off** unless you add one | Folder templates are personal layout preferences |
| User script folder | Empty | This vault's logic lives in `06-Resources/scripts/`, not in a Templater script folder |
| Enable system commands | **Off** | No template in this vault needs shell access; leaving it off keeps a vault file from ever executing a command |

**Required vs optional:** §1 is required (already provided). §2.1 rows 2–5 and the first four Templater rows are required for the advertised workflow. Row 1 is optional — the core daily-note command covers it. Everything else in the plugins (layouts, colours, folder-note mappings) is preference.

## 3. Verification

Repeatable checks, all runnable any time:

1. `npm test` — includes `setup-contract.test.mjs`, which asserts §1's values, that the generic-capture default is `00-Inbox` and the Concept template is the explicit concept door, that the single attachment authority's pattern sits under the tracked core root with the `YYYY-MM` form, that the drawing/Markdown exceptions and link-preserving migration are documented, that every script named above exists, that the tracked hotkey's choice ID is the one this file declares, and that no runtime `data.json` is tracked.
2. **Command palette (`Ctrl/Cmd + P`)** — after §2.1, these five appear by name: *Create Daily Note*, *Quick Capture*, *Triage Sweep*, *Weekly Review*, *AI Enrich Note*.
3. **Daily path** — `Ctrl/Cmd + P` → *Daily notes: Open today's daily note* creates `01-Daily/YYYY-MM/YYYY-MM-DD.md` with the template's frontmatter rendered (no unrendered `<% %>` markers left).
4. **Hotkey** — `Ctrl/Cmd + Shift + A` runs the AI action on the active note (needs `GEMINI_API_KEY`; without one it reports a quota/key notice rather than failing silently).
5. **Capture → triage loop** — append a line to `00-Inbox/quick-capture-dump.md`, tag it `#do`, run *Triage Sweep* on a day whose daily note exists, and confirm the line lands in the note and the dump entry is logged as swept.
6. **Placement policy (disposable vault)** — create a generic scratch note and confirm it opens in `00-Inbox`; create a concept from the Concept template and confirm it lands in `08-Concepts/`; paste an image and draw an Excalidraw sketch, then confirm the image lands under `99-Attachments/YYYY-MM/` while the drawing stays a note. Existing attachments must be untouched by merely applying the defaults.

Steps 2–5 need the app; they are marked **unavailable** in any headless run rather than assumed passed.

## 4. If you add your own choices

Choose any IDs you like, but if you bind a hotkey, bind it to the ID QuickAdd generated — and if you *change* the AI action's ID, update `.obsidian/hotkeys.json` in the same commit so the tracked shortcut keeps resolving.

## 🔗 Related

- [[Plugin Ownership]] — `homepulse` / `kanban-status-sync` provenance and the update procedure
- [[Vault Security Policy]] — why runtime state and `.env` stay private
- [[Tagging & Properties]] — the frontmatter contract these templates write
- [[Second Brain Guide]] — the workflows these five actions drive
