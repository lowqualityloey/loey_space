---
created: 2026-08-02
updated: 2026-08-02
type: resource
url: https://openweathermap.org/api
category: api
area: dev
tags:
  - type/resource
  - area/dev
  - topic/api
  - tool/openweather
---

# OpenWeatherMap API

## Purpose
Provides current weather conditions, 5-day / 3-hour forecasts, and geocoding city search for the [[Weather Dashboard]] project.

## Project
- Related project: [[Weather Dashboard]]
- Owner: Loey
- Status: Active (Production Integration)

## Setup
- Base URL: `https://api.openweathermap.org/data/2.5/`
- Auth type: API Key query parameter (`appid=...`)
- Required scopes: Public read (weather & geocoding)
- Environment variable name: `VITE_OPENWEATHER_API_KEY`
- Secret location: `.env`
- Rotation date: 2026-12-31

## Key Endpoints
1. **Geocoding Search**: `GET /geo/1.0/direct?q={city_name}&limit=5&appid={API_KEY}`
2. **Current Weather**: `GET /weather?lat={lat}&lon={lon}&units=metric&appid={API_KEY}`
3. **5-Day Forecast**: `GET /forecast?lat={lat}&lon={lon}&units=metric&appid={API_KEY}`

## Usage Notes
- **Units**: Always pass `units=metric` to get Celsius temperature and km/h wind speeds.
- **Icons**: Weather icons are retrieved from `https://openweathermap.org/img/wn/{icon_code}@2x.png`.
- **Client Implementation**: API service helper located in `src/lib/api.ts` in the `weather-dashboard` repository.

## Related
- [[Weather Dashboard]]
- [[08-Concepts/Fetch API|Fetch API]]
- [[06-Resources/Vault Security Policy|Vault Security Policy]]

## Risks / Limits
- Rate limits: 60 calls/minute (Free Tier).
- Cost notes: Free Tier (1,000 calls/day free). No credit card required.
- Privacy notes: Only city names and approximate lat/lon are sent. No user PII transmitted.

## Next Steps
- [x] Integrate Geocoding API for city search
- [x] Wire 5-day forecast cards
- [ ] Add error fallback UI when API key is missing or quota is exceeded
