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
function formatTime12(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, "0");
  const minutesStr = String(minutes).padStart(2, "0");
  return `${hoursStr}:${minutesStr} ${ampm}`;
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
function formatGitHubEventToRow(event) {
  const date = new Date(event.created_at);
  const time = formatTime12(date);
  const dateKey = formatDateKey(date);
  const repoShort = event.repo.name.split("/")[1] || event.repo.name;
  const repo = `\`${repoShort}\``;
  let eventType = "";
  let details = "";
  if (event.type === "PushEvent") {
    const branch = (event.payload?.ref || "main").replace("refs/heads/", "");
    eventType = `\u{1F419} Push (\`${branch}\`)`;
    const commits = event.payload?.commits || [];
    if (commits.length > 0) {
      details = commits.map((c) => c.message.split("\n")[0].trim()).filter(Boolean).slice(0, 3).join("; ");
    } else {
      details = `Pushed commits to ${branch}`;
    }
  } else if (event.type === "PullRequestEvent") {
    const action = event.payload?.action;
    const pr = event.payload?.pull_request;
    const title = pr?.title || "Pull Request";
    const number = pr?.number || event.payload?.number;
    if (action === "closed" && pr?.merged) {
      eventType = `\u{1F500} PR #${number} Merged`;
    } else if (action === "opened") {
      eventType = `\u{1F500} PR #${number} Opened`;
    } else {
      eventType = `\u{1F500} PR #${number} ${action}`;
    }
    details = title;
  } else if (event.type === "IssuesEvent") {
    const action = event.payload?.action;
    const issue = event.payload?.issue;
    const title = issue?.title || "Issue";
    const number = issue?.number;
    eventType = `\u{1F3AF} Issue #${number} ${action}`;
    details = title;
  } else if (event.type === "CreateEvent") {
    const refType = event.payload?.ref_type;
    const ref = event.payload?.ref;
    if (refType === "branch" || refType === "tag") {
      eventType = `\u{1F33F} Created ${refType}`;
      details = `\`${ref}\``;
    } else {
      return null;
    }
  } else if (event.type === "ReleaseEvent") {
    const releaseName = event.payload?.release?.name || event.payload?.release?.tag_name || "Release";
    eventType = `\u{1F680} Release`;
    details = releaseName;
  } else {
    return null;
  }
  return {
    id: event.id,
    time,
    dateKey,
    repo,
    type: eventType,
    details: escapeTablePipes(details),
    rawDate: date
  };
}
function buildGitHubCalloutTable(rows) {
  if (rows.length === 0)
    return "";
  const header = `> [!NOTE]- \u{1F419} GitHub Activity Log (${rows.length} event${rows.length === 1 ? "" : "s"} \u2014 click to expand)
> | Time | Repo | Type | Message / Details |
> | :--- | :--- | :--- | :--- |`;
  const tableLines = rows.map((r) => `> | ${r.time} | ${r.repo} | ${r.type} | ${r.details} |`);
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
    runCli();
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
  const rows = [];
  for (const ev of events) {
    const r = formatGitHubEventToRow(ev);
    if (r && r.dateKey === noteDateKey) {
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
function runCli() {
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
  const rows = [];
  for (const ev of events) {
    const r = formatGitHubEventToRow(ev);
    if (r && r.dateKey === targetDateKey) {
      rows.push(r);
    }
  }
  if (rows.length === 0) {
    console.log(`\u2139\uFE0F No GitHub activity found for date ${targetDateKey}.`);
    return;
  }
  console.log(`\u{1F4CB} Found ${rows.length} activity item(s) for table callout:`);
  rows.slice(0, 5).forEach((r) => console.log(`  | ${r.time} | ${r.repo} | ${r.type} | ${r.details.slice(0, 40)}... |`));
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
