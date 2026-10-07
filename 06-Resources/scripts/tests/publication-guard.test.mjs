// Issue #116 / audit A01 — a record can be *declared* owner-only and still publish.
//
// `.gitignore` removes nothing that is already in the index: for a path to be ignored it
// must be untracked at the moment the rule is added. So the audit found root control
// records sitting in the public tree while the ignore file called them private, and the
// existing secret scanner could not see the problem either — it looks for credential
// *shapes*, and a project name, a filesystem path or a profile paragraph has no shape.
//
// #96 fixed the private engineering branch's push guard. That says nothing about the
// product branch, which is the one with readers.
//
// No shell can observe "GitHub would have published this", so this suite drives a real
// publication guard against disposable repositories and asserts the three outcomes that
// matter: reject (staged, already-indexed, renamed), allow (a benign product change), and
// permit (legitimate engineering storage that nobody named). The interfaces it pins are
// the contract recorded in docs/specs/2026-10-08-spec-vault-audit-remediation.md §4.1 C1:
//
//   bash .githooks/lib/publication-guard.sh --repo <path> [--mode staged|index]
//     exit 0  allow
//     exit 1  reject, printing paths only (never contents)
//
//   <repo>/.githooks/lib/private-records.txt  — one owner-only path or glob per line,
//     `#` comments allowed. Paths only, by construction: the list must never be a place
//     where a note's contents leak in order to be classified as private.
//
// The list is resolved against `--repo`, not against the guard's own location, so these
// fixtures stay synthetic and the vault's real inventory never enters a test.
//
// Text assertions on `pre-commit` and `ci.yml` exist because the guard is worthless
// uninvoked — the same defect class as #54, #93, #101 and the stacked-PR gap pinned by
// ci-workflow-trigger.test.mjs: a check that cannot fail, or that is never called.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");

const GUARD = path.join(REPO_ROOT, ".githooks", "lib", "publication-guard.sh");
const RECORD_LIST = path.join(REPO_ROOT, ".githooks", "lib", "private-records.txt");
const PRE_COMMIT = path.join(REPO_ROOT, ".githooks", "pre-commit");
const CI_WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");
const SECRET_SCAN = path.join(REPO_ROOT, ".githooks", "lib", "secret-scan.sh");

const PRIVATE_PATH = "owner-notes.md";
const PRIVATE_CONTENT = "Synthetic owner-only record. Never publish this line.\n";

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

function git(repo, ...args) {
  return spawnSync("git", args, { cwd: repo, env: GIT_ENV, encoding: "utf8" });
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function guard(repo, mode = "staged") {
  return spawnSync("bash", [GUARD, "--repo", repo, "--mode", mode], {
    cwd: repo,
    env: GIT_ENV,
    encoding: "utf8",
  });
}

// A disposable repository that already carries the guard's configuration shape, so the
// fixtures exercise the guard rather than the fixture's own setup.
function makeRepo({ privateRecords = [PRIVATE_PATH], productFiles = ["README.md"] } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "publication-guard-"));
  git(repo, "init", "-q");
  write(path.join(repo, ".githooks", "lib", "private-records.txt"), privateRecords.join("\n") + "\n");
  for (const file of productFiles) write(path.join(repo, file), "# product file\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "chore: fixture baseline");
  return repo;
}

function cleanup(repo) {
  fs.rmSync(repo, { recursive: true, force: true });
}

test("the publication guard and its declared-record list exist at the contracted paths", () => {
  assert.ok(
    fs.existsSync(GUARD),
    `missing ${path.relative(REPO_ROOT, GUARD)} — without a guard, a declared owner-only record still publishes whenever the ignore rule arrived after the file did`
  );
  assert.ok(
    fs.existsSync(RECORD_LIST),
    `missing ${path.relative(REPO_ROOT, RECORD_LIST)} — the guard cannot fail closed without an explicit list of owner-only paths`
  );
});

test("a newly staged declared private record is rejected with paths only, never contents", () => {
  const repo = makeRepo();
  try {
    write(path.join(repo, PRIVATE_PATH), PRIVATE_CONTENT);
    git(repo, "add", PRIVATE_PATH);

    const result = guard(repo);
    assert.equal(
      result.status,
      1,
      `expected rejection (exit 1), got exit ${result.status}: ${result.stdout}${result.stderr}`
    );
    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /owner-notes\.md/, "the rejected path must be named so the operator can unstage it");
    assert.ok(
      !output.includes("Never publish this line"),
      "the guard must print a redacted path list, not the record's contents — echoing them spreads what it is protecting"
    );
  } finally {
    cleanup(repo);
  }
});

test("a declared private record already in the index is rejected even with nothing staged", () => {
  // This is the A01 case exactly: the file was tracked before the ignore rule existed and
  // ignore rules never untrack, so a staged-only check would report clean forever.
  const repo = makeRepo();
  try {
    write(path.join(repo, PRIVATE_PATH), PRIVATE_CONTENT);
    git(repo, "add", PRIVATE_PATH);
    git(repo, "commit", "-qm", "chore: track a record that should never publish");

    const result = guard(repo, "index");
    assert.equal(
      result.status,
      1,
      `expected rejection (exit 1) for an already-indexed private record, got exit ${result.status}: ${result.stdout}${result.stderr}`
    );
    assert.match(`${result.stdout}${result.stderr}`, /owner-notes\.md/);
  } finally {
    cleanup(repo);
  }
});

test("renaming a declared private record does not evade the guard", () => {
  const repo = makeRepo();
  try {
    write(path.join(repo, PRIVATE_PATH), PRIVATE_CONTENT);
    git(repo, "add", PRIVATE_PATH);
    git(repo, "commit", "-qm", "chore: track a private record");
    git(repo, "mv", PRIVATE_PATH, "innocuous.md");

    const result = guard(repo);
    assert.equal(
      result.status,
      1,
      `expected rejection (exit 1) after a rename, got exit ${result.status}: ${result.stdout}${result.stderr}`
    );
  } finally {
    cleanup(repo);
  }
});

test("a benign product-only change is allowed", () => {
  const repo = makeRepo();
  try {
    write(path.join(repo, "CHANGELOG.md"), "# Changelog\n");
    git(repo, "add", "CHANGELOG.md");

    const result = guard(repo);
    assert.equal(
      result.status,
      0,
      `expected an allow (exit 0) for a product-only change, got exit ${result.status}: ${result.stdout}${result.stderr}`
    );
  } finally {
    cleanup(repo);
  }
});

test("legitimate engineering storage nobody named remains publishable", () => {
  // The guard is an explicit-name boundary, not a heuristic one: the private engineering
  // repository is a deliberate owner decision (#96), and over-blocking it would make the
  // guard the reason work cannot ship.
  const repo = makeRepo({ productFiles: ["README.md"] });
  try {
    write(path.join(repo, "engineering", "notes.md"), "# Engineering note\n");
    git(repo, "add", "-A");

    const result = guard(repo);
    assert.equal(
      result.status,
      0,
      `expected an allow (exit 0) for storage that is not named owner-only, got exit ${result.status}: ${result.stdout}${result.stderr}`
    );
  } finally {
    cleanup(repo);
  }
});

test("the declared-record list holds paths, never note contents", () => {
  assert.ok(fs.existsSync(RECORD_LIST), "the declared-record list must exist");
  const lines = fs.readFileSync(RECORD_LIST, "utf8").split("\n");
  for (const line of lines) {
    const entry = line.trim();
    if (entry === "" || entry.startsWith("#")) continue;
    assert.ok(
      !/\s/.test(entry),
      `each entry must be a single path token so the list cannot become a record dump; got: ${JSON.stringify(entry)}`
    );
    assert.ok(
      entry.length <= 200,
      `a path entry of ${entry.length} characters is long enough to be prose rather than a path: ${JSON.stringify(entry)}`
    );
  }
  assert.ok(
    fs.statSync(RECORD_LIST).size <= 4096,
    "the declared-record list must stay small: it is a boundary declaration, not a copy of what it protects"
  );
});

test("the pre-commit hook and CI both invoke the publication guard", () => {
  assert.ok(fs.existsSync(PRE_COMMIT), "the pre-commit hook must exist");
  // `includes`, not `match`: a regex mismatch would dump the whole hook into the failure
  // output, which costs more context than the guard is worth.
  const hook = fs.readFileSync(PRE_COMMIT, "utf8");
  assert.ok(
    hook.includes("publication-guard"),
    "the pre-commit hook must invoke the publication guard — a guard that is never called is the same defect class as the gates in #54/#93/#101"
  );

  const ci = fs.readFileSync(CI_WORKFLOW, "utf8");
  assert.ok(
    ci.includes("publication-guard"),
    "ci.yml must invoke the publication guard, because the local hook cannot run on a machine where core.hooksPath was never set"
  );
});

test("the product index is clean of declared private records", () => {
  const result = spawnSync("bash", [GUARD, "--repo", REPO_ROOT, "--mode", "index"], {
    cwd: REPO_ROOT,
    env: GIT_ENV,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `the tracked product tree still carries declared private records: ${result.stdout}${result.stderr}`
  );
});

test("wiring the guard did not weaken the existing secret scan", () => {
  const result = spawnSync("bash", [SECRET_SCAN, "--tracked"], {
    cwd: REPO_ROOT,
    env: GIT_ENV,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `secret-scan.sh --tracked must stay green: ${result.stdout}${result.stderr}`
  );
});
