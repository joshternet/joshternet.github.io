/**
 * Goal & Constraints:
 * Extract dated speaking appearances, presentations, and tools-index entries
 * from publisher HTML. A directory page is not a work. Dates stay as published.
 * Off-origin slides and recordings are resource links, not crawled copies.
 * No person-specific rules. Undated listings and booking pages produce nothing.
 */

import {
  isEmptyAppearanceTitle,
  isYearCrumbConference,
  resolveEventTitle,
} from "./appearance-title.mjs";
import { fetchPublicText } from "./lib.mjs";
import { SPEAKING_ARCHIVE_SEGMENTS, directoryIndexRole } from "./page-role.mjs";
import { subjectsFromHtml } from "./subjects.mjs";
import { loadHtml } from "./structured-html.mjs";
import { normalizeExtractedText } from "./text.mjs";

/** Event indexes whose dated rows are gatherings the member published. */
const HOSTED_INDEX_SEGMENTS = new Set([
  "events",
  "calendar",
  "meetups",
  "schedule",
]);

/**
 * One-segment listing paths probed when deep crawl is short-circuited.
 * @type {readonly string[]}
 */
const APPEARANCE_LISTING_SEGMENTS = Object.freeze([
  ...SPEAKING_ARCHIVE_SEGMENTS,
  "tools",
  ...HOSTED_INDEX_SEGMENTS,
]);

const MONTH_INDEX = new Map([
  ["jan", "01"],
  ["january", "01"],
  ["feb", "02"],
  ["february", "02"],
  ["mar", "03"],
  ["march", "03"],
  ["apr", "04"],
  ["april", "04"],
  ["may", "05"],
  ["jun", "06"],
  ["june", "06"],
  ["jul", "07"],
  ["july", "07"],
  ["aug", "08"],
  ["august", "08"],
  ["sep", "09"],
  ["sept", "09"],
  ["september", "09"],
  ["oct", "10"],
  ["october", "10"],
  ["nov", "11"],
  ["november", "11"],
  ["dec", "12"],
  ["december", "12"],
]);

const MONTH_PATTERN = [...MONTH_INDEX.keys()].join("|");

/**
 * @param {unknown} value
 * @returns {string}
 */
function collapse(value) {
  return normalizeExtractedText(String(value || ""));
}

/**
 * Stable slug for identities. Not a permalink.
 * @param {unknown} value
 * @returns {string}
 */
export function appearanceSlug(value) {
  const slug = collapse(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug;
}

/**
 * @param {string} year
 * @param {string} monthName
 * @param {string} day
 * @returns {string}
 */
function calendarDate(year, monthName, day) {
  const month = MONTH_INDEX.get(monthName.toLowerCase());
  const dayNumber = Number(day);

  if (
    !month ||
    !Number.isInteger(dayNumber) ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return "";
  }

  const paddedDay = String(dayNumber).padStart(2, "0");
  const iso = `${year}-${month}-${paddedDay}`;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, dayNumber));

  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== dayNumber
  ) {
    return "";
  }

  return iso;
}

/**
 * Reads a publisher date. Does not invent a clock time.
 * Month-day strings such as `Mar 28` need a section year (for example an `h2`
 * that is only `2026`) via `options.year`.
 * @param {string} value
 * @param {{ year?: string | number }} [options]
 * @returns {{ start: string, precision: 'date'|'datetime'|'' }}
 */
