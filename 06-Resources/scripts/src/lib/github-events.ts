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

export interface FormattedActivityItem {
  id: string;
  timestamp12: string; // e.g. "06:36 PM"
  dateKey: string;     // e.g. "2026-08-31"
  rawDate: Date;
  markdown: string;
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

export function formatGitHubEvent(event: GitHubEventItem): FormattedActivityItem | null {
  const date = new Date(event.created_at);
  const timeStr = formatTime12(date);
  const dateKey = formatDateKey(date);
  const repoName = event.repo.name.split('/')[1] || event.repo.name;

  let text = '';

  if (event.type === 'PushEvent') {
    const branch = (event.payload?.ref || 'main').replace('refs/heads/', '');
    const commits = event.payload?.commits || [];
    if (commits.length > 0) {
      const commitMessages = commits
        .map((c: any) => c.message.split('\n')[0].trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('; ');
      text = `- ${timeStr} 🐙 **Push** (\`${repoName}\` → \`${branch}\`): ${commitMessages}`;
    } else {
      text = `- ${timeStr} 🐙 **Push** (\`${repoName}\` → \`${branch}\`)`;
    }
  } else if (event.type === 'PullRequestEvent') {
    const action = event.payload?.action;
    const pr = event.payload?.pull_request;
    const title = pr?.title || 'Pull Request';
    const number = pr?.number || event.payload?.number;
    if (action === 'closed' && pr?.merged) {
      text = `- ${timeStr} 🔀 **PR Merged** (\`${repoName}\` #${number}): ${title}`;
    } else if (action === 'opened') {
      text = `- ${timeStr} 🔀 **PR Opened** (\`${repoName}\` #${number}): ${title}`;
    } else {
      text = `- ${timeStr} 🔀 **PR ${action}** (\`${repoName}\` #${number}): ${title}`;
    }
  } else if (event.type === 'IssuesEvent') {
    const action = event.payload?.action;
    const issue = event.payload?.issue;
    const title = issue?.title || 'Issue';
    const number = issue?.number;
    text = `- ${timeStr} 🎯 **Issue ${action}** (\`${repoName}\` #${number}): ${title}`;
  } else if (event.type === 'CreateEvent') {
    const refType = event.payload?.ref_type;
    const ref = event.payload?.ref;
    if (refType === 'branch' || refType === 'tag') {
      text = `- ${timeStr} 🌿 **Created ${refType}** \`${ref}\` in \`${repoName}\``;
    } else {
      return null;
    }
  } else if (event.type === 'ReleaseEvent') {
    const releaseName = event.payload?.release?.name || event.payload?.release?.tag_name || 'Release';
    text = `- ${timeStr} 🚀 **Release** \`${releaseName}\` in \`${repoName}\``;
  } else {
    return null;
  }

  return {
    id: event.id,
    timestamp12: timeStr,
    dateKey,
    rawDate: date,
    markdown: text
  };
}

export function mergeDailyLog(existingContent: string, newLogBullets: string[]): { updatedContent: string; addedCount: number } {
  if (!newLogBullets.length) {
    return { updatedContent: existingContent, addedCount: 0 };
  }

  const lines = existingContent.split('\n');
  const sectionIdx = lines.findIndex((l) => l.trim().startsWith('## 📝 Daily Log'));

  if (sectionIdx === -1) {
    const newSection = `\n## 📝 Daily Log\n> _A running timestamp of what happened today._\n\n${newLogBullets.join('\n')}\n`;
    return { updatedContent: existingContent + newSection, addedCount: newLogBullets.length };
  }

  // Find start of log body after ## 📝 Daily Log and blockquotes
  let insertIdx = sectionIdx + 1;
  while (insertIdx < lines.length && (lines[insertIdx].trim().startsWith('>') || lines[insertIdx].trim() === '')) {
    insertIdx++;
  }

  // Find end of Daily Log bullet zone (next heading or divider)
  let logEndIdx = lines.length;
  for (let i = insertIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ') || trimmed === '---') {
      logEndIdx = i;
      break;
    }
  }

  const dailyLogSlice = lines.slice(sectionIdx, logEndIdx).join('\n');
  const bulletsToAdd: string[] = [];

  for (const bullet of newLogBullets) {
    const clean = bullet.replace(/-\s*\d{2}:\d{2}\s*(?:AM|PM)\s*/i, '').trim();
    if (!dailyLogSlice.includes(clean)) {
      bulletsToAdd.push(bullet);
    }
  }

  if (bulletsToAdd.length === 0) {
    return { updatedContent: existingContent, addedCount: 0 };
  }

  // If there is only a blank bullet "- " at insertIdx, replace it
  if (lines[insertIdx]?.trim() === '-') {
    lines.splice(insertIdx, 1, ...bulletsToAdd);
  } else {
    lines.splice(logEndIdx, 0, ...bulletsToAdd);
  }

  return { updatedContent: lines.join('\n'), addedCount: bulletsToAdd.length };
}
