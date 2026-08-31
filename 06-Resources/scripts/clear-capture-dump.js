// 06-Resources/scripts/src/clear-capture-dump.ts
module.exports = async (params) => {
  const { app } = params;
  const Notice = window.Notice || globalThis.Notice;
  try {
    const dumpPath = "00-Inbox/quick-capture-dump.md";
    const dumpFile = app.vault.getAbstractFileByPath(dumpPath);
    if (!dumpFile) {
      new Notice("\u274C Quick Capture Dump file not found!", 4e3);
      return;
    }
    const content = await app.vault.read(dumpFile);
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const nonHeaderLines = lines.filter((l) => !l.startsWith("# Quick Capture Dump"));
    if (nonHeaderLines.length === 0) {
      new Notice("\u2728 Quick Capture Dump is already clean and empty!", 4e3);
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const yearMonth = now.toISOString().slice(0, 7);
    const archiveFolderPath = "00-Inbox/Archives";
    const archiveFilePath = `${archiveFolderPath}/Quick Capture Archive ${yearMonth}.md`;
    let archiveFolder = app.vault.getAbstractFileByPath(archiveFolderPath);
    if (!archiveFolder) {
      await app.vault.createFolder(archiveFolderPath);
    }
    const timestamp = now.toLocaleString();
    const archiveHeader = `
## \u{1F4E6} Archived on ${timestamp}

`;
    const textToArchive = content.replace(/# Quick Capture Dump\s*\n?/, "").trim();
    let archiveFile = app.vault.getAbstractFileByPath(archiveFilePath);
    if (archiveFile) {
      const existingArchive = await app.vault.read(archiveFile);
      await app.vault.modify(archiveFile, existingArchive + archiveHeader + textToArchive + "\n");
    } else {
      const initialArchiveContent = `---
type: archive
tags:
  - type/archive
---

# \u{1F4E6} Quick Capture Archive \u2014 ${yearMonth}
` + archiveHeader + textToArchive + "\n";
      await app.vault.create(archiveFilePath, initialArchiveContent);
    }
    const resetContent = `# Quick Capture Dump

> Append quick thoughts, links, or ideas here. Run \`QuickAdd: \u{1F9F9} Archive & Clear Quick Capture Dump\` to archive processed entries.

`;
    await app.vault.modify(dumpFile, resetContent);
    new Notice(`\u{1F389} Archived capture entries to "Quick Capture Archive ${yearMonth}.md" and reset dump!`, 6e3);
  } catch (error) {
    console.error("Clear Capture Dump Error:", error);
    new Notice(`\u274C Archive Error: ${error.message}`, 5e3);
  }
};
