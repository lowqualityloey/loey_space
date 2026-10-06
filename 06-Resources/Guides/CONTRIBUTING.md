---
created: 2026-09-01
updated: 2026-10-07
type: guide
status: active
area: system
tags:
  - type/guide
  - area/system
  - topic/contributing
---

# Contributing to `loey_space`

This repository is two things in one: a **reusable Obsidian system** (plugins, scripts, snippets, templates, hooks) and **one person's notes**. Contributions are welcome to the first and closed on the second — so this document is mostly a scope statement.

---

## ✅ Open to contributions

| Area | What's useful |
| :--- | :--- |
| [`.obsidian/plugins/kanban-status-sync/`](.obsidian/plugins/kanban-status-sync/) | Bug fixes, lane-mapping options, tests. Self-contained, ~500 lines, no build step — the best entry point. |
| [`06-Resources/scripts/src/`](06-Resources/scripts/src/) | AI enricher, triage sweep, weekly summary, GitHub Kanban sync (TypeScript source). Compiled via `npm run build`. |
| [`.obsidian/snippets/`](.obsidian/snippets/) | Theme and responsiveness fixes, particularly mobile. |
| [`.githooks/`](.githooks/) | Additional credential patterns, fewer false positives. |
| [`99-Templates/`](99-Templates/) | Template improvements that don't assume my personal habits. |
| Documentation | `README.md` and the guides in `06-Resources/`. Corrections especially welcome. |

## 🚫 Not open to contributions

