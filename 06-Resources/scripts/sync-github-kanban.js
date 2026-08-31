// 06-Resources/scripts/src/sync-github-kanban.ts
var import_child_process = require("child_process");
var import_obsidian = require("obsidian");
module.exports = async function syncGitHubKanban(params) {
  const app = params?.app || window.app || globalThis.app;
  const Notice = window.Notice || import_obsidian.Notice;
  try {
    let activeFile = app.workspace.getActiveFile();
    let projectNumber = null;
    let owner = null;
    let targetFile = activeFile;
    if (activeFile) {
      const cache = app.metadataCache.getFileCache(activeFile);
      if (cache?.frontmatter?.github_project_number) {
        projectNumber = Number(cache.frontmatter.github_project_number);
        owner = cache.frontmatter.github_owner || "lowqualityloey";
      }
    }
    if (!projectNumber) {
      const defaultPath = "02-Projects/weather-dashboard/Weather Dashboard Kanban.md";
      const abstractDefault = app.vault.getAbstractFileByPath(defaultPath);
      if (abstractDefault && abstractDefault instanceof import_obsidian.TFile) {
        targetFile = abstractDefault;
        const cache = app.metadataCache.getFileCache(targetFile);
        projectNumber = Number(cache?.frontmatter?.github_project_number) || 2;
        owner = cache?.frontmatter?.github_owner || "lowqualityloey";
      } else {
        projectNumber = 2;
        owner = "lowqualityloey";
        targetFile = activeFile;
      }
    }
    if (!targetFile || !(targetFile instanceof import_obsidian.TFile)) {
      new Notice("\u274C Please open a Kanban note to sync!", 4e3);
      return;
    }
    new Notice(`\u{1F504} 2-Way Syncing "${targetFile.basename}" with GitHub Project #${projectNumber}...`, 4e3);
    let projectId = null;
    try {
      const projViewJson = (0, import_child_process.execSync)(`gh project view ${projectNumber} --owner ${owner} --format json`, { encoding: "utf8", timeout: 1e4 });
      const projData = JSON.parse(projViewJson);
      projectId = projData.id;
    } catch (e) {
      if (e?.stderr && typeof e.stderr === "string" && e.stderr.includes("read:project")) {
        new Notice("\u26A0\uFE0F Missing GitHub token scope!\nRun in terminal: gh auth refresh -s project", 8e3);
        return;
      }
      console.warn("Project view warning:", e);
    }
    if (!projectId) {
      new Notice(`\u274C Could not resolve GitHub Project #${projectNumber} for user "${owner}".`, 5e3);
      return;
    }
    let statusFieldId = null;
    const statusOptionsMap = {};
    const statusIdToNameMap = {};
    let priorityFieldId = null;
    const priorityOptionsMap = {};
    const priorityIdToNameMap = {};
    try {
      const fieldsJson = (0, import_child_process.execSync)(`gh project field-list ${projectNumber} --owner ${owner} --format json`, { encoding: "utf8", timeout: 1e4 });
      const fieldsData = JSON.parse(fieldsJson);
      const fields = fieldsData.fields || [];
      for (const field of fields) {
        const nameLower = (field.name || "").toLowerCase();
        if (nameLower === "status" && field.options) {
          statusFieldId = field.id;
          for (const opt of field.options) {
            statusOptionsMap[opt.name.toLowerCase()] = opt.id;
            statusIdToNameMap[opt.id] = opt.name;
          }
        } else if (nameLower === "priority" && field.options) {
          priorityFieldId = field.id;
          for (const opt of field.options) {
            priorityOptionsMap[opt.name.toLowerCase()] = opt.id;
            priorityIdToNameMap[opt.id] = opt.name;
          }
        }
      }
    } catch (fieldErr) {
      console.warn("Field discovery warning:", fieldErr);
    }
    const statusToSectionMap = {
      "backlog": "Backlog",
      "ready": "To Do",
      "to do": "To Do",
      "in progress": "In Progress",
      "in-progress": "In Progress",
      "in review": "Review / Test",
      "done": "Done"
    };
    const sectionToStatusMap = {
      "Backlog": "Backlog",
      "To Do": "Ready",
      "In Progress": "In progress",
      "Review / Test": "In review",
      "Done": "Done"
    };
    const sectionToCheckboxMap = {
      "Backlog": "- [ ]",
      "To Do": "- [ ]",
      "In Progress": "- [/]",
      "Review / Test": "- [/]",
      "Done": "- [x]"
    };
    const resolveStatusOption = (statusStr) => {
      if (!statusStr)
        return statusOptionsMap["backlog"] || null;
      const s = statusStr.toLowerCase();
      if (statusOptionsMap[s])
        return statusOptionsMap[s];
      if (s === "ready" && statusOptionsMap["to do"])
        return statusOptionsMap["to do"];
      if (s === "to do" && statusOptionsMap["ready"])
        return statusOptionsMap["ready"];
      if (s === "in progress" && statusOptionsMap["in-progress"])
        return statusOptionsMap["in-progress"];
      return statusOptionsMap["backlog"] || null;
    };
    const resolvePriorityOption = (priStr) => {
      if (!priStr)
        return null;
      const p = priStr.toLowerCase();
      if (priorityOptionsMap[p])
        return priorityOptionsMap[p];
      if (p === "p0" && priorityOptionsMap["critical"])
        return priorityOptionsMap["critical"];
      if (p === "p1" && priorityOptionsMap["high"])
        return priorityOptionsMap["high"];
      if (p === "p2" && priorityOptionsMap["medium"])
        return priorityOptionsMap["medium"];
      if (p === "p3" && priorityOptionsMap["low"])
        return priorityOptionsMap["low"];
      return null;
    };
    let githubItems = [];
    try {
      const ghJson = (0, import_child_process.execSync)(`gh project item-list ${projectNumber} --owner ${owner} --format json`, {
        encoding: "utf8",
        timeout: 1e4
      });
      const parsed = JSON.parse(ghJson);
      githubItems = parsed.items || parsed || [];
    } catch (e) {
      console.warn("Item fetch warning:", e);
    }
    const githubMap = /* @__PURE__ */ new Map();
    for (const item of githubItems) {
      const rawTitle = (item.title || "").replace(/^\]\s*/, "").trim();
      const normTitle = rawTitle.toLowerCase();
      let itemStatus = item.status || "Backlog";
      let itemPriority = item.priority || null;
      githubMap.set(normTitle, {
        id: item.id,
        rawTitle,
        status: itemStatus,
        priority: itemPriority
      });
    }
    const content = await app.vault.read(targetFile);
    const lines = content.split("\n");
    const sections = {
      "Backlog": [],
      "To Do": [],
      "In Progress": [],
      "Review / Test": [],
      "Done": [],
      "Archive": []
    };
    let currentSection = "Backlog";
    const frontmatterLines = [];
    let isFrontmatter = false;
    let frontmatterDone = false;
    const sectionOrder = ["Backlog", "To Do", "In Progress", "Review / Test", "Done", "Archive"];
    const localItemsMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (i === 0 && trimmed === "---") {
        isFrontmatter = true;
        frontmatterLines.push(line);
        continue;
      }
      if (isFrontmatter) {
        frontmatterLines.push(line);
        if (trimmed === "---") {
          isFrontmatter = false;
          frontmatterDone = true;
        }
        continue;
      }
      if (trimmed.startsWith("## ")) {
        const secName = trimmed.replace("## ", "").trim();
        if (sections[secName] !== void 0) {
          currentSection = secName;
        } else {
          sections[secName] = [];
          sectionOrder.push(secName);
          currentSection = secName;
        }
        continue;
      }
      if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [/]") || trimmed.startsWith("- [x]")) {
        const checkbox = trimmed.slice(0, 5);
        let rawTaskText = trimmed.slice(5).trim();
        let priority = null;
        if (rawTaskText.includes("#priority/p0") || rawTaskText.includes("#p0"))
          priority = "P0";
        else if (rawTaskText.includes("#priority/p1") || rawTaskText.includes("#p1"))
          priority = "P1";
        else if (rawTaskText.includes("#priority/p2") || rawTaskText.includes("#p2"))
          priority = "P2";
        else if (rawTaskText.includes("#priority/p3") || rawTaskText.includes("#p3"))
          priority = "P3";
        let completionDate = null;
        const dateMatch = rawTaskText.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          completionDate = dateMatch[1];
        }
        let cleanTitle = rawTaskText.replace(/#priority\/p[0-3]/g, "").replace(/#p[0-3]/g, "").replace(/✅\s*\d{4}-\d{2}-\d{2}/g, "").replace(/`[^`]+`/g, (match) => match.replace(/`/g, "")).trim();
        cleanTitle = cleanTitle.replace(/^\]\s*/, "").trim();
        if (cleanTitle) {
          const normTitle = cleanTitle.toLowerCase();
          localItemsMap.set(normTitle, {
            title: cleanTitle,
            priority,
            section: currentSection,
            checkbox,
            completionDate
          });
        }
      }
    }
    let pulledCount = 0;
    let pushedCount = 0;
    const nowStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const reconciledMap = /* @__PURE__ */ new Map();
    for (const [normTitle, ghItem] of githubMap.entries()) {
      const localItem = localItemsMap.get(normTitle);
      let targetSection = statusToSectionMap[ghItem.status.toLowerCase()] || "Backlog";
      let targetPriority = ghItem.priority || (localItem ? localItem.priority : "P2");
      if (localItem) {
        if (statusToSectionMap[ghItem.status.toLowerCase()] && statusToSectionMap[ghItem.status.toLowerCase()] !== localItem.section) {
          pulledCount++;
        }
        if (ghItem.priority && ghItem.priority !== localItem.priority) {
          targetPriority = ghItem.priority;
          pulledCount++;
        } else if (!ghItem.priority && localItem.priority) {
          targetPriority = localItem.priority;
          const priorityOptId = resolvePriorityOption(targetPriority);
          if (priorityFieldId && priorityOptId) {
            try {
              (0, import_child_process.execSync)(`gh project item-edit --id "${ghItem.id}" --project-id "${projectId}" --field-id "${priorityFieldId}" --single-select-option-id "${priorityOptId}"`, { encoding: "utf8", timeout: 5e3 });
              pushedCount++;
            } catch (err) {
              console.warn("Priority push err:", err);
            }
          }
        }
      } else {
        pulledCount++;
      }
      let checkbox = sectionToCheckboxMap[targetSection] || "- [ ]";
      let completionDate = localItem ? localItem.completionDate : null;
      if (targetSection === "Done" && !completionDate) {
        completionDate = nowStr;
      }
      reconciledMap.set(normTitle, {
        title: ghItem.rawTitle,
        priority: targetPriority,
        section: targetSection,
        checkbox,
        completionDate
      });
    }
    for (const [normTitle, localItem] of localItemsMap.entries()) {
      if (!githubMap.has(normTitle)) {
        try {
          const createCmd = `gh project item-create ${projectNumber} --owner ${owner} --title "${localItem.title.replace(/"/g, '\\"')}" --format json`;
          const createRes = (0, import_child_process.execSync)(createCmd, { encoding: "utf8", timeout: 1e4 });
          const newItem = JSON.parse(createRes);
          if (newItem && newItem.id) {
            const ghStatusName = sectionToStatusMap[localItem.section] || "Backlog";
            const statusOptId = resolveStatusOption(ghStatusName);
            if (statusFieldId && statusOptId) {
              (0, import_child_process.execSync)(`gh project item-edit --id "${newItem.id}" --project-id "${projectId}" --field-id "${statusFieldId}" --single-select-option-id "${statusOptId}"`, { encoding: "utf8", timeout: 5e3 });
            }
            if (priorityFieldId && localItem.priority) {
              const priorityOptId = resolvePriorityOption(localItem.priority);
              if (priorityOptId) {
                (0, import_child_process.execSync)(`gh project item-edit --id "${newItem.id}" --project-id "${projectId}" --field-id "${priorityFieldId}" --single-select-option-id "${priorityOptId}"`, { encoding: "utf8", timeout: 5e3 });
              }
            }
            pushedCount++;
          }
        } catch (createErr) {
          console.error(`Failed to push local item "${localItem.title}":`, createErr);
        }
        reconciledMap.set(normTitle, localItem);
      }
    }
    for (const item of reconciledMap.values()) {
      const sec = sections[item.section] ? item.section : "Backlog";
      sections[sec].push(item);
    }
    let newContent = "";
    if (frontmatterLines.length > 0) {
      newContent += frontmatterLines.join("\n") + "\n\n";
    }
    for (const secName of sectionOrder) {
      newContent += `## ${secName}
`;
      const items = sections[secName] || [];
      for (const item of items) {
        let priTag = item.priority ? ` #priority/${item.priority.toLowerCase()}` : "";
        let dateTag = secName === "Done" && item.completionDate ? ` \u2705 ${item.completionDate}` : "";
        newContent += `${item.checkbox} ${item.title}${priTag}${dateTag}
`;
      }
      newContent += "\n";
    }
    await app.vault.modify(targetFile, newContent.trim() + "\n");
    new Notice(`\u{1F389} 2-Way Sync Complete! Updated ${pulledCount} from GitHub, Pushed ${pushedCount} to GitHub.`, 7e3);
  } catch (error) {
    console.error("GitHub 2-Way Sync Error:", error);
    new Notice(`\u274C GitHub Sync Error: ${error?.message || error}`, 7e3);
  }
};
