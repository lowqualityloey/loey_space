import * as fs from 'fs';
import * as path from 'path';

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

interface AuditReport {
  totalNotes: number;
  totalAttachments: number;
  totalLinks: number;
  brokenLinks: BrokenLink[];
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

export function parseAliases(content: string): string[] {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return [];

  const fm = fmMatch[1];
  const aliasesMatch = fm.match(/^aliases:\s*(.*)$/m);
  if (!aliasesMatch) return [];

  const raw = aliasesMatch[1].trim();
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }

  const listMatches = fm.match(/^aliases:\s*\r?\n((?:\s*-\s*.*(?:\r?\n|$))+)/m);
  if (listMatches) {
    return listMatches[1]
      .split('\n')
      .map(line => line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  return raw ? [raw.replace(/^["']|["']$/g, '')] : [];
}

export function extractWikilinks(content: string): Array<{ target: string; raw: string; line: number }> {
  const links: Array<{ target: string; raw: string; line: number }> = [];
  const lines = content.split('\n');

  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Strip inline code blocks before scanning for wikilinks
    const strippedLine = line.replace(/`[^`]+`/g, ' ');

    const matches = strippedLine.matchAll(/!?\[\[([^\[\]]+)\]\]/g);
    for (const match of matches) {
      const raw = match[0];
      const inner = match[1].trim();
      const cleanInner = inner.replace(/\\\|/g, '|');
      const targetOnly = cleanInner.split('|')[0].split('#')[0].trim();
      if (targetOnly && targetOnly !== '|' && targetOnly !== '#') {
        links.push({
          target: targetOnly.replace(/\.md$/i, ''),
          raw: raw,
          line: i + 1
        });
      }
    }
  }

  return links;
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

  const brokenLinks: BrokenLink[] = [];
  let totalLinks = 0;

  for (const [relPath, note] of notes) {
    if (relPath.startsWith('99-Templates/')) continue;

    for (const link of note.outgoingLinks) {
      totalLinks++;
      const lowerTarget = link.target.toLowerCase();

      const resolvesToNote = noteLookup.has(lowerTarget);
      const resolvesToAttachment = attachments.has(lowerTarget) || attachments.has(link.target.toLowerCase());

      if (resolvesToNote) {
        const canonical = noteLookup.get(lowerTarget)!;
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
    console.log('✅ No broken wikilinks found! All targets resolve cleanly.\n');
  } else {
    console.log(`⚠️  Found ${report.brokenLinks.length} uncreated/broken link target(s):\n`);
    for (const b of report.brokenLinks) {
      const suggestStr = b.suggestion ? ` -> Suggestion: [[${b.suggestion}]]` : '';
      console.log(`  ❌ ${b.sourceFile}:${b.line} -> ${b.rawLink}${suggestStr}`);
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

  if (isStrict && report.brokenLinks.length > 0) {
    console.error('❌ Strict audit failed: Broken links exist in vault.');
    process.exit(1);
  }

  console.log('🎉 Audit finished successfully!');
}

if (require.main === module) {
  main();
}
