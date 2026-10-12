/*
 * Weekly Review Extraction
 * ------------------------
 * Reading a daily note into the fields a weekly review needs.
 *
 * This was a private function inside `weekly-ai-summary.ts` and three separate
 * things about it were wrong, all measured against the owner's real notes:
 *
 *   1. It only advanced its "current section" on `## ` headings. In this vault
 *      the sections that matter are `### ` — `### \u2705 Tasks`, `### \U0001F501 Habits`,
 *      `### Wins`, `### Blockers`, `### Reflection` — so the buckets were never
 *      entered. Measured on 2026-10-06 and 2026-09-13: `completedTasks`,
 *      `unfinishedTasks`, `completedHabits`, `wins` and `blockers` were **all
 *      zero**, and `taskCompletionRate` was therefore 0 for every note. The
 *      summary had been fed dates and vitals and nothing else.
 *   2. `mood: ` (blank) was matched by `/^mood:\s*(.*)$/m`, and `\s` matches
 *      newlines, so the capture ran onto the next frontmatter line. Measured:
 *      a blank `mood` parsed as the literal string `"energy:"`, which is the
 *      name of the key below it. Absent vitals were then replaced by
 *      `parseInt(energy) || 3` and `parseFloat(sleepHours) || 7`.
 *   3. Those `|| 3` / `|| 7` / `|| 0` defaults are indistinguishable from real
 *      readings downstream, so a week where nothing was logged read as a
 *      consistent, unremarkable week. `energy: 0` was also silently promoted
 *      to 3, because `0` is falsy.
 *
 * So: values that are absent stay `null` and are excluded from averages, with
 * coverage reported next to them; and section classification follows the
 * template's actual heading levels rather than assuming one level.
 *
 * Parsing is heading-stack based: every heading of any level is tracked, and a
 * section belongs to the nearest ancestor (or itself) that names a bucket. That
 * is what makes `#### \U0001F3AF In Progress from Projects` count as tasks — it sits
 * under `### \u2705 Tasks` and names no bucket of its own — while `### Wins`, which
 * lives under `## \U0001F307 End of the Day...`, names its own and is not swallowed
 * by it.
 */

import { stripTaskMetadata } from "./markdown";

/** The template's buckets, in priority order. */
const BUCKETS: Array<[RegExp, Bucket]> = [
  [/\btasks?\b/, "tasks"],
  [/\bfocus\b/, "focus"],
  [/\bhabits?\b/, "habits"],
  [/\bwins?\b/, "wins"],
  [/\bblockers?\b/, "blockers"],
  [/\breflection\b/, "reflection"],
  [/\bideas?\b/, "ideas"],
];

export type Bucket = "tasks" | "focus" | "habits" | "wins" | "blockers" | "reflection" | "ideas";

export interface DailyEntry {
  date: string;
  /** Verbatim frontmatter value, or `null` when absent or blank. */
  mood: string | null;
  /** `null` when absent, blank, or not a number. Never defaulted. */
  energy: number | null;
  /** `null` when absent, blank, or not a number. Never defaulted. */
  sleepHours: number | null;
  completedTasks: string[];
  unfinishedTasks: string[];
  completedHabits: string[];
  wins: string[];
  blockers: string[];
  reflection: string[];
  ideas: string[];
  intentions: string[];
  /** `null` when the note carried no tasks, rather than a misleading 0. */
  taskCompletionRate: number | null;
}

