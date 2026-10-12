// `init:vault` writes into a vault the user has already been living in, so the properties
// that matter are the ones that protect existing work: it creates only what is missing, it
// never rewrites a file, and it says what it did without echoing what it wrote.
//
// Every fixture lives in os.tmpdir(). The bundle is exercised as a process, which is the
// interface a user actually gets, rather than by importing functions whose signatures could
// pass while the command misbehaves.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseDumpLines } from "../src/lib/triage.ts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const BUNDLE = path.join(REPO_ROOT, "06-Resources/scripts/vault-init.js");

const CREATED_FILES = [
  "memory.md",
  "handoff.md",
  path.join("00-Private", "SOUL.md"),
  path.join("00-Inbox", "quick-capture-dump.md"),
];

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** A directory that validates as a vault: the two markers the command requires, nothing else. */
function makeVault(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-init-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "99-Templates"));
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# fixture vault\n");
  return root;
}

function run(args, cwd = REPO_ROOT) {
  return spawnSync(process.execPath, [BUNDLE, ...args], { cwd, encoding: "utf8" });
}

function runIn(cwd, args = []) {
  return spawnSync(process.execPath, [BUNDLE, ...args], { cwd, encoding: "utf8" });
}

test("the bundled command exists (the suite would otherwise test nothing)", () => {
  assert.ok(
    fs.existsSync(BUNDLE),
    `missing ${path.relative(REPO_ROOT, BUNDLE)} — run \`npm run build\`; CI builds before it tests`
  );
});

test("a run on a bare vault creates all four records and exits 0", (t) => {
  const root = makeVault(t);
  const result = run(["--root", root]);

  assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
  for (const rel of CREATED_FILES) {
    assert.ok(fs.existsSync(path.join(root, rel)), `expected ${rel} to be created`);
  }
  assert.match(result.stdout, /4 created, 0 already present/);
});

test("a second run is a no-op that changes no byte", (t) => {
  const root = makeVault(t);
  run(["--root", root]);

  const before = CREATED_FILES.map((rel) => sha256(path.join(root, rel)));
  const second = run(["--root", root]);

  assert.equal(second.status, 0, `expected exit 0 on a repeat run, got ${second.status}`);
  assert.match(second.stdout, /0 created, 4 already present/);
  assert.deepEqual(
    CREATED_FILES.map((rel) => sha256(path.join(root, rel))),
    before,
    "a repeat run must not touch the files it already created"
  );
});

test("an existing record is reported as present and left byte-identical", (t) => {
  const root = makeVault(t);
  const sentinel = "SENTINEL-owner-content-do-not-touch\n";
  fs.writeFileSync(path.join(root, "memory.md"), sentinel);

  const result = run(["--root", root]);

  assert.equal(result.status, 0);
  assert.equal(
    fs.readFileSync(path.join(root, "memory.md"), "utf8"),
    sentinel,
    "the initializer must never overwrite a record the user already has"
  );
  assert.match(result.stdout, /exists\s+memory\.md/);
  // The other three are still created: a populated vault is partially initialized, not fixed.
  for (const rel of CREATED_FILES.slice(1)) {
    assert.ok(fs.existsSync(path.join(root, rel)), `expected ${rel} to be created alongside the existing record`);
  }
});

test("--dry-run reports the plan and writes nothing at all", (t) => {
  const root = makeVault(t);
  const result = run(["--root", root, "--dry-run"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /would create memory\.md/);
  for (const rel of CREATED_FILES) {
    assert.equal(fs.existsSync(path.join(root, rel)), false, `--dry-run must not create ${rel}`);
  }
  assert.deepEqual(
    fs.readdirSync(root).sort(),
    ["99-Templates", "AGENTS.md"],
    "--dry-run must not even create the folders the records would live in"
  );
});

test("output names paths and status words but never file bodies", (t) => {
  const root = makeVault(t);
  const result = run(["--root", root]);

  // A distinctive line from each template's body. None of it may reach stdout: this output
  // is routinely pasted into a chat or an issue, and these are the user's private records.
  const templateBodies = [
    "durable truths only",
    "answers one question for the next session",
    "This file is optional",
    "Append one capture per line",
  ];
  for (const phrase of templateBodies) {
    assert.ok(
      !result.stdout.includes(phrase),
      `stdout echoed record content (${JSON.stringify(phrase)}); it must print paths only`
    );
  }
});

test("a directory that is not a vault is refused, and nothing is written", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "not-a-vault-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = run(["--root", root]);

  assert.equal(result.status, 1, "a non-vault target must fail rather than guess");
  assert.match(result.stderr, /not a vault/);
  assert.match(result.stderr, /AGENTS\.md/);
  assert.match(result.stderr, /99-Templates/);
  assert.deepEqual(fs.readdirSync(root), [], "a refused run must write nothing");
});

test("--root targets that directory, independently of the working directory", (t) => {
  const root = makeVault(t);
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "cwd-"));
  t.after(() => fs.rmSync(elsewhere, { recursive: true, force: true }));

  const result = runIn(elsewhere, ["--root", root]);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  for (const rel of CREATED_FILES) {
    assert.ok(fs.existsSync(path.join(root, rel)), `--root must create ${rel} in the named vault`);
  }
  assert.deepEqual(
    fs.readdirSync(elsewhere),
    [],
    "the target is the named vault, never the working directory or the script's own location"
  );
});

test("the default target is the working directory", (t) => {
  const root = makeVault(t);
  const result = runIn(root);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.ok(fs.existsSync(path.join(root, "memory.md")), "with no --root, the vault is where the command was run");
  assert.match(result.stdout, /Vault root: \./, "the target is reported relative to the working directory");
});

test("output never prints an absolute vault path by default, in a run or a dry run", (t) => {
  // This output is routinely pasted into a chat or an issue. An absolute vault path publishes
  // the user's filesystem layout along with it, so the default form is relative and the
  // absolute one is opt-in (`--show-paths`).
  const root = makeVault(t);

  for (const args of [[], ["--dry-run"]]) {
    const result = runIn(root, args);
    assert.equal(result.status, 0, `expected exit 0 for ${args.join(" ") || "a run"}: ${result.stderr}`);
    assert.ok(
      !result.stdout.includes(root),
      `a run from inside the vault must not print its absolute path (${args.join(" ") || "run"}):\n${result.stdout}`
    );
    assert.match(result.stdout, /Vault root: \./);
  }

  // And when --root names a different directory, the label stays relative to the caller.
  const elsewhere = makeVault(t);
  const named = run(["--root", elsewhere]);
  assert.equal(named.status, 0, `expected exit 0: ${named.stderr}`);
  assert.ok(
    !named.stdout.includes(`Vault root: ${elsewhere}`),
    `--root must not be echoed back as an absolute path:\n${named.stdout}`
  );
  assert.match(named.stdout, /Vault root: \.\.\//, "the named target is shown relative to the working directory");
});

test("--show-paths opts into the absolute target path for diagnostics", (t) => {
  const root = makeVault(t);
  const result = run(["--root", root, "--show-paths"]);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.ok(
    result.stdout.includes(`Vault root: ${root}`),
    `--show-paths must print the absolute target:\n${result.stdout}`
  );
});

test("the help text documents --show-paths", () => {
  const result = run(["--help"]);

  assert.equal(result.status, 0, `expected exit 0: ${result.stderr}`);
  assert.match(result.stdout, /--show-paths/, "the opt-in diagnostic flag must be discoverable in the help text");
});

test("--env is opt-in and copies the example without inventing secrets", (t) => {
  const root = makeVault(t);
  fs.writeFileSync(path.join(root, ".env.example"), "GEMINI_API_KEY=your_gemini_api_key_here\n");

  run(["--root", root]);
  assert.equal(fs.existsSync(path.join(root, ".env")), false, ".env must not be created without --env");

  run(["--root", root, "--env"]);
  assert.equal(
    fs.readFileSync(path.join(root, ".env"), "utf8"),
    "GEMINI_API_KEY=your_gemini_api_key_here\n",
    ".env is copied from the example, so it contains placeholders rather than anything real"
  );
});

test("the generated capture dump contains no capture for the sweep to file", (t) => {
  const root = makeVault(t);
  run(["--root", root]);

  const dump = fs.readFileSync(path.join(root, "00-Inbox/quick-capture-dump.md"), "utf8");
  const parsed = parseDumpLines(dump.split("\n"));

  // The scaffold documents the tokens, and the triage parser treats any bullet carrying a
  // token as a capture to file. A help line shaped like a capture would become a real task on
  // the first sweep, which is why every example lives below the archive heading.
  assert.deepEqual(
    parsed.map((item) => item.text),
    [],
    "the shipped dump must parse to zero captures"
  );
  assert.ok(
    dump.includes("## ✅ Triaged") || dump.includes("Triaged"),
    "the archive heading must be present so swept captures have somewhere to go"
  );
});

test("init:vault is declared, so the documented command is a real one", () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).scripts;
  assert.equal(
    scripts["init:vault"],
    "node 06-Resources/scripts/vault-init.js",
    "the onboarding guide documents this command; the documented-commands guard reads package.json"
  );
});
