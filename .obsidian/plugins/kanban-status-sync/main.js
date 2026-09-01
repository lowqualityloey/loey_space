"use strict";

/*
 * Kanban Status Sync
 * ------------------
 * Keeps every Kanban card's checkbox in step with the lane it sits in, and
 * treats a card you tick anywhere (board, _Tasks MOC, a daily-note query) as
 * finished by moving it to the Done lane.
 *
 * Two rules, in this order:
 *   1. If a card changed lane, the lane wins and the marker follows it.
 *   2. If a card stayed put but became [x], that's a completion -> move to Done.
 *
 * Rule order is decided from a snapshot of where each card was on the previous
 * sync, not from the presence of a ✅ date, because the Tasks plugin may stamp
 * that date itself when a checkbox is toggled.
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
  "active to-dos": " ",
  "active to dos": " ",
  "active todos": " ",

  // Started
  "in progress": "/",
  "currently in progress": "/",
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
  "recently completed tasks": "x",
  "recently completed": "x",
  "completed tasks": "x",
  "shipped": "x"
};

// Lanes whose cards are never touched. Archive holds finished history, and
// rewriting it would churn old completion dates.
const UNMANAGED_LANES = ["archive", "archived"];

// Markers carrying meaning a lane cannot express, so they are left alone:
// cancelled, forwarded, scheduled, question, important.
const PRESERVED_MARKERS = ["-", ">", "<", "?", "!"];

// Only top-level cards are managed. Indented lines are subtasks inside a card.
const CARD_PATTERN = /^- \[([^\]])\]\s*(.*)$/;
const COMPLETION_DATE = /\s*✅\s*\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/g;
const HAS_COMPLETION_DATE = /✅\s*\d{4}-\d{2}-\d{2}/;

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

// Identity for tracking a card across syncs. Ignores the marker, completion
// date, wiki links, and block id so ticking or dating a card does not look like a new card.
function cardKey(text) {
  return String(text)
    .replace(COMPLETION_DATE, " ")
    .replace(/\[\[.*?\]\]/g, " ")
    .replace(/\s\^[A-Za-z0-9-]+\s*$/, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
 * Splits a board into preamble / lanes / trailer so cards can be moved between
 * lanes without disturbing frontmatter or the %% kanban:settings %% block.
 */
function parseBoard(content) {
  const lines = String(content).split("\n");
  const preamble = [];
  const lanes = [];
  const trailer = [];

  let i = 0;

  // Frontmatter
  if (lines.length && lines[0].trim() === "---") {
    preamble.push(lines[0]);
    for (i = 1; i < lines.length; i++) {
      preamble.push(lines[i]);
      if (lines[i].trim() === "---") { i++; break; }
    }
  }

  let current = null;
  let inTrailer = false;
  let inFence = false;

  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inTrailer) { trailer.push(line); continue; }

    // The %% block holds Kanban's own settings and ends the card area.
    if (!inFence && trimmed.startsWith("%%")) {
      inTrailer = true;
      trailer.push(line);
      continue;
    }

    if (trimmed.startsWith("```")) inFence = !inFence;

    if (!inFence) {
      const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
      if (heading) {
        current = { name: heading[1].trim(), heading: line, body: [] };
        lanes.push(current);
        continue;
      }
    }

    if (current) current.body.push(line);
    else preamble.push(line);
  }

  return { preamble: preamble, lanes: lanes, trailer: trailer };
}

function serializeBoard(board) {
  let out = board.preamble.slice();
  for (const lane of board.lanes) {
    out.push(lane.heading);
    out = out.concat(lane.body);
  }
  return out.concat(board.trailer).join("\n");
}

// Places a card after the last existing card in a lane, keeping the blank-line
// padding the Kanban plugin writes around lanes.
function insertCard(body, line) {
  let last = -1;
  for (let i = 0; i < body.length; i++) {
    if (CARD_PATTERN.test(body[i])) last = i;
  }
  if (last >= 0) {
    body.splice(last + 1, 0, line);
    return;
  }
  const at = body.length && body[0].trim() === "" ? 1 : 0;
  body.splice(at, 0, line);
}

function findBestMatchingLane(lanes, desiredMarker) {
  for (const lane of lanes) {
    const key = laneKey(lane.name);
    if (UNMANAGED_LANES.indexOf(key) !== -1) continue;
    const marker = resolveMarker(lane.name, LANE_MARKERS);
    if (marker === desiredMarker) return lane;
  }
  return null;
}

