/**
 * Goal & Constraints:
 * Prune-then-gather content retention. Writing stays in a 30-day hub cache;
 * visitor surfaces show 14 days (regular posters). Showcase creative is
 * permanent while observed. Origins remain the archive of record.
 */

import {
  ACTIVITY_WINDOW_DAYS,
  SHOWCASE_CONTENT_TYPES,
  publishedWithinDays,
} from "../views/lib.mjs";
import { isDirectoryIndexPath } from "./page-role.mjs";

/** Operational writing cache in `_data/content.json` (days). */
export const CONTENT_CACHE_DAYS = 30;

/**
 * True when a content row is a directory index mis-typed as a durable work.
 * Speaking archives may still be the link URL on real `event` / `presentation`
 * rows; those stay. Project/collection/sitemap leftovers are dropped.
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {boolean}
 */
function isStaleDirectoryIndexWork(item) {
  if (typeof item.url !== "string" || !isDirectoryIndexPath(item.url)) {
    return false;
  }

  const type = String(
    typeof item.content_type === "string" ? item.content_type : "",
  ).trim();

  return type !== "event" && type !== "presentation";
}

/** Re-export display window for callers that import retention policy. */
export { ACTIVITY_WINDOW_DAYS };

/**
 * Prefer publisher date, else crawl observation time.
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {string}
 */
export function contentItemTimestamp(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  if (typeof item.published_at === "string" && item.published_at) {
    return item.published_at;
  }

  if (typeof item.observed_at === "string" && item.observed_at) {
    return item.observed_at;
  }

  return "";
}

/**
 * True when an item is durable creative (Showcase catalog), not ephemeral writing.
 * Uses Showcase content types and creative source kinds so prune keeps catalog
 * rows without depending on Showcase substance checks (avoids circular imports).
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {boolean}
 */
export function isDurableCreativeContentItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  // Directory indexes stay discoverable via page role; they are not works.
  if (isStaleDirectoryIndexWork(item)) {
    return false;
  }

  const type = String(
    typeof item.content_type === "string" ? item.content_type : "",
  ).trim();

  if (SHOWCASE_CONTENT_TYPES.includes(type) || type === "event") {
    return true;
  }

  let sourceKind = "";

  if (typeof item.source_kind === "string") {
    sourceKind = item.source_kind;
  } else if (item.source && typeof item.source === "object") {
    const kind = /** @type {{ kind?: unknown }} */ (item.source).kind;
    if (typeof kind === "string") {
      sourceKind = kind;
    }
  }

  return sourceKind === "portfolio" || sourceKind.startsWith("creative-");
}

/**
 * True when writing/Activity UI may show this item (14-day window or durable).
 * @param {Record<string, unknown> | null | undefined} item
 * @param {Date | string} now
 * @returns {boolean}
 */
export function isVisitorFacingContentItem(item, now) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (isDurableCreativeContentItem(item)) {
    return true;
  }

  return publishedWithinDays(
    contentItemTimestamp(item),
    now,
    ACTIVITY_WINDOW_DAYS,
  );
}

/**
 * True when an item may remain in the committed 30-day writing cache (or permanent).
 * @param {Record<string, unknown> | null | undefined} item
 * @param {Date | string} now
 * @param {number} [cacheDays]
 * @returns {boolean}
 */
export function isContentCacheEligible(
  item,
  now,
  cacheDays = CONTENT_CACHE_DAYS,
) {
  if (!item || typeof item !== "object") {
    return false;
  }

  // Stale directory leftovers must leave even when carry-forward would
  // otherwise keep a durable creative row.
  if (isStaleDirectoryIndexWork(item)) {
    return false;
  }

  if (isDurableCreativeContentItem(item)) {
    return true;
  }

  const timestamp = contentItemTimestamp(item);

  if (!timestamp) {
    return false;
  }

  return publishedWithinDays(timestamp, now, cacheDays);
}

/**
 * Drops writing older than the cache window; keeps durable creative.
 * Runs before gather so crawl work targets a slim base.
 * @param {unknown} items
 * @param {Date | string} now
 * @param {{ cacheDays?: number }} [options]
 * @returns {{ kept: Array<Record<string, unknown>>, prunedCount: number }}
 */
export function pruneContentItems(items, now, options = {}) {
  const cacheDays =
    typeof options.cacheDays === "number" && options.cacheDays > 0
      ? options.cacheDays
      : CONTENT_CACHE_DAYS;
  const list = Array.isArray(items) ? items : [];
  /** @type {Array<Record<string, unknown>>} */
  const kept = [];
  let prunedCount = 0;

  for (const item of list) {
    if (!item || typeof item !== "object") {
      prunedCount += 1;
      continue;
    }

    if (isContentCacheEligible(item, now, cacheDays)) {
      kept.push(/** @type {Record<string, unknown>} */ (item));
    } else {
      prunedCount += 1;
    }
  }

  return { kept, prunedCount };
}

