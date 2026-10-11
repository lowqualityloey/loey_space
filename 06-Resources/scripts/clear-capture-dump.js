// 06-Resources/scripts/src/clear-capture-dump.ts
function isTFile(file) {
  return Boolean(file && typeof file === "object" && "extension" in file && "path" in file);
}
var DEFAULT_RESET_CONTENT = `# Quick Capture Dump

> Append quick thoughts, links, or ideas here. Run \`QuickAdd: \u{1F9F9} Archive & Clear Quick Capture Dump\` to archive processed entries.

`;
function isScaffoldLine(trimmed) {
  if (trimmed === "")
    return true;
  if (/^#\s+(?:📥\s*)?Quick Capture Dump\b/i.test(trimmed))
    return true;
  if (trimmed.startsWith(">"))
    return true;
  if (/^##\s+(?:Captured Notes|✅\s*Triaged)\b/i.test(trimmed))
    return true;
  if (trimmed === "---")
    return true;
  return false;
}
function splitFrontmatter(raw) {
  const match = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
  if (!match) {
    return { frontmatterBlock: "", body: raw };
  }
  return {
    frontmatterBlock: match[1],
    body: raw.slice(match[1].length)
  };
}
function leadingIndent(line) {
  let width = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === " ")
      width += 1;
    else if (line[i] === "	")
      width += 2;
    else
      break;
  }
  return width;
}
function isListItemLine(line) {
  return /^(\s*)(?:[-*+]|\d+[.)])\s+/.test(line);
}
function tokenizeDumpBody(body) {
  const lines = body.split("\n");
  const tokens = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (isScaffoldLine(trimmed)) {
      tokens.push({ kind: "scaffold", line });
      continue;
    }
    if (/^###\s+📅\s+/.test(trimmed)) {
      tokens.push({ kind: "dateHeader", line });
      continue;
    }
    let lastNonBlankIdx = tokens.length - 1;
    while (lastNonBlankIdx >= 0 && tokens[lastNonBlankIdx].kind === "scaffold" && tokens[lastNonBlankIdx].line.trim() === "") {
      lastNonBlankIdx -= 1;
    }
    const prev = lastNonBlankIdx >= 0 ? tokens[lastNonBlankIdx] : void 0;
    if (prev && prev.kind === "captureBlock") {
      const blankCount = tokens.length - 1 - lastNonBlankIdx;
      const rootLine = prev.lines[0];
      const rootIndent = leadingIndent(rootLine);
      const rootIsList = isListItemLine(rootLine);
      const currIndent = leadingIndent(line);
      const currIsList = isListItemLine(line);
      const currIsHeading = /^#+\s+/.test(trimmed);
      if (!currIsHeading && (currIndent > rootIndent || blankCount === 0 && rootIsList && !currIsList)) {
        const absorbedBlanks = tokens.splice(lastNonBlankIdx + 1, blankCount).map((t) => t.line);
        prev.lines.push(...absorbedBlanks, line);
        prev.key = prev.lines.join("\n");
        continue;
      }
    }
    tokens.push({
      kind: "captureBlock",
      lines: [line],
      key: line
    });
  }
  return tokens;
}
function extractArchivableSnapshot(raw) {
  const { body } = splitFrontmatter(raw);
  const tokens = tokenizeDumpBody(body);
  const archivableBlocks = [];
  const archiveLines = [];
  let pendingDateHeader = null;
  for (const token of tokens) {
    if (token.kind === "scaffold")
      continue;
    if (token.kind === "dateHeader") {
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
    archiveText: archiveLines.join("\n").trim()
  };
}
function removeArchivedFromCurrent(currentRaw, archivedBlocks) {
  const { frontmatterBlock, body } = splitFrontmatter(currentRaw);
  const remainingToRemove = /* @__PURE__ */ new Map();
  for (const blockKey of archivedBlocks) {
    remainingToRemove.set(blockKey, (remainingToRemove.get(blockKey) ?? 0) + 1);
  }
  const tokens = tokenizeDumpBody(body);
  const firstPass = [];
  let sawScaffoldBlockquote = false;
  let survivingEntries = 0;
  for (const token of tokens) {
    if (token.kind === "scaffold") {
      if (token.line.trim().startsWith(">"))
        sawScaffoldBlockquote = true;
      firstPass.push(token.line);
      continue;
    }
    if (token.kind === "dateHeader") {
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
  const cleanedLines = [];
  for (let i = 0; i < firstPass.length; i++) {
    const line = firstPass[i];
    const trimmed = line.trim();
    if (/^###\s+📅\s+/.test(trimmed)) {
      let hasEntryUnderneath = false;
      for (let j = i + 1; j < firstPass.length; j++) {
        const nextTrimmed = firstPass[j].trim();
        if (nextTrimmed === "")
          continue;
        if (/^###\s+📅\s+/.test(nextTrimmed) || /^##\s+/.test(nextTrimmed) || nextTrimmed === "---") {
          break;
        }
        if (!isScaffoldLine(nextTrimmed)) {
          hasEntryUnderneath = true;
          break;
        }
      }
      if (!hasEntryUnderneath)
        continue;
    }
    cleanedLines.push(line);
  }
  if (frontmatterBlock === "" && !sawScaffoldBlockquote && survivingEntries === 0) {
    return DEFAULT_RESET_CONTENT;
  }
  const normalizedBody = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  if (frontmatterBlock !== "") {
    const fm = frontmatterBlock.endsWith("\n") ? frontmatterBlock : `${frontmatterBlock}
`;
    return `${fm}
${normalizedBody.replace(/^\n+/, "")}
`;
  }
  if (!sawScaffoldBlockquote) {
    const headerMatch = normalizedBody.match(/^(#\s+(?:📥\s*)?Quick Capture Dump[^\n]*)\n?([\s\S]*)$/i);
    if (headerMatch) {
      const rest = headerMatch[2].trim();
      return `${headerMatch[1]}

> Append quick thoughts, links, or ideas here. Run \`QuickAdd: \u{1F9F9} Archive & Clear Quick Capture Dump\` to archive processed entries.

` + (rest ? `${rest}
` : "");
    }
  }
  return `${normalizedBody}
`;
}
var VAULT_QUEUE_SYMBOL = Symbol.for("loey_space.clearCaptureDump.queues");
var GLOBAL_FALLBACK_QUEUE_SYMBOL = Symbol.for("loey_space.clearCaptureDump.fallbackQueues");
function getSharedQueueMap(vault) {
  if (vault && typeof vault === "object") {
    const host = vault;
    if (!host[VAULT_QUEUE_SYMBOL]) {
      host[VAULT_QUEUE_SYMBOL] = /* @__PURE__ */ new Map();
    }
    return host[VAULT_QUEUE_SYMBOL];
  }
  const globalHost = globalThis;
  if (!globalHost[GLOBAL_FALLBACK_QUEUE_SYMBOL]) {
    globalHost[GLOBAL_FALLBACK_QUEUE_SYMBOL] = /* @__PURE__ */ new Map();
  }
  return globalHost[GLOBAL_FALLBACK_QUEUE_SYMBOL];
}
function enqueueArchiveRun(vault, dumpPath, task) {
  const queueMap = getSharedQueueMap(vault);
  const previous = queueMap.get(dumpPath) ?? Promise.resolve();
  const next = previous.catch(() => void 0).then(task);
  const tracked = next.finally(() => {
    if (queueMap.get(dumpPath) === tracked) {
      queueMap.delete(dumpPath);
    }
  });
  queueMap.set(dumpPath, tracked);
  return next;
}
async function appendArchiveSection(app, archiveFilePath, yearMonth, archiveHeader, archiveText) {
  const appendTransform = (existingArchive) => `${existingArchive}${archiveHeader}${archiveText}
`;
  const existingFile = app.vault.getAbstractFileByPath(archiveFilePath);
  if (existingFile && isTFile(existingFile)) {
    if (typeof app.vault.process === "function") {
      await app.vault.process(existingFile, appendTransform);
    } else {
      const existingArchive = await app.vault.read(existingFile);
      await app.vault.modify(existingFile, appendTransform(existingArchive));
    }
    return;
  }
  const initialArchiveContent = `---
type: archive
tags:
  - type/archive
---

# \u{1F4E6} Quick Capture Archive \u2014 ${yearMonth}
` + archiveHeader + archiveText + "\n";
  try {
    await app.vault.create(archiveFilePath, initialArchiveContent);
  } catch (createErr) {
    const racedFile = app.vault.getAbstractFileByPath(archiveFilePath);
    if (racedFile && isTFile(racedFile)) {
      if (typeof app.vault.process === "function") {
        await app.vault.process(racedFile, appendTransform);
      } else {
        const existingArchive = await app.vault.read(racedFile);
        await app.vault.modify(racedFile, appendTransform(existingArchive));
      }
      return;
    }
    throw createErr;
  }
}
module.exports = async function clearCaptureDump(params) {
  const app = params?.app || window.app || globalThis.app;
  const Notice = window.Notice || globalThis.Notice;
  const dumpPath = "00-Inbox/quick-capture-dump.md";
  return enqueueArchiveRun(app?.vault, dumpPath, async () => {
    try {
      const dumpFile = app.vault.getAbstractFileByPath(dumpPath);
      if (!dumpFile || !isTFile(dumpFile)) {
        new Notice("\u274C Quick Capture Dump file not found!", 4e3);
        return;
      }
      const content = await app.vault.read(dumpFile);
      const { archivableBlocks, archiveText } = extractArchivableSnapshot(content);
      if (archivableBlocks.length === 0) {
        new Notice("\u2728 Quick Capture Dump is already clean and empty!", 4e3);
        return;
      }
      const now = /* @__PURE__ */ new Date();
      const yearMonth = now.toISOString().slice(0, 7);
      const archiveFolderPath = "00-Inbox/Archives";
      const archiveFilePath = `${archiveFolderPath}/Quick Capture Archive ${yearMonth}.md`;
      const archiveFolder = app.vault.getAbstractFileByPath(archiveFolderPath);
      if (!archiveFolder) {
        await app.vault.createFolder(archiveFolderPath);
      }
      const timestamp = now.toLocaleString();
      const archiveHeader = `
## \u{1F4E6} Archived on ${timestamp}

`;
      await appendArchiveSection(app, archiveFilePath, yearMonth, archiveHeader, archiveText);
      const rewrite = (current) => removeArchivedFromCurrent(current, archivableBlocks);
      if (typeof app.vault.process === "function") {
        await app.vault.process(dumpFile, rewrite);
      } else {
        await app.vault.modify(dumpFile, rewrite(await app.vault.read(dumpFile)));
      }
      new Notice(`\u{1F389} Archived capture entries to "Quick Capture Archive ${yearMonth}.md" and reset dump!`, 6e3);
    } catch (error) {
      console.error("Clear Capture Dump Error:", error);
      new Notice(`\u274C Archive Error: ${error?.message || error}`, 5e3);
    }
  });
};
