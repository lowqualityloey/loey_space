# loey_space

## What loey_space is

loey_space is a personal knowledge management system built inside Obsidian that combines daily notes, project boards, and habit tracking. It is organized around plain Markdown files so all tasks, logs, and reference materials remain readable on your local machine without proprietary databases.

## What it includes

1. **Dashboard and habit synchronization**: HomePulse, a local dashboard plugin, displays active tasks, recent notes, and six daily habits that sync directly with today's daily note.
2. **Structured task management**: Tasks live in daily notes and project Kanban boards. Dragging a card between lanes updates its checkbox state automatically, and unfinished tasks roll forward to the next morning without double-counting.
3. **Rapid capture and triage**: A plain-text dump file (`00-Inbox/quick-capture-dump.md`) lets you record thoughts on mobile or desktop, tag them with destination tokens like `#do` or `#concept`, and file them in one pass with a triage script.
4. **Optional AI assistance**: When configured with a Google Gemini API key, optional scripts can draft end-of-day summaries, distill reusable code concepts, or generate weekly retrospectives. All core note-taking, search, and task tracking functions work completely offline without an API key.

## Getting started

Before setup, keep three rules in mind:

- **Bundled custom plugins**: `homepulse` and `kanban-status-sync` are local builds in `.obsidian/plugins/`. Keep **Auto-update plugins: OFF** so community store updates do not overwrite custom code.
- **Runtime plugin configuration**: Plugin data files (`.obsidian/plugins/*/data.json`) are git-ignored by design, so you complete a short in-app setup for Templater and QuickAdd once after cloning.
- **Credential isolation**: Real API keys live only in the git-ignored `.env` file, never in tracked Markdown files.

Setup path:

1. **Clone and open**: Clone the repository and open the folder in Obsidian:
   ```bash
   git clone https://github.com/lowqualityloey/loey_space.git
   ```
   In Obsidian, select **Open folder as vault** and choose the cloned directory. Obsidian asks you to trust the vault on first open: choose **Trust author and enable plugins**, because **Restricted Mode** leaves every community plugin off.
2. **Create your records**: Three files the assistant instructions refer to (`memory.md`, `handoff.md`, and the optional `00-Private/SOUL.md`) are private and absent from a clone. Create them with `npm run init:vault`, which only ever adds files that are missing:
   ```bash
   npm run init:vault -- --dry-run   # show the plan
   npm run init:vault                # create what is missing
   ```
   See [Onboarding](06-Resources/Guides/Onboarding.md) for what it creates and what to do without Node installed.
3. **Enable community plugins**: In **Settings → Community plugins**, turn on community plugins, verify **Auto-update plugins: OFF**, and make sure the nine required plugins are enabled — HomePulse, QuickAdd, Templater, Dataview, Kanban, Kanban Status Sync, Calendar, Activity History, and Custom Attachment Location. The clone enables more plugins than that; [Setup & Configuration](06-Resources/Guides/Setup%20&%20Configuration.md) separates the required set from the optional rest — extra features outside the core workflow that you can leave on or turn off. The first time the vault opens, HomePulse also runs a short 4-step setup wizard before its dashboard exists; complete all four steps, since it has no Skip button and it reopens if closed early.
4. **Configure Templater**: In **Settings → Templater**, set **Template folder location** to `99-Templates`, turn **Trigger Templater on new file creation** to **On**, and leave **User script folder** empty.
5. **Register QuickAdd actions**: In **Settings → QuickAdd → Manage Macros**, create a macro for each script, then add each as a choice under **Add Choice → Macro** using these exact names:
   - **Quick Capture** → `06-Resources/scripts/quick-capture-action.js`
   - **Triage Sweep** → `06-Resources/scripts/triage-sweep.js`
   - **Weekly Review** → `06-Resources/scripts/weekly-ai-summary.js`
   - **AI Enrich Note** → `06-Resources/scripts/ai-enrich-action.js` (bound to `Ctrl/Cmd + Shift + A`)
   - *(Optional)* **Create Daily Note** → Template choice pointing to `99-Templates/Daily`.
   See [Setup & Configuration](06-Resources/Guides/Setup%20&%20Configuration.md) for the exact choice IDs required by the tracked hotkeys.
