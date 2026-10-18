// The scaffold files are the only public copy of what a private record should look like, so
// they carry two obligations that nothing else checks: they must contain the heading names
// other parts of the vault already promise, and they must not contain anything that came from
// the owner's real records.
//
// The heading names are not a style preference. `Home.md` links two headings inside
// `handoff.md` by name, and a template that renames one produces a dashboard panel that is
// broken from the first run — with no error anywhere, because a wikilink to a missing heading
// resolves to the note either way.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const SCAFFOLD_DIR = path.join(REPO_ROOT, "06-Resources/scaffold");
const HYGIENE_BUNDLE = path.join(REPO_ROOT, "06-Resources/scripts/vault-hygiene.js");
const VALIDATOR_BUNDLE = path.join(REPO_ROOT, "06-Resources/scripts/validate-templates.js");
const HOME = path.join(REPO_ROOT, "Home.md");

// A complete synthetic note. `type` is a parameter because the exemption case needs the
// records the validator exempts BY PATH, and the tracker case needs one ordinary note so the
// scan is not empty.
function syntheticNote(type) {
  return [
    "---",
    "created: 2026-01-01",
    "updated: 2026-01-01",
    `type: ${type}`,
    "status: active",
    "area: general",
    "tags:",
    `  - type/${type}`,
    "  - area/general",
    "  - status/active",
    "---",
    "",
    `# ${type} fixture`,
    "",
  ].join("\n");
}

const TEMPLATES = ["memory.template.md", "handoff.template.md", "profile.template.md"];

// Literals that must never appear in a published scaffold file. Kept in a public test on
// purpose for the ones that are already public; a term that is not already public is
// deliberately absent from this list rather than written here to guard it.
const FORBIDDEN_LITERALS = ["lowqualityloey", "/home/", "heyloey", "promptkit-os", "kiwi"];

function read(name) {
  return fs.readFileSync(path.join(SCAFFOLD_DIR, name), "utf8");
}

test("every scaffold template exists and carries content", () => {
  for (const name of TEMPLATES) {
    const full = path.join(SCAFFOLD_DIR, name);
    assert.ok(fs.existsSync(full), `missing scaffold template ${name}`);
    assert.ok(fs.readFileSync(full, "utf8").trim().length > 200, `${name} is too thin to be a starting point`);
  }
});

test("the handoff template carries the headings the public dashboard links", () => {
  const handoff = read("handoff.template.md");
  const home = fs.readFileSync(HOME, "utf8");

  // Read the headings out of Home.md rather than restating them, so a deliberate rename in
  // the dashboard fails here instead of silently drifting from the template that must match it.
  const linked = [...home.matchAll(/\[\[handoff\.md#([^\]]+)\]\]/g)].map((match) => match[1]);
  assert.ok(
    linked.length >= 2,
    `expected Home.md to link at least two handoff headings, found ${linked.length} — if the dashboard changed, update this guard rather than deleting it`
  );

  for (const heading of linked) {
    assert.ok(
      handoff.includes(`## ${heading}`),
      `handoff.template.md is missing "## ${heading}", which Home.md links. A template that does not carry it produces a dead dashboard panel on the first run.`
    );
  }

  assert.ok(
    handoff.includes("### Latest Updates"),
    "the Hey Loey Guide records handoff entries under `### Latest Updates`, so the template must provide that section"
  );
});

test("the memory template satisfies the routing invariant the health check enforces", (t) => {
  // `vault-hygiene --check-rot` looks for this exact pattern in `memory.md` and counts its
  // absence as a finding, so a template without it ships a fresh clone into a red health check.
  const memory = read("memory.template.md");
  assert.match(
    memory,
    /Core Memory Rule\**\s*:/i,
    "memory.template.md must carry a `Core Memory Rule:` marker — vault-hygiene counts a missing routing rule as a finding"
  );

  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "scaffold-memory-"));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  fs.writeFileSync(path.join(vault, "memory.md"), memory);

  const result = spawnSync(process.execPath, [HYGIENE_BUNDLE, "--check-rot", "--strict"], {
    cwd: vault,
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    `a memory.md created from the template must pass the strict health check:\n${result.stdout}${result.stderr}`
  );
  assert.match(result.stdout, /Routing invariant header: ✅ present/);
  assert.ok(
    !/exceeds 75% warning threshold/.test(result.stdout),
    "the template must start a record well inside the budget, not at the warning threshold"
  );
});

test("no scaffold file carries an owner-identifying literal", () => {
  const files = fs.readdirSync(SCAFFOLD_DIR).filter((name) => name.endsWith(".md"));
  assert.ok(files.length >= TEMPLATES.length, "expected the scaffold folder to hold the templates");

  for (const name of files) {
    const contents = read(name);
    for (const literal of FORBIDDEN_LITERALS) {
      assert.ok(
        !contents.includes(literal),
        `${name} contains ${JSON.stringify(literal)}. These files are published; the records they generate are private. Use synthetic text and placeholders.`
      );
    }
  }
});

test("the handoff example matches the entry format the logging policy appends", () => {
  const handoff = read("handoff.template.md");

  // The exact shape a session writes under `### Latest Updates`. A template that shows a
  // different one produces handoffs that disagree with the entries already in the file.
  assert.match(
    handoff,
    /^- \[x\] \*\*\[YYYY-MM-DD HH:MM\]\*\* /m,
    "handoff.template.md must show `- [x] **[YYYY-MM-DD HH:MM]** <summary>` under `### Latest Updates`"
  );
});

test("the profile template does not contradict the milestone-only logging policy", () => {
  const profile = read("profile.template.md");
  const agents = fs.readFileSync(path.join(REPO_ROOT, "AGENTS.md"), "utf8");

  // The policy the vault actually runs on. If this wording moves, the profile's allowance
  // below must be re-read against it rather than assumed to still line up.
  assert.match(agents, /milestone-only/i);
  assert.match(agents, /Autonomous Logging/i);

  // Autonomous milestone logging is authorised, so the profile must not re-impose a blanket
  // permission prompt on the handoff update the policy already permits...
  assert.ok(
    !/Ask before writing to `memory\.md` or `handoff\.md`/.test(profile),
    "the profile must not ask for permission on every handoff update the milestone-only policy already authorises"
  );
  assert.match(profile, /milestone/i, "the profile must name the milestone-only allowance");
  assert.match(profile, /without asking/i, "the profile must say a qualifying handoff update needs no permission");

  // ...while unrelated changes to the records still need approval.
  assert.match(profile, /memory\.md/, "the profile must still name `memory.md` as an approval boundary");
  assert.match(profile, /approval/i, "unrelated record changes must still require approval");
});

test("the two path exemptions print on the tracked-index path (AC-1b-4)", (t) => {
  // The real `memory.md` and `handoff.md` are git-ignored by design, so the tracked-index
  // pass can never reach the exemptions against the live vault — the print was unobservable
  // there. The exemption is still a live contract, so it is exercised the only way it can be
  // without tracking a real private record: a synthetic vault that tracks its own records.
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "exempt-vault-"));
  t.after(() => fs.rmSync(vault, { recursive: true, force: true }));
  fs.mkdirSync(path.join(vault, "99-Templates"));
  fs.mkdirSync(path.join(vault, "03-Dev"), { recursive: true });
  fs.writeFileSync(path.join(vault, "memory.md"), syntheticNote("memory"));
  fs.writeFileSync(path.join(vault, "handoff.md"), syntheticNote("handoff"));
  fs.writeFileSync(path.join(vault, "03-Dev/Real.md"), syntheticNote("concept"));

  const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const git = (args) => spawnSync("git", args, { cwd: vault, env: gitEnv, encoding: "utf8" });
  assert.equal(git(["init", "-q"]).status, 0, "the fixture needs a repository for the tracked-index pass");
  assert.equal(git(["add", "-A"]).status, 0, "the fixture's records must be in the index for the exempt path to run");

  const result = spawnSync(process.execPath, [VALIDATOR_BUNDLE], {
    cwd: vault,
    env: gitEnv,
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    `the exempt records must not fail the contract:\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
  );
  assert.match(result.stdout, /memory\.md: exempt from the metadata contract/);
  assert.match(result.stdout, /handoff\.md: exempt from the metadata contract/);
});

test("the scaffold folder is declared to a hub, so its notes are not orphans", () => {
  // `hygiene` counts a note outside every hub's declared scope as a finding, and `--strict`
  // gates CI on it. The vault's own answer for a new folder is a hub, and the hub also tells
  // a future reader that this folder is published and must stay synthetic.
  const hub = path.join(SCAFFOLD_DIR, "_Scaffold MOC.md");
  assert.ok(fs.existsSync(hub), "the scaffold folder needs its hub, like every other folder in this vault");
  const contents = fs.readFileSync(hub, "utf8");
  assert.ok(
    contents.includes('FROM "06-Resources/scaffold"'),
    "the hub must declare the folder in a FROM clause; hygiene reads scopes, not folder containment"
  );
  assert.match(contents, /type: moc/, "the hub declares itself as a MOC, like every other _* MOC.md");
  assert.match(
    contents,
    /public/i,
    "the hub must state that this folder is published, because it is the only place a future edit would look"
  );
});
