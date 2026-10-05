import test from "node:test";
import assert from "node:assert/strict";

// RED-FIRST for #46 — these tests are written before the module exists.
// They must fail with a module-not-found error, and pass once
// 06-Resources/scripts/src/lib/task-view.ts implements the contract.

import {
  PROMOTION_TAG,
  isShielded,
  isPromoted,
  isVisible,
  taskIdentity,
  taskSource,
  collectVisibleTasks
} from "../src/lib/task-view.ts";

/** Build a task in the normalised shape the vault layer passes to the module. */
function task(overrides = {}) {
  return {
    text: "Renew passport",
    status: " ",
    section: "✅ Action Items & Next Steps",
    path: "05-Personal/passport.md",
    line: 30,
    parent: null,
    ...overrides
  };
}

test("#46 AC1: only explicitly promoted personal and learning commitments are visible", () => {
  // A promoted personal obligation is visible.
  assert.equal(
    isVisible(task({ text: `Renew passport ${PROMOTION_TAG}` })),
    true,
    "a promoted personal action must be visible"
  );

  // The same obligation without promotion is NOT visible: surfacing it would
  // flood the daily flow with every incidental checkbox.
  assert.equal(
    isVisible(task({ text: "Renew passport" })),
    false,
    "an unpromoted personal action must stay out of task views"
  );

  // Learning works the same way, opt-in only.
  assert.equal(
    isVisible(
      task({
        text: `Finish Module 1 quiz ${PROMOTION_TAG}`,
        section: "📝 Study Notes & Key Takeaways",
        path: "04-Learning/gemini.md"
      })
    ),
    true,
    "a promoted learning action must be visible"
  );
  assert.equal(
    isVisible(
      task({
        text: "Finish Module 1 quiz",
        section: "📝 Study Notes & Key Takeaways",
        path: "04-Learning/gemini.md"
      })
    ),
    false,
    "an unpromoted learning action must stay out of task views"
  );
});

test("#46 AC2: reference, syllabus, example, Backlog and Archive items stay shielded", () => {
  const shieldedSections = [
    "🗺️ Syllabus & Milestones",
    "🔗 Related References & Media",
    "🔗 Related References & Auto-Backlinks",
    "🔄 Auto-Backlinks",
    "Module 1: Foundations",
    "Example worked problem",
    "## Backlog",
    "Backlog",
    "Archive",
    "🔁 Habits",
    "Daily Habits"
  ];

  for (const section of shieldedSections) {
    assert.equal(
      isShielded(task({ section })),
      true,
      `section "${section}" must be shielded`
    );
  }

  // Promotion must NOT override a shield. This is the whole point: the daily
  // flow would flood if a syllabus checkbox could opt itself in.
  for (const section of shieldedSections) {
    assert.equal(
      isVisible(task({ section, text: `Syllabus item ${PROMOTION_TAG}` })),
      false,
      `promotion must not unshield "${section}"`
    );
  }

  // Nested checklist items stay out too — only top-level commitments surface.
  // The marker is present so this exercises the nesting rule specifically:
  // without it the assertion would pass on the promotion check and prove
  // nothing about nesting.
  assert.equal(
    isPromoted(task({ text: `Sub-step of a commitment ${PROMOTION_TAG}`, parent: 2 })),
    true,
    "precondition: the nested task is promoted"
  );
  assert.equal(
    isVisible(task({ text: `Sub-step of a commitment ${PROMOTION_TAG}`, parent: 2 })),
    false,
    "nested checklist items must stay out of task views"
  );
  assert.equal(
    isVisible(task({ text: `Sub-step of a commitment ${PROMOTION_TAG}`, parent: null })),
    true,
    "the same text is visible once it is a top-level commitment"
  );
});

test("#46 AC3: every visible action keeps a stable identity and a source reference, and appears once", () => {
  const duplicated = [
    task({ text: `Renew passport ${PROMOTION_TAG}`, path: "05-Personal/passport.md", line: 30 }),
    task({ text: `renew   PASSPORT! ${PROMOTION_TAG}`, path: "01-Daily/2026-10-06.md", line: 12 })
  ];

  const collected = collectVisibleTasks(duplicated);
  assert.equal(collected.length, 1, "the same commitment must not appear twice");

  // Identity is stable across whitespace, case and the promotion marker.
  assert.equal(
    taskIdentity(duplicated[0]),
    taskIdentity(duplicated[1]),
    "identity must ignore case, punctuation and the promotion marker"
  );

  // A genuinely different commitment keeps its own identity.
  assert.notEqual(
    taskIdentity(task({ text: `Renew passport ${PROMOTION_TAG}` })),
    taskIdentity(task({ text: `Book dentist ${PROMOTION_TAG}` })),
    "different commitments must not collapse into one identity"
  );

  // Every collected action carries a source reference back to its note.
  assert.deepEqual(taskSource(duplicated[0]), {
    path: "05-Personal/passport.md",
    line: 30
  });
  for (const entry of collected) {
    assert.ok(entry.path, "a visible action must carry a source path");
  }
});

test("#46 AC3: priority tags are not part of identity", () => {
  assert.equal(
    taskIdentity(task({ text: "Ship #46 #priority/p1" })),
    taskIdentity(task({ text: "Ship #46 #priority/p2" })),
    "changing a priority tag must not fork the identity of one commitment"
  );
});

