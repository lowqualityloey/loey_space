import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';
import {
  GitHubEventItem,
  ActivityTableRow,
  formatGitHubEventToRow,
  formatDateKey,
  fetchCommitDetailsMap,
  mergeDailyLogTable
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
    await runCli();
    return;
  }

  let targetFile: TFile | null = app.workspace.getActiveFile();
  const todayDateKey = formatDateKey(new Date());

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

  const noteDateKey = targetFile.basename;
  if (Notice) new Notice('🐙 Fetching GitHub activity...', 3000);

  const events = fetchUserEvents('lowqualityloey');
  if (!events.length) {
    if (Notice) new Notice('⚠️ No GitHub activity found or gh CLI not authenticated.', 4000);
    return;
  }

  const targetDateEvents = events.filter((ev) => {
    const d = new Date(ev.created_at);
    return formatDateKey(d) === noteDateKey;
  });

  const pushesToFetch: Array<{ repo: string; head: string }> = [];
  for (const ev of targetDateEvents) {
    if (ev.type === 'PushEvent' && ev.payload?.head && (!ev.payload.commits || ev.payload.commits.length === 0)) {
      pushesToFetch.push({ repo: ev.repo.name, head: ev.payload.head });
    }
  }

  const commitMap = await fetchCommitDetailsMap(pushesToFetch);

  const rows: ActivityTableRow[] = [];
  for (const ev of targetDateEvents) {
    const r = formatGitHubEventToRow(ev, commitMap);
    if (r) {
      rows.push(r);
    }
  }

  if (rows.length === 0) {
    if (Notice) new Notice(`ℹ️ No GitHub events found for ${noteDateKey}.`, 4000);
    return;
  }

  const content = await app.vault.read(targetFile);
  const { updatedContent, count } = mergeDailyLogTable(content, rows);

  await app.vault.modify(targetFile, updatedContent);
  if (Notice) new Notice(`🎉 Synced ${count} GitHub event(s) into table callout for ${targetFile.basename}!`, 5000);
}

async function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const targetDateKey = args[0] || formatDateKey(new Date());

  console.log('🐙 Sync GitHub Activity to Daily Log (Table Callout Mode)...');
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

  const targetDateEvents = events.filter((ev) => {
    const d = new Date(ev.created_at);
    return formatDateKey(d) === targetDateKey;
  });

  const pushesToFetch: Array<{ repo: string; head: string }> = [];
  for (const ev of targetDateEvents) {
    if (ev.type === 'PushEvent' && ev.payload?.head && (!ev.payload.commits || ev.payload.commits.length === 0)) {
      pushesToFetch.push({ repo: ev.repo.name, head: ev.payload.head });
    }
  }

  if (pushesToFetch.length > 0) {
    console.log(`⚡ Resolving commit details for ${pushesToFetch.length} push event(s)...`);
  }

  const commitMap = await fetchCommitDetailsMap(pushesToFetch);

  const rows: ActivityTableRow[] = [];
  for (const ev of targetDateEvents) {
    const r = formatGitHubEventToRow(ev, commitMap);
    if (r) {
      rows.push(r);
    }
  }

  if (rows.length === 0) {
    console.log(`ℹ️ No GitHub activity found for date ${targetDateKey}.`);
    return;
  }

  console.log(`📋 Found ${rows.length} activity item(s) for table callout:`);
  rows.slice(0, 5).forEach((r) => console.log(`  | ${r.time} | ${r.repo} | ${r.type} | ${r.details.slice(0, 50)}... |`));

  const content = fs.readFileSync(dailyPath, 'utf8');
  const { updatedContent, count } = mergeDailyLogTable(content, rows);

  fs.writeFileSync(dailyPath, updatedContent, 'utf8');
  console.log(`\n🎉 Successfully formatted ${count} event(s) into collapsible table callout in ${dailyPath}!`);
}

if (require.main === module) {
  runCli();
}

export = Object.assign(syncGithubActivityAction, {
  fetchUserEvents,
  syncGithubActivityAction
});
