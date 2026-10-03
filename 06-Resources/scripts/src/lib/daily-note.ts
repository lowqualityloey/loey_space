/*
 * Daily Note Path Resolver
 * -----------------------
 * One place that knows where a dated daily note lives.
 *
 * The vault's Obsidian daily-notes config uses format "YYYY-MM/YYYY-MM-DD"
 * under folder "01-Daily", so a dated note is 01-Daily/2026-10/2026-10-04.md.
 * Hardcoding a flat 01-Daily/2026-10-04.md silently misses the real note, which
 * is why task routing previously reported "no daily note" for notes that
 * existed.
 *
 * Observed config wins; the defaults below match this vault's
 * .obsidian/daily-notes.json and are used when it cannot be read.
 */

export interface DailyNotesConfig {
  folder: string;
  format: string;
}

export const DEFAULT_DAILY_NOTES_CONFIG: DailyNotesConfig = {
  folder: "01-Daily",
  format: "YYYY-MM/YYYY-MM-DD",
};

/** Path of the config file inside the vault. */
export const DAILY_NOTES_CONFIG_PATH = ".obsidian/daily-notes.json";

/**
 * Expand Obsidian date tokens (YYYY, MM, DD, YY) for a single date.
 * Unknown characters are passed through, so an unusual format degrades to
 * something recognisable rather than throwing.
 */
export function formatDate(date: Date, format: string): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return format
    .replace(/YYYY/g, yyyy)
    .replace(/YY/g, yyyy.slice(2))
    .replace(/MM/g, mm)
    .replace(/DD/g, dd);
}

/**
 * Resolve the vault-relative path (no extension) of the daily note for a date.
 * `dateStr` is the same YYYY-MM-DD key used elsewhere in triage.
 */
export function resolveDailyNotePath(
  dateStr: string,
  config: DailyNotesConfig = DEFAULT_DAILY_NOTES_CONFIG,
): string {
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`resolveDailyNotePath: expected YYYY-MM-DD, received "${dateStr}"`);
  }

  const formatted = formatDate(new Date(year, month - 1, day), config.format);
  const folder = config.folder.replace(/\/+$/, "");
  return `${folder}/${formatted}`;
}

/** Resolve the full markdown path, including the extension. */
export function resolveDailyNoteFile(
  dateStr: string,
  config: DailyNotesConfig = DEFAULT_DAILY_NOTES_CONFIG,
): string {
  return `${resolveDailyNotePath(dateStr, config)}.md`;
}

/**
 * Read the live Obsidian config when a vault adapter is available.
 * Any failure falls back to the defaults rather than blocking the caller —
 * a missing config must not stop task filing.
 */
export async function readDailyNotesConfig(
  readJson: (path: string) => Promise<unknown> | undefined,
): Promise<DailyNotesConfig> {
  try {
    const raw = await readJson(DAILY_NOTES_CONFIG_PATH);
    if (raw && typeof raw === "object") {
      const { folder, format } = raw as Partial<DailyNotesConfig>;
      return {
        folder: typeof folder === "string" && folder ? folder : DEFAULT_DAILY_NOTES_CONFIG.folder,
        format: typeof format === "string" && format ? format : DEFAULT_DAILY_NOTES_CONFIG.format,
      };
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_DAILY_NOTES_CONFIG;
}