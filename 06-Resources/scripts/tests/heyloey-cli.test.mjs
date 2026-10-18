/*
 * `heyloey` is the repository-local CLI. Its whole reason to exist is that a clone can run it
 * without a global install and without a machine-specific path, and that the commands that
 * claim to be read-only are, and the commands that write refuse rather than improvise.
 *
 * So every property here is driven through the BUNDLE as a process — the interface a user
 * actually gets — against synthetic fixtures in `os.tmpdir()`. Nothing touches the repository,
 * its private records or the owner's daily notes. The fixture vault is also the only thing the
 * tests ever name with `--root`, which is what proves the target is explicit rather than
 * guessed from the script's own location.
 *
 * The two properties most worth stating plainly:
 *   - read-only means no byte changes: `brief` and `context` are hash-compared before and after.
 *   - a write refuses when the record it would write to is missing, and when the heading it
 *     owns is missing. No replacement note structure is ever invented.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const BUNDLE = path.join(REPO_ROOT, "06-Resources/scripts/heyloey.js");
const SOURCE = path.join(REPO_ROOT, "06-Resources/scripts/src/heyloey.ts");
const SCAFFOLD = path.join(REPO_ROOT, "06-Resources/scaffold");

function todayStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dailyRel(date = todayStr()) {
  return path.join("01-Daily", date.slice(0, 7), `${date}.md`);
}

/** A directory that validates as a vault: the two markers the command requires, nothing else. */
function makeVault(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "heyloey-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "99-Templates"));
  fs.mkdirSync(path.join(root, ".obsidian"));
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# fixture vault\n");
  fs.writeFileSync(
    path.join(root, ".obsidian/daily-notes.json"),
    JSON.stringify({ folder: "01-Daily", format: "YYYY-MM/YYYY-MM-DD", template: "99-Templates/Daily" })
  );
  return root;
}

const DAILY_SENTINEL = "SENTINEL: a human's evening note must survive";
const HANDOFF_SENTINEL = "SENTINEL: an objective the user wrote";

/** A vault with the handoff record and today's daily note, both shaped like the templates. */
function makeFullVault(t) {
  const root = makeVault(t);
  const date = todayStr();

  fs.writeFileSync(
    path.join(root, "handoff.md"),
    [
      "# Session Handoff",
      "",
      "## 🎯 Current Main Objectives",
      "",
      `- ${HANDOFF_SENTINEL}`,
      "",
      "## Session Log",
      "",
      "### Latest Updates",
      "",
      "- [x] **[2026-01-01 09:00]** <what changed, and what it means for the next move>",
      "",
    ].join("\n")
  );

  const dailyPath = path.join(root, dailyRel());
  fs.mkdirSync(path.dirname(dailyPath), { recursive: true });
  fs.writeFileSync(
    dailyPath,
    [
      "---",
      `created: ${date}`,
      `updated: ${date}`,
      "type: daily",
      "area: personal",
      "mood: focused",
      "energy: 4",
      "sleep_hours: 7.5",
      "---",
      `# Fixture day`,
      "",
      "### 🎯 Today's Focus",
      "> _What's the 1-3 things I want to accomplish today?_",
      "",
      "- Ship the parser fix",
      "",
      "### ✅ Tasks",
      "- [x] Done task",
      "- [ ] Open task",
      "",
      "### 🔁 Habits",
      "- [x] water",
      "- [ ] move",
      "",
      "## 📝 Daily Log",
      "> _A running timestamp of what happened today._",
      "- ",
      "",
      "---",
      "",
      "## 🌇 End of the Day...",
      "",
      DAILY_SENTINEL,
      "",
    ].join("\n")
  );
  return root;
}

function run(args, cwd = REPO_ROOT) {
  return spawnSync(process.execPath, [BUNDLE, ...args], { cwd, encoding: "utf8" });
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Every file under a root, relative path -> content hash. Used to prove a command wrote nothing. */
function snapshot(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) out.push([path.relative(root, absolute), sha256(absolute)]);
    }
  };
  walk(root);
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

