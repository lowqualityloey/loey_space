// Template and note validation script for tag and properties consistency
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

// Dynamically locate 99-Templates whether run from repo root or scripts dir
function resolveTemplatesPath(): string {
  const fromCwd = path.resolve(process.cwd(), '99-Templates');
  if (fs.existsSync(fromCwd)) return fromCwd;

  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(current, '99-Templates');
    if (fs.existsSync(candidate)) return candidate;
    current = path.dirname(current);
  }
  return path.resolve(__dirname, '../../99-Templates');
}

const TEMPLATES_DIR_NAME = '99-Templates';
const templatesPath = resolveTemplatesPath();

// Issue #93: the scan root is the VAULT ROOT — the directory that holds 99-Templates —
// not the templates folder itself. `resolveTemplatesPath()` used to be the whole scan, so
// the validator inspected 3% of the notes that declare metadata and reported success over
// the rest: 21 tracked notes used a type (`moc` ×13, `guide` ×6, `dashboard` ×2) that the
// registry below did not even know about, and nothing failed. The defect is the scope, not
// the schema, so the scan now covers every tracked markdown file and the registry is
// brought in line with the canonical table in `06-Resources/Guides/Tagging & Properties.md`.
const vaultRoot = path.dirname(templatesPath);
const templatesPrefix = `${TEMPLATES_DIR_NAME}/`;

// Expected required properties for each note type, transcribed from the canonical contract
// in `06-Resources/Guides/Tagging & Properties.md` § "Baseline Required Properties (All
// Notes)" (created, updated, type, area, tags) extended by § "Required Fields by Type":
// `status` is required on every type EXCEPT `daily`, and `project` additionally requires
// `priority`. Every type a live note declares must have an entry here: a type with no entry
// is an unregistered type and fails validation rather than silently passing.
const expectedProperties: Record<string, string[]> = {
  'project': ['created', 'updated', 'type', 'status', 'priority', 'area', 'tags'],
  'learning': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'snippet': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'resource': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'concept': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'daily': ['created', 'updated', 'type', 'area', 'tags'],
  'personal': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'review': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  // --- Explicit exceptions, pending issue #50 ---------------------------
  // Issue #50 owns the canonical type/area/status vocabulary and names these
  // three classes as needing "explicit justified exceptions" (raw captures and
  // software documents). Until it lands they are registered here so that the
  // tightened validator does not fail the live vault. Required-field lists are
  // derived from the fields those templates actually declare; their optional
  // extras (`source`, `priority`) are deliberately not required.
  // Exception: `capture` — Enhanced Quick Capture.md, Mobile Capture.md
  'capture': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  // Exception: `task` — Mobile Task.md
  'task': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  // Exception: `template` — AI Daily Enrich.md
  'template': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  // Issue #93: `dashboard`, `guide` and `moc` are the three types the guide records
  // as "documentation only" because the validator had never seen them. They are
  // real and heavily used — every MOC, every guide including the guide itself, and
  // the vault's home page declare them — and the guide's own table gives all three
  // `status` as their only extended requirement, which is the same list `snippet`
  // carries. Registering them without widening the scan would have been cosmetic;
  // widening the scan without them would have failed 21 notes at once. They are one
  // change for that reason, not two.
  'dashboard': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'guide': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'moc': ['created', 'updated', 'type', 'status', 'area', 'tags']
  // Issue #93: the `triage` key is GONE. It was registered while
  // `99-Templates/Triage.md` declares `type: personal`, so it described nothing, and
  // because the registry is keyed on the raw string, a typo such as `type: triag`
  // validated exactly like the dead key did. Registering a type is not free: it
  // claims that some note really is that kind of note. Do not re-add it unless a
  // tracked note actually declares it.
};

// Issue #93: DECLARED exemptions, keyed by vault-relative path.
//
// `memory.md` and `handoff.md` are the owner's private cross-session records. They are
// tracked, they declare `type: memory` and `type: handoff`, and neither name is in the
// canonical taxonomy — the guide's type table lists 14 types and these are not among them,
// nor are they the documented `capture`/`task`/`template` exceptions. Registering them
// would push non-canonical vocabulary INTO the schema, which is the opposite of what a
// registry is for, so they are exempted by path instead and each exemption is printed on
// every run: declared, not silently tolerated. If either note adopts a canonical type, or
// stops declaring one at all, delete the entry — a stale exemption is dead weight that
// hides the next author from the real reason it existed.
const exemptNotes: Record<string, string> = {
  'memory.md': "owner's private long-term memory record; its type is not in the canonical taxonomy",
  'handoff.md': "owner's private cross-session handoff record; its type is not in the canonical taxonomy"
};

