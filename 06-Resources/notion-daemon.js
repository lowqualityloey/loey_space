const fs = require('fs');
const path = require('path');
const { sync } = require('./notion-sync');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  console.log(line.trim());
  try {
    fs.appendFileSync(path.join(__dirname, 'sync-daemon.log'), line, 'utf8');
  } catch (e) {}
}

log('🤖 Notion Daily Sync Daemon starting...');
log('🚀 Running initial sync...');

// Execute immediately on startup
sync().then(() => {
  log('✅ Initial sync complete. Daemon listening every 5 minutes.');
}).catch(err => {
  log(`❌ Sync error: ${err.message}`);
});

// Repeat every 5 minutes
setInterval(async () => {
  log('⏰ Starting 5-minute scheduled sync...');
  try {
    await sync();
    log('✅ Scheduled sync complete.');
  } catch (err) {
    log(`❌ Scheduled sync error: ${err.message}`);
  }
}, INTERVAL_MS);