test("the bundled command exists (the suite would otherwise test nothing)", () => {
  assert.ok(
    fs.existsSync(BUNDLE),
    `missing ${path.relative(REPO_ROOT, BUNDLE)} — run \`npm run build\`; CI builds before it tests`
  );
});

test("--help documents every command, its write behaviour and the chat/CLI distinction", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  for (const command of ["brief", "context", "done", "learn"]) {
    assert.ok(result.stdout.includes(command), `help must document \`${command}\``);
  }
  assert.match(result.stdout, /--dry-run/, "help must document --dry-run");
  assert.match(result.stdout, /--root/, "help must document explicit vault targeting");
  assert.match(result.stdout, /read-only/i, "help must say which commands only read");
  assert.ok(
    /chat prefix/i.test(result.stdout),
    "help must distinguish the CLI from the `\"heyloey\"` chat prefix"
  );
});

test("a bare invocation prints help and exits 0", () => {
  const result = run([]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

test("an unknown command and an unknown option are usage errors (exit 2)", () => {
  const unknownCommand = run(["nonsense"]);
  assert.equal(unknownCommand.status, 2, "an unknown command must not be treated as a vault op");

  const unknownOption = run(["--nope", "brief"]);
  assert.equal(unknownOption.status, 2);
});

test("--root targets that directory, independently of the working directory", (t) => {
  const root = makeFullVault(t);
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "heyloey-cwd-"));
  t.after(() => fs.rmSync(elsewhere, { recursive: true, force: true }));

  const result = run(["--root", root, "brief"], elsewhere);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.ok(
    result.stdout.includes(dailyRel().replace(/\\/g, "/")),
    `--root must read the named vault's daily note:\n${result.stdout}`
  );
  assert.deepEqual(fs.readdirSync(elsewhere), [], "the target is the named vault, never the cwd");
});

test("the default target is the working directory", (t) => {
  const root = makeFullVault(t);
  const result = run(["brief"], root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /Vault root: \./, "with no --root the vault is where the command ran");
});

test("a directory that is not a vault is refused, and nothing is written", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "heyloey-nonvault-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = run(["--root", root, "brief"]);
  assert.equal(result.status, 1, "a non-vault target must fail rather than guess");
  assert.match(result.stderr, /not a vault/);
  assert.match(result.stderr, /AGENTS\.md/);
  assert.deepEqual(fs.readdirSync(root), [], "a refused run must write nothing");
});

test("brief is read-only and reports the day's shape without echoing record bodies", (t) => {
  const root = makeFullVault(t);
  const before = snapshot(root);

  const result = run(["brief"], root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.deepEqual(snapshot(root), before, "brief must change no byte in the vault");
  assert.match(result.stdout, /Focus: 1 intention/);
  assert.match(result.stdout, /Tasks: 1 open \/ 1 done/);
  assert.match(result.stdout, /Habits: 1\/2/);
  assert.match(result.stdout, /mood=focused/);
  assert.match(result.stdout, /Inbox: 0 unprocessed/);
  assert.ok(
    !result.stdout.includes(DAILY_SENTINEL) && !result.stdout.includes(HANDOFF_SENTINEL),
    "brief must summarize, never echo note bodies"
  );
});

test("brief reports absent records plainly instead of creating them", (t) => {
  const root = makeVault(t);
  const before = snapshot(root);

  const result = run(["brief"], root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /memory\.md missing/);
  assert.match(result.stdout, /handoff\.md missing/);
  assert.match(result.stdout, /Today \([^)]+\): .* missing/);
  assert.deepEqual(snapshot(root), before, "brief must never create a missing record");
});

test("context routes a query to matching notes and stays read-only", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "02-Projects/kanban-sync"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "02-Projects/kanban-sync/kanban-sync.md"),
    "# kanban sync\n\n## Sync rules\n\nBoards mirror their lanes.\n"
  );
  const before = snapshot(root);

  const result = run(["context", "kanban sync"], root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.ok(
    result.stdout.includes("02-Projects/kanban-sync/kanban-sync.md"),
    `context must route to the project hub:\n${result.stdout}`
  );
  assert.deepEqual(snapshot(root), before, "context must change no byte in the vault");
});

test("context with no query is a usage error and writes nothing", (t) => {
  const root = makeFullVault(t);
  const before = snapshot(root);
  const result = run(["context"], root);
  assert.equal(result.status, 2);
  assert.deepEqual(snapshot(root), before);
});

test("done refuses when today's daily note is absent, and writes nothing", (t) => {
  const root = makeVault(t);
  fs.writeFileSync(path.join(root, "handoff.md"), "### Latest Updates\n");
  const before = snapshot(root);

  const result = run(["done", "Ship the parser fix"], root);

  assert.equal(result.status, 4, "a missing daily note is a `refused` outcome (exit 4)");
  assert.match(result.stderr, /daily note is absent/);
  assert.deepEqual(snapshot(root), before, "a refused run must write nothing");
});

test("done refuses when handoff.md is absent, and writes nothing", (t) => {
  const root = makeFullVault(t);
  fs.rmSync(path.join(root, "handoff.md"));
  const before = snapshot(root);

  const result = run(["done", "Ship the parser fix"], root);

  assert.equal(result.status, 4);
  assert.match(result.stderr, /handoff\.md is absent/);
  assert.deepEqual(snapshot(root), before);
});

test("done --dry-run prints the targets and lines but writes nothing", (t) => {
  const root = makeFullVault(t);
  const before = snapshot(root);

  const result = run(["done", "Ship the parser fix", "--dry-run"], root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /Dry run — nothing was written/);
  assert.match(result.stdout, new RegExp(dailyRel().replace(/\\/g, "/").replace(/[/.]/g, "\\$&")));
  assert.match(result.stdout, /- \*\*\d{2}:\d{2}\*\*: Ship the parser fix/);
  assert.deepEqual(snapshot(root), before, "--dry-run must write nothing at all");
});

test("done writes the documented format to the daily log and the handoff, preserving both", (t) => {
  const root = makeFullVault(t);
  const summary = "Ship the parser fix";

  const result = run(["done", summary], root);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);

  const daily = fs.readFileSync(path.join(root, dailyRel()), "utf8");
  assert.match(daily, /- \*\*\d{2}:\d{2}\*\*: Ship the parser fix/, "daily log line format");
  assert.ok(daily.includes(DAILY_SENTINEL), "the rest of the daily note must survive");
  // The entry must land inside the Daily Log section, not after the `---` divider.
  const logStart = daily.indexOf("## 📝 Daily Log");
  const logEnd = daily.indexOf("\n---\n", logStart);
  assert.ok(logStart !== -1 && logEnd !== -1, "the fixture must keep its Daily Log section and divider");
  const logSection = daily.slice(logStart, logEnd);
  assert.ok(logSection.includes(summary), "the entry must sit under `## 📝 Daily Log`");

  const handoff = fs.readFileSync(path.join(root, "handoff.md"), "utf8");
  assert.match(
    handoff,
    /- \[x\] \*\*\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\*\* Ship the parser fix/,
    "handoff line format"
  );
  assert.ok(handoff.includes(HANDOFF_SENTINEL), "the handoff's own content must survive");
});

test("done refuses when the daily note has no Daily Log section", (t) => {
  const root = makeVault(t);
  fs.mkdirSync(path.join(root, "01-Daily", todayStr().slice(0, 7)), { recursive: true });
  fs.writeFileSync(
    path.join(root, dailyRel()),
    ["---", "type: daily", "---", "# A note with no Daily Log heading", ""].join("\n")
  );
  fs.writeFileSync(path.join(root, "handoff.md"), "### Latest Updates\n");
  const before = snapshot(root);

  const result = run(["done", "Ship the parser fix"], root);

  assert.equal(result.status, 4, "an absent heading is a `refused` outcome (exit 4)");
  assert.match(result.stderr, /no `## 📝 Daily Log` section/);
  assert.deepEqual(snapshot(root), before);
});

