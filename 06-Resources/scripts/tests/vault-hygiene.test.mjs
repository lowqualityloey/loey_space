// Issue #52: a note that declares no `type`, or declares a review type and no
// `last_reviewed`, is silent everywhere. `validate-templates` cannot see it (a note with no
// `type` is outside the publication contract by design), `audit-links` cannot see it (it
// counts incoming wikilinks, and a hub's Dataview query is not one), and the canonical
// overdue query in `00-Inbox/_Triage MOC.md` requires BOTH `last_reviewed` AND
// `review_cycle`, so a note missing either is never listed as due.
//
// These cases drive the COMMITTED bundle, not the TypeScript source, because the artifact
// under test is the CLI's exit status and its stdout — including the promise that it prints
// paths and field names and never a value or a body (#51's sentinel rule). The bucket
// membership assertions call the bundle's exported `auditVaultHygiene` directly against the
// same fixture, so a rename of an output line cannot make a case pass vacuously.
//
// Every fixture lives under `os.tmpdir()` and is removed afterwards. Nothing here reads or
// writes the real vault, and the fixture has no `.git` unless a case creates one — which is
// also what exercises the report's non-git enumeration fallback.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditVaultHygiene } from "../vault-hygiene.js";

const BUNDLE = fileURLToPath(new URL("../vault-hygiene.js", import.meta.url));

// The canonical review-metadata contract, transcribed from
// `06-Resources/Guides/Tagging & Properties.md` § "Required Fields by Type". Exactly these
// four types carry `last_reviewed` + `review_cycle`; the guide's table is the authority, so
// pinning it here is the point — a registry that drifts from the guide fails here, not in
// review.
const REVIEW_TYPES = ["project", "learning", "concept", "personal"];

function frontmatter(fields) {
  const lines = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n");
}

function note(fields, body = "# Fixture\n") {
  return `---\n${frontmatter(fields)}\n---\n\n${body}`;
}

// A fully classified note of the given type, so a case only has to name what it omits.
function classified(type, overrides = {}) {
  const base = {
    created: "2026-01-01",
    updated: "2026-01-01",
    type,
    status: "active",
    area: "general",
    tags: undefined,
    ...overrides,
  };
  const tags =
    "- type/" + type + "\n  - area/general";
  return `---\n${frontmatter(base)}\ntags:\n  ${tags}\n---\n\n# Fixture\n`;
}

function makeFixture(fileMap) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-hygiene-"));
  for (const [rel, content] of Object.entries(fileMap)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
  return root;
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function git(root, ...args) {
  execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
}

function run(root, ...args) {
  return spawnSync(process.execPath, [BUNDLE, ...args], { cwd: root, encoding: "utf8" });
}

// The issue's own verification asks for "no file writes". A hash of every byte in the
// fixture before and after a run is the only version of that claim a test can hold.
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

function bucketPaths(report, key) {
  return report[key].map((entry) => (typeof entry === "string" ? entry : entry.path)).sort();
}

// ---------------------------------------------------------------------------------------
// AC-2: unclassified records, and review metadata that the overdue query requires and the
// note does not carry.
// ---------------------------------------------------------------------------------------

test("unclassified records are reported by path, and classified notes are not", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "08-Concepts/Untitled.md": "# No frontmatter at all\n",
    "08-Concepts/Named.md": classified("concept"),
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(bucketPaths(report, "unclassified"), ["08-Concepts/Untitled.md"]);
    // Vacuity guard: the scan must actually have seen the notes it is judging.
    assert.equal(report.scanned, 3);
    assert.equal(report.source, "filesystem");
  } finally {
    cleanup(root);
  }
});

test("scope: structural and documentation notes outside the note folders are not findings", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "README.md": "# Readme, no frontmatter\n",
    "99-Templates/Concept.md": "# A blueprint, deliberately not a record\n",
    "docs/engineering.md": "# Engineering record\n",
    "08-Concepts/Untitled.md": "# No frontmatter\n",
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(bucketPaths(report, "unclassified"), ["08-Concepts/Untitled.md"]);
  } finally {
    cleanup(root);
  }
});

