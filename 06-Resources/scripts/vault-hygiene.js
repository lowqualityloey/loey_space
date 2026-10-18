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
  auditRot: () => auditRot,
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
var QUERY_BLOCK = /```dataview(js)?[ \t]*\r?\n([\s\S]*?)```/g;
var DV_PAGES_CALL = /dv\.pages\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)\s*\)/g;
var DV_PAGES_ANY = /dv\.pages\s*\(/g;
var QUOTED_PATH = /"([^"]*)"/g;
var NON_PATH_SOURCE = /(^|[\s(])[#[]/;
var FROM_CLAUSE = /(?:^|\b(?:LIST|TABLE|TASK|CALENDAR)\b[^\n]*?)FROM[ \t]+(\S[^\n]*)$/gm;
var FROM_TAIL_CUT = /\b(?:WHERE|SORT|GROUP|FLATTEN|LIMIT|TABLE|LIST|TASK|CALENDAR)\b[\s\S]*$/i;
var DV_QUERY_ANY = /\bdv\.(?:tryQuery|tryQueryMarkdown|query)\s*\(/;
var INTERPOLATED = /\$\{/;
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
function isAttachmentArtifact(rel) {
  return rel.startsWith("99-Attachments/");
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
function fromOperands(clause) {
  const operands = [];
  let current = "";
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < clause.length; index++) {
    const char = clause[index];
    if (char === '"')
      quoted = !quoted;
    if (!quoted) {
      if (char === "(" || char === "[")
        depth++;
      else if (char === ")" || char === "]")
        depth = Math.max(0, depth - 1);
      const join2 = depth === 0 ? clause.slice(index).match(/^(?:\s+(?:AND|OR)\s+|,\s*)/i) : null;
      if (join2) {
        operands.push(current);
        current = "";
        index += join2[0].length - 1;
        continue;
      }
    }
    current += char;
  }
  operands.push(current);
  return operands.map((operand) => operand.trim()).filter((operand) => operand !== "");
}
function fromClauseSources(clause) {
  const scopes = [];
  let positives = 0;
  let exclusions = 0;
  let unresolved = false;
  for (const operand of fromOperands(clause)) {
    const negated = operand.startsWith("!");
    const source = (negated ? operand.slice(1) : operand).trim();
    if (negated)
      exclusions++;
    else
      positives++;
    const quoted = source.match(/^"([\s\S]*)"$/);
    if (!quoted) {
      unresolved = true;
      continue;
    }
    const scope = quoted[1].replace(/\/+$/, "");
    if (scope === "")
      continue;
    if (INTERPOLATED.test(scope) || scope.startsWith("#")) {
      unresolved = true;
      continue;
    }
    if (!negated)
      scopes.push(scope);
  }
  if (positives === 0 && exclusions > 0)
    unresolved = true;
  return { scopes, unresolved };
}
function sourcesOf(content) {
  const scopes = /* @__PURE__ */ new Set();
  let unresolved = false;
  for (const block of content.matchAll(QUERY_BLOCK)) {
    const isDataviewJs = block[1] === "js";
    const body = block[2];
    if (isDataviewJs) {
      if (DV_QUERY_ANY.test(body))
        unresolved = true;
    } else {
      for (const from of body.matchAll(FROM_CLAUSE)) {
        const clause = from[1].replace(FROM_TAIL_CUT, "");
        const sources = fromClauseSources(clause);
        for (const scope of sources.scopes)
          scopes.add(scope);
        if (sources.unresolved)
          unresolved = true;
      }
    }
    const calls = body.match(DV_PAGES_ANY) ?? [];
    let resolvedCalls = 0;
    for (const call of body.matchAll(DV_PAGES_CALL)) {
      resolvedCalls++;
      const literal = call[1] ?? call[2] ?? call[3] ?? "";
      if (INTERPOLATED.test(literal)) {
        unresolved = true;
        continue;
      }
      if (NON_PATH_SOURCE.test(literal)) {
        unresolved = true;
        continue;
      }
      let found = 0;
      for (const quoted of literal.matchAll(QUOTED_PATH)) {
        const scope = quoted[1].replace(/\/+$/, "");
        if (scope === "" || scope.startsWith("#"))
          continue;
        scopes.add(scope);
        found++;
      }
      if (found === 0)
        unresolved = true;
    }
    if (calls.length > resolvedCalls)
      unresolved = true;
  }
  return { scopes: [...scopes], unresolved };
}
function hubScopes(read, files) {
  const scopes = /* @__PURE__ */ new Set();
  const unresolvedHubs = [];
  for (const rel of files) {
    if (rel.startsWith("99-Templates/"))
      continue;
    if (!path.basename(rel).startsWith("_"))
      continue;
    const sources = sourcesOf(read(rel));
    for (const scope of sources.scopes)
      scopes.add(scope);
    if (sources.unresolved)
      unresolvedHubs.push(rel);
  }
  return { scopes: [...scopes], unresolvedHubs };
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
    if (isAttachmentArtifact(rel))
      continue;
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
  const { scopes, unresolvedHubs } = hubScopes(
    (rel) => contentByPath.get(rel) ?? "",
    candidates.map((c) => c.rel)
  );
  const noIncomingLinks = [];
  const dynamicMocOnly = [];
  const reachabilityUnknown = [];
  for (const { rel } of candidates) {
    const base = path.basename(rel, ".md");
    if ((incoming.get(base.toLowerCase()) ?? 0) > 0)
      continue;
    if (base.startsWith("_"))
      continue;
    if (rel === "Home.md")
      continue;
    if (isAttachmentArtifact(rel))
      continue;
    if (isCovered(rel, scopes))
      dynamicMocOnly.push(rel);
    else if (unresolvedHubs.length > 0)
      reachabilityUnknown.push(rel);
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
    dynamicMocOnly,
    reachabilityUnknown,
    unresolvedHubs
  };
}
var CYCLE_DAYS = {
  "14d": 14,
  "30d": 30,
  "90d": 90
};
function parseIsoDateUtc(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    return null;
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}
function auditRot(root, options = {}) {
  const referenceDate = options.today ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const refMs = parseIsoDateUtc(referenceDate) ?? Date.now();
  const maxLines = options.maxMemoryLines ?? 200;
  const maxBytes = options.maxMemoryBytes ?? 8192;
  const warnLines = Math.floor(maxLines * 0.75);
  const warnBytes = Math.floor(maxBytes * 0.75);
  const memPath = path.join(root, "memory.md");
  let memoryBudget = {
    present: false,
    lines: 0,
    bytes: 0,
    maxLines,
    maxBytes,
    warnLines,
    warnBytes,
    overThreshold: false,
    hasRoutingRule: false
  };
  try {
    const raw = fs.readFileSync(memPath, "utf8");
    const bytes = Buffer.byteLength(raw, "utf8");
    const lines = raw.split(/\r?\n/).length;
    const hasRoutingRule = /Core Memory Rule\**\s*:/i.test(raw);
    memoryBudget = {
      present: true,
      lines,
      bytes,
      maxLines,
      maxBytes,
      warnLines,
      warnBytes,
      overThreshold: lines >= warnLines || bytes >= warnBytes,
      hasRoutingRule
    };
  } catch {
  }
  const { files } = enumerate(root, options.includeIgnored === true);
  const overdueReviews = [];
  for (const rel of files) {
    if (!isNoteCandidate(rel))
      continue;
    let content;
    try {
      content = fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue;
    }
    const block = frontmatterOf(content);
    const type = fieldOf(block, "type");
    if (!REVIEW_TYPES.has(type))
      continue;
    const status = fieldOf(block, "status");
    if (status === "archived" || status === "completed")
      continue;
    const lastReviewed = fieldOf(block, "last_reviewed");
    const cycle = fieldOf(block, "review_cycle");
    const cycleDays = CYCLE_DAYS[cycle];
    const reviewedMs = parseIsoDateUtc(lastReviewed);
    if (!cycleDays || reviewedMs === null)
      continue;
    const elapsedDays = Math.floor((refMs - reviewedMs) / (1e3 * 60 * 60 * 24));
    if (elapsedDays > cycleDays) {
      overdueReviews.push({
        path: rel,
        daysOverdue: elapsedDays - cycleDays
      });
    }
  }
  const skillGaps = [];
  const skillsDir = path.join(root, ".agents", "skills");
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory())
        continue;
      const rel = `.agents/skills/${entry.name}/SKILL.md`;
      const abs = path.join(root, rel);
      let content;
      try {
        content = fs.readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      const block = frontmatterOf(content);
      const missing = [];
      if (fieldOf(block, "version") === "")
        missing.push("version");
      if (fieldOf(block, "pinned") === "")
        missing.push("pinned");
      if (fieldOf(block, "status") === "deprecated" && fieldOf(block, "absorbed_by") === "") {
        missing.push("absorbed_by");
      }
      if (!/^##\s+.*Regression Cases/m.test(content)) {
        missing.push("regression_cases");
      }
      if (missing.length > 0) {
        skillGaps.push({ path: rel, missing });
      }
    }
  } catch {
  }
  return {
    referenceDate,
    memoryBudget,
    overdueReviews,
    skillGaps
  };
}
function main() {
  const argv = process.argv.slice(2);
  const includeIgnored = argv.includes("--include-ignored");
  const isStrict = argv.includes("--strict");
  const checkRot = argv.includes("--check-rot");
  const todayIdx = argv.indexOf("--today");
  const todayOpt = todayIdx !== -1 && argv[todayIdx + 1] ? argv[todayIdx + 1] : void 0;
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
  const reachTotal = report.dynamicMocOnly.length + report.noIncomingLinks.length + report.reachabilityUnknown.length;
  console.log(`\u{1F9ED} REACHABILITY \u2014 literal backlinks vs hub scope (${reachTotal})`);
  console.log("   A literal-link orphan count cannot see a note a hub tries to list through a dynamic");
  console.log("   query, so the two are reported apart. The queries are NOT evaluated here: the");
  console.log("   first bucket means the note sits inside a hub's declared scope \u2014 a FROM path or a");
  console.log("   literal dv.pages folder \u2014 not that the hub's result contains it.");
  console.log(`   - Inside a hub's declared scope, no literal backlink (${report.dynamicMocOnly.length})`);
  for (const file of report.dynamicMocOnly)
    console.log(`     - ${file}`);
  if (report.reachabilityUnknown.length > 0) {
    console.log(`   - Reachability unknown \u2014 a hub declares a source this report cannot resolve (${report.reachabilityUnknown.length})`);
    for (const hub of report.unresolvedHubs)
      console.log(`     \xB7 unresolved hub: ${hub}`);
    for (const file of report.reachabilityUnknown)
      console.log(`     - ${file}`);
  }
  console.log(`   - Outside every hub's declared scope \u2014 no hub names its folder (${report.noIncomingLinks.length})`);
  for (const file of report.noIncomingLinks)
    console.log(`     - ${file}`);
  console.log("");
  if (report.unresolvedHubs.length > 0) {
    console.log(`\u{1F517} UNRESOLVED HUB SOURCES (${report.unresolvedHubs.length})`);
    console.log("   These hubs name a source this report cannot read \u2014 a tag or link, a FROM operand");
    console.log("   that is a function or an exclusion, a computed string, or a dv.pages argument that is");
    console.log("   not a literal. The queries were never evaluated, so a note outside every declared");
    console.log("   scope reads as unknown rather than as an orphan (\u201Cno hub names its folder\u201D is");
    console.log("   advisory while this section is non-empty).");
    for (const hub of report.unresolvedHubs)
      console.log(`   - ${hub}`);
    console.log("");
  }
  if (report.reviewCycleOutsideSchema.length > 0) {
    console.log(`\u{1F501} SPECIMEN: review_cycle outside the schema (${report.reviewCycleOutsideSchema.length})`);
    console.log(`   The schema accepts exactly: ${[...REVIEW_CYCLES].join(", ")}`);
    for (const file of report.reviewCycleOutsideSchema)
      console.log(`   - ${file}`);
    console.log("");
  }
  let rotFindings = 0;
  if (checkRot) {
    const rot = auditRot(root, { includeIgnored, today: todayOpt });
    const mem = rot.memoryBudget;
    console.log("\u{1F9E0} CORE MEMORY BUDGET & ANTI-ROT");
    if (!mem.present) {
      console.log("   \u2139\uFE0F  Local memory record not present (fresh clone or external).");
    } else {
      const linePct = Math.round(mem.lines / mem.maxLines * 100);
      const bytePct = Math.round(mem.bytes / mem.maxBytes * 100);
      console.log(`   - Capacity: ${mem.lines}/${mem.maxLines} lines (${linePct}%), ${mem.bytes}/${mem.maxBytes} bytes (${bytePct}%)`);
      console.log(`   - Routing invariant header: ${mem.hasRoutingRule ? "\u2705 present" : "\u26A0\uFE0F missing"}`);
      if (mem.overThreshold) {
        console.log("   \u26A0\uFE0F  Memory exceeds 75% warning threshold \u2014 offload infra/system details to 06-Resources/.");
        rotFindings++;
      }
      if (!mem.hasRoutingRule) {
        rotFindings++;
      }
    }
    console.log("");
    console.log(`\u23F3 OVERDUE REVIEWS as of ${rot.referenceDate} (${rot.overdueReviews.length})`);
    if (rot.overdueReviews.length === 0)
      console.log("   \u2705 None.");
    else {
      for (const item of rot.overdueReviews) {
        console.log(`   - ${item.path} (${item.daysOverdue}d overdue)`);
      }
      rotFindings += rot.overdueReviews.length;
    }
    console.log("");
    console.log(`\u{1F6E1}\uFE0F  SKILL ANTI-ROT GUARDRAILS (${rot.skillGaps.length})`);
    if (rot.skillGaps.length === 0)
      console.log("   \u2705 All skills carry version, pinned, and regression cases.");
    else {
      for (const gap of rot.skillGaps) {
        console.log(`   - ${gap.path}: missing ${gap.missing.join(", ")}`);
      }
      rotFindings += rot.skillGaps.length;
    }
    console.log("");
  }
  console.log("=".repeat(40));
  const findings = report.unclassified.length + report.missingReviewMetadata.length + report.noIncomingLinks.length + report.reviewCycleOutsideSchema.length + rotFindings;
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
  auditRot,
  auditVaultHygiene,
  main
});