6. **Add an API key (optional)**: For AI features, copy the example file and add your key from [Google AI Studio](https://aistudio.google.com/app/apikey):
   ```bash
   cp .env.example .env
   ```
7. **Open today's note**: Press `Ctrl + P` and run **Daily notes: Open today's daily note** to create `01-Daily/YYYY-MM/YYYY-MM-DD.md`. Open the dashboard with **HomePulse: Open Dashboard View**.

See [Setup & Configuration](06-Resources/Guides/Setup%20&%20Configuration.md) for full configuration details.

## Daily workflow

Here is how a typical day flows through the vault:

- **Morning**: Open today's note with `Ctrl + P` → **Daily notes: Open today's daily note**. Carried-forward tasks appear under `### ✅ Tasks`. Write high-level intentions under `### 🎯 Today's Focus` as plain bullets, and record vitals (`mood`, `energy`, `sleep_hours`) in the frontmatter.
- **During the day**: Press your Quick Capture shortcut to append thoughts to `00-Inbox/quick-capture-dump.md`. On project boards in `02-Projects/`, drag a card to `In Progress`; Kanban Status Sync updates its marker to `[/]`, which mirrors into your daily note and task hub.
- **Evening**: Append destination tokens (such as `#do`, `#dev`, or `#concept`) to dump items and run `Ctrl + P` → **QuickAdd: Triage Sweep** to file them. Check off habits in the HomePulse dashboard to sync with your daily note. Log work under `## 📝 Daily Log`, and optionally press `Ctrl + Shift + A` to run AI enrichment.

## Documentation

Guides are organized by reader goal in `06-Resources/Guides/`:

- **Getting Started and Setup**:
  - [Onboarding](06-Resources/Guides/Onboarding.md): From a fresh clone to a working vault: the three rules, creating your private records, and the first daily note.
  - [Setup & Configuration](06-Resources/Guides/Setup%20&%20Configuration.md): Authoritative setup checklist, attachment rules, and QuickAdd registration.
  - [Mobile Workflow Guide](06-Resources/Guides/Mobile%20Workflow%20Guide.md): Mobile toolbar capture and desktop triage.
- **Everyday Workflows**:
  - [Second Brain Guide](06-Resources/Guides/Second%20Brain%20Guide.md): Folder layout, task lifecycle, and note connections.
  - [QuickAdd Inbox Optimization Guide](06-Resources/Guides/QuickAdd%20Inbox%20Optimization%20Guide.md): Rapid capture and optional classification templates.
- **Assistant and Automation**:
  - [Hey Loey Guide](06-Resources/Guides/Hey%20Loey%20Guide.md): Conversational prompts (`"hey loey"`), milestone logging, and CLI tool usage.
- **Reviews and Maintenance**:
  - [Weekly AI Summary Guide](06-Resources/Guides/Weekly%20AI%20Summary%20Guide.md): Weekly reviews, metrics, and Gemini data transmission details.
  - [Maintenance & Troubleshooting](06-Resources/Guides/Maintenance%20&%20Troubleshooting.md): Common error diagnosis and read-only versus mutating commands.
- **Security, Standards, and Contributing**:
  - [Vault Security Policy](06-Resources/Guides/Vault%20Security%20Policy.md): Storage boundaries, `.gitignore` rules, and secret protection.
  - [Tagging & Properties](06-Resources/Guides/Tagging%20&%20Properties.md): Frontmatter schemas and tag taxonomy.
  - [Plugin Ownership](06-Resources/Guides/Plugin%20Ownership.md): Bundled plugin provenance and patch restoration.
  - [CONTRIBUTING](06-Resources/Guides/CONTRIBUTING.md): Contribution scope, test mocking, and pull request guidelines.
  - [Documentation Index](06-Resources/Guides/Documentation%20Index.md): Complete directory of vault documentation.

Engineering records, specifications, and verification evidence live in `docs/`.

## Contributing and license

The vault system architecture (custom plugins, scripts, CSS snippets, templates, and documentation) is open to contributions. Personal content in numbered folders is private and closed to pull requests. See [CONTRIBUTING.md](06-Resources/Guides/CONTRIBUTING.md) for testing guidelines and pull request instructions.

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
