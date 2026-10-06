// 06-Resources/scripts/src/lib/gemini.ts
function parseGeminiError(status, bodyText, model) {
  let message = "";
  let retrySeconds = 0;
  let quotaId = "";
  let quotaValue = "";
  try {
    const body = JSON.parse(bodyText);
    const error = body.error || {};
    message = error.message || "";
    const details = Array.isArray(error.details) ? error.details : [];
    for (const detail of details) {
      const type = String(detail["@type"] || "");
      if (type.includes("RetryInfo") && detail.retryDelay) {
        const seconds = String(detail.retryDelay).match(/([\d.]+)\s*s/);
        if (seconds)
          retrySeconds = Math.ceil(parseFloat(seconds[1]));
      }
      if (type.includes("QuotaFailure") && Array.isArray(detail.violations) && detail.violations.length) {
        quotaId = detail.violations[0].quotaId || "";
        quotaValue = detail.violations[0].quotaValue || "";
      }
    }
  } catch (e) {
    message = String(bodyText || "").slice(0, 200);
  }
  let kind = "unknown";
  if (status === 429) {
    if (/PerDay/i.test(quotaId))
      kind = "quotaPerDay";
    else if (/PerMinute/i.test(quotaId))
      kind = "quotaPerMinute";
    else if (/Token/i.test(quotaId))
      kind = "quotaTokens";
    else
      kind = retrySeconds > 120 ? "quotaPerDay" : "quotaPerMinute";
  } else if (status === 404)
    kind = "modelMissing";
  else if (status === 400)
    kind = "badRequest";
  else if (status === 401 || status === 403)
    kind = "auth";
  else if (status >= 500)
    kind = "serverError";
  return { status, kind, message, retrySeconds, quotaId, quotaValue, model };
}
function describeQuotaReset() {
  try {
    const now = /* @__PURE__ */ new Date();
    const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const msUntilReset = ((24 - pacific.getHours()) * 60 - pacific.getMinutes()) * 60 * 1e3;
    const resetLocal = new Date(now.getTime() + msUntilReset);
    const hours = Math.max(1, Math.round(msUntilReset / 36e5));
    const clock = resetLocal.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `in about ${hours}h (around ${clock} your time)`;
  } catch (e) {
    return "at midnight Pacific time";
  }
}
function formatGeminiFailure(failure) {
  if (!failure)
    return "the request failed";
  switch (failure.kind) {
    case "quotaPerMinute":
      return failure.retrySeconds ? `per-minute rate limit hit \u2014 Google says retry in about ${failure.retrySeconds}s` : "per-minute rate limit hit \u2014 wait about a minute and run it again";
    case "quotaPerDay":
      return `daily free-tier quota used up${failure.quotaValue ? ` (limit ${failure.quotaValue} requests/day on ${failure.model})` : ""} \u2014 resets ${describeQuotaReset()}, so waiting a few minutes will NOT help`;
    case "quotaTokens":
      return "tokens-per-minute quota hit \u2014 wait a minute, or shorten the note";
    case "auth":
      return `API key rejected (HTTP ${failure.status}) \u2014 check GEMINI_API_KEY in .env`;
    case "badRequest":
      return `request rejected (400): ${failure.message || "invalid request"}`;
    case "modelMissing":
      return "none of the configured models are available for this key (404)";
    case "serverError":
      return `Google server error (${failure.status}) \u2014 try again shortly`;
    case "network":
      return `network error: ${failure.message}`;
    case "emptyResponse":
      return `model returned no content${failure.message ? ` (${failure.message})` : ""}`;
    case "badJson":
      return "model returned text that was not valid JSON";
    case "noKey":
      return "GEMINI_API_KEY is missing from .env";
    default:
      return failure.message || "the request failed";
  }
}

