/* HomePulse owned prelude — the locally maintained seam of a bundle with no upstream source.
 * Source of truth for .obsidian/plugins/homepulse/main.js; injected by
 * 06-Resources/scripts/apply-homepulse-prelude.mjs. Never edit the minified core.
 * Provenance and update procedure: 06-Resources/Guides/Plugin Ownership.md */

"use strict";

function getLocalDateStr(d) {
  d = d || new Date();
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

async function syncHabitsToFiles(habitName, isChecked, appObj) {
  try {
    var todayStr = getLocalDateStr();
    var esc = habitName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var regex = new RegExp("^(- \\[)[ x](\\] \\*?" + esc + ".*)$", "im");
    var newChar = isChecked ? "x" : " ";

    // Only the dated observation is written. 99-Templates/Daily.md holds habit
    // *defaults*; writing a completion there made every new day start checked.

    var dailyFiles = appObj.vault.getMarkdownFiles().filter(function(f) {
      var norm = f.path.replace(/\\/g, "/");
      return norm.startsWith("01-Daily/") && f.name.includes(todayStr);
    });

    for (var i = 0; i < dailyFiles.length; i++) {
      var dFile = dailyFiles[i];
      var content2 = await appObj.vault.read(dFile);
      if (regex.test(content2)) {
        content2 = content2.replace(regex, "$1" + newChar + "$2");
        await appObj.vault.modify(dFile, content2);
      }
    }
  } catch (err) {
    console.error("Habit sync error:", err);
  }
}

/* ---- Today's Focus bridge (vault patch; see Plugin Ownership.md §3) ---- */

function getLocalDateStr() {
  let now = new Date();
  let year = now.getFullYear();
  let month = String(now.getMonth() + 1).padStart(2, "0");
  let day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ensureVaultHomePulseState(app) {
  try {
    let targetApp = app || (typeof window !== "undefined" ? window.app : null);
    let hp = targetApp && targetApp.plugins && targetApp.plugins.plugins && targetApp.plugins.plugins.homepulse;
    if (!hp || !hp.data || !hp.data.widgets) return false;
    let todayStr = getLocalDateStr();
    let widgets = hp.data.widgets;
    let healed = false;

    // Prevent focus.render() from calling saveState() -> saveData() on every render:
    // upstream _e("focus") strips lastFocusDate, which otherwise makes every vault
    // modify event overwrite data.json with in-memory state.
    if (widgets["focus-main"] && widgets["focus-main"].state) {
      if (widgets["focus-main"].state.lastFocusDate !== todayStr) {
        widgets["focus-main"].state.lastFocusDate = todayStr;
      }
    }

    if (!hp.data.initialized) {
      hp.data.initialized = true;
      healed = true;
    }

    if (hp.data.settings) {
      if (!hp.data.settings.obsidianStartDate) {
        hp.data.settings.obsidianStartDate = "2026-08-22";
        healed = true;
      }
      if (!hp.data.settings.profileName || hp.data.settings.profileName === "My Homepage") {
        hp.data.settings.profileName = "LOEY SPACE";
        healed = true;
      }
    }

    for (let [id, entry] of Object.entries(widgets)) {
      if (!entry || typeof entry !== "object") continue;
      let cfg = entry.config = entry.config || {};
      let st = entry.state = entry.state || {};

      if (id.startsWith("music-player") && (cfg.serviceName === "NetEase Cloud Music" || cfg.playUrl === "https://music.163.com/")) {
        cfg.title = "music player";
        cfg.serviceName = "YouTube Music";
        cfg.loginUrl = "https://accounts.google.com/";
        cfg.playUrl = "https://music.youtube.com/";
        healed = true;
      } else if (id.startsWith("habits")) {
        if (!Array.isArray(st.habits) || st.habits.length === 0) {
          st.habits = ["prioritised", "water", "move", "read", "tidy", "disconnect"];
          if (!st.completions || typeof st.completions !== "object") st.completions = {};
          hp._needsVaultHabitSync = true;
          healed = true;
        } else if (!st.completions || Object.keys(st.completions).length === 0) {
          st.completions = {};
          hp._needsVaultHabitSync = true;
        }
      } else if (id.startsWith("knowledge") && Array.isArray(cfg.projectNamePrefixes) && cfg.projectNamePrefixes.includes("Project_")) {
        cfg.projectNamePrefixes = [];
        cfg.projectFolders = ["02-Projects"];
        cfg.projectTags = ["type/project"];
        healed = true;
      } else if (id.startsWith("tasks") && Array.isArray(cfg.projectNamePrefixes) && cfg.projectNamePrefixes.includes("Project_")) {
        cfg.projectFolders = ["02-Projects", "01-Daily"];
        cfg.projectTags = [];
        cfg.projectNamePrefixes = [];
        cfg.limit = 12;
        healed = true;
      } else if (id.startsWith("projects") && Array.isArray(cfg.projectNamePrefixes) && cfg.projectNamePrefixes.includes("Project_")) {
        cfg.projectFolders = ["02-Projects"];
        cfg.projectTags = ["type/project"];
        cfg.projectNamePrefixes = [];
        cfg.limit = 10;
        healed = true;
      } else if (id.startsWith("tech-tree") && Array.isArray(cfg.projectNamePrefixes) && cfg.projectNamePrefixes.includes("Project_")) {
        cfg.areaRoot = "";
        cfg.projectFolders = ["02-Projects"];
        cfg.projectTags = ["type/project"];
        cfg.projectNamePrefixes = [];
        healed = true;
      } else if (id.startsWith("pomodoro") && Array.isArray(cfg.projectNamePrefixes) && cfg.projectNamePrefixes.includes("Project_")) {
        cfg.projectFolders = ["02-Projects"];
        cfg.projectTags = ["type/project"];
        cfg.projectNamePrefixes = [];
        cfg.areaFolders = ["03-Dev", "04-Learning", "05-Personal", "08-Concepts"];
        cfg.areaTags = [];
        cfg.areaNamePrefixes = [];
        cfg.taskFile = "00-Inbox/quick-capture-dump.md";
        healed = true;
      } else if (id.startsWith("bookmarks") && (!Array.isArray(cfg.items) || cfg.items.length === 0)) {
        cfg.useFavicons = true;
        cfg.items = [
          { label: "github", type: "url", value: "https://github.com/lowqualityloey" },
          { label: "gmail", type: "url", value: "https://mail.google.com" },
          { label: "chatgpt", type: "url", value: "https://chatgpt.com" },
          { label: "calendar", type: "url", value: "https://calendar.google.com" }
        ];
        healed = true;
      } else if (id.startsWith("quick-actions") && (!Array.isArray(cfg.items) || cfg.items.length <= 2)) {
        cfg.items = [
          { label: "daily", type: "daily-note", value: "" },
          { label: "capture", type: "command", value: "quickadd:choice:capture-to-inbox" },
          { label: "start task", type: "command", value: "quickadd:choice:f8e2c1a0-4b3d-4e5f-9a1b-2c3d4e5f6a7b" },
          { label: "done task", type: "command", value: "quickadd:choice:a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d" },
          { label: "sync board", type: "command", value: "quickadd:choice:d4c3b2a1-6f5e-4b5a-9d8c-1f0e3b2a5d4c" },
          { label: "weekly ai", type: "command", value: "quickadd:choice:weekly-ai-review-id" },
          { label: "archive", type: "command", value: "quickadd:choice:archive-capture-dump" },
          { label: "backup", type: "command", value: "quickadd:choice:backup-vault-id" }
        ];
        healed = true;
      }
    }

    if (healed) {
      hp._needsPersistHeal = true;
    }
    return healed;
  } catch (err) {
    return false;
  }
}

async function syncVaultHabitsToHomePulse(app) {
  try {
    let targetApp = app || (typeof window !== "undefined" ? window.app : null);
    let hp = targetApp && targetApp.plugins && targetApp.plugins.plugins && targetApp.plugins.plugins.homepulse;
    if (!hp || !hp.data || !hp.data.widgets) return;
    let needSync = !!hp._needsVaultHabitSync;
    let needPersist = !!hp._needsPersistHeal;
    hp._needsVaultHabitSync = false;
    hp._needsPersistHeal = false;

    let habitsEntry = Object.entries(hp.data.widgets).find(([k]) => k.startsWith("habits"));
    if (!habitsEntry) return;
    let st = habitsEntry[1].state = habitsEntry[1].state || {};
    let habits = Array.isArray(st.habits) && st.habits.length ? st.habits : ["prioritised", "water", "move", "read", "tidy", "disconnect"];
    st.completions = st.completions || {};

    let changed = false;
    let files = targetApp.vault.getMarkdownFiles().filter(f => {
      let norm = f.path.replace(/\\/g, "/");
      return norm.startsWith("01-Daily/") && /^\d{4}-\d{2}-\d{2}$/.test(f.basename);
    });
    let targetFiles = needSync ? files : files.filter(f => f.basename === getLocalDateStr());

    for (let f of targetFiles) {
      let content = await targetApp.vault.cachedRead(f);
      for (let h of habits) {
        let esc = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        let rx = new RegExp("^- \\[([xX ])\\] \\*?" + esc + "\\b", "m");
        let m = rx.exec(content);
        if (!m) continue;
        let key = h + "|" + f.basename;
        let checked = m[1].toLowerCase() === "x";
        if (checked && !st.completions[key]) {
          st.completions[key] = true;
          changed = true;
        } else if (!checked && st.completions[key] && f.basename === getLocalDateStr()) {
          delete st.completions[key];
          changed = true;
        }
      }
    }

    if (needPersist || needSync || changed) {
      await hp.persist();
      if (needSync || changed) {
        hp.scheduleRefresh();
      }
    }
  } catch (err) {
    console.error("syncVaultHabitsToHomePulse error:", err);
  }
}

function getTodayDailyFile(app) {
  try {
    let targetApp = app || (typeof window !== "undefined" ? window.app : null);
    if (!targetApp || !targetApp.vault) return null;
    ensureVaultHomePulseState(targetApp);
    let todayStr = getLocalDateStr();
    let files = targetApp.vault.getMarkdownFiles().filter(f => f.path.startsWith("01-Daily/") && !f.name.startsWith("_"));
    let exact = files.find(f => f.basename === todayStr || f.name === todayStr + ".md");
    if (exact) return exact;
    return files.find(f => f.name.startsWith(todayStr)) || null;
  } catch (err) {
    return null;
  }
}

async function readTodayFocusFromNote(app) {
  try {
    let targetApp = app || (typeof window !== "undefined" ? window.app : null);
    await syncVaultHabitsToHomePulse(targetApp);
    let file = getTodayDailyFile(targetApp);
    if (!file) return "";
    let content = await targetApp.vault.read(file);
    let lines = content.split(/\r?\n/);
    let inSec = false, textLines = [];
    for (let l of lines) {
      if (/^#+\s+.*(Focus|goal)/i.test(l)) {
        inSec = true;
        continue;
      } else if (/^#+\s+/.test(l) && inSec) {
        break;
      }
      if (inSec) {
        let trimmed = l.trim();
        // Skip empty lines, blockquotes (subtitles/descriptions), and bare bullet markers
        if (!trimmed) continue;
        if (trimmed.startsWith(">")) continue;
        if (trimmed === "-" || trimmed === "- " || trimmed === "*") continue;
        if (/^define your focus/i.test(trimmed)) continue;
        // Strip bullet prefix to get clean focus text
        let clean = trimmed.replace(/^[-*]\s+/, "").trim();
        if (clean) textLines.push(clean);
      }
    }
    return textLines.join("\n").trim();
  } catch (err) {
    return "";
  }
}

async function saveTodayFocusToNote(app, text) {
  try {
    let targetApp = app || (typeof window !== "undefined" ? window.app : null);
    if (!targetApp || !targetApp.vault) return;
    let todayStr = getLocalDateStr();
    let file = getTodayDailyFile(targetApp);
    
    if (!file) {
      let tmplFile = targetApp.vault.getAbstractFileByPath("99-Templates/Daily.md");
      let initialContent = "";
      if (tmplFile) {
        initialContent = await targetApp.vault.read(tmplFile);
        initialContent = initialContent.replace(/<% tp\.date\.now\("YYYY-MM-DD"\) %>/g, todayStr);
        initialContent = initialContent.replace(/<% tp\.date\.now\("dddd, MMMM D, YYYY"\) %>/g, todayStr);
      } else {
        initialContent = "---\ntype: daily\n---\n# " + todayStr + "\n\n## 🎯 Today's Focus\n" + (text || "") + "\n\n## ✅ Tasks\n";
      }
      let monthFolder = "01-Daily/" + todayStr.slice(0, 7);
      if (!targetApp.vault.getAbstractFileByPath(monthFolder)) {
        try { await targetApp.vault.createFolder(monthFolder); } catch (e) {}
      }
      file = await targetApp.vault.create(monthFolder + "/" + todayStr + ".md", initialContent);
    }

    // Convert widget text to bullet format for daily note
    let bulletLines = "";
    if (text) {
      let items = text.split(/\n/).map(s => s.trim()).filter(s => s);
      bulletLines = items.map(item => {
        // Don't double-add bullet if already has one
        if (item.startsWith("- ") || item.startsWith("* ")) return item;
        return "- " + item;
      }).join("\n");
    }

    let content = await targetApp.vault.read(file);
    let lines = content.split(/\r?\n/);
    let newLines = [], inSec = false, foundSec = false, skipIdx = -1;

    for (let idx = 0; idx < lines.length; idx++) {
      let l = lines[idx];
      if (/^#+\s+.*(Focus|goal)/i.test(l)) {
        inSec = true; foundSec = true;
        newLines.push(l);
        // Preserve subtitle/description blockquote lines immediately after header
        let nextIdx = idx + 1;
        while (nextIdx < lines.length && lines[nextIdx].trim().startsWith(">")) {
          newLines.push(lines[nextIdx]);
          nextIdx++;
        }
        skipIdx = nextIdx - 1; // Mark where we stopped preserving blockquotes
        if (bulletLines) newLines.push(bulletLines);
        continue;
      }
      // Skip lines we already handled (blockquote preservation)
      if (inSec && idx <= skipIdx) continue;
      if (/^#+\s+/.test(l) && inSec) {
        inSec = false;
      }
      if (!inSec) {
        newLines.push(l);
      }
    }

    if (!foundSec) {
      let idx = newLines.findIndex(l => /^#+\s+.*Tasks/i.test(l));
      let insertSec = ["## 🎯 Today's Focus", bulletLines || "", ""];
      if (idx !== -1) {
        newLines.splice(idx, 0, ...insertSec);
      } else {
        newLines.push("", ...insertSec);
      }
    }

    await targetApp.vault.modify(file, newLines.join("\n"));
  } catch (err) {
    console.error("saveTodayFocusToNote error:", err);
  }
}
