export interface ProjectFieldOption {
  id: string;
  name: string;
}

export interface ProjectField {
  id: string;
  name: string;
  options?: ProjectFieldOption[];
}

export interface GitHubProjectItem {
  id: string;
  title?: string;
  contentTitle?: string;
  number?: number;
  url?: string;
  status?: string;
  priority?: string | null;
}

export interface LocalTaskItem {
  title: string;
  priority: string | null;
  section: string;
  checkbox: string;
  completionDate: string | null;
}

export interface BoardSyncConfig {
  filePath: string;
  title: string;
  projectNumber: number;
  owner: string;
  repo?: string;
}

export function normalizeLaneName(rawName: string): string {
  const clean = rawName
    .replace(/^#+\s*/, '')
    .replace(/^[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔📦🔄📋🎯💡💻🚀✨⚠️]\s*/, '')
    .trim()
    .toLowerCase();

  if (clean.includes('backlog') || clean.includes('icebox')) return 'backlog';
  if (clean.includes('to do') || clean.includes('todo') || clean.includes('to-do') || clean.includes('ready')) return 'to do';
  if (clean.includes('in progress') || clean.includes('doing') || clean.includes('in-progress')) return 'in progress';
  if (clean.includes('review') || clean.includes('test') || clean.includes('qa')) return 'review / test';
  if (clean.includes('done') || clean.includes('completed') || clean.includes('archive')) return 'done';

  return clean;
}

export function parsePriorityTag(text: string): { cleanText: string; priority: string | null } {
  const match = text.match(/#priority\/(p[0-3]|high|medium|low)/i);
  if (!match) {
    return { cleanText: text.trim(), priority: null };
  }

  const rawPriority = match[1].toLowerCase();
  let normalized = 'P2';
  if (rawPriority === 'p0' || rawPriority === 'high') normalized = 'P0';
  else if (rawPriority === 'p1') normalized = 'P1';
  else if (rawPriority === 'p2' || rawPriority === 'medium') normalized = 'P2';
  else if (rawPriority === 'p3' || rawPriority === 'low') normalized = 'P3';

  const cleanText = text.replace(/#priority\/(?:p[0-3]|high|medium|low)/gi, '').replace(/\s{2,}/g, ' ').trim();
  return { cleanText, priority: normalized };
}

export function extractLocalKanbanTasks(content: string): { tasks: LocalTaskItem[]; sections: string[] } {
  const lines = content.split('\n');
  const tasks: LocalTaskItem[] = [];
  const sections: string[] = [];

  let currentSection = '';
  let inFrontmatter = false;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') inFrontmatter = false;
      continue;
    }

    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (trimmed.startsWith('## ')) {
      currentSection = trimmed;
      if (!sections.includes(trimmed)) {
        sections.push(trimmed);
      }
      continue;
    }

    const taskMatch = line.match(/^-\s*\[([ xX/>\-?*!])\]\s+(.*)$/);
    if (taskMatch && currentSection) {
      const checkbox = taskMatch[1];
      const rawText = taskMatch[2].trim();

      const dateMatch = rawText.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
      const completionDate = dateMatch ? dateMatch[1] : null;

      const { cleanText, priority } = parsePriorityTag(rawText.replace(/✅\s*\d{4}-\d{2}-\d{2}/, '').trim());

      tasks.push({
        title: cleanText,
        priority,
        section: currentSection,
        checkbox,
        completionDate
      });
    }
  }

  return { tasks, sections };
}

export function createBranchSlug(issueNumber: number, title: string, prefix = 'feat'): string {
  const clean = title
    .toLowerCase()
    .replace(/#priority\/[^\s]+/gi, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 35)
    .replace(/^-|-$/g, '');

  return `${prefix}/issue-${issueNumber}-${clean || 'task'}`;
}

export function formatCardWithIssue(
  issueNumber: number,
  issueUrl: string,
  title: string,
  priority?: string | null
): string {
  const prioritySuffix = priority ? ` #priority/${priority.toLowerCase()}` : '';
  const cleanTitle = title.replace(/#priority\/[^\s]+/gi, '').trim();
  return `- [/] [#${issueNumber}](${issueUrl}) ${cleanTitle}${prioritySuffix}`;
}

export function moveCardToInProgress(
  content: string,
  targetTaskTitle: string,
  updatedCardText: string
): string {
  const lines = content.split('\n');
  const cleanTarget = targetTaskTitle.toLowerCase().trim();

  let removedLine = false;
  const filteredLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const taskMatch = line.match(/^-\s*\[[ xX/>\-?*!]\]\s+(.*)$/);
    if (taskMatch && !removedLine) {
      const lineClean = taskMatch[1].toLowerCase().trim();
      if (lineClean.includes(cleanTarget) || cleanTarget.includes(lineClean)) {
        removedLine = true;
        while (i + 1 < lines.length && (/^\s{2,}|\t/.test(lines[i + 1]) || /^\s*>\s/.test(lines[i + 1]))) {
          i++;
        }
        continue;
      }
    }
    filteredLines.push(line);
  }

  let inProgressIdx = -1;
  for (let i = 0; i < filteredLines.length; i++) {
    if (normalizeLaneName(filteredLines[i]) === 'in progress') {
      inProgressIdx = i;
      break;
    }
  }

  if (inProgressIdx !== -1) {
    filteredLines.splice(inProgressIdx + 1, 0, '', updatedCardText);
    return filteredLines.join('\n');
  }

  return filteredLines.join('\n') + `\n\n## In Progress\n\n${updatedCardText}\n`;
}

export interface GitHubIssueInfo {
  number: number;
  title: string;
  url: string;
  state?: string;
  body?: string;
}

export interface RemoteSubtask {
  checked: boolean;
  rawText: string;
  cleanText: string;
}

function normalizeSubtaskText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`_*~]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSubtasksFromIssueBody(body: string): RemoteSubtask[] {
  const subtasks: RemoteSubtask[] = [];
  if (!body) return subtasks;

  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*[-*]\s*\[([ xX])\]\s+(.+)$/);
    if (match) {
      const checked = match[1].toLowerCase() === 'x';
      const rawText = match[2].trim();
      const cleanText = normalizeSubtaskText(rawText);
      if (cleanText) {
        subtasks.push({ checked, rawText, cleanText });
      }
    }
  }
  return subtasks;
}

export function syncBoardSubtasksWithGitHubIssues(
  content: string,
  issues: GitHubIssueInfo[]
): { updatedContent: string; updatedCount: number } {
  const lines = content.split('\n');
  let updatedCount = 0;
  let inFrontmatter = false;
  let inFence = false;

  const issueByNumber = new Map<number, { issue: GitHubIssueInfo; subtasks: RemoteSubtask[] }>();
  const issueByTitle = new Map<string, { issue: GitHubIssueInfo; subtasks: RemoteSubtask[] }>();

  for (const issue of issues) {
    const subtasks = extractSubtasksFromIssueBody(issue.body || '');
    const entry = { issue, subtasks };
    issueByNumber.set(issue.number, entry);

    const cleanTitle = normalizeSubtaskText(issue.title);
    if (cleanTitle) {
      issueByTitle.set(cleanTitle, entry);
    }
  }

  const newLines: string[] = [];
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      newLines.push(line);
      continue;
    }
    if (inFrontmatter) {
      newLines.push(line);
      if (trimmed === '---') inFrontmatter = false;
      continue;
    }

    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      newLines.push(line);
      continue;
    }
    if (inFence) {
      newLines.push(line);
      continue;
    }

    if (trimmed.startsWith('## ')) {
      currentSection = trimmed;
      newLines.push(line);
      continue;
    }

    const topCardMatch = line.match(/^([ \t]*-\s*\[)([ xX/>\-?*!])(\]\s+)(.*)$/);
    const isIndented = /^[ \t]{2,}|\t/.test(line);

    if (topCardMatch && !isIndented) {
      newLines.push(line);
      const cardCheckbox = topCardMatch[2];
      const cardBody = topCardMatch[4];

      let cardEntry: { issue: GitHubIssueInfo; subtasks: RemoteSubtask[] } | null = null;
      const issueNumMatch = cardBody.match(/\[#(\d+)\]|#(\d+)/);
      if (issueNumMatch) {
        const num = Number(issueNumMatch[1] || issueNumMatch[2]);
        if (issueByNumber.has(num)) {
          cardEntry = issueByNumber.get(num)!;
        }
      }

      if (!cardEntry) {
        const cleanCardTitle = normalizeSubtaskText(
          cardBody.replace(/#priority\/[^\s]+/gi, '').replace(/✅\s*\d{4}-\d{2}-\d{2}/, '')
        );
        if (issueByTitle.has(cleanCardTitle)) {
          cardEntry = issueByTitle.get(cleanCardTitle)!;
        }
      }

      const childLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && (/^[ \t]{2,}|\t/.test(lines[j]) || /^\s*>\s/.test(lines[j]))) {
        childLines.push(lines[j]);
        j++;
      }

      if (cardEntry && cardEntry.subtasks.length > 0) {
        const existingSubtaskIndices = childLines
          .map((cl, idx) => ({ cl, idx }))
          .filter((item) => /^\s*-\s*\[[ xX]\]/.test(item.cl));

        if (existingSubtaskIndices.length === 0 && (cardCheckbox === '/' || normalizeLaneName(currentSection) === 'in progress')) {
          const hasBranch = childLines.some((cl) => /^\s*>\s*🌿/.test(cl));
          if (!hasBranch) {
            const cleanTitle = cardBody.replace(/\[#\d+\]\([^)]+\)/g, '').replace(/#\d+/g, '').trim();
            childLines.push(`\t  > 🌿 \`${createBranchSlug(cardEntry.issue.number, cleanTitle)}\``);
          }
          for (const sub of cardEntry.subtasks) {
            childLines.push(`\t  - [${sub.checked ? 'x' : ' '}] ${sub.rawText}`);
          }
          updatedCount++;
        } else if (existingSubtaskIndices.length > 0) {
          for (let k = 0; k < childLines.length; k++) {
            const cl = childLines[k];
            const subtaskMatch = cl.match(/^(\s*-\s*\[)([ xX])(\]\s+)(.*)$/);
            if (subtaskMatch) {
              const prefix = subtaskMatch[1];
              const currentCheck = subtaskMatch[2];
              const suffix = subtaskMatch[3];
              const subtaskBody = subtaskMatch[4];
              const cleanLocalText = normalizeSubtaskText(subtaskBody);

              const matchedRemote = cardEntry.subtasks.find((rem) => {
                if (rem.cleanText === cleanLocalText) return true;
                if (rem.cleanText.length > 10 && cleanLocalText.length > 10) {
                  return rem.cleanText.includes(cleanLocalText) || cleanLocalText.includes(rem.cleanText);
                }
                return false;
              });

              if (matchedRemote) {
                const targetCheck = matchedRemote.checked ? 'x' : ' ';
                if (currentCheck !== targetCheck) {
                  childLines[k] = `${prefix}${targetCheck}${suffix}${subtaskBody}`;
                  updatedCount++;
                }
              }
            }
          }
        }
      }

      newLines.push(...childLines);
      i = j - 1;
      continue;
    }

    newLines.push(line);
  }

  return { updatedContent: newLines.join('\n'), updatedCount };
}

