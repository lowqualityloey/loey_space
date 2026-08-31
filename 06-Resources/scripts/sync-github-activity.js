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

// 06-Resources/scripts/src/sync-github-activity.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_child_process = require("child_process");

// 06-Resources/scripts/src/lib/github-events.ts
function cleanBranchName(raw) {
  if (!raw)
    return "main";
  const branch = raw.replace(/^refs\/heads\//, "").trim();
  return branch.replace(/-\d{10,}$/, "");
}
function formatTime12(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, "0");
  const minutesStr = String(minutes).padStart(2, "0");
  return `${hoursStr}:${minutesStr}&nbsp;${ampm}`;
}
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function escapeTablePipes(text) {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
async function fetchCommitDetailsMap(pushes, execFn) {
  const commitMap = /* @__PURE__ */ new Map();
  const uniqueItems = /* @__PURE__ */ new Map();
  for (const p of pushes) {
    if (p.head && !uniqueItems.has(p.head)) {
      uniqueItems.set(p.head, p.repo);
    }
  }
  if (uniqueItems.size === 0)
    return commitMap;
  let runner = execFn;
  if (!runner) {
    try {
      const cp = require("child_process");
      const util = require("util");
      runner = util.promisify(cp.exec);
    } catch {
      return commitMap;
    }
  }
  const tasks = Array.from(uniqueItems.entries()).map(async ([head, repo]) => {
    try {
      const { stdout } = await runner(
        `gh api repos/${repo}/commits/${head} -q "{message: .commit.message, url: .html_url}"`
      );
      const data = JSON.parse(stdout);
      commitMap.set(head, {
        message: data.message ? data.message.split("\n")[0].trim() : "",
        url: data.url || `https://github.com/${repo}/commit/${head}`
      });
    } catch {
      commitMap.set(head, {
        message: "",
        url: `https://github.com/${repo}/commit/${head}`
      });
    }
  });
  await Promise.all(tasks);
  return commitMap;
}
function formatGitHubEventToRow(event, commitMap) {
  const date = new Date(event.created_at);
  const time = formatTime12(date);
  const dateKey = formatDateKey(date);
  const repoShort = event.repo.name.split("/")[1] || event.repo.name;
  const repo = `\`${repoShort}\``;
  let eventType = "";
  let details = "";
  if (event.type === "PushEvent") {
    eventType = `\u{1F419} Push`;
    const branch = cleanBranchName(event.payload?.ref || "main");
    const head = event.payload?.head;
    const commits = event.payload?.commits || [];
    if (commits.length > 0) {
      const commitItems = commits.slice(0, 2).map((c) => {
        const msg = escapeTablePipes(c.message.split("\n")[0].trim());
        const url = c.url || (c.sha ? `https://github.com/${event.repo.name}/commit/${c.sha}` : head ? `https://github.com/${event.repo.name}/commit/${head}` : "");
        return url ? `[${msg}](${url})` : msg;
      }).filter(Boolean);
      details = `\`${branch}\`: ${commitItems.join("; ")}`;
    } else if (head) {
      const info = commitMap?.get(head);
      if (info && info.message) {
        const msg = escapeTablePipes(info.message.split("\n")[0].trim());
        const url = info.url || `https://github.com/${event.repo.name}/commit/${head}`;
        details = `\`${branch}\`: [${msg}](${url})`;
      } else {
        const shortHead = head.slice(0, 7);
        const url = `https://github.com/${event.repo.name}/commit/${head}`;
        details = `\`${branch}\`: [\`${shortHead}\`](${url})`;
      }
    } else {
      details = `\`${branch}\``;
    }
  } else if (event.type === "PullRequestEvent") {
    const action = event.payload?.action;
    const pr = event.payload?.pull_request;
    const number = pr?.number || event.payload?.number;
    const isMerged = action === "closed" && pr?.merged;
    const url = pr?.html_url || (number ? `https://github.com/${event.repo.name}/pull/${number}` : "");
    if (isMerged) {
      eventType = `\u{1F500} PR #${number} Merged`;
    } else if (action === "opened") {
      eventType = `\u{1F500} PR #${number} Opened`;
    } else {
      eventType = `\u{1F500} PR #${number} ${action}`;
    }
    const title = pr?.title ? escapeTablePipes(pr.title) : "";
    const headBranch = cleanBranchName(pr?.head?.ref);
    const baseBranch = cleanBranchName(pr?.base?.ref || "main");
    if (title && title !== "Pull Request") {
      if (url) {
        if (headBranch && headBranch !== "main") {
          details = `[${title}](${url}) (\`${headBranch}\` \u2192 \`${baseBranch}\`)`;
        } else {
          details = `[${title}](${url})`;
        }
      } else {
        details = title;
      }
    } else if (headBranch && headBranch !== "main") {
      details = url ? `[\`${headBranch}\` \u2192 \`${baseBranch}\`](${url})` : `\`${headBranch}\` \u2192 \`${baseBranch}\``;
    } else {
      details = url ? `[\`${baseBranch}\`](${url})` : `\`${baseBranch}\``;
    }
  } else if (event.type === "IssuesEvent") {
    const action = event.payload?.action;
    const issue = event.payload?.issue;
    const rawTitle = issue?.title || "Issue";
    const title = escapeTablePipes(rawTitle);
    const number = issue?.number;
    const url = issue?.html_url || (number ? `https://github.com/${event.repo.name}/issues/${number}` : "");
    eventType = `\u{1F3AF} Issue #${number} ${action}`;
    details = url ? `[${title}](${url})` : title;
  } else if (event.type === "CreateEvent") {
    const refType = event.payload?.ref_type;
    const ref = cleanBranchName(event.payload?.ref);
    if (refType === "branch" || refType === "tag") {
      eventType = `\u{1F33F} New ${refType === "branch" ? "Branch" : "Tag"}`;
      details = `\`${ref}\``;
    } else {
      return null;
    }
  } else if (event.type === "ReleaseEvent") {
    const release = event.payload?.release;
    const releaseName = escapeTablePipes(release?.name || release?.tag_name || "Release");
    const url = release?.html_url || `https://github.com/${event.repo.name}/releases`;
    eventType = `\u{1F680} Release`;
    details = url ? `[${releaseName}](${url})` : releaseName;
  } else {
    return null;
  }
  return {
    id: event.id,
    time,
    dateKey,
    repo,
    type: eventType,
    details,
    rawDate: date
  };
}
function buildGitHubCalloutTable(rows) {
  if (rows.length === 0)
    return "";
  const sortedRows = [...rows].sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  const header = `> [!NOTE]- \u{1F419} GitHub Activity Log (${sortedRows.length} event${sortedRows.length === 1 ? "" : "s"} \u2014 click to expand)
> | Time | Repo | Action | Details / Branch |
> | :--- | :--- | :--- | :--- |`;
  const tableLines = sortedRows.map((r) => `> | ${r.time} | ${r.repo} | ${r.type} | ${r.details} |`);
  return `${header}
${tableLines.join("\n")}`;
}
function mergeDailyLogTable(existingContent, rows) {
  if (rows.length === 0) {
    return { updatedContent: existingContent, count: 0 };
  }
  const calloutBlock = buildGitHubCalloutTable(rows);
  const calloutRegex = /> \[!NOTE\]-\s*🐙 GitHub Activity Log[\s\S]*?(?=\r?\n\r?\n|\r?\n#{1,6} |\r?\n---[ \t]*\r?\n|(?![\s\S]))/;
  if (calloutRegex.test(existingContent)) {
    return {
      updatedContent: existingContent.replace(calloutRegex, calloutBlock),
      count: rows.length
    };
  }
  const lines = existingContent.split("\n");
  const sectionIdx = lines.findIndex((l) => l.trim().startsWith("## \u{1F4DD} Daily Log"));
  if (sectionIdx === -1) {
    const newSection = `
## \u{1F4DD} Daily Log
> _A running timestamp of what happened today._
- 

${calloutBlock}
`;
    return { updatedContent: existingContent + newSection, count: rows.length };
  }
  let insertIdx = sectionIdx + 1;
  while (insertIdx < lines.length && (lines[insertIdx].trim().startsWith(">") || lines[insertIdx].trim() === "")) {
    insertIdx++;
  }
  let nextSectionIdx = lines.length;
  for (let i = insertIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("## ") || trimmed.startsWith("### ") || trimmed === "---") {
      nextSectionIdx = i;
      break;
    }
  }
  lines.splice(nextSectionIdx, 0, "", calloutBlock, "");
  return { updatedContent: lines.join("\n"), count: rows.length };
}

// 06-Resources/scripts/src/sync-github-activity.ts
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
function fetchUserEvents(username = "lowqualityloey") {
  try {
    const raw = (0, import_child_process.execSync)(`gh api "users/${username}/events" -q "."`, {
      encoding: "utf8",
      timeout: 15e3
    });
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to fetch GitHub events via gh CLI:", err?.message || err);
    return [];
  }
}
async function syncGithubActivityAction(params) {
  const app = params?.app || (typeof window !== "undefined" ? window.app : globalThis.app);
  const Notice = typeof window !== "undefined" ? window.Notice : globalThis.Notice;
  if (!app) {
    await runCli();
    return;
  }
  let targetFile = app.workspace.getActiveFile();
  const todayDateKey = formatDateKey(/* @__PURE__ */ new Date());
  if (!targetFile || !targetFile.path.startsWith("01-Daily/") || targetFile.basename.startsWith("_")) {
    const todayPath = `01-Daily/${todayDateKey.slice(0, 7)}/${todayDateKey}.md`;
    const abstractFile = app.vault.getAbstractFileByPath(todayPath);
    if (abstractFile && isTFile(abstractFile)) {
      targetFile = abstractFile;
    }
  }
  if (!targetFile || !isTFile(targetFile)) {
    if (Notice)
      new Notice(`\u26A0\uFE0F Daily note for today (${todayDateKey}) does not exist. Create it first!`, 5e3);
    return;
  }
  const noteDateKey = targetFile.basename;
  if (Notice)
    new Notice("\u{1F419} Fetching GitHub activity...", 3e3);
  const events = fetchUserEvents("lowqualityloey");
  if (!events.length) {
    if (Notice)
      new Notice("\u26A0\uFE0F No GitHub activity found or gh CLI not authenticated.", 4e3);
    return;
  }
  const targetDateEvents = events.filter((ev) => {
    const d = new Date(ev.created_at);
    return formatDateKey(d) === noteDateKey;
  });
  const pushesToFetch = [];
  for (const ev of targetDateEvents) {
    if (ev.type === "PushEvent" && ev.payload?.head && (!ev.payload.commits || ev.payload.commits.length === 0)) {
      pushesToFetch.push({ repo: ev.repo.name, head: ev.payload.head });
    }
  }
  const commitMap = await fetchCommitDetailsMap(pushesToFetch);
  const rows = [];
  for (const ev of targetDateEvents) {
    const r = formatGitHubEventToRow(ev, commitMap);
    if (r) {
      rows.push(r);
    }
  }
  if (rows.length === 0) {
    if (Notice)
      new Notice(`\u2139\uFE0F No GitHub events found for ${noteDateKey}.`, 4e3);
    return;
  }
  const content = await app.vault.read(targetFile);
  const { updatedContent, count } = mergeDailyLogTable(content, rows);
  await app.vault.modify(targetFile, updatedContent);
  if (Notice)
    new Notice(`\u{1F389} Synced ${count} GitHub event(s) into table callout for ${targetFile.basename}!`, 5e3);
}
async function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const targetDateKey = args[0] || formatDateKey(/* @__PURE__ */ new Date());
  console.log("\u{1F419} Sync GitHub Activity to Daily Log (Table Callout Mode)...");
  console.log(`\u{1F4C2} Vault Root: ${vaultRoot}`);
  console.log(`\u{1F4C5} Target Date: ${targetDateKey}
`);
  const monthFolder = targetDateKey.slice(0, 7);
  const dailyPath = path.join(vaultRoot, "01-Daily", monthFolder, `${targetDateKey}.md`);
  if (!fs.existsSync(dailyPath)) {
    console.error(`\u274C Daily note not found: ${dailyPath}`);
    process.exit(1);
  }
  console.log(`\u{1F50D} Fetching GitHub events for lowqualityloey...`);
  const events = fetchUserEvents("lowqualityloey");
  const targetDateEvents = events.filter((ev) => {
    const d = new Date(ev.created_at);
    return formatDateKey(d) === targetDateKey;
  });
  const pushesToFetch = [];
  for (const ev of targetDateEvents) {
    if (ev.type === "PushEvent" && ev.payload?.head && (!ev.payload.commits || ev.payload.commits.length === 0)) {
      pushesToFetch.push({ repo: ev.repo.name, head: ev.payload.head });
    }
  }
  if (pushesToFetch.length > 0) {
    console.log(`\u26A1 Resolving commit details for ${pushesToFetch.length} push event(s)...`);
  }
  const commitMap = await fetchCommitDetailsMap(pushesToFetch);
  const rows = [];
  for (const ev of targetDateEvents) {
    const r = formatGitHubEventToRow(ev, commitMap);
    if (r) {
      rows.push(r);
    }
  }
  if (rows.length === 0) {
    console.log(`\u2139\uFE0F No GitHub activity found for date ${targetDateKey}.`);
    return;
  }
  console.log(`\u{1F4CB} Found ${rows.length} activity item(s) for table callout:`);
  rows.slice(0, 5).forEach((r) => console.log(`  | ${r.time} | ${r.repo} | ${r.type} | ${r.details.slice(0, 50)}... |`));
  const content = fs.readFileSync(dailyPath, "utf8");
  const { updatedContent, count } = mergeDailyLogTable(content, rows);
  fs.writeFileSync(dailyPath, updatedContent, "utf8");
  console.log(`
\u{1F389} Successfully formatted ${count} event(s) into collapsible table callout in ${dailyPath}!`);
}
if (require.main === module) {
  runCli();
}
module.exports = Object.assign(syncGithubActivityAction, {
  fetchUserEvents,
  syncGithubActivityAction
});
