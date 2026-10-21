/*
 * One Auckland clock for the separation fixtures. The production writers decide "today" in
 * Pacific/Auckland, so the fixtures must do the same: a host-local date disagrees with the writer
 * for part of every UTC day. These constants make the writer and its fixture note use one frozen
 * discovery instant; PR merge metadata stays a separate input and is never used to choose the note.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const DISCOVERY_NOW = '2026-10-17T12:00:00.000Z';
export const MIDNIGHT_DISCOVERY_NOW = '2026-10-17T11:03:00.000Z';
export const MIDNIGHT_MERGE_AT = '2026-10-17T10:58:00.000Z';

export const DISCOVERY_DATE = '2026-10-18';
export const PREVIOUS_DATE = '2026-10-17';

const CLOCK_PRELOAD = fileURLToPath(new URL('./fixed-clock.cjs', import.meta.url));
export const { freezeClock } = require('./fixed-clock.cjs');

export function aucklandDate(instant = DISCOVERY_NOW) {
  const date = new Date(instant);
  if (!Number.isFinite(date.valueOf())) throw new Error(`Invalid fixture instant: ${instant}`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Environment for a writer subprocess: the same frozen instant, inherited by its own children. */
export function clockEnv(now = DISCOVERY_NOW, base = process.env) {
  const inherited = (base.NODE_OPTIONS || '').trim();
  return {
    ...base,
    LOEY_TEST_NOW: now,
    NODE_OPTIONS: [inherited, `--require ${CLOCK_PRELOAD}`].filter(Boolean).join(' '),
  };
}
