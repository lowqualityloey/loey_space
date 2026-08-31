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
  if (clean.includes('to do') || clean.includes('todo') || clean.includes('to-do')) return 'to do';
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

    const taskMatch = line.match(/^\s*-\s*\[([ xX/>\-?*!])\]\s+(.*)$/);
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
    const taskMatch = line.match(/^\s*-\s*\[[ xX/>\-?*!]\]\s+(.*)$/);
    if (taskMatch && !removedLine) {
      const lineClean = taskMatch[1].toLowerCase().trim();
      if (lineClean.includes(cleanTarget) || cleanTarget.includes(lineClean)) {
        removedLine = true;
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
