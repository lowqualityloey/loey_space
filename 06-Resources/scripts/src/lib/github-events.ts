export interface GitHubEventItem {
  id: string;
  type: string;
  repo: {
    name: string;
    url?: string;
  };
  payload: any;
  created_at: string;
}

export interface ActivityTableRow {
  id: string;
  time: string;       // e.g. "06:36 PM"
  dateKey: string;    // e.g. "2026-08-31"
  repo: string;       // e.g. "`loey_space`"
  type: string;       // e.g. "🐙 Push (`main`)"
  details: string;    // e.g. "feat(distill): add concept distiller"
  rawDate: Date;
}

export function formatTime12(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function escapeTablePipes(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

export function formatGitHubEventToRow(event: GitHubEventItem): ActivityTableRow | null {
  const date = new Date(event.created_at);
  const time = formatTime12(date);
  const dateKey = formatDateKey(date);
  const repoShort = event.repo.name.split('/')[1] || event.repo.name;
  const repo = `\`${repoShort}\``;

  let eventType = '';
  let details = '';

  if (event.type === 'PushEvent') {
    const branch = (event.payload?.ref || 'main').replace('refs/heads/', '');
    eventType = `🐙 Push (\`${branch}\`)`;
    const commits = event.payload?.commits || [];
    if (commits.length > 0) {
      details = commits
        .map((c: any) => c.message.split('\n')[0].trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('; ');
    } else {
      details = `Pushed commits to ${branch}`;
    }
  } else if (event.type === 'PullRequestEvent') {
    const action = event.payload?.action;
    const pr = event.payload?.pull_request;
    const title = pr?.title || 'Pull Request';
    const number = pr?.number || event.payload?.number;
    if (action === 'closed' && pr?.merged) {
      eventType = `🔀 PR #${number} Merged`;
    } else if (action === 'opened') {
      eventType = `🔀 PR #${number} Opened`;
    } else {
      eventType = `🔀 PR #${number} ${action}`;
    }
    details = title;
  } else if (event.type === 'IssuesEvent') {
    const action = event.payload?.action;
    const issue = event.payload?.issue;
    const title = issue?.title || 'Issue';
    const number = issue?.number;
    eventType = `🎯 Issue #${number} ${action}`;
    details = title;
  } else if (event.type === 'CreateEvent') {
    const refType = event.payload?.ref_type;
    const ref = event.payload?.ref;
    if (refType === 'branch' || refType === 'tag') {
      eventType = `🌿 Created ${refType}`;
      details = `\`${ref}\``;
    } else {
      return null;
    }
  } else if (event.type === 'ReleaseEvent') {
    const releaseName = event.payload?.release?.name || event.payload?.release?.tag_name || 'Release';
    eventType = `🚀 Release`;
    details = releaseName;
  } else {
    return null;
  }

  return {
    id: event.id,
    time,
    dateKey,
    repo,
    type: eventType,
    details: escapeTablePipes(details),
    rawDate: date
  };
}

export function buildGitHubCalloutTable(rows: ActivityTableRow[]): string {
  if (rows.length === 0) return '';

  const header = `> [!NOTE]- 🐙 GitHub Activity Log (${rows.length} event${rows.length === 1 ? '' : 's'} — click to expand)\n> | Time | Repo | Type | Message / Details |\n> | :--- | :--- | :--- | :--- |`;
  const tableLines = rows.map((r) => `> | ${r.time} | ${r.repo} | ${r.type} | ${r.details} |`);

  return `${header}\n${tableLines.join('\n')}`;
}

export function mergeDailyLogTable(existingContent: string, rows: ActivityTableRow[]): { updatedContent: string; count: number } {
  if (rows.length === 0) {
    return { updatedContent: existingContent, count: 0 };
  }

  const calloutBlock = buildGitHubCalloutTable(rows);
  const calloutRegex = /> \[!NOTE\]-\s*🐙 GitHub Activity Log[\s\S]*?(?=\r?\n\r?\n|\r?\n#{1,6} |\r?\n---[ \t]*\r?\n|(?![\s\S]))/;

  // If a previous GitHub callout table already exists in the file, replace it
  if (calloutRegex.test(existingContent)) {
    return {
      updatedContent: existingContent.replace(calloutRegex, calloutBlock),
      count: rows.length
    };
  }

  const lines = existingContent.split('\n');
  const sectionIdx = lines.findIndex((l) => l.trim().startsWith('## 📝 Daily Log'));

  if (sectionIdx === -1) {
    const newSection = `\n## 📝 Daily Log\n> _A running timestamp of what happened today._\n- \n\n${calloutBlock}\n`;
    return { updatedContent: existingContent + newSection, count: rows.length };
  }

  // Find where to insert callout (before next section like ### 💡 Ideas or ## 🌇 End of the Day)
  let insertIdx = sectionIdx + 1;
  while (insertIdx < lines.length && (lines[insertIdx].trim().startsWith('>') || lines[insertIdx].trim() === '')) {
    insertIdx++;
  }

  let nextSectionIdx = lines.length;
  for (let i = insertIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ') || trimmed === '---') {
      nextSectionIdx = i;
      break;
    }
  }

  // Insert callout with clean spacing before the next section
  lines.splice(nextSectionIdx, 0, '', calloutBlock, '');
  return { updatedContent: lines.join('\n'), count: rows.length };
}
