---
type: dashboard
status: active
area: general
tags:
  - type/dashboard
updated: 2026-08-03
---

# 🏠 Welcome Home

> Your Second Brain Central Hub

---

## ⚡ Quick Navigation

| Folder           | MOC / Hub Link                                          | Purpose                            |
| :--------------- | :------------------------------------------------------ | :--------------------------------- |
| **📥 Inbox**     | [[00-Inbox/_Inbox MOC\|Inbox MOC]]                      | Quick capture & triage             |
| **🚀 Projects**  | [[02-Projects/_Projects MOC\|Projects MOC]]             | Active development & builds        |
| **💻 Dev**       | [[03-Dev/_Dev MOC\|Dev MOC]]                            | Code snippets & technical patterns |
| **📖 Learning**  | [[04-Learning/_Learning MOC\|Learning MOC]]             | Courses & React concepts           |
| **🏋️ Personal** | [[_Personal MOC\|Personal MOC]]                         | Goals, life & gym notes            |
| **📚 Resources** | [[06-Resources/_Resources MOC\|Resources MOC]]          | Reference links & cheatsheets      |
| **🔌 APIs**      | [[06-Resources/APIs/_APIs MOC\|APIs MOC]]               | API specs & integration docs       |
| **📊 Reviews**   | [[07-Reviews/_Reviews MOC\|Reviews MOC]]                | Weekly & monthly reviews           |
| **💡 Concepts**  | [[08-Concepts/_Concepts MOC\|Concepts MOC]]             | Evergreen concept hubs             |
| **🧠 Guide**     | [[06-Resources/Second Brain Guide\|Workflow Guide]]     | System usage & daily routine       |
| **🛡️ Security** | [[06-Resources/Vault Security Policy\|Security Policy]] | Secrets handling & Git safety      |

---

## ✅ Next Actions (Across Projects, Dev & Learning)

```dataview
TASK
FROM "02-Projects" OR "03-Dev" OR "04-Learning"
WHERE !completed
AND text != ""
AND !contains(file.name, "Kanban")
AND !contains(file.name, "MOC")
SORT file.mtime DESC
LIMIT 10
```

---

## 🚀 Active Projects

```dataview
TABLE WITHOUT ID
file.link AS "Project",
status AS "Status",
priority AS "Priority",
file.tags AS "Tags"
FROM "02-Projects"
WHERE !contains(file.name, "Kanban") AND !contains(file.name, "MOC")
SORT file.mtime DESC
LIMIT 10
```

---

## 📥 Unprocessed Inbox Notes

```dataviewjs
const pages = dv.pages('"00-Inbox"').where(p => p.file.name !== "_Inbox MOC" && !p.file.name.includes("quick-capture-dump"));
if (pages.length > 0) {
  dv.table(["Note", "Captured Date"], pages.map(p => [p.file.link, p.file.ctime]));
} else {
  dv.paragraph("🎉 Inbox is completely clear!");
}
```

---

## 📖 Current Learning Focus

```dataview
TABLE topic AS "Topic", source_url AS "Resource Link"
FROM "04-Learning"
WHERE file.name != "_Learning MOC"
SORT file.mtime DESC
LIMIT 5
```

---

## 💡 Recent Evergreen Concepts

```dataview
TABLE summary AS "Summary", updated AS "Updated"
FROM "08-Concepts"
WHERE file.name != "_Concepts MOC"
SORT file.mtime DESC
LIMIT 5
```

---

## 📅 Recent Daily Logs

```dataview
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)"
FROM "01-Daily"
WHERE file.name != "_Daily MOC"
SORT file.name DESC
LIMIT 7
```

---

## 🔗 Unlinked / Orphan Notes

```dataview
TABLE file.folder AS "Folder", file.ctime AS "Created"
FROM ""
WHERE length(file.inlinks) = 0
AND file.path != "Home.md"
AND !contains(file.path, "99-Templates/")
AND !contains(file.name, "MOC")
SORT file.ctime DESC
LIMIT 5
```
