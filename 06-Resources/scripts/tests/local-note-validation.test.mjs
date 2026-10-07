// Issue #120: publication validation enumerates tracked Markdown, while owner-local notes are
// ignored on purpose. CI therefore never establishes local-note schema health: an unknown type,
// a missing required field or an unparseable frontmatter block can sit in the owner's own
// folders indefinitely, and the existing hygiene walk reports classification gaps without
// applying the contract at all.
//
// These cases drive the committed bundle as a real child process against a disposable fixture
// vault, exactly like `validate-templates-scan.test.mjs`, because the artifact under test is the
// validator's EXIT STATUS and its stdout. The fixture is a real git repository — `git init -q`
// plus `.gitignore` rules — because the whole point is the boundary between the index and what
// the owner's ignore rules keep local: a fixture without a repository could not express it.
//
// Nothing here reads or writes the real vault: the fixture lives under `os.tmpdir()` and is
// removed afterwards, and it always contains its own `99-Templates/` directory, which is how the
// bundle locates its scan root (otherwise it would resolve the real vault from `__dirname`).
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VALIDATOR_BUNDLE = fileURLToPath(new URL("../validate-templates.js", import.meta.url));

// The local-mode flag keeps the vocabulary `vault-hygiene.ts` already uses for the same idea.
const LOCAL_FLAG = "--include-ignored";

// The #51 rule: a diagnostic names the path and the field only, never the value. This token is
// planted in the offending fixtures' frontmatter AND body, so a report that echoes either fails.
const SENTINEL = "SENTINEL-NEVER-ECHOED";

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed in ${cwd}\n--- stderr ---\n${result.stderr}`
  );
}

function frontmatter(fields) {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
  lines.push("tags:");
  lines.push(`  - type/${fields.type}`);
  lines.push("  - area/general");
  lines.push("  - status/active");
  return lines.join("\n");
}

function note(fields, body = "# Fixture\n") {
  return `---\n${frontmatter(fields)}\n---\n\n${body}`;
}

function hashTree(root) {
  const entries = [];
  const walk = (dir, prefix) => {
    const children = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of children) {
      // `.git` is the harness's own plumbing, not vault content.
      if (prefix === "" && entry.name === ".git") continue;
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs, rel);
      else entries.push(`${rel}\0${crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex")}`);
    }
  };
  walk(root, "");
  return crypto.createHash("sha256").update(entries.join("\n")).digest("hex");
}

// A disposable repository shaped like the vault: content folders are ignored wholesale, one root
// note is tracked (the CI scope), and the engineering/control-plane trees are ignored too.
function buildVault() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-note-validation-"));
  fs.mkdirSync(path.join(root, "99-Templates"), { recursive: true });

  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  };

  const baseline = { created: "2026-01-01", updated: "2026-01-01", status: "active", area: "general" };

  // The only tracked markdown file: the default mode must read exactly this and nothing else.
  write("Home.md", note({ ...baseline, type: "dashboard" }));

  write(
    ".gitignore",
    [
      "00-Inbox/*",
      "01-Daily/*",
      "03-Dev/*",
      "04-Learning/*",
      "08-Concepts/*",
      "99-Attachments/*",
      ".promptkit/",
      "docs/",
      "node_modules/",
      "memory.md",
      "",
    ].join("\n")
  );

  // Ignored vault notes that DO declare the contract — the local mode must hold them to it.
  write("04-Learning/valid-local.md", note({ ...baseline, type: "learning" }));
  write(
    "08-Concepts/unregistered-type.md",
    note({ ...baseline, type: "wizardry", area: SENTINEL })
  );
  write(
    "08-Concepts/missing-status.md",
    note({
      created: "2026-01-01",
      updated: "2026-01-01",
      type: "concept",
      area: "general",
    })
  );
  // Starts a frontmatter block and never closes it: not "no frontmatter", an unreadable one.
  write("03-Dev/malformed.md", `---\ntype: concept\nstatus: active\n${SENTINEL}\n\n# Notes\n${SENTINEL}\n`);

  // Declared exception classes: queue, board, attachment, root control.
  write("00-Inbox/quick-capture-dump.md", "- [ ] raw capture line\n");
  write("01-Daily/Tasks Kanban.md", "## To Do\n- [ ] a card\n");
  write("99-Attachments/drawing.md", "# Drawing\n");
  write("memory.md", "---\nupdated: 2026-01-01\ntype: memory\n---\n\n# Memory\n");

  // Engineering/control-plane trees: each holds contract-violating markdown and must never be read.
  write(".promptkit/engine-note.md", note({ ...baseline, type: "not-a-canonical-type" }));
  write("docs/engine-note.md", note({ ...baseline, type: "also-not-canonical" }));
  write("node_modules/dep/README.md", "# dependency\n");

  git(root, "init", "-q");
  git(root, "add", "Home.md", ".gitignore");

  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
    treeHash: () => hashTree(root),
  };
}

function runValidator(root, args = []) {
  return spawnSync(process.execPath, [VALIDATOR_BUNDLE, ...args], { cwd: root, encoding: "utf8" });
}

