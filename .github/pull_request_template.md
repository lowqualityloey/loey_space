# Pull Request Template

Thanks for contributing. This repository is an Obsidian vault — a personal knowledge
system — so the split below matters: **the system is open, the journal is not.**

## Scope check

- [ ] This PR touches **only** open scope: the `kanban-status-sync` plugin, automation
      scripts (`06-Resources/scripts/`), CSS snippets (`.obsidian/snippets/`), the
      pre-commit hook (`.githooks/`), templates (`99-Templates/`), or documentation
      (`AGENTS.md`, `README.md`, `06-Resources/Guides/`).
- [ ] This PR touches **no** personal-note folder (`00-Inbox/`, `01-Daily/`,
      `02-Projects/`, `03-Dev/`, `04-Learning/`, `05-Personal/`,
      `06-Resources/Articles/`, `07-Reviews/`, `08-Concepts/`, `99-Attachments/`).
      Those are closed to PRs — open an issue instead.

## Description

<!-- What problem does this solve, and why is this the right fix? -->

Closes #

## Verification evidence

<!-- Do not check a box without the command and its result. "It works" is not evidence. -->

- [ ] `npm ci` — clean install completed
- [ ] `npm run typecheck` — exit 0
- [ ] `npm run build` — exit 0
- [ ] `npm test` — `[N] passing, 0 failing`
- [ ] `npm run validate-templates` — exit 0 *(only if templates changed)*
- [ ] `git status --short` is empty after `npm run build` — committed bundles are
      byte-identical to a fresh build *(only if `06-Resources/scripts/` changed)*

### Manual verification

<!-- For anything a user sees, or anything a test can't reach. -->

1.
2.

## Rules that are easy to get wrong

- [ ] **`npm`, not `pnpm` or `yarn`.** `package-lock.json` is canonical and the test
      runner is a pinned devDependency. Do not regenerate the lockfile.
- [ ] **`node_modules/` is platform-specific.** `esbuild` ships one native binary per
      OS. If you build from a different shell than you installed from, do
      `rm -rf node_modules && npm ci` rather than sharing the directory between
      Windows and WSL.
- [ ] **Do not update `homepulse` or `kanban-status-sync` from the Community Store.**
      Both are bundled custom builds with no store equivalent; a store update replaces
      the local code. This applies to vendored plugin files under `.obsidian/plugins/`.
- [ ] **No secrets.** Credentials live only in `.env`, which is git-ignored. Never
      commit `.env`, `.secrets/`, or real keys — not even in a docs example.

## Reviewer focus areas

<!-- Which files, functions, or boundary conditions deserve extra scrutiny, and why? -->

- `path/to/file:lines`:

## Rollback

<!-- How can this be reverted safely? For docs/template changes, "revert the commit" is fine. -->

- [ ] No data or state migration to unwind
- [ ] Reverting this commit restores the prior behaviour