test("#46 AC4: due and awaiting information survives into the rendered view", () => {
  // AC4 asks that supplied due/awaiting information be retained. Retention here
  // means the views pass the task text through untouched, so the assertion is on
  // the only stripping the pipeline performs: the promotion marker.
  const withDue = task({ text: `Renew passport ${PROMOTION_TAG} 📅 2026-11-02` });
  assert.equal(
    displayText(withDue),
    "Renew passport 📅 2026-11-02",
    "a supplied due date must reach the rendered view"
  );

  const withAwaiting = task({ text: `Renew passport ${PROMOTION_TAG} ⏳ waiting on council` });
  assert.equal(
    displayText(withAwaiting),
    "Renew passport ⏳ waiting on council",
    "supplied awaiting text must reach the rendered view"
  );

  // Nothing is invented when nothing was supplied.
  assert.equal(
    displayText(task({ text: `Renew passport ${PROMOTION_TAG}` })),
    "Renew passport",
    "no due or awaiting text may be fabricated"
  );

  // Daily focus needs no filter here: a plain intention bullet is not a
  // checkbox, so Dataview never reports it as a task and no view can surface it.
  // Widening these views to Learning and Personal does not change that.
  assert.equal(
    isVisible(task({ text: "- Deep work on the bundle parity check", path: "05-Personal/focus.md" })),
    false,
    "a plain bullet is not a task, so it must never be promoted into a view"
  );
});

test("#46: a promotion marker is required and is stripped from display text", () => {
  const promoted = task({ text: `Renew passport ${PROMOTION_TAG}` });
  assert.equal(isPromoted(promoted), true);
  assert.equal(
    displayText(promoted),
    "Renew passport",
    "the promotion marker is bookkeeping and must not leak into the rendered view"
  );
  assert.equal(isPromoted(task({ text: "Renew passport" })), false);
});

test("#46: daily notes and project boards keep working without any marker", () => {
  // Regression guard: promotion is scope-dependent. If this ever becomes a
  // uniform rule, every existing daily and project task vanishes from the
  // dashboard — a break no other assertion in this file would catch.
  for (const path of ["01-Daily/2026-10-06.md", "02-Projects/loey_sync/loey_sync Kanban.md"]) {
    assert.equal(
      requiresPromotion(path),
      false,
      `${path} must not require the promotion marker`
    );
    assert.equal(
      isVisible(task({ text: "Existing unmarked commitment", path })),
      true,
      `an unmarked task in ${path} must stay visible, as it is today`
    );
  }

  // The opt-in folders are the ones that require the marker.
  for (const path of ["04-Learning/gemini.md", "05-Personal/passport.md"]) {
    assert.equal(requiresPromotion(path), true, `${path} must require the promotion marker`);
  }

  // A marker in a Daily note is harmless and is stripped from display.
  const marked = task({ text: `Existing unmarked commitment ${PROMOTION_TAG}`, path: "01-Daily/2026-10-06.md" });
  assert.equal(isVisible(marked), true, "a marked daily task is still visible");
  assert.equal(displayText(marked), "Existing unmarked commitment");
});

test("#46: the wide shield applies only to opt-in folders, never to daily or project boards", () => {
  // A project may legitimately keep tasks under "Examples" or "References".
  // Those are visible today, so the wider opt-in shield must not reach them.
  for (const section of ["Examples", "References", "Module 1 rollout", "Syllabus"]) {
    assert.equal(
      isShielded(task({ section, path: "02-Projects/loey_sync/loey_sync.md" })),
      false,
      `"${section}" in a project note must not be newly shielded`
    );
    assert.equal(
      isShielded(task({ section, path: "01-Daily/2026-10-06.md" })),
      false,
      `"${section}" in a daily note must not be newly shielded`
    );
  }

  // The exclusions the views have always applied still hold everywhere.
  for (const path of ["01-Daily/2026-10-06.md", "02-Projects/loey_sync/loey_sync.md"]) {
    for (const section of ["Backlog", "Archive", "🔁 Habits"]) {
      assert.equal(
        isShielded(task({ section, path })),
        true,
        `"${section}" must stay shielded in ${path}`
      );
    }
  }

  // And the wide shield does apply in the opt-in folders.
  for (const path of ["04-Learning/gemini.md", "05-Personal/passport.md"]) {
    assert.equal(
      isShielded(task({ section: "🗺️ Syllabus & Milestones", path })),
      true,
      `syllabus material must be shielded in ${path}`
    );
  }
});

test("#46: a normalised task keeps the original object so its checkbox stays clickable", () => {
  // dv.taskList needs the raw dataview task, not a copy, or the rendered checkbox
  // stops being clickable in Obsidian.
  const raw = {
    text: `Renew passport ${PROMOTION_TAG}`,
    status: " ",
    header: { subpath: "✅ Action Items & Next Steps" },
    file: { path: "05-Personal/passport.md" },
    line: 30,
    parent: null
  };

  const normalised = normalizeTask(raw);
  assert.equal(normalised.raw, raw, "the original task object must be carried through by reference");
  assert.equal(normalised.path, "05-Personal/passport.md");
  assert.equal(normalised.section, "✅ Action Items & Next Steps");
  assert.equal(normalised.line, 30);
  assert.equal(isVisible(normalised), true);

  // A page without a file path falls back to the caller's path rather than "".
  const orphan = normalizeTask({ text: "A task", header: { subpath: "## Done" } }, "05-Personal/x.md");
  assert.equal(orphan.path, "05-Personal/x.md", "the fallback path must be used when dataview omits file.path");
  assert.equal(orphan.section, "## Done");
});

// Imported late so the RED failure message names the module under test.
import { displayText, requiresPromotion, normalizeTask } from "../src/lib/task-view.ts";