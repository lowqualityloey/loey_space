// #62: enrichment must not write wikilinks to notes that do not exist.
//
// Learning enrichment emitted `[[Concept Name]]` for every concept the model
// suggested, resolved or not, and dev enrichment did the same for `related`.
// Both produced phantom links — the "no phantom wikilinks" invariant, broken
// silently by an automated writer rather than by a human typo.
//
// These drive the real entry points with a canned model reply. No live or paid
// AI call is made.
import test from "node:test";
import assert from "node:assert/strict";
import { enrichLearningNote } from "../src/lib/enrichers/learning.ts";
import { enrichDevNote } from "../src/lib/enrichers/dev.ts";
import { enrichConceptNote } from "../src/lib/enrichers/concept.ts";

globalThis.window = globalThis;
const notices = [];
globalThis.Notice = class { constructor(msg) { notices.push(msg); } };

function replyModel(reply) {
  globalThis.fetch = async () => ({
    status: 200,
    text: async () => JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] }, finishReason: "STOP" }]
    })
  });
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

## 💻 Reusable Code Patterns & Snippets
*Practical snippets & solutions saved to \`03-Dev/\`:*
- [[ ]]

## ❓ Active Recall & Self-Quiz
- placeholder
`;

const DEV_NOTE = `---
type: snippet
area: dev
tags:
  - type/dev
---

# target

## Context
- System: placeholder

## Code Explanation
- placeholder line

## Related
- placeholder
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

## 🔗 Related References
- [[ ]]
`;

function learningReply(extra) {
  return {
    topicTag: "topic/testing",
    topicName: "Testing",
    objectives: { why: "generated why", targetOutcome: "generated outcome" },
    extractedConcepts: [],
    extractedSnippets: [],
    activeRecall: [],
    ...extra
  };
}

test("learning: an existing concept is linked, an uncreated one is not", async () => {
  notices.length = 0;
  const file = { path: "04-Learning/subject.md", basename: "subject" };
  const files = { [file.path]: LEARNING_NOTE, "08-Concepts/Existing Concept.md": "# existing\n" };
  const { app } = makeVault(files);
  replyModel(learningReply({ extractedConcepts: ["[[Existing Concept]]", "[[Brand New Concept]]"] }));

  await enrichLearningNote(app, file);
  const out = files[file.path];

  assert.ok(out.includes("[[Existing Concept]]"), "a concept that exists is linked");
  assert.ok(!out.includes("[[Brand New Concept]]"), "an uncreated concept must not become a wikilink");
  assert.ok(out.includes("Brand New Concept"), "the suggestion is still shown, as plain text");
});

test("learning: an existing snippet is linked, an uncreated one is not", async () => {
  notices.length = 0;
  const file = { path: "04-Learning/subject.md", basename: "subject" };
  const files = { [file.path]: LEARNING_NOTE, "03-Dev/Existing Snippet.md": "# existing\n" };
  const { app } = makeVault(files);
  replyModel(learningReply({ extractedSnippets: ["[[Existing Snippet]]", "[[Ghost Snippet]]"] }));

  await enrichLearningNote(app, file);
  const out = files[file.path];

  assert.ok(out.includes("[[Existing Snippet]]"), "a snippet that exists is linked");
  assert.ok(!out.includes("[[Ghost Snippet]]"), "an uncreated snippet must not become a wikilink");
  assert.ok(out.includes("Ghost Snippet"), "the suggestion is still shown, as plain text");
});

test("dev: an existing related note is linked, a ghost note is not", async () => {
  notices.length = 0;
  const file = { path: "03-Dev/target.md", basename: "target" };
  const files = { [file.path]: DEV_NOTE, "08-Concepts/Existing Note.md": "# existing\n" };
  const { app } = makeVault(files);
  replyModel({
    type: "snippet", area: "dev", language: "TypeScript", tags: ["area/dev"],
    context: { system: "plain system", stack: "plain stack", whereItFits: "" },
    codeExplanation: ["generated explanation"],
    related: ["[[Existing Note]]", "[[Ghost Note]]"]
  });

  await enrichDevNote(app, file);
  const out = files[file.path];

  assert.ok(out.includes("[[Existing Note]]"), "a related note that exists is linked");
  assert.ok(!out.includes("[[Ghost Note]]"), "a related note that does not exist must not be linked");
  assert.ok(out.includes("Ghost Note"), "the suggestion is still shown, as plain text");
});

test("dev: an unresolvable wikilink inside context free text is degraded, not emitted", async () => {
  notices.length = 0;
  const file = { path: "03-Dev/target.md", basename: "target" };
  const files = { [file.path]: DEV_NOTE, "08-Concepts/Real System.md": "# real\n" };
  const { app } = makeVault(files);
  replyModel({
    type: "snippet", area: "dev", language: "TypeScript", tags: ["area/dev"],
    context: { system: "[[Ghost System]] and [[Real System]]", stack: "plain", whereItFits: "" },
    codeExplanation: [],
    related: []
  });

  await enrichDevNote(app, file);
  const out = files[file.path];

  assert.ok(!out.includes("[[Ghost System]]"), "a ghost link in free text must be degraded");
  assert.ok(out.includes("Ghost System"), "the words survive as plain text");
  assert.ok(out.includes("[[Real System]]"), "a resolvable link in free text is kept");
});

test("concept: an unresolvable relatedConcept is never written (unchanged behaviour)", async () => {
  notices.length = 0;
  const file = { path: "08-Concepts/subject.md", basename: "subject" };
  const files = { [file.path]: CONCEPT_NOTE };
  const { app } = makeVault(files);
  replyModel({
    tags: ["area/knowledge"], summary: "generated summary",
    whyItMatters: [], examples: [], questions: [], nextSteps: [],
    relatedConcepts: ["[[Ghost Concept]]"]
  });

  await enrichConceptNote(app, file);
  const out = files[file.path];

  assert.ok(!out.includes("[[Ghost Concept]]"), "concept enrichment still drops unresolvable links");
});
