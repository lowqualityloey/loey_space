/*
 * `.githooks/pre-push` is the blocking gate between a local change and everyone else. It must run
 * the UTC timezone lane for every non-deletion push, and it must refuse the push when that lane
 * fails. These tests exercise the shipped hook in disposable repositories with a fake `npm`, so
 * they pin the real Git invocation without spending the lane's ~80 seconds or touching a remote.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const HOOK = path.join(REPO_ROOT, ".githooks", "pre-push");
const ZERO = "0".repeat(40);

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function writeExecutable(file, body) {
  fs.writeFileSync(file, body, { mode: 0o755 });
}

function git(cwd, args, env = {}) {
  return spawnSync("git", args, {
    cwd,
    env: { ...GIT_ENV, ...env },
    encoding: "utf8",
  });
}

/**
 * A repository with one baseline commit, a local bare remote, and the shipped hook activated.
 * The baseline is committed before activation so the fixture's own setup never runs the gate.
 */
function makeRepo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-hook-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.writeFileSync(path.join(root, "README.md"), "# fixture\n");
  assert.equal(git(root, ["init", "-q"]).status, 0);
  assert.equal(git(root, ["add", "README.md"]).status, 0);
  assert.equal(git(root, ["commit", "-qm", "fixture baseline"]).status, 0);

  const remote = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-remote-"));
  t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
  assert.equal(git(remote, ["init", "--bare", "-q"]).status, 0);
  assert.equal(git(root, ["remote", "add", "origin", remote]).status, 0);

  fs.mkdirSync(path.join(root, ".githooks"));
  fs.copyFileSync(HOOK, path.join(root, ".githooks", "pre-push"));
  fs.chmodSync(path.join(root, ".githooks", "pre-push"), 0o755);
  assert.equal(git(root, ["config", "--local", "core.hooksPath", ".githooks"]).status, 0);

  return { root, remote };
}

/** A PATH directory holding a fake npm, and optionally the Windows branch's uname/wsl.exe. */
function makeToolbox(t, { npmExit = 0, wslExit = 0, windows = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-tools-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  writeExecutable(
    path.join(dir, "npm"),
    `#!/bin/sh
printf '%s\\n' "$*" > "$FAKE_NPM_RECORD"
exit ${npmExit}
`
  );

  if (windows) {
    writeExecutable(
      path.join(dir, "uname"),
      `#!/bin/sh
printf '%s\\n' MINGW64_NT-10.0
`
    );
    writeExecutable(
      path.join(dir, "wsl.exe"),
      `#!/bin/sh
printf '%s\\n' "$*" > "$FAKE_WSL_RECORD"
exit ${wslExit}
`
    );
  }

  return dir;
}

function push(repo, tools, env = {}) {
  return git(repo, ["push", "origin", "HEAD:main"], {
    PATH: `${tools}:${process.env.PATH || ""}`,
    ...env,
  });
}

test("the pre-push hook is executable and wires in the timezone lane", () => {
  const stat = fs.statSync(HOOK);
  assert.ok(stat.mode & 0o111, "git silently skips a non-executable hook");
  assert.match(read(HOOK).split("\n")[0], /^#!\/usr\/bin\/env bash$/);

  const code = read(HOOK)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

  assert.ok(code.includes("git rev-parse --show-toplevel"), "the hook must target this checkout");
  assert.ok(code.includes("npm run test:timezone"), "the hook must run the UTC lane");
  assert.ok(code.includes("wsl.exe"), "the Windows path must go through WSL");
  assert.ok(!/\bPATH\s*=/.test(code), "the hook must not mutate PATH");
  assert.ok(!/\.local\/bin|\$HOME|~\/\./.test(code), "no machine-specific paths");
});

test("a passing timezone lane lets the push through", (t) => {
  const { root, remote } = makeRepo(t);
  const tools = makeToolbox(t);
  const record = path.join(root, "npm-call.txt");

  const result = push(root, tools, { FAKE_NPM_RECORD: record });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(record).trim(), "run test:timezone");
  assert.equal(git(remote, ["rev-parse", "--verify", "refs/heads/main"]).status, 0);
});

test("a failing timezone lane blocks the push", (t) => {
  const { root, remote } = makeRepo(t);
  const tools = makeToolbox(t, { npmExit: 7 });
  const record = path.join(root, "npm-call.txt");

  const result = push(root, tools, { FAKE_NPM_RECORD: record });

  assert.notEqual(result.status, 0, "a failing lane must fail the push");
  assert.match(result.stderr, /Push blocked — the UTC timezone lane failed/);
  assert.match(result.stderr, /git push --no-verify/);
  assert.equal(read(record).trim(), "run test:timezone");
  assert.notEqual(
    git(remote, ["rev-parse", "--verify", "refs/heads/main"]).status,
    0,
    "the refused commit must not reach the remote"
  );
});

test("a deletion-only push skips the lane", (t) => {
  const { root } = makeRepo(t);
  const tools = makeToolbox(t);
  const record = path.join(root, "npm-call.txt");

  const result = spawnSync("bash", [".githooks/pre-push", "origin", "fixture"], {
    cwd: root,
    env: { ...GIT_ENV, PATH: `${tools}:${process.env.PATH || ""}`, FAKE_NPM_RECORD: record },
    input: `${ZERO} ${ZERO} refs/heads/main ${ZERO}\n`,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(record), false, "a deletion cannot introduce a date regression");
});

test("the Windows branch runs the lane through WSL", (t) => {
  const { root } = makeRepo(t);
  const tools = makeToolbox(t, { windows: true });
  const wslRecord = path.join(root, "wsl-call.txt");
  const npmRecord = path.join(root, "npm-call.txt");
  const sha = "a".repeat(40);

  const result = spawnSync("bash", [".githooks/pre-push", "origin", "fixture"], {
    cwd: root,
    env: {
      ...GIT_ENV,
      PATH: `${tools}:${process.env.PATH || ""}`,
      FAKE_WSL_RECORD: wslRecord,
      FAKE_NPM_RECORD: npmRecord,
    },
    input: `${sha} ${sha} refs/heads/main ${ZERO}\n`,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const call = read(wslRecord);
  assert.match(call, /-e env LOEY_REPO_ROOT=/);
  assert.match(call, /bash -lc/);
  assert.match(call, /npm run test:timezone/);
  assert.equal(fs.existsSync(npmRecord), false, "native Windows npm must not be used");
});

test("missing npm fails closed instead of silently allowing the push", (t) => {
  const { root } = makeRepo(t);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-no-npm-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const gitBin = spawnSync("bash", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  const bashBin = spawnSync("bash", ["-c", "command -v bash"], { encoding: "utf8" }).stdout.trim();
  fs.symlinkSync(gitBin, path.join(dir, "git"));

  const sha = "a".repeat(40);
  const result = spawnSync(bashBin, [".githooks/pre-push", "origin", "fixture"], {
    cwd: root,
    env: { ...GIT_ENV, PATH: dir },
    input: `${sha} ${sha} refs/heads/main ${ZERO}\n`,
    encoding: "utf8",
  });

  assert.equal(result.status, 1, result.error?.message || result.stderr);
  assert.match(result.stderr, /npm is not on PATH/);
});
