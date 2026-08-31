import test from "node:test";
import assert from "node:assert/strict";

const TOKEN_RE = /#(do|dev|concept|learn|ref|personal|project|bin)(?=\s|$)/i;
const TIME_CODE_RE = /\(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\)/;
const HEADING_DATE_RE = /^###\s+.*?(\d{4}-\d{2}-\d{2})/;

function parseCaptureLine(line) {
  if (!/^\s*-\s+\S/.test(line)) return null;

  const tokenMatch = line.match(TOKEN_RE);
  if (!tokenMatch) return null;

  const text = line
    .replace(/^\s*-\s+/, "")
    .replace(TOKEN_RE, "")
    .replace(TIME_CODE_RE, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    token: tokenMatch[1].toLowerCase(),
    text: text
  };
}

test("triage parsing: correctly identifies and extracts valid tokens", () => {
  const line = "- clean up room (10:30 AM) #do";
  const result = parseCaptureLine(line);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.token, "do");
  assert.strictEqual(result.text, "clean up room");
});

test("triage parsing: handles case-insensitive tokens", () => {
  const line = "- learn React 19 server actions #LEARN";
  const result = parseCaptureLine(line);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.token, "learn");
  assert.strictEqual(result.text, "learn React 19 server actions");
});

test("triage parsing: ignores lines without valid triage tokens", () => {
  const line = "- random thought without any tag";
  const result = parseCaptureLine(line);
  assert.strictEqual(result, null);
});

test("triage parsing: ignores non-bullet lines", () => {
  const line = "Just plain text #do";
  const result = parseCaptureLine(line);
  assert.strictEqual(result, null);
});

test("heading date extraction: extracts YYYY-MM-DD from date heading", () => {
  const heading = "### 📅 2026-08-31";
  const match = heading.match(HEADING_DATE_RE);
  assert.notStrictEqual(match, null);
  assert.strictEqual(match[1], "2026-08-31");
});
