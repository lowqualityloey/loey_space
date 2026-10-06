import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const SCRIPTS_DECLARED = new Set(
  Object.keys(JSON.parse(
    execFileSync("node", ["-p", "JSON.stringify(require('./package.json').scripts)"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
  ))
);

// Issue #63: the guide promised `npm run weekly-summary`, which was never declared, so
// following the documentation exited 1 with "Missing script". This guard makes a
// documented command a checked claim rather than a review habit, matching the same
// reasoning as `check-bundle-parity` and the pre-push boundary guard.
//
// `npm test` and `npm ci` are deliberately out of scope: they are npm builtins invoked
// without `run`, so this scan never sees them. `npm run build` IS seen and IS declared.
//
// 99-Templates/ is excluded on purpose. A project template documents the commands the
// OWNER's future software project will define, not this repository's CLI, so `npm run dev`
// there is a legitimate placeholder rather than a broken promise. Excluding the whole
// directory keeps that judgement in one visible place instead of allowlisting commands.
//
// docs/ is excluded for the opposite reason: it is this repository's own engineering
// record, and it quotes broken commands *on purpose* — `docs/STATE.md` names
// `npm run weekly-summary` and `npm run X` as the defects issue #63 fixed. Those are
// evidence, not promises, and a guard that flagged them would fail the moment the record
// was accurate. docs/ is also gitignored on public `main` (never published), so nothing
// a vault user can read is lost by excluding it.
const EXCLUDED_PREFIXES = ["99-Templates/", "docs/"];

function trackedMarkdownFiles() {
  // -z is required: 31 tracked filenames contain spaces, and word-splitting them silently
  // skips every MOC and guide, which is how this defect stayed invisible in review.
  const out = execFileSync("git", ["ls-files", "-z", "--", "*.md"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return out.split("\0").filter((f) => f && !EXCLUDED_PREFIXES.some((p) => f.startsWith(p)));
}

function documentedRunCommands() {
  const found = new Map();
  for (const file of trackedMarkdownFiles()) {
    // Enumeration is what needs -z; reading a known path with spaces is safe via fs.
    const text = readFileSync(path.join(REPO_ROOT, file), "utf8");
    for (const match of text.matchAll(/\bnpm run ([A-Za-z0-9:_-]+)/g)) {
      const cmd = match[1];
      if (!found.has(cmd)) found.set(cmd, []);
      found.get(cmd).push(file);
    }
  }
  return found;
}

test("every `npm run X` promised in tracked documentation is a declared script", () => {
  const documented = documentedRunCommands();

  assert.ok(
    documented.size > 0,
    "the scan must actually find documented commands, otherwise it passes vacuously"
  );

  const missing = [];
  for (const [cmd, files] of documented) {
    if (!SCRIPTS_DECLARED.has(cmd)) {
      missing.push(`\`npm run ${cmd}\` — promised in ${[...new Set(files)].join(", ")}`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `documented but not declared in package.json scripts:\n  ${missing.join("\n  ")}`
  );
});

test("the scan sees the commands it is meant to police", () => {
  // Guards against the scan silently matching nothing after a regex or path change.
  const documented = documentedRunCommands();

  for (const expected of ["build", "typecheck", "validate-templates", "audit-links"]) {
    assert.ok(
      documented.has(expected),
      `expected \`npm run ${expected}\` to appear in tracked documentation; if it was renamed, update this test`
    );
  }

  // `npm run dev` exists only inside 99-Templates/Project.md, which is excluded above.
  // If it ever appears elsewhere, the exclusion is no longer covering it.
  assert.ok(
    !documented.has("dev"),
    "`npm run dev` must not be documented outside 99-Templates/ — it is not a declared script"
  );
});
