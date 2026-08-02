---
created: 2026-08-02
updated: 2026-08-02
type: snippet
language: JavaScript
tags:
  - type/snippet
  - tech/
  - api
  - fetch
  - weather
  - openweathermap
  - debugging
  - javascript
---
# Fetching Data with [[JavaScript]]

```js
async function getCurrentWeather(city, apiKey) {
  const units = 'imperial'; // or 'metric' for Celsius
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${units}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Handle HTTP errors
      const errorData = await response.json();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message}`);
    }
    const data = await response.json();
    console.log(`Current weather for ${city}:`, data);
    return data;
  } catch (error) {
    console.error("Error fetching current weather data:", error);
    // You might want to display an error message to the user here
    return null;
  }
}

// --- How to use it ---
// Replace 'YOUR_API_KEY' with the actual API key you obtained from OpenWeatherMap
const MY_API_KEY = 'YOUR_API_KEY';
const CITY_NAME = 'San Francisco'; // Or any city you want to test

// Call the function
getCurrentWeather(CITY_NAME, MY_API_KEY);

// You can also fetch the 5-day forecast similarly:
async function getFiveDayForecast(city, apiKey) {
  const units = 'imperial';
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=${units}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message}`);
    }
    const data = await response.json();
    console.log(`5-day forecast for ${city}:`, data);
    return data;
  } catch (error) {
    console.error("Error fetching 5-day forecast data:", error);
    return null;
  }
}

// getFiveDayForecast(CITY_NAME, MY_API_KEY); // Uncomment to test the forecast API

```

## Explanation
This JavaScript snippet fetches current weather and 5-day forecast data from the [[OpenWeatherMap]] API using fetch. It returns JSON data for a selected city and includes error handling for invalid API keys or failed requests

## Related
- "[[OpenWeatherMap API]]" 
- "[[Fetch API]]" 
- "[[HTTP 401 Error]]" 
- "[[Weather Dashboard]]"

