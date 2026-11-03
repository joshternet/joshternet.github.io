/**
 * Goal & Constraints:
 * Discover YouTube channel/playlist show URLs from member HTML and harvest
 * dated podcast_episode rows via public Atom feeds (channel_id / playlist_id).
 * Fallback to watch-page uploadDate when Atom is empty/404. Injectable fetch
 * for offline fixtures; never invent dates; robots gate required. Live YouTube
 * debugging happens outside the agent sandbox on human sync runs.
 */

import { contentItemsFromRssOrAtom, isoDateString } from "./content.mjs";
import { fetchPublicText } from "./lib.mjs";
import { createOriginRobotsGate } from "./origin-robots.mjs";
import {
  youtubeChannelFeedUrl,
  youtubeChannelIdFromHref,
  youtubeChannelIdFromHtml,
} from "./channel-publish.mjs";

/** Max episodes harvested per show URL per sync. */
export const MAX_YOUTUBE_SHOW_EPISODES = 12;

/**
 * YouTube playlist id from a playlist URL.
 * @param {unknown} href
 * @returns {string}
 */
export function youtubePlaylistIdFromHref(href) {
  if (typeof href !== "string" || !href) {
    return "";
  }

  try {
    const parsed = new URL(href);

    if (!/(^|\.)youtube\.com$/i.test(parsed.hostname)) {
      return "";
    }

    const list = parsed.searchParams.get("list") || "";

    if (/^PL[\w-]{10,}$/i.test(list)) {
      return list;
    }

    return "";
  } catch {
    return "";
  }
}

/**
 * Public YouTube Atom feed URL for a playlist id.
 * @param {unknown} playlistId
 * @returns {string}
 */
export function youtubePlaylistFeedUrl(playlistId) {
  if (typeof playlistId !== "string" || !/^PL[\w-]+$/i.test(playlistId)) {
    return "";
  }

  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
}

/**
 * Canonical https YouTube show URL, or "" when unparseable.
 * @param {unknown} raw
 * @returns {string}
 */
export function canonicalizeYoutubeShowUrl(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    return "";
  }

  try {
    return new URL(raw.replace(/\\+$/, "").trim()).href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/**
 * Discover YouTube playlist / channel / @ show URLs in HTML or feed XML.
 * Prefers playlists when present; also keeps channel and @ profile links.
 * @param {unknown} html
 * @returns {string[]}
 */
export function youtubeShowUrlsFromHtml(html) {
  if (typeof html !== "string" || !html) {
    return [];
  }

  /** @type {Set<string>} */
  const found = new Set();

  const patterns = [
    /https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=PL[\w-]+/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/channel\/UC[\w-]+/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/@[A-Za-z0-9._-]+/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const cleaned = canonicalizeYoutubeShowUrl(match[0]);

      if (cleaned) {
        found.add(cleaned);
      }
    }
  }

  return [...found];
}

/**
 * uploadDate / datePublished from a YouTube watch (or channel) HTML body.
 * @param {unknown} html
 * @returns {string} ISO timestamp, or "" when absent.
 */
export function youtubeUploadDateFromHtml(html) {
  if (typeof html !== "string" || !html) {
    return "";
  }

  const raw =
    html.match(/"uploadDate"\s*:\s*"([^"]+)"/i)?.[1] ||
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ||
    "";

  return isoDateString(raw);
}

/**
 * Video ids listed on a YouTube playlist HTML page (recent-first when present).
 * @param {unknown} html
 * @param {number} [limit]
 * @returns {string[]}
 */
export function youtubeVideoIdsFromPlaylistHtml(
  html,
  limit = MAX_YOUTUBE_SHOW_EPISODES,
) {
  if (typeof html !== "string" || !html) {
    return [];
  }

  /** @type {string[]} */
  const ids = [];
  const seen = new Set();

  for (const match of html.matchAll(/"videoId"\s*:\s*"([A-Za-z0-9_-]{6,})"/g)) {
    const id = match[1];

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    ids.push(id);

    if (ids.length >= limit) {
      break;
    }
  }

  return ids;
}

/**
 * Atom feed URL for a show page (playlist preferred, else channel).
 * @param {string} showUrl
 * @param {{
 *   fetchPublicText?: typeof fetchPublicText,
 *   cache?: Map<string, unknown>,
 *   robotsGate?: import("./origin-robots.mjs").OriginRobotsGate,
 * }} [options]
 * @returns {Promise<string>}
 */
