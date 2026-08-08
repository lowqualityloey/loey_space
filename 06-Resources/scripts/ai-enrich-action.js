module.exports = async function aiEnrichAction(params) {
  const app = (params && params.app) ? params.app : (window.app || app);
  const file = app.workspace.getActiveFile();

  if (!file) {
    new Notice("⚠️ Please open a note first!");
    return;
  }

  const isDaily = file.path.startsWith("01-Daily");
  const isConcept = file.path.startsWith("08-Concepts");
  const isDev = file.path.startsWith("03-Dev");

  if (!isDaily && !isConcept && !isDev) {
    new Notice("⚠️ Please open a Daily, Concept, or Dev note first!");
    return;
  }

  if (isConcept) {
    await enrichConceptNote(app, file);
  } else if (isDev) {
    await enrichDevNote(app, file);
  } else {
    await enrichDailyNote(app, file);
  }
};

/* ==========================================================================
   DEV NOTE AI ENRICHER
   ========================================================================== */
async function enrichDevNote(app, file) {
  let content = await app.vault.read(file);
  const noteTitle = file.basename;

  new Notice(`🤖 Analyzing & enriching Dev Note: "${noteTitle}"...`);

  // 1. Load Gemini API Key
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

  // 2. Collect existing markdown notes for wikilinks
  const existingNotes = app.vault.getMarkdownFiles()
    .map(f => f.basename)
    .filter(n => n && !n.startsWith("_") && n !== noteTitle && !n.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesStr = existingNotes.slice(0, 60).join(", ");

  const systemPrompt = `You are a senior software engineer. Enrich dev notes with frontmatter and sections.`;

  const userPrompt = `Analyze this dev note. Provide JSON only.

Title: "${noteTitle}"
Existing Notes: [${existingNotesStr}]

Content:
${content}

JSON format:
{
  "type":"snippet",
  "area":"dev",
  "language":"JavaScript ES6",
  "tags":["type/dev","area/dev"],
  "context":{"system":"[[second brain]]","stack":"JavaScript ES6+","whereItFits":""},
  "codeExplanation":[],
  "related":[]
}
`;

  const modelsToTry = ["gemini-2.0-flash-lite"];
  let responseText = "";

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
      const res = await requestUrl({
        url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const json = JSON.parse(res.text);
      if (json.candidates && json.candidates[0] && json.candidates[0].content) {
        responseText = json.candidates[0].content.parts[0].text.trim();
        if (responseText) break;
      }
    } catch (e) {
      console.warn(`Dev Enrich model ${model} warning:`, e.message);
    }
  }

  if (!responseText) {
    new Notice("⚠️ Failed to generate AI content for Dev note.");
    return;
  }

  try {
    const cleanJsonText = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    const data = JSON.parse(cleanJsonText);

    // Update frontmatter properties
    if (data.type) content = content.replace(/^type:\s*.*$/m, `type: ${data.type}`);
    if (data.area) content = content.replace(/^area:\s*.*$/m, `area: ${data.area}`);
    if (data.language) content = content.replace(/^language:\s*.*$/m, `language: ${data.language}`);

    if (data.tags && Array.isArray(data.tags)) {
      data.tags.forEach(t => {
        if (!content.includes(t)) {
          content = content.replace(/(tags:\s*\n)/, `$1  - ${t}\n`);
        }
      });
    }

    // Update Context
    if (data.context) {
      let ctxLines = [];
      if (data.context.system) ctxLines.push(`- System: ${data.context.system}`);
      if (data.context.stack) ctxLines.push(`- Stack: ${data.context.stack}`);
      if (data.context.whereItFits) ctxLines.push(`- Where this fits: ${data.context.whereItFits}`);
      content = content.replace(/(## Context\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${ctxLines.join("\n")}\n\n`);
    }

    // Update Code Explanation
    if (data.codeExplanation && Array.isArray(data.codeExplanation)) {
      const expText = data.codeExplanation.map(e => `- ${e}`).join("\n");
      content = content.replace(/(## Code Explanation\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${expText}\n\n`);
    }

    // Update Related
    if (data.related && Array.isArray(data.related)) {
      const relText = data.related.map(r => `- ${r.startsWith("[[") ? r : "[[" + r + "]]"}`).join("\n");
      content = content.replace(/(## Related\s*[\s\S]*$)/, `## Related\n${relText}\n`);
    }

    await app.vault.modify(file, content);
    new Notice(`✨ Dev note "${noteTitle}" enriched with AI!`);

  } catch (err) {
    console.error("Failed to parse Dev JSON:", err);
    new Notice("⚠️ Failed to parse AI Dev response.");
  }
}

/* ==========================================================================
   CONCEPT NOTE AI ENRICHER
   ========================================================================== */
async function enrichConceptNote(app, file) {
  let content = await app.vault.read(file);
  const conceptName = file.basename;

  new Notice(`🤖 Analyzing & enriching Concept: "${conceptName}"...`);

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

  // 2. Collect existing vault markdown notes to populate valid wikilinks
  const existingNotes = app.vault.getMarkdownFiles()
    .map(f => f.basename)
    .filter(n => n && !n.startsWith("_") && n !== conceptName && !n.match(/^\d{4}-\d{2}-\d{2}/));
  const existingNotesStr = existingNotes.slice(0, 60).join(", ");

  const systemPrompt = `You are a knowledge base curator. Analyze concepts and provide concise JSON.`;

  const userPrompt = `Analyze concept: "${conceptName}". Provide JSON only.
Existing Notes: [${existingNotesStr}]

JSON format:
{
  "tags":["area/knowledge"],
  "summary":"1 sentence",
  "whyItMatters":["1 key point"],
  "examples":["example"],
  "relatedConcepts":["[[second brain]]"],
  "questions":["Question?"],
  "nextSteps":["- [ ] action"]
}
`;

  const modelsToTry = ["gemini-2.0-flash-lite"];
  let responseText = "";

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
      const res = await requestUrl({
        url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const json = JSON.parse(res.text);
      if (json.candidates && json.candidates[0] && json.candidates[0].content) {
        responseText = json.candidates[0].content.parts[0].text.trim();
        if (responseText) break;
      }
    } catch (e) {
      console.warn(`Concept Enrich model ${model} warning:`, e.message);
    }
  }

  if (!responseText) {
    new Notice("⚠️ Failed to generate AI content for concept.");
    return;
  }

  try {
    const cleanJsonText = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    const data = JSON.parse(cleanJsonText);

    // Update tags in frontmatter
    if (data.tags && Array.isArray(data.tags)) {
      data.tags.forEach(t => {
        if (!content.includes(t)) {
          content = content.replace(/(tags:\s*\n)/, `$1  - ${t}\n`);
        }
      });
    }

    // Update Summary
    if (data.summary) {
      content = content.replace(/(## Summary\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${data.summary}\n\n`);
    }

    // Update Why it matters
    if (data.whyItMatters && Array.isArray(data.whyItMatters)) {
      const wimText = data.whyItMatters.map(w => `- ${w}`).join("\n");
      content = content.replace(/(## Why it matters\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${wimText}\n\n`);
    }

    // Update Examples
    if (data.examples && Array.isArray(data.examples)) {
      const exText = data.examples.map(e => `- ${e}`).join("\n\n");
      content = content.replace(/(## Examples\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${exText}\n\n`);
    }

    // Update Related concepts
    if (data.relatedConcepts && Array.isArray(data.relatedConcepts)) {
      const rcText = data.relatedConcepts.map(c => `- ${c.startsWith("[[") ? c : "[[" + c + "]]"}`).join("\n");
      content = content.replace(/(## Related concepts\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${rcText}\n\n`);
    }

    // Update Questions
    if (data.questions && Array.isArray(data.questions)) {
      const qText = data.questions.map(q => `- ${q}`).join("\n");
      content = content.replace(/(## Questions\s*\n)([\s\S]*?)(?=\n## |\n$)/, `$1${qText}\n\n`);
    }

    // Update Next steps
    if (data.nextSteps && Array.isArray(data.nextSteps)) {
      const nsText = data.nextSteps.map(s => s.startsWith("- [ ]") ? s : `- [ ] ${s.replace(/^-\s*/, "")}`).join("\n");
      content = content.replace(/(## Next steps\s*[\s\S]*$)/, `## Next steps\n${nsText}\n`);
    }

    await app.vault.modify(file, content);
    new Notice(`✨ Concept note "${conceptName}" enriched with AI!`);

  } catch (err) {
    console.error("Failed to parse concept JSON:", err);
    new Notice("⚠️ Failed to parse AI concept response.");
  }
}

/* ==========================================================================
   DAILY NOTE AI ENRICHER
   ========================================================================== */
async function enrichDailyNote(app, file) {
  let content = await app.vault.read(file);
  new Notice("🤖 Gemini Flash is analyzing note & generating summary + reflection...");

  // 1. Extract Frontmatter Properties (mood, energy, sleep_hours)
  let mood = "okay";
  let energy = "3";
  let sleepHours = "7";

  const moodMatch = content.match(/^mood:\s*(.*)$/m);
  const energyMatch = content.match(/^energy:\s*(.*)$/m);
  const sleepMatch = content.match(/^sleep_hours:\s*(.*)$/m);

  if (moodMatch && moodMatch[1].trim()) mood = moodMatch[1].trim();
  if (energyMatch && energyMatch[1].trim()) energy = energyMatch[1].trim();
  if (sleepMatch && sleepMatch[1].trim()) sleepHours = sleepMatch[1].trim();

  // 2. Collect existing markdown note titles for valid wikilinks
  const existingNoteNames = app.vault.getMarkdownFiles()
    .map(f => f.basename)
    .filter(name => name && !name.startsWith('_') && name.length > 2 && !name.match(/^\d{4}-\d{2}-\d{2}/));

  const existingNotesListStr = existingNoteNames.slice(0, 60).join(", ");

  // 3. Extract clean structured user data from Daily.md template sections
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
        trimmed.startsWith("What got in my way") || trimmed.startsWith("What did I learn") ||
        trimmed.startsWith("What did I do today") || trimmed.startsWith("What patterns do I notice") ||
        trimmed.startsWith("Based on today")) {
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
      } else if (openMatch && openMatch[1].trim() && openMatch[1].trim() !== "..." && openMatch[1].trim() !== "None") {
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

  // 4. Content completeness check
  let sectionCounts = {
    focus: focusText ? 1 : 0,
    tasks: completedTasks.length + unfinishedTasks.length,
    habitsChecked: checkedHabits.length,
    wins: winsLog.length,
    blockers: blockersLog.length,
    userRef: userReflectionLog.length
  };

  let filledSectionCount = sectionCounts.focus + (sectionCounts.tasks ? 1 : 0) + (sectionCounts.habitsChecked ? 1 : 0) + 
                           (sectionCounts.wins ? 1 : 0) + (sectionCounts.blockers ? 1 : 0) + (sectionCounts.userRef ? 1 : 0);

  if (filledSectionCount < 1) {
    new Notice("⚠️ Daily note is mostly empty! Log items in Focus, Tasks, Wins, Blockers, or Reflection before generating AI Daily Summary.", 7000);
    return;
  }

  // 5. Load Gemini API Key from .env
  let geminiApiKey = "";
  let openAiApiKey = "";

  try {
    const envContent = await app.vault.adapter.read(".env");
    const geminiMatch = envContent.match(/GEMINI_API_KEY\s*=\s*([^\s]+)/);
    const openAiMatch = envContent.match(/OPENAI_API_KEY\s*=\s*([^\s]+)/);
    
    if (geminiMatch && !geminiMatch[1].includes("your_gemini")) geminiApiKey = geminiMatch[1].trim();
    if (openAiMatch && !openAiMatch[1].includes("your_openai")) openAiApiKey = openAiMatch[1].trim();
  } catch (e) {}

  const systemPrompt = "You are an insightful personal reviewer. Analyze daily logs and provide structured JSON answers.";

  const userPromptText = `Daily log analysis. Provide valid JSON only.

Metadata: Mood: ${mood}, Energy: ${energy}/5, Sleep: ${sleepHours} hours
Focus: ${focusText || "None"}
Completed Tasks: ${completedTasks.join(", ") || "None"}
Open Tasks: ${unfinishedTasks.join(", ") || "None"}
Habits Completed: ${checkedHabits.join(", ") || "None"}
Wins: ${winsLog.join(", ") || "None"}
Blockers / Obstacles: ${blockersLog.join(", ") || "None"}
User Reflection: ${userReflectionLog.join(", ") || "None"}
Existing Vault Concepts to link if relevant: [${existingNotesListStr}]

JSON format:
{
  "quote": "1-sentence inspirational spark quote",
  "author": "Author or Source",
  "summary": "1 paragraph summary answering: What did I do today? Key activities, progress, and outcomes.",
  "reflection": "1 paragraph reflection answering: What patterns do I notice? What could I improve? Any insights or blind spots?",
  "nextStep": "1-2 sentence recommendation answering: Based on today, what's the smartest move for tomorrow?"
}
`;

  let responseData = null;

  if (geminiApiKey) {
    const modelsToTry = ["gemini-2.0-flash-lite"];
    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
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
          let cleanText = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
          responseData = JSON.parse(cleanText);
          if (responseData && responseData.summary) break;
        }
      } catch (err) {
        console.warn(`Gemini API (${model}) Warning:`, err.message);
      }
    }
  }

  // Offline Smart Fallback
  if (!responseData || !responseData.summary) {
    responseData = {
      quote: "Consistency compounds over time — every small step forward builds momentum.",
      author: "Daily Spark",
      summary: `Progress focused on core daily routines with ${mood} mindset and ${energy}/5 energy. ${completedTasks.length > 0 ? "Completed " + completedTasks.length + " tasks today." : "Maintained basic execution."}`,
      reflection: `Logging mood (${mood}) and sleep (${sleepHours}h) provides a clear operational baseline. ${blockersLog.length > 0 ? "Addressing blockers (" + blockersLog.join(", ") + ") will unlock smoother flow." : "Steady rhythm maintained."}`,
      nextStep: `${unfinishedTasks.length > 0 ? "Focus tomorrow on completing: " + unfinishedTasks[0] : "Set 1 clear deliverable for tomorrow and maintain consistency."}`
    };
  }

  // Prepare quote callout
  const authorText = responseData.author ? `\n> — **${responseData.author}**` : "";
  const quoteCallout = `> [!QUOTE] 💡 Daily Spark\n> *"${responseData.quote}"*${authorText}`;

  // Update Daily Spark quote
  if (content.includes("> [!QUOTE] 💡 Daily Spark")) {
    content = content.replace(/> \[!QUOTE\] 💡 Daily Spark[\s\S]*?(?=\n\n### |\n\n## |\n---)/, quoteCallout);
  }

  // Update AI Daily Summary section
  const aiSummaryBlock = `## 🤖 AI Daily Summary

### Summary
>_What did I do today? Key activities, progress, and outcomes._
${responseData.summary}

### AI Reflection
>_What patterns do I notice? What could I improve? Any insights or blind spots?_
${responseData.reflection}

### **Suggested Next Step**
>_Based on today, what's the smartest move for tomorrow?_
${responseData.nextStep}`;

  if (content.includes("## 🤖 AI Daily Summary")) {
    content = content.replace(/## 🤖 AI Daily Summary[\s\S]*$/, aiSummaryBlock + "\n");
  } else {
    content += "\n\n" + aiSummaryBlock + "\n";
  }

  await app.vault.modify(file, content);
  new Notice("✨ Daily Note enriched with AI Summary, Reflection & Suggested Next Step!");
}
