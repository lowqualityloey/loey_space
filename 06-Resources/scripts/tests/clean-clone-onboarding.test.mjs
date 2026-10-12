// The end-to-end question this suite answers: does a person who clones the repository and runs
// the documented command end up with records the rest of the system can use?
//
// The fixture is built from an EXPLICIT MANIFEST of working-tree paths, not from
// `git archive HEAD` or any other git-derived source. A git-derived fixture exports committed
// state only, so while this feature is being developed it cannot contain the initializer at
// all — the suite would either exercise the previous implementation or assert nothing about
// the new one. Reading the working tree tests what is about to be committed. The published
// artifact is verified separately, after publication, by cloning the real repository (see the
// onboarding guide's verification section and the CI step that initializes the CI checkout).
//
// Every manifest entry is asserted to exist, so a rename or a deleted file fails the suite
// loudly instead of quietly shrinking the fixture into a test of nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundleSources } from "../../../build.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const GUARD = path.join(REPO_ROOT, ".githooks/lib/publication-guard.sh");

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

// Copied verbatim from the working tree. The two markers (`AGENTS.md`, `99-Templates/`) are
// what the initializer validates against, so the fixture is a vault in the only sense the
// command checks.
const MANIFEST = [
  "AGENTS.md",
  "CLAUDE.md",
  "CODEX.md",
  "README.md",
  "package.json",
  ".gitignore",
  ".githooks/lib/private-records.txt",
  ".githooks/lib/publication-guard.sh",
  ".githooks/pre-commit",
  "Home.md",
  "06-Resources/scripts/vault-init.js",
  "06-Resources/scaffold/_Scaffold MOC.md",
  "06-Resources/scaffold/memory.template.md",
  "06-Resources/scaffold/handoff.template.md",
  "06-Resources/scaffold/profile.template.md",
  "99-Templates/Daily.md",
];

// The subset the onboarding path genuinely depends on. Kept separate from the manifest so that
// deleting an entry fails here rather than silently reducing coverage.
const REQUIRED = [
  "AGENTS.md",
  ".githooks/lib/private-records.txt",
  "06-Resources/scripts/vault-init.js",
  "06-Resources/scaffold/memory.template.md",
  "06-Resources/scaffold/handoff.template.md",
  "06-Resources/scaffold/profile.template.md",
];

const CREATED = [
  "memory.md",
  "handoff.md",
  path.join("00-Private", "SOUL.md"),
  path.join("00-Inbox", "quick-capture-dump.md"),
];

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function copy(rel, into) {
  const destination = path.join(into, rel);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, rel), destination);
}

function makeClone(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "clean-clone-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const rel of MANIFEST) copy(rel, root);
  return root;
}

function git(repo, args) {
  return spawnSync("git", args, { cwd: repo, env: GIT_ENV, encoding: "utf8" });
}

function init(root, extra = []) {
  return spawnSync(process.execPath, [path.join(root, "06-Resources/scripts/vault-init.js"), ...extra], {
    cwd: root,
    encoding: "utf8",
  });
}

test("the fixture manifest is complete and every entry exists", () => {
  assert.ok(MANIFEST.length >= 16, `the manifest shrank to ${MANIFEST.length} entries; a smaller fixture tests less`);
  for (const rel of REQUIRED) {
    assert.ok(MANIFEST.includes(rel), `the manifest no longer carries ${rel}, which the onboarding path needs`);
  }
  for (const rel of MANIFEST) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, rel)), `manifest names ${rel}, which does not exist — update the manifest`);
  }
});

test("the manifest's initializer bundle is the one build.mjs declares", () => {
  // Reuses `bundleSources` rather than hard-coding the path a second time, so renaming the
  // entry point fails here instead of leaving the fixture with a stale copy.
  const bundles = bundleSources.map((entry) => `06-Resources/scripts/${entry.bundle}`);
  assert.ok(
    bundles.includes("06-Resources/scripts/vault-init.js"),
    `build.mjs no longer builds vault-init.js; it declares: ${bundles.join(", ")}`
  );
});

test("initialization: the documented command creates every record a first session needs", (t) => {
  const root = makeClone(t);

  const result = init(root);

  assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
  for (const rel of CREATED) {
    assert.ok(fs.existsSync(path.join(root, rel)), `expected ${rel} after initialization`);
  }

  // Initialization is repeatable: a second run in the same clone is a no-op, not an error.
  const second = init(root);
  assert.equal(second.status, 0, "a repeat run must exit 0");
  assert.match(second.stdout, /0 created, 4 already present/);
});

test("preservation: a record the user already wrote survives initialization untouched", (t) => {
  const root = makeClone(t);
  const sentinel = "SENTINEL: the user's own words, not the template's\n";
  fs.writeFileSync(path.join(root, "memory.md"), sentinel);
  fs.mkdirSync(path.join(root, "00-Private"), { recursive: true });
  fs.writeFileSync(path.join(root, "00-Private/SOUL.md"), "SENTINEL: a persona already written\n");

  const result = init(root);

  assert.equal(result.status, 0);
  assert.equal(fs.readFileSync(path.join(root, "memory.md"), "utf8"), sentinel);
  assert.equal(fs.readFileSync(path.join(root, "00-Private/SOUL.md"), "utf8"), "SENTINEL: a persona already written\n");
  assert.ok(fs.existsSync(path.join(root, "handoff.md")), "the untouched records are still created");
});

