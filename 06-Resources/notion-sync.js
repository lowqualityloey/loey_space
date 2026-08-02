const fs = require('fs');
const path = require('path');

const NOTION_TOKEN = 'ntn_i36779894338EYI3dTh92QZEcSC4bTQqOK1DEhAB7Lw4UA';
const VAULT_PATH = path.join(__dirname, '..');

const DATABASES = [
  { id: 'd28ea424-1ad0-4492-a83a-59acb2fadbae', name: 'Inbox', folder: '00-Inbox', type: 'inbox', area: 'general' },
  { id: 'ba03415d-78cb-4d12-be86-c67be44f5fcf', name: 'Daily Notes', folder: '01-Daily', type: 'daily', area: 'general' },
  { id: 'abd7b176-1406-4aa7-9309-5dd51dda97a1', name: 'Projects', folder: '02-Projects', type: 'project', area: 'dev' },
  { id: '66f24548-60e0-4068-8ff7-530793214c9b', name: 'Code Snippets', folder: '03-Dev', type: 'snippet', area: 'dev' },
  { id: 'c1e9feeb-0fd1-41e9-a433-d422924af349', name: 'Learning', folder: '04-Learning', type: 'learning', area: 'learning' },
  { id: '2da30617-12f4-43f3-861b-40ace82555ad', name: 'Resources', folder: '06-Resources', type: 'resource', area: 'dev' }
];

const headers = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
};

function getLocalTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFormattedTime(item) {
  let dateObj = new Date();
  if (item.properties && item.properties.Date && item.properties.Date.date && item.properties.Date.date.start) {
    const dStr = item.properties.Date.date.start;
    if (dStr.includes('T')) dateObj = new Date(dStr);
  } else if (item.created_time) {
    dateObj = new Date(item.created_time);
  }
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  return `${hh}${mm}`;
}

async function sync() {
  console.log('🚀 Syncing Notion → Obsidian (In-Place Note Update Sync)...');

  let updatedCount = 0;
  let createdCount = 0;
  const todayStr = getLocalTodayDate();

  for (const db of DATABASES) {
    const res = await fetch(`https://api.notion.com/v1/databases/${db.id}/query`, { method: 'POST', headers, body: JSON.stringify({ page_size: 50 }) });
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const targetFolder = path.join(VAULT_PATH, db.folder);
      if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

      for (const item of data.results) {
        const rawTitle = extractTitle(item);
        if (!rawTitle) continue;

        let dateVal = null;
        if (db.type === 'daily') {
          dateVal = extractDate(item.properties, 'Date') || extractDateFromTitle(rawTitle) || todayStr;
        }

        // 1. Search if an existing Obsidian note matches notion_id or date
        const existingFilePath = findExistingFile(targetFolder, item.id, dateVal, db.type);
        
        let targetFilePath = existingFilePath;
        let isNewFile = false;

        if (!targetFilePath) {
          isNewFile = true;
          let filename = sanitizeFilename(rawTitle);
          if (db.type === 'daily') {
            const timeStr = getFormattedTime(item);
            filename = `${dateVal} ${timeStr}`;
          }
          targetFilePath = path.join(targetFolder, `${filename}.md`);
        }

        // 2. Fetch page blocks (body content) from Notion
        const blocks = await fetchBlocks(item.id);
        const bodyContent = blocksToMarkdown(blocks);

        const content = db.type === 'daily' 
          ? buildDailyMarkdown(dateVal || todayStr, item, bodyContent) 
          : buildMarkdown(rawTitle, db, item, bodyContent);

        fs.writeFileSync(targetFilePath, content, 'utf8');
        
        if (isNewFile) {
          console.log(`  + [Notion → Obsidian] Created Note: ${path.relative(VAULT_PATH, targetFilePath)}`);
          createdCount++;
        } else {
          console.log(`  ↻ [Notion → Obsidian] Updated Note: ${path.relative(VAULT_PATH, targetFilePath)}`);
          updatedCount++;
        }
      }
    }
  }

  console.log(`\n✅ Notion → Obsidian Sync Complete! Updated ${updatedCount} existing notes, created ${createdCount} new notes.`);
}

function findExistingFile(folderPath, notionId, dateVal, dbType) {
  if (!fs.existsSync(folderPath)) return null;
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md') && !f.startsWith('_'));

  // 1. Search by notion_id match inside frontmatter
  for (const f of files) {
    const fullPath = path.join(folderPath, f);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(`notion_id: ${notionId}`)) {
        return fullPath;
      }
    } catch (e) {}
  }

  // 2. For Daily notes, search by date prefix match (e.g. 2026-08-02)
  if (dbType === 'daily' && dateVal) {
    for (const f of files) {
      if (f.startsWith(dateVal)) {
        return path.join(folderPath, f);
      }
    }
  }

  return null;
}

async function fetchBlocks(blockId) {
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, { headers });
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    return [];
  }
}

