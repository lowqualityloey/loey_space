// #40: a sweep must rewrite the dump from its *current* content.
//
// The sweep used to compute its replacement from the snapshot it read at the
// start and then hand that finished string to vault.process, throwing away the
// current content Obsidian passed in. Anything captured while destination notes
// were being created therefore vanished, and a capture edited mid-sweep was
// removed even though the edit was what should have survived.
import test from "node:test";
import assert from "node:assert/strict";
import { getTodayStr, DUMP_PATH } from "../src/lib/triage.ts";
import triageSweep from "../src/triage-sweep.ts";

// triage-sweep reads `(window as any).Notice`, which plain Node has no binding for.
globalThis.window = globalThis;

function makeVault(initial) {
  const files = new Map(Object.entries(initial));
  const folders = new Set();

  const vault = {
    getAbstractFileByPath: (p) => (files.has(p) ? { path: p, extension: "md" } : null),
    read: async (f) => {
      if (!files.has(f.path)) throw new Error("ENOENT " + f.path);
      return files.get(f.path);
    },
    modify: async (f, c) => { files.set(f.path, c); },
    // Real Obsidian process() hands the callback the file's CURRENT content.
    // Reproducing that faithfully is the whole point of these tests.
    process: async (f, fn) => { files.set(f.path, fn(files.get(f.path))); },
    create: async (p, c) => { files.set(p, c); return { path: p, extension: "md" }; },
    createFolder: async (p) => { folders.add(p); },
    getMarkdownFiles: () =>
      [...files.keys()]
        .filter((p) => p.endsWith(".md"))
        .map((p) => ({ path: p, basename: p.split("/").pop().replace(/\.md$/, "") }))
  };

  return { app: { vault }, files, folders };
}

function dump(today, ...entries) {
  return [
    "---",
    "updated: " + today,
    "---",
    "",
    "# 📥 Quick Capture Dump",
    "",
    "## Captured Notes",
    "",
    "### 📅 " + today,
    ...entries,
    "",
    "---",
    "",
    "## ✅ Triaged",
    "> _Swept out of the inbox. Kept as a record of where things went._",
    ""
  ].join("\n");
}

/** Run `mutate` against the dump at the moment the first note is created. */
function duringFirstCreate(app, mutate) {
  const realCreate = app.vault.create;
  let fired = false;
  app.vault.create = async (p, c) => {
    if (!fired) {
      fired = true;
      await app.vault.process(app.vault.getAbstractFileByPath(DUMP_PATH), mutate);
    }
    return realCreate(p, c);
  };
  return () => { app.vault.create = realCreate; };
}

const notices = [];
globalThis.Notice = class {
  constructor(msg) { notices.push(msg); }
};

test("a capture appended while the sweep is filing survives the rewrite", async () => {
  const today = getTodayStr();
  const { app, files } = makeVault({
    [DUMP_PATH]: dump(today, "- https://boot.dev/courses #learn")
  });

  const restore = duringFirstCreate(app, (current) =>
    current.replace(
      "## Captured Notes\n",
      "## Captured Notes\n\n### 📅 " + today + "\n- appended mid sweep #concept\n"
    )
  );

  await triageSweep({ app });

  const after = files.get(DUMP_PATH);
  assert.ok(
    after.includes("- appended mid sweep #concept"),
    "capture appended during the sweep must survive"
  );
  assert.ok(
    !after.includes("~~appended mid sweep~~"),
    "a capture that arrived mid-sweep was never filed, so it must not be archived"
  );

  // It stays actionable: the next sweep files it exactly once.
  restore();
  await triageSweep({ app });

  assert.ok(
    files.has("08-Concepts/appended mid sweep.md"),
    "the surviving capture is filed by the next sweep"
  );
  assert.equal(
    files.get(DUMP_PATH).split("~~appended mid sweep~~").length - 1, 1,
    "and is archived exactly once"
  );
  assert.deepEqual(
    [...files.keys()].filter((p) => p.startsWith("04-Learning/")),
    ["04-Learning/boot.dev courses.md"],
    "while the originally filed capture is not filed a second time"
  );
});

test("a capture edited during the sweep is left in place rather than removed", async () => {
  const today = getTodayStr();
  const { app, files } = makeVault({
    [DUMP_PATH]: dump(today, "- https://boot.dev/courses #learn")
  });

  duringFirstCreate(app, (current) =>
    current.replace(
      "- https://boot.dev/courses #learn",
      "- https://boot.dev/courses and the exercises #learn"
    )
  );

  await triageSweep({ app });

  assert.ok(
    files.get(DUMP_PATH).includes("- https://boot.dev/courses and the exercises #learn"),
    "the edited capture must not be swept out from under the edit"
  );
});

test("a capture that could not be filed stays in the inbox and is not archived", async () => {
  const today = getTodayStr();
  // No daily note exists, so #do has nowhere to go.
  const { app, files } = makeVault({
    [DUMP_PATH]: dump(today, "- do the laundry #do")
  });

  await triageSweep({ app });

  const after = files.get(DUMP_PATH);
  assert.ok(after.includes("- do the laundry #do"), "a failed filing must leave its capture alone");
  assert.ok(!after.includes("~~do the laundry~~"), "a failed filing must not be logged as swept");
});

test("re-running the sweep neither refiles a capture nor duplicates its archive entry", async () => {
  const today = getTodayStr();
  const { app, files } = makeVault({
    [DUMP_PATH]: dump(today, "- https://boot.dev/courses #learn")
  });

  await triageSweep({ app });

  const filed = [...files.keys()].filter((p) => p.startsWith("04-Learning/"));
  assert.deepEqual(filed, ["04-Learning/boot.dev courses.md"]);
  const first = files.get(DUMP_PATH);
  assert.equal(
    first.split("~~https://boot.dev/courses~~").length - 1, 1,
    "the first sweep records exactly one archive entry"
  );

  await triageSweep({ app });

  assert.deepEqual(
    [...files.keys()].filter((p) => p.startsWith("04-Learning/")),
    filed,
    "a second sweep must not create a duplicate note"
  );
  assert.equal(
    files.get(DUMP_PATH).split("~~https://boot.dev/courses~~").length - 1, 1,
    "a second sweep must not duplicate the archive entry"
  );
});

test("untagged entries and archived history are never touched", async () => {
  const today = getTodayStr();
  const { app, files } = makeVault({
    [DUMP_PATH]: dump(
      today,
      "- https://boot.dev/courses #learn",
      "- an untagged thought worth keeping"
    )
  });

  await triageSweep({ app });

  const after = files.get(DUMP_PATH);
  assert.ok(after.includes("- an untagged thought worth keeping"));
  assert.ok(
    after.includes("> _Swept out of the inbox. Kept as a record of where things went._"),
    "the existing Triaged record must survive the rewrite"
  );
});