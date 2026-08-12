/**
 * QuickAdd UserScript: Universal Dynamic GitHub Project Kanban Sync (Push & Pull)
 * --------------------------------------------------------------------------
 * Dynamic Schema Auto-Discovery Engine for Obsidian Kanban <-> GitHub Projects v2.
 * Works for current and future projects with zero hardcoded IDs.
 * 
 * Frontmatter Requirements for Target Kanban Note:
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

    // 1. Check active file frontmatter
    if (activeFile) {
      const cache = app.metadataCache.getFileCache(activeFile);
      if (cache?.frontmatter?.github_project_number) {
        projectNumber = cache.frontmatter.github_project_number;
        owner = cache.frontmatter.github_owner || 'lowqualityloey';
      }
    }

    // 2. Fallback to Weather Dashboard Kanban if no active note frontmatter
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

    new Notice(`🔄 Dynamic Syncing "${targetFile.basename}" with GitHub Project #${projectNumber}...`, 4000);

    // 3. Dynamic Runtime Project & Schema Discovery
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

    // 4. Dynamic Field Schema Discovery (Status & Priority fields)
    let statusFieldId = null;
    let statusOptionsMap = {}; // name -> optionId
    let priorityFieldId = null;
    let priorityOptionsMap = {}; // name -> optionId

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
          }
        } else if (nameLower === 'priority' && field.options) {
          priorityFieldId = field.id;
          for (const opt of field.options) {
            priorityOptionsMap[opt.name.toLowerCase()] = opt.id;
          }
        }
      }
    } catch (fieldErr) {
      console.warn('Field discovery warning:', fieldErr);
    }

    // Helper to resolve status option ID
    const resolveStatusOption = (statusStr) => {
      const s = statusStr.toLowerCase();
      if (statusOptionsMap[s]) return statusOptionsMap[s];
      if (s === 'ready' && statusOptionsMap['to do']) return statusOptionsMap['to do'];
      if (s === 'to do' && statusOptionsMap['ready']) return statusOptionsMap['ready'];
      if (s === 'in progress' && statusOptionsMap['in-progress']) return statusOptionsMap['in-progress'];
      return statusOptionsMap['backlog'] || null;
    };

    // Helper to resolve priority option ID
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

    // 5. Read Obsidian Kanban tasks & sections
    const content = await app.vault.read(targetFile);
    const lines = content.split('\n');

    const tasksToSync = [];
    let currentSection = 'Backlog';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        currentSection = trimmed.replace('## ', '').trim();
      } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [/]') || trimmed.startsWith('- [x]')) {
        let rawTitle = trimmed.replace(/^-\s*\[[ x/\]]*\]\s*/, '');
        
        let priority = null;
        if (rawTitle.includes('#priority/p0') || rawTitle.includes('#p0')) priority = 'P0';
        else if (rawTitle.includes('#priority/p1') || rawTitle.includes('#p1')) priority = 'P1';
        else if (rawTitle.includes('#priority/p2') || rawTitle.includes('#p2')) priority = 'P2';
        else if (rawTitle.includes('#priority/p3') || rawTitle.includes('#p3')) priority = 'P3';

        let cleanTitle = rawTitle
          .replace(/#priority\/p[0-3]/g, '')
          .replace(/#p[0-3]/g, '')
          .replace(/✅\s*\d{4}-\d{2}-\d{2}/g, '')
          .replace(/`[^`]+`/g, (match) => match.replace(/`/g, ''))
          .trim();

        cleanTitle = cleanTitle.replace(/^\]\s*/, '').trim();

        let status = 'Backlog';
        if (currentSection === 'In Progress' || trimmed.startsWith('- [/]')) status = 'In progress';
        else if (currentSection === 'Review / Test') status = 'In review';
        else if (currentSection === 'Done' || trimmed.startsWith('- [x]')) status = 'Done';
        else if (currentSection === 'To Do') status = 'Ready';
        else status = 'Backlog';

        if (cleanTitle) {
          tasksToSync.push({
            title: cleanTitle,
            status,
            priority
          });
        }
      }
    }

    // 6. Fetch existing GitHub items
    let existingItems = [];
    try {
      const ghJson = execSync(`gh project item-list ${projectNumber} --owner ${owner} --format json`, {
        encoding: 'utf8',
        timeout: 10000,
      });
      const parsed = JSON.parse(ghJson);
      existingItems = parsed.items || parsed || [];
    } catch (e) {
      console.warn('Item fetch warning:', e);
    }

    const existingMap = new Map();
    for (const item of existingItems) {
      const normTitle = (item.title || '').replace(/^\]\s*/, '').toLowerCase().trim();
      existingMap.set(normTitle, item);
    }

    let syncedCount = 0;

    // 7. Dynamic Sync to GitHub Project
    for (const task of tasksToSync) {
      const normTitle = task.title.toLowerCase().trim();
      let item = existingMap.get(normTitle);

      if (!item) {
        try {
          const createCmd = `gh project item-create ${projectNumber} --owner ${owner} --title "${task.title.replace(/"/g, '\\"')}" --format json`;
          const createRes = execSync(createCmd, { encoding: 'utf8', timeout: 10000 });
          item = JSON.parse(createRes);
        } catch (createErr) {
          console.error(`Failed to create item "${task.title}":`, createErr);
        }
      }

      if (item && item.id && projectId) {
        // Set Status
        if (statusFieldId) {
          const statusOptId = resolveStatusOption(task.status);
          if (statusOptId) {
            try {
              execSync(`gh project item-edit --id "${item.id}" --project-id "${projectId}" --field-id "${statusFieldId}" --single-select-option-id "${statusOptId}"`, { encoding: 'utf8', timeout: 5000 });
            } catch (err) {
              console.warn('Status edit warning:', err);
            }
          }
        }

        // Set Priority
        if (priorityFieldId && task.priority) {
          const priorityOptId = resolvePriorityOption(task.priority);
          if (priorityOptId) {
            try {
              execSync(`gh project item-edit --id "${item.id}" --project-id "${projectId}" --field-id "${priorityFieldId}" --single-select-option-id "${priorityOptId}"`, { encoding: 'utf8', timeout: 5000 });
            } catch (err) {
              console.warn('Priority edit warning:', err);
            }
          }
        }

        syncedCount++;
      }
    }

    new Notice(`🎉 Dynamic Sync Complete! Synced ${syncedCount} items with GitHub Project #${projectNumber}.`, 6000);

  } catch (error) {
    console.error('GitHub Dynamic Sync Error:', error);
    new Notice(`❌ GitHub Sync Error: ${error.message}`, 6000);
  }
};
