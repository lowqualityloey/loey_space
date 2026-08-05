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

  if (moodMatch) mood = moodMatch[1].trim();
  if (energyMatch) energy = energyMatch[1].trim();
  if (sleepMatch) sleepHours = sleepMatch[1].trim();

  // 2. Collect existing markdown note titles to prevent uncreated concept flooding
  const existingNoteNames = app.vault.getMarkdownFiles()
    .map(f => f.basename)
    .filter(name => name && !name.startsWith('_') && name.length > 2 && !name.match(/^\d{4}-\d{2}-\d{2}/));

  const existingNotesListStr = existingNoteNames.slice(0, 60).join(", ");

  // 3. Extract clean structured user data (separating completed [x] vs unfinished [ ])
  const lines = content.split('\n');
  let completedTasks = [];
  let unfinishedTasks = [];
  let checkedHabits = [];
  let devLog = [];
  let leisureLog = [];
  let notesLog = [];
  let smallWinsLog = [];

  let currentSec = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      currentSec = trimmed;
      continue;
    }

    // Skip template guides, tables, and section headers
    if (!trimmed || trimmed.startsWith(">") || trimmed.startsWith("|") || 
        trimmed.startsWith("Things I need") || trimmed.startsWith("Daily basics") || 
        trimmed.startsWith("Progress from today") || trimmed.startsWith("What I played") || 
        trimmed.startsWith("Anything on my mind") || trimmed.startsWith("Something positive")) {
      continue;
    }

    if (currentSec.includes("Tasks") || currentSec.includes("Carry Forward") || currentSec.includes("Focus 3")) {
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
    } else if (currentSec.includes("Work") || currentSec.includes("Dev")) {
      const cleanItem = trimmed.replace(/^-\s*/, "").trim();
      if (cleanItem && !cleanItem.endsWith(":")) devLog.push(cleanItem);
    } else if (currentSec.includes("Leisure") || currentSec.includes("Fun")) {
      const cleanItem = trimmed.replace(/^-\s*/, "").trim();
      if (cleanItem) leisureLog.push(cleanItem);
    } else if (currentSec.includes("Notes") || currentSec.includes("Thoughts")) {
      const cleanItem = trimmed.replace(/^-\s*/, "").trim();
      if (cleanItem) notesLog.push(cleanItem);
    } else if (currentSec.includes("Small Wins") || currentSec.includes("Wins")) {
      const cleanItem = trimmed.replace(/^-\s*/, "").trim();
      if (cleanItem) smallWinsLog.push(cleanItem);
    }
  }

  // 3b. Content completeness check (excluding Motivation)
  let sectionCounts = {
    tasks: completedTasks.length + unfinishedTasks.length,
    habitsChecked: checkedHabits.length,
    devWork: devLog.length,
    leisure: leisureLog.length,
    notes: notesLog.length,
    smallWins: smallWinsLog.length
  };

  let filledSectionCount = 0;
  if (sectionCounts.tasks >= 1) filledSectionCount++;
  if (sectionCounts.habitsChecked >= 1) filledSectionCount++;
  if (sectionCounts.devWork >= 1) filledSectionCount++;
  if (sectionCounts.leisure >= 1) filledSectionCount++;
  if (sectionCounts.notes >= 1) filledSectionCount++;
  if (sectionCounts.smallWins >= 1) filledSectionCount++;

  const totalEntries = sectionCounts.tasks + sectionCounts.devWork + sectionCounts.leisure + sectionCounts.notes + sectionCounts.smallWins;

  if (filledSectionCount < 2 && totalEntries < 2) {
    new Notice("⚠️ Daily note is mostly empty! Please log at least 1–2 items in your sections (Tasks, Dev Work, Notes, Wins, etc.) before generating AI Daily Summary.", 7000);
    return;
  }

  // Build clean noise-free payload of actual user logs
  const userLoggedDataText = `
USER LOGGED DATA FOR TODAY:
- Metadata: Mood: ${mood}, Energy: ${energy}/5, Sleep: ${sleepHours} hours

- COMPLETED TASKS [x] (${completedTasks.length}):
${completedTasks.length > 0 ? completedTasks.map(t => `  * ${t}`).join('\n') : '  * (No tasks completed today)'}

- UNFINISHED / OPEN TASKS [ ] (${unfinishedTasks.length}):
${unfinishedTasks.length > 0 ? unfinishedTasks.map(t => `  * ${t}`).join('\n') : '  * (All tasks completed today)'}

- HABITS COMPLETED:
${checkedHabits.length > 0 ? checkedHabits.map(h => `  * ${h}`).join(', ') : '  * (No habits checked)'}

- WORK / STUDY / DEV PROGRESS:
${devLog.length > 0 ? devLog.map(d => `  * ${d}`).join('\n') : '  * (No dev progress logged)'}

- LEISURE & FUN LOGGED:
${leisureLog.length > 0 ? leisureLog.map(l => `  * ${l}`).join('\n') : '  * (No leisure activity logged)'}

- NOTES & THOUGHTS LOGGED:
${notesLog.length > 0 ? notesLog.map(n => `  * ${n}`).join('\n') : '  * (No notes/thoughts logged)'}

- SMALL WINS LOGGED:
${smallWinsLog.length > 0 ? smallWinsLog.map(w => `  * ${w}`).join('\n') : '  * (No small wins logged)'}
`.trim();

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

  const systemPrompt = `You are a personal companion. Review daily logs and provide concise summaries.`;

  const userPromptText = `Daily log analysis. Provide JSON only.

Metadata: Mood: ${mood}, Energy: ${energy}/5, Sleep: ${sleepHours} hours

USER LOGGED DATA:
- COMPLETED TASKS [x]: ${completedTasks.length > 0 ? completedTasks.slice(0,5).join(", ") : "None"}
- UNFINISHED TASKS [ ]: ${unfinishedTasks.length > 0 ? unfinishedTasks.slice(0,5).join(", ") : "None"}
- HABITS: ${checkedHabits.length > 0 ? checkedHabits.slice(0,3).join(", ") : "None"}
- DEV: ${devLog.length > 0 ? devLog.slice(0,3).join(", ") : "None"}
- LEISURE: ${leisureLog.length > 0 ? leisureLog.slice(0,3).join(", ") : "None"}
- WINS: ${smallWinsLog.length > 0 ? smallWinsLog.slice(0,3).join(", ") : "None"}

JSON format:
{
  "quote":"1-sentence motivation",
  "summary":"1 paragraph summary",
  "reflection":"1 paragraph reflection",
  "tomorrow":["- [ ] task 1","- [ ] task 2","- [ ] task 3"]
}
`;

  let aiTomorrowSetupList = [];

  function parseResponse(fullText) {
    let quote = "";
    let summaryRef = "";
    let tomorrowItems = [];

    let text = fullText;

    // Strictly isolate Tomorrow Setup to prevent duplicate section leakage
    if (text.includes("SECTION 3:") || text.includes("TOMORROW SETUP:") || text.includes("## 🌙 Tomorrow Setup") || text.includes("## Tomorrow Setup")) {
      const s3Parts = text.split(/SECTION 3:|TOMORROW SETUP:|## 🌙 Tomorrow Setup|## Tomorrow Setup/i);
      text = s3Parts[0];
      const rawTomorrow = s3Parts.slice(1).join("\n").trim();
      const tLines = rawTomorrow.split("\n");
      for (const line of tLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- ")) {
          let item = trimmed.startsWith("- [ ]") ? trimmed : "- [ ] " + trimmed.replace(/^-\s*/, "");
          tomorrowItems.push(item);
        }
      }
    }

    if (text.includes("SECTION 2:") || text.includes("### Summary")) {
      const parts = text.split(/SECTION 2:|### Summary/i);
      quote = parts[0].replace(/SECTION 1:|MOTIVATION:|MOTIVATION \/ QUOTE:/gi, "").replace(/^"/, "").replace(/"$/, "").trim();
      summaryRef = "### Summary\n" + (parts[1] || text).trim();
    } else {
      const firstLineEnd = text.indexOf("\n");
      quote = text.substring(0, firstLineEnd).trim();
      summaryRef = text.substring(firstLineEnd).trim();
    }

    // Strip out any trailing Tomorrow Setup headers that leaked into summaryRef
    summaryRef = summaryRef.replace(/## 🌙 Tomorrow Setup[\s\S]*$/gi, "")
                           .replace(/## Tomorrow Setup[\s\S]*$/gi, "")
                           .replace(/SECTION 3[\s\S]*$/gi, "")
                           .trim();

    return { quote, summaryRef, tomorrowItems };
  }

  // 5. Call AI Provider (Gemini API with fallback models)
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
            generationConfig: {
              temperature: 0.7,
              topP: 0.95
            }
          })
        });

        const json = JSON.parse(res.text);
        if (json.candidates && json.candidates[0] && json.candidates[0].content) {
          const fullText = json.candidates[0].content.parts[0].text.trim();
          const parsed = parseResponse(fullText);
          motivationQuote = parsed.quote;
          summarySectionText = parsed.summaryRef;
          if (parsed.tomorrowItems.length > 0) aiTomorrowSetupList = parsed.tomorrowItems;
          if (summarySectionText) break; // Successfully generated content!
        }
      } catch (err) {
        console.warn(`Gemini API (${model}) Warning:`, err.message);
      }
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
      const parsed = parseResponse(text);
      motivationQuote = parsed.quote;
      summarySectionText = parsed.summaryRef;
      if (parsed.tomorrowItems.length > 0) aiTomorrowSetupList = parsed.tomorrowItems;
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
Progress focused on core daily tasks, completing key items while leaving open priorities for tomorrow. ==Fixing workflow hurdles brought clarity to today's focus.==

