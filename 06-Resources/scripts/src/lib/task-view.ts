/**
 * Shared task-view selection rules.
 *
 * Central task views (Home.md, 01-Daily/_Tasks MOC.md) previously carried their
 * filtering logic inline in dataviewjs, where nothing could be unit tested. The
 * rules now live here so both the vault views and the test suite consume the
 * same behaviour.
 *
 * The contract has one driving constraint: personal and learning notes are full
 * of checkboxes that are not commitments — syllabus milestones, worked
 * examples, reference links, habits. Surfacing all of them would flood the daily
 * flow, so visibility is strictly opt-in via PROMOTION_TAG, and a handful of
 * sections stay shielded even when they carry that marker.
 */

/** Marker that promotes a checkbox into the central task views. */
export const PROMOTION_TAG = "#promote";

/**
 * Shield applied everywhere.
 *
 * The existing views already skip habit, backlog and archive subsections, and
 * those exclusions are load-bearing across the whole vault.
 */
export const CORE_SHIELD_KEYWORDS: readonly string[] = ["habit", "backlog", "archive"];

/**
 * Extra shields for opt-in folders only.
 *
 * Learning and Personal notes are teaching and record-keeping documents whose
 * checkboxes are milestones, examples and links rather than commitments. These
 * are deliberately NOT applied to Daily notes or project boards: a project may
 * legitimately keep tasks under "Examples" or "References", and shielding those
 * would hide work that is visible today.
 */
export const OPT_IN_SHIELD_KEYWORDS: readonly string[] = [
  ...CORE_SHIELD_KEYWORDS,
  "syllabus",
  "reference",
  "auto-backlink",
  "module",
  "example"
];

/**
 * Folders whose commitments are opt-in.
 *
 * Daily notes and project boards are the existing source of truth for tasks, and
 * their checkboxes are already commitments — they must keep showing without any
 * marker, or adding this feature would empty the dashboard. Learning and Personal
 * notes are different: they are full of checkboxes that are not commitments, so
 * visibility there is opt-in.
 */
export const PROMOTION_REQUIRED_PREFIXES: readonly string[] = ["04-Learning", "05-Personal"];

/** True when a note's commitments need the explicit marker to be visible. */
export function requiresPromotion(path: string): boolean {
  return PROMOTION_REQUIRED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Project paths: the lifecycle authority (#119).
 *
 * A project is a folder under 02-Projects/ holding a master note and its
 * companion board. Only the board's cards are commitments; the master note's
 * checklist items are the project's acceptance criteria, attached to the
 * project rather than surfaced as commitments of their own.
 */
export const PROJECT_ROOT = "02-Projects/";

/** True when the note is a project's companion Kanban board — the commitment source. */
export function isBoardCard(path: string): boolean {
  return path.startsWith(PROJECT_ROOT) && / Kanban\.md$/i.test(path);
}

/** True when the note is a project's master/hub note — the criteria source. */
export function isProjectHub(path: string): boolean {
  return path.startsWith(PROJECT_ROOT) && !isBoardCard(path) && path.endsWith(".md");
}

/** Frontmatter lifecycles that expose a project's commitments to active views. */
export const ACTIVE_LIFECYCLES: readonly string[] = [
  "active",
  "in progress",
  "in-progress",
  "doing",
  "wip"
];

/** Fold a frontmatter status into a comparable form. */
export function normalizeLifecycle(value?: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when a project's commitments may appear in the active views.
 *
 * A caller that supplies no lifecycle keeps the previous behaviour, so an
 * unwired view cannot silently empty itself; the wiring is pinned by the test
 * suite instead. `planning`, `completed` and `archived` all hold commitments
 * back — the graduation rule only opens on an active lifecycle.
 */
export function isLifecycleActive(value?: string): boolean {
  const normalized = normalizeLifecycle(value);
  if (normalized === "") return true;
  return ACTIVE_LIFECYCLES.includes(normalized);
}

/** Priority tags are bookkeeping and must not fork a commitment's identity. */
const PRIORITY_TAG = /#priority\/[^\s]+/gi;

/** A task in the normalised shape the vault layer passes in. */
export interface TaskLike {
  text: string;
  status?: string;
  section?: string;
  path: string;
  line?: number;
  parent?: number | null;
  /**
   * The caller's original object, carried through untouched so a view can hand
   * the raw dataview task back to dv.taskList and keep its checkbox clickable.
   */
  raw?: unknown;
}

/** Where a visible action came from, for traceability back to its note. */
export interface TaskSource {
  path: string;
  line?: number;
}

/**
 * True when the task sits in a shielded section.
 *
 * Opt-in folders get the wider shield, because that is where non-commitment
 * checkboxes live. Daily notes and project boards keep only the exclusions the
 * views have always applied, so no task visible today becomes hidden.
 */
export function isShielded(task: TaskLike): boolean {
  const section = (task.section ?? "").toLowerCase();
  if (section === "") return false;
  const keywords = requiresPromotion(task.path) ? OPT_IN_SHIELD_KEYWORDS : CORE_SHIELD_KEYWORDS;
  return keywords.some((keyword) => section.includes(keyword));
}

/** True when the task carries the explicit promotion marker. */
export function isPromoted(task: TaskLike): boolean {
  return (task.text ?? "").toLowerCase().includes(PROMOTION_TAG);
}

/**
 * What the caller knows about where a task sits.
 *
 * `projectLifecycle` is the containing project's frontmatter status (the board's
 * status for a board card), and `lane` is the Kanban lane a card was read from.
 */
export interface TaskContext {
  projectLifecycle?: string;
  lane?: string;
}

/**
 * True when a task should appear in a central task view.
 *
 * Shielded sections and nested checklist items are always rejected: a sub-step
 * belongs to its parent commitment, which is what actually gets done.
 *
 * Promotion is scope-dependent. Learning and Personal notes require the marker
 * because their checkboxes are mostly not commitments; Daily notes and project
 * boards do not, because their checkboxes already are and requiring a marker
 * there would empty the dashboard.
 */
export function isVisible(task: TaskLike, context: TaskContext = {}): boolean {
  if (isShielded(task)) return false;
  // A lane the shield would exclude stays excluded even when the caller passes
  // it as a lane rather than as the task's enclosing heading.
  if (context.lane !== undefined && context.lane !== "" && isShielded({ ...task, section: context.lane })) {
    return false;
  }
  if (task.parent !== undefined && task.parent !== null) return false;
  if (requiresPromotion(task.path) && !isPromoted(task)) return false;

  // Project lifecycle authority: hub criteria are never commitments, and a
  // project's commitments only reach the active views once it is active.
  if (task.path.startsWith(PROJECT_ROOT)) {
    if (!isCommitment(task)) return false;
    if (!isLifecycleActive(context.projectLifecycle)) return false;
  }

  return true;
}

/**
 * True when a task is a commitment rather than a nested acceptance criterion.
 *
 * A project's board cards are its commitments. The same project's master-note
 * checklist items are criteria: they belong to a commitment (or to the project)
 * and are reported as such, never as commitments in their own right.
 */
export function isCommitment(task: TaskLike): boolean {
  return !isProjectHub(task.path);
}

/** True when the task is checked off. */
export function isDone(task: TaskLike): boolean {
  return String(task.status ?? "").toLowerCase() === "x";
}

/** One level's progress counters. */
export interface ProgressCount {
  done: number;
  total: number;
}

/** Commitment progress and criterion progress, always reported apart. */
export interface ProgressSummary {
  commitments: ProgressCount;
  criteria: ProgressCount;
}

/**
 * Count progress per level, never as one blended ratio.
 *
 * Commitments obey the same visibility rules as the views, so a planning
 * project reports zero commitment progress while its criteria are still
 * counted — which is what makes the two levels comparable instead of conflated.
 */
export function summarizeProgress(
  tasks: readonly TaskLike[],
  context: TaskContext = {}
): ProgressSummary {
  const commitments: ProgressCount = { done: 0, total: 0 };
  const criteria: ProgressCount = { done: 0, total: 0 };

  for (const task of tasks) {
    if (isShielded(task)) continue;

    if (!isCommitment(task)) {
      criteria.total += 1;
      if (isDone(task)) criteria.done += 1;
      continue;
    }

    if (!isVisible(task, context)) continue;
    commitments.total += 1;
    if (isDone(task)) commitments.done += 1;
  }

  return { commitments, criteria };
}

/**
 * Stable identity for a commitment.
 *
 * Strips the promotion marker, priority tags, wikilinks and punctuation, and
 * folds case and whitespace, so the same commitment reached through a daily
 * note and its source note collapses to one entry.
 */
export function taskIdentity(task: TaskLike): string {
  return String(task.text ?? "")
    .toLowerCase()
    .replaceAll(PROMOTION_TAG, " ")
    .replace(PRIORITY_TAG, " ")
    .replace(/\[\[[^\]]+\]\]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text as rendered in a view: the promotion marker is bookkeeping. */
export function displayText(task: TaskLike): string {
  return String(task.text ?? "")
    .replaceAll(PROMOTION_TAG, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Source reference for a visible action. */
export function taskSource(task: TaskLike): TaskSource {
  return { path: task.path, line: task.line };
}

/**
 * Select the tasks a central view should render, de-duplicated by identity.
 *
 * The first occurrence wins, so when a commitment is mirrored into a daily note
 * the view points back at wherever it was seen first.
 */
export function collectVisibleTasks(tasks: readonly TaskLike[]): TaskLike[] {
  const seen = new Set<string>();
  const visible: TaskLike[] = [];

  for (const task of tasks) {
    if (!isVisible(task)) continue;
    const key = taskIdentity(task);
    if (key === "") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    visible.push(task);
  }

  return visible;
}



/**
 * Normalise a raw dataview task into the shape this module works with.
 *
 * Dataview exposes the enclosing heading as `header.subpath` and the containing
 * line as `line`; absent values are tolerated so callers can pass partial
 * objects without defensive noise at every call site.
 */
export function normalizeTask(
  raw: {
    text?: string;
    status?: string;
    header?: { subpath?: string };
    file?: { path?: string };
    line?: number;
    parent?: number | null;
  },
  fallbackPath = ""
): TaskLike {
  return {
    text: raw.text ?? "",
    status: raw.status ?? " ",
    section: raw.header?.subpath ?? "",
    path: raw.file?.path ?? fallbackPath,
    line: raw.line,
    parent: raw.parent ?? null,
    raw
  };
}

/**
 * Publish the API for dataviewjs callers.
 *
 * Dataview evaluates `dv.load()` scripts without a module system, so the views
 * read these names off globalThis. Attaching them keeps a single source of
 * truth for the rules instead of re-implementing them per view.
 */
export function installOnGlobal(scope: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): void {
  scope.TaskView = {
    PROMOTION_TAG,
    CORE_SHIELD_KEYWORDS,
    OPT_IN_SHIELD_KEYWORDS,
    PROMOTION_REQUIRED_PREFIXES,
    PROJECT_ROOT,
    ACTIVE_LIFECYCLES,
    requiresPromotion,
    isShielded,
    isPromoted,
    isVisible,
    isBoardCard,
    isProjectHub,
    normalizeLifecycle,
    isLifecycleActive,
    isCommitment,
    isDone,
    summarizeProgress,
    taskIdentity,
    displayText,
    taskSource,
    collectVisibleTasks,
    normalizeTask
  };
}