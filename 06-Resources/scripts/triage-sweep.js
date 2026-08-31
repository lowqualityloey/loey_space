// 06-Resources/scripts/src/triage-sweep.ts
function isTFile(file) {
  return Boolean(file && typeof file === "object" && "extension" in file && "path" in file);
}
module.exports = async function triageSweep(params) {
  const app = params?.app || window.app || globalThis.app;
  const Notice = window.Notice || globalThis.Notice;
  if (!app) {
    console.error("Triage Sweep: no app instance available.");
    return;
  }
  const DUMP_PATH = "00-Inbox/quick-capture-dump.md";
  const ARCHIVE_SWEPT_LINES = true;
  const TRIAGED_HEADING = "## \u2705 Triaged";
  const ROUTES = {
    do: { kind: "task" },
    bin: { kind: "drop" },
    dev: { kind: "note", folder: "03-Dev", type: "snippet", area: "dev", status: "active" },
    concept: { kind: "note", folder: "08-Concepts", type: "concept", area: "general", status: "active", review: "90d" },
    learn: { kind: "note", folder: "04-Learning", type: "learning", area: "learning", status: "in-progress", review: "30d" },
    ref: { kind: "note", folder: "06-Resources", type: "resource", area: "resources", status: "active" },
    personal: { kind: "note", folder: "05-Personal", type: "personal", area: "personal", status: "active" },
    project: { kind: "project", folder: "02-Projects", type: "project", area: "dev", status: "planning", review: "14d" }
  };
  const TOKEN_RE = new RegExp("#(" + Object.keys(ROUTES).join("|") + ")\\b", "i");
  const TIME_CODE_RE = /`\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\s*`/gi;
  const pad = (n) => String(n).padStart(2, "0");
  const today = /* @__PURE__ */ new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  function sanitizeTitle(text) {
    let clean = String(text).replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().replace(/[.,;:\-–—]+$/, "").trim();
    if (clean.length > 60)
      clean = clean.slice(0, 60).trim();
    return clean;
  }
  function deriveTitle(text) {
    const urlMatch = text.match(/https?:\/\/\S+/);
    const withoutUrl = urlMatch ? text.replace(urlMatch[0], "") : text;
    const hasWords = withoutUrl.replace(/[^\p{L}\p{N}]/gu, "").length >= 4;
    if (urlMatch && !hasWords) {
      try {
        const url = new URL(urlMatch[0]);
        const host = url.hostname.replace(/^www\./, "");
        const segment = url.pathname.split("/").filter(Boolean)[0] || "";
        const readable = segment && segment.length <= 24 ? " " + segment.replace(/[-_]+/g, " ") : "";
        return sanitizeTitle(host + readable);
      } catch (e) {
      }
    }
    return sanitizeTitle(hasWords ? withoutUrl : text) || "Capture " + todayStr;
  }
  async function uniquePath(folder, title) {
    let candidate = `${folder}/${title}.md`;
    let n = 2;
    while (app.vault.getAbstractFileByPath(candidate)) {
      candidate = `${folder}/${title} ${n}.md`;
      n++;
      if (n > 50)
        break;
    }
    return candidate;
  }
  async function ensureFolder(folderPath) {
    if (!app.vault.getAbstractFileByPath(folderPath)) {
      try {
        await app.vault.createFolder(folderPath);
      } catch (e) {
      }
    }
  }
  function buildNote(route, title, text, noteCapturedDate) {
    const url = (text.match(/https?:\/\/\S+/) || [])[0] || "";
    const tags = [`type/${route.type}`, `area/${route.area}`];
    if (route.status)
      tags.push(`status/${route.status}`);
    const front = [
      "---",
      `created: ${todayStr}`,
      `updated: ${todayStr}`
    ];
    if (route.review) {
      front.push(`last_reviewed: ${todayStr}`);
      front.push(`review_cycle: ${route.review}`);
    }
    front.push(`type: ${route.type}`);
    front.push(`status: ${route.status}`);
    front.push(`area: ${route.area}`);
    if (route.type === "project")
      front.push("priority: medium");
    front.push(`source: quick-capture`);
    if (noteCapturedDate)
      front.push(`captured: ${noteCapturedDate}`);
    front.push("tags:");
    tags.forEach((t) => front.push(`  - ${t}`));
    front.push("---");
    const body = [
      "",
      `# ${title}`,
      ""
    ];
    if (route.type === "resource") {
      body.push(`**Resource URL**: ${url}`);
      body.push("");
    }
    body.push("## Capture");
    body.push(`- ${text}`);
    body.push("");
    body.push("## Notes");
    body.push("- ");
    body.push("");
    body.push("## \u{1F517} Related References");
    body.push("- [[ ]]");
    body.push("");
    body.push(`> [!NOTE] Triaged from quick capture${noteCapturedDate ? " on " + noteCapturedDate : ""}. Expand when you next touch this.`);
    body.push("");
    return front.join("\n") + body.join("\n");
  }
  function buildKanban() {
    return [
      "---",
      "",
      "kanban-plugin: board",
      `updated: ${todayStr}`,
      "",
      "---",
      "",
      "## Backlog",
      "",
      "## To Do",
      "",
      "## In Progress",
      "",
      "## Review / Test",
      "",
      "## Done",
      "",
      "## Archive",
      "",
      "%% kanban:settings",
      "```",
      '{"kanban-plugin":"board"}',
      "```",
      "%%",
      ""
    ].join("\n");
  }
  function insertTask(content, text) {
    const lines = content.split("\n");
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^#{2,4}\s+.*\bTasks\b/i.test(lines[i])) {
        start = i;
        break;
      }
    }
    if (start === -1)
      return { content, ok: false };
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{1,6}\s+/.test(lines[i]) || /^---+\s*$/.test(lines[i])) {
        end = i;
        break;
      }
    }
    for (let i = start + 1; i < end; i++) {
      if (/^\s*-\s*\[\s?\]\s*$/.test(lines[i])) {
        lines[i] = `- [ ] ${text}`;
        return { content: lines.join("\n"), ok: true };
      }
    }
    let insertAt = start + 1;
    for (let i = start + 1; i < end; i++) {
      if (/^\s*-\s*\[/.test(lines[i]))
        insertAt = i + 1;
      else if (/^\s*>/.test(lines[i]) && insertAt === start + 1)
        insertAt = i + 1;
    }
    lines.splice(insertAt, 0, `- [ ] ${text}`);
    return { content: lines.join("\n"), ok: true };
  }
  const dumpFile = app.vault.getAbstractFileByPath(DUMP_PATH);
  if (!dumpFile || !isTFile(dumpFile)) {
    new Notice(`\u26A0\uFE0F Triage Sweep: ${DUMP_PATH} not found.`);
    return;
  }
  const dumpRaw = await app.vault.read(dumpFile);
  const dumpLines = dumpRaw.split("\n");
  const picked = [];
  let inTriaged = false;
  let capturedDate = "";
  for (let i = 0; i < dumpLines.length; i++) {
    const line = dumpLines[i];
    if (/^##\s+.*Triaged/i.test(line)) {
      inTriaged = true;
      continue;
    } else if (/^##\s+/.test(line)) {
      inTriaged = false;
    }
    if (inTriaged)
      continue;
    const heading = line.match(/^###\s+.*?(\d{4}-\d{2}-\d{2})/);
    if (heading) {
      capturedDate = heading[1];
      continue;
    }
    if (!/^\s*-\s+\S/.test(line))
      continue;
    const token = line.match(TOKEN_RE);
    if (!token)
      continue;
    const text = line.replace(/^\s*-\s+/, "").replace(TOKEN_RE, "").replace(TIME_CODE_RE, "").replace(/\s+/g, " ").trim();
    if (!text)
      continue;
    picked.push({ index: i, token: token[1].toLowerCase(), text, capturedDate });
  }
  if (picked.length === 0) {
    new Notice(
      "Nothing tagged to sweep.\n\nAdd a token to any line in the capture dump \u2014 #do #dev #concept #learn #ref #personal #project #bin \u2014 then run this again.",
      1e4
    );
    return;
  }
  new Notice(`\u{1F9F9} Triage Sweep: filing ${picked.length} item${picked.length === 1 ? "" : "s"}\u2026`);
  const results = [];
  const sweptIndexes = /* @__PURE__ */ new Set();
  for (const item of picked) {
    const route = ROUTES[item.token];
    if (!route)
      continue;
    try {
      if (route.kind === "drop") {
        results.push({ item, destination: "dropped", ok: true });
        sweptIndexes.add(item.index);
        continue;
      }
      if (route.kind === "task") {
        const dailyPath = `01-Daily/${todayStr}.md`;
        const dailyFile = app.vault.getAbstractFileByPath(dailyPath);
        if (!dailyFile || !isTFile(dailyFile)) {
          results.push({ item, ok: false, reason: `no daily note for ${todayStr}` });
          continue;
        }
        let inserted = false;
        if (typeof app.vault.process === "function") {
          await app.vault.process(dailyFile, (data) => {
            const out = insertTask(data, item.text);
            inserted = out.ok;
            return out.content;
          });
        } else {
          const data = await app.vault.read(dailyFile);
          const out = insertTask(data, item.text);
          inserted = out.ok;
          if (out.ok)
            await app.vault.modify(dailyFile, out.content);
        }
        if (!inserted) {
          results.push({ item, ok: false, reason: "no Tasks section in today's note" });
          continue;
        }
        results.push({ item, destination: dailyPath, ok: true });
        sweptIndexes.add(item.index);
        continue;
      }
      const title = deriveTitle(item.text);
      if (route.kind === "project") {
        const folder = `${route.folder}/${title}`;
        await ensureFolder(folder);
        const notePath = await uniquePath(folder, title);
        await app.vault.create(notePath, buildNote(route, title, item.text, item.capturedDate));
        const kanbanPath = `${folder}/${title} Kanban.md`;
        if (!app.vault.getAbstractFileByPath(kanbanPath)) {
          await app.vault.create(kanbanPath, buildKanban());
        }
        results.push({ item, destination: notePath, ok: true, extra: "+ Kanban" });
        sweptIndexes.add(item.index);
        continue;
      }
      if (route.folder) {
        await ensureFolder(route.folder);
        const notePath = await uniquePath(route.folder, title);
        await app.vault.create(notePath, buildNote(route, title, item.text, item.capturedDate));
        results.push({ item, destination: notePath, ok: true });
        sweptIndexes.add(item.index);
      }
    } catch (e) {
      console.error(`Triage Sweep: failed on "${item.text}"`, e);
      results.push({ item, ok: false, reason: e?.message ? e.message : String(e) });
    }
  }
  if (sweptIndexes.size > 0) {
    const kept = [];
    const logEntries = [];
    for (let i = 0; i < dumpLines.length; i++) {
      if (!sweptIndexes.has(i)) {
        kept.push(dumpLines[i]);
        continue;
      }
      const result = results.find((r) => r.item.index === i && r.ok);
      if (!result) {
        kept.push(dumpLines[i]);
        continue;
      }
      if (ARCHIVE_SWEPT_LINES) {
        const target = result.destination === "dropped" ? "dropped" : `[[${(result.destination || "").replace(/^.*\//, "").replace(/\.md$/, "")}]]`;
        logEntries.push(`- ~~${result.item.text}~~ \u2192 ${target} \`#${result.item.token}\``);
      }
    }
    const pruned = [];
    for (let i = 0; i < kept.length; i++) {
      const isDateHeading = /^###\s+.*?\d{4}-\d{2}-\d{2}/.test(kept[i]);
      if (!isDateHeading) {
        pruned.push(kept[i]);
        continue;
      }
      let hasItems = false;
      for (let j = i + 1; j < kept.length; j++) {
        if (/^#{2,3}\s+/.test(kept[j]))
          break;
        if (/^\s*-\s+\S/.test(kept[j])) {
          hasItems = true;
          break;
        }
      }
      if (hasItems)
        pruned.push(kept[i]);
    }
    let nextDump = pruned.join("\n").replace(/\n{4,}/g, "\n\n\n");
    if (ARCHIVE_SWEPT_LINES && logEntries.length > 0) {
      const block = `### \u{1F4C5} ${todayStr}
${logEntries.join("\n")}`;
      if (nextDump.includes(TRIAGED_HEADING)) {
        nextDump = nextDump.replace(/\s*$/, "") + "\n\n" + block + "\n";
      } else {
        nextDump = nextDump.replace(/\s*$/, "") + `

---

${TRIAGED_HEADING}
> _Swept out of the inbox. Kept as a record of where things went._

` + block + "\n";
      }
    }
    if (typeof app.vault.process === "function") {
      await app.vault.process(dumpFile, () => nextDump);
    } else {
      await app.vault.modify(dumpFile, nextDump);
    }
  }
  const filed = results.filter((r) => r.ok && r.destination !== "dropped");
  const tasks = results.filter((r) => r.ok && r.destination && r.destination.startsWith("01-Daily"));
  const dropped = results.filter((r) => r.ok && r.destination === "dropped");
  const failed = results.filter((r) => !r.ok);
  console.log("Triage Sweep results:", results.map((r) => ({
    text: r.item.text,
    token: r.item.token,
    to: r.ok ? r.destination : "FAILED: " + r.reason
  })));
  const parts = [];
  if (tasks.length)
    parts.push(`${tasks.length} to today's tasks`);
  const notes = filed.length - tasks.length;
  if (notes > 0)
    parts.push(`${notes} note${notes === 1 ? "" : "s"} created`);
  if (dropped.length)
    parts.push(`${dropped.length} dropped`);
  if (failed.length)
    parts.push(`${failed.length} skipped`);
  new Notice(
    `\u2728 Triage Sweep: ${parts.join(", ")}.` + (failed.length ? `

Skipped: ${failed.map((f) => f.reason).join("; ")}` : ""),
    failed.length ? 12e3 : 7e3
  );
};