### AI Reflection
Logging mood and maintaining basic check-offs provides clarity. Tomorrow needs a clear focus to keep momentum without overextending.`;
  }

  // Clean quote & author formatting
  let authorAttribution = "";
  let cleanQuote = motivationQuote
    .replace(/^>\s*/, "")
    .replace(/^SECTION\s*\d*:?\s*/gi, "")
    .replace(/^MOTIVATION\s*\/?\s*QUOTE:?\s*/gi, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();

  if (cleanQuote.includes("—") || cleanQuote.includes(" - ")) {
    const parts = cleanQuote.split(/—| - /);
    cleanQuote = parts[0].replace(/^["'\s]+|["'\s]+$/g, "").trim();
    if (parts[1] && parts[1].trim()) {
      authorAttribution = parts[1].replace(/\*\*/g, "").replace(/^["'\s]+|["'\s]+$/g, "").trim();
    }
  } else {
    cleanQuote = cleanQuote.replace(/^["'\s]+|["'\s]+$/g, "").trim();
  }

  const quoteCallout = authorAttribution 
    ? `> [!QUOTE] 💡 Daily Spark\n> *"${cleanQuote}"*\n> — **${authorAttribution}**`
    : `> [!QUOTE] 💡 Daily Spark\n> *${cleanQuote}*`;

  // 6. Prepare Tomorrow Setup content
  let tomorrowSetupLines = ["What I want to carry or prepare for tomorrow."];
  const finalTasksToUse = aiTomorrowSetupList.length > 0 
    ? aiTomorrowSetupList 
    : (unfinishedTasks.length > 0 ? unfinishedTasks.map(t => `- [ ] ${t}`) : ["- [ ] "]);

  finalTasksToUse.forEach(t => tomorrowSetupLines.push(t.startsWith("- [ ]") ? t : `- [ ] ${t}`));
  const tomorrowSetupContent = tomorrowSetupLines.join("\n");

  // 7. Update sections cleanly
  if (content.includes("> [!QUOTE] 💡 Daily Spark")) {
    content = content.replace(/> \[!QUOTE\] 💡 Daily Spark[\s\S]*?(?=\n\n## |\n## |\n$)/, `${quoteCallout}`);
  } else if (content.includes("## ✨ Motivation")) {
    content = content.replace(/## ✨ Motivation\s*\n[\s\S]*?(?=\n\n## |\n## |\n$)/, `${quoteCallout}`);
  } else if (content.includes("> | **sleep_hours**")) {
    content = content.replace(/(> \| \*\*sleep_hours\*\*[\s\S]*?\n\n)/, `$1${quoteCallout}\n\n`);
  }

  if (content.includes("## 🤖 AI Daily Summary")) {
    content = content.replace(/(## 🤖 AI Daily Summary\s*\n)[\s\S]*?(?=\n## 🌙 Tomorrow Setup|\n## Tomorrow Setup|\n$)/, `$1${summarySectionText}\n\n`);
  } else if (content.includes("## AI Daily Summary")) {
    content = content.replace(/(## AI Daily Summary\s*\n)[\s\S]*?(?=\n## 🌙 Tomorrow Setup|\n## Tomorrow Setup|\n$)/, `$1${summarySectionText}\n\n`);
  }

  if (content.includes("## 🌙 Tomorrow Setup")) {
    content = content.replace(/## 🌙 Tomorrow Setup[\s\S]*$/, `## 🌙 Tomorrow Setup\n${tomorrowSetupContent}\n`);
  } else if (content.includes("## Tomorrow Setup")) {
    content = content.replace(/## Tomorrow Setup[\s\S]*$/, `## Tomorrow Setup\n${tomorrowSetupContent}\n`);
  } else {
    content += `\n\n## 🌙 Tomorrow Setup\n${tomorrowSetupContent}\n`;
  }

  await app.vault.modify(file, content);
  new Notice("✨ Daily Note enriched with AI Summary & Reflection!");
}
