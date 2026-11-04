/**
 * Goal & Constraints:
 * What's New and Showcase cards use a local poster sized for the card, not
 * the publisher's full image. Sharp fits each https poster inside 1280×800
 * (≈2–3× retina card width) without cropping or upscaling, and writes crisp
 * WebP under assets/activity/posters. Encode version stamps the asset hash so
 * quality bumps re-fetch. This runs inside nlp:sync → views:build. Network
 * fetches cover only Activity + Showcase; Search/topic cards reuse on-disk
 * posters when present. Sheet music without a publisher image gets a generated
 * staff-preview poster. Showcase must finish fully localized or the build
 * throws so CI does not publish remote img srcs. After download/resize fails,
 * views:build captures a viewport snapshot of the work page before that gate.
 * Files stay while referenced by a shown card (or still mapped from cache),
 * then are removed.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { USER_AGENT } from "../nlp/lib.mjs";
import { createOriginRobotsGate } from "../nlp/origin-robots.mjs";
import { assertPublicURL } from "../network/lib.mjs";
import {
  MAX_PUBLIC_FETCH_REDIRECTS,
  readCappedResponseBytes,
} from "../network/public-fetch-guard.mjs";

/** @type {number} Max poster width in pixels (2–3× retina creative cards). */
export const POSTER_MAX_WIDTH = 1280;

/** @type {number} Max poster height in pixels. */
export const POSTER_MAX_HEIGHT = 800;

/** @type {number} Sheet-music preview width in pixels. */
export const SHEET_MUSIC_POSTER_WIDTH = 960;

/** @type {number} Sheet-music preview height in pixels. */
export const SHEET_MUSIC_POSTER_HEIGHT = 720;

/**
 * Bumped when encode settings change so asset paths rematerialize crisply.
 * @type {string}
 */
export const POSTER_ENCODE_VERSION = "hq-v1";

/** @type {number} WebP quality for readable UI / photo posters. */
export const POSTER_WEBP_QUALITY = 92;

/** @type {number} WebP CPU effort (0–6). */
export const POSTER_WEBP_EFFORT = 6;

/** @type {string} Repo-relative directory of generated posters. */
export const POSTER_DIRECTORY = "assets/activity/posters";

/** @type {string} User-Agent for publisher poster downloads during nlp:sync. */
export const POSTER_FETCH_USER_AGENT = USER_AGENT;

/** @type {number} Per-attempt fetch budget for large photography posters. */
export const POSTER_FETCH_TIMEOUT_MS = 45_000;

/** @type {number} Attempts per poster URL before leaving it remote. */
export const POSTER_FETCH_ATTEMPTS = 2;

/**
 * Hard cap for one downloaded poster body. Oversized CDN blobs must not hang
 * sync in arrayBuffer()/Sharp (Vercel/edge stalls have stalled nlp:sync for hours).
 * @type {number}
 */
export const POSTER_MAX_BYTES = 12_000_000;

/**
 * Shared WebP encode options for Activity / Showcase posters.
 * @returns {{
 *   quality: number,
 *   alphaQuality: number,
 *   smartSubsample: boolean,
 *   effort: number,
 *   preset: string,
 * }}
 */
export function posterWebpOptions() {
  return {
    quality: POSTER_WEBP_QUALITY,
    alphaQuality: 100,
    smartSubsample: true,
    effort: POSTER_WEBP_EFFORT,
    preset: "picture",
  };
}

/**
 * Public path for a poster, or "" when the source is not a plain https URL.
 * @param {unknown} sourceUrl
 * @returns {string}
 */
export function posterAssetPath(sourceUrl) {
  if (typeof sourceUrl !== "string" || !sourceUrl.startsWith("https://")) {
    return "";
  }

  try {
    const url = new URL(sourceUrl);

    if (url.username || url.password) {
      return "";
    }
  } catch {
    return "";
  }

  const name = crypto
    .createHash("sha256")
    .update(`${POSTER_ENCODE_VERSION}\0${sourceUrl}`)
    .digest("hex");

  return `/${POSTER_DIRECTORY}/${name}.webp`;
}

/**
 * Fits a poster inside the card size and encodes crisp WebP.
 * @param {Buffer} input
 * @returns {Promise<Buffer>}
 * @throws {Error} When the bytes are not an image Sharp can read.
 */
export async function resizePoster(input) {
  return sharp(input)
    .resize(POSTER_MAX_WIDTH, POSTER_MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3",
      // Avoid JPEG/WebP shrink-on-load moiré on UI text and fine lines.
      fastShrinkOnLoad: false,
    })
    .webp(posterWebpOptions())
    .toBuffer();
}

/**
 * Visits What's New + Showcase cards (the only surfaces that fetch posters).
 * @param {Record<string, unknown> | null | undefined} views
 * @param {(item: unknown) => void} visit
 * @returns {void}
 */
export function visitPriorityPosters(views, visit) {
  const activity = views?.activity;
  const primary =
    activity && typeof activity === "object"
      ? /** @type {{ primary?: unknown }} */ (activity).primary
      : undefined;

  if (Array.isArray(primary)) {
    for (const item of primary) {
      visit(item);
    }
  }

  const showcase = views?.showcase;

  if (showcase && typeof showcase === "object") {
    const showcaseItems = /** @type {{ items?: unknown, home?: unknown }} */ (
      showcase
    ).items;
    const showcaseHome = /** @type {{ items?: unknown, home?: unknown }} */ (
      showcase
    ).home;

    if (Array.isArray(showcaseItems)) {
      for (const item of showcaseItems) {
        visit(item);
      }
    }

    if (Array.isArray(showcaseHome)) {
      for (const item of showcaseHome) {
        visit(item);
      }
    }
  }
}

/**
 * Visits every card surface that may show a poster (for cache reuse + keep).
 * @param {Record<string, unknown> | null | undefined} views
 * @param {(item: unknown) => void} visit
 * @returns {void}
 */
export function visitShownPosters(views, visit) {
  visitPriorityPosters(views, visit);

  const search = views?.search_index;
  const documents =
    search && typeof search === "object"
      ? /** @type {{ documents?: unknown }} */ (search).documents
      : undefined;

  if (Array.isArray(documents)) {
    for (const item of documents) {
      visit(item);
    }
  }

  const topics = views?.topic_views;
  const neighborhoods =
    topics && typeof topics === "object"
      ? /** @type {{ neighborhoods?: unknown }} */ (topics).neighborhoods
      : undefined;

  if (Array.isArray(neighborhoods)) {
    for (const neighborhood of neighborhoods) {
      const topic =
        neighborhood && typeof neighborhood === "object"
          ? /** @type {{ recent?: unknown, members?: unknown }} */ (
              neighborhood
            )
          : {};
      const recent = Array.isArray(topic.recent) ? topic.recent : [];

      for (const item of recent) {
        visit(item);
      }

      const members = Array.isArray(topic.members) ? topic.members : [];

      for (const member of members) {
        const row =
          member && typeof member === "object"
            ? /** @type {{ articles?: unknown, recent?: unknown }} */ (member)
            : {};
        const articles = Array.isArray(row.articles) ? row.articles : [];
        const memberRecent = Array.isArray(row.recent) ? row.recent : [];

        for (const item of articles) {
          visit(item);
        }

        for (const item of memberRecent) {
          visit(item);
        }
      }
    }
  }
}

/**
 * Collects https poster URLs from the given visitor.
 * @param {Record<string, unknown> | null | undefined} views
 * @param {(
 *   views: Record<string, unknown> | null | undefined,
 *   visit: (item: unknown) => void,
 * ) => void} visitor
 * @returns {string[]}
 */
function collectHttpsPosterSources(views, visitor) {
  /** @type {Set<string>} */
  const sources = new Set();

  visitor(views, (item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const image = /** @type {{ image?: unknown }} */ (item).image;

    if (posterAssetPath(image)) {
      sources.add(/** @type {string} */ (image));
    }
  });

  return [...sources];
}

/**
 * Distinct https poster URLs on What's New + Showcase (fetch targets).
 * @param {Record<string, unknown> | null | undefined} views
 * @returns {string[]}
 */
export function posterSourcesFromViews(views) {
  return collectHttpsPosterSources(views, visitPriorityPosters);
}

/**
 * Distinct https poster URLs on any shown surface (cache reuse candidates).
 * @param {Record<string, unknown> | null | undefined} views
 * @returns {string[]}
 */
export function posterCacheSourcesFromViews(views) {
  return collectHttpsPosterSources(views, visitShownPosters);
}

/**
 * Points shown cards at a local poster when one was written.
 * @param {Record<string, unknown>} views
 * @param {Map<string, string>} localBySource
 * @returns {void}
 */
export function applyPosterAssets(views, localBySource) {
  visitShownPosters(views, (item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const card = /** @type {{ image?: unknown, image_origin?: unknown }} */ (
      item
    );
    const local =
      typeof card.image === "string" ? localBySource.get(card.image) : "";

    if (!local) {
      return;
    }

    card.image = local;
    card.image_origin = "";
  });
}

/**
 * @param {string} filePath
 * @returns {Promise<Buffer | null>}
 */
async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error && /** @type {{ code?: string }} */ (error).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

/**
 * Escapes text for SVG attribute/text nodes.
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Truncates a title for the sheet-music preview card.
 * @param {string} title
 * @param {number} maxChars
 * @returns {string}
 */
function truncatePreviewTitle(title, maxChars) {
  const normalized = String(title || "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/**
 * Public path for a generated sheet-music preview poster.
 * @param {unknown} workUrl
 * @returns {string}
 */
export function sheetMusicPosterAssetPath(workUrl) {
  if (typeof workUrl !== "string" || !workUrl) {
    return "";
  }

  const name = crypto
    .createHash("sha256")
    .update(`${POSTER_ENCODE_VERSION}\0sheet-music:${workUrl}`)
    .digest("hex");

  return `/${POSTER_DIRECTORY}/${name}.webp`;
}

/**
 * SVG staff preview used when a publisher PDF has no raster image.
 * @param {string} title
 * @returns {string}
 */
export function sheetMusicPreviewSvg(title) {
  const label = escapeXml(truncatePreviewTitle(title, 42) || "Sheet music");
  const width = SHEET_MUSIC_POSTER_WIDTH;
  const height = SHEET_MUSIC_POSTER_HEIGHT;
  const staffTop = 168;
  const staffGap = 14;
  const staffLines = [0, 1, 2, 3, 4]
    .map((index) => {
      const y = staffTop + index * staffGap;

      return `<line x1="72" y1="${y}" x2="${width - 72}" y2="${y}" stroke="#1f2a24" stroke-width="2.2" stroke-linecap="round"/>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f1e4"/>
      <stop offset="55%" stop-color="#efe4d0"/>
      <stop offset="100%" stop-color="#e4d5bb"/>
    </linearGradient>
    <radialGradient id="wash" cx="18%" cy="12%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#paper)"/>
  <rect width="${width}" height="${height}" fill="url(#wash)"/>
  <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="none" stroke="#c9b79a" stroke-width="2"/>
  <text x="48" y="78" fill="#5c4a32" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="700" letter-spacing="0.08em">SHEET MUSIC</text>
  <text x="48" y="124" fill="#1f2a24" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700">${label}</text>
  ${staffLines}
  <path d="M96 ${staffTop + staffGap * 4} c 8 -28 22 -52 22 -78 c 0 -18 -10 -30 -22 -30 c -14 0 -24 14 -20 34 c 6 28 28 48 46 70" fill="none" stroke="#1f2a24" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="168" cy="${staffTop + staffGap * 3}" r="7" fill="#1f2a24"/>
  <line x1="175" y1="${staffTop + staffGap}" x2="175" y2="${staffTop + staffGap * 3}" stroke="#1f2a24" stroke-width="3"/>
  <circle cx="236" cy="${staffTop + staffGap * 2}" r="7" fill="#1f2a24"/>
  <line x1="243" y1="${staffTop}" x2="243" y2="${staffTop + staffGap * 2}" stroke="#1f2a24" stroke-width="3"/>
  <circle cx="304" cy="${staffTop + staffGap * 4}" r="7" fill="#1f2a24"/>
  <line x1="311" y1="${staffTop + staffGap * 2}" x2="311" y2="${staffTop + staffGap * 4}" stroke="#1f2a24" stroke-width="3"/>
  <text x="48" y="${height - 48}" fill="#7a684f" font-family="Georgia, 'Times New Roman', serif" font-size="16">Score preview · opens on the publisher’s site</text>
</svg>`;
}

/**
 * Renders a WebP sheet-music preview poster.
 * @param {string} title
 * @returns {Promise<Buffer>}
 */
export async function renderSheetMusicPoster(title) {
  return sharp(Buffer.from(sheetMusicPreviewSvg(title)))
    .webp(posterWebpOptions())
    .toBuffer();
}

/**
 * True when a Showcase card is sheet music that still needs a local preview.
 * @param {Record<string, unknown>} card
 * @returns {boolean}
 */
function needsSheetMusicPoster(card) {
  const isSheet =
    card.content_type === "sheet_music" || card.kind === "sheet music";

  if (!isSheet) {
    return false;
  }

  const image = typeof card.image === "string" ? card.image : "";

  if (image.startsWith("https://")) {
    return false;
  }

  if (image.startsWith(`/${POSTER_DIRECTORY}/`)) {
    return false;
  }

  return typeof card.url === "string" && card.url.length > 0;
}

/**
 * Writes staff-preview posters for sheet-music Showcase cards without images.
 * @param {Record<string, unknown>} views
 * @param {string} directory
 * @param {Set<string>} keepNames
 * @returns {Promise<void>}
 */
export async function materializeSheetMusicPosters(
  views,
  directory,
  keepNames,
) {
  /** @type {Record<string, unknown>[]} */
  const cards = [];

  visitShownPosters(views, (item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const card = /** @type {Record<string, unknown>} */ (item);

    if (needsSheetMusicPoster(card)) {
      cards.push(card);
      return;
    }

    if (
      (card.content_type === "sheet_music" || card.kind === "sheet music") &&
      typeof card.image === "string" &&
      card.image.startsWith(`/${POSTER_DIRECTORY}/`)
    ) {
      keepNames.add(path.basename(card.image));
    }
  });

  for (const card of cards) {
    const assetPath = sheetMusicPosterAssetPath(String(card.url));
    const fileName = path.basename(assetPath);
    const outputPath = path.join(directory, fileName);
    const webp = await renderSheetMusicPoster(
      String(card.title || "Sheet music"),
    );
    const existing = await readFileIfExists(outputPath);

    if (!existing || !existing.equals(webp)) {
      await fs.writeFile(outputPath, webp);
    }

    card.image = assetPath;
    card.image_origin = "";
    keepNames.add(fileName);
  }
}

/**
 * Deletes poster files whose articles are no longer shown.
 * @param {string} directory
 * @param {Set<string>} keepNames
 * @returns {Promise<void>}
 */
export async function removeUnshownPosters(directory, keepNames) {
  /** @type {string[]} */
  let files;

  try {
    files = await fs.readdir(directory);
  } catch (error) {
    if (error && /** @type {{ code?: string }} */ (error).code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const file of files) {
    if (!file.endsWith(".webp") || keepNames.has(file)) {
      continue;
    }

    await fs.rm(path.join(directory, file), { force: true });
  }
}

/**
 * Reads a poster response body with an absolute byte ceiling.
 * @param {{
 *   ok?: boolean,
 *   status?: number,
 *   headers?: { get?: (name: string) => string | null },
 *   body?: ReadableStream<Uint8Array> | null,
 *   arrayBuffer?: () => Promise<ArrayBuffer>,
 * }} response
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
export async function readPosterResponseBytes(response, maxBytes) {
  try {
    return await readCappedResponseBytes(response, maxBytes, {
      overflow: "throw",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      message
        .replace(/^Response exceeds/, "Poster exceeds")
        .replace(
          /^Response has no readable body/,
          "Poster response has no readable body",
        ),
    );
  }
}

/**
 * Downloads one poster URL with retries, User-Agent, and a hard AbortController
 * timeout (same pattern as fetchPublicText—AbortSignal.timeout alone has left
 * ESTABLISHED CDN downloads hung for hours during nlp:sync).
 * Skips when robots.txt disallows the image URL.
 * @param {string} source
 * @param {typeof fetch} fetchImpl
 * @param {{
 *   robotsGate?: import("../nlp/origin-robots.mjs").OriginRobotsGate,
 *   cache?: Map<string, unknown>,
 *   fetchPublicText?: unknown,
 *   timeoutMs?: number,
 *   maxBytes?: number,
 *   attempts?: number,
 *   maxRedirects?: number,
 *   lookup?: unknown,
 * }} [options]
 * @returns {Promise<Buffer>}
 */
export async function fetchPosterBytes(source, fetchImpl, options = {}) {
  const robotsGate =
    options.robotsGate ||
    createOriginRobotsGate({
      userAgent: POSTER_FETCH_USER_AGENT,
      cache: options.cache,
      fetchPublicText: options.fetchPublicText,
    });
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : POSTER_FETCH_TIMEOUT_MS;
  const maxBytes =
    typeof options.maxBytes === "number" && options.maxBytes > 0
      ? options.maxBytes
      : POSTER_MAX_BYTES;
  const attempts =
    typeof options.attempts === "number" && options.attempts > 0
      ? options.attempts
      : POSTER_FETCH_ATTEMPTS;
  const maxRedirects =
    typeof options.maxRedirects === "number" && options.maxRedirects >= 0
      ? options.maxRedirects
      : MAX_PUBLIC_FETCH_REDIRECTS;
  const dnsOptions = {
    cache: options.cache,
    lookup: options.lookup,
  };

  await assertPublicURL(source, dnsOptions);

  if (!(await robotsGate.allows(source))) {
    throw new Error("Poster URL disallowed by robots.txt");
  }

  /** @type {unknown} */
  let lastError = new Error("poster fetch failed");

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutError = new Error(
      `Poster fetch timed out after ${timeoutMs}ms`,
    );
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let hardTimer;

    try {
      // Abort the request AND race the whole attempt. Some stalled CDN
      // sockets ignore AbortSignal alone (nlp:sync sat ESTABLISHED for hours).
      const bytes = await Promise.race([
        (async () => {
          let current = source;
          let hops = 0;

          while (true) {
            const response = await fetchImpl(current, {
              headers: {
                Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
                "User-Agent": POSTER_FETCH_USER_AGENT,
              },
              redirect: "manual",
              signal: controller.signal,
            });

            if (response.status >= 300 && response.status < 400) {
              const location = response.headers?.get?.("location");

              if (!location) {
                throw new Error(
                  `Poster redirect without location from ${current}`,
                );
              }

              hops += 1;

              if (hops > maxRedirects) {
                throw new Error(
                  `Poster exceeded ${maxRedirects} redirects from ${source}`,
                );
              }

              current = new URL(location, current).href;
              await assertPublicURL(current, dnsOptions);
              continue;
            }

            if (!response.ok) {
              throw new Error(`Poster request failed (${response.status})`);
            }

            return readPosterResponseBytes(response, maxBytes);
          }
        })(),
        new Promise((_, reject) => {
          hardTimer = setTimeout(() => {
            controller.abort(timeoutError);
            reject(timeoutError);
          }, timeoutMs);
        }),
      ]);
      return bytes;
    } catch (error) {
      lastError = error;
    } finally {
      if (hardTimer !== undefined) {
        clearTimeout(hardTimer);
      }
    }
  }

  throw lastError;
}

/**
 * Showcase cards that still point at a non-local image after materialize.
 * Empty images are allowed (no poster). Remote https is not.
 * @param {Record<string, unknown> | null | undefined} views
 * @returns {Array<{ url: string, image: string }>}
 */
export function remainingRemoteShowcasePosters(views) {
  const showcase =
    views && typeof views === "object"
      ? /** @type {{ showcase?: { items?: unknown, home?: unknown } }} */ (
          views
        ).showcase
      : undefined;
  const items = Array.isArray(showcase?.items) ? showcase.items : [];
  const home = Array.isArray(showcase?.home) ? showcase.home : [];
  /** @type {Array<{ url: string, image: string }>} */
  const remaining = [];

  for (const item of [...items, ...home]) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const card = /** @type {{ url?: unknown, image?: unknown }} */ (item);
    const image = typeof card.image === "string" ? card.image : "";

    if (!image || image.startsWith(`/${POSTER_DIRECTORY}/`)) {
      continue;
    }

    remaining.push({
      url: typeof card.url === "string" ? card.url : "",
      image,
    });
  }

  return remaining;
}

/**
 * Throws when Showcase cards still point at remote/invalid images.
 * @param {Record<string, unknown>} views
 * @param {{ logError?: (message: string) => void }} [options]
 * @returns {void}
 * @throws {Error} When any Showcase card image is still remote.
 */
export function assertShowcasePostersLocalized(views, options = {}) {
  /**
   * @param {string} message
   */
  const logError =
    typeof options.logError === "function"
      ? options.logError
      : (message) => {
          process.stderr.write(message);
        };

  const remaining = remainingRemoteShowcasePosters(views);

  if (remaining.length === 0) {
    return;
  }

  for (const row of remaining) {
    logError(
      `showcase poster not localized: ${row.url || "(missing url)"} (${row.image})\n`,
    );
  }

  throw new Error(
    `Showcase poster materialize left ${remaining.length} remote/invalid image(s); nlp:sync cannot publish until the crawl can fetch them or capture a page snapshot.`,
  );
}

/**
 * Downloads, resizes, and rewrites posters for What's New + Showcase.
 * Reuses on-disk WebP for any shown surface; fetches only missing
 * Activity/Showcase sources. Part of nlp:sync (GitHub Actions).
 * @param {Record<string, unknown>} views
 * @param {string} root
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   robotsGate?: import("../nlp/origin-robots.mjs").OriginRobotsGate,
 *   cache?: Map<string, unknown>,
 *   lookup?: unknown,
 *   fetchPublicText?: unknown,
 *   logError?: (message: string) => void,
 *   log?: (message: string) => void,
 *   requireLocalizedShowcase?: boolean,
 * }} [options]
 * @returns {Promise<Record<string, unknown>>}
 * @throws {Error} When Showcase still has remote/invalid images after attempts
 *   and `requireLocalizedShowcase` is not false.
 */
export async function materializeActivityPosters(views, root, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const dnsCache = options.cache || new Map();
  const robotsGate =
    options.robotsGate ||
    createOriginRobotsGate({
      userAgent: POSTER_FETCH_USER_AGENT,
      cache: dnsCache,
      fetchPublicText: options.fetchPublicText,
    });
  /**
   * Reports a soft poster failure. Defaults to stderr; tests inject a no-op.
   * @param {string} message
   */
  const logError =
    typeof options.logError === "function"
      ? options.logError
      : (message) => {
          process.stderr.write(message);
        };
  /**
   * Progress for sync operators. Defaults to stdout; tests inject a no-op.
   * @param {string} message
   */
  const log =
    typeof options.log === "function"
      ? options.log
      : (message) => {
          process.stdout.write(message);
        };
  const fetchSources = posterSourcesFromViews(views);
  const cacheSources = posterCacheSourcesFromViews(views);
  const directory = path.join(root, POSTER_DIRECTORY);
  /** @type {Map<string, string>} */
  const localBySource = new Map();
  /** @type {Set<string>} */
  const keepNames = new Set();
  /** @type {Set<string>} */
  const fetchNeeded = new Set(fetchSources);

  await fs.mkdir(directory, { recursive: true });

  let reused = 0;

  for (const source of cacheSources) {
    const assetPath = posterAssetPath(source);
    const fileName = path.basename(assetPath);
    const outputPath = path.join(directory, fileName);
    const existing = await readFileIfExists(outputPath);

    if (!existing) {
      continue;
    }

    localBySource.set(source, assetPath);
    keepNames.add(fileName);
    fetchNeeded.delete(source);
    reused += 1;
  }

  const toFetch = [...fetchNeeded];

  log(
    `posters: ${fetchSources.length} latest, ${reused} cached, ${toFetch.length} to fetch\n`,
  );

  let fetchedOk = 0;

  for (let index = 0; index < toFetch.length; index += 1) {
    const source = toFetch[index];
    const assetPath = posterAssetPath(source);
    const fileName = path.basename(assetPath);
    const outputPath = path.join(directory, fileName);

    log(`poster ${index + 1}/${toFetch.length} ${source}\n`);

    try {
      const webp = await resizePoster(
        await fetchPosterBytes(source, fetchImpl, {
          robotsGate,
          cache: dnsCache,
          lookup: options.lookup,
        }),
      );
      await fs.writeFile(outputPath, webp);
      localBySource.set(source, assetPath);
      keepNames.add(fileName);
      fetchedOk += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`poster materialize failed ${source}: ${message}\n`);

      const existing = await readFileIfExists(outputPath);

      if (existing) {
        localBySource.set(source, assetPath);
        keepNames.add(fileName);
      }
    }
  }

  if (toFetch.length > 0) {
    log(`posters: fetched ${fetchedOk}/${toFetch.length}\n`);
  }

  applyPosterAssets(views, localBySource);
  await materializeSheetMusicPosters(views, directory, keepNames);

  // Keep Playwright / prior local posters already pointed at by shown cards.
  visitShownPosters(views, (item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const image = /** @type {{ image?: unknown }} */ (item).image;

    if (
      typeof image === "string" &&
      image.startsWith(`/${POSTER_DIRECTORY}/`)
    ) {
      keepNames.add(path.basename(image));
    }
  });

  await removeUnshownPosters(directory, keepNames);

  if (options.requireLocalizedShowcase !== false) {
    assertShowcasePostersLocalized(views, { logError });
  }

  log(
    `posters: localized ${localBySource.size} source(s); kept ${keepNames.size} file(s)\n`,
  );

  return views;
}
