// 06-Resources/scripts/src/quick-capture-action.ts
function isTFile(file) {
  return Boolean(file && typeof file === "object" && "extension" in file && "path" in file);
}
var DUMP_PATH = "00-Inbox/quick-capture-dump.md";
var INITIAL_DUMP_CONTENT = `# Quick Capture Dump

> Append quick thoughts, links, or ideas here. Run \`QuickAdd: \u{1F9F9} Archive & Clear Quick Capture Dump\` to archive processed entries.

## Captured Notes

`;
async function getOrCreateDumpFile(app) {
  let dumpFile = app.vault.getAbstractFileByPath(DUMP_PATH);
  if (!dumpFile) {
    try {
      dumpFile = await app.vault.create(DUMP_PATH, INITIAL_DUMP_CONTENT);
    } catch {
      dumpFile = app.vault.getAbstractFileByPath(DUMP_PATH);
    }
  }
  if (!dumpFile || !isTFile(dumpFile)) {
    dumpFile = app.vault.getAbstractFileByPath(DUMP_PATH);
  }
  return isTFile(dumpFile) ? dumpFile : null;
}
function formatTimeBadge(now) {
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}
function insertCaptureIntoDump(content, captureText, now = /* @__PURE__ */ new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  const dateHeader = `### \u{1F4C5} ${dateStr}`;
  const timeStr = formatTimeBadge(now);
  const newBullet = `- ${captureText} \`${timeStr}\``;
  const capturedMarker = "## Captured Notes";
  const triagedMatch = content.match(/^##\s+(?:✅\s*)?Triaged\b/m);
  const triagedIndex = triagedMatch ? triagedMatch.index : -1;
  const capturedIndex = content.indexOf(capturedMarker);
  if (capturedIndex !== -1) {
    const searchEnd = triagedIndex !== -1 && triagedIndex > capturedIndex ? triagedIndex : content.length;
    const activeSection = content.slice(capturedIndex, searchEnd);
    const headerPattern = new RegExp(`^###\\s*\u{1F4C5}\\s*${dateStr}(?:\\s+\\d{2}:\\d{2})?`, "m");
    const headerMatch = activeSection.match(headerPattern);
    if (headerMatch && headerMatch.index !== void 0) {
      const absHeaderIndex = capturedIndex + headerMatch.index;
      const endOfHeaderLine = content.indexOf("\n", absHeaderIndex);
      if (endOfHeaderLine !== -1) {
        const updated = content.slice(0, endOfHeaderLine + 1) + `${newBullet}
` + content.slice(endOfHeaderLine + 1);
        return { content: updated, timeStr };
      } else {
        const updated = content + `
${newBullet}
`;
        return { content: updated, timeStr };
      }
    } else {
      const endOfSecLine = content.indexOf("\n", capturedIndex);
      if (endOfSecLine !== -1) {
        const updated = content.slice(0, endOfSecLine + 1) + `
${dateHeader}
${newBullet}
` + content.slice(endOfSecLine + 1);
        return { content: updated, timeStr };
      } else {
        const updated = content + `

${dateHeader}
${newBullet}
`;
        return { content: updated, timeStr };
      }
    }
  } else {
    if (triagedIndex !== -1) {
      const updated = content.slice(0, triagedIndex) + `## Captured Notes

${dateHeader}
${newBullet}

` + content.slice(triagedIndex);
      return { content: updated, timeStr };
    } else {
      const prefix = content.length > 0 && !content.endsWith("\n\n") ? content.endsWith("\n") ? "\n" : "\n\n" : "";
      const updated = content + `${prefix}## Captured Notes

${dateHeader}
${newBullet}
`;
      return { content: updated, timeStr };
    }
  }
}
async function quickCaptureAction(params) {
  const app = params?.app || window.app || globalThis.app;
  const quickAddApi = params?.quickAddApi;
  const Notice = window.Notice || globalThis.Notice;
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
    if (typeof app.vault.process !== "function") {
      const errorMsg = "Atomic vault.process is required for quick capture to prevent data loss.";
      new Notice(`\u274C Capture Refused: ${errorMsg}`, 5e3);
      throw new Error(errorMsg);
    }
    const dumpFile = await getOrCreateDumpFile(app);
    if (!dumpFile) {
      const errorMsg = "Could not access quick capture dump file.";
      new Notice(`\u274C Capture Error: ${errorMsg}`, 4e3);
      throw new Error(errorMsg);
    }
    const now = /* @__PURE__ */ new Date();
    let recordedTimeStr = "";
    const transform = (current) => {
      const result = insertCaptureIntoDump(current, captureText, now);
      recordedTimeStr = result.timeStr;
      return result.content;
    };
    await app.vault.process(dumpFile, transform);
    new Notice(`\u{1F4E5} Captured to Inbox (\`${recordedTimeStr}\`)`, 3e3);
  } catch (error) {
    console.error("Quick Capture Error:", error);
    new Notice(`\u274C Capture Error: ${error?.message || error}`, 5e3);
    throw error;
  }
}
module.exports = Object.assign(quickCaptureAction, {
  insertCaptureIntoDump,
  getOrCreateDumpFile,
  formatTimeBadge
});
