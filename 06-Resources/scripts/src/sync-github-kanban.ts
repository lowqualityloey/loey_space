/**
 * QuickAdd UserScript: True 2-Way Bi-Directional GitHub Project Kanban Sync
 * --------------------------------------------------------------------------
 * Dynamic Schema Auto-Discovery Engine with Full Pull & Push Reconciliation.
 * - PULLS changes made on GitHub Web UI (status moves, priority changes, new issues) into Obsidian Kanban.
 * - PUSHES local Obsidian Kanban changes (new cards, status moves, priority tags) to GitHub Projects v2.
 *
 * Target Kanban Note Frontmatter:
 *   github_project_number: 2
 *   github_owner: lowqualityloey
 */

const { execSync } = require('child_process');

module.exports = async (params) => {
  const { app } = params;
  const Notice = window.Notice || globalThis.Notice;

  try {
    let activeFile = app.workspace.getActiveFile();
    let projectNumber = null;
    let owner = null;
    let targetFile = activeFile;

    // 1. Resolve Target Note & Frontmatter
    if (activeFile) {
      const cache = app.metadataCache.getFileCache(activeFile);
      if (cache?.frontmatter?.github_project_number) {
        projectNumber = cache.frontmatter.github_project_number;
        owner = cache.frontmatter.github_owner || 'lowqualityloey';
      }
    }

    if (!projectNumber) {
      const defaultPath = '02-Projects/weather-dashboard/Weather Dashboard Kanban.md';
      targetFile = app.vault.getAbstractFileByPath(defaultPath);
      if (targetFile) {
        const cache = app.metadataCache.getFileCache(targetFile);
        projectNumber = cache?.frontmatter?.github_project_number || 2;
        owner = cache?.frontmatter?.github_owner || 'lowqualityloey';
      } else {
        projectNumber = 2;
        owner = 'lowqualityloey';
        targetFile = activeFile;
      }
    }

    if (!targetFile) {
      new Notice('❌ Please open a Kanban note to sync!', 4000);
      return;
    }

    new Notice(`🔄 2-Way Syncing "${targetFile.basename}" with GitHub Project #${projectNumber}...`, 4000);

    // 2. Dynamic Project & Schema Discovery
    let projectId = null;
    try {
      const projViewJson = execSync(`gh project view ${projectNumber} --owner ${owner} --format json`, { encoding: 'utf8', timeout: 10000 });
      const projData = JSON.parse(projViewJson);
      projectId = projData.id;
    } catch (e) {
      if (e.stderr && e.stderr.includes('read:project')) {
        new Notice('⚠️ Missing GitHub token scope!\nRun in terminal: gh auth refresh -s project', 8000);
        return;
      }
      console.warn('Project view warning:', e);
    }

    if (!projectId) {
      new Notice(`❌ Could not resolve GitHub Project #${projectNumber} for user "${owner}".`, 5000);
      return;
    }

    // 3. Dynamic Field Schema Discovery (Status & Priority fields)
    let statusFieldId = null;
    let statusOptionsMap = {}; // name.toLowerCase() -> optionId
    let statusIdToNameMap = {}; // optionId -> name
    let priorityFieldId = null;
    let priorityOptionsMap = {}; // name.toLowerCase() -> optionId
    let priorityIdToNameMap = {}; // optionId -> name

    try {
      const fieldsJson = execSync(`gh project field-list ${projectNumber} --owner ${owner} --format json`, { encoding: 'utf8', timeout: 10000 });
      const fieldsData = JSON.parse(fieldsJson);
      const fields = fieldsData.fields || [];

      for (const field of fields) {
        const nameLower = (field.name || '').toLowerCase();
        if (nameLower === 'status' && field.options) {
          statusFieldId = field.id;
          for (const opt of field.options) {
            statusOptionsMap[opt.name.toLowerCase()] = opt.id;
            statusIdToNameMap[opt.id] = opt.name;
          }
        } else if (nameLower === 'priority' && field.options) {
          priorityFieldId = field.id;
          for (const opt of field.options) {
            priorityOptionsMap[opt.name.toLowerCase()] = opt.id;
            priorityIdToNameMap[opt.id] = opt.name;
          }
        }
      }
    } catch (fieldErr) {
      console.warn('Field discovery warning:', fieldErr);
    }

    // Status mapping helpers
    const statusToSectionMap = {
      'backlog': 'Backlog',
      'ready': 'To Do',
      'to do': 'To Do',
      'in progress': 'In Progress',
      'in-progress': 'In Progress',
      'in review': 'Review / Test',
      'done': 'Done'
    };

    const sectionToStatusMap = {
      'Backlog': 'Backlog',
      'To Do': 'Ready',
      'In Progress': 'In progress',
      'Review / Test': 'In review',
      'Done': 'Done'
    };

    const sectionToCheckboxMap = {
      'Backlog': '- [ ]',
      'To Do': '- [ ]',
      'In Progress': '- [/]',
      'Review / Test': '- [/]',
      'Done': '- [x]'
    };

    const resolveStatusOption = (statusStr) => {
      if (!statusStr) return statusOptionsMap['backlog'] || null;
      const s = statusStr.toLowerCase();
      if (statusOptionsMap[s]) return statusOptionsMap[s];
      if (s === 'ready' && statusOptionsMap['to do']) return statusOptionsMap['to do'];
      if (s === 'to do' && statusOptionsMap['ready']) return statusOptionsMap['ready'];
      if (s === 'in progress' && statusOptionsMap['in-progress']) return statusOptionsMap['in-progress'];
      return statusOptionsMap['backlog'] || null;
    };

    const resolvePriorityOption = (priStr) => {
      if (!priStr) return null;
      const p = priStr.toLowerCase();
      if (priorityOptionsMap[p]) return priorityOptionsMap[p];
      if (p === 'p0' && priorityOptionsMap['critical']) return priorityOptionsMap['critical'];
      if (p === 'p1' && priorityOptionsMap['high']) return priorityOptionsMap['high'];
      if (p === 'p2' && priorityOptionsMap['medium']) return priorityOptionsMap['medium'];
      if (p === 'p3' && priorityOptionsMap['low']) return priorityOptionsMap['low'];
      return null;
    };

    // 4. Fetch GitHub Items (PULL Source)
    let githubItems = [];
    try {
      const ghJson = execSync(`gh project item-list ${projectNumber} --owner ${owner} --format json`, {
        encoding: 'utf8',
        timeout: 10000,
      });
      const parsed = JSON.parse(ghJson);
      githubItems = parsed.items || parsed || [];
    } catch (e) {
      console.warn('Item fetch warning:', e);
    }

    const githubMap = new Map(); // normTitle -> githubItem
    for (const item of githubItems) {
      const rawTitle = (item.title || '').replace(/^\]\s*/, '').trim();
      const normTitle = rawTitle.toLowerCase();

      let itemStatus = item.status || 'Backlog';
      let itemPriority = item.priority || null;

      githubMap.set(normTitle, {
        id: item.id,
        rawTitle,
        status: itemStatus,
        priority: itemPriority
      });
    }

    // 5. Read & Parse Local Obsidian Kanban File
    const content = await app.vault.read(targetFile);
    const lines = content.split('\n');

    const sections = {
      'Backlog': [],
      'To Do': [],
      'In Progress': [],
      'Review / Test': [],
      'Done': [],
      'Archive': []
    };

    let currentSection = 'Backlog';
    let frontmatterLines = [];
    let isFrontmatter = false;
    let frontmatterDone = false;
    let sectionOrder = ['Backlog', 'To Do', 'In Progress', 'Review / Test', 'Done', 'Archive'];

    const localItemsMap = new Map(); // normTitle -> { title, priority, section, checkbox, completionDate }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (i === 0 && trimmed === '---') {
        isFrontmatter = true;
        frontmatterLines.push(line);
        continue;
      }
      if (isFrontmatter) {
        frontmatterLines.push(line);
        if (trimmed === '---') {
          isFrontmatter = false;
          frontmatterDone = true;
        }
        continue;
      }

      if (trimmed.startsWith('## ')) {
        const secName = trimmed.replace('## ', '').trim();
        if (sections[secName] !== undefined) {
          currentSection = secName;
        } else {
          sections[secName] = [];
          sectionOrder.push(secName);
          currentSection = secName;
        }
        continue;
      }

      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [/]') || trimmed.startsWith('- [x]')) {
        const checkbox = trimmed.slice(0, 5);
        let rawTaskText = trimmed.slice(5).trim();

        // Extract priority tag
        let priority = null;
        if (rawTaskText.includes('#priority/p0') || rawTaskText.includes('#p0')) priority = 'P0';
        else if (rawTaskText.includes('#priority/p1') || rawTaskText.includes('#p1')) priority = 'P1';
        else if (rawTaskText.includes('#priority/p2') || rawTaskText.includes('#p2')) priority = 'P2';
        else if (rawTaskText.includes('#priority/p3') || rawTaskText.includes('#p3')) priority = 'P3';

        // Extract completion date if Done
        let completionDate = null;
        const dateMatch = rawTaskText.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          completionDate = dateMatch[1];
        }

        // Clean title
        let cleanTitle = rawTaskText
          .replace(/#priority\/p[0-3]/g, '')
          .replace(/#p[0-3]/g, '')
          .replace(/✅\s*\d{4}-\d{2}-\d{2}/g, '')
          .replace(/`[^`]+`/g, (match) => match.replace(/`/g, ''))
          .trim();
        cleanTitle = cleanTitle.replace(/^\]\s*/, '').trim();

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

    // 6. True 2-Way Bi-Directional Reconciliation
    let pulledCount = 0;
    let pushedCount = 0;
    const nowStr = new Date().toISOString().slice(0, 10);

    const reconciledMap = new Map(); // normTitle -> { title, priority, section, checkbox, completionDate }

    // Phase A: Reconcile GitHub Items (PULL & Update)
    for (const [normTitle, ghItem] of githubMap.entries()) {
      const localItem = localItemsMap.get(normTitle);

      let targetSection = statusToSectionMap[ghItem.status.toLowerCase()] || 'Backlog';
      let targetPriority = ghItem.priority || (localItem ? localItem.priority : 'P2');

      // If local item exists, check if GitHub was updated
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
              execSync(`gh project item-edit --id "${ghItem.id}" --project-id "${projectId}" --field-id "${priorityFieldId}" --single-select-option-id "${priorityOptId}"`, { encoding: 'utf8', timeout: 5000 });
              pushedCount++;
            } catch (err) { console.warn('Priority push err:', err); }
          }
        }
      } else {
        pulledCount++;
      }

      let checkbox = sectionToCheckboxMap[targetSection] || '- [ ]';
      let completionDate = localItem ? localItem.completionDate : null;
      if (targetSection === 'Done' && !completionDate) {
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

    // Phase B: Reconcile Local Obsidian Items NOT on GitHub (PUSH NEW)
    for (const [normTitle, localItem] of localItemsMap.entries()) {
      if (!githubMap.has(normTitle)) {
        try {
          const createCmd = `gh project item-create ${projectNumber} --owner ${owner} --title "${localItem.title.replace(/"/g, '\\"')}" --format json`;
          const createRes = execSync(createCmd, { encoding: 'utf8', timeout: 10000 });
          const newItem = JSON.parse(createRes);

          if (newItem && newItem.id) {
            const ghStatusName = sectionToStatusMap[localItem.section] || 'Backlog';
            const statusOptId = resolveStatusOption(ghStatusName);
            if (statusFieldId && statusOptId) {
              execSync(`gh project item-edit --id "${newItem.id}" --project-id "${projectId}" --field-id "${statusFieldId}" --single-select-option-id "${statusOptId}"`, { encoding: 'utf8', timeout: 5000 });
            }
            if (priorityFieldId && localItem.priority) {
              const priorityOptId = resolvePriorityOption(localItem.priority);
              if (priorityOptId) {
                execSync(`gh project item-edit --id "${newItem.id}" --project-id "${projectId}" --field-id "${priorityFieldId}" --single-select-option-id "${priorityOptId}"`, { encoding: 'utf8', timeout: 5000 });
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

    // 7. Group Reconciled Tasks into Kanban Sections
    for (const item of reconciledMap.values()) {
      const sec = sections[item.section] ? item.section : 'Backlog';
      sections[sec].push(item);
    }

    // 8. Re-build Obsidian Kanban Note Content
    let newContent = '';
    if (frontmatterLines.length > 0) {
      newContent += frontmatterLines.join('\n') + '\n\n';
    }

    for (const secName of sectionOrder) {
      newContent += `## ${secName}\n`;
      const items = sections[secName] || [];
      for (const item of items) {
        let priTag = item.priority ? ` #priority/${item.priority.toLowerCase()}` : '';
        let dateTag = (secName === 'Done' && item.completionDate) ? ` ✅ ${item.completionDate}` : '';
        newContent += `${item.checkbox} ${item.title}${priTag}${dateTag}\n`;
      }
      newContent += '\n';
    }

    // 9. Write Reconciled Content back to Obsidian Note
    await app.vault.modify(targetFile, newContent.trim() + '\n');

    new Notice(`🎉 2-Way Sync Complete! Updated ${pulledCount} from GitHub, Pushed ${pushedCount} to GitHub.`, 7000);

  } catch (error) {
    console.error('GitHub 2-Way Sync Error:', error);
    new Notice(`❌ GitHub Sync Error: ${error.message}`, 7000);
  }
};