function headingText(line: string): { level: number; text: string } | null {
  const match = line.match(/^(#{1,6})\s+(.*)$/);
  if (!match) return null;
  return { level: match[1].length, text: match[2].trim().toLowerCase() };
}

function bucketOf(text: string): Bucket | null {
  for (const [pattern, bucket] of BUCKETS) {
    if (pattern.test(text)) return bucket;
  }
  return null;
}

/**
 * Read one frontmatter key, without letting the match run past the line it is
 * on. The old regex used `\s*` before the capture, which spans newlines and so
 * read the next key's name as the value; this splits lines first instead.
 */
export function frontmatterValue(content: string, key: string): string | null {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return null;
  const pattern = new RegExp(`^${key}\\s*:`);
  const line = frontmatter[1].split(/\r?\n/).find((candidate) => pattern.test(candidate));
  if (!line) return null;
  const raw = line.slice(line.indexOf(":") + 1).trim();
  return raw === "" ? null : raw;
}

/** A whole-number reading, or `null`. `0` is a reading; `""` is not. */
function numericOrNull(raw: string | null, integer: boolean): number | null {
  if (raw === null) return null;
  const pattern = integer ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/;
  if (!pattern.test(raw)) return null;
  const value = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

const PLACEHOLDERS = new Set(["...", "\u2026", "none", "n/a", "unknown"]);

function isPlaceholder(text: string): boolean {
  return PLACEHOLDERS.has(text.trim().toLowerCase());
}

function push(list: string[], text: string): void {
  if (text && !isPlaceholder(text) && !list.includes(text)) list.push(text);
}

/**
 * Extract the review-relevant structure from one daily note.
 *
 * `noteDate` is the note's `YYYY-MM-DD` calendar key.
 */
export function extractDailyData(content: string, noteDate: string): DailyEntry {
  const mood = frontmatterValue(content, "mood");
  const energy = numericOrNull(frontmatterValue(content, "energy"), true);
  const sleepHours = numericOrNull(frontmatterValue(content, "sleep_hours"), false);

  const completedTasks: string[] = [];
  const unfinishedTasks: string[] = [];
  const completedHabits: string[] = [];
  const wins: string[] = [];
  const blockers: string[] = [];
  const reflection: string[] = [];
  const ideas: string[] = [];
  const intentions: string[] = [];

  // Heading stack: every level is tracked, so a `####` inherits the nearest
  // ancestor that names a bucket and a sibling `###` replaces it.
  const stack: Array<{ level: number; bucket: Bucket | null }> = [];
  const currentBucket = (): Bucket | null => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].bucket) return stack[i].bucket;
    }
    return null;
  };

  const lines = content.split(/\r?\n/);
  // Skip exactly the frontmatter block, by line index rather than by matching
  // `---` markers as they appear: a body containing a horizontal rule must not
  // be mistaken for a second frontmatter block. The block is skipped whole
  // because its tag list (`- type/daily`) is a bullet list, and a bullet list
  // must never be read as an entry under whatever section came before it.
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatterLines = frontmatter ? frontmatter[0].split(/\r?\n/).length : 0;
  let inFence = false;

  for (const [index, line] of lines.entries()) {
    if (index < frontmatterLines) continue;
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = headingText(trimmed);
    if (heading) {
      while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop();
      stack.push({ level: heading.level, bucket: bucketOf(heading.text) });
      continue;
    }

    if (!trimmed || trimmed.startsWith(">") || trimmed.startsWith("|")) continue;

    const bucket = currentBucket();
    if (!bucket) continue;

    const done = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
    const open = trimmed.match(/^\s*-\s*\[ \]\s+(.*)$/);
    const bullet = trimmed.match(/^\s*-\s+(.*)$/);

    if (bucket === "tasks") {
      if (done) push(completedTasks, done[1].trim());
      else if (open) push(unfinishedTasks, open[1].trim());
      continue;
    }
    if (bucket === "habits") {
      // Only ticked habits are completions; an unticked habit line is not a
      // failure, and treating one as such is how a bad week gets invented.
      if (done) push(completedHabits, stripTaskMetadata(done[1].trim()));
      continue;
    }
    if (bucket === "focus") {
      // Intentions are written as plain bullets by the morning protocol.
      if (bullet) push(intentions, stripTaskMetadata(bullet[1].trim()));
      continue;
    }

    if (bullet) {
      const text = stripTaskMetadata(bullet[1].trim());
      if (bucket === "wins") push(wins, text);
      else if (bucket === "blockers") push(blockers, text);
      else if (bucket === "reflection") push(reflection, text);
      else if (bucket === "ideas") push(ideas, text);
    }
  }

  const taskTotal = completedTasks.length + unfinishedTasks.length;

  return {
    date: noteDate,
    mood,
    energy,
    sleepHours,
    completedTasks,
    unfinishedTasks,
    completedHabits,
    wins,
    blockers,
    reflection,
    ideas,
    intentions,
    // `null` rather than `0`: a note with no tasks has no completion rate, and
    // the old `0 / 0 || 0` reported "0% complete" for exactly those notes.
    taskCompletionRate: taskTotal === 0 ? null : completedTasks.length / taskTotal,
  };
}

