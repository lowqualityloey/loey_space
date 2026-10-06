import * as fs from 'fs';
import * as path from 'path';

// The two parsers live in `lib/links.ts` so that importing them from another script
// cannot execute this file's CLI (see the header there). Re-exported so every existing
// `import { parseAliases } from '../audit-links.js'` keeps resolving against the bundle.
import { parseAliases, extractWikilinks } from './lib/links';
import { readRepoFacts } from './lib/gitpaths';
export { parseAliases, extractWikilinks };

interface NoteInfo {
  relativePath: string;
  basename: string;
  aliases: string[];
  outgoingLinks: Array<{ target: string; raw: string; line: number }>;
}

interface BrokenLink {
  sourceFile: string;
  line: number;
  rawLink: string;
  target: string;
  suggestion?: string;
}

// A link whose target is not in this checkout **by design**: its candidate path is excluded by
// the repository's own ignore rules, so the content exists on the machine the vault is for and
// in no clone of it. Kept apart from `BrokenLink` because the two need different responses —
// one is a typo, the other is the architecture (`Home.md` links the capture dump that
// `.gitignore` keeps local) — and because only the first should ever fail a build.
interface LocalOnlyLink {
  sourceFile: string;
  line: number;
  rawLink: string;
  target: string;
}

interface AuditReport {
  totalNotes: number;
  totalAttachments: number;
  totalLinks: number;
  brokenLinks: BrokenLink[];
  localOnlyLinks: LocalOnlyLink[];
  orphanNotes: string[];
}

function findVaultRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(current, '.obsidian')) || fs.existsSync(path.join(current, '06-Resources'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;

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

// The paths a target could name, in the order Obsidian would try them.
//
// A target that carries a path (`00-Inbox/quick-capture-dump`) names its own candidates, with
// and without the `.md` extension. A bare target (`quick-capture-dump`) resolves against the
// whole vault, and Obsidian prefers the linking note's own folder before the root — which is
// not academic here: the one bare target in the real report is `![[quick-capture-dump]]` in
// `00-Inbox/_Inbox MOC.md`, a sibling of the note it names, and without that same-folder
// candidate it would stay "broken" and CI could still not be made strict.
//
// The stated limit: a bare target whose only home is some OTHER ignored folder is reported
// broken, because a static reader has no way to ask about every folder. Qualifying the link
// fixes it, and the case is visible rather than silent — the count is printed.
function candidatePaths(sourceRel: string, target: string): string[] {
  const stem = target.replace(/\.md$/i, '');
  const candidates = new Set<string>();
  const add = (base: string) => {
    candidates.add(base);
    candidates.add(`${base}.md`);
  };

  add(stem);
  const folder = path.posix.dirname(sourceRel);
  if (!target.includes('/') && folder !== '.') add(`${folder}/${stem}`);
  return [...candidates];
}

function findFuzzyMatch(target: string, candidates: string[]): string | undefined {
  const lowerTarget = target.toLowerCase();
  let bestCandidate: string | undefined;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const lowerCandidate = candidate.toLowerCase();
    if (lowerCandidate === lowerTarget) return candidate;

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

export function auditVaultLinks(vaultRoot: string): AuditReport {
  const IGNORED_DIRS = new Set([
    '.git',
    '.obsidian',
    '.trash',
    '.agents',
    '.smart-env',
    '.claudian',
    '.secrets',
    'node_modules',
    'dist'
  ]);

  const notes = new Map<string, NoteInfo>();
  const attachments = new Set<string>();
  const noteLookup = new Map<string, string>(); // lowercase target -> canonical name
  const allTargetNames: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(vaultRoot, fullPath).replace(/\\/g, '/');

        if (entry.name.endsWith('.md')) {
          const basename = entry.name.slice(0, -3);
          const content = fs.readFileSync(fullPath, 'utf8');
          const aliases = parseAliases(content);
          const outgoingLinks = extractWikilinks(content);

          notes.set(relPath, {
            relativePath: relPath,
            basename,
            aliases,
            outgoingLinks
          });

          // Register lookup variations (basename, relative path with and without .md)
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

  const incomingBacklinks = new Map<string, number>();
  for (const [, note] of notes) {
    incomingBacklinks.set(note.basename.toLowerCase(), 0);
  }

  const unresolved: Array<{ sourceFile: string; link: { target: string; raw: string; line: number } }> = [];
  let totalLinks = 0;

  for (const [relPath, note] of notes) {
    // Issue #54: templates used to be skipped here, so a blueprint could ship a wikilink
    // that cannot resolve in any note it produces and no audit would ever say so.
    // `99-Templates/Project.md` carried `[[08-Concepts/ ]]` and `[[04-Learning/ ]]` —
    // folder targets, not the notes the template asks the author to add. A template is a
    // metadata contract in its own right (the validator already fails one that declares no
    // `type`), so its links are audited like any other note's.
    for (const link of note.outgoingLinks) {
      // A Templater blueprint resolves some targets at RENDER time: `[[<% tp.file.title %>
      // Kanban]]` has no target until the template runs, so it cannot be resolved
      // statically and is not a broken link. An EMPTY `[[ ]]` placeholder never reaches
      // here at all — `extractWikilinks` drops a link whose target is blank.
      if (link.target.includes('<%')) continue;

      totalLinks++;
      const lowerTarget = link.target.toLowerCase();

      const resolvesToNote = noteLookup.has(lowerTarget);
      const resolvesToAttachment = attachments.has(lowerTarget) || attachments.has(link.target.toLowerCase());

      if (resolvesToNote) {
        const canonical = noteLookup.get(lowerTarget)!;
        incomingBacklinks.set(canonical.toLowerCase(), (incomingBacklinks.get(canonical.toLowerCase()) || 0) + 1);
      } else if (!resolvesToAttachment) {
        unresolved.push({ sourceFile: relPath, link });
      }
    }
  }

  // Issue #101: an unresolved target is not automatically a defect. In a clone, content the
  // repository deliberately does not carry is simply absent, and the ignore rules — not the
  // disk — are what say so. Split here, so `--strict` can gate on the part that is decidable.
  const candidates = unresolved.flatMap((item) => candidatePaths(item.sourceFile, item.link.target));
  const repo = readRepoFacts(vaultRoot, candidates);
  const brokenLinks: BrokenLink[] = [];
  const localOnlyLinks: LocalOnlyLink[] = [];

  for (const { sourceFile, link } of unresolved) {
    // A note that is itself untracked cannot have its dangling links excused by the ignore
    // rules: an untracked note and an untracked target live on the same disk, so there the
    // question IS decidable and a link that resolves nowhere is a real defect. Without this
    // clause every dangling link in the owner's own notes would be reclassified as local-only
    // and the report would stop reporting the very findings it exists for.
    const trackedSource = repo.available && repo.trackedNotes.has(sourceFile);
    const targetIsIgnored =
      repo.available && candidatePaths(sourceFile, link.target).some((p) => repo.ignored.has(p));

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

  const orphanNotes: string[] = [];
  for (const [relPath, note] of notes) {
    if (
      relPath.startsWith('99-Templates/') ||
      relPath.startsWith('00-Inbox/Archives/') ||
      note.basename.startsWith('_') ||
      note.basename === 'Home' ||
      relPath === 'README.md' ||
      relPath === 'AGENTS.md'
    ) {
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
    localOnlyLinks,
    orphanNotes
  };
}

export function main() {
  const vaultRoot = findVaultRoot();
  const isStrict = process.argv.includes('--strict');

  console.log('🔍 Auditing Vault Wikilinks & Backlink Graph...');
  console.log(`📂 Vault Root: ${vaultRoot}\n`);

  const report = auditVaultLinks(vaultRoot);

  console.log('========================================');
  console.log('📊 Vault Link Audit Report');
  console.log('========================================');
  console.log(`📝 Total Markdown Notes:  ${report.totalNotes}`);
  console.log(`📎 Total Attachments:     ${report.totalAttachments}`);
  console.log(`🔗 Total Wikilinks Read:  ${report.totalLinks}`);
  console.log('----------------------------------------');

  if (report.brokenLinks.length === 0) {
    console.log('✅ No broken wikilinks found! Every target resolves, or points at content that');
    console.log('   is not in this checkout by design (see below).\n');
  } else {
    console.log(`⚠️  Found ${report.brokenLinks.length} uncreated/broken link target(s):\n`);
    for (const b of report.brokenLinks) {
      const suggestStr = b.suggestion ? ` -> Suggestion: [[${b.suggestion}]]` : '';
      console.log(`  ❌ ${b.sourceFile}:${b.line} -> ${b.rawLink}${suggestStr}`);
    }
    console.log('');
  }

  // Disclosed whether or not it is empty, because the alternative is a report that quietly
  // omits findings. `--strict` passes on these: the target's path is excluded by the
  // repository's ignore rules, so the link is correct where the content lives and unverifiable
  // here — a different thing from a typo, and not something a build should fail on.
  if (report.localOnlyLinks.length > 0) {
    console.log(
      `🔗 ${report.localOnlyLinks.length} link target(s) point at local-only content ` +
        `(excluded by the repository's ignore rules):\n`
    );
    for (const l of report.localOnlyLinks) {
      console.log(`  - ${l.sourceFile}:${l.line} -> ${l.rawLink}`);
    }
    console.log('');
  }

  if (report.orphanNotes.length === 0) {
    console.log('✅ No orphaned notes detected! All notes have incoming backlinks.\n');
  } else {
    console.log(`🟡 Found ${report.orphanNotes.length} orphan note(s) (0 incoming links):\n`);
    for (const orphan of report.orphanNotes.slice(0, 25)) {
      console.log(`  - ${orphan}`);
    }
    if (report.orphanNotes.length > 25) {
      console.log(`  ...and ${report.orphanNotes.length - 25} more orphan notes.`);
    }
    console.log('');
  }

  console.log('========================================');

  // Only genuinely dangling links fail the gate. Local-only content is reported and passes,
  // which is what lets CI run the strict form at all.
  if (isStrict && report.brokenLinks.length > 0) {
    console.error('❌ Strict audit failed: Broken links exist in vault.');
    process.exit(1);
  }

  console.log('🎉 Audit finished successfully!');
}

if (require.main === module) {
  main();
}
