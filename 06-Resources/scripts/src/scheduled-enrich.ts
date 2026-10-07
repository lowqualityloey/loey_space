import * as fs from 'fs';
import * as path from 'path';

// Scheduled enrichment scaffold.
//
// #61 made simulation explicit and non-mutating, and added nested discovery. #123 closes the
// remaining honesty gap: the normal (live) path logged "Enriched N notes" and advanced
// .enriched-timestamps.json without ever producing enrichment output, which then suppressed the
// next attempt for seven days. No live enrichment adapter exists yet, so an unsupported live run
// now fails explicitly and never writes timestamps. `--simulate` stays the only supported,
// explicitly labelled, non-mutating preview path.

// Dynamically locate Vault Root
function resolveVaultPath(): string {
  const fromCwd = process.cwd();
  if (fs.existsSync(path.join(fromCwd, '01-Daily')) || fs.existsSync(path.join(fromCwd, '06-Resources'))) {
    return fromCwd;
  }
  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, '01-Daily')) || fs.existsSync(path.join(current, '06-Resources'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(__dirname, '../../');
}

const VAULT_PATH = resolveVaultPath();
const ENRICHED_NOTES_FILE = path.join(__dirname, '.enriched-timestamps.json');

// Load existing timestamps
let enrichedTimestamps: Record<string, number> = {};
try {
  if (fs.existsSync(ENRICHED_NOTES_FILE)) {
    enrichedTimestamps = JSON.parse(fs.readFileSync(ENRICHED_NOTES_FILE, 'utf8'));
  }
} catch (e) {
  console.log('No existing timestamps file, starting fresh');
}

// Whether this run is a preview. Explicit via --simulate so a dry run never claims to have
// enriched notes and never mutates the timestamp map.
const SIMULATE = process.argv.includes('--simulate');

// No live enrichment adapter is implemented yet (#123). Until one exists, a live run must not
// report success or advance timestamps: either would suppress the next attempt for seven days
// while producing nothing.
const LIVE_ENRICHMENT_SUPPORTED = false;

const BATCH_SIZE = 5;

async function getNotesToEnrich(): Promise<string[]> {
  const files: string[] = [];
  const folders = ['01-Daily', '02-Projects', '03-Dev', '04-Learning', '08-Concepts'];

  folders.forEach(folder => {
    const folderPath = path.join(VAULT_PATH, folder);
    if (fs.existsSync(folderPath)) {
      // Recurse into subfolders (e.g. 01-Daily/2026-10/) so nested dated and project
      // notes are discovered. The previous code only read top-level entries, which missed
      // everything under year-month subdirectories.
      function walk(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
            files.push(path.relative(VAULT_PATH, full));
          }
        }
      }
      walk(folderPath);
    }
  });

  return files;
}

async function shouldEnrich(file: string): Promise<boolean> {
  const now = Date.now();
  const lastEnriched = enrichedTimestamps[file] || 0;
  const daysSince = (now - lastEnriched) / (1000 * 60 * 60 * 24);

  // Re-enrich every 7 days
  return daysSince >= 7;
}

async function markEnriched(file: string): Promise<void> {
  enrichedTimestamps[file] = Date.now();
  await fs.promises.writeFile(ENRICHED_NOTES_FILE, JSON.stringify(enrichedTimestamps, null, 2));
}

// Live enrichment lives here once a real adapter exists. It is intentionally unused while
// LIVE_ENRICHMENT_SUPPORTED is false, and must persist output before returning so that a
// success timestamp can only follow an actual change.
async function enrichNote(_file: string): Promise<void> {
  throw new Error('no live enrichment adapter is implemented');
}

interface RunCounts {
  attempted: number;
  succeeded: number;
  skipped: number;
  failed: number;
}

// attempted / succeeded / skipped / failed are reported separately so a run can never blend
// "looked at" with "wrote output".
function reportCounts(counts: RunCounts): void {
  console.log(
    `Counts — attempted: ${counts.attempted}, succeeded: ${counts.succeeded}, skipped: ${counts.skipped}, failed: ${counts.failed}`
  );
}

async function main(): Promise<void> {
  const notes = await getNotesToEnrich();
  console.log(`Found ${notes.length} notes to check for enrichment`);

  const counts: RunCounts = { attempted: 0, succeeded: 0, skipped: 0, failed: 0 };
  const candidates: string[] = [];

  for (const note of notes) {
    if (await shouldEnrich(note)) {
      candidates.push(note);
    } else {
      console.log(`Skipping (recently enriched): ${note}`);
      counts.skipped++;
    }
  }

  const batch = candidates.slice(0, BATCH_SIZE);

  if (SIMULATE) {
    console.log('SIMULATION MODE — no timestamps will be written.');
    for (const note of batch) {
      console.log(`Would enrich: ${note}`);
      counts.attempted++;
    }
    reportCounts(counts);
    console.log(`\n✅ Simulation complete. Would enrich ${counts.attempted} notes.`);
    return;
  }

  if (!LIVE_ENRICHMENT_SUPPORTED) {
    // Rejected: nothing can be persisted, so no success may be recorded and no timestamp moves.
    console.log('LIVE MODE UNSUPPORTED — no enrichment adapter is implemented; refusing to record success.');
    reportCounts(counts);
    console.log(`Rejected without persisting: ${batch.length} note(s). No timestamps were written.`);
    process.exitCode = 1;
    return;
  }

  for (const note of batch) {
    counts.attempted++;
    try {
      await enrichNote(note); // must persist output before success is recorded
      await markEnriched(note); // only reached after the enrichment actually persisted
      counts.succeeded++;
      console.log(`Enriched: ${note}`);
    } catch (e: any) {
      counts.failed++;
      console.error(`Failed to enrich ${note}: ${e?.message || e}`);
    }
  }

  reportCounts(counts);
  if (counts.failed === 0) {
    console.log(`\n✅ Enrichment complete. Enriched ${counts.succeeded} notes.`);
  } else {
    console.log(`\n⚠️ Enrichment incomplete. Enriched ${counts.succeeded}, failed ${counts.failed}.`);
    process.exitCode = 1;
  }
}

main();
