---
type: dashboard
status: active
area: general
tags:
  - type/dashboard
---

# 🏠 Welcome Home

> Your Second Brain Central Hub

---

## ⚡ Quick Navigation

| Folder           | MOC Link                                                               | Purpose                            |
| :--------------- | :--------------------------------------------------------------------- | :--------------------------------- |
| **📥 Inbox**     | [[00-Inbox/_Inbox MOC\|Inbox MOC]]                                     | Quick capture & triage             |
| **🚀 Projects**  | [[02-Projects/_Projects MOC\|Projects MOC]]                            | Active development & builds        |
| **💻 Dev**       | [[03-Dev/_Dev MOC\|Dev MOC]]                                           | Code snippets & technical patterns |
| **📖 Learning**  | [[04-Learning/_Learning MOC\|Learning MOC]]                            | Courses & React concepts           |
| **🏋️ Personal** | [[05-Personal/_Personal MOC\|Personal MOC]]                            | Goals, life & gym notes            |
| **📚 Resources** | [[06-Resources/_Resources MOC\|Resources MOC]]                         | Reference links & cheatsheets      |
| **📊 Reviews**   | [[07-Reviews/_Reviews MOC\|Reviews MOC]]                               | Weekly & monthly reviews           |
| **🧠 Guide**     | [[06-Resources/Second Brain Guide\|Workflow Guide]]                    | System usage & daily routine       |
| **🛡️ Security**  | [[06-Resources/Vault Security Policy\|Security Policy]]                 | Secrets handling & Git safety      |

---

## ✅ Next Actions (Across Projects & Learning)
```dataview
TASK
FROM "02-Projects" OR "04-Learning" OR "01-Daily"
WHERE !completed AND file.name != "Kanban" AND !contains(file.name, "MOC")
LIMIT 10
```

---

## 🚀 Active Projects
```dataview
TABLE status AS "Status", priority AS "Priority", tags AS "Tags"
FROM "02-Projects"
WHERE type = "project" AND status != "completed"
SORT priority DESC
```

---

## 📥 Inbox Needs Review
```dataview
TABLE file.ctime AS "Captured Date"
FROM "00-Inbox"
WHERE file.name != "_Inbox MOC" AND file.name != "Quick capture dump. Empty it weekly."
```

---

## 📖 Current Learning Focus
```dataview
TABLE topic AS "Topic", source_url AS "Resource Link"
FROM "04-Learning"
WHERE status = "in-progress"
```

---

## 🕒 Recently Modified Notes
```dataview
TABLE file.folder AS "Folder", file.mtime AS "Last Modified"
FROM ""
WHERE !contains(file.path, "99-Templates") AND !contains(file.name, "MOC") AND file.name != "Home"
SORT file.mtime DESC
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

---

## 📅 Recent Daily Notes
```dataview
TABLE mood AS "Mood", energy AS "Energy", sleep_hours AS "Sleep (hrs)"
FROM "01-Daily"
SORT file.name DESC
LIMIT 7
```

---

## 🏷️ Vault Metadata & Status Legend

| Property        | Allowed / Standard Values                                                  | Description                             |
| :-------------- | :------------------------------------------------------------------------- | :-------------------------------------- |
| `type`          | `project`, `learning`, `resource`, `snippet`, `review`, `dashboard`, `moc` | Schema identifier                       |
| `status`        | `planning`, `in-progress`, `completed`, `active`, `archived`               | Lifecycle state                         |
| `area`          | `dev`, `learning`, `personal`, `general`                                   | Domain category                         |
| `priority`      | `high`, `medium`, `low`                                                    | Urgency                                 |
| `source_type`   | `article`, `video`, `documentation`, `repo`, `tool`, `book`                | Resource medium                         |
| `last_reviewed` | `YYYY-MM-DD`                                                               | Last date of active review              |
| `review_cycle`  | `7d`, `14d`, `30d`                                                         | Review frequency threshold for projects |
