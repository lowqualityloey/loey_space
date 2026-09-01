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

// 06-Resources/scripts/src/audit-links.ts
var audit_links_exports = {};
__export(audit_links_exports, {
  auditVaultLinks: () => auditVaultLinks,
  extractWikilinks: () => extractWikilinks,
  main: () => main,
  parseAliases: () => parseAliases
});
module.exports = __toCommonJS(audit_links_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function findVaultRoot() {
  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(current, ".obsidian")) || fs.existsSync(path.join(current, "06-Resources"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current)
      break;
    current = parent;
  }
  return process.cwd();
}
function levenshteinDistance(a, b) {
  const an = a.length;
  const bn = b.length;
  if (an === 0)
    return bn;
  if (bn === 0)
    return an;
  const matrix = [];
  for (let i = 0; i <= bn; ++i)
    matrix[i] = [i];
  for (let i = 0; i <= an; ++i)
    matrix[0][i] = i;
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}
function findFuzzyMatch(target, candidates) {
  const lowerTarget = target.toLowerCase();
  let bestCandidate;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const lowerCandidate = candidate.toLowerCase();
    if (lowerCandidate === lowerTarget)
      return candidate;
    if (lowerCandidate.includes(lowerTarget) || lowerTarget.includes(lowerCandidate)) {
      if (bestDistance > 2) {
        bestDistance = 2;
        bestCandidate = candidate;
      }
    }
    const dist = levenshteinDistance(lowerTarget, lowerCandidate);
    if (dist < bestDistance && dist <= 3) {
      bestDistance = dist;
      bestCandidate = candidate;
    }
  }
  return bestCandidate;
}
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
function auditVaultLinks(vaultRoot) {
  const IGNORED_DIRS = /* @__PURE__ */ new Set([
    ".git",
    ".obsidian",
    ".trash",
    ".agents",
    ".smart-env",
    ".claudian",
    ".secrets",
    "node_modules",
    "dist"
  ]);
  const notes = /* @__PURE__ */ new Map();
  const attachments = /* @__PURE__ */ new Set();
  const noteLookup = /* @__PURE__ */ new Map();
  const allTargetNames = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(vaultRoot, fullPath).replace(/\\/g, "/");
        if (entry.name.endsWith(".md")) {
          const basename = entry.name.slice(0, -3);
          const content = fs.readFileSync(fullPath, "utf8");
          const aliases = parseAliases(content);
          const outgoingLinks = extractWikilinks(content);
          notes.set(relPath, {
            relativePath: relPath,
            basename,
            aliases,
            outgoingLinks
          });
          noteLookup.set(basename.toLowerCase(), basename);
          noteLookup.set(relPath.toLowerCase(), basename);
          noteLookup.set(relPath.slice(0, -3).toLowerCase(), basename);
          allTargetNames.push(basename);
          for (const alias of aliases) {
            noteLookup.set(alias.toLowerCase(), basename);
            allTargetNames.push(alias);
          }
        } else {
          attachments.add(entry.name.toLowerCase());
          attachments.add(relPath.toLowerCase());
          allTargetNames.push(entry.name);
        }
      }
    }
  }
  walk(vaultRoot);
  const incomingBacklinks = /* @__PURE__ */ new Map();
  for (const [, note] of notes) {
    incomingBacklinks.set(note.basename.toLowerCase(), 0);
  }
  const brokenLinks = [];
  let totalLinks = 0;
  for (const [relPath, note] of notes) {
    if (relPath.startsWith("99-Templates/"))
      continue;
    for (const link of note.outgoingLinks) {
      totalLinks++;
      const lowerTarget = link.target.toLowerCase();
      const resolvesToNote = noteLookup.has(lowerTarget);
      const resolvesToAttachment = attachments.has(lowerTarget) || attachments.has(link.target.toLowerCase());
      if (resolvesToNote) {
        const canonical = noteLookup.get(lowerTarget);
        incomingBacklinks.set(canonical.toLowerCase(), (incomingBacklinks.get(canonical.toLowerCase()) || 0) + 1);
      } else if (!resolvesToAttachment) {
        const suggestion = findFuzzyMatch(link.target, allTargetNames);
        brokenLinks.push({
          sourceFile: relPath,
          line: link.line,
          rawLink: link.raw,
          target: link.target,
          suggestion
        });
      }
    }
  }
  const orphanNotes = [];
  for (const [relPath, note] of notes) {
    if (relPath.startsWith("99-Templates/") || relPath.startsWith("00-Inbox/Archives/") || note.basename.startsWith("_") || note.basename === "Home" || relPath === "README.md" || relPath === "AGENTS.md") {
      continue;
    }
    const count = incomingBacklinks.get(note.basename.toLowerCase()) || 0;
    if (count === 0) {
      orphanNotes.push(relPath);
    }
  }
  return {
    totalNotes: notes.size,
    totalAttachments: attachments.size,
    totalLinks,
    brokenLinks,
    orphanNotes
  };
}
function main() {
  const vaultRoot = findVaultRoot();
  const isStrict = process.argv.includes("--strict");
  console.log("\u{1F50D} Auditing Vault Wikilinks & Backlink Graph...");
  console.log(`\u{1F4C2} Vault Root: ${vaultRoot}
`);
  const report = auditVaultLinks(vaultRoot);
  console.log("========================================");
  console.log("\u{1F4CA} Vault Link Audit Report");
  console.log("========================================");
  console.log(`\u{1F4DD} Total Markdown Notes:  ${report.totalNotes}`);
  console.log(`\u{1F4CE} Total Attachments:     ${report.totalAttachments}`);
  console.log(`\u{1F517} Total Wikilinks Read:  ${report.totalLinks}`);
  console.log("----------------------------------------");
  if (report.brokenLinks.length === 0) {
    console.log("\u2705 No broken wikilinks found! All targets resolve cleanly.\n");
  } else {
    console.log(`\u26A0\uFE0F  Found ${report.brokenLinks.length} uncreated/broken link target(s):
`);
    for (const b of report.brokenLinks) {
      const suggestStr = b.suggestion ? ` -> Suggestion: [[${b.suggestion}]]` : "";
      console.log(`  \u274C ${b.sourceFile}:${b.line} -> ${b.rawLink}${suggestStr}`);
    }
    console.log("");
  }
  if (report.orphanNotes.length === 0) {
    console.log("\u2705 No orphaned notes detected! All notes have incoming backlinks.\n");
  } else {
    console.log(`\u{1F7E1} Found ${report.orphanNotes.length} orphan note(s) (0 incoming links):
`);
    for (const orphan of report.orphanNotes.slice(0, 25)) {
      console.log(`  - ${orphan}`);
    }
    if (report.orphanNotes.length > 25) {
      console.log(`  ...and ${report.orphanNotes.length - 25} more orphan notes.`);
    }
    console.log("");
  }
  console.log("========================================");
  if (isStrict && report.brokenLinks.length > 0) {
    console.error("\u274C Strict audit failed: Broken links exist in vault.");
    process.exit(1);
  }
  console.log("\u{1F389} Audit finished successfully!");
}
if (require.main === module) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  auditVaultLinks,
  extractWikilinks,
  main,
  parseAliases
});
