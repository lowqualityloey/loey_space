// #41: an enrichment must be written against the note's current content.
//
// Every enricher read the note, awaited the model, transformed that earlier
// snapshot and wrote the whole thing back with vault.modify. Anything typed
// while the request was in flight was overwritten — including Dataview blocks
// and hand-written annotations in sections the enricher does not own.
//
// These drive the real entry points with a paused fake model: fetch is stubbed,
// the note is edited while the request is pending, then the response resolves.
// No paid or live AI call is made.
import test from "node:test";
import assert from "node:assert/strict";
import { enrichConceptNote } from "../src/lib/enrichers/concept.ts";
import { enrichDevNote } from "../src/lib/enrichers/dev.ts";
import { enrichLearningNote } from "../src/lib/enrichers/learning.ts";
import { enrichDailyNote } from "../src/lib/enrichers/daily.ts";

// The enrichers read `(window as any).Notice`, which plain Node has no binding for.
globalThis.window = globalThis;

const notices = [];
globalThis.Notice = class {
  constructor(msg) { notices.push(msg); }
};

const DATAVIEW = '```dataview\nLIST FROM "03-Dev"\n```';

/** Stub fetch so the model request can be held open while the note is edited. */
function pauseModel(reply) {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let requested = false;

  globalThis.fetch = async () => {
    requested = true;
    await held;
    return {
      status: 200,
      text: async () => JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] }, finishReason: "STOP" }]
      })
    };
  };

  return {
    settle: () => release(),
    get requested() { return requested; }
  };
}

function makeVault(files) {
  return {
    app: {
      vault: {
        adapter: { read: async () => "GEMINI_API_KEY=your_fixture_key" },
        getMarkdownFiles: () => Object.keys(files).map((path) => ({
          path,
          basename: path.split("/").pop().replace(/\.md$/, "")
        })),
        read: async (f) => {
          if (!(f.path in files)) throw new Error("ENOENT " + f.path);
          return files[f.path];
        },
        modify: async (f, c) => { files[f.path] = c; },
        process: async (f, fn) => { files[f.path] = fn(files[f.path]); }
      }
    },
    files
  };
}

function warned(text) {
  return notices.some((n) => n.includes(text));
}

async function editWhilePending(model, edit) {
  while (!model.requested) await new Promise((r) => setTimeout(r, 1));
  edit();
  model.settle();
}

const DEV_NOTE = `---
type: snippet
area: dev
tags:
  - type/dev
---

# target

## Context
- System: second brain

## Code Explanation
- placeholder line

## My Annotation
- hand-written note to self

${DATAVIEW}
`;

const CONCEPT_NOTE = `---
type: concept
status: active
area: general
tags:
  - type/concept
---

# subject

## Summary
- placeholder

## Why it matters
- placeholder

## Examples
- placeholder

## Questions
- placeholder

## Next steps
- placeholder

## 🔗 Related References
- [[ ]]

${DATAVIEW}
`;

const LEARNING_NOTE = `---
type: learning
status: in-progress
area: learning
topic: general
tags:
  - type/learning
---

# subject

## 🎯 Learning Objectives & Motivation
- placeholder

## 💡 Extracted Evergreen Concepts
*Atomic concepts distilled into \`08-Concepts/\`:*
- [[ ]]

## ❓ Active Recall & Self-Quiz
- placeholder

${DATAVIEW}
`;

const DAILY_NOTE = `---
type: daily
mood: 4
energy: 3
sleep_hours: 7
---

> [!QUOTE] 💡 Daily Spark
> *"placeholder quote"*

## 📝 Daily Log
- 09:00 AM standup

## 💡 Ideas & Fleeting Notes
- an idea worth keeping

##### 🔗 Connected Notes
- [[2026-01-01]]

${DATAVIEW}
`;

const DEV_REPLY = {
  type: "snippet",
  area: "dev",
  language: "JavaScript ES6",
  tags: ["area/dev"],
  context: { system: "[[second brain]]", stack: "JavaScript ES6+", whereItFits: "" },
  codeExplanation: ["generated explanation"],
  related: []
};

const CONCEPT_REPLY = {
  tags: ["area/knowledge"],
  summary: "generated summary",
  whyItMatters: ["generated reason"],
  examples: ["generated example"],
  questions: ["generated question?"],
  nextSteps: ["generated step"],
  relatedConcepts: []
};

const LEARNING_REPLY = {
  topicTag: "topic/testing",
  topicName: "Testing",
  objectives: { why: "generated why", targetOutcome: "generated outcome" },
  extractedConcepts: ["[[A Concept]]"],
  extractedSnippets: [],
  activeRecall: [{ q: "generated q?", a: "generated a." }]
};

const DAILY_REPLY = {
  quote: "Simplicity is prerequisite for reliability.",
  author: "Edsger W. Dijkstra",
  debrief: "generated debrief",
  takeaway: "generated takeaway",
  tomorrowMove: "generated move",
  connectedNotes: []
};

test("dev: an edit made while the request was pending survives", async () => {
  notices.length = 0;
  const file = { path: "03-Dev/target.md", basename: "target" };
  const files = { [file.path]: DEV_NOTE };
  const { app } = makeVault(files);
  const model = pauseModel(DEV_REPLY);

  const running = enrichDevNote(app, file);
  await editWhilePending(model, () => {
    files[file.path] = files[file.path].replace(
      "## My Annotation\n- hand-written note to self",
      "## My Annotation\n- hand-written note to self\n- typed while the model was thinking"
    );
  });
  await running;

  assert.ok(files[file.path].includes("- generated explanation"), "the owned section is updated");
  assert.ok(
    files[file.path].includes("- typed while the model was thinking"),
    "the mid-request edit must survive"
  );
});

test("dev: a Dataview block and a newly added section are preserved", async () => {
  notices.length = 0;
  const file = { path: "03-Dev/target.md", basename: "target" };
  const files = { [file.path]: DEV_NOTE };
  const { app } = makeVault(files);
  const model = pauseModel(DEV_REPLY);

  const running = enrichDevNote(app, file);
  await editWhilePending(model, () => {
    files[file.path] = files[file.path].replace(
      "## My Annotation",
      "## Scratchpad\n- a whole section typed mid-request\n\n## My Annotation"
    );
  });
  await running;

  assert.ok(files[file.path].includes(DATAVIEW), "the Dataview block is untouched");
  assert.ok(files[file.path].includes("## Scratchpad"), "a section added mid-request is kept");
  assert.ok(!warned("## Scratchpad"), "an unowned section is not reported as a conflict");
});

test("dev: an edit inside an owned section is reported as a conflict", async () => {
  notices.length = 0;
  const file = { path: "03-Dev/target.md", basename: "target" };
  const files = { [file.path]: DEV_NOTE };
  const { app } = makeVault(files);
  const model = pauseModel(DEV_REPLY);

  const running = enrichDevNote(app, file);
  await editWhilePending(model, () => {
    files[file.path] = files[file.path].replace(
      "## Code Explanation\n- placeholder line",
      "## Code Explanation\n- I rewrote this while it waited"
    );
  });
  await running;

  assert.ok(warned("## Code Explanation"), "the conflict is surfaced, not silently applied");
});

test("concept: a mid-request edit survives", async () => {
  notices.length = 0;
  const file = { path: "08-Concepts/subject.md", basename: "subject" };
  const files = { [file.path]: CONCEPT_NOTE };
  const { app } = makeVault(files);
  const model = pauseModel(CONCEPT_REPLY);

  const running = enrichConceptNote(app, file);
  await editWhilePending(model, () => {
    files[file.path] = files[file.path].replace(
      "## 🔗 Related References",
      "## My Notes\n- my own margin note\n\n## 🔗 Related References"
    );
  });
  await running;

  assert.ok(files[file.path].includes("- generated example"), "the owned section is updated");
  assert.ok(files[file.path].includes("- my own margin note"), "the mid-request edit survives");
  assert.ok(files[file.path].includes(DATAVIEW), "the Dataview block is untouched");
});

test("learning: a mid-request edit survives", async () => {
  notices.length = 0;
  const file = { path: "04-Learning/subject.md", basename: "subject" };
  const files = { [file.path]: LEARNING_NOTE };
  const { app } = makeVault(files);
  const model = pauseModel(LEARNING_REPLY);

  const running = enrichLearningNote(app, file);
  await editWhilePending(model, () => {
    files[file.path] = files[file.path].replace(
      "## ❓ Active Recall & Self-Quiz",
      "## My Notes\n- my own aside\n\n## ❓ Active Recall & Self-Quiz"
    );
  });
  await running;

  assert.ok(files[file.path].includes("generated why"), "the owned section is updated");
  assert.ok(files[file.path].includes("- my own aside"), "the mid-request edit survives");
  assert.ok(files[file.path].includes(DATAVIEW), "the Dataview block is untouched");
});

test("daily: a mid-request edit survives and the summary still lands", async () => {
  notices.length = 0;
  const file = { path: "01-Daily/2026-10/2026-10-04.md", basename: "2026-10-04" };
  const files = { [file.path]: DAILY_NOTE };
  const { app } = makeVault(files);
  const model = pauseModel(DAILY_REPLY);

  const running = enrichDailyNote(app, file);
  await editWhilePending(model, () => {
    files[file.path] = files[file.path].replace(
      "## 💡 Ideas & Fleeting Notes\n- an idea worth keeping",
      "## 💡 Ideas & Fleeting Notes\n- an idea worth keeping\n- typed mid-request"
    );
  });
  await running;

  assert.ok(files[file.path].includes("## 🤖 AI Daily Summary"), "the summary is still written");
  assert.ok(files[file.path].includes("generated debrief"));
  assert.ok(files[file.path].includes("- typed mid-request"), "the mid-request edit survives");
  assert.ok(files[file.path].includes(DATAVIEW), "the Dataview block is untouched");
});