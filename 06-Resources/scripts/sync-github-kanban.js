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

// 06-Resources/scripts/src/sync-github-kanban.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_child_process = require("child_process");
var import_util = require("util");

// 06-Resources/scripts/src/lib/github.ts
function normalizeLaneName(rawName) {
  const clean = rawName.replace(/^#+\s*/, "").replace(/^[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔📦🔄📋🎯💡💻🚀✨⚠️]\s*/, "").trim().toLowerCase();
  if (clean.includes("backlog") || clean.includes("icebox"))
    return "backlog";
  if (clean.includes("to do") || clean.includes("todo") || clean.includes("to-do"))
    return "to do";
  if (clean.includes("in progress") || clean.includes("doing") || clean.includes("in-progress"))
    return "in progress";
  if (clean.includes("review") || clean.includes("test") || clean.includes("qa"))
    return "review / test";
  if (clean.includes("done") || clean.includes("completed") || clean.includes("archive"))
    return "done";
  return clean;
}
function parsePriorityTag(text) {
  const match = text.match(/#priority\/(p[0-3]|high|medium|low)/i);
  if (!match) {
    return { cleanText: text.trim(), priority: null };
  }
  const rawPriority = match[1].toLowerCase();
  let normalized = "P2";
  if (rawPriority === "p0" || rawPriority === "high")
    normalized = "P0";
  else if (rawPriority === "p1")
    normalized = "P1";
  else if (rawPriority === "p2" || rawPriority === "medium")
    normalized = "P2";
  else if (rawPriority === "p3" || rawPriority === "low")
    normalized = "P3";
  const cleanText = text.replace(/#priority\/(?:p[0-3]|high|medium|low)/gi, "").replace(/\s{2,}/g, " ").trim();
  return { cleanText, priority: normalized };
}
function extractLocalKanbanTasks(content) {
  const lines = content.split("\n");
  const tasks = [];
  const sections = [];
  let currentSection = "";
  let inFrontmatter = false;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (i === 0 && trimmed === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === "---")
        inFrontmatter = false;
      continue;
    }
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    if (trimmed.startsWith("## ")) {
      currentSection = trimmed;
      if (!sections.includes(trimmed)) {
        sections.push(trimmed);
      }
      continue;
    }
    const taskMatch = line.match(/^-\s*\[([ xX/>\-?*!])\]\s+(.*)$/);
    if (taskMatch && currentSection) {
      const checkbox = taskMatch[1];
      const rawText = taskMatch[2].trim();
      const dateMatch = rawText.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
      const completionDate = dateMatch ? dateMatch[1] : null;
      const { cleanText, priority } = parsePriorityTag(rawText.replace(/✅\s*\d{4}-\d{2}-\d{2}/, "").trim());
      tasks.push({
        title: cleanText,
        priority,
        section: currentSection,
        checkbox,
        completionDate
      });
    }
  }
  return { tasks, sections };
}

// 06-Resources/scripts/src/sync-github-kanban.ts
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
function isTFile(file) {
  return Boolean(file && typeof file === "object" && "extension" in file && "path" in file);
}
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
    const parent = path.dirname(current);
    if (parent === current)
      break;
    current = parent;
  }
  return process.cwd();
}
function discoverProjectBoards(app) {
  const boards = [];
  const files = app.vault.getMarkdownFiles();
  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (fm && fm.github_project_number) {
      boards.push({
        filePath: file.path,
        title: file.basename,
        projectNumber: Number(fm.github_project_number),
        owner: fm.github_owner || "lowqualityloey",
        repo: fm.github_repo
      });
    }
  }
  return boards;
}
async function syncSingleBoard(app, targetFile, config, customExecFn) {
  const Notice = typeof window !== "undefined" ? window.Notice : globalThis.Notice;
  const projectNumber = config.projectNumber;
  const owner = config.owner;
  const execFn = async (cmd, opts) => {
    if (customExecFn) {
      const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
      return customExecFn(cmdStr, opts);
    }
    const timeout = opts?.timeout || 15e3;
    if (Array.isArray(cmd)) {
      const [file, ...args] = cmd;
      const res = await execFileAsync(file, args, { encoding: "utf8", timeout });
      return { stdout: res.stdout.toString(), stderr: res.stderr?.toString() };
    } else {
      const res = await execAsync(cmd, { encoding: "utf8", timeout });
      return { stdout: res.stdout.toString(), stderr: res.stderr?.toString() };
    }
  };
  console.log(`Syncing "${targetFile.basename}" with GitHub Project #${projectNumber} (${owner})...`);
  let projectId = null;
  let statusField = null;
  let priorityField = null;
  const remoteItems = [];
  const [projRes, itemsRes] = await Promise.allSettled([
    execFn(["gh", "project", "view", String(projectNumber), "--owner", owner, "--format", "json"], { timeout: 15e3 }),
    execFn(["gh", "project", "item-list", String(projectNumber), "--owner", owner, "--format", "json", "--limit", "100"], { timeout: 15e3 })
  ]);
  if (projRes.status === "fulfilled") {
    try {
      const projData = JSON.parse(projRes.value.stdout);
      projectId = projData.id;
      if (Array.isArray(projData.fields)) {
        statusField = projData.fields.find((f) => f.name && f.name.toLowerCase() === "status") || null;
        priorityField = projData.fields.find((f) => f.name && f.name.toLowerCase() === "priority") || null;
      }
    } catch (e) {
      console.warn(`Project view parsing error for #${projectNumber}:`, e);
    }
  } else {
    const e = projRes.reason;
    if (e?.stderr && typeof e.stderr === "string" && e.stderr.includes("read:project")) {
      if (Notice)
        new Notice("\u26A0\uFE0F Missing GitHub token scope!\nRun in terminal: gh auth refresh -s project", 8e3);
      throw e;
    }
    console.warn(`Project view warning for #${projectNumber}:`, e);
  }
  if (itemsRes.status === "fulfilled") {
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
    } catch (e) {
      console.warn(`Could not parse items for Project #${projectNumber}:`, e);
    }
  } else {
    console.warn(`Could not fetch items for Project #${projectNumber}:`, itemsRes.reason);
  }
  const content = await app.vault.read(targetFile);
  const { tasks: localTasks } = extractLocalKanbanTasks(content);
  let updatedCount = 0;
  let createdCount = 0;
  let errorCount = 0;
  if (projectId && statusField && statusField.options) {
    const statusOptions = statusField.options;
    const updateTasks = [];
    const createTasks = [];
    for (const task of localTasks) {
      const match = remoteItems.find(
        (r) => r.title && r.title.toLowerCase().trim() === task.title.toLowerCase().trim()
      );
      const targetNormalizedLane = normalizeLaneName(task.section);
      let matchedOption = statusOptions.find(
        (opt) => normalizeLaneName(opt.name) === targetNormalizedLane
      );
      if (!matchedOption) {
        if (targetNormalizedLane === "done") {
          matchedOption = statusOptions.find((opt) => opt.name.toLowerCase().includes("done"));
        } else if (targetNormalizedLane === "in progress") {
          matchedOption = statusOptions.find((opt) => opt.name.toLowerCase().includes("progress") || opt.name.toLowerCase().includes("doing"));
        } else if (targetNormalizedLane === "to do") {
          matchedOption = statusOptions.find((opt) => opt.name.toLowerCase().includes("todo") || opt.name.toLowerCase().includes("to do"));
        }
      }
      if (match && matchedOption && match.status !== matchedOption.name) {
        const editCmd = [
          "gh",
          "project",
          "item-edit",
          "--project-id",
          projectId,
          "--id",
          match.id,
          "--field-id",
          statusField.id,
          "--single-select-option-id",
          matchedOption.id
        ];
        updateTasks.push(async () => {
          try {
            await execFn(editCmd, { timeout: 1e4 });
            return true;
          } catch (err) {
            console.warn(`Failed to update status for "${task.title}":`, err);
            return false;
          }
        });
      } else if (!match) {
        createTasks.push(async () => {
          try {
            const createCmd = [
              "gh",
              "project",
              "item-create",
              String(projectNumber),
              "--owner",
              owner,
              "--title",
              task.title,
              "--format",
              "json"
            ];
            const createRes = await execFn(createCmd, { timeout: 1e4 });
            const newItem = JSON.parse(createRes.stdout);
            if (newItem && newItem.id && matchedOption) {
              const editCmd = [
                "gh",
                "project",
                "item-edit",
                "--project-id",
                projectId,
                "--id",
                newItem.id,
                "--field-id",
                statusField.id,
                "--single-select-option-id",
                matchedOption.id
              ];
              await execFn(editCmd, { timeout: 5e3 });
            }
            return true;
          } catch (err) {
            console.warn(`Failed to create project item for "${task.title}":`, err);
            return false;
          }
        });
      }
    }
    if (updateTasks.length > 0) {
      const results = await Promise.all(updateTasks.map((fn) => fn()));
      for (const ok of results) {
        if (ok)
          updatedCount++;
        else
          errorCount++;
      }
    }
    if (createTasks.length > 0) {
      const results = await Promise.all(createTasks.map((fn) => fn()));
      for (const ok of results) {
        if (ok)
          createdCount++;
        else
          errorCount++;
      }
    }
  }
  return { updated: updatedCount, created: createdCount, errors: errorCount };
}
async function syncGitHubKanban(params) {
  const app = params?.app || (typeof window !== "undefined" ? window.app : globalThis.app);
  const Notice = typeof window !== "undefined" ? window.Notice : globalThis.Notice;
  const quickAddApi = params?.quickAddApi;
  if (!app) {
    runCli();
    return;
  }
  try {
    const activeFile = app.workspace.getActiveFile();
    const allBoards = discoverProjectBoards(app);
    if (allBoards.length === 0) {
      if (Notice)
        new Notice('\u26A0\uFE0F No Kanban boards with "github_project_number" found in vault!', 5e3);
      return;
    }
    let targetBoards = [];
    if (activeFile && isTFile(activeFile)) {
      const activeBoard = allBoards.find((b) => b.filePath === activeFile.path);
      if (activeBoard) {
        targetBoards = [activeBoard];
      }
    }
    if (targetBoards.length === 0) {
      if (quickAddApi && typeof quickAddApi.suggester === "function") {
        const displayOptions = ["\u{1F504} Sync All Projects"].concat(
          allBoards.map((b) => `\u{1F4CB} ${b.title} (Project #${b.projectNumber})`)
        );
        const choice = await quickAddApi.suggester(displayOptions, displayOptions);
        if (!choice)
          return;
        if (choice === "\u{1F504} Sync All Projects") {
          targetBoards = allBoards;
        } else {
          const index = displayOptions.indexOf(choice) - 1;
          if (index >= 0 && index < allBoards.length) {
            targetBoards = [allBoards[index]];
          }
        }
      } else {
        targetBoards = allBoards;
      }
    }
    if (Notice) {
      const label = targetBoards.length === 1 ? `"${targetBoards[0].title}"` : `${targetBoards.length} projects`;
      new Notice(`\u{1F504} 2-Way Syncing ${label} with GitHub Projects...`, 4e3);
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
        } catch (err) {
          totalErrors++;
          console.error(`Sync error on ${board.title}:`, err);
        }
      }
    }
    if (Notice) {
      if (totalErrors > 0) {
        new Notice(`\u26A0\uFE0F Kanban sync complete with ${totalErrors} issue(s). Updated: ${totalUpdated}`, 5e3);
      } else {
        new Notice(`\u{1F389} GitHub Kanban 2-way sync complete! Updated ${totalUpdated} item(s).`, 5e3);
      }
    }
  } catch (err) {
    console.error("Fatal Kanban sync error:", err);
    if (Notice)
      new Notice(`\u274C Kanban sync failed: ${err?.message || err}`, 6e3);
  }
}
function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const filterArg = args.find((a) => !a.startsWith("-"))?.toLowerCase();
  console.log("\u{1F504} GitHub Projects Multi-Kanban Sync (CLI Mode)...");
  console.log(`\u{1F4C2} Vault Root: ${vaultRoot}
`);
  const boards = [];
  const projectDirs = ["02-Projects", "01-Daily"];
  function scanDir(dirRel) {
    const dirFull = path.join(vaultRoot, dirRel);
    if (!fs.existsSync(dirFull))
      return;
    const entries = fs.readdirSync(dirFull, { withFileTypes: true });
    for (const entry of entries) {
      const entryRel = path.join(dirRel, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        scanDir(entryRel);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const fullPath = path.join(vaultRoot, entryRel);
        const content = fs.readFileSync(fullPath, "utf8");
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
              owner: ownerMatch ? ownerMatch[1].trim() : "lowqualityloey",
              repo: repoMatch ? repoMatch[1].trim() : void 0
            });
          }
        }
      }
    }
  }
  projectDirs.forEach(scanDir);
  if (boards.length === 0) {
    console.log('\u26A0\uFE0F No Kanban boards with "github_project_number" found.');
    return;
  }
  let selectedBoards = boards;
  if (filterArg) {
    selectedBoards = boards.filter(
      (b) => b.title.toLowerCase().includes(filterArg) || b.filePath.toLowerCase().includes(filterArg)
    );
    if (selectedBoards.length === 0) {
      console.log(`\u26A0\uFE0F No boards matching "${filterArg}" found. Available boards:`);
      boards.forEach((b) => console.log(`  - ${b.title} (#${b.projectNumber})`));
      return;
    }
  }
  console.log(`Found ${selectedBoards.length} board(s) configured for GitHub sync:`);
  selectedBoards.forEach((b) => console.log(`  - ${b.title} -> GitHub Project #${b.projectNumber} (${b.owner})`));
  console.log("");
  const mockApp = {
    vault: {
      read: async (file) => fs.readFileSync(path.join(vaultRoot, file.path), "utf8"),
      modify: async (file, data) => fs.writeFileSync(path.join(vaultRoot, file.path), data, "utf8")
    }
  };
  (async () => {
    for (const board of selectedBoards) {
      const mockFile = { basename: board.title, path: board.filePath };
      try {
        const res = await syncSingleBoard(mockApp, mockFile, board);
        console.log(`\u2705 ${board.title}: updated ${res.updated}, created ${res.created}, errors ${res.errors}`);
      } catch (err) {
        console.error(`\u274C ${board.title} sync failed:`, err?.message || err);
      }
    }
    console.log("\n\u{1F389} Multi-Kanban sync finished!");
  })();
}
if (require.main === module) {
  runCli();
}
module.exports = Object.assign(syncGitHubKanban, {
  normalizeLaneName,
  parsePriorityTag,
  extractLocalKanbanTasks,
  syncSingleBoard
});
