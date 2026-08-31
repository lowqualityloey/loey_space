/**
 * QuickAdd UserScript: Smart Grouped Quick Capture Action
 * --------------------------------------------------------------------------
 * Groups all capture entries from the same day under a single date header
 * (### 📅 YYYY-MM-DD) and appends an inline time badge (`hh:mm AM/PM`) beside each bullet.
 */

import { App, TFile, Notice as ObsidianNotice } from 'obsidian';
import type { QuickAddParams } from './types';

export = async function quickCaptureAction(params: QuickAddParams): Promise<void> {
  const app = params?.app || (window as any).app || (globalThis as any).app;
  const quickAddApi = params?.quickAddApi;
  const Notice = window.Notice || ObsidianNotice;

  try {
    // 1. Prompt user for capture text
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

    const dumpPath = '00-Inbox/quick-capture-dump.md';
    let dumpFile = app.vault.getAbstractFileByPath(dumpPath);

    if (!dumpFile) {
      const initialContent = `# Quick Capture Dump\n\n> Append quick thoughts, links, or ideas here. Run \`QuickAdd: 🧹 Archive & Clear Quick Capture Dump\` to archive processed entries.\n\n## Captured Notes\n\n`;
      dumpFile = await app.vault.create(dumpPath, initialContent);
    }

    if (!(dumpFile instanceof TFile)) {
      new Notice('❌ Could not access quick capture dump file.', 4000);
      return;
    }

    let content = await app.vault.read(dumpFile);

    // 2. Format Dates & Times
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateHeader = `### 📅 ${dateStr}`;

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour 0 is 12
    const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    const newBullet = `- ${captureText} \`${timeStr}\``;

    // 3. Re-format existing flooded headers into clean grouped layout
    const lines = content.split('\n');
    const cleanedLines: string[] = [];
    let currentGroupHeader: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match old flooded headers: ### 📅 YYYY-MM-DD HH:mm or ### 📅 YYYY-MM-DD
      const oldHeaderMatch = line.match(/^###\s*📅\s*(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?/);
      if (oldHeaderMatch) {
        const headerDate = oldHeaderMatch[1];
        const canonicalHeader = `### 📅 ${headerDate}`;
        if (cleanedLines.includes(canonicalHeader)) {
          // Skip duplicate header
          continue;
        } else {
          cleanedLines.push(canonicalHeader);
          currentGroupHeader = canonicalHeader;
          continue;
        }
      }
      cleanedLines.push(line);
    }

    let updatedContent = cleanedLines.join('\n');

    // 4. Insert bullet under today's date header
    if (updatedContent.includes(dateHeader)) {
      // Date header exists: insert bullet immediately after the date header line
      const headerIndex = updatedContent.indexOf(dateHeader);
      const endOfHeaderLine = updatedContent.indexOf('\n', headerIndex);
      if (endOfHeaderLine !== -1) {
        updatedContent = updatedContent.slice(0, endOfHeaderLine + 1) + `${newBullet}\n` + updatedContent.slice(endOfHeaderLine + 1);
      } else {
        updatedContent += `\n${newBullet}\n`;
      }
    } else {
      // Date header does not exist: add date header and bullet under ## Captured Notes or at bottom
      const sectionMarker = '## Captured Notes';
      if (updatedContent.includes(sectionMarker)) {
        const secIndex = updatedContent.indexOf(sectionMarker);
        const endOfSecLine = updatedContent.indexOf('\n', secIndex);
        if (endOfSecLine !== -1) {
          updatedContent = updatedContent.slice(0, endOfSecLine + 1) + `\n${dateHeader}\n${newBullet}\n` + updatedContent.slice(endOfSecLine + 1);
        } else {
          updatedContent += `\n\n${dateHeader}\n${newBullet}\n`;
        }
      } else {
        updatedContent += `\n\n## Captured Notes\n\n${dateHeader}\n${newBullet}\n`;
      }
    }

    await app.vault.modify(dumpFile, updatedContent);
    new Notice(`📥 Captured to Inbox (\`${timeStr}\`)`, 3000);

  } catch (error: any) {
    console.error('Quick Capture Error:', error);
    new Notice(`❌ Capture Error: ${error?.message || error}`, 5000);
  }
};
