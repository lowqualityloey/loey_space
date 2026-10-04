"use strict";
// Stubbed-Obsidian loader + synthetic vault for the kanban-status-sync plugin.
//
// Loads the REAL main.js under plain Node (no Obsidian install) by intercepting
// require("obsidian") with a stub, then drives propagateBoard() against
// in-memory vaults with writing-set semantics (mirrors the plugin's
// writing.add / modify / 800ms-release path). Zero edits to main.js.
//
// Two layout-sensitive rules live here:
//   1. ROOT is four levels up from this file (helpers -> tests -> scripts ->
//      06-Resources -> repo root).
//   2. MAIN_JS honours KANBAN_MAIN_JS so a regression suite can be pointed at a
//      pre-fix copy of main.js to prove its own non-vacuity.

const path = require("node:path");
const Module = require("node:module");

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const MAIN_JS = process.env.KANBAN_MAIN_JS
  ? path.resolve(process.env.KANBAN_MAIN_JS)
  : path.join(ROOT, ".obsidian", "plugins", "kanban-status-sync", "main.js");

// Block ID conformance: trailing block ID, charset [A-Za-z0-9-]. Mirrors
// BLOCK_ID_AT_END in main.js (kept local; main.js does not export it).
const BLOCK_ID_RE = /\s(\^[A-Za-z0-9-]+)\s*$/;

// The six bare habit slot titles every daily note carries. These names are
// already public in this repo's agent contract, so reusing them leaks nothing.
const SIX_SLOTS = ["water", "prioritised", "move", "read", "tidy", "disconnect"];

function fileObj(p) {
  const name = p.split("/").pop();
  return { path: p, name, basename: name.replace(/\.md$/, "") };
}

function createLog() {
  return { modify: [], notices: [], logs: [], errors: [] };
}

// Load a FRESH copy of main.js with require("obsidian") stubbed.
// Fresh per fixture so the stub Notice class closes over that fixture's log.
function installStubs(log) {
  if (typeof globalThis.window === "undefined") {
    globalThis.window = {
      setTimeout: (fn, ms, ...args) => {
        const t = setTimeout(fn, ms, ...args);
        if (t && typeof t.unref === "function") t.unref();
        return t;
      },
      clearTimeout: (...args) => clearTimeout(...args),
    };
  }
  const obsidianStub = {
    Plugin: class Plugin {
      constructor(app, manifest) {
        this.app = app;
        this.manifest = manifest;
      }
      async loadData() {
        return {};
      }
      async saveData() {}
      registerEvent() {}
      addCommand() {}
      addSettingTab() {}
    },
    PluginSettingTab: class PluginSettingTab {},
    Setting: class Setting {
      setName() {
        return this;
      }
      setDesc() {
        return this;
      }
      addToggle() {
        return this;
      }
      addButton() {
        return this;
      }
    },
    Notice: class Notice {
      constructor(msg) {
        log.notices.push(String(msg));
      }
    },
  };
  const origLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === "obsidian") return obsidianStub;
    return origLoad.call(this, request, ...rest);
  };
  let pluginExports;
  try {
    const resolved = require.resolve(MAIN_JS);
    delete require.cache[resolved];
    pluginExports = require(resolved);
  } finally {
    Module._load = origLoad;
  }
  return pluginExports;
}

// Synthetic vault: getMarkdownFiles / read / modify with write-count logging.
// writing-set semantics live on the plugin (plugin.writing); the vault only records.
function makeVault(initialFiles, log) {
  const files = new Map(Object.entries(initialFiles));
  const vault = {
    getMarkdownFiles: () => [...files.keys()].map(fileObj),
    getAbstractFileByPath: (p) => (files.has(p) ? fileObj(p) : null),
    read: async (f) => {
      const p = typeof f === "string" ? f : f.path;
      if (!files.has(p)) throw new Error(`ENOENT: ${p}`);
      return files.get(p);
    },
    modify: async (f, c) => {
      const p = typeof f === "string" ? f : f.path;
      log.modify.push(p);
      files.set(p, c);
    },
  };
  return { vault, files };
}

// Bypass onload (needs a real workspace); propagateBoard only needs
// app.vault + settings + writing + laneState.
function newPlugin(pluginExports, vault) {
  const plugin = new pluginExports({ vault }, {});
  plugin.settings = { autoSync: true, manageCompletionDate: true, notifyOnChange: false };
  plugin.writing = new Set();
  plugin.laneState = {};
  plugin.timers = new Map();
  return plugin;
}

function fileByPath(vault, p) {
  return vault.getMarkdownFiles().find((f) => f.path === p);
}

async function withCapturedConsole(log, fn) {
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args) => {
    log.logs.push(args.map(String).join(" "));
  };
  console.error = (...args) => {
    log.errors.push(args.map(String).join(" "));
  };
  try {
    return await fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

// Minimal kanban board text (frontmatter gate for isKanbanBoard + %% trailer).
function boardText(lanes) {
  const out = ["---", "kanban-plugin: board", "---", ""];
  for (const [heading, cards] of lanes) {
    out.push(`## ${heading}`, "");
    for (const c of cards) out.push(c);
    out.push("");
  }
  out.push("%% kanban:settings", "%%");
  return out.join("\n");
}

// Synthetic daily note: task section + habit section (heading contains
// "habit" so the plugin's habit-section skip applies).
function dailyText(taskLines, slots = SIX_SLOTS) {
  const out = ["---", "type: daily", "---", "", "### ✅ Tasks"];
  for (const t of taskLines) out.push(t);
  out.push("", "### 🔁 Habits");
  for (const s of slots) out.push(`- [ ] ${s}`);
  out.push("");
  return out.join("\n");
}

// Count lines that differ between two file versions (blast-radius measure).
function countChangedLines(beforeStr, afterStr) {
  const a = String(beforeStr).split("\n");
  const b = String(afterStr).split("\n");
  let n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) n++;
  }
  return n;
}

// Count trailing-^id occurrences vault-wide.
function countBlockIds(files) {
  let n = 0;
  for (const content of files.values()) {
    const lines = String(content).split("\n");
    for (const l of lines) if (BLOCK_ID_RE.test(l)) n++;
  }
  return n;
}

module.exports = {
  ROOT,
  MAIN_JS,
  BLOCK_ID_RE,
  SIX_SLOTS,
  fileObj,
  createLog,
  installStubs,
  makeVault,
  newPlugin,
  fileByPath,
  withCapturedConsole,
  boardText,
  dailyText,
  countChangedLines,
  countBlockIds,
};