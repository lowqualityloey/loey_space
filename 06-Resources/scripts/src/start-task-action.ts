import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';
import {
  LocalTaskItem,
  normalizeLaneName,
  parsePriorityTag,
  extractLocalKanbanTasks,
  createBranchSlug,
  formatCardWithIssue,
  moveCardToInProgress
} from './lib/github';

function isTFile(file: any): file is TFile {
  return Boolean(file && typeof file === 'object' && 'extension' in file && 'path' in file);
}

function resolveVaultPath(): string {
  const fromCwd = process.cwd();
  if (fs.existsSync(path.join(fromCwd, '02-Projects')) || fs.existsSync(path.join(fromCwd, '06-Resources'))) {
    return fromCwd;
  }
  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, '02-Projects')) || fs.existsSync(path.join(current, '06-Resources'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

async function startTaskAction(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (typeof window !== 'undefined' ? (window as any).app : (globalThis as any).app);
  const Notice = typeof window !== 'undefined' ? (window as any).Notice : (globalThis as any).Notice;
  const quickAddApi = params?.quickAddApi;

  if (!app) {
    runCli();
    return;
  }

  const activeFile = app.workspace.getActiveFile();
  if (!activeFile || !isTFile(activeFile)) {
    if (Notice) new Notice('⚠️ Please open a Kanban note (e.g. shelf Kanban.md)!');
    return;
  }

  const cache = app.metadataCache.getFileCache(activeFile);
  const fm = cache?.frontmatter;

  const owner = fm?.github_owner || 'lowqualityloey';
  const repo = fm?.github_repo || activeFile.basename.replace(/Kanban/i, '').trim().toLowerCase().replace(/\s+/g, '-');
  const projectNumber = fm?.github_project_number ? Number(fm.github_project_number) : null;

  const content = await app.vault.read(activeFile);
  const { tasks } = extractLocalKanbanTasks(content);

  // Filter tasks in To Do or Backlog that don't already have an issue link
  const openTasks = tasks.filter((t) => {
    const lane = normalizeLaneName(t.section);
    const isOpenLane = lane === 'to do' || lane === 'backlog';
    const isUnlinked = !t.title.includes('github.com') && !t.title.match(/\[#\d+\]/);
    return isOpenLane && isUnlinked;
  });

  if (openTasks.length === 0) {
    if (Notice) new Notice('⚠️ No unlinked tasks found in "To Do" or "Backlog" lanes!');
    return;
  }

  let selectedTask: LocalTaskItem | null = null;

  if (quickAddApi && typeof quickAddApi.suggester === 'function') {
    const displayOptions = openTasks.map((t) => {
      const p = t.priority ? ` [${t.priority}]` : '';
      return `${t.section.replace(/^#+\s*/, '')}: ${t.title}${p}`;
    });

    const choice = await quickAddApi.suggester(displayOptions, displayOptions);
    if (!choice) return; // User cancelled

    const idx = displayOptions.indexOf(choice);
    selectedTask = openTasks[idx];
  } else {
    selectedTask = openTasks[0];
  }

  if (!selectedTask) return;

  if (Notice) new Notice(`🚀 Creating GitHub Issue in ${owner}/${repo}...`, 4000);

  const { cleanText, priority } = parsePriorityTag(selectedTask.title);
  const priorityLabel = priority ? `--label "${priority}"` : '';

  let issueUrl = '';
  let issueNumber = 0;

  try {
    const createArgs = [
      'issue',
      'create',
      '--repo',
      `${owner}/${repo}`,
      '--title',
      cleanText,
      '--body',
      `Created from Obsidian Kanban note [[${activeFile.basename}]].`
    ];
    if (priority) {
      createArgs.push('--label', priority);
    }
    issueUrl = execFileSync('gh', createArgs, { encoding: 'utf8', timeout: 15000 }).trim();

    const match = issueUrl.match(/\/issues\/(\d+)/);
    if (match) {
      issueNumber = parseInt(match[1], 10);
    }
  } catch (err: any) {
    console.error('Failed to create GitHub issue:', err);
    if (Notice) new Notice(`❌ GitHub issue creation failed: ${err?.message || err}`, 6000);
    return;
  }

  if (!issueNumber) {
    if (Notice) new Notice(`❌ Could not determine issue number from ${issueUrl}`, 6000);
    return;
  }

  const branchName = createBranchSlug(issueNumber, cleanText);
  const updatedCard = formatCardWithIssue(issueNumber, issueUrl, cleanText, priority);
  const updatedContent = moveCardToInProgress(content, cleanText, updatedCard);

  await app.vault.modify(activeFile, updatedContent);

  if (Notice) {
    new Notice(
      `🎉 Issue #${issueNumber} created!\n` +
      `📌 Moved card to "In Progress".\n` +
      `🌿 Branch: ${branchName}`,
      8000
    );
  }
}

function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);

  console.log('🚀 Start Task & Generate GitHub Issue (CLI Mode)...');
  console.log(`📂 Vault Root: ${vaultRoot}\n`);

  const projectName = args[0];
  const taskQuery = args[1];

  if (!projectName || !taskQuery) {
    console.log('Usage: node start-task-action.js <project-name> "<task-title>"');
    console.log('Example: node start-task-action.js shelf "Build TanStack Router layouts"');
    process.exit(1);
  }

  const possiblePaths = [
    `02-Projects/${projectName}/${projectName} Kanban.md`,
    `02-Projects/${projectName}/Kanban.md`
  ];

  let targetPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(vaultRoot, p))) {
      targetPath = p;
      break;
    }
  }

  if (!targetPath) {
    console.error(`❌ Could not find Kanban note for project "${projectName}".`);
    process.exit(1);
  }

  const fullPath = path.join(vaultRoot, targetPath);
  const content = fs.readFileSync(fullPath, 'utf8');

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = fmMatch ? fmMatch[1] : '';

  const ownerMatch = fm.match(/^github_owner:\s*(.*)$/m);
  const repoMatch = fm.match(/^github_repo:\s*(.*)$/m);

  const owner = ownerMatch ? ownerMatch[1].trim() : 'lowqualityloey';
  const repo = repoMatch ? repoMatch[1].trim() : projectName.toLowerCase();

  const { tasks } = extractLocalKanbanTasks(content);
  const matchedTask = tasks.find((t) => t.title.toLowerCase().includes(taskQuery.toLowerCase()));

  if (!matchedTask) {
    console.error(`❌ Task matching "${taskQuery}" not found in ${targetPath}.`);
    process.exit(1);
  }

  const { cleanText, priority } = parsePriorityTag(matchedTask.title);
  console.log(`📋 Found Task: "${cleanText}" (Lane: ${matchedTask.section})`);
  console.log(`🚀 Creating GitHub Issue in ${owner}/${repo}...`);

  const priorityLabel = priority ? `--label "${priority}"` : '';
  let issueUrl = '';
  let issueNumber = 0;

  try {
    const createArgs = [
      'issue',
      'create',
      '--repo',
      `${owner}/${repo}`,
      '--title',
      cleanText,
      '--body',
      `Created from Obsidian Kanban note [[${path.basename(targetPath)}]].`
    ];
    if (priority) {
      createArgs.push('--label', priority);
    }
    issueUrl = execFileSync('gh', createArgs, { encoding: 'utf8', timeout: 15000 }).trim();

    const match = issueUrl.match(/\/issues\/(\d+)/);
    if (match) {
      issueNumber = parseInt(match[1], 10);
    }
  } catch (err: any) {
    console.error('❌ Failed to create GitHub issue:', err?.message || err);
    process.exit(1);
  }

  const branchName = createBranchSlug(issueNumber, cleanText);
  const updatedCard = formatCardWithIssue(issueNumber, issueUrl, cleanText, priority);
  const updatedContent = moveCardToInProgress(content, cleanText, updatedCard);

  fs.writeFileSync(fullPath, updatedContent, 'utf8');

  console.log(`\n🎉 Success!`);
  console.log(`  🔗 Issue:  ${issueUrl}`);
  console.log(`  📌 Status: Moved to "In Progress" in ${targetPath}`);
  console.log(`  🌿 Branch: ${branchName}`);
  console.log(`\nTo start coding on this branch, run:\n  git checkout -b ${branchName}`);
}

if (require.main === module) {
  runCli();
}

export = Object.assign(startTaskAction, {
  createBranchSlug,
  formatCardWithIssue,
  moveCardToInProgress
});
