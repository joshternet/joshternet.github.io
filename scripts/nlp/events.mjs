/**
 * Goal & Constraints:
 * Extract Schema.org Event/MusicEvent/ExhibitionEvent and mf2 h-event from
 * crawled HTML. Builds content items with content_type "event".
 * Past events are never surfaced in the public Happening calendar—only future
 * or ongoing events relative to an injectable `now` are included.
 * Requires a dependable start date; undated or mention-only events are skipped.
 * Does not mint participation edges from event pages—only `attribution_role`.
 */

import {
  jsonLdObjects,
  normalizeExtractedText,
  normalizeLanguageTag,
} from "./text.mjs";

/** Content type emitted for every event item. */
export const EVENT_CONTENT_TYPE = "event";

/**
 * Valid attribution roles for an event.
 * @type {ReadonlyArray<string>}
 */
export const ATTRIBUTION_ROLES = [
  "hosted",
  "organized",
  "performed",
  "presented",
  "collaborated",
  "mention",
];

/**
 * Schema.org Event sub-types that are extractable.
 * @type {ReadonlyArray<string>}
 */
const EVENT_SCHEMA_TYPES = [
  "Event",
  "MusicEvent",
  "ExhibitionEvent",
  "SocialEvent",
  "Festival",
  "Hackathon",
  "BusinessEvent",
  "ChildrensEvent",
  "ComedyEvent",
  "CourseInstance",
  "DanceEvent",
  "DeliveryEvent",
  "EducationEvent",
  "EventSeries",
  "FoodEvent",
  "LiteraryEvent",
  "PublicationEvent",
  "SaleEvent",
  "ScreeningEvent",
  "SportsEvent",
  "TheaterEvent",
  "VisualArtsEvent",
];

/**
 * Normalises a single raw string field from a Schema.org node.
 * @param {unknown} value
 * @returns {string}
 */
function sf(value) {
  if (typeof value === "string") {
    return normalizeExtractedText(value);
  }

  if (value && typeof value === "object" && typeof value.name === "string") {
    return normalizeExtractedText(value.name);
  }

  return "";
}

/**
 * Resolves a raw URL string or Schema.org Place-like object to an absolute
 * HTTPS/HTTP URL, or empty string.
 * @param {unknown} value
 * @param {string} base
 * @returns {string}
 */
function absUrl(value, base) {
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
    const url = new URL(raw, base);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

/**
 * Strips surrounding whitespace and normalises a date string.  Returns empty
 * string when the value is not a recognisable ISO 8601 / RFC 3339 prefix.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeDate(value) {
  const raw = String(value || "").trim();

  // Require at least a YYYY-MM-DD prefix.
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return "";
  }

  return raw;
}

/**
 * Extract Schema.org event data from a single JSON-LD node.
 * @param {Record<string, unknown>} node
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Record<string, unknown> | null}
 */
function itemFromEventNode(node, pageUrl, siteOrigin, observedAt) {
  const types = (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]])
    .map((t) => String(t || ""))
    .filter((t) =>
      EVENT_SCHEMA_TYPES.some((allowed) =>
        t.toLowerCase().includes(allowed.toLowerCase()),
      ),
    );

  if (types.length === 0) {
    return null;
  }

  const start = normalizeDate(node.startDate);

  if (!start) {
    // Skip events with no dependable start date.
    return null;
  }

  const declaredUrl = absUrl(node.url, pageUrl);

  if (typeof node.url === "string" && node.url && !declaredUrl) {
    return null;
  }

  let url = declaredUrl;

  if (!url) {
    url = absUrl(node.mainEntityOfPage, pageUrl);
  }

  if (!url) {
    url = absUrl(node["@id"], pageUrl);
  }

  if (!url) {
    url = pageUrl;
  }

  if (!url.startsWith(siteOrigin)) {
    return null;
  }

  const title = sf(node.name) || sf(node.headline);

  if (!title) {
    return null;
  }

  const end = normalizeDate(node.endDate);
  const language = normalizeLanguageTag(
    String(node.inLanguage || node.language || ""),
  );

  // Location: prefer venue name + address.
  const locationNode = node.location;
  let venue = "";
  let location = "";

  if (locationNode && typeof locationNode === "object") {
    venue = sf(locationNode.name);
    const addrNode = locationNode.address;

    if (addrNode && typeof addrNode === "object") {
      const parts = [
        sf(addrNode.streetAddress),
        sf(addrNode.addressLocality),
        sf(addrNode.addressRegion),
        sf(addrNode.addressCountry),
      ].filter(Boolean);
      location = parts.join(", ");
    } else if (typeof addrNode === "string") {
      location = normalizeExtractedText(addrNode);
    }
  } else if (typeof locationNode === "string") {
    venue = normalizeExtractedText(locationNode);
  }

  // Status: strip schema.org prefix if present.
  let status = "";
  const rawStatus = String(node.eventStatus || "");

  if (rawStatus) {
    status = rawStatus.includes("/")
      ? rawStatus.split("/").pop() || ""
      : rawStatus;
  }

  // Attribution role: infer from organizer/performer/contributor.
  let attributionRole = "mention";

  const organizer = node.organizer;
  const performer = node.performer;

  if (performer) {
    attributionRole = "performed";
  } else if (organizer) {
    attributionRole = "organized";
  }

  return {
    identity: `url:${url}`,
    url,
    site_origin: siteOrigin,
    title,
    summary: sf(node.description),
    content_type: EVENT_CONTENT_TYPE,
    page_role: "event",
    language: language || null,
    start,
    ...(end ? { end } : {}),
    ...(venue ? { venue } : {}),
    ...(location ? { location } : {}),
    ...(status ? { status } : {}),
    attribution_role: attributionRole,
    source: { kind: "event-schema", page: pageUrl },
    source_feeds: [{ type: "event-schema", url: pageUrl }],
    observed_at: observedAt,
  };
}

