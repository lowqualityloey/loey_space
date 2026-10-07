import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// RED-FIRST for #119 / TASK-2026-10-08-task-lifecycle-authority.
//
// The module is imported as a namespace on purpose. A named import of a
// capability that does not exist yet would fail at ES-module link time and take
// the whole file down with an error that proves nothing about behaviour; reading
// the names off the namespace instead makes every gap surface as its own failing
// assertion with a readable message.
//
// Production source is untouched by this milestone: these fixtures define the
// contract, the implementation follows in the owning workflow.
import * as TaskView from "../src/lib/task-view.ts";

/** Factory: a task in the normalised shape the vault views pass to the module. */
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

/** Reject a missing capability with a message that names what to implement. */
function requireCapability(name) {
  assert.equal(
    typeof TaskView[name],
    "function",
    `the shared task-view module must expose ${name}() as part of the lifecycle-authority contract`
  );
}

const PLANNING_BOARD = "02-Projects/roadie/roadie Kanban.md";
const PLANNING_HUB = "02-Projects/roadie/roadie.md";
const ACTIVE_BOARD = "02-Projects/loey_sync/loey_sync Kanban.md";
const ACTIVE_HUB = "02-Projects/loey_sync/loey_sync.md";

test("#119 AC-2 / BEHAVIOR-task-lifecycle-authority-001: a planning project contributes zero commitments", () => {
  // The reported defect: these items reach the active views while the project is
  // still planning, because isVisible() never sees the project's lifecycle.
  const planningContext = { projectLifecycle: "planning" };

  assert.equal(
    TaskView.isVisible(
      task({ path: PLANNING_BOARD, section: "To Do", text: "Graduate the roadmap" }),
      planningContext
    ),
    false,
    "a planning project's board card must not enter the active views before graduation"
  );

  assert.equal(
    TaskView.isVisible(
      task({ path: PLANNING_HUB, section: "🏁 Definition of Done (MVP)", text: "Ship the first slice" }),
      planningContext
    ),
    false,
    "a planning project's definition-of-done items must not enter the active views"
  );

  // Graduation is what exposes the work: the same card is a commitment once the
  // project is active.
  assert.equal(
    TaskView.isVisible(
      task({ path: ACTIVE_BOARD, section: "To Do", text: "Graduate the roadmap" }),
      { projectLifecycle: "active" }
    ),
    true,
    "an active project's board card must stay visible, as it is today"
  );

  // A non-project task is unaffected by project lifecycle at all.
  assert.equal(
    TaskView.isVisible(task({ path: "01-Daily/2026-10-06.md", section: "✅ Action Items" }), planningContext),
    true,
    "daily-note commitments must not be gated by a project lifecycle they do not have"
  );
});

test("#119 AC-3 / BEHAVIOR-task-lifecycle-authority-002: graduation exposes each commitment once, and every view asks the authority", () => {
  const graduation = { projectLifecycle: "active" };

  // The same commitment mirrored from the master note into the companion board
  // must collapse to a single row once the project graduates.
  const mirrored = [
    task({ path: ACTIVE_BOARD, section: "To Do", text: "Ship the first slice #priority/p1" }),
    task({ path: ACTIVE_HUB, section: "✨ Core Features & Scope", text: "Ship the first slice" })
  ];
  // The board card is the commitment; the hub copy is the same commitment seen
  // from the other side, so exactly one representative may survive.
  const visibleAfterGraduation = mirrored.filter((entry) => TaskView.isVisible(entry, graduation));
  assert.equal(
    TaskView.collectVisibleTasks(visibleAfterGraduation).length,
    1,
    "graduation must expose a mirrored commitment exactly once"
  );

  // Before graduation nothing is committed at all.
  const visibleBeforeGraduation = mirrored.filter((entry) =>
    TaskView.isVisible(entry, { projectLifecycle: "planning" })
  );
  assert.equal(
    visibleBeforeGraduation.length,
    0,
    "a planning project contributes zero commitments to the active views"
  );

  // The gate only works if the views actually ask for the lifecycle: this is the
  // same defect class as a guard that is never invoked.
  const callSites = [
    "01-Daily/_Tasks MOC.md",
    "Home.md",
    "02-Projects/_Projects MOC.md"
  ];
  for (const path of callSites) {
    const source = readFileSync(path, "utf8");
    assert.ok(
      /projectLifecycle|projectStatus|\.status\b/.test(source),
      `${path} must pass the project lifecycle into the shared task-view authority`
    );
  }
});

