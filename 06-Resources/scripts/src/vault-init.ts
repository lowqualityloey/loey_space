/*
 * vault-init — create the private records the instructions refer to.
 *
 * The tracked instruction files (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`) tell an agent to
 * consult `memory.md`, `handoff.md` and `00-Private/SOUL.md`. In a fresh clone none of them
 * exist and nothing created them, so the first session either stopped or improvised a shape
 * that disagreed with what the rest of the system expects. This command is the missing step.
 *
 * Three properties matter more than the feature itself:
 *
 *   1. CREATE-ONLY. Every write uses the exclusive flag ('wx'), so an existing file raises
 *      EEXIST instead of being truncated. There is no code path that deletes or rewrites a
 *      user's file — the worst outcome of running this twice is a no-op, and the worst
 *      outcome of running it on a populated vault is a list of "exists" lines.
 *   2. TARGETING IS EXPLICIT. The target is `--root <dir>` or the working directory, never
 *      this script's own location, and there is no upward search for a vault root. Deriving
 *      the target from the script made the safety check unfalsifiable — the script always
 *      lives in a vault — and searching upward would mean initializing a parent directory
 *      the user never named.
 *   3. IT REPORTS PATHS, NOT CONTENT. The output names what it created and nothing else, so
 *      running it is safe in a shared terminal and its output is safe to paste. Paths are
 *      RELATIVE to the working directory by default — an absolute vault path publishes the
 *      user's filesystem layout along with the report — and `--show-paths` opts back into the
 *      absolute form for diagnostics.
 *
 * Usage:
 *   npm run init:vault [-- --root <dir>] [--dry-run] [--env] [--show-paths]
 */
import * as fs from 'fs';
import * as path from 'path';
import { DUMP_PATH, ROUTES, TRIAGED_HEADING } from './lib/triage';

/** A directory is a vault only if it carries the files every other path assumes. */
const REQUIRED_MARKERS = ['AGENTS.md', '99-Templates'];

/**
 * Templates resolve from THIS script, not from the target: the bundle lives at
 * `06-Resources/scripts/vault-init.js` and its inputs at `06-Resources/scaffold/`, so the
 * pair stays together no matter which directory the command is pointed at.
 */
const TEMPLATES_DIR = path.resolve(__dirname, '..', 'scaffold');

const ENV_EXAMPLE = '.env.example';

interface RecordSpec {
  /** Path relative to the vault root. */
  rel: string;
  /** Template file to copy, or null for content generated here. */
  template: string | null;
  /** Builds the content for a generated record. */
  build?: (today: string) => string;
}

const RECORDS: RecordSpec[] = [
  { rel: 'memory.md', template: 'memory.template.md' },
  { rel: 'handoff.md', template: 'handoff.template.md' },
  { rel: path.join('00-Private', 'SOUL.md'), template: 'profile.template.md' },
  { rel: DUMP_PATH, template: null, build: buildCaptureDump },
];

function usage(): string {
  return [
    'vault-init — create the private records a fresh clone is missing',
    '',
    'Usage:',
    '  npm run init:vault -- [--root <dir>] [--dry-run] [--env] [--show-paths]',
    '',
    'Options:',
    '  --root <dir>  Vault to initialize. Defaults to the working directory.',
    '  --dry-run     Print what would be created and write nothing.',
    '  --env         Also copy .env.example to .env when .env is absent.',
    '  --show-paths  Print the absolute target path (diagnostics). Output is relative by',
    '                default, because it is routinely pasted into an issue.',
    '  -h, --help    This text.',
    '',
    'Existing files are never overwritten. Running it twice is a no-op.',
  ].join('\n');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The capture dump's scaffold is generated from the triage parser's own constants rather
 * than restated, so the tokens it advertises cannot drift from the tokens that get filed.
 *
 * Note the format constraint: `parseCaptureLine` treats any line matching /^\s*-\s+\S/ that
 * also carries a route token as a capture to file. Every list and example here is therefore
 * prose, and the worked examples live below the archive heading, where the parser stops
 * reading. A bullet containing `#do` above that heading would be filed as a real task on the
 * first sweep.
 */
function buildCaptureDump(created: string): string {
  const tokens = Object.keys(ROUTES)
    .map((token) => `#${token}`)
    .join(', ');

  return [
    '---',
    `created: ${created}`,
    `updated: ${created}`,
    'type: capture',
    'status: active',
    'area: inbox',
    'tags:',
    '  - type/capture',
    '  - area/inbox',
    '  - status/active',
    '---',
    '',
    '# 📥 Quick Capture Dump',
    '',
    'Append one capture per line, above the archive heading, in the form of a bullet whose',
    'text ends with a destination token. Anything above the archive heading that is not a',
    `bulleted capture line is ignored — including this paragraph. Available tokens are: ${tokens}.`,
    '',
    'Run the triage sweep to file everything above the archive heading and rewrite this file.',
    'Captures are archived below it as struck-through entries naming where each one went.',
    '',
    TRIAGED_HEADING,
    '',
    'Worked examples, kept below the heading so the sweep never files them:',
    '',
    '> - Replace the failing drive #do',
    '> - Backoff never jitters, so thundering herds still collide #dev',
    '',
  ].join('\n');
}

interface Options {
  root: string;
  dryRun: boolean;
  withEnv: boolean;
  showPaths: boolean;
}

function parseArgs(argv: string[]): Options | { help: true } | { error: string } {
  let root = process.cwd();
  let dryRun = false;
  let withEnv = false;
  let showPaths = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--env') {
      withEnv = true;
      continue;
    }
    if (arg === '--show-paths') {
      showPaths = true;
      continue;
    }
    if (arg === '--root') {
      const value = argv[i + 1];
      if (!value) return { error: '--root requires a directory' };
      root = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--root=')) {
      root = arg.slice('--root='.length);
      if (!root) return { error: '--root requires a directory' };
      continue;
    }
    return { error: `unknown argument: ${arg}` };
  }

  return { root: path.resolve(root), dryRun, withEnv, showPaths };
}

/**
 * How a target is named in output. The absolute path is opt-in (`--show-paths`): this output is
 * routinely pasted into a chat or an issue, and an absolute vault path publishes the user's
 * filesystem layout along with it. The relative form is what a reader can act on, and when the
 * two are on different drives `path.relative` cannot express it, so the folder name is the most
 * that is shown by default.
 */
function describeTarget(root: string, showPaths: boolean): string {
  if (showPaths) return root;
  const relative = path.relative(process.cwd(), root);
  if (relative === '') return '.';
  return path.isAbsolute(relative) ? path.basename(root) : relative;
}

/**
/**
 * Refusals are explicit and name the target, because the failure mode this guards against is
 * creating vault files in a directory the user did not mean to name — including a parent
 * directory reached by guessing. The refusal is returned as a STRUCTURE rather than a string,
 * so the caller decides how much of the path to show; the default is the relative form, for the
 * reason in `describeTarget`.
 */
type Refusal =
  | { reason: 'not a directory' }
  | { reason: 'refusing to initialize the filesystem root' }
  | { reason: 'refusing to initialize a Git directory' }
  | { reason: 'not writable' }
  | { reason: 'not a vault'; missing: string[] };

function validateTarget(root: string): Refusal | null {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return { reason: 'not a directory' };
  }
  if (root === path.parse(root).root) {
    return { reason: 'refusing to initialize the filesystem root' };
  }
  if (path.basename(root) === '.git') {
    return { reason: 'refusing to initialize a Git directory' };
  }
  try {
    fs.accessSync(root, fs.constants.W_OK);
  } catch {
    return { reason: 'not writable' };
  }

  const missing = REQUIRED_MARKERS.filter((marker) => !fs.existsSync(path.join(root, marker)));
  if (missing.length > 0) {
    return { reason: 'not a vault', missing };
  }
  return null;
}

type Status = 'created' | 'exists' | 'would create' | 'failed';

const STATUS_LABEL: Record<Status, string> = {
  created: 'created     ',
  exists: 'exists      ',
  'would create': 'would create',
  failed: 'failed      ',
};

function readTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
}

function writeExclusive(absolute: string, contents: string): Status {
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  try {
    // 'wx' is the whole safety story: it fails rather than truncates when the path exists.
    fs.writeFileSync(absolute, contents, { flag: 'wx' });
    return 'created';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'exists';
    throw error;
  }
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));

  if ('help' in parsed) {
    console.log(usage());
    return;
  }
  if ('error' in parsed) {
    console.error(`vault-init: ${parsed.error}`);
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  const { root, dryRun, withEnv, showPaths } = parsed;
  const failure = validateTarget(root);
  if (failure) {
    const detail =
      failure.reason === 'not a vault'
        ? `not a vault: missing ${failure.missing.join(', ')}`
        : failure.reason;
    console.error(`vault-init: ${detail}: ${describeTarget(root, showPaths)}`);
    console.error('   Nothing was written. Point --root at a vault, or run this from one.');
    process.exitCode = 1;
    return;
  }

  const created = today();
  const results: Array<{ rel: string; status: Status }> = [];

  for (const record of RECORDS) {
    const absolute = path.join(root, record.rel);
    const contents = record.build ? record.build(created) : readTemplate(record.template as string);

    if (dryRun) {
      results.push({ rel: record.rel, status: fs.existsSync(absolute) ? 'exists' : 'would create' });
      continue;
    }
    results.push({ rel: record.rel, status: writeExclusive(absolute, contents) });
  }

  if (withEnv) {
    const absolute = path.join(root, '.env');
    const example = path.join(root, ENV_EXAMPLE);
    if (!fs.existsSync(example)) {
      results.push({ rel: '.env', status: 'failed' });
      console.error(`vault-init: ${ENV_EXAMPLE} is missing, so .env was not created.`);
    } else if (dryRun) {
      results.push({ rel: '.env', status: fs.existsSync(absolute) ? 'exists' : 'would create' });
    } else {
      results.push({ rel: '.env', status: writeExclusive(absolute, fs.readFileSync(example, 'utf8')) });
    }
  }

  console.log(`🗂️  Vault root: ${describeTarget(root, showPaths)}`);
  console.log(dryRun ? '🔎 Dry run — nothing was written.' : '✍️  Create-only: existing files are left untouched.');
  console.log('');
  // Paths and status words only. File bodies are never echoed: they are the user's records,
  // and this output is routinely pasted into an issue.
  for (const result of results) {
    console.log(`   ${STATUS_LABEL[result.status]} ${result.rel}`);
  }
  console.log('');

  const made = results.filter((r) => r.status === 'created').length;
  const present = results.filter((r) => r.status === 'exists').length;
  console.log(`   ${made} created, ${present} already present.`);

  if (results.some((r) => r.status === 'failed')) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

export { buildCaptureDump, parseArgs, validateTarget, RECORDS, TEMPLATES_DIR };