/**
 * Extracts all JSON-LD blocks from HTML.
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
 * Extracts the `datetime` attribute value or visible text from the first
 * element whose `class` attribute contains the given mf2 property token.
 * Inspects the full tag attrs to extract `datetime` independently from class
 * so attribute order does not affect extraction.
 * @param {string} chunk
 * @param {string} token - e.g. "dt-start" or "dt-end"
 * @returns {string}
 */
function mf2DateValue(chunk, token) {
  // Find a <time|span|abbr> whose class contains the token.
  const tagPattern =
    /<(time|span|abbr)\b([^>]*)>([\s\S]*?)<\/(?:time|span|abbr)>/gi;
  let m;

  while ((m = tagPattern.exec(chunk))) {
    const attrs = m[2];
    const classVal = htmlAttrValue(attrs, "class");

    if (!classVal) {
      continue;
    }

    const classTokens = classVal.split(/\s+/);

    if (!classTokens.includes(token)) {
      continue;
    }

    // Prefer explicit datetime= attribute; fall back to visible text.
    const datetime = htmlAttrValue(attrs, "datetime");

    if (datetime) {
      return normalizeDate(datetime);
    }

    // Visible text inside the element (strip tags).
    const text = m[3].replace(/<[^>]+>/g, " ").trim();
    return normalizeDate(text);
  }

  return "";
}

/**
 * Returns the value of a named HTML attribute from a partial attribute string.
 * Only handles double- or single-quoted values.
 * @param {string} attrs
 * @param {string} name
 * @returns {string}
 */
function htmlAttrValue(attrs, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const m = attrs.match(pattern);

  if (!m) {
    return "";
  }

  // The regex alternation guarantees that when matched, m[1] captures the
  // double-quoted value and m[2] captures the single-quoted value.
  // Exactly one group is always defined when the regex matches.
  if (m[1] !== undefined) {
    return m[1];
  }

  // m[2] is always a string here since the regex only matches single-quote form.
  return String(m[2]);
}

/**
 * Extracts dt-start / dt-end from a single h-event element chunk.
 * Uses class-based mf2 parsing (no full mf2 library required).
 * @param {string} chunk
 * @returns {{ start: string, end: string }}
 */
function mf2Dates(chunk) {
  const start = mf2DateValue(chunk, "dt-start");
  const end = mf2DateValue(chunk, "dt-end");
  return { start, end };
}

