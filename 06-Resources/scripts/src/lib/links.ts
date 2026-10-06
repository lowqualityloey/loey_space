// Wikilink and alias parsing, shared by every reader of the vault's link graph.
//
// This lives in `lib/` rather than in `audit-links.ts` for a bundling reason, not a
// stylistic one, and the reason is worth recording because it cost a debugging session:
//
// `build.mjs` bundles with `esbuild` in `format: 'cjs'`, and for a CJS entry esbuild
// INLINES the imported modules into the entry's own top-level scope — there is no
// `__commonJS` wrapper per module. Every `if (require.main === module) { main(); }` in
// the graph therefore evaluates TRUE, because `module` and `require.main` are both the
// one bundle. So the moment a second script imported `parseAliases` from `audit-links.ts`,
// the freshly built `vault-hygiene.js` ran the whole link audit and printed its report
// before printing its own.
//
// The rule that falls out, and the reason `build.mjs` carries an equivalent note: a CLI
// guard is only safe in a file that is never imported. Pure logic belongs in `lib/`, and
// `audit-links.ts` re-exports these two so the existing imports through the bundle keep
// working unchanged.
//
// Neither function touches the filesystem or process state; both are pure string
// functions, which is what makes them safe to share.

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
