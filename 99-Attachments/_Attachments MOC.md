---
created: 2026-08-02
updated: 2026-10-06
type: moc
status: active
area: attachments
tags:
  - type/moc
  - area/attachments
---

# 📁 Attachments & Media Dashboard

Media and binary assets — images, screenshots, PDFs, audio, and exports, filed into monthly `YYYY-MM/` subfolders. Keeps assets out of your note flow.

---

## 🖼️ Recent Media & Attachments
```dataviewjs
const files = app.vault.getFiles().filter(f => f.path.startsWith("99-Attachments/") && f.name !== "_Attachments MOC.md");
files.sort((a, b) => b.stat.mtime - a.stat.mtime);

if (files.length > 0) {
  dv.table(["Preview / File", "Subfolder", "Size (KB)", "Last Modified"], files.map(f => [
    `![[${f.name}|120]]`,
    f.parent ? f.parent.name : "99-Attachments",
    (f.stat.size / 1024).toFixed(1),
    moment(f.stat.mtime).format("YYYY-MM-DD HH:mm")
  ]));
} else {
  dv.paragraph("No media attachments found in 99-Attachments.");
}
```

---

## 🧹 Attachment Hygiene & Tips

> [!TIP] **Pasting Screenshots**
> The **Custom Attachment Location** plugin is the single placement authority for new attachments. Configured with the pattern `99-Attachments/${date:{momentJsFormat:'YYYY-MM'}}`, it files pasted images and screenshots into `99-Attachments/YYYY-MM/`. Obsidian's core attachment root stays at `99-Attachments` as the compatible fallback, so nothing lands outside this folder even with the plugin off. See [[Setup & Configuration]] §1.1 for the sanitized settings.

> [!NOTE] **Drawings & Markdown are notes, not media**
> Excalidraw drawings (`.excalidraw.md`) and any Markdown file are notes, so they stay with their peers and are excluded from attachment collection — they are never pulled into `99-Attachments`. Their hygiene is note hygiene (frontmatter, links, review cycle), not an image sweep.

> [!NOTE] **Cleaning Up Unused Images**
> If you delete notes over time, leftover images can linger in `99-Attachments`. You can use plugins like **Clear Unused Images** to scan and delete unused attachment files in one click! Back up first, and prefer link-preserving moves so no reference is silently broken.
