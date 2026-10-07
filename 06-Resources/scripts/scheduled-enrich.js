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
var SIMULATE = process.argv.includes("--simulate");
var LIVE_ENRICHMENT_SUPPORTED = false;
var BATCH_SIZE = 5;
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
async function enrichNote(_file) {
  throw new Error("no live enrichment adapter is implemented");
}
function reportCounts(counts) {
  console.log(
    `Counts \u2014 attempted: ${counts.attempted}, succeeded: ${counts.succeeded}, skipped: ${counts.skipped}, failed: ${counts.failed}`
  );
}
async function main() {
  const notes = await getNotesToEnrich();
  console.log(`Found ${notes.length} notes to check for enrichment`);
  const counts = { attempted: 0, succeeded: 0, skipped: 0, failed: 0 };
  const candidates = [];
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
    console.log("SIMULATION MODE \u2014 no timestamps will be written.");
    for (const note of batch) {
      console.log(`Would enrich: ${note}`);
      counts.attempted++;
    }
    reportCounts(counts);
    console.log(`
\u2705 Simulation complete. Would enrich ${counts.attempted} notes.`);
    return;
  }
  if (!LIVE_ENRICHMENT_SUPPORTED) {
    console.log("LIVE MODE UNSUPPORTED \u2014 no enrichment adapter is implemented; refusing to record success.");
    reportCounts(counts);
    console.log(`Rejected without persisting: ${batch.length} note(s). No timestamps were written.`);
    process.exitCode = 1;
    return;
  }
  for (const note of batch) {
    counts.attempted++;
    try {
      await enrichNote(note);
      await markEnriched(note);
      counts.succeeded++;
      console.log(`Enriched: ${note}`);
    } catch (e) {
      counts.failed++;
      console.error(`Failed to enrich ${note}: ${e?.message || e}`);
    }
  }
  reportCounts(counts);
  if (counts.failed === 0) {
    console.log(`
\u2705 Enrichment complete. Enriched ${counts.succeeded} notes.`);
  } else {
    console.log(`
\u26A0\uFE0F Enrichment incomplete. Enriched ${counts.succeeded}, failed ${counts.failed}.`);
    process.exitCode = 1;
  }
}
main();
