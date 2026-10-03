/**
 * Goal & Constraints:
 * Bounded page_role classification and topic contribution policy.
 * error/legal/utility/generated never establish public topic communities.
 */

/**
 * @typedef {'home'|'article'|'note'|'project'|'about'|'portfolio'|'documentation'|'index'|'archive'|'tag-index'|'utility'|'legal'|'error'|'generated'|'unknown'} PageRole
 */

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
    /license|licen[cs]e|third.?party|privacy|terms|legal|cookie/.test(lower) ||
    /license|privacy policy|terms of/.test(title)
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

  if (/^\/(portfolio|work|projects?)\/[^/]+$/.test(lower)) {
    return "project";
  }

  if (/^\/(portfolio|work|projects?)$/.test(lower)) {
    return "portfolio";
  }

  if (/\/(docs?|documentation|guide|handbook)\b/.test(lower)) {
    return "documentation";
  }

  if (/\/(util|utility|login|search|feed|rss|atom)\b/.test(lower)) {
    return "utility";
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

  if (/\/(posts?|blog|notes?|essays?)\//.test(lower)) {
    return "article";
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
