import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const SCRIPTS_DIR = path.resolve(process.cwd(), '06-Resources/scripts');

const EXPECTED_SCRIPTS = [
  'ai-enrich-action.js',
  'audit-links.js',
  'clear-capture-dump.js',
  'distill-concept-action.js',
  'quick-capture-action.js',
  'sync-github-kanban.js',
  'triage-sweep.js',
  'weekly-ai-summary.js',
  'scheduled-enrich.js',
  'validate-templates.js'
];

test('build integrity: all 10 bundled scripts exist and contain no require("obsidian")', () => {
  for (const script of EXPECTED_SCRIPTS) {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    assert.ok(fs.existsSync(scriptPath), `Bundled script ${script} must exist in 06-Resources/scripts`);

    const code = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(
      !code.includes('require("obsidian")') && !code.includes("require('obsidian')"),
      `${script} must not contain require("obsidian") to prevent QuickAdd runtime failures`
    );
  }
});
