import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeminiError, formatGeminiFailure } from '../src/lib/gemini.ts';

test('parseGeminiError: parses 429 quota error correctly', () => {
  const bodyText = JSON.stringify({
    error: {
      message: 'Resource exhausted',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: '15.5s'
        },
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [{ quotaId: 'PerMinutePerProject', quotaValue: '15' }]
        }
      ]
    }
  });

  const failure = parseGeminiError(429, bodyText, 'gemini-2.5-flash');
  assert.equal(failure.status, 429);
  assert.equal(failure.kind, 'quotaPerMinute');
  assert.equal(failure.message, 'Resource exhausted');
  assert.equal(failure.retrySeconds, 16);
  assert.equal(failure.quotaId, 'PerMinutePerProject');
  assert.equal(failure.quotaValue, '15');
  assert.equal(failure.model, 'gemini-2.5-flash');
});

test('parseGeminiError: handles non-JSON body gracefully', () => {
  const failure = parseGeminiError(500, 'Internal Server Error raw html', 'gemini-2.0-flash');
  assert.equal(failure.status, 500);
  assert.equal(failure.kind, 'serverError');
  assert.equal(failure.message, 'Internal Server Error raw html');
});

test('formatGeminiFailure: formats quota and auth failures', () => {
  const authFail = { status: 401, kind: 'auth', message: 'Unauthorized', retrySeconds: 0, model: 'gemini-2.5-flash' };
  assert.equal(formatGeminiFailure(authFail), 'API key rejected (HTTP 401) — check GEMINI_API_KEY in .env');

  const quotaRateFail = { status: 429, kind: 'quotaPerMinute', message: 'Quota hit', retrySeconds: 10, model: 'gemini-2.5-flash' };
  assert.equal(formatGeminiFailure(quotaRateFail), 'per-minute rate limit hit — Google says retry in about 10s');
});