function blocksToMarkdown(blocks) {
  if (!blocks || blocks.length === 0) return '';
  const lines = [];

  for (const b of blocks) {
    const type = b.type;
    const info = b[type];
    if (!info) continue;

    const text = extractRichText(info.rich_text);

    if (type === 'heading_1') lines.push(`\n# ${text}`);
    else if (type === 'heading_2') lines.push(`\n## ${text}`);
    else if (type === 'heading_3') lines.push(`\n### ${text}`);
    else if (type === 'paragraph') lines.push(text ? `${text}` : '');
    else if (type === 'quote') lines.push(`> ${text}`);
    else if (type === 'bulleted_list_item') lines.push(`- ${text}`);
    else if (type === 'numbered_list_item') lines.push(`1. ${text}`);
    else if (type === 'to_do') {
      const checkMark = info.checked ? 'x' : ' ';
      lines.push(`- [${checkMark}] ${text}`);
    } else if (type === 'divider') lines.push('\n---');
    else if (type === 'callout') lines.push(`> 💡 ${text}`);
    else if (type === 'code') lines.push(`\`\`\`${info.language || ''}\n${text}\n\`\`\``);
  }

  return lines.join('\n');
}

function extractRichText(richTextArr) {
  if (!richTextArr || richTextArr.length === 0) return '';
  return richTextArr.map(t => {
    if (t.type === 'mention' && t.mention && t.mention.type === 'date') {
      return t.mention.date.start;
    }
    return t.plain_text || (t.text ? t.text.content : '');
  }).join('');
}

function extractDateFromTitle(title) {
  const match = title.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function formatHeadingDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function buildDailyMarkdown(dateStr, item, bodyContent) {
  const props = item.properties;
  const today = getLocalTodayDate();
  const formattedDateHeading = formatHeadingDate(dateStr);

  let mood = extractSelect(props, 'Mood') || 'okay';
  let energy = extractNumber(props, 'Energy') || 3;
  let sleepHours = extractNumber(props, 'Sleep Hours') || 7;
  let status = extractSelect(props, 'Status') || 'active';

  let frontmatter = `---
created: ${dateStr}
updated: ${today}
type: daily
status: ${status}
area: general
notion_id: ${item.id}
tags:
  - type/daily
  - area/general
  - source/notion
mood: ${mood}
energy: ${energy}
sleep_hours: ${sleepHours}
---

`;

  if (bodyContent && bodyContent.trim().length > 0) {
    return frontmatter + bodyContent.trim() + '\n';
  }

  return frontmatter + `# ${formattedDateHeading}

> Mood: calm | good | okay | tired | stressed | low
> Energy: 1–5
> Sleep: hours slept, e.g. 7 or 6.5

## ✨ Motivation
- 

## ↪ Carry Forward
- None

## 🎯 Focus 3
What 3 things would make today feel successful?
- [ ] 
- [ ] 
- [ ] 

## ✅ Tasks
Things I need or want to get done today.
- [ ] 
- [ ] 
- [ ] 

## 🔁 Habits
Daily basics (keep it flexible, not perfect).
- [ ] exercise
- [ ] meditate
- [ ] coding
- [ ] clean
- [ ] hydrate
- [ ] sleep

## 💻 Work / Study / Dev
Progress from today across coding, study, or problem-solving.
- Worked on:
- Learned:
- Challenges:

## 🎮 Leisure / Fun
- 

## 🧠 Notes / Thoughts
- 

## ⚡ Small Wins
- 

## 🤖 AI Daily Summary
- 

## 🌙 Tomorrow Setup
What I want to carry or prepare for tomorrow.
- [ ] 
`;
}

function buildMarkdown(title, db, item, bodyContent) {
  const today = getLocalTodayDate();
  const props = item.properties;

  let status = extractSelect(props, 'Status') || 'in-progress';
  let priority = extractSelect(props, 'Priority') || 'medium';
  let area = extractSelect(props, 'Area') || db.area;
  let reviewCycle = extractSelect(props, 'Review Cycle') || '14d';
  let lastReviewed = extractDate(props, 'Last Reviewed') || today;
  let sourceType = extractSelect(props, 'Source Type') || extractSelect(props, 'Category') || 'article';

  let frontmatter = `---
created: ${today}
updated: ${today}
type: ${db.type}
status: ${status}
area: ${area}
notion_id: ${item.id}
tags:
  - type/${db.type}
  - area/${area}
  - source/notion
`;

  if (db.type === 'project') {
    frontmatter += `priority: ${priority}\nlast_reviewed: ${lastReviewed}\nreview_cycle: ${reviewCycle}\n`;
  } else if (db.type === 'resource') {
    frontmatter += `source_type: ${sourceType}\n`;
  }

  frontmatter += `---\n\n# ${title}\n\n`;

  if (bodyContent && bodyContent.trim().length > 0) {
    frontmatter += bodyContent.trim() + '\n';
  } else {
    frontmatter += `## 📌 Notes\n- Synced from Notion (${db.name})\n`;
  }

  return frontmatter;
}

function extractTitle(item) {
  for (const propVal of Object.values(item.properties)) {
    if (propVal.type === 'title' && propVal.title && propVal.title.length > 0) {
      return propVal.title.map(t => t.plain_text).join('');
    }
  }
  return null;
}

function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim();
}

function extractSelect(props, key) {
  if (props[key] && props[key].select && props[key].select.name) return props[key].select.name;
  if (props[key] && props[key].status && props[key].status.name) return props[key].status.name;
  return null;
}

function extractDate(props, key) {
  if (props[key] && props[key].date && props[key].date.start) return props[key].date.start;
  return null;
}

function extractNumber(props, key) {
  if (props[key] && props[key].number !== undefined && props[key].number !== null) return props[key].number;
  return null;
}

sync();
