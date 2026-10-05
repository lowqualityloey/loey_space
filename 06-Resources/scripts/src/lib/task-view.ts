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
export function isVisible(task: TaskLike): boolean {
  if (isShielded(task)) return false;
  if (task.parent !== undefined && task.parent !== null) return false;
  if (requiresPromotion(task.path) && !isPromoted(task)) return false;
  return true;
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
    requiresPromotion,
    isShielded,
    isPromoted,
    isVisible,
    taskIdentity,
    displayText,
    taskSource,
    collectVisibleTasks,
    normalizeTask
  };
}