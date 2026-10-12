var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// 06-Resources/scripts/src/vault-init.ts
var vault_init_exports = {};
__export(vault_init_exports, {
  RECORDS: () => RECORDS,
  TEMPLATES_DIR: () => TEMPLATES_DIR,
  buildCaptureDump: () => buildCaptureDump,
  parseArgs: () => parseArgs,
  validateTarget: () => validateTarget
});
module.exports = __toCommonJS(vault_init_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// 06-Resources/scripts/src/lib/triage.ts
var DUMP_PATH = "00-Inbox/quick-capture-dump.md";
var TRIAGED_HEADING = "## \u2705 Triaged";
var ROUTES = {
  do: { kind: "task" },
  bin: { kind: "drop" },
  dev: { kind: "note", folder: "03-Dev", type: "snippet", area: "dev", status: "active" },
  concept: { kind: "note", folder: "08-Concepts", type: "concept", area: "general", status: "active", review: "90d" },
  learn: { kind: "note", folder: "04-Learning", type: "learning", area: "learning", status: "in-progress", review: "30d" },
  ref: { kind: "note", folder: "06-Resources", type: "resource", area: "resources", status: "active" },
  personal: { kind: "note", folder: "05-Personal", type: "personal", area: "personal", status: "active" },
  project: { kind: "project", folder: "02-Projects", type: "project", area: "dev", status: "planning", review: "14d" }
};
var TOKEN_RE = new RegExp("#(" + Object.keys(ROUTES).join("|") + ")\\b", "i");

// 06-Resources/scripts/src/vault-init.ts
var REQUIRED_MARKERS = ["AGENTS.md", "99-Templates"];
var TEMPLATES_DIR = path.resolve(__dirname, "..", "scaffold");
var ENV_EXAMPLE = ".env.example";
var RECORDS = [
  { rel: "memory.md", template: "memory.template.md" },
  { rel: "handoff.md", template: "handoff.template.md" },
  { rel: path.join("00-Private", "SOUL.md"), template: "profile.template.md" },
  { rel: DUMP_PATH, template: null, build: buildCaptureDump }
];
function usage() {
  return [
    "vault-init \u2014 create the private records a fresh clone is missing",
    "",
    "Usage:",
    "  npm run init:vault -- [--root <dir>] [--dry-run] [--env] [--show-paths]",
    "",
    "Options:",
    "  --root <dir>  Vault to initialize. Defaults to the working directory.",
    "  --dry-run     Print what would be created and write nothing.",
    "  --env         Also copy .env.example to .env when .env is absent.",
    "  --show-paths  Print the absolute target path (diagnostics). Output is relative by",
    "                default, because it is routinely pasted into an issue.",
    "  -h, --help    This text.",
    "",
    "Existing files are never overwritten. Running it twice is a no-op."
  ].join("\n");
}
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function buildCaptureDump(created) {
  const tokens = Object.keys(ROUTES).map((token) => `#${token}`).join(", ");
  return [
    "---",
    `created: ${created}`,
    `updated: ${created}`,
    "type: capture",
    "status: active",
    "area: inbox",
    "tags:",
    "  - type/capture",
    "  - area/inbox",
    "  - status/active",
    "---",
    "",
    "# \u{1F4E5} Quick Capture Dump",
    "",
    "Append one capture per line, above the archive heading, in the form of a bullet whose",
    "text ends with a destination token. Anything above the archive heading that is not a",
    `bulleted capture line is ignored \u2014 including this paragraph. Available tokens are: ${tokens}.`,
    "",
    "Run the triage sweep to file everything above the archive heading and rewrite this file.",
    "Captures are archived below it as struck-through entries naming where each one went.",
    "",
    TRIAGED_HEADING,
    "",
    "Worked examples, kept below the heading so the sweep never files them:",
    "",
    "> - Replace the failing drive #do",
    "> - Backoff never jitters, so thundering herds still collide #dev",
    ""
  ].join("\n");
}
function parseArgs(argv) {
  let root = process.cwd();
  let dryRun = false;
  let withEnv = false;
  let showPaths = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help")
      return { help: true };
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--env") {
      withEnv = true;
      continue;
    }
    if (arg === "--show-paths") {
      showPaths = true;
      continue;
    }
    if (arg === "--root") {
      const value = argv[i + 1];
      if (!value)
        return { error: "--root requires a directory" };
      root = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--root=")) {
      root = arg.slice("--root=".length);
      if (!root)
        return { error: "--root requires a directory" };
      continue;
    }
    return { error: `unknown argument: ${arg}` };
  }
  return { root: path.resolve(root), dryRun, withEnv, showPaths };
}
function describeTarget(root, showPaths) {
  if (showPaths)
    return root;
  const relative2 = path.relative(process.cwd(), root);
  if (relative2 === "")
    return ".";
  return path.isAbsolute(relative2) ? path.basename(root) : relative2;
}
function validateTarget(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { reason: "not a directory" };
  }
  if (root === path.parse(root).root) {
    return { reason: "refusing to initialize the filesystem root" };
  }
  if (path.basename(root) === ".git") {
    return { reason: "refusing to initialize a Git directory" };
  }
  try {
    fs.accessSync(root, fs.constants.W_OK);
  } catch {
    return { reason: "not writable" };
  }
  const missing = REQUIRED_MARKERS.filter((marker) => !fs.existsSync(path.join(root, marker)));
  if (missing.length > 0) {
    return { reason: "not a vault", missing };
  }
  return null;
}
var STATUS_LABEL = {
  created: "created     ",
  exists: "exists      ",
  "would create": "would create",
  failed: "failed      "
};
function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
}
function writeExclusive(absolute, contents) {
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  try {
    fs.writeFileSync(absolute, contents, { flag: "wx" });
    return "created";
  } catch (error) {
    if (error.code === "EEXIST")
      return "exists";
    throw error;
  }
}
function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if ("help" in parsed) {
    console.log(usage());
    return;
  }
  if ("error" in parsed) {
    console.error(`vault-init: ${parsed.error}`);
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  const { root, dryRun, withEnv, showPaths } = parsed;
  const failure = validateTarget(root);
  if (failure) {
    const detail = failure.reason === "not a vault" ? `not a vault: missing ${failure.missing.join(", ")}` : failure.reason;
    console.error(`vault-init: ${detail}: ${describeTarget(root, showPaths)}`);
    console.error("   Nothing was written. Point --root at a vault, or run this from one.");
    process.exitCode = 1;
    return;
  }
  const created = today();
  const results = [];
  for (const record of RECORDS) {
    const absolute = path.join(root, record.rel);
    const contents = record.build ? record.build(created) : readTemplate(record.template);
    if (dryRun) {
      results.push({ rel: record.rel, status: fs.existsSync(absolute) ? "exists" : "would create" });
      continue;
    }
    results.push({ rel: record.rel, status: writeExclusive(absolute, contents) });
  }
  if (withEnv) {
    const absolute = path.join(root, ".env");
    const example = path.join(root, ENV_EXAMPLE);
    if (!fs.existsSync(example)) {
      results.push({ rel: ".env", status: "failed" });
      console.error(`vault-init: ${ENV_EXAMPLE} is missing, so .env was not created.`);
    } else if (dryRun) {
      results.push({ rel: ".env", status: fs.existsSync(absolute) ? "exists" : "would create" });
    } else {
      results.push({ rel: ".env", status: writeExclusive(absolute, fs.readFileSync(example, "utf8")) });
    }
  }
  console.log(`\u{1F5C2}\uFE0F  Vault root: ${describeTarget(root, showPaths)}`);
  console.log(dryRun ? "\u{1F50E} Dry run \u2014 nothing was written." : "\u270D\uFE0F  Create-only: existing files are left untouched.");
  console.log("");
  for (const result of results) {
    console.log(`   ${STATUS_LABEL[result.status]} ${result.rel}`);
  }
  console.log("");
  const made = results.filter((r) => r.status === "created").length;
  const present = results.filter((r) => r.status === "exists").length;
  console.log(`   ${made} created, ${present} already present.`);
  if (results.some((r) => r.status === "failed")) {
    process.exitCode = 1;
  }
}
if (require.main === module) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RECORDS,
  TEMPLATES_DIR,
  buildCaptureDump,
  parseArgs,
  validateTarget
});
