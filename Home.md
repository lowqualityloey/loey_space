---
type: dashboard
status: active
area: general
tags:
  - type/dashboard
updated: 2026-08-05
---

# 🏠 Welcome Home

> Your Second Brain Central Hub

---

## ⚡ Quick Navigation

| Folder           | MOC / Hub Link                                          | Purpose                            |
| :--------------- | :------------------------------------------------------ | :--------------------------------- |
| **📥 Inbox**     | [[00-Inbox/_Inbox MOC\|Inbox MOC]]                      | Quick capture & triage             |
| **🚀 Projects**  | [[02-Projects/_Projects MOC\|Projects MOC]]             | Active development & builds        |
| **💻 Dev**       | [[03-Dev/_Dev MOC\|Dev MOC]]                            | Code snippets & technical patterns |
| **📖 Learning**  | [[04-Learning/_Learning MOC\|Learning MOC]]             | Courses & React concepts           |
| **🏋️ Personal** | [[_Personal MOC\|Personal MOC]]                         | Goals, life & gym notes            |
| **📚 Resources** | [[06-Resources/_Resources MOC\|Resources MOC]]          | Reference links & cheatsheets      |
| **🔌 APIs**      | [[06-Resources/APIs/_APIs MOC\|APIs MOC]]               | API specs & integration docs       |
| **📊 Reviews**   | [[07-Reviews/_Reviews MOC\|Reviews MOC]]                | Weekly & monthly reviews           |
| **💡 Concepts**  | [[08-Concepts/_Concepts MOC\|Concepts MOC]]             | Evergreen concept hubs             |
| **🧠 Guide**     | [[06-Resources/Second Brain Guide\|Workflow Guide]]     | System usage & daily routine       |
| **🛡️ Security** | [[06-Resources/Vault Security Policy\|Security Policy]] | Secrets handling & Git safety      |

---

## ✅ Next Actions (Across Projects, Dev & Learning)

```dataview
TASK
FROM "02-Projects" OR "03-Dev" OR "04-Learning"
WHERE !completed
AND text != ""
AND !contains(file.name, "Kanban")
AND !contains(file.name, "MOC")
SORT file.mtime DESC
LIMIT 10
```

---

## 🚀 Active Projects

```dataview
TABLE WITHOUT ID
file.link AS "Project",
status AS "Status",
priority AS "Priority",
file.tags AS "Tags"
FROM "02-Projects"
WHERE !contains(file.name, "Kanban") AND !contains(file.name, "MOC")
SORT file.mtime DESC
LIMIT 10
```

---

## 📥 Unprocessed Inbox Notes

```dataviewjs
const pages = dv.pages('"00-Inbox"').where(p => p.file.name !== "_Inbox MOC" && !p.file.name.includes("quick-capture-dump"));
if (pages.length > 0) {
  dv.table(["Note", "Captured Date"], pages.map(p => [p.file.link, p.file.ctime]));
} else {
  dv.paragraph("🎉 Inbox is completely clear!");
}
```

---

## 📖 Current Learning Focus

```dataview
TABLE topic AS "Topic", source_url AS "Resource Link"
FROM "04-Learning"
WHERE file.name != "_Learning MOC"
SORT file.mtime DESC
LIMIT 5
```

---

## 💡 Recent Evergreen Concepts

```dataview
TABLE summary AS "Summary", updated AS "Updated"
FROM "08-Concepts"
WHERE file.name != "_Concepts MOC"
SORT file.mtime DESC
LIMIT 5
```

---

## 📅 Recent Daily Logs

```dataview
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)"
FROM "01-Daily"
WHERE file.name != "_Daily MOC"
SORT file.name DESC
LIMIT 7
```

---

## 🔗 Unlinked / Orphan Notes

```dataview
TABLE file.folder AS "Folder", file.ctime AS "Created"
FROM ""
WHERE length(file.inlinks) = 0
AND file.path != "Home.md"
AND !contains(file.path, "99-Templates/")
AND !contains(file.name, "MOC")
SORT file.ctime DESC
LIMIT 5
```

---

## 🔒 Security & Git Health

```dataviewjs
// Git status check - shows if secrets are tracked
const shell = require('child_process');
try {
  const status = shell.execSync('git status --porcelain', { encoding: 'utf8', maxBuffer: 1024*1024 });
  const lines = status.split('\n').filter(l => l.trim());
  
  // Check for potentially tracked secrets
  const secretPatterns = ['.env', '.secrets/', '00-Private/', '_secret', '_private'];
  const secretFiles = lines.filter(l => 
    secretPatterns.some(p => l.includes(p)) && (l.startsWith('A ') || l.startsWith(' M'))
  );
  
  if (secretFiles.length > 0) {
    dv.paragraph('❌ **WARNING**: Secrets detected in tracked files!');
    dv.paragraph('Review: ' + secretFiles.map(l => l.substring(3)).join(', '));
  } else {
    dv.paragraph('✅ **Git Health**: No secrets in tracked files');
  }
  
  // Show recent commits
  const commits = shell.execSync('git log --oneline -5', { encoding: 'utf8', maxBuffer: 1024*1024 });
  dv.paragraph('Last commit: ' + (commits.split('\n')[0] || 'No commits yet'));
  
} catch (err) {
  dv.paragraph('Git status unavailable');
}
```

---

## 🛠️ Vault Health & Status

### Vault Health
```dataviewjs
// Orphan notes check
const pages = dv.pages('');
const linkedPages = new Set();
pages.forEach(p => {
  if (p.file && p.file.outlinks) {
    p.file.outlinks.forEach(link => {
      if (link.path) linkedPages.add(link.path);
    });
  }
});

const allFiles = dv.pages('').where(p => !p.file.name.startsWith('_') && !p.file.name.endsWith('MOC'));
const orphanCount = allFiles.filter(p => !linkedPages.has(p.file.path)).length;

// Missing backlinks (files with outlinks but no inlinks)
const brokenLinks = allFiles.filter(p => p.file.outlinks && p.file.outlinks.length > 0 && p.file.inlinks.length === 0).length;

dv.paragraph(`📄 **Total Notes**: ${allFiles.length}`);
dv.paragraph(`🔗 **Broken Links**: ${brokenLinks} (files with outgoing links but no incoming)`);
dv.paragraph(`🔗 **Orphan Notes**: ${orphanCount} (unlinked notes)`);
```

### Notion Sync Status
```dataviewjs
// Check Notion sync status
const fs = require('fs');
const path = require('path');

try {
  const logFile = path.join(__dirname, '06-Resources', 'sync-daemon.log');
  if (fs.existsSync(logFile)) {
    const log = fs.readFileSync(logFile, 'utf8');
    const lines = log.split('\n').filter(l => l.trim());
    const lastSync = lines.slice(-5).join('\n');
    dv.paragraph(`📅 **Last Notion Sync**: \n` + lastSync);
  } else {
    dv.paragraph('📅 **Last Notion Sync**: Not yet run');
  }
  
  // Check for pending daily notes in Notion
  const envContent = fs.readFileSync('.env', 'utf8');
  const hasKey = envContent.includes('NOTION_API_KEY=secret_');
  if (hasKey) {
    dv.paragraph('✅ Notion sync configured');
  } else {
    dv.paragraph('⚠️ Notion sync: Missing API key in .env');
  }
} catch (err) {
  dv.paragraph('Notion sync status: Unavailable');
}
```

---

## 🏷️ Standardized Vault Tag Taxonomy

> **Complete metadata taxonomy for effective organization** | [[Tagging & Properties|Full Documentation]]

| Tag Namespace  | Purpose                 | Standard Examples & Usage                                                                                                                                                                                              |
| :------------- | :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`type/*`**   | Note schema & blueprint | `type/project` (dev initiatives), `type/learning` (course notes), `type/snippet` (code patterns), `type/resource` (external references), `type/concept` (evergreen ideas), `type/review` (retrospectives), `type/daily` (journal), `type/moc` (hubs), `type/guide` (how-tos), `type/personal` (life mgmt), `type/template` (file templates) |
| **`area/*`**   | Knowledge domain        | `area/general` (cross-cutting), `area/dev` (development), `area/learning` (education), `area/personal` (life), `area/resources` (references), `area/reviews` (reflection), `area/security` (safety), `area/system` (vault setup), `area/automation` (workflows), `area/ai` (AI tools) |
| **`topic/*`**  | Subject / Tech stack    | `topic/react`, `topic/typescript`, `topic/tailwind`, `topic/api`, `topic/git`, `topic/obsidian`, `topic/ai`, `topic/fitness`, `topic/productivity`, `topic/security`, `topic/automation`, `topic/dataview`, `topic/notion`, `topic/javascript`, `topic/python` |
| **`status/*`** | Lifecycle state         | `status/planning` (initial), `status/in-progress` (active work), `status/completed` (done), `status/active` (evergreen), `status/archived` (historical), `status/blocked` (waiting), `status/idea` (concept), `status/review-needed` (needs review) |
| **`priority/*`** | Urgency level        | `priority/low` (nice-to-have), `priority/medium` (regular), `priority/high` (important), `priority/critical` (urgent)                                                                                                    |

### 📋 Standard Properties (YAML Frontmatter)

**Universal Properties (All Notes):**
- `created`: Auto-generated creation date (YYYY-MM-DD)
- `updated`: Auto-updated on save (YYYY-MM-DD)  
- `type`: Primary classification (see `type/*` taxonomy)
- `area`: Knowledge domain (see `area/*` taxonomy)
- `status`: Lifecycle state (see `status/*` taxonomy)
- `tags`: Tag collection following above taxonomies

**Optional Properties (Type-Specific):**
- `priority`: low/medium/high (projects, tasks)
- `last_reviewed`: Review date (evergreen notes)
- `review_cycle`: Review frequency (7d/14d/30d/90d)
- `language`: Code language (snippets)
- `energy`: 1-5 scale (daily notes)
- `mood`: calm/good/okay/tired/etc (daily notes)
- `sleep_hours`: Hours slept (daily notes)

### 🔍 Quick Reference Queries

**Find active projects:**
```dataview
TABLE priority, status, file.mtime AS "Last Modified"
FROM "02-Projects"
WHERE type = "project" AND status = "in-progress"
SORT priority DESC, file.mtime DESC
```

**Find learning resources by topic:**  
```dataview
TABLE topic, status, file.ctime AS "Created"
FROM "04-Learning"
WHERE contains(tags, "topic/react") AND type = "learning"
SORT file.ctime DESC
```

**Find code snippets by language:**
```dataview
TABLE language, file.link AS "Snippet", file.mtime AS "Updated"
FROM "03-Dev"
WHERE type = "snippet" AND language = "typescript"
SORT file.mtime DESC
```

**Find notes needing review:**
```dataview
TABLE type, area, last_reviewed, review_cycle AS "Cycle"
FROM ""
WHERE (type = "concept" OR type = "learning")
AND date(today) - date(last_reviewed) > dur(review_cycle)
SORT last_reviewed ASC
```

