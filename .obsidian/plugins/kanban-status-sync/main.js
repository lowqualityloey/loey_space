"use strict";

/*
 * Kanban Status Sync
 * ------------------
 * Keeps the checkbox marker of every Kanban card in step with the lane it sits in.
 * The board becomes the authority on status, so `_Tasks MOC` can tell an active
 * to-do from work in progress without you editing markers by hand.
 *
 * Edit LANE_MARKERS below to match your own column names.
 */

const obsidian = require("obsidian");

/* ==========================================================================
   CONFIG — lane name (lowercase) -> checkbox marker
   ========================================================================== */

const LANE_MARKERS = {
  // Not started
  "backlog": " ",
  "to do": " ",
  "todo": " ",
  "next": " ",
  "planned": " ",

  // Started
  "in progress": "/",
  "doing": "/",
  "wip": "/",
  "review / test": "/",
  "review": "/",
  "test": "/",
  "testing": "/",
  "qa": "/",

  // Finished
  "done": "x",
  "complete": "x",
  "completed": "x",
  "shipped": "x"
};

// Lanes whose cards are never touched. Archive holds finished history, and
// rewriting it would churn old completion dates.
const UNMANAGED_LANES = ["archive", "archived"];

// Markers carrying meaning the lane cannot express, so they are left alone:
// cancelled, forwarded, scheduled, question, important.
const PRESERVED_MARKERS = ["-", ">", "<", "?", "!"];

// Only top-level cards are managed. Indented lines are subtasks inside a card.
const CARD_PATTERN = /^- \[([^\]])\]\s*(.*)$/;
const COMPLETION_DATE = /\s*✅\s*\d{4}-\d{2}-\d{2}/g;

