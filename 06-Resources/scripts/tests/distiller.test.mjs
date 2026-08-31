import test from 'node:test';
import assert from 'node:assert/strict';
import distillConceptAction from '../distill-concept-action.js';

const { buildConceptNoteMarkdown } = distillConceptAction;

test('buildConceptNoteMarkdown: generates valid YAML frontmatter and structure', () => {
  const concept = {
    title: 'Type-Driven Design',
    summary: 'Making illegal application states unrepresentable at compile time.',
    whyItMatters: [
      'Eliminates whole classes of runtime bugs.',
      'Documents invariants directly in code.'
    ],
    mentalModel: 'Parse input data once at the boundary into validated types rather than validating repeatedly.',
    examples: [
      'Parsing string into NonEmptyString.',
      'Discriminated union for state machine states.'
    ],
    area: 'dev',
    topicTag: 'topic/type-systems',
    aliases: ['Parse Don\'t Validate', 'Making Illegal States Unrepresentable']
  };

  const md = buildConceptNoteMarkdown(concept, 'Parse, don’t validate', '2026-08-31');

  // Verify YAML frontmatter
  assert.ok(md.includes('type: concept'));
  assert.ok(md.includes('review_cycle: 90d'));
  assert.ok(md.includes('area: dev'));
  assert.ok(md.includes('topic/type-systems'));
  assert.ok(md.includes('aliases:'));
  assert.ok(md.includes('Parse Don\'t Validate'));

  // Verify Heading & Summary
  assert.ok(md.includes('# 💡 Type-Driven Design'));
  assert.ok(md.includes('> **Making illegal application states unrepresentable at compile time.**'));

  // Verify Sections
  assert.ok(md.includes('## 🧠 Core Mental Model'));
  assert.ok(md.includes('## 🎯 Why It Matters'));
  assert.ok(md.includes('## 🛠️ Practical Examples'));
  assert.ok(md.includes('## 🔗 Source & References'));
  assert.ok(md.includes('Extracted from: [[Parse, don’t validate]]'));

  // Verify Dataview Auto-backlinks
  assert.ok(md.includes('```dataview'));
  assert.ok(md.includes('FROM [[]] AND !"99-Templates"'));
});