function assertExit(result, expected, message) {
  assert.equal(
    result.status,
    expected,
    `${message}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
  );
}

test("the local mode is explicit and prints its coverage, while the default tracked scope is unchanged", () => {
  const vault = buildVault();
  try {
    const def = runValidator(vault.root);

    assertExit(def, 0, "the default tracked-index run must stay green over the fixture's tracked note");
    assert.ok(
      def.stdout.includes("Inspected 1 note(s); 1 of 1 tracked markdown file(s) declare a `type`."),
      `the default coverage line must be unchanged\n--- stdout ---\n${def.stdout}`
    );
    for (const ignored of ["04-Learning/valid-local.md", "08-Concepts/unregistered-type.md"]) {
      assert.ok(
        !def.stdout.includes(ignored),
        `the default mode must not read ignored local notes (${ignored})\n--- stdout ---\n${def.stdout}`
      );
    }

    const local = runValidator(vault.root, [LOCAL_FLAG]);

    assert.match(
      local.stdout,
      /🗂️\s+Scope: tracked index \+ ignored local notes/,
      `the local mode must print the scope it selected\n--- stdout ---\n${local.stdout}`
    );
    assert.match(
      local.stdout,
      /📄 Local coverage: inspected 4 ignored note\(s\), 4 declared exception\(s\)/,
      `the local mode must print its own coverage\n--- stdout ---\n${local.stdout}`
    );
  } finally {
    vault.cleanup();
  }
});

test("the canonical registry applies to typed local notes, and no diagnostic echoes a value", () => {
  const vault = buildVault();
  try {
    const local = runValidator(vault.root, [LOCAL_FLAG]);

    assertExit(local, 1, "a typed local note that violates the contract must fail the local mode");
    assert.ok(
      local.stdout.includes("08-Concepts/unregistered-type.md: unregistered type"),
      `an unregistered local type must be named\n--- stdout ---\n${local.stdout}`
    );
    assert.ok(
      local.stdout.includes("08-Concepts/missing-status.md: missing property: status"),
      `a missing required local field must be named\n--- stdout ---\n${local.stdout}`
    );
    assert.match(
      local.stdout,
      /03-Dev\/malformed\.md: [^\n]*frontmatter/i,
      `an unparseable frontmatter block must fail with a path-only reason\n--- stdout ---\n${local.stdout}`
    );
    assert.ok(
      local.stdout.includes("04-Learning/valid-local.md"),
      `the complete local note must have been inspected, or the failures above prove nothing\n--- stdout ---\n${local.stdout}`
    );
    assert.ok(
      !local.stdout.includes(SENTINEL),
      `a diagnostic must never echo a frontmatter value or a note body (#51)\n--- stdout ---\n${local.stdout}`
    );
  } finally {
    vault.cleanup();
  }
});

test("queue, board, attachment and root-control artifacts are declared exceptions, and engineering trees are never walked", () => {
  const vault = buildVault();
  try {
    const local = runValidator(vault.root, [LOCAL_FLAG]);

    // Each declared rule prints a `➖` line naming the artifact class it excuses and why. The
    // glob spelling is the implementation's business; the declaration and the reason are not.
    const rules = [
      [/➖[^\n]*00-Inbox[^\n]*queue/i, "queue"],
      [/➖[^\n]*Kanban\.md[^\n]*board/i, "board"],
      [/➖[^\n]*99-Attachments[^\n]*attachment/i, "attachment"],
      [/➖[^\n]*memory\.md[^\n]*(root control|owner)/i, "root control"],
    ];
    for (const [pattern, label] of rules) {
      assert.match(
        local.stdout,
        pattern,
        `the declared exception for the ${label} artifacts must be printed, not silently skipped\n--- stdout ---\n${local.stdout}`
      );
    }

    assert.ok(
      !/❌[^\n]*(quick-capture-dump|Tasks Kanban|drawing\.md|memory\.md)/.test(local.stdout),
      `a declared exception must not be reported as a contract failure\n--- stdout ---\n${local.stdout}`
    );

    for (const tree of [".promptkit/", "docs/engine-note.md", "node_modules/"]) {
      assert.ok(
        !local.stdout.includes(tree),
        `the engineering/control-plane tree ${tree} must never be walked, even when it holds a violating note\n--- stdout ---\n${local.stdout}`
      );
    }
  } finally {
    vault.cleanup();
  }
});

test("the local mode is read-only, and an ignored violation never reaches the default CI scope", () => {
  const vault = buildVault();
  try {
    const before = vault.treeHash();
    const def = runValidator(vault.root);
    const local = runValidator(vault.root, [LOCAL_FLAG]);
    const after = vault.treeHash();

    // Asserted before the exit-status pair on purpose: this one is a control that must already
    // hold, so a Red run still proves the current build does not touch the vault.
    assert.equal(after, before, "neither run may create, modify or delete a file in the vault");

    assertExit(def, 0, "an ignored note that violates the contract must not fail the default run");
    assert.ok(
      !/❌/.test(def.stdout),
      `the default run must not report the ignored note at all\n--- stdout ---\n${def.stdout}`
    );
    assertExit(local, 1, "the same note must fail the local mode — the pair is the point");
  } finally {
    vault.cleanup();
  }
});
