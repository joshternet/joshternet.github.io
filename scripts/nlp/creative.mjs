/**
 * Goal & Constraints:
 * Extract creative works (photos, art, music, video, games, comics, collections)
 * from Schema.org JSON-LD, Open Graph, figures, and gallery indexes. Prefer
 * publisher URLs and captions. Do not fabricate work URLs or treat decorative
 * thumbnails as independent artworks. Preserve original-language text.
 * Comics hubs (`/comics/`, `/webcomics/`) may list strips under `/blog/…`; those
 * same-origin post links are comic works (og:image + dates via enrich).
 */

import { isShowcaseChromePath } from "../network/slash-pages.mjs";
import { projectsFromToolIndexes } from "./appearances.mjs";
import { contentIdentityKey, publishedAtFromPageHtml } from "./content.mjs";
import { isDirectoryIndexPath } from "./page-role.mjs";
import { buildTopicEvidence } from "./evidence.mjs";
import {
  decodeHrefForParse,
  firstMeaningfulParagraphFromHtml,
  htmlWithoutEmbeddedScripts,
  isJsTemplateHref,
  jsonLdObjects,
  normalizeExtractedText,
  normalizeLanguageTag,
  schemaTypesFromHtml,
  shareDescriptionFromHtml,
} from "./text.mjs";
import {
  youtubeThumbnailUrl,
  youtubeVideoIdFromHref,
} from "./youtube-feeds.mjs";

/** Index/homepage chrome blurbs that are not work descriptions. */
const CHROME_SUMMARY_RE =
  /^(elsewhere|read more|learn more|click here|more)\.?$/i;

/**
 * Content identity with hash stripped so OG and schema #fragment rows merge.
 * @param {string} url
 * @returns {string}
 */
function creativeUrlIdentity(url) {
  const key = contentIdentityKey({ url });

  if (key) {
    return key;
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return `url:${parsed.href}`;
  } catch {
    return `url:${String(url || "").split("#")[0]}`;
  }
}

/**
 * Drops title-echo and chrome CTA blurbs.
 * @param {string} summary
 * @param {string} title
 * @returns {string}
 */
function usableCreativeSummary(summary, title) {
  const text = normalizeExtractedText(summary || "");
  const titleText = normalizeExtractedText(title || "");

  if (!text) {
    return "";
  }

  if (titleText && text.toLowerCase() === titleText.toLowerCase()) {
    return "";
  }

  if (CHROME_SUMMARY_RE.test(text)) {
    return "";
  }

  return text;
}

/**
 * Splits staircase-style index link text into a short title and tagline.
 * @param {string} rawTitle
 * @returns {{ title: string, summary: string }}
 * @example
 * splitIndexLinkTitleAndTagline("worn Your movements, a stranger's face.")
 * // { title: "worn", summary: "Your movements, a stranger's face." }
 */
export function splitIndexLinkTitleAndTagline(rawTitle) {
  const title = normalizeExtractedText(rawTitle || "");

  if (!title) {
    return { title: "", summary: "" };
  }

  const stripped = title.replace(/^\d{1,3}\s+/, "").trim();
  // Only split when the work name is lowercase words (staircase indexes),
  // so Title-Case score names like "It Is Truly Meet - Macedonian" stay intact.
  const match = stripped.match(
    /^([a-z][a-z0-9]*(?:\s+[a-z][a-z0-9]*)*)\s+([A-Z][\s\S]{11,})$/,
  );

  if (!match) {
    return { title, summary: "" };
  }

  const name = normalizeExtractedText(match[1]);
  const tagline = normalizeExtractedText(match[2]);

  if (name.length < 2 || tagline.length < 12) {
    return { title, summary: "" };
  }

  if (name.toLowerCase() === tagline.toLowerCase()) {
    return { title, summary: "" };
  }

  return { title: name, summary: tagline };
}

/** Quoted or unquoted href (minified or Prettier-wrapped member HTML). */
const ANCHOR_HREF_PATTERN =
  /<a\b([^>]*)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>([\s\S]*?)<\/a\s*>/gi;

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
  "PodcastEpisode",
  "PodcastSeries",
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
 * True when a figure href is a static media file / CMS upload, not a work page.
 * @param {unknown} url
 * @returns {boolean}
 */
function isStaticMediaWorkUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }

  try {
    const path = new URL(url).pathname || "";

    if (
      /\.(jpe?g|png|gif|webp|avif|svg|mp3|m4a|aac|ogg|flac|wav|opus|mp4|webm|mov)(\?|$)/i.test(
        path,
      )
    ) {
      return true;
    }

    return /\/wp-content\/uploads\//i.test(path);
  } catch {
    return false;
  }
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

  if (/podcastepisode/.test(joined) || /\/podcasts?\//.test(path)) {
    return "podcast_episode";
  }

  if (/podcastseries/.test(joined)) {
    return "collection";
  }

  if (
    /musicrecording|audioobject/.test(joined) ||
    /\.(mp3|m4a|aac|ogg|flac|wav|opus)(\?|$)/i.test(path) ||
    /(^|\/)(music|sounds?|tracks?)(\/|$)/.test(path)
  ) {
    return "music_recording";
  }

  // `/film/` is film-stock photography on member sites, not motion video.
  if (/(^|\/)film(\/|$)/.test(path) && !/videoobject/.test(joined)) {
    return "photograph";
  }

  if (
    /videoobject/.test(joined) ||
    /(^|\/)(videos?|animation|reels?|shorts|cssbattles?)(\/|$)/.test(path)
  ) {
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

  if (!raw || isJsTemplateHref(raw)) {
    return "";
  }

  try {
    const url = new URL(raw, baseUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    if (isJsTemplateHref(url.pathname) || isJsTemplateHref(url.href)) {
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
    case "podcast_episode":
      return "Listen";
    case "sheet_music":
      return "View score";
    case "video":
      return "Watch";
    case "photograph":
    case "visual_artwork":
    case "collection":
    case "comic":
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

  // A sitemap, speaking archive, or tools index is not a creative work.
  if (isDirectoryIndexPath(url) || isShowcaseChromePath(url)) {
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
    identity: creativeUrlIdentity(url),
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
    const rawCaption = firstDefinedString(
      figcaptionMatch ? figcaptionMatch[1] : undefined,
      altMatch ? altMatch[1] : undefined,
    );
    const caption = normalizeExtractedText(
      String(rawCaption || "").replace(/<[^>]+>/g, " "),
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

    // Static media files (and image-only figure hrefs) are never Showcase works.
    if (isStaticMediaWorkUrl(url)) {
      continue;
    }

    const titleMatch = chunk.match(
      /<span\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    );
    const title = normalizeExtractedText(
      firstDefinedString(titleMatch ? titleMatch[1] : undefined, caption),
    );
    const published =
      publishedAtFromPageHtml(chunk) || publishedAtFromPageHtml(caption);

    const workTitle = title || caption;
    items.push({
      identity: creativeUrlIdentity(url),
      url,
      site_origin: siteOrigin,
      title: workTitle,
      summary: usableCreativeSummary(caption, workTitle),
      content_type: creativeContentType([], new URL(pageUrl).pathname),
      page_role: "project",
      language: null,
      ...(published ? { published_at: published } : {}),
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
/**
 * Year album cards: `.album-in-list` → `/photos/{year}/`.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromAlbumList(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  const items = [];
  const seen = new Set();

  if (typeof html !== "string" || !html || !/album-in-list/i.test(html)) {
    return items;
  }

  // Match album links directly (cards nest <div>s; avoid fragile outer wrappers).
  const linkPattern =
    /<a\b([^>]*class(?:=["'][^"']*album-in-list-link[^"']*["']|=album-in-list-link\b)[^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while (
    (match = linkPattern.exec(html)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const attrs = match[1] || "";
    const inner = match[2] || "";
    const hrefMatch = attrs.match(
      /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const url = absoluteUrl(
      decodeHrefForParse(
        hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "",
      ),
      pageUrl,
    );

    if (!url || !url.startsWith(siteOrigin) || seen.has(url)) {
      continue;
    }

    const title =
      normalizeExtractedText(
        (
          inner.match(
            /class(?:=["'][^"']*album-in-list-title[^"']*["']|=album-in-list-title\b)[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
          )?.[1] ||
          inner.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ||
          ""
        ).replace(/<[^>]+>/g, " "),
      ) ||
      normalizeExtractedText(
        inner.match(/<img\b[^>]*alt=["']([^"']+)["']/i)?.[1] ||
          inner.match(/<img\b[^>]*alt=([^\s>]+)/i)?.[1] ||
          "",
      );
    const img = inner.match(
      /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const rawImg = img?.[1] ?? img?.[2] ?? img?.[3] ?? "";
    const imageAbs = rawImg ? absoluteUrl(rawImg, pageUrl) : "";
    const image =
      typeof imageAbs === "string" && imageAbs.startsWith("https://")
        ? imageAbs
        : "";

    if (!title) {
      continue;
    }

    let albumTitle = title;
    let albumSummary = "";
    const altText = normalizeExtractedText(
      inner.match(/<img\b[^>]*alt=["']([^"']+)["']/i)?.[1] ||
        inner.match(/<img\b[^>]*alt=([^\s>]+)/i)?.[1] ||
        "",
    );

    try {
      const yearMatch = new URL(url).pathname.match(/\/((?:19|20)\d{2})\/?$/);
      const year = yearMatch?.[1] || "";

      if (year && title !== year) {
        // Long list titles ("An assortment of photos from 2026") become summary.
        albumTitle = `${year} photos`;
        albumSummary = usableCreativeSummary(title, albumTitle);
      } else if (year) {
        albumTitle = `${year} photos`;
        albumSummary = usableCreativeSummary(altText, albumTitle);
      }
    } catch {
      albumSummary = usableCreativeSummary(altText, albumTitle);
    }

    seen.add(url);
    items.push({
      identity: creativeUrlIdentity(url),
      url,
      site_origin: siteOrigin,
      title: albumTitle,
      summary: albumSummary,
      content_type: "collection",
      page_role: "portfolio",
      language: null,
      declared_topics: [],
      source: { kind: "photo-album-list", page: pageUrl },
      source_feeds: [{ type: "photo-album-list", url: pageUrl }],
      observed_at: observedAt,
      ...(image ? { image } : {}),
    });
  }

  return items;
}

/**
 * True when the page is a sounds / music / tracks / discography index.
 * @param {string} pathname
 * @returns {boolean}
 */
function isSoundsIndexPath(pathname) {
  return /\/(sounds?|music|tracks|discography)(?:\/|$)/i.test(
    String(pathname || ""),
  );
}

/**
 * External listen links on /sounds/ or /music/ indexes (YouTube, Bandcamp, …).
 * Card target is the listen URL (index stays in source provenance). YouTube
 * rows get an hqdefault poster when the video id parses.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromExternalListenLinks(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  const items = [];
  const seen = new Set();
  let path = "/";

  try {
    path = new URL(pageUrl).pathname.toLowerCase();
  } catch {
    return items;
  }

  if (!isSoundsIndexPath(path)) {
    return items;
  }

  let siteOriginUrl;

  try {
    siteOriginUrl = new URL(siteOrigin);
  } catch {
    return items;
  }

  const linkPattern = new RegExp(ANCHOR_HREF_PATTERN.source, "gi");
  let match;

  while (
    (match = linkPattern.exec(html)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const href = decodeHrefForParse(match[2] ?? match[3] ?? match[4]);
    const title = normalizeExtractedText(match[6].replace(/<[^>]+>/g, " "));

    if (!href || !title || title.length < 2) {
      continue;
    }

    let absolute;

    try {
      absolute = new URL(href, pageUrl);
    } catch {
      continue;
    }

    if (absolute.origin === siteOriginUrl.origin) {
      continue;
    }

    if (!/^https?:$/i.test(absolute.protocol)) {
      continue;
    }

    const listenUrl = absolute.href;
    const host = absolute.hostname.toLowerCase();

    if (
      !/(youtube\.com|youtu\.be|bandcamp\.com|soundcloud\.com|spotify\.com|vimeo\.com)/.test(
        host,
      ) &&
      !/\.(mp3|m4a|aac|ogg|flac|wav|opus)(\?|$)/i.test(listenUrl)
    ) {
      continue;
    }

    const identity = `listen:${siteOrigin}:${listenUrl}`;

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    const videoId = youtubeVideoIdFromHref(listenUrl);
    const image = videoId ? youtubeThumbnailUrl(videoId) : "";
    items.push({
      identity,
      url: listenUrl,
      site_origin: siteOrigin,
      title,
      summary: "",
      content_type: "music_recording",
      page_role: "project",
      language: null,
      declared_topics: [],
      source: { kind: "sounds-listen-link", page: pageUrl },
      source_feeds: [{ type: "sounds-listen-link", url: pageUrl }],
      observed_at: observedAt,
      action_label: "Listen",
      action_url: listenUrl,
      actions: [
        {
          label: "Listen",
          url: listenUrl,
          type: "listen",
        },
      ],
      ...(image ? { image } : {}),
    });
  }

  return items;
}

/**
 * Off-origin band/project cards listed as h2/h3 links on /sounds/ indexes
 * (joshtronic-shaped: heading link + img.project + blurb).
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromSoundsProjectLinks(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  const items = [];
  const seen = new Set();
  let path = "/";

  try {
    path = new URL(pageUrl).pathname.toLowerCase();
  } catch {
    return items;
  }

  if (!isSoundsIndexPath(path)) {
    return items;
  }

  let siteOriginUrl;

  try {
    siteOriginUrl = new URL(siteOrigin);
  } catch {
    return items;
  }

  const headingPattern =
    /<h([23])\b[^>]*>\s*<a\b([^>]*)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>([\s\S]*?)<\/a\s*>\s*<\/h\1>/gi;
  let match;

  while (
    (match = headingPattern.exec(html)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const href = decodeHrefForParse(match[3] ?? match[4] ?? match[5]);
    const title = normalizeExtractedText(match[7].replace(/<[^>]+>/g, " "));

    if (!href || !title || title.length < 2) {
      continue;
    }

    let absolute;

    try {
      absolute = new URL(href, pageUrl);
    } catch {
      continue;
    }

    if (absolute.origin === siteOriginUrl.origin) {
      continue;
    }

    if (!/^https?:$/i.test(absolute.protocol)) {
      continue;
    }

    const host = absolute.hostname.toLowerCase();

    // Streaming listen hosts belong to creativeItemsFromExternalListenLinks.
    if (
      /(youtube\.com|youtu\.be|bandcamp\.com|soundcloud\.com|spotify\.com|vimeo\.com)/.test(
        host,
      )
    ) {
      continue;
    }

    const projectUrl = absolute.href;
    const identity = `sounds-project:${siteOrigin}:${projectUrl}`;

    if (seen.has(identity)) {
      continue;
    }

    const afterHeading = html.slice(match.index + match[0].length);
    const untilNextHeading = afterHeading.split(/<h[23]\b/i)[0] || "";
    const imgMatch =
      untilNextHeading.match(
        /<img\b[^>]*class\s*=\s*(?:"[^"]*\bproject\b[^"]*"|'[^']*\bproject\b[^']*'|[^\s>]*\bproject\b)[^>]*>/i,
      ) || untilNextHeading.match(/<img\b[^>]*>/i);
    const imgTag = imgMatch?.[0] || "";
    const srcMatch = imgTag.match(
      /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const rawImg = srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3] ?? "";
    const imageAbs = rawImg ? absoluteUrl(rawImg, pageUrl) : "";
    const image =
      typeof imageAbs === "string" && imageAbs.startsWith("https://")
        ? imageAbs
        : "";
    const paragraphMatch = untilNextHeading.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const summary = usableCreativeSummary(
      paragraphMatch ? paragraphMatch[1].replace(/<[^>]+>/g, " ") : "",
      title,
    );

    seen.add(identity);
    items.push({
      identity,
      url: projectUrl,
      site_origin: siteOrigin,
      title,
      summary,
      content_type: "music_recording",
      page_role: "project",
      language: null,
      declared_topics: [],
      source: { kind: "sounds-project-link", page: pageUrl },
      source_feeds: [{ type: "sounds-project-link", url: pageUrl }],
      observed_at: observedAt,
      ...(image ? { image } : {}),
    });
  }

  return items;
}

/**
 * External watch links on video indexes (YouTube, Vimeo, Twitch).
 * Work identity stays on the member page; watch action points off-origin.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromExternalWatchLinks(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  const items = [];
  const seen = new Set();
  let path = "/";

  try {
    path = new URL(pageUrl).pathname.toLowerCase();
  } catch {
    return items;
  }

  if (!/\/(videos?|reels?|shorts|animation|cssbattles?)(?:\/|$)/i.test(path)) {
    return items;
  }

  const linkPattern = new RegExp(ANCHOR_HREF_PATTERN.source, "gi");
  let match;

  while (
    (match = linkPattern.exec(html)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const href = decodeHrefForParse(match[2] ?? match[3] ?? match[4]);
    const title = normalizeExtractedText(match[6].replace(/<[^>]+>/g, " "));

    if (!href || !title || title.length < 2) {
      continue;
    }

    let absolute;

    try {
      absolute = new URL(href, pageUrl);
    } catch {
      continue;
    }

    if (absolute.origin === new URL(siteOrigin).origin) {
      continue;
    }

    if (!/^https?:$/i.test(absolute.protocol)) {
      continue;
    }

    const watchUrl = absolute.href;
    const host = absolute.hostname.toLowerCase();

    if (!/(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv)/.test(host)) {
      continue;
    }

    const identity = `watch:${siteOrigin}:${watchUrl}`;

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    items.push({
      identity,
      url: watchUrl,
      site_origin: siteOrigin,
      title,
      summary: "",
      content_type: "video",
      page_role: "project",
      language: null,
      declared_topics: [],
      source: { kind: "videos-watch-link", page: pageUrl },
      source_feeds: [{ type: "videos-watch-link", url: pageUrl }],
      observed_at: observedAt,
      actions: [
        {
          label: "Watch",
          url: watchUrl,
          type: "watch",
        },
      ],
    });
  }

  return items;
}

/**
 * True when the page is a comics / webcomics index hub.
 * @param {string} pathname
 * @returns {boolean}
 */
function isComicsHubPath(pathname) {
  const normalized = `/${String(pathname || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase()}`;

  return /^\/(comics?|webcomics)$/.test(normalized);
}

/**
 * Writing-tree roots where comics hubs commonly list strips (Artlung-shaped).
 * These are Showcase chrome for ordinary posts, but hub-listed links are comics.
 * @type {ReadonlySet<string>}
 */
const COMICS_HUB_WRITING_ROOTS = new Set(["blog", "posts", "writings"]);

/**
 * Same-origin comic post linked from a comics hub (often under `/blog/…`
 * rather than `/comics/…`). Rejects media files, bare indexes, and non-writing
 * chrome trees. Writing-tree children listed from the hub are allowed.
 * @param {string} url
 * @param {string} siteOrigin
 * @returns {boolean}
 */
function isComicsHubLinkedWork(url, siteOrigin) {
  if (typeof url !== "string" || !url.startsWith("https://")) {
    return false;
  }

  if (isStaticMediaWorkUrl(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const origin = new URL(siteOrigin).origin;

    if (parsed.origin !== origin) {
      return false;
    }

    const path = parsed.pathname.replace(/\/+$/, "") || "/";

    if (path === "/") {
      return false;
    }

    const parts = path.split("/").filter(Boolean);

    // Need a real post path (`/blog/2025/03/use-it/`), not `/blog/` or `/photos/`.
    if (parts.length < 2) {
      return false;
    }

    if (isComicsHubPath(path) || isCreativeIndexPath(path)) {
      return false;
    }

    const root = parts[0].toLowerCase();

    // Hub-listed writing-tree posts are the comic works themselves.
    if (COMICS_HUB_WRITING_ROOTS.has(root)) {
      return true;
    }

    // Other chrome trees (topics, tags, webrings, …) stay out.
    if (isShowcaseChromePath(url)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Same-origin project cards from creative index pages. Comics hubs also accept
 * off-prefix same-origin comic posts (e.g. Artlung `/comics/` → `/blog/…`).
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
  const comicsHub = isComicsHubPath(path);
  const indexRoots =
    /^\/(gallery|galleries|albums|photography|photos|art|illustration|artwork|paintings?|graphics?|fiction|comics?|webcomics|toys?|play|reels?|shorts|cssbattles?|music|discography|tracks|videos|film|animation|games|game|interactive|exhibitions|design|portfolio|work|projects?|experiments?|sounds?|apps?|software|books?|guides?|resources?|shows?|concerts?|events?|podcasts?|study-hall|frontend-study-hall|front-end-study-hall|fresh|education|learn|classes?|courses?)(?:\/|$)/i;

  if (!indexRoots.test(path.replace(/\/+$/, "") + "/")) {
    return items;
  }

  const linkHtml = htmlWithoutEmbeddedScripts(html);
  const indexIntro =
    shareDescriptionFromHtml(html) ||
    firstMeaningfulParagraphFromHtml(html) ||
    "";
  const linkPattern = new RegExp(ANCHOR_HREF_PATTERN.source, "gi");
  let match;

  while (
    (match = linkPattern.exec(linkHtml)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const href = decodeHrefForParse(match[2] ?? match[3] ?? match[4]);
    const url = absoluteUrl(href, pageUrl);
    const rawTitle = normalizeExtractedText(match[6].replace(/<[^>]+>/g, " "));

    if (
      !url ||
      !url.startsWith(siteOrigin) ||
      !rawTitle ||
      rawTitle.length < 2
    ) {
      continue;
    }

    if (url === pageUrl || seen.has(url)) {
      continue;
    }

    // Prefer detail pages under the same index prefix.
    // `url` already passed absoluteUrl (valid http(s)), so pathname is safe.
    const childPath = new URL(url).pathname;
    const indexPrefix = path.replace(/\/+$/, "");
    const underPrefix =
      indexPrefix === "/" ||
      childPath.toLowerCase().startsWith(indexPrefix + "/");
    const comicsOffPrefix =
      comicsHub && !underPrefix && isComicsHubLinkedWork(url, siteOrigin);

    if (!underPrefix && !comicsOffPrefix) {
      continue;
    }

    if (childPath.replace(/\/+$/, "") === indexPrefix) {
      continue;
    }

    if (isStaticMediaWorkUrl(url)) {
      continue;
    }

    // Writing-tree comics hub links are intentional; other chrome stays out.
    if (
      isShowcaseChromePath(url) &&
      !(
        comicsOffPrefix &&
        COMICS_HUB_WRITING_ROOTS.has(
          childPath.split("/").filter(Boolean)[0]?.toLowerCase() || "",
        )
      )
    ) {
      continue;
    }

    const anchorHtml = match[0] || "";
    const imgInAnchor = anchorHtml.match(
      /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    // Prefer media/copy that follows this card’s link (shelf cards often:
    // <h3><a>…</a></h3><img class="project">…<p>blurb</p>) instead of the
    // previous card’s trailing image in a short ±120 window. match.index is
    // relative to linkHtml (script-stripped), so slice that string—not raw html.
    const afterStart = match.index + anchorHtml.length;
    const afterWindow = linkHtml.slice(afterStart, afterStart + 800);
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
    const nearby = linkHtml.slice(
      Math.max(0, match.index - 120),
      Math.min(linkHtml.length, afterStart + 120),
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
    const paragraphSummary = paragraphMatch
      ? normalizeExtractedText(paragraphMatch[1].replace(/<[^>]+>/g, " "))
      : "";
    const contentType = comicsHub
      ? "comic"
      : creativeContentType(schemaTypesFromHtml(html), childPath);
    const sourceKind = comicsOffPrefix
      ? "creative-comics-hub"
      : "creative-index";
    const split = splitIndexLinkTitleAndTagline(rawTitle);
    let title = rawTitle;
    let summary = usableCreativeSummary(paragraphSummary, rawTitle);

    if (!summary && split.summary) {
      title = split.title;
      summary = usableCreativeSummary(split.summary, title);
    }

    // PDF sheet-music links rarely have a trailing <p>; inherit the index intro.
    if (!summary && contentType === "sheet_music") {
      summary = usableCreativeSummary(indexIntro, title);
    }

    seen.add(url);
    items.push({
      identity: creativeUrlIdentity(url),
      url,
      site_origin: siteOrigin,
      title,
      summary,
      content_type: contentType,
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

    for (const item of creativeItemsFromAlbumList(
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

    for (const item of creativeItemsFromExternalListenLinks(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (seen.has(String(item.identity))) {
        continue;
      }

      applyPageLanguage(item, pageLang);
      seen.add(String(item.identity));
      items.push(item);
    }

    for (const item of creativeItemsFromSoundsProjectLinks(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (seen.has(String(item.identity))) {
        continue;
      }

      applyPageLanguage(item, pageLang);
      seen.add(String(item.identity));
      items.push(item);
    }

    for (const item of creativeItemsFromExternalWatchLinks(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (seen.has(String(item.identity))) {
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
      if (seen.has(String(item.identity))) {
        continue;
      }

      if (
        String(item.url || "").startsWith(siteOrigin) &&
        isShowcaseChromePath(item.url)
      ) {
        continue;
      }

      applyPageLanguage(item, pageLang);
      seen.add(String(item.identity));
      items.push(item);
    }

    for (const item of creativeItemsFromProjectsIndex(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      // Off-origin shelf products use member site_origin; skip chrome only for
      // same-origin URLs (external App Store / product domains are fine).
      if (seen.has(String(item.identity))) {
        continue;
      }

      if (
        String(item.url || "").startsWith(siteOrigin) &&
        isShowcaseChromePath(item.url)
      ) {
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

  for (const item of projectsFromToolIndexes(pageList, {
    siteOrigin,
    observedAt,
  })) {
    if (seen.has(String(item.identity)) || isShowcaseChromePath(item.url)) {
      continue;
    }

    seen.add(String(item.identity));
    items.push(item);
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
  return /^\/(gallery|galleries|albums|photography|photos|art|illustration|artwork|paintings?|graphics?|fiction|comics?|webcomics|toys?|play|reels?|shorts|cssbattles?|music|discography|tracks|videos|film|animation|games|game|interactive|exhibitions|design|portfolio|work|projects?|experiments?|sounds?|apps?|software|books?|guides?|resources?|shows?|concerts?|events?|podcasts?|study-hall|frontend-study-hall|front-end-study-hall|fresh|education|learn|classes?|courses?)(?:\/|$)/.test(
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
  "hire-me",
  "availability",
  "ideas",
  "colophon",
  "credits",
  "recipes",
  "things",
  "hustles",
  "code",
  "unoffice-hours",
  "unofficehours",
  "wish",
  "wish-list",
  "wishlist",
  "datenschutz",
  "impressum",
  "speaking",
  "talks",
  "presentations",
  "slides",
  "html-sitemap",
  "collections",
  "tools",
  // Licensing / reuse pages are not Showcase works.
  "image-use",
  "imageuse",
  "licensing",
  "license",
  "attribution",
  "copyright",
  "reuse",
  "permissions",
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
 * Title + blurb from a Projects-shelf anchor (e.g. dual `<span>` shelves).
 * @param {string} innerHtml
 * @returns {{ title: string, summary: string }}
 */
export function shelfLinkTitleAndSummary(innerHtml) {
  const html = typeof innerHtml === "string" ? innerHtml : "";
  const spans = [...html.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span\s*>/gi)].map(
    (match) => normalizeExtractedText(match[1].replace(/<[^>]+>/g, " ")),
  );
  const named = spans.filter(Boolean);

  if (named.length >= 2) {
    return {
      title: named[0],
      summary: named.slice(1).join(" "),
    };
  }

  if (named.length === 1) {
    return { title: named[0], summary: "" };
  }

  const flat = normalizeExtractedText(html.replace(/<[^>]+>/g, " "));

  return { title: flat, summary: "" };
}

/**
 * True when an off-origin href is a first-party product (app site, App Store,
 * GitHub repo) rather than Elsewhere chrome.
 * @param {string} href
 * @param {string} siteOrigin
 * @returns {boolean}
 */
export function isExternalProductProjectUrl(href, siteOrigin) {
  let absolute;
  let memberOrigin = "";

  try {
    absolute = new URL(href);
    memberOrigin = new URL(siteOrigin).origin;
  } catch {
    return false;
  }

  if (absolute.protocol !== "https:" && absolute.protocol !== "http:") {
    return false;
  }

  if (absolute.origin === memberOrigin) {
    return false;
  }

  if (absolute.username || absolute.password) {
    return false;
  }

  const host = absolute.hostname.toLowerCase();
  const parts = absolute.pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  // Profile / social Elsewhere links — never projects.
  if (
    /(^|\.)(twitter|x|instagram|linkedin|facebook|threads|mastodon|bsky|bluesky)\./.test(
      host,
    ) ||
    host === "bsky.app" ||
    host.endsWith(".bsky.social") ||
    host === "substack.com" ||
    host.endsWith(".substack.com")
  ) {
    return false;
  }

  if (host === "github.com" || host === "www.github.com") {
    // Require owner/repo, not a bare profile.
    return parts.length >= 2;
  }

  if (host === "apps.apple.com" || host.endsWith(".apple.com")) {
    return parts.length >= 1;
  }

  if (host === "play.google.com") {
    return /\/store\/apps\//i.test(absolute.pathname);
  }

  // Dedicated product domains (themorning.app) — any path is fine.
  return true;
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

  // Never scrape anchors out of inline LinkLog / template scripts.
  const linkHtml = htmlWithoutEmbeddedScripts(html);
  const seen = new Set();
  /** @type {Set<number>} */
  const productShelfRanges = new Set();
  const headingPattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let headingMatch;

  while ((headingMatch = headingPattern.exec(linkHtml))) {
    const headingText = normalizeExtractedText(
      headingMatch[2].replace(/<[^>]+>/g, " "),
    );

    if (!isHomepageProductShelfHeading(headingText)) {
      continue;
    }

    const start = headingMatch.index + headingMatch[0].length;
    const nextHeading = linkHtml.slice(start).search(/<h[1-6]\b/i);
    const end = nextHeading >= 0 ? start + nextHeading : linkHtml.length;

    for (let index = start; index < end; index += 1) {
      productShelfRanges.add(index);
    }
  }

  const linkPattern = new RegExp(ANCHOR_HREF_PATTERN.source, "gi");
  let match;

  while (
    (match = linkPattern.exec(linkHtml)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const href = decodeHrefForParse(match[2] ?? match[3] ?? match[4]);
    const url = absoluteUrl(href, pageUrl);
    const inProductShelf = productShelfRanges.has(match.index);
    const { title: shelfTitle, summary: shelfSummary } =
      shelfLinkTitleAndSummary(match[6] || "");
    let title = shelfTitle;
    let summary = shelfSummary;

    if (!url || !title || title.length < 2) {
      continue;
    }

    if (url === pageUrl || seen.has(url)) {
      continue;
    }

    const sameOrigin = url.startsWith(siteOrigin);
    let childPathname = "";
    let segment = "";

    try {
      childPathname = new URL(url).pathname;
    } catch {
      continue;
    }

    if (sameOrigin) {
      // Require exactly one path segment, e.g. /somaspace (not /blog/post).
      const segments = childPathname
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(Boolean);

      if (segments.length !== 1) {
        continue;
      }

      segment = segments[0].toLowerCase();

      if (
        NON_PROJECT_SEGMENTS.has(segment) ||
        isShowcaseChromePath(`/${segment}/`)
      ) {
        continue;
      }
    } else if (
      !inProductShelf ||
      !isExternalProductProjectUrl(url, siteOrigin)
    ) {
      continue;
    }

    const afterStart = match.index + (match[0] || "").length;
    const forward = linkHtml.slice(afterStart, afterStart + 600);
    const imgAfter = forward.match(
      /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const paragraphMatch = forward.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const paragraphSummary = paragraphMatch
      ? normalizeExtractedText(paragraphMatch[1].replace(/<[^>]+>/g, " "))
      : "";

    if (!summary && paragraphSummary) {
      summary = paragraphSummary;
    }

    const rawImg =
      (imgAfter && (imgAfter[1] ?? imgAfter[2] ?? imgAfter[3])) || "";
    const imageAbs = rawImg ? absoluteUrl(rawImg, pageUrl) : "";
    const image =
      typeof imageAbs === "string" && imageAbs.startsWith("https://")
        ? imageAbs
        : "";

    // Outside a product shelf, keep short named works only—never blog cards
    // ("Oct 5 · 4 min read …", "Personal Data Pipeline Update"). Inside
    // Products/OSS shelves, allow blurbs and off-origin first-party apps.
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
      identity: creativeUrlIdentity(url),
      url,
      site_origin: siteOrigin,
      title,
      summary: usableCreativeSummary(summary, title),
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
 * Projects index pages (`/projects/`) listing same-origin and off-origin works
 * (first-party apps linked from a Projects shelf, including off-origin).
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function creativeItemsFromProjectsIndex(
  html,
  pageUrl,
  siteOrigin,
  observedAt,
) {
  const items = [];

  if (typeof html !== "string" || !html) {
    return items;
  }

  let path = "/";

  try {
    path = new URL(pageUrl).pathname.toLowerCase().replace(/\/+$/, "") || "/";
  } catch {
    return items;
  }

  if (!/^\/projects?$/.test(path)) {
    return items;
  }

  const linkHtml = htmlWithoutEmbeddedScripts(html);
  const seen = new Set();
  const linkPattern = new RegExp(ANCHOR_HREF_PATTERN.source, "gi");
  let match;

  while (
    (match = linkPattern.exec(linkHtml)) &&
    items.length < MAX_CREATIVE_WORKS_PER_PAGE
  ) {
    const href = decodeHrefForParse(match[2] ?? match[3] ?? match[4]);
    const url = absoluteUrl(href, pageUrl);
    const { title, summary: shelfSummary } = shelfLinkTitleAndSummary(
      match[6] || "",
    );

    if (
      !url ||
      !title ||
      title.length < 2 ||
      seen.has(url) ||
      url === pageUrl
    ) {
      continue;
    }

    const sameOrigin = url.startsWith(siteOrigin);

    if (sameOrigin) {
      let childPathname = "";

      try {
        childPathname = new URL(url).pathname;
      } catch {
        continue;
      }

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
    } else if (!isExternalProductProjectUrl(url, siteOrigin)) {
      continue;
    }

    if (isHomepageBlogCardTitle(title)) {
      continue;
    }

    seen.add(url);
    items.push({
      identity: creativeUrlIdentity(url),
      url,
      site_origin: siteOrigin,
      title,
      summary: shelfSummary && shelfSummary !== title ? shelfSummary : "",
      content_type: "project",
      page_role: "project",
      language: null,
      declared_topics: [],
      source: { kind: "creative-projects-shelf", page: pageUrl },
      source_feeds: [{ type: "creative-projects-shelf", url: pageUrl }],
      observed_at: observedAt,
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
      identity: creativeUrlIdentity(url),
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
