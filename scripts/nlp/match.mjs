/**
 * Goal & Constraints:
 * Whole-phrase topic matching on visible titles/summaries. Used to project a
 * publisher topic catalog onto sites that lack Microformats or JSON-LD.
 * Does not invent connections.
 */

import { isNonSubjectSlug } from "./evidence.mjs";

/**
 * True when title or summary names a topic slug/label as a whole phrase.
 * @param {string} text
 * @param {string} slug
 * @param {string} [label]
 * @returns {boolean}
 */
export function textMentionsSlug(text, slug, label = "") {
  const haystack = String(text || "").toLowerCase();

  if (!haystack || isNonSubjectSlug(slug)) {
    return false;
  }

  const phrases = new Set();
  const slugText = String(slug || "")
    .toLowerCase()
    .replace(/-/g, " ")
    .trim();

  if (slugText) {
    phrases.add(slugText);
  }

  const labelText = String(label || "")
    .toLowerCase()
    .trim();

  if (labelText) {
    phrases.add(labelText);
  }

  for (const phrase of phrases) {
    if (phrase.length < 2) {
      continue;
    }

    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");

    if (pattern.test(haystack)) {
      return true;
    }
  }

  return false;
}

/**
 * True when a content item is about a topic via tags or visible phrasing.
 * @param {Record<string, unknown>} item
 * @param {string} slug
 * @param {string} [label]
 * @returns {boolean}
 */
export function itemMentionsTopic(item, slug, label = "") {
  if (!item || !slug) {
    return false;
  }

  const declared = Array.isArray(item.declared_topics)
    ? item.declared_topics
    : [];

  if (declared.some((topic) => topic && topic.slug === slug)) {
    return true;
  }

  const tags = Array.isArray(item.tags) ? item.tags : [];

  if (tags.some((topic) => topic && topic.slug === slug)) {
    return true;
  }

  const neighborhoods = Array.isArray(item.neighborhoods)
    ? item.neighborhoods
    : [];

  if (neighborhoods.some((topic) => topic && topic.slug === slug)) {
    return true;
  }

  return textMentionsSlug(
    `${item.title || ""} ${item.summary || ""}`,
    slug,
    label,
  );
}
