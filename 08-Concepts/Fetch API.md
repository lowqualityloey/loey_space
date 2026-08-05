---
created: 2026-08-02
updated: 2026-08-06
type: concept
status: active
area: general
tags:
  - type/concept
  - area/general
---

# Fetch API

## Summary
The **Fetch API** is a modern, native JavaScript interface that provides a Promise-based standard for making HTTP requests (GET, POST, PUT, DELETE, etc.) across web applications without needing external libraries like Axios or legacy `XMLHttpRequest`.

## Why it matters
- **Promise-Native & Clean Control Flow**: Operates natively using `async`/`await`, eliminating callback nesting and supporting clean asynchronous data fetching.
- **Unified Web & Server Standard**: Natively supported across all modern browsers, Node.js (v18+), Deno, Bun, and Cloudflare Workers.
- **Granular Request/Response Control**: Exposes explicit `Request`, `Response`, and `Headers` objects for full header inspection, authentication tokens, and body streams.
- **Cancellation & Streaming**: Integrates with `AbortController` for request timeouts and supports streaming large response payloads via `ReadableStream`.

## Examples
- **Basic `async`/`await` GET Request with Error Handling**:
```javascript
async function fetchWeatherData(city) {
  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric`);
    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch request failed:", error.message);
  }
}
```

- **POST Request with JSON Payload and Auth Headers**:
```javascript
async function postLogData(payload) {
  const response = await fetch("https://api.example.com/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_API_TOKEN"
    },
    body: JSON.stringify(payload)
  });
  return await response.json();
}
```

- **Cancelling Requests / Setting Timeouts with `AbortController`**:
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

try {
  const response = await fetch("/api/endpoint", { signal: controller.signal });
  clearTimeout(timeoutId);
  const data = await response.json();
} catch (err) {
  if (err.name === "AbortError") {
    console.warn("Fetch request timed out after 5 seconds");
  }
}
```

## Related concepts
- [[OpenWeatherMap API]]
- [[AI integration]]
- [[second brain]]

## Related notes (Auto-backlinks)
```dataview
LIST
FROM [[]] AND !"99-Templates"
WHERE file.name != this.file.name
SORT file.mtime DESC
```

## Questions
- **Why doesn't `fetch()` reject on 404 or 500 status codes?** *(Answer: `fetch()` only rejects on network failures or blocked requests. You must manually check `response.ok` or `response.status`).*
- **What is the difference between `.json()` and `.text()` body methods?** *(Answer: `.json()` parses the response body stream as a JSON object, whereas `.text()` returns the raw string payload. Both consume the body stream and can only be called once).*
- **How do CORS headers affect `fetch()` calls from frontend applications?** *(Answer: Cross-Origin Resource Sharing restrictions require the target server to return `Access-Control-Allow-Origin` headers for browser `fetch()` requests to succeed).*

## Next steps
- [ ] Implement robust `try/catch` and `response.ok` error handling for [[OpenWeatherMap API]] calls.
- [ ] Add an `AbortController` timeout wrapper for external API fetch calls in dev scripts.
- [ ] Practice mocking `fetch()` responses for unit testing.
