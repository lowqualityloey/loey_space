---
created: <% tp.date.now("YYYY-MM-DD") %>
updated: <% tp.date.now("YYYY-MM-DD") %>
type: template
status: active
area: dev
tags:
  - type/template
  - area/dev
  - status/active
---
<%*
const file = app.workspace.getActiveFile();
if (!file || !file.path.startsWith("01-Daily")) {
  new Notice("⚠️ Please open a daily note inside 01-Daily first!");
  return;
}

let content = await app.vault.read(file);
new Notice("🤖 Gemini Flash is analyzing note & generating summary + reflection...");

let mood = "okay";
let energy = "3";
let sleepHours = "7";

const moodMatch = content.match(/^mood:\s*(.*)$/m);
const energyMatch = content.match(/^energy:\s*(.*)$/m);
const sleepMatch = content.match(/^sleep_hours:\s*(.*)$/m);

if (moodMatch && moodMatch[1].trim()) mood = moodMatch[1].trim();
if (energyMatch && energyMatch[1].trim()) energy = energyMatch[1].trim();
if (sleepMatch && sleepMatch[1].trim()) sleepHours = sleepMatch[1].trim();

const lines = content.split('\n');
let focusText = "";
let completedTasks = [];
let unfinishedTasks = [];
let checkedHabits = [];
let winsLog = [];
let blockersLog = [];
let userReflectionLog = [];

let currentSec = "";
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
    currentSec = trimmed;
    continue;
  }

  if (!trimmed || trimmed.startsWith(">") || trimmed.startsWith("|") || 
      trimmed.startsWith("Define your focus") || trimmed.startsWith("Things I need") || 
      trimmed.startsWith("Daily basics") || trimmed.startsWith("Something positive") || 
      trimmed.startsWith("What got in my way") || trimmed.startsWith("What did I learn")) {
    continue;
  }

  if (currentSec.includes("Focus")) {
    const cleanItem = trimmed.replace(/^[#\s-*]+/, "").trim();
    if (cleanItem) focusText += (focusText ? " " : "") + cleanItem;
  } else if (currentSec.includes("Tasks")) {
    const doneMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
    const openMatch = trimmed.match(/^\s*-\s*\[ \]\s+(.*)$/);
    if (doneMatch && doneMatch[1].trim()) {
      const itemText = doneMatch[1].trim();
      if (!completedTasks.includes(itemText)) completedTasks.push(itemText);
    } else if (openMatch && openMatch[1].trim() && openMatch[1].trim() !== "...") {
      const itemText = openMatch[1].trim();
      if (!unfinishedTasks.includes(itemText)) unfinishedTasks.push(itemText);
    }
  } else if (currentSec.includes("Habits")) {
    const habitMatch = trimmed.match(/^\s*-\s*\[x\]\s+(.*)$/i);
    if (habitMatch && habitMatch[1].trim()) {
      const habitText = habitMatch[1].trim();
      if (!checkedHabits.includes(habitText)) checkedHabits.push(habitText);
    }
  } else if (currentSec.includes("Wins")) {
    const cleanItem = trimmed.replace(/^-\s*/, "").trim();
    if (cleanItem) winsLog.push(cleanItem);
  } else if (currentSec.includes("Blockers")) {
    const cleanItem = trimmed.replace(/^-\s*/, "").trim();
    if (cleanItem) blockersLog.push(cleanItem);
  } else if (currentSec.includes("Reflection") && !currentSec.includes("AI Reflection")) {
    const cleanItem = trimmed.replace(/^-\s*/, "").trim();
    if (cleanItem) userReflectionLog.push(cleanItem);
  }
}

let geminiApiKey = "";
try {
  const envContent = await app.vault.adapter.read(".env");
  const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
  if (match && !match[1].includes("your_gemini")) geminiApiKey = match[1].trim();
} catch (e) {}

const systemPrompt = "You are an insightful personal reviewer. Analyze daily logs and provide structured JSON answers.";

const userPromptText = `Daily log analysis. Provide valid JSON only.
Metadata: Mood: ${mood}, Energy: ${energy}/5, Sleep: ${sleepHours} hours
Focus: ${focusText || "None"}
Completed Tasks: ${completedTasks.join(", ") || "None"}
Open Tasks: ${unfinishedTasks.join(", ") || "None"}
Habits Completed: ${checkedHabits.join(", ") || "None"}
Wins: ${winsLog.join(", ") || "None"}
Blockers: ${blockersLog.join(", ") || "None"}
User Reflection: ${userReflectionLog.join(", ") || "None"}

JSON format:
{
  "quote": "1-sentence motivation",
  "author": "Author",
  "summary": "1 paragraph summary answering: What did I do today? Key activities, progress, and outcomes.",
  "reflection": "1 paragraph reflection answering: What patterns do I notice? What could I improve? Any insights or blind spots?",
  "nextStep": "1-2 sentence recommendation answering: Based on today, what's the smartest move for tomorrow?"
}
`;

let responseData = null;

if (geminiApiKey) {
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`;
    const res = await requestUrl({
      url: geminiUrl,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPromptText }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
      })
    });

    const json = JSON.parse(res.text);
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      const text = json.candidates[0].content.parts[0].text.trim();
      const cleanText = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      responseData = JSON.parse(cleanText);
    }
  } catch (err) {}
}

if (!responseData || !responseData.summary) {
  responseData = {
    quote: "Consistency compounds over time — every small step forward builds momentum.",
    author: "Daily Spark",
    summary: `Progress focused on core daily routines with ${mood} mindset and ${energy}/5 energy.`,
    reflection: `Logging mood (${mood}) and sleep (${sleepHours}h) provides a clear operational baseline.`,
    nextStep: (unfinishedTasks.length > 0 ? "Focus tomorrow on completing: " + unfinishedTasks[0] : "Set 1 clear deliverable for tomorrow.")
  };
}

const authorText = responseData.author ? `\n> — **${responseData.author}**` : "";
const quoteCallout = `> [!QUOTE] 💡 Daily Spark\n> *"${responseData.quote}"*${authorText}`;

if (content.includes("> [!QUOTE] 💡 Daily Spark")) {
  content = content.replace(/> \[!QUOTE\] 💡 Daily Spark[\s\S]*?(?=\n\n### |\n\n## |\n---)/, quoteCallout);
}

const aiSummaryBlock = `## 🤖 AI Daily Summary

### 📖 Daily Debrief
> _What did I do today? The day's story and key outcomes._

${responseData.summary}

### 🧠 Chief of Staff Takeaway
> _What's the high-signal lesson, pattern, or blind spot from today?_

${responseData.reflection}

### 🎯 Tomorrow's Move
> _Based on today, what's the smartest priority to tackle first?_

${responseData.nextStep}`;

if (content.includes("## 🤖 AI Daily Summary")) {
  content = content.replace(/## 🤖 AI Daily Summary[\s\S]*$/, aiSummaryBlock + "\n");
} else {
  content += "\n\n" + aiSummaryBlock + "\n";
}

await app.vault.modify(file, content);
new Notice("✨ Daily Note enriched with AI Summary, Reflection & Suggested Next Step!");
-%>
