import * as fs from 'fs';
import * as path from 'path';
import { exec as cpExec } from 'child_process';
import { promisify } from 'util';
import type { App, TFile } from 'obsidian';

const execAsync = promisify(cpExec);

type ExecFn = (cmd: string, opts?: { encoding?: string; timeout?: number }) => Promise<{ stdout: string; stderr?: string }>;
import type { QuickAddParams } from './types';
import {
  ProjectField,
  GitHubProjectItem,
  LocalTaskItem,
  BoardSyncConfig,
  normalizeLaneName,
  parsePriorityTag,
  extractLocalKanbanTasks
} from './lib/github';

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

function discoverProjectBoards(app: App): BoardSyncConfig[] {
  const boards: BoardSyncConfig[] = [];
  const files = app.vault.getMarkdownFiles();

  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (fm && fm.github_project_number) {
      boards.push({
        filePath: file.path,
        title: file.basename,
        projectNumber: Number(fm.github_project_number),
        owner: fm.github_owner || 'lowqualityloey',
        repo: fm.github_repo
      });
    }
  }

  return boards;
}

async function syncSingleBoard(
  app: App,
  targetFile: TFile,
  config: BoardSyncConfig,
  customExecFn?: ExecFn
): Promise<{ updated: number; created: number; errors: number }> {
  const Notice = typeof window !== 'undefined' ? (window as any).Notice : (globalThis as any).Notice;
  const projectNumber = config.projectNumber;
  const owner = config.owner;

  const execFn: ExecFn =
    customExecFn ||
    (async (cmd, opts) => {
      const res = await execAsync(cmd, { encoding: 'utf8', timeout: opts?.timeout || 15000 });
      return { stdout: res.stdout.toString(), stderr: res.stderr?.toString() };
    });

  console.log(`Syncing "${targetFile.basename}" with GitHub Project #${projectNumber} (${owner})...`);

  // 1 & 2. Concurrent Dynamic Project & Schema Discovery and Item Fetching
  let projectId: string | null = null;
  let statusField: ProjectField | null = null;
  let priorityField: ProjectField | null = null;
  const remoteItems: GitHubProjectItem[] = [];

  const [projRes, itemsRes] = await Promise.allSettled([
    execFn(`gh project view ${projectNumber} --owner ${owner} --format json`, { timeout: 15000 }),
    execFn(`gh project item-list ${projectNumber} --owner ${owner} --format json --limit 100`, { timeout: 15000 })
  ]);

  if (projRes.status === 'fulfilled') {
    try {
      const projData = JSON.parse(projRes.value.stdout);
      projectId = projData.id;

      if (Array.isArray(projData.fields)) {
        statusField = projData.fields.find((f: any) => f.name && f.name.toLowerCase() === 'status') || null;
        priorityField = projData.fields.find((f: any) => f.name && f.name.toLowerCase() === 'priority') || null;
      }
    } catch (e: any) {
      console.warn(`Project view parsing error for #${projectNumber}:`, e);
    }
  } else {
    const e = projRes.reason;
    if (e?.stderr && typeof e.stderr === 'string' && e.stderr.includes('read:project')) {
      if (Notice) new Notice('⚠️ Missing GitHub token scope!\nRun in terminal: gh auth refresh -s project', 8000);
      throw e;
    }
    console.warn(`Project view warning for #${projectNumber}:`, e);
  }

  if (itemsRes.status === 'fulfilled') {
    try {
      const itemsData = JSON.parse(itemsRes.value.stdout);
      if (Array.isArray(itemsData.items)) {
        for (const item of itemsData.items) {
          remoteItems.push({
            id: item.id,
            title: item.title,
            status: item.status,
            priority: item.priority
          });
        }
      }
    } catch (e: any) {
      console.warn(`Could not parse items for Project #${projectNumber}:`, e);
    }
  } else {
    console.warn(`Could not fetch items for Project #${projectNumber}:`, itemsRes.reason);
  }

  // 3. Read & Parse Local Kanban File
  const content = await app.vault.read(targetFile);
  const { tasks: localTasks } = extractLocalKanbanTasks(content);

  let updatedCount = 0;
  let createdCount = 0;
  let errorCount = 0;

  // 4. Map Local Tasks to Remote Schema
  if (projectId && statusField && statusField.options) {
    const statusOptions = statusField.options;
    const updateTasks: Array<() => Promise<boolean>> = [];

    for (const task of localTasks) {
      const match = remoteItems.find(
        (r) => r.title && r.title.toLowerCase().trim() === task.title.toLowerCase().trim()
      );

      const targetNormalizedLane = normalizeLaneName(task.section);

      let matchedOption = statusOptions.find(
        (opt) => normalizeLaneName(opt.name) === targetNormalizedLane
      );

      if (!matchedOption) {
        if (targetNormalizedLane === 'done') {
          matchedOption = statusOptions.find((opt) => opt.name.toLowerCase().includes('done'));
        } else if (targetNormalizedLane === 'in progress') {
          matchedOption = statusOptions.find((opt) => opt.name.toLowerCase().includes('progress') || opt.name.toLowerCase().includes('doing'));
        } else if (targetNormalizedLane === 'to do') {
          matchedOption = statusOptions.find((opt) => opt.name.toLowerCase().includes('todo') || opt.name.toLowerCase().includes('to do'));
        }
      }

      if (match && matchedOption && match.status !== matchedOption.name) {
        const editCmd = `gh project item-edit --project-id "${projectId}" --id "${match.id}" --field-id "${statusField.id}" --single-select-option-id "${matchedOption.id}"`;
        updateTasks.push(async () => {
          try {
            await execFn(editCmd, { timeout: 10000 });
            return true;
          } catch (err) {
            console.warn(`Failed to update status for "${task.title}":`, err);
            return false;
          }
        });
      }
    }

    if (updateTasks.length > 0) {
      const results = await Promise.all(updateTasks.map((fn) => fn()));
      for (const ok of results) {
        if (ok) updatedCount++;
        else errorCount++;
      }
    }
  }

  return { updated: updatedCount, created: createdCount, errors: errorCount };
}

async function syncGitHubKanban(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (typeof window !== 'undefined' ? (window as any).app : (globalThis as any).app);
  const Notice = typeof window !== 'undefined' ? (window as any).Notice : (globalThis as any).Notice;
  const quickAddApi = params?.quickAddApi;

  if (!app) {
    // If no app and called via require/cli, run node CLI runner
    runCli();
    return;
  }

  try {
    const activeFile = app.workspace.getActiveFile();
    const allBoards = discoverProjectBoards(app);

    if (allBoards.length === 0) {
      if (Notice) new Notice('⚠️ No Kanban boards with "github_project_number" found in vault!', 5000);
      return;
    }

    let targetBoards: BoardSyncConfig[] = [];

    // 1. Check if active file is a configured board
    if (activeFile && isTFile(activeFile)) {
      const activeBoard = allBoards.find((b) => b.filePath === activeFile.path);
      if (activeBoard) {
        targetBoards = [activeBoard];
      }
    }

    // 2. If not on a board and QuickAdd suggester available, let user choose
    if (targetBoards.length === 0) {
      if (quickAddApi && typeof quickAddApi.suggester === 'function') {
        const displayOptions = ['🔄 Sync All Projects'].concat(
          allBoards.map((b) => `📋 ${b.title} (Project #${b.projectNumber})`)
        );

        const choice = await quickAddApi.suggester(displayOptions, displayOptions);
        if (!choice) return; // User cancelled

        if (choice === '🔄 Sync All Projects') {
          targetBoards = allBoards;
        } else {
          const index = displayOptions.indexOf(choice) - 1;
          if (index >= 0 && index < allBoards.length) {
            targetBoards = [allBoards[index]];
          }
        }
      } else {
        // Fallback: default to all boards
        targetBoards = allBoards;
      }
    }

    if (Notice) {
      const label = targetBoards.length === 1 ? `"${targetBoards[0].title}"` : `${targetBoards.length} projects`;
      new Notice(`🔄 2-Way Syncing ${label} with GitHub Projects...`, 4000);
    }

    let totalUpdated = 0;
    let totalErrors = 0;

    for (const board of targetBoards) {
      const file = app.vault.getAbstractFileByPath(board.filePath);
      if (file && isTFile(file)) {
        try {
          const res = await syncSingleBoard(app, file, board);
          totalUpdated += res.updated;
          totalErrors += res.errors;
        } catch (err: any) {
          totalErrors++;
          console.error(`Sync error on ${board.title}:`, err);
        }
      }
    }

    if (Notice) {
      if (totalErrors > 0) {
        new Notice(`⚠️ Kanban sync complete with ${totalErrors} issue(s). Updated: ${totalUpdated}`, 5000);
      } else {
        new Notice(`🎉 GitHub Kanban 2-way sync complete! Updated ${totalUpdated} item(s).`, 5000);
      }
    }
  } catch (err: any) {
    console.error('Fatal Kanban sync error:', err);
    if (Notice) new Notice(`❌ Kanban sync failed: ${err?.message || err}`, 6000);
  }
}

function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const filterArg = args.find((a) => !a.startsWith('-'))?.toLowerCase();

  console.log('🔄 GitHub Projects Multi-Kanban Sync (CLI Mode)...');
  console.log(`📂 Vault Root: ${vaultRoot}\n`);

  const boards: BoardSyncConfig[] = [];
  const projectDirs = ['02-Projects', '01-Daily'];

  function scanDir(dirRel: string) {
    const dirFull = path.join(vaultRoot, dirRel);
    if (!fs.existsSync(dirFull)) return;
    const entries = fs.readdirSync(dirFull, { withFileTypes: true });
    for (const entry of entries) {
      const entryRel = path.join(dirRel, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        scanDir(entryRel);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const fullPath = path.join(vaultRoot, entryRel);
        const content = fs.readFileSync(fullPath, 'utf8');
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          const numMatch = fmMatch[1].match(/^github_project_number:\s*(\d+)/m);
          const ownerMatch = fmMatch[1].match(/^github_owner:\s*(.*)$/m);
          const repoMatch = fmMatch[1].match(/^github_repo:\s*(.*)$/m);
          if (numMatch) {
            boards.push({
              filePath: entryRel,
              title: entry.name.slice(0, -3),
              projectNumber: Number(numMatch[1]),
              owner: ownerMatch ? ownerMatch[1].trim() : 'lowqualityloey',
              repo: repoMatch ? repoMatch[1].trim() : undefined
            });
          }
        }
      }
    }
  }

  projectDirs.forEach(scanDir);

  if (boards.length === 0) {
    console.log('⚠️ No Kanban boards with "github_project_number" found.');
    return;
  }

  let selectedBoards = boards;
  if (filterArg) {
    selectedBoards = boards.filter(
      (b) => b.title.toLowerCase().includes(filterArg) || b.filePath.toLowerCase().includes(filterArg)
    );
    if (selectedBoards.length === 0) {
      console.log(`⚠️ No boards matching "${filterArg}" found. Available boards:`);
      boards.forEach((b) => console.log(`  - ${b.title} (#${b.projectNumber})`));
      return;
    }
  }

  console.log(`Found ${selectedBoards.length} board(s) configured for GitHub sync:`);
  selectedBoards.forEach((b) => console.log(`  - ${b.title} -> GitHub Project #${b.projectNumber} (${b.owner})`));
  console.log('');

  const mockApp: any = {
    vault: {
      read: async (file: any) => fs.readFileSync(path.join(vaultRoot, file.path), 'utf8'),
      modify: async (file: any, data: string) => fs.writeFileSync(path.join(vaultRoot, file.path), data, 'utf8')
    }
  };

  (async () => {
    for (const board of selectedBoards) {
      const mockFile: any = { basename: board.title, path: board.filePath };
      try {
        const res = await syncSingleBoard(mockApp, mockFile, board);
        console.log(`✅ ${board.title}: updated ${res.updated}, created ${res.created}, errors ${res.errors}`);
      } catch (err: any) {
        console.error(`❌ ${board.title} sync failed:`, err?.message || err);
      }
    }
    console.log('\n🎉 Multi-Kanban sync finished!');
  })();
}

if (require.main === module) {
  runCli();
}

export = Object.assign(syncGitHubKanban, {
  normalizeLaneName,
  parsePriorityTag,
  extractLocalKanbanTasks,
  syncSingleBoard
});