/**
 * Applies both rules to a board.
 *
 * options.previousLanes — { cardKey: laneKey } from the last sync. Without it,
 * every card falls back to "lane wins", which is the safe default on first run.
 *
 * Returns { text, changed, changes, laneState } and never mutates the input.
 */
function syncBoard(content, options) {
  const opts = options || {};
  const markers = opts.markers || LANE_MARKERS;
  const unmanaged = (opts.unmanaged || UNMANAGED_LANES).map(laneKey);
  const manageDate = opts.manageCompletionDate !== false;
  const today = opts.today || formatDate(new Date());
  const previous = opts.previousLanes || null;

  const board = parseBoard(content);
  const laneInfo = board.lanes.map((lane) => {
    const key = laneKey(lane.name);
    return {
      lane: lane,
      key: key,
      desired: unmanaged.indexOf(key) !== -1 ? undefined : resolveMarker(lane.name, markers)
    };
  });

  const doneLane = laneInfo.filter((info) => info.desired === "x")[0] || null;
  const changes = [];
  const laneState = {};
  const moves = [];

  for (let li = 0; li < laneInfo.length; li++) {
    const info = laneInfo[li];

    for (let bi = 0; bi < info.lane.body.length; bi++) {
      const line = info.lane.body[bi];
      const card = line.match(CARD_PATTERN);
      if (!card) continue;

      const marker = card[1];
      const body = card[2];
      const key = cardKey(body);

      // Unmanaged lane or a marker that carries its own meaning: track only.
      if (info.desired === undefined || PRESERVED_MARKERS.indexOf(marker) !== -1) {
        laneState[key] = info.key;
        continue;
      }

      const knownBefore = previous && Object.prototype.hasOwnProperty.call(previous, key);
      const laneChanged = knownBefore && previous[key] !== info.key;
      if (laneChanged) {
        changes.push({ action: "moved", card: cardKey(body), from: previous[key], to: info.lane.name, marker: info.desired });
      }
      const completedHere = marker === "x" && info.desired !== "x" && knownBefore && !laneChanged;

      if (completedHere) {
        let text = body;
        if (manageDate && !HAS_COMPLETION_DATE.test(text)) text = withCompletionDate(text, today);
        const nextLine = `- [x] ${text}`.replace(/\s+$/, "");

        if (doneLane) {
          moves.push({ from: li, index: bi, line: nextLine });
          changes.push({ action: "moved", card: cardKey(body), from: info.lane.name, to: doneLane.lane.name });
          laneState[key] = doneLane.key;
        } else {
          // No done lane on this board: honour the tick where it is.
          if (nextLine !== line) {
            info.lane.body[bi] = nextLine;
            changes.push({ action: "completed-in-place", card: cardKey(body), lane: info.lane.name });
          }
          laneState[key] = info.key;
        }
        continue;
      }

      // Rule 1 — the lane decides.
      let text = body;
      let updated = marker !== info.desired;

      if (manageDate) {
        const hasDate = HAS_COMPLETION_DATE.test(text);
        if (info.desired === "x" && !hasDate) {
          text = withCompletionDate(text, today);
          updated = true;
        } else if (info.desired !== "x" && hasDate) {
          text = text.replace(COMPLETION_DATE, "").replace(/\s+$/, "");
          updated = true;
        }
      }

      if (updated) {
        info.lane.body[bi] = `- [${info.desired}] ${text}`.replace(/\s+$/, "");
        changes.push({ action: "marker", card: cardKey(body), lane: info.lane.name, from: marker, to: info.desired });
      }

      laneState[key] = info.key;
    }
  }

  // Remove moved cards from the deepest index first so earlier indexes stay valid.
  if (moves.length && doneLane) {
    const ordered = moves.slice().sort((a, b) => b.index - a.index);
    for (const move of ordered) {
      laneInfo[move.from].lane.body.splice(move.index, 1);
    }
    for (const move of moves) {
      insertCard(doneLane.lane.body, move.line);
    }
  }

  const text = serializeBoard(board);
  return { text: text, changed: text !== content, changes: changes, laneState: laneState };
}

