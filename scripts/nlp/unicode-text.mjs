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
 * Truncates a label by grapheme clusters (not UTF-16 code units).
 * Appends an ellipsis when the text exceeds `max` graphemes.
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
export function truncateLabel(value, max) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return "";
  }

  /** @type {string[]} */
  let units;

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    units = [...segmenter.segment(text)].map((part) => part.segment);
  } else {
    units = [...text];
  }

  if (units.length <= max) {
    return text;
  }

  return `${units.slice(0, Math.max(0, max - 1)).join("")}…`;
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
