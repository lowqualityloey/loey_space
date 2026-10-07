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

// 06-Resources/scripts/src/audit-links.ts
var TEMPLATE_DIR = "99-Templates";
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
function candidatePaths(sourceRel, target) {
  const stem = target.replace(/\.md$/i, "");
  const candidates = /* @__PURE__ */ new Set();
  const add = (base) => {
    candidates.add(base);
    candidates.add(`${base}.md`);
  };
  add(stem);
  const folder = path.posix.dirname(sourceRel);
  if (!target.includes("/") && folder !== ".")
    add(`${folder}/${stem}`);
  return [...candidates];
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
function auditVaultLinks(vaultRoot) {
  const includedDirs = [];
  const excludedDirs = [];
  for (const entry of fs.readdirSync(vaultRoot, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue;
    if (isEngineeringDir(entry.name, true))
      excludedDirs.push(entry.name);
    else
      includedDirs.push(entry.name);
  }
  includedDirs.sort();
  excludedDirs.sort();
  const scope = {
    knowledge: includedDirs.filter((dir) => dir !== TEMPLATE_DIR),
    templates: includedDirs.filter((dir) => dir === TEMPLATE_DIR),
    rootNotes: true,
    excluded: excludedDirs
  };
  const notes = /* @__PURE__ */ new Map();
  const attachmentFiles = /* @__PURE__ */ new Set();
  const attachmentKeys = /* @__PURE__ */ new Set();
  const noteLookup = /* @__PURE__ */ new Map();
  const allTargetNames = [];
  function walk(dir, atRoot) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!isEngineeringDir(entry.name, atRoot)) {
          walk(path.join(dir, entry.name), false);
        }
      } else if (entry.isFile()) {
        if (entry.name.startsWith("."))
          continue;
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
          attachmentFiles.add(relPath.toLowerCase());
          attachmentKeys.add(entry.name.toLowerCase());
          attachmentKeys.add(relPath.toLowerCase());
          allTargetNames.push(entry.name);
        }
      }
    }
  }
  walk(vaultRoot, true);
  const incomingBacklinks = /* @__PURE__ */ new Map();
  for (const [, note] of notes) {
    incomingBacklinks.set(note.basename.toLowerCase(), 0);
  }
  const unresolved = [];
  let totalLinks = 0;
  for (const [relPath, note] of notes) {
    for (const link of note.outgoingLinks) {
      if (link.target.includes("<%"))
        continue;
      totalLinks++;
      const lowerTarget = link.target.toLowerCase();
      const resolvesToNote = noteLookup.has(lowerTarget);
      const resolvesToAttachment = attachmentKeys.has(lowerTarget);
      if (resolvesToNote) {
        const canonical = noteLookup.get(lowerTarget);
        incomingBacklinks.set(canonical.toLowerCase(), (incomingBacklinks.get(canonical.toLowerCase()) || 0) + 1);
      } else if (!resolvesToAttachment) {
        unresolved.push({ sourceFile: relPath, link });
      }
    }
  }
  const candidates = unresolved.flatMap((item) => candidatePaths(item.sourceFile, item.link.target));
  const repo = readRepoFacts(vaultRoot, candidates);
  const brokenLinks = [];
  const localOnlyLinks = [];
  for (const { sourceFile, link } of unresolved) {
    const trackedSource = repo.available && repo.trackedNotes.has(sourceFile);
    const targetIsIgnored = repo.available && candidatePaths(sourceFile, link.target).some((p) => repo.ignored.has(p));
    if (trackedSource && targetIsIgnored) {
      localOnlyLinks.push({ sourceFile, line: link.line, rawLink: link.raw, target: link.target });
      continue;
    }
    brokenLinks.push({
      sourceFile,
      line: link.line,
      rawLink: link.raw,
      target: link.target,
      suggestion: findFuzzyMatch(link.target, allTargetNames)
    });
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
    scope,
    reachability: "literal-wikilinks-only",
    totalNotes: notes.size,
    totalAttachments: attachmentFiles.size,
    totalLinks,
    brokenLinks,
    localOnlyLinks,
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
  const scopeLabel = `knowledge${report.scope.templates.length > 0 ? " + templates" : ""}` + (report.scope.rootNotes ? " + root notes" : "");
  const excludedLabel = report.scope.excluded.length > 0 ? report.scope.excluded.join(", ") : "none found";
  console.log(`\u{1F5C2}\uFE0F  Scope: ${scopeLabel}`);
  console.log(`   Excluded engineering/control-plane trees: ${excludedLabel}
`);
  console.log("========================================");
  console.log("\u{1F4CA} Vault Link Audit Report");
  console.log("========================================");
  console.log(`\u{1F4DD} Total Markdown Notes:  ${report.totalNotes}`);
  console.log(`\u{1F4CE} Total Attachments:     ${report.totalAttachments}`);
  console.log(`\u{1F517} Total Wikilinks Read:  ${report.totalLinks}`);
  console.log("----------------------------------------");
  if (report.brokenLinks.length === 0) {
    console.log("\u2705 No broken wikilinks found! Every target resolves, or points at content that");
    console.log("   is not in this checkout by design (see below).\n");
  } else {
    console.log(`\u26A0\uFE0F  Found ${report.brokenLinks.length} uncreated/broken link target(s):
`);
    for (const b of report.brokenLinks) {
      const suggestStr = b.suggestion ? ` -> Suggestion: [[${b.suggestion}]]` : "";
      console.log(`  \u274C ${b.sourceFile}:${b.line} -> ${b.rawLink}${suggestStr}`);
    }
    console.log("");
  }
  if (report.localOnlyLinks.length > 0) {
    console.log(
      `\u{1F517} ${report.localOnlyLinks.length} link target(s) point at local-only content (excluded by the repository's ignore rules):
`
    );
    for (const l of report.localOnlyLinks) {
      console.log(`  - ${l.sourceFile}:${l.line} -> ${l.rawLink}`);
    }
    console.log("");
  }
  console.log("   Reachability is measured from literal [[wikilinks]] only. Dataview/hub");
  console.log("   queries are not evaluated, so a note reached only by a query is not claimed");
  console.log("   to be displayed.\n");
  if (report.orphanNotes.length === 0) {
    console.log("\u2705 No notes are unreachable by literal wikilinks.\n");
  } else {
    console.log(
      `\u{1F7E1} Found ${report.orphanNotes.length} note(s) with no incoming literal wikilink:
`
    );
    for (const orphan of report.orphanNotes.slice(0, 25)) {
      console.log(`  - ${orphan}`);
    }
    if (report.orphanNotes.length > 25) {
      console.log(`  ...and ${report.orphanNotes.length - 25} more note(s).`);
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
