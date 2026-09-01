---
created: 2026-08-09
updated: 2026-09-01
type: moc
status: active
area: inbox
tags:
  - type/moc
  - area/inbox
---

# 📥 Inbox Dashboard & Capture Hub

> *Capture everything here before sorting. Triage by tagging each line with a destination token, then run **Triage Sweep** to file them. Rule: empty this weekly.*

```dataviewjs
// Single pressure line: how much is waiting, how old, how much is ready to file.
const dumpPath = "00-Inbox/quick-capture-dump.md";
const TOKEN = /#(do|dev|concept|learn|ref|personal|project|bin)\b/;

let open = 0, tagged = 0, oldest = null;

try {
  const raw = (await dv.io.load(dumpPath)) || "";
  let inTriaged = false, date = null;

  for (const line of raw.split(/\r?\n/)) {
    // Anything under the Triaged log is history, not workload.
    if (/^##\s+.*Triaged/i.test(line)) { inTriaged = true; continue; }
    else if (/^##\s+/.test(line)) { inTriaged = false; }
    if (inTriaged) continue;

    const heading = line.match(/^###\s+.*?(\d{4}-\d{2}-\d{2})/);
    if (heading) { date = heading[1]; continue; }

    if (/^\s*-\s+\S/.test(line)) {
      open++;
      if (TOKEN.test(line)) tagged++;
      if (date && (!oldest || date < oldest)) oldest = date;
    }
  }
} catch (e) {
  dv.paragraph("⚠️ Could not read the capture dump.");
}

const loose = dv.pages('"00-Inbox"')
  .where(p => !p.file.name.startsWith("_") && p.file.name !== "quick-capture-dump").length;

const total = open + loose;
const days = oldest ? Math.floor((Date.now() - new Date(oldest + "T00:00:00").getTime()) / 86400000) : 0;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

if (total === 0) {
  dv.paragraph("✅ **Inbox clear.**");
} else {
  const parts = [`📥 **${plural(total, "item")} waiting**`];
  if (oldest && days > 0) parts.push(`oldest ${plural(days, "day")}`);
  parts.push(tagged > 0 ? `**${tagged} ready to sweep**` : "none tagged yet");
  if (loose > 0) parts.push(`${plural(loose, "loose note")}`);
  dv.paragraph(parts.join(" · "));
}
```

> [!TIP] Triage = tag the line, then sweep
> Append one token to any capture line, then run **QuickAdd: 🧹 Triage Sweep** from the command palette (`Ctrl + P`).
>
> | Token | Goes to |
> | :--- | :--- |
> | `#do` | today's daily note, under ✅ Tasks |
> | `#dev` | `03-Dev/` |
> | `#concept` | `08-Concepts/` |
> | `#learn` | `04-Learning/` |
> | `#ref` | `06-Resources/` |
> | `#personal` | `05-Personal/` |
> | `#project` | `02-Projects/` |
> | `#bin` | dropped (logged in Triaged, not filed) |
>
> Untagged lines stay put. Swept lines move to the **Triaged** log at the bottom of the dump, so nothing is silently deleted.

---

## 📌 Unprocessed Notes

Loose notes sitting in the inbox — the dump is tracked separately below.

```dataview
TABLE file.ctime AS "Created", tags AS "Tags"
FROM "00-Inbox"
WHERE !startswith(file.name, "_") AND file.name != "quick-capture-dump"
SORT file.ctime DESC
```

---

## 📝 Quick Notes Dump

![[quick-capture-dump]]

