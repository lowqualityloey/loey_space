---

kanban-plugin: board
created: 2026-08-29
updated: 2026-09-02
type: kanban
status: active
area: daily
tags:
  - type/kanban
  - area/daily
  - topic/tasks

---

## 📌 Active To-Dos ([ ])

- [ ] [#12](https://github.com/lowqualityloey/shelf/issues/12) Build TanStack Router layouts (/, _authenticated, /library/$bookId) #priority/p1 [[shelf Kanban]]
- [ ] [#13](https://github.com/lowqualityloey/shelf/issues/13) Implement debounced Open Library search hook (useBookSearch) #priority/p1 [[shelf Kanban]]
- [ ] [#14](https://github.com/lowqualityloey/shelf/issues/14) Create core UI components (BookCard, ShelfSelector, StarRating) #priority/p2 [[shelf Kanban]]
- [ ] [#15](https://github.com/lowqualityloey/shelf/issues/15) Add optimistic update logic for reading status toggles #priority/p2 [[shelf Kanban]]
- [ ] [#16](https://github.com/lowqualityloey/shelf/issues/16) Build book details view with notes editor #priority/p2 [[shelf Kanban]]

## 🔄 Currently In Progress ([/])

- [/] [#11](https://github.com/lowqualityloey/shelf/issues/11) Configure Supabase Auth client & route guards #priority/p1 [[shelf Kanban]]
	  > 🌿 `feat/issue-11-configure-supabase-auth`
	  - [ ] Install `@supabase/supabase-js` and initialize Supabase client with project URL and anon key in `client`
	  - [ ] Create authentication forms/components (`LoginForm`, `SignUpForm`, `UserProfile`)
	  - [ ] Implement an authenticated layout guard that redirects unauthenticated users to login
	  - [ ] Attach Supabase session access token to outgoing API requests in `Authorization: Bearer <token>` header


## ✅ Recently Completed Tasks

- [x] feat(api): Implement full CRUD library REST endpoints with Zod validation and Drizzle relations (#6) #priority/p2 ✅ 2026-08-31 [[shelf Kanban]]
- [x] [#6](https://github.com/lowqualityloey/shelf/issues/6) Build Express REST API endpoints (/api/library) #priority/p1 ✅ 2026-08-31 [[shelf Kanban]]
- [x] [#5](https://github.com/lowqualityloey/shelf/issues/5) Scaffold PostgreSQL schema (users, books, user_books) #priority/p1 ✅ 2026-08-27 [[shelf Kanban]]
- [x] [#7](https://github.com/lowqualityloey/shelf/issues/7) Configure express-oauth2-jwt-bearer auth middleware #priority/p1 ✅ 2026-08-27 [[shelf Kanban]]
- [x] feat(db): scaffold PostgreSQL schema and Drizzle migrations #priority/p2 ✅ 2026-08-27 [[shelf Kanban]]
- [x] feat(auth): implement authentication middleware and add protected route #priority/p2 ✅ 2026-08-27 [[shelf Kanban]]
- [x] finishing the weather dashboard app ✅ 2026-08-24 [[2026-08-22]]
- [x] [#1](https://github.com/lowqualityloey/shelf/issues/1) Initialize Vite + React + TypeScript repository ✅ 2026-08-24 [[shelf Kanban]]
- [x] [#3](https://github.com/lowqualityloey/shelf/issues/3) Design UX wireframes and screen mockups ✅ 2026-08-24 [[shelf Kanban]]
- [x] [#4](https://github.com/lowqualityloey/shelf/issues/4) Define REST API contracts and PostgreSQL schema #priority/p2 ✅ 2026-08-24 [[shelf Kanban]]
- [x] Define REST API contracts and PostgreSQL schema design ✅ 2026-08-24 [[shelf Kanban]]
- [x] Laundry ✅ 2026-08-22 [[2026-08-20]]
- [x] Set up Vitest & React Testing Library test suite #priority/p2 ✅ 2026-08-22 [[Weather Dashboard Kanban]]
- [x] Unit test weatherMapper utilities and useWeather hook #priority/p2 ✅ 2026-08-22 [[Weather Dashboard Kanban]]
- [x] Add search input debouncing (useDebounce) #priority/p2 ✅ 2026-08-22 [[Weather Dashboard Kanban]]
- [x] Add browser geolocation weather detection #priority/p2 ✅ 2026-08-22 [[Weather Dashboard Kanban]]
- [x] Implement API response caching with TTL #priority/p3 ✅ 2026-08-22 [[Weather Dashboard Kanban]]




%% kanban:settings
```
{"kanban-plugin":"board","lane-width":320,"list-collapse":[null,null]}
```
%%