import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";
import sharp from "sharp";

import {
  blogrollEdges,
  buildBlogrollsDocument,
  buildJoshternetOpml,
  carryForwardBlogrollEdges,
  fetchBlogrollOpml,
  isJoshternetGeneratedOpml,
  originsFromBlogrollUrls,
  parseOpmlOutlineUrls,
  sanitizeBlogrollUrls,
  sortBlogrollEdges,
  withBlogroll,
} from "./blogroll.mjs";
import { itemsFromCollection } from "./collections.mjs";

import {
  HUB_ORIGIN,
  carryForwardConnectionEdges,
  connectionObservations,
  sortConnectionEdges,
} from "./connections.mjs";

import {
  elsewhereHostCatalog,
  sanitizeElsewhere,
  withElsewhere,
} from "./elsewhere.mjs";

import {
  assertPublicURL,
  chooseDescription,
  framePolicy,
  chooseTitle,
  partitionPublicParticipants,
  projectRegistry,
  registryParticipationFields,
  sanitizeFeeds,
  screenshotPath,
  stableSiteID,
} from "./lib.mjs";

import { extractPageMetadata } from "./metadata.mjs";
import {
  localPreviewEnabled,
  mergePreviewParticipants,
  readPreviewFile,
  simulatedParticipants,
} from "./preview.mjs";

import {
  captureIsFresh,
  fallbackEntry,
  removeOrphanScreenshots,
  withFeeds,
} from "./state.mjs";

const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/joshternet/index-data/main/registry.json";

const DEFAULT_DATA_PATH = "_data/network.json";
const DEFAULT_BLOGROLLS_PATH = "_data/blogrolls.json";
const DEFAULT_CONNECTIONS_PATH = "_data/connections.json";
const DEFAULT_OPML_PATH = "assets/network/joshternet.opml";
const DEFAULT_SCREENSHOT_ROOT = "assets/network/sites";

const NAVIGATION_TIMEOUT_MS = 20_000;
const SETTLE_TIME_MS = 1_500;
const SITE_TIMEOUT_MS = 30_000;

const registrySource = process.env.NETWORK_REGISTRY_URL || DEFAULT_REGISTRY_URL;

const refreshAll =
  process.env.NETWORK_REFRESH_ALL === "1" ||
  process.env.NETWORK_REFRESH_ALL === "true";

function nowISO() {
  return new Date().toISOString();
}

async function readJSONIfExists(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function loadRegistry(source) {
  if (source.startsWith("https://") || source.startsWith("http://")) {
    const response = await fetch(source, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Joshternet-Network-Sync",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`registry request failed with ${response.status}`);
    }

    return response.json();
  }

  const data = await fs.readFile(path.resolve(source), "utf8");

  return JSON.parse(data);
}

function existingByOrigin(entries) {
  const index = new Map();

  if (!Array.isArray(entries)) {
    return index;
  }

  for (const entry of entries) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof entry.origin === "string"
    ) {
      index.set(entry.origin, entry);
    }
  }

  return index;
}

function reportRejectedParticipants(rejected) {
  for (const { participant, error } of rejected) {
    const origin =
      participant && typeof participant.origin === "string"
        ? participant.origin
        : "<invalid origin>";

    process.stderr.write(
      `Network participant rejected before publication: ${origin}: ` +
        `${error.message}\n`,
    );
  }
}

/**
 * @param {import("playwright").Browser} browser
 * @param {{ origin: string }} participant
 * @param {{ settle?: boolean }} [options]
 * @returns {Promise<{
 *   metadata: Record<string, unknown>,
 *   headers: Record<string, string>,
 *   dnsCache: Map<string, unknown>,
 *   context: import("playwright").BrowserContext,
 *   page: import("playwright").Page,
 * }>}
 */
async function openParticipantHomepage(
  browser,
  participant,
  { settle = false } = {},
) {
  const dnsCache = new Map();

  await assertPublicURL(participant.origin, {
    cache: dnsCache,
  });

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 900,
    },
    deviceScaleFactor: 1,
    javaScriptEnabled: true,
    serviceWorkers: "block",
    ignoreHTTPSErrors: false,
    userAgent: "Joshternet-Network-Capture (+https://joshternet.org/network/)",
  });

  const page = await context.newPage();

  await page.route("**/*", async (route) => {
    const request = route.request();

    try {
      const requestURL = new URL(request.url());

      if (requestURL.protocol !== "https:" && requestURL.protocol !== "http:") {
        await route.abort("blockedbyclient");
        return;
      }

      await assertPublicURL(requestURL.href, {
        cache: dnsCache,
      });

      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });

  try {
    const response = await page.goto(participant.origin, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    if (!response) {
      throw new Error("homepage returned no main response");
    }

    await assertPublicURL(page.url(), {
      cache: dnsCache,
    });

    const headers = await response.allHeaders();

    if (settle) {
      await page.waitForTimeout(SETTLE_TIME_MS);
    }

    const metadata = await page.evaluate(
      extractPageMetadata,
      elsewhereHostCatalog(),
    );

    return {
      metadata,
      headers,
      dnsCache,
      context,
      page,
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * @param {string} sourceOrigin
 * @param {string[]} blogrollUrls
 * @param {Set<string>} participantOrigins
 * @param {Map<string, unknown>} dnsCache
 * @returns {Promise<Array<{from: string, to: string, blogroll: string}>>}
 */
async function edgesFromBlogrollAds(
  sourceOrigin,
  blogrollUrls,
  participantOrigins,
  dnsCache,
) {
  const edges = [];

  for (const blogrollUrl of blogrollUrls) {
    try {
      const opmlText = await fetchBlogrollOpml(blogrollUrl, {
        cache: dnsCache,
      });
      const outlineOrigins = originsFromBlogrollUrls(
        parseOpmlOutlineUrls(opmlText),
      );

      edges.push(
        ...blogrollEdges({
          sourceOrigin,
          blogrollUrl,
          outlineOrigins,
          participantOrigins,
        }),
      );
    } catch (error) {
      process.stderr.write(
        `blogroll fetch failed ${sourceOrigin} (${blogrollUrl}): ${error.message}\n`,
      );
    }
  }

  return edges;
}

/**
 * Stamps the page URL onto each outbound link record for connection evidence.
 * @param {unknown} links
 * @param {string} pageUrl
 * @returns {Array<{href: string, text: string, rel: string[], page: string}>}
 */
function stampLinkPages(links, pageUrl) {
  if (!Array.isArray(links) || typeof pageUrl !== "string" || !pageUrl) {
    return [];
  }

  const stamped = [];

  for (const link of links) {
    if (typeof link === "string") {
      stamped.push({
        href: link,
        text: "",
        rel: [],
        page: pageUrl,
      });
      continue;
    }

    if (!link || typeof link !== "object" || typeof link.href !== "string") {
      continue;
    }

    stamped.push({
      href: link.href,
      text: typeof link.text === "string" ? link.text : "",
      rel: Array.isArray(link.rel) ? link.rel : [],
      page: pageUrl,
    });
  }

  return stamped;
}

/**
 * Collects elsewhere links and outbound page links from homepage metadata and
 * an optional same-origin about page already fetched during enrichment.
 * @param {import("playwright").Page} page
 * @param {Record<string, unknown>} metadata
 * @param {Map<string, unknown>} dnsCache
 * @param {string} participantOrigin
 * @returns {Promise<{
 *   elsewhere: Array<{url: string, network: string, label: string}>,
 *   links: Array<{href: string, text: string, rel: string[], page: string}>,
 * }>}
 */
async function collectElsewhereAndLinks(
  page,
  metadata,
  dnsCache,
  participantOrigin,
) {
  const raw = Array.isArray(metadata.elsewhere) ? [...metadata.elsewhere] : [];
  const homepagePageUrl = page.url();
  const links = stampLinkPages(metadata.links, homepagePageUrl);
  const aboutPageHref =
    typeof metadata.aboutPageHref === "string" ? metadata.aboutPageHref : "";

  if (aboutPageHref) {
    try {
      const aboutURL = await assertPublicURL(aboutPageHref, {
        cache: dnsCache,
      });
      const participantURL = new URL(participantOrigin);

      if (aboutURL.origin === participantURL.origin) {
        const response = await page.goto(aboutURL.href, {
          waitUntil: "domcontentloaded",
          timeout: NAVIGATION_TIMEOUT_MS,
        });

        if (response) {
          await assertPublicURL(page.url(), {
            cache: dnsCache,
          });

          const aboutMetadata = await page.evaluate(
            extractPageMetadata,
            elsewhereHostCatalog(),
          );

          if (Array.isArray(aboutMetadata.elsewhere)) {
            raw.push(...aboutMetadata.elsewhere);
          }

          if (Array.isArray(aboutMetadata.links)) {
            links.push(...stampLinkPages(aboutMetadata.links, page.url()));
          }
        }
      }
    } catch (error) {
      process.stderr.write(
        `about-page elsewhere failed ${participantOrigin}: ${error.message}\n`,
      );
    }
  }

  return {
    elsewhere: await sanitizeElsewhere(raw, {
      cache: dnsCache,
    }),
    links,
  };
}

/**
 * @param {Record<string, unknown>} entry
 * @param {unknown} feeds
 * @param {unknown} blogrollUrl
 * @param {unknown} elsewhere
 * @returns {Record<string, unknown>}
 */
function withEnrichment(entry, feeds, blogrollUrl, elsewhere) {
  return withElsewhere(
    withBlogroll(withFeeds(entry, feeds), blogrollUrl),
    elsewhere,
  );
}

/**
 * Shared feeds / blogroll / elsewhere enrichment from an opened homepage.
 * @param {{
 *   metadata: Record<string, unknown>,
 *   dnsCache: Map<string, unknown>,
 *   page: import("playwright").Page,
 * }} opened
 * @param {{ origin: string }} participant
 * @param {Set<string>} participantOrigins
 * @returns {Promise<{
 *   feeds: Array<{url: string, type: string, title?: string}>,
 *   blogrollUrl: string,
 *   elsewhere: Array<{url: string, network: string, label: string}>,
 *   edges: Array<{from: string, to: string, blogroll: string}>,
 *   connections: Array<{
 *     from: string,
 *     to: string,
 *     kind: string,
 *     via: string,
 *     source: string,
 *     href: string,
 *     text: string,
 *     rel: string[],
 *     page: string,
 *   }>,
 *   links: Array<{href: string, text: string, rel: string[], page: string}>,
 * }>}
 */
async function enrichFromOpenedPage(opened, participant, participantOrigins) {
  const { metadata, dnsCache, page } = opened;
  const feeds = await sanitizeFeeds(metadata.feeds, {
    cache: dnsCache,
  });
  const blogrollUrls = await sanitizeBlogrollUrls(metadata.blogrolls, {
    cache: dnsCache,
  });
  const blogrollUrl = blogrollUrls[0] || "";
  const homepagePageUrl = page.url();
  const { elsewhere, links } = await collectElsewhereAndLinks(
    page,
    metadata,
    dnsCache,
    participant.origin,
  );
  const edges = await edgesFromBlogrollAds(
    participant.origin,
    blogrollUrls,
    participantOrigins,
    dnsCache,
  );
  const connections = connectionObservations({
    sourceOrigin: participant.origin,
    pageUrl: homepagePageUrl,
    links,
    participantOrigins,
  });

  return {
    feeds,
    blogrollUrl,
    elsewhere,
    edges,
    connections,
    links,
  };
}

async function captureParticipant(browser, participant, participantOrigins) {
  const opened = await openParticipantHomepage(browser, participant, {
    settle: true,
  });

  try {
    const { metadata, headers, page } = opened;

    const png = await page.screenshot({
      type: "png",
      fullPage: false,
      animations: "disabled",
    });

    const id = stableSiteID(participant.origin);
    const outputPath = path.join(DEFAULT_SCREENSHOT_ROOT, `${id}.webp`);

    await fs.mkdir(path.dirname(outputPath), {
      recursive: true,
    });

    await sharp(png)
      .resize(1440, 900, {
        fit: "cover",
        position: "top",
      })
      .webp({
        quality: 82,
        effort: 5,
      })
      .toFile(outputPath);

    const title = chooseTitle({
      ...metadata,
      domain: participant.domain,
    });

    const description = chooseDescription(metadata);

    const framing = framePolicy({
      origin: participant.origin,
      headers,
    });

    const enrichment = await enrichFromOpenedPage(
      opened,
      participant,
      participantOrigins,
    );

    const entry = withEnrichment(
      {
        ...registryParticipationFields(participant),
        title,
        description,
        screenshot: screenshotPath(participant.origin),
        embeddable: framing.embeddable,
        frame_reason: framing.reason,
        captured_at: nowISO(),
      },
      enrichment.feeds,
      enrichment.blogrollUrl,
      enrichment.elsewhere,
    );

    return {
      entry,
      edges: enrichment.edges,
      connections: enrichment.connections,
      links: enrichment.links,
    };
  } finally {
    await opened.context.close();
  }
}

/**
 * @param {import("playwright").Browser} browser
 * @param {{ origin: string }} participant
 * @param {Set<string>} participantOrigins
 * @returns {Promise<{
 *   feeds: Array<{url: string, type: string, title?: string}>,
 *   blogrollUrl: string,
 *   elsewhere: Array<{url: string, network: string, label: string}>,
 *   edges: Array<{from: string, to: string, blogroll: string}>,
 *   connections: Array<Record<string, unknown>>,
 *   links: Array<{href: string, text: string, rel: string[], page: string}>,
 * }>}
 */
async function discoverHomepageEnrichment(
  browser,
  participant,
  participantOrigins,
) {
  const opened = await openParticipantHomepage(browser, participant);

  try {
    return await enrichFromOpenedPage(opened, participant, participantOrigins);
  } finally {
    await opened.context.close();
  }
}

async function withTimeout(promise, timeoutMS, label) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} exceeded ${timeoutMS}ms`));
        }, timeoutMS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function shouldRefresh(previous) {
  return refreshAll || !captureIsFresh(previous);
}

async function writeJSONAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  const temporary = `${filePath}.tmp-${process.pid}`;

  await fs.mkdir(directory, {
    recursive: true,
  });

  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");

  await fs.rename(temporary, filePath);
}

async function writeTextAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  const temporary = `${filePath}.tmp-${process.pid}`;

  await fs.mkdir(directory, {
    recursive: true,
  });

  await fs.writeFile(temporary, value, "utf8");
  await fs.rename(temporary, filePath);
}

const registry = await loadRegistry(registrySource);
let projected = projectRegistry(registry);

if (localPreviewEnabled()) {
  const previewPath = path.join(process.cwd(), "_data/network_preview.json");
  const preview = await readPreviewFile(previewPath);
  const simulated = await simulatedParticipants(preview.participants, {
    fetchImpl: fetch,
  });

  for (const skipped of simulated.skipped) {
    process.stderr.write(
      `Local preview skipped ${skipped.origin}: ${skipped.reason}\n`,
    );
  }

  projected = mergePreviewParticipants(projected, simulated.participants);

  if (simulated.participants.length > 0) {
    process.stdout.write(
      `Local preview added ${simulated.participants.length} participant` +
        `${simulated.participants.length === 1 ? "" : "s"} not yet in the JoshBot registry.\n`,
    );
  }
}

const { accepted: participants, rejected } =
  await partitionPublicParticipants(projected);

reportRejectedParticipants(rejected);

const existing = await readJSONIfExists(DEFAULT_DATA_PATH, []);
const previousBlogrollEdges = itemsFromCollection(
  await readJSONIfExists(DEFAULT_BLOGROLLS_PATH, {}),
  "edges",
);
const previousConnectionEdges = itemsFromCollection(
  await readJSONIfExists(DEFAULT_CONNECTIONS_PATH, {}),
  "edges",
);

const previous = existingByOrigin(existing);
const participantOrigins = new Set(
  participants.map((participant) => participant.origin),
);

process.stdout.write(
  `Registry contains ${projected.length} participant` +
    `${projected.length === 1 ? "" : "s"}; ` +
    `${participants.length} passed the publication boundary.\n`,
);

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage"],
});

const nextEntries = [];
const nextEdges = [];
const nextConnections = [];
/** @type {Array<{origin: string, links: Array<{href: string, text: string, rel: string[], page: string}>}>} */
const originLinkBundles = [];

try {
  for (const participant of participants) {
    const oldEntry = previous.get(participant.origin);

    if (!shouldRefresh(oldEntry)) {
      const kept = {
        ...oldEntry,
        ...registryParticipationFields(participant),
        frame_reason:
          oldEntry.frame_reason ||
          (oldEntry.embeddable ? "allowed" : "unknown"),
      };

      try {
        const enrichment = await withTimeout(
          discoverHomepageEnrichment(browser, participant, participantOrigins),
          SITE_TIMEOUT_MS,
          `${participant.origin} enrichment`,
        );

        nextEntries.push(
          withEnrichment(
            kept,
            enrichment.feeds,
            enrichment.blogrollUrl,
            enrichment.elsewhere,
          ),
        );
        nextEdges.push(...enrichment.edges);
        nextConnections.push(...enrichment.connections);
        originLinkBundles.push({
          origin: participant.origin,
          links: enrichment.links,
        });
        process.stdout.write(
          `keep ${participant.origin} (feeds, blogrolls, elsewhere, and connections refreshed)\n`,
        );
      } catch (error) {
        nextEntries.push(
          withEnrichment(
            kept,
            oldEntry.feeds,
            oldEntry.blogroll,
            oldEntry.elsewhere,
          ),
        );
        nextEdges.push(
          ...carryForwardBlogrollEdges(
            previousBlogrollEdges,
            participant.origin,
          ),
        );
        nextConnections.push(
          ...carryForwardConnectionEdges(
            previousConnectionEdges,
            participant.origin,
          ),
        );
        process.stderr.write(
          `enrichment refresh failed ${participant.origin}: ${error.message}\n`,
        );
      }

      continue;
    }

    process.stdout.write(`capture ${participant.origin}\n`);

    try {
      const captured = await withTimeout(
        captureParticipant(browser, participant, participantOrigins),
        SITE_TIMEOUT_MS,
        participant.origin,
      );

      nextEntries.push(captured.entry);
      nextEdges.push(...captured.edges);
      nextConnections.push(...captured.connections);
      originLinkBundles.push({
        origin: participant.origin,
        links: captured.links || [],
      });

      process.stdout.write(`captured ${participant.origin}\n`);
    } catch (error) {
      nextEntries.push(fallbackEntry(participant, oldEntry));
      nextEdges.push(
        ...carryForwardBlogrollEdges(previousBlogrollEdges, participant.origin),
      );
      nextConnections.push(
        ...carryForwardConnectionEdges(
          previousConnectionEdges,
          participant.origin,
        ),
      );

      process.stderr.write(
        `capture failed ${participant.origin}: ` + `${error.message}\n`,
      );
    }
  }
} finally {
  await browser.close();
}

nextEntries.sort((left, right) => {
  return left.domain.localeCompare(right.domain, undefined, {
    numeric: true,
    sensitivity: "base",
  });
});

const blogrollEdgeList = sortBlogrollEdges(
  nextEdges.filter(
    (edge) => !isJoshternetGeneratedOpml(edge.blogroll, HUB_ORIGIN),
  ),
);
const blogrollsDocument = buildBlogrollsDocument({
  generatedAt: new Date().toISOString(),
  edges: blogrollEdgeList,
  entries: nextEntries,
  hubOrigin: HUB_ORIGIN,
});
const connectionEdgeList = sortConnectionEdges(
  nextConnections.filter((edge) => {
    const relation = edge.relation || edge.kind;
    return relation !== "friend" && relation !== "topic";
  }),
);
const opml = buildJoshternetOpml(nextEntries);

await removeOrphanScreenshots(nextEntries, DEFAULT_SCREENSHOT_ROOT);
await writeJSONAtomic(DEFAULT_DATA_PATH, nextEntries);
await writeJSONAtomic(DEFAULT_BLOGROLLS_PATH, blogrollsDocument);
await writeTextAtomic(DEFAULT_OPML_PATH, opml);

process.stdout.write(
  `Wrote ${nextEntries.length} network entr` +
    `${nextEntries.length === 1 ? "y" : "ies"}, ` +
    `${blogrollEdgeList.length} publisher blogroll edge` +
    `${blogrollEdgeList.length === 1 ? "" : "s"}, ` +
    `${connectionEdgeList.length} homepage connection observation` +
    `${connectionEdgeList.length === 1 ? "" : "s"} (connections.json is published by nlp:sync), and joshternet.opml.\n`,
);
