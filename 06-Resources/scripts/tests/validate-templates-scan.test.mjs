// Issue #93: `resolveTemplatesPath()` returned `99-Templates` and nothing else, so the
// validator inspected 3% of the notes that declare metadata and reported success over
// the rest — 21 tracked notes used a type (`moc` ×13, `guide` ×6, `dashboard` ×2) that the
// registry did not know, and no test noticed because every fixture was a TEMPLATE.
//
// These cases drive the committed bundle as a real child process against a synthetic vault
// in a temp directory, exactly like `template-validation.test.mjs`, because the artifact
// under test is the validator's EXIT STATUS and its stdout — not a returned boolean.
// Nothing here reads or writes the real vault: the fixture directory is created under
// `os.tmpdir()` and removed afterwards, and the fixture has no `.git`, which is also what
// exercises the validator's non-git enumeration path.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VALIDATOR_BUNDLE = fileURLToPath(new URL("../validate-templates.js", import.meta.url));

// The canonical required-field contract, transcribed from
// `06-Resources/Guides/Tagging & Properties.md` § "Baseline Required Properties (All Notes)"
// and the "Required Fields by Type" table. Baseline is 5 fields; `status` is required on
// every type EXCEPT `daily`; `project` additionally requires `priority`. Pinning the table
// here is the point: a registry that drifts from the guide must fail here, not in review.
const CANONICAL_REQUIRED = {
  project: ["created", "updated", "type", "status", "priority", "area", "tags"],
  learning: ["created", "updated", "type", "status", "area", "tags"],
  snippet: ["created", "updated", "type", "status", "area", "tags"],
  resource: ["created", "updated", "type", "status", "area", "tags"],
  concept: ["created", "updated", "type", "status", "area", "tags"],
  personal: ["created", "updated", "type", "status", "area", "tags"],
  review: ["created", "updated", "type", "status", "area", "tags"],
  daily: ["created", "updated", "type", "area", "tags"],
  capture: ["created", "updated", "type", "status", "area", "tags"],
  task: ["created", "updated", "type", "status", "area", "tags"],
  template: ["created", "updated", "type", "status", "area", "tags"],
  dashboard: ["created", "updated", "type", "status", "area", "tags"],
  guide: ["created", "updated", "type", "status", "area", "tags"],
  moc: ["created", "updated", "type", "status", "area", "tags"],
};

// Values are deliberately inert fixtures: the sentinel rule from #51 is that a diagnostic
// must never echo a frontmatter VALUE, so no test below asserts on a value appearing in
// output, and no fixture value doubles as a sentinel.
function validFrontmatter(type, overrides = {}) {
  const fields = {
    created: "2026-01-01",
    updated: "2026-01-01",
    type,
    area: "general",
    ...overrides,
  };
  if (type !== "daily") fields.status = "active";
  if (type === "project") fields.priority = "p1";

  const lines = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === "tags") continue;
    lines.push(value === undefined ? `${key}:` : `${key}: ${value}`);
  }
  lines.push("tags:");
  lines.push(`  - type/${fields.type}`);
  lines.push("  - area/general");
  lines.push("  - status/active");
  return lines.join("\n");
}

function note(frontmatterLines, body = "# Fixture\n") {
  return `---\n${frontmatterLines}\n---\n\n${body}`;
}

// `runVault` writes a synthetic vault: every key is a repo-root-relative path, so a case can
// put a note outside `99-Templates/` without touching the real vault. The `99-Templates`
// directory is always created (empty when the case supplies no templates) because that is
// how the validator locates the scan root.
function runVault(fileMap) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "validate-templates-scan-"));
  try {
    fs.mkdirSync(path.join(fixtureRoot, "99-Templates"));
    for (const [relPath, content] of Object.entries(fileMap)) {
      const abs = path.join(fixtureRoot, relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf8");
    }
    return spawnSync(process.execPath, [VALIDATOR_BUNDLE], {
      cwd: fixtureRoot,
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function assertExit(result, expected, message) {
  assert.equal(
    result.status,
    expected,
    `${message}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
  );
}

test("a valid note of every registered type passes, wherever it lives in the vault", () => {
  for (const [type, required] of Object.entries(CANONICAL_REQUIRED)) {
    for (const [location, relPath] of [
      ["template", `99-Templates/${type}.md`],
      ["note", `03-Dev/${type} note.md`],
    ]) {
      const result = runVault({
        [relPath]: note(validFrontmatter(type)),
      });

      assertExit(result, 0, `a complete \`${type}\` ${location} must pass`);
      assert.ok(
        result.stdout.includes(relPath),
        `the report must name the file it inspected (${relPath})\n--- stdout ---\n${result.stdout}`
      );
    }
  }
});

test("a violation OUTSIDE 99-Templates/ is inspected, not ignored", () => {
  // The core #93 regression. Before the fix the scan returned only 99-Templates, so this
  // file was never read and the validator exited 0 over a vault that violated the contract.
  const result = runVault({
    "03-Dev/Orphan Typo.md": note(validFrontmatter("snippet").replace("type: snippet", "type: snipet")),
  });

  assertExit(result, 1, "a bad type outside 99-Templates/ must fail validation");
  assert.ok(
    result.stdout.includes("03-Dev/Orphan Typo.md"),
    `the diagnostic must name the offending file\n--- stdout ---\n${result.stdout}`
  );
});

test("a missing required field outside 99-Templates/ fails", () => {
  const noStatus = validFrontmatter("concept")
    .split("\n")
    .filter((line) => !line.startsWith("status:"))
    .join("\n");

  const result = runVault({ "08-Concepts/Bare.md": note(noStatus) });

  assertExit(result, 1, "an absent required field on a non-template note must fail");
  assert.ok(
    result.stdout.includes("missing property: status"),
    `the diagnostic must name the field\n--- stdout ---\n${result.stdout}`
  );
});

test("a declared-but-blank required field outside 99-Templates/ fails", () => {
  const result = runVault({
    "08-Concepts/Half.md": note(validFrontmatter("concept").replace("area: general", "area:")),
  });

  assertExit(result, 1, "a blank required field on a non-template note must fail");
  assert.ok(
    result.stdout.includes("blank property: area"),
    `the diagnostic must name the field\n--- stdout ---\n${result.stdout}`
  );
});

test("a note that declares no type is not a contract violation", () => {
  // 29 of the 87 tracked markdown files declare no `type` at all (docs/, AGENTS.md,
  // README.md, skill files, issue templates). Demanding a type from them would be a
  // different contract than the canonical one, which binds notes that declare metadata.
  const result = runVault({
    "docs/STATE.md": "# Project State\n\nNo frontmatter here.\n",
    "AGENTS.md": "---\nupdated: 2026-09-01\n---\n\n# Agent\n",
    "99-Templates/Daily.md": note(validFrontmatter("daily")),
  });

  assertExit(result, 0, "a markdown file with no declared type must not fail the contract");
});

test("the dead `triage` registry key no longer validates a type no template declares", () => {
  // `triage` was registered while `99-Templates/Triage.md` declares `type: personal`, so the
  // key described nothing and a typo of a real name could not be told from a real type.
  //
  // The fixture carries the dead entry's own required-field list verbatim (including
  // `priority`), because that is what makes the case meaningful: it passes against the old
  // registry and must fail against the new one. Omitting `priority` would make this test pass
  // before the fix for the wrong reason — a missing field, not the dead key.
  const result = runVault({
    "99-Templates/Triage.md": note(validFrontmatter("triage", { priority: "p2" })),
  });

  assertExit(result, 1, "`triage` must not be a registered type while no note declares it");
});

test("a typo of a registered type fails", () => {
  const result = runVault({
    "03-Dev/Typo.md": note(validFrontmatter("concept").replace("type: concept", "type: concpet")),
  });

  assertExit(result, 1, "a misspelled type must not validate");
  assert.ok(
    !result.stdout.includes("concpet"),
    `the diagnostic must never echo the offending value (#51)\n--- stdout ---\n${result.stdout}`
  );
});

test("the declared exemptions do not fail, and are reported rather than silently skipped", () => {
  // `memory.md` and `handoff.md` are the owner's private records. They are tracked, they
  // declare `type: memory` / `type: handoff`, and neither name belongs in the canonical
  // taxonomy — so they are exempted BY PATH and the exemption is printed on every run.
  const result = runVault({
    "memory.md": note(validFrontmatter("memory")),
    "handoff.md": note(validFrontmatter("handoff")),
    "99-Templates/Concept.md": note(validFrontmatter("concept")),
  });

  assertExit(result, 0, "the exempted notes must not fail the contract");
  for (const exempt of ["memory.md", "handoff.md"]) {
    assert.ok(
      result.stdout.includes(exempt),
      `the exemption for ${exempt} must be declared in the output\n--- stdout ---\n${result.stdout}`
    );
  }
});

test("a tracked file under docs/ that declares a type is validated, not excluded by prefix", () => {
  // Decision recorded in the validator: `docs/` is NOT blanket-excluded. Its files declare
  // no `type` today, so they fall out on the "declares a type" rule rather than on a path
  // exemption — and if a future author adds frontmatter there, it must be held to the same
  // contract as any other note instead of hiding behind a directory exclusion.
  const result = runVault({
    "docs/tasks/TASK-synthetic.md": note(validFrontmatter("concept").replace("type: concept", "type: taskk")),
  });

  assertExit(result, 1, "a typed docs/ file must be held to the same contract");
  assert.ok(
    result.stdout.includes("docs/tasks/TASK-synthetic.md"),
    `the diagnostic must name the offending file\n--- stdout ---\n${result.stdout}`
  );
});

test("the dynamic-date placeholder warning applies only to files under 99-Templates/", () => {
  const result = runVault({
    "03-Dev/No Placeholder.md": note(validFrontmatter("snippet")),
    "99-Templates/Has Placeholder.md": note(validFrontmatter("snippet"), '<% tp.date.now("YYYY-MM-DD") %>\n'),
  });

  assertExit(result, 0, "a note without a Templater placeholder must still pass");
  assert.ok(
    result.stdout.includes("03-Dev/No Placeholder.md"),
    `the non-template note must actually have been inspected, or this assertion is vacuous\n--- stdout ---\n${result.stdout}`
  );
  assert.ok(
    !result.stdout.includes("Missing dynamic date template"),
    `the placeholder check is template-only; a non-template note must not be warned about it\n--- stdout ---\n${result.stdout}`
  );

  const warned = runVault({
    "99-Templates/No Placeholder.md": note(validFrontmatter("snippet")),
  });

  assertExit(warned, 0, "a missing placeholder on a template stays a warning, not a failure");
  assert.ok(
    warned.stdout.includes("Missing dynamic date template"),
    `a template without the placeholder must still be warned about\n--- stdout ---\n${warned.stdout}`
  );
});

test("a tag-namespace warning does not affect the exit status", () => {
  const noStatusTag = validFrontmatter("guide")
    .split("\n")
    .filter((line) => !line.includes("status/"))
    .join("\n");

  const result = runVault({ "06-Resources/Guides/Guide.md": note(noStatusTag) });

  assertExit(result, 0, "a missing status/* tag is advisory, not a contract failure");
  assert.ok(
    result.stdout.includes("Missing status/* tag"),
    `the warning must still be reported\n--- stdout ---\n${result.stdout}`
  );
});

test("NON-VACUITY: a run whose scan matches no files must not report success", () => {
  // If enumeration silently matched nothing — a wrong path, a broken root, a `git` call
  // that returned nothing — the old validator would print "All templates are properly
  // structured!" and exit 0. That is the failure this issue exists to kill, so the empty
  // scan must be a failure.
  const result = runVault({});

  assertExit(result, 1, "an empty scan must fail rather than pass vacuously");
});

test("NON-VACUITY: the scan reaches a note whose filename contains spaces", () => {
  // 31 tracked filenames contain spaces, and word-splitting them silently skips every MOC
  // and every guide — the exact bug that hid this defect for a session (see the census note
  // in docs/STATE.md and the same guard in documented-commands.test.mjs). If enumeration
  // regresses to whitespace splitting, this case finds nothing and fails.
  const relPath = "08-Concepts/_Concepts MOC.md";
  const result = runVault({ [relPath]: note(validFrontmatter("moc")) });

  assertExit(result, 0, "a MOC whose filename contains spaces must validate");
  assert.ok(
    result.stdout.includes(relPath),
    `the scan must have reached ${relPath}\n--- stdout ---\n${result.stdout}`
  );
});

test("NON-VACUITY: the scan reports how many notes it inspected", () => {
  const result = runVault({
    "03-Dev/One.md": note(validFrontmatter("concept")),
    "03-Dev/Two.md": note(validFrontmatter("snippet")),
    "03-Dev/Untyped.md": "# No frontmatter\n",
    "99-Templates/Concept.md": note(validFrontmatter("concept")),
  });

  assertExit(result, 0, "a clean vault must exit 0");
  assert.match(
    result.stdout,
    /Inspected 3 note\(s\); 3 of 4 tracked markdown file\(s\) declare a `type`\./,
    `the run must report its own coverage\n--- stdout ---\n${result.stdout}`
  );
});

test("the coverage line counts an exempted note as declaring a type, not as uninspected", () => {
  // `memory.md` declares `type: memory`. Reporting "1 of 3 files inspected" for it would read
  // as though it declared no type at all, which is a coverage claim this script must not make.
  const result = runVault({
    "memory.md": note(validFrontmatter("memory")),
    "03-Dev/Real.md": note(validFrontmatter("concept")),
  });

  assertExit(result, 0, "an exempt note plus one clean note must exit 0");
  assert.match(
    result.stdout,
    /Inspected 1 note\(s\); 2 of 2 tracked markdown file\(s\) declare a `type`, 1 exempted\./,
    `the coverage line must not hide the exempted note\n--- stdout ---\n${result.stdout}`
  );
});