/**
 * Extract mf2 h-event items from HTML.
 * Finds every element with class `h-event`, then extracts its full inner
 * content by scanning forward for the matching closing tag—avoiding the
 * greedy/non-greedy ambiguity of a simple regex terminator.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
export function eventsFromMf2(html, pageUrl, siteOrigin, observedAt) {
  const items = [];
  // Match the opening tag of any h-event element, capturing the tag name.
  const openPattern =
    /<(\w+)\b[^>]*class=["'][^"']*\bh-event\b[^"']*["'][^>]*>/gi;
  let match;

  while ((match = openPattern.exec(html))) {
    const tagName = match[1].toLowerCase();
    const innerStart = match.index + match[0].length;
    // Find matching close tag (case-insensitive, scanning forward).
    const closeTag = `</${tagName}>`;
    const closePos = html.toLowerCase().indexOf(closeTag, innerStart);

    if (closePos === -1) {
      continue;
    }

    const chunk = html.slice(innerStart, closePos);
    const { start, end } = mf2Dates(chunk);

    if (!start) {
      continue;
    }

    // p-name
    const nameMatch = chunk.match(
      /<[^>]+class=["'][^"']*\bp-name\b[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
    );
    const title = normalizeExtractedText(
      nameMatch ? nameMatch[1].replace(/<[^>]+>/g, " ") : "",
    );

    if (!title) {
      continue;
    }

    // u-url
    const urlMatch = chunk.match(
      /<a\b[^>]*class=["'][^"']*\bu-url\b[^"']*["'][^>]*href=["']([^"']+)["']/i,
    );
    let url = urlMatch ? absUrl(urlMatch[1], pageUrl) : pageUrl;

    if (!url || !url.startsWith(siteOrigin)) {
      url = pageUrl;
    }

    // p-location
    const locMatch = chunk.match(
      /<[^>]+class=["'][^"']*\bp-location\b[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
    );
    const location = locMatch
      ? normalizeExtractedText(locMatch[1].replace(/<[^>]+>/g, " "))
      : "";

    items.push({
      identity: `url:${url}`,
      url,
      site_origin: siteOrigin,
      title,
      summary: "",
      content_type: EVENT_CONTENT_TYPE,
      page_role: "event",
      language: null,
      start,
      ...(end ? { end } : {}),
      ...(location ? { location } : {}),
      attribution_role: "mention",
      source: { kind: "event-mf2", page: pageUrl },
      source_feeds: [{ type: "event-mf2", url: pageUrl }],
      observed_at: observedAt,
    });
  }

  return items;
}

/**
 * Collect event items from crawled HTML pages.
 * Only items with a dependable `start` date are emitted.
 * This function does NOT filter by horizon—callers decide what to do
 * with past events (e.g. `buildHappeningItems` skips past events for display).
 *
 * @param {Array<{url?: string, html?: string, lang?: string}>} pages
 * @param {{ siteOrigin: string, observedAt?: string }} meta
 * @returns {{ items: Array<Record<string, unknown>> }}
 */
export function collectEvents(pages, meta) {
  const items = [];
  const seen = new Set();
  const observedAt = meta?.observedAt || "";
  const siteOrigin = meta?.siteOrigin || "";

  if (!siteOrigin) {
    return { items };
  }

  for (const page of Array.isArray(pages) ? pages : []) {
    if (!page || typeof page.html !== "string" || !page.html || !page.url) {
      continue;
    }

    const pageLang = normalizeLanguageTag(String(page.lang || ""));

    for (const node of jsonLdObjects(extractJsonLd(page.html))) {
      const item = itemFromEventNode(node, page.url, siteOrigin, observedAt);

      if (!item || seen.has(String(item.identity))) {
        continue;
      }

      if (pageLang && !item.language) {
        item.language = pageLang;
      }

      seen.add(String(item.identity));
      items.push(item);
    }

    for (const item of eventsFromMf2(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (seen.has(String(item.identity))) {
        continue;
      }

      if (pageLang && !item.language) {
        item.language = pageLang;
      }

      seen.add(String(item.identity));
      items.push(item);
    }
  }

  return { items };
}
