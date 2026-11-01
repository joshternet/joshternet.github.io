/**
 * Goal: Unicode NFC tokenization and RTL helpers — offline fixtures only.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isRtlLanguage,
  normalizeUnicodeText,
  truncateLabel,
  unicodeLetterTokens,
} from "../../scripts/nlp/unicode-text.mjs";

test("normalizeUnicodeText: NFC and empty", () => {
  assert.equal(normalizeUnicodeText(""), "");
  assert.equal(normalizeUnicodeText(null), "");
  const nfd = "cafe\u0301";
  assert.equal(normalizeUnicodeText(nfd), "café");
});

test("unicodeLetterTokens: Latin accents, CJK, Arabic, and empties", () => {
  assert.deepEqual(unicodeLetterTokens("Hello café"), ["hello", "café"]);
  assert.deepEqual(unicodeLetterTokens("日本語 テスト"), ["日本語", "テスト"]);
  assert.deepEqual(unicodeLetterTokens("مرحبا"), ["مرحبا"]);
  assert.deepEqual(unicodeLetterTokens(""), []);
  assert.deepEqual(unicodeLetterTokens("!!!"), []);
});

test("isRtlLanguage: Arabic and Hebrew bases", () => {
  assert.equal(isRtlLanguage("ar"), true);
  assert.equal(isRtlLanguage("ar-SA"), true);
  assert.equal(isRtlLanguage("he"), true);
  assert.equal(isRtlLanguage("en"), false);
  assert.equal(isRtlLanguage(""), false);
  assert.equal(isRtlLanguage(null), false);
});

test("truncateLabel: empty, short, and grapheme-aware ellipsis", () => {
  assert.equal(truncateLabel(null, 10), "");
  assert.equal(truncateLabel("  short  ", 10), "short");
  assert.equal(truncateLabel("abcdefghijklmnop", 8), "abcdefg…");
  assert.equal(truncateLabel("日本語テスト", 3), "日本…");
});
