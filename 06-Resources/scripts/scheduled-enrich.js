var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// 06-Resources/scripts/src/scheduled-enrich.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function resolveVaultPath() {
  const fromCwd = process.cwd();
  if (fs.existsSync(path.join(fromCwd, "01-Daily")) || fs.existsSync(path.join(fromCwd, "06-Resources"))) {
    return fromCwd;
  }
  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, "01-Daily")) || fs.existsSync(path.join(current, "06-Resources"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(__dirname, "../../");
}
var VAULT_PATH = resolveVaultPath();
var ENRICHED_NOTES_FILE = path.join(__dirname, ".enriched-timestamps.json");
var enrichedTimestamps = {};
try {
  if (fs.existsSync(ENRICHED_NOTES_FILE)) {
    enrichedTimestamps = JSON.parse(fs.readFileSync(ENRICHED_NOTES_FILE, "utf8"));
  }
} catch (e) {
  console.log("No existing timestamps file, starting fresh");
}
var today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
var SIMULATE = process.argv.includes("--simulate");
async function getNotesToEnrich() {
  const files = [];
  const folders = ["01-Daily", "02-Projects", "03-Dev", "04-Learning", "08-Concepts"];
  folders.forEach((folder) => {
    const folderPath = path.join(VAULT_PATH, folder);
    if (fs.existsSync(folderPath)) {
      let walk = function(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
            files.push(path.relative(VAULT_PATH, full));
          }
        }
      };
      walk(folderPath);
    }
  });
  return files;
}
async function shouldEnrich(file) {
  const now = Date.now();
  const lastEnriched = enrichedTimestamps[file] || 0;
  const daysSince = (now - lastEnriched) / (1e3 * 60 * 60 * 24);
  return daysSince >= 7;
}
async function markEnriched(file) {
  enrichedTimestamps[file] = Date.now();
  await fs.promises.writeFile(ENRICHED_NOTES_FILE, JSON.stringify(enrichedTimestamps, null, 2));
}
async function processBatch(notes, batchSize = 5) {
  console.log(`Found ${notes.length} notes to check for enrichment`);
  if (SIMULATE) {
    console.log("SIMULATION MODE \u2014 no timestamps will be written.");
  }
  let enrichedCount = 0;
  let simulatedCount = 0;
  for (const note of notes) {
    try {
      const should = await shouldEnrich(note);
      if (should) {
        if (SIMULATE) {
          console.log(`[Sim ${simulatedCount + 1}/${batchSize}] Would enrich: ${note}`);
          simulatedCount++;
        } else {
          console.log(`[Batch ${enrichedCount + 1}/${batchSize}] Enriching: ${note}`);
          await markEnriched(note);
          enrichedCount++;
        }
        if (!SIMULATE && enrichedCount >= batchSize) {
          console.log(`Batch size reached (${batchSize}), stopping`);
          break;
        }
        if (SIMULATE && simulatedCount >= batchSize) {
          console.log(`Batch size reached (${batchSize}), stopping`);
          break;
        }
      } else {
        console.log(`Skipping (recently enriched): ${note}`);
      }
    } catch (e) {
      console.error(`Error processing ${note}:`, e?.message || e);
    }
  }
  if (SIMULATE) {
    console.log(`
\u2705 Simulation complete. Would enrich ${simulatedCount} notes.`);
  } else {
    console.log(`
\u2705 Enrichment batch complete. Enriched ${enrichedCount} notes.`);
    console.log(`Next batch: 7 days from now.`);
  }
}
async function main() {
  const notes = await getNotesToEnrich();
  await processBatch(notes);
}
main();
