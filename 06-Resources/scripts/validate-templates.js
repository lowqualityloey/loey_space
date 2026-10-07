var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// 06-Resources/scripts/src/validate-templates.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_child_process2 = require("child_process");

// 06-Resources/scripts/src/lib/gitpaths.ts
var import_child_process = require("child_process");
var MAX_PATHS_PER_CALL = 200;
function git(root, args) {
  const result = (0, import_child_process.spawnSync)("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    // git writes `fatal: not a git repository` to stderr for the common non-repo case, and
    // that is the fallback working, not an error to show an operator.
    stdio: ["ignore", "pipe", "ignore"]
  });
  if (result.error || typeof result.status !== "number")
    return { status: null, stdout: "" };
  return { status: result.status, stdout: result.stdout ?? "" };
}
function trackedNotes(root) {
  const result = git(root, ["ls-files", "-z", "--", "*.md"]);
  if (result.status !== 0)
    return { available: false, paths: /* @__PURE__ */ new Set() };
  return {
    available: true,
    paths: new Set(result.stdout.split("\0").filter((entry) => entry.length > 0))
  };
}
function ignoredAmong(root, candidates) {
  const ignored = /* @__PURE__ */ new Set();
  if (candidates.length === 0)
    return { available: true, ignored };
  for (let offset = 0; offset < candidates.length; offset += MAX_PATHS_PER_CALL) {
    const batch = candidates.slice(offset, offset + MAX_PATHS_PER_CALL);
    const result = git(root, ["check-ignore", "--", ...batch]);
    if (result.status !== 0 && result.status !== 1)
      return { available: false, ignored: /* @__PURE__ */ new Set() };
    for (const line of result.stdout.split("\n")) {
      if (line.length > 0)
        ignored.add(line);
    }
  }
  return { available: true, ignored };
}
function readRepoFacts(root, candidates) {
  const tracked = trackedNotes(root);
  if (!tracked.available) {
    return { available: false, trackedNotes: /* @__PURE__ */ new Set(), ignored: /* @__PURE__ */ new Set() };
  }
  const rules = ignoredAmong(root, candidates);
  if (!rules.available) {
    return { available: false, trackedNotes: /* @__PURE__ */ new Set(), ignored: /* @__PURE__ */ new Set() };
  }
  return { available: true, trackedNotes: tracked.paths, ignored: rules.ignored };
}

