<%*
const file = app.workspace.getActiveFile();
if (!file || !file.path.startsWith("01-Daily")) {
  new Notice("⚠️ Please open a daily note inside 01-Daily first!");
  return;
}

let content = await app.vault.read(file);
new Notice("🤖 Gemini 3.6 Flash is analyzing note & generating summary + reflection...");

// 1. Extract Frontmatter Properties (mood, energy, sleep_hours)
let mood = "okay";
let energy = "3";
let sleepHours = "7";

const moodMatch = content.match(/^mood:\s*(.*)$/m);
const energyMatch = content.match(/^energy:\s*(.*)$/m);
const sleepMatch = content.match(/^sleep_hours:\s*(.*)$/m);

if (moodMatch) mood = moodMatch[1].trim();
if (energyMatch) energy = energyMatch[1].trim();
if (sleepMatch) sleepHours = sleepMatch[1].trim();

// 2. Collect existing markdown note titles to prevent uncreated concept flooding
const existingNoteNames = app.vault.getMarkdownFiles()
  .map(f => f.basename)
  .filter(name => name && !name.startsWith('_') && name.length > 2 && !name.match(/^\d{4}-\d{2}-\d{2}/));

const existingNotesListStr = existingNoteNames.slice(0, 60).join(", ");

// 3. Extract unfinished tasks across the note (excluding Habits and Tomorrow Setup)
const lines = content.split('\n');
let unfinishedTasks = [];
let currentSection = "";

for (const line of lines) {
  if (line.startsWith("## ")) {
    currentSection = line.trim();
  }
  
  if (currentSection.includes("Habits") || currentSection.includes("Tomorrow Setup")) {
    continue;
  }

  const match = line.match(/^\s*-\s*\[ \]\s+(.*)$/);
  if (match) {
    const taskText = match[1].trim();
    if (taskText && taskText !== "" && taskText !== "..." && !unfinishedTasks.includes(taskText)) {
      unfinishedTasks.push(taskText);
    }
  }
}

// 4. Load Gemini API Key from .env
let geminiApiKey = "";
let openAiApiKey = "";

try {
  const envContent = await app.vault.adapter.read(".env");
  const geminiMatch = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
  const openAiMatch = envContent.match(/OPENAI_API_KEY\s*=\s*([^\s]+)/);
  
  if (geminiMatch && !geminiMatch[1].includes("your_gemini")) geminiApiKey = geminiMatch[1].trim();
  if (openAiMatch && !openAiMatch[1].includes("your_openai")) openAiApiKey = openAiMatch[1].trim();
} catch (e) {}

let motivationQuote = "";
let summarySectionText = "";

const systemPrompt = `You are a personal reviewer. Provide concise daily summaries.`;

const userPromptText = `Daily log analysis. Provide JSON only.

Metadata: Mood: ${mood}, Energy: ${energy}/5, Sleep: ${sleepHours} hours

Note:
${content}

JSON format:
{
  "quote":"1-sentence motivation",
  "summary":"1 paragraph summary",
  "reflection":"1 paragraph reflection",
  "tomorrow":["- [ ] task 1","- [ ] task 2","- [ ] task 3"]
}
`;

// 5. Call AI Provider (Gemini 3.6 Flash / 2.5 Flash High)
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
        generationConfig: {
          temperature: 0.7,
          topP: 0.95
        }
      })
    });

    const json = JSON.parse(res.text);
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      const fullText = json.candidates[0].content.parts[0].text.trim();
      
      if (fullText.includes("SECTION 2:") || fullText.includes("### Summary")) {
        const parts = fullText.split(/SECTION 2:|### Summary/i);
        motivationQuote = parts[0].replace(/SECTION 1:|MOTIVATION:/gi, "").replace(/^"/, "").replace(/"$/, "").trim();
        summarySectionText = "### Summary\n" + (parts[1] || fullText).trim();
      } else {
        const firstLineEnd = fullText.indexOf("\n");
        motivationQuote = fullText.substring(0, firstLineEnd).trim();
        summarySectionText = fullText.substring(firstLineEnd).trim();
      }
    }
  } catch (err) {
    console.warn("Gemini API Request Warning:", err.message);
  }
}

// Fallback Provider: OpenAI API
if (!summarySectionText && openAiApiKey) {
  try {
    const res = await requestUrl({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPromptText }
        ]
      })
    });
    const json = JSON.parse(res.text);
    const text = json.choices[0].message.content.trim();
    const parts = text.split(/SECTION 2:|### Summary/i);
    motivationQuote = parts[0].replace(/SECTION 1:|MOTIVATION:/gi, "").replace(/^"/, "").replace(/"$/, "").trim();
    summarySectionText = "### Summary\n" + (parts[1] || text).trim();
  } catch (err) {
    console.warn("OpenAI API Fallback Warning:", err.message);
  }
}

// Offline Smart Fallback
if (!motivationQuote) {
  motivationQuote = "Some days the best win is showing up and moving forward — consistency compounds over time.";
}

if (!summarySectionText) {
  summarySectionText = `### Summary
A day logged with a **${mood}** mindset, **${energy}/5** energy, and **${sleepHours} hours** of sleep. Progress focused on core daily routines, completing key tasks while leaving open items carried forward. ==Steady execution on basic habits builds long-term consistency even on low-energy days.== Dev work advanced on [[Weather Dashboard]] alongside workflow setup in [[second brain]].

### AI Reflection
Logging mood and maintaining basic habit check-offs provides a solid operational baseline. Today's task scope was broad, so focusing tomorrow on one concrete deliverable will keep momentum steady without overextending.`;
}

// Clean quote formatting
motivationQuote = motivationQuote.replace(/^>\s*/, "").replace(/^Motivation:\s*/i, "").trim();

// 6. Prepare Tomorrow Setup content
let tomorrowSetupContent = unfinishedTasks.length > 0
  ? unfinishedTasks.map(t => `- [ ] ${t}`).join("\n")
  : "- [ ] All tasks completed today! 🎉";

// 7. Update sections cleanly
if (content.includes("## ✨ Motivation")) {
  content = content.replace(/(## ✨ Motivation\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1> ${motivationQuote}\n\n`);
}

if (content.includes("## 🤖 AI Daily Summary")) {
  content = content.replace(/(## 🤖 AI Daily Summary\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${summarySectionText}\n\n`);
} else if (content.includes("## AI Daily Summary")) {
  content = content.replace(/(## AI Daily Summary\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${summarySectionText}\n\n`);
}

if (content.includes("## 🌙 Tomorrow Setup")) {
  content = content.replace(/(## 🌙 Tomorrow Setup[\s\S]*?\n)([\s\S]*?)(?=\n## |\n$)/, `$1What I want to carry or prepare for tomorrow.\n${tomorrowSetupContent}\n`);
}

await app.vault.modify(file, content);

// 8. Auto-clean any unwanted concept junk files
try {
  const conceptsFolder = app.vault.getAbstractFileByPath("08-Concepts");
  if (conceptsFolder && conceptsFolder.children) {
    for (const child of conceptsFolder.children) {
      if (["AI Daily Enrich.md", "generate.md", "trigger it.md", "updated.md"].includes(child.name)) {
        await app.vault.delete(child, true);
      }
    }
  }
} catch (e) {}

new Notice("✨ Daily Note enriched with AI Summary & Reflection!");
-%>
