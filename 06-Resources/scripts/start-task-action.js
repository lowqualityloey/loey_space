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

// 06-Resources/scripts/src/start-task-action.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_child_process = require("child_process");

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
    const taskMatch = line.match(/^\s*-\s*\[([ xX/>\-?*!])\]\s+(.*)$/);
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
function createBranchSlug(issueNumber, title, prefix = "feat") {
  const clean = title.toLowerCase().replace(/#priority\/[^\s]+/gi, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 35).replace(/^-|-$/g, "");
  return `${prefix}/issue-${issueNumber}-${clean || "task"}`;
}
function formatCardWithIssue(issueNumber, issueUrl, title, priority) {
  const prioritySuffix = priority ? ` #priority/${priority.toLowerCase()}` : "";
  const cleanTitle = title.replace(/#priority\/[^\s]+/gi, "").trim();
  return `- [/] [#${issueNumber}](${issueUrl}) ${cleanTitle}${prioritySuffix}`;
}
function moveCardToInProgress(content, targetTaskTitle, updatedCardText) {
  const lines = content.split("\n");
  const cleanTarget = targetTaskTitle.toLowerCase().trim();
  let removedLine = false;
  const filteredLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const taskMatch = line.match(/^\s*-\s*\[[ xX/>\-?*!]\]\s+(.*)$/);
    if (taskMatch && !removedLine) {
      const lineClean = taskMatch[1].toLowerCase().trim();
      if (lineClean.includes(cleanTarget) || cleanTarget.includes(lineClean)) {
        removedLine = true;
        continue;
      }
    }
    filteredLines.push(line);
  }
  let inProgressIdx = -1;
  for (let i = 0; i < filteredLines.length; i++) {
    if (normalizeLaneName(filteredLines[i]) === "in progress") {
      inProgressIdx = i;
      break;
    }
  }
  if (inProgressIdx !== -1) {
    filteredLines.splice(inProgressIdx + 1, 0, "", updatedCardText);
    return filteredLines.join("\n");
  }
  return filteredLines.join("\n") + `

## In Progress

${updatedCardText}
`;
}

// 06-Resources/scripts/src/start-task-action.ts
function isTFile(file) {
  return Boolean(file && typeof file === "object" && "extension" in file && "path" in file);
}
function resolveVaultPath() {
  const fromCwd = process.cwd();
  if (fs.existsSync(path.join(fromCwd, "02-Projects")) || fs.existsSync(path.join(fromCwd, "06-Resources"))) {
    return fromCwd;
  }
  let current = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, "02-Projects")) || fs.existsSync(path.join(current, "06-Resources"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current)
      break;
    current = parent;
  }
  return process.cwd();
}
async function startTaskAction(params) {
  const app = params?.app || (typeof window !== "undefined" ? window.app : globalThis.app);
  const Notice = typeof window !== "undefined" ? window.Notice : globalThis.Notice;
  const quickAddApi = params?.quickAddApi;
  if (!app) {
    runCli();
    return;
  }
  const activeFile = app.workspace.getActiveFile();
  if (!activeFile || !isTFile(activeFile)) {
    if (Notice)
      new Notice("\u26A0\uFE0F Please open a Kanban note (e.g. shelf Kanban.md)!");
    return;
  }
  const cache = app.metadataCache.getFileCache(activeFile);
  const fm = cache?.frontmatter;
  const owner = fm?.github_owner || "lowqualityloey";
  const repo = fm?.github_repo || activeFile.basename.replace(/Kanban/i, "").trim().toLowerCase().replace(/\s+/g, "-");
  const projectNumber = fm?.github_project_number ? Number(fm.github_project_number) : null;
  const content = await app.vault.read(activeFile);
  const { tasks } = extractLocalKanbanTasks(content);
  const openTasks = tasks.filter((t) => {
    const lane = normalizeLaneName(t.section);
    const isOpenLane = lane === "to do" || lane === "backlog";
    const isUnlinked = !t.title.includes("github.com") && !t.title.match(/\[#\d+\]/);
    return isOpenLane && isUnlinked;
  });
  if (openTasks.length === 0) {
    if (Notice)
      new Notice('\u26A0\uFE0F No unlinked tasks found in "To Do" or "Backlog" lanes!');
    return;
  }
  let selectedTask = null;
  if (quickAddApi && typeof quickAddApi.suggester === "function") {
    const displayOptions = openTasks.map((t) => {
      const p = t.priority ? ` [${t.priority}]` : "";
      return `${t.section.replace(/^#+\s*/, "")}: ${t.title}${p}`;
    });
    const choice = await quickAddApi.suggester(displayOptions, displayOptions);
    if (!choice)
      return;
    const idx = displayOptions.indexOf(choice);
    selectedTask = openTasks[idx];
  } else {
    selectedTask = openTasks[0];
  }
  if (!selectedTask)
    return;
  if (Notice)
    new Notice(`\u{1F680} Creating GitHub Issue in ${owner}/${repo}...`, 4e3);
  const { cleanText, priority } = parsePriorityTag(selectedTask.title);
  const priorityLabel = priority ? `--label "${priority}"` : "";
  let issueUrl = "";
  let issueNumber = 0;
  try {
    const createCmd = `gh issue create --repo "${owner}/${repo}" --title "${cleanText.replace(/"/g, '\\"')}" --body "Created from Obsidian Kanban note [[${activeFile.basename}]]." ${priorityLabel}`;
    issueUrl = (0, import_child_process.execSync)(createCmd, { encoding: "utf8", timeout: 15e3 }).trim();
    const match = issueUrl.match(/\/issues\/(\d+)/);
    if (match) {
      issueNumber = parseInt(match[1], 10);
    }
  } catch (err) {
    console.error("Failed to create GitHub issue:", err);
    if (Notice)
      new Notice(`\u274C GitHub issue creation failed: ${err?.message || err}`, 6e3);
    return;
  }
  if (!issueNumber) {
    if (Notice)
      new Notice(`\u274C Could not determine issue number from ${issueUrl}`, 6e3);
    return;
  }
  const branchName = createBranchSlug(issueNumber, cleanText);
  const updatedCard = formatCardWithIssue(issueNumber, issueUrl, cleanText, priority);
  const updatedContent = moveCardToInProgress(content, cleanText, updatedCard);
  await app.vault.modify(activeFile, updatedContent);
  if (Notice) {
    new Notice(
      `\u{1F389} Issue #${issueNumber} created!
\u{1F4CC} Moved card to "In Progress".
\u{1F33F} Branch: ${branchName}`,
      8e3
    );
  }
}
function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  console.log("\u{1F680} Start Task & Generate GitHub Issue (CLI Mode)...");
  console.log(`\u{1F4C2} Vault Root: ${vaultRoot}
`);
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
  let targetPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(vaultRoot, p))) {
      targetPath = p;
      break;
    }
  }
  if (!targetPath) {
    console.error(`\u274C Could not find Kanban note for project "${projectName}".`);
    process.exit(1);
  }
  const fullPath = path.join(vaultRoot, targetPath);
  const content = fs.readFileSync(fullPath, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = fmMatch ? fmMatch[1] : "";
  const ownerMatch = fm.match(/^github_owner:\s*(.*)$/m);
  const repoMatch = fm.match(/^github_repo:\s*(.*)$/m);
  const owner = ownerMatch ? ownerMatch[1].trim() : "lowqualityloey";
  const repo = repoMatch ? repoMatch[1].trim() : projectName.toLowerCase();
  const { tasks } = extractLocalKanbanTasks(content);
  const matchedTask = tasks.find((t) => t.title.toLowerCase().includes(taskQuery.toLowerCase()));
  if (!matchedTask) {
    console.error(`\u274C Task matching "${taskQuery}" not found in ${targetPath}.`);
    process.exit(1);
  }
  const { cleanText, priority } = parsePriorityTag(matchedTask.title);
  console.log(`\u{1F4CB} Found Task: "${cleanText}" (Lane: ${matchedTask.section})`);
  console.log(`\u{1F680} Creating GitHub Issue in ${owner}/${repo}...`);
  const priorityLabel = priority ? `--label "${priority}"` : "";
  let issueUrl = "";
  let issueNumber = 0;
  try {
    const createCmd = `gh issue create --repo "${owner}/${repo}" --title "${cleanText.replace(/"/g, '\\"')}" --body "Created from Obsidian Kanban note [[${path.basename(targetPath)}]]." ${priorityLabel}`;
    issueUrl = (0, import_child_process.execSync)(createCmd, { encoding: "utf8", timeout: 15e3 }).trim();
    const match = issueUrl.match(/\/issues\/(\d+)/);
    if (match) {
      issueNumber = parseInt(match[1], 10);
    }
  } catch (err) {
    console.error("\u274C Failed to create GitHub issue:", err?.message || err);
    process.exit(1);
  }
  const branchName = createBranchSlug(issueNumber, cleanText);
  const updatedCard = formatCardWithIssue(issueNumber, issueUrl, cleanText, priority);
  const updatedContent = moveCardToInProgress(content, cleanText, updatedCard);
  fs.writeFileSync(fullPath, updatedContent, "utf8");
  console.log(`
\u{1F389} Success!`);
  console.log(`  \u{1F517} Issue:  ${issueUrl}`);
  console.log(`  \u{1F4CC} Status: Moved to "In Progress" in ${targetPath}`);
  console.log(`  \u{1F33F} Branch: ${branchName}`);
  console.log(`
To start coding on this branch, run:
  git checkout -b ${branchName}`);
}
if (require.main === module) {
  runCli();
}
module.exports = Object.assign(startTaskAction, {
  createBranchSlug,
  formatCardWithIssue,
  moveCardToInProgress
});
