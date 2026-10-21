/*
 * Test-only clock preload. The daily-note date is decided by the writer's Auckland clock, so a
 * fixture test that freezes only its own Date still races the writer subprocess. `auckland-clock.mjs`
 * injects this file through NODE_OPTIONS and LOEY_TEST_NOW for every fixture writer, and also calls
 * `freezeClock()` in the test process so both sides of a write share one instant. Production code
 * never loads this file.
 */
function freezeClock(instant) {
  const fixed = typeof instant === 'number' ? instant : Date.parse(instant);
  if (!Number.isFinite(fixed)) {
    throw new Error(`LOEY_TEST_NOW is not a valid instant: ${instant}`);
  }
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [fixed] : args));
    }
    static now() {
      return fixed;
    }
  }
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  globalThis.Date = FrozenDate;
  return fixed;
}

const initial = process.env.LOEY_TEST_NOW;
if (initial) freezeClock(initial);

module.exports = { freezeClock };
