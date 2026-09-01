/*
 * Triage Sweep
 * ------------
 * Triage is a decision, not a document. Tag any line in the capture dump with a
 * destination token and run this once — it files everything in one pass.
 *
 *   - i have to do laundry #do            -> today's daily note, under ✅ Tasks
 *   - https://boot.dev/... #learn         -> 04-Learning/boot.dev lessons.md
 *   - semantic commit messages #concept   -> 08-Concepts/semantic commit messages.md
 *   - lemme test #bin                     -> dropped (logged, never silently lost)
 *
 * Untagged lines are left exactly where they are. Swept lines move to the
 * Triaged log at the bottom of the dump, so nothing disappears without a trace.
 *
 * Run from QuickAdd (user script) or Templater.
 */

import type { QuickAddParams, RouteConfig } from './types';
import {
  DUMP_PATH,
  ROUTES,
  TriageCandidate,
  TriageResult,
  isTFile,
  getTodayStr,
  deriveTitle,
  buildNote,
  buildKanban,
  insertTask,
  parseDumpLines,
  updateDumpContent
} from './lib/triage';

async function uniquePath(app: any, folder: string, title: string): Promise<string> {
  let candidate = `${folder}/${title}.md`;
  let n = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = `${folder}/${title} ${n}.md`;
    n++;
    if (n > 50) break;
  }
  return candidate;
}

async function ensureFolder(app: any, folderPath: string): Promise<void> {
  if (!app.vault.getAbstractFileByPath(folderPath)) {
    try { await app.vault.createFolder(folderPath); } catch (e) { /* already exists */ }
  }
}

async function fileItem(app: any, item: TriageCandidate, route: RouteConfig, todayStr: string): Promise<{ result: TriageResult; sweptIndex?: number }> {
  if (route.kind === "drop") {
    return { result: { item, destination: "dropped", ok: true }, sweptIndex: item.index };
  }

  if (route.kind === "task") {
    const dailyPath = `01-Daily/${todayStr}.md`;
    const dailyFile = app.vault.getAbstractFileByPath(dailyPath);

    if (!dailyFile || !isTFile(dailyFile)) {
      return { result: { item, ok: false, reason: `no daily note for ${todayStr}` } };
    }

    let inserted = false;
    if (typeof (app.vault as any).process === "function") {
      await (app.vault as any).process(dailyFile, (data: string) => {
        const out = insertTask(data, item.text);
        inserted = out.ok;
        return out.content;
      });
    } else {
      const data = await app.vault.read(dailyFile);
      const out = insertTask(data, item.text);
      inserted = out.ok;
      if (out.ok) await app.vault.modify(dailyFile, out.content);
    }

    if (!inserted) {
      return { result: { item, ok: false, reason: "no Tasks section in today's note" } };
    }

    return { result: { item, destination: dailyPath, ok: true }, sweptIndex: item.index };
  }

  const title = deriveTitle(item.text, todayStr);

  if (route.kind === "project") {
    const folder = `${route.folder}/${title}`;
    await ensureFolder(app, folder);
    const notePath = await uniquePath(app, folder, title);
    await app.vault.create(notePath, buildNote(route, title, item.text, item.capturedDate, todayStr));

    const kanbanPath = `${folder}/${title} Kanban.md`;
    if (!app.vault.getAbstractFileByPath(kanbanPath)) {
      await app.vault.create(kanbanPath, buildKanban(todayStr));
    }

    return { result: { item, destination: notePath, ok: true, extra: "+ Kanban" }, sweptIndex: item.index };
  }

  // Plain note routes
  if (route.folder) {
    await ensureFolder(app, route.folder);
    const notePath = await uniquePath(app, route.folder, title);
    await app.vault.create(notePath, buildNote(route, title, item.text, item.capturedDate, todayStr));

    return { result: { item, destination: notePath, ok: true }, sweptIndex: item.index };
  }

  return { result: { item, ok: false, reason: "invalid route" } };
}

export = async function triageSweep(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (window as any).app || (globalThis as any).app;
  const Notice = (window as any).Notice || (globalThis as any).Notice;

  if (!app) {
    console.error("Triage Sweep: no app instance available.");
    return;
  }

  const todayStr = getTodayStr();

  /* ======================================================================
     1. READ AND PARSE THE DUMP
     ====================================================================== */

  const dumpFile = app.vault.getAbstractFileByPath(DUMP_PATH);
  if (!dumpFile || !isTFile(dumpFile)) {
    new Notice(`⚠️ Triage Sweep: ${DUMP_PATH} not found.`);
    return;
  }

  const dumpRaw = await app.vault.read(dumpFile);
  const dumpLines = dumpRaw.split("\n");
  const picked = parseDumpLines(dumpLines);

  if (picked.length === 0) {
    new Notice(
      "Nothing tagged to sweep.\n\nAdd a token to any line in the capture dump — " +
      "#do #dev #concept #learn #ref #personal #project #bin — then run this again.",
      10000
    );
    return;
  }

  new Notice(`🧹 Triage Sweep: filing ${picked.length} item${picked.length === 1 ? "" : "s"}…`);

  /* ======================================================================
     2. FILE EACH ITEM
     ====================================================================== */

  const results: TriageResult[] = [];
  const sweptIndexes = new Set<number>();

  for (const item of picked) {
    const route = ROUTES[item.token];
    if (!route) continue;

    try {
      const { result, sweptIndex } = await fileItem(app, item, route, todayStr);
      results.push(result);
      if (sweptIndex !== undefined) {
        sweptIndexes.add(sweptIndex);
      }
    } catch (e: any) {
      console.error(`Triage Sweep: failed on "${item.text}"`, e);
      results.push({ item, ok: false, reason: e?.message ? e.message : String(e) });
    }
  }

  /* ======================================================================
     3. REWRITE THE DUMP
     ====================================================================== */

  if (sweptIndexes.size > 0) {
    const nextDump = updateDumpContent(dumpLines, results, sweptIndexes, todayStr);

    if (typeof (app.vault as any).process === "function") {
      await (app.vault as any).process(dumpFile, () => nextDump);
    } else {
      await app.vault.modify(dumpFile, nextDump);
    }
  }

  /* ======================================================================
     4. REPORT
     ====================================================================== */

  const filed = results.filter(r => r.ok && r.destination !== "dropped");
  const tasks = results.filter(r => r.ok && r.destination && r.destination.startsWith("01-Daily"));
  const dropped = results.filter(r => r.ok && r.destination === "dropped");
  const failed = results.filter(r => !r.ok);

  console.log("Triage Sweep results:", results.map(r => ({
    text: r.item.text,
    token: r.item.token,
    to: r.ok ? r.destination : "FAILED: " + r.reason
  })));

  const parts: string[] = [];
  if (tasks.length) parts.push(`${tasks.length} to today's tasks`);
  const notes = filed.length - tasks.length;
  if (notes > 0) parts.push(`${notes} note${notes === 1 ? "" : "s"} created`);
  if (dropped.length) parts.push(`${dropped.length} dropped`);
  if (failed.length) parts.push(`${failed.length} skipped`);

  new Notice(
    `✨ Triage Sweep: ${parts.join(", ")}.` +
    (failed.length ? `\n\nSkipped: ${failed.map(f => f.reason).join("; ")}` : ""),
    failed.length ? 12000 : 7000
  );
};
