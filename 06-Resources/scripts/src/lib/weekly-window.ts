/*
 * Weekly Review Window
 * --------------------
 * Which daily notes a "last 7 days" summary is allowed to read.
 *
 * The shipped selector was `getMarkdownFiles().filter(path startsWith 01-Daily/
 * && !name.includes("MOC")).sort(by name desc).slice(0, 7)`. Three things were
 * wrong with it, and only the first is visible in the code:
 *
 *   1. It selected seven note *files*, never a range of dates. With a gap in
 *      logging the selection reached back past the period it claimed.
 *      Measured on the owner's vault (2026-10-06): the seven selected notes
 *      spanned 2026-09-11 -> 2026-10-06, twenty-six days, under a heading
 *      that says seven.
 *   2. The filter excluded only names containing "MOC". `01-Daily/Tasks Kanban.md`
 *      contains none, and because the comparator was a descending
 *      `localeCompare` — where a letter sorts above a digit — the task board
 *      came FIRST. One of seven slots summarised a task board as a day.
 *   3. A sparse week silently borrowed older notes to fill the seven slots, so
 *      "7 days" reported a week that was never logged.
 *
 * So the window is the authority here, not a count of files: the dates are
 * derived first, and a note is selected only because a date in the window
 * resolves to its path. Sparse weeks therefore yield FEWER notes rather than
 * older ones, which is the honest reading and is disclosed by
 * `describeCoverage`.
 *
 * The path for a date comes from `resolveDailyNoteFile`, so this module never
 * re-derives the vault's layout — `01-Daily/YYYY-MM/YYYY-MM-DD.md` is defined
 * in one place (#60). Date arithmetic is local-calendar, the same rule #55
 * applied to the habit dashboard: thirty days is today plus the twenty-nine
 * before it, and a window is inclusive of today at both ends of its name.
 */

import {
  DEFAULT_DAILY_NOTES_CONFIG,
  formatDate,
  resolveDailyNoteFile,
  type DailyNotesConfig,
} from "./daily-note";

/** Calendar days a weekly review spans, today included. */
export const DEFAULT_WEEK_DAYS = 7;

export interface WeeklyWindow {
  /** Inclusive first day, `YYYY-MM-DD`. */
  startDate: string;
  /** Inclusive last day, `YYYY-MM-DD` (today). */
  endDate: string;
  /** Calendar days the window spans. */
  days: number;
  /** IANA zone the window was computed in. */
  timeZone: string;
  /** Every calendar day in the window, oldest first. */
  dateKeys: string[];
}

/** A vault file, reduced to what selection needs. */
export interface VaultFileLike {
  path: string;
}

/** The `YYYY-MM-DD` calendar key of a date, read in local time. */
export function localDateKey(date: Date): string {
  return formatDate(date, "YYYY-MM-DD");
}

/**
 * The zone the window is expressed in. `Intl` on an exotic runtime can refuse
 * to answer, and a review that silently claimed UTC would be wrong in a way
 * nobody would notice, so the fallback says so in words.
 */
export function resolveTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || "local (IANA zone unavailable)";
  } catch {
    return "local (IANA zone unavailable)";
  }
}

/**
 * Build the window ending on `today`, inclusive of both ends. The subtraction
 * is `days - 1` because seven calendar days is today plus the six before it.
 */
export function buildWeeklyWindow(
  today: Date,
  days: number = DEFAULT_WEEK_DAYS,
  timeZone: string = resolveTimeZone(),
): WeeklyWindow {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`buildWeeklyWindow: days must be a positive integer, received "${days}"`);
  }

  const dateKeys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    // Rebuilt from local components each step (rather than subtracting
    // milliseconds) so a DST change shifts the clock, not the calendar day.
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    dateKeys.push(localDateKey(day));
  }

  return {
    startDate: dateKeys[0],
    endDate: dateKeys[dateKeys.length - 1],
    days,
    timeZone,
    dateKeys,
  };
}

/** The vault paths a window expects, one per calendar day. */
export function windowPaths(
  window: WeeklyWindow,
  config: DailyNotesConfig = DEFAULT_DAILY_NOTES_CONFIG,
): string[] {
  return window.dateKeys.map((key) => resolveDailyNoteFile(key, config));
}

/**
 * Select the daily notes inside the window, newest first.
 *
 * Membership is decided by the window's own paths, so a task board, a MOC, a
 * note dated outside the window, and a note in the wrong folder are excluded
 * by construction rather than by a name blocklist that has to be kept current.
 */
export function selectWeeklyNotes<T extends VaultFileLike>(
  files: T[],
  window: WeeklyWindow,
  config: DailyNotesConfig = DEFAULT_DAILY_NOTES_CONFIG,
): T[] {
  const wanted = new Map<string, number>();
  windowPaths(window, config).forEach((path, index) => wanted.set(path, index));

  return files
    .filter((file) => wanted.has(file.path))
    .sort((a, b) => wanted.get(b.path)! - wanted.get(a.path)!);
}

/**
 * Disclose how much of the window the notes actually cover.
 *
 * Printed before the numbers it qualifies, and it counts missing days as
 * unknown: a rate over two logged days and the same rate over seven are the
 * same figure and different facts.
 */
export function describeCoverage(window: WeeklyWindow, selectedCount: number): string {
  const missing = window.days - selectedCount;
  const tail =
    missing === 0
      ? "every calendar day in the window has a daily note"
      : `${missing} day(s) have no daily note, which is unknown rather than zero`;

  return (
    `**Coverage**: ${selectedCount}/${window.days} calendar days logged ` +
    `(${window.startDate} to ${window.endDate}, ${window.timeZone}) \u2014 ${tail}.`
  );
}