// Lane-wins only. Kept as the simple entry point (and used by tests).
function normalizeBoardText(content, options) {
  return syncBoard(content, Object.assign({}, options, { previousLanes: null }));
}

/* ==========================================================================
   PLUGIN
   ========================================================================== */

const SETTING_KEYS = ["autoSync", "manageCompletionDate", "notifyOnChange"];
const DEFAULT_SETTINGS = {
  autoSync: true,
  manageCompletionDate: true,
  notifyOnChange: false
};

class KanbanStatusSyncPlugin extends obsidian.Plugin {
  async onload() {
    const data = (await this.loadData()) || {};

    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    SETTING_KEYS.forEach((key) => {
      if (typeof data[key] === "boolean") this.settings[key] = data[key];
    });

    // { boardPath: { cardKey: laneKey } } — where each card sat last time.
    this.laneState = (data.laneState && typeof data.laneState === "object") ? data.laneState : {};

    this.writing = new Set();
    this.timers = new Map();
    this.saveTimer = null;

    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (!this.settings.autoSync) return;
      if (!file || typeof file.path !== "string" || !file.path.endsWith(".md")) return;
      if (this.writing.has(file.path)) return;
      if (file.name.endsWith("Kanban.md") || file.name === "Tasks Kanban.md") {
        this.scheduleSync(file);
      } else if (file.path.startsWith("01-Daily/")) {
        this.scheduleDailySync(file);
      } else {
        this.scheduleSync(file);
      }
    }));

    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (this.laneState[oldPath]) {
        this.laneState[file.path] = this.laneState[oldPath];
        delete this.laneState[oldPath];
        this.queueSave();
      }
    }));

    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (this.laneState[file.path]) {
        delete this.laneState[file.path];
        this.queueSave();
      }
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

    console.log("Kanban Status Sync: loaded");
    this.addSettingTab(new KanbanStatusSyncSettingTab(this.app, this));
  }

  onunload() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
  }

  async saveAll() {
    await this.saveData(Object.assign({}, this.settings, { laneState: this.laneState }));
  }

  // Lane snapshots change on most syncs; batch the writes.
  queueSave() {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.saveAll();
    }, 1500);
  }

  // Dragging a card fires several modify events; coalesce them per file.
  scheduleSync(file) {
    if (this.timers.has(file.path)) window.clearTimeout(this.timers.get(file.path));

    const timer = window.setTimeout(() => {
      this.timers.delete(file.path);
      this.syncFile(file, { notify: false });
    }, 400);

    this.timers.set(file.path, timer);
  }

  scheduleDailySync(file) {
    if (this.timers.has(file.path)) window.clearTimeout(this.timers.get(file.path));

    const timer = window.setTimeout(() => {
      this.timers.delete(file.path);
      this.syncDailyNoteToKanban(file);
    }, 400);

    this.timers.set(file.path, timer);
  }

  async syncDailyNoteToKanban(dailyFile) {
    let content = "";
    try {
      content = await this.app.vault.read(dailyFile);
    } catch (e) {
      return;
    }
    if (isKanbanBoard(content)) return;

    const kanbanFile = this.app.vault.getAbstractFileByPath("01-Daily/Tasks Kanban.md");
    if (!kanbanFile || this.writing.has(kanbanFile.path)) return;

    let kanbanContent = "";
    try {
      kanbanContent = await this.app.vault.read(kanbanFile);
    } catch (e) {
      return;
    }
    if (!isKanbanBoard(kanbanContent)) return;

    const board = parseBoard(kanbanContent);
    const lines = content.split(/\r?\n/);
    let boardChanged = false;

    let currentSec = "";
    const dailyTasks = new Map();
    for (const line of lines) {
      if (/^#+\s+/.test(line)) {
        currentSec = line.replace(/^#+\s+/, "").trim().toLowerCase();
        continue;
      }
      if (currentSec.includes("habit")) continue;

      const match = line.match(/^(\s*[-*]\s+\[)( |\^|\/|x|-|>|<|\?|!)(\]\s+)(.*)$/);
      if (!match) continue;
      const marker = match[2];
      const body = match[4].trim();
      if (!body) continue;
      const key = cardKey(body);
      dailyTasks.set(key, { marker, body });
    }

    const dailyBaseName = dailyFile.basename;
    const dailyLinkSuffix = `[[${dailyBaseName}]]`;

    // 1. Prune cards linked to this daily note that no longer exist in the daily note
    for (const lane of board.lanes) {
      for (let bi = lane.body.length - 1; bi >= 0; bi--) {
        const cardLine = lane.body[bi];
        const cardMatch = cardLine.match(CARD_PATTERN);
        if (!cardMatch) continue;
        const cardBody = cardMatch[2];
        
        if (cardBody.includes(dailyLinkSuffix)) {
          const key = cardKey(cardBody);
          if (!dailyTasks.has(key)) {
            lane.body.splice(bi, 1);
            boardChanged = true;
            console.log(`Kanban Status Sync: pruned deleted daily task "${key}" from Tasks Kanban`);
          }
        }
      }
    }

    // 2. Sync existing cards or add newly created daily tasks
    for (const [key, { marker, body }] of dailyTasks.entries()) {
      const desiredMarker = marker === "/" ? "/" : marker === "x" ? "x" : " ";
      let foundCard = false;

      for (const lane of board.lanes) {
        for (let bi = 0; bi < lane.body.length; bi++) {
          const cardLine = lane.body[bi];
          const cardMatch = cardLine.match(CARD_PATTERN);
          if (!cardMatch) continue;
          const cardBody = cardMatch[2];
          if (cardKey(cardBody) === key) {
            foundCard = true;
            const currentMarker = resolveMarker(lane.name, LANE_MARKERS);
            if (currentMarker !== desiredMarker) {
              const destLane = findBestMatchingLane(board.lanes, desiredMarker);
              if (destLane && destLane !== lane) {
                lane.body.splice(bi, 1);
                let newBody = cardBody;
                if (desiredMarker === "x" && this.settings.manageCompletionDate) {
                  if (!HAS_COMPLETION_DATE.test(newBody)) {
                    newBody = withCompletionDate(newBody, formatDate(new Date()));
                  }
                } else if (desiredMarker !== "x") {
                  newBody = newBody.replace(COMPLETION_DATE, "").replace(/\s+$/, "");
                }
                const newLine = `- [${desiredMarker}] ${newBody}`;
                insertCard(destLane.body, newLine);
                boardChanged = true;
                console.log(`Kanban Status Sync: synced task "${key}" from daily note to ${destLane.name} in Tasks Kanban`);
              }
            }
          }
        }
      }

      if (!foundCard) {
        const destLane = findBestMatchingLane(board.lanes, desiredMarker);
        if (destLane) {
          let cardText = body;
          if (!cardText.includes(dailyLinkSuffix)) {
            cardText = `${cardText} ${dailyLinkSuffix}`;
          }
          if (desiredMarker === "x" && this.settings.manageCompletionDate && !HAS_COMPLETION_DATE.test(cardText)) {
            cardText = withCompletionDate(cardText, formatDate(new Date()));
          }
          const newLine = `- [${desiredMarker}] ${cardText}`;
          insertCard(destLane.body, newLine);
          boardChanged = true;
          console.log(`Kanban Status Sync: added new task "${key}" to ${destLane.name} in Tasks Kanban`);
        }
      }
    }

    if (boardChanged) {
      const nextText = serializeBoard(board);
      this.writing.add(kanbanFile.path);
      try {
        await this.app.vault.modify(kanbanFile, nextText);
      } catch (err) {
        console.error(`Kanban Status Sync: failed to write Tasks Kanban`, err);
      } finally {
        window.setTimeout(() => this.writing.delete(kanbanFile.path), 800);
      }
    }
  }

  async syncFile(file, options) {
    const opts = options || {};
    let result = null;
    let isBoard = false;

    const transform = (data) => {
      if (!isKanbanBoard(data)) return data;
      isBoard = true;
      result = syncBoard(data, {
        manageCompletionDate: this.settings.manageCompletionDate,
        today: formatDate(new Date()),
        previousLanes: this.laneState[file.path] || null
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

    if (result) {
      this.laneState[file.path] = result.laneState;
      this.queueSave();
    }

    if (isBoard) {
      await this.propagateBoard(file);
    }

    if (result && (result.changed || result.changes.length)) {
      const moved = result.changes.filter((c) => c.action === "moved");
      console.log(`Kanban Status Sync: ${result.changes.length} change(s) in ${file.path}`, result.changes);

      if (opts.notify || this.settings.notifyOnChange) {
        const parts = [];
        if (moved.length) parts.push(`${moved.length} card${moved.length === 1 ? "" : "s"} moved to ${moved[0].to}`);
        const markerCount = result.changes.length - moved.length;
        if (markerCount) parts.push(`${markerCount} status${markerCount === 1 ? "" : "es"} synced`);
        new obsidian.Notice(`✅ ${parts.join(", ")} in ${file.basename}`);
      }
    } else if (opts.notify) {
      new obsidian.Notice(isBoard ? "Card statuses already match their lanes." : "This note is not a Kanban board.");
    }

    return result;
  }

  async propagateBoard(sourceFile) {
    let sourceContent = "";
    try {
      sourceContent = await this.app.vault.read(sourceFile);
    } catch (e) {
      return;
    }
    if (!isKanbanBoard(sourceContent)) return;

    const sourceBoard = parseBoard(sourceContent);
    const allFiles = this.app.vault.getMarkdownFiles();
    const targetFiles = allFiles.filter((f) => f.path !== sourceFile.path && !f.name.startsWith("_"));

    for (const sLane of sourceBoard.lanes) {
      const desiredMarker = resolveMarker(sLane.name, LANE_MARKERS);
      if (!desiredMarker) continue;

      for (const line of sLane.body) {
        const match = line.match(CARD_PATTERN);
        if (!match) continue;
        const body = match[2];
        const key = cardKey(body);

        const linkMatch = body.match(/\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]/);
        const linkedName = linkMatch ? linkMatch[1].trim() : null;

        for (const tFile of targetFiles) {
          if (this.writing.has(tFile.path)) continue;

          const isLinkedTarget = linkedName && (tFile.basename === linkedName || tFile.name === linkedName + ".md");

          let targetContent = "";
          try {
            targetContent = await this.app.vault.read(tFile);
          } catch (e) {
            continue;
          }

          if (isKanbanBoard(targetContent)) {
            const targetBoard = parseBoard(targetContent);
            let targetChanged = false;

            for (const tLane of targetBoard.lanes) {
              for (let bi = 0; bi < tLane.body.length; bi++) {
                const tLine = tLane.body[bi];
                const tMatch = tLine.match(CARD_PATTERN);
                if (!tMatch) continue;
                const tKey = cardKey(tMatch[2]);
                if (tKey === key) {
                  const currentMarker = resolveMarker(tLane.name, LANE_MARKERS);
                  if (currentMarker !== desiredMarker) {
                    const destLane = findBestMatchingLane(targetBoard.lanes, desiredMarker);
                    if (destLane && destLane !== tLane) {
                      tLane.body.splice(bi, 1);
                      let newBody = tMatch[2];
                      if (desiredMarker === "x" && this.settings.manageCompletionDate) {
                        if (!HAS_COMPLETION_DATE.test(newBody)) {
                          newBody = withCompletionDate(newBody, formatDate(new Date()));
                        }
                      } else if (desiredMarker !== "x") {
                        newBody = newBody.replace(COMPLETION_DATE, "").replace(/\s+$/, "");
                      }
                      const newLine = `- [${desiredMarker}] ${newBody}`;
                      insertCard(destLane.body, newLine);
                      targetChanged = true;
                      console.log(`Kanban Status Sync: cross-synced "${key}" to ${destLane.name} in ${tFile.basename}`);
                    }
                  }
                }
              }
            }

            if (targetChanged) {
              const nextText = serializeBoard(targetBoard);
              this.writing.add(tFile.path);
              try {
                await this.app.vault.modify(tFile, nextText);
              } catch (err) {
                console.error(`Kanban Status Sync: failed to write ${tFile.path}`, err);
              } finally {
                window.setTimeout(() => this.writing.delete(tFile.path), 800);
              }
            }
          } else if (isLinkedTarget || tFile.path.startsWith("01-Daily/")) {
            const lines = targetContent.split(/\r?\n/);
            let noteChanged = false;

            for (let li = 0; li < lines.length; li++) {
              const tLine = lines[li];
              const tMatch = tLine.match(/^(\s*[-*]\s+\[)( |\^|\/|x|-|>|<|\?|!)(\]\s+)(.*)$/);
              if (!tMatch) continue;
              const lineBody = tMatch[4];
              if (cardKey(lineBody) === key) {
                const currentMarker = tMatch[2];
                if (currentMarker !== desiredMarker && PRESERVED_MARKERS.indexOf(currentMarker) === -1) {
                  let newLineBody = lineBody;
                  if (desiredMarker === "x" && this.settings.manageCompletionDate) {
                    if (!HAS_COMPLETION_DATE.test(newLineBody)) {
                      newLineBody = withCompletionDate(newLineBody, formatDate(new Date()));
                    }
                  } else if (desiredMarker !== "x") {
                    newLineBody = newLineBody.replace(COMPLETION_DATE, "").replace(/\s+$/, "");
                  }
                  lines[li] = `${tMatch[1]}${desiredMarker}${tMatch[3]}${newLineBody}`;
                  noteChanged = true;
                  console.log(`Kanban Status Sync: synced daily task "${key}" marker from [${currentMarker}] to [${desiredMarker}] in ${tFile.basename}`);
                }
              }
            }

            if (noteChanged) {
              const nextText = lines.join("\n");
              this.writing.add(tFile.path);
              try {
                await this.app.vault.modify(tFile, nextText);
              } catch (err) {
                console.error(`Kanban Status Sync: failed to write note ${tFile.path}`, err);
              } finally {
                window.setTimeout(() => this.writing.delete(tFile.path), 800);
              }
            }
          }
        }
      }
    }
  }

  async syncAllBoards() {
    const files = this.app.vault.getMarkdownFiles();
    let boards = 0;
    let changes = 0;

    for (const file of files) {
      const result = await this.syncFile(file, { notify: false });
      if (result && result.changed) {
        boards++;
        changes += result.changes.length;
      }
    }

    new obsidian.Notice(
      boards === 0
        ? "All Kanban card statuses already match their lanes."
        : `✅ ${changes} change${changes === 1 ? "" : "s"} across ${boards} board${boards === 1 ? "" : "s"}.`
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
      .setDesc("Update cards whenever a board changes. Turn this off to sync only via the commands.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveAll();
        }));

    new obsidian.Setting(containerEl)
      .setName("Manage completion dates")
      .setDesc("Add ✅ YYYY-MM-DD when a card reaches a done lane, and remove it if the card moves back out.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.manageCompletionDate)
        .onChange(async (value) => {
          this.plugin.settings.manageCompletionDate = value;
          await this.plugin.saveAll();
        }));

    new obsidian.Setting(containerEl)
      .setName("Notify on every change")
      .setDesc("Show a notice each time cards are updated. Useful while testing, noisy day to day.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.notifyOnChange)
        .onChange(async (value) => {
          this.plugin.settings.notifyOnChange = value;
          await this.plugin.saveAll();
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

    [
      ["Backlog, To Do, Next, Planned", "[ ]"],
      ["In Progress, Doing, WIP", "[/]"],
      ["Review / Test, QA, Testing", "[/]"],
      ["Done, Complete, Shipped", "[x] + ✅ date"],
      ["Archive", "left untouched"]
    ].forEach(([lane, marker]) => {
      const row = table.createEl("tr");
      row.createEl("td", { text: lane });
      row.createEl("td").createEl("code", { text: marker });
    });

    containerEl.createEl("h3", { text: "Ticking a card" });
    containerEl.createEl("p", {
      text: "Tick a card anywhere — on the board, in _Tasks MOC, or in a daily-note query — and it moves to the Done lane with today's date. Dragging a card out of Done clears both the tick and the date. Cancelled or forwarded markers ([-], [>], [<], [?], [!]) are never overwritten, and lanes not listed above are ignored."
    }).style.fontSize = "var(--font-ui-smaller)";

    containerEl.createEl("p", {
      text: "Edit LANE_MARKERS at the top of main.js to add your own column names."
    }).style.fontSize = "var(--font-ui-smaller)";
  }
}

module.exports = KanbanStatusSyncPlugin;

// Exposed for testing.
module.exports.syncBoard = syncBoard;
module.exports.normalizeBoardText = normalizeBoardText;
module.exports.parseBoard = parseBoard;
module.exports.serializeBoard = serializeBoard;
module.exports.isKanbanBoard = isKanbanBoard;
module.exports.laneKey = laneKey;
module.exports.cardKey = cardKey;
module.exports.resolveMarker = resolveMarker;
module.exports.formatDate = formatDate;
module.exports.LANE_MARKERS = LANE_MARKERS;
