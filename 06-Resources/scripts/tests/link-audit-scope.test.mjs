// Issue #125: the link auditor traversed ignored engineering/control-plane directories as if
// they were vault knowledge, and its attachment lookup stored both basenames and relative
// paths in the same set, so lookup-key count was printed as attachment-file count.
//
// Two separate defects, one report:
//   1. Scope. `.promptkit`, `.opencode`, `.clinerules`, `docs/`, `node_modules` and every
//      hidden directory are engine/control-plane material, not a vault's knowledge. On the
//      real vault they outnumber the notes roughly ten to one, so they dominated the orphan
//      total and made the owner-facing health number meaningless. Obsidian itself ignores
//      dot-folders, so an engine note must not satisfy a knowledge note's link either.
//   2. Counting. `attachments.size` counted resolution keys, not files: one file reachable by
//      basename and by path was counted twice.
//
// Fixtures are synthetic vaults under `os.tmpdir()`. Nothing here reads or writes the real
// vault, and no personal content, local path, or backup endpoint appears in a case.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditVaultLinks } from "../audit-links.js";

const BUNDLE = fileURLToPath(new URL("../audit-links.js", import.meta.url));

const CONTENT_IGNORE = ["00-Inbox/*", "!00-Inbox/_*.md", "02-Projects/*", "!02-Projects/_*.md"];

function makeRepo(files, { ignore = [], git = true, afterAdd = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "link-scope-"));
  // `findVaultRoot()` looks for `.obsidian` or `06-Resources`, so a fixture has to look like
  // a vault root rather than inherit one from a parent directory.
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
    spawnSync("git", ["init", "-q"], { cwd: root });
    spawnSync("git", ["add", "-A"], { cwd: root });
    // Written after `git add`, so these exist on disk and are deliberately NOT tracked.
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

// ---------------------------------------------------------------------------------------
// BEHAVIOR-link-audit-scope-001 - engineering/control-plane subtrees never enter the totals.
// ---------------------------------------------------------------------------------------

test("an unlinked engineering subtree contributes no notes and no orphans, and the scope is printed", () => {
  const root = makeRepo({
    "Home.md": "# Home\n",
    "06-Resources/Guides/Guide.md": "# Guide\n",
    ".promptkit/README.md": "# Engine\n",
    ".promptkit/templates/activity.md": "# Activity\n",
    ".opencode/rules.md": "# Rules\n",
    ".clinerules/promptkit.md": "# Rules\n",
    "docs/tasks/TASK-something.md": "# Record\n",
    ".github/ISSUE_TEMPLATE/task.md": "# Issue\n",
    "node_modules/some-pkg/README.md": "# Dependency\n"
  });
  try {
    const report = auditVaultLinks(root);
    // Only the two knowledge notes are vault content; every engine file above is excluded.
    assert.equal(report.totalNotes, 2, "engineering subtrees must not be counted as notes");
    assert.deepEqual(report.orphanNotes, ["06-Resources/Guides/Guide.md"]);

    // Non-vacuity: the exclusion is reported, not silent.
    const excluded = report.scope.excluded;
    for (const dir of [".promptkit", ".opencode", ".clinerules", "docs", ".github", "node_modules"]) {
      assert.ok(excluded.includes(dir), `${dir} must be reported as excluded scope`);
    }

    const result = run(root);
    assert.equal(result.status, 0);
    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /Scope/i, "the selected scope must be printed");
    assert.match(output, /\.promptkit/, "an excluded engineering subtree must be named");
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// BEHAVIOR-link-audit-scope-002 - physical attachment files, not resolution keys.
// ---------------------------------------------------------------------------------------

test("one attachment reachable by basename and by path counts once, and still resolves", () => {
  const root = makeRepo({
    "Home.md": "# Home\n\n![[img.png]] and [[99-Attachments/img.png]]\n",
    "99-Attachments/img.png": "binary-ish"
  });
  try {
    const report = auditVaultLinks(root);
    assert.equal(report.totalAttachments, 1, "one physical file is one attachment");
    assert.deepEqual(targets(report.brokenLinks), [], "both the basename and the path key must resolve");
  } finally {
    cleanup(root);
  }
});

test("two distinct files that share a basename count as two attachments", () => {
  const root = makeRepo({
    "Home.md": "# Home\n",
    "99-Attachments/a/logo.png": "a",
    "99-Attachments/b/logo.png": "b"
  });
  try {
    const report = auditVaultLinks(root);
    assert.equal(
      report.totalAttachments,
      2,
      "a shared basename is one resolution key but two physical files"
    );
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// BEHAVIOR-link-audit-scope-003 - literal-link reachability is not hub-query scope.
// ---------------------------------------------------------------------------------------

test("the report states literal-link reachability apart from unevaluated hub queries", () => {
  const root = makeRepo({
    "Home.md": "# Home\n",
    "06-Resources/Guides/Lonely.md": "# Lonely\n"
  });
  try {
    const report = auditVaultLinks(root);
    assert.equal(report.reachability, "literal-wikilinks-only");

    const result = run(root);
    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /literal/i, "the orphan finding must say it is literal-link based");
    assert.match(
      output,
      /not evaluated|unevaluated|are not evaluated/i,
      "the report must not claim an unevaluated query displays a note"
    );
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// BEHAVIOR-link-audit-scope-004 - engineering never satisfies a knowledge link, and the
// strict / local-only semantics are unchanged.
// ---------------------------------------------------------------------------------------

test("an engineering-only note does not satisfy a knowledge link, and a real broken link still fails --strict", () => {
  const root = makeRepo({
    "06-Resources/Guides/Guide.md": "# Guide\n\nSee [[Engine Only]].\n",
    ".promptkit/Engine Only.md": "# Engine\n",
    "06-Resources/Guides/Broken.md": "# Broken\n\nSee [[06-Resources/Guides/Gone]].\n"
  });
  try {
    const report = auditVaultLinks(root);
    const broken = targets(report.brokenLinks);
    // Obsidian ignores dot-folders, so an engine note is not a valid target for a vault note.
    assert.ok(broken.includes("Engine Only"), "an engineering-only note must not resolve a knowledge link");
    assert.ok(broken.includes("06-Resources/Guides/Gone"), "a genuinely broken link stays broken");

    const strict = run(root, "--strict");
    assert.equal(strict.status, 1, "a broken link must still fail --strict");
  } finally {
    cleanup(root);
  }
});

test("local-only targets are still classified local-only and still pass --strict", () => {
  const root = makeRepo(
    { "Home.md": "# Home\n\nSee [[00-Inbox/quick-capture-dump]].\n" },
    { ignore: CONTENT_IGNORE }
  );
  try {
    const report = auditVaultLinks(root);
    assert.deepEqual(targets(report.brokenLinks), []);
    assert.deepEqual(targets(report.localOnlyLinks), ["00-Inbox/quick-capture-dump"]);

    const strict = run(root, "--strict");
    assert.equal(strict.status, 0, "local-only content must not fail the gate");
  } finally {
    cleanup(root);
  }
});
