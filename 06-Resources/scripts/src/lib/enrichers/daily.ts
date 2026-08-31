import type { App, TFile } from 'obsidian';
import { callGeminiJson, formatGeminiFailure } from '../gemini';
import {
  readFrontmatterValue,
  formatDate,
  previousDateStr,
  toSingleLine,
  escapeReplacement,
  normalizeWikiLink,
  wikiLinkTarget,
  replaceSectionBody,
  stripTaskMetadata,
  asSentence,
  capitalise
} from '../markdown';

// Drops a leading clock time so a log line can be dropped into a sentence.
function stripTimestamp(entry: any): string {
  return String(entry)
    .replace(/^\s*\d{1,2}[:.]?\d{0,2}\s*(am|pm|nn|hrs?)?\s*[:\-–]?\s*/i, "")
    .trim() || String(entry).trim();
}

// Finds the largest untracked gap between timestamped log entries.
function largestLogGap(entries: any[]): { from: string; to: string; hours: number } | null {
  const times: Array<{ minutes: number; label: string }> = [];

  for (const entry of entries) {
    const match = String(entry).match(/(\d{1,2})[:.](\d{2})\s*(am|pm|nn)?|(\d{1,2})\s*(am|pm|nn)/i);
    if (!match) continue;

    let hour: number, minute: number, suffix: string;
    if (match[1] !== undefined) {
      hour = parseInt(match[1], 10);
      minute = parseInt(match[2], 10);
      suffix = (match[3] || "").toLowerCase();
    } else {
      hour = parseInt(match[4], 10);
      minute = 0;
      suffix = (match[5] || "").toLowerCase();
    }
    if (isNaN(hour)) continue;

    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "nn" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;

    times.push({
      minutes: hour * 60 + minute,
      label: `${String(hour % 12 === 0 ? 12 : hour % 12)}${minute ? ":" + String(minute).padStart(2, "0") : ""}${hour >= 12 ? "pm" : "am"}`
    });
  }

  if (times.length < 2) return null;
  times.sort((a, b) => a.minutes - b.minutes);

  let widest: { span: number; from: string; to: string } | null = null;
  for (let i = 1; i < times.length; i++) {
    const span = times[i].minutes - times[i - 1].minutes;
    if (span >= 120 && (!widest || span > widest.span)) {
      widest = { span: span, from: times[i - 1].label, to: times[i].label };
    }
  }

  if (!widest) return null;
  return { from: widest.from, to: widest.to, hours: Math.round(widest.span / 60) };
}

export interface ParsedGitHubRow {
  time: string;
  repo: string;
  type: string;
  details: string;
}