* `01-Daily/`, `05-Personal/`, `07-Reviews/`, `00-Inbox/` — personal journal, habits and captures. Mostly git-ignored; what remains is dashboards.
* `03-Dev/`, `04-Learning/`, `08-Concepts/` — my own notes. Fine to read, not to edit.
* `.obsidian/plugins/homepulse/` — ships as a **built, minified `main.js` with no authoritative source available**, so the minified core cannot meaningfully be patched here. The readable prelude at the top of the bundle *is* locally owned and already carries vault patches (habit and focus sync) covered by tests. Read [`Plugin Ownership.md`](Plugin%20Ownership.md) first: it records the provenance, the owned symbols, and how to re-apply local changes after a plugin update. For the minified core, please open an issue instead of a PR.
* `.env`, `.secrets/` — never in the repo. See [Security](#-security).

**Issues are welcome for anything**, including the closed areas — a bug report about the dashboard is useful even when the fix has to happen elsewhere.

---

## 🛠️ Script Development & Verification

Vault user scripts are authored in TypeScript under [`06-Resources/scripts/src/`](06-Resources/scripts/src/) and bundled to CommonJS in [`06-Resources/scripts/`](06-Resources/scripts/) for Obsidian QuickAdd compatibility:

### Clean install first

`node_modules/` contains **platform-specific native binaries**. `esbuild` — which `npm run build` drives, and which the `tsx` test runner also depends on — ships exactly one binary per OS/arch, selected at install time. So a tree installed on Windows holds only `@esbuild/win32-x64`, and every later `npm run build` from WSL or Linux fails with *"You installed esbuild for another platform"*.

**Never share a `node_modules/` directory between operating systems**, including between Windows and WSL. Install per platform, from a clean tree:

```bash
rm -rf node_modules     # Windows PowerShell: Remove-Item -Recurse -Force node_modules
npm ci                  # exact versions from package-lock.json, this platform's binaries
```

`npm ci` is the supported command because `package-lock.json` pins every version — including the test runner, so `npm test` never downloads anything on demand. If you change a dependency, update `package.json` and `package-lock.json` together (`npm install --save-dev <pkg>`) and commit both.

Working from WSL against a vault on a Windows drive? Run `npm ci` from the WSL shell before your first build of the session, and again from PowerShell before the first Windows build. One shared directory means one of the two platforms is always broken.

Then:

```bash
# 1. Typecheck TypeScript source
npm run typecheck

# 2. Build single-file CommonJS bundles via esbuild
npm run build

# 3. Run automated unit test suite
npm test

# 4. Audit vault wikilinks & graph connectivity
npm run audit-links

# 5. Distill atomic evergreen concepts from articles/notes
npm run distill -- "path/to/note.md"

# 6. Start work on Kanban card & create GitHub issue + branch
npm run start-task -- <project-name> "<task-title>"

# 7. Sync today's GitHub commits/PRs into Daily Log (12h AM/PM)
npm run log-github

# 8. Sync GitHub Projects v2 Kanban boards (multi-project)
npm run sync-kanban

# 9. Validate vault templates against schema
npm run validate-templates
```

## 🧪 How to test without a vault

Every script here talks to Obsidian through a small slice of its API, so you can exercise it under plain Node by mocking `app.vault`. No Obsidian install, and no risk to anyone's notes:

```js
const files = new Map([["00-Inbox/quick-capture-dump.md", "- example #ref\n"]]);

global.Notice = class { constructor(msg) { console.log(msg); } };

const app = { vault: {
  getAbstractFileByPath: (p) => (files.has(p) ? { path: p } : null),
  read:    async (f)      => files.get(f.path),
  modify:  async (f, c)   => files.set(f.path, c),
  process: async (f, fn)  => files.set(f.path, fn(files.get(f.path))),
  create:  async (p, c)   => { files.set(p, c); return { path: p }; },
  createFolder: async ()  => {},
  getMarkdownFiles: ()    => [{ basename: "Example" }]
}};

require("./06-Resources/scripts/triage-sweep.js")({ app })
  .then(() => console.log(files.get("00-Inbox/quick-capture-dump.md")));
```

For the Kanban plugin, stub the `obsidian` module and import the pure helpers it exports for exactly this purpose (`syncBoard`, `parseBoard`, `normalizeWikiLink`, …):

```js
const src = require("fs").readFileSync(".obsidian/plugins/kanban-status-sync/main.js", "utf8")
  .replace('require("obsidian")', "STUB");
const stub = { Plugin: class {}, PluginSettingTab: class {}, Setting: class {}, Notice: class {} };
const mod = { exports: {} };
const api = new Function("STUB", "module", src + "\nreturn module.exports;")(stub, mod);

console.log(api.syncBoard("---\nkanban-plugin: board\n---\n\n## Done\n\n- [ ] task\n", {}).text);
```

Please include the check you ran in the PR description. Node's built-in `assert` is fine; there's no test framework to learn.

---

## 📝 Pull requests

1. **One concern per PR.** A lane-mapping fix and a CSS tweak are two PRs.
2. **Match the surrounding style** — TypeScript in `06-Resources/scripts/src/` (always run `npm run typecheck` and `npm run build`); plain CommonJS/CSS with no external runtime dependencies for standalone plugins and snippets.
3. **Say what you verified**, and what you couldn't. "Tested on desktop, not mobile" is genuinely useful.
4. **Never commit** `.env`, real API keys, or personal notes. Activate the guard first:


   ```bash
   git config core.hooksPath .githooks
   ```

5. **Don't reformat** files you aren't otherwise changing.

### Stacked pull requests

If a change is too big for one review, open it as a **stack**: a second PR whose base is the
first PR's branch rather than `main`. Stacks are supported here, and every pull request is
checked regardless of what it targets — the workflow does not filter on `main`, because a
`branches` filter matches the *base* branch and so silently skipped every stacked PR.

Two caveats come from GitHub rather than from this repository, and both bite a stack harder
than they bite a PR against `main`:

* **Pushing to a base branch does not re-run the checks on the PRs stacked on it.** Re-run the
  check yourself once the branch beneath yours moves, or you are reading a result computed
  against code that no longer exists.
* **No run happens at all while the pull request has a merge conflict.** An absent check is not
  a passing one, and a stack is likelier to be in that state than a PR against `main`.

## 🐛 Bug reports

Include your Obsidian version, desktop or mobile, the relevant console output (`Ctrl + Shift + I`), and what you expected. For AI features, note whether the notice mentioned a **quota limit** — a 429 means Gemini refused the request, which is not a bug in this code.

## 🔒 Security

Never open a public issue for a credential. If you find a key committed here, email the address on my GitHub profile.

Rules that apply to every contribution:

* Secrets live in `.env` only, which is git-ignored. Commit `.env.example` instead.
* `.secrets/` and `00-Private/` are never tracked.
* The [pre-commit hook](.githooks/pre-commit) blocks key-shaped strings and forbidden paths. It is a local guard, not a net — see the [Vault Security Policy](Vault%20Security%20Policy.md).
* A key that reached a public commit must be **rotated**. Rewriting history does not un-leak it.

---

## 📄 Licence

Contributions are accepted under the [MIT Licence](LICENSE), same as the rest of the project.