test("review metadata follows the guide's four types and nothing else", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    // The latent defect this issue is about: `last_reviewed` present, `review_cycle` blank,
    // so the overdue query's `review_cycle = "14d"` clause can never match it.
    "02-Projects/beta/beta.md": classified("project", {
      last_reviewed: "2026-01-01",
    }),
    "05-Personal/Health.md": classified("personal"),
    // The guide gives `snippet` no review metadata, so a blank pair is correct here and
    // reporting it would be a false positive.
    "03-Dev/snippet.md": classified("snippet"),
    "08-Concepts/ok.md": classified("concept", {
      last_reviewed: "2026-01-01",
      review_cycle: "90d",
    }),
    "04-Learning/course.md": classified("learning", {
      last_reviewed: "2026-01-01",
      review_cycle: "30d",
    }),
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(report.missingReviewMetadata, [
      { path: "02-Projects/beta/beta.md", missing: ["review_cycle"] },
      { path: "05-Personal/Health.md", missing: ["last_reviewed", "review_cycle"] },
    ]);
    // A type the guide gives no review metadata is not judged at all, and a complete pair
    // is never a finding. Only the two incomplete notes above are.
    for (const judged of ["03-Dev/snippet.md", "08-Concepts/ok.md", "04-Learning/course.md"]) {
      assert.ok(
        !report.missingReviewMetadata.some((gap) => gap.path === judged),
        `${judged} carries what the guide asks of its type`
      );
    }
    assert.deepEqual(bucketPaths(report, "unclassified"), []);
  } finally {
    cleanup(root);
  }
});

test("a review_cycle outside the schema is reported apart from a missing one", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "08-Concepts/seven.md": classified("concept", {
      last_reviewed: "2026-01-01",
      review_cycle: "7d",
    }),
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(report.reviewCycleOutsideSchema, ["08-Concepts/seven.md"]);
    // Present but wrong is not the same finding as absent, and the count must not double.
    assert.deepEqual(report.missingReviewMetadata, []);
  } finally {
    cleanup(root);
  }
});

test("the owner's private cross-session records are never scanned", () => {
  // `memory.md` and `handoff.md` declare a `type` outside the canonical taxonomy, so a
  // report that enumerated the whole vault would name both of them on every run. They sit
  // at the vault root, which is outside the note folders — that scope is what excludes
  // them, and widening it to every root-level `.md` is the mutation this case catches.
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "memory.md": "# Private, type not in the taxonomy\n",
    "handoff.md": "# Private, type not in the taxonomy\n",
    "AGENTS.md": "# Agent contract, not a record\n",
    "08-Concepts/Untitled.md": "# No frontmatter\n",
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(bucketPaths(report, "unclassified"), ["08-Concepts/Untitled.md"]);
    assert.equal(report.scanned, 2, "only Home.md and the one note folder record");

    const spawned = run(root);
    const output = `${spawned.stdout}${spawned.stderr}`;
    for (const privateRecord of ["memory.md", "handoff.md", "AGENTS.md"]) {
      assert.ok(!output.includes(privateRecord), `${privateRecord} must not be named`);
    }
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// AC-3: dynamic MOC reachability is a different bucket from a literal-link orphan count.
// ---------------------------------------------------------------------------------------

test("hub scope and literal orphans are reported as separate findings", () => {
  const root = makeFixture({
    "Home.md": `${classified("dashboard")}\nSee [[Linked]].\n`,
    "08-Concepts/_Concepts MOC.md": `---\ntype: moc\n---\n\n\`\`\`dataview\nLIST\nFROM "08-Concepts"\nWHERE type = "concept"\n\`\`\`\n`,
    "08-Concepts/Linked.md": classified("concept"),
    "08-Concepts/Unlinked.md": classified("concept"),
    "03-Dev/Lonely.md": classified("snippet"),
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(report.dynamicMocOnly, ["08-Concepts/Unlinked.md"]);
    assert.deepEqual(report.noIncomingLinks, ["03-Dev/Lonely.md"]);
    // `Linked.md` has a literal backlink, so it is in neither bucket — the report's buckets
    // partition the notes with no incoming link, and a note that has one is not a finding.
    assert.ok(!report.dynamicMocOnly.includes("08-Concepts/Linked.md"));
    assert.ok(!report.noIncomingLinks.includes("Home.md"), "Home.md is the front door");
  } finally {
    cleanup(root);
  }
});

test("a hub's own folder is not its scope; the FROM paths are", () => {
  // The regression this pins: reading `path.dirname(hub)` would claim all of
  // `06-Resources/`, but `_Resources MOC.md` queries only the Guides subtree, so a note in
  // `06-Resources/APIs/` is covered by nothing and must not be granted a hub it lacks.
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "06-Resources/_Resources MOC.md": `---\ntype: moc\n---\n\n\`\`\`dataview\nLIST\nFROM "06-Resources/Guides"\n\`\`\`\n`,
    "06-Resources/Guides/Guide.md": classified("guide"),
    "06-Resources/APIs/API.md": classified("resource"),
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(report.dynamicMocOnly, ["06-Resources/Guides/Guide.md"]);
    assert.deepEqual(report.noIncomingLinks, ["06-Resources/APIs/API.md"]);
  } finally {
    cleanup(root);
  }
});

test("a vault-wide FROM names no path, so it grants no note a hub", () => {
  // `_Triage MOC`'s real query is `FROM "" AND !"99-Templates"` with a status filter. Read
  // as the whole vault it would claim every note and make the second bucket permanently
  // empty, which is a silent omission of exactly the kind this report exists to surface.
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "00-Inbox/_Triage MOC.md": `---\ntype: moc\n---\n\n\`\`\`dataview\nTASK\nFROM "" AND !"99-Templates"\nWHERE status = "in-progress"\n\`\`\`\n`,
    "05-Personal/Private.md": classified("personal"),
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(report.dynamicMocOnly, []);
    assert.deepEqual(report.noIncomingLinks, ["05-Personal/Private.md"]);
  } finally {
    cleanup(root);
  }
});

test("a FROM path outside a dataview block is not a query, and hubs are not findings", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    // Prose that mentions a FROM clause is not a query the vault runs.
    "08-Concepts/_Concepts MOC.md": `---\ntype: moc\n---\n\nProse about \`FROM "08-Concepts"\`.\n`,
    "08-Concepts/Unlinked.md": classified("concept"),
  });
  try {
    const report = auditVaultHygiene(root);
    assert.deepEqual(report.dynamicMocOnly, []);
    assert.deepEqual(report.noIncomingLinks, ["08-Concepts/Unlinked.md"]);
  } finally {
    cleanup(root);
  }
});