/* ==========================================================================
   PURE HELPERS (no Obsidian dependency — safe to unit test)
   ========================================================================== */

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Turns "## 🔄 In Progress" into "in progress" so headings can carry emoji,
// bold or punctuation without breaking the mapping.
function laneKey(heading) {
  return String(heading)
    .replace(/[*_`~]/g, "")
    .replace(/[^\p{L}\p{N}\/\s-]/gu, " ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Exact match first, then a punctuation-insensitive match so "Review/Test",
// "Review / Test" and "review test" all resolve to the same marker.
function resolveMarker(heading, markers) {
  const key = laneKey(heading);
  if (Object.prototype.hasOwnProperty.call(markers, key)) return markers[key];

  const compact = key.replace(/[^\p{L}\p{N}]/gu, "");
  const names = Object.keys(markers);
  for (let i = 0; i < names.length; i++) {
    if (names[i].replace(/[^\p{L}\p{N}]/gu, "") === compact) return markers[names[i]];
  }
  return undefined;
}

function isKanbanBoard(content) {
  const frontmatter = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return !!frontmatter && /^kanban-plugin:/m.test(frontmatter[1]);
}

// Keeps a trailing block id (^abc123) at the end of the line, where Obsidian
// expects it, instead of burying it behind the completion date.
function withCompletionDate(body, today) {
  const blockId = body.match(/\s(\^[A-Za-z0-9-]+)\s*$/);
  if (blockId) {
    const head = body.slice(0, blockId.index).replace(/\s+$/, "");
    return `${head} ✅ ${today} ${blockId[1]}`;
  }
  return `${body.replace(/\s+$/, "")} ✅ ${today}`;
}

/**
 * Rewrites card markers to match their lane.
 * Returns { text, changed, changes } and never mutates the input.
 */
function normalizeBoardText(content, options) {
  const opts = options || {};
  const markers = opts.markers || LANE_MARKERS;
  const unmanaged = (opts.unmanaged || UNMANAGED_LANES).map(laneKey);
  const manageDate = opts.manageCompletionDate !== false;
  const today = opts.today || formatDate(new Date());

  const lines = String(content).split("\n");
  const changes = [];

  let lane = "";
  let desired;
  let inFrontmatter = false;
  let inComment = false;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Frontmatter
    if (i === 0 && trimmed === "---") { inFrontmatter = true; continue; }
    if (inFrontmatter) {
      if (trimmed === "---") inFrontmatter = false;
      continue;
    }

    // %% ... %% blocks (this is where Kanban stores board settings)
    if (trimmed.startsWith("%%")) {
      if ((trimmed.match(/%%/g) || []).length === 1) inComment = !inComment;
      continue;
    }
    if (inComment) continue;

    // Fenced code
    if (trimmed.startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;

    // Lane heading
    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      lane = heading[1].trim();
      desired = unmanaged.indexOf(laneKey(lane)) !== -1 ? undefined : resolveMarker(lane, markers);
      continue;
    }

    // Unknown or unmanaged lane: leave every card alone.
    if (desired === undefined) continue;

    const card = line.match(CARD_PATTERN);
    if (!card) continue;

    const current = card[1];
    if (PRESERVED_MARKERS.indexOf(current) !== -1) continue;

    let body = card[2];
    let updated = current !== desired;

    if (manageDate) {
      const hasDate = /✅\s*\d{4}-\d{2}-\d{2}/.test(body);
      if (desired === "x" && !hasDate) {
        body = withCompletionDate(body, today);
        updated = true;
      } else if (desired !== "x" && hasDate) {
        body = body.replace(COMPLETION_DATE, "").replace(/\s+$/, "");
        updated = true;
      }
    }

    if (updated) {
      lines[i] = `- [${desired}] ${body}`.replace(/\s+$/, "");
      changes.push({ line: i + 1, lane: lane, from: current, to: desired });
    }
  }

  const text = lines.join("\n");
  return { text: text, changed: text !== content, changes: changes };
}

/* ==========================================================================
   PLUGIN
   ========================================================================== */

const DEFAULT_SETTINGS = {
  autoSync: true,
  manageCompletionDate: true,
  notifyOnChange: false
};

class KanbanStatusSyncPlugin extends obsidian.Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Paths this plugin is currently writing, so its own writes are ignored.
    this.writing = new Set();
    this.timers = new Map();

    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (!this.settings.autoSync) return;
      if (!file || typeof file.path !== "string" || !file.path.endsWith(".md")) return;
      if (this.writing.has(file.path)) return;
      this.scheduleSync(file);
    }));

    this.addCommand({
      id: "normalize-current-board",
      name: "Sync card statuses in current board",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new obsidian.Notice("Open a Kanban board first.");
          return;
        }
        await this.syncFile(file, { notify: true });
      }
    });

    this.addCommand({
      id: "normalize-all-boards",
      name: "Sync card statuses in all boards",
      callback: async () => { await this.syncAllBoards(); }
    });

    this.addSettingTab(new KanbanStatusSyncSettingTab(this.app, this));

    console.log("Kanban Status Sync: loaded");
  }

  onunload() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Dragging a card fires several modify events; coalesce them per file.
  scheduleSync(file) {
    const existing = this.timers.get(file.path);
    if (existing) window.clearTimeout(existing);

    const timer = window.setTimeout(() => {
      this.timers.delete(file.path);
      this.syncFile(file, { notify: false });
    }, 400);

    this.timers.set(file.path, timer);
  }

  async syncFile(file, options) {
    const opts = options || {};
    let result = null;
    let isBoard = false;

    const transform = (data) => {
      if (!isKanbanBoard(data)) return data;
      isBoard = true;
      result = normalizeBoardText(data, {
        manageCompletionDate: this.settings.manageCompletionDate,
        today: formatDate(new Date())
      });
      return result.changed ? result.text : data;
    };

    this.writing.add(file.path);
    try {
      // vault.process is the atomic read-modify-write path (Obsidian 1.6+).
      if (typeof this.app.vault.process === "function") {
        await this.app.vault.process(file, transform);
      } else {
        const data = await this.app.vault.read(file);
        const next = transform(data);
        if (next !== data) await this.app.vault.modify(file, next);
      }
    } catch (e) {
      console.error(`Kanban Status Sync: failed to update ${file.path}`, e);
      if (opts.notify) new obsidian.Notice("⚠️ Kanban Status Sync failed — see console.");
      this.writing.delete(file.path);
      return null;
    }

    // Released after a beat so the resulting modify event is ignored too.
    window.setTimeout(() => this.writing.delete(file.path), 800);

    if (result && result.changed) {
      console.log(`Kanban Status Sync: ${result.changes.length} card(s) updated in ${file.path}`, result.changes);
      if (opts.notify || this.settings.notifyOnChange) {
        new obsidian.Notice(`✅ ${result.changes.length} card status${result.changes.length === 1 ? "" : "es"} synced in ${file.basename}`);
      }
    } else if (opts.notify) {
      new obsidian.Notice(isBoard ? "Card statuses already match their lanes." : "This note is not a Kanban board.");
    }

    return result;
  }

  async syncAllBoards() {
    const files = this.app.vault.getMarkdownFiles();
    let boards = 0;
    let cards = 0;

    for (const file of files) {
      const result = await this.syncFile(file, { notify: false });
      if (result && result.changed) {
        boards++;
        cards += result.changes.length;
      }
    }

    new obsidian.Notice(
      boards === 0
        ? "All Kanban card statuses already match their lanes."
        : `✅ Synced ${cards} card status${cards === 1 ? "" : "es"} across ${boards} board${boards === 1 ? "" : "s"}.`
    );
  }
}

class KanbanStatusSyncSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new obsidian.Setting(containerEl)
      .setName("Sync automatically")
      .setDesc("Update card markers whenever a board changes. Turn this off to sync only via the commands.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        }));

    new obsidian.Setting(containerEl)
      .setName("Manage completion dates")
      .setDesc("Add ✅ YYYY-MM-DD when a card reaches a done lane, and remove it if the card moves back out.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.manageCompletionDate)
        .onChange(async (value) => {
          this.plugin.settings.manageCompletionDate = value;
          await this.plugin.saveSettings();
        }));

    new obsidian.Setting(containerEl)
      .setName("Notify on every change")
      .setDesc("Show a notice each time markers are corrected. Useful while testing, noisy day to day.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.notifyOnChange)
        .onChange(async (value) => {
          this.plugin.settings.notifyOnChange = value;
          await this.plugin.saveSettings();
        }));

    new obsidian.Setting(containerEl)
      .setName("Sync all boards now")
      .setDesc("Apply the lane rules to every Kanban board in the vault.")
      .addButton((button) => button
        .setButtonText("Sync all boards")
        .setCta()
        .onClick(async () => { await this.plugin.syncAllBoards(); }));

    containerEl.createEl("h3", { text: "Lane rules" });

    const table = containerEl.createEl("table");
    table.style.width = "100%";
    const head = table.createEl("tr");
    head.createEl("th", { text: "Lane" }).style.textAlign = "left";
    head.createEl("th", { text: "Marker" }).style.textAlign = "left";

    const shown = [
      ["Backlog, To Do, Next, Planned", "[ ]"],
      ["In Progress, Doing, WIP", "[/]"],
      ["Review / Test, QA, Testing", "[/]"],
      ["Done, Complete, Shipped", "[x] + ✅ date"],
      ["Archive", "left untouched"]
    ];
    shown.forEach(([lane, marker]) => {
      const row = table.createEl("tr");
      row.createEl("td", { text: lane });
      row.createEl("td").createEl("code", { text: marker });
    });

    containerEl.createEl("p", {
      text: "Cancelled or forwarded markers ([-], [>], [<], [?], [!]) are never overwritten, and lanes not listed above are ignored. Edit LANE_MARKERS at the top of main.js to add your own column names."
    }).style.fontSize = "var(--font-ui-smaller)";
  }
}

module.exports = KanbanStatusSyncPlugin;

// Exposed for testing.
module.exports.normalizeBoardText = normalizeBoardText;
module.exports.isKanbanBoard = isKanbanBoard;
module.exports.laneKey = laneKey;
module.exports.resolveMarker = resolveMarker;
module.exports.formatDate = formatDate;
module.exports.LANE_MARKERS = LANE_MARKERS;