test("done refuses when handoff.md has no Latest Updates section", (t) => {
  const root = makeFullVault(t);
  fs.writeFileSync(path.join(root, "handoff.md"), "# Handoff without the section\n");
  const before = snapshot(root);

  const result = run(["done", "Ship the parser fix"], root);

  assert.equal(result.status, 4);
  assert.match(result.stderr, /no `### Latest Updates` section/);
  assert.deepEqual(snapshot(root), before);
});

test("learn creates a snippet note with the documented frontmatter", (t) => {
  const root = makeFullVault(t);

  const result = run(["learn", "Debounce", "const debounce = (fn, ms) => setTimeout(fn, ms);"], root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  const note = fs.readFileSync(path.join(root, "03-Dev/Debounce.md"), "utf8");
  assert.match(note, /^type: snippet$/m, "a snippet must declare type: snippet");
  assert.match(note, /^area: dev$/m);
  assert.match(note, /^status: active$/m);
  assert.match(note, /^language: javascript$/m, "the fence language must be detected");
  assert.ok(note.includes("## ⚡ The Code / Implementation"));
  assert.ok(note.includes("const debounce"), "the pattern must be preserved verbatim");
});

test("learn --dry-run prints the plan and writes nothing", (t) => {
  const root = makeFullVault(t);
  const before = snapshot(root);

  const result = run(["learn", "Debounce", "const x = 1;", "--dry-run"], root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /Dry run — nothing was written/);
  assert.match(result.stdout, /03-Dev\/Debounce\.md/);
  assert.match(result.stdout, /# 💻 Debounce/);
  assert.deepEqual(snapshot(root), before, "--dry-run must create no note");
});

test("learn merges into a colliding note instead of overwriting it, and never stacks regions", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  const curated = [
    "---",
    "created: 2026-01-01",
    "updated: 2026-01-01",
    "type: snippet",
    "area: dev",
    "status: active",
    "language: javascript",
    "---",
    "",
    "# 💻 Debounce",
    "",
    "My hand-written notes that must survive.",
    "",
    "## 🔗 Related Resources & Notes",
    "- [[Some Real Note]]",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(root, "03-Dev/Debounce.md"), curated);

  const first = run(["learn", "Debounce", "const debounce = () => {};"], root);
  assert.equal(first.status, 0, `expected exit 0: ${first.stderr}`);

  const merged = fs.readFileSync(path.join(root, "03-Dev/Debounce.md"), "utf8");
  assert.ok(merged.includes("My hand-written notes that must survive."), "curated body preserved");
  assert.ok(merged.includes("[[Some Real Note]]"), "manual links preserved");
  assert.match(merged, /^created: 2026-01-01$/m, "original created date wins");
  assert.ok(!/^created: 20\d\d-\d\d-\d\d$/m.test(merged.replace(/^created: 2026-01-01$/m, "")), "generated created date must not win");
  assert.ok(merged.includes("<!-- heyloey:learn:start -->"), "new material lands in a marked region");

  const second = run(["learn", "Debounce", "const debounce = () => {};"], root);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /nothing changed/);
  assert.equal(
    fs.readFileSync(path.join(root, "03-Dev/Debounce.md"), "utf8"),
    merged,
    "re-running the identical pattern must be a byte-for-byte no-op"
  );
  assert.equal(
    merged.split("<!-- heyloey:learn:start -->").length - 1,
    1,
    "marked regions must not accumulate"
  );
});

test("learn treats a case-only collision as a merge, not a second note", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  fs.writeFileSync(path.join(root, "03-Dev/debounce.md"), "# existing\nkeep me\n");

  const result = run(["learn", "Debounce", "const x = () => 1;"], root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  const files = fs.readdirSync(path.join(root, "03-Dev")).sort();
  assert.deepEqual(files, ["debounce.md"], "no case-variant sibling may be created");
  assert.ok(
    fs.readFileSync(path.join(root, "03-Dev/debounce.md"), "utf8").includes("keep me"),
    "the existing note's body must survive the merge"
  );
});

test("learn requires both a title and a pattern", (t) => {
  const root = makeFullVault(t);
  const before = snapshot(root);
  const result = run(["learn", "OnlyATitle"], root);
  assert.equal(result.status, 2);
  assert.deepEqual(snapshot(root), before);
});

test("the source and bundle carry no username, home directory or machine path", () => {
  const forbidden = ["lowqualityloey", "/home/", "C:\\Users", "~/.local/bin"];
  for (const file of [SOURCE, BUNDLE]) {
    const text = fs.readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.ok(
        !text.includes(needle),
        `${path.relative(REPO_ROOT, file)} must not hard-code ${JSON.stringify(needle)}`
      );
    }
  }
});

test("package.json declares the bin entry and the documented npm script", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts.heyloey,
    "node 06-Resources/scripts/heyloey.js",
    "the documented `npm run heyloey` must be a declared script"
  );
  assert.equal(
    pkg.bin.heyloey,
    "06-Resources/scripts/heyloey.js",
    "the optional global install path needs a bin entry pointing at the bundle"
  );
});

// ---------------------------------------------------------------------------------------------
// Review finding 1 — every write target must stay inside the selected vault.
// ---------------------------------------------------------------------------------------------

test("done refuses a daily-note path traversal and leaves both records unchanged", (t) => {
  const root = makeFullVault(t);
  const escapeName = `escape-${path.basename(root)}`;
  // A config whose folder climbs out of the vault: the note name itself is data, so it must be
  // validated rather than trusted.
  fs.writeFileSync(
    path.join(root, ".obsidian/daily-notes.json"),
    JSON.stringify({ folder: `../../${escapeName}`, format: "YYYY-MM/YYYY-MM-DD" })
  );
  const handoffBefore = sha256(path.join(root, "handoff.md"));
  const dailyBefore = sha256(path.join(root, dailyRel()));
  const before = snapshot(root);

  const result = run(["done", "Ship the parser fix"], root);

  assert.equal(result.status, 4, "a traversing daily-note path is a `refused` outcome (exit 4)");
  assert.match(result.stderr, /refusing to write outside the vault/);
  assert.equal(sha256(path.join(root, "handoff.md")), handoffBefore, "the handoff must be untouched");
  assert.equal(sha256(path.join(root, dailyRel())), dailyBefore, "the daily note must be untouched");
  assert.deepEqual(snapshot(root), before, "no byte in the vault may change on a traversal refusal");
  assert.ok(
    !fs.existsSync(path.resolve(root, "..", "..", escapeName)),
    "nothing may be created outside the vault"
  );
});

