// #39: concept distillation must never replace a curated note. A colliding
// title merges instead: the human body, original `created` date, manual links
// and provenance survive, and the new material is clearly marked for review.
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConceptNoteMarkdown,
  mergeConceptNote,
  DISTILLED_START,
  DISTILLED_END,
} from "../src/lib/distiller.ts";

const CURATED = `---
created: 2026-08-02
updated: 2026-08-02
type: concept
area: dev
tags:
  - type/concept
---

# 💡 Parse, Don't Validate

My own hand-written explanation that must survive.

## 🔗 Source & References
- Extracted from: [[Some Original Note]]
`;

const concept = {
  title: "Parse, Don't Validate",
  summary: "Validate at the boundary, model the rest.",
  area: "dev",
};

test("a colliding title never overwrites curated content", () => {
  const generated = buildConceptNoteMarkdown(concept, "Some Original Note", "2026-10-04");
  const { content, action } = mergeConceptNote(CURATED, generated);

  assert.equal(action, "merged");
  assert.ok(
    content.includes("My own hand-written explanation that must survive."),
    "curated body must be preserved"
  );
});

test("the original created date is preserved", () => {
  const generated = buildConceptNoteMarkdown(concept, "Some Original Note", "2026-10-04");
  const { content } = mergeConceptNote(CURATED, generated);

  assert.match(content, /^created: 2026-08-02$/m);
  assert.ok(!/^created: 2026-10-04$/m.test(content), "generated created date must not win");
});

test("manual links and provenance survive", () => {
  const generated = buildConceptNoteMarkdown(concept, "Some Original Note", "2026-10-04");
  const { content } = mergeConceptNote(CURATED, generated);

  assert.ok(content.includes("[[Some Original Note]]"));
});

test("new material lands in a marked, reviewable region", () => {
  const generated = buildConceptNoteMarkdown(concept, "Some Original Note", "2026-10-04");
  const { content } = mergeConceptNote(CURATED, generated);

  assert.ok(content.includes(DISTILLED_START));
  assert.ok(content.includes(DISTILLED_END));
  assert.ok(content.includes("Validate at the boundary"), "new summary must be present");
});

test("re-running the same distillation changes nothing", () => {
  const generated = buildConceptNoteMarkdown(concept, "Some Original Note", "2026-10-04");
  const first = mergeConceptNote(CURATED, generated);
  const second = mergeConceptNote(first.content, generated);

  assert.equal(second.action, "unchanged");
  assert.equal(second.content, first.content);
});

test("re-distilling with new material replaces the marked region only", () => {
  const first = mergeConceptNote(
    CURATED,
    buildConceptNoteMarkdown(concept, "Some Original Note", "2026-10-04")
  );
  const updated = { ...concept, summary: "A sharper summary." };
  const second = mergeConceptNote(first.content, buildConceptNoteMarkdown(updated, "Some Original Note", "2026-10-05"));

  assert.equal(second.action, "merged");
  assert.ok(second.content.includes("A sharper summary."));
  assert.ok(!second.content.includes("Validate at the boundary"), "stale region must be replaced");
  assert.ok(second.content.includes("My own hand-written explanation that must survive."));
  assert.equal(
    second.content.split(DISTILLED_START).length - 1,
    1,
    "must not accumulate marked regions"
  );
});

test("a note without frontmatter still keeps its content", () => {
  const noFm = "# Handwritten\n\nkeep me\n";
  const { content } = mergeConceptNote(
    noFm,
    buildConceptNoteMarkdown(concept, "Some Original Note", "2026-10-04")
  );
  assert.ok(content.includes("keep me"));
  assert.ok(content.includes(DISTILLED_START));
});

test("distinct generated content does not duplicate the curated body", () => {
  const a = buildConceptNoteMarkdown(concept, "Note A", "2026-10-04");
  const b = buildConceptNoteMarkdown({ ...concept, summary: "different" }, "Note B", "2026-10-05");

  const first = mergeConceptNote(CURATED, a);
  const second = mergeConceptNote(first.content, b);

  assert.equal(
    (second.content.match(/# 💡 Parse, Don't Validate/g) || []).length,
    1,
    "curated heading must appear once"
  );
});