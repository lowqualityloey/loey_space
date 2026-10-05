import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');

const entryPoints = [
  '06-Resources/scripts/src/ai-enrich-action.ts',
  '06-Resources/scripts/src/audit-links.ts',
  '06-Resources/scripts/src/clear-capture-dump.ts',
  '06-Resources/scripts/src/distill-concept-action.ts',
  '06-Resources/scripts/src/quick-capture-action.ts',
  '06-Resources/scripts/src/scheduled-enrich.ts',
  '06-Resources/scripts/src/start-task-action.ts',
  '06-Resources/scripts/src/sync-github-activity.ts',
  '06-Resources/scripts/src/sync-github-kanban.ts',
  '06-Resources/scripts/src/task-view.ts',
  '06-Resources/scripts/src/triage-sweep.ts',
  '06-Resources/scripts/src/validate-templates.ts',
  '06-Resources/scripts/src/weekly-ai-summary.ts',
];

const buildOptions = {
  entryPoints,
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outdir: '06-Resources/scripts',
  external: ['obsidian', 'electron', 'fs', 'path', 'child_process', 'http', 'https', 'crypto', 'os', 'util'],
  logLevel: 'info',
};

// Every entry point produces exactly one flat <name>.js next to the sources.
// Exported so the bundle-parity guard derives the expected output list from this
// file instead of hard-coding a second copy that could silently go stale.
export const bundleSources = entryPoints.map((source) => ({
  source,
  bundle: `${path.basename(source, path.extname(source))}.js`,
}));

export { entryPoints, buildOptions };

async function run() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('⚡ Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('✅ Build completed successfully!');
  }
}

// Only build when invoked as a program. Importing this module (the parity guard
// and its tests do) must reuse the configuration above without emitting bundles
// as a side effect.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
