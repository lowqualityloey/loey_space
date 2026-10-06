// Git-aware path facts, for readers that must tell "absent from this checkout" apart from
// "absent, period".
//
// The vault's architecture makes that distinction load-bearing. Content folders are ignored
// wholesale and their MOCs are put back by negation (`.gitignore`: `00-Inbox/*` plus
// `!00-Inbox/_*.md`), so a tracked MOC links untracked content by design: `Home.md` and four
// MOCs link `00-Inbox/quick-capture-dump` and `01-Daily/Tasks Kanban`, both of which exist on
// the owner's machine and in no clone. A link auditor that calls those broken can never be run
// in CI, and one that ignores them silently would be hiding a real defect.
//
// The answer cannot come from the disk: in a clone the target does not exist at all, so
// `fs.existsSync` says "missing" for a link that is correct. It comes from the ignore RULES,
// which do travel with the repository, and that is why this module asks `git check-ignore`
// instead. Verified before relying on it: `check-ignore` is rule-based, so it answers for a
// path that does not exist, it honours a negated rule (the MOC is NOT ignored despite its
// folder being ignored), and it exits 128 outside a repository.
//
// Everything here degrades rather than throws. Outside a worktree there are no rules to read,
// so both sets come back empty with `available: false`, and a caller is expected to fall back
// to disk-only semantics — which is exactly what the auditor did before this existed.
import { spawnSync } from 'child_process';

// `check-ignore` echoes the paths it was given, so a very large batch would be echoed back in
// full. Chunking keeps both the argument list and the output bounded.
const MAX_PATHS_PER_CALL = 200;

export interface RepoFacts {
  // False when there is no repository, or no usable `git`. Callers must fall back.
  available: boolean;
  // Repo-relative paths of tracked markdown notes, from `git ls-files`. Paths are relative to
  // `root`, which is how the callers' own relative paths are expressed.
  trackedNotes: Set<string>;
  // The subset of the caller's candidate paths that an ignore rule excludes.
  ignored: Set<string>;
}

function git(root: string, args: string[]): { status: number | null; stdout: string } {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    // git writes `fatal: not a git repository` to stderr for the common non-repo case, and
    // that is the fallback working, not an error to show an operator.
    stdio: ['ignore', 'pipe', 'ignore']
  });
  if (result.error || typeof result.status !== 'number') return { status: null, stdout: '' };
  return { status: result.status, stdout: result.stdout ?? '' };
}

function trackedNotes(root: string): { available: boolean; paths: Set<string> } {
  // Only markdown notes are tracked here: every source of a wikilink is a `.md` note, so a
  // note's own tracked status is the only tracked status this module's callers ask about.
  const result = git(root, ['ls-files', '-z', '--', '*.md']);
  if (result.status !== 0) return { available: false, paths: new Set() };
  return {
    available: true,
    paths: new Set(result.stdout.split('\0').filter((entry) => entry.length > 0))
  };
}

function ignoredAmong(root: string, candidates: string[]): { available: boolean; ignored: Set<string> }
{
  const ignored = new Set<string>();
  if (candidates.length === 0) return { available: true, ignored };

  for (let offset = 0; offset < candidates.length; offset += MAX_PATHS_PER_CALL) {
    const batch = candidates.slice(offset, offset + MAX_PATHS_PER_CALL);
    const result = git(root, ['check-ignore', '--', ...batch]);
    // 0 = at least one path is ignored, 1 = none is. Both mean git ran and the stdout is the
    // complete answer; 128 means there is no repository.
    if (result.status !== 0 && result.status !== 1) return { available: false, ignored: new Set() };
    for (const line of result.stdout.split('\n')) {
      if (line.length > 0) ignored.add(line);
    }
  }
  return { available: true, ignored };
}

export function readRepoFacts(root: string, candidates: string[]): RepoFacts {
  const tracked = trackedNotes(root);
  if (!tracked.available) {
    return { available: false, trackedNotes: new Set(), ignored: new Set() };
  }
  const rules = ignoredAmong(root, candidates);
  if (!rules.available) {
    return { available: false, trackedNotes: new Set(), ignored: new Set() };
  }
  return { available: true, trackedNotes: tracked.paths, ignored: rules.ignored };
}
