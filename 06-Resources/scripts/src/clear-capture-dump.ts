/**
 * QuickAdd UserScript: Archive & Clear Quick Capture Dump
 * --------------------------------------------------------------------------
 * Moves processed entries from 00-Inbox/quick-capture-dump.md into a monthly
 * archive note (00-Inbox/Archives/Quick Capture Archive YYYY-MM.md) and resets
 * quick-capture-dump.md to a clean state.
 */

module.exports = async (params) => {
  const { app } = params;
  const Notice = window.Notice || globalThis.Notice;

  try {
    const dumpPath = '00-Inbox/quick-capture-dump.md';
    const dumpFile = app.vault.getAbstractFileByPath(dumpPath);

    if (!dumpFile) {
      new Notice('❌ Quick Capture Dump file not found!', 4000);
      return;
    }

    const content = await app.vault.read(dumpFile);

    // Check if file is empty or only has the header
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const nonHeaderLines = lines.filter(l => !l.startsWith('# Quick Capture Dump'));

    if (nonHeaderLines.length === 0) {
      new Notice('✨ Quick Capture Dump is already clean and empty!', 4000);
      return;
    }

    // Determine current month for archive
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const archiveFolderPath = '00-Inbox/Archives';
    const archiveFilePath = `${archiveFolderPath}/Quick Capture Archive ${yearMonth}.md`;

    // Ensure Archives folder exists
    let archiveFolder = app.vault.getAbstractFileByPath(archiveFolderPath);
    if (!archiveFolder) {
      await app.vault.createFolder(archiveFolderPath);
    }

    // Prepare archive content
    const timestamp = now.toLocaleString();
    const archiveHeader = `\n## 📦 Archived on ${timestamp}\n\n`;
    const textToArchive = content.replace(/# Quick Capture Dump\s*\n?/, '').trim();

    let archiveFile = app.vault.getAbstractFileByPath(archiveFilePath);
    if (archiveFile) {
      const existingArchive = await app.vault.read(archiveFile);
      await app.vault.modify(archiveFile, existingArchive + archiveHeader + textToArchive + '\n');
    } else {
      const initialArchiveContent = `---\ntype: archive\ntags:\n  - type/archive\n---\n\n# 📦 Quick Capture Archive — ${yearMonth}\n` + archiveHeader + textToArchive + '\n';
      await app.vault.create(archiveFilePath, initialArchiveContent);
    }

    // Reset quick-capture-dump.md to clean header
    const resetContent = `# Quick Capture Dump\n\n> Append quick thoughts, links, or ideas here. Run \`QuickAdd: 🧹 Archive & Clear Quick Capture Dump\` to archive processed entries.\n\n`;
    await app.vault.modify(dumpFile, resetContent);

    new Notice(`🎉 Archived capture entries to "Quick Capture Archive ${yearMonth}.md" and reset dump!`, 6000);

  } catch (error) {
    console.error('Clear Capture Dump Error:', error);
    new Notice(`❌ Archive Error: ${error.message}`, 5000);
  }
};