export interface Aggregate<T> {
  known: number;
  unknown: number;
  total: number;
  average: T | null;
  /** e.g. `3/7 notes declared energy` — reported wherever the average is. */
  coverage: string;
}

function aggregate(values: Array<number | null>, label: string): Aggregate<number> {
  const known = values.filter((value): value is number => value !== null);
  const total = values.length;
  const average =
    known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length;
  return {
    known: known.length,
    unknown: total - known.length,
    total,
    average: average === null ? null : Math.round(average * 100) / 100,
    coverage: `${known.length}/${total} note(s) declared ${label}`,
  };
}

export interface WeekSummary {
  notes: number;
  energy: Aggregate<number>;
  sleepHours: Aggregate<number>;
  moods: string[];
  tasks: { completed: number; unfinished: number; completionRate: number | null };
  habits: {
    completed: number;
    observedDays: number;
    unobservedNotes: number;
    missingDays: number;
    coverage: string;
    completedChecks: number;
    observedOpportunities: number;
    completionRate: number | null;
  };
  habitTrends: HabitTrendReport;
  commitmentTriage: MorningCommitmentTriage;
  entries: { wins: number; blockers: number; reflection: number };
}

/**
 * Summarise a week, excluding unknown readings from every average.
 *
 * The point of the return shape is that `average` and `coverage` travel
 * together: a mean over two logged days and the same mean over seven are the
 * same number and different facts, and only the pair says which one it is.
 */
export function summarizeWeek(
  entries: DailyEntry[],
  windowDays = 7,
  options?: { pendingTodayDate?: string }
): WeekSummary {
  const tasks = {
    completed: entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0),
    unfinished: entries.reduce((sum, entry) => sum + entry.unfinishedTasks.length, 0),
  };

  const rated = entries
    .map((entry) => entry.taskCompletionRate)
    .filter((rate): rate is number => rate !== null);

  const habitTrends = analyzeHabitTrends(entries, windowDays, options);
  const openTaskLines = Array.from(
    new Set(
      entries.flatMap((entry) =>
        entry.unfinishedTasks.map((t) => (t.startsWith("- [") ? t : `- [ ] ${t}`))
      )
    )
  );
  const commitmentTriage = triageDailyCommitments(openTaskLines, 3);

  return {
    notes: entries.length,
    energy: aggregate(entries.map((entry) => entry.energy), "energy"),
    sleepHours: aggregate(entries.map((entry) => entry.sleepHours), "sleep_hours"),
    moods: Array.from(new Set(entries.map((entry) => entry.mood).filter((m): m is string => m !== null))),
    tasks: {
      completed: tasks.completed,
      unfinished: tasks.unfinished,
      completionRate:
        rated.length === 0
          ? null
          : Math.round((rated.reduce((sum, rate) => sum + rate, 0) / rated.length) * 100) / 100,
    },
    habits: {
      completed: entries.reduce((sum, entry) => sum + entry.completedHabits.length, 0),
      observedDays: habitTrends.observedDays,
      unobservedNotes: habitTrends.unobservedNotes,
      missingDays: habitTrends.missingDays,
      coverage: habitTrends.coverage,
      completedChecks: habitTrends.overall.completedChecks,
      observedOpportunities: habitTrends.overall.observedOpportunities,
      completionRate: habitTrends.overall.rate,
    },
    habitTrends,
    commitmentTriage,
    entries: {
      wins: entries.reduce((sum, entry) => sum + entry.wins.length, 0),
      blockers: entries.reduce((sum, entry) => sum + entry.blockers.length, 0),
      reflection: entries.reduce((sum, entry) => sum + entry.reflection.length, 0),
    },
  };
}

