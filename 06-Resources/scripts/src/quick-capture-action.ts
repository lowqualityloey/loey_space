/**
 * QuickAdd UserScript: Smart Grouped Quick Capture Action
 * --------------------------------------------------------------------------
 * Groups all capture entries from the same day under a single date header
 * (### 📅 YYYY-MM-DD) and appends an inline time badge (`hh:mm AM/PM`) beside each bullet.
 */

import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';

function isTFile(file: any): file is TFile {
  return Boolean(file && typeof file === 'object' && 'extension' in file && 'path' in file);
}

const DUMP_PATH = '00-Inbox/quick-capture-dump.md';
const INITIAL_DUMP_CONTENT =
  `# Quick Capture Dump\n\n> Append quick thoughts, links, or ideas here. Run \`QuickAdd: 🧹 Archive & Clear Quick Capture Dump\` to archive processed entries.\n\n## Captured Notes\n\n`;

async function getOrCreateDumpFile(app: App): Promise<TFile | null> {
  let dumpFile = app.vault.getAbstractFileByPath(DUMP_PATH);

  if (!dumpFile) {
    try {
      dumpFile = await app.vault.create(DUMP_PATH, INITIAL_DUMP_CONTENT);
    } catch {
      // If another concurrent capture created the file first, retrieve the newly created file
      dumpFile = app.vault.getAbstractFileByPath(DUMP_PATH);
    }
  }

  if (!dumpFile || !isTFile(dumpFile)) {
    dumpFile = app.vault.getAbstractFileByPath(DUMP_PATH);
  }

  return isTFile(dumpFile) ? dumpFile : null;
}

function formatTimeBadge(now: Date): string {
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour 0 is 12
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function insertCaptureIntoDump(
  content: string,
  captureText: string,
  now: Date = new Date()
): { content: string; timeStr: string } {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const dateHeader = `### 📅 ${dateStr}`;

  const timeStr = formatTimeBadge(now);
  const newBullet = `- ${captureText} \`${timeStr}\``;

  const capturedMarker = '## Captured Notes';
  const triagedMatch = content.match(/^##\s+(?:✅\s*)?Triaged\b/m);
  const triagedIndex = triagedMatch ? triagedMatch.index! : -1;
  const capturedIndex = content.indexOf(capturedMarker);

  if (capturedIndex !== -1) {
    const searchEnd = triagedIndex !== -1 && triagedIndex > capturedIndex ? triagedIndex : content.length;
    const activeSection = content.slice(capturedIndex, searchEnd);

    // Search for today's date header inside ## Captured Notes (before any Triaged section)
    const headerPattern = new RegExp(`^###\\s*📅\\s*${dateStr}(?:\\s+\\d{2}:\\d{2})?`, 'm');
    const headerMatch = activeSection.match(headerPattern);

    if (headerMatch && headerMatch.index !== undefined) {
      const absHeaderIndex = capturedIndex + headerMatch.index;
      const endOfHeaderLine = content.indexOf('\n', absHeaderIndex);
      if (endOfHeaderLine !== -1) {
        const updated =
          content.slice(0, endOfHeaderLine + 1) +
          `${newBullet}\n` +
          content.slice(endOfHeaderLine + 1);
        return { content: updated, timeStr };
      } else {
        const updated = content + `\n${newBullet}\n`;
        return { content: updated, timeStr };
      }
    } else {
      // Date header does not exist in active section. Insert after ## Captured Notes line.
      const endOfSecLine = content.indexOf('\n', capturedIndex);
      if (endOfSecLine !== -1) {
        const updated =
          content.slice(0, endOfSecLine + 1) +
          `\n${dateHeader}\n${newBullet}\n` +
          content.slice(endOfSecLine + 1);
        return { content: updated, timeStr };
      } else {
        const updated = content + `\n\n${dateHeader}\n${newBullet}\n`;
        return { content: updated, timeStr };
      }
    }
  } else {
    // ## Captured Notes does not exist.
    if (triagedIndex !== -1) {
      const updated =
        content.slice(0, triagedIndex) +
        `## Captured Notes\n\n${dateHeader}\n${newBullet}\n\n` +
        content.slice(triagedIndex);
      return { content: updated, timeStr };
    } else {
      const prefix =
        content.length > 0 && !content.endsWith('\n\n')
          ? content.endsWith('\n')
            ? '\n'
            : '\n\n'
          : '';
      const updated = content + `${prefix}## Captured Notes\n\n${dateHeader}\n${newBullet}\n`;
      return { content: updated, timeStr };
    }
  }
}

async function quickCaptureAction(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (window as any).app || (globalThis as any).app;
  const quickAddApi = params?.quickAddApi;
  const Notice = (window as any).Notice || (globalThis as any).Notice;

  try {
    let captureText = params?.variables?.value;
    if (!captureText || typeof captureText !== 'string' || !captureText.trim()) {
      if (quickAddApi) {
        captureText = await quickAddApi.inputPrompt('📥 Quick Capture to Inbox', 'Type your thought, link, or idea...');
      }
    }

    if (!captureText || !captureText.trim()) {
      return; // Cancelled by user
    }

    captureText = captureText.trim();

    // Require atomic vault.process explicitly to guarantee data integrity before touching any file
    if (typeof (app.vault as any).process !== 'function') {
      const errorMsg = 'Atomic vault.process is required for quick capture to prevent data loss.';
      new Notice(`❌ Capture Refused: ${errorMsg}`, 5000);
      throw new Error(errorMsg);
    }

    const dumpFile = await getOrCreateDumpFile(app);
    if (!dumpFile) {
      const errorMsg = 'Could not access quick capture dump file.';
      new Notice(`❌ Capture Error: ${errorMsg}`, 4000);
      throw new Error(errorMsg);
    }

    const now = new Date();
    let recordedTimeStr = '';

    const transform = (current: string): string => {
      const result = insertCaptureIntoDump(current, captureText as string, now);
      recordedTimeStr = result.timeStr;
      return result.content;
    };

    await (app.vault as any).process(dumpFile, transform);

    new Notice(`📥 Captured to Inbox (\`${recordedTimeStr}\`)`, 3000);
  } catch (error: any) {
    console.error('Quick Capture Error:', error);
    new Notice(`❌ Capture Error: ${error?.message || error}`, 5000);
    throw error;
  }
}

export = Object.assign(quickCaptureAction, {
  insertCaptureIntoDump,
  getOrCreateDumpFile,
  formatTimeBadge,
});
