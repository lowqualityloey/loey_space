---
type: project
status: in progress
priority: high
tags:
  - type/project
  - area/dev
---

# Weather Dashboard

## Goal
- A responsive weather dashboard built with React and TypeScript to search locations, view current and forecast weather, save favourite cities, and switch themes.

## Status
- In progress

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
- Build static dashboard layout with mock data

## Bugs / Blockers
- None documented

## Next Actions
- [ ] Implement theme toggle functionality
- [ ] Add collapsible accordion for hourly forecast
- [ ] Connect city search to Geocoding API

## Progress Log
- 2026-08-02: Kanban and project note aligned with repository roadmap.