// 06-Resources/scripts/src/validate-templates.ts
function resolveTemplatesPath() {
  const fromCwd = path.resolve(process.cwd(), "99-Templates");
  if (fs.existsSync(fromCwd))
    return fromCwd;
  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(current, "99-Templates");
    if (fs.existsSync(candidate))
      return candidate;
    current = path.dirname(current);
  }
  return path.resolve(__dirname, "../../99-Templates");
}
var TEMPLATES_DIR_NAME = "99-Templates";
var templatesPath = resolveTemplatesPath();
var vaultRoot = path.dirname(templatesPath);
var templatesPrefix = `${TEMPLATES_DIR_NAME}/`;
var expectedProperties = {
  "project": ["created", "updated", "type", "status", "priority", "area", "tags"],
  "learning": ["created", "updated", "type", "status", "area", "tags"],
  "snippet": ["created", "updated", "type", "status", "area", "tags"],
  "resource": ["created", "updated", "type", "status", "area", "tags"],
  "concept": ["created", "updated", "type", "status", "area", "tags"],
  "daily": ["created", "updated", "type", "area", "tags"],
  "personal": ["created", "updated", "type", "status", "area", "tags"],
  "review": ["created", "updated", "type", "status", "area", "tags"],
  // --- Explicit exceptions, pending issue #50 ---------------------------
  // Issue #50 owns the canonical type/area/status vocabulary and names these
  // three classes as needing "explicit justified exceptions" (raw captures and
  // software documents). Until it lands they are registered here so that the
  // tightened validator does not fail the live vault. Required-field lists are
  // derived from the fields those templates actually declare; their optional
  // extras (`source`, `priority`) are deliberately not required.
  // Exception: `capture` — Enhanced Quick Capture.md, Mobile Capture.md
  "capture": ["created", "updated", "type", "status", "area", "tags"],
  // Exception: `task` — Mobile Task.md
  "task": ["created", "updated", "type", "status", "area", "tags"],
  // Exception: `template` — AI Daily Enrich.md
  "template": ["created", "updated", "type", "status", "area", "tags"],
  // Issue #93: `dashboard`, `guide` and `moc` are the three types the guide records
  // as "documentation only" because the validator had never seen them. They are
  // real and heavily used — every MOC, every guide including the guide itself, and
  // the vault's home page declare them — and the guide's own table gives all three
  // `status` as their only extended requirement, which is the same list `snippet`
  // carries. Registering them without widening the scan would have been cosmetic;
  // widening the scan without them would have failed 21 notes at once. They are one
  // change for that reason, not two.
  "dashboard": ["created", "updated", "type", "status", "area", "tags"],
  "guide": ["created", "updated", "type", "status", "area", "tags"],
  "moc": ["created", "updated", "type", "status", "area", "tags"]
  // Issue #93: the `triage` key is GONE. It was registered while
  // `99-Templates/Triage.md` declares `type: personal`, so it described nothing, and
  // because the registry is keyed on the raw string, a typo such as `type: triag`
  // validated exactly like the dead key did. Registering a type is not free: it
  // claims that some note really is that kind of note. Do not re-add it unless a
  // tracked note actually declares it.
};
var exemptNotes = {
  "memory.md": "owner's private long-term memory record; its type is not in the canonical taxonomy",
  "handoff.md": "owner's private cross-session handoff record; its type is not in the canonical taxonomy"
};
var nonNoteDirectories = /* @__PURE__ */ new Set([".git", ".obsidian", "node_modules", "99-Attachments"]);
var LOCAL_MODE_FLAG = "--include-ignored";
var KNOWLEDGE_FOLDERS = [
  "00-Inbox",
  "01-Daily",
  "02-Projects",
  "03-Dev",
  "04-Learning",
  "05-Personal",
  "06-Resources",
  "07-Reviews",
  "08-Concepts",
  "99-Attachments",
  "99-Templates"
];
var ENGINEERING_ANY_DEPTH = /* @__PURE__ */ new Set(["node_modules", "dist"]);
var ENGINEERING_ROOT_ONLY = /* @__PURE__ */ new Set(["docs"]);
function isEngineeringDir(name, atRoot) {
  if (name.startsWith("."))
    return true;
  if (ENGINEERING_ANY_DEPTH.has(name))
    return true;
  if (atRoot && ENGINEERING_ROOT_ONLY.has(name))
    return true;
  return false;
}
var DECLARED_EXCEPTIONS = [
  {
    rule: "00-Inbox/*",
    matches: (rel) => rel.startsWith("00-Inbox/"),
    reason: "capture queue \u2014 raw captures are deliberately untyped"
  },
  {
    rule: "* Kanban.md",
    matches: (rel) => rel.endsWith(" Kanban.md"),
    reason: "board \u2014 a card store is a task surface, not a typed note"
  },
  {
    rule: "99-Attachments/*",
    matches: (rel) => rel.startsWith("99-Attachments/"),
    reason: "attachment \u2014 the media store holds assets, not typed notes"
  },
  {
    rule: "memory.md, handoff.md",
    matches: (rel) => rel === "memory.md" || rel === "handoff.md",
    reason: "root control \u2014 the owner's cross-session records, not vault notes"
  }
];
function walkLocalMarkdown(root) {
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md"))
      found.push(entry.name);
  }
  const walk = (prefix) => {
    for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (isEngineeringDir(entry.name, false))
          continue;
        walk(`${prefix}/${entry.name}`);
      } else if (entry.name.endsWith(".md")) {
        found.push(`${prefix}/${entry.name}`);
      }
    }
  };
  for (const folder of KNOWLEDGE_FOLDERS) {
    if (!fs.existsSync(path.join(root, folder)))
      continue;
    walk(folder);
  }
  return found.sort();
}
function validateLocalNotes(root, allValid) {
  console.log("");
  for (const exception of DECLARED_EXCEPTIONS) {
    console.log(`\u2796 ${exception.rule} \u2014 ${exception.reason}`);
  }
  const candidates = walkLocalMarkdown(root);
  const facts = readRepoFacts(root, candidates);
  if (!facts.available) {
    console.log(`\u26A0\uFE0F git ignore rules unavailable under ${root}; every walked note counts as local`);
  }
  const localNotes = candidates.filter((rel) => facts.available ? facts.ignored.has(rel) : true);
  console.log("");
  let inspected = 0;
  let excused = 0;
  let valid = true;
  for (const relativePath of localNotes) {
    const exception = DECLARED_EXCEPTIONS.find((candidate) => candidate.matches(relativePath));
    if (exception) {
      excused++;
      console.log(`\u2796 ${relativePath}: declared exception \u2014 ${exception.rule} (${exception.reason})`);
      continue;
    }
    let content;
    try {
      content = fs.readFileSync(path.join(root, relativePath), "utf8");
    } catch {
      console.log(`\u2796 ${relativePath}: in the ignore set but not on disk \u2014 skipped`);
      continue;
    }
    const frontmatter = parseFrontmatter(content);
    if (frontmatter === null) {
      if (/^---\r?\n/.test(content)) {
        inspected++;
        console.log(`\u274C ${relativePath}: unparseable frontmatter \u2014 the block opens but never closes`);
        valid = false;
      }
      continue;
    }
    const declaredType = frontmatter.props.type;
    if (declaredType === void 0 || declaredType.trim() === "") {
      continue;
    }
    inspected++;
    console.log(`
\u{1F50D} Validating ${relativePath}...`);
    valid = validateNote(relativePath, content, frontmatter) && valid;
  }
  console.log(`
\u{1F4C4} Local coverage: inspected ${inspected} ignored note(s), ${excused} declared exception(s)`);
  return allValid && valid;
}
function listTrackedMarkdown(root) {
  try {
    const output = (0, import_child_process2.execFileSync)("git", ["ls-files", "-z", "--", "*.md"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    });
    return output.split("\0").filter((file) => file.length > 0).sort();
  } catch {
    console.log(`\u26A0\uFE0F git enumeration unavailable under ${root}; walking the filesystem instead`);
    return walkMarkdown(root, "");
  }
}
function walkMarkdown(root, prefix) {
  const found = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    if (prefix === "" && nonNoteDirectories.has(entry.name))
      continue;
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...walkMarkdown(root, relativePath));
    } else if (entry.name.endsWith(".md")) {
      found.push(relativePath);
    }
  }
  return found.sort();
}
function parseFrontmatter(content) {
  const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!yamlMatch)
    return null;
  const yamlContent = yamlMatch[1];
  const lines = yamlContent.split(/\r?\n/);
  const props = {};
  let inTags = false;
  const tags = [];
  for (const line of lines) {
    if (line.trim() === "")
      continue;
    if (inTags) {
      if (line.trim().startsWith("-")) {
        const tag = line.trim().substring(1).trim();
        tags.push(tag);
      } else {
        inTags = false;
      }
    }
    if (!inTags) {
      const propMatch = line.match(/^(\w+):\s*(.*)$/);
      if (propMatch) {
        const [_, key, value] = propMatch;
        props[key] = value.trim();
        if (key === "tags") {
          inTags = true;
        }
      }
    }
  }
  if (tags.length > 0) {
    props.tags = tags.join("\n");
  }
  return { props, tags };
}
var requiredTagNamespaces = ["type", "area", "status"];
function validateNote(relativePath, content, frontmatter) {
  const { props, tags } = frontmatter;
  const isTemplate = relativePath.startsWith(templatesPrefix);
  const type = (typeof props.type === "string" ? props.type : "") || "unknown";
  const expected = expectedProperties[type];
  let isValid = true;
  if (!expected) {
    console.log(`\u274C ${relativePath}: unregistered type \u2014 the declared type is not in the schema registry`);
    isValid = false;
  }
  for (const prop of expected ?? []) {
    const value = props[prop];
    if (value === void 0) {
      console.log(`\u274C ${relativePath}: missing property: ${prop}`);
      isValid = false;
    } else if (typeof value === "string" && value.trim() === "") {
      console.log(`\u274C ${relativePath}: blank property: ${prop}`);
      isValid = false;
    }
  }
  const tagNamespaces = /* @__PURE__ */ new Set();
  for (const tag of tags) {
    const namespace = tag.split("/")[0];
    tagNamespaces.add(namespace);
  }
  const requiredNamespaces = type === "daily" ? ["type", "area"] : requiredTagNamespaces;
  for (const namespace of requiredNamespaces) {
    if (!tagNamespaces.has(namespace)) {
      console.log(`\u26A0\uFE0F ${relativePath}: Missing ${namespace}/* tag`);
    }
  }
  if (isTemplate && !content.includes('<% tp.date.now("YYYY-MM-DD") %>')) {
    console.log(`\u26A0\uFE0F ${relativePath}: Missing dynamic date template`);
  }
  if (isValid) {
    console.log(`\u2705 ${relativePath} passes validation`);
  }
  return isValid;
}
function validateAllNotes(includeIgnored) {
  console.log("\u{1F4CB} Vault Metadata Validation Report");
  console.log("=".repeat(40));
  if (includeIgnored) {
    console.log("\u{1F5C2}\uFE0F  Scope: tracked index + ignored local notes");
  }
  let files;
  try {
    files = listTrackedMarkdown(vaultRoot);
  } catch (error) {
    console.error("\u274C Error enumerating tracked markdown:", error?.message || error);
    return false;
  }
  if (files.length === 0) {
    console.error(`\u274C No markdown files found under ${vaultRoot} \u2014 refusing to report success over an empty scan`);
    return false;
  }
  let allValid = true;
  let inspected = 0;
  let exempted = 0;
  for (const relativePath of files) {
    const exemption = exemptNotes[relativePath];
    if (exemption !== void 0) {
      exempted++;
      console.log(`\u2796 ${relativePath}: exempt from the metadata contract \u2014 ${exemption}`);
      continue;
    }
    const absolutePath = path.join(vaultRoot, relativePath);
    let content;
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      console.log(`\u2796 ${relativePath}: tracked but not present on disk \u2014 skipped`);
      continue;
    }
    console.log(`
\u{1F50D} Validating ${relativePath}...`);
    const frontmatter = parseFrontmatter(content);
    if (frontmatter === null) {
      if (relativePath.startsWith(templatesPrefix)) {
        console.log(`\u274C ${relativePath}: Missing YAML frontmatter`);
        allValid = false;
      }
      continue;
    }
    const declaredType = frontmatter.props.type;
    if (declaredType === void 0 || declaredType.trim() === "") {
      if (relativePath.startsWith(templatesPrefix)) {
        console.log(`\u274C ${relativePath}: missing property: type`);
        allValid = false;
      }
      continue;
    }
    inspected++;
    const isValid = validateNote(relativePath, content, frontmatter);
    allValid = isValid && allValid;
  }
  if (inspected === 0) {
    console.error(`\u274C None of the ${files.length} markdown file(s) under ${vaultRoot} declare a \`type\` \u2014 nothing was validated`);
    return false;
  }
  console.log(
    `
Inspected ${inspected} note(s); ${inspected + exempted} of ${files.length} tracked markdown file(s) declare a \`type\`${exempted === 0 ? "." : `, ${exempted} exempted.`}`
  );
  if (includeIgnored) {
    allValid = validateLocalNotes(vaultRoot, allValid);
  }
  console.log("=".repeat(40));
  if (allValid) {
    console.log("\u{1F389} All notes are properly structured!");
  } else {
    console.log("\u26A0\uFE0F Some notes need attention");
  }
  return allValid;
}
if (!validateAllNotes(process.argv.slice(2).includes(LOCAL_MODE_FLAG))) {
  process.exitCode = 1;
}
