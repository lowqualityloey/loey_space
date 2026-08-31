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
function formatGitHubEvent(event) {
  const date = new Date(event.created_at);
  const timeStr = formatTime12(date);
  const dateKey = formatDateKey(date);
  const repoName = event.repo.name.split("/")[1] || event.repo.name;
  let text = "";
  if (event.type === "PushEvent") {
    const branch = (event.payload?.ref || "main").replace("refs/heads/", "");
    const commits = event.payload?.commits || [];
    if (commits.length > 0) {
      const commitMessages = commits.map((c) => c.message.split("\n")[0].trim()).filter(Boolean).slice(0, 3).join("; ");
      text = `- ${timeStr} \u{1F419} **Push** (\`${repoName}\` \u2192 \`${branch}\`): ${commitMessages}`;
    } else {
      text = `- ${timeStr} \u{1F419} **Push** (\`${repoName}\` \u2192 \`${branch}\`)`;
    }
  } else if (event.type === "PullRequestEvent") {
    const action = event.payload?.action;
    const pr = event.payload?.pull_request;
    const title = pr?.title || "Pull Request";
    const number = pr?.number || event.payload?.number;
    if (action === "closed" && pr?.merged) {
      text = `- ${timeStr} \u{1F500} **PR Merged** (\`${repoName}\` #${number}): ${title}`;
    } else if (action === "opened") {
      text = `- ${timeStr} \u{1F500} **PR Opened** (\`${repoName}\` #${number}): ${title}`;
    } else {
      text = `- ${timeStr} \u{1F500} **PR ${action}** (\`${repoName}\` #${number}): ${title}`;
    }
  } else if (event.type === "IssuesEvent") {
    const action = event.payload?.action;
    const issue = event.payload?.issue;
    const title = issue?.title || "Issue";
    const number = issue?.number;
    text = `- ${timeStr} \u{1F3AF} **Issue ${action}** (\`${repoName}\` #${number}): ${title}`;
  } else if (event.type === "CreateEvent") {
    const refType = event.payload?.ref_type;
    const ref = event.payload?.ref;
    if (refType === "branch" || refType === "tag") {
      text = `- ${timeStr} \u{1F33F} **Created ${refType}** \`${ref}\` in \`${repoName}\``;
    } else {
      return null;
    }
  } else if (event.type === "ReleaseEvent") {
    const releaseName = event.payload?.release?.name || event.payload?.release?.tag_name || "Release";
    text = `- ${timeStr} \u{1F680} **Release** \`${releaseName}\` in \`${repoName}\``;
  } else {
    return null;
  }
  return {
    id: event.id,
    timestamp12: timeStr,
    dateKey,
    rawDate: date,
    markdown: text
  };
}
function mergeDailyLog(existingContent, newLogBullets) {
  if (!newLogBullets.length) {
    return { updatedContent: existingContent, addedCount: 0 };
  }
  const lines = existingContent.split("\n");
  const sectionIdx = lines.findIndex((l) => l.trim().startsWith("## \u{1F4DD} Daily Log"));
  if (sectionIdx === -1) {
    const newSection = `
## \u{1F4DD} Daily Log
> _A running timestamp of what happened today._

${newLogBullets.join("\n")}
`;
    return { updatedContent: existingContent + newSection, addedCount: newLogBullets.length };
  }
  let insertIdx = sectionIdx + 1;
  while (insertIdx < lines.length && (lines[insertIdx].trim().startsWith(">") || lines[insertIdx].trim() === "")) {
    insertIdx++;
  }
  let logEndIdx = lines.length;
  for (let i = insertIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("## ") || trimmed.startsWith("### ") || trimmed === "---") {
      logEndIdx = i;
      break;
    }
  }
  const dailyLogSlice = lines.slice(sectionIdx, logEndIdx).join("\n");
  const bulletsToAdd = [];
  for (const bullet of newLogBullets) {
    const clean = bullet.replace(/-\s*\d{2}:\d{2}\s*(?:AM|PM)\s*/i, "").trim();
    if (!dailyLogSlice.includes(clean)) {
      bulletsToAdd.push(bullet);
    }
  }
  if (bulletsToAdd.length === 0) {
    return { updatedContent: existingContent, addedCount: 0 };
  }
  if (lines[insertIdx]?.trim() === "-") {
    lines.splice(insertIdx, 1, ...bulletsToAdd);
  } else {
    lines.splice(logEndIdx, 0, ...bulletsToAdd);
  }
  return { updatedContent: lines.join("\n"), addedCount: bulletsToAdd.length };
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
  const matchingBullets = [];
  for (const ev of events) {
    const formatted = formatGitHubEvent(ev);
    if (formatted && formatted.dateKey === noteDateKey) {
      matchingBullets.push(formatted.markdown);
    }
  }
  if (matchingBullets.length === 0) {
    if (Notice)
      new Notice(`\u2139\uFE0F No GitHub events found for ${noteDateKey}.`, 4e3);
    return;
  }
  const content = await app.vault.read(targetFile);
  const { updatedContent, addedCount } = mergeDailyLog(content, matchingBullets.reverse());
  if (addedCount > 0) {
    await app.vault.modify(targetFile, updatedContent);
    if (Notice)
      new Notice(`\u{1F389} Synced ${addedCount} GitHub event(s) to ${targetFile.basename}!`, 5e3);
  } else {
    if (Notice)
      new Notice(`\u2139\uFE0F All GitHub events for ${noteDateKey} are already in Daily Log.`, 4e3);
  }
}
function runCli() {
  const vaultRoot = resolveVaultPath();
  const args = process.argv.slice(2);
  const targetDateKey = args[0] || formatDateKey(/* @__PURE__ */ new Date());
  console.log("\u{1F419} Sync GitHub Activity to Daily Log (CLI Mode)...");
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
  const matchingBullets = [];
  for (const ev of events) {
    const formatted = formatGitHubEvent(ev);
    if (formatted && formatted.dateKey === targetDateKey) {
      matchingBullets.push(formatted.markdown);
    }
  }
  if (matchingBullets.length === 0) {
    console.log(`\u2139\uFE0F No GitHub activity found for date ${targetDateKey}.`);
    return;
  }
  console.log(`\u{1F4CB} Found ${matchingBullets.length} activity item(s):`);
  matchingBullets.forEach((b) => console.log(`  ${b}`));
  const content = fs.readFileSync(dailyPath, "utf8");
  const { updatedContent, addedCount } = mergeDailyLog(content, matchingBullets.reverse());
  if (addedCount > 0) {
    fs.writeFileSync(dailyPath, updatedContent, "utf8");
    console.log(`
\u{1F389} Successfully added ${addedCount} new event(s) to ${dailyPath}!`);
  } else {
    console.log(`
\u2139\uFE0F All events for ${targetDateKey} are already logged in the note.`);
  }
}
if (require.main === module) {
  runCli();
}
module.exports = Object.assign(syncGithubActivityAction, {
  fetchUserEvents,
  syncGithubActivityAction
});
