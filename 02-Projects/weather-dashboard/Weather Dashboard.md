---
type: project
status: completed
priority: high
tags: [type/project, area/dev, status/completed, priority/high]
updated: 2026-09-02
---

# Weather Dashboard

## Goal
- A responsive weather dashboard built with React and TypeScript to search locations, view current and forecast weather, save favourite cities, and switch themes.

## Status
- Completed (Prototype Architecture & Code Review Milestone)

## Tech Stack
- React 19, TypeScript 6, Vite 8
- Tailwind CSS 4, shadcn/ui (Base UI + Nova preset)
- Lucide React, Geist font
- ESLint, Prettier

## Key Links
- Repository: https://github.com/lowqualityloey/weather-dashboard.git
- Live demo: Not documented
- Design: Not documented
- Documentation: README.md

## Project Structure
- `src/components/ui/` - shadcn/ui components (Base UI + Nova preset)
- `src/components/` - Presentational and container components (SearchBar, Sidebar, etc.)
- `src/lib/` - API requests, mappers, and utility functions
- `src/types/` - TypeScript interfaces
- `src/index.css` - Tailwind imports and theme tokens

## Features
- Search for a city using OpenWeather Geocoding API
- View current weather conditions and 5-day forecast
- Expand a forecast day to view weather at three-hour intervals
- Save and remove favourite cities with `localStorage`
- Toggle between light and dark themes
- Responsive desktop and mobile layouts
- Metric units (Celsius and km/h)

## API / Data
- [[06-Resources/APIs/OpenWeatherMap API|OpenWeatherMap API]]: Geocoding API & 5-day / 3-hour Forecast API
- Requires `VITE_OPENWEATHER_API_KEY` environment variable (stored in `.env`).

## 💡 Applied Architectural Concepts & Knowledge Links
- [[08-Concepts/Parse, Don't Validate|Parse, Don't Validate]] — Parsing raw OpenWeather JSON API payloads into strict application types at the API adapter layer.
- [[08-Concepts/Build-Time Optimization|Build-Time Optimization]] — Vite build tree shaking and Tailwind CSS asset minification.
- [[08-Concepts/Make Illegal States Unrepresentable|Make Illegal States Unrepresentable]] — Explicit forecast data structures preventing undefined weather condition crashes.

## Setup and Run
- Install: `yarn install`
- Development: `yarn dev`
- Build: `yarn build`
- Format/Lint: `yarn format`, `yarn lint`


## 📜 Progress Log
- 2026-08-02: Kanban and project note aligned with repository roadmap.
- 2026-08-11: Senior Frontend Code Review completed; technical debt register and refactoring roadmap established.
- 2026-08-13: Updated Kanban board and project focus to reflect P0 data wiring and stub completion.
- 2026-09-01: Reconciled milestone status and structured technical debt roadmap for future sprints.

