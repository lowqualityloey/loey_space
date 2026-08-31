// 06-Resources/scripts/src/quick-capture-action.ts
var import_obsidian = require("obsidian");
module.exports = async function quickCaptureAction(params) {
  const app = params?.app || window.app || globalThis.app;
  const quickAddApi = params?.quickAddApi;
  const Notice = window.Notice || import_obsidian.Notice;
  try {
    let captureText = params?.variables?.value;
    if (!captureText || typeof captureText !== "string" || !captureText.trim()) {
      if (quickAddApi) {
        captureText = await quickAddApi.inputPrompt("\u{1F4E5} Quick Capture to Inbox", "Type your thought, link, or idea...");
      }
    }
    if (!captureText || !captureText.trim()) {
      return;
    }
    captureText = captureText.trim();
    const dumpPath = "00-Inbox/quick-capture-dump.md";
    let dumpFile = app.vault.getAbstractFileByPath(dumpPath);
    if (!dumpFile) {
      const initialContent = `# Quick Capture Dump

> Append quick thoughts, links, or ideas here. Run \`QuickAdd: \u{1F9F9} Archive & Clear Quick Capture Dump\` to archive processed entries.

## Captured Notes

`;
      dumpFile = await app.vault.create(dumpPath, initialContent);
    }
    if (!(dumpFile instanceof import_obsidian.TFile)) {
      new Notice("\u274C Could not access quick capture dump file.", 4e3);
      return;
    }
    let content = await app.vault.read(dumpFile);
    const now = /* @__PURE__ */ new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const dateHeader = `### \u{1F4C5} ${dateStr}`;
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
    const newBullet = `- ${captureText} \`${timeStr}\``;
    const lines = content.split("\n");
    const cleanedLines = [];
    let currentGroupHeader = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const oldHeaderMatch = line.match(/^###\s*📅\s*(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?/);
      if (oldHeaderMatch) {
        const headerDate = oldHeaderMatch[1];
        const canonicalHeader = `### \u{1F4C5} ${headerDate}`;
        if (cleanedLines.includes(canonicalHeader)) {
          continue;
        } else {
          cleanedLines.push(canonicalHeader);
          currentGroupHeader = canonicalHeader;
          continue;
        }
      }
      cleanedLines.push(line);
    }
    let updatedContent = cleanedLines.join("\n");
    if (updatedContent.includes(dateHeader)) {
      const headerIndex = updatedContent.indexOf(dateHeader);
      const endOfHeaderLine = updatedContent.indexOf("\n", headerIndex);
      if (endOfHeaderLine !== -1) {
        updatedContent = updatedContent.slice(0, endOfHeaderLine + 1) + `${newBullet}
` + updatedContent.slice(endOfHeaderLine + 1);
      } else {
        updatedContent += `
${newBullet}
`;
      }
    } else {
      const sectionMarker = "## Captured Notes";
      if (updatedContent.includes(sectionMarker)) {
        const secIndex = updatedContent.indexOf(sectionMarker);
        const endOfSecLine = updatedContent.indexOf("\n", secIndex);
        if (endOfSecLine !== -1) {
          updatedContent = updatedContent.slice(0, endOfSecLine + 1) + `
${dateHeader}
${newBullet}
` + updatedContent.slice(endOfSecLine + 1);
        } else {
          updatedContent += `

${dateHeader}
${newBullet}
`;
        }
      } else {
        updatedContent += `

## Captured Notes

${dateHeader}
${newBullet}
`;
      }
    }
    await app.vault.modify(dumpFile, updatedContent);
    new Notice(`\u{1F4E5} Captured to Inbox (\`${timeStr}\`)`, 3e3);
  } catch (error) {
    console.error("Quick Capture Error:", error);
    new Notice(`\u274C Capture Error: ${error?.message || error}`, 5e3);
  }
};