// 06-Resources/scripts/src/lib/daily-note.ts
var DEFAULT_DAILY_NOTES_CONFIG = {
  folder: "01-Daily",
  format: "YYYY-MM/YYYY-MM-DD"
};
function formatDate(date, format) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return format.replace(/YYYY/g, yyyy).replace(/YY/g, yyyy.slice(2)).replace(/MM/g, mm).replace(/DD/g, dd);
}
function resolveDailyNotePath(dateStr, config = DEFAULT_DAILY_NOTES_CONFIG) {
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`resolveDailyNotePath: expected YYYY-MM-DD, received "${dateStr}"`);
  }
  const formatted = formatDate(new Date(year, month - 1, day), config.format);
  const folder = config.folder.replace(/\/+$/, "");
  return `${folder}/${formatted}`;
}
function resolveDailyNoteFile(dateStr, config = DEFAULT_DAILY_NOTES_CONFIG) {
  return `${resolveDailyNotePath(dateStr, config)}.md`;
}

// 06-Resources/scripts/src/lib/weekly-window.ts
var DEFAULT_WEEK_DAYS = 7;
function localDateKey(date) {
  return formatDate(date, "YYYY-MM-DD");
}
function resolveTimeZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || "local (IANA zone unavailable)";
  } catch {
    return "local (IANA zone unavailable)";
  }
}
function buildWeeklyWindow(today, days = DEFAULT_WEEK_DAYS, timeZone = resolveTimeZone()) {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`buildWeeklyWindow: days must be a positive integer, received "${days}"`);
  }
  const dateKeys = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    dateKeys.push(localDateKey(day));
  }
  return {
    startDate: dateKeys[0],
    endDate: dateKeys[dateKeys.length - 1],
    days,
    timeZone,
    dateKeys
  };
}
function windowPaths(window2, config = DEFAULT_DAILY_NOTES_CONFIG) {
  return window2.dateKeys.map((key) => resolveDailyNoteFile(key, config));
}
function selectWeeklyNotes(files, window2, config = DEFAULT_DAILY_NOTES_CONFIG) {
  const wanted = /* @__PURE__ */ new Map();
  windowPaths(window2, config).forEach((path, index) => wanted.set(path, index));
  return files.filter((file) => wanted.has(file.path)).sort((a, b) => wanted.get(b.path) - wanted.get(a.path));
}
function describeCoverage(window2, selectedCount) {
  const missing = window2.days - selectedCount;
  const tail = missing === 0 ? "every calendar day in the window has a daily note" : `${missing} day(s) have no daily note, which is unknown rather than zero`;
  return `**Coverage**: ${selectedCount}/${window2.days} calendar days logged (${window2.startDate} to ${window2.endDate}, ${window2.timeZone}) \u2014 ${tail}.`;
}

// 06-Resources/scripts/src/lib/markdown.ts
function stripTaskMetadata(text) {
  return String(text).replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]\s*\d{4}-\d{2}-\d{2}/g, " ").replace(/[✅❌➕📅⏳🛫🔁⏫🔼🔽⏬🆔⛔]/g, " ").replace(/\s*\^[A-Za-z0-9]+\s*$/, " ").replace(/\s{2,}/g, " ").trim();
}

// 06-Resources/scripts/src/lib/weekly-extract.ts
var BUCKETS = [
  [/\btasks?\b/, "tasks"],
  [/\bfocus\b/, "focus"],
  [/\bhabits?\b/, "habits"],
  [/\bwins?\b/, "wins"],
  [/\bblockers?\b/, "blockers"],
  [/\breflection\b/, "reflection"],
  [/\bideas?\b/, "ideas"]
];
function headingText(line) {
  const match = line.match(/^(#{1,6})\s+(.*)$/);
  if (!match)
    return null;
  return { level: match[1].length, text: match[2].trim().toLowerCase() };
}
function bucketOf(text) {
  for (const [pattern, bucket] of BUCKETS) {
    if (pattern.test(text))
      return bucket;
  }
  return null;
}
function frontmatterValue(content, key) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter)
    return null;
  const pattern = new RegExp(`^${key}\\s*:`);
  const line = frontmatter[1].split(/\r?\n/).find((candidate) => pattern.test(candidate));
  if (!line)
    return null;
  const raw = line.slice(line.indexOf(":") + 1).trim();
  return raw === "" ? null : raw;
}
function numericOrNull(raw, integer) {
  if (raw === null)
    return null;
  const pattern = integer ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/;
  if (!pattern.test(raw))
    return null;
  const value = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}
var PLACEHOLDERS = /* @__PURE__ */ new Set(["...", "\u2026", "none", "n/a", "unknown"]);
function isPlaceholder(text) {
  return PLACEHOLDERS.has(text.trim().toLowerCase());
}
function push(list, text) {
  if (text && !isPlaceholder(text) && !list.includes(text))
    list.push(text);
}
function extractDailyData(content, noteDate) {
  const mood = frontmatterValue(content, "mood");
  const energy = numericOrNull(frontmatterValue(content, "energy"), true);
  const sleepHours = numericOrNull(frontmatterValue(content, "sleep_hours"), false);
  const completedTasks = [];
  const unfinishedTasks = [];
  const completedHabits = [];
  const wins = [];
  const blockers = [];
  const reflection = [];
  const ideas = [];
  const intentions = [];
  const stack = [];
  const currentBucket = () => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].bucket)
        return stack[i].bucket;
    }
    return null;
  };
  const lines = content.split(/\r?\n/);
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatterLines = frontmatter ? frontmatter[0].split(/\r?\n/).length : 0;
  let inFence = false;
  for (const [index, line] of lines.entries()) {
    if (index < frontmatterLines)
      continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    const heading = headingText(trimmed);
    if (heading) {
      while (stack.length && stack[stack.length - 1].level >= heading.level)
        stack.pop();
      stack.push({ level: heading.level, bucket: bucketOf(heading.text) });
      continue;
    }
    if (!trimmed || trimmed.startsWith(">") || trimmed.startsWith("|"))
      continue;
    const bucket = currentBucket();
    if (!bucket)
      continue;
    const done = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
    const open = trimmed.match(/^\s*-\s*\[ \]\s+(.*)$/);
    const bullet = trimmed.match(/^\s*-\s+(.*)$/);
    if (bucket === "tasks") {
      if (done)
        push(completedTasks, done[1].trim());
      else if (open)
        push(unfinishedTasks, open[1].trim());
      continue;
    }
    if (bucket === "habits") {
      if (done)
        push(completedHabits, stripTaskMetadata(done[1].trim()));
      continue;
    }
    if (bucket === "focus") {
      if (bullet)
        push(intentions, stripTaskMetadata(bullet[1].trim()));
      continue;
    }
    if (bullet) {
      const text = stripTaskMetadata(bullet[1].trim());
      if (bucket === "wins")
        push(wins, text);
      else if (bucket === "blockers")
        push(blockers, text);
      else if (bucket === "reflection")
        push(reflection, text);
      else if (bucket === "ideas")
        push(ideas, text);
    }
  }
  const taskTotal = completedTasks.length + unfinishedTasks.length;
  return {
    date: noteDate,
    mood,
    energy,
    sleepHours,
    completedTasks,
    unfinishedTasks,
    completedHabits,
    wins,
    blockers,
    reflection,
    ideas,
    intentions,
    // `null` rather than `0`: a note with no tasks has no completion rate, and
    // the old `0 / 0 || 0` reported "0% complete" for exactly those notes.
    taskCompletionRate: taskTotal === 0 ? null : completedTasks.length / taskTotal
  };
}
function aggregate(values, label) {
  const known = values.filter((value) => value !== null);
  const total = values.length;
  const average = known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length;
  return {
    known: known.length,
    unknown: total - known.length,
    total,
    average: average === null ? null : Math.round(average * 100) / 100,
    coverage: `${known.length}/${total} note(s) declared ${label}`
  };
}
function summarizeWeek(entries) {
  const tasks = {
    completed: entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0),
    unfinished: entries.reduce((sum, entry) => sum + entry.unfinishedTasks.length, 0)
  };
  const taskTotal = tasks.completed + tasks.unfinished;
  const rated = entries.map((entry) => entry.taskCompletionRate).filter((rate) => rate !== null);
  return {
    notes: entries.length,
    energy: aggregate(entries.map((entry) => entry.energy), "energy"),
    sleepHours: aggregate(entries.map((entry) => entry.sleepHours), "sleep_hours"),
    moods: Array.from(new Set(entries.map((entry) => entry.mood).filter((m) => m !== null))),
    tasks: {
      completed: tasks.completed,
      unfinished: tasks.unfinished,
      completionRate: rated.length === 0 ? null : Math.round(rated.reduce((sum, rate) => sum + rate, 0) / rated.length * 100) / 100
    },
    habits: {
      completed: entries.reduce((sum, entry) => sum + entry.completedHabits.length, 0)
    },
    entries: {
      wins: entries.reduce((sum, entry) => sum + entry.wins.length, 0),
      blockers: entries.reduce((sum, entry) => sum + entry.blockers.length, 0),
      reflection: entries.reduce((sum, entry) => sum + entry.reflection.length, 0)
    }
  };
}
function describeWeekCoverage(summary) {
  return `**Vitals coverage**: energy ${summary.energy.coverage}; sleep ${summary.sleepHours.coverage}` + (summary.moods.length ? `; mood recorded: ${summary.moods.join(", ")}` : "; no mood recorded");
}

// 06-Resources/scripts/src/weekly-ai-summary.ts
function formatWeeklySummary(data) {
  let formatted = "";
  if (data.executiveSummary) {
    formatted += `### \u{1F4CB} Executive Summary
${data.executiveSummary}

`;
  }
  if (data.keyAccomplishments && data.keyAccomplishments.length > 0) {
    formatted += `### \u{1F3C6} Key Accomplishments
`;
    data.keyAccomplishments.forEach((item) => {
      formatted += `- ${item}
`;
    });
    formatted += "\n";
  }
  if (data.challengesFaced && data.challengesFaced.length > 0) {
    formatted += `### \u{1F6A7} Challenges Faced
`;
    data.challengesFaced.forEach((item) => {
      formatted += `- ${item}
`;
    });
    formatted += "\n";
  }
  if (data.productivityPatterns && data.productivityPatterns.length > 0) {
    formatted += `### \u26A1 Productivity Patterns
`;
    data.productivityPatterns.forEach((item) => {
      formatted += `- ${item}
`;
    });
    formatted += "\n";
  }
  if (data.moodEnergyTrends && data.moodEnergyTrends.length > 0) {
    formatted += `### \u{1F60A} Mood & Energy Trends
`;
    data.moodEnergyTrends.forEach((item) => {
      formatted += `- ${item}
`;
    });
    formatted += "\n";
  }
  if (data.habitAnalysis && data.habitAnalysis.length > 0) {
    formatted += `### \u{1F504} Habit Analysis
`;
    data.habitAnalysis.forEach((item) => {
      formatted += `- ${item}
`;
    });
    formatted += "\n";
  }
  if (data.topInsights && data.topInsights.length > 0) {
    formatted += `### \u{1F4A1} Top Insights
`;
    data.topInsights.forEach((item) => {
      formatted += `- ${item}
`;
    });
    formatted += "\n";
  }
  if (data.recommendations && data.recommendations.length > 0) {
    formatted += `### \u{1F3AF} Recommendations for Next Week
`;
    data.recommendations.forEach((item) => {
      formatted += `- ${item}
`;
    });
    formatted += "\n";
  }
  return formatted;
}
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 864e5;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
function getWeekRange(date) {
  const d = new Date(date.getTime());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(d.setDate(diff + 6));
  const formatDate2 = (dt) => {
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const dayNum = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${month}-${dayNum}`;
  };
  return `${formatDate2(monday)} to ${formatDate2(sunday)}`;
}
module.exports = async function weeklyAISummary(params) {
  const app = params?.app || window.app || globalThis.app;
  const Notice = window.Notice || globalThis.Notice;
  new Notice("\u{1F916} Generating weekly AI summary...");
  let geminiApiKey = "";
  try {
    const envContent = await app.vault.adapter.read(".env");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    if (match && !match[1].includes("your_gemini"))
      geminiApiKey = match[1].trim();
  } catch (e) {
  }
  if (!geminiApiKey) {
    new Notice("\u26A0\uFE0F GEMINI_API_KEY missing in .env!");
    return;
  }
  const reviewWindow = buildWeeklyWindow(/* @__PURE__ */ new Date());
  const recentNotes = selectWeeklyNotes(app.vault.getMarkdownFiles(), reviewWindow);
  const coverage = describeCoverage(reviewWindow, recentNotes.length);
  if (recentNotes.length === 0) {
    new Notice("\u26A0\uFE0F No daily notes found for weekly summary!");
    return;
  }
  const weekDataResults = await Promise.all(
    recentNotes.map(async (note) => {
      try {
        const content = await app.vault.read(note);
        const noteDate = note.basename;
        return extractDailyData(content, noteDate);
      } catch (error) {
        console.warn(`Error reading note ${note.name}:`, error);
        return null;
      }
    })
  );
  const weekData = weekDataResults.filter((data) => data !== null);
  const weekSummary = summarizeWeek(weekData);
  const systemPrompt = `You are an insightful personal coach and productivity analyst. Analyze weekly data and provide comprehensive insights with actionable recommendations.`;
  const userPrompt = `Analyze this weekly data and provide a comprehensive weekly review. Provide JSON only.

REVIEW WINDOW (the span these notes were selected from, and how much of it was logged):
from: ${reviewWindow.startDate}
to: ${reviewWindow.endDate}
calendar days: ${reviewWindow.days}
timezone: ${reviewWindow.timeZone}
coverage: ${coverage}

WEEK SUMMARY (computed from the notes below; absent values are excluded from every average, and each coverage line states what its average rests on \u2014 do not present an average as covering more days than its coverage says):
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
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
  let responseText = "";
  let failureReason = null;
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
          console.warn(`Weekly Summary: aborting model fallback \u2014 ${failureReason.kind} affects all models`);
          break;
        }
      }
    } catch (e) {
      failureReason = { status: 0, kind: "network", message: e?.message ? e.message : String(e), retrySeconds: 0, model };
      console.warn(`Weekly Summary model ${model} warning:`, failureReason.message);
    }
  }
  if (!responseText) {
    const errorMsg = formatGeminiFailure(failureReason);
    new Notice(`\u26A0\uFE0F Failed to generate weekly AI summary: ${errorMsg}`);
    return;
  }
  try {
    const cleanJsonText = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    const data = JSON.parse(cleanJsonText);
    const currentDate = /* @__PURE__ */ new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    const weekNumber = getWeekNumber(currentDate);
    const fileName = `${year}-W${weekNumber}.md`;
    const folderPath = "07-Reviews/";
    const fullPath = folderPath + fileName;
    let existingFile = app.vault.getAbstractFileByPath(fullPath);
    let content = "";
    if (existingFile) {
      content = await app.vault.read(existingFile);
      content += "\n\n---\n\n## \u{1F916} AI Weekly Summary\n\n" + formatWeeklySummary(data);
    } else {
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

# \u{1F4CA} Weekly Review: Week ${weekNumber}, ${year}

**Period**: ${getWeekRange(currentDate)}
**Analysed window**: ${reviewWindow.startDate} to ${reviewWindow.endDate} (${reviewWindow.timeZone})
**Theme**: ${data.weeklyTitle || "Weekly Analysis"}

${coverage}
${describeWeekCoverage(weekSummary)}

---

## \u{1F916} AI Weekly Summary

${formatWeeklySummary(data)}

---

## \u{1F4C8} Weekly Metrics

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

## \u{1F4DD} Manual Review Notes

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

## \u{1F517} Related Content

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
    if (existingFile) {
      await app.vault.modify(existingFile, content);
    } else {
      await app.vault.create(fullPath, content);
    }
    new Notice(`\u2728 Weekly AI summary created: ${fileName}`);
    const newFile = app.vault.getAbstractFileByPath(fullPath);
    if (newFile && app.workspace && typeof app.workspace.getLeaf === "function") {
      app.workspace.getLeaf().openFile(newFile);
    }
  } catch (err) {
    console.error("Failed to parse weekly JSON:", err);
    new Notice("\u26A0\uFE0F Failed to parse weekly AI response.");
  }
};
