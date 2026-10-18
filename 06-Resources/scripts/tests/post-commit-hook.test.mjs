/*
 * `.githooks/post-commit` is the one tracked hook that runs unattended, after the commit object
 * already exists. That gives it two obligations that are easy to get wrong and impossible to
 * notice: it must decide very little (a milestone is logged only when the commit opts in), and it
 * must never change the commit's outcome.
 *
 * The properties pinned here are driven through REAL `git commit` in disposable repositories that
 * carry a copy of the shipped hook, so the tests exercise what a clone runs rather than a
 * re-implementation of it. Every fixture lives in `os.tmpdir()`; nothing touches this repository,
 * its private records or the owner's daily notes.
 *
 * Two deliberate choices about the test doubles:
 *
 *   - The tool PATH is built from a toolbox of symlinks to the tools the hook needs, so `node` and
 *     `heyloey` are present only when a test puts them there. Otherwise whatever the developer has
 *     installed on PATH decides which branch a fixture exercises, and an assertion about "no tool
 *     available" could silently test the wrong branch.
 *   - Nothing consults a model. A classifier was prototyped during the milestone and removed after
 *     measurement, so the suite pins that removal — a `laya` on PATH must never even be executed —
 *     rather than a model's opinion, which would change with every checkpoint.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");

const HOOK = path.join(REPO_ROOT, ".githooks/post-commit");
const HOOK_LIB = path.join(REPO_ROOT, ".githooks/lib");
const BUNDLE = path.join(REPO_ROOT, "06-Resources/scripts/heyloey.js");
const PRE_COMMIT = path.join(REPO_ROOT, ".githooks/pre-commit");

/** Absolute git, resolved once so a controlled child PATH cannot break process spawning. */
const GIT_BIN = spawnSync("bash", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();

const TRAILER = "HeyLoey-Milestone:";

/**
 * The PATH real commits run under: the real Node, the system tools, and deliberately NOT
 * `~/.local/bin`, where a machine's own `heyloey` (and any other tool) lives.
 *
 * That keeps the suite fast and deterministic, and it is also the honest default case — a fresh
 * clone has no globally installed tools, so the guardrail must be skipped and logging must proceed.
 * The guardrail itself is exercised through a stub below, where the verdict can be controlled.
 */
const CONTROLLED_PATH = [path.dirname(process.execPath), "/usr/local/bin", "/usr/bin", "/bin"]
  .filter((dir) => fs.existsSync(dir))
  .join(":");

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayStr(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dailyRel(date = todayStr()) {
  return path.join("01-Daily", date.slice(0, 7), `${date}.md`);
}

const DAILY_SENTINEL = "SENTINEL: the day's own writing must survive";
const HANDOFF_SENTINEL = "SENTINEL: an objective the user wrote";

/**
 * A PATH containing only the tools the hook needs, plus whatever stubs a test asks for.
 *
 * `node` and `heyloey` are never symlinked: a test that needs one writes a stub. The real Node's
 * directory is appended separately by the cases that need the real logger to run.
 */
function makeToolbox(stubs = {}, { omit = [], extra = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "post-commit-toolbox-"));
  // `git` is required even when a test removes node: the hook itself shells out to git for the
  // repository root, the commit message and the ledger, and a fixture without it would pass for the
  // wrong reason.
  const needed = [
    "git",
    "bash",
    "env",
    "timeout",
    "mkdir",
    "rmdir",
    "rm",
    "sleep",
    "dirname",
    "basename",
    "awk",
    "sed",
    "grep",
    "head",
    "tail",
    "date",
    "tr",
    "cut",
    "sort",
    "wc",
    "cat",
  ];
  for (const name of [...needed, ...extra]) {
    if (omit.includes(name)) continue;
    const found = spawnSync("bash", ["-c", `command -v ${name}`], { encoding: "utf8" }).stdout.trim();
    if (!found) continue;
    try {
      fs.symlinkSync(found, path.join(dir, name));
    } catch {
      /* a duplicate name is not a problem for this fixture */
    }
  }
  for (const [name, body] of Object.entries(stubs)) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, body);
    fs.chmodSync(file, 0o755);
  }
  return dir;
}

function cleanup(...paths) {
  for (const p of paths) fs.rmSync(p, { recursive: true, force: true });
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * A disposable vault-shaped repository with a copy of the shipped hook.
 *
 * Git hooks are inactive until `core.hooksPath` is set, so activation is opt-in per test — that is
 * itself one of the behaviours under test.
 */
function makeVaultRepo(t, options = {}) {
  const {
    prefix = "post-commit-hook-",
    withBundle = true,
    withDailyNote = true,
    withHandoff = true,
  } = options;

  const repo = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));

  fs.cpSync(path.join(REPO_ROOT, ".githooks"), path.join(repo, ".githooks"), { recursive: true });
  fs.chmodSync(path.join(repo, ".githooks/post-commit"), 0o755);

  if (withBundle) {
    fs.mkdirSync(path.join(repo, "06-Resources/scripts"), { recursive: true });
    fs.copyFileSync(BUNDLE, path.join(repo, "06-Resources/scripts/heyloey.js"));
  }

  write(path.join(repo, "AGENTS.md"), "# fixture vault\n");
  write(path.join(repo, "99-Templates/Daily.md"), "# daily blueprint\n");
  write(
    path.join(repo, ".obsidian/daily-notes.json"),
    JSON.stringify({ folder: "01-Daily", format: "YYYY-MM/YYYY-MM-DD" })
  );

  if (withHandoff) {
    write(
      path.join(repo, "handoff.md"),
      [
        "# Session Handoff",
        "",
        "## 🎯 Current Main Objectives",
        "",
        `- ${HANDOFF_SENTINEL}`,
        "",
        "### Latest Updates",
        "",
        "- [x] **[2026-01-01 09:00]** <what changed, and what it means for the next move>",
        "",
      ].join("\n")
    );
  }

  if (withDailyNote) {
    write(
      path.join(repo, dailyRel()),
      [
        "---",
        `created: ${todayStr()}`,
        "type: daily",
        "---",
        `# Fixture day`,
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
  }

  // The fixture ignores its private records exactly as the real vault does, so `git add -A` cannot
  // stage them and the pre-commit hook's index advisory stays silent. `handoff.md` in particular is
  // declared owner-only: tracking it would warn on every commit made in this fixture.
  write(
    path.join(repo, ".gitignore"),
    ["memory.md", "handoff.md", ".env", "00-Private/", "01-Daily/", ""].join("\n")
  );

  git(repo, "init", "-q");
  git(repo, "add", "-A");
  // The baseline commit is made with hooks still inactive, so the fixture itself is never logged.
  git(repo, "commit", "-qm", "chore: fixture baseline");

  return repo;
}

function git(repo, ...args) {
  return spawnSync(GIT_BIN, args, { cwd: repo, env: GIT_ENV, encoding: "utf8" });
}

/** Activate the hooks exactly as the guide documents. */
function activate(repo) {
  git(repo, "config", "--local", "core.hooksPath", ".githooks");
}

/** A real commit through git, so the hook runs the way a user's commit runs it. */
function commit(repo, message, env = {}) {
  return spawnSync(GIT_BIN, ["commit", "--allow-empty", "-m", message], {
    cwd: repo,
    env: { ...GIT_ENV, PATH: CONTROLLED_PATH, ...env },
    encoding: "utf8",
  });
}

/**
 * Invoke the hook the way git does, without a commit in the way.
 *
 * Used only where PATH itself is the subject under test: a real `git commit` would also run the
 * blocking pre-commit hook, whose own tool needs (and whose advisory output) are a different
 * concern. Git invokes a hook as `<hook> <args>` with the working directory at the repository root,
 * which is what this reproduces.
 */
function runHook(repo, env = {}) {
  return spawnSync("bash", [".githooks/post-commit"], {
    cwd: repo,
    env: { ...GIT_ENV, ...env },
    encoding: "utf8",
  });
}

function ledgerPath(repo) {
  return path.join(repo, ".git", "heyloey-milestones");
}

function lockPath(repo) {
  return path.join(repo, ".git", "heyloey-milestones.lock");
}

/** The sibling directory a reclaim is serialised with: only its holder may remove a stale lock. */
function claimPath(repo) {
  return `${lockPath(repo)}.reclaim`;
}

/**
 * A hand-written lock, shaped exactly as a run leaves one.
 *
 * `writer` is the hook's three-state writer record: `none` (no writer was ever started), `pending` (a
 * fork was intended but the pid was never recorded) or a pid — and `null` for a lock carrying no
 * record at all, which is the state a reclaimer must treat as "a writer may exist".
 */
function writeLock(repo, { pid, at = Math.floor(Date.now() / 1000), writer = "none" }) {
  fs.mkdirSync(lockPath(repo), { recursive: true });
  fs.writeFileSync(path.join(lockPath(repo), "pid"), `${pid}\n`);
  fs.writeFileSync(path.join(lockPath(repo), "at"), `${at}\n`);
  if (writer !== null) fs.writeFileSync(path.join(lockPath(repo), "logger"), `${writer}\n`);
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let detachedSeq = 0;

/**
 * Run the hook for an interruption test: with no stdio pipes at all.
 *
 * A logger that outlived a broken hook would inherit a pipe and keep the test waiting for EOF, which
 * would turn a failed assertion into a hang. stderr goes to a file instead, and the hook is `exec`ed
 * so the pid handed back is the hook's own — the process the INT/TERM trap is installed on.
 */
function runHookDetached(t, repo, env = {}) {
  const errFile = path.join(repo, ".git", `post-commit-test-${process.pid}-${++detachedSeq}.err`);
  t.after(() => fs.rmSync(errFile, { force: true }));
  const child = spawn("bash", ["-c", `exec .githooks/post-commit 2>"${errFile}"`], {
    cwd: repo,
    env: { ...GIT_ENV, ...env },
    stdio: ["ignore", "ignore", "ignore"],
  });
  const done = new Promise((resolve) =>
    child.on("close", (code) =>
      resolve({ status: code, stderr: fs.existsSync(errFile) ? read(errFile) : "" })
    )
  );
  return { child, done };
}

/**
 * A logger that survives TERM, records its own pid, and would write to the note after `delayMs`.
 *
 * Both halves matter. `trap '' TERM` survives the `exec` into node, so only KILL can end it — that
 * is the escalation under test. The `exec` keeps it a single process, so nothing the hook cannot
 * reach is left behind holding the note open.
 */
function hangingLogger({ pidFile, noteFile, delayMs = 4000 }) {
  return [
    "#!/bin/sh",
    "trap '' TERM",
    `printf '%s\\n' "$$" > '${pidFile}'`,
    `exec "${process.execPath}" -e '`,
    'process.on("SIGTERM", function () {});',
    `setTimeout(function () { require("fs").appendFileSync(${JSON.stringify(noteFile)}, "- **late**: written by a logger that survived\\n"); }, ${delayMs});`,
    `setTimeout(function () { process.exit(0); }, ${delayMs + 6000});`,
    "'",
    "",
  ].join("\n");
}

/** Any file the hook left behind in the Git directory; there should never be one. */
function strayFiles(repo) {
  return fs
    .readdirSync(path.join(repo, ".git"))
    .filter((name) => name.startsWith("heyloey-postcommit"));
}

/** Run the hook without waiting for it, so two invocations can overlap. */
function runHookAsync(repo, env = {}) {
  const child = spawn("bash", [".githooks/post-commit"], {
    cwd: repo,
    env: { ...GIT_ENV, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const done = new Promise((resolve) =>
    child.on("close", (code) => resolve({ status: code, stdout, stderr }))
  );
  return { child, done };
}

async function waitFor(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

function ledgerKeys(repo) {
  const file = ledgerPath(repo);
  if (!fs.existsSync(file)) return [];
  return read(file).split("\n").filter(Boolean);
}

/** The Daily Log section body, so an assertion cannot pass on an entry that landed elsewhere. */
function dailyLogSection(repo) {
  const file = path.join(repo, dailyRel());
  if (!fs.existsSync(file)) return "";
  const text = read(file);
  const start = text.indexOf("## 📝 Daily Log");
  if (start === -1) return "";
  const end = text.indexOf("\n---\n", start);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

function logEntries(repo, summary) {
  return dailyLogSection(repo)
    .split("\n")
    .filter((line) => line.includes(summary));
}

// ---------------------------------------------------------------------------------------------
// The shipped artifacts: the hook must be the file git will actually run, and it must not carry
// the machine-specific behaviour it replaced.
// ---------------------------------------------------------------------------------------------

test("the shipped hook is executable — a non-executable hook is silently skipped by git", () => {
  const mode = spawnSync(GIT_BIN, ["ls-files", "-s", ".githooks/post-commit"], {
    cwd: REPO_ROOT,
    env: GIT_ENV,
    encoding: "utf8",
  }).stdout.trim();
  assert.match(
    mode,
    /^100755 /,
    `the tracked mode must be 100755, got: ${mode} — git ignores a hook it cannot execute, so the whole feature would be inert in every clone`
  );
  assert.ok(fs.statSync(HOOK).mode & 0o111, "the working-tree file must be executable too");
  assert.match(read(HOOK).split("\n")[0], /^#!\/usr\/bin\/env bash$/, "the hook needs a bash shebang");
});

test("the hook mutates no PATH and hard-codes no machine path", () => {
  const code = read(HOOK)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

  assert.ok(
    !/\bPATH\s*=/.test(code),
    "the hook must not assign PATH: the previous version prepended ~/.local/bin and ~/.cargo/bin, which can shadow the caller's own tools"
  );
  assert.ok(!/\.local\/bin|\.cargo\/bin|C:\\\\Users|\$HOME|~\/\./.test(code), "no machine-specific paths");
});

test("the hook prefers the repository-local bundle and calls `done` with an explicit vault root", () => {
  const code = read(HOOK);
  assert.ok(
    code.includes("06-Resources/scripts/heyloey.js"),
    "the repository-local bundle must be the preferred tool, so a clone needs no global install"
  );
  assert.match(code, /--root "\$repo_root" done/, "the vault must be named explicitly, never guessed");
  assert.ok(
    !/heyloey"?\s+log\b/.test(code),
    "`heyloey log` was never a real subcommand — it exited 2 on every commit, which is why nothing was ever logged"
  );
  assert.ok(
    code.indexOf("repo-local bundle") < code.indexOf("heyloey on PATH"),
    "the local bundle must be tried before a global binary"
  );
});

test("eligibility is the trailer alone: no classifier is consulted", (t) => {
  // A model-based classifier was prototyped in Milestone 3 and removed: measured on daily-log
  // summaries it ranked chores above milestones as often as below, and the same text scored
  // differently per run. This case pins the removal, because a future re-add would be a change to
  // what gets logged and deserves its own decision rather than a diff nobody noticed.
  const code = read(HOOK);
  assert.ok(!/laya/i.test(code), "the hook must not consult a classifier");
  assert.ok(
    !fs.existsSync(path.join(HOOK_LIB, "milestone-questions.json")),
    "no classifier spec may ship alongside the hook"
  );

  // And behaviourally: a `laya` on PATH that would have vetoed is never executed.
  const repo = makeVaultRepo(t);
  activate(repo);
  const sentinel = path.join(os.tmpdir(), `post-commit-laya-${process.pid}.txt`);
  const toolbox = makeToolbox({
    laya: `#!/bin/sh\nprintf 'consulted' > '${sentinel}'\nprintf '%s' '{"answers":{"milestone":{"noul":0.01}}}'\n`,
  });
  t.after(() => cleanup(toolbox, sentinel));
  const summary = "Ship the trailer-only logger";

  const result = commit(repo, `feat: trailer only\n\n${TRAILER} ${summary}`, {
    PATH: `${toolbox}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(logEntries(repo, summary).length, 1, "the trailer alone decides: the entry is logged");
  assert.ok(!fs.existsSync(sentinel), "nothing may run a classifier, not even to ask");
});

test("the blocking pre-commit hook is untouched by this change", () => {
  const pre = read(PRE_COMMIT);
  assert.ok(pre.includes("publication-guard"), "the publication boundary check must stay wired in");
  assert.ok(pre.includes("secret-scan.sh"), "the content scan must stay wired in");
  assert.ok(pre.includes("exit 1"), "pre-commit must still be able to refuse a commit");
  const code = pre
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
  assert.ok(!/\bPATH\s*=/.test(code), "pre-commit must not mutate PATH either");
});

// ---------------------------------------------------------------------------------------------
// Activation and opt-in: the two reasons a commit is not logged.
// ---------------------------------------------------------------------------------------------

test("hooks inactive: a milestone commit in an unactivated clone logs nothing", (t) => {
  const repo = makeVaultRepo(t);
  const before = sha256(path.join(repo, dailyRel()));

  const result = commit(repo, `feat: ship the thing\n\n${TRAILER} Ship the thing`);

  assert.equal(result.status, 0, `the commit must succeed: ${result.stderr}`);
  assert.equal(sha256(path.join(repo, dailyRel())), before, "git hooks are inactive until activated");
  assert.deepEqual(ledgerKeys(repo), [], "no ledger entry without an active hook");
});

test("not opted in: a commit with no trailer writes nothing", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const before = sha256(path.join(repo, dailyRel()));
  const handoffBefore = sha256(path.join(repo, "handoff.md"));

  const result = commit(repo, "chore: routine work that must not fill the daily log");

  assert.equal(result.status, 0, `the commit must succeed: ${result.stderr}`);
  assert.equal(sha256(path.join(repo, dailyRel())), before, "an unopted commit must not touch the daily note");
  assert.equal(sha256(path.join(repo, "handoff.md")), handoffBefore);
  assert.equal(result.stderr.trim(), "", "silence is the correct output for the common case");
});

test("an opted-in milestone is logged to the daily note and the handoff, once", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Make the post-commit hook portable and opt-in";

  const result = commit(repo, `feat(hooks): portable logger\n\n${TRAILER} ${summary}`);

  assert.equal(result.status, 0, `the commit must succeed: ${result.stderr}`);
  assert.match(result.stderr, /logged milestone to today's daily note and handoff\.md/, "the hook must report the outcome");

  const entries = logEntries(repo, summary);
  assert.equal(entries.length, 1, `expected one daily-log entry, got ${entries.length}:\n${entries.join("\n")}`);
  assert.match(entries[0], /^- \*\*\d{2}:\d{2}\*\*: /, "the documented `- **HH:MM**: <summary>` format");
  assert.ok(read(path.join(repo, dailyRel())).includes(DAILY_SENTINEL), "the rest of the daily note must survive");

  const handoff = read(path.join(repo, "handoff.md"));
  assert.match(handoff, /- \[x\] \*\*\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\*\* .*Make the post-commit hook portable/);
  assert.ok(handoff.includes(HANDOFF_SENTINEL), "the handoff's own content must survive");

  assert.equal(ledgerKeys(repo).length, 1, "a successful log must be recorded for duplicate avoidance");
  assert.ok(
    !read(path.join(repo, dailyRel())).includes(TRAILER),
    "the trailer syntax itself must never reach the record"
  );
});

test("an empty trailer is not an opt-in", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const before = sha256(path.join(repo, dailyRel()));

  const result = commit(repo, `feat: something\n\n${TRAILER}`);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(sha256(path.join(repo, dailyRel())), before, "an empty trailer must not log an empty entry");
});

test("duplicate avoidance: the same summary on the same day stays one entry", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Fix the carry-forward test";

  assert.equal(commit(repo, `fix: first\n\n${TRAILER} ${summary}`).status, 0);
  const first = logEntries(repo, summary);
  assert.equal(first.length, 1);

  // Amending, rebasing or re-running the hook must not stack a second identical entry.
  const second = commit(repo, `fix: amended\n\n${TRAILER} ${summary}`);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stderr, /already logged today/, "the hook must say why it did nothing");
  assert.equal(logEntries(repo, summary).length, 1, "a repeat summary must not duplicate");
  assert.equal(ledgerKeys(repo).length, 1, "the ledger must not grow either");
});

test("paths with spaces: a vault directory and a summary with spaces still log", (t) => {
  const repo = makeVaultRepo(t, { prefix: "post commit hook spaces " });
  activate(repo);
  const summary = "Settle the spaced-path behaviour once and for all";

  const result = commit(repo, `fix: spaces\n\n${TRAILER} ${summary}`);

  assert.equal(result.status, 0, `the commit must succeed: ${result.stderr}`);
  assert.equal(logEntries(repo, summary).length, 1, "quoting must survive a path with spaces");
});

test("a summary that starts with a hyphen is still logged", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);

  const result = commit(repo, `fix: leading dash\n\n${TRAILER} - fix the thing that broke`);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    logEntries(repo, "fix the thing that broke").length,
    1,
    "a leading hyphen must be stripped rather than read as a CLI option"
  );
});

// ---------------------------------------------------------------------------------------------
// Failure paths: none of these may affect the commit.
// ---------------------------------------------------------------------------------------------

test("missing records: an absent daily note refuses the entry and leaves the commit alone", (t) => {
  const repo = makeVaultRepo(t, { withDailyNote: false });
  activate(repo);
  const summary = "Nothing to write into yet";

  const result = commit(repo, `feat: early\n\n${TRAILER} ${summary}`);

  assert.equal(result.status, 0, `the commit must succeed: ${result.stderr}`);
  assert.ok(!fs.existsSync(path.join(repo, dailyRel())), "the hook must never scaffold a daily note");
  assert.match(result.stderr, /not logged/, "the refusal must be reported");
  assert.deepEqual(ledgerKeys(repo), [], "a refused entry must stay retryable");
});

test("missing tooling: with no node and no heyloey the hook is silent and writes nothing", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const toolbox = makeToolbox(); // deliberately no node, no heyloey, no laya
  t.after(() => cleanup(toolbox));
  const before = sha256(path.join(repo, dailyRel()));
  // The commit is real but logging is off, so the direct invocation below still finds the trailer in
  // HEAD without a second entry appearing first.
  assert.equal(
    commit(repo, `feat: nothing to run\n\n${TRAILER} Ship the parser fix`, { HEYLOEY_LOG: "off" }).status,
    0
  );
  const result = runHook(repo, { PATH: toolbox });

  assert.equal(result.status, 0, `the hook must exit 0 with nothing to run: ${result.stderr}`);
  assert.equal(result.stdout.trim(), "", "a missing tool is the expected state in a fresh clone");
  assert.equal(result.stderr.trim(), "", "and must not be reported on every commit");
  assert.equal(sha256(path.join(repo, dailyRel())), before);
  assert.deepEqual(ledgerKeys(repo), []);
});

test("no repo-local bundle and no global binary: silent skip", (t) => {
  const repo = makeVaultRepo(t, { withBundle: false });
  activate(repo);
  const toolbox = makeToolbox();
  t.after(() => cleanup(toolbox));
  const before = sha256(path.join(repo, dailyRel()));

  const result = runHook(repo, { PATH: toolbox });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.trim(), "");
  assert.equal(sha256(path.join(repo, dailyRel())), before);
});

test("a failing logger never fails the commit and never records the key", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const toolbox = makeToolbox({ node: "#!/bin/sh\necho 'logger exploded' >&2\nexit 3\n" });
  t.after(() => cleanup(toolbox));
  const before = sha256(path.join(repo, dailyRel()));

  const result = commit(repo, `feat: broken logger\n\n${TRAILER} Ship the parser fix`, { PATH: toolbox });

  assert.equal(result.status, 0, `a failing logger must not fail the commit: ${result.stderr}`);
  assert.equal(sha256(path.join(repo, dailyRel())), before, "nothing may be written by a failed logger");
  assert.match(result.stderr, /milestone not logged/, "the failure must be reported to the operator");
  assert.deepEqual(ledgerKeys(repo), [], "a failed log must stay retryable");
});

test("a TERM-resistant logger is force-killed, reaped and bounded", (t) => {
  // This logger ignores TERM, so only an escalation to KILL can end it. The hook must be back at
  // the commit prompt just after `heyloey.timeout` + the grace, with no writer left behind.
  const repo = makeVaultRepo(t);
  activate(repo);
  git(repo, "config", "--local", "heyloey.timeout", "1");
  const pidFile = path.join(os.tmpdir(), `post-commit-bound-pid-${process.pid}.txt`);
  const toolbox = makeToolbox({
    node: hangingLogger({ pidFile, noteFile: path.join(repo, dailyRel()) }),
  });
  t.after(() => cleanup(toolbox, pidFile));
  const before = sha256(path.join(repo, dailyRel()));

  const started = Date.now();
  const result = commit(repo, `feat: hang\n\n${TRAILER} Ship the parser fix`, { PATH: toolbox });
  const elapsed = Date.now() - started;
  const loggerPid = Number(read(pidFile).trim());

  assert.equal(result.status, 0, `the commit must succeed: ${result.stderr}`);
  assert.ok(elapsed >= 1000, `the bound must actually elapse, took ${elapsed}ms`);
  assert.ok(elapsed < 8000, `the bound must hold near timeout+grace, took ${elapsed}ms`);
  assert.match(result.stderr, /milestone not logged \(logger exit 124\)/);
  assert.ok(!processAlive(loggerPid), "the logger must not survive the bound");
  assert.equal(sha256(path.join(repo, dailyRel())), before, "a killed logger writes nothing");
  assert.deepEqual(ledgerKeys(repo), [], "a killed run records no key");
  assert.ok(!fs.existsSync(lockPath(repo)), "the lock must be released");
  assert.deepEqual(strayFiles(repo), [], "the capture file must not be left behind");
});

test("HEYLOEY_LOG=off and heyloey.log=false both disable the hook", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Disabled on purpose";
  const before = sha256(path.join(repo, dailyRel()));

  const byEnv = commit(repo, `feat: env off\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" });
  assert.equal(byEnv.status, 0, byEnv.stderr);
  assert.equal(byEnv.stderr.trim(), "");

  git(repo, "config", "--local", "heyloey.log", "false");
  const byConfig = commit(repo, `feat: config off\n\n${TRAILER} ${summary}`);
  assert.equal(byConfig.status, 0, byConfig.stderr);

  assert.equal(sha256(path.join(repo, dailyRel())), before, "both switches must prevent any write");
});

test("the blocking pre-commit checks still refuse a staged secret, and only that", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  // Assembled rather than written as one literal: the vault's own tracked-file scan
  // (`secret-scan.sh --tracked`, and the pre-commit hook that shares its patterns) flags
  // `<GEMINI|OPENAI|…>_API_KEY=<16+ credential chars>` in ANY tracked file — this test
  // included, since it exists to prove that very refusal. Joining the parts keeps the
  // fixture a real-looking credential while leaving no finding in tracked source.
  const stagedEnv = ["GEMINI_API_KEY=", "super_secret_value_", "1234567890"].join("");
  write(path.join(repo, ".env"), `${stagedEnv}\n`);
  git(repo, "add", "-f", ".env");
  const headBefore = git(repo, "rev-parse", "HEAD").stdout.trim();

  const blocked = commit(repo, "chore: stage an env file");
  assert.notEqual(blocked.status, 0, "a staged .env must still be refused");
  assert.equal(git(repo, "rev-parse", "HEAD").stdout.trim(), headBefore, "no commit may be created");

  // The same hook must not be over-blocking: a benign change commits normally.
  git(repo, "rm", "-q", "--cached", ".env");
  write(path.join(repo, "notes.md"), "# benign\n");
  git(repo, "add", "notes.md");
  const allowed = commit(repo, "docs: benign change");
  assert.equal(allowed.status, 0, `pre-commit must not block benign work: ${allowed.stderr}`);
});

// ---------------------------------------------------------------------------------------------
// Tool resolution: PATH is the caller's, and it is passed through untouched.
// ---------------------------------------------------------------------------------------------

test("the hook resolves tools through the caller's PATH and passes it through unchanged", (t) => {
  const repo = makeVaultRepo(t, { withBundle: false });
  activate(repo);
  const record = path.join(os.tmpdir(), `post-commit-path-${process.pid}.txt`);
  const toolbox = makeToolbox({
    heyloey: `#!/bin/sh\nprintf '%s' "$PATH" > '${record}'\nexit 0\n`,
  });
  t.after(() => cleanup(toolbox, record));

  // The hook reads the trailer from HEAD, so the commit is real; logging is off for it, otherwise
  // the entry would already be logged and duplicate avoidance would hide the stub.
  assert.equal(
    commit(repo, `feat: record the path\n\n${TRAILER} Ship the parser fix`, { HEYLOEY_LOG: "off" }).status,
    0
  );

  // Direct invocation makes the assertion exact. Through a real commit, git itself prepends its
  // own git-core directory to PATH, which would hide any prefix the hook added.
  const requestedPath = `${toolbox}:/usr/bin:/bin`;
  const result = runHook(repo, { PATH: requestedPath });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(record), "the global-binary fallback must have been used");
  assert.equal(
    read(record),
    requestedPath,
    "the hook must not prepend anything to PATH — the old version injected ~/.local/bin and ~/.cargo/bin"
  );
  assert.ok(
    !read(record).split(":").some((dir) => /(\.local\/bin|\.cargo\/bin)$/.test(dir)),
    "no machine-specific directory may enter the child environment"
  );
});

// ---------------------------------------------------------------------------------------------
// The ledger: ordering matters more than the mechanism.
// ---------------------------------------------------------------------------------------------

test("the ledger admits a key before the logger runs and records it only on success", (t) => {
  // Ordering is the whole design: a duplicate check that ran after logging would let a rebase
  // replay stack entries, and a key written before the logger succeeded would make a refusal
  // permanent. Both halves are asserted here, on the file the hook actually consults.
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Ship the ledger ordering";

  const before = ledgerKeys(repo);
  assert.deepEqual(before, [], "no key may exist before anything is logged");

  const failing = makeToolbox({ node: "#!/bin/sh\nexit 3\n" });
  t.after(() => cleanup(failing));
  const failedCommit = commit(repo, `fix: logger fails\n\n${TRAILER} ${summary}`, {
    PATH: `${failing}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
  });
  assert.equal(failedCommit.status, 0, failedCommit.stderr);
  assert.deepEqual(ledgerKeys(repo), [], "a failed run must leave no key, so the summary stays retryable");

  const ok = commit(repo, `fix: logger succeeds\n\n${TRAILER} ${summary}`);
  assert.equal(ok.status, 0, ok.stderr);
  const keys = ledgerKeys(repo);
  assert.equal(keys.length, 1, "a successful run records exactly one key");
  assert.match(keys[0], /^[0-9a-f]{40}$/, "the key is a git object id, not a fingerprint of the note");
  assert.ok(
    !read(ledgerPath(repo)).includes(summary),
    "the ledger must not carry the summary text itself"
  );
});

// ---------------------------------------------------------------------------------------------
// The bound does not depend on timeout(1). `timeout` is a coreutils tool, absent on a bare macOS,
// and a plain `timeout` never escalates past TERM — a TERM-resistant logger would hang the commit
// on it. The suite therefore removes `timeout` from PATH and asserts the same hard bound.
// ---------------------------------------------------------------------------------------------

test("the bound does not depend on timeout(1): a TERM-resistant logger still dies", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  git(repo, "config", "--local", "heyloey.timeout", "1");
  const pidFile = path.join(os.tmpdir(), `post-commit-notimeout-pid-${process.pid}.txt`);
  const toolbox = makeToolbox(
    { node: hangingLogger({ pidFile, noteFile: path.join(repo, dailyRel()) }) },
    { omit: ["timeout"] }
  );
  t.after(() => cleanup(toolbox, pidFile));
  const before = sha256(path.join(repo, dailyRel()));

  const started = Date.now();
  const result = commit(repo, `feat: no timeout\n\n${TRAILER} Ship the parser fix`, {
    PATH: `${toolbox}:${path.dirname(process.execPath)}`,
  });
  const elapsed = Date.now() - started;
  const loggerPid = Number(read(pidFile).trim());

  assert.equal(result.status, 0, `the commit must succeed: ${result.stderr}`);
  assert.ok(elapsed >= 1000 && elapsed < 8000, `bounded without timeout(1), took ${elapsed}ms`);
  assert.ok(!processAlive(loggerPid), "no logger may survive, with or without timeout(1)");
  assert.equal(sha256(path.join(repo, dailyRel())), before, "a killed logger writes nothing");
  assert.deepEqual(ledgerKeys(repo), [], "a killed run records no key");
  assert.ok(!fs.existsSync(lockPath(repo)), "the lock must be released");
  assert.deepEqual(strayFiles(repo), []);
});

test("without sleep(1), logging is skipped instead of run unbounded", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const sentinel = path.join(os.tmpdir(), `post-commit-unbounded-${process.pid}.txt`);
  // `timeout` is present and `sleep` is not: `timeout` cannot replace the escalation ladder, so a
  // run that cannot be bounded must not be started at all.
  const toolbox = makeToolbox(
    { node: `#!/bin/sh\nprintf 'ran' > '${sentinel}'\nexit 0\n` },
    { omit: ["sleep"] }
  );
  t.after(() => cleanup(toolbox, sentinel));
  const summary = "Must not be run unbounded";
  assert.equal(
    commit(repo, `feat: unbounded\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status,
    0
  );
  const before = sha256(path.join(repo, dailyRel()));

  const result = runHook(repo, { PATH: toolbox });

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /cannot be bounded/,
    "the skip must say why, rather than failing silently"
  );
  assert.ok(!fs.existsSync(sentinel), "the logger must not be started at all without a bound");
  assert.equal(sha256(path.join(repo, dailyRel())), before);
  assert.deepEqual(ledgerKeys(repo), []);
});

// ---------------------------------------------------------------------------------------------
// Coordination: the duplicate check, the logging run and the ledger update are one critical
// section. Two invocations that share a vault must never lose an entry or duplicate one.
// ---------------------------------------------------------------------------------------------

test("a live lock holder is respected and never stolen", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Blocked by a live holder";
  assert.equal(commit(repo, `feat: held\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);

  writeLock(repo, { pid: process.pid }); // this test process: alive
  const before = sha256(path.join(repo, dailyRel()));

  const result = runHook(repo);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /another invocation is already logging/, "silent skipping is not enough");
  assert.equal(sha256(path.join(repo, dailyRel())), before, "a skip must write nothing");
  assert.deepEqual(ledgerKeys(repo), [], "a skip must not record a key");
  assert.ok(fs.existsSync(lockPath(repo)), "a live holder's lock must survive");
  assert.equal(
    read(path.join(lockPath(repo), "pid")).trim(),
    String(process.pid),
    "the lock must still belong to its holder"
  );
});

test("a stale lock with a dead holder is reclaimed and reported", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const nowSecs = () => Math.floor(Date.now() / 1000);
  const hold = (pid, atSecs) => writeLock(repo, { pid, at: atSecs });

  // A pid that has certainly exited: the hook must not treat a dead holder as a locked vault.
  const deadPid = Number(spawnSync("bash", ["-c", "echo $$"], { encoding: "utf8" }).stdout.trim());
  const fromDead = "Reclaimed from a dead holder";
  assert.equal(commit(repo, `feat: dead\n\n${TRAILER} ${fromDead}`, { HEYLOEY_LOG: "off" }).status, 0);
  hold(deadPid, nowSecs());

  const first = runHook(repo);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(logEntries(repo, fromDead).length, 1, "a dead holder must not block logging");
  assert.equal(ledgerKeys(repo).length, 1);
  assert.ok(!fs.existsSync(lockPath(repo)), "the reclaimed lock must be released");
  assert.match(
    first.stderr,
    /reclaimed a stale coordination lock/,
    "a takeover must be reported: it is the signature of an interrupted run, and the moment to look for a partial write"
  );
  assert.ok(!fs.existsSync(claimPath(repo)), "a completed reclaim must not leave its claim behind");
});

test("an old but live holder is respected: age never steals a live lock", (t) => {
  // `heyloey.timeout` is 300s here. The previous implementation swept any lock older than a fixed
  // 120s, which would have stolen this lock from a run that was legitimately still going — writing a
  // second entry for a summary the holder was in the middle of logging.
  const repo = makeVaultRepo(t);
  activate(repo);
  git(repo, "config", "--local", "heyloey.timeout", "300");
  const summary = "Held by a live run for a long time";
  assert.equal(commit(repo, `feat: live\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);

  // Backdated far enough that age is reported, with margin below the 9999s rollover: the hook reads
  // `date +%s` after this process does, so a 9999s backdate can round to 10000s and miss /99\d\d/.
  writeLock(repo, { pid: process.pid, at: Math.floor(Date.now() / 1000) - 9900 }); // alive, and old
  const before = sha256(path.join(repo, dailyRel()));

  const result = runHook(repo);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /another invocation is already logging to this vault/);
  assert.match(result.stderr, /held for 99\d\ds/, "age is reported so a human can act on it");
  assert.equal(logEntries(repo, summary).length, 0, "nothing may be written while a live run holds the lock");
  assert.equal(sha256(path.join(repo, dailyRel())), before, "a skip must write nothing");
  assert.ok(fs.existsSync(lockPath(repo)), "a live holder's lock must survive any age");
  assert.equal(
    read(path.join(lockPath(repo), "pid")).trim(),
    String(process.pid),
    "the lock must still belong to its holder"
  );
  assert.deepEqual(ledgerKeys(repo), []);
  assert.ok(!fs.existsSync(claimPath(repo)), "no claim may be left behind");
});

test("coordination unavailable: logging is skipped with a notice, and the commit is unaffected", (t) => {
  // The parallel of the bounded-execution case: if the lock cannot be taken, the honest move is to
  // skip rather than run unsynchronised. `rm` is left in place and `mkdir` removed, so the notice
  // must name what is actually missing instead of blaming a holder that does not exist.
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Must not run unsynchronised";
  assert.equal(commit(repo, `feat: no lock\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);
  const toolbox = makeToolbox({}, { omit: ["mkdir"], extra: ["node"] });
  t.after(() => cleanup(toolbox));
  const before = sha256(path.join(repo, dailyRel()));

  const result = runHook(repo, { PATH: toolbox });

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /mkdir\(1\), rm\(1\) and rmdir\(1\) are needed to serialise invocations/,
    "the skip must name the missing capability"
  );
  assert.equal(sha256(path.join(repo, dailyRel())), before, "a skip must write nothing");
  assert.deepEqual(ledgerKeys(repo), []);
  assert.ok(!fs.existsSync(lockPath(repo)), "no lock may be left behind");
  assert.deepEqual(strayFiles(repo), []);
});

test("overlapping invocations with identical summaries leave exactly one entry", async (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Identical overlapping summary";
  assert.equal(commit(repo, `feat: same\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);

  // A logger slow enough that the second invocation arrives while the first is mid-write.
  const slow = makeToolbox({ node: `#!/bin/sh\nsleep 1.5\nexec ${process.execPath} "$@"\n` });
  t.after(() => cleanup(slow));
  const env = { PATH: `${slow}:${path.dirname(process.execPath)}:/usr/bin:/bin` };

  const first = runHookAsync(repo, env);
  assert.ok(await waitFor(() => fs.existsSync(lockPath(repo))), "the first run must take the lock");
  const second = runHookAsync(repo, env);
  const [a, b] = await Promise.all([first.done, second.done]);

  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.equal(logEntries(repo, summary).length, 1, "one daily entry, not two");
  assert.equal(
    (read(path.join(repo, "handoff.md")).match(new RegExp(summary, "g")) || []).length,
    1,
    "one handoff entry, not two"
  );
  assert.equal(ledgerKeys(repo).length, 1, "one key, not two");
  assert.ok(
    /another invocation is already logging|already logged today/.test(a.stderr + b.stderr),
    "the invocation that did nothing must say so"
  );
  assert.ok(!fs.existsSync(lockPath(repo)), "the lock must be released");
  assert.deepEqual(strayFiles(repo), []);
});

test("overlapping invocations with different summaries serialise, and the skipped one is recoverable", async (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const summaryA = "Overlapping summary A";
  const summaryB = "Overlapping summary B";
  assert.equal(commit(repo, `feat: A\n\n${TRAILER} ${summaryA}`, { HEYLOEY_LOG: "off" }).status, 0);

  const slow = makeToolbox({ node: `#!/bin/sh\nsleep 2\nexec ${process.execPath} "$@"\n` });
  t.after(() => cleanup(slow));
  const a = runHookAsync(repo, { PATH: `${slow}:${path.dirname(process.execPath)}:/usr/bin:/bin` });
  assert.ok(await waitFor(() => fs.existsSync(lockPath(repo))), "the first run must take the lock");

  // A second commit arrives inside the critical section, so HEAD — and with it the summary — differs.
  const b = commit(repo, `feat: B\n\n${TRAILER} ${summaryB}`);
  const settled = await a.done;

  assert.equal(settled.status, 0, settled.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.equal(logEntries(repo, summaryA).length, 1, "the holder's entry is written exactly once");
  assert.equal(logEntries(repo, summaryB).length, 0, "the loser must not write concurrently");
  assert.match(b.stderr, /another invocation is already logging/);
  assert.equal(ledgerKeys(repo).length, 1, "a skip must not record a key");
  const handoff = read(path.join(repo, "handoff.md"));
  assert.equal((handoff.match(/Overlapping summary A/g) || []).length, 1);
  assert.equal((handoff.match(/Overlapping summary B/g) || []).length, 0);
  assert.ok(!fs.existsSync(lockPath(repo)), "the holder must release the lock");
  assert.deepEqual(strayFiles(repo), []);

  // Recoverable, not lost: with HEAD now on B, one re-run logs it and records its own key.
  const retry = runHook(repo);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(logEntries(repo, summaryB).length, 1, "the skipped summary must be recoverable");
  assert.equal(ledgerKeys(repo).length, 2);
  const finalHandoff = read(path.join(repo, "handoff.md"));
  assert.equal((finalHandoff.match(/Overlapping summary A/g) || []).length, 1);
  assert.equal((finalHandoff.match(/Overlapping summary B/g) || []).length, 1);
});

// ---------------------------------------------------------------------------------------------
// Reclaiming a stale lock is claimed, not assumed. Removing the lock is serialised by an atomic
// sibling directory, only its holder may remove the lock, and an invocation that finds a freshly
// acquired lock must leave it alone.
// ---------------------------------------------------------------------------------------------

test("a reclaim in progress is respected: another reclaimer's claim is never stolen", (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Claim held by another reclaimer";
  assert.equal(commit(repo, `feat: claim\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);

  // A provably dead holder plus a claim: a reclaimer that ignored the claim would remove the lock
  // and start writing while the other reclaimer is doing exactly the same thing.
  const deadPid = Number(spawnSync("bash", ["-c", "echo $$"], { encoding: "utf8" }).stdout.trim());
  fs.mkdirSync(claimPath(repo), { recursive: true });
  writeLock(repo, { pid: deadPid });
  const before = sha256(path.join(repo, dailyRel()));

  const result = runHook(repo);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /another invocation is reclaiming a stale coordination lock/);
  assert.ok(fs.existsSync(lockPath(repo)), "the lock must not be removed while another claim is held");
  assert.ok(fs.existsSync(claimPath(repo)), "another reclaimer's claim must be left in place");
  assert.equal(sha256(path.join(repo, dailyRel())), before, "a skip must write nothing");
  assert.deepEqual(ledgerKeys(repo), []);
  assert.deepEqual(strayFiles(repo), []);
});

test("competing reclamations cannot delete a newly acquired lock", async (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "One winner among reclaimers";
  assert.equal(commit(repo, `feat: race\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);

  // Exactly the state an interrupted run leaves: a lock whose holder and writer are both gone.
  const deadPid = Number(spawnSync("bash", ["-c", "echo $$"], { encoding: "utf8" }).stdout.trim());
  writeLock(repo, { pid: deadPid });

  // A logger slow enough that the winner is still logging when the second invocation starts.
  const slow = makeToolbox({ node: `#!/bin/sh\nsleep 1.5\nexec ${process.execPath} "$@"\n` });
  t.after(() => cleanup(slow));
  const env = { PATH: `${slow}:${path.dirname(process.execPath)}:/usr/bin:/bin` };

  const first = runHookAsync(repo, env);
  const second = runHookAsync(repo, env);
  const [a, b] = await Promise.all([first.done, second.done]);

  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.match(a.stderr + b.stderr, /reclaimed a stale coordination lock/, "the stale lock must be reclaimed");
  assert.match(
    a.stderr + b.stderr,
    /another invocation is (already logging to this vault|reclaiming a stale coordination lock)/,
    "the invocation that did nothing must say so"
  );
  assert.equal(logEntries(repo, summary).length, 1, "exactly one entry, never two");
  assert.equal(
    (read(path.join(repo, "handoff.md")).match(new RegExp(summary, "g")) || []).length,
    1,
    "exactly one handoff line"
  );
  assert.equal(ledgerKeys(repo).length, 1, "exactly one key");
  assert.ok(!fs.existsSync(lockPath(repo)), "the winner must release the lock");
  assert.ok(!fs.existsSync(claimPath(repo)), "no claim may be left behind");
  assert.deepEqual(strayFiles(repo), []);
});

test("a lock with no readable holder is reported, not reclaimed", (t) => {
  // The third state: not provably dead, not provably live. Safety cannot be established, so the lock
  // is left exactly as it is and the notice names the file a human may inspect.
  const repo = makeVaultRepo(t);
  activate(repo);
  const summary = "Unreadable lock holder";
  assert.equal(commit(repo, `feat: unreadable\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);

  writeLock(repo, { pid: "not-a-pid" });
  const before = sha256(path.join(repo, dailyRel()));

  const result = runHook(repo);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /has no readable holder/);
  assert.ok(fs.existsSync(lockPath(repo)), "a lock that cannot be proven stale must not be removed");
  assert.equal(sha256(path.join(repo, dailyRel())), before, "a skip must write nothing");
  assert.deepEqual(ledgerKeys(repo), []);
  assert.ok(!fs.existsSync(claimPath(repo)), "no claim may be left behind");
});

// ---------------------------------------------------------------------------------------------
// Interruption. An interrupted hook must stop its writer and reap it BEFORE releasing coordination
// state — otherwise the freed lock can be taken by a second invocation while the first writer is
// still alive, which is two writers in one vault.
// ---------------------------------------------------------------------------------------------

async function interruptRun(t, signal, expectedExit, notice) {
  const repo = makeVaultRepo(t);
  activate(repo);
  // 30s: the bound is deliberately not what ends this run, the signal is.
  git(repo, "config", "--local", "heyloey.timeout", "30");
  const noteFile = path.join(repo, dailyRel());
  const pidFile = path.join(os.tmpdir(), `post-commit-int-${signal.replace(/[^A-Za-z]/g, "")}-${process.pid}.txt`);
  const toolbox = makeToolbox({ node: hangingLogger({ pidFile, noteFile, delayMs: 4000 }) });
  t.after(() => cleanup(toolbox, pidFile));
  const summary = `Interrupted by ${signal}`;
  assert.equal(commit(repo, `feat: ${signal}\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);
  const before = sha256(noteFile);

  const { child, done } = runHookDetached(t, repo, {
    PATH: `${toolbox}:${path.dirname(process.execPath)}`,
  });
  assert.ok(await waitFor(() => fs.existsSync(pidFile)), "the logger must be running before the signal");
  const loggerPid = Number(read(pidFile).trim());

  const started = Date.now();
  child.kill(signal);
  const result = await done;
  const elapsed = Date.now() - started;

  assert.equal(result.status, expectedExit, `an interrupted hook exits 128+signal: ${result.stderr}`);
  assert.match(result.stderr, notice, "the interruption must be reported");
  assert.ok(elapsed < 15000, `the hook must not wait out the run, took ${elapsed}ms`);
  assert.ok(!processAlive(loggerPid), "the logger must be terminated and reaped before the hook exits");
  assert.equal(sha256(noteFile), before, "an interrupted run writes nothing");
  assert.deepEqual(ledgerKeys(repo), [], "an interrupted run records no key");
  assert.ok(!fs.existsSync(lockPath(repo)), "coordination state must be released after the writer is gone");
  assert.ok(!fs.existsSync(claimPath(repo)), "no claim may be left behind");
  assert.deepEqual(strayFiles(repo), [], "the capture file must not be left behind");
  return { repo, noteFile, before, summary };
}

test("SIGTERM during an active run stops and reaps the logger, then releases the lock", async (t) => {
  const { repo, noteFile, before, summary } = await interruptRun(t, "SIGTERM", 143, /interrupted \(signal 15\)/);

  // No later write: this logger would have appended its line four seconds in. It is gone, and the
  // note must still be byte-identical after that moment has passed.
  await new Promise((resolve) => setTimeout(resolve, 4500));
  assert.equal(sha256(noteFile), before, "a logger stopped by the hook must never write afterwards");

  // And the vault is not wedged: the summary was never logged, so the next run logs it once.
  const retry = runHook(repo);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(logEntries(repo, summary).length, 1, "the interrupted entry must be recoverable");
  assert.equal(ledgerKeys(repo).length, 1);
  assert.ok(!fs.existsSync(lockPath(repo)));
});

test("SIGINT during an active run stops and reaps the logger, then releases the lock", async (t) => {
  await interruptRun(t, "SIGINT", 130, /interrupted \(signal 2\)/);
});

// ---------------------------------------------------------------------------------------------
// The writer outlives the hook. A SIGKILLed hook runs no cleanup at all, so its logger can still be
// alive and writing while the hook's pid is provably dead. Reclaiming on that alone would hand the
// lock to a second writer, which is the gap these cases close.
// ---------------------------------------------------------------------------------------------

test("a SIGKILLed hook's surviving writer keeps the lock, and the documented recovery works", async (t) => {
  const repo = makeVaultRepo(t);
  activate(repo);
  // 30s: the bound is not what ends this run, the SIGKILL is.
  git(repo, "config", "--local", "heyloey.timeout", "30");
  const noteFile = path.join(repo, dailyRel());
  const pidFile = path.join(os.tmpdir(), `post-commit-sigkill-${process.pid}.txt`);
  // A writer that pauses before writing: it is alive, has written nothing, and will write if it
  // survives long enough — which is exactly the state a reclaimer must not write into.
  const toolbox = makeToolbox({ node: hangingLogger({ pidFile, noteFile, delayMs: 20000 }) });
  t.after(() => cleanup(toolbox, pidFile));
  const summary = "Writer survives a SIGKILLed hook";
  assert.equal(commit(repo, `feat: sigkill\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);
  const before = sha256(noteFile);

  const first = runHookDetached(t, repo, { PATH: `${toolbox}:${path.dirname(process.execPath)}` });
  // Never leak the survivor, even when an assertion below fails.
  t.after(() => {
    try {
      process.kill(Number(read(pidFile).trim()), "SIGKILL");
    } catch {
      /* already gone */
    }
  });
  assert.ok(await waitFor(() => fs.existsSync(pidFile)), "the writer must be running before the kill");
  const writerPid = Number(read(pidFile).trim());
  assert.ok(
    await waitFor(() => {
      try {
        return read(path.join(lockPath(repo), "logger")).trim() === String(writerPid);
      } catch {
        return false;
      }
    }),
    "the lock must record the writer, not only the hook"
  );
  assert.equal(
    read(path.join(lockPath(repo), "pid")).trim(),
    String(first.child.pid),
    "the lock belongs to the hook that is about to die"
  );

  first.child.kill("SIGKILL");
  await new Promise((resolve) => first.child.on("close", resolve));
  assert.ok(processAlive(writerPid), "the writer must survive the hook's SIGKILL — that is the gap");

  // A second invocation must not reclaim the lock or start a competing writer.
  const second = await runHookDetached(t, repo, { PATH: `${toolbox}:${path.dirname(process.execPath)}` }).done;
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stderr, /a milestone writer \(pid \d+\) from a killed hook is still running/);
  assert.ok(fs.existsSync(lockPath(repo)), "the active writer's lock must survive");
  assert.equal(
    read(path.join(lockPath(repo), "logger")).trim(),
    String(writerPid),
    "no second writer may be recorded"
  );
  assert.equal(
    read(path.join(lockPath(repo), "pid")).trim(),
    String(first.child.pid),
    "the lock still belongs to the killed hook"
  );
  assert.equal(read(pidFile).trim(), String(writerPid), "the first writer is still the only writer");
  assert.equal(sha256(noteFile), before, "a refused reclaim writes nothing");
  assert.deepEqual(ledgerKeys(repo), []);
  assert.ok(!fs.existsSync(claimPath(repo)), "a refused reclaim must not leave a claim behind");
  // A SIGKILLed hook cannot clean up, so its capture file stays behind — inert, inside `.git`.
  assert.deepEqual(
    strayFiles(repo),
    [`heyloey-postcommit.${first.child.pid}.out`],
    "a SIGKILL leaves exactly the killed run's capture file"
  );

  // The documented recovery: stop the surviving writer, then the next run reclaims and logs once.
  process.kill(writerPid, "SIGKILL");
  assert.ok(await waitFor(() => !processAlive(writerPid)), "the writer must be gone before recovery");
  const third = await runHookDetached(t, repo).done;
  assert.equal(third.status, 0, third.stderr);
  assert.match(third.stderr, /reclaimed a stale coordination lock/);
  assert.equal(logEntries(repo, summary).length, 1, "the recovered entry is logged exactly once");
  assert.equal(ledgerKeys(repo).length, 1);
  assert.ok(!fs.existsSync(lockPath(repo)), "the lock is released after recovery");
});

test("a lock whose writer cannot be accounted for is never reclaimed", (t) => {
  // Two states that cannot be told apart from "a writer is still running": `pending`, which is the
  // interval between recording the intent to fork and recording the pid, and a lock carrying no
  // writer record at all. Neither may be reclaimed, and both must say why.
  const deadPid = Number(spawnSync("bash", ["-c", "echo $$"], { encoding: "utf8" }).stdout.trim());

  for (const writer of ["pending", null]) {
    const label = writer === null ? "absent" : writer;
    const repo = makeVaultRepo(t);
    activate(repo);
    const summary = `Writer unaccounted for (${label})`;
    assert.equal(commit(repo, `feat: unknown\n\n${TRAILER} ${summary}`, { HEYLOEY_LOG: "off" }).status, 0);
    writeLock(repo, { pid: deadPid, writer });
    const before = sha256(path.join(repo, dailyRel()));

    const result = runHook(repo);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /cannot be reclaimed safely/, `the ${label} writer record must explain itself`);
    assert.ok(fs.existsSync(lockPath(repo)), `the lock must survive a ${label} writer record`);
    assert.equal(logEntries(repo, summary).length, 0, `nothing may be written while the writer is ${label}`);
    assert.equal(sha256(path.join(repo, dailyRel())), before, "a refused reclaim writes nothing");
    assert.deepEqual(ledgerKeys(repo), []);
    assert.ok(!fs.existsSync(claimPath(repo)), "a refused reclaim must not leave a claim behind");
  }
});