/**
 * Site origin key for carry-forward grouping.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function itemOriginKey(item) {
  if (typeof item.site_origin === "string" && item.site_origin) {
    return item.site_origin;
  }

  if (typeof item.url === "string" && item.url) {
    try {
      return new URL(item.url).origin;
    } catch {
      return "";
    }
  }

  return "";
}

/**
 * Identity key for content merge.
 * Prefer publisher `identity` so many speaking appearances can share one archive
 * URL without collapsing into a single row.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function itemIdentityKey(item) {
  if (typeof item.identity === "string" && item.identity) {
    return item.identity;
  }

  if (typeof item.url === "string" && item.url) {
    return item.url;
  }

  if (typeof item.id === "string" && item.id) {
    return item.id;
  }

  return "";
}

/**
 * Source kind from `source.kind` or `source_kind` / `source_feeds`.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function itemSourceKind(item) {
  if (typeof item.source_kind === "string" && item.source_kind) {
    return item.source_kind;
  }

  if (item.source && typeof item.source === "object") {
    const kind = /** @type {{ kind?: unknown }} */ (item.source).kind;
    if (typeof kind === "string" && kind) {
      return kind;
    }
  }

  if (Array.isArray(item.source_feeds)) {
    for (const feed of item.source_feeds) {
      if (!feed || typeof feed !== "object") {
        continue;
      }
      const type = /** @type {{ type?: unknown }} */ (feed).type;
      if (typeof type === "string" && type) {
        return type;
      }
    }
  }

  return "";
}

/**
 * True when an event/presentation came from a speaking archive or event index.
 * These rows must be re-confirmed on a successful gather or they leave the cache
 * (hygiene renames identities; blog false-positives must not zombie forever).
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function isAppearanceListingSourcedItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const type = String(
    typeof item.content_type === "string" ? item.content_type : "",
  ).trim();

  if (type !== "event" && type !== "presentation") {
    return false;
  }

  const sourceKind = itemSourceKind(item);
  return sourceKind === "speaking-archive" || sourceKind === "event-listing";
}

/**
 * Merges gathered items onto a pruned cache base. Failed origins keep their
 * pruned-base rows (permanent + in-window writing). Result is cache-pruned again
 * so full-archive feeds cannot reintroduce aged writing.
 * @param {Array<Record<string, unknown>>} prunedBase
 * @param {Array<Record<string, unknown>>} gathered
 * @param {{
 *   now: Date | string,
 *   failedOrigins?: Iterable<string>,
 *   reuseOrigins?: Iterable<string>,
 *   cacheDays?: number,
 * }} options
 * @returns {{
 *   items: Array<Record<string, unknown>>,
 *   addedCount: number,
 *   updatedCount: number,
 *   carriedForwardCount: number,
 * }}
 */
export function mergeGatheredContent(prunedBase, gathered, options) {
  const now = options.now;
  const cacheDays =
    typeof options.cacheDays === "number" && options.cacheDays > 0
      ? options.cacheDays
      : CONTENT_CACHE_DAYS;
  const carryForwardOrigins = new Set(
    [...(options.failedOrigins || []), ...(options.reuseOrigins || [])].filter(
      (origin) => typeof origin === "string" && origin,
    ),
  );
  /** @type {Map<string, Record<string, unknown>>} */
  const byKey = new Map();
  let carriedForwardCount = 0;

  for (const item of Array.isArray(prunedBase) ? prunedBase : []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const key = itemIdentityKey(item);

    if (!key) {
      continue;
    }

    const origin = itemOriginKey(item);

    if (carryForwardOrigins.has(origin)) {
      byKey.set(key, item);
      carriedForwardCount += 1;
      continue;
    }

    // Successful origins: keep durable creative from the base until gather
    // replaces the same identity. Speaking/event listing rows must be
    // re-emitted — title hygiene and blog false-positives change identities.
    if (
      isDurableCreativeContentItem(item) &&
      !isAppearanceListingSourcedItem(item)
    ) {
      byKey.set(key, item);
    }
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const item of Array.isArray(gathered) ? gathered : []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (!isContentCacheEligible(item, now, cacheDays)) {
      continue;
    }

    const key = itemIdentityKey(item);

    if (!key) {
      continue;
    }

    if (byKey.has(key)) {
      byKey.set(key, item);
      updatedCount += 1;
    } else {
      byKey.set(key, item);
      addedCount += 1;
    }
  }

  const { kept } = pruneContentItems([...byKey.values()], now, {
    cacheDays,
  });

  kept.sort((left, right) => {
    const leftUrl = typeof left.url === "string" ? left.url : "";
    const rightUrl = typeof right.url === "string" ? right.url : "";
    const urlCmp = leftUrl.localeCompare(rightUrl);

    if (urlCmp !== 0) {
      return urlCmp;
    }

    const leftTitle = typeof left.title === "string" ? left.title : "";
    const rightTitle = typeof right.title === "string" ? right.title : "";
    return leftTitle.localeCompare(rightTitle);
  });

  return {
    items: kept,
    addedCount,
    updatedCount,
    carriedForwardCount,
  };
}
