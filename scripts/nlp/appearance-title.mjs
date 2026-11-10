/**
 * Goal & Constraints:
 * Shared appearance/event/presentation title hygiene for the speaking parser,
 * Showcase eligibility, Past/Happening listing, and read-only showcase audit.
 * Rejects blog chrome, year crumbs, and min-read ledes so crawlers cannot mint
 * empty or misleading talk titles. Inputs: raw title/conference strings.
 * Outputs: boolean helpers and resolveEventTitle. Do not write datasets.
 */

/**
 * Normalize whitespace for title checks.
 * @param {unknown} value
 * @returns {string}
 */
export function collapseAppearanceTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when a conference label is only a year crumb (", 2026", "2026").
 * @param {unknown} value
 * @returns {boolean}
 */
export function isYearCrumbConference(value) {
  const text = collapseAppearanceTitle(value);

  if (!text) {
    return true;
  }

  return /^,?\s*\d{4}$/.test(text);
}

/**
 * True when a title is substance-empty for speaking/events (blog chrome, year crumbs).
 * Rejects exact year crumbs, exact reading-time labels, leading `, YYYY · …`
 * chrome, and any string that still carries a min-read marker.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmptyAppearanceTitle(value) {
  const text = collapseAppearanceTitle(value);

  if (!text) {
    return true;
  }

  if (isYearCrumbConference(text)) {
    return true;
  }

  // Blog indexes mint ", 2026" or ", 2026 · 2 min read …lede…" as titles.
  // Require the leading comma so ISO dates (`2026-01-15`) stay valid.
  if (/^,\s*\d{4}\b/.test(text)) {
    return true;
  }

  if (/^\d+\s*min(?:ute)?s?\s+read$/i.test(text)) {
    return true;
  }

  if (/\b\d+\s*min(?:ute)?s?\s+read\b/i.test(text)) {
    return true;
  }

  if (/^reading\s+time\b/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Prefer a substantive talk title when the conference label is a year crumb.
 * Never returns blog-chrome or year-crumb blobs when a better talk title exists;
 * returns empty when both sides fail hygiene.
 * @param {string} conference
 * @param {string} talkTitle
 * @returns {string}
 */
export function resolveEventTitle(conference, talkTitle) {
  const talk = collapseAppearanceTitle(talkTitle);
  const conf = collapseAppearanceTitle(conference);

  if (conf && !isYearCrumbConference(conf) && !isEmptyAppearanceTitle(conf)) {
    return conf;
  }

  if (talk && !isEmptyAppearanceTitle(talk)) {
    return talk;
  }

  return "";
}