export function injectIssueBadgesIntoBoard(
  content: string,
  issues: GitHubIssueInfo[]
): { updatedContent: string; injectedCount: number } {
  const lines = content.split('\n');
  let injectedCount = 0;
  let inFrontmatter = false;
  let inFence = false;

  const issueMap = new Map<string, GitHubIssueInfo>();
  for (const issue of issues) {
    const clean = issue.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (clean) {
      issueMap.set(clean, issue);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') inFrontmatter = false;
      continue;
    }

    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const taskMatch = line.match(/^(\s*-\s*\[[ xX/>\-?*!]\]\s+)(.*)$/);
    if (!taskMatch) continue;

    const prefix = taskMatch[1];
    const body = taskMatch[2];

    if (/\[#\d+\]\([^)]+\)/.test(body) || /#\d+/.test(body)) continue;

    const cleanBody = body
      .replace(/#priority\/[^\s]+/gi, '')
      .replace(/✅\s*\d{4}-\d{2}-\d{2}/, '')
      .replace(/\[\[[^\]]+\]\]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim()
      .toLowerCase();

    if (!cleanBody) continue;

    const matchedIssue = issueMap.get(cleanBody) || Array.from(issueMap.values()).find((iss) => {
      const issClean = iss.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
      return issClean.length > 5 && (cleanBody.includes(issClean) || issClean.includes(cleanBody));
    });

    if (matchedIssue) {
      const newBody = `[#${matchedIssue.number}](${matchedIssue.url}) ${body.trim()}`;
      lines[i] = `${prefix}${newBody}`;
      injectedCount++;
    }
  }

  return { updatedContent: lines.join('\n'), injectedCount };
}

export interface KanbanCardBlock {
  headerLine: string;
  checkbox: string;
  rawTitle: string;
  cleanTitle: string;
  issueNumber: number | null;
  issueUrl: string | null;
  priority: string | null;
  completionDate: string | null;
  childrenLines: string[];
}

export interface ParsedKanbanLane {
  headingLine: string;
  normalizedName: string;
  cards: KanbanCardBlock[];
}

export function syncBoardLanesWithRemoteItems(
  content: string,
  remoteItems: GitHubProjectItem[],
  repoIssues: GitHubIssueInfo[],
  todayDate = new Date().toISOString().slice(0, 10)
): { updatedContent: string; movedCount: number } {
  let inFrontmatter = false;
  const frontmatterLines: string[] = [];
  const bodyLines: string[] = [];
  const settingsLines: string[] = [];
  let inSettings = false;

  const rawLines = content.split(/\r?\n/);

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      frontmatterLines.push(line);
      continue;
    }
    if (inFrontmatter) {
      frontmatterLines.push(line);
      if (trimmed === '---') {
        inFrontmatter = false;
      }
      continue;
    }

    if (trimmed.startsWith('%% kanban:settings')) {
      inSettings = true;
    }

    if (inSettings) {
      settingsLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }

  const lanes: ParsedKanbanLane[] = [];
  let currentLane: ParsedKanbanLane | null = null;
  let currentCard: KanbanCardBlock | null = null;
  const preambleLines: string[] = [];

  for (const line of bodyLines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      if (currentCard && currentLane) {
        currentLane.cards.push(currentCard);
        currentCard = null;
      }
      const normalizedName = normalizeLaneName(trimmed);
      currentLane = {
        headingLine: line,
        normalizedName,
        cards: []
      };
      lanes.push(currentLane);
      continue;
    }

    if (!currentLane) {
      preambleLines.push(line);
      continue;
    }

    const taskMatch = line.match(/^([ \t]*-\s*\[)([ xX/>\-?*!])(\]\s+)(.*)$/);
    const isIndented = /^[ \t]{2,}|\t/.test(line);

    if (taskMatch && !isIndented) {
      if (currentCard) {
        currentLane.cards.push(currentCard);
      }

      const checkbox = taskMatch[2];
      const rawTitle = taskMatch[4];

      const issueNumMatch = rawTitle.match(/\[#(\d+)\]|#(\d+)/);
      const issueNumber = issueNumMatch ? Number(issueNumMatch[1] || issueNumMatch[2]) : null;

      const urlMatch = rawTitle.match(/\((https?:\/\/[^\s)]+)\)/);
      const issueUrl = urlMatch ? urlMatch[1] : null;

      const dateMatch = rawTitle.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
      const completionDate = dateMatch ? dateMatch[1] : null;

      const { cleanText, priority } = parsePriorityTag(rawTitle.replace(/✅\s*\d{4}-\d{2}-\d{2}/, '').trim());

      currentCard = {
        headerLine: line,
        checkbox,
        rawTitle,
        cleanTitle: cleanText.replace(/\[#\d+\]\([^)]+\)/g, '').replace(/#\d+/g, '').trim(),
        issueNumber,
        issueUrl,
        priority,
        completionDate,
        childrenLines: []
      };
      continue;
    }

    if (currentCard && (isIndented || /^\s*>\s/.test(line))) {
      currentCard.childrenLines.push(line);
      continue;
    }
  }

  if (currentCard && currentLane) {
    currentLane.cards.push(currentCard);
    currentCard = null;
  }

  const remoteByNumber = new Map<number, GitHubProjectItem>();
  const remoteByTitle = new Map<string, GitHubProjectItem>();

  for (const item of remoteItems) {
    if (item.number) {
      remoteByNumber.set(item.number, item);
    }
    const cleanTitle = normalizeSubtaskText(item.title || '');
    if (cleanTitle) remoteByTitle.set(cleanTitle, item);
    const cleanContentTitle = normalizeSubtaskText(item.contentTitle || '');
    if (cleanContentTitle) remoteByTitle.set(cleanContentTitle, item);
  }

  const issuesByNumber = new Map<number, GitHubIssueInfo>();
  for (const iss of repoIssues) {
    issuesByNumber.set(iss.number, iss);
  }

  let movedCount = 0;

  for (const lane of lanes) {
    const remainingCards: KanbanCardBlock[] = [];

    for (const card of lane.cards) {
      let targetStatus: string | null = null;

      if (card.issueNumber && remoteByNumber.has(card.issueNumber)) {
        const item = remoteByNumber.get(card.issueNumber)!;
        if (item.status) targetStatus = item.status;
      } else {
        const cleanCard = normalizeSubtaskText(card.cleanTitle);
        if (remoteByTitle.has(cleanCard)) {
          const item = remoteByTitle.get(cleanCard)!;
          if (item.status) targetStatus = item.status;
        }
      }

      if (!targetStatus && card.issueNumber && issuesByNumber.has(card.issueNumber)) {
        const iss = issuesByNumber.get(card.issueNumber)!;
        if (iss.state === 'CLOSED') {
          targetStatus = 'Done';
        }
      }

      if (!targetStatus) {
        remainingCards.push(card);
        continue;
      }

      const targetLaneNorm = normalizeLaneName(targetStatus);

      // If card is already marked done locally ([x] or in Done lane), keep it in Done so it updates remote
      if (lane.normalizedName === 'done' || card.checkbox === 'x') {
        remainingCards.push(card);
        continue;
      }

      if (targetLaneNorm !== lane.normalizedName) {
        movedCount++;

        if (targetLaneNorm === 'done') {
          card.checkbox = 'x';
          if (!card.completionDate) {
            card.completionDate = todayDate;
            if (!card.headerLine.includes('✅')) {
              card.headerLine = card.headerLine.replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)(.*)$/, `$1x$2$3 ✅ ${todayDate}`);
            } else {
              card.headerLine = card.headerLine.replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)/, '$1x$2');
            }
          } else {
            card.headerLine = card.headerLine.replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)/, '$1x$2');
          }
          card.childrenLines = card.childrenLines.map((ch) =>
            ch.replace(/^(\s*-\s*\[)[ ](\]\s+)/, '$1x$2')
          );
        } else if (targetLaneNorm === 'in progress') {
          card.checkbox = '/';
          card.headerLine = card.headerLine
            .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '')
            .replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)/, '$1/$2');

          const hasSubtasks = card.childrenLines.some((l) => /^\s*-\s*\[[ xX]\]/.test(l));
          if (!hasSubtasks && card.issueNumber && issuesByNumber.has(card.issueNumber)) {
            const iss = issuesByNumber.get(card.issueNumber)!;
            const subtasks = extractSubtasksFromIssueBody(iss.body || '');
            if (subtasks.length > 0) {
              const hasBranch = card.childrenLines.some((l) => /^\s*>\s*🌿/.test(l));
              if (!hasBranch) {
                card.childrenLines.push(`\t  > 🌿 \`${createBranchSlug(iss.number, card.cleanTitle)}\``);
              }
              for (const sub of subtasks) {
                card.childrenLines.push(`\t  - [${sub.checked ? 'x' : ' '}] ${sub.rawText}`);
              }
            }
          }
        } else {
          card.checkbox = ' ';
          card.headerLine = card.headerLine
            .replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '')
            .replace(/^([ \t]*-\s*\[)[ xX/>\-?*!](\]\s+)/, '$1 $2');
        }

        let destLane = lanes.find((l) => l.normalizedName === targetLaneNorm);
        if (!destLane) {
          let title = targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1);
          if (targetLaneNorm === 'to do') title = 'To Do';
          if (targetLaneNorm === 'in progress') title = 'In Progress';
          if (targetLaneNorm === 'review / test') title = 'Review / Test';
          destLane = {
            headingLine: `## ${title}`,
            normalizedName: targetLaneNorm,
            cards: []
          };
          const archiveIdx = lanes.findIndex((l) => l.normalizedName === 'archive');
          if (archiveIdx !== -1) {
            lanes.splice(archiveIdx, 0, destLane);
          } else {
            lanes.push(destLane);
          }
        }

        destLane.cards.push(card);
      } else {
        remainingCards.push(card);
      }
    }

    lane.cards = remainingCards;
  }

  if (movedCount === 0) {
    return { updatedContent: content, movedCount: 0 };
  }

  const outLines: string[] = [];
  if (frontmatterLines.length > 0) {
    outLines.push(...frontmatterLines);
    outLines.push('');
  }

  for (const p of preambleLines) {
    if (p.trim()) outLines.push(p);
  }

  for (const lane of lanes) {
    outLines.push(lane.headingLine);
    outLines.push('');
    for (const card of lane.cards) {
      outLines.push(card.headerLine);
      for (const ch of card.childrenLines) {
        outLines.push(ch);
      }
    }
    outLines.push('');
  }

  if (settingsLines.length > 0) {
    outLines.push(...settingsLines);
  }

  return { updatedContent: outLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', movedCount };
}


