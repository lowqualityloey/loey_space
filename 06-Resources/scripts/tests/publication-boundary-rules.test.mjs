// The publication boundary is declared in three places that were never compared:
// `.gitignore` states intent, `.githooks/lib/private-records.txt` states enforcement, and
// `git ls-files` is reality. Three owner-only records sat in the public index while the
// ignore file called their folder private, and the publication guard reported clean — because
// it is an explicit-name boundary and nobody had named them (`.gitignore` never untracks).
//
// The revision-1 remedy for that class was wrong in a specific way worth pinning: it treated
// "listed in private-records.txt" as an ALTERNATIVE to "re-included by a negation", so a
// declared-private file could still be tracked and the check would call it clean. Declaring a
// path private makes tracking it a failure, never an exemption.
//
// Four rules, all decidable from git alone:
//   A  every tracked path matched by an ignore rule must be re-included by a negation
//   B  no path declared private may be tracked
//   C  every declared path must actually be matched by an ignore rule (no no-op declaration)
//   D  no path may be both negated (public) and declared private (contradiction)
//
// Each rule gets a disposable repository in which it is deliberately violated, so a rule that
// stops working fails a test instead of silently passing. This suite is also the one that
// would have caught the published records on the day they were committed.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const RECORDS_REL = ".githooks/lib/private-records.txt";

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

function git(repo, args) {
  return spawnSync("git", args, { cwd: repo, env: GIT_ENV, encoding: "utf8" });
}

// ---------------------------------------------------------------------------
// The four rules, as functions of a repository root. Nothing here is specific to
// this vault: the fixtures below drive the same code against disposable repos.
// ---------------------------------------------------------------------------

function trackedPaths(repo) {
  const result = git(repo, ["ls-files", "-z"]);
  assert.equal(result.status, 0, `git ls-files failed in ${repo}: ${result.stderr}`);
  return result.stdout.split("\0").filter(Boolean);
}

/**
 * The rule git would apply to `target`, asked of the RULES rather than the disk, so the
 * answer is the same for a path that does not exist (`--no-index`) and for one that is
 * already tracked (`check-ignore` consults the index otherwise, and answers "not ignored"
 * for exactly the files this suite cares about). The last matching rule wins: a `!` prefix
 * means the path was re-included, i.e. it is public on purpose.
 */
function parseIgnoreLine(line) {
  const [meta, pathname] = line.split("\t");
  const first = meta.indexOf(":");
  const second = meta.indexOf(":", first + 1);
  const pattern = meta.slice(second + 1);
  return { pathname, pattern, negated: pattern.startsWith("!") };
}

// `check-ignore` accepts many paths per invocation and prints one line per path that a rule
// matches, so the tracked-path scan is a handful of processes rather than one per file.
// Measured: one process per path cost 34s on the real index; batching costs well under a
// second. The chunk size matches `lib/gitpaths.ts`, which batches for the same reason.
const MAX_PATHS_PER_CALL = 200;

function ignoreMatches(repo, targets) {
  const matches = new Map();
  for (let i = 0; i < targets.length; i += MAX_PATHS_PER_CALL) {
    const chunk = targets.slice(i, i + MAX_PATHS_PER_CALL);
    const result = git(repo, ["check-ignore", "-v", "--no-index", "--", ...chunk]);
    // Exit 1 means "no path matched a rule", which is the ordinary case for a clean tree.
    // Anything else is a real failure and must not be read as "ignored by nothing".
    if (result.status !== 0 && result.status !== 1) {
      assert.fail(`git check-ignore failed in ${repo}: ${result.stderr}`);
    }
    for (const line of result.stdout.split("\n")) {
      if (line.trim() === "") continue;
      const parsed = parseIgnoreLine(line);
      // `matched: true` matters: absence from this map IS the "no rule matched" answer, so
      // the flag has to be explicit rather than inferred from a key that exists either way.
      matches.set(parsed.pathname, { ...parsed, matched: true });
    }
  }
  return matches;
}

function ignoreMatch(repo, target) {
  return ignoreMatches(repo, [target]).get(target) ?? { matched: false };
}

