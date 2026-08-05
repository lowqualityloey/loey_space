---
created: <% tp.date.now("YYYY-MM-DD") %>
updated: <% tp.date.now("YYYY-MM-DD") %>
last_reviewed: <% tp.date.now("YYYY-MM-DD") %>
review_cycle: 14d
type: project
status: planning
priority: medium
area: dev
tags:
  - type/project
  - area/dev
  - status/planning
  - priority/medium
---
<%*
  const title = tp.file.title;
  const folder = tp.file.folder(true);
  if (title && title !== "Project") {
    const kanbanPath = `${folder}/${title} Kanban.md`;
    const kanbanContent = `---

kanban-plugin: board

---

## Backlog

- [ ] 


## To Do

- [ ] 


## In Progress

- [ ] 


## Review / Test



## Done




%% kanban:settings
\`\`\`
{"kanban-plugin":"board"}
\`\`\`
%%`;

    if (!await tp.file.exists(kanbanPath)) {
      await app.vault.create(kanbanPath, kanbanContent);
    }
  }
-%>

# <% tp.file.title %>

## Goal
- 

## Status
- Planning

## Tech Stack
- 

## Key Links
- Repository: 
- Live demo: 
- Design: 
- Documentation: 

## Project Structure
- 

## Features
- [ ] 

## API / Data
- 

## Setup and Run
- Install: 
- Development: 
- Build: 

## Current Focus
- 

## Project Board
- [[<% tp.file.title %> Kanban]]

## Bugs / Blockers
- None

## Next Actions
- [ ] 

## Progress Log
- <% tp.date.now("YYYY-MM-DD") %>: Project created.