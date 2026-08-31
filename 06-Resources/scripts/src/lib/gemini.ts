export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

export interface GeminiFailure {
  status: number;
  kind: string;
  message: string;
  retrySeconds: number;
  quotaId?: string;
  quotaValue?: string;
  model: string;
}

// Classifies a Gemini error response. Google puts the useful information in the
// response body: a RetryInfo entry with retryDelay, and a QuotaFailure entry
// whose quotaId says whether the limit was per-minute or per-day.
export function parseGeminiError(status: number, bodyText: string, model: string): GeminiFailure {
  let message = "";
  let retrySeconds = 0;
  let quotaId: any = "";
  let quotaValue = "";

  try {
    const body = JSON.parse(bodyText);
    const error = body.error || {};
    message = error.message || "";
    const details = Array.isArray(error.details) ? error.details : [];

    for (const detail of details) {
      const type = String(detail["@type"] || "");
      if (type.includes("RetryInfo") && detail.retryDelay) {
        const seconds = String(detail.retryDelay).match(/([\d.]+)\s*s/);
        if (seconds) retrySeconds = Math.ceil(parseFloat(seconds[1]));
      }
      if (type.includes("QuotaFailure") && Array.isArray(detail.violations) && detail.violations.length) {
        quotaId = detail.violations[0].quotaId || "";
        quotaValue = detail.violations[0].quotaValue || "";
      }
    }
  } catch (e) {
    message = String(bodyText || "").slice(0, 200);
  }

  let kind = "unknown";
  if (status === 429) {
    if (/PerDay/i.test(quotaId)) kind = "quotaPerDay";
    else if (/PerMinute/i.test(quotaId)) kind = "quotaPerMinute";
    else if (/Token/i.test(quotaId)) kind = "quotaTokens";
    else kind = retrySeconds > 120 ? "quotaPerDay" : "quotaPerMinute";
  } else if (status === 404) kind = "modelMissing";
  else if (status === 400) kind = "badRequest";
  else if (status === 401 || status === 403) kind = "auth";
  else if (status >= 500) kind = "serverError";

  return { status, kind, message, retrySeconds, quotaId, quotaValue, model };
}

// Free-tier daily quotas reset at midnight Pacific, expressed in local time.
export function describeQuotaReset(): string {
  try {
    const now = new Date();
    const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const msUntilReset = ((24 - pacific.getHours()) * 60 - pacific.getMinutes()) * 60 * 1000;
    const resetLocal = new Date(now.getTime() + msUntilReset);
    const hours = Math.max(1, Math.round(msUntilReset / 3600000));
    const clock = resetLocal.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `in about ${hours}h (around ${clock} your time)`;
  } catch (e) {
    return "at midnight Pacific time";
  }
}

// Turns a failure into one plain-language sentence for the Obsidian notice.
export function formatGeminiFailure(failure: GeminiFailure | null | undefined): string {
  if (!failure) return "the request failed";

  switch (failure.kind) {
    case "quotaPerMinute":
      return failure.retrySeconds
        ? `per-minute rate limit hit — Google says retry in about ${failure.retrySeconds}s`
        : "per-minute rate limit hit — wait about a minute and run it again";
    case "quotaPerDay":
      return `daily free-tier quota used up${failure.quotaValue ? ` (limit ${failure.quotaValue} requests/day on ${failure.model})` : ""} — resets ${describeQuotaReset()}, so waiting a few minutes will NOT help`;
    case "quotaTokens":
      return "tokens-per-minute quota hit — wait a minute, or shorten the note";
    case "auth":
      return `API key rejected (HTTP ${failure.status}) — check GEMINI_API_KEY in .env`;
    case "badRequest":
      return `request rejected (400): ${failure.message || "invalid request"}`;
    case "modelMissing":
      return "none of the configured models are available for this key (404)";
    case "serverError":
      return `Google server error (${failure.status}) — try again shortly`;
    case "network":
      return `network error: ${failure.message}`;
    case "emptyResponse":
      return `model returned no content${failure.message ? ` (${failure.message})` : ""}`;
    case "badJson":
      return "model returned text that was not valid JSON";
    case "noKey":
      return "GEMINI_API_KEY is missing from .env";
    default:
      return failure.message || "the request failed";
  }
}

// One Gemini request with model fallback and quota-aware retries.
export async function callGeminiJson(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  label: string,
  temperature?: number
): Promise<{ data: any; model: string; failure: GeminiFailure | null }> {
  let failure: GeminiFailure = { status: 0, kind: "unknown", message: "request failed", retrySeconds: 0, model: "" };

  const reqUrl = (window as any).requestUrl || (globalThis as any).requestUrl || requestUrl;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: any = null;

      try {
        res = await reqUrl({
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          throw: false,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: typeof temperature === "number" ? temperature : 0.6
            }
          })
        });
      } catch (e: any) {
        failure = { status: 0, kind: "network", message: e?.message ? e.message : String(e), retrySeconds: 0, model };
        console.warn(`${label}: ${model} network error — ${failure.message}`);
        break;
      }

      if (res.status === 200) {
        try {
          const json = JSON.parse(res.text);
          const candidate = json.candidates && json.candidates[0];
          const parts = candidate && candidate.content && candidate.content.parts;
          const text = parts && parts[0] && parts[0].text ? parts[0].text.trim() : "";

          if (!text) {
            failure = {
              status: 200,
              kind: "emptyResponse",
              retrySeconds: 0,
              model,
              message: `finishReason: ${candidate ? candidate.finishReason : "none"}`
            };
            console.warn(`${label}: ${model} returned no usable content`, json);
            break;
          }

          const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
          return { data: JSON.parse(clean), model, failure: null };
        } catch (e: any) {
          failure = { status: 200, kind: "badJson", message: e?.message ? e.message : String(e), retrySeconds: 0, model };
          console.warn(`${label}: ${model} returned unparsable JSON — ${failure.message}`);
          break;
        }
      }

      failure = parseGeminiError(res.status, res.text, model);
      console.warn(
        `${label}: ${model} → HTTP ${res.status} [${failure.kind}]${failure.quotaId ? ` quotaId=${failure.quotaId}` : ""}${failure.retrySeconds ? ` retryDelay=${failure.retrySeconds}s` : ""} — ${failure.message}`
      );

      if (failure.kind === "quotaPerMinute" && attempt === 0) {
        const waitSeconds = Math.min(Math.max(failure.retrySeconds || 6, 5), 20);
        console.log(`${label}: waiting ${waitSeconds}s before retrying ${model}`);
        await new Promise(r => setTimeout(r, waitSeconds * 1000));
        continue;
      }
      break;
    }

    if (failure.kind === "auth" || failure.kind === "badRequest") {
      console.warn(`${label}: aborting model fallback — ${failure.kind} affects all models`);
      break;
    }
  }

  console.warn(`${label}: all models failed — ${formatGeminiFailure(failure)}`);
  return { data: null, model: "", failure };
}
