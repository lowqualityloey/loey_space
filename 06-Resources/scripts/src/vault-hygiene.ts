// Vault hygiene report (issue #52) — the question the metadata contract and the link
// graph both leave open.
//
// Three read-only reporters exist in this vault, and this is the third, so the boundary
// between them is deliberate and worth stating once here:
//
//   * `validate-templates.js` enforces the PUBLICATION contract. It enumerates
//     `git ls-files -z -- '*.md'` and checks every note that DECLARES a `type` against
//     that type's required fields. A note with no `type` is outside the contract by
//     design, and ignored local content is invisible to it because ignored files are not
//     in the index. Both of those are correct for a contract enforcer and both are holes
//     for a health check: a concept note that never declares a type, or that declares one
//     but never a `last_reviewed`, is silent everywhere.
//   * `audit-links.js` owns the GRAPH — broken wikilinks and literal orphan counts. Its
//     orphan count is a count of incoming WIKILINKS, so a note whose only path is a
//     Dataview query in a MOC reads as unreachable when it is not.
//   * this report answers: which records are unclassified, which carry a review type but
//     no review metadata, and which notes the graph genuinely cannot reach.
//
// Read-only, always. No file is opened for writing anywhere in this module, and the
// output prints paths and FIELD NAMES only — never a field value and never a note body
// (#51's sentinel rule). The one value the report quotes is the schema it holds notes to,
// which comes from the guide rather than from any note.
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
// Imported from `lib/links` rather than from `./audit-links` on purpose: a CJS esbuild
// bundle inlines both modules into one scope, so a `require.main === module` guard in an
// imported ENTRY file fires inside this bundle too. Sharing from `lib/` is what keeps
// `npm run hygiene` from printing the link audit first.
import { extractWikilinks, parseAliases } from './lib/links';

// Review metadata, transcribed from `06-Resources/Guides/Tagging & Properties.md`
// § "Required Fields by Type" (the "Review metadata" column). Exactly these four types
// carry it; the guide's table is the authority and this list must follow it.
const REVIEW_TYPES = new Set(['project', 'learning', 'concept', 'personal']);

// `review_cycle` accepts exactly three values. The guide records that `7d` appeared in an
// earlier draft but that no template and no script emits it, so it is not in the schema.
const REVIEW_CYCLES = new Set(['14d', '30d', '90d']);

// The folders that hold vault notes. Everything outside them (`docs/`, `README.md`,
// `AGENTS.md`, the skill files, the issue templates, `99-Templates/`) is structure or
// documentation rather than a record, so "declares no type" is not a finding there — which
// is the same line `validate-templates.js` draws, arrived at by scope instead of by rule.
//
// That single line is also what excludes the owner's two private cross-session records,
// `memory.md` and `handoff.md`, which sit at the vault root. `validate-templates.js` has to
// exempt those two BY PATH because it enumerates the whole index; here the root is already
// outside the note folders, so a second explicit list would be a rule that can never fire.
// A test cannot tell such a list apart from dead code, so there is not one: widening this
// set to every root-level `.md` is the mutation the exemption case exists to catch.
const NOTE_FOLDERS = new Set([
  '00-Inbox', '01-Daily', '02-Projects', '03-Dev', '04-Learning',
  '05-Personal', '06-Resources', '07-Reviews', '08-Concepts', '99-Attachments'
]);

// Frontmatter parsing is scoped to the `---` block on purpose. `readFrontmatterValue` in
// `lib/markdown.ts` falls back to the whole file when no block exists, which is right for
// its callers but wrong here: a note with no frontmatter would then be classified by any
// `type:` line in its prose. This report's whole job is to notice notes that declare
// NOTHING, so it must read the block or nothing.
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const QUERY_BLOCK = /```dataview(?:js)?[ \t]*\r?\n([\s\S]*?)```/g;
const FROM_SCOPE = /FROM\s+"([^"]*)"/g;

function frontmatterOf(content: string): string | null {
  const match = content.match(FRONTMATTER);
  return match ? match[1] : null;
}

