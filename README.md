# loey_space

## What loey_space is

loey_space is a personal knowledge system built inside [Obsidian](https://obsidian.md). Daily notes, project boards, habit tracking and an inbox are plain Markdown files, so everything stays readable on your own machine without a proprietary database.

Four things sit on top of plain Markdown:

- **A dashboard and habits.** HomePulse shows active tasks, recent notes and six daily habits, and syncs them with today's daily note.
- **Projects that stay honest.** Cards live on project Kanban boards; dragging a card between lanes updates its checkbox marker, that marker mirrors into the daily note, and unfinished tasks roll forward to the next morning without being counted twice.
- **Fast capture, one triage pass.** Thoughts land in `00-Inbox/quick-capture-dump.md`, you tag them for a destination (`#do`, `#dev`, `#concept`), and one command files the batch.
- **Optional AI.** With a Gemini API key, scripts can draft end-of-day summaries, distil reusable snippets, or generate a weekly review. Every other feature works offline without a key.

## Public and private

The boundary is deliberate:

| Ships with the repository | Stays on your machine only |
| :--- | :--- |
| Scripts, templates, bundled plugins, documentation and the `.githooks/` guards | `01-Daily/`, `02-Projects/`, `05-Personal/` and the other numbered content folders |
| Empty starting templates for the assistant records | `memory.md`, `handoff.md`, `00-Private/` |
| `.env.example`, which lists variable names | `.env`, which holds your real keys |

Your notes are git-ignored, so a clone is a working system rather than somebody's journal. Real API keys belong in `.env` and never in a Markdown file, not even a private one. [Vault Security Policy](06-Resources/Guides/Vault%20Security%20Policy.md) covers the storage rules and the pre-commit scanner that enforces part of them.

## Getting started

```bash
git clone https://github.com/lowqualityloey/loey_space.git
cd loey_space
```

Then, in order:

1. **Open and trust.** In Obsidian choose **Open folder as vault** and select the clone. Choose **Trust author and enable plugins**, because Restricted Mode leaves every community plugin off.
2. **Create your records.** `npm run init:vault` writes `memory.md`, `handoff.md`, `00-Private/SOUL.md` and `00-Inbox/quick-capture-dump.md` if they are missing, and never overwrites a file that exists. Without Node, copy the three templates from `06-Resources/scaffold/` and write the dump by hand — [Onboarding](06-Resources/Guides/Onboarding.md) has the details.
3. **Enable the plugins, then finish the HomePulse wizard.** Confirm **Auto-update plugins: OFF** first, then complete the four-step HomePulse setup that runs the first time the vault opens.
4. **Configure Templater and QuickAdd.** Use the exact action names and choice IDs in [Setup & Configuration](06-Resources/Guides/Setup%20&%20Configuration.md): the tracked hotkeys are bound to choice IDs, so recreating an action under a new ID leaves its documented shortcut dead.
5. **Add an API key if you want the AI features.** `cp .env.example .env`, then paste a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
6. **Open today's note.** `Ctrl/Cmd + P` → **Daily notes: Open today's daily note** creates `01-Daily/YYYY-MM/YYYY-MM-DD.md` from the template.

[Onboarding](06-Resources/Guides/Onboarding.md) is the same path with the detail behind each step: what every record is for, what the wizard asks, and the checks that no automation can make for you.

### Optional: the Git hooks

Hooks are inactive until you point Git at them. `pre-commit` blocks a commit that stages a secret-shaped string or a declared private record; `post-commit` records a milestone in today's daily note and `handoff.md`, but only for a commit that opts in with a `HeyLoey-Milestone:` trailer.

```bash
git config --local core.hooksPath .githooks
```

The [Git Hooks Guide](06-Resources/Guides/Git%20Hooks%20Guide.md) covers activation, permissions, the timeout, coordination and recovery.

## Documentation by goal

- **Setting up:** [Onboarding](06-Resources/Guides/Onboarding.md) · [Setup & Configuration](06-Resources/Guides/Setup%20&%20Configuration.md) · [Mobile Workflow Guide](06-Resources/Guides/Mobile%20Workflow%20Guide.md)
- **Day to day:** [Second Brain Guide](06-Resources/Guides/Second%20Brain%20Guide.md) · [QuickAdd Inbox Optimization Guide](06-Resources/Guides/QuickAdd%20Inbox%20Optimization%20Guide.md)
- **Assistant and automation:** [Hey Loey Guide](06-Resources/Guides/Hey%20Loey%20Guide.md) · [Git Hooks Guide](06-Resources/Guides/Git%20Hooks%20Guide.md) · [Weekly AI Summary Guide](06-Resources/Guides/Weekly%20AI%20Summary%20Guide.md)
- **Housekeeping:** [Maintenance & Troubleshooting](06-Resources/Guides/Maintenance%20&%20Troubleshooting.md) · [Tagging & Properties](06-Resources/Guides/Tagging%20&%20Properties.md) · [Plugin Ownership](06-Resources/Guides/Plugin%20Ownership.md)
- **Security and contributing:** [Vault Security Policy](06-Resources/Guides/Vault%20Security%20Policy.md) · [CONTRIBUTING](06-Resources/Guides/CONTRIBUTING.md) · [Documentation Index](06-Resources/Guides/Documentation%20Index.md)

## Contributing and license

The system layer — plugins, scripts, templates and documentation — is open to contributions. Personal content in the numbered folders is out of scope for a pull request. [CONTRIBUTING.md](06-Resources/Guides/CONTRIBUTING.md) lists the checks to run first.

Licensed under the MIT License; see [LICENSE](LICENSE).
