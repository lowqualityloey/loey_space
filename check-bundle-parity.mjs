#!/usr/bin/env node
/**
 * Bundle parity guard.
 *
 * The bundles under `06-Resources/scripts/*.js` are what Obsidian QuickAdd and the
 * npm CLI entry points actually load — the TypeScript under `src/` is never
 * executed directly. So a commit that edits a `.ts` file without regenerating its
 * `.js` silently ships old behaviour, and nothing in the suite notices.
 *
 * This guard closes that hole: it runs the repository's own esbuild configuration
 * into a throwaway temp directory and compares the result, byte for byte, against
 * the committed bundles. It is a separate script from `npm run build` on purpose —
 * a developer's normal build must stay a build, never a failing verifier.
 *
 * Scope boundary: this guard reads and compares exactly one directory,
 * `06-Resources/scripts`, and writes only to a temp directory outside the
 * repository. It deliberately never reads the numbered journal folders, the
 * private-notes directory, the Obsidian plugin/workspace configuration, or any
 * credential file. Those hold personal content and machine secrets that no build
 * check has any business touching, and CI echoing them into job logs would leak
 * them. Everything it needs comes from `build.mjs` and the bundles themselves, so
 * it also never consults git and gives the same verdict whether or not the
 * developer's working tree happens to be clean.
 */
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { buildOptions, bundleSources } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);

export const REPO_ROOT = path.dirname(__filename);
export const SCRIPTS_DIR = path.join(REPO_ROOT, '06-Resources/scripts');
export const SCRIPTS_RELATIVE = '06-Resources/scripts';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

/**
 * Runs the repository's esbuild configuration into a caller-owned directory.
 * `outDir` is always honoured and never inherited from the checked-in config, so
 * the guard can never write over a committed bundle by accident.
 */
export async function runEsbuild({ entryPoints: entries, outDir, overrides = {} }) {
  await esbuild.build({
    ...buildOptions,
    logLevel: 'silent',
    ...overrides,
    entryPoints: entries,
    outdir: outDir,
  });
  return outDir;
}

/**
 * Compares freshly generated bundles against their committed counterparts.
 * Pure with respect to the filesystem: reads only, writes nothing.
 */
export function compareBundles({ bundles, generatedDir, committedDir }) {
  const drifted = [];

  for (const { bundle, source } of bundles) {
    const committedPath = path.join(committedDir, bundle);
    const generatedPath = path.join(generatedDir, bundle);
    const committedExists = fs.existsSync(committedPath);
    const generatedExists = fs.existsSync(generatedPath);

    if (!committedExists || !generatedExists) {
      drifted.push({
        bundle,
        source,
        committedPath: toPosix(path.relative(REPO_ROOT, committedPath)),
        reason: !committedExists ? 'not committed' : 'not produced by the build',
        committedSha: null,
        generatedSha: generatedExists ? sha256(fs.readFileSync(generatedPath)) : null,
      });
      continue;
    }

    const committedBytes = fs.readFileSync(committedPath);
    const generatedBytes = fs.readFileSync(generatedPath);

    if (!committedBytes.equals(generatedBytes)) {
      drifted.push({
        bundle,
        source,
        committedPath: toPosix(path.relative(REPO_ROOT, committedPath)),
        reason: 'stale',
        committedSha: sha256(committedBytes),
        generatedSha: sha256(generatedBytes),
      });
    }
  }

  return { checked: bundles.length, drifted };
}

/** Names every affected path plus the source it should have been rebuilt from. */
export function formatDriftReport(drifted) {
  const lines = [
    '',
    `❌ Bundle drift: ${drifted.length} committed bundle(s) are not a byte-identical build of ${SCRIPTS_RELATIVE}/src`,
    '',
  ];

  for (const { committedPath, source, reason, committedSha, generatedSha } of drifted) {
    lines.push(`  ${committedPath}`);
    lines.push(`    source:    ${source}`);
    lines.push(`    reason:    ${reason}`);
    if (committedSha) lines.push(`    committed: ${committedSha.slice(0, 12)}`);
    if (generatedSha) lines.push(`    built:     ${generatedSha.slice(0, 12)}`);
    lines.push('');
  }

  lines.push('  QuickAdd and the npm entry points load these .js files, not the TypeScript');
  lines.push('  sources, so a stale bundle ships old behaviour. Rebuild and commit them in the');
  lines.push('  same change so the source and its output stay one atomic edit:');
  lines.push('');
  lines.push('      npm run build');
  for (const { bundle } of drifted) {
    lines.push(`      git add ${SCRIPTS_RELATIVE}/${bundle}`);
  }
  lines.push('');

  return lines.join('\n');
}

/** Builds into a temp directory, compares, then always removes the temp directory. */
export async function verifyBundleParity({ repoRoot = REPO_ROOT } = {}) {
  const generatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loey-bundle-build-'));

  try {
    await runEsbuild({
      entryPoints: bundleSources.map(({ source }) => path.join(repoRoot, source)),
      outDir: generatedDir,
      overrides: { absWorkingDir: repoRoot },
    });

    return compareBundles({
      bundles: bundleSources.map(({ source, bundle }) => ({
        bundle,
        source: toPosix(path.relative(REPO_ROOT, path.join(repoRoot, source))),
      })),
      generatedDir,
      committedDir: path.join(repoRoot, SCRIPTS_RELATIVE),
    });
  } finally {
    fs.rmSync(generatedDir, { recursive: true, force: true });
  }
}

async function main() {
  const { drifted, checked } = await verifyBundleParity();

  if (drifted.length === 0) {
    console.log(
      `✅ Bundle parity verified: ${checked} bundles are byte-identical to a fresh build of ${SCRIPTS_RELATIVE}/src`
    );
    return;
  }

  console.error(formatDriftReport(drifted));
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}