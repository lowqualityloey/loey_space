import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TEMPLATES_DIR = path.resolve(process.cwd(), "99-Templates");

test("template validation: all 19 templates have valid YAML frontmatter and types", () => {
  assert.ok(fs.existsSync(TEMPLATES_DIR), "99-Templates directory must exist");
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith(".md"));
  assert.ok(files.length >= 19, "Must contain at least 19 template files");

  for (const file of files) {
    const fullPath = path.join(TEMPLATES_DIR, file);
    const content = fs.readFileSync(fullPath, "utf8");

    assert.ok(content.startsWith("---"), `${file} must start with YAML frontmatter delimiter (---)`);
    const endMatch = content.slice(3).indexOf("---");
    assert.ok(endMatch !== -1, `${file} must have closing YAML frontmatter delimiter (---)`);

    const fm = content.slice(3, endMatch + 3);
    const typeMatch = fm.match(/type:\s*([a-zA-Z0-9_-]+)/);
    assert.ok(typeMatch, `${file} must declare a non-empty type field in frontmatter`);
  }
});

// Issue #51: the exit status of the validator is the artifact under test, so these
// cases spawn the committed bundle as a real child process instead of importing it.
// The validator resolves 99-Templates from process.cwd() first, which is what lets a
// throwaway fixture directory drive the run.
const VALIDATOR_BUNDLE = fileURLToPath(new URL("../validate-templates.js", import.meta.url));

function fixtureTemplate(frontmatterLines) {
  return `---\n${frontmatterLines}\n---\n\n# Fixture\n\n<% tp.date.now("YYYY-MM-DD") %>\n`;
}

const COMPLETE_CONCEPT = [
  "created: 2026-01-01",
  "updated: 2026-01-01",
  "type: concept",
  "status: active",
  "area: general",
  "tags:",
  "  - type/concept",
  "  - area/general",
  "  - status/active",
].join("\n");

function runValidator(templateMap) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "validate-templates-"));
  try {
    const fixtureTemplates = path.join(fixtureRoot, "99-Templates");
    fs.mkdirSync(fixtureTemplates);
    for (const [name, content] of Object.entries(templateMap)) {
      fs.writeFileSync(path.join(fixtureTemplates, name), content, "utf8");
    }
    return spawnSync(process.execPath, [VALIDATOR_BUNDLE], {
      cwd: fixtureRoot,
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("validator exits nonzero when a required property is absent", () => {
  const missingStatusArea = COMPLETE_CONCEPT.split("\n")
    .filter(line => !line.startsWith("status:") && !line.startsWith("area:"))
    .join("\n");

  const result = runValidator({ "MissingProperty.md": fixtureTemplate(missingStatusArea) });

  assert.equal(
    result.status,
    1,
    `Absent required property must fail validation.\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
  );
});

test("validator exits nonzero when a required property is present but blank", () => {
  const blankCreated = COMPLETE_CONCEPT.replace("created: 2026-01-01", "created:");

  const result = runValidator({ "BlankProperty.md": fixtureTemplate(blankCreated) });

  assert.equal(
    result.status,
    1,
    `Blank required property must fail validation.\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
  );
});

test("validator exits nonzero for a type that is not in the schema registry", () => {
  const unknownType = COMPLETE_CONCEPT.replace("type: concept", "type: total-nonsense");

  const result = runValidator({ "UnknownType.md": fixtureTemplate(unknownType) });

  assert.equal(
    result.status,
    1,
    `Unregistered type must fail validation.\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
  );
  assert.ok(
    !result.stdout.includes("total-nonsense"),
    `Diagnostics must name the file and field only, never the offending value.\n--- stdout ---\n${result.stdout}`
  );
});

test("validator exits zero for a template that satisfies its type's required properties", () => {
  const result = runValidator({ "ValidConcept.md": fixtureTemplate(COMPLETE_CONCEPT) });

  assert.equal(
    result.status,
    0,
    `Complete template must pass validation.\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
  );
});
