/**
 * Goal & Constraints:
 * Extract creative works (photos, art, music, video, games, collections) from
 * Schema.org JSON-LD, Open Graph, figures, and gallery indexes. Prefer
 * publisher URLs and captions. Do not fabricate work URLs or treat decorative
 * thumbnails as independent artworks. Preserve original-language text.
 */

import { isShowcaseChromePath } from "../network/slash-pages.mjs";
import { buildTopicEvidence } from "./evidence.mjs";
import {
  decodeHrefForParse,
  jsonLdObjects,
  normalizeExtractedText,
  normalizeLanguageTag,
  schemaTypesFromHtml,
} from "./text.mjs";

/** Quoted or unquoted href (minified member HTML e.g. joshbeard.com). */
const ANCHOR_HREF_PATTERN =
  /<a\b([^>]*)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>([\s\S]*?)<\/a>/gi;

/** @type {number} */
export const MAX_CREATIVE_WORKS_PER_PAGE = 200;

const CREATIVE_SCHEMA_TYPES = [
  "CreativeWork",
  "Photograph",
  "VisualArtwork",
  "ImageObject",
  "ImageGallery",
  "MusicRecording",
  "MusicAlbum",
  "MusicComposition",
  "AudioObject",
  "VideoObject",
  "CollectionPage",
  "ItemList",
  "Game",
  "VideoGame",
  "SoftwareApplication",
  "MobileApplication",
  "WebApplication",
  "Book",
  "HowTo",
];

/**
 * @param {unknown} types
 * @returns {string[]}
 */
function typeList(types) {
  if (Array.isArray(types)) {
    return types.map((entry) => String(entry));
  }

  if (typeof types === "string") {
    return [types];
  }

  return [];
}

/**
 * Maps Schema.org / hints to a Joshternet content_type.
 * @param {string[]} types
 * @param {string} [pathHint]
 * @returns {string}
 */
