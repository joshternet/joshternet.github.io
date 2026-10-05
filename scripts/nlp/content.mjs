/**
 * Goal & Constraints:
 * Normalize feed entries into content.json with canonical URL identity and
 * cross-feed dedupe. Never mirror full article bodies.
 */

import { originFromHttpUrl } from "../network/blogroll.mjs";
import { slugifyTopic } from "../network/connections.mjs";
import { buildTopicEvidence, isCommunityEligibleSource } from "./evidence.mjs";
import {
  MAX_SUMMARY_CHARS,
  MAX_TITLE_CHARS,
  capRemoteString,
  decodeHtmlEntities,
  decodeHrefForParse,
  normalizeExtractedText,
} from "./text.mjs";

/**
 * Canonical content identity key.
 * @param {{ url?: string, id?: string, feed?: string, siteOrigin?: string }} input
 * @returns {string}
 */
export function contentIdentityKey(input) {
  const url =
    typeof input.url === "string" ? decodeHrefForParse(input.url) : "";

  if (url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      return `url:${parsed.href}`;
    } catch {
      // fall through
    }
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  const site = typeof input.siteOrigin === "string" ? input.siteOrigin : "";
  const feed = typeof input.feed === "string" ? input.feed : "";

  if (id && (site || feed)) {
    return `id:${site || feed}:${id}`;
  }

  return "";
}

/**
 * Strips markup and entities from feed summaries. Never persist HTML.
 * @param {string} htmlOrText
 * @returns {string}
 */
export function plainTextSummary(htmlOrText) {
  if (typeof htmlOrText !== "string" || !htmlOrText) {
    return "";
  }

  const withoutCdata = htmlOrText.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const decoded = decodeHtmlEntities(withoutCdata);
  const withoutTags = decoded.replace(/<[^>]*>/g, " ").replace(/<[^>]*$/g, " ");
  return capRemoteString(withoutTags, MAX_SUMMARY_CHARS);
}

/**
 * Returns an ISO timestamp when value parses as a date, otherwise empty.
 * @param {unknown} value
 * @returns {string}
 */
export function isoDateString(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const time = Date.parse(value);

  if (Number.isNaN(time)) {
    return "";
  }

  return new Date(time).toISOString();
}

/**
 * Returns an http(s) URL without credentials or hash, otherwise empty.
 * @param {unknown} value
 * @returns {string}
 */
export function httpContentUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const parsed = new URL(value);

    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
      return "";
    }

    parsed.hash = "";
    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * Shapes a content item for content.schema.json. Drops items without identity
 * or an http(s) url. Empty summaries become "".
 * @param {unknown} item
 * @returns {Record<string, unknown> | null}
 */
export function normalizeContentItemForPublish(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const record = /** @type {Record<string, unknown>} */ (item);

  if (typeof record.identity !== "string" || !record.identity.trim()) {
    return null;
  }

  const url = httpContentUrl(record.url);

  if (!url) {
    return null;
  }

  const title =
    capRemoteString(String(record.title || "").trim(), MAX_TITLE_CHARS) ||
    "Untitled";
  const published = isoDateString(record.published_at);
  const updated = isoDateString(record.updated_at);
  const next = { ...record, identity: record.identity, url, title };
  next.summary = plainTextSummary(
    typeof record.summary === "string" ? record.summary : "",
  );

  if (published) {
    next.published_at = published;
  } else {
    delete next.published_at;
  }

  if (updated) {
    next.updated_at = updated;
  } else {
    delete next.updated_at;
  }

  return next;
}

const FEED_IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;

/**
 * Resolves a feed image candidate to an https URL with no credentials.
 * @param {unknown} value
 * @param {string} [base]
 * @returns {string}
 */
export function absoluteHttpsImageUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const decoded = decodeHrefForParse(
    value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim(),
  );

  try {
    const parsed = base ? new URL(decoded, base) : new URL(decoded);

    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * True when a URL or MIME type is a raster image advertised by a feed.
 * @param {string} url
 * @param {string} [type]
 * @returns {boolean}
 */
function looksLikeFeedImage(url, type = "") {
  if (/^image\//i.test(type) && !/svg/i.test(type)) {
    return true;
  }

  return FEED_IMAGE_EXTENSION.test(url);
}

/**
 * First image URL advertised on an RSS or Atom entry.
 * @param {string} chunk
 * @param {string} feedUrl
 * @returns {string}
 */
export function feedImageFromXml(chunk, feedUrl) {
  if (typeof chunk !== "string" || !chunk) {
    return "";
  }

  for (const match of chunk.matchAll(/<enclosure\b([^>]*)\/?>/gi)) {
    const attrs = match[1] || "";
    const type = attrs.match(/\btype=["']([^"']+)["']/i)?.[1] || "";
    const abs = absoluteHttpsImageUrl(
      attrs.match(/\burl=["']([^"']+)["']/i)?.[1],
      feedUrl,
    );

    if (abs && looksLikeFeedImage(abs, type)) {
      return abs;
    }
  }

  for (const match of chunk.matchAll(
    /<(?:media:thumbnail|media:content)\b([^>]*)\/?>/gi,
  )) {
    const attrs = match[1] || "";
    const medium = attrs.match(/\bmedium=["']([^"']+)["']/i)?.[1] || "";
    const type = attrs.match(/\btype=["']([^"']+)["']/i)?.[1] || "";
    const abs = absoluteHttpsImageUrl(
      attrs.match(/\burl=["']([^"']+)["']/i)?.[1],
      feedUrl,
    );

    if (!abs || (medium && medium !== "image")) {
      continue;
    }

    if (looksLikeFeedImage(abs, type) || medium === "image") {
      return abs;
    }
  }

  const itunes = absoluteHttpsImageUrl(
    chunk.match(/<itunes:image\b[^>]*href=["']([^"']+)["']/i)?.[1],
    feedUrl,
  );

  if (itunes) {
    return itunes;
  }

  for (const match of chunk.matchAll(/<link\b([^>]*)\/?>/gi)) {
    const attrs = match[1] || "";
    const rel = attrs.match(/\brel=["']([^"']+)["']/i)?.[1] || "";

    if (!/^(?:enclosure|image)$/i.test(rel)) {
      continue;
    }

    const type = attrs.match(/\btype=["']([^"']+)["']/i)?.[1] || "";
    const abs = absoluteHttpsImageUrl(
      attrs.match(/\bhref=["']([^"']+)["']/i)?.[1],
      feedUrl,
    );

    if (abs && looksLikeFeedImage(abs, type)) {
      return abs;
    }
  }

  const html =
    chunk.match(
      /<(?:content:encoded|content|description|summary)\b[^>]*>([\s\S]*?)<\/(?:content:encoded|content|description|summary)>/i,
    )?.[1] || "";
  const decoded = decodeHtmlEntities(
    html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"),
  );
  const fromHtml = absoluteHttpsImageUrl(
    decoded.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1],
    feedUrl,
  );

  if (fromHtml && looksLikeFeedImage(fromHtml, "image/jpeg")) {
    return fromHtml;
  }

  return "";
}

/**
 * First image URL advertised on a JSON Feed item.
 * @param {Record<string, unknown>} item
 * @param {string} feedUrl
 * @returns {string}
 */
export function feedImageFromJsonItem(item, feedUrl) {
  if (!item || typeof item !== "object") {
    return "";
  }

  for (const candidate of [item.image, item.banner_image]) {
    const raw =
      typeof candidate === "string"
        ? candidate
        : candidate &&
            typeof candidate === "object" &&
            typeof candidate.url === "string"
          ? candidate.url
          : "";
    const abs = absoluteHttpsImageUrl(raw, feedUrl);

    if (abs && looksLikeFeedImage(abs, "image/jpeg")) {
      return abs;
    }
  }

  if (Array.isArray(item.attachments)) {
    for (const attachment of item.attachments) {
      if (!attachment || typeof attachment !== "object") {
        continue;
      }

      const mime =
        typeof attachment.mime_type === "string" ? attachment.mime_type : "";
      const abs = absoluteHttpsImageUrl(attachment.url, feedUrl);

      if (abs && looksLikeFeedImage(abs, mime)) {
        return abs;
      }
    }
  }

  const html = typeof item.content_html === "string" ? item.content_html : "";
  const fromHtml = absoluteHttpsImageUrl(
    html.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1],
    feedUrl,
  );

  if (fromHtml && looksLikeFeedImage(fromHtml, "image/jpeg")) {
    return fromHtml;
  }

  return "";
}

/**
 * Parses RSS/Atom entry blocks into normalized content drafts.
 * @param {string} xml
 * @param {{ feedUrl: string, feedKind: 'rss'|'atom', siteOrigin: string, observedAt: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function contentItemsFromRssOrAtom(xml, meta) {
  if (typeof xml !== "string" || !xml) {
    return [];
  }

  const items = [];
  const isAtom = meta.feedKind === "atom" || /<feed[\s>]/i.test(xml);
  const blockPattern = isAtom
    ? /<entry\b[\s\S]*?<\/entry>/gi
    : /<item\b[\s\S]*?<\/item>/gi;
  const sourceKey = isAtom ? "atom:category" : "rss:category";

  for (const block of xml.matchAll(blockPattern)) {
    const chunk = block[0];
    const title = capRemoteString(
      (chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(
        /<!\[CDATA\[([\s\S]*?)\]\]>/g,
        "$1",
      ),
      MAX_TITLE_CHARS,
    );
    let link = "";

    if (isAtom) {
      link =
        chunk.match(
          /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i,
        )?.[1] ||
        chunk.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ||
        "";
    } else {
      link = chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "";
    }

    link = decodeHrefForParse(
      link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"),
    );
    const id =
      chunk.match(/<id[^>]*>([\s\S]*?)<\/id>/i)?.[1] ||
      chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
      "";
    const published =
      chunk.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1] ||
      chunk.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ||
      chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ||
      null;
    const summary = plainTextSummary(
      chunk.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
        chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
        "",
    );

    const categories = [];
    const catPattern = isAtom
      ? /<category\b[^>]*(?:term=["']([^"']+)["']|>([^<]+)<)/gi
      : /<category[^>]*>([\s\S]*?)<\/category>/gi;
    let catMatch;

    while ((catMatch = catPattern.exec(chunk))) {
      const raw = normalizeExtractedText(catMatch[1] || catMatch[2]);
      if (raw) {
        categories.push(raw);
      }
    }

    let absoluteUrl = link;

    try {
      absoluteUrl = link ? new URL(link, meta.feedUrl).href : "";
    } catch {
      absoluteUrl = "";
    }

    const key = contentIdentityKey({
      url: absoluteUrl,
      id: normalizeExtractedText(id),
      feed: meta.feedUrl,
      siteOrigin: meta.siteOrigin,
    });

    if (!key) {
      continue;
    }

    const declared_topics = [];

    for (const raw of categories) {
      const evidence = buildTopicEvidence({
        rawValue: raw,
        source: sourceKey,
        page: absoluteUrl || meta.feedUrl,
        evidenceClass: "declared",
        communityEligible: isCommunityEligibleSource(sourceKey),
        observedAt: meta.observedAt,
        feed: meta.feedUrl,
      });

      if (evidence) {
        declared_topics.push({
          slug: evidence.slug,
          label: evidence.value,
          raw_value: evidence.raw_value,
          source: sourceKey,
          community_eligible: evidence.community_eligible === true,
        });
      }
    }

    items.push({
      identity: key,
      url: absoluteUrl || null,
      site_origin: meta.siteOrigin,
      title: title || slugifyTopic(absoluteUrl) || "Untitled",
      published_at: isoDateString(published) || null,
      updated_at: null,
      content_type: "article",
      language: null,
      summary,
      declared_topics,
      source: { kind: isAtom ? "atom" : "rss", feed: meta.feedUrl },
      source_feeds: [{ type: isAtom ? "atom" : "rss", url: meta.feedUrl }],
      observed_at: meta.observedAt,
      image: feedImageFromXml(chunk, meta.feedUrl) || undefined,
    });
  }

  return items;
}

/**
 * Parses JSON Feed items.
 * @param {string} jsonText
 * @param {{ feedUrl: string, siteOrigin: string, observedAt: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function contentItemsFromJsonFeed(jsonText, meta) {
  let data;

  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const out = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const url = decodeHrefForParse(
      typeof item.url === "string"
        ? item.url
        : typeof item.external_url === "string"
          ? item.external_url
          : "",
    );
    let absoluteUrl = url;

    try {
      absoluteUrl = url ? new URL(url, meta.feedUrl).href : "";
    } catch {
      absoluteUrl = "";
    }

    const id = typeof item.id === "string" ? item.id : "";
    const key = contentIdentityKey({
      url: absoluteUrl,
      id,
      feed: meta.feedUrl,
      siteOrigin: meta.siteOrigin,
    });

    if (!key) {
      continue;
    }

    const tags = Array.isArray(item.tags) ? item.tags : [];
    const declared_topics = [];

    for (const tag of tags) {
      const evidence = buildTopicEvidence({
        rawValue: String(tag),
        source: "json-feed:tag",
        page: absoluteUrl || meta.feedUrl,
        evidenceClass: "declared",
        communityEligible: true,
        observedAt: meta.observedAt,
        feed: meta.feedUrl,
      });

      if (evidence) {
        declared_topics.push({
          slug: evidence.slug,
          label: evidence.value,
          raw_value: evidence.raw_value,
          source: "json-feed:tag",
          community_eligible: evidence.community_eligible === true,
        });
      }
    }

    out.push({
      identity: key,
      url: absoluteUrl || null,
      site_origin: meta.siteOrigin,
      title: capRemoteString(String(item.title || "Untitled"), MAX_TITLE_CHARS),
      published_at:
        isoDateString(
          typeof item.date_published === "string" ? item.date_published : "",
        ) || null,
      updated_at:
        isoDateString(
          typeof item.date_modified === "string" ? item.date_modified : "",
        ) || null,
      content_type: "article",
      language: typeof data.language === "string" ? data.language : null,
      summary: plainTextSummary(String(item.summary || "")),
      declared_topics,
      source: { kind: "json-feed", feed: meta.feedUrl },
      source_feeds: [{ type: "json-feed", url: meta.feedUrl }],
      observed_at: meta.observedAt,
      image: feedImageFromJsonItem(item, meta.feedUrl) || undefined,
    });
  }

  return out;
}

/**
 * Merges content drafts by identity, unioning source_feeds and topics.
 * @param {Array<Record<string, unknown>>} drafts
 * @returns {Array<Record<string, unknown>>}
 */
export function mergeContentItems(drafts) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map();

  for (const draft of drafts || []) {
    if (!draft || typeof draft.identity !== "string") {
      continue;
    }

    const existing = byId.get(draft.identity);

    if (!existing) {
      byId.set(draft.identity, {
        ...draft,
        source_feeds: [...(draft.source_feeds || [])],
        declared_topics: [...(draft.declared_topics || [])],
      });
      continue;
    }

    const feedKey = new Set(
      existing.source_feeds.map((feed) => `${feed.type}\0${feed.url}`),
    );

    for (const feed of draft.source_feeds || []) {
      const key = `${feed.type}\0${feed.url}`;
      if (!feedKey.has(key)) {
        existing.source_feeds.push(feed);
        feedKey.add(key);
      }
    }

    const topicKey = new Set(
      existing.declared_topics.map(
        (topic) => `${topic.slug}\0${topic.source || ""}`,
      ),
    );

    for (const topic of draft.declared_topics || []) {
      const key = `${topic.slug}\0${topic.source || ""}`;
      if (!topicKey.has(key)) {
        existing.declared_topics.push(topic);
        topicKey.add(key);
      }
    }

    if (!existing.url && draft.url) {
      existing.url = draft.url;
    }

    if (!existing.published_at && draft.published_at) {
      existing.published_at = draft.published_at;
    }

    if (!existing.image && draft.image) {
      existing.image = draft.image;
    }
  }

  return [...byId.values()]
    .map((item) => normalizeContentItemForPublish(item))
    .filter((item) => item !== null)
    .sort((left, right) => String(left.url).localeCompare(String(right.url)));
}

/**
 * Canonical URL string without hash for joining crawl pages to content.
 * @param {string} url
 * @returns {string}
 */
function canonicalPageUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * Joins crawled page language, page_role, and community-eligible declarations
 * onto feed content items that share a canonical URL.
 * @param {Array<Record<string, unknown>>} items
 * @param {Array<{
 *   pages?: Array<{url?: string, lang?: string, page_role?: string}>,
 *   declared_topics?: Array<Record<string, unknown>>,
 * }>} originSignals
 * @returns {Array<Record<string, unknown>>}
 */
export function joinContentWithPageSignals(items, originSignals) {
  /** @type {Map<string, {lang?: string, page_role?: string}>} */
  const pages = new Map();
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const declaredByUrl = new Map();

  for (const origin of originSignals || []) {
    for (const page of origin.pages || []) {
      if (typeof page?.url !== "string" || !page.url) {
        continue;
      }

      const key = canonicalPageUrl(page.url);

      if (key) {
        pages.set(key, {
          lang: page.lang,
          page_role: page.page_role,
        });
      }
    }

    for (const topic of origin.declared_topics || []) {
      for (const item of topic.evidence || []) {
        if (
          item?.community_eligible !== true ||
          item.class !== "declared" ||
          typeof item.page !== "string" ||
          !item.page
        ) {
          continue;
        }

        const key = canonicalPageUrl(item.page);

        if (!key) {
          continue;
        }

        const list = declaredByUrl.get(key) || [];
        list.push({
          slug: topic.slug,
          label: topic.label,
          raw_value: item.raw_value || topic.label,
          source: item.source,
          community_eligible: item.community_eligible === true,
        });
        declaredByUrl.set(key, list);
      }
    }
  }

  return (items || []).map((item) => {
    const key = typeof item.url === "string" ? canonicalPageUrl(item.url) : "";
    const page = key ? pages.get(key) : undefined;
    const pageTopics = key ? declaredByUrl.get(key) || [] : [];
    const next = { ...item };
    const topicKey = new Set(
      (next.declared_topics || []).map(
        (topic) => `${topic.slug}\0${topic.source || ""}`,
      ),
    );

    if ((!next.language || next.language === null) && page?.lang) {
      next.language = page.lang;
    }

    if (page?.page_role) {
      next.page_role = page.page_role;
    }

    for (const topic of pageTopics) {
      const id = `${topic.slug}\0${topic.source || ""}`;

      if (!topicKey.has(id)) {
        next.declared_topics = [...(next.declared_topics || []), topic];
        topicKey.add(id);
      }
    }

    next.summary = plainTextSummary(
      typeof next.summary === "string" ? next.summary : "",
    );

    return next;
  });
}

/**
 * Origins from content URLs for connection helpers.
 * @param {string} url
 * @returns {string}
 */
export function siteOriginFromContentUrl(url) {
  try {
    return originFromHttpUrl(url);
  } catch {
    return "";
  }
}
