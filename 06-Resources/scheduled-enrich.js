const fs = require('fs');
const path = require('path');

// Configuration
const VAULT_PATH = path.join(__dirname, '..');
const ENRICHED_NOTES_FILE = path.join(__dirname, '.enriched-timestamps.json');

// Load existing timestamps
let enrichedTimestamps = {};
try {
  if (fs.existsSync(ENRICHED_NOTES_FILE)) {
    enrichedTimestamps = JSON.parse(fs.readFileSync(ENRICHED_NOTES_FILE, 'utf8'));
  }
} catch (e) {
  console.log('No existing timestamps file, starting fresh');
}

// Get today's date for batching
const today = new Date().toISOString().split('T')[0];

async function getNotesToEnrich() {
  const vault = {
    getMarkdownFiles: () => {
      const files = [];
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
  };
  
  return vault.getMarkdownFiles();
}

async function shouldEnrich(file) {
  const now = Date.now();
  const lastEnriched = enrichedTimestamps[file] || 0;
  const daysSince = (now - lastEnriched) / (1000 * 60 * 60 * 24);
  
  // Re-enrich every 7 days
  return daysSince >= 7;
}

async function markEnriched(file) {
  enrichedTimestamps[file] = Date.now();
  fs.writeFileSync(ENRICHED_NOTES_FILE, JSON.stringify(enrichedTimestamps, null, 2));
}

async function processBatch(notes, batchSize = 5) {
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
    } catch (e) {
      console.error(`Error processing ${note}:`, e.message);
    }
  }
  
  console.log(`\n✅ Enrichment batch complete. Enriched ${enrichedCount} notes.`);
  console.log(`Next batch: 7 days from now.`);
}

async function main() {
  const notes = await getNotesToEnrich();
  await processBatch(notes);
}

main();