export function creativeContentType(types, pathHint = "") {
  const joined = types.join(" ").toLowerCase();
  const path = String(pathHint || "").toLowerCase();

  if (
    /photograph|imageobject|visualartwork/.test(joined) ||
    /photo|gallery|illustration|art\b/.test(path)
  ) {
    if (
      /gallery|collectionpage|itemlist/.test(joined) ||
      /galler|albums?\b/.test(path)
    ) {
      return "collection";
    }

    if (
      /visualartwork|illustration|art\b/.test(joined) ||
      /art|illustrat/.test(path)
    ) {
      return "visual_artwork";
    }

    return "photograph";
  }

  if (/musicalbum/.test(joined) || /discograph|albums?\b/.test(path)) {
    return "music_album";
  }

  // PDF scores / MusicComposition are sheet music, not audio recordings.
  if (
    /musiccomposition/.test(joined) ||
    (/\.pdf(\?|$)/i.test(path) &&
      /music|score|sheet|composition|scores?\b/.test(path))
  ) {
    return "sheet_music";
  }

  if (
    /musicrecording|audioobject/.test(joined) ||
    /\.(mp3|m4a|aac|ogg|flac|wav|opus)(\?|$)/i.test(path) ||
    /music|tracks?\b|sounds?\b/.test(path)
  ) {
    return "music_recording";
  }

  if (/videoobject/.test(joined) || /video|film|animation/.test(path)) {
    return "video";
  }

  if (
    /videogame|game|softwareapplication|mobileapplication|webapplication/.test(
      joined,
    ) ||
    /games?|interactive|apps?\b/.test(path)
  ) {
    return "game";
  }

  if (/collectionpage|itemlist|imagegallery/.test(joined)) {
    return "collection";
  }

  return "project";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function stringField(value) {
  if (typeof value === "string") {
    return normalizeExtractedText(value);
  }

  if (value && typeof value === "object" && typeof value.name === "string") {
    return normalizeExtractedText(value.name);
  }

  return "";
}

/**
 * @param {unknown} value
 * @param {string} baseUrl
 * @returns {string}
 */
function absoluteUrl(value, baseUrl) {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && typeof value.url === "string"
        ? value.url
        : value && typeof value === "object" && typeof value["@id"] === "string"
          ? value["@id"]
          : "";

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw, baseUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

/**
 * Maps content_type + Schema.org availability to a visitor-facing CTA label.
 * Returns null when availability does not indicate a live/playable item so
 * sold-out or out-of-stock works never get misleading action buttons.
 * @param {string} contentType
 * @param {string} availability
 * @returns {string | null}
 */
export function actionLabelForItem(contentType, availability) {
  if (!availability) {
    return null;
  }

  const avail = availability.toLowerCase();

  // Only surface a CTA for items that are online and available.
  if (!/instock|onlineonly/i.test(avail)) {
    return null;
  }

  const type = String(contentType || "").toLowerCase();

  switch (type) {
    case "game":
      return "Play";
    case "music_recording":
    case "music_album":
      return "Listen";
    case "sheet_music":
      return "View score";
    case "video":
      return "Watch";
    case "photograph":
    case "visual_artwork":
    case "collection":
      return "View";
    case "project":
      return "View";
    default: {
      const _exhaustive = type;
      void _exhaustive;
      return "View";
    }
  }
}

/**
 * @param {Record<string, unknown>} node
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Record<string, unknown> | null}
 */
function itemFromJsonLdNode(node, pageUrl, siteOrigin, observedAt) {
  const types = typeList(node["@type"]).filter((type) =>
    CREATIVE_SCHEMA_TYPES.some((allowed) =>
      type.toLowerCase().includes(allowed.toLowerCase()),
    ),
  );

  if (types.length === 0) {
    return null;
  }

  const declaredUrl = absoluteUrl(node.url, pageUrl);
  if (typeof node.url === "string" && node.url && !declaredUrl) {
    return null;
  }

  const url =
    declaredUrl ||
    absoluteUrl(node.mainEntityOfPage, pageUrl) ||
    absoluteUrl(node["@id"], pageUrl) ||
    pageUrl;
  const title =
    stringField(node.name) ||
    stringField(node.headline) ||
    stringField(node.title);

  if (!title || !url.startsWith(siteOrigin)) {
    return null;
  }

  if (isShowcaseChromePath(url)) {
    return null;
  }

  // Skip bare ImageObject thumbnails without a distinct work URL or caption.
  if (
    types.some((type) => /ImageObject/i.test(type)) &&
    url === pageUrl &&
    !stringField(node.caption) &&
    !stringField(node.description)
  ) {
    return null;
  }

  const summary =
    stringField(node.description) ||
    stringField(node.caption) ||
    stringField(node.abstract);
  const language = normalizeLanguageTag(node.inLanguage || node.language || "");
  const contentType = creativeContentType(types, new URL(pageUrl).pathname);
  const image =
    absoluteUrl(node.image, pageUrl) ||
    absoluteUrl(node.thumbnailUrl, pageUrl) ||
    "";
  const declared_topics = [];

  for (const raw of [stringField(node.genre), stringField(node.artMedium)]) {
    if (!raw) {
      continue;
    }

    const evidence = buildTopicEvidence({
      rawValue: raw,
      source: "schema:creative",
      page: pageUrl,
      evidenceClass: "declared",
      communityEligible: true,
      observedAt,
    });

    if (evidence) {
      declared_topics.push({
        slug: evidence.slug,
        label: evidence.value,
        raw_value: evidence.raw_value,
        source: "schema:creative",
        community_eligible: true,
      });
    }
  }

  // Optional categories from applicationCategory, category, or genre.
  const categories = [];
  const catRaw =
    stringField(node.applicationCategory) || stringField(node.category) || "";

  if (catRaw) {
    categories.push(catRaw);
  }

  // Optional availability from offers (strip schema.org path prefix if present).
  let availability = "";
  const offerNode = Array.isArray(node.offers) ? node.offers[0] : node.offers;

  if (offerNode && typeof offerNode === "object") {
    const raw = stringField(offerNode.availability);
    availability = raw.includes("/") ? raw.split("/").pop() || "" : raw;
  }

  // Derive a visitor-facing CTA label from availability + content type.
  // Only set when availability signals a live/online item so dead/soldout
  // works do not get misleading buttons.
  const actionLabel = actionLabelForItem(contentType, availability);

  return {
    identity: `url:${url}`,
    url,
    site_origin: siteOrigin,
    title,
    summary,
    content_type: contentType,
    page_role: contentType === "collection" ? "portfolio" : "project",
    language: language || null,
    published_at:
      typeof node.datePublished === "string" ? node.datePublished : null,
    declared_topics,
    source: { kind: "creative-schema", page: pageUrl },
    source_feeds: [{ type: "creative-schema", url: pageUrl }],
    observed_at: observedAt,
    ...(image.startsWith("https://") ? { image } : {}),
    ...(categories.length > 0 ? { categories } : {}),
    ...(availability ? { availability } : {}),
    ...(actionLabel ? { action_label: actionLabel, action_url: url } : {}),
  };
}

/**
 * Figure / figcaption pairs on a gallery-like page.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromFigures(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  const items = [];
  const pattern = /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi;
  let match;

  while (
    (match = pattern.exec(html)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const chunk = match[1];
    const figcaptionMatch = chunk.match(
      /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i,
    );
    const altMatch = chunk.match(/alt=["']([^"']+)["']/i);
    const caption = normalizeExtractedText(
      firstDefinedString(
        figcaptionMatch ? figcaptionMatch[1] : undefined,
        altMatch ? altMatch[1] : undefined,
      ),
    );
    const anchorMatch = chunk.match(
      /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const imageMatch = chunk.match(
      /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const anchorHref = anchorMatch
      ? decodeHrefForParse(anchorMatch[1] ?? anchorMatch[2] ?? anchorMatch[3])
      : undefined;
    const imageSrc = imageMatch
      ? decodeHrefForParse(imageMatch[1] ?? imageMatch[2] ?? imageMatch[3])
      : undefined;
    const href = firstDefinedString(anchorHref, imageSrc);
    const url = absoluteUrl(href, pageUrl);

    if (!caption || !url || !url.startsWith(siteOrigin)) {
      continue;
    }

    const imageAbs = imageSrc ? absoluteUrl(imageSrc, pageUrl) : "";
    const image =
      typeof imageAbs === "string" && imageAbs.startsWith("https://")
        ? imageAbs
        : "";

    // Image file URLs alone are not treated as artwork pages.
    if (/\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url)) {
      const workUrl = anchorHref ? absoluteUrl(anchorHref, pageUrl) : "";

      if (!workUrl || !workUrl.startsWith(siteOrigin)) {
        continue;
      }

      items.push({
        identity: `url:${workUrl}`,
        url: workUrl,
        site_origin: siteOrigin,
        title: caption,
        summary: caption,
        content_type: creativeContentType([], new URL(pageUrl).pathname),
        page_role: "project",
        language: null,
        declared_topics: [],
        source: { kind: "creative-figure", page: pageUrl },
        source_feeds: [{ type: "creative-figure", url: pageUrl }],
        observed_at: observedAt,
        ...(image ? { image } : {}),
      });
      continue;
    }

    items.push({
      identity: `url:${url}`,
      url,
      site_origin: siteOrigin,
      title: caption,
      summary: caption,
      content_type: creativeContentType([], new URL(pageUrl).pathname),
      page_role: "project",
      language: null,
      declared_topics: [],
      source: { kind: "creative-figure", page: pageUrl },
      source_feeds: [{ type: "creative-figure", url: pageUrl }],
      observed_at: observedAt,
      ...(image ? { image } : {}),
    });
  }

  return items;
}

/**
 * Same-origin project cards from creative index pages.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromIndexLinks(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  const items = [];
  const seen = new Set();
  const path = new URL(pageUrl).pathname.toLowerCase();
  const indexRoots =
    /^\/(gallery|galleries|albums|photography|photos|art|illustration|artwork|music|discography|tracks|videos|film|animation|games|game|interactive|exhibitions|design|portfolio|work|projects?|experiments?|sounds?|apps?|software|books?|guides?|resources?|shows?|concerts?|events?)(?:\/|$)/i;

  if (!indexRoots.test(path.replace(/\/+$/, "") + "/")) {
    return items;
  }

  const linkPattern = new RegExp(ANCHOR_HREF_PATTERN.source, "gi");
  let match;

  while (
    (match = linkPattern.exec(html)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const href = decodeHrefForParse(match[2] ?? match[3] ?? match[4]);
    const url = absoluteUrl(href, pageUrl);
    const title = normalizeExtractedText(match[6].replace(/<[^>]+>/g, " "));

    if (!url || !url.startsWith(siteOrigin) || !title || title.length < 2) {
      continue;
    }

    if (url === pageUrl || seen.has(url)) {
      continue;
    }

    // Prefer detail pages under the same index prefix.
    // `url` already passed absoluteUrl (valid http(s)), so pathname is safe.
    const childPath = new URL(url).pathname;
    const indexPrefix = path.replace(/\/+$/, "");

    if (
      indexPrefix !== "/" &&
      !childPath.toLowerCase().startsWith(indexPrefix + "/")
    ) {
      continue;
    }

    if (childPath.replace(/\/+$/, "") === indexPrefix) {
      continue;
    }

    const anchorHtml = match[0] || "";
    const imgInAnchor = anchorHtml.match(
      /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    // Prefer media/copy that follows this card’s link (joshtronic-style:
    // <h3><a>…</a></h3><img class="project">…<p>blurb</p>) instead of the
    // previous card’s trailing image in a short ±120 window.
    const afterStart = match.index + anchorHtml.length;
    const afterWindow = html.slice(afterStart, afterStart + 800);
    // Stop at the next opening heading so we keep this card’s trailing
    // </h3><img><p>… and do not steal the following card.
    const nextHeadingAt = afterWindow.search(/<h[1-6]\b/i);
    const forward = afterWindow.slice(
      0,
      nextHeadingAt >= 0 ? nextHeadingAt : afterWindow.length,
    );
    const imgAfter = forward.match(
      /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const nearby = html.slice(
      Math.max(0, match.index - 120),
      Math.min(html.length, afterStart + 120),
    );
    const imgNearby = nearby.match(
      /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const rawImg =
      (imgInAnchor && (imgInAnchor[1] ?? imgInAnchor[2] ?? imgInAnchor[3])) ||
      (imgAfter && (imgAfter[1] ?? imgAfter[2] ?? imgAfter[3])) ||
      (imgNearby && (imgNearby[1] ?? imgNearby[2] ?? imgNearby[3])) ||
      "";
    const imageAbs = rawImg ? absoluteUrl(rawImg, pageUrl) : "";
    const image =
      typeof imageAbs === "string" && imageAbs.startsWith("https://")
        ? imageAbs
        : "";
    const paragraphMatch = forward.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const summary = paragraphMatch
      ? normalizeExtractedText(paragraphMatch[1].replace(/<[^>]+>/g, " "))
      : "";

    seen.add(url);
    items.push({
      identity: `url:${url}`,
      url,
      site_origin: siteOrigin,
      title,
      summary: summary && summary !== title ? summary : "",
      content_type: creativeContentType(schemaTypesFromHtml(html), childPath),
      page_role: "project",
      language: null,
      declared_topics: [],
      source: { kind: "creative-index", page: pageUrl },
      source_feeds: [{ type: "creative-index", url: pageUrl }],
      observed_at: observedAt,
      ...(image ? { image } : {}),
    });
  }

  return items;
}

/**
 * Collect creative works from crawled HTML pages.
 * @param {Array<{url?: string, html?: string, lang?: string}>} pages
 * @param {{ siteOrigin: string, observedAt?: string }} meta
 * @returns {{
 *   items: Array<Record<string, unknown>>,
 *   subjects: Array<Record<string, unknown>>,
 * }}
 */
export function collectCreativeWorks(pages, meta) {
  const items = [];
  const subjects = [];
  const seen = new Set();
  const observedAt = meta.observedAt || "";
  const siteOrigin = meta.siteOrigin;

  if (!siteOrigin) {
    return { items, subjects };
  }

  const pageList = Array.isArray(pages) ? pages : [];

  for (const page of pageList) {
    if (!page || typeof page.html !== "string" || !page.html || !page.url) {
      continue;
    }

    const pageLang = normalizeLanguageTag(page.lang || "");

    for (const node of jsonLdObjects(extractJsonLd(page.html))) {
      const item = itemFromJsonLdNode(node, page.url, siteOrigin, observedAt);

      if (!item || seen.has(String(item.identity))) {
        continue;
      }

      if (isShowcaseChromePath(item.url)) {
        continue;
      }

      applyPageLanguage(item, pageLang);
      seen.add(String(item.identity));
      items.push(item);

      for (const topic of item.declared_topics) {
        subjects.push({
          slug: topic.slug,
          label: topic.label,
          evidence: [
            {
              source: topic.source,
              page: page.url,
              raw_value: topic.raw_value,
              class: "declared",
              community_eligible: true,
            },
          ],
        });
      }
    }

    for (const item of creativeItemsFromFigures(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (seen.has(String(item.identity)) || isShowcaseChromePath(item.url)) {
        continue;
      }

      applyPageLanguage(item, pageLang);
      seen.add(String(item.identity));
      items.push(item);
    }

    for (const item of creativeItemsFromIndexLinks(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (seen.has(String(item.identity)) || isShowcaseChromePath(item.url)) {
        continue;
      }

      applyPageLanguage(item, pageLang);
      seen.add(String(item.identity));
      items.push(item);
    }

    for (const item of creativeItemsFromHomepageLinks(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (seen.has(String(item.identity)) || isShowcaseChromePath(item.url)) {
        continue;
      }

      applyPageLanguage(item, pageLang);
      seen.add(String(item.identity));
      items.push(item);
    }

    for (const item of creativeItemsFromOpenGraph(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (seen.has(String(item.identity)) || isShowcaseChromePath(item.url)) {
        continue;
      }

      applyPageLanguage(item, pageLang);
      seen.add(String(item.identity));
      items.push(item);
    }
  }

  return { items, subjects };
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} pageLang
 */
function applyPageLanguage(item, pageLang) {
  if (item.language) {
    return;
  }

  if (pageLang) {
    item.language = pageLang;
  }
}

/**
 * @param {...unknown} values
 * @returns {string}
 */
function firstDefinedString(...values) {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return "";
}

/**
 * @param {string} html
 * @returns {unknown[]}
 */
function extractJsonLd(html) {
  const blocks = [];
  const pattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return blocks;
}

/**
 * True when a path looks like a creative index for page-role portfolio.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isCreativeIndexPath(pathname) {
  const lower = `/${String(pathname || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase()}`;

  const candidate = `${lower}/`;
  return /^\/(gallery|galleries|albums|photography|photos|art|illustration|artwork|music|discography|tracks|videos|film|animation|games|game|interactive|exhibitions|design|portfolio|work|projects?|experiments?|sounds?|apps?|software|books?|guides?|resources?|shows?|concerts?|events?)(?:\/|$)/.test(
    candidate,
  );
}

/**
 * Navigation-like single-segment paths that are not creative project pages.
 * Used by {@link creativeItemsFromHomepageLinks} to filter out utility links.
 * @type {ReadonlySet<string>}
 */
const NON_PROJECT_SEGMENTS = new Set([
  "about",
  "me",
  "now",
  "uses",
  "links",
  "more",
  "buttons",
  "referrals",
  "dedication",
  "friends",
  "feeds",
  "hello",
  "cal",
  "say-hi",
  "sayhi",
  "why",
  "seeking",
  "wander",
  "ai",
  "blog",
  "posts",
  "writings",
  "notes",
  "reading",
  "topics",
  "topic",
  "webring",
  "webrings",
  "indieweb",
  "neighborhood",
  "contact",
  "login",
  "logout",
  "signup",
  "register",
  "search",
  "privacy",
  "terms",
  "legal",
  "cookie",
  "faq",
  "help",
  "support",
  "sitemap",
  "feed",
  "rss",
  "atom",
  "newsletter",
  "subscribe",
  "home",
  "archive",
  "archives",
  "tags",
  "tag",
  "categories",
  "category",
  "news",
  "press",
  "jobs",
  "careers",
  "portfolio",
  "work",
  "projects",
  "cv",
  "resume",
  "hire",
  "colophon",
  "credits",
  "recipes",
  "things",
  "hustles",
  "code",
  "unoffice-hours",
  "unofficehours",
]);

/**
 * True when a homepage heading suggests a product / OSS shelf.
 * @param {string} heading
 * @returns {boolean}
 */
function isHomepageProductShelfHeading(heading) {
  return /\b(products?|projects?|oss|open[\s-]?source|software|apps?)\b/i.test(
    heading,
  );
}

/**
 * True when an anchor title looks like a blog/index card, not a named product.
 * @param {string} title
 * @returns {boolean}
 */
function isHomepageBlogCardTitle(title) {
  const text = String(title || "");

  return (
    /\bmin read\b/i.test(text) ||
    /\bupdates?\b/i.test(text) ||
    /\bimagining\b/i.test(text) ||
    /\?/.test(text) ||
    /&middot;|·/.test(text) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(
      text,
    ) ||
    /^\s*\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(
      text,
    )
  );
}

/**
 * Extract same-origin project links from a site homepage ("/").
 * Collects links to single-segment paths (e.g. /somaspace) that do not look
 * like navigation or utility pages. Also harvests single-segment links that
 * follow Products / Projects / OSS headings (Ghent-style product shelves).
 * Only runs when pageUrl is the root path.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromHomepageLinks(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  const items = [];

  let parsedPage;
  try {
    parsedPage = new URL(pageUrl);
  } catch {
    return items;
  }

  const rootPath = parsedPage.pathname.replace(/\/+$/, "") || "/";

  // Only process the root homepage.
  if (rootPath !== "" && rootPath !== "/") {
    return items;
  }

  const seen = new Set();
  /** @type {Set<number>} */
  const productShelfRanges = new Set();
  const headingPattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let headingMatch;

  while ((headingMatch = headingPattern.exec(html))) {
    const headingText = normalizeExtractedText(
      headingMatch[2].replace(/<[^>]+>/g, " "),
    );

    if (!isHomepageProductShelfHeading(headingText)) {
      continue;
    }

    const start = headingMatch.index + headingMatch[0].length;
    const nextHeading = html.slice(start).search(/<h[1-6]\b/i);
    const end = nextHeading >= 0 ? start + nextHeading : html.length;

    for (let index = start; index < end; index += 1) {
      productShelfRanges.add(index);
    }
  }

  const linkPattern = new RegExp(ANCHOR_HREF_PATTERN.source, "gi");
  let match;

  while (
    (match = linkPattern.exec(html)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const href = decodeHrefForParse(match[2] ?? match[3] ?? match[4]);
    const url = absoluteUrl(href, pageUrl);
    const title = normalizeExtractedText(match[6].replace(/<[^>]+>/g, " "));

    if (!url || !url.startsWith(siteOrigin) || !title || title.length < 2) {
      continue;
    }

    if (url === pageUrl || seen.has(url)) {
      continue;
    }

    let childPathname;
    try {
      childPathname = new URL(url).pathname;
    } catch {
      continue;
    }

    // Require exactly one path segment, e.g. /somaspace (not /blog/post).
    const segments = childPathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);

    if (segments.length !== 1) {
      continue;
    }

    const segment = segments[0].toLowerCase();

    if (
      NON_PROJECT_SEGMENTS.has(segment) ||
      isShowcaseChromePath(`/${segment}/`)
    ) {
      continue;
    }

    const inProductShelf = productShelfRanges.has(match.index);
    const afterStart = match.index + (match[0] || "").length;
    const forward = html.slice(afterStart, afterStart + 600);
    const imgAfter = forward.match(
      /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const paragraphMatch = forward.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const summary = paragraphMatch
      ? normalizeExtractedText(paragraphMatch[1].replace(/<[^>]+>/g, " "))
      : "";
    const rawImg =
      (imgAfter && (imgAfter[1] ?? imgAfter[2] ?? imgAfter[3])) || "";
    const imageAbs = rawImg ? absoluteUrl(rawImg, pageUrl) : "";
    const image =
      typeof imageAbs === "string" && imageAbs.startsWith("https://")
        ? imageAbs
        : "";

    // Outside a product shelf, keep short named works only—never blog cards
    // ("Oct 5 · 4 min read …", "Personal Data Pipeline Update"). Inside
    // Products/OSS shelves, allow blurbs.
    if (!inProductShelf) {
      if (title.length < 3 || title.length > 48) {
        continue;
      }

      if (isHomepageBlogCardTitle(title)) {
        continue;
      }

      // Blog posts use long hyphenated slugs; product apps usually have ≤1.
      if ((segment.match(/-/g) || []).length > 1) {
        continue;
      }

      if (title.trim().split(/\s+/).filter(Boolean).length > 3) {
        continue;
      }
    }

    const sourceKind = inProductShelf
      ? "creative-homepage-shelf"
      : "creative-homepage";

    seen.add(url);
    items.push({
      identity: `url:${url}`,
      url,
      site_origin: siteOrigin,
      title,
      summary: summary && summary !== title ? summary : "",
      content_type: "project",
      page_role: "project",
      language: null,
      declared_topics: [],
      source: { kind: sourceKind, page: pageUrl },
      source_feeds: [{ type: sourceKind, url: pageUrl }],
      observed_at: observedAt,
      ...(image ? { image } : {}),
    });
  }

  return items;
}

/**
 * Open Graph fallback for creative index pages.
 * Emits at most one item per page using og:title + og:url when og:type is a
 * recognised creative/content type. Only runs on pages whose path matches
 * {@link isCreativeIndexPath} so it does not consume data from arbitrary pages.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromOpenGraph(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  let pathname;
  try {
    pathname = new URL(pageUrl).pathname;
  } catch {
    return [];
  }

  if (!isCreativeIndexPath(pathname)) {
    return [];
  }

  // Match og:type in either attribute order.
  const typeMatch =
    html.match(
      /<meta\b[^>]*property=["']og:type["'][^>]*content=["']([^"']*)["']/i,
    ) ||
    html.match(
      /<meta\b[^>]*content=["']([^"']*)["'][^>]*property=["']og:type["']/i,
    );

  if (!typeMatch) {
    return [];
  }

  const ogType = typeMatch[1].toLowerCase();

  if (!/\b(?:article|website|product|software|game)\b/.test(ogType)) {
    return [];
  }

  const titleMatch =
    html.match(
      /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i,
    ) ||
    html.match(
      /<meta\b[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i,
    );

  if (!titleMatch) {
    return [];
  }

  const urlMatch =
    html.match(
      /<meta\b[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["']/i,
    ) ||
    html.match(
      /<meta\b[^>]*content=["']([^"']*)["'][^>]*property=["']og:url["']/i,
    );

  const title = normalizeExtractedText(titleMatch[1]);
  const url = absoluteUrl(urlMatch != null ? urlMatch[1] : pageUrl, pageUrl);

  if (!title || !url || !url.startsWith(siteOrigin)) {
    return [];
  }

  return [
    {
      identity: `url:${url}`,
      url,
      site_origin: siteOrigin,
      title,
      summary: "",
      content_type: creativeContentType([], pathname),
      page_role: "collection",
      language: null,
      declared_topics: [],
      source: { kind: "creative-og", page: pageUrl },
      source_feeds: [{ type: "creative-og", url: pageUrl }],
      observed_at: observedAt,
    },
  ];
}
