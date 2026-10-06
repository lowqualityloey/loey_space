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
function isVisible(task) {
  if (isShielded(task))
    return false;
  if (task.parent !== void 0 && task.parent !== null)
    return false;
  if (requiresPromotion(task.path) && !isPromoted(task))
    return false;
  return true;
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
    requiresPromotion,
    isShielded,
    isPromoted,
    isVisible,
    taskIdentity,
    displayText,
    taskSource,
    collectVisibleTasks,
    normalizeTask
  };
}

// 06-Resources/scripts/src/task-view.ts
installOnGlobal();
