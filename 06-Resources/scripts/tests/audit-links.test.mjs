import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAliases, extractWikilinks } from '../audit-links.js';

test('alias parser: parses bracketed inline aliases correctly', () => {
  const content = `---
type: concept
aliases: [Second Brain, Digital Brain, PKM]
---
# Content`;

  const aliases = parseAliases(content);
  assert.deepStrictEqual(aliases, ['Second Brain', 'Digital Brain', 'PKM']);
});

test('alias parser: parses yaml list aliases correctly', () => {
  const content = `---
type: concept
aliases:
  - React Compiler
  - React Forget
---
# Content`;

  const aliases = parseAliases(content);
  assert.deepStrictEqual(aliases, ['React Compiler', 'React Forget']);
});

test('wikilink extractor: extracts wikilinks, aliased links, and embeds', () => {
  const content = `
Check out [[React 19 Compiler]] and [[Second Brain Guide|my guide]].
Also see ![[obsidian-dailynote.png]] and [[Tagging & Properties#Metadata]].
`;

  const links = extractWikilinks(content);
  const targets = links.map(l => l.target);

  assert.ok(targets.includes('React 19 Compiler'));
  assert.ok(targets.includes('Second Brain Guide'));
  assert.ok(targets.includes('obsidian-dailynote.png'));
  assert.ok(targets.includes('Tagging & Properties'));
});

test('wikilink extractor: ignores links inside code fences', () => {
  const content = `
Outside link: [[Home]].

\`\`\`markdown
Code fence: [[Ignored Note In Code]]
\`\`\`

Another link: [[CONTRIBUTING]].
`;

  const links = extractWikilinks(content);
  const targets = links.map(l => l.target);

  assert.ok(targets.includes('Home'));
  assert.ok(targets.includes('CONTRIBUTING'));
  assert.ok(!targets.includes('Ignored Note In Code'));
});
