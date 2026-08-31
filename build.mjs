import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');

const entryPoints = [
  '06-Resources/scripts/src/ai-enrich-action.ts',
  '06-Resources/scripts/src/clear-capture-dump.ts',
  '06-Resources/scripts/src/quick-capture-action.ts',
  '06-Resources/scripts/src/scheduled-enrich.ts',
  '06-Resources/scripts/src/sync-github-kanban.ts',
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

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