test("handoff shape: a resumed session finds the headings the dashboard links", (t) => {
  const root = makeClone(t);
  init(root);

  const home = fs.readFileSync(path.join(root, "Home.md"), "utf8");
  const linked = [...home.matchAll(/\[\[handoff\.md#([^\]]+)\]\]/g)].map((match) => match[1]);
  assert.ok(linked.length >= 2, "Home.md should link the handoff headings; if that changed, update this guard");

  const handoff = fs.readFileSync(path.join(root, "handoff.md"), "utf8");
  for (const heading of linked) {
    assert.ok(
      handoff.includes(`## ${heading}`),
      `a resume from this clone would find no "## ${heading}" in handoff.md, so the dashboard link is dead from the first run`
    );
  }
  assert.ok(
    handoff.includes("### Latest Updates"),
    "the logging policy appends under `### Latest Updates`, which must exist as a level-3 heading"
  );
  assert.ok(
    handoff.includes("## 🎯 Current Main Objectives"),
    "the objectives section is what makes a handoff resumable rather than a diary"
  );
});

test("the guide describes the pre-commit hook as blocking, and only the logger as fail-open", (t) => {
  // The guide is the only place a new user is told what activating the hooks does. Describing
  // the blocking check as fail-open tells them a leaked secret cannot stop a commit, which is
  // the opposite of what the hook is for.
  const guide = fs.readFileSync(path.join(REPO_ROOT, "06-Resources/Guides/Onboarding.md"), "utf8");

  assert.match(guide, /`pre-commit` — blocking/, "the guide must mark the pre-commit check as blocking");
  assert.match(guide, /`post-commit` — non-blocking/, "the guide must mark only the logger as non-blocking");
  assert.match(guide, /refuses a commit/, "the guide must say the pre-commit hook can refuse a commit");
  assert.ok(
    !/Both are fail-open/.test(guide),
    "the guide must not describe the blocking pre-commit check as fail-open"
  );
});

test("publication boundaries: the guard blocks a declared record and prints no content", (t) => {
  const root = makeClone(t);
  git(root, ["init", "-q"]);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "chore: fixture baseline"]);

  // `.mcp.json` is per-machine configuration: ignored, and declared, so a stray `git add -A`
  // cannot publish it.
  fs.writeFileSync(path.join(root, ".mcp.json"), '{"synthetic": true}\n');
  const ignored = git(root, ["check-ignore", "-v", "--no-index", "--", ".mcp.json"]);
  assert.equal(ignored.status, 0, ".mcp.json must match an ignore rule, or a single `git add -A` publishes it");

  // A declared owner-only path, force-added: the guard must refuse and name the path only.
  const owners = path.join(root, "06-Resources/Guides/Owners/probe.md");
  fs.mkdirSync(path.dirname(owners), { recursive: true });
  fs.writeFileSync(owners, "SENTINEL-OWNER-CONTENT-MUST-NOT-BE-ECHOED\n");
  git(root, ["add", "-f", "--", "06-Resources/Guides/Owners/probe.md"]);

  const guarded = spawnSync("bash", [GUARD, "--repo", root, "--mode", "staged"], {
    cwd: root,
    env: GIT_ENV,
    encoding: "utf8",
  });
  const output = `${guarded.stdout}${guarded.stderr}`;

  assert.equal(guarded.status, 1, `the guard must refuse a staged declared record:\n${output}`);
  assert.match(output, /Owners\/probe\.md/, "the rejected path must be named so an operator can unstage it");
  assert.ok(
    !output.includes("SENTINEL-OWNER-CONTENT-MUST-NOT-BE-ECHOED"),
    "the guard must never echo the record's contents; doing so spreads what it protects"
  );
});

test("the suite never writes into the real repository", (t) => {
  // This suite is designed to be runnable in the owner's own checkout, where `memory.md` and
  // `handoff.md` are real private records. Snapshotting them is what makes that claim testable
  // rather than conventional.
  const realRecords = ["memory.md", "handoff.md", path.join("00-Private", "SOUL.md")];
  const before = { status: git(REPO_ROOT, ["status", "--porcelain"]).stdout };
  for (const rel of realRecords) {
    const full = path.join(REPO_ROOT, rel);
    before[rel] = fs.existsSync(full) ? sha256(full) : null;
  }

  const root = makeClone(t);
  init(root);

  assert.equal(git(REPO_ROOT, ["status", "--porcelain"]).stdout, before.status, "the real checkout's git status changed");
  for (const rel of realRecords) {
    const full = path.join(REPO_ROOT, rel);
    const after = fs.existsSync(full) ? sha256(full) : null;
    assert.equal(after, before[rel], `the suite modified the real ${rel}`);
    assert.ok(root !== REPO_ROOT, "initialization must run against the fixture, never the repository");
  }
});
