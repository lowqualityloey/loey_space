import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { bundleSources } from '../../../build.mjs';
import {
  REPO_ROOT,
  SCRIPTS_DIR,
  compareBundles,
  formatDriftReport,
  runEsbuild,
  verifyBundleParity,
} from '../../../check-bundle-parity.mjs';

// Synthetic fixture entry points. Nothing here touches the real vault sources or
// the committed bundles — every file is created inside a fresh temp directory.
const FIXTURE_ENTRIES = [
  { bundle: 'synthetic-alpha.js', source: 'synthetic-alpha.ts', symbol: 'SYNTHETIC_ALPHA' },
  { bundle: 'synthetic-beta.js', source: 'synthetic-beta.ts', symbol: 'SYNTHETIC_BETA' },
];

const DRIFT_MARKER = '\n// synthetic drift injected by the bundle-parity test\n';

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function snapshotScriptsDir() {
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort()
    .map((file) => [file, sha256(path.join(SCRIPTS_DIR, file))]);
}

/**
 * Builds a throwaway source tree, bundles it with the repository's own esbuild
 * configuration, then clones that fresh output into a second directory standing
 * in for "the committed bundles". Tests drift the committed copy only.
 */
async function createSyntheticFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-bundle-parity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const srcDir = path.join(root, 'src');
  const generatedDir = path.join(root, 'generated');
  const committedDir = path.join(root, 'committed');
  fs.mkdirSync(srcDir);
  fs.mkdirSync(generatedDir);
  fs.mkdirSync(committedDir);

  for (const { source, symbol } of FIXTURE_ENTRIES) {
    fs.writeFileSync(path.join(srcDir, source), `export const ${symbol} = 'synthetic-fixture-value';\n`);
  }

  await runEsbuild({
    entryPoints: FIXTURE_ENTRIES.map(({ source }) => path.join(srcDir, source)),
    outDir: generatedDir,
  });

  for (const { bundle } of FIXTURE_ENTRIES) {
    fs.copyFileSync(path.join(generatedDir, bundle), path.join(committedDir, bundle));
  }

  return {
    generatedDir,
    committedDir,
    bundles: FIXTURE_ENTRIES.map(({ bundle, source }) => ({
      bundle,
      source: `06-Resources/scripts/src/${source}`,
    })),
  };
}

test('bundle parity: a stale committed bundle is reported by name', async (t) => {
  const fixture = await createSyntheticFixture(t);
  fs.appendFileSync(path.join(fixture.committedDir, 'synthetic-beta.js'), DRIFT_MARKER);

  const { drifted, checked } = compareBundles({
    bundles: fixture.bundles,
    generatedDir: fixture.generatedDir,
    committedDir: fixture.committedDir,
  });

  assert.equal(checked, fixture.bundles.length);
  assert.deepEqual(
    drifted.map((entry) => entry.bundle),
    ['synthetic-beta.js'],
    'only the drifted bundle must be reported'
  );
});

test('bundle parity: byte-identical committed bundles report no drift', async (t) => {
  const fixture = await createSyntheticFixture(t);

  const { drifted, checked } = compareBundles({
    bundles: fixture.bundles,
    generatedDir: fixture.generatedDir,
    committedDir: fixture.committedDir,
  });

  assert.equal(checked, fixture.bundles.length);
  assert.deepEqual(drifted, [], 'an unmodified fresh build must produce zero drift');
});

test('bundle parity: the drift report names the affected bundle, its source and the fix', async (t) => {
  const fixture = await createSyntheticFixture(t);
  fs.appendFileSync(path.join(fixture.committedDir, 'synthetic-alpha.js'), DRIFT_MARKER);

  const { drifted } = compareBundles({
    bundles: fixture.bundles,
    generatedDir: fixture.generatedDir,
    committedDir: fixture.committedDir,
  });

  const report = formatDriftReport(drifted);

  assert.ok(report.includes('synthetic-alpha.js'), 'report must name the stale bundle');
  assert.ok(report.includes('06-Resources/scripts/src/synthetic-alpha.ts'), 'report must name the source');
  assert.ok(report.includes('npm run build'), 'report must tell the reader how to regenerate');
  assert.ok(!report.includes('synthetic-beta.js'), 'in-sync bundles must not be listed');
});

test('bundle parity: every committed bundle matches a fresh build of its source', async () => {
  const { drifted, checked } = await verifyBundleParity({ repoRoot: REPO_ROOT });

  assert.equal(
    checked,
    bundleSources.length,
    'the check must cover every esbuild entry point declared in build.mjs'
  );
  assert.deepEqual(
    drifted.map((entry) => `${entry.sourcePath} -> ${entry.committedPath}`),
    [],
    'committed bundles are byte-identical to a fresh build'
  );
});

test('bundle parity: verification leaves the committed bundles untouched', async () => {
  const before = snapshotScriptsDir();

  await verifyBundleParity({ repoRoot: REPO_ROOT });

  assert.deepEqual(snapshotScriptsDir(), before, 'the check must not write into 06-Resources/scripts');
});

test('bundle parity: the check never reads personal notes or plugin configuration', () => {
  const forbidden = ['docs/', '.secrets', '.obsidian', '00-Private', '.env', '01-Daily', '05-Personal'];
  const guardSources = ['check-bundle-parity.mjs', 'build.mjs'].map((file) =>
    fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')
  );

  for (const [index, source] of guardSources.entries()) {
    for (const needle of forbidden) {
      assert.ok(
        !source.includes(needle),
        `guard source #${index + 1} must not reference ${needle}`
      );
    }
  }
});