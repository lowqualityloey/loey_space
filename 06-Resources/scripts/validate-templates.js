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
var import_child_process = require("child_process");
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
function listTrackedMarkdown(root) {
  try {
    const output = (0, import_child_process.execFileSync)("git", ["ls-files", "-z", "--", "*.md"], {
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
function validateAllNotes() {
  console.log("\u{1F4CB} Vault Metadata Validation Report");
  console.log("=".repeat(40));
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
  console.log("=".repeat(40));
  if (allValid) {
    console.log("\u{1F389} All notes are properly structured!");
  } else {
    console.log("\u26A0\uFE0F Some notes need attention");
  }
  return allValid;
}
if (!validateAllNotes()) {
  process.exitCode = 1;
}