export function parseAppearanceDate(value, options = {}) {
  const raw = collapse(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parts = raw.split("-");
    const checked = calendarDate(parts[0], monthName(parts[1]), parts[2]);

    if (!checked) {
      return { start: "", precision: "" };
    }

    return { start: checked, precision: "date" };
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const day = raw.slice(0, 10);
    const parts = day.split("-");
    const checked = calendarDate(parts[0], monthName(parts[1]), parts[2]);

    if (!checked) {
      return { start: "", precision: "" };
    }

    return { start: raw, precision: "datetime" };
  }

  const monthFirst = raw.match(
    new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i"),
  );

  if (monthFirst) {
    const start = calendarDate(monthFirst[3], monthFirst[1], monthFirst[2]);

    return start ? { start, precision: "date" } : { start: "", precision: "" };
  }

  const dayFirst = raw.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\b`, "i"),
  );

  if (dayFirst) {
    const start = calendarDate(dayFirst[3], dayFirst[2], dayFirst[1]);

    return start ? { start, precision: "date" } : { start: "", precision: "" };
  }

  const yearHint = String(options.year || "").trim();

  if (/^\d{4}$/.test(yearHint)) {
    // `(?<![A-Za-z])` so `40Mar 28` (no space after a conference number) still matches.
    const monthDay = raw.match(
      new RegExp(`(?<![A-Za-z])(${MONTH_PATTERN})\\s+(\\d{1,2})\\b`, "i"),
    );

    if (monthDay) {
      const start = calendarDate(yearHint, monthDay[1], monthDay[2]);

      return start
        ? { start, precision: "date" }
        : { start: "", precision: "" };
    }

    const dayMonth = raw.match(
      new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})(?![A-Za-z])`, "i"),
    );

    if (dayMonth) {
      const start = calendarDate(yearHint, dayMonth[2], dayMonth[1]);

      return start
        ? { start, precision: "date" }
        : { start: "", precision: "" };
    }
  }

  return { start: "", precision: "" };
}

/**
 * Month name or number used by {@link calendarDate}.
 * @param {string} month
 * @returns {string}
 */
function monthName(month) {
  const names = {
    "01": "january",
    "02": "february",
    "03": "march",
    "04": "april",
    "05": "may",
    "06": "june",
    "07": "july",
    "08": "august",
    "09": "september",
    10: "october",
    11: "november",
    12: "december",
  };

  return names[month] || month;
}

/**
 * How a page should be read, or "" when it is not a listing.
 * @param {unknown} url
 * @returns {'presented'|'hosted'|'tools'|''}
 */
export function listingMode(url) {
  let segment = "";

  try {
    const parts = new URL(String(url)).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    if (parts.length !== 1) {
      return "";
    }

    segment = parts[0].replace(/\.(html?|php)$/i, "").toLowerCase();
  } catch {
    return "";
  }

  if (directoryIndexRole(segment) === "speaking-archive") {
    return "presented";
  }

  if (segment === "tools") {
    return "tools";
  }

  if (HOSTED_INDEX_SEGMENTS.has(segment)) {
    return "hosted";
  }

  return "";
}

/**
 * @param {string} href
 * @param {string} pageUrl
 * @returns {string}
 */