test("aliases and path-qualified links both count as a literal backlink", () => {
  const root = makeFixture({
    "Home.md": `${classified("dashboard")}\nSee [[Aliased Target]] and [[08-Concepts/By Path]].\n`,
    "08-Concepts/Real Name.md": `---\naliases: [Aliased Target]\n${frontmatter({
      created: "2026-01-01",
      updated: "2026-01-01",
      type: "concept",
      status: "active",
      area: "general",
      last_reviewed: "2026-01-01",
      review_cycle: "90d",
    })}\ntags:\n  - type/concept\n---\n\n# Fixture\n`,
    "08-Concepts/By Path.md": classified("concept", {
      last_reviewed: "2026-01-01",
      review_cycle: "90d",
    }),
    "08-Concepts/Orphan.md": classified("concept", {
      last_reviewed: "2026-01-01",
      review_cycle: "90d",
    }),
  });
  try {
    const report = auditVaultHygiene(root);
    const unreachable = [...report.dynamicMocOnly, ...report.noIncomingLinks];
    assert.ok(!unreachable.includes("08-Concepts/Real Name.md"), "an alias is a backlink");
    assert.ok(!unreachable.includes("08-Concepts/By Path.md"), "a path link is a backlink");
    assert.ok(unreachable.includes("08-Concepts/Orphan.md"), "a genuinely unlinked note is");
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// AC-1: ignored local content is audited only when explicitly requested.
// ---------------------------------------------------------------------------------------

test("the tracked index is the default and --include-ignored adds local content", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "08-Concepts/Kept.md": classified("concept"),
    "08-Concepts/Ignored.md": "# Locally ignored, unclassified, and not the index's business\n",
    ".gitignore": "08-Concepts/Ignored.md\n",
  });
  try {
    git(root, "init", "-q");
    git(root, "add", "-A");

    const tracked = auditVaultHygiene(root);
    assert.equal(tracked.source, "tracked");
    assert.equal(tracked.scanned, 2, "only Home.md and the tracked concept are in the index");
    assert.deepEqual(bucketPaths(tracked, "unclassified"), []);

    const local = auditVaultHygiene(root, { includeIgnored: true });
    assert.equal(local.source, "filesystem");
    assert.equal(local.scanned, 3);
    assert.deepEqual(bucketPaths(local, "unclassified"), ["08-Concepts/Ignored.md"]);

    // The flag is what the CLI adds, and the source line says which enumeration ran.
    const spawned = run(root, "--include-ignored");
    assert.equal(spawned.status, 0);
    assert.match(spawned.stdout, /Source: filesystem walk \(ignored local content included\)/);
    assert.match(spawned.stdout, /08-Concepts\/Ignored\.md/);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------------------
// AC-4, plus the issue's "verify no file writes and no silent omissions".
// ---------------------------------------------------------------------------------------

test("output carries paths and field names, never a value and never a note body", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "08-Concepts/unclassified.md": "# Heading\n\nBODY-SENTINEL-9c1d\n",
    "04-Learning/gap.md": classified("learning", { topic: "VALUE-SENTINEL-7f3a" }),
    "08-Concepts/cycle.md": classified("concept", {
      last_reviewed: "2026-01-01",
      review_cycle: "CYCLE-SENTINEL-4b2e",
    }),
  });
  try {
    const spawned = run(root);
    const output = `${spawned.stdout}${spawned.stderr}`;

    assert.equal(spawned.status, 0, "a report with findings is not a failure by default");
    assert.match(output, /08-Concepts\/unclassified\.md/);
    assert.match(output, /04-Learning\/gap\.md: missing last_reviewed, review_cycle/);
    assert.match(output, /08-Concepts\/cycle\.md/);

    // The sentinel rule: a diagnostic prints WHAT is missing, never the content it read.
    for (const sentinel of ["BODY-SENTINEL-9c1d", "VALUE-SENTINEL-7f3a", "CYCLE-SENTINEL-4b2e"]) {
      assert.ok(!output.includes(sentinel), `output must not echo ${sentinel}`);
    }
    // Field NAMES are the safe half of the pair and must still be there.
    assert.match(output, /last_reviewed/);
    assert.match(output, /review_cycle/);
  } finally {
    cleanup(root);
  }
});

