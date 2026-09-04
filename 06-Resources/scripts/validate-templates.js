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
var templatesPath = resolveTemplatesPath();
var expectedProperties = {
  "project": ["created", "updated", "type", "status", "priority", "area", "tags"],
  "learning": ["created", "updated", "type", "status", "area", "tags"],
  "snippet": ["created", "updated", "type", "status", "area", "tags"],
  "resource": ["created", "updated", "type", "status", "area", "tags"],
  "concept": ["created", "updated", "type", "status", "area", "tags"],
  "daily": ["created", "updated", "type", "area", "tags"],
  "personal": ["created", "updated", "type", "status", "area", "tags"],
  "review": ["created", "updated", "type", "status", "area", "tags"],
  "triage": ["created", "updated", "type", "status", "area", "priority", "tags"]
};
var requiredTagNamespaces = ["type", "area", "status"];
function validateTemplate(templateName, content) {
  console.log(`
\u{1F50D} Validating ${templateName}...`);
  const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!yamlMatch) {
    console.log("\u274C Missing YAML frontmatter");
    return false;
  }
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
        props[key] = value.trim() || true;
        if (key === "tags") {
          inTags = true;
        }
      }
    }
  }
  const type = (typeof props.type === "string" ? props.type : "") || "unknown";
  const expected = expectedProperties[type] || [];
  let isValid = true;
  for (const prop of expected) {
    if (!props[prop]) {
      console.log(`\u274C Missing property: ${prop}`);
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
      console.log(`\u26A0\uFE0F Missing ${namespace}/* tag`);
    }
  }
  if (!content.includes('<% tp.date.now("YYYY-MM-DD") %>')) {
    console.log("\u26A0\uFE0F Missing dynamic date template");
  }
  if (isValid) {
    console.log(`\u2705 ${templateName} passes validation`);
  }
  return isValid;
}
function validateAllTemplates() {
  console.log("\u{1F4CB} Template Validation Report");
  console.log("=".repeat(40));
  try {
    const files = fs.readdirSync(templatesPath);
    let allValid = true;
    for (const file of files) {
      if (file.endsWith(".md")) {
        const content = fs.readFileSync(path.join(templatesPath, file), "utf8");
        const isValid = validateTemplate(file, content);
        allValid = allValid && isValid;
      }
    }
    console.log("\n" + "=".repeat(40));
    if (allValid) {
      console.log("\u{1F389} All templates are properly structured!");
    } else {
      console.log("\u26A0\uFE0F Some templates need attention");
    }
    return allValid;
  } catch (error) {
    console.error("\u274C Error reading templates:", error?.message || error);
    return false;
  }
}
validateAllTemplates();
