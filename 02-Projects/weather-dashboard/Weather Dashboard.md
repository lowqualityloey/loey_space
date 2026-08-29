---
type: project
status: completed
priority: high
tags:
  - type/project
  - area/dev
updated: 2026-08-24
---

# Weather Dashboard

## Goal
- A responsive weather dashboard built with React and TypeScript to search locations, view current and forecast weather, save favourite cities, and switch themes.

## Status
- Done

## Tech Stack
- [[React]] 19, TypeScript 6, Vite 8
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
- OpenWeather Geocoding API
- OpenWeather One Call API 3.0
- Requires `VITE_OPENWEATHER_API_KEY` environment variable.

## Setup and Run
- Install: `yarn install`
- Development: `yarn dev`
- Build: `yarn build`
- Format/Lint: `yarn format`, `yarn lint`

## Current Focus
- Build out component UI stubs (`CurrentWeather`, `ForecastList`, `ForecastDay`) and connect state management (`WeatherContext` & `useWeather` hook).

## Bugs / Blockers
- Component stubs returning `null`; data pipeline currently disconnected; missing state management layer and runtime API key validation.

## Next Actions
1. Connect `SearchBar` to `openWeather.ts` API via `WeatherContext`.
2. Build UI presentation components from stubs.
3. Implement `localStorage` persistence and dark mode toggle.
4. Add loading/error UI states and screen reader accessibility support.

## Progress Log
- 2026-08-02: Kanban and project note aligned with repository roadmap.
- 2026-08-11: Senior Frontend Code Review completed; technical debt register and refactoring roadmap established.
- 2026-08-13: Updated Kanban board and project focus to reflect P0 data wiring and stub completion.

