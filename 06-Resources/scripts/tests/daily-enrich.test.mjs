import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDailyNoteSections,
  resolveConnectedNotes,
  applyDailyEnrichment
} from '../src/lib/enrichers/daily.ts';

test('parseDailyNoteSections: extracts sections correctly from daily note markdown', () => {
  const sampleNoteContent = `---
type: daily
mood: 4
energy: 3
sleep_hours: 7
---

## 🎯 Daily Focus
- Complete code health refactoring
- Review PRs

## 📋 Tasks
- [x] Write unit tests for daily enricher
- [>] Forwarded task to tomorrow
- [ ] Refactor enrichDailyNote function #priority/p1
- [ ] ...

## 💧 Daily Habits & Rituals
- [x] Water 2L
- [x] Disconnect by 9pm

## 📝 Daily Log
- 08:30 AM Standup meeting
- 02:00 PM Refactored daily enricher

## 💡 Ideas & Fleeting Notes
- Extract prompt builder to separate function

## 🎉 Wins & Good Things
- Unit tests ran fast

## 🚧 Blockers & Friction
- Complex monolith functions

## 💭 Daily Reflection & Learning
- Refactoring makes code much more testable
`;

  const sections = parseDailyNoteSections(sampleNoteContent);

  assert.deepStrictEqual(sections.focusItems, [
    'Complete code health refactoring',
    'Review PRs'
  ]);
  assert.deepStrictEqual(sections.completedTasks, [
    'Write unit tests for daily enricher'
  ]);
  assert.deepStrictEqual(sections.forwardedTasks, [
    'Forwarded task to tomorrow'
  ]);
  assert.deepStrictEqual(sections.unfinishedTasks, [
    'Refactor enrichDailyNote function #priority/p1'
  ]);
  assert.deepStrictEqual(sections.checkedHabits, [
    'Water 2L',
    'Disconnect by 9pm'
  ]);
  assert.deepStrictEqual(sections.dailyLog, [
    '08:30 AM Standup meeting',
    '02:00 PM Refactored daily enricher'
  ]);
  assert.deepStrictEqual(sections.ideas, [
    'Extract prompt builder to separate function'
  ]);
  assert.deepStrictEqual(sections.winsLog, [
    'Unit tests ran fast'
  ]);
  assert.deepStrictEqual(sections.blockersLog, [
    'Complex monolith functions'
  ]);
  assert.deepStrictEqual(sections.userReflectionLog, [
    'Refactoring makes code much more testable'
  ]);
  assert.strictEqual(sections.filledSectionCount, 8);
});

test('resolveConnectedNotes: filters and formats connected wikilinks correctly', () => {
  const validTargets = new Map([
    ['2026-08-30', '2026-08-30'],
    ['concept distiller engine', 'Concept Distiller Engine'],
    ['unrelated note', 'Unrelated Note']
  ]);

  const rawLinks = [
    '[[Concept Distiller Engine]]',
    '[[Unrelated Note]]',
    '[[Non Existent Note]]'
  ];

  const userCorpus = 'today we worked on concept distiller engine and built tests';

  const result = resolveConnectedNotes({
    validTargets,
    currentNoteName: '2026-08-31',
    rawConnectedNotes: rawLinks,
    yesterdayDate: '2026-08-30',
    userCorpus
  });

  assert.deepStrictEqual(result, [
    '[[2026-08-30]]',
    '[[Concept Distiller Engine]]'
  ]);
});

test('applyDailyEnrichment: updates quote, AI Daily Summary, and Connected Notes sections', () => {
  const initialContent = `---
type: daily
---

> [!QUOTE] 💡 Daily Spark
> *"Old quote"*

## 🎯 Daily Focus
- Refactoring

##### 🔗 Connected Notes
- [[2026-08-30]]
`;

  const data = {
    quote: 'Simplicity is prerequisite for reliability.',
    author: 'Edsger W. Dijkstra',
    debrief: 'Solid afternoon of refactoring.\n\nEverything passed cleanly.',
    takeaway: 'Smaller functions are easier to test.',
    tomorrowMove: 'Get stuck into next task.',
    connectedLinks: ['[[2026-08-30]]', '[[Concept Distiller Engine]]']
  };

  const updated = applyDailyEnrichment(initialContent, data);

  assert.ok(updated.includes('> [!QUOTE] 💡 Daily Spark'));
  assert.ok(updated.includes('Simplicity is prerequisite for reliability.'));
  assert.ok(updated.includes('> — **Edsger W. Dijkstra**'));
  assert.ok(updated.includes('## 🤖 AI Daily Summary'));
  assert.ok(updated.includes('### 📖 Daily Debrief\nSolid afternoon of refactoring.'));
  assert.ok(updated.includes('### 🧠 Chief of Staff Takeaway\nSmaller functions are easier to test.'));
  assert.ok(updated.includes('### 🎯 Tomorrow\'s Move\nGet stuck into next task.'));
  assert.ok(updated.includes('##### 🔗 Connected Notes\n- [[2026-08-30]]\n- [[Concept Distiller Engine]]'));
});
