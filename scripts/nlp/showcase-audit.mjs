/**
 * Goal & Constraints:
 * Read-only Showcase attribution audit over generated `_data` files.
 * Fails closed on empty appearance titles, hash-stripped URL doubles in
 * Showcase, and education events that share a title with a presentation.
 * Never writes or patches dataset files.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import { isEmptyAppearanceTitle } from "./appearance-title.mjs";
import { readJSONIfExists } from "./lib.mjs";
import { decodeCrawlValue } from "./site-record.mjs";
import {
  isMadeContentItem,
  isPastEducationShowcaseEvent,
} from "../views/lib.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));

/**
 * @param {unknown} url
 * @returns {string}
 */
function hashStrippedUrl(url) {
  if (typeof url !== "string" || !url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url.split("#")[0] || "";
  }
}

/**
 * @param {unknown} title
 * @returns {string}
 */
function normTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a Showcase attribution report from decoded content + showcase docs.
 * @param {{ content?: unknown, showcase?: unknown, now?: Date }} input
 * @returns {{
 *   ok: boolean,
 *   errors: string[],
 *   metrics: Record<string, number>,
 *   findings: Record<string, unknown[]>
 * }}
 */
export function showcaseAttributionReport(input = {}) {
  const contentDoc =
    input.content && typeof input.content === "object" ? input.content : {};
  const showcaseDoc =
    input.showcase && typeof input.showcase === "object" ? input.showcase : {};
  const contentItems = Array.isArray(
    /** @type {{ items?: unknown }} */ (contentDoc).items,
  )
    ? /** @type {{ items: unknown[] }} */ (contentDoc).items
    : [];
  const showcaseItems = Array.isArray(
    /** @type {{ items?: unknown }} */ (showcaseDoc).items,
  )
    ? /** @type {{ items: unknown[] }} */ (showcaseDoc).items
    : [];
  const now = input.now instanceof Date ? input.now : new Date();
  /** @type {string[]} */
  const errors = [];
  /** @type {unknown[]} */
  const badTitles = [];
  /** @type {unknown[]} */
  const hashUrlDoubles = [];
  /** @type {unknown[]} */
  const eventPresentationPairs = [];

  for (const raw of showcaseItems) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const item = /** @type {Record<string, unknown>} */ (raw);
    const type = String(item.content_type || "");

    // Year photo albums titled "2026" are valid; only speaking rows use this hygiene.
    if (type !== "presentation" && type !== "event") {
      continue;
    }

    if (isEmptyAppearanceTitle(item.title)) {
      badTitles.push({
        title: item.title,
        identity: item.identity,
        url: item.url,
        site_origin: item.site_origin,
        content_type: type,
      });
    }
  }

  for (const raw of contentItems) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const item = /** @type {Record<string, unknown>} */ (raw);
    const type = String(item.content_type || "");

    if (type !== "presentation" && type !== "event") {
      continue;
    }

    if (!isEmptyAppearanceTitle(item.title)) {
      continue;
    }

    if (!isMadeContentItem(item, { now })) {
      continue;
    }

    badTitles.push({
      title: item.title,
      identity: item.identity,
      url: item.url,
      site_origin: item.site_origin,
      content_type: type,
    });
  }

  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const byOriginUrl = new Map();

  for (const raw of showcaseItems) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const item = /** @type {Record<string, unknown>} */ (raw);
    const origin = String(item.site_origin || "");
    const keyUrl = hashStrippedUrl(item.url);

    if (!origin || !keyUrl) {
      continue;
    }

    const key = `${origin}\0${keyUrl}`;
    const list = byOriginUrl.get(key) || [];
    list.push(item);
    byOriginUrl.set(key, list);
  }

  for (const [key, items] of byOriginUrl) {
    // Only url: identity twins (creative #gallery vs OG). Presentation/event
    // rows intentionally share speaking-archive indexes.
    const urlIdentityItems = items.filter((item) =>
      String(item.identity || "").startsWith("url:"),
    );
    const identities = new Set(
      urlIdentityItems.map((item) => String(item.identity || "")),
    );

    if (identities.size < 2) {
      continue;
    }

    const [, url] = key.split("\0");
    hashUrlDoubles.push({
      url,
      site_origin: items[0]?.site_origin,
      identities: [...identities],
      titles: urlIdentityItems.map((item) => item.title),
    });
  }

  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const byOriginTitle = new Map();

  for (const raw of showcaseItems) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const item = /** @type {Record<string, unknown>} */ (raw);
    const type = String(item.content_type || "");

    if (type !== "event" && type !== "presentation") {
      continue;
    }

    const titleKey = normTitle(item.title);
    const origin = String(item.site_origin || "");

    if (!origin || !titleKey) {
      continue;
    }

    const key = `${origin}\0${titleKey}`;
    const list = byOriginTitle.get(key) || [];
    list.push(item);
    byOriginTitle.set(key, list);
  }

  for (const [key, items] of byOriginTitle) {
    const types = new Set(items.map((item) => String(item.content_type || "")));

    if (!types.has("event") || !types.has("presentation")) {
      continue;
    }

    const educationEvent = items.find(
      (item) =>
        String(item.content_type) === "event" &&
        isPastEducationShowcaseEvent(item, now),
    );

    if (!educationEvent) {
      continue;
    }

    eventPresentationPairs.push({
      key,
      titles: items.map((item) => item.title),
      identities: items.map((item) => item.identity),
    });
  }

  if (badTitles.length > 0) {
    errors.push(
      `empty or chrome appearance titles in Showcase-eligible rows: ${badTitles.length}`,
    );
  }

  if (hashUrlDoubles.length > 0) {
    errors.push(
      `Showcase hash-stripped URL doubles (multiple identities): ${hashUrlDoubles.length}`,
    );
  }

  if (eventPresentationPairs.length > 0) {
    errors.push(
      `Showcase education event + presentation title pairs: ${eventPresentationPairs.length}`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    metrics: {
      content_items: contentItems.length,
      showcase_items: showcaseItems.length,
      bad_titles: badTitles.length,
      hash_url_doubles: hashUrlDoubles.length,
      event_presentation_pairs: eventPresentationPairs.length,
    },
    findings: {
      bad_titles: badTitles,
      hash_url_doubles: hashUrlDoubles,
      event_presentation_pairs: eventPresentationPairs,
    },
  };
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  const contentRaw = await readJSONIfExists(
    path.join(root, "_data/content.json"),
    {},
  );
  const showcaseRaw = await readJSONIfExists(
    path.join(root, "_data/showcase.json"),
    {},
  );
  const report = showcaseAttributionReport({
    content: decodeCrawlValue(contentRaw),
    showcase: decodeCrawlValue(showcaseRaw),
  });

  process.stdout.write(`${JSON.stringify(report.metrics)}\n`);

  if (!report.ok) {
    process.stderr.write(
      `${JSON.stringify({ errors: report.errors, findings: report.findings })}\n`,
    );
    process.exitCode = 1;
  }
}
