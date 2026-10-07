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

// 06-Resources/scripts/src/vault-hygiene.ts
var vault_hygiene_exports = {};
__export(vault_hygiene_exports, {
  auditVaultHygiene: () => auditVaultHygiene,
  main: () => main
});
module.exports = __toCommonJS(vault_hygiene_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_child_process = require("child_process");

// 06-Resources/scripts/src/lib/links.ts
function parseAliases(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch)
    return [];
  const fm = fmMatch[1];
  const aliasesMatch = fm.match(/^aliases:\s*(.*)$/m);
  if (!aliasesMatch)
    return [];
  const raw = aliasesMatch[1].trim();
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  const listMatches = fm.match(/^aliases:\s*\r?\n((?:\s*-\s*.*(?:\r?\n|$))+)/m);
  if (listMatches) {
    return listMatches[1].split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  return raw ? [raw.replace(/^["']|["']$/g, "")] : [];
}
function extractWikilinks(content) {
  const links = [];
  const lines = content.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    const strippedLine = line.replace(/`[^`]+`/g, " ");
    const matches = strippedLine.matchAll(/!?\[\[([^\[\]]+)\]\]/g);
    for (const match of matches) {
      const raw = match[0];
      const inner = match[1].trim();
      const cleanInner = inner.replace(/\\\|/g, "|");
      const targetOnly = cleanInner.split("|")[0].split("#")[0].trim();
      if (targetOnly && targetOnly !== "|" && targetOnly !== "#") {
        links.push({
          target: targetOnly.replace(/\.md$/i, ""),
          raw,
          line: i + 1
        });
      }
    }
  }
  return links;
}

// 06-Resources/scripts/src/vault-hygiene.ts
var REVIEW_TYPES = /* @__PURE__ */ new Set(["project", "learning", "concept", "personal"]);
var REVIEW_CYCLES = /* @__PURE__ */ new Set(["14d", "30d", "90d"]);
var NOTE_FOLDERS = /* @__PURE__ */ new Set([
  "00-Inbox",
  "01-Daily",
  "02-Projects",
  "03-Dev",
  "04-Learning",
  "05-Personal",
  "06-Resources",
  "07-Reviews",
  "08-Concepts",
  "99-Attachments"
]);
var FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
var QUERY_BLOCK = /```dataview(?:js)?[ \t]*\r?\n([\s\S]*?)```/g;
var FROM_SCOPE = /FROM\s+"([^"]*)"/g;
function frontmatterOf(content) {
  const match = content.match(FRONTMATTER);
  return match ? match[1] : null;
}
function fieldOf(block, key) {
  if (block === null)
    return "";
  const match = block.match(new RegExp("^" + key + ":[ \\t]*([^\\r\\n]*)$", "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "").trim() : "";
}
function isNoteCandidate(rel) {
  if (rel === "Home.md")
    return true;
  return NOTE_FOLDERS.has(rel.split("/")[0]);
}
function walkMarkdown(root, prefix) {
  const skipped = /* @__PURE__ */ new Set([".git", ".obsidian", "node_modules"]);
  const found = [];
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, prefix), { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (prefix === "" && skipped.has(entry.name))
      continue;
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory())
      found.push(...walkMarkdown(root, rel));
    else if (entry.name.endsWith(".md"))
      found.push(rel);
  }
  return found;
}
function enumerate(root, includeIgnored) {
  if (!includeIgnored) {
    try {
      const output = (0, import_child_process.execFileSync)("git", ["ls-files", "-z", "--", "*.md"], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        // git prints `fatal: not a git repository` to stderr when there is none, and that
        // message is not a finding — the fallback below is the answer, not an error.
        stdio: ["ignore", "pipe", "ignore"]
      });
      return { files: output.split("\0").filter((file) => file.length > 0).sort(), source: "tracked" };
    } catch {
      console.log(`\u26A0\uFE0F git enumeration unavailable under ${root}; walking the filesystem instead`);
    }
  }
  return { files: walkMarkdown(root, "").sort(), source: "filesystem" };
}
function hubScopes(read, files) {
  const scopes = /* @__PURE__ */ new Set();
  for (const rel of files) {
    if (rel.startsWith("99-Templates/"))
      continue;
    if (!path.basename(rel).startsWith("_"))
      continue;
    for (const block of read(rel).matchAll(QUERY_BLOCK)) {
      for (const from of block[1].matchAll(FROM_SCOPE)) {
        const scope = from[1].replace(/\/+$/, "");
        if (scope !== "")
          scopes.add(scope);
      }
    }
  }
  return [...scopes];
}
function isCovered(rel, scopes) {
  return scopes.some(
    (scope) => scope === "" || rel === scope || rel.startsWith(`${scope}/`)
  );
}
function auditVaultHygiene(root, options = {}) {
  const { files, source } = enumerate(root, options.includeIgnored === true);
  const candidates = [];
  for (const rel of files) {
    if (!isNoteCandidate(rel))
      continue;
    let content;
    try {
      content = fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue;
    }
    candidates.push({ rel, content, block: frontmatterOf(content) });
  }
  const unclassified = [];
  const missingReviewMetadata = [];
  const reviewCycleOutsideSchema = [];
  for (const { rel, block } of candidates) {
    const type = fieldOf(block, "type");
    if (type === "") {
      unclassified.push(rel);
      continue;
    }
    if (!REVIEW_TYPES.has(type))
      continue;
    const missing = [];
    if (fieldOf(block, "last_reviewed") === "")
      missing.push("last_reviewed");
    const cycle = fieldOf(block, "review_cycle");
    if (cycle === "")
      missing.push("review_cycle");
    else if (!REVIEW_CYCLES.has(cycle))
      reviewCycleOutsideSchema.push(rel);
    if (missing.length > 0)
      missingReviewMetadata.push({ path: rel, missing });
  }
  const incoming = /* @__PURE__ */ new Map();
  const names = /* @__PURE__ */ new Map();
  for (const { rel, content } of candidates) {
    const base = path.basename(rel, ".md");
    for (const key of [base, rel, rel.slice(0, -3)])
      names.set(key.toLowerCase(), base.toLowerCase());
    for (const alias of parseAliases(content))
      names.set(alias.toLowerCase(), base.toLowerCase());
    incoming.set(base.toLowerCase(), incoming.get(base.toLowerCase()) ?? 0);
  }
  for (const { content } of candidates) {
    for (const link of extractWikilinks(content)) {
      const target = names.get(link.target.toLowerCase());
      if (target !== void 0)
        incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
  }
  const contentByPath = new Map(candidates.map((candidate) => [candidate.rel, candidate.content]));
  const scopes = hubScopes((rel) => contentByPath.get(rel) ?? "", candidates.map((c) => c.rel));
  const noIncomingLinks = [];
  const dynamicMocOnly = [];
  for (const { rel } of candidates) {
    const base = path.basename(rel, ".md");
    if ((incoming.get(base.toLowerCase()) ?? 0) > 0)
      continue;
    if (base.startsWith("_"))
      continue;
    if (rel === "Home.md")
      continue;
    if (isCovered(rel, scopes))
      dynamicMocOnly.push(rel);
    else
      noIncomingLinks.push(rel);
  }
  return {
    root,
    source,
    scanned: candidates.length,
    unclassified,
    missingReviewMetadata,
    reviewCycleOutsideSchema,
    noIncomingLinks,
    dynamicMocOnly
  };
}
function main() {
  const argv = process.argv.slice(2);
  const includeIgnored = argv.includes("--include-ignored");
  const isStrict = argv.includes("--strict");
  const root = process.cwd();
  const report = auditVaultHygiene(root, { includeIgnored });
  console.log("\u{1FA7A} Vault Hygiene Report");
  console.log("=".repeat(40));
  console.log(`\u{1F4C2} Vault Root: ${report.root}`);
  console.log(
    `\u{1F5C2}\uFE0F  Source: ${report.source === "tracked" ? "tracked index (ignored local content excluded; pass --include-ignored to add it)" : "filesystem walk (ignored local content included)"}`
  );
  console.log(`\u{1F50D} Scanned ${report.scanned} note(s) in the vault note folders
`);
  console.log(`\u{1F4CB} UNCLASSIFIED RECORDS \u2014 no \`type\` in frontmatter (${report.unclassified.length})`);
  if (report.unclassified.length === 0)
    console.log("   \u2705 None.");
  else
    for (const file of report.unclassified)
      console.log(`   - ${file}`);
  console.log("");
  console.log(`\u{1F552} MISSING REVIEW METADATA (${report.missingReviewMetadata.length})`);
  console.log("   Required by the canonical guide for: project, learning, concept, personal.");
  console.log("   A blank field is not listed by the MOC queries, so these notes never surface as due.");
  if (report.missingReviewMetadata.length === 0)
    console.log("   \u2705 None.");
  else {
    for (const gap of report.missingReviewMetadata) {
      console.log(`   - ${gap.path}: missing ${gap.missing.join(", ")}`);
    }
  }
  console.log("");
  console.log(`\u{1F9ED} REACHABILITY \u2014 literal backlinks vs hub scope (${report.noIncomingLinks.length + report.dynamicMocOnly.length})`);
  console.log("   A literal-link orphan count cannot see a note a hub tries to list through a dynamic");
  console.log("   query, so the two are reported apart. The queries are NOT evaluated here: the");
  console.log("   first bucket means the note sits inside a hub's FROM scope \u2014 not that the hub's");
  console.log("   result contains it.");
  console.log(`   - Inside a hub's declared FROM scope, no literal backlink (${report.dynamicMocOnly.length})`);
  for (const file of report.dynamicMocOnly)
    console.log(`     - ${file}`);
  console.log(`   - Outside every hub's FROM scope \u2014 no hub names its folder (${report.noIncomingLinks.length})`);
  for (const file of report.noIncomingLinks)
    console.log(`     - ${file}`);
  console.log("");
  if (report.reviewCycleOutsideSchema.length > 0) {
    console.log(`\u{1F501} SPECIMEN: review_cycle outside the schema (${report.reviewCycleOutsideSchema.length})`);
    console.log(`   The schema accepts exactly: ${[...REVIEW_CYCLES].join(", ")}`);
    for (const file of report.reviewCycleOutsideSchema)
      console.log(`   - ${file}`);
    console.log("");
  }
  console.log("=".repeat(40));
  const findings = report.unclassified.length + report.missingReviewMetadata.length + report.noIncomingLinks.length + report.reviewCycleOutsideSchema.length;
  console.log(`\u{1FA7A} ${findings} finding(s). This report is read-only and changed nothing.`);
  if (isStrict && findings > 0) {
    console.error("\u274C Strict hygiene report failed: findings exist.");
    process.exitCode = 1;
  }
}
if (require.main === module) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  auditVaultHygiene,
  main
});
