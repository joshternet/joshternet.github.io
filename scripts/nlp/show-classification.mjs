/**
 * Goal & Constraints:
 * A playlist found in a post does not make every upload a podcast.
 * CSS Battle recordings stay with podcasts and live streams.
 * Audio enclosures and iTunes episode tags still mark a real podcast.
 */

/** @type {ReadonlySet<string>} */
const SHOW_SOURCE_KINDS = new Set([
  "youtube-show-feed",
  "youtube-show-fallback",
]);

/**
 * True when a title is a CSS Battle episode (CSSBattle, CSS Battle, CSS Battles).
 * @param {unknown} title
 * @returns {boolean}
 */
export function isCssBattleShowTitle(title) {
  return /css\s*battles?\b/i.test(String(title || ""));
}

/**
 * Source kind from a harvested content row.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function sourceKindOf(item) {
  if (typeof item.source_kind === "string" && item.source_kind) {
    return item.source_kind;
  }

  const source = item.source;

  if (source && typeof source === "object") {
    const kind = /** @type {{ kind?: unknown }} */ (source).kind;

    if (typeof kind === "string") {
      return kind;
    }
  }

  return "";
}

/**
 * True when crawl classification says this row is a podcast or live show.
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {boolean}
 */
export function isPodcastShowItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (String(item.content_type || "") === "podcast_episode") {
    return true;
  }

  if (SHOW_SOURCE_KINDS.has(sourceKindOf(item))) {
    return true;
  }

  const type = String(item.content_type || "");
  const url = String(item.url || "");
  const onYoutube = /youtube\.com|youtu\.be/i.test(url);

  return isCssBattleShowTitle(item.title) && (type === "video" || onYoutube);
}

/**
 * Content type for one harvested YouTube row.
 * Show feeds and CSS Battle episodes are podcasts. Other channel uploads stay video.
 * @param {unknown} requested
 * @param {unknown} sourceKind
 * @param {unknown} title
 * @returns {string}
 */
export function contentTypeForHarvestedYoutube(requested, sourceKind, title) {
  if (isCssBattleShowTitle(title)) {
    return "podcast_episode";
  }

  // A discovered playlist or channel feed is not a podcast by itself.
  if (SHOW_SOURCE_KINDS.has(String(sourceKind || ""))) {
    return "video";
  }

  const type = String(requested || "").trim();

  return type || "video";
}
