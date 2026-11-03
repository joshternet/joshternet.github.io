/**
 * Goal & Constraints:
 * Resolve the latest upload `published_at` for Network elsewhere YouTube
 * channel URLs via the public Atom feed (with watch-page uploadDate fallback).
 * Used so Showcase / What's New only promote channels with uploads inside
 * ACTIVITY_WINDOW_DAYS. Never invent dates; Vimeo/Twitch stay undated until a
 * public feed path exists. Injectable fetch for offline tests.
 */

import { contentItemsFromRssOrAtom, isoDateString } from "./content.mjs";
import { fetchPublicText } from "./lib.mjs";
import { createOriginRobotsGate } from "./origin-robots.mjs";

/**
 * YouTube channel id from a /channel/UC… URL.
 * @param {unknown} href
 * @returns {string}
 */
export function youtubeChannelIdFromHref(href) {
  if (typeof href !== "string" || !href) {
    return "";
  }

  try {
    const path = new URL(href).pathname;
    const match = path.match(/^\/channel\/(UC[\w-]+)\/?$/i);

    return match?.[1] || "";
  } catch {
    return "";
  }
}

/**
 * YouTube channel id embedded in a channel page HTML body.
 * @param {unknown} html
 * @returns {string}
 */
export function youtubeChannelIdFromHtml(html) {
  if (typeof html !== "string" || !html) {
    return "";
  }

  const fromJson = html.match(/"channelId"\s*:\s*"(UC[\w-]+)"/i)?.[1];

  if (fromJson) {
    return fromJson;
  }

  const fromCanonical = html.match(/youtube\.com\/channel\/(UC[\w-]+)/i)?.[1];

  return fromCanonical || "";
}

/**
 * Public YouTube Atom feed URL for a channel id.
 * @param {unknown} channelId
 * @returns {string}
 */
export function youtubeChannelFeedUrl(channelId) {
  if (typeof channelId !== "string" || !channelId.startsWith("UC")) {
    return "";
  }

  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

/**
 * Newest entry publish date from a YouTube channel Atom document.
 * @param {unknown} xml
 * @returns {string} ISO timestamp, or "" when no dated entries exist.
 */
export function latestPublishedAtFromYoutubeAtom(xml) {
  if (typeof xml !== "string" || !xml.trim()) {
    return "";
  }

  const items = contentItemsFromRssOrAtom(xml, {
    feedKind: "atom",
    feedUrl: "https://www.youtube.com/feeds/videos.xml",
    siteOrigin: "https://www.youtube.com",
    observedAt: new Date(0).toISOString(),
  });

  let newestMs = Number.NEGATIVE_INFINITY;
  let newest = "";

  for (const item of items) {
    const raw = typeof item.published_at === "string" ? item.published_at : "";
    const iso = isoDateString(raw);

    if (!iso) {
      continue;
    }

    const ms = Date.parse(iso);

    if (!Number.isFinite(ms) || ms < newestMs) {
      continue;
    }

    newestMs = ms;
    newest = iso;
  }

  return newest;
}

/**
 * Resolve latest upload publish time for one YouTube channel URL.
 * Honors YouTube robots.txt via the shared origin gate.
 * @param {string} channelUrl
 * @param {{
 *   fetchPublicText?: typeof fetchPublicText,
 *   cache?: Map<string, unknown>,
 *   robotsGate?: import("./origin-robots.mjs").OriginRobotsGate,
 * }} [options]
 * @returns {Promise<string>}
 */
/**
 * uploadDate from YouTube HTML (watch or channel page).
 * @param {unknown} html
 * @returns {string}
 */
function uploadDateFromYoutubeHtml(html) {
  if (typeof html !== "string" || !html) {
    return "";
  }

  const raw =
    html.match(/"uploadDate"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ||
    "";

  return isoDateString(raw);
}

export async function resolveYoutubeChannelPublishedAt(
  channelUrl,
  options = {},
) {
  const fetchText = options.fetchPublicText || fetchPublicText;
  const cache = options.cache || new Map();
  // Reuse the injected fetch so offline tests and robots share one boundary.
  const robotsGate =
    options.robotsGate ||
    createOriginRobotsGate({ cache, fetchPublicText: fetchText });
  let channelId = youtubeChannelIdFromHref(channelUrl);
  /** @type {string} */
  let pageBody = "";

  if (!channelId) {
    if (!(await robotsGate.allows(channelUrl))) {
      return "";
    }

    try {
      const page = await fetchText(channelUrl, {
        cache,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      });
      pageBody = page.body;
      channelId = youtubeChannelIdFromHtml(pageBody);
    } catch {
      return "";
    }
  }

  const feedUrl = youtubeChannelFeedUrl(channelId);

  if (feedUrl && (await robotsGate.allows(feedUrl))) {
    try {
      const feed = await fetchText(feedUrl, {
        cache,
        accept: "application/atom+xml,application/xml,text/xml,*/*;q=0.8",
      });
      const fromAtom = latestPublishedAtFromYoutubeAtom(feed.body);

      if (fromAtom) {
        return fromAtom;
      }
    } catch {
      // Fall through to HTML uploadDate.
    }
  }

  if (!pageBody) {
    if (!(await robotsGate.allows(channelUrl))) {
      return "";
    }

    try {
      const page = await fetchText(channelUrl, {
        cache,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      });
      pageBody = page.body;
    } catch {
      return "";
    }
  }

  const fromPage = uploadDateFromYoutubeHtml(pageBody);

  if (fromPage) {
    return fromPage;
  }

  const videoId = pageBody.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{6,})"/)?.[1];

  if (!videoId) {
    return "";
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (!(await robotsGate.allows(watchUrl))) {
    return "";
  }

  try {
    const watch = await fetchText(watchUrl, {
      cache,
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    });

    return uploadDateFromYoutubeHtml(watch.body);
  } catch {
    return "";
  }
}

/**
 * Map elsewhere-channel URLs to latest upload `published_at` (YouTube only).
 * @param {unknown} channels
 * @param {{
 *   fetchPublicText?: typeof fetchPublicText,
 *   cache?: Map<string, unknown>,
 *   robotsGate?: import("./origin-robots.mjs").OriginRobotsGate,
 * }} [options]
 * @returns {Promise<Record<string, string>>}
 */
export async function buildChannelPublishByUrl(channels, options = {}) {
  /** @type {Record<string, string>} */
  const publishByUrl = {};
  const list = Array.isArray(channels) ? channels : [];

  for (const channel of list) {
    if (!channel || typeof channel !== "object") {
      continue;
    }

    const url = typeof channel.url === "string" ? channel.url : "";
    const network =
      channel.source &&
      typeof channel.source === "object" &&
      typeof (/** @type {{ network?: unknown }} */ (channel.source).network) ===
        "string"
        ? /** @type {{ network: string }} */ (channel.source).network
        : "";

    if (!url || network !== "youtube") {
      continue;
    }

    const published = await resolveYoutubeChannelPublishedAt(url, options);

    if (published) {
      publishByUrl[url] = published;
    }
  }

  return publishByUrl;
}