// Directories that hold no vault notes. Used only by the non-git fallback walk below: the
// git path enumerates the index, so it never sees them, but a filesystem walk would
// otherwise spend its time inside `node_modules` and the binary attachment store.
const nonNoteDirectories = new Set(['.git', '.obsidian', '.promptkit', 'node_modules', '99-Attachments']);

// Issue #93: enumerate markdown NUL-safely. `-z` is mandatory, not stylistic: 31 tracked
// filenames in this repo contain spaces ("Tagging & Properties.md", every "_Concepts MOC.md"),
// and splitting that output on whitespace silently skips every MOC and every guide — the same
// bug class that hid this defect for a whole session, and the one `documented-commands.test.mjs`
// already guards against in its own scan.
function listTrackedMarkdown(root: string): string[] {
  try {
    const output = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024
    });
    return output.split('\0').filter((file) => file.length > 0).sort();
  } catch {
    // Not a git worktree — an exported vault, or a test fixture. Fall back to a filesystem
    // walk rather than refusing to run: this path scans MORE than the index would (untracked
    // notes included), so it can only be stricter, never a way for a violation to slip past.
    console.log(`⚠️ git enumeration unavailable under ${root}; walking the filesystem instead`);
    return walkMarkdown(root, '');
  }
}

function walkMarkdown(root: string, prefix: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    if (prefix === '' && nonNoteDirectories.has(entry.name)) continue;
    const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...walkMarkdown(root, relativePath));
    } else if (entry.name.endsWith('.md')) {
      found.push(relativePath);
    }
  }
  return found.sort();
}

interface ParsedFrontmatter {
  props: Record<string, string>;
  tags: string[];
}

// Returns null when the file has no YAML frontmatter block at all.
function parseFrontmatter(content: string): ParsedFrontmatter | null {
  const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!yamlMatch) return null;

  const yamlContent = yamlMatch[1];
  const lines = yamlContent.split(/\r?\n/);
  // Values are kept verbatim so a blank declaration stays distinguishable from an
  // absent one. A Templater placeholder such as `created: <% tp.date.now("YYYY-MM-DD") %>`
  // is a non-empty literal, so it counts as present.
  const props: Record<string, string> = {};
  let inTags = false;
  const tags: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;

    if (inTags) {
      if (line.trim().startsWith('-')) {
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
        props[key] = value.trim();
        if (key === 'tags') {
          inTags = true;
        }
      }
    }
  }

  // `tags:` is declared empty and populated by the list lines beneath it, so its
  // presence is decided by whether that list ended up non-empty.
  if (tags.length > 0) {
    props.tags = tags.join('\n');
  }

  return { props, tags };
}

// Expected tag structure
const requiredTagNamespaces = ['type', 'area', 'status'];

// Issue #93: the contract checks below (unknown type, missing/blank required field) apply to
// EVERY scanned note. The Templater placeholder check is NOT a contract check — a blueprint
// is expected to carry `<% tp.date.now("YYYY-MM-DD") %>` and an ordinary note never will —
// so it is gated to `99-Templates/`. Before the split, widening the scan without gating it
// would have produced one spurious warning per note in the vault.
function validateNote(relativePath: string, content: string, frontmatter: ParsedFrontmatter): boolean {
  const { props, tags } = frontmatter;
  const isTemplate = relativePath.startsWith(templatesPrefix);

  // Determine note type
  const type = (typeof props.type === 'string' ? props.type : '') || 'unknown';
  const expected = expectedProperties[type];
  let isValid = true;

  // A type absent from the registry is a schema failure, not an empty required-list.
  // Diagnostics name the file and the field only; the offending value is never echoed (#51).
  if (!expected) {
    console.log(`❌ ${relativePath}: unregistered type — the declared type is not in the schema registry`);
    isValid = false;
  }

  // Check required properties. A declared-but-blank property is a failure too: it
  // carries no value for a reader or a downstream parser to act on.
  for (const prop of expected ?? []) {
    const value = props[prop];
    if (value === undefined) {
      console.log(`❌ ${relativePath}: missing property: ${prop}`);
      isValid = false;
    } else if (typeof value === 'string' && value.trim() === '') {
      console.log(`❌ ${relativePath}: blank property: ${prop}`);
      isValid = false;
    }
  }

  // Check tag structure. Advisory only: a note whose fields are complete but whose tags
  // lack a namespace is incomplete, not invalid, so a warning must not move the exit status.
  const tagNamespaces = new Set<string>();
  for (const tag of tags) {
    const namespace = tag.split('/')[0];
    tagNamespaces.add(namespace);
  }

  const requiredNamespaces = type === 'daily' ? ['type', 'area'] : requiredTagNamespaces;
  for (const namespace of requiredNamespaces) {
    if (!tagNamespaces.has(namespace)) {
      console.log(`⚠️ ${relativePath}: Missing ${namespace}/* tag`);
    }
  }

  // Check for dynamic date placeholders — templates only, for the reason in the comment above.
  if (isTemplate && !content.includes('<% tp.date.now("YYYY-MM-DD") %>')) {
    console.log(`⚠️ ${relativePath}: Missing dynamic date template`);
  }

  if (isValid) {
    console.log(`✅ ${relativePath} passes validation`);
  }

  return isValid;
}

function validateAllNotes(): boolean {
  console.log('📋 Vault Metadata Validation Report');
  console.log('=' .repeat(40));

  let files: string[];
  try {
    files = listTrackedMarkdown(vaultRoot);
  } catch (error: any) {
    console.error('❌ Error enumerating tracked markdown:', error?.message || error);
    return false;
  }

  // Non-vacuity, on the artifact that matters. An enumeration that matched nothing — wrong
  // root, a `git` failure swallowed above, a renamed directory — used to produce "All
  // templates are properly structured!" and exit 0. Success over nothing is the exact class
  // of bug #51 and #93 exist to remove, so it is a failure.
  if (files.length === 0) {
    console.error(`❌ No markdown files found under ${vaultRoot} — refusing to report success over an empty scan`);
    return false;
  }

  let allValid = true;
  let inspected = 0;
  let exempted = 0;

  for (const relativePath of files) {
    const exemption = exemptNotes[relativePath];
    if (exemption !== undefined) {
      exempted++;
      console.log(`➖ ${relativePath}: exempt from the metadata contract — ${exemption}`);
      continue;
    }

    const absolutePath = path.join(vaultRoot, relativePath);
    let content: string;
    try {
      content = fs.readFileSync(absolutePath, 'utf8');
    } catch {
      // Tracked in the index but gone from the working tree. Nothing to validate, and the
      // missing file is `git status`'s business, not this script's.
      console.log(`➖ ${relativePath}: tracked but not present on disk — skipped`);
      continue;
    }

    console.log(`\n🔍 Validating ${relativePath}...`);

    // The contract binds notes that DECLARE metadata. 29 of the 87 tracked markdown files
    // declare no `type` at all — `docs/`, `AGENTS.md`, `README.md`, the skill files, the
    // issue templates — and they are not the subject of this contract.
    //
    // Decision on `docs/`, recorded here because it was a judgement call and the next
    // engineer will ask: `docs/` is NOT excluded by prefix. It is excluded by this rule —
    // every file in it declares no `type`, so none of them is a contract note today. That
    // is different from the `documented-commands` scan's `docs/` exclusion, which exists
    // because those files quote broken commands on purpose. Here, if someone later adds
    // frontmatter to a `docs/` file, holding it to the same contract as any other note is
    // the correct outcome; a blanket path exemption would have hidden it instead.
    const frontmatter = parseFrontmatter(content);
    if (frontmatter === null) {
      if (relativePath.startsWith(templatesPrefix)) {
        // A template IS a metadata contract in itself: with no frontmatter it cannot even
        // declare a type, so it can never be validated. Fail it rather than skip it.
        console.log(`❌ ${relativePath}: Missing YAML frontmatter`);
        allValid = false;
      }
      continue;
    }

    const declaredType = frontmatter.props.type;
    if (declaredType === undefined || declaredType.trim() === '') {
      if (relativePath.startsWith(templatesPrefix)) {
        console.log(`❌ ${relativePath}: missing property: type`);
        allValid = false;
      }
      continue;
    }

    inspected++;
    const isValid = validateNote(relativePath, content, frontmatter);
    allValid = isValid && allValid;
  }

  // Same non-vacuity rule one level down: files were found, but if none of them declared a
  // type then no contract was checked at all and a green run would mean nothing.
  if (inspected === 0) {
    console.error(`❌ None of the ${files.length} markdown file(s) under ${vaultRoot} declare a \`type\` — nothing was validated`);
    return false;
  }

  // `exempted` is counted separately because an exempted note DID declare a type; folding the
  // two together would under-report coverage, which is the failure this script exists to stop.
  console.log(
    `\nInspected ${inspected} note(s); ${inspected + exempted} of ${files.length} tracked markdown file(s) declare a \`type\`` +
    `${exempted === 0 ? '.' : `, ${exempted} exempted.`}`
  );
  console.log('=' .repeat(40));
  if (allValid) {
    console.log('🎉 All notes are properly structured!');
  } else {
    console.log('⚠️ Some notes need attention');
  }
  return allValid;
}

// Run validation. A failure must reach the process exit status or CI stays green.
if (!validateAllNotes()) {
  process.exitCode = 1;
}
