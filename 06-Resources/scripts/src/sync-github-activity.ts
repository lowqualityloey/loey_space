import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';
import {
  GitHubEventItem,
  formatGitHubEvent,
  formatDateKey,
  mergeDailyLog
} from './lib/github-events';

function isTFile(file: any): file is TFile {
  return Boolean(file && typeof file === 'object' && 'extension' in file && 'path' in file);
}

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
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function fetchUserEvents(username = 'lowqualityloey'): GitHubEventItem[] {
  try {
    const raw = execSync(`gh api "users/${username}/events" -q "."`, {
      encoding: 'utf8',
      timeout: 15000
    });
    return JSON.parse(raw);
  } catch (err: any) {
    console.error('Failed to fetch GitHub events via gh CLI:', err?.message || err);
    return [];
  }
}

async function syncGithubActivityAction(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (typeof window !== 'undefined' ? (window as any).app : (globalThis as any).app);
  const Notice = typeof window !== 'undefined' ? (window as any).Notice : (globalThis as any).Notice;

  if (!app) {
    runCli();
    return;
  }

  let targetFile: TFile | null = app.workspace.getActiveFile();
  const todayDateKey = formatDateKey(new Date());

  // If active file is not a daily note, target today's daily note
  if (!targetFile || !targetFile.path.startsWith('01-Daily/') || targetFile.basename.startsWith('_')) {
    const todayPath = `01-Daily/${todayDateKey.slice(0, 7)}/${todayDateKey}.md`;
    const abstractFile = app.vault.getAbstractFileByPath(todayPath);
    if (abstractFile && isTFile(abstractFile)) {
      targetFile = abstractFile;
    }
  }

  if (!targetFile || !isTFile(targetFile)) {
    if (Notice) new Notice(`⚠️ Daily note for today (${todayDateKey}) does not exist. Create it first!`, 5000);
    return;
  }

  const noteDateKey = targetFile.basename; // e.g. "2026-08-31"
  if (Notice) new Notice('🐙 Fetching GitHub activity...', 3000);

  const events = fetchUserEvents('lowqualityloey');
  if (!events.length) {
    if (Notice) new Notice('⚠️ No GitHub activity found or gh CLI not authenticated.', 4000);
    return;
  }

  const matchingBullets: string[] = [];
  for (const ev of events) {
    const formatted = formatGitHubEvent(ev);
    if (formatted && formatted.dateKey === noteDateKey) {
      matchingBullets.push(formatted.markdown);
    }
  }

  if (matchingBullets.length === 0) {
    if (Notice) new Notice(`ℹ️ No GitHub events found for ${noteDateKey}.`, 4000);
    return;
  }

  const content = await app.vault.read(targetFile);
  const { updatedContent, addedCount } = mergeDailyLog(content, matchingBullets.reverse()); // chronological order

  if (addedCount > 0) {
    await app.vault.modify(targetFile, updatedContent);
    if (Notice) new Notice(`🎉 Synced ${addedCount} GitHub event(s) to ${targetFile.basename}!`, 5000);
  } else {
    if (Notice) new Notice(`ℹ️ All GitHub events for ${noteDateKey} are already in Daily Log.`, 4000);
  }
}

function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const targetDateKey = args[0] || formatDateKey(new Date());

  console.log('🐙 Sync GitHub Activity to Daily Log (CLI Mode)...');
  console.log(`📂 Vault Root: ${vaultRoot}`);
  console.log(`📅 Target Date: ${targetDateKey}\n`);

  const monthFolder = targetDateKey.slice(0, 7);
  const dailyPath = path.join(vaultRoot, '01-Daily', monthFolder, `${targetDateKey}.md`);

  if (!fs.existsSync(dailyPath)) {
    console.error(`❌ Daily note not found: ${dailyPath}`);
    process.exit(1);
  }

  console.log(`🔍 Fetching GitHub events for lowqualityloey...`);
  const events = fetchUserEvents('lowqualityloey');

  const matchingBullets: string[] = [];
  for (const ev of events) {
    const formatted = formatGitHubEvent(ev);
    if (formatted && formatted.dateKey === targetDateKey) {
      matchingBullets.push(formatted.markdown);
    }
  }

  if (matchingBullets.length === 0) {
    console.log(`ℹ️ No GitHub activity found for date ${targetDateKey}.`);
    return;
  }

  console.log(`📋 Found ${matchingBullets.length} activity item(s):`);
  matchingBullets.forEach((b) => console.log(`  ${b}`));

  const content = fs.readFileSync(dailyPath, 'utf8');
  const { updatedContent, addedCount } = mergeDailyLog(content, matchingBullets.reverse());

  if (addedCount > 0) {
    fs.writeFileSync(dailyPath, updatedContent, 'utf8');
    console.log(`\n🎉 Successfully added ${addedCount} new event(s) to ${dailyPath}!`);
  } else {
    console.log(`\nℹ️ All events for ${targetDateKey} are already logged in the note.`);
  }
}

if (require.main === module) {
  runCli();
}

export = Object.assign(syncGithubActivityAction, {
  fetchUserEvents,
  syncGithubActivityAction
});
