// Issue #54: the blueprints under `99-Templates/` are this vault's note factory, so a defect
// in one is copied into every note it produces — and until this file existed, none of the
// three classes below failed a gate.
//
// Why every gate was blind, recorded here because each case closes one hole:
//
//   * `audit-links.js` skipped templates outright (`if (relPath.startsWith('99-Templates/'))
//     continue`), so a blueprint's unresolvable wikilink was never reported.
//     `99-Templates/Project.md` shipped `[[08-Concepts/ ]]` and `[[04-Learning/ ]]` —
//     folder targets, not the notes the template asks the author to add.
//   * `validate-templates.js` asked only whether a blueprint mentioned the date placeholder
//     SOMEWHERE, so `Concept.md` passed while carrying `updated: 2026-08-10` on line 3.
//   * No gate read a board blueprint's LANES, and the validator treats a note that declares
//     no `type` as out of contract — which is exactly what the board `Project.md` generates
//     declared, so its missing metadata was invisible by construction.
//
// Templater JS runs only inside Obsidian, so nothing here executes a blueprint. The board
// `Project.md` generates is read out of its own `kanbanContent` literal and rendered the way
// the shipped script does, then handed to the COMMITTED validator as a real note — so the
// metadata is judged by the canonical contract rather than by a second transcription of it.
// Not verified anywhere in this file: live Obsidian rendering, and therefore the exact text
// Templater substitutes for `<% %>`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import auditLinks from "../audit-links.js";

const { auditVaultLinks } = auditLinks;

const TEMPLATES_DIR = path.resolve(process.cwd(), "99-Templates");
const VALIDATOR_BUNDLE = fileURLToPath(new URL("../validate-templates.js", import.meta.url));

// The six standard lanes, from AGENTS.md's project-scaffolding protocol and the
// kanban-project-planner skill. Order is asserted too, because it is the order a reader scans.
const STANDARD_LANES = ["Backlog", "To Do", "In Progress", "Review / Test", "Done", "Archive"];

// Required frontmatter for `type: project`, transcribed from
// `06-Resources/Guides/Tagging & Properties.md` the same way the #93 scan test pins the whole
// table: a blueprint that drifts from the contract must fail here, not in review.
const PROJECT_REQUIRED = ["created", "updated", "type", "status", "priority", "area", "tags"];

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
}

function lanesOf(markdown) {
  return [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]);
}

function frontmatterOf(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "expected a YAML frontmatter block");
  const props = new Map();
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) props.set(kv[1], kv[2].trim());
  }
  return props;
}

