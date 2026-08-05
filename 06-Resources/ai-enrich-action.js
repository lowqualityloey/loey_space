module.exports = async function aiEnrichAction(params) {
  const app = (params && params.app) ? params.app : (window.app || app);
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

  const systemPrompt = `You are a thoughtful, observant, and articulate personal companion reviewing my daily journal note in Obsidian.
Your tone is deeply human, casual, grounded, observant, and reflective — like a smarter, clearer version of me writing at the end of the day.

STRICT WRITING RULES & FORBIDDEN LANGUAGE:
- NO corporate, startup, or generic productivity buzzwords (e.g., "operational baseline", "steady execution", "maintaining momentum", "key deliverables", "operationally strong", "optimizing bandwidth", "synergy", "paradigm").
- NO therapist clichés, artificial cheerleading, or generic self-help platitudes (e.g., "be kind to yourself", "every step counts", "remember to breathe", "embrace the journey").
- Avoid repetitive sentence openings or rigid templates. Prefer specific, concrete observations over abstract claims.
- Write like a real person with genuine opinions, emotional texture, self-awareness, and natural em-dashes (—).`;

  const userPromptText = `Synthesize and analyze this Obsidian daily log note based STRICTLY on the user's logged data below.

${userLoggedDataText}

CRITICAL ACCURACY & GROUNDING RULES:
1. ONLY summarize activities, tasks, wins, thoughts, and progress explicitly listed under USER LOGGED DATA FOR TODAY above.
2. Differentiate clearly between COMPLETED TASKS [x] vs UNFINISHED TASKS [ ]. Mention what actually got done and what stayed open.
3. Do NOT invent fake activities or repeat generic productivity fluff.
4. Ground every single claim on the specific notes, dev progress, leisure activities, and small wins recorded.

CRITICAL WIKILINK RULE:
Only use Obsidian wikilinks [[Note Title]] if the title EXACTLY matches one of these existing vault notes:
[${existingNotesListStr}]
If a term is not in this list, use **bold text** instead. DO NOT invent uncreated wikilinks!

SECTION 1: MOTIVATION / QUOTE
Provide a short, grounded quote that fits the exact mood and feel of today.
If the quote is from a known historical figure, author, or thinker, append " - Author Name" (e.g. "Do what you can - Theodore Roosevelt"). If it is an unauthored observation or personal thought, do NOT append an author.

SECTION 2: AI DAILY SUMMARY & REFLECTION
Provide exactly two sub-sections:

### Summary
Write a short, concise end-of-day summary in 1 to 2 compact paragraphs (around 70 to 120 words TOTAL).
- Keep it punchy, direct, and brief — absolutely NO long walls of text.
- Summarize what got done, what remained open, and how the day felt.
- Apply Obsidian Markdown highlight syntax ==highlight sentence== to 1 key takeaway sentence.

### AI Reflection
Write a short, concise personal reflection in 1 compact paragraph (around 50 to 90 words TOTAL).
- Keep it brief, honest, and direct — write like a quick thought out loud at the end of the day.
- Mention key mindset or lesson without long-winded fluff.

SECTION 3: TOMORROW SETUP
Do NOT copy tasks word-for-word from earlier sections. Infer what tomorrow should actually focus on based on the unfinished tasks and user notes above.
Provide 3 to 5 prioritized actionable bullet points formatted as markdown checkboxes:
- [ ] Actionable task 1 (the main thing / top priority)
- [ ] Actionable task 2
- [ ] Actionable task 3
(Optionally 4 and 5 if relevant)

Instructions for Tomorrow Setup:
- Make decisions: if today was overloaded or messy, simplify tomorrow to 3 focused tasks instead of carrying everything over.
- Rewrite tasks in clearer, smarter, well-phrased language.`;

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
    const modelsToTry = ["gemini-flash-latest", "gemini-2.0-flash-lite", "gemini-2.5-flash-lite"];
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
};