function absoluteHttpUrl(href, pageUrl) {
  if (!href || href.startsWith("#")) {
    return "";
  }

  try {
    const url = new URL(href, pageUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

/**
 * @param {string} url
 * @param {string} label
 * @returns {'slides'|'recording'|'code'|''}
 */
function resourceKind(url, label) {
  const name = collapse(label);
  const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();

  const slideHost =
    host === "speakerdeck.com" ||
    (host === "docs.google.com" && url.includes("/presentation"));

  if (/^(slides?|deck)$/i.test(name) || slideHost) {
    return "slides";
  }

  const recordingHost =
    host === "youtube.com" || host === "youtu.be" || host === "vimeo.com";

  if (/^(recording|video|watch)$/i.test(name) || recordingHost) {
    return "recording";
  }

  if (/^(source|repo|code)$/i.test(name) || host === "github.com") {
    return "code";
  }

  return "";
}

/**
 * @param {string} text
 * @param {string[]} parts
 * @returns {string}
 */
function withoutParts(text, parts) {
  let rest = text;

  for (const part of parts) {
    if (!part) {
      continue;
    }

    rest = rest.split(part).join(" ");
  }

  return collapse(rest);
}

/**
 * Drop month-day crumbs and a trailing " - City" location from conference text.
 * @param {string} value
 * @returns {string}
 */
function cleanConferenceLabel(value) {
  let rest = collapse(value);

  rest = rest.replace(
    new RegExp(`(?<![A-Za-z])(${MONTH_PATTERN})\\s+\\d{1,2}\\b`, "gi"),
    " ",
  );
  rest = rest.replace(
    new RegExp(`\\b\\d{1,2}\\s+(${MONTH_PATTERN})(?![A-Za-z])`, "gi"),
    " ",
  );
  rest = rest.replace(/\s*[-–—]\s+\S.*$/u, "");
  rest = collapse(rest);

  // Year crumbs are not conference names; clear them so talk titles win.
  if (isYearCrumbConference(rest) || isEmptyAppearanceTitle(rest)) {
    return "";
  }

  return rest;
}

/**
 * Talk title when the conference is the link and the talk name is plain text.
 * @param {ReturnType<typeof loadHtml>} $
 * @param {unknown} blockElement
 * @param {string} conference
 * @param {string} yearHint
 * @returns {string}
 */
function descriptionTitle($, blockElement, conference, yearHint) {
  for (const node of $(blockElement).find("div, p, span").toArray()) {
    const clone = $(node).clone();
    clone.find("a").remove();
    const text = collapse(clone.text());

    if (!text || text.length < 3 || text.length > 200) {
      continue;
    }

    if (conference && text === conference) {
      continue;
    }

    if (parseAppearanceDate(text, yearHint ? { year: yearHint } : {}).start) {
      continue;
    }

    if (/^(slides?|deck|recording|video|watch|source|repo|code)$/i.test(text)) {
      continue;
    }

    return text;
  }

  return "";
}

/**
 * Topics declared on this item only. Page-level biography is not included.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
function topicsFromItem(html, pageUrl, observedAt) {
  const subjects = subjectsFromHtml(html, pageUrl, { observedAt });
  /** @type {Array<Record<string, unknown>>} */
  const topics = [];

  for (const subject of subjects) {
    if (subject.community_eligible !== true) {
      continue;
    }

    topics.push({
      slug: subject.slug,
      label: /** @type {string} */ (subject.label),
      source: "item:declared",
      community_eligible: true,
    });
  }

  return topics;
}

/**
 * @param {ReturnType<typeof loadHtml>} $
 * @param {unknown} element
 * @param {string} [yearHint]
 * @returns {{ start: string, precision: 'date'|'datetime'|'', label: string }}
 */
function dateFromBlock($, element, yearHint = "") {
  const options = yearHint ? { year: yearHint } : {};
  const time = $(element).find("time").first();

  if (time.length) {
    const datetime = collapse(time.attr("datetime") || "");
    const label = collapse(time.text());
    const fromDatetime = parseAppearanceDate(datetime, options);

    if (fromDatetime.start) {
      return { ...fromDatetime, label: label || datetime };
    }

    const fromLabel = parseAppearanceDate(label, options);

    if (fromLabel.start) {
      return { ...fromLabel, label };
    }
  }

  const fromText = parseAppearanceDate($(element).text(), options);

  return { ...fromText, label: fromText.start };
}

/**
 * Nearest preceding same-level outline year (`h2` text `2026`) for a block.
 * @param {ReturnType<typeof loadHtml>} $
 * @param {unknown} element
 * @returns {string}
 */
function precedingSectionYear($, element) {
  const root = $("main").length ? $("main").first() : $("body").first();
  const nodes = root.find("h1, h2, h3, h4, h5, h6, li, article, tr").toArray();
  let year = "";

  for (const node of nodes) {
    if (node === element) {
      break;
    }

    if ($(node).is("h1, h2, h3, h4, h5, h6")) {
      const heading = collapse($(node).text());

      if (/^\d{4}$/.test(heading)) {
        year = heading;
      }
    }
  }

  return year;
}

/**
 * Peer blocks in document order, outside site chrome and outside a parent block.
 * @param {ReturnType<typeof loadHtml>} $
 * @returns {unknown[]}
 */
function peerBlocks($) {
  const root = $("main").length ? $("main") : $("body");

  return root
    .find("li, article, tr")
    .toArray()
    .filter((element) => {
      if ($(element).parents("nav, header, footer").length > 0) {
        return false;
      }

      if ($(element).parents("li, article, tr").length > 0) {
        return false;
      }

      return true;
    });
}

/**
 * Prefer slides/recording when the talk URL is only the speaking archive index.
 * @param {string} itemUrl
 * @param {string} pageUrl
 * @param {Array<{ kind: string, url: string }>} resources
 * @returns {string}
 */
function presentationCardUrl(itemUrl, pageUrl, resources) {
  const slides = resources.find((resource) => resource.kind === "slides");
  const recording = resources.find((resource) => resource.kind === "recording");
  const preferred = slides || recording;
  const onArchiveIndex =
    itemUrl === pageUrl ||
    /\/speaking\/?$/i.test(itemUrl) ||
    /\/talks\/?$/i.test(itemUrl);

  if (preferred && typeof preferred.url === "string" && onArchiveIndex) {
    return preferred.url;
  }

  return itemUrl;
}

/**
 * @param {string} siteOrigin
 * @param {string} title
 * @returns {string}
 */
function presentationIdentity(siteOrigin, title) {
  return `presentation:${siteOrigin}:${appearanceSlug(title)}`;
}

/**
 * @param {string} siteOrigin
 * @param {string} conference
 * @param {string} start
 * @returns {string}
 */
function eventIdentity(siteOrigin, conference, start) {
  const day = start.slice(0, 10);
  return `event:${siteOrigin}:${appearanceSlug(conference)}:${day}`;
}

/**
 * Dated rows from a speaking archive or event index.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @param {'presented'|'hosted'} mode
 * @returns {Array<Record<string, unknown>>}
 */
function appearancesFromHtml(html, pageUrl, siteOrigin, observedAt, mode) {
  const $ = loadHtml(html);
  /** @type {Map<string, Record<string, unknown>>} */
  const presentations = new Map();
  /** @type {Array<Record<string, unknown>>} */
  const events = [];
  const seenEvents = new Set();

  for (const element of peerBlocks($)) {
    if ($(element).is(".h-event")) {
      continue;
    }

    const block = $(element).clone();
    block.children("ul, ol, table").remove();
    const topicsHtml = $.html(block);
    block.find(".p-category").remove();
    const yearHint = precedingSectionYear($, element);
    const dated = dateFromBlock($, block.get(0), yearHint);
    const text = collapse(block.text());

    if (!dated.start || /\bcancell?ed\b/i.test(text)) {
      continue;
    }

    /** @type {Array<{ url: string, text: string, kind: string }>} */
    const links = [];

    for (const anchor of block.find("a[href]").toArray()) {
      const href = absoluteHttpUrl($(anchor).attr("href") || "", pageUrl);
      const linkText = collapse($(anchor).text());

      if (!href || !linkText) {
        continue;
      }

      links.push({
        url: href,
        text: linkText,
        kind: resourceKind(href, linkText),
      });
    }

    const contentLinks = links.filter((link) => {
      if (link.text.length < 3) {
        return false;
      }

      if (!link.kind) {
        return true;
      }

      // Google Slides / video hosts can still be the talk title permalink.
      if (
        (link.kind === "slides" || link.kind === "recording") &&
        !/^(slides?|deck|recording|video|watch|session video)$/i.test(link.text)
      ) {
        return true;
      }

      return false;
    });
    const titleLink =
      contentLinks.length > 1 ? contentLinks[1] : contentLinks[0];
    const explicitConference = collapse(
      block.attr("data-conference") ||
        block.find("[data-conference]").first().text(),
    );
    const location = collapse(
      block.attr("data-location") ||
        block.find("[data-location], .p-location").first().text(),
    );
    const resourceLabels = links
      .filter((link) => link.kind)
      .map((link) => link.text);
    const description = descriptionTitle(
      $,
      block.get(0),
      explicitConference || (contentLinks[0] ? contentLinks[0].text : ""),
      yearHint,
    );
    let title = description || (titleLink ? titleLink.text : "");
    const conferenceFromLink =
      description && contentLinks[0] ? contentLinks[0].text : "";
    const conference = cleanConferenceLabel(
      explicitConference ||
        conferenceFromLink ||
        withoutParts(text, [title, dated.label, location, ...resourceLabels]),
    );

    if (!title || isEmptyAppearanceTitle(title)) {
      continue;
    }

    // When the only content link was the conference, keep slides/recording on
    // the presentation but do not treat that link as the talk permalink.
    const talkLink =
      description && contentLinks.length === 1 ? null : titleLink;
    let eventTitle = title;
    let eventLocation = location;

    if (mode === "hosted") {
      eventLocation = location || conference;
    } else {
      eventTitle = resolveEventTitle(conference, title);
    }

    // Title already passed hygiene; resolveEventTitle keeps a good talk title.
    const identity = eventIdentity(siteOrigin, eventTitle, dated.start);

    if (seenEvents.has(identity)) {
      continue;
    }

    seenEvents.add(identity);

    /** @type {Array<{ kind: string, url: string }>} */
    const resources = [];
    const seenResources = new Set();

    for (const link of links) {
      const kind = link === talkLink ? resourceKind(link.url, "") : link.kind;

      if (!kind || seenResources.has(link.url)) {
        continue;
      }

      seenResources.add(link.url);
      resources.push({ kind, url: link.url });
    }

    let itemUrl = pageUrl;

    if (
      talkLink &&
      talkLink.url.startsWith(siteOrigin) &&
      talkLink.url !== pageUrl
    ) {
      itemUrl = talkLink.url;
    }

    const sourceKind =
      mode === "presented" ? "speaking-archive" : "event-listing";
    /** @type {Record<string, unknown>} */
    const event = {
      identity,
      url: itemUrl,
      site_origin: siteOrigin,
      title: eventTitle,
      summary: mode === "presented" ? title : "",
      content_type: "event",
      page_role: "event",
      language: null,
      start: dated.start,
      start_precision: dated.precision,
      attribution_role: mode,
      source: { kind: sourceKind, page: pageUrl },
      source_feeds: [{ type: sourceKind, url: pageUrl }],
      observed_at: observedAt,
      ...(eventLocation ? { location: eventLocation } : {}),
      ...(resources.length > 0 ? { resources } : {}),
    };

    if (mode === "presented") {
      const presentationId = presentationIdentity(siteOrigin, title);
      event.related = [{ id: presentationId, relation: "presentation" }];
      const topics = topicsFromItem(topicsHtml, pageUrl, observedAt);
      const slides = resources.find((resource) => resource.kind === "slides");
      const recording = resources.find(
        (resource) => resource.kind === "recording",
      );
      const cardTarget = presentationCardUrl(itemUrl, pageUrl, resources);
      let presentation = presentations.get(presentationId);

      if (!presentation) {
        presentation = {
          identity: presentationId,
          url: cardTarget,
          site_origin: siteOrigin,
          title,
          summary: conference ? `${conference}` : "",
          content_type: "presentation",
          page_role: "presentation",
          language: null,
          start: dated.start,
          start_precision: dated.precision,
          ...(conference ? { conference } : {}),
          declared_topics: topics,
          related: [],
          resources: [],
          source: { kind: "speaking-archive", page: pageUrl },
          source_feeds: [{ type: "speaking-archive", url: pageUrl }],
          observed_at: observedAt,
          ...(slides ? { action_url: slides.url, action_label: "Slides" } : {}),
          ...(!slides && recording
            ? { action_url: recording.url, action_label: "Recording" }
            : {}),
        };
        presentations.set(presentationId, presentation);
      } else if (
        dated.start.slice(0, 10) > String(presentation.start).slice(0, 10)
      ) {
        presentation.start = dated.start;
        presentation.start_precision = dated.precision;
        presentation.summary = conference || presentation.summary;

        if (conference) {
          presentation.conference = conference;
        }

        presentation.url = presentationCardUrl(itemUrl, pageUrl, [
          .../** @type {Array<{ kind: string, url: string }>} */ (
            presentation.resources
          ),
          ...resources,
        ]);
      }

      const related = /** @type {Array<{ id: string, relation: string }>} */ (
        presentation.related
      );

      if (!related.some((item) => item.id === identity)) {
        related.push({ id: identity, relation: "presented-at" });
      }

      const presentationResources =
        /** @type {Array<{ kind: string, url: string }>} */ (
          presentation.resources
        );

      for (const resource of resources) {
        if (!presentationResources.some((item) => item.url === resource.url)) {
          presentationResources.push(resource);
        }
      }

      if (slides && !presentation.action_url) {
        presentation.action_url = slides.url;
        presentation.action_label = "Slides";
      }

      if (topics.length > 0 && presentation.declared_topics.length === 0) {
        presentation.declared_topics = topics;
      }
    }

    events.push(event);
  }

  return [...presentations.values(), ...events];
}

/**
 * Same-origin tools linked from a tools index. The index itself is omitted.
 * @param {string} html
 * @param {string} pageUrl
 * @param {string} siteOrigin
 * @param {string} observedAt
 * @returns {Array<Record<string, unknown>>}
 */
function toolsFromHtml(html, pageUrl, siteOrigin, observedAt) {
  const $ = loadHtml(html);
  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  const seen = new Set();

  for (const element of peerBlocks($)) {
    const anchor = $(element).find("a[href]").first();
    const href = absoluteHttpUrl(anchor.attr("href") || "", pageUrl);
    const title = collapse(anchor.text());

    if (!href || !title || title.length < 2 || !href.startsWith(siteOrigin)) {
      continue;
    }

    const parts = new URL(href).pathname.split("/").filter(Boolean);
    const directory = parts.length === 1 && directoryIndexRole(parts[0]) !== "";

    if (href === pageUrl || seen.has(href) || directory) {
      continue;
    }

    const summary = collapse($(element).find("p").first().text());

    seen.add(href);
    items.push({
      identity: `url:${href}`,
      url: href,
      site_origin: siteOrigin,
      title,
      summary: summary && summary !== title ? summary : "",
      content_type: "project",
      page_role: "project",
      language: null,
      categories: ["software"],
      declared_topics: [],
      source: { kind: "tool-index", page: pageUrl },
      source_feeds: [{ type: "tool-index", url: pageUrl }],
      observed_at: observedAt,
    });
  }

  return items;
}

/**
 * Same-origin speaking / tools / event-index URL candidates for a site.
 * @param {string} origin - Absolute origin.
 * @returns {string[]}
 */
export function appearanceListingCandidateUrls(origin) {
  let base;

  try {
    base = new URL(origin);
  } catch {
    return [];
  }

  const root = `${base.protocol}//${base.host}`;
  /** @type {string[]} */
  const urls = [];

  for (const segment of APPEARANCE_LISTING_SEGMENTS) {
    urls.push(
      `${root}/${segment}/`,
      `${root}/${segment}`,
      `${root}/${segment}.html`,
    );
  }

  return urls;
}

/**
 * Fetches speaking / tools / event listing HTML for an origin.
 * Used when deep crawl is short-circuited (or missed those slash pages) so
 * appearances still refresh on every sync without waiting for feed/sitemap churn.
 * @param {string} origin
 * @param {{
 *   cache?: object,
 *   httpCache?: import("./fetch-cache.mjs").FetchCache,
 *   fetchText?: typeof fetchPublicText,
 *   haveModes?: Iterable<string>,
 * }} [options]
 * @returns {Promise<Array<{ url: string, html: string, lang: string }>>}
 */
export async function fetchAppearanceListingPages(origin, options = {}) {
  const fetchText =
    typeof options.fetchText === "function"
      ? options.fetchText
      : fetchPublicText;
  /** @type {Array<{ url: string, html: string, lang: string }>} */
  const pages = [];
  const seenUrls = new Set();
  const modesFound = new Set(
    [...(options.haveModes || [])].filter(
      (mode) => typeof mode === "string" && mode,
    ),
  );

  for (const candidate of appearanceListingCandidateUrls(origin)) {
    const candidateMode = listingMode(candidate);

    if (!candidateMode || modesFound.has(candidateMode)) {
      continue;
    }

    try {
      const fetched = await fetchText(candidate, {
        cache: options.cache,
        httpCache: options.httpCache,
      });
      const finalUrl = String(fetched?.url || candidate);
      const mode = listingMode(finalUrl);

      if (
        typeof fetched?.body !== "string" ||
        !fetched.body ||
        !mode ||
        seenUrls.has(finalUrl) ||
        modesFound.has(mode)
      ) {
        continue;
      }

      seenUrls.add(finalUrl);
      modesFound.add(mode);
      pages.push({
        url: finalUrl,
        html: fetched.body,
        lang: "",
      });
    } catch {
      // Try the next candidate path.
    }
  }

  return pages;
}

/**
 * Events and presentations from speaking archives and hosted event indexes.
 * Repeated talk titles share one presentation and keep one event per date.
 * @param {Array<{ url?: string, html?: string, lang?: string }>} pages
 * @param {{ siteOrigin?: string, observedAt?: string }} meta
 * @returns {{ items: Array<Record<string, unknown>> }}
 */
export function collectAppearances(pages, meta) {
  const siteOrigin = meta?.siteOrigin || "";
  const observedAt = meta?.observedAt || "";
  /** @type {Array<Record<string, unknown>>} */
  const items = [];

  if (!siteOrigin) {
    return { items };
  }

  for (const page of Array.isArray(pages) ? pages : []) {
    if (!page || typeof page.html !== "string" || !page.html || !page.url) {
      continue;
    }

    const mode = listingMode(page.url);

    if (mode !== "presented" && mode !== "hosted") {
      continue;
    }

    const pageLang = collapse(page.lang || "");

    for (const item of appearancesFromHtml(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
      mode,
    )) {
      if (pageLang && !item.language) {
        item.language = pageLang;
      }

      items.push(item);
    }
  }

  return { items };
}

/**
 * Software entries from `/tools/` indexes. Directory pages are not returned.
 * @param {Array<{ url?: string, html?: string, lang?: string }>} pages
 * @param {{ siteOrigin?: string, observedAt?: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function projectsFromToolIndexes(pages, meta) {
  const siteOrigin = meta?.siteOrigin || "";
  const observedAt = meta?.observedAt || "";
  /** @type {Array<Record<string, unknown>>} */
  const items = [];

  if (!siteOrigin) {
    return items;
  }

  for (const page of Array.isArray(pages) ? pages : []) {
    if (!page || typeof page.html !== "string" || !page.html || !page.url) {
      continue;
    }

    if (listingMode(page.url) !== "tools") {
      continue;
    }

    const pageLang = collapse(page.lang || "");

    for (const item of toolsFromHtml(
      page.html,
      page.url,
      siteOrigin,
      observedAt,
    )) {
      if (pageLang && !item.language) {
        item.language = pageLang;
      }

      items.push(item);
    }
  }

  return items;
}
