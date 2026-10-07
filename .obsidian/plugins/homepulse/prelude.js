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

function getTodayDailyFile(app) {
  try {
    let targetApp = app || (typeof window !== "undefined" ? window.app : null);
    if (!targetApp || !targetApp.vault) return null;
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
