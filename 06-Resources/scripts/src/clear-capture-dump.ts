/**
 * QuickAdd UserScript: Archive & Clear Quick Capture Dump
 * --------------------------------------------------------------------------
 * Moves processed entries from 00-Inbox/quick-capture-dump.md into a monthly
 * archive note (00-Inbox/Archives/Quick Capture Archive YYYY-MM.md) and resets
 * quick-capture-dump.md to a clean state.
 */

import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';

function isTFile(file: any): file is TFile {
  return Boolean(file && typeof file === 'object' && 'extension' in file && 'path' in file);
}

const DEFAULT_RESET_CONTENT =
  `# Quick Capture Dump\n\n> Append quick thoughts, links, or ideas here. Run \`QuickAdd: 🧹 Archive & Clear Quick Capture Dump\` to archive processed entries.\n\n`;

function isScaffoldLine(trimmed: string): boolean {
  if (trimmed === '') return true;
  if (/^#\s+(?:📥\s*)?Quick Capture Dump\b/i.test(trimmed)) return true;
  if (trimmed.startsWith('>')) return true;
  if (/^##\s+(?:Captured Notes|✅\s*Triaged)\b/i.test(trimmed)) return true;
  if (trimmed === '---') return true;
  return false;
}

function splitFrontmatter(raw: string): { frontmatterBlock: string; body: string } {
  const match = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
  if (!match) {
    return { frontmatterBlock: '', body: raw };
  }
  return {
    frontmatterBlock: match[1],
    body: raw.slice(match[1].length),
  };
}

function leadingIndent(line: string): number {
  let width = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') width += 1;
    else if (line[i] === '\t') width += 2;
    else break;
  }
  return width;
}

function isListItemLine(line: string): boolean {
  return /^(\s*)(?:[-*+]|\d+[.)])\s+/.test(line);
}

type BodyToken =
  | { kind: 'scaffold'; line: string }
  | { kind: 'dateHeader'; line: string }
  | { kind: 'captureBlock'; lines: string[]; key: string };

function tokenizeDumpBody(body: string): BodyToken[] {
  const lines = body.split('\n');
  const tokens: BodyToken[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (isScaffoldLine(trimmed)) {
      tokens.push({ kind: 'scaffold', line });
      continue;
    }
    if (/^###\s+📅\s+/.test(trimmed)) {
      tokens.push({ kind: 'dateHeader', line });
      continue;
    }

    let lastNonBlankIdx = tokens.length - 1;
    while (
      lastNonBlankIdx >= 0 &&
      tokens[lastNonBlankIdx].kind === 'scaffold' &&
      (tokens[lastNonBlankIdx] as { kind: 'scaffold'; line: string }).line.trim() === ''
    ) {
      lastNonBlankIdx -= 1;
    }

    const prev = lastNonBlankIdx >= 0 ? tokens[lastNonBlankIdx] : undefined;
    if (prev && prev.kind === 'captureBlock') {
      const blankCount = tokens.length - 1 - lastNonBlankIdx;
      const rootLine = prev.lines[0];
      const rootIndent = leadingIndent(rootLine);
      const rootIsList = isListItemLine(rootLine);
      const currIndent = leadingIndent(line);
      const currIsList = isListItemLine(line);
      const currIsHeading = /^#+\s+/.test(trimmed);

      if (
        !currIsHeading &&
        (currIndent > rootIndent || (blankCount === 0 && rootIsList && !currIsList))
      ) {
        const absorbedBlanks = tokens
          .splice(lastNonBlankIdx + 1, blankCount)
          .map((t) => (t as { kind: 'scaffold'; line: string }).line);
        prev.lines.push(...absorbedBlanks, line);
        prev.key = prev.lines.join('\n');
        continue;
      }
    }

    tokens.push({
      kind: 'captureBlock',
      lines: [line],
      key: line,
    });
  }

  return tokens;
}

function extractArchivableSnapshot(raw: string): {
  archivableBlocks: string[];
  archiveText: string;
} {
  const { body } = splitFrontmatter(raw);
  const tokens = tokenizeDumpBody(body);
  const archivableBlocks: string[] = [];
  const archiveLines: string[] = [];
  let pendingDateHeader: string | null = null;

  for (const token of tokens) {
    if (token.kind === 'scaffold') continue;
    if (token.kind === 'dateHeader') {
      pendingDateHeader = token.line;
      continue;
    }
    if (pendingDateHeader !== null) {
      archiveLines.push(pendingDateHeader);
      pendingDateHeader = null;
    }
    archivableBlocks.push(token.key);
    archiveLines.push(...token.lines);
  }

  return {
    archivableBlocks,
    archiveText: archiveLines.join('\n').trim(),
  };
}

