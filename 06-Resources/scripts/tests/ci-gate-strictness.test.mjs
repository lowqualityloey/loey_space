// `.github/workflows/ci.yml` ran `npm run audit-links` without `--strict` for as long as the
// step has existed, and `npm run hygiene` is not wired at all. A non-strict invocation prints
// its findings and exits 0 regardless, so **a broken wikilink in a tracked note cannot fail
// CI** — the step has never been able to go red on the thing it exists to check. That is the
// same class of defect #54 found inside `audit-links.ts` itself (a `99-Templates/` skip that
// hid phantom links from the auditor) and #93 found in the validator (a scan that read 3% of
// the vault): a gate whose verdict is discarded.
//
// A test cannot observe "CI would have failed", so it pins the two things that decide it: the
// exit status of the exact command the workflow runs, and the workflow's own invocation. The
// second half is the part that rots silently — the flag is one word, and dropping it turns the
// step green without changing a single test result.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Derived with `path`, not with URL `../..` segments, which spend one `..` on the test file's
// own directory before the first step up. `tests/` is three levels below the root.
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");

function gateInvocations(script) {
  const text = fs.readFileSync(WORKFLOW, "utf8");
  // `npm run <script>` with any arguments, one per matching line. `--strict` is passed after
  // `--`; `npm run script --flag` would be parsed by npm itself and never reach the script.
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(`npm run ${script}`));
  return lines;
}

function run(script) {
  return spawnSync("npm", ["run", script, "--", "--strict"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

test("the lint gates actually fail when they have something to fail on", () => {
  // The workflow is looked up by path, so a rename would make every case below vacuous
  // rather than failing. This is the guard for that.
  assert.ok(
    fs.existsSync(WORKFLOW),
    `expected the CI workflow at ${path.relative(REPO_ROOT, WORKFLOW)}`
  );

  for (const script of ["audit-links", "hygiene"]) {
    const declarations = gateInvocations(script);
    assert.ok(
      declarations.length > 0,
      `CI must run \`npm run ${script}\`; the gate cannot be a gate if no step invokes it`
    );
    for (const line of declarations) {
      assert.ok(
        line.includes("--strict"),
        `CI invokes \`npm run ${script}\` without --strict, so the step can never fail:\n  ${line}`
      );
    }
  }
});

test("every CI step that runs a vault lint is strict, and the suite is run too", () => {
  const text = fs.readFileSync(WORKFLOW, "utf8");
  const invoked = [...text.matchAll(/npm (?:run )?([a-z-]+)/g)].map((match) => match[1]);
  for (const expected of ["typecheck", "build", "validate-templates", "audit-links", "hygiene"]) {
    assert.ok(
      invoked.includes(expected),
      `CI no longer runs \`${expected}\`; if that was deliberate, update this test`
    );
  }
  assert.ok(
    invoked.includes("test"),
    "CI no longer runs the unit suite; if that was deliberate, update this test"
  );
});

test("the strict gates pass in this checkout, which is what CI checks out", () => {
  // This is the acceptance criterion for the whole change, run the way CI runs it: the
  // committed bundle, invoked from the repository root, with `--strict`.
  for (const script of ["audit-links", "hygiene"]) {
    const result = run(script);
    assert.equal(
      result.status,
      0,
      `\`npm run ${script} -- --strict\` must exit 0 in a clean checkout, or CI is red on a \
clean tree and the gate is unusable.\n${result.stdout}${result.stderr}`
    );
  }
});