// `99-Templates/Project.md` builds its board as a JS template literal inside a Templater
// `<%* %>` block. This asserts the literal was FOUND and that lanes came out of it, so a
// rename or a restructure fails loudly instead of quietly checking an empty string.
function generatedBoard() {
  const source = readTemplate("Project.md");
  const match = source.match(/const kanbanContent = `([\s\S]*?)`;/);
  assert.ok(match, "Project.md must still build its board from a `kanbanContent` template literal");

  const rendered = match[1].replace(/\\`/g, "`").replace(/\$\{[^}]*\}/g, "2026-01-01");

  assert.ok(
    rendered.includes("## Backlog"),
    `the extracted board must actually contain lanes\n--- extracted ---\n${rendered}`
  );
  return rendered;
}

function runValidatorOn(fileMap) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-contract-"));
  try {
    fs.mkdirSync(path.join(root, "99-Templates"));
    for (const [relPath, content] of Object.entries(fileMap)) {
      const abs = path.join(root, relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf8");
    }
    return spawnSync(process.execPath, [VALIDATOR_BUNDLE], { cwd: root, encoding: "utf8" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function runAuditOn(fileMap) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-links-"));
  try {
    fs.mkdirSync(path.join(root, "06-Resources"), { recursive: true });
    for (const [relPath, content] of Object.entries(fileMap)) {
      const abs = path.join(root, relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf8");
    }
    return auditVaultLinks(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("both board blueprints declare all six standard lanes, including Archive", () => {
  const blueprints = [
    ["99-Templates/Kanban.md", readTemplate("Kanban.md")],
    ["the board Project.md generates", generatedBoard()],
  ];

  for (const [label, board] of blueprints) {
    const lanes = lanesOf(board);
    assert.ok(
      lanes.length >= STANDARD_LANES.length,
      `${label}: expected at least ${STANDARD_LANES.length} lanes, found ${lanes.length}: ${JSON.stringify(lanes)}`
    );
    assert.deepEqual(
      lanes.filter((lane) => STANDARD_LANES.includes(lane)),
      STANDARD_LANES,
      `${label}: every standard lane must be present`
    );
  }
});

test("the generated board carries the metadata its project type requires", () => {
  const board = generatedBoard();
  const props = frontmatterOf(board);

  for (const field of PROJECT_REQUIRED) {
    assert.ok(
      props.has(field),
      `the generated board must declare \`${field}\`; it declares ${JSON.stringify([...props.keys()])}`
    );
  }
  assert.ok(board.includes("kanban-plugin: board"), "the generated board must stay a Kanban board");
});

test("both board blueprints satisfy the canonical contract when materialised as notes", () => {
  // The case above only proves the keys exist. This writes each board into a throwaway vault
  // as the note it becomes and runs the committed validator over it, so the fields are judged
  // by the canonical contract instead of by a second transcription of it.
  const cases = {
    "02-Projects/Demo/Demo Kanban.md": generatedBoard(),
    "02-Projects/Demo/Standalone Kanban.md": readTemplate("Kanban.md").replace(
      /<% tp\.date\.now\("YYYY-MM-DD"\) %>/g,
      "2026-01-01"
    ),
  };

  for (const [relPath, board] of Object.entries(cases)) {
    const result = runValidatorOn({ [relPath]: board });
    assert.equal(
      result.status,
      0,
      `${relPath} must satisfy the canonical contract\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
    );
  }
});

test("the daily blueprint keeps Today's Focus empty and omits the status daily must not carry", () => {
  const daily = readTemplate("Daily.md");
  const props = frontmatterOf(daily);

  assert.equal(props.get("type"), "daily");
  assert.ok(
    !props.has("status"),
    "`daily` is the only type that does not require `status`; a blueprint must not stamp one onto every day"
  );

  for (const field of ["mood", "energy", "sleep_hours"]) {
    assert.ok(props.has(field), `the daily blueprint must declare \`${field}\` for the check-in`);
    assert.equal(
      props.get(field),
      "",
      `\`${field}\` must ship blank — a default would be recorded as a real observation on every day it is left alone`
    );
  }

  const heading = daily.match(/^#{3}\s.*Today's Focus.*$/m);
  assert.ok(heading, "the daily blueprint must still have a `🎯 Today's Focus` section");
  const body = daily.slice(heading.index + heading[0].length).split(/^#{2,4}\s/m)[0];

  assert.ok(!/^\s*[-*+]\s*\[[ x/]\]/m.test(body), "Today's Focus must not ship task checkboxes");
  assert.ok(
    !/^\s*[-*+]\s+\S/m.test(body),
    `Today's Focus is a daily intention, not a task list, and must ship empty\n--- body ---\n${body}`
  );
});

test("a blueprint's unresolvable wikilink is reported, while a render-time target is not", () => {
  const report = runAuditOn({
    "99-Templates/Phantom.md": "# Blueprint\n\n- [[08-Concepts/ ]] — \n",
    "99-Templates/RenderTime.md": "# Blueprint\n\n- [[<% tp.file.title %> Kanban|Open Visual Kanban Board]]\n",
    "99-Templates/Empty placeholder.md": "# Blueprint\n\n- [[ ]]\n",
  });

  const reported = report.brokenLinks.map((broken) => `${broken.sourceFile}:${broken.line}`);

  assert.ok(
    reported.includes("99-Templates/Phantom.md:3"),
    `a folder-target wikilink in a blueprint must be reported; got ${JSON.stringify(reported)}`
  );
  assert.ok(
    !reported.some((line) => line.startsWith("99-Templates/RenderTime.md")),
    `a target that only exists after the template renders must not be called broken; got ${JSON.stringify(reported)}`
  );
  assert.ok(
    !reported.some((line) => line.startsWith("99-Templates/Empty placeholder.md")),
    `an empty [[ ]] placeholder is not a target and must not be reported; got ${JSON.stringify(reported)}`
  );
});

test("the real vault's blueprints contain no unresolvable wikilinks", () => {
  const report = auditVaultLinks(process.cwd());

  // Non-vacuity: an audit that walked nothing would satisfy the assertion below trivially.
  assert.ok(report.totalNotes > 0, "the audit must have enumerated the vault");

  const fromTemplates = report.brokenLinks
    .filter((broken) => broken.sourceFile.startsWith("99-Templates/"))
    .map((broken) => `${broken.sourceFile}:${broken.line} ${broken.rawLink}`);

  assert.deepEqual(
    fromTemplates,
    [],
    `blueprints must not ship targets that cannot resolve:\n${fromTemplates.join("\n")}`
  );
});

test("every blueprint's date fields are Templater expressions, not literals", () => {
  // Why this rule is here and not in `validate-templates.js`: that file's date rule asks only
  // whether a blueprint mentions the placeholder SOMEWHERE, and `Concept.md` satisfied it —
  // line 2 supplied the placeholder the check looked for while line 3 read
  // `updated: 2026-08-10`. A literal in a date FIELD is worse than a missing placeholder
  // (it is copied verbatim into every note the blueprint makes, so the note's content date is
  // simply wrong), but the two rules cannot both live in the validator off the same
  // whole-content heuristic: the case that proves a placeholder-less blueprint is warned
  // would have to carry literal dates to stay placeholder-less, and would then fail the
  // literal rule. So the blueprint set is pinned here instead.
  const DATE_FIELDS = ["created", "updated", "last_reviewed"];
  const blueprints = fs.readdirSync(TEMPLATES_DIR).filter((name) => name.endsWith(".md"));
  assert.ok(blueprints.length >= 19, `expected the full blueprint set, found ${blueprints.length}`);

  const offenders = [];
  let checked = 0;

  for (const name of blueprints) {
    const props = frontmatterOf(readTemplate(name));
    for (const field of DATE_FIELDS) {
      const value = props.get(field);
      if (value === undefined || value === "") continue;
      checked++;
      if (!value.includes("<%")) offenders.push(`${name}: ${field}: ${value}`);
    }
  }

  // Non-vacuity: a scan that read no date fields would satisfy the assertion below trivially.
  assert.ok(checked >= 19, `the scan must read every blueprint's date fields; read ${checked}`);

  assert.deepEqual(
    offenders,
    [],
    `a date field in a blueprint must be a Templater expression, not a literal:\n${offenders.join("\n")}`
  );
});