function removeArchivedFromCurrent(currentRaw: string, archivedBlocks: readonly string[]): string {
  const { frontmatterBlock, body } = splitFrontmatter(currentRaw);

  // Build multiset of complete archived capture blocks
  const remainingToRemove = new Map<string, number>();
  for (const blockKey of archivedBlocks) {
    remainingToRemove.set(blockKey, (remainingToRemove.get(blockKey) ?? 0) + 1);
  }

  const tokens = tokenizeDumpBody(body);
  const firstPass: string[] = [];
  let sawScaffoldBlockquote = false;
  let survivingEntries = 0;

  for (const token of tokens) {
    if (token.kind === 'scaffold') {
      if (token.line.trim().startsWith('>')) sawScaffoldBlockquote = true;
      firstPass.push(token.line);
      continue;
    }
    if (token.kind === 'dateHeader') {
      firstPass.push(token.line);
      continue;
    }

    const count = remainingToRemove.get(token.key) ?? 0;
    if (count > 0) {
      remainingToRemove.set(token.key, count - 1);
      continue;
    }

    survivingEntries += 1;
    firstPass.push(...token.lines);
  }

  // Drop `### 📅 YYYY-MM-DD` subheadings that have no surviving entries beneath them
  const cleanedLines: string[] = [];
  for (let i = 0; i < firstPass.length; i++) {
    const line = firstPass[i];
    const trimmed = line.trim();
    if (/^###\s+📅\s+/.test(trimmed)) {
      let hasEntryUnderneath = false;
      for (let j = i + 1; j < firstPass.length; j++) {
        const nextTrimmed = firstPass[j].trim();
        if (nextTrimmed === '') continue;
        if (
          /^###\s+📅\s+/.test(nextTrimmed) ||
          /^##\s+/.test(nextTrimmed) ||
          nextTrimmed === '---'
        ) {
          break;
        }
        if (!isScaffoldLine(nextTrimmed)) {
          hasEntryUnderneath = true;
          break;
        }
      }
      if (!hasEntryUnderneath) continue;
    }
    cleanedLines.push(line);
  }

  if (frontmatterBlock === '' && !sawScaffoldBlockquote && survivingEntries === 0) {
    return DEFAULT_RESET_CONTENT;
  }

  const normalizedBody = cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

  if (frontmatterBlock !== '') {
    const fm = frontmatterBlock.endsWith('\n') ? frontmatterBlock : `${frontmatterBlock}\n`;
    return `${fm}\n${normalizedBody.replace(/^\n+/, '')}\n`;
  }

  if (!sawScaffoldBlockquote) {
    const headerMatch = normalizedBody.match(/^(#\s+(?:📥\s*)?Quick Capture Dump[^\n]*)\n?([\s\S]*)$/i);
    if (headerMatch) {
      const rest = headerMatch[2].trim();
      return (
        `${headerMatch[1]}\n\n> Append quick thoughts, links, or ideas here. Run \`QuickAdd: 🧹 Archive & Clear Quick Capture Dump\` to archive processed entries.\n\n` +
        (rest ? `${rest}\n` : '')
      );
    }
  }

  return `${normalizedBody}\n`;
}

const VAULT_QUEUE_SYMBOL = Symbol.for('loey_space.clearCaptureDump.queues');
const GLOBAL_FALLBACK_QUEUE_SYMBOL = Symbol.for('loey_space.clearCaptureDump.fallbackQueues');

function getSharedQueueMap(vault: unknown): Map<string, Promise<void>> {
  if (vault && typeof vault === 'object') {
    const host = vault as Record<symbol, Map<string, Promise<void>> | undefined>;
    if (!host[VAULT_QUEUE_SYMBOL]) {
      host[VAULT_QUEUE_SYMBOL] = new Map<string, Promise<void>>();
    }
    return host[VAULT_QUEUE_SYMBOL]!;
  }
  const globalHost = globalThis as unknown as Record<symbol, Map<string, Promise<void>> | undefined>;
  if (!globalHost[GLOBAL_FALLBACK_QUEUE_SYMBOL]) {
    globalHost[GLOBAL_FALLBACK_QUEUE_SYMBOL] = new Map<string, Promise<void>>();
  }
  return globalHost[GLOBAL_FALLBACK_QUEUE_SYMBOL]!;
}

function enqueueArchiveRun(vault: unknown, dumpPath: string, task: () => Promise<void>): Promise<void> {
  const queueMap = getSharedQueueMap(vault);
  const previous: Promise<void> = queueMap.get(dumpPath) ?? Promise.resolve();
  const next: Promise<void> = previous.catch((): void => undefined).then(task);
  const tracked: Promise<void> = next.finally((): void => {
    if (queueMap.get(dumpPath) === tracked) {
      queueMap.delete(dumpPath);
    }
  });
  queueMap.set(dumpPath, tracked);
  return next;
}

async function appendArchiveSection(
  app: App,
  archiveFilePath: string,
  yearMonth: string,
  archiveHeader: string,
  archiveText: string
): Promise<void> {
  const appendTransform = (existingArchive: string): string =>
    `${existingArchive}${archiveHeader}${archiveText}\n`;

  const existingFile = app.vault.getAbstractFileByPath(archiveFilePath);
  if (existingFile && isTFile(existingFile)) {
    if (typeof (app.vault as any).process === 'function') {
      await (app.vault as any).process(existingFile, appendTransform);
    } else {
      const existingArchive = await app.vault.read(existingFile);
      await app.vault.modify(existingFile, appendTransform(existingArchive));
    }
    return;
  }

  const initialArchiveContent =
    `---\ntype: archive\ntags:\n  - type/archive\n---\n\n# 📦 Quick Capture Archive — ${yearMonth}\n` +
    archiveHeader +
    archiveText +
    '\n';

  try {
    await app.vault.create(archiveFilePath, initialArchiveContent);
  } catch (createErr) {
    const racedFile = app.vault.getAbstractFileByPath(archiveFilePath);
    if (racedFile && isTFile(racedFile)) {
      if (typeof (app.vault as any).process === 'function') {
        await (app.vault as any).process(racedFile, appendTransform);
      } else {
        const existingArchive = await app.vault.read(racedFile);
        await app.vault.modify(racedFile, appendTransform(existingArchive));
      }
      return;
    }
    throw createErr;
  }
}

export = async function clearCaptureDump(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (window as any).app || (globalThis as any).app;
  const Notice = (window as any).Notice || (globalThis as any).Notice;
  const dumpPath = '00-Inbox/quick-capture-dump.md';

  return enqueueArchiveRun(app?.vault, dumpPath, async () => {
    try {
      const dumpFile = app.vault.getAbstractFileByPath(dumpPath);

      if (!dumpFile || !isTFile(dumpFile)) {
        new Notice('❌ Quick Capture Dump file not found!', 4000);
        return;
      }

      const content = await app.vault.read(dumpFile);
      const { archivableBlocks, archiveText } = extractArchivableSnapshot(content);

      if (archivableBlocks.length === 0) {
        new Notice('✨ Quick Capture Dump is already clean and empty!', 4000);
        return;
      }

      // Determine current month for archive
      const now = new Date();
      const yearMonth = now.toISOString().slice(0, 7); // YYYY-MM
      const archiveFolderPath = '00-Inbox/Archives';
      const archiveFilePath = `${archiveFolderPath}/Quick Capture Archive ${yearMonth}.md`;

      // Ensure Archives folder exists
      const archiveFolder = app.vault.getAbstractFileByPath(archiveFolderPath);
      if (!archiveFolder) {
        await app.vault.createFolder(archiveFolderPath);
      }

      // Prepare archive content
      const timestamp = now.toLocaleString();
      const archiveHeader = `\n## 📦 Archived on ${timestamp}\n\n`;

      await appendArchiveSection(app, archiveFilePath, yearMonth, archiveHeader, archiveText);

      // Remove only complete capture blocks whose exact text was archived, transforming the live
      // dump's CURRENT content so blocks appended or edited while archiving survive intact.
      const rewrite = (current: string): string => removeArchivedFromCurrent(current, archivableBlocks);
      if (typeof (app.vault as any).process === 'function') {
        await (app.vault as any).process(dumpFile, rewrite);
      } else {
        await app.vault.modify(dumpFile, rewrite(await app.vault.read(dumpFile)));
      }

      new Notice(`🎉 Archived capture entries to "Quick Capture Archive ${yearMonth}.md" and reset dump!`, 6000);
    } catch (error: any) {
      console.error('Clear Capture Dump Error:', error);
      new Notice(`❌ Archive Error: ${error?.message || error}`, 5000);
    }
  });
};
