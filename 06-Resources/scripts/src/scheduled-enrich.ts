import * as fs from 'fs';
import * as path from 'path';

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

// Get today's date for batching
const today = new Date().toISOString().split('T')[0];

async function getNotesToEnrich(): Promise<string[]> {
  const files: string[] = [];
  const folders = ['01-Daily', '02-Projects', '03-Dev', '04-Learning', '08-Concepts'];

  folders.forEach(folder => {
    const folderPath = path.join(VAULT_PATH, folder);
    if (fs.existsSync(folderPath)) {
      const entries = fs.readdirSync(folderPath);
      entries.forEach(entry => {
        if (entry.endsWith('.md') && !entry.startsWith('_')) {
          files.push(path.join(folder, entry));
        }
      });
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
  fs.writeFileSync(ENRICHED_NOTES_FILE, JSON.stringify(enrichedTimestamps, null, 2));
}

async function processBatch(notes: string[], batchSize: number = 5): Promise<void> {
  console.log(`Found ${notes.length} notes to check for enrichment`);

  let enrichedCount = 0;

  for (const note of notes) {
    try {
      const should = await shouldEnrich(note);
      if (should) {
        console.log(`[Batch ${enrichedCount + 1}/${batchSize}] Would enrich: ${note}`);
        enrichedCount++;

        // Simulate actual enrichment
        await markEnriched(note);

        if (enrichedCount >= batchSize) {
          console.log(`Batch size reached (${batchSize}), stopping`);
          break;
        }
      } else {
        console.log(`Skipping (recently enriched): ${note}`);
      }
    } catch (e: any) {
      console.error(`Error processing ${note}:`, e?.message || e);
    }
  }

  console.log(`\n✅ Enrichment batch complete. Enriched ${enrichedCount} notes.`);
  console.log(`Next batch: 7 days from now.`);
}

async function main(): Promise<void> {
  const notes = await getNotesToEnrich();
  await processBatch(notes);
}

main();

