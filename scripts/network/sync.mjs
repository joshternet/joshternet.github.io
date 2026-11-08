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
  buildHomepageConnectionsDocument,
  carryForwardConnectionEdges,
  connectionObservations,
  sortConnectionEdges,
} from "./connections.mjs";

import {
  elsewhereHostCatalog,
  resolveParticipantTitle,
  sanitizeElsewhere,
  withElsewhere,
} from "./elsewhere.mjs";

import {
  assertPublicURL,
  chooseDescription,
  displayTitleOverridesFromDocument,
  framePolicy,
  networkDescriptionQuality,
  partitionPublicParticipants,
  projectRegistry,
  registryParticipationFields,
  sanitizeFeeds,
  screenshotPath,
  selectPublishedNetworkTitle,
  stableSiteID,
} from "./lib.mjs";

import { extractPageMetadata } from "./metadata.mjs";
import {
  isAboutDescriptionPath,
  slashPageAllowsHostElsewhere,
} from "./slash-page-catalog.mjs";
import {
  localPreviewEnabled,
  mergePreviewParticipants,
  readPreviewFile,
  simulatedParticipants,
} from "./preview.mjs";
import {
  LOCAL_NONJOSHTERNET_INTAKE_LIMIT,
  devCacheEnabled,
  devCacheRoot,
  localDevCacheParticipants,
  readLocalIntakeOrigins,
} from "../uses/dev-cache.mjs";
import { installPublicUrlRouteGuard } from "./public-fetch-guard.mjs";

import {
  fallbackEntry,
  needsScreenshotCapture,
  removeOrphanScreenshots,
  withFeeds,
} from "./state.mjs";
import { IDENTITY_SLASH_PATHS } from "./slash-pages.mjs";
import {
  enrichmentBudgetExhausted,
  runWithEnrichmentBudget,
  visitIdentityPages,
} from "./enrichment-budget.mjs";
import { formatGeneratedOutputs } from "../format-written.mjs";
import { writeJSONAtomic, writeTextAtomic } from "../nlp/lib.mjs";
import { USER_AGENT } from "../nlp/lib.mjs";
import { createOriginRobotsGate } from "../nlp/origin-robots.mjs";
import { probeCommonFeedPaths } from "./feed-probes.mjs";
import {
  navigateAndSettle,
  PAGE_NAV_SETTLE_MS,
  settlePage,
} from "./page-navigation.mjs";

const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/joshternet/index-data/main/registry.json";

const DEFAULT_DATA_PATH = "_data/network.json";
const DEFAULT_DISPLAY_TITLES_PATH = "_data/network_display_titles.json";
const DEFAULT_BLOGROLLS_PATH = "_data/blogrolls.json";
const DEFAULT_CONNECTIONS_PATH = "_data/connections.json";
const DEFAULT_HOMEPAGE_CONNECTIONS_PATH = "_data/homepage_connections.json";
const DEFAULT_OPML_PATH = "assets/network/joshternet.opml";
const DEFAULT_SCREENSHOT_ROOT = "assets/network/sites";

const NAVIGATION_TIMEOUT_MS = 20_000;
const SETTLE_TIME_MS = PAGE_NAV_SETTLE_MS;
/** Soft enrichment budget — long enough for settled identity slash probes. */
const SITE_TIMEOUT_MS = 90_000;
/** Uncapped identity slash page visits per participant during network enrichment. */
const MAX_IDENTITY_PAGES = Number.POSITIVE_INFINITY;

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
        "User-Agent": USER_AGENT,
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
 *   robotsGate: import("../nlp/origin-robots.mjs").OriginRobotsGate,
 * }>}
 */
async function openParticipantHomepage(
  browser,
  participant,
  { settle = false, robotsGate } = {},
) {
  const dnsCache = new Map();
  const gate =
    robotsGate ||
    createOriginRobotsGate({
      cache: dnsCache,
      userAgent: USER_AGENT,
    });

  await assertPublicURL(participant.origin, {
    cache: dnsCache,
  });

  if (!(await gate.allows(participant.origin))) {
    throw new Error(`robots.txt disallows ${participant.origin}`);
  }

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 900,
    },
    deviceScaleFactor: 1,
    javaScriptEnabled: true,
    serviceWorkers: "block",
    ignoreHTTPSErrors: false,
    userAgent: USER_AGENT,
  });

  const page = await context.newPage();

  await installPublicUrlRouteGuard(page, { cache: dnsCache });

  try {
    const response = await page.goto(participant.origin, {
      waitUntil: "load",
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
      await settlePage(page, {
        timeoutMs: NAVIGATION_TIMEOUT_MS,
        settleMs: SETTLE_TIME_MS,
      });
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
      robotsGate: gate,
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
  robotsGate,
) {
  const edges = [];
  const gate =
    robotsGate ||
    createOriginRobotsGate({
      cache: dnsCache,
      userAgent: USER_AGENT,
    });

  for (const blogrollUrl of blogrollUrls) {
    try {
      const opmlText = await fetchBlogrollOpml(blogrollUrl, {
        cache: dnsCache,
        robotsGate: gate,
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
 * Ordered same-origin identity slash pages to visit for elsewhere + link edges.
 * Prefer homepage-discovered hrefs, then conventional indieweb slash seeds.
 * @param {Record<string, unknown>} metadata
 * @param {string} participantOrigin
 * @returns {string[]}
 */
function identityPagesToVisit(metadata, participantOrigin) {
  const seen = new Set();
  /** @type {string[]} */
  const ordered = [];

  /**
   * @param {string} href
   */
  function push(href) {
    if (typeof href !== "string" || !href) {
      return;
    }

    let absolute = "";

    try {
      absolute = new URL(href, participantOrigin).href;
    } catch {
      return;
    }

    try {
      if (new URL(absolute).origin !== new URL(participantOrigin).origin) {
        return;
      }
    } catch {
      return;
    }

    if (seen.has(absolute)) {
      return;
    }

    seen.add(absolute);
    ordered.push(absolute);
  }

  if (Array.isArray(metadata.aboutPageHrefs)) {
    for (const href of metadata.aboutPageHrefs) {
      push(typeof href === "string" ? href : "");
    }
  }

  if (typeof metadata.aboutPageHref === "string") {
    push(metadata.aboutPageHref);
  }

  for (const path of IDENTITY_SLASH_PATHS) {
    push(path);
  }

  return ordered.slice(0, MAX_IDENTITY_PAGES);
}

/**
 * Collects elsewhere links and outbound page links from homepage metadata and
 * same-origin identity slash pages (about, now, uses, more, site, …).
 * @param {import("playwright").Page} page
 * @param {Record<string, unknown>} metadata
 * @param {Map<string, unknown>} dnsCache
 * @param {string} participantOrigin
 * @param {AbortSignal | undefined} signal - Enrichment budget; stops probes when aborted.
 * @returns {Promise<{
 *   elsewhere: Array<{url: string, network: string, label: string}>,
 *   links: Array<{href: string, text: string, rel: string[], page: string}>,
 *   aboutDescription: string,
 * }>}
 */
async function collectElsewhereAndLinks(
  page,
  metadata,
  dnsCache,
  participantOrigin,
  signal,
  robotsGate,
) {
  const raw = Array.isArray(metadata.elsewhere) ? [...metadata.elsewhere] : [];
  const homepagePageUrl = page.url();
  const links = stampLinkPages(metadata.links, homepagePageUrl);
  const gate =
    robotsGate ||
    createOriginRobotsGate({
      cache: dnsCache,
      userAgent: USER_AGENT,
    });
  /** @type {string} */
  let aboutDescription = "";
  let aboutScore = -1;

  await visitIdentityPages(
    identityPagesToVisit(metadata, participantOrigin),
    async (identityHref, visitSignal) => {
      if (enrichmentBudgetExhausted(visitSignal)) {
        return;
      }

      const identityURL = await assertPublicURL(identityHref, {
        cache: dnsCache,
      });

      if (!(await gate.allows(identityURL.href))) {
        return;
      }

      // Abort between pages, not mid-goto — mid-flight abort races the next URL.
      const response = await navigateAndSettle(page, identityURL.href, {
        timeoutMs: NAVIGATION_TIMEOUT_MS,
        settleMs: SETTLE_TIME_MS,
        signal: visitSignal,
      });

      if (enrichmentBudgetExhausted(visitSignal)) {
        return;
      }

      if (response && typeof response.ok === "function" && !response.ok()) {
        return;
      }

      await assertPublicURL(page.url(), {
        cache: dnsCache,
      });

      const identityMetadata = await page.evaluate(
        extractPageMetadata,
        elsewhereHostCatalog(),
      );

      let identityPath = "";

      try {
        identityPath = new URL(page.url()).pathname;
      } catch {
        identityPath = "";
      }

      const allowHostElsewhere = slashPageAllowsHostElsewhere(identityPath);

      if (Array.isArray(identityMetadata.elsewhere)) {
        for (const entry of identityMetadata.elsewhere) {
          if (
            allowHostElsewhere ||
            (entry && typeof entry === "object" && entry.me === true)
          ) {
            raw.push(entry);
          }
        }
      }

      if (Array.isArray(identityMetadata.links)) {
        links.push(...stampLinkPages(identityMetadata.links, page.url()));
      }

      // Only about/profile pages contribute blurbs — not friends/hello/uses.
      if (isAboutDescriptionPath(identityPath)) {
        const pageBlurb = chooseDescription({
          description:
            typeof identityMetadata.description === "string"
              ? identityMetadata.description
              : "",
          ogDescription:
            typeof identityMetadata.ogDescription === "string"
              ? identityMetadata.ogDescription
              : "",
          twitterDescription:
            typeof identityMetadata.twitterDescription === "string"
              ? identityMetadata.twitterDescription
              : "",
          jsonLdDescription:
            typeof identityMetadata.jsonLdDescription === "string"
              ? identityMetadata.jsonLdDescription
              : "",
          mainDescription:
            typeof identityMetadata.mainDescription === "string"
              ? identityMetadata.mainDescription
              : "",
        });
        const pageScore = networkDescriptionQuality(pageBlurb);

        if (pageScore > aboutScore) {
          aboutDescription = pageBlurb;
          aboutScore = pageScore;
        }
      }
    },
    {
      signal,
      onVisitError(identityHref, error) {
        process.stderr.write(
          `identity-page elsewhere failed ${participantOrigin} (${identityHref}): ${error.message}\n`,
        );
      },
    },
  );

  return {
    elsewhere: await sanitizeElsewhere(raw, {
      cache: dnsCache,
      participantOrigin,
    }),
    links,
    aboutDescription,
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
 * @param {AbortSignal | undefined} signal - Enrichment budget signal.
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
 *   metadata: Record<string, unknown>,
 * }>}
 */
async function enrichFromOpenedPage(
  opened,
  participant,
  participantOrigins,
  signal,
) {
  const { metadata, dnsCache, page, robotsGate } = opened;
  const advertisedFeeds = await sanitizeFeeds(metadata.feeds, {
    cache: dnsCache,
  });
  const feeds = await probeCommonFeedPaths(
    participant.origin,
    advertisedFeeds,
    { cache: dnsCache, robotsGate },
  );
  const blogrollUrls = await sanitizeBlogrollUrls(metadata.blogrolls, {
    cache: dnsCache,
  });
  const blogrollUrl = blogrollUrls[0] || "";
  const homepagePageUrl = page.url();
  const { elsewhere, links, aboutDescription } = await collectElsewhereAndLinks(
    page,
    metadata,
    dnsCache,
    participant.origin,
    signal,
    robotsGate,
  );
  const edges = await edgesFromBlogrollAds(
    participant.origin,
    blogrollUrls,
    participantOrigins,
    dnsCache,
    robotsGate,
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
    metadata: {
      ...metadata,
      elsewhere,
      aboutDescription,
    },
  };
}

/**
 * @param {import("playwright").Browser} browser
 * @param {{ origin: string, domain: string }} participant
 * @param {Set<string>} participantOrigins
 * @param {AbortSignal | undefined} signal
 * @param {{ previousTitle?: string, titleOverride?: string }} [publish]
 */
async function captureParticipant(
  browser,
  participant,
  participantOrigins,
  signal,
  publish = {},
) {
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

    const written = await fs.stat(outputPath);

    if (!written.isFile() || written.size <= 0) {
      throw new Error(
        `screenshot write produced empty file for ${participant.origin}`,
      );
    }

    const framing = framePolicy({
      origin: participant.origin,
      headers,
    });

    const enrichment = await enrichFromOpenedPage(
      opened,
      participant,
      participantOrigins,
      signal,
    );
    const title = selectPublishedNetworkTitle({
      resolved: await resolveParticipantTitle(
        enrichment.metadata,
        participant.domain,
      ),
      previous:
        typeof publish.previousTitle === "string" ? publish.previousTitle : "",
      domain: participant.domain,
      override:
        typeof publish.titleOverride === "string" ? publish.titleOverride : "",
    });
    const description = chooseDescription(enrichment.metadata);

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
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<{
 *   feeds: Array<{url: string, type: string, title?: string}>,
 *   blogrollUrl: string,
 *   elsewhere: Array<{url: string, network: string, label: string}>,
 *   edges: Array<{from: string, to: string, blogroll: string}>,
 *   connections: Array<Record<string, unknown>>,
 *   links: Array<{href: string, text: string, rel: string[], page: string}>,
 *   metadata: Record<string, unknown>,
 * }>}
 */
async function discoverHomepageEnrichment(
  browser,
  participant,
  participantOrigins,
  signal,
) {
  const opened = await openParticipantHomepage(browser, participant);

  try {
    return await enrichFromOpenedPage(
      opened,
      participant,
      participantOrigins,
      signal,
    );
  } finally {
    await opened.context.close();
  }
}

/**
 * Whether this participant needs a new homepage screenshot this sync.
 * Scheduled runs leave NETWORK_REFRESH_ALL false; missing WebPs still refresh.
 * @param {{ captured_at?: string, screenshot?: string } | null | undefined} previous
 * @returns {Promise<boolean>}
 */
async function shouldRefresh(previous) {
  if (refreshAll || !previous) {
    return true;
  }

  return needsScreenshotCapture(previous);
}

const registry = await loadRegistry(registrySource);
let projected = projectRegistry(registry);

/** @type {Set<string>} Origins from the local cache (not the Joshternet registry). */
const devCacheOrigins = new Set();
/** @type {Set<string>} Orphan local-only rows kept when the cache no longer lists them. */
const carriedLocalDevCacheOrigins = new Set();

const existing = await readJSONIfExists(DEFAULT_DATA_PATH, []);

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
  const cachedSites = await localDevCacheParticipants(
    devCacheRoot(process.cwd()),
    devCacheEnabled(),
  );
  const intakeListed = new Set(
    await readLocalIntakeOrigins(devCacheRoot(process.cwd())),
  );
  let newIntakeCount = 0;
  for (const site of cachedSites) {
    if (projected.some((entry) => entry && entry.origin === site.origin)) {
      continue;
    }
    projected = mergePreviewParticipants(projected, [site]);
    devCacheOrigins.add(site.origin);
    if (intakeListed.has(site.origin)) {
      newIntakeCount += 1;
    }
  }

  if (simulated.participants.length > 0) {
    process.stdout.write(
      `Local preview added ${simulated.participants.length} participant` +
        `${simulated.participants.length === 1 ? "" : "s"} not yet in the JoshBot registry.\n`,
    );
  }
  if (devCacheOrigins.size > 0) {
    process.stdout.write(
      `Local dev cache syncing ${devCacheOrigins.size} personal site` +
        `${devCacheOrigins.size === 1 ? "" : "s"}` +
        `${
          newIntakeCount > 0
            ? ` (${newIntakeCount} new this run, limit ${LOCAL_NONJOSHTERNET_INTAKE_LIMIT})`
            : ""
        }.\n`,
    );
  }
}

const { accepted: participants, rejected } =
  await partitionPublicParticipants(projected);

reportRejectedParticipants(rejected);
const displayTitleOverrides = displayTitleOverridesFromDocument(
  await readJSONIfExists(DEFAULT_DISPLAY_TITLES_PATH, {}),
);
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

    if (!(await shouldRefresh(oldEntry))) {
      const kept = {
        ...oldEntry,
        ...registryParticipationFields(participant),
        frame_reason:
          oldEntry.frame_reason ||
          (oldEntry.embeddable ? "allowed" : "unknown"),
      };

      try {
        const enrichment = await runWithEnrichmentBudget(
          (signal) =>
            discoverHomepageEnrichment(
              browser,
              participant,
              participantOrigins,
              signal,
            ),
          SITE_TIMEOUT_MS,
          `${participant.origin} enrichment`,
        );
        // Re-resolve titles on every sync so algorithm changes and new
        // author/GitHub signals apply without waiting for screenshot expiry.
        // Curated overrides + sticky person names keep rebuilds from
        // downgrading published cards (e.g. Chris Minnick, Joshua Stübner).
        const title = selectPublishedNetworkTitle({
          resolved: await resolveParticipantTitle(
            enrichment.metadata,
            participant.domain,
          ),
          previous: typeof kept.title === "string" ? kept.title : "",
          domain: participant.domain,
          override: displayTitleOverrides.get(participant.origin) || "",
        });

        const description =
          chooseDescription(enrichment.metadata) || kept.description || "";

        nextEntries.push(
          withEnrichment(
            {
              ...kept,
              title,
              description,
            },
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
          `keep ${participant.origin} (title, feeds, blogrolls, elsewhere, and connections refreshed)\n`,
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
      const captured = await runWithEnrichmentBudget(
        (signal) =>
          captureParticipant(browser, participant, participantOrigins, signal, {
            previousTitle:
              typeof oldEntry?.title === "string" ? oldEntry.title : "",
            titleOverride: displayTitleOverrides.get(participant.origin) || "",
          }),
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

const capturedOrigins = new Set(nextEntries.map((entry) => entry.origin));
for (const entry of existing) {
  if (
    !entry ||
    entry.local_dev_cache !== true ||
    typeof entry.origin !== "string" ||
    !entry.origin ||
    capturedOrigins.has(entry.origin)
  ) {
    continue;
  }
  if (participants.some((participant) => participant.origin === entry.origin)) {
    continue;
  }
  nextEntries.push({ ...entry, local_dev_cache: true });
  carriedLocalDevCacheOrigins.add(entry.origin);
  capturedOrigins.add(entry.origin);
}

for (const entry of nextEntries) {
  if (
    devCacheOrigins.has(entry.origin) ||
    carriedLocalDevCacheOrigins.has(entry.origin) ||
    entry.local_dev_cache === true
  ) {
    entry.local_dev_cache = true;
  }
}

if (carriedLocalDevCacheOrigins.size > 0) {
  process.stdout.write(
    `Local dev cache kept ${carriedLocalDevCacheOrigins.size} prior personal site` +
      `${carriedLocalDevCacheOrigins.size === 1 ? "" : "s"} missing from the Uses cache.\n`,
  );
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
const homepageConnectionsDocument = buildHomepageConnectionsDocument({
  generatedAt: new Date().toISOString(),
  edges: connectionEdgeList,
});
const opml = buildJoshternetOpml(nextEntries);

await removeOrphanScreenshots(nextEntries, DEFAULT_SCREENSHOT_ROOT);
await writeJSONAtomic(DEFAULT_DATA_PATH, nextEntries);
await writeJSONAtomic(DEFAULT_BLOGROLLS_PATH, blogrollsDocument);
await writeJSONAtomic(
  DEFAULT_HOMEPAGE_CONNECTIONS_PATH,
  homepageConnectionsDocument,
);
await writeTextAtomic(DEFAULT_OPML_PATH, opml);
await formatGeneratedOutputs();

const homepageEdgeCount =
  typeof homepageConnectionsDocument.edge_count === "number"
    ? homepageConnectionsDocument.edge_count
    : 0;

process.stdout.write(
  `Wrote ${nextEntries.length} network entr` +
    `${nextEntries.length === 1 ? "y" : "ies"}, ` +
    `${blogrollEdgeList.length} publisher blogroll edge` +
    `${blogrollEdgeList.length === 1 ? "" : "s"}, ` +
    `${homepageEdgeCount} homepage connection edge` +
    `${homepageEdgeCount === 1 ? "" : "s"} for nlp:sync merge` +
    ` (${connectionEdgeList.length} raw observation` +
    `${connectionEdgeList.length === 1 ? "" : "s"}; connections.json is published by nlp:sync), and joshternet.opml.\n`,
);
