// Issue #101: `.github/workflows/ci.yml` could not go red on a broken wikilink, because it
// ran `audit-links` without `--strict`. Turning `--strict` on is not a one-word change: in a
// clean checkout `--strict` exits 1 on nine links that are **correct**, and all nine collapse
// to two targets, `00-Inbox/quick-capture-dump.md` and `01-Daily/Tasks Kanban.md`, that exist
// on the owner's machine and are **gitignored by design** (`.gitignore:111 00-Inbox/*`,
// `:114 01-Daily/*`). Every one of the eight referring notes is tracked and ships in every
// clone, so the vault's own architecture requires a tracked MOC to link its untracked content.
//
// The question the old resolver could not ask is *"is this link broken, or does it point at
// content that deliberately is not here?"* The answer cannot come from the disk — in a clone
// the file does not exist at all. It comes from the ignore rules, which do travel with the
// repository, and that is why the classification is `git check-ignore` and not `fs.existsSync`.
//
// One rule keeps the owner's local report as sharp as it was: a note that is **untracked**
// cannot have its dangling links excused by ignore rules. An untracked note and an untracked
// target live on the same disk, so there the question is decidable and a dangling link is a
// real defect. Without that clause, the five genuinely broken links in the owner's vault
// would all be reclassified as "local-only" and the report would stop reporting them.
//
// Fixtures are real git repositories under `os.tmpdir()` with a `.gitignore`, because ignore
// rules are the subject. Nothing here reads or writes the real vault.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditVaultLinks } from "../audit-links.js";

const BUNDLE = fileURLToPath(new URL("../audit-links.js", import.meta.url));
// `path.resolve`, not URL `../..` segments: URL resolution spends one `..` on the test file's
// own directory before the first step up. This file sits in `tests/`, which is three levels
// below the repository root (`tests` -> `scripts` -> `06-Resources` -> root) — the vendored
// helper in `tests/helpers/` needs four, which is where the wrong count comes from.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// The vault's own rule pair, copied from the real `.gitignore` so a fixture reproduces the
// architecture rather than a stand-in for it: a content folder is ignored wholesale and its
// MOCs are put back by negation.
const CONTENT_IGNORE = ["00-Inbox/*", "!00-Inbox/_*.md", "02-Projects/*", "!02-Projects/_*.md"];

function makeRepo(files, { ignore = [], git = true, afterAdd = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "link-audit-"));
  // `findVaultRoot()` looks for `.obsidian` or `06-Resources`, so a fixture that drives the
  // CLI has to look like a vault root rather than inherit one from a parent directory.
  fs.mkdirSync(path.join(root, "06-Resources", "Guides"), { recursive: true });
  fs.writeFileSync(path.join(root, ".gitignore"), `${ignore.join("\n")}\n`, "utf8");

  const write = (map) => {
    for (const [rel, content] of Object.entries(map)) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf8");
    }
  };
  write(files);

  if (git) {
    execFileSync("git", ["init", "-q"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
    execFileSync("git", ["add", "-A"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
    // Written after `git add`, so these notes exist on disk and are deliberately NOT tracked.
    write(afterAdd);
  }

  return root;
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function run(root, ...args) {
  return spawnSync(process.execPath, [BUNDLE, ...args], { cwd: root, encoding: "utf8" });
}

function targets(links) {
  return links.map((link) => link.target).sort();
}

function snapshot(root) {
  const files = new Map();
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (prefix === "" && entry.name === ".git") continue;
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs, rel);
      else files.set(rel, crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex"));
    }
  };
  walk(root, "");
  return [...files.entries()].sort();
}

// ---------------------------------------------------------------------------------------
// The three outcomes, and the clause that keeps them honest locally.
// ---------------------------------------------------------------------------------------

test("a tracked note linking into an ignored folder is local-only, not broken", () => {
  const root = makeRepo(
    { "Home.md": "# Home\n\nSee [[00-Inbox/quick-capture-dump|the dump]].\n" },
    { ignore: CONTENT_IGNORE }
  );
  try {
    const report = auditVaultLinks(root);
    assert.deepEqual(targets(report.brokenLinks), []);
    assert.deepEqual(targets(report.localOnlyLinks), ["00-Inbox/quick-capture-dump"]);
    assert.equal(report.localOnlyLinks[0].sourceFile, "Home.md");
    assert.equal(report.localOnlyLinks[0].line, 3);
  } finally {
    cleanup(root);
  }
});

test("a tracked note linking to an absent path that no rule excludes is broken", () => {
  // The distinction that makes the bucket worth having: this is the link CI can and must
  // catch, and it lives in a tracked folder, so nothing about it is local-only.
  const root = makeRepo(
    { "06-Resources/Guides/Guide.md": "# Guide\n\nSee [[06-Resources/Guides/No Such Guide]].\n" },
    { ignore: CONTENT_IGNORE }
  );
  try {
    const report = auditVaultLinks(root);
    assert.deepEqual(targets(report.localOnlyLinks), []);
    assert.deepEqual(targets(report.brokenLinks), ["06-Resources/Guides/No Such Guide"]);
    // The position is asserted rather than the fuzzy suggestion: the suggestion is pre-existing
    // behaviour this change does not touch, and pinning it here would make an unrelated
    // improvement to the matcher fail a test about local-only classification.
    assert.equal(report.brokenLinks[0].sourceFile, "06-Resources/Guides/Guide.md");
    assert.equal(report.brokenLinks[0].line, 3);
  } finally {
    cleanup(root);
  }
});

test("an untracked note cannot have a dangling link excused by the ignore rules", () => {
  // Both notes live on the owner's disk; neither ships. There the question is decidable, so
  // a link that resolves nowhere is a defect — which is why the real vault keeps reporting
  // its dangling links instead of reclassifying every one of them as local-only.
  const root = makeRepo(
    { "Home.md": "# Home\n" },
    {
      ignore: CONTENT_IGNORE,
      afterAdd: { "02-Projects/portfolio/portfolio.md": "# Draft\n\nSee [[00-Inbox/quick-capture-dump]].\n" },
    }
  );
  try {
    const report = auditVaultLinks(root);
    assert.deepEqual(targets(report.localOnlyLinks), []);
    assert.deepEqual(targets(report.brokenLinks), ["00-Inbox/quick-capture-dump"]);
    assert.equal(report.brokenLinks[0].sourceFile, "02-Projects/portfolio/portfolio.md");
  } finally {
    cleanup(root);
  }
});

test("a bare target resolves against its own folder first, so the real MOC embed is local-only", () => {
  // `00-Inbox/_Inbox MOC.md:97` is `![[quick-capture-dump]]` — no path, and the note that
  // exists on the owner's machine is its sibling. Obsidian prefers the same folder, so that
  // is the candidate to test; without it the one bare target in the real report would stay
  // "broken" and `--strict` still could not be enabled.
  const root = makeRepo(
    { "00-Inbox/_Inbox MOC.md": "# Inbox\n\n![[quick-capture-dump]]\n" },
    { ignore: CONTENT_IGNORE }
  );
  try {
    const report = auditVaultLinks(root);
    assert.deepEqual(targets(report.brokenLinks), []);
    assert.deepEqual(targets(report.localOnlyLinks), ["quick-capture-dump"]);
  } finally {
    cleanup(root);
  }
});

test("a bare target with no ignored candidate stays broken, so the bucket does not swallow everything", () => {
  // Non-vacuity for the same-folder rule: a same-folder candidate exists here, and it is not
  // ignored, so the link is broken. Without this case "local-only" could be implemented as
  // "unresolved" and every other assertion would still pass.
  const root = makeRepo(
    { "06-Resources/Guides/Guide.md": "# Guide\n\nSee [[Missing Thing]].\n" },
    { ignore: CONTENT_IGNORE }
  );
  try {
    const report = auditVaultLinks(root);
    assert.deepEqual(targets(report.localOnlyLinks), []);
    assert.deepEqual(targets(report.brokenLinks), ["Missing Thing"]);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// What the operator sees, and what the exit status does.
// ---------------------------------------------------------------------------------------

test("--strict fails on a broken link and passes when the only issue is local-only content", () => {
  const localOnly = makeRepo(
    { "Home.md": "# Home\n\nSee [[00-Inbox/quick-capture-dump]].\n" },
    { ignore: CONTENT_IGNORE }
  );
  const broken = makeRepo(
    { "Home.md": "# Home\n\nSee [[06-Resources/Guides/Gone]].\n" },
    { ignore: CONTENT_IGNORE }
  );
  try {
    const lenient = run(localOnly);
    assert.equal(lenient.status, 0);

    const strictClean = run(localOnly, "--strict");
    assert.equal(
      strictClean.status,
      0,
      `local-only content must not fail the gate that CI now runs\n${strictClean.stdout}${strictClean.stderr}`
    );

    const strictBroken = run(broken, "--strict");
    assert.equal(strictBroken.status, 1, "a broken link must still fail");
    assert.match(strictBroken.stderr, /Strict audit failed/);
  } finally {
    cleanup(localOnly);
    cleanup(broken);
  }
});

test("the report discloses the local-only bucket, so nothing is omitted silently", () => {
  const root = makeRepo(
    {
      "Home.md": "# Home\n\nSee [[00-Inbox/quick-capture-dump]].\n",
      "06-Resources/Guides/Guide.md": "# Guide\n\nSee [[06-Resources/Guides/Gone]].\n",
    },
    { ignore: CONTENT_IGNORE }
  );
  try {
    const result = run(root);
    assert.equal(result.status, 0);
    const output = `${result.stdout}${result.stderr}`;

    // Both buckets are stated, with their counts.
    assert.match(output, /1 uncreated\/broken link target\(s\)/);
    assert.match(output, /1 link target\(s\) point at local-only content/);
    assert.match(output, /00-Inbox\/quick-capture-dump/);
    assert.match(output, /06-Resources\/Guides\/Gone/);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// Degradation, and the promise that nothing is written.
// ---------------------------------------------------------------------------------------

test("outside a git worktree the audit degrades to disk semantics instead of failing", () => {
  // No `.gitignore` rules are readable without a repository, so nothing can be called
  // local-only, and the previous behaviour — everything unresolved is broken — is the right
  // fallback. It must not throw, and it must not silently drop the link.
  const root = makeRepo(
    { "Home.md": "# Home\n\nSee [[00-Inbox/quick-capture-dump]].\n" },
    { git: false }
  );
  try {
    const report = auditVaultLinks(root);
    assert.deepEqual(targets(report.localOnlyLinks), []);
    assert.deepEqual(targets(report.brokenLinks), ["00-Inbox/quick-capture-dump"]);

    const result = run(root);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stderr, /fatal:/, "git's stderr is not a finding");
  } finally {
    cleanup(root);
  }
});

test("the audit writes nothing, and two runs agree", () => {
  const root = makeRepo(
    {
      "Home.md": "# Home\n\nSee [[00-Inbox/quick-capture-dump]].\n",
      "00-Inbox/_Inbox MOC.md": "# Inbox\n\n![[quick-capture-dump]]\n",
      "06-Resources/Guides/Guide.md": "# Guide\n\nSee [[06-Resources/Guides/Gone]].\n",
    },
    { ignore: CONTENT_IGNORE, afterAdd: { "02-Projects/portfolio/portfolio.md": "# Draft\n\n[[Weather]]\n" } }
  );
  try {
    const before = snapshot(root);
    const first = run(root);
    assert.equal(first.status, 0);
    assert.deepEqual(snapshot(root), before, "a read-only audit must not touch a byte");
    const second = run(root);
    assert.equal(second.stdout, first.stdout, "the audit is deterministic");
    assert.deepEqual(snapshot(root), before);
    auditVaultLinks(root);
    assert.deepEqual(snapshot(root), before);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// The integration pin: the repository's own ignore rules are what make CI's strict mode usable.
// ---------------------------------------------------------------------------------------

test("this repository's rules classify both real CI findings as local-only", () => {
  // The two targets behind all nine findings in a clean checkout, checked against the
  // repository's own `.gitignore` rather than a fixture. If either rule is ever narrowed,
  // `--strict` goes red in CI and this case says why.
  const repoRoot = REPO_ROOT;
  const targets = ["00-Inbox/quick-capture-dump.md", "01-Daily/Tasks Kanban.md"];
  for (const target of targets) {
    const probe = spawnSync("git", ["check-ignore", "-q", "--", target], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(
      probe.status,
      0,
      `${target} is no longer excluded by .gitignore, so a clean checkout can no longer resolve it`
    );
  }

  // And the referrers on the other side are tracked, which is what makes them ship.
  const referrers = execFileSync(
    "git",
    ["ls-files", "--", "Home.md", "00-Inbox/_Inbox MOC.md", "01-Daily/_Tasks MOC.md"],
    { cwd: repoRoot, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean);
  assert.equal(referrers.length, 3, "the MOCs that link local-only content must be tracked");
});
