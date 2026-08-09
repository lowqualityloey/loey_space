---
created: 2026-08-02
type: moc
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
> When you copy-paste screenshots or images into any note, Obsidian automatically stores them cleanly inside `99-Attachments/YYYY-MM/`.

> [!NOTE] **Cleaning Up Unused Images**
> If you delete notes over time, leftover images can linger in `99-Attachments`. You can use plugins like **Clear Unused Images** to scan and delete unused attachment files in one click!