test("done refuses a symlinked handoff escaping the vault, leaving the daily note unchanged", (t) => {
  const root = makeFullVault(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "heyloey-outside-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const outsideFile = path.join(outside, "handoff.md");
  fs.writeFileSync(outsideFile, "OUTSIDE SENTINEL\n");

  try {
    fs.rmSync(path.join(root, "handoff.md"));
    fs.symlinkSync(outsideFile, path.join(root, "handoff.md"));
  } catch {
    t.skip("symlinks are unavailable in this environment");
    return;
  }

  const dailyBefore = sha256(path.join(root, dailyRel()));
  const result = run(["done", "Ship the parser fix"], root);

  assert.equal(result.status, 4, "a symlinked handoff is a `refused` outcome (exit 4)");
  assert.match(result.stderr, /refusing to write outside the vault/);
  assert.equal(
    sha256(path.join(root, dailyRel())),
    dailyBefore,
    "validation must precede every write, so the daily note is untouched too"
  );
  assert.equal(
    fs.readFileSync(outsideFile, "utf8"),
    "OUTSIDE SENTINEL\n",
    "the outside file must not be written through the symlink"
  );
});

test("learn refuses a symlinked 03-Dev that escapes the vault", (t) => {
  const root = makeFullVault(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "heyloey-outside-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));

  try {
    fs.symlinkSync(outside, path.join(root, "03-Dev"), "dir");
  } catch {
    t.skip("symlinks are unavailable in this environment");
    return;
  }

  const result = run(["learn", "Escaper", "const x = 1;"], root);

  assert.equal(result.status, 1, "a symlinked snippet folder must be refused");
  assert.match(result.stderr, /refusing to write outside the vault/);
  assert.deepEqual(fs.readdirSync(outside), [], "nothing may be written through the symlink");
});

// ---------------------------------------------------------------------------------------------
// Review finding 2 — user patterns must survive `String.replace` replacement syntax literally.
// ---------------------------------------------------------------------------------------------

const DOLLAR_PATTERN = "replacement tokens: $&, $$, $', $` and $1 must stay literal";

test("learn preserves $&, $$, $', and $` literally through a region merge", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "03-Dev/Dollar.md"),
    "# 💻 Dollar\n\nHand-written anchor must survive.\n"
  );

  // Seed a marked region, so the next run takes the region-REPLACEMENT branch, which is where a
  // string replacement would interpret `$&`/`$$`/`$'`/`` $` `` as its own patterns.
  const seed = run(["learn", "Dollar", "const seed = 0;"], root);
  assert.equal(seed.status, 0, seed.stderr);

  const merged = run(["learn", "Dollar", DOLLAR_PATTERN], root);
  assert.equal(merged.status, 0, merged.stderr);

  const note = fs.readFileSync(path.join(root, "03-Dev/Dollar.md"), "utf8");
  assert.ok(
    note.includes(DOLLAR_PATTERN),
    "the literal pattern must be present verbatim, not reinterpreted as replacement syntax"
  );
  for (const token of ["$&", "$$", "$'", "$`"]) {
    assert.ok(note.includes(token), `the literal ${JSON.stringify(token)} must survive`);
  }
  assert.ok(note.includes("Hand-written anchor must survive."), "curated content survives");
  assert.equal(
    note.split("<!-- heyloey:learn:start -->").length - 1,
    1,
    "exactly one marked region"
  );

  const again = run(["learn", "Dollar", DOLLAR_PATTERN], root);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /nothing changed/);
  assert.equal(
    fs.readFileSync(path.join(root, "03-Dev/Dollar.md"), "utf8"),
    note,
    "a repeat run must be a byte-for-byte no-op"
  );
});

// ---------------------------------------------------------------------------------------------
// Review finding 3 — learned snippets connect to the Dev hub, without duplicating the link.
// ---------------------------------------------------------------------------------------------

test("learn connects the note to the existing Dev hub and never duplicates the link", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  fs.writeFileSync(path.join(root, "03-Dev/_Dev MOC.md"), "# 💻 Dev MOC\n");

  const first = run(["learn", "Hub Link", "const x = () => 1;"], root);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /connects: \[\[_Dev MOC\]\] \(existing Dev hub\)/);
  let note = fs.readFileSync(path.join(root, "03-Dev/Hub Link.md"), "utf8");
  assert.equal(note.split("[[_Dev MOC]]").length - 1, 1, "the snippet links to its hub exactly once");

  const second = run(["learn", "Hub Link", "const x = () => 1;"], root);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /nothing changed/);
  note = fs.readFileSync(path.join(root, "03-Dev/Hub Link.md"), "utf8");
  assert.equal(note.split("[[_Dev MOC]]").length - 1, 1, "a repeat run must not add a second link");

  // A different pattern merges new material but still must not duplicate the hub link.
  const third = run(["learn", "Hub Link", "const y = () => 2;"], root);
  assert.equal(third.status, 0, third.stderr);
  note = fs.readFileSync(path.join(root, "03-Dev/Hub Link.md"), "utf8");
  assert.equal(note.split("[[_Dev MOC]]").length - 1, 1, "a merge must not duplicate the hub link");
});

test("learn on a fresh title twice does not duplicate the body or the hub link", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  fs.writeFileSync(path.join(root, "03-Dev/_Dev MOC.md"), "# Dev MOC\n");

  assert.equal(run(["learn", "Twice", "const x = () => 1;"], root).status, 0);
  const afterFirst = fs.readFileSync(path.join(root, "03-Dev/Twice.md"), "utf8");

  const second = run(["learn", "Twice", "const x = () => 1;"], root);
  assert.equal(second.status, 0);
  const afterSecond = fs.readFileSync(path.join(root, "03-Dev/Twice.md"), "utf8");
  assert.equal(afterSecond, afterFirst, "a repeat run must be a byte-for-byte no-op");
  assert.equal(afterSecond.split("const x = () => 1;").length - 1, 1, "the body must not duplicate");
  assert.equal(afterSecond.split("[[_Dev MOC]]").length - 1, 1, "exactly one hub link");
});

test("learn does not invent a hub link when no Dev hub exists", (t) => {
  const root = makeFullVault(t);

  const result = run(["learn", "No Hub", "const x = 1;"], root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no hub link/);
  const note = fs.readFileSync(path.join(root, "03-Dev/No Hub.md"), "utf8");
  assert.ok(
    !note.includes("[[_Dev MOC]]"),
    "no phantom wikilink may be written when the hub does not exist"
  );
});

test("learn --dry-run reports the Dev hub connection and writes nothing", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  fs.writeFileSync(path.join(root, "03-Dev/_Dev MOC.md"), "# Dev MOC\n");
  const before = snapshot(root);

  const result = run(["learn", "Dry Hub", "const x = 1;", "--dry-run"], root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /connects: \[\[_Dev MOC\]\]/);
  assert.deepEqual(snapshot(root), before, "--dry-run must write nothing");
});

// ---------------------------------------------------------------------------------------------
// Review findings 1 & 2 — the hub link is note-level bookkeeping, the generated region is not.
//
// Two defects met here. The link de-duplication scanned the whole note, so a snippet whose fence
// legitimately held the line `- [[_Dev MOC]]` had its code deleted. And because the generated
// region carried its own copy of the link that the same pass then stripped, repeating an
// already-merged pattern rewrote the region and reported `merged` instead of doing nothing.
// ---------------------------------------------------------------------------------------------

/**
 * Count `- [[_Dev MOC]]` lines that are real connectivity, i.e. outside every code fence.
 *
 * Written independently of the production scan on purpose: the property under test is that
 * fenced content is never mistaken for note structure, so the oracle must not borrow the logic
 * whose fence handling it is checking.
 */
function countUnfencedHubLines(markdown) {
  let open = null;
  let count = 0;
  for (const line of markdown.split("\n")) {
    const fence = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (open === null) {
      if (fence && !(fence[1][0] === "`" && fence[2].includes("`"))) {
        open = fence[1];
        continue;
      }
      if (line.trim() === "- [[_Dev MOC]]") count++;
      continue;
    }
    if (fence && fence[1][0] === open[0] && fence[1].length >= open.length && fence[2].trim() === "") {
      open = null;
    }
  }
  return count;
}

function readSnippet(root, name) {
  return fs.readFileSync(path.join(root, `03-Dev/${name}.md`), "utf8");
}

const HUB_LITERAL_PATTERN = [
  "Markdown checklist sample:",
  "- [[_Dev MOC]]",
  "- [[Another Note]]",
  "end of sample",
].join("\n");

test("a fenced `- [[_Dev MOC]]` in the pattern survives, and only the real link is managed", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  fs.writeFileSync(path.join(root, "03-Dev/_Dev MOC.md"), "# 💻 Dev MOC\n");
  // An existing note that already carries the real link, which is the one thing to keep singular.
  fs.writeFileSync(
    path.join(root, "03-Dev/Hub Literal.md"),
    [
      "---",
      "created: 2026-01-01",
      "updated: 2026-01-01",
      "type: snippet",
      "area: dev",
      "status: active",
      "language: text",
      "---",
      "",
      "# 💻 Hub Literal",
      "",
      "Hand-written anchor.",
      "",
      "## 🔗 Related Resources & Notes",
      "- [[_Dev MOC]]",
      "",
    ].join("\n")
  );

  const result = run(["learn", "Hub Literal", HUB_LITERAL_PATTERN], root);
  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);

  const note = readSnippet(root, "Hub Literal");
  assert.ok(
    note.includes(`\`\`\`text\n${HUB_LITERAL_PATTERN}\n\`\`\``),
    "the pattern must survive verbatim inside its fence, literal hub line included"
  );
  assert.equal(countUnfencedHubLines(note), 1, "the note must keep exactly one real hub link");
  assert.ok(note.includes("Hand-written anchor."), "curated content survives");

  const repeat = run(["learn", "Hub Literal", HUB_LITERAL_PATTERN], root);
  assert.equal(repeat.status, 0);
  assert.match(repeat.stdout, /nothing changed/);
  assert.equal(readSnippet(root, "Hub Literal"), note, "an identical repeat must change zero bytes");
});

test("merging a second pattern and repeating it changes zero bytes", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  fs.writeFileSync(path.join(root, "03-Dev/_Dev MOC.md"), "# 💻 Dev MOC\n");

  assert.equal(run(["learn", "Two Steps", "const a = () => 1;"], root).status, 0);
  assert.equal(run(["learn", "Two Steps", "const b = () => 2;"], root).status, 0);
  const merged = readSnippet(root, "Two Steps");

  const repeat = run(["learn", "Two Steps", "const b = () => 2;"], root);
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.match(repeat.stdout, /nothing changed/, "a repeat of the merged pattern is a no-op");
  assert.ok(!repeat.stdout.includes("Merged"), "a no-op must not be reported as a merge");
  assert.equal(readSnippet(root, "Two Steps"), merged, "the repeat must change zero bytes");
  assert.equal(
    merged.split("<!-- heyloey:learn:start -->").length - 1,
    1,
    "the region must not accumulate"
  );
  assert.equal(countUnfencedHubLines(merged), 1, "exactly one hub link");
});

test("a hub line that only exists inside a fence is not connectivity", (t) => {
  const root = makeFullVault(t);
  fs.mkdirSync(path.join(root, "03-Dev"), { recursive: true });
  fs.writeFileSync(path.join(root, "03-Dev/_Dev MOC.md"), "# 💻 Dev MOC\n");
  fs.writeFileSync(
    path.join(root, "03-Dev/Fenced Only.md"),
    ["# 💻 Fenced Only", "", "Hand-written anchor.", "", "```md", "- [[_Dev MOC]]", "```", ""].join(
      "\n"
    )
  );

  assert.equal(run(["learn", "Fenced Only", "const c = () => 3;"], root).status, 0);
  const note = readSnippet(root, "Fenced Only");
  assert.equal(countUnfencedHubLines(note), 1, "a real link must be added outside every fence");
  assert.ok(note.includes("```md\n- [[_Dev MOC]]\n```"), "the fenced literal is left untouched");
  assert.match(note, /^## 🔗 Related Resources & Notes$/m, "the link lands in a real section");

  const repeat = run(["learn", "Fenced Only", "const c = () => 3;"], root);
  assert.equal(repeat.status, 0);
  assert.equal(readSnippet(root, "Fenced Only"), note, "no second link may accumulate");
  assert.equal(countUnfencedHubLines(readSnippet(root, "Fenced Only")), 1, "exactly one real link");
});

test("the scaffold templates still carry none of the CLI's identity literals", () => {
  // The scaffold MUST NOT name `heyloey` (it is a private-record template set), and the CLI
  // must not leak its name into it. This pins the separation the guide describes.
  for (const file of fs.readdirSync(SCAFFOLD)) {
    const text = fs.readFileSync(path.join(SCAFFOLD, file), "utf8");
    assert.ok(!text.includes("heyloey"), `scaffold/${file} must not name the CLI`);
  }
});