function declaredEntries(repo) {
  const file = path.join(repo, RECORDS_REL);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((entry) => entry.replace(/^\.\//, "").replace(/^\//, "").replace(/\/$/, ""));
}

/**
 * Rule C and D need the declaration's EFFECTIVE match. A directory entry such as
 * `00-Private` is declared as a path with no trailing slash, while the ignore rule that
 * covers it (`00-Private/`) only matches a directory — so the entry itself can come back
 * unmatched while everything beneath it is ignored. Probing a child path is what makes the
 * check answer the question that matters: is this path's content private?
 */
function effectiveMatch(repo, entry) {
  const asSelf = ignoreMatch(repo, entry);
  if (asSelf.matched) return asSelf;
  return ignoreMatch(repo, `${entry}/__publication-boundary-probe__`);
}

export function auditPublicationBoundary(repo) {
  const tracked = trackedPaths(repo);
  const declared = declaredEntries(repo);
  const violations = { A: [], B: [], C: [], D: [] };

  const matches = ignoreMatches(repo, tracked);
  for (const file of tracked) {
    const match = matches.get(file);
    if (match && !match.negated) violations.A.push(file);
  }

  for (const entry of declared) {
    if (tracked.some((file) => file === entry || file.startsWith(`${entry}/`))) {
      violations.B.push(entry);
    }
    const effective = effectiveMatch(repo, entry);
    if (!effective.matched) violations.C.push(entry);
    else if (effective.negated) violations.D.push(entry);
  }

  return { tracked, declared, violations };
}

// ---------------------------------------------------------------------------
// Disposable fixtures
// ---------------------------------------------------------------------------

function makeFixture({ gitignore = "", records = [], files = {}, tracked = [] }) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "publication-boundary-"));
  git(repo, ["init", "-q"]);

  const write = (rel, contents) => {
    const full = path.join(repo, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  };

  if (gitignore) write(".gitignore", gitignore);
  write(RECORDS_REL, records.length ? `${records.join("\n")}\n` : "# no declarations\n");
  for (const [rel, contents] of Object.entries(files)) write(rel, contents);

  git(repo, ["add", "-A"]);
  for (const rel of tracked) git(repo, ["add", "-f", "--", rel]);
  git(repo, ["commit", "-qm", "chore: fixture baseline"]);
  return repo;
}

function cleanup(repo) {
  fs.rmSync(repo, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Rule A — a tracked path matched by an ignore rule must be re-included explicitly
// ---------------------------------------------------------------------------

test("rule A: a tracked path the ignore rules exclude is a violation", () => {
  const repo = makeFixture({
    gitignore: "vault-notes/*\n",
    files: { "vault-notes/leaked.md": "synthetic public leak\n" },
    tracked: ["vault-notes/leaked.md"],
  });
  try {
    const { violations } = auditPublicationBoundary(repo);
    assert.deepEqual(
      violations.A,
      ["vault-notes/leaked.md"],
      "an ignored-but-tracked path must be reported: the ignore rule cannot untrack it, so the tree is lying about what is private"
    );
  } finally {
    cleanup(repo);
  }
});

test("rule A: the same path is clean once a negation declares it public", () => {
  const repo = makeFixture({
    gitignore: "vault-notes/*\n!vault-notes/leaked.md\n",
    files: { "vault-notes/leaked.md": "synthetic deliberately public file\n" },
    tracked: ["vault-notes/leaked.md"],
  });
  try {
    const { violations } = auditPublicationBoundary(repo);
    assert.deepEqual(violations.A, [], "an explicit negation is a public declaration and must satisfy rule A");
  } finally {
    cleanup(repo);
  }
});

// ---------------------------------------------------------------------------
// Rule B — declaring a path private makes tracking it a failure, not an exemption
// ---------------------------------------------------------------------------

test("rule B: a declared private path that is still tracked is a violation", () => {
  const repo = makeFixture({
    gitignore: "owner-notes/*\n",
    records: ["owner-notes/ledger.md"],
    files: { "owner-notes/ledger.md": "synthetic owner-only record\n" },
    tracked: ["owner-notes/ledger.md"],
  });
  try {
    const { violations } = auditPublicationBoundary(repo);
    assert.deepEqual(
      violations.B,
      ["owner-notes/ledger.md"],
      "a declaration must not act as an exemption — this is the revision-1 defect, where being listed private was accepted as an alternative to being untracked"
    );
  } finally {
    cleanup(repo);
  }
});

test("rule B: a directory declaration covers everything beneath it", () => {
  const repo = makeFixture({
    gitignore: "owner-notes/*\n",
    records: ["owner-notes"],
    files: { "owner-notes/deep/ledger.md": "synthetic owner-only record\n" },
    tracked: ["owner-notes/deep/ledger.md"],
  });
  try {
    const { violations } = auditPublicationBoundary(repo);
    assert.deepEqual(violations.B, ["owner-notes"], "a directory entry must match the paths under it");
  } finally {
    cleanup(repo);
  }
});

// ---------------------------------------------------------------------------
// Rule C — a declaration must really be ignored, or it protects nothing
// ---------------------------------------------------------------------------

test("rule C: a declared path matched by no ignore rule is a violation", () => {
  const repo = makeFixture({
    gitignore: "# nothing ignored here\n",
    records: [".mcp.json"],
    files: { ".mcp.json": "{\"synthetic\": true}\n" },
  });
  try {
    const { violations } = auditPublicationBoundary(repo);
    assert.deepEqual(
      violations.C,
      [".mcp.json"],
      "a declaration with no ignore rule behind it advertises protection that does not exist, and one `git add -A` would publish the file"
    );
  } finally {
    cleanup(repo);
  }
});

test("rule C: a directory declaration is satisfied by a rule that covers its contents", () => {
  const repo = makeFixture({
    gitignore: "private-notes/\n",
    records: ["private-notes"],
    files: { "private-notes/keep.md": "synthetic\n" },
  });
  try {
    const { violations } = auditPublicationBoundary(repo);
    assert.deepEqual(violations.C, [], "a trailing-slash directory rule covers the paths it declares");
  } finally {
    cleanup(repo);
  }
});

// ---------------------------------------------------------------------------
// Rule D — private and public are mutually exclusive declarations
// ---------------------------------------------------------------------------

test("rule D: a path both declared private and negated is a contradiction", () => {
  const repo = makeFixture({
    gitignore: "notes/*\n!notes/keep.md\n",
    records: ["notes/keep.md"],
    files: { "notes/keep.md": "synthetic\n" },
    tracked: ["notes/keep.md"],
  });
  try {
    const { violations } = auditPublicationBoundary(repo);
    assert.deepEqual(
      violations.D,
      ["notes/keep.md"],
      "one path cannot be declared public by a negation and private by the declaration list; an ambiguous boundary is the defect, not either choice"
    );
  } finally {
    cleanup(repo);
  }
});

// ---------------------------------------------------------------------------
// The real tree
// ---------------------------------------------------------------------------

test("the scan walks the real tree (anti-vacuity)", () => {
  const { tracked, declared } = auditPublicationBoundary(REPO_ROOT);
  assert.ok(
    tracked.length > 300,
    `expected the scan to see the product index, saw ${tracked.length} tracked path(s) — a helper that returns nothing would make every rule below pass while checking nothing`
  );
  assert.ok(
    declared.length >= 6,
    `expected the declaration list to be read, saw ${declared.length} entr(ies)`
  );
});

test("the real tree satisfies all four boundary rules", () => {
  const { violations } = auditPublicationBoundary(REPO_ROOT);
  assert.deepEqual(
    violations.A,
    [],
    `tracked path(s) matched by an ignore rule with no negation — either add a negation declaring them public, or stop tracking them:\n  ${violations.A.join("\n  ")}`
  );
  assert.deepEqual(
    violations.B,
    [],
    `declared private but still tracked — run \`git rm --cached <path>\` so the ignore rules can hold:\n  ${violations.B.join("\n  ")}`
  );
  assert.deepEqual(
    violations.C,
    [],
    `declared private but matched by no ignore rule, so the declaration protects nothing:\n  ${violations.C.join("\n  ")}`
  );
  assert.deepEqual(
    violations.D,
    [],
    `both negated (public) and declared private:\n  ${violations.D.join("\n  ")}`
  );
});

test("the owner-only engineering records are untracked and still declared", () => {
  const owners = "06-Resources/Guides/Owners";
  const tracked = trackedPaths(REPO_ROOT);
  assert.deepEqual(
    tracked.filter((file) => file.startsWith(`${owners}/`)),
    [],
    "the owner-only records were published for as long as the ignore rule could not untrack them; they must not return to the index"
  );
  assert.ok(
    declaredEntries(REPO_ROOT).includes(owners),
    "untracking alone is not the boundary — the directory must stay declared so a re-add is rejected"
  );
});

test("no test in this suite writes inside the real repository", () => {
  // Every fixture is built under os.tmpdir(). This asserts the property rather than
  // trusting it: the suite's whole value is that it can be run in the owner's checkout.
  const before = git(REPO_ROOT, ["status", "--porcelain"]).stdout;
  const repo = makeFixture({
    gitignore: "scratch/*\n",
    records: ["scratch"],
    files: { "scratch/file.md": "synthetic\n" },
  });
  cleanup(repo);
  const after = git(REPO_ROOT, ["status", "--porcelain"]).stdout;
  assert.equal(after, before, "the real checkout's status must be identical after fixture work");
});
