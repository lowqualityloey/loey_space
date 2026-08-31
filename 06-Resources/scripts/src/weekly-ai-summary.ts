import type { App, TFile } from 'obsidian';
import type { QuickAddParams } from './types';
import { parseGeminiError, formatGeminiFailure, type GeminiFailure } from './lib/gemini';

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

export = async function weeklyAISummary(params?: QuickAddParams): Promise<void> {
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

  // 2. Get daily notes from the last 7 days
  const dailyNotes = app.vault.getMarkdownFiles()
    .filter((f: TFile) => f.path.startsWith("01-Daily/") &&
                !f.name.includes("MOC") &&
                !f.name.includes("All daily notes live here"));

  // Sort by date (newest first)
  dailyNotes.sort((a: TFile, b: TFile) => b.name.localeCompare(a.name));

  // Get last 7 days of notes (or all if fewer than 7)
  const recentNotes = dailyNotes.slice(0, 7);

  if (recentNotes.length === 0) {
    new Notice("⚠️ No daily notes found for weekly summary!");
    return;
  }

  // 3. Extract data from each daily note
  const weekData: any[] = [];


  for (const note of recentNotes) {
    try {
      const content = await app.vault.read(note);
      const noteDate = note.basename;

      // Extract key data from daily note
      const data = extractDailyData(content, noteDate);
      weekData.push(data);
    } catch (error) {
      console.warn(`Error reading note ${note.name}:`, error);
    }
  }

  // 4. Prepare prompt for AI
  const systemPrompt = `You are an insightful personal coach and productivity analyst. Analyze weekly data and provide comprehensive insights with actionable recommendations.`;

  const userPrompt = `Analyze this weekly data and provide a comprehensive weekly review. Provide JSON only.

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

    // Create weekly review note
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const weekNumber = getWeekNumber(currentDate);

    const fileName = `${year}-W${weekNumber}.md`;
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
      // Create new weekly review
      content = `---
created: ${year}-${month}-${day}
updated: ${year}-${month}-${day}
type: review
status: active
area: general
tags:
  - type/review
  - area/general
  - period/weekly
---

# 📊 Weekly Review: Week ${weekNumber}, ${year}

**Period**: ${getWeekRange(currentDate)}
**Theme**: ${data.weeklyTitle || "Weekly Analysis"}

---

## 🤖 AI Weekly Summary

${formatWeeklySummary(data)}

---

## 📈 Weekly Metrics

### Daily Notes Analyzed
\`\`\`dataview
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)"
FROM "01-Daily"
WHERE file.day >= date(${year}-${month}-${day}) - dur(7 days) AND file.day <= date(${year}-${month}-${day})
SORT file.day DESC
\`\`\`

### Task Completion Rate
\`\`\`dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day >= dv.date("${year}-${month}-${day}") - dv.duration("7d") && p.file.day <= dv.date("${year}-${month}-${day}"));
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
\`\`\`dataviewjs
const pages = dv.pages('"01-Daily"').where(p => p.file.day >= dv.date("${year}-${month}-${day}") - dv.duration("7d") && p.file.day <= dv.date("${year}-${month}-${day}"));
let totalHabits = 0;
let completedHabits = 0;

pages.forEach(p => {
  if (p.file.tasks) {
    p.file.tasks.forEach(t => {
      if (t.text && t.text.trim() !== "") {
        const sec = (t.header && t.header.subpath) ? t.header.subpath.toLowerCase() : "";
        if (sec.includes("habit")) {
          totalHabits++;
          if (t.completed || t.status === "x") completedHabits++;
        }
      }
    });
  }
});

const habitRate = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;
dv.paragraph(\`**Habit Completion Rate**: \${habitRate}% (\${completedHabits}/\${totalHabits} habits)\`);
\`\`\`

---

## 📝 Manual Review Notes

### What Went Well This Week
-

### What Could Be Improved
-

### Key Learnings
-

### Goals for Next Week
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
WHERE updated >= date(${year}-${month}-${day}) - dur(7 days)
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
function extractDailyData(content: string, noteDate: string) {
  const lines = content.split('\n');

  let mood = "neutral";
  let energy = "3";
  let sleepHours = "7";
  const completedTasks: string[] = [];
  const unfinishedTasks: string[] = [];
  const checkedHabits: string[] = [];
  const winsLog: string[] = [];
  const blockersLog: string[] = [];

  // Extract frontmatter
  const moodMatch = content.match(/^mood:\s*(.*)$/m);
  const energyMatch = content.match(/^energy:\s*(.*)$/m);
  const sleepMatch = content.match(/^sleep_hours:\s*(.*)$/m);

  if (moodMatch && moodMatch[1].trim()) mood = moodMatch[1].trim();
  if (energyMatch && energyMatch[1].trim()) energy = energyMatch[1].trim();
  if (sleepMatch && sleepMatch[1].trim()) sleepHours = sleepMatch[1].trim();

  let currentSec = "";
  for (const line of lines) {
    const trimmed = line.trim();

    // Update current section
    if (trimmed.startsWith("## ")) {
      currentSec = trimmed.toLowerCase();
    }

    if (!trimmed || trimmed.startsWith(">") || trimmed.startsWith("|")) {
      continue;
    }

    // Extract tasks
    if (currentSec.includes("task")) {
      const doneMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
      const openMatch = trimmed.match(/^\s*-\s*\[ \]\s+(.*)$/);
      if (doneMatch && doneMatch[1].trim()) {
        const itemText = doneMatch[1].trim();
        if (!completedTasks.includes(itemText)) completedTasks.push(itemText);
      } else if (openMatch && openMatch[1].trim() && openMatch[1].trim() !== "..." && openMatch[1].trim() !== "None") {
        const itemText = openMatch[1].trim();
        if (!unfinishedTasks.includes(itemText)) unfinishedTasks.push(itemText);
      }
    }

    // Extract habits
    if (currentSec.includes("habit")) {
      const habitMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
      if (habitMatch && habitMatch[1].trim()) {
        const habitText = habitMatch[1].trim();
        if (!checkedHabits.includes(habitText)) checkedHabits.push(habitText);
      }
    }

    // Extract wins
    if (currentSec.includes("win")) {
      const cleanItem = trimmed.replace(/^-\s*/, "").trim();
      if (cleanItem) winsLog.push(cleanItem);
    }

    // Extract blockers
    if (currentSec.includes("blocker")) {
      const cleanItem = trimmed.replace(/^-\s*/, "").trim();
      if (cleanItem) blockersLog.push(cleanItem);
    }
  }

  return {
    date: noteDate,
    mood: mood,
    energy: parseInt(energy) || 3,
    sleepHours: parseFloat(sleepHours) || 7,
    completedTasks: completedTasks,
    unfinishedTasks: unfinishedTasks,
    completedHabits: checkedHabits,
    wins: winsLog,
    blockers: blockersLog,
    taskCompletionRate: completedTasks.length / (completedTasks.length + unfinishedTasks.length) || 0,
    habitCompletionRate: checkedHabits.length // Assuming 5 habits per day as baseline
  };
}

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

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Helper function to get week range
function getWeekRange(date: Date): string {
  const d = new Date(date.getTime());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(d.setDate(diff + 6));

  const formatDate = (dt: Date) => {
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const dayNum = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${month}-${dayNum}`;
  };

  return `${formatDate(monday)} to ${formatDate(sunday)}`;
}

