/**
 * Goal & Constraints:
 * Bounded page_role classification and topic contribution policy.
 * error/legal/utility/generated never establish public topic communities.
 */

/**
 * Single-segment speaking archives. The page is a directory, not a talk.
 * @type {ReadonlySet<string>}
 */
export const SPEAKING_ARCHIVE_SEGMENTS = new Set([
  "speaking",
  "talks",
  "presentations",
  "slides",
]);

/**
 * Single-segment directories that list other works. Not a work themselves.
 * @type {ReadonlySet<string>}
 */
export const COLLECTION_INDEX_SEGMENTS = new Set([
  "sitemap",
  "html-sitemap",
  "collections",
  "tools",
]);

/**
 * @typedef {'home'|'article'|'note'|'project'|'about'|'portfolio'|'documentation'|'index'|'archive'|'tag-index'|'utility'|'legal'|'error'|'generated'|'collection'|'speaking-archive'|'unknown'} PageRole
 */

/**
 * Role for a one-segment directory slug, or "" when the slug is not a directory.
 * @param {unknown} segment
 * @returns {'collection'|'speaking-archive'|''}
 */
export function directoryIndexRole(segment) {
  const slug = String(segment || "")
    .replace(/\.(html?|php)$/i, "")
    .toLowerCase();

  if (SPEAKING_ARCHIVE_SEGMENTS.has(slug)) {
    return "speaking-archive";
  }

  if (COLLECTION_INDEX_SEGMENTS.has(slug)) {
    return "collection";
  }

  return "";
}

/**
 * True when the URL is exactly a directory index such as `/speaking/` or `/tools/`.
 * Child paths (`/tools/calendar/`) are not indexes.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isDirectoryIndexPath(url) {
  let segment = "";

  try {
    const parts = new URL(String(url)).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    if (parts.length !== 1) {
      return false;
    }

    segment = parts[0];
  } catch {
    return false;
  }

  return directoryIndexRole(segment) !== "";
}

/**
 * @param {string} url
 * @param {{ title?: string, schemaTypes?: string[], status?: number, derived?: boolean }} [hints]
 * @returns {PageRole}
 */
export function classifyPageRole(url, hints = {}) {
  if (hints.derived) {
    return "generated";
  }

  if (typeof hints.status === "number" && hints.status >= 400) {
    return "error";
  }

  const title = String(hints.title || "").toLowerCase();

  if (
    /\b404\b/.test(title) ||
    /not found/.test(title) ||
    /page not found/.test(title)
  ) {
    return "error";
  }

  let path = "/";

  try {
    path = new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "unknown";
  }

  const lower = path.toLowerCase();

  if (
    /license|licen[cs]e|third.?party|privacy|terms|legal|cookie|datenschutz|impressum/.test(
      lower,
    ) ||
    /license|privacy policy|terms of|datapolicy|datenschutz|impressum/.test(
      title,
    )
  ) {
    return "legal";
  }

  if (/\/(tag|tags|category|categories|topic|topics)\b/.test(lower)) {
    return "tag-index";
  }

  if (/\/(archive|archives|posts\/?$|blog\/?$|index)\b/.test(lower)) {
    return "archive";
  }

  if (/\/(about|bio|profile)\b/.test(lower)) {
    return "about";
  }

  // Indieweb / personal essay pages often lack /blog/ URL shape but still
  // carry publisher keywords and prose worth heuristic extraction.
  if (
    /^\/(me|now|uses|health|homelab|workouts|social|elsewhere|colophon|neighborhood|interests|site)(?:\/|$|\.html?$)/.test(
      lower,
    )
  ) {
    return "about";
  }

  if (
    /^\/(portfolio|work|projects?|gallery|galleries|albums|photography|photos|art|illustration|artwork|paintings?|fiction|music|discography|tracks|videos|film|animation|games?|interactive|exhibitions|design)\/[^/]+/.test(
      lower,
    )
  ) {
    return "project";
  }

  if (
    /^\/(portfolio|work|projects?|gallery|galleries|albums|photography|photos|art|illustration|artwork|music|discography|tracks|videos|film|animation|games?|interactive|exhibitions|design)$/.test(
      lower,
    )
  ) {
    return "portfolio";
  }

  if (/\/(docs?|documentation|guide|handbook)\b/.test(lower)) {
    return "documentation";
  }

  // /seeking request pages must not feed biographical or expertise topics.
  // /seeking/docs stays documentation via the rule above.
  if (/^\/seeking(?:\/|\.html?)?$/.test(lower)) {
    return "utility";
  }

  if (/\/(util|utility|login|search|feed|rss|atom)\b/.test(lower)) {
    return "utility";
  }

  const directoryParts = lower.split("/").filter(Boolean);

  if (directoryParts.length === 1) {
    const directoryRole = directoryIndexRole(directoryParts[0]);

    if (directoryRole) {
      return directoryRole;
    }
  }

  if (path === "/" || path === "/index.html" || path === "/index.htm") {
    return "home";
  }

  const types = Array.isArray(hints.schemaTypes) ? hints.schemaTypes : [];

  if (
    types.some((type) => /BlogPosting|Article|NewsArticle/i.test(String(type)))
  ) {
    return "article";
  }

  if (types.some((type) => /AboutPage/i.test(String(type)))) {
    return "about";
  }

  // Microblog / note permalinks (e.g. /notes/2026-08-30-0952/).
  if (/\/notes\/\d{4}-\d{2}-\d{2}(?:-\d{3,4})?(?:\/|$|\.html?$)/.test(lower)) {
    return "note";
  }

  if (/\/(posts?|blog|notes?|essays?|tips?)\//.test(lower)) {
    return "article";
  }

  if (/^\/(photos?|photography|gallery|galleries|albums)(?:\/|$)/.test(lower)) {
    return "portfolio";
  }

  return "unknown";
}

/**
 * @param {PageRole} role
 * @returns {'full'|'profile'|'limited'|'none'}
 */
export function topicContributionForRole(role) {
  switch (role) {
    case "article":
    case "note":
    case "project":
      return "full";
    case "home":
    case "about":
    case "portfolio":
    case "documentation":
      return "profile";
    case "index":
    case "archive":
    case "tag-index":
    case "collection":
    case "speaking-archive":
      return "limited";
    case "utility":
    case "legal":
    case "error":
    case "generated":
      return "none";
    default:
      return "limited";
  }
}

/**
 * Whether visible-text NLP may contribute subjects from this page.
 * @param {PageRole} role
 * @param {{ noindex?: boolean }} [options]
 * @returns {boolean}
 */
export function allowsHeuristicTopics(role, options = {}) {
  if (options.noindex) {
    return false;
  }

  const contribution = topicContributionForRole(role);
  return contribution === "full" || contribution === "profile";
}

/**
 * Whether declared community-eligible topics from this page may enroll.
 * @param {PageRole} role
 * @param {{ noindex?: boolean }} [options]
 * @returns {boolean}
 */
export function allowsCommunityTopics(role, options = {}) {
  if (options.noindex) {
    return false;
  }

  return topicContributionForRole(role) !== "none";
}
