// `.github/workflows/ci.yml` filtered BOTH of its triggers on `main`, and on
// `pull_request` a `branches` filter matches the **base** branch. So a pull request
// opened against another feature branch — a stacked PR — matched nothing and got no
// run at all: measured on #102, `gh pr checks` reported "no checks reported" and no
// run had ever been created for that branch, which is why verifying it meant
// replicating the whole `ci.yml` sequence by hand in a scratch clone.
//
// That is the same defect class as #54, #93 and #101 — a check whose verdict never
// reaches the place it is supposed to gate — one level up. Those were gates that
// could not fail; this was a gate that was never invoked.
//
// No shell can observe "GitHub would have created a run", so this pins the decision
// instead: the trigger set, and the absence of a branch filter on the pull-request
// trigger. That is the half that rots silently. Restoring one line makes every
// stacked PR invisible again while every other test in this suite still passes,
// which is exactly why the guard has to exist rather than be inferred from green.
//
// Text-based on purpose: the repository declares no YAML parser, and adding a
// dependency to assert four lines of configuration would be heavier than the guard
// is worth. The parser below throws on an unexpected shape rather than returning an
// empty trigger set, because a guard that silently matches nothing is the failure
// mode this file exists to prevent.
//
// Not covered here, deliberately: a `paths` filter would also skip pull requests
// (a docs-only PR would get no run), but that restricts *which changes* are checked
// rather than *which pull requests*, it applies equally to a PR against `main`, and
// it is a separate trade-off. This guard is about the stacked-PR gap only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Derived with `path`, not with URL `../..` segments, which spend one `..` on the
// test file's own directory before the first step up. `tests/` is three levels below
// the repository root.
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");

// Parse the top-level `on:` mapping only: Map<trigger, string[]>, where each value
// holds that trigger's indented configuration lines, trimmed.
function parseTriggers(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^on:\s*(#.*)?$/.test(line));
  if (start === -1) {
    throw new Error(
      "no top-level `on:` block found in .github/workflows/ci.yml. If the workflow " +
        "was restructured, update this guard rather than deleting it — the stacked-PR " +
        "gap it pins is invisible in every other test."
    );
  }

  const triggers = new Map();
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    if (!/^\s/.test(line)) break; // next top-level key: the `on:` block ended

    const trigger = line.match(/^ {2}([A-Za-z_]+):\s*(.*)$/);
    if (trigger) {
      triggers.set(trigger[1], []);
      if (trigger[2].trim() !== "") triggers.get(trigger[1]).push(trigger[2].trim());
      continue;
    }

    if (/^ {4}\S/.test(line) && triggers.size > 0) {
      triggers.get([...triggers.keys()].pop()).push(line.trim());
      continue;
    }

    throw new Error(
      `unexpected line inside the \`on:\` block of ci.yml: ${JSON.stringify(line)}`
    );
  }
  return triggers;
}

function readTriggers() {
  return parseTriggers(fs.readFileSync(WORKFLOW, "utf8"));
}

test("the guard reads the real workflow and finds its triggers", () => {
  // Anti-vacuity. Every assertion below reads from this parse, so a renamed file or
  // a restructured `on:` block would otherwise make them all pass while checking
  // nothing at all.
  assert.ok(
    fs.existsSync(WORKFLOW),
    `expected the CI workflow at ${path.relative(REPO_ROOT, WORKFLOW)}`
  );

  const triggers = readTriggers();
  assert.ok(
    triggers.size >= 2,
    `expected at least two triggers under \`on:\`, parsed ${triggers.size}: ` +
      `${[...triggers.keys()].join(", ")}`
  );
  for (const expected of ["push", "pull_request"]) {
    assert.ok(
      triggers.has(expected),
      `\`on:\` no longer lists \`${expected}\`; parsed: ${[...triggers.keys()].join(", ")}`
    );
  }
});

test("every pull request is checked, including one stacked on another branch", () => {
  const filtering = readTriggers()
    .get("pull_request")
    .filter((line) => /^(branches|branches-ignore)\s*:/.test(line));

  assert.deepEqual(
    filtering,
    [],
    "`pull_request` carries a branch filter again. That filter matches the BASE " +
      "branch, so a pull request opened against another feature branch (a stacked " +
      "PR) will silently get no run at all:\n  " +
      filtering.join("\n  ")
  );
});

test("the post-merge push trigger stays filtered to main", () => {
  // The other half of the decision, pinned so the fix cannot drift into an
  // unrestricted `push`: that would re-run this job for every feature-branch push,
  // duplicating the pull-request run for no extra signal.
  const branchLine = readTriggers()
    .get("push")
    .find((line) => /^branches\s*:/.test(line));

  assert.ok(
    branchLine,
    "`push` is no longer filtered by branch, so every feature-branch push now runs " +
      "the same job as its pull request"
  );
  assert.match(
    branchLine,
    /\bmain\b/,
    `\`push\` must stay filtered to \`main\`; it reads: ${branchLine}`
  );
});