test("#119 AC-4 / BEHAVIOR-task-lifecycle-authority-003: a generated companion board inherits its master's lifecycle", () => {
  const template = readFileSync("99-Templates/Project.md", "utf8");
  const statuses = [...template.matchAll(/^\s*status:\s*(.+?)\s*$/gm)].map((match) => match[1]);

  assert.ok(
    statuses.length >= 2,
    "the project template must declare the master note's status and the generated board's status"
  );

  const [masterStatus, generatedStatus] = statuses;
  assert.ok(
    masterStatus.length > 0 && generatedStatus.length > 0,
    "both declarations must carry a concrete lifecycle value"
  );
  assert.equal(
    generatedStatus,
    masterStatus,
    `the companion board a new project generates must not disagree with its master note (master: ${masterStatus}, generated: ${generatedStatus})`
  );
});

test("#119 AC-1 & AC-5 / BEHAVIOR-task-lifecycle-authority-004: one authority for commitments, and progress reported per level", () => {
  requireCapability("isCommitment");
  requireCapability("summarizeProgress");

  // One authority: board cards are commitments, hub checklist items are nested
  // acceptance criteria. Daily-note checkboxes are commitments, as they are today.
  assert.equal(
    TaskView.isCommitment(task({ path: ACTIVE_BOARD, section: "To Do" })),
    true,
    "a board card is a commitment"
  );
  assert.equal(
    TaskView.isCommitment(task({ path: ACTIVE_HUB, section: "🏁 Definition of Done (MVP)" })),
    false,
    "a hub definition-of-done item is a nested criterion, not a commitment"
  );
  assert.equal(
    TaskView.isCommitment(task({ path: "01-Daily/2026-10-06.md" })),
    true,
    "a daily-note checkbox is still a commitment"
  );

  // Progress is reported per level, never blended: a planning project therefore
  // shows zero commitment progress while its criteria still exist.
  const projectItems = [
    task({ path: PLANNING_BOARD, section: "To Do", status: "/", text: "Graduate the roadmap" }),
    task({ path: PLANNING_BOARD, section: "Done", status: "x", text: "Write the brief" }),
    task({ path: PLANNING_HUB, section: "🏁 Definition of Done (MVP)", status: " ", text: "Ship the first slice" }),
    task({ path: PLANNING_HUB, section: "🚀 Setup & Development", status: "x", text: "Scaffold the repo" })
  ];

  const summary = TaskView.summarizeProgress(projectItems, { projectLifecycle: "planning" });
  assert.ok(summary && summary.commitments && summary.criteria, "the summary must report both levels separately");
  assert.equal(
    summary.commitments.total,
    0,
    "a planning project must report zero commitment progress"
  );
  assert.equal(
    summary.criteria.total,
    2,
    "the hub criteria must still be counted at the criterion level"
  );

  const active = TaskView.summarizeProgress(projectItems, { projectLifecycle: "active" });
  assert.equal(active.commitments.total, 2, "an active project reports its board cards as commitments");
  assert.equal(active.commitments.done, 1, "completed board cards count toward commitment progress");
  assert.equal(active.criteria.done, 1, "completed hub criteria count toward criterion progress");

  // A blended single ratio must never be the only thing a consumer can read.
  assert.equal(
    "percent" in active,
    false,
    "progress must not be collapsed back into one blended figure"
  );
});