/** One line stating what the week's averages rest on. */
export function describeWeekCoverage(summary: WeekSummary): string {
  return (
    `**Vitals coverage**: energy ${summary.energy.coverage}; sleep ${summary.sleepHours.coverage}` +
    (summary.moods.length ? `; mood recorded: ${summary.moods.join(", ")}` : "; no mood recorded")
  );
}

/** One line stating what the week's habit rates rest on, separating habit reviews from morning-only/unobserved notes. */
export function describeHabitCoverage(report: HabitTrendReport): string {
  const pct = report.overall.rate === null ? "n/a" : `${Math.round(report.overall.rate * 100)}%`;
  const parts = [
    `**Habit review coverage**: ${report.coverage} day(s) with completed habit review`,
    report.overall.observedOpportunities > 0
      ? `${report.overall.completedChecks}/${report.overall.observedOpportunities} habit checks (${pct})`
      : "0 observed habit opportunities (unreviewed habits stay unknown)",
  ];
  if (report.unobservedNotes > 0) {
    parts.push(`${report.unobservedNotes} morning-only/unobserved note(s) excluded from denominator`);
  }
  if (report.missingDays > 0) {
    parts.push(`${report.missingDays} unlogged day(s)`);
  }
  if (report.tentative) {
    parts.push("tentative (sparse coverage < 4 observed days)");
  }
  return parts.join("; ");
}

/** Render a static Markdown summary of evidence-proportional habit rates for the weekly review note. */
export function formatHabitTrendsMarkdown(report: HabitTrendReport): string {
  const lines: string[] = [describeHabitCoverage(report)];
  if (report.observedDays > 0) {
    const perHabitSummary = CORE_HABITS.map((habit) => {
      const h = report.perHabit[habit];
      const pct = h.rate === null ? "n/a" : `${Math.round(h.rate * 100)}%`;
      return `\`${habit}\` ${h.completedDays}/${h.observedDays} (${pct})`;
    }).join(" · ");
    lines.push(`**Per-habit completion (over ${report.observedDays} observed day(s))**: ${perHabitSummary}`);
  }
  if (report.burnoutRisk.flagged) {
    lines.push(
      `> [!WARNING] Burnout / Sleep-Debt Signal\n> Detected ${report.burnoutRisk.maxConsecutiveCalendarDays} consecutive calendar days of low energy/sleep or depleted mood (${report.burnoutRisk.streakDates.join(", ")}).`
    );
  }
  return lines.join("\n\n");
}

export const CORE_HABITS = ["water", "prioritised", "move", "read", "tidy", "disconnect"] as const;
export type CoreHabit = (typeof CORE_HABITS)[number];

/**
 * The 5 habits reviewed during the evening wind-down (`heyloey evening`) or
 * daytime tracking. `prioritised` is excluded here because `heyloey morning`
 * checks `- [x] prioritised` automatically during morning kick-off before the
 * day's habits have been lived or reviewed.
 */
const EVENING_REVIEW_HABITS = new Set(["water", "move", "read", "tidy", "disconnect"]);

const DEPLETED_MOODS = new Set(["tired", "stressed", "exhausted", "restless"]);

/**
 * Determine whether a daily note entry has evidence of a completed **habit review**,
 * separate from a morning check-in (`mood`, `energy`, `sleep_hours`, `Today's Focus`,
 * and auto-checked `- [x] prioritised`).
 *
 * - An untouched scaffolded note has no habit review (`false`).
 * - A morning-only note (vitals + intentions + only `prioritised` checked, with no
 *   other habits checked and no evening `Wins`/`Blockers`/`Reflection`) has NOT
 *   undergone a habit review (`false`), so the other 5 habits stay unknown rather
 *   than counting as 5 missed habits (1/6 = 17%).
 * - If `pendingTodayDate` matches `entry.date`, today's note is still in progress
 *   unless evening reflections (`Wins`/`Blockers`/`Reflection`) or all 6 habits are
 *   already recorded.
 */
export function isObservedDailyEntry(
  entry: DailyEntry,
  options?: { pendingTodayDate?: string }
): boolean {
  const hasEveningReflection =
    entry.wins.length > 0 || entry.blockers.length > 0 || entry.reflection.length > 0;
  const hasNonMorningHabit = entry.completedHabits.some((h) =>
    EVENING_REVIEW_HABITS.has(h.trim().toLowerCase())
  );

  if (options?.pendingTodayDate && entry.date === options.pendingTodayDate) {
    const allSixChecked = CORE_HABITS.every((habit) =>
      entry.completedHabits.some((h) => h.trim().toLowerCase() === habit)
    );
    return hasEveningReflection || allSixChecked;
  }

  return hasNonMorningHabit || hasEveningReflection;
}

function hasVitalsEvidence(entry: DailyEntry): boolean {
  return entry.mood !== null || entry.energy !== null || entry.sleepHours !== null;
}

function diffCalendarDays(dateA: string, dateB: string): number | null {
  const matchA = dateA.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const matchB = dateB.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matchA || !matchB) return null;
  const utcA = Date.UTC(Number(matchA[1]), Number(matchA[2]) - 1, Number(matchA[3]));
  const utcB = Date.UTC(Number(matchB[1]), Number(matchB[2]) - 1, Number(matchB[3]));
  return Math.round((utcB - utcA) / 86400000);
}

function isBurnoutDay(entry: DailyEntry): boolean {
  if (entry.energy !== null && entry.energy <= 2) return true;
  if (entry.sleepHours !== null && entry.sleepHours < 6) return true;
  if (entry.mood !== null && DEPLETED_MOODS.has(entry.mood.trim().toLowerCase())) return true;
  return false;
}

export interface HabitRate {
  completedDays: number;
  observedDays: number;
  rate: number | null;
}

export interface HabitTrendReport {
  windowDays: number;
  observedDays: number;
  unobservedNotes: number;
  missingDays: number;
  coverage: string;
  perHabit: Record<CoreHabit, HabitRate>;
  overall: {
    completedChecks: number;
    observedOpportunities: number;
    rate: number | null;
  };
  burnoutRisk: {
    flagged: boolean;
    maxConsecutiveCalendarDays: number;
    streakDates: string[];
  };
  tentative: boolean;
}

/**
 * Evidence-proportional habit & burnout analysis across a calendar window:
 * - Distinguishes missing dates, untouched scaffolded notes, and morning-only notes from confirmed habit reviews.
 * - Uses `completedDays / observedDays` per habit and `completedChecks / (6 * observedDays)` overall.
 * - Evaluates burnout risk across all notes with vitals evidence requiring >= 3 consecutive *calendar* days.
 */
export function analyzeHabitTrends(
  entries: DailyEntry[],
  windowDays = 7,
  options?: { pendingTodayDate?: string }
): HabitTrendReport {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const observedEntries = sorted.filter((entry) => isObservedDailyEntry(entry, options));
  const observedDays = observedEntries.length;
  const unobservedNotes = sorted.length - observedDays;
  const missingDays = Math.max(0, windowDays - sorted.length);

  const perHabit = {} as Record<CoreHabit, HabitRate>;
  let completedChecks = 0;

  for (const habit of CORE_HABITS) {
    const completedDays = observedEntries.filter((entry) =>
      entry.completedHabits.some((h) => h.trim().toLowerCase() === habit)
    ).length;
    completedChecks += completedDays;
    perHabit[habit] = {
      completedDays,
      observedDays,
      rate: observedDays === 0 ? null : Math.round((completedDays / observedDays) * 100) / 100,
    };
  }

  const observedOpportunities = CORE_HABITS.length * observedDays;
  const overallRate =
    observedOpportunities === 0
      ? null
      : Math.round((completedChecks / observedOpportunities) * 100) / 100;

  const vitalsEntries = sorted.filter(
    (entry) => hasVitalsEvidence(entry) || isObservedDailyEntry(entry, options)
  );
  let currentStreak: string[] = [];
  let bestStreak: string[] = [];

  for (const entry of vitalsEntries) {
    if (!isBurnoutDay(entry)) {
      currentStreak = [];
      continue;
    }
    if (currentStreak.length === 0) {
      currentStreak = [entry.date];
    } else {
      const prevDate = currentStreak[currentStreak.length - 1];
      if (diffCalendarDays(prevDate, entry.date) === 1) {
        currentStreak.push(entry.date);
      } else {
        currentStreak = [entry.date];
      }
    }
    if (currentStreak.length > bestStreak.length) {
      bestStreak = [...currentStreak];
    }
  }

  return {
    windowDays,
    observedDays,
    unobservedNotes,
    missingDays,
    coverage: `${observedDays}/${windowDays}`,
    perHabit,
    overall: {
      completedChecks,
      observedOpportunities,
      rate: overallRate,
    },
    burnoutRisk: {
      flagged: bestStreak.length >= 3,
      maxConsecutiveCalendarDays: bestStreak.length,
      streakDates: bestStreak,
    },
    tentative: observedDays < 4,
  };
}

export interface DeferredCommitment {
  task: string;
  destinationKind: "project" | "personal" | "standalone";
  destination: string;
}

export interface MorningCommitmentTriage {
  selected: string[];
  deferred: DeferredCommitment[];
}

function taskPriorityRank(task: string): number {
  const isInProgress = /^\s*-\s*\[\/\]/.test(task);
  const pMatch = task.match(/#priority\/p([0-3])\b/i);
  const pLevel = pMatch ? Number(pMatch[1]) : 4;
  return (isInProgress ? 0 : 10) + pLevel;
}

function resolveDeferredHome(task: string): {
  destinationKind: "project" | "personal" | "standalone";
  destination: string;
} {
  const kanbanLink = task.match(/\[\[(?:02-Projects\/[^\]|]+\/)?([^\]|/]+?)\s+Kanban(?:\|[^\]]+)?\]\]/i);
  if (kanbanLink) {
    const project = kanbanLink[1].trim();
    return {
      destinationKind: "project",
      destination: `02-Projects/${project}/${project} Kanban.md`,
    };
  }
  const projectTag = task.match(/#project\/([a-z0-9_-]+)/i);
  if (projectTag) {
    const project = projectTag[1];
    return {
      destinationKind: "project",
      destination: `02-Projects/${project}/${project} Kanban.md`,
    };
  }
  if (/#(?:area\/)?personal\b/i.test(task)) {
    return {
      destinationKind: "personal",
      destination: "05-Personal/",
    };
  }
  return {
    destinationKind: "standalone",
    destination: "01-Daily/Tasks Kanban.md",
  };
}

/**
 * Cap active daily commitments at `limit` (default 3) while keeping every
 * remaining carried-forward task recoverable in its appropriate home
 * (project board vs. personal vs. standalone Tasks Kanban).
 */
export function triageDailyCommitments(tasks: string[], limit = 3): MorningCommitmentTriage {
  const indexed = tasks.map((task, index) => ({
    task,
    index,
    rank: taskPriorityRank(task),
  }));

  indexed.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index));

  const selectedSet = new Set(indexed.slice(0, Math.max(0, limit)).map((item) => item.index));
  const selected: string[] = [];
  const deferred: DeferredCommitment[] = [];

  tasks.forEach((task, idx) => {
    if (selectedSet.has(idx)) {
      selected.push(task);
    } else {
      const home = resolveDeferredHome(task);
      deferred.push({ task, ...home });
    }
  });

  return { selected, deferred };
}