export function parseGitHubCalloutFromNote(content: string): ParsedGitHubRow[] {
  const match = content.match(/> \[!NOTE\]-\s*🐙 GitHub Activity Log[\s\S]*?(?=\r?\n\r?\n|\r?\n#{1,6} |\r?\n---[ \t]*\r?\n|(?![\s\S]))/);
  if (!match) return [];

  const rows: ParsedGitHubRow[] = [];
  const lines = match[0].split('\n');

  for (const line of lines) {
    if (!line.includes('|') || line.includes(':---') || line.includes('Message / Details') || line.includes('[!NOTE]')) continue;
    const parts = line.replace(/^>\s*\|?/, '').replace(/\|?\s*$/, '').split('|').map(s => s.trim());
    if (parts.length >= 4) {
      rows.push({
        time: parts[0],
        repo: parts[1].replace(/`/g, ''),
        type: parts[2],
        details: parts[3]
      });
    }
  }

  return rows;
}

export function extractGitHubSummary(rows: ParsedGitHubRow[], dailyLog: string[]): string {
  const repoActivity: Record<string, { pushes: number; prs: number; issues: number; highlights: string[] }> = {};

  // 1. Process structured table rows
  for (const r of rows) {
    const repo = r.repo;
    if (!repoActivity[repo]) repoActivity[repo] = { pushes: 0, prs: 0, issues: 0, highlights: [] };

    if (r.type.includes('Push')) {
      repoActivity[repo].pushes++;
      if (r.details && !r.details.startsWith('Pushed commits')) repoActivity[repo].highlights.push(r.details);
    } else if (r.type.includes('PR')) {
      repoActivity[repo].prs++;
      if (r.details && !r.details.startsWith('Pull Request')) repoActivity[repo].highlights.push(`PR: ${r.details}`);
    } else if (r.type.includes('Issue')) {
      repoActivity[repo].issues++;
      if (r.details) repoActivity[repo].highlights.push(`Issue: ${r.details}`);
    }
  }

  // 2. Process raw bullets if table wasn't present
  if (rows.length === 0) {
    for (const entry of dailyLog) {
      const pushMatch = entry.match(/🐙\s*\*\*Push\*\*\s*\(`([^`]+)`\s*→\s*`([^`]+)`\)(?::\s*(.*))?/i);
      const prMatch = entry.match(/🔀\s*\*\*PR\s*([^*]+)\*\*\s*\(`([^`]+)`(?:\s*#(\d+))?\)(?::\s*(.*))?/i);
      const issueMatch = entry.match(/🎯\s*\*\*Issue\s*([^*]+)\*\*\s*\(`([^`]+)`(?:\s*#(\d+))?\)(?::\s*(.*))?/i);

      if (pushMatch) {
        const repo = pushMatch[1];
        if (!repoActivity[repo]) repoActivity[repo] = { pushes: 0, prs: 0, issues: 0, highlights: [] };
        repoActivity[repo].pushes++;
        if (pushMatch[3]) repoActivity[repo].highlights.push(pushMatch[3]);
      } else if (prMatch) {
        const repo = prMatch[2];
        if (!repoActivity[repo]) repoActivity[repo] = { pushes: 0, prs: 0, issues: 0, highlights: [] };
        repoActivity[repo].prs++;
        if (prMatch[4]) repoActivity[repo].highlights.push(`PR: ${prMatch[4]}`);
      } else if (issueMatch) {
        const repo = issueMatch[2];
        if (!repoActivity[repo]) repoActivity[repo] = { pushes: 0, prs: 0, issues: 0, highlights: [] };
        repoActivity[repo].issues++;
        if (issueMatch[4]) repoActivity[repo].highlights.push(`Issue: ${issueMatch[4]}`);
      }
    }
  }

  const repoNames = Object.keys(repoActivity);
  if (repoNames.length === 0) return "";

  return repoNames.map((r) => {
    const act = repoActivity[r];
    const parts: string[] = [];
    if (act.pushes) parts.push(`${act.pushes} push(es)`);
    if (act.prs) parts.push(`${act.prs} PR(s)`);
    if (act.issues) parts.push(`${act.issues} issue(s)`);
    const hl = act.highlights.slice(0, 3).join("; ");
    return `- \`${r}\`: ${parts.join(", ")}${hl ? ` (${hl})` : ""}`;
  }).join("\n");
}

function detectLateSession(dailyLog: string[], gitRows: ParsedGitHubRow[], checkedHabits: string[]): { isLate: boolean; latestTime: string; missedDisconnect: boolean } {
  let isLate = false;
  let latestTime = "";

  const allTimeStrings: string[] = [];
  for (const entry of dailyLog) {
    const m = entry.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m) allTimeStrings.push(`${m[1]}:${m[2]} ${m[3]}`);
  }
  for (const r of gitRows) {
    if (r.time) allTimeStrings.push(r.time);
  }

  for (const tStr of allTimeStrings) {
    const match = tStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;

      if (hour > 19 || (hour === 19 && minute >= 30)) {
        isLate = true;
        latestTime = `${match[1]}:${match[2]} ${ampm}`;
      }
    }
  }

  const missedDisconnect = !checkedHabits.some(h => h.toLowerCase().includes("disconnect"));
  return { isLate, latestTime, missedDisconnect };
}

function buildDailyFallback(d: any) {
  const energyNum = parseFloat(d.energy);
  const done = d.completedTasks.length;
  const open = d.unfinishedTasks.length;
  const logged = d.dailyLog.length + (d.gitRows?.length || 0);
  const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

  const COMFORT_HINTS = [
    "coffee", "matcha", "tea", "lunch", "dinner", "breakfast", "sushi", "ate", "eating",
    "food", "walk", "nap", "rest", "shower", "music", "game", "played"
  ];
  const comfort = d.dailyLog.find((entry: string) => COMFORT_HINTS.some(word => entry.toLowerCase().includes(word))) || "";

  let vibe: string;
  if (d.gitRows?.length > 0) {
    vibe = asSentence(`High developer momentum shipping across ${d.gitRows.length} GitHub events despite a demanding day`);
  } else if (logged >= 2) {
    const first = stripTimestamp(d.dailyLog[0]);
    const last = stripTimestamp(d.dailyLog[d.dailyLog.length - 1]);
    vibe = asSentence(`A day that went from ${first} to ${last}`);
  } else if (d.isDepleted) {
    vibe = "Running on fumes today — short sleep, low energy.";
  } else if (done && open) {
    vibe = asSentence(`Closed ${done} thing${done === 1 ? "" : "s"}, left ${open} on the table`);
  } else if (done) {
    vibe = "Quiet day, but things actually got finished.";
  } else {
    vibe = "A thin day on the record — not much made it into the log.";
  }

  const moved: string[] = [];
  if (d.gitSummary) {
    moved.push(asSentence(`Shipped major code milestones: ${d.gitSummary.replace(/^-\s*/, '')}`));
  } else if (done) {
    moved.push(asSentence(`Closed ${d.completedTasks.slice(0, 2).join(" and ")}`));
  }
  if (d.userReflectionLog.length) moved.push(asSentence(`Key takeaway: ${d.userReflectionLog[0]}`));
  else if (d.winsLog.length) moved.push(asSentence(d.winsLog[0]));

  const coping = comfort ? asSentence(stripTimestamp(comfort)) : "";

  const missedHabits = ["water", "prioritised", "move", "read", "tidy", "disconnect"]
    .filter((habit: string) => !d.checkedHabits.some((kept: string) => kept.toLowerCase().includes(habit)));

  let pattern: string;
  if (d.checkedHabits.length && missedHabits.length) {
    pattern = asSentence(
      `${d.checkedHabits.join(", ")} got ticked; ${missedHabits.join(", ")} didn't — the ones needing a clear head are the ones that slipped${d.energy ? `, even at energy ${d.energy}` : ""}`
    );
  } else if (d.checkedHabits.length === d.habitTotal) {
    pattern = asSentence(`All ${d.habitTotal} habits held${done ? ` and ${done} task${done === 1 ? "" : "s"} closed` : ""}`);
  } else if (open) {
    pattern = asSentence(`${open} ${plural(open, "task", "tasks")} still open and no habit ticked — the day never found a rhythm`);
  } else {
    pattern = "Not enough logged to read a pattern yet.";
  }

  const gap = largestLogGap(d.dailyLog);
  let friction: string;
  if (d.blockersLog.length) {
    friction = asSentence(d.blockersLog[0]);
  } else if (d.lateSession?.isLate && d.lateSession?.missedDisconnect) {
    friction = asSentence(`High coding momentum ran late until ${d.lateSession.latestTime} while the disconnect habit was unticked`);
  } else if (gap) {
    friction = `Nothing logged between ${gap.from} and ${gap.to} — about ${gap.hours} ${gap.hours === 1 ? "hour" : "hours"} that went untracked.`;
  } else if (d.isDepleted) {
    friction = asSentence(`Under 6 hours of sleep with energy at ${d.energy} of 5 caps what was available`);
  } else if (d.forwardedTasks.length) {
    friction = asSentence(`${d.forwardedTasks.length} ${plural(d.forwardedTasks.length, "task", "tasks")} showed up already forwarded from an earlier day`);
  } else {
    friction = "Nothing obvious got in the way today.";
  }

  let insight: string;
  if (d.isDepleted) {
    insight = "Short sleep and low energy together mean the ceiling was physical, not a discipline problem.";
  } else if (d.lateSession?.isLate && d.lateSession?.missedDisconnect) {
    insight = asSentence(`Late evening velocity was productive, but skipped wind-down makes tomorrow morning vulnerable to fatigue`);
  } else if (d.gitRows?.length > 0 && d.isDepleted) {
    insight = "High code output while physically depleted shows great technical grit, but recovery is needed to sustain it.";
  } else if (open > done && done > 0) {
    insight = "More was left open than closed, which usually means the tasks were scoped too big for one sitting.";
  } else {
    insight = "Not enough signal today to draw a non-obvious connection.";
  }

  let nextStep: string;
  const highPriority = d.unfinishedTasks.find((t: string) => /#priority\/(p0|p1|high)/i.test(t));
  if (highPriority) {
    nextStep = `Try starting with "${highPriority}" first thing because it is your top priority open milestone.`;
  } else if (open) {
    nextStep = `Try starting with "${d.unfinishedTasks[0]}" first thing because it's still open after today.`;
  } else {
    nextStep = "Try picking one clear priority target before opening code tomorrow.";
  }
  if (d.sleepDebt) {
    nextStep += ` And on ${d.sleepHours} hours, keep tomorrow's list to one thing.`;
  }

  return {
    quote: "Small steps, taken today, are what tomorrow is built on.",
    author: "Daily Spark",
    vibe: vibe,
    moved: moved.slice(0, 2),
    coping: coping,
    pattern: pattern,
    friction: friction,
    insight: insight,
    nextStep: nextStep,
    connectedNotes: [`[[${d.yesterdayDate}]]`]
  };
}

export async function enrichDailyNote(app: App, file: TFile): Promise<void> {
  const Notice = (window as any).Notice || (globalThis as any).Notice;
  let content = await app.vault.read(file);
  new Notice("🤖 Gemini Flash is analyzing note & generating summary + reflection...");

  // 1. Extract Frontmatter Properties
  const mood = readFrontmatterValue(content, "mood");
  const energy = readFrontmatterValue(content, "energy");
  const sleepHours = readFrontmatterValue(content, "sleep_hours");

  const moodText = mood || "not logged";
  const energyText = energy ? `${energy} out of 5` : "not logged";
  const sleepText = sleepHours ? `${sleepHours} hours` : "not logged";

  // 2. Collect existing markdown note titles
  const existingNoteNames = app.vault.getMarkdownFiles()
    .map((f: TFile) => f.basename)
    .filter((name: string) => name && !name.startsWith('_') && name.length > 2 && !name.match(/^\d{4}-\d{2}-\d{2}/));

  const existingNotesListStr = existingNoteNames.slice(0, 60).join(", ");

  // 3. Extract GitHub callout table rows
  const gitRows = parseGitHubCalloutFromNote(content);

  // 4. Extract clean structured user data from Daily.md template sections
  const lines = content.split('\n');
  const focusItems: string[] = [];
  const completedTasks: string[] = [];
  const unfinishedTasks: string[] = [];
  const forwardedTasks: string[] = [];
  const checkedHabits: string[] = [];
  const dailyLog: string[] = [];
  const ideas: string[] = [];
  const winsLog: string[] = [];
  const blockersLog: string[] = [];
  const userReflectionLog: string[] = [];

  const HABIT_RITUALS = ["water", "prioritised", "move", "read", "tidy", "disconnect"];

  let currentSec = "";
  let inFrontmatter = false;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (i === 0 && trimmed === "---") { inFrontmatter = true; continue; }
    if (inFrontmatter) {
      if (trimmed === "---") inFrontmatter = false;
      continue;
    }

    if (trimmed.startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;

    if (/^#{1,6}\s+/.test(trimmed)) {
      currentSec = trimmed;
      continue;
    }

    if (/^---+$/.test(trimmed)) { currentSec = ""; continue; }

    if (!trimmed || /^[-*+]$/.test(trimmed) || /^[-*+]\s*\[[ xX]\]$/.test(trimmed)) continue;
    if (trimmed.startsWith(">") || trimmed.startsWith("|")) continue;
    if (trimmed.startsWith("Define your focus") || trimmed.startsWith("Things I need") ||
        trimmed.startsWith("Daily basics") || trimmed.startsWith("Something positive") ||
        trimmed.startsWith("What got in my way") || trimmed.startsWith("What did I learn") ||
        trimmed.startsWith("What did I do today") || trimmed.startsWith("What patterns do I notice") ||
        trimmed.startsWith("Based on today") || trimmed.startsWith("What's the 1-3 things")) {
      continue;
    }

    if (currentSec.includes("Focus")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").replace(/^\[[ xX]\]\s*/, "").trim();
      if (cleanItem && !focusItems.includes(cleanItem)) focusItems.push(cleanItem);
    } else if (currentSec.includes("Tasks")) {
      const doneMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
      const fwdMatch = trimmed.match(/^\s*-\s*\[>\]\s+(.*)$/);
      const openMatch = trimmed.match(/^\s*-\s*\[ \]\s+(.*)$/);

      if (doneMatch && stripTaskMetadata(doneMatch[1])) {
        const itemText = stripTaskMetadata(doneMatch[1]);
        if (!completedTasks.includes(itemText)) completedTasks.push(itemText);
      } else if (fwdMatch && stripTaskMetadata(fwdMatch[1])) {
        const itemText = stripTaskMetadata(fwdMatch[1]);
        if (!forwardedTasks.includes(itemText)) forwardedTasks.push(itemText);
      } else if (openMatch && stripTaskMetadata(openMatch[1]) && stripTaskMetadata(openMatch[1]) !== "..." && stripTaskMetadata(openMatch[1]) !== "None") {
        const itemText = stripTaskMetadata(openMatch[1]);
        if (!unfinishedTasks.includes(itemText)) unfinishedTasks.push(itemText);
      }
    } else if (currentSec.includes("Ideas")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) ideas.push(cleanItem);
    } else if (currentSec.includes("Log") && !currentSec.includes("Blockers")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) dailyLog.push(cleanItem);
    } else if (currentSec.includes("Habits")) {
      const habitMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
      if (habitMatch && stripTaskMetadata(habitMatch[1])) {
        const habitText = stripTaskMetadata(habitMatch[1]);
        if (!checkedHabits.includes(habitText)) checkedHabits.push(habitText);
      }
    } else if (currentSec.includes("Wins")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) winsLog.push(cleanItem);
    } else if (currentSec.includes("Blockers")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) blockersLog.push(cleanItem);
    } else if (currentSec.includes("Reflection") && !currentSec.includes("AI Reflection")) {
      const cleanItem = trimmed.replace(/^[-*+]\s*/, "").trim();
      if (cleanItem.replace(/[^\w]/g, "")) userReflectionLog.push(cleanItem);
    }
  }

  // 5. Content completeness check
  const filledSectionCount = [
    focusItems.length,
    completedTasks.length + unfinishedTasks.length + forwardedTasks.length,
    checkedHabits.length,
    dailyLog.length + gitRows.length,
    ideas.length,
    winsLog.length,
    blockersLog.length,
    userReflectionLog.length
  ].filter(count => count > 0).length;

  if (filledSectionCount < 1) {
    new Notice("⚠️ Daily note is mostly empty! Log something in Focus, Tasks, Daily Log, Wins, Blockers or Reflection before generating the AI summary.", 7000);
    return;
  }

  // 6. Compute Developer & Pacing Signals
  const githubSummary = extractGitHubSummary(gitRows, dailyLog);
  const highPriorityTasks = unfinishedTasks.filter(t => /#priority\/(p0|p1|high)/i.test(t));
  const lateSession = detectLateSession(dailyLog, gitRows, checkedHabits);

  // 7. Load Gemini API Key from .env
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const geminiMatch = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (geminiMatch && !geminiMatch[1].includes("your_gemini")) geminiApiKey = geminiMatch[1].trim();
  } catch (e) {}

  const noteDate = (file.basename.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || formatDate(new Date());
  const yesterdayDate = previousDateStr(noteDate);

  const sleepNum = parseFloat(sleepHours);
  const energyNum = parseFloat(energy);
  const sleepDebt = !isNaN(sleepNum) && sleepNum < 6;
  const isDepleted = sleepDebt && !isNaN(energyNum) && energyNum < 3;

  const systemPrompt = [
    "You are this person's Daily Note Analyst and Executive Chief of Staff.",
    "You write like you're texting a smart friend: conversational, sharp, pragmatic, never clinical or therapeutic.",
    "You use direct action verbs, avoid repeating words across bullets, synthesize multi-project developer progress clearly, and never psychoanalyse.",
    "You never invent facts. You always answer with valid JSON only."
  ].join(" ");

  const userPromptText = `Analyse this day and fill the AI Daily Summary.

METADATA
Mood: ${moodText}
Energy: ${energyText}
Sleep: ${sleepText}

TODAY'S FOCUS (intentions)
${focusItems.length ? focusItems.map((f: string) => "- " + f).join("\n") : "- none written"}

TASKS
Completed: ${completedTasks.join(" | ") || "none"}
Still open: ${unfinishedTasks.join(" | ") || "none"}
High Priority Open Tasks: ${highPriorityTasks.join(" | ") || "none"}
Forwarded from an earlier day: ${forwardedTasks.join(" | ") || "none"}

DAILY LOG (personal notes)
${dailyLog.length ? dailyLog.map((l: string) => "- " + l).join("\n") : "- none logged"}

GITHUB DEVELOPER ACTIVITY (grouped by project)
${githubSummary || "- no GitHub events logged"}

PACING & RECOVERY SIGNALS
Late evening coding session (>7:30 PM): ${lateSession.isLate ? `YES (latest at ${lateSession.latestTime})` : "NO"}
Disconnect habit kept: ${!lateSession.missedDisconnect ? "YES" : "NO"}

HABITS
Kept ${checkedHabits.length} of ${HABIT_RITUALS.length}: ${checkedHabits.join(", ") || "none"}

IDEAS & FLEETING NOTES
${ideas.length ? ideas.map((i: string) => "- " + i).join("\n") : "- none"}

END OF DAY (written by them)
Wins: ${winsLog.join(" | ") || "none"}
Blockers: ${blockersLog.join(" | ") || "none"}
Reflection: ${userReflectionLog.join(" | ") || "none"}

EXISTING VAULT NOTES (the only valid link targets)
[${existingNotesListStr}]
Yesterday's daily note: ${yesterdayDate}

WHAT TO PRODUCE
"vibe": ONE casual sentence catching the day's narrative arc — e.g. "Started the day carrying heavy anxiety and debt worries, but turned it into a high-leverage build session across loey_space."
"moved": at most 2 distinct bullets on what actually moved forward. If GITHUB DEVELOPER ACTIVITY is present, cite specific project milestones (e.g. "Shipped Concept Distiller, Start Task action, and GitHub sync to loey_space" or "Merged PR #4"). DO NOT repeat concepts from vibe. Use direct active verbs ("Shipped...", "Completed...", "Finalized...").
"coping": ONE bullet on how they coped or self-regulated (food, habits, rituals). Only if it is actually in the log or habits; otherwise return an empty string.
"pattern": the repeated behaviour across tasks, log, and habits. Connect mood/energy to output and note how habits held up.
"friction": where the day lost momentum. Use Blockers or time gaps (e.g. hours lost waiting or sleep disruption).
"insight": one non-obvious connection, e.g. "Adopting a structured planning-before-coding workflow dramatically boosted shipping speed even while energy was low".
"nextStep": ONE small tactical move. If high priority tasks (#priority/p0 or p1) are open, anchor on the top priority task. Phrased "Try [action] because [reason from today]".${sleepDebt ? ` Sleep was under 6 hours, so this MUST acknowledge the sleep debt.` : ""}
"connectedNotes": start with "[[${yesterdayDate}]]" (always). Then ONLY notes explicitly named in their tasks, log or ideas. 2-5 links total.

HARD RULES
1. Never invent meetings, people, projects or tasks that are not written above.
2. Never use clinical or therapy language. Banned: "emotional distress", "interpersonal conflict", "significant impact", "well-being", "wellbeing", "restorative", "process your emotions", "process the conflict".
3. DO NOT repeat identical words or phrases across bullets (e.g. never say "felt powerful" twice).
4. Balance friction with resilience.
5. ${isDepleted ? `Sleep was under 6 hours AND energy under 3 — say plainly that capacity was capped, without turning it into a lecture.` : `Do not speculate about sleep or energy unless the numbers are notable.`}
6. Keep the WHOLE output under 150 words. Conversational and sharp, not clinical.
7. Never mention property names (mood, energy, sleep_hours, tags, frontmatter, JSON) or the words "template" or "section".
8. If a field above says "none" or "nothing logged", stay silent about it. Never point out that something is empty.
9. Every string is one single line: no bullets, headings or line breaks inside a value.

JSON format:
{
  "quote": "short original line that fits this specific day",
  "author": "Daily Spark",
  "vibe": "one casual sentence",
  "moved": ["...", "..."],
  "coping": "...",
  "pattern": "...",
  "friction": "...",
  "insight": "...",
  "nextStep": "Try ... because ...",
  "connectedNotes": ["[[${yesterdayDate}]]"]
}
`;

  let responseData: any = null;
  let usedFallback = false;
  let failureReason = "";

  if (geminiApiKey) {
    const result = await callGeminiJson(geminiApiKey, systemPrompt, userPromptText, "Daily Enrich", 0.7);
    if (result && result.data && (result.data.vibe || result.data.pattern)) {
      responseData = result.data;
      console.log(`Daily Enrich: generated with ${result.model}`);
    } else {
      failureReason = formatGeminiFailure(result && result.failure);
    }
  } else {
    failureReason = formatGeminiFailure({ status: 0, kind: "noKey", message: "GEMINI_API_KEY is missing from .env", retrySeconds: 0, model: "" });
  }

  if (!responseData) {
    usedFallback = true;
    responseData = buildDailyFallback({
      mood, energy, sleepHours, sleepDebt, isDepleted, focusItems, completedTasks,
      unfinishedTasks, forwardedTasks, checkedHabits, habitTotal: HABIT_RITUALS.length,
      dailyLog, ideas, winsLog, blockersLog, userReflectionLog, yesterdayDate,
      gitRows, gitSummary: githubSummary, lateSession
    });
  }

  const vibeText = toSingleLine(responseData.vibe);
  const movedLines = (Array.isArray(responseData.moved) ? responseData.moved : [])
    .map(toSingleLine).filter(Boolean).slice(0, 2);
  const copingText = toSingleLine(responseData.coping);
  const patternText = toSingleLine(responseData.pattern);
  const frictionText = toSingleLine(responseData.friction);
  const insightText = toSingleLine(responseData.insight);
  const nextStepText = toSingleLine(responseData.nextStep);

  responseData.quote = toSingleLine(responseData.quote) || "Small steps, taken today, are what tomorrow is built on.";
  responseData.author = toSingleLine(responseData.author) || "Daily Spark";

  const BANNED_PHRASES = [
    "emotional distress", "interpersonal conflict", "significant impact",
    "well-being", "wellbeing", "restorative", "process your emotions", "process the conflict"
  ];
  const generatedProse = [vibeText, movedLines.join(" "), copingText, patternText, frictionText, insightText, nextStepText]
    .join(" ").toLowerCase();
  const slips = BANNED_PHRASES.filter(phrase => generatedProse.includes(phrase));
  if (slips.length) console.warn(`Daily Enrich: clinical phrasing slipped through — ${slips.join(", ")}`);

  const validTargets = new Map<string, string>();
  app.vault.getMarkdownFiles().forEach((f: TFile) => validTargets.set(f.basename.toLowerCase(), f.basename));

  const userCorpus = ([] as string[]).concat(
    focusItems, completedTasks, unfinishedTasks, forwardedTasks,
    dailyLog, ideas, winsLog, blockersLog, userReflectionLog
  ).join(" \n ").toLowerCase();

  const isNamedByUser = (target: string): boolean => {
    const lower = target.toLowerCase();
    if (validTargets.has(lower) && userCorpus.includes(lower)) return true;
    const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter((word: string) => word.length >= 4);
    if (tokens.length === 0) return false;
    const hits = tokens.filter((word: string) => userCorpus.includes(word)).length;
    return hits >= 2;
  };

  const connectedLinks: string[] = [];
  const seenLinks = new Set<string>();

  const addConnected = (rawLink: any, force: boolean) => {
    const target = wikiLinkTarget(normalizeWikiLink(rawLink));
    if (!target) return;
    const key = target.toLowerCase();
    if (key === file.basename.toLowerCase() || seenLinks.has(key)) return;
    if (!force && !isNamedByUser(target)) {
      console.warn(`Daily Enrich: dropped link "[[${target}]]" — not named anywhere in the note`);
      return;
    }
    seenLinks.add(key);
    connectedLinks.push(`[[${validTargets.get(key) || target}]]`);
  };

  addConnected(`[[${yesterdayDate}]]`, true);
  (Array.isArray(responseData.connectedNotes) ? responseData.connectedNotes : []).forEach((link: any) => addConnected(link, false));
  while (connectedLinks.length > 5) connectedLinks.pop();

  const authorText = responseData.author ? `\n> — **${responseData.author}**` : "";
  const quoteCallout = `> [!QUOTE] 💡 Daily Spark\n> *"${responseData.quote}"*${authorText}`;

  if (content.includes("> [!QUOTE] 💡 Daily Spark")) {
    content = content.replace(
      /> \[!QUOTE\] 💡 Daily Spark[\s\S]*?(?=\r?\n\r?\n#{1,6} |\r?\n---[ \t]*\r?\n|(?![\s\S]))/,
      escapeReplacement(quoteCallout)
    );
  }

  const summaryLines = [vibeText].concat(movedLines).concat(copingText ? [copingText] : [])
    .filter(Boolean).map(line => `- ${line}`).join("\n");

  const reflectionLines = [
    patternText ? `- **Pattern:** ${patternText}` : "",
    frictionText ? `- **Friction:** ${frictionText}` : "",
    insightText ? `- **Insight:** ${insightText}` : ""
  ].filter(Boolean).join("\n");

  const nextStepLines = nextStepText ? `- ${nextStepText}` : "";

  const aiSummaryBlock = `## 🤖 AI Daily Summary

### Summary
>_What did I do today? Key activities, progress, and outcomes._
${summaryLines || "- "}

### AI Reflection
>_What patterns do I notice? What could I improve? Any insights or blind spots?_
${reflectionLines || "- "}

### **Suggested Next Step**
>_Based on today, what's the smartest move for tomorrow?_
${nextStepLines || "- "}`;

  const aiSectionRe = /^## 🤖 AI Daily Summary[\s\S]*?(?=^## |^---[ \t]*$|(?![\s\S]))/m;

  if (aiSectionRe.test(content)) {
    content = content.replace(aiSectionRe, escapeReplacement(aiSummaryBlock + "\n"));
  } else {
    content = content.replace(/\s*$/, "") + "\n\n" + aiSummaryBlock + "\n";
  }

  const connectedBlock = connectedLinks.map(link => `- ${link}`).join("\n");

  if (/^##### 🔗 Connected Notes[ \t]*$/m.test(content)) {
    content = replaceSectionBody(content, "##### 🔗 Connected Notes", connectedBlock);
  } else {
    content = content.replace(/\s*$/, "") + `\n\n---\n##### 🔗 Connected Notes\n${connectedBlock}\n`;
  }

  await app.vault.modify(file, content);

  const wordCount = generatedProse.split(/\s+/).filter(Boolean).length;
  console.log(`Daily Enrich: ${wordCount} words, ${connectedLinks.length} connected note(s)`);
  if (wordCount > 150) console.warn(`Daily Enrich: output ran to ${wordCount} words, over the 150-word target.`);

  if (usedFallback) {
    new Notice(
      `⚠️ No AI writing this time: ${failureReason}.\n\n` +
      `A basic offline summary was assembled from your logged items instead. Re-run the enricher once the limit clears to replace it with real AI analysis.`,
      12000
    );
  } else {
    new Notice("✨ Daily Note enriched: summary, reflection, next step & connected notes.");
  }
}
