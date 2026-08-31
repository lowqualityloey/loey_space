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
* `.obsidian/plugins/homepulse/` — ships as a **built, minified `main.js` with no source in this repo**, so it cannot meaningfully be patched here. Please open an issue instead of a PR.
* `.env`, `.secrets/` — never in the repo. See [Security](#-security).

**Issues are welcome for anything**, including the closed areas — a bug report about the dashboard is useful even when the fix has to happen elsewhere.

---

## 🛠️ Script Development & Verification

Vault user scripts are authored in TypeScript under [`06-Resources/scripts/src/`](06-Resources/scripts/src/) and bundled to CommonJS in [`06-Resources/scripts/`](06-Resources/scripts/) for Obsidian QuickAdd compatibility:

```bash
# 1. Typecheck TypeScript source
npm run typecheck

# 2. Build single-file CommonJS bundles via esbuild
npm run build

# 3. Validate vault templates against schema
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

## 🐛 Bug reports

Include your Obsidian version, desktop or mobile, the relevant console output (`Ctrl + Shift + I`), and what you expected. For AI features, note whether the notice mentioned a **quota limit** — a 429 means Gemini refused the request, which is not a bug in this code.

## 🔒 Security

Never open a public issue for a credential. If you find a key committed here, email the address on my GitHub profile.

Rules that apply to every contribution:

* Secrets live in `.env` only, which is git-ignored. Commit `.env.example` instead.
* `.secrets/` and `00-Private/` are never tracked.
* The [pre-commit hook](.githooks/pre-commit) blocks key-shaped strings and forbidden paths. It is a local guard, not a net — see the [Vault Security Policy](06-Resources/Vault%20Security%20Policy.md).
* A key that reached a public commit must be **rotated**. Rewriting history does not un-leak it.

---

## 📄 Licence

Contributions are accepted under the [MIT Licence](LICENSE), same as the rest of the project.