export async function youtubeFeedUrlForShow(showUrl, options = {}) {
  const playlistId = youtubePlaylistIdFromHref(showUrl);

  if (playlistId) {
    return youtubePlaylistFeedUrl(playlistId);
  }

  let channelId = youtubeChannelIdFromHref(showUrl);

  if (!channelId) {
    const fetchText = options.fetchPublicText || fetchPublicText;
    const cache = options.cache || new Map();
    const robotsGate =
      options.robotsGate ||
      createOriginRobotsGate({ cache, fetchPublicText: fetchText });

    if (!(await robotsGate.allows(showUrl))) {
      return "";
    }

    try {
      const page = await fetchText(showUrl, {
        cache,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      });
      channelId = youtubeChannelIdFromHtml(page.body);
    } catch {
      return "";
    }
  }

  return youtubeChannelFeedUrl(channelId);
}

/**
 * Map feed-shaped video entries into podcast_episode drafts.
 * @param {unknown} feedItems
 * @param {{
 *   siteOrigin: string,
 *   observedAt?: string,
 *   showUrl?: string,
 *   limit?: number,
 * }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function podcastEpisodesFromFeedItems(feedItems, meta) {
  const siteOrigin =
    typeof meta?.siteOrigin === "string" ? meta.siteOrigin : "";

  if (!siteOrigin) {
    return [];
  }

  const limit =
    typeof meta.limit === "number" && meta.limit > 0
      ? meta.limit
      : MAX_YOUTUBE_SHOW_EPISODES;
  const observedAt =
    typeof meta.observedAt === "string" && meta.observedAt
      ? meta.observedAt
      : "";
  const showUrl = typeof meta.showUrl === "string" ? meta.showUrl : "";
  const list = Array.isArray(feedItems) ? feedItems : [];

  /** @type {Array<Record<string, unknown>>} */
  const episodes = [];

  for (const entry of list) {
    if (episodes.length >= limit) {
      break;
    }

    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = /** @type {Record<string, unknown>} */ (entry);
    const url = typeof record.url === "string" ? record.url : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const published =
      typeof record.published_at === "string"
        ? isoDateString(record.published_at)
        : "";

    if (
      !url ||
      !/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(url)
    ) {
      continue;
    }

    episodes.push({
      identity: `youtube-episode:${siteOrigin}:${url}`,
      url,
      site_origin: siteOrigin,
      title: title || url,
      summary: typeof record.summary === "string" ? record.summary : "",
      content_type: "podcast_episode",
      page_role: "project",
      language: null,
      declared_topics: [],
      source: {
        kind: "youtube-show-feed",
        show: showUrl || "",
      },
      source_feeds: showUrl ? [{ type: "youtube-show", url: showUrl }] : [],
      observed_at: observedAt,
      ...(published ? { published_at: published } : {}),
      ...(typeof record.image === "string" && record.image
        ? { image: record.image }
        : {}),
      actions: [
        {
          label: "Watch",
          url,
          type: "watch",
        },
      ],
    });
  }

  return episodes;
}

/**
 * Parse YouTube Atom entries into podcast_episode drafts for a member origin.
 * @param {unknown} xml
 * @param {{
 *   siteOrigin: string,
 *   observedAt?: string,
 *   showUrl?: string,
 *   limit?: number,
 * }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function podcastEpisodesFromYoutubeAtom(xml, meta) {
  const siteOrigin =
    typeof meta?.siteOrigin === "string" ? meta.siteOrigin : "";

  if (!siteOrigin || typeof xml !== "string" || !xml.trim()) {
    return [];
  }

  const observedAt =
    typeof meta.observedAt === "string" && meta.observedAt
      ? meta.observedAt
      : "";
  const showUrl = typeof meta.showUrl === "string" ? meta.showUrl : "";

  const feedItems = contentItemsFromRssOrAtom(xml, {
    feedKind: "atom",
    feedUrl: showUrl || "https://www.youtube.com/feeds/videos.xml",
    siteOrigin: "https://www.youtube.com",
    observedAt: observedAt || new Date(0).toISOString(),
  });

  return podcastEpisodesFromFeedItems(feedItems, meta);
}

/**
 * Fallback: playlist HTML → watch pages → uploadDate podcast episodes.
 * @param {string} playlistUrl
 * @param {{
 *   siteOrigin: string,
 *   observedAt?: string,
 *   fetchPublicText?: typeof fetchPublicText,
 *   cache?: Map<string, unknown>,
 *   robotsGate?: import("./origin-robots.mjs").OriginRobotsGate,
 *   limit?: number,
 * }} options
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function podcastEpisodesFromPlaylistHtmlFallback(
  playlistUrl,
  options,
) {
  const siteOrigin = options.siteOrigin;
  const fetchText = options.fetchPublicText || fetchPublicText;
  const cache = options.cache || new Map();
  const robotsGate =
    options.robotsGate ||
    createOriginRobotsGate({ cache, fetchPublicText: fetchText });
  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? options.limit
      : MAX_YOUTUBE_SHOW_EPISODES;
  const observedAt = options.observedAt || "";

  if (!(await robotsGate.allows(playlistUrl))) {
    return [];
  }

  let playlistHtml = "";

  try {
    const page = await fetchText(playlistUrl, {
      cache,
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    });
    playlistHtml = page.body;
  } catch {
    return [];
  }

  const videoIds = youtubeVideoIdsFromPlaylistHtml(playlistHtml, limit);
  /** @type {Array<Record<string, unknown>>} */
  const episodes = [];

  for (const videoId of videoIds) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

    if (!(await robotsGate.allows(watchUrl))) {
      continue;
    }

    try {
      const watch = await fetchText(watchUrl, {
        cache,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      });
      const published = youtubeUploadDateFromHtml(watch.body);
      const titleMatch = watch.body.match(/<title>([^<]+)<\/title>/i);
      let title = titleMatch?.[1] || videoId;
      title = title.replace(/\s*-\s*YouTube\s*$/i, "").trim();

      episodes.push({
        identity: `youtube-episode:${siteOrigin}:${watchUrl}`,
        url: watchUrl,
        site_origin: siteOrigin,
        title,
        summary: "",
        content_type: "podcast_episode",
        page_role: "project",
        language: null,
        declared_topics: [],
        source: {
          kind: "youtube-show-fallback",
          show: playlistUrl,
        },
        source_feeds: [{ type: "youtube-show", url: playlistUrl }],
        observed_at: observedAt,
        ...(published ? { published_at: published } : {}),
        actions: [
          {
            label: "Watch",
            url: watchUrl,
            type: "watch",
          },
        ],
      });
    } catch {
      // skip one video
    }
  }

  return episodes;
}

/**
 * Harvest podcast episodes for discovered show URLs attributed to a member.
 * @param {Iterable<string>} showUrls
 * @param {{
 *   siteOrigin: string,
 *   observedAt?: string,
 *   fetchPublicText?: typeof fetchPublicText,
 *   cache?: Map<string, unknown>,
 *   robotsGate?: import("./origin-robots.mjs").OriginRobotsGate,
 *   limit?: number,
 * }} options
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function harvestYoutubeShowEpisodes(showUrls, options) {
  const siteOrigin = options.siteOrigin;

  if (!siteOrigin) {
    return [];
  }

  const fetchText = options.fetchPublicText || fetchPublicText;
  const cache = options.cache || new Map();
  const robotsGate =
    options.robotsGate ||
    createOriginRobotsGate({ cache, fetchPublicText: fetchText });
  const list = [...new Set([...(showUrls || [])].filter(Boolean))];
  /** @type {Map<string, Record<string, unknown>>} */
  const byUrl = new Map();

  // Prefer playlists over whole channels when both appear.
  list.sort((left, right) => {
    const leftPl = youtubePlaylistIdFromHref(left) ? 0 : 1;
    const rightPl = youtubePlaylistIdFromHref(right) ? 0 : 1;
    return leftPl - rightPl || left.localeCompare(right);
  });

  for (const showUrl of list) {
    const feedUrl = await youtubeFeedUrlForShow(showUrl, {
      fetchPublicText: fetchText,
      cache,
      robotsGate,
    });

    let fromFeed = [];

    if (feedUrl && (await robotsGate.allows(feedUrl))) {
      try {
        const feed = await fetchText(feedUrl, {
          cache,
          accept: "application/atom+xml,application/xml,text/xml,*/*;q=0.8",
        });
        fromFeed = podcastEpisodesFromYoutubeAtom(feed.body, {
          siteOrigin,
          observedAt: options.observedAt,
          showUrl,
          limit: options.limit,
        });
      } catch {
        fromFeed = [];
      }
    }

    if (fromFeed.length === 0 && youtubePlaylistIdFromHref(showUrl)) {
      fromFeed = await podcastEpisodesFromPlaylistHtmlFallback(showUrl, {
        ...options,
        fetchPublicText: fetchText,
        cache,
        robotsGate,
      });
    }

    for (const episode of fromFeed) {
      const key = String(episode.url);

      if (byUrl.has(key)) {
        continue;
      }

      byUrl.set(key, episode);
    }

    // One successful playlist is enough; skip channel siblings for the same show.
    if (fromFeed.length > 0 && youtubePlaylistIdFromHref(showUrl)) {
      break;
    }
  }

  return [...byUrl.values()];
}
