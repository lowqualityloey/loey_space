import {
  DAILY_LOG_HEADING,
  DAILY_LOG_INTRO,
  LOG_AREA_HEADINGS,
  aucklandStamp,
  dailyLogBounds,
  displayLogTime,
  ensureLogArea,
  logAreaBounds,
  normalizeDailyLog,
} from './daily-log-time';

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
  return displayLogTime(aucklandStamp(date).time, '&nbsp;');
}

export function formatDateKey(date: Date): string {
  return aucklandStamp(date).date;
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
  const newline = existingContent.includes('\r\n') ? '\r\n' : '\n';
  const lines = existingContent.split(newline);
  const parent = dailyLogBounds(lines);

  if (!parent) {
    const newSection =
      `${newline}${DAILY_LOG_HEADING}${newline}${DAILY_LOG_INTRO}${newline}- ${newline}${newline}${LOG_AREA_HEADINGS.github}${newline}${newline}${calloutBlock}${newline}`;
    return { updatedContent: existingContent + newSection, count: rows.length };
  }

  // The GitHub table owns its own labelled area inside the daily log. The area is created when the
  // note predates the separation; an existing one is reused, so a second sync never writes a second
  // copy, and the parent's other areas are never disturbed.
  ensureLogArea(lines, 'github');

  // A callout written before the areas existed can sit under the personal or agent area. It is
  // still this writer's content, so it is adopted into the area that owns it rather than left
  // stranded there — and a later sync must never append a second callout beside it.
  const calloutStart = lines.findIndex((line) => /^\s*> \[!NOTE\]-\s*🐙 GitHub Activity Log/.test(line));
  const areaBefore = logAreaBounds(lines, 'github');
  if (!areaBefore) {
    return { updatedContent: existingContent, count: 0 };
  }

  if (calloutStart >= 0) {
    let calloutEnd = calloutStart + 1;
    while (calloutEnd < lines.length && /^\s*>/.test(lines[calloutEnd])) calloutEnd += 1;

    if (calloutStart > areaBefore.start && calloutStart < areaBefore.end) {
      // Already owned: replace it in place so its position and the surrounding prose survive.
      lines.splice(calloutStart, calloutEnd - calloutStart, ...calloutBlock.split(newline));
      return { updatedContent: normalizeDailyLog(lines.join(newline)), count: rows.length };
    }

    lines.splice(calloutStart, calloutEnd - calloutStart);
    // Removing the block can leave two blank lines behind; collapse the seam, never the prose.
    if (lines[calloutStart - 1]?.trim() === '' && lines[calloutStart]?.trim() === '') {
      lines.splice(calloutStart, 1);
    }
  }

  const area = logAreaBounds(lines, 'github');
  if (!area) {
    return { updatedContent: existingContent, count: rows.length };
  }

  let insertIdx = area.start + 1;
  while (insertIdx < area.end && lines[insertIdx].trim() === '') insertIdx++;
  lines.splice(insertIdx, 0, ...calloutBlock.split(newline), '');

  return { updatedContent: normalizeDailyLog(lines.join(newline)), count: rows.length };
}
