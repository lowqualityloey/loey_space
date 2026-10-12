var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// 06-Resources/scripts/src/task-view.ts
var task_view_exports = {};
module.exports = __toCommonJS(task_view_exports);

// 06-Resources/scripts/src/lib/weekly-extract.ts
function taskPriorityRank(task) {
  const isInProgress = /^\s*-\s*\[\/\]/.test(task);
  const pMatch = task.match(/#priority\/p([0-3])\b/i);
  const pLevel = pMatch ? Number(pMatch[1]) : 4;
  return (isInProgress ? 0 : 10) + pLevel;
}
function resolveDeferredHome(task) {
  const kanbanLink = task.match(/\[\[(?:02-Projects\/[^\]|]+\/)?([^\]|/]+?)\s+Kanban(?:\|[^\]]+)?\]\]/i);
  if (kanbanLink) {
    const project = kanbanLink[1].trim();
    return {
      destinationKind: "project",
      destination: `02-Projects/${project}/${project} Kanban.md`
    };
  }
  const projectTag = task.match(/#project\/([a-z0-9_-]+)/i);
  if (projectTag) {
    const project = projectTag[1];
    return {
      destinationKind: "project",
      destination: `02-Projects/${project}/${project} Kanban.md`
    };
  }
  if (/#(?:area\/)?personal\b/i.test(task)) {
    return {
      destinationKind: "personal",
      destination: "05-Personal/"
    };
  }
  return {
    destinationKind: "standalone",
    destination: "01-Daily/Tasks Kanban.md"
  };
}
function triageDailyCommitments(tasks, limit = 3) {
  const indexed = tasks.map((task, index) => ({
    task,
    index,
    rank: taskPriorityRank(task)
  }));
  indexed.sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : a.index - b.index);
  const selectedSet = new Set(indexed.slice(0, Math.max(0, limit)).map((item) => item.index));
  const selected = [];
  const deferred = [];
  tasks.forEach((task, idx) => {
    if (selectedSet.has(idx)) {
      selected.push(task);
    } else {
      const home = resolveDeferredHome(task);
      deferred.push({ task, ...home });
    }
  });
  return { selected, deferred };
}

// 06-Resources/scripts/src/lib/task-view.ts
var PROMOTION_TAG = "#promote";
var CORE_SHIELD_KEYWORDS = ["habit", "backlog", "archive"];
var OPT_IN_SHIELD_KEYWORDS = [
  ...CORE_SHIELD_KEYWORDS,
  "syllabus",
  "reference",
  "auto-backlink",
  "module",
  "example"
];
var PROMOTION_REQUIRED_PREFIXES = ["04-Learning", "05-Personal"];
function requiresPromotion(path) {
  return PROMOTION_REQUIRED_PREFIXES.some((prefix) => path.startsWith(prefix));
}
var PROJECT_ROOT = "02-Projects/";
function isBoardCard(path) {
  return path.startsWith(PROJECT_ROOT) && / Kanban\.md$/i.test(path);
}
function isProjectHub(path) {
  return path.startsWith(PROJECT_ROOT) && !isBoardCard(path) && path.endsWith(".md");
}
var ACTIVE_LIFECYCLES = [
  "active",
  "in progress",
  "in-progress",
  "doing",
  "wip"
];
function normalizeLifecycle(value) {
  return String(value ?? "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
function isLifecycleActive(value) {
  const normalized = normalizeLifecycle(value);
  if (normalized === "")
    return true;
  return ACTIVE_LIFECYCLES.includes(normalized);
}
var PRIORITY_TAG = /#priority\/[^\s]+/gi;
function isShielded(task) {
  const section = (task.section ?? "").toLowerCase();
  if (section === "")
    return false;
  const keywords = requiresPromotion(task.path) ? OPT_IN_SHIELD_KEYWORDS : CORE_SHIELD_KEYWORDS;
  return keywords.some((keyword) => section.includes(keyword));
}
function isPromoted(task) {
  return (task.text ?? "").toLowerCase().includes(PROMOTION_TAG);
}
function isVisible(task, context = {}) {
  if (isShielded(task))
    return false;
  if (context.lane !== void 0 && context.lane !== "" && isShielded({ ...task, section: context.lane })) {
    return false;
  }
  if (task.parent !== void 0 && task.parent !== null)
    return false;
  if (requiresPromotion(task.path) && !isPromoted(task))
    return false;
  if (task.path.startsWith(PROJECT_ROOT)) {
    if (!isCommitment(task))
      return false;
    if (!isLifecycleActive(context.projectLifecycle))
      return false;
  }
  return true;
}
function isCommitment(task) {
  return !isProjectHub(task.path);
}
function isDone(task) {
  return String(task.status ?? "").toLowerCase() === "x";
}
function summarizeProgress(tasks, context = {}) {
  const commitments = { done: 0, total: 0 };
  const criteria = { done: 0, total: 0 };
  for (const task of tasks) {
    if (isShielded(task))
      continue;
    if (!isCommitment(task)) {
      criteria.total += 1;
      if (isDone(task))
        criteria.done += 1;
      continue;
    }
    if (!isVisible(task, context))
      continue;
    commitments.total += 1;
    if (isDone(task))
      commitments.done += 1;
  }
  return { commitments, criteria };
}
function taskIdentity(task) {
  return String(task.text ?? "").toLowerCase().replaceAll(PROMOTION_TAG, " ").replace(PRIORITY_TAG, " ").replace(/\[\[[^\]]+\]\]/g, " ").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}
function displayText(task) {
  return String(task.text ?? "").replaceAll(PROMOTION_TAG, " ").replace(/\s+/g, " ").trim();
}
function taskSource(task) {
  return { path: task.path, line: task.line };
}
function collectVisibleTasks(tasks) {
  const seen = /* @__PURE__ */ new Set();
  const visible = [];
  for (const task of tasks) {
    if (!isVisible(task))
      continue;
    const key = taskIdentity(task);
    if (key === "")
      continue;
    if (seen.has(key))
      continue;
    seen.add(key);
    visible.push(task);
  }
  return visible;
}
function normalizeTask(raw, fallbackPath = "") {
  return {
    text: raw.text ?? "",
    status: raw.status ?? " ",
    section: raw.header?.subpath ?? "",
    path: raw.file?.path ?? fallbackPath,
    line: raw.line,
    parent: raw.parent ?? null,
    raw
  };
}
function installOnGlobal(scope = globalThis) {
  scope.TaskView = {
    PROMOTION_TAG,
    CORE_SHIELD_KEYWORDS,
    OPT_IN_SHIELD_KEYWORDS,
    PROMOTION_REQUIRED_PREFIXES,
    PROJECT_ROOT,
    ACTIVE_LIFECYCLES,
    requiresPromotion,
    isShielded,
    isPromoted,
    isVisible,
    isBoardCard,
    isProjectHub,
    normalizeLifecycle,
    isLifecycleActive,
    isCommitment,
    isDone,
    summarizeProgress,
    taskIdentity,
    displayText,
    taskSource,
    collectVisibleTasks,
    normalizeTask,
    triageDailyCommitments
  };
}

// 06-Resources/scripts/src/task-view.ts
installOnGlobal();