function fieldOf(block: string | null, key: string): string {
  if (block === null) return '';
  const match = block.match(new RegExp('^' + key + ':[ \\t]*([^\\r\\n]*)$', 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '').trim() : '';
}

export interface ReviewGap {
  path: string;
  missing: string[];
}

export interface HygieneReport {
  root: string;
  source: 'tracked' | 'filesystem';
  scanned: number;
  unclassified: string[];
  missingReviewMetadata: ReviewGap[];
  reviewCycleOutsideSchema: string[];
  noIncomingLinks: string[];
  dynamicMocOnly: string[];
}

interface Candidate {
  rel: string;
  content: string;
  block: string | null;
}

function isNoteCandidate(rel: string): boolean {
  if (rel === 'Home.md') return true;
  return NOTE_FOLDERS.has(rel.split('/')[0]);
}

function walkMarkdown(root: string, prefix: string): string[] {
  const skipped = new Set(['.git', '.obsidian', 'node_modules']);
  const found: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(root, prefix), { withFileTypes: true });
  } catch {
    // An unreadable directory is not a finding and must not abort the report. A health
    // check that crashes on the first EACCES reports nothing at all.
    return found;
  }
  for (const entry of entries) {
    if (prefix === '' && skipped.has(entry.name)) continue;
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    // `isDirectory()` is false for a symlink, so a linked directory is skipped rather
    // than followed — that is both the desired scope and what makes a cycle impossible.
    if (entry.isDirectory()) found.push(...walkMarkdown(root, rel));
    else if (entry.name.endsWith('.md')) found.push(rel);
  }
  return found;
}

// The enumeration seam, and the only thing `--include-ignored` changes. Tracked-only is
// the default because it is what CI sees and what the publication contract covers;
// ignored content is the owner's own notes and is only read when explicitly asked for.
function enumerate(root: string, includeIgnored: boolean): { files: string[]; source: 'tracked' | 'filesystem' } {
  if (!includeIgnored) {
    try {
      const output = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        // git prints `fatal: not a git repository` to stderr when there is none, and that
        // message is not a finding — the fallback below is the answer, not an error.
        stdio: ['ignore', 'pipe', 'ignore']
      });
      return { files: output.split('\0').filter((file) => file.length > 0).sort(), source: 'tracked' };
    } catch {
      // Not a git worktree — an exported vault, or a test fixture. Fall through to the
      // walk, which reads MORE files rather than fewer, so it can only over-report.
      console.log(`⚠️ git enumeration unavailable under ${root}; walking the filesystem instead`);
    }
  }
  return { files: walkMarkdown(root, '').sort(), source: 'filesystem' };
}

// Hub coverage, read as a SCOPE and nothing more.
//
// A hub's RESULT cannot be computed without Dataview, so this deliberately does not try.
// What it reads is the one part of a hub that is a fact rather than an evaluation: the
// paths the `FROM` clause declares. Reading the hub's OWN FOLDER instead — the obvious
// first approximation — over-claims, and `06-Resources/_Resources MOC.md` is the proof:
// it sits in `06-Resources/` while its queries name only `06-Resources/Guides`,
// `06-Resources/Articles` and `06-Resources/APIs`, so a folder-level reading would report
// every note under `06-Resources/` as covered by a query that never mentions it.
//
// `FROM ""` is deliberately NOT a scope. It names no path, so it cannot be attributed to
// any note, and treating it as the whole vault would make the second bucket permanently
// empty and the report silently useless — this vault's only vault-wide query is
// `_Triage MOC`'s task scan (`FROM "" AND !"99-Templates"`), which lists notes by
// STATUS and so does not try to surface a note that carries no status at all. A scope is a
// path or it is nothing.
function hubScopes(read: (rel: string) => string, files: string[]): string[] {
  const scopes = new Set<string>();
  for (const rel of files) {
    if (rel.startsWith('99-Templates/')) continue;
    if (!path.basename(rel).startsWith('_')) continue;
    for (const block of read(rel).matchAll(QUERY_BLOCK)) {
      for (const from of block[1].matchAll(FROM_SCOPE)) {
        const scope = from[1].replace(/\/+$/, '');
        if (scope !== '') scopes.add(scope);
      }
    }
  }
  return [...scopes];
}

function isCovered(rel: string, scopes: string[]): boolean {
  return scopes.some(
    (scope) => scope === '' || rel === scope || rel.startsWith(`${scope}/`)
  );
}

export function auditVaultHygiene(root: string, options: { includeIgnored?: boolean } = {}): HygieneReport {
  const { files, source } = enumerate(root, options.includeIgnored === true);

  const candidates: Candidate[] = [];
  for (const rel of files) {
    if (!isNoteCandidate(rel)) continue;
    let content: string;
    try {
      content = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue; // tracked but absent from the working tree — `git status`'s business
    }
    candidates.push({ rel, content, block: frontmatterOf(content) });
  }

  const unclassified: string[] = [];
  const missingReviewMetadata: ReviewGap[] = [];
  const reviewCycleOutsideSchema: string[] = [];

  for (const { rel, block } of candidates) {
    const type = fieldOf(block, 'type');
    if (type === '') {
      unclassified.push(rel);
      continue; // no type means no review expectation to test against
    }
    if (!REVIEW_TYPES.has(type)) continue; // the guide gives these four review metadata and no other type

    const missing: string[] = [];
    if (fieldOf(block, 'last_reviewed') === '') missing.push('last_reviewed');
    const cycle = fieldOf(block, 'review_cycle');
    if (cycle === '') missing.push('review_cycle');
    else if (!REVIEW_CYCLES.has(cycle)) reviewCycleOutsideSchema.push(rel);
    if (missing.length > 0) missingReviewMetadata.push({ path: rel, missing });
  }

  // Reachability reuses the auditor's link reader rather than re-deriving it, so the two
  // reports cannot disagree about what a link is or where it points.
  const incoming = new Map<string, number>();
  const names = new Map<string, string>();
  for (const { rel, content } of candidates) {
    const base = path.basename(rel, '.md');
    for (const key of [base, rel, rel.slice(0, -3)]) names.set(key.toLowerCase(), base.toLowerCase());
    for (const alias of parseAliases(content)) names.set(alias.toLowerCase(), base.toLowerCase());
    incoming.set(base.toLowerCase(), incoming.get(base.toLowerCase()) ?? 0);
  }
  for (const { content } of candidates) {
    for (const link of extractWikilinks(content)) {
      const target = names.get(link.target.toLowerCase());
      if (target !== undefined) incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
  }

  const contentByPath = new Map(candidates.map((candidate) => [candidate.rel, candidate.content]));
  const scopes = hubScopes((rel) => contentByPath.get(rel) ?? '', candidates.map((c) => c.rel));

  const noIncomingLinks: string[] = [];
  const dynamicMocOnly: string[] = [];
  for (const { rel } of candidates) {
    const base = path.basename(rel, '.md');
    if ((incoming.get(base.toLowerCase()) ?? 0) > 0) continue;
    if (base.startsWith('_')) continue;      // a hub is a destination, not a linked record
    if (rel === 'Home.md') continue;         // the front door
    if (isCovered(rel, scopes)) dynamicMocOnly.push(rel);
    else noIncomingLinks.push(rel);
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

export interface MemoryBudgetReport {
  present: boolean;
  lines: number;
  bytes: number;
  maxLines: number;
  maxBytes: number;
  warnLines: number;
  warnBytes: number;
  overThreshold: boolean;
  hasRoutingRule: boolean;
}

export interface OverdueReview {
  path: string;
  daysOverdue: number;
}

export interface SkillGap {
  path: string;
  missing: string[];
}

export interface RotReport {
  referenceDate: string;
  memoryBudget: MemoryBudgetReport;
  overdueReviews: OverdueReview[];
  skillGaps: SkillGap[];
}

const CYCLE_DAYS: Record<string, number> = {
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

function parseIsoDateUtc(dateStr: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function auditRot(
  root: string,
  options: {
    includeIgnored?: boolean;
    today?: string;
    maxMemoryLines?: number;
    maxMemoryBytes?: number;
  } = {}
): RotReport {
  const referenceDate = options.today ?? new Date().toISOString().slice(0, 10);
  const refMs = parseIsoDateUtc(referenceDate) ?? Date.now();
  const maxLines = options.maxMemoryLines ?? 200;
  const maxBytes = options.maxMemoryBytes ?? 8192;
  const warnLines = Math.floor(maxLines * 0.75);
  const warnBytes = Math.floor(maxBytes * 0.75);

  // 1. Memory budget check (metrics & boolean flags only; never echoes content)
  const memPath = path.join(root, 'memory.md');
  let memoryBudget: MemoryBudgetReport = {
    present: false,
    lines: 0,
    bytes: 0,
    maxLines,
    maxBytes,
    warnLines,
    warnBytes,
    overThreshold: false,
    hasRoutingRule: false,
  };
  try {
    const raw = fs.readFileSync(memPath, 'utf8');
    const bytes = Buffer.byteLength(raw, 'utf8');
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
      hasRoutingRule,
    };
  } catch {
    // memory.md is owner-only and optional in fresh clones
  }

  // 2. Overdue reviews scan across vault note folders
  const { files } = enumerate(root, options.includeIgnored === true);
  const overdueReviews: OverdueReview[] = [];
  for (const rel of files) {
    if (!isNoteCandidate(rel)) continue;
    let content: string;
    try {
      content = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    const block = frontmatterOf(content);
    const type = fieldOf(block, 'type');
    if (!REVIEW_TYPES.has(type)) continue;
    const status = fieldOf(block, 'status');
    if (status === 'archived' || status === 'completed') continue;

    const lastReviewed = fieldOf(block, 'last_reviewed');
    const cycle = fieldOf(block, 'review_cycle');
    const cycleDays = CYCLE_DAYS[cycle];
    const reviewedMs = parseIsoDateUtc(lastReviewed);
    if (!cycleDays || reviewedMs === null) continue;

    const elapsedDays = Math.floor((refMs - reviewedMs) / (1000 * 60 * 60 * 24));
    if (elapsedDays > cycleDays) {
      overdueReviews.push({
        path: rel,
        daysOverdue: elapsedDays - cycleDays,
      });
    }
  }

  // 3. Skill library anti-rot guardrails (.agents/skills/*/SKILL.md)
  const skillGaps: SkillGap[] = [];
  const skillsDir = path.join(root, '.agents', 'skills');
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const rel = `.agents/skills/${entry.name}/SKILL.md`;
      const abs = path.join(root, rel);
      let content: string;
      try {
        content = fs.readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      const block = frontmatterOf(content);
      const missing: string[] = [];
      if (fieldOf(block, 'version') === '') missing.push('version');
      if (fieldOf(block, 'pinned') === '') missing.push('pinned');
      if (fieldOf(block, 'status') === 'deprecated' && fieldOf(block, 'absorbed_by') === '') {
        missing.push('absorbed_by');
      }
      if (!/^##\s+.*Regression Cases/m.test(content)) {
        missing.push('regression_cases');
      }
      if (missing.length > 0) {
        skillGaps.push({ path: rel, missing });
      }
    }
  } catch {
    // .agents/skills optional in minimal fixtures
  }

  return {
    referenceDate,
    memoryBudget,
    overdueReviews,
    skillGaps,
  };
}

export function main(): void {
  const argv = process.argv.slice(2);
  const includeIgnored = argv.includes('--include-ignored');
  const isStrict = argv.includes('--strict');
  const checkRot = argv.includes('--check-rot');
  const todayIdx = argv.indexOf('--today');
  const todayOpt = todayIdx !== -1 && argv[todayIdx + 1] ? argv[todayIdx + 1] : undefined;
  const root = process.cwd();

  const report = auditVaultHygiene(root, { includeIgnored });

  console.log('🩺 Vault Hygiene Report');
  console.log('='.repeat(40));
  console.log(`📂 Vault Root: ${report.root}`);
  console.log(
    `🗂️  Source: ${
      report.source === 'tracked'
        ? 'tracked index (ignored local content excluded; pass --include-ignored to add it)'
        : 'filesystem walk (ignored local content included)'
    }`
  );
  console.log(`🔍 Scanned ${report.scanned} note(s) in the vault note folders\n`);

  console.log(`📋 UNCLASSIFIED RECORDS \u2014 no \`type\` in frontmatter (${report.unclassified.length})`);
  if (report.unclassified.length === 0) console.log('   ✅ None.');
  else for (const file of report.unclassified) console.log(`   - ${file}`);
  console.log('');

  console.log(`🕒 MISSING REVIEW METADATA (${report.missingReviewMetadata.length})`);
  console.log('   Required by the canonical guide for: project, learning, concept, personal.');
  console.log('   A blank field is not listed by the MOC queries, so these notes never surface as due.');
  if (report.missingReviewMetadata.length === 0) console.log('   ✅ None.');
  else {
    for (const gap of report.missingReviewMetadata) {
      console.log(`   - ${gap.path}: missing ${gap.missing.join(', ')}`);
    }
  }
  console.log('');

  console.log(`🧭 REACHABILITY \u2014 literal backlinks vs hub scope (${report.noIncomingLinks.length + report.dynamicMocOnly.length})`);
  console.log('   A literal-link orphan count cannot see a note a hub tries to list through a dynamic');
  console.log('   query, so the two are reported apart. The queries are NOT evaluated here: the');
  console.log("   first bucket means the note sits inside a hub's FROM scope \u2014 not that the hub's");
  console.log('   result contains it.');
  console.log(`   - Inside a hub's declared FROM scope, no literal backlink (${report.dynamicMocOnly.length})`);
  for (const file of report.dynamicMocOnly) console.log(`     - ${file}`);
  console.log(`   - Outside every hub's FROM scope \u2014 no hub names its folder (${report.noIncomingLinks.length})`);
  for (const file of report.noIncomingLinks) console.log(`     - ${file}`);
  console.log('');

  if (report.reviewCycleOutsideSchema.length > 0) {
    console.log(`🔁 SPECIMEN: review_cycle outside the schema (${report.reviewCycleOutsideSchema.length})`);
    console.log(`   The schema accepts exactly: ${[...REVIEW_CYCLES].join(', ')}`);
    for (const file of report.reviewCycleOutsideSchema) console.log(`   - ${file}`);
    console.log('');
  }

  let rotFindings = 0;
  if (checkRot) {
    const rot = auditRot(root, { includeIgnored, today: todayOpt });
    const mem = rot.memoryBudget;
    console.log('🧠 CORE MEMORY BUDGET & ANTI-ROT');
    if (!mem.present) {
      console.log('   ℹ️  Local memory record not present (fresh clone or external).');
    } else {
      const linePct = Math.round((mem.lines / mem.maxLines) * 100);
      const bytePct = Math.round((mem.bytes / mem.maxBytes) * 100);
      console.log(`   - Capacity: ${mem.lines}/${mem.maxLines} lines (${linePct}%), ${mem.bytes}/${mem.maxBytes} bytes (${bytePct}%)`);
      console.log(`   - Routing invariant header: ${mem.hasRoutingRule ? '✅ present' : '⚠️ missing'}`);
      if (mem.overThreshold) {
        console.log('   ⚠️  Memory exceeds 75% warning threshold — offload infra/system details to 06-Resources/.');
        rotFindings++;
      }
      if (!mem.hasRoutingRule) {
        rotFindings++;
      }
    }
    console.log('');

    console.log(`⏳ OVERDUE REVIEWS as of ${rot.referenceDate} (${rot.overdueReviews.length})`);
    if (rot.overdueReviews.length === 0) console.log('   ✅ None.');
    else {
      for (const item of rot.overdueReviews) {
        console.log(`   - ${item.path} (${item.daysOverdue}d overdue)`);
      }
      rotFindings += rot.overdueReviews.length;
    }
    console.log('');

    console.log(`🛡️  SKILL ANTI-ROT GUARDRAILS (${rot.skillGaps.length})`);
    if (rot.skillGaps.length === 0) console.log('   ✅ All skills carry version, pinned, and regression cases.');
    else {
      for (const gap of rot.skillGaps) {
        console.log(`   - ${gap.path}: missing ${gap.missing.join(', ')}`);
      }
      rotFindings += rot.skillGaps.length;
    }
    console.log('');
  }

  console.log('='.repeat(40));

  const findings =
    report.unclassified.length +
    report.missingReviewMetadata.length +
    report.noIncomingLinks.length +
    report.reviewCycleOutsideSchema.length +
    rotFindings;
  console.log(`🩺 ${findings} finding(s). This report is read-only and changed nothing.`);

  if (isStrict && findings > 0) {
    console.error('❌ Strict hygiene report failed: findings exist.');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

