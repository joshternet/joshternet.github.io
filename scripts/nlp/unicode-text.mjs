/**
 * Goal & Constraints:
 * Shared Unicode NFC normalization and letter/number tokenization for search
 * and English-heuristic NLP. Does not invent translations or language identity.
 * Browser search mirrors this logic in assets/js/search.js.
 */

/**
 * NFC-normalizes text for stable Unicode comparison.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeUnicodeText(value) {
  if (typeof value !== "string" || !value) {
    return "";
  }

  return value.normalize("NFC");
}

/**
 * Splits text into lowercase Unicode letter/mark/number tokens.
 * Keeps non-Latin scripts (CJK, Arabic, etc.) instead of stripping them.
 * @param {unknown} value
 * @returns {string[]}
 */
export function unicodeLetterTokens(value) {
  const normalized = normalizeUnicodeText(value).toLowerCase();

  if (!normalized) {
    return [];
  }

  const matches = normalized.match(/[\p{L}\p{M}\p{N}]+/gu);

  return matches || [];
}

/**
 * True when a BCP 47 base language is typically written right-to-left.
 * @param {unknown} lang
 * @returns {boolean}
 */
export function isRtlLanguage(lang) {
  if (typeof lang !== "string" || !lang) {
    return false;
  }

  const base = lang.toLowerCase().split(/[-_]/)[0];

  return (
    base === "ar" ||
    base === "he" ||
    base === "fa" ||
    base === "ur" ||
    base === "yi" ||
    base === "dv"
  );
}
