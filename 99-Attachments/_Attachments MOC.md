---
created: 2026-08-02
type: moc
tags:
  - type/moc
  - area/attachments
---

# 📁 Attachments & Media Dashboard

Central hub for tracking images, screenshots, PDFs, and binary attachments in your second brain.

---

## 🖼️ Recent Media & Attachments
```dataview
LIST
FROM "99-Attachments"
WHERE file.name != "_Attachments MOC" AND !endsWith(file.name, ".md")
SORT file.mtime DESC
LIMIT 25
```

---

## 🧹 Attachment Hygiene & Tips

> [!TIP] **Pasting Screenshots**
> When you copy-paste screenshots or images into any note, Obsidian automatically stores them cleanly inside `99-Attachments/`.

> [!NOTE] **Cleaning Up Unused Images**
> If you delete notes over time, leftover images can linger in `99-Attachments`. You can use plugins like **Clear Unused Images** to scan and delete unused attachment files in one click!
