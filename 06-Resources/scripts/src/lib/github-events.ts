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
  time: string;       // e.g. "06:36&nbsp;PM"
  dateKey: string;    // e.g. "2026-08-31"
  repo: string;       // e.g. "`loey_space`"
  type: string;       // e.g. "🐙 Push" or "🔀 PR #4 Merged"
  details: string;    // e.g. "`ts-migration-assessment` → `main`"
  rawDate: Date;
}

export function cleanBranchName(raw: string): string {
  if (!raw) return 'main';
  const branch = raw.replace(/^refs\/heads\//, '').trim();
  // Strip trailing long generated timestamp hashes (e.g. -1650511599458480235)
  return branch.replace(/-\d{10,}$/, '');
}

export function formatTime12(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  return `${hoursStr}:${minutesStr}&nbsp;${ampm}`;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface CommitInfo {
  message: string;
  url?: string;
}

export function escapeTablePipes(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

export async function fetchCommitDetailsMap(
  pushes: Array<{ repo: string; head: string }>,
  execFn?: (cmd: string | string[]) => Promise<{ stdout: string }>
): Promise<Map<string, CommitInfo>> {
  const commitMap = new Map<string, CommitInfo>();
  const uniqueItems = new Map<string, string>(); // head -> repo

  for (const p of pushes) {
    if (p.head && !uniqueItems.has(p.head)) {
      uniqueItems.set(p.head, p.repo);
    }
  }

  if (uniqueItems.size === 0) return commitMap;

  let runner = execFn;
  if (!runner) {
    try {
      const cp = require('child_process');
      const util = require('util');
      const execFileAsync = util.promisify(cp.execFile);
      runner = async (cmd: string | string[]) => {
        if (Array.isArray(cmd)) {
          const [file, ...args] = cmd;
          return execFileAsync(file, args, { encoding: 'utf8' });
        }
        return util.promisify(cp.exec)(cmd, { encoding: 'utf8' });
      };
    } catch {
      return commitMap;
    }
  }

  const tasks = Array.from(uniqueItems.entries()).map(async ([head, repo]) => {
    try {
      const cmd = ['gh', 'api', `repos/${repo}/commits/${head}`, '-q', '{message: .commit.message, url: .html_url}'];
      const { stdout } = await runner!(cmd as any);
      const data = JSON.parse(stdout);
      commitMap.set(head, {
        message: data.message ? data.message.split('\n')[0].trim() : '',
        url: data.url || `https://github.com/${repo}/commit/${head}`
      });
    } catch {
      commitMap.set(head, {
        message: '',
        url: `https://github.com/${repo}/commit/${head}`
      });
    }
  });

  await Promise.all(tasks);
  return commitMap;
}

export function formatGitHubEventToRow(
  event: GitHubEventItem,
  commitMap?: Map<string, CommitInfo>
): ActivityTableRow | null {
  const date = new Date(event.created_at);
  const time = formatTime12(date);
  const dateKey = formatDateKey(date);
  const repoShort = event.repo.name.split('/')[1] || event.repo.name;
  const repo = `\`${repoShort}\``;

  let eventType = '';
  let details = '';

  if (event.type === 'PushEvent') {
    eventType = `🐙 Push`;
    const branch = cleanBranchName(event.payload?.ref || 'main');
    const head = event.payload?.head;
    const commits = event.payload?.commits || [];

    if (commits.length > 0) {
      const commitItems = commits
        .slice(0, 2)
        .map((c: any) => {
          const msg = escapeTablePipes(c.message.split('\n')[0].trim());
          const url = c.url || (c.sha ? `https://github.com/${event.repo.name}/commit/${c.sha}` : (head ? `https://github.com/${event.repo.name}/commit/${head}` : ''));
          return url ? `[${msg}](${url})` : msg;
        })
        .filter(Boolean);
      details = `\`${branch}\`: ${commitItems.join('; ')}`;
    } else if (head) {
      const info = commitMap?.get(head);
      if (info && info.message) {
        const msg = escapeTablePipes(info.message.split('\n')[0].trim());
        const url = info.url || `https://github.com/${event.repo.name}/commit/${head}`;
        details = `\`${branch}\`: [${msg}](${url})`;
      } else {
        const shortHead = head.slice(0, 7);
        const url = `https://github.com/${event.repo.name}/commit/${head}`;
        details = `\`${branch}\`: [\`${shortHead}\`](${url})`;
      }
    } else {
      details = `\`${branch}\``;
    }
  } else if (event.type === 'PullRequestEvent') {
    const action = event.payload?.action;
    const pr = event.payload?.pull_request;
    const number = pr?.number || event.payload?.number;
    const isMerged = action === 'closed' && pr?.merged;
    const url = pr?.html_url || (number ? `https://github.com/${event.repo.name}/pull/${number}` : '');

    if (isMerged) {
      eventType = `🔀 PR #${number} Merged`;
    } else if (action === 'opened') {
      eventType = `🔀 PR #${number} Opened`;
    } else {
      eventType = `🔀 PR #${number} ${action}`;
    }

    const title = pr?.title ? escapeTablePipes(pr.title) : '';
    const headBranch = cleanBranchName(pr?.head?.ref);
    const baseBranch = cleanBranchName(pr?.base?.ref || 'main');

    if (title && title !== 'Pull Request') {
      if (url) {
        if (headBranch && headBranch !== 'main') {
          details = `[${title}](${url}) (\`${headBranch}\` → \`${baseBranch}\`)`;
        } else {
          details = `[${title}](${url})`;
        }
      } else {
        details = title;
      }
    } else if (headBranch && headBranch !== 'main') {
      details = url ? `[\`${headBranch}\` → \`${baseBranch}\`](${url})` : `\`${headBranch}\` → \`${baseBranch}\``;
    } else {
      details = url ? `[\`${baseBranch}\`](${url})` : `\`${baseBranch}\``;
    }
  } else if (event.type === 'IssuesEvent') {
    const action = event.payload?.action;
    const issue = event.payload?.issue;
    const rawTitle = issue?.title || 'Issue';
    const title = escapeTablePipes(rawTitle);
    const number = issue?.number;
    const url = issue?.html_url || (number ? `https://github.com/${event.repo.name}/issues/${number}` : '');
    eventType = `🎯 Issue #${number} ${action}`;
    details = url ? `[${title}](${url})` : title;
  } else if (event.type === 'CreateEvent') {
    const refType = event.payload?.ref_type;
    const ref = cleanBranchName(event.payload?.ref);
    if (refType === 'branch' || refType === 'tag') {
      eventType = `🌿 New ${refType === 'branch' ? 'Branch' : 'Tag'}`;
      details = `\`${ref}\``;
    } else {
      return null;
    }
  } else if (event.type === 'ReleaseEvent') {
    const release = event.payload?.release;
    const releaseName = escapeTablePipes(release?.name || release?.tag_name || 'Release');
    const url = release?.html_url || `https://github.com/${event.repo.name}/releases`;
    eventType = `🚀 Release`;
    details = url ? `[${releaseName}](${url})` : releaseName;
  } else {
    return null;
  }

  return {
    id: event.id,
    time,
    dateKey,
    repo,
    type: eventType,
    details,
    rawDate: date
  };
}

export function buildGitHubCalloutTable(rows: ActivityTableRow[]): string {
  if (rows.length === 0) return '';

  // Sort chronologically (AM to PM: earliest morning to latest evening)
  const sortedRows = [...rows].sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

  const header = `> [!NOTE]- 🐙 GitHub Activity Log (${sortedRows.length} event${sortedRows.length === 1 ? '' : 's'} — click to expand)\n> | Time | Repo | Action | Details / Branch |\n> | :--- | :--- | :--- | :--- |`;
  const tableLines = sortedRows.map((r) => `> | ${r.time} | ${r.repo} | ${r.type} | ${r.details} |`);

  return `${header}\n${tableLines.join('\n')}`;
}

export function mergeDailyLogTable(existingContent: string, rows: ActivityTableRow[]): { updatedContent: string; count: number } {
  if (rows.length === 0) {
    return { updatedContent: existingContent, count: 0 };
  }

  const calloutBlock = buildGitHubCalloutTable(rows);
  const calloutRegex = /> \[!NOTE\]-\s*🐙 GitHub Activity Log[\s\S]*?(?=\r?\n\r?\n|\r?\n#{1,6} |\r?\n---[ \t]*\r?\n|(?![\s\S]))/;

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

  lines.splice(nextSectionIdx, 0, '', calloutBlock, '');
  return { updatedContent: lines.join('\n'), count: rows.length };
}
