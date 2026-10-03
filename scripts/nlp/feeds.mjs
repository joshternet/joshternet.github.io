/**
 * Goal & Constraints:
 * Parse advertised feed entry categories/tags into subject signals. One broken
 * feed must not fail the sync.
 */

import { buildTopicEvidence } from "./evidence.mjs";
import { slugifyTopic, fetchPublicText, normalizeText } from "./lib.mjs";
import { decodeHtmlEntities } from "./text.mjs";

/**
 * @param {string} xml
 * @param {{ observedAt?: string }} [options]
 * @returns {Array<{slug: string, label: string, sources: string[], pages: Array<{url: string, title: string}>}>}
 */
export function subjectsFromRssOrAtom(xml, options = {}) {
  /** @type {Map<string, {label: string, pages: Map<string, string>}>} */
  const bySlug = new Map();
  const itemPattern = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi;
  let item;

  while ((item = itemPattern.exec(xml))) {
    const block = item[0];
    const linkMatch =
      block.match(/<link[^>]*href=["']([^"']+)["']/i) ||
      block.match(/<link>([^<]+)<\/link>/i);
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const url = normalizeText(linkMatch?.[1] || "");
    const title = normalizeText(
      (titleMatch?.[1] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"),
    );
    const categoryPattern =
      /<category[^>]*(?:term=["']([^"']+)["'])?[^>]*>([^<]*)<\/category>|<category[^>]*term=["']([^"']+)["'][^>]*\/?>/gi;
    let category;

    while ((category = categoryPattern.exec(block))) {
      const label = normalizeText(
        category[1] || category[3] || category[2] || "",
      );
      const slug = slugifyTopic(label);

      if (!slug) {
        continue;
      }

      const entry = bySlug.get(slug) || {
        label,
        pages: new Map(),
      };

      if (url) {
        entry.pages.set(url, title);
      }

      bySlug.set(slug, entry);
    }
  }

  const isAtom = /<feed[\s>]|<entry[\s>]/i.test(xml);
  const source = isAtom ? "atom:category" : "rss:category";

  return [...bySlug.entries()].map(([slug, entry]) => {
    const pages = [...entry.pages.entries()]
      .slice(0, 5)
      .map(([url, title]) => ({ url, title }));
    const evidence = pages
      .map((page) =>
        buildTopicEvidence({
          rawValue: decodeHtmlEntities(entry.label),
          source,
          page: page.url,
          evidenceClass: "declared",
          communityEligible: true,
          observedAt: options.observedAt,
        }),
      )
      .filter(Boolean);

    return {
      slug,
      label: entry.label,
      sources: ["feed", source],
      pages,
      evidence_class: "declared",
      community_eligible: true,
      evidence,
    };
  });
}

/**
 * @param {string} jsonText
 * @param {{ observedAt?: string }} [options]
 * @returns {Array<{slug: string, label: string, sources: string[], pages: Array<{url: string, title: string}>}>}
 */
export function subjectsFromJsonFeed(jsonText, options = {}) {
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  /** @type {Map<string, {label: string, pages: Map<string, string>}>} */
  const bySlug = new Map();
  const items = Array.isArray(parsed?.items) ? parsed.items : [];

  for (const item of items) {
    const url = typeof item?.url === "string" ? item.url : "";
    const title = typeof item?.title === "string" ? item.title : "";
    const tags = Array.isArray(item?.tags) ? item.tags : [];

    for (const tag of tags) {
      if (typeof tag !== "string") {
        continue;
      }

      const label = normalizeText(tag);
      const slug = slugifyTopic(label);

      if (!slug) {
        continue;
      }

      const entry = bySlug.get(slug) || { label, pages: new Map() };

      if (url) {
        entry.pages.set(url, title);
      }

      bySlug.set(slug, entry);
    }
  }

  return [...bySlug.entries()].map(([slug, entry]) => {
    const pages = [...entry.pages.entries()]
      .slice(0, 5)
      .map(([pageUrl, pageTitle]) => ({ url: pageUrl, title: pageTitle }));
    const evidence = pages
      .map((page) =>
        buildTopicEvidence({
          rawValue: decodeHtmlEntities(entry.label),
          source: "json-feed:tag",
          page: page.url,
          evidenceClass: "declared",
          communityEligible: true,
          observedAt: options.observedAt,
        }),
      )
      .filter(Boolean);

    return {
      slug,
      label: entry.label,
      sources: ["feed", "json-feed:tag"],
      pages,
      evidence_class: "declared",
      community_eligible: true,
      evidence,
    };
  });
}

/**
 * @param {Array<{url: string, type?: string}>} feeds
 * @param {Map<string, unknown>} [cache]
 * @param {{ observedAt?: string }} [options]
 * @returns {Promise<{subjects: Array<{slug: string, label: string, sources: string[], pages: Array<{url: string, title: string}>}>, entryUrls: string[]}>}
 */
export async function subjectsFromFeeds(
  feeds,
  cache = new Map(),
  options = {},
) {
  const subjects = [];
  const entryUrls = [];

  if (!Array.isArray(feeds)) {
    return { subjects, entryUrls };
  }

  for (const feed of feeds.slice(0, 3)) {
    if (!feed || typeof feed.url !== "string") {
      continue;
    }

    try {
      const fetched = await fetchPublicText(feed.url, {
        cache,
        accept:
          "application/rss+xml,application/atom+xml,application/feed+json,application/json,application/xml,text/xml,*/*;q=0.8",
      });
      const type = feed.type || fetched.contentType;
      let parsed = [];

      if (/json/i.test(type) || fetched.body.trim().startsWith("{")) {
        parsed = subjectsFromJsonFeed(fetched.body, options);

        try {
          const json = JSON.parse(fetched.body);

          for (const item of Array.isArray(json.items) ? json.items : []) {
            if (typeof item?.url === "string" && /^https?:/i.test(item.url)) {
              entryUrls.push(item.url);
            }
          }
        } catch {
          // ignore
        }
      } else {
        parsed = subjectsFromRssOrAtom(fetched.body, options);
        const linkPattern = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi;
        let block;

        while ((block = linkPattern.exec(fetched.body))) {
          const linkMatch =
            block[0].match(/<link[^>]*href=["']([^"']+)["']/i) ||
            block[0].match(/<link>([^<]+)<\/link>/i);

          if (linkMatch?.[1]) {
            const href = normalizeText(linkMatch[1]);

            if (/^https?:/i.test(href)) {
              entryUrls.push(href);
            }
          }
        }
      }

      subjects.push(...parsed);
    } catch {
      continue;
    }
  }

  return { subjects, entryUrls: entryUrls.slice(0, 80) };
}
