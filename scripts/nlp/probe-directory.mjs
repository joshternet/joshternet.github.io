/**
 * Goal: Local-only schema probe against robots-allowed joshing.you sites.
 * Not hourly CI. Does not write _data. Excluded from coverage.
 *
 * Usage: npm run nlp:probe-directory -- --limit 100 --seed 1
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { originFromHttpUrl } from "../network/blogroll.mjs";
import { assertPublicURL } from "../network/lib.mjs";
import {
  contentItemsFromJsonFeed,
  contentItemsFromRssOrAtom,
  mergeContentItems,
} from "./content.mjs";
import {
  USER_AGENT,
  fetchPublicText,
  parseHtmlDocument,
  writeJSONAtomic,
} from "./lib.mjs";
import { robotsAllowsPath } from "./robots.mjs";

const DIRECTORY_ORIGIN = "https://joshing.you";
const DEFAULT_LIMIT = 100;
const DEFAULT_SEED = 1;
const DIRECTORY_PAGES = 12;
const MAX_FEEDS_PER_ORIGIN = 2;

/**
 * @param {string[]} argv
 * @param {string} flag
 * @param {string} fallback
 * @returns {string}
 */
function flagValue(argv, flag, fallback) {
  const index = argv.indexOf(flag);

  if (index < 0 || !argv[index + 1]) {
    return fallback;
  }

  return argv[index + 1];
}

/**
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @template T
 * @param {T[]} list
 * @param {() => number} random
 * @returns {T[]}
 */
function shuffle(list, random) {
  const copy = [...list];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swap];
    copy[swap] = temp;
  }

  return copy;
}

/**
 * @param {string} html
 * @param {string} base
 * @returns {string[]}
 */
function originsFromDirectoryHtml(html, base) {
  const origins = [];
  const seen = new Set();

  for (const link of parseHtmlDocument(html).links) {
    try {
      const parsed = new URL(link.href, base);

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }

      if (
        parsed.hostname === "joshing.you" ||
        parsed.hostname === "www.joshing.you"
      ) {
        continue;
      }

      const origin = originFromHttpUrl(parsed.href);

      if (!seen.has(origin)) {
        seen.add(origin);
        origins.push(origin);
      }
    } catch {
      continue;
    }
  }

  return origins;
}

/**
 * @param {string} html
 * @param {string} origin
 * @returns {Array<{ url: string, type: string }>}
 */
function advertisedFeeds(html, origin) {
  const feeds = [];
  const seen = new Set();

  for (const link of parseHtmlDocument(html).links) {
    const rel = (link.rel || []).join(" ").toLowerCase();
    const href = String(link.href || "");

    if (
      !/\balternate\b/.test(rel) &&
      !/\.(rss|atom|xml|json)(?:$|[?#])/i.test(href) &&
      !/\/feed\b/i.test(href)
    ) {
      continue;
    }

    try {
      const url = new URL(href, origin).href;

      if (seen.has(url)) {
        continue;
      }

      seen.add(url);
      const blob = `${rel} ${href}`;
      const type = /json/i.test(blob)
        ? "json"
        : /atom/i.test(blob)
          ? "atom"
          : "rss";
      feeds.push({ url, type });
    } catch {
      continue;
    }
  }

  return feeds.slice(0, MAX_FEEDS_PER_ORIGIN);
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const argv = process.argv.slice(2);
  const limit = Math.max(
    1,
    Number.parseInt(flagValue(argv, "--limit", String(DEFAULT_LIMIT)), 10) ||
      DEFAULT_LIMIT,
  );
  const seed = Number.parseInt(
    flagValue(argv, "--seed", String(DEFAULT_SEED)),
    10,
  );
  const dnsCache = new Map();
  const listed = [];
  const listedSeen = new Set();

  for (let page = 1; page <= DIRECTORY_PAGES; page += 1) {
    const href =
      page === 1 ? `${DIRECTORY_ORIGIN}/` : `${DIRECTORY_ORIGIN}/?page=${page}`;

    try {
      const fetched = await fetchPublicText(href, { cache: dnsCache });
      const found = originsFromDirectoryHtml(fetched.body, fetched.url);
      let added = 0;

      for (const origin of found) {
        if (!listedSeen.has(origin)) {
          listedSeen.add(origin);
          listed.push(origin);
          added += 1;
        }
      }

      if (page > 1 && added === 0) {
        break;
      }
    } catch {
      continue;
    }
  }

  const allowed = [];
  let skippedRobots = 0;
  let skippedSsrf = 0;

  for (const origin of listed) {
    try {
      await assertPublicURL(origin, { cache: dnsCache });
    } catch {
      skippedSsrf += 1;
      continue;
    }

    let robotsBody = "";

    try {
      const robots = await fetchPublicText(`${origin}/robots.txt`, {
        cache: dnsCache,
        accept: "text/plain,*/*;q=0.1",
      });
      robotsBody = robots.body;
    } catch {
      robotsBody = "";
    }

    if (!robotsAllowsPath(robotsBody, "/", USER_AGENT)) {
      skippedRobots += 1;
      continue;
    }

    allowed.push(origin);
  }

  const random = mulberry32(Number.isNaN(seed) ? DEFAULT_SEED : seed);
  const sample = shuffle(allowed, random).slice(0, limit);
  const drafts = [];
  let crawled = 0;
  let skippedFetch = 0;

  for (const origin of sample) {
    try {
      const home = await fetchPublicText(`${origin}/`, { cache: dnsCache });
      const feeds = advertisedFeeds(home.body, origin);
      const now = new Date().toISOString();

      if (feeds.length === 0) {
        crawled += 1;
        continue;
      }

      for (const feed of feeds) {
        try {
          const fetched = await fetchPublicText(feed.url, {
            cache: dnsCache,
            accept:
              "application/feed+json, application/json, application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.1",
          });
          const kind = feed.type;
          const items =
            kind === "json" || fetched.contentType.includes("json")
              ? contentItemsFromJsonFeed(fetched.body, {
                  feedUrl: fetched.url,
                  siteOrigin: origin,
                  observedAt: now,
                })
              : contentItemsFromRssOrAtom(fetched.body, {
                  feedUrl: fetched.url,
                  feedKind: kind === "atom" ? "atom" : "rss",
                  siteOrigin: origin,
                  observedAt: now,
                });
          drafts.push(...items);
        } catch {
          continue;
        }
      }

      crawled += 1;
    } catch {
      skippedFetch += 1;
    }
  }

  const items = mergeContentItems(drafts);
  const document = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    item_count: items.length,
    ...(items.length > 0 ? { items } : {}),
  };
  const outPath = path.join(process.cwd(), ".tmp", "probe-content.json");
  await writeJSONAtomic(outPath, document);

  process.stdout.write(
    `listed=${listed.length} allowed=${allowed.length} sampled=${sample.length} crawled=${crawled} skipped_robots=${skippedRobots} skipped_ssrf=${skippedSsrf} skipped_fetch=${skippedFetch} items=${items.length}\n`,
  );

  if (items.length === 0) {
    process.stdout.write("no content items; schema item list omitted\n");
    return;
  }

  const schema = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "schemas", "content.schema.json"),
      "utf8",
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(document)) {
    const detail = (validate.errors || [])
      .slice(0, 5)
      .map((error) => {
        const match = /^\/items\/(\d+)/.exec(error.instancePath || "");
        const item = match ? items[Number(match[1])] : null;
        const who = item?.identity || item?.url || "?";
        return `${error.instancePath || "/"} ${error.message} (${who})`;
      })
      .join("; ");
    throw new Error(`probe content failed schema validation: ${detail}`);
  }

  process.stdout.write("probe content schema ok\n");
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack || error.message : error}\n`,
  );
  process.exitCode = 1;
});
