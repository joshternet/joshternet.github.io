/**
 * Goal: Local-only schema probe against a sample of robots-allowed member
 * sites listed on joshing.you. Not hourly CI. Does not write _data.
 *
 * Usage: npm run nlp:probe-directory -- --limit 100 --seed 1
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { assertPublicURL } from "../network/lib.mjs";
import {
  contentItemsFromJsonFeed,
  contentItemsFromRssOrAtom,
  mergeContentItems,
} from "./content.mjs";
import {
  DIRECTORY_ORIGIN,
  FEED_ACCEPT,
  MAX_DIRECTORY_PAGES,
  accumulateListedOrigins,
  advertisedFeeds,
  directoryPageUrls,
  flagValue,
  mulberry32,
  shuffle,
} from "./directory.mjs";
import { USER_AGENT, fetchPublicText, writeJSONAtomic } from "./lib.mjs";
import { robotsAllowsPath } from "./robots.mjs";

const DEFAULT_LIMIT = 100;
const DEFAULT_SEED = 1;

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
  let listed = [];

  for (let page = 1; page <= MAX_DIRECTORY_PAGES; page += 1) {
    let added = 0;

    for (const href of directoryPageUrls(page)) {
      try {
        const fetched = await fetchPublicText(href, { cache: dnsCache });
        const next = accumulateListedOrigins(
          listed,
          fetched.body,
          fetched.url || DIRECTORY_ORIGIN,
        );
        listed = next.origins;
        added += next.added;
      } catch {
        continue;
      }
    }

    if (page > 1 && added === 0) {
      break;
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
            accept: FEED_ACCEPT,
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
