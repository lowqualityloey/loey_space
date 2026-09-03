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
  if (clean.includes("to do") || clean.includes("todo") || clean.includes("to-do") || clean.includes("ready"))
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
function createBranchSlug(issueNumber, title, prefix = "feat") {
  const clean = title.toLowerCase().replace(/#priority\/[^\s]+/gi, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 35).replace(/^-|-$/g, "");
  return `${prefix}/issue-${issueNumber}-${clean || "task"}`;
}
function normalizeSubtaskText(text) {
  return text.toLowerCase().replace(/[`_*~]/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}
function extractSubtasksFromIssueBody(body) {
  const subtasks = [];
  if (!body)
    return subtasks;
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*[-*]\s*\[([ xX])\]\s+(.+)$/);
    if (match) {
      const checked = match[1].toLowerCase() === "x";
      const rawText = match[2].trim();
      const cleanText = normalizeSubtaskText(rawText);
      if (cleanText) {
        subtasks.push({ checked, rawText, cleanText });
      }
    }
  }
  return subtasks;
}
function syncBoardSubtasksWithGitHubIssues(content, issues) {
  const lines = content.split("\n");
  let updatedCount = 0;
  let inFrontmatter = false;
  let inFence = false;
  const issueByNumber = /* @__PURE__ */ new Map();
  const issueByTitle = /* @__PURE__ */ new Map();
  for (const issue of issues) {
    const subtasks = extractSubtasksFromIssueBody(issue.body || "");
    const entry = { issue, subtasks };
    issueByNumber.set(issue.number, entry);
    const cleanTitle = normalizeSubtaskText(issue.title);
    if (cleanTitle) {
      issueByTitle.set(cleanTitle, entry);
    }
  }
  const newLines = [];
  let currentSection = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (i === 0 && trimmed === "---") {
      inFrontmatter = true;
      newLines.push(line);
      continue;
    }
    if (inFrontmatter) {
      newLines.push(line);
      if (trimmed === "---")
        inFrontmatter = false;
      continue;
    }
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      newLines.push(line);
      continue;
    }
    if (inFence) {
      newLines.push(line);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      currentSection = trimmed;
      newLines.push(line);
      continue;
    }
    const topCardMatch = line.match(/^([ \t]*-\s*\[)([ xX/>\-?*!])(\]\s+)(.*)$/);
    const isIndented = /^[ \t]{2,}|\t/.test(line);
    if (topCardMatch && !isIndented) {
      newLines.push(line);
      const cardCheckbox = topCardMatch[2];
      const cardBody = topCardMatch[4];
      let cardEntry = null;
      const issueNumMatch = cardBody.match(/\[#(\d+)\]|#(\d+)/);
      if (issueNumMatch) {
        const num = Number(issueNumMatch[1] || issueNumMatch[2]);
        if (issueByNumber.has(num)) {
          cardEntry = issueByNumber.get(num);
        }
      }
      if (!cardEntry) {
        const cleanCardTitle = normalizeSubtaskText(
          cardBody.replace(/#priority\/[^\s]+/gi, "").replace(/✅\s*\d{4}-\d{2}-\d{2}/, "")
        );
        if (issueByTitle.has(cleanCardTitle)) {
          cardEntry = issueByTitle.get(cleanCardTitle);
        }
      }
      const childLines = [];
      let j = i + 1;
      while (j < lines.length && (/^[ \t]{2,}|\t/.test(lines[j]) || /^\s*>\s/.test(lines[j]))) {
        childLines.push(lines[j]);
        j++;
      }
      if (cardEntry && cardEntry.subtasks.length > 0) {
        const existingSubtaskIndices = childLines.map((cl, idx) => ({ cl, idx })).filter((item) => /^\s*-\s*\[[ xX]\]/.test(item.cl));
        if (existingSubtaskIndices.length === 0 && (cardCheckbox === "/" || normalizeLaneName(currentSection) === "in progress")) {
          const hasBranch = childLines.some((cl) => /^\s*>\s*🌿/.test(cl));
          if (!hasBranch) {
            const cleanTitle = cardBody.replace(/\[#\d+\]\([^)]+\)/g, "").replace(/#\d+/g, "").trim();
            childLines.push(`	  > \u{1F33F} \`${createBranchSlug(cardEntry.issue.number, cleanTitle)}\``);
          }
          for (const sub of cardEntry.subtasks) {
            childLines.push(`	  - [${sub.checked ? "x" : " "}] ${sub.rawText}`);
          }
          updatedCount++;
        } else if (existingSubtaskIndices.length > 0) {
          for (let k = 0; k < childLines.length; k++) {
            const cl = childLines[k];
            const subtaskMatch = cl.match(/^(\s*-\s*\[)([ xX])(\]\s+)(.*)$/);
            if (subtaskMatch) {
              const prefix = subtaskMatch[1];
              const currentCheck = subtaskMatch[2];
              const suffix = subtaskMatch[3];
              const subtaskBody = subtaskMatch[4];
              const cleanLocalText = normalizeSubtaskText(subtaskBody);
              const matchedRemote = cardEntry.subtasks.find((rem) => {
                if (rem.cleanText === cleanLocalText)
                  return true;
                if (rem.cleanText.length > 10 && cleanLocalText.length > 10) {
                  return rem.cleanText.includes(cleanLocalText) || cleanLocalText.includes(rem.cleanText);
                }
                return false;
              });
              if (matchedRemote) {
                const targetCheck = matchedRemote.checked ? "x" : " ";
                if (currentCheck !== targetCheck) {
                  childLines[k] = `${prefix}${targetCheck}${suffix}${subtaskBody}`;
                  updatedCount++;
                }
              }
            }
          }
        }
      }
      newLines.push(...childLines);
      i = j - 1;
      continue;
    }
    newLines.push(line);
  }
  return { updatedContent: newLines.join("\n"), updatedCount };
}
function injectIssueBadgesIntoBoard(content, issues) {
  const lines = content.split("\n");
  let injectedCount = 0;
  let inFrontmatter = false;
  let inFence = false;
  const issueMap = /* @__PURE__ */ new Map();
  for (const issue of issues) {
    const clean = issue.title.toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (clean) {
      issueMap.set(clean, issue);
    }
  }
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
    const taskMatch = line.match(/^(\s*-\s*\[[ xX/>\-?*!]\]\s+)(.*)$/);
    if (!taskMatch)
      continue;
    const prefix = taskMatch[1];
    const body = taskMatch[2];
    if (/\[#\d+\]\([^)]+\)/.test(body) || /#\d+/.test(body))
      continue;
    const cleanBody = body.replace(/#priority\/[^\s]+/gi, "").replace(/✅\s*\d{4}-\d{2}-\d{2}/, "").replace(/\[\[[^\]]+\]\]/g, "").replace(/[^\w\s]/g, "").trim().toLowerCase();
    if (!cleanBody)
      continue;
    const matchedIssue = issueMap.get(cleanBody) || Array.from(issueMap.values()).find((iss) => {
      const issClean = iss.title.toLowerCase().replace(/[^\w\s]/g, "").trim();
      return issClean.length > 5 && (cleanBody.includes(issClean) || issClean.includes(cleanBody));
    });
    if (matchedIssue) {
      const newBody = `[#${matchedIssue.number}](${matchedIssue.url}) ${body.trim()}`;
      lines[i] = `${prefix}${newBody}`;
      injectedCount++;
    }
  }
  return { updatedContent: lines.join("\n"), injectedCount };
}
function syncBoardLanesWithRemoteItems(content, remoteItems, repoIssues, todayDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
  let inFrontmatter = false;
  const frontmatterLines = [];
  const bodyLines = [];
  const settingsLines = [];
  let inSettings = false;
  const rawLines = content.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();
    if (i === 0 && trimmed === "---") {
      inFrontmatter = true;
      frontmatterLines.push(line);
      continue;
    }
    if (inFrontmatter) {
      frontmatterLines.push(line);
      if (trimmed === "---") {
        inFrontmatter = false;
      }
      continue;
    }
    if (trimmed.startsWith("%% kanban:settings")) {
      inSettings = true;
    }
    if (inSettings) {
      settingsLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }
  const lanes = [];
  let currentLane = null;
  let currentCard = null;
  const preambleLines = [];
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      if (currentCard && currentLane) {
        currentLane.cards.push(currentCard);
        currentCard = null;
      }
      const normalizedName = normalizeLaneName(trimmed);
      currentLane = {
        headingLine: line,
        normalizedName,
        cards: []
      };
      lanes.push(currentLane);
      continue;
    }
    if (!currentLane) {
      preambleLines.push(line);
      continue;
    }
    const taskMatch = line.match(/^([ \t]*-\s*\[)([ xX/>\-?*!])(\]\s+)(.*)$/);
    const isIndented = /^[ \t]{2,}|\t/.test(line);
    if (taskMatch && !isIndented) {
      if (currentCard) {
        currentLane.cards.push(currentCard);
      }
      const checkbox = taskMatch[2];
      const rawTitle = taskMatch[4];
      const issueNumMatch = rawTitle.match(/\[#(\d+)\]|#(\d+)/);
      const issueNumber = issueNumMatch ? Number(issueNumMatch[1] || issueNumMatch[2]) : null;
      const urlMatch = rawTitle.match(/\((https?:\/\/[^\s)]+)\)/);
      const issueUrl = urlMatch ? urlMatch[1] : null;
      const dateMatch = rawTitle.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
      const completionDate = dateMatch ? dateMatch[1] : null;
      const { cleanText, priority } = parsePriorityTag(rawTitle.replace(/✅\s*\d{4}-\d{2}-\d{2}/, "").trim());
      currentCard = {
        headerLine: line,
        checkbox,
        rawTitle,
        cleanTitle: cleanText.replace(/\[#\d+\]\([^)]+\)/g, "").replace(/#\d+/g, "").trim(),
        issueNumber,
        issueUrl,
        priority,
        completionDate,
        childrenLines: []
      };
      continue;
    }
    if (currentCard && (isIndented || /^\s*>\s/.test(line))) {
      currentCard.childrenLines.push(line);
      continue;
    }
  }
  if (currentCard && currentLane) {
    currentLane.cards.push(currentCard);
    currentCard = null;
  }
  const remoteByNumber = /* @__PURE__ */ new Map();
  const remoteByTitle = /* @__PURE__ */ new Map();
  for (const item of remoteItems) {
    if (item.number) {
      remoteByNumber.set(item.number, item);
    }
    const cleanTitle = normalizeSubtaskText(item.title || "");
    if (cleanTitle)
      remoteByTitle.set(cleanTitle, item);
    const cleanContentTitle = normalizeSubtaskText(item.contentTitle || "");
    if (cleanContentTitle)
      remoteByTitle.set(cleanContentTitle, item);
  }
  const issuesByNumber = /* @__PURE__ */ new Map();
  for (const iss of repoIssues) {
    issuesByNumber.set(iss.number, iss);
  }
  let movedCount = 0;
  for (const lane of lanes) {
    const remainingCards = [];
    for (const card of lane.cards) {
      let targetStatus = null;
      if (card.issueNumber && remoteByNumber.has(card.issueNumber)) {
        const item = remoteByNumber.get(card.issueNumber);
        if (item.status)
          targetStatus = item.status;
      } else {
        const cleanCard = normalizeSubtaskText(card.cleanTitle);
        if (remoteByTitle.has(cleanCard)) {
          const item = remoteByTitle.get(cleanCard);
          if (item.status)
            targetStatus = item.status;
        }
      }
      if (!targetStatus && card.issueNumber && issuesByNumber.has(card.issueNumber)) {
        const iss = issuesByNumber.get(card.issueNumber);
        if (iss.state === "CLOSED") {
          targetStatus = "Done";
        }
      }
      if (!targetStatus) {
        remainingCards.push(card);
        continue;
      }
      const targetLaneNorm = normalizeLaneName(targetStatus);
      if (lane.normalizedName === "done" || card.checkbox === "x") {
        remainingCards.push(card);
        continue;
      }
      if (targetLaneNorm !== lane.normalizedName) {
        movedCount++;
        if (targetLaneNorm === "done") {
          card.checkbox = "x";
          if (!card.completionDate) {
            card.completionDate = todayDate;
            if (!card.headerLine.includes("\u2705")) {
              card.headerLine = card.headerLine.replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)(.*)$/, `$1x$2$3 \u2705 ${todayDate}`);
            } else {
              card.headerLine = card.headerLine.replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)/, "$1x$2");
            }
          } else {
            card.headerLine = card.headerLine.replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)/, "$1x$2");
          }
          card.childrenLines = card.childrenLines.map(
            (ch) => ch.replace(/^(\s*-\s*\[)[ ](\]\s+)/, "$1x$2")
          );
        } else if (targetLaneNorm === "in progress") {
          card.checkbox = "/";
          card.headerLine = card.headerLine.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, "").replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)/, "$1/$2");
          const hasSubtasks = card.childrenLines.some((l) => /^\s*-\s*\[[ xX]\]/.test(l));
          if (!hasSubtasks && card.issueNumber && issuesByNumber.has(card.issueNumber)) {
            const iss = issuesByNumber.get(card.issueNumber);
            const subtasks = extractSubtasksFromIssueBody(iss.body || "");
            if (subtasks.length > 0) {
              const hasBranch = card.childrenLines.some((l) => /^\s*>\s*🌿/.test(l));
              if (!hasBranch) {
                card.childrenLines.push(`	  > \u{1F33F} \`${createBranchSlug(iss.number, card.cleanTitle)}\``);
              }
              for (const sub of subtasks) {
                card.childrenLines.push(`	  - [${sub.checked ? "x" : " "}] ${sub.rawText}`);
              }
            }
          }
        } else {
          card.checkbox = " ";
          card.headerLine = card.headerLine.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, "").replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)/, "$1 $2");
        }
        let destLane = lanes.find((l) => l.normalizedName === targetLaneNorm);
        if (!destLane) {
          let title = targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1);
          if (targetLaneNorm === "to do")
            title = "To Do";
          if (targetLaneNorm === "in progress")
            title = "In Progress";
          if (targetLaneNorm === "review / test")
            title = "Review / Test";
          destLane = {
            headingLine: `## ${title}`,
            normalizedName: targetLaneNorm,
            cards: []
          };
          const archiveIdx = lanes.findIndex((l) => l.normalizedName === "archive");
          if (archiveIdx !== -1) {
            lanes.splice(archiveIdx, 0, destLane);
          } else {
            lanes.push(destLane);
          }
        }
        destLane.cards.push(card);
      } else {
        remainingCards.push(card);
      }
    }
    lane.cards = remainingCards;
  }
  if (movedCount === 0) {
    return { updatedContent: content, movedCount: 0 };
  }
  const outLines = [];
  if (frontmatterLines.length > 0) {
    outLines.push(...frontmatterLines);
    outLines.push("");
  }
  for (const p of preambleLines) {
    if (p.trim())
      outLines.push(p);
  }
  for (const lane of lanes) {
    outLines.push(lane.headingLine);
    outLines.push("");
    for (const card of lane.cards) {
      outLines.push(card.headerLine);
      for (const ch of card.childrenLines) {
        outLines.push(ch);
      }
    }
    outLines.push("");
  }
  if (settingsLines.length > 0) {
    outLines.push(...settingsLines);
  }
  return { updatedContent: outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n", movedCount };
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
  const remotePromises = [
    execFn(["gh", "project", "view", String(projectNumber), "--owner", owner, "--format", "json"], { timeout: 15e3 }),
    execFn(["gh", "project", "item-list", String(projectNumber), "--owner", owner, "--format", "json", "--limit", "100"], { timeout: 15e3 })
  ];
  if (config.repo) {
    remotePromises.push(
      execFn(["gh", "issue", "list", "--repo", `${owner}/${config.repo}`, "--state", "all", "--limit", "100", "--json", "number,title,url,state,body"], { timeout: 15e3 })
    );
  }
  const results = await Promise.allSettled(remotePromises);
  const projRes = results[0];
  const itemsRes = results[1];
  const issuesRes = config.repo && results[2] ? results[2] : null;
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
            contentTitle: item.content?.title,
            number: item.content?.number,
            url: item.content?.url,
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
  const repoIssues = [];
  if (issuesRes && issuesRes.status === "fulfilled") {
    try {
      const parsedIssues = JSON.parse(issuesRes.value.stdout);
      if (Array.isArray(parsedIssues)) {
        for (const iss of parsedIssues) {
          repoIssues.push({
            number: iss.number,
            title: iss.title,
            url: iss.url,
            state: iss.state,
            body: iss.body
          });
        }
      }
    } catch (e) {
      console.warn(`Could not parse issues for ${owner}/${config.repo}:`, e);
    }
  }
  let content = await app.vault.read(targetFile);
  let fileNeedsUpdate = false;
  if (repoIssues.length > 0) {
    const { updatedContent: badgedContent, injectedCount } = injectIssueBadgesIntoBoard(content, repoIssues);
    if (injectedCount > 0) {
      content = badgedContent;
      fileNeedsUpdate = true;
      console.log(`Injected ${injectedCount} issue badges into ${targetFile.basename}`);
    }
    const { updatedContent: subtaskSyncedContent, updatedCount: subtasksUpdated } = syncBoardSubtasksWithGitHubIssues(content, repoIssues);
    if (subtasksUpdated > 0) {
      content = subtaskSyncedContent;
      fileNeedsUpdate = true;
      console.log(`Synced ${subtasksUpdated} subtask checkbox states from GitHub into ${targetFile.basename}`);
    }
  }
  if (remoteItems.length > 0 || repoIssues.length > 0) {
    const { updatedContent: laneSyncedContent, movedCount } = syncBoardLanesWithRemoteItems(content, remoteItems, repoIssues);
    if (movedCount > 0) {
      content = laneSyncedContent;
      fileNeedsUpdate = true;
      console.log(`Moved ${movedCount} card(s) to matching lanes from GitHub in ${targetFile.basename}`);
    }
  }
  if (fileNeedsUpdate && typeof app?.vault?.modify === "function") {
    await app.vault.modify(targetFile, content);
  }
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
      const results2 = await Promise.all(updateTasks.map((fn) => fn()));
      for (const ok of results2) {
        if (ok)
          updatedCount++;
        else
          errorCount++;
      }
    }
    if (createTasks.length > 0) {
      const results2 = await Promise.all(createTasks.map((fn) => fn()));
      for (const ok of results2) {
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
  syncSingleBoard,
  extractSubtasksFromIssueBody,
  syncBoardSubtasksWithGitHubIssues,
  syncBoardLanesWithRemoteItems
});