test("the report writes nothing, and two runs agree", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "08-Concepts/Untitled.md": "# No frontmatter\n",
    "05-Personal/Health.md": classified("personal"),
    "08-Concepts/_Concepts MOC.md": `---\ntype: moc\n---\n\n\`\`\`dataview\nLIST\nFROM "08-Concepts"\n\`\`\`\n`,
  });
  try {
    const before = snapshot(root);

    const first = run(root);
    assert.equal(first.status, 0);
    assert.deepEqual(snapshot(root), before, "a read-only report must not touch a byte");

    const second = run(root);
    assert.equal(second.stdout, first.stdout, "the report is deterministic");
    assert.deepEqual(snapshot(root), before);

    auditVaultHygiene(root, { includeIgnored: true });
    assert.deepEqual(snapshot(root), before, "the filesystem walk writes nothing either");
  } finally {
    cleanup(root);
  }
});

test("the module prints only its own report, whether run or imported", () => {
  // `build.mjs` bundles with `format: 'cjs'`, and for a CJS entry esbuild INLINES imported
  // modules into the entry's own scope — so a `require.main === module` guard in any
  // imported file evaluates true inside this bundle. Importing the two parsers from
  // `./audit-links` rather than from `lib/links` therefore made `npm run hygiene` print the
  // entire link audit first. Both halves are asserted: the CLI emits one report, and
  // requiring the module emits none.
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "08-Concepts/Untitled.md": "# No frontmatter\n",
  });
  try {
    const spawned = run(root);
    assert.equal(spawned.status, 0);
    assert.ok(
      !spawned.stdout.includes("Vault Link Audit Report"),
      "running the hygiene report must not run the link audit"
    );
    assert.ok(!spawned.stdout.includes("orphan note(s)"));
    assert.equal(
      spawned.stdout.split("\n").filter((line) => line.includes("Vault Hygiene Report")).length,
      1,
      "exactly one report, printed once"
    );

    const imported = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(BUNDLE)});`], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(imported.status, 0);
    assert.equal(imported.stdout, "", "importing the module must have no CLI side effect");
  } finally {
    cleanup(root);
  }
});

test("--strict is the only mode that fails, and a clean report passes it", () => {
  const findingsRoot = makeFixture({
    "Home.md": classified("dashboard"),
    "08-Concepts/Untitled.md": "# No frontmatter\n",
  });
  const cleanRoot = makeFixture({ "Home.md": classified("dashboard") });
  try {
    const lenient = run(findingsRoot);
    assert.equal(lenient.status, 0);
    // Two findings, and the pair is the point: `08-Concepts/Untitled.md` is unclassified AND
    // no hub names its folder, and the report says both rather than collapsing them.
    assert.match(lenient.stdout, /UNCLASSIFIED RECORDS \u2014 no `type` in frontmatter \(1\)/);
    assert.match(lenient.stdout, /Outside every hub's FROM scope \u2014 no hub names its folder \(1\)/);
    assert.match(lenient.stdout, /2 finding\(s\).*read-only and changed nothing/);

    const strict = run(findingsRoot, "--strict");
    assert.equal(strict.status, 1, "findings are a gate only when asked for");
    assert.match(strict.stderr, /Strict hygiene report failed/);

    const agreeablyClean = run(cleanRoot, "--strict");
    assert.equal(agreeablyClean.status, 0);
    assert.match(agreeablyClean.stdout, /0 finding\(s\)/);
  } finally {
    cleanup(findingsRoot);
    cleanup(cleanRoot);
  }
});

test("a vault that is not a git worktree falls back to the walk, without a fatal message", () => {
  const root = makeFixture({
    "Home.md": classified("dashboard"),
    "08-Concepts/Untitled.md": "# No frontmatter\n",
  });
  try {
    const spawned = run(root);
    assert.equal(spawned.status, 0);
    assert.match(spawned.stdout, /walking the filesystem instead/);
    // git prints `fatal: not a git repository` on stderr; the fallback is the answer here,
    // not an error, so it must not reach the operator as one.
    assert.ok(
      !spawned.stderr.includes("fatal:"),
      `stderr must not carry git's fatal noise: ${spawned.stderr}`
    );
    assert.match(spawned.stdout, /Source: filesystem walk/);
  } finally {
    cleanup(root);
  }
});
