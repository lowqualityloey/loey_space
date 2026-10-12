import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';
import { parseGeminiError, formatGeminiFailure, type GeminiFailure } from './lib/gemini';
import { stripTaskMetadata } from './lib/markdown';
import { buildWeeklyWindow, describeCoverage, selectWeeklyNotes } from './lib/weekly-window';
import {
  extractDailyData,
  summarizeWeek,
  describeWeekCoverage,
  describeHabitCoverage,
  formatHabitTrendsMarkdown,
  analyzeHabitTrends,
  isObservedDailyEntry,
  triageDailyCommitments,
} from './lib/weekly-extract';

interface WeeklySummaryJson {
  weeklyTitle?: string;
  executiveSummary?: string;
  keyAccomplishments?: string[];
  challengesFaced?: string[];
  productivityPatterns?: string[];
  moodEnergyTrends?: string[];
  habitAnalysis?: string[];
  topInsights?: string[];
  recommendations?: string[];
  weeklyQuote?: string;
}

async function weeklyAISummary(params?: QuickAddParams): Promise<void> {
  const app = params?.app || (window as any).app || (globalThis as any).app;
  const Notice = (window as any).Notice || (globalThis as any).Notice;

  new Notice("🤖 Generating weekly AI summary...");

  // 1. Load Gemini API Key from .env
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes("your_gemini")) geminiApiKey = match[1].trim();
  } catch (e) {}

  if (!geminiApiKey) {
    new Notice("⚠️ GEMINI_API_KEY missing in .env!");
    return;
  }

  // 2. Select the daily notes inside the declared review window (#57).
  //
  // The window is derived first and the notes are matched against it, so a
  // sparse week selects FEWER notes instead of reaching further back for
  // older ones to fill seven slots. Membership is the window's own paths, so a
  // file that is not a dated daily note cannot enter by name accident — the
  // measured case was `01-Daily/Tasks Kanban.md`, which the old name-blocklist
  // admitted and the name-sort placed first.
  const reviewWindow = buildWeeklyWindow(new Date());
  const recentNotes = selectWeeklyNotes(app.vault.getMarkdownFiles(), reviewWindow);
  const coverage = describeCoverage(reviewWindow, recentNotes.length);

  if (recentNotes.length === 0) {
    new Notice("⚠️ No daily notes found for weekly summary!");
    return;
  }

  // 3. Extract data from each daily note (in parallel)
  const weekDataResults = await Promise.all(
    recentNotes.map(async (note: TFile) => {
      try {
        const content = await app.vault.read(note);
        const noteDate = note.basename;

        // Extract key data from daily note
        return extractDailyData(content, noteDate);
      } catch (error) {
        console.warn(`Error reading note ${note.name}:`, error);
        return null;
      }
    })
  );

  const weekData = weekDataResults.filter((data): data is NonNullable<typeof data> => data !== null);

  // 3b. Summarise what the week actually contains (#58). Averages exclude
  // unknown readings and are returned with the coverage they rest on, so a
  // mean over two logged days cannot be read as a mean over seven.
  const weekSummary = summarizeWeek(weekData, reviewWindow.days);

  // 4. Prepare prompt for AI
  const systemPrompt = `You are an insightful personal coach and productivity analyst. Analyze weekly data and provide comprehensive insights with actionable recommendations.`;

  const userPrompt = `Analyze this weekly data and provide a comprehensive weekly review. Provide JSON only.

REVIEW WINDOW (the span these notes were selected from, and how much of it was logged):
from: ${reviewWindow.startDate}
to: ${reviewWindow.endDate}
calendar days: ${reviewWindow.days}
timezone: ${reviewWindow.timeZone}
coverage: ${coverage}
habit_review_coverage: ${describeHabitCoverage(weekSummary.habitTrends)}

WEEK SUMMARY (computed from the notes below; absent values are excluded from every average, and each coverage line states what its average rests on — do not present an average as covering more days than its coverage says, and do not treat morning-only or untouched scaffold notes as missed habits):
${JSON.stringify(weekSummary, null, 2)}

These notes were selected BY this window. Do not describe the week as more complete than the coverage says, and treat a day with no note as unknown rather than as a zero.

WEEKLY DATA:
${JSON.stringify(weekData, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Look for patterns in mood, energy, sleep, and productivity
2. Identify what worked well and what didn't
3. Notice task completion patterns
4. Analyze habit consistency
5. Identify key insights and blind spots
6. Provide specific, actionable recommendations

JSON FORMAT:
{
  "weeklyTitle": "1-2 word theme for the week",
  "executiveSummary": "1 paragraph overview of the week",
  "keyAccomplishments": ["3-5 bullet points of what went well"],
  "challengesFaced": ["2-3 bullet points of what was difficult"],
  "productivityPatterns": ["2-3 bullet points about work patterns"],
  "moodEnergyTrends": ["2-3 bullet points about mood/energy patterns"],
  "habitAnalysis": ["2-3 bullet points about habit consistency"],
  "topInsights": ["3-5 bullet points of key learnings"],
  "recommendations": ["3-5 specific, actionable recommendations for next week"],
  "weeklyQuote": "1-sentence inspirational quote relevant to the week"
}
`;

  // 5. Call Gemini API with model fallback and error classification
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
  let responseText = "";
  let failureReason: GeminiFailure | null = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
      const res = await requestUrl({
        url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        throw: false,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.5
          }
        })
      });

      if (res.status === 200) {
        const json = JSON.parse(res.text);
        if (json.candidates && json.candidates[0] && json.candidates[0].content) {
          responseText = json.candidates[0].content.parts[0].text.trim();
          if (responseText) {
            console.log(`Weekly AISummary generated using model: ${model}`);
            failureReason = null;
            break;
          }
        }
      } else {
        failureReason = parseGeminiError(res.status, res.text, model);
        console.warn(`Weekly Summary model ${model} HTTP ${res.status}:`, failureReason.message);
        if (failureReason.kind === "auth" || failureReason.kind === "badRequest") {
          console.warn(`Weekly Summary: aborting model fallback — ${failureReason.kind} affects all models`);
          break;
        }
      }
    } catch (e: any) {
      failureReason = { status: 0, kind: "network", message: e?.message ? e.message : String(e), retrySeconds: 0, model };
      console.warn(`Weekly Summary model ${model} warning:`, failureReason.message);
    }
  }

  if (!responseText) {
    const errorMsg = formatGeminiFailure(failureReason);
    new Notice(`⚠️ Failed to generate weekly AI summary: ${errorMsg}`);
    return;
  }


  // 6. Parse response and create weekly review note
  try {
    const cleanJsonText = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    const data = JSON.parse(cleanJsonText);

    // Create weekly review note using ISO-8601 week-year identity (F04)
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const { isoYear, isoWeekPadded, weekKey } = getIsoWeekParts(currentDate);

    const fileName = `${weekKey}.md`;
    const folderPath = "07-Reviews/";
    const fullPath = folderPath + fileName;

    // Check if file exists, create if not
    let existingFile = app.vault.getAbstractFileByPath(fullPath);
    let content = "";

    if (existingFile) {
      content = await app.vault.read(existingFile);
      // Append to existing weekly review
      content += "\n\n---\n\n## 🤖 AI Weekly Summary\n\n" + formatWeeklySummary(data);
    } else {
      // Create new weekly review (valid YAML frontmatter with explicit kind: weekly — F03)
      // The exact window this run analysed (#59) is written into `period_start` / `period_end`
      // as well as the body so statistics stay anchored to the analysed period.
      content = `---
created: ${year}-${month}-${day}
updated: ${year}-${month}-${day}
period_start: ${reviewWindow.startDate}
period_end: ${reviewWindow.endDate}
type: review
kind: weekly
status: active
area: general
tags:
  - type/review
  - area/general
  - status/active
  - period/weekly
---

# 📊 Weekly Review: Week ${isoWeekPadded}, ${isoYear}

**Period**: ${getWeekRange(currentDate)}
**Analysed window**: ${reviewWindow.startDate} to ${reviewWindow.endDate} (${reviewWindow.timeZone})
**Theme**: ${data.weeklyTitle || "Weekly Analysis"}

${coverage}
${describeWeekCoverage(weekSummary)}
${describeHabitCoverage(weekSummary.habitTrends)}

---

## 🤖 AI Weekly Summary

${formatWeeklySummary(data)}

---

## 📈 Weekly Metrics

### Daily Notes Analyzed
\`\`\`dataview
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)"
FROM "01-Daily"
WHERE file.day >= date(${reviewWindow.startDate}) AND file.day <= date(${reviewWindow.endDate})
SORT file.day DESC
\`\`\`

### Task Completion Rate
\`\`\`dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day >= dv.date("${reviewWindow.startDate}") && p.file.day <= dv.date("${reviewWindow.endDate}"));
let totalTasks = 0;
let completedTasks = 0;

pages.forEach(p => {
  if (p.file.tasks) {
    p.file.tasks.forEach(t => {
      if (t.text && t.text.trim() !== "") {
        const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
        if (!sec.includes("habit")) {
          totalTasks++;
          if (t.completed || t.status === "x") completedTasks++;
        }
      }
    });
  }
});

const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
dv.paragraph(\`**Task Completion Rate**: \${completionRate}% (\${completedTasks}/\${totalTasks} tasks)\`);
\`\`\`

### Habit Consistency
${formatHabitTrendsMarkdown(weekSummary.habitTrends)}

\`\`\`dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day >= dv.date("${reviewWindow.startDate}") && p.file.day <= dv.date("${reviewWindow.endDate}"));
const placeholders = new Set(["...", "\\u2026", "none", "n/a", "unknown"]);
const eveningHabits = new Set(["water", "move", "read", "tidy", "disconnect"]);
const coreHabits = new Set(["water", "prioritised", "move", "read", "tidy", "disconnect"]);
let observedDays = 0;
let completedHabits = 0;

pages.forEach(p => {
  const tasks = (p.file && p.file.tasks) ? p.file.tasks : [];
  const lists = (p.file && p.file.lists) ? p.file.lists : [];
  const habitTasks = tasks.filter(t => {
    const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
    return t.text && t.text.trim() !== "" && sec.includes("habit");
  });
  const checkedCore = new Set();
  habitTasks.forEach(t => {
    if (t.completed || t.status === "x" || t.status === "X") {
      const name = t.text.trim().toLowerCase().split(/\\s+/)[0];
      if (coreHabits.has(name)) checkedCore.add(name);
    }
  });
  const hasNonMorningHabit = Array.from(checkedCore).some(h => eveningHabits.has(h));
  const hasEveningReflection = lists.some(item => {
    if (item.task) return false;
    const sec = (item.header && item.header.subpath) ? item.header.subpath.toLowerCase() : "";
    if (!/\\b(wins?|blockers?|reflection)\\b/.test(sec)) return false;
    const txt = (item.text || "").trim().toLowerCase();
    return txt !== "" && !placeholders.has(txt);
  });
  if (hasNonMorningHabit || hasEveningReflection) {
    observedDays++;
    completedHabits += checkedCore.size;
  }
});

const opportunities = observedDays * 6;
const habitRate = opportunities > 0 ? Math.round((completedHabits / opportunities) * 100) : 0;
dv.paragraph(\`**Live Habit Completion Rate**: \${opportunities > 0 ? habitRate + "%" : "n/a"} (\${completedHabits}/\${opportunities} habit opportunities across \${observedDays} observed day(s))\`);
\`\`\`

---

## 📝 Manual Review Notes

### What went well this week
-

### What was challenging or needs adjustment
-

### Key learnings
-

### Goals for next week
1.
2.
3.

---

## 🔗 Related Content

### Projects Worked On
\`\`\`dataview
TABLE status AS "Status", priority AS "Priority"
FROM "02-Projects"
WHERE status = "in-progress"
SORT priority DESC
\`\`\`

### Concepts Explored
\`\`\`dataview
TABLE summary AS "Summary", updated AS "Updated"
FROM "08-Concepts"
WHERE updated >= date(${reviewWindow.startDate}) AND updated <= date(${reviewWindow.endDate})
SORT updated DESC
\`\`\`

---

> [!QUOTE] Weekly Inspiration
> *"${data.weeklyQuote || "Continuous improvement is better than delayed perfection."}"*
`;
    }

    // Write or update the file
    if (existingFile) {
      await app.vault.modify(existingFile, content);
    } else {
      await app.vault.create(fullPath, content);
    }

    new Notice(`✨ Weekly AI summary created: ${fileName}`);

    // Open the weekly review
    const newFile = app.vault.getAbstractFileByPath(fullPath);
    if (newFile && app.workspace && typeof app.workspace.getLeaf === "function") {
      app.workspace.getLeaf().openFile(newFile);
    }

  } catch (err) {
    console.error("Failed to parse weekly JSON:", err);
    new Notice("⚠️ Failed to parse weekly AI response.");
  }
};

// Helper function to extract data from daily notes

// Helper function to format weekly summary
function formatWeeklySummary(data: WeeklySummaryJson): string {
  let formatted = "";

  if (data.executiveSummary) {
    formatted += `### 📋 Executive Summary\n${data.executiveSummary}\n\n`;
  }

  if (data.keyAccomplishments && data.keyAccomplishments.length > 0) {
    formatted += `### 🏆 Key Accomplishments\n`;
    data.keyAccomplishments.forEach(item => {
      formatted += `- ${item}\n`;
    });
    formatted += "\n";
  }

  if (data.challengesFaced && data.challengesFaced.length > 0) {
    formatted += `### 🚧 Challenges Faced\n`;
    data.challengesFaced.forEach(item => {
      formatted += `- ${item}\n`;
    });
    formatted += "\n";
  }

  if (data.productivityPatterns && data.productivityPatterns.length > 0) {
    formatted += `### ⚡ Productivity Patterns\n`;
    data.productivityPatterns.forEach(item => {
      formatted += `- ${item}\n`;
    });
    formatted += "\n";
  }

  if (data.moodEnergyTrends && data.moodEnergyTrends.length > 0) {
    formatted += `### 😊 Mood & Energy Trends\n`;
    data.moodEnergyTrends.forEach(item => {
      formatted += `- ${item}\n`;
    });
    formatted += "\n";
  }

  if (data.habitAnalysis && data.habitAnalysis.length > 0) {
    formatted += `### 🔄 Habit Analysis\n`;
    data.habitAnalysis.forEach(item => {
      formatted += `- ${item}\n`;
    });
    formatted += "\n";
  }

  if (data.topInsights && data.topInsights.length > 0) {
    formatted += `### 💡 Top Insights\n`;
    data.topInsights.forEach(item => {
      formatted += `- ${item}\n`;
    });
    formatted += "\n";
  }

  if (data.recommendations && data.recommendations.length > 0) {
    formatted += `### 🎯 Recommendations for Next Week\n`;
    data.recommendations.forEach(item => {
      formatted += `- ${item}\n`;
    });
    formatted += "\n";
  }

  return formatted;
}

// Helper function to compute ISO-8601 week-year and week number (F04)
function getIsoWeekParts(date: Date): {
  isoYear: number;
  isoWeek: number;
  isoWeekPadded: string;
  weekKey: string;
} {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const rawDay = utc.getUTCDay();
  const dayNum = rawDay === 0 ? 7 : rawDay;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const isoWeekPadded = String(isoWeek).padStart(2, '0');
  return {
    isoYear,
    isoWeek,
    isoWeekPadded,
    weekKey: `${isoYear}-W${isoWeekPadded}`,
  };
}

// Helper function to get week range (Monday to Sunday)
function getWeekRange(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = monday.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + offsetToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const formatDate = (dt: Date) => {
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const dayNum = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${month}-${dayNum}`;
  };

  return `${formatDate(monday)} to ${formatDate(sunday)}`;
}

export = Object.assign(weeklyAISummary, {
  getIsoWeekParts,
  getWeekRange,
  analyzeHabitTrends,
  isObservedDailyEntry,
  triageDailyCommitments,
});
