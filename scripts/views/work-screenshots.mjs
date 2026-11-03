/**
 * Goal & Constraints:
 * After OG enrich (and during views:build for channel cards), any card-worthy
 * item still missing a poster (article, note, project, game, music, video
 * channel, …) gets a Playwright viewport screenshot as local WebP under
 * assets/activity/posters keyed by the work URL. When Showcase still has a
 * remote/invalid publisher image after download+resize, snapshot the work
 * page and rewrite that card to a local WebP keyed by the image URL. Reuse
 * an on-disk poster when present before launching a browser. Never invent
 * works—only screenshot harvested https URLs. Skip hub, member-homepage, and
 * bare creative-index URLs. Reserve writing slots each sync so articles
 * progress when creative backlog is large. Injectable Playwright for offline
 * tests; cap captures per sync.
 */

import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { USER_AGENT } from "../nlp/lib.mjs";
import { createOriginRobotsGate } from "../nlp/origin-robots.mjs";
import { loadPlaywright } from "../nlp/render.mjs";
import {
  SHOWCASE_CONTENT_TYPES,
  isBareCreativeIndexUrl,
  isJoshternetHubContentUrl,
  isMemberSiteHomeItem,
} from "./lib.mjs";
import {
  POSTER_DIRECTORY,
  applyPosterAssets,
  posterAssetPath,
  remainingRemoteShowcasePosters,
} from "./posters.mjs";

/** @type {number} Max work screenshots per sync. */
export const MAX_WORK_SCREENSHOTS_PER_SYNC = 48;

/** @type {number} Reserved article/note slots when creative backlog is large. */
export const MAX_WRITING_SCREENSHOTS_PER_SYNC = 16;

/** @type {number} Preferred creative slots (remainder after writing reserve). */
export const MAX_CREATIVE_SCREENSHOTS_PER_SYNC =
  MAX_WORK_SCREENSHOTS_PER_SYNC - MAX_WRITING_SCREENSHOTS_PER_SYNC;

/** @type {number} Navigation budget per work URL. */
export const WORK_SCREENSHOT_TIMEOUT_MS = 20_000;

/** @type {number} Soft networkidle budget after load (analytics often never idle). */
export const WORK_SCREENSHOT_NETWORKIDLE_MS = 8_000;

/**
 * Soft budget for incomplete `<img>` decode before capture.
 * Lazy/broken images on Twitch and creative sites can stay `complete === false`
 * without ever firing load/error — that wait must not block sync forever.
 */
export const WORK_SCREENSHOT_IMAGE_WAIT_MS = 5_000;

/** @type {number} Hard ceiling for one work URL (goto + settle + screenshot). */
export const WORK_SCREENSHOT_CAPTURE_BUDGET_MS = 45_000;

/** @type {number} Brief settle after assets before the viewport capture. */
export const WORK_SCREENSHOT_SETTLE_MS = 750;

/** @type {number} Capture viewport width. */
export const WORK_SCREENSHOT_WIDTH = 1280;

/** @type {number} Capture viewport height. */
export const WORK_SCREENSHOT_HEIGHT = 800;

/** @type {ReadonlySet<string>} */
const WRITING_CONTENT_TYPES = new Set(["article", "note"]);

/**
 * Normalized content_type (blank → article).
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function screenshotContentType(item) {
  const raw = String(item?.content_type || "").trim();

  return raw || "article";
}

/**
 * True when the content type is article/note writing (blank → article).
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function isWritingScreenshotItem(item) {
  return WRITING_CONTENT_TYPES.has(screenshotContentType(item));
}

/**
 * True when the content type may receive a card/social poster screenshot.
 * @param {string} type
 * @returns {boolean}
 */
export function isScreenshotEligibleContentType(type) {
  return (
    SHOWCASE_CONTENT_TYPES.includes(type) || WRITING_CONTENT_TYPES.has(type)
  );
}

/**
 * True when a draft should get a Playwright poster if OG enrich left it empty.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function contentItemNeedsWorkScreenshot(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (typeof item.image === "string" && item.image.startsWith("https://")) {
    return false;
  }

  if (
    typeof item.image === "string" &&
    item.image.startsWith(`/${POSTER_DIRECTORY}/`)
  ) {
    return false;
  }

  if (typeof item.url !== "string" || !item.url.startsWith("https://")) {
    return false;
  }

  try {
    const parsed = new URL(item.url);

    if (parsed.username || parsed.password) {
      return false;
    }
  } catch {
    return false;
  }

  if (isJoshternetHubContentUrl(item.url)) {
    return false;
  }

  if (isMemberSiteHomeItem(item)) {
    return false;
  }

  if (isBareCreativeIndexUrl(item.url)) {
    return false;
  }

  return isScreenshotEligibleContentType(screenshotContentType(item));
}

/**
 * Absolute filesystem path for a poster asset URL under root.
 * @param {string} root
 * @param {string} assetPath
 * @returns {string}
 */
function absolutePosterPath(root, assetPath) {
  return path.join(root, assetPath.replace(/^\//, ""));
}

/**
 * When a prior sync already wrote a poster WebP for this URL, attach it so
 * channel cards and re-projected Showcase rows do not stay image-less.
 * @param {Array<Record<string, unknown>>} items
 * @param {string} root
 * @returns {Promise<number>} Count of items that gained an image from disk.
 */
export async function attachExistingWorkPosters(items, root) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  let attached = 0;

  for (const item of items) {
    if (!contentItemNeedsWorkScreenshot(item)) {
      continue;
    }

    const workUrl = String(item.url);
    // contentItemNeedsWorkScreenshot already requires a plain https URL.
    const assetPath = posterAssetPath(workUrl);

    try {
      const absolute = absolutePosterPath(root, assetPath);
      const written = await fs.stat(absolute);

      if (written.isFile() && written.size > 0) {
        item.image = assetPath;
        attached += 1;
      }
    } catch {
      // Missing file — leave for Playwright capture.
    }
  }

  return attached;
}

/**
 * Unique Showcase / Activity card rows that may still need a poster.
 * @param {Record<string, unknown>} views
 * @returns {Array<Record<string, unknown>>}
 */
export function collectProjectionItemsNeedingPosters(views) {
  if (!views || typeof views !== "object") {
    return [];
  }

  /** @type {Map<string, Record<string, unknown>>} */
  const byUrl = new Map();
  const lists = [
    views.showcase &&
    typeof views.showcase === "object" &&
    Array.isArray(/** @type {{ items?: unknown }} */ (views.showcase).items)
      ? /** @type {{ items: Array<Record<string, unknown>> }} */ (
          views.showcase
        ).items
      : [],
    views.showcase &&
    typeof views.showcase === "object" &&
    Array.isArray(/** @type {{ home?: unknown }} */ (views.showcase).home)
      ? /** @type {{ home: Array<Record<string, unknown>> }} */ (views.showcase)
          .home
      : [],
    views.activity &&
    typeof views.activity === "object" &&
    Array.isArray(/** @type {{ primary?: unknown }} */ (views.activity).primary)
      ? /** @type {{ primary: Array<Record<string, unknown>> }} */ (
          views.activity
        ).primary
      : [],
  ];

  for (const list of lists) {
    for (const item of list) {
      if (!item || typeof item !== "object") {
        continue;
      }

      if (typeof item.url !== "string" || !item.url) {
        continue;
      }

      if (!byUrl.has(item.url)) {
        byUrl.set(item.url, item);
      }
    }
  }

  return [...byUrl.values()];
}

/**
 * Sort key within a bucket: newer published_at first.
 * @param {Record<string, unknown>} left
 * @param {Record<string, unknown>} right
 * @returns {number}
 */
function comparePublishedDesc(left, right) {
  const leftPublished =
    typeof left.published_at === "string" ? left.published_at : "";
  const rightPublished =
    typeof right.published_at === "string" ? right.published_at : "";

  return rightPublished.localeCompare(leftPublished);
}

/**
 * Sort key: Showcase creative types first, then writing by published_at desc.
 * @param {Record<string, unknown>} left
 * @param {Record<string, unknown>} right
 * @returns {number}
 */
export function compareScreenshotPriority(left, right) {
  const leftType = screenshotContentType(left);
  const rightType = screenshotContentType(right);
  const leftCreative = SHOWCASE_CONTENT_TYPES.includes(leftType) ? 0 : 1;
  const rightCreative = SHOWCASE_CONTENT_TYPES.includes(rightType) ? 0 : 1;

  if (leftCreative !== rightCreative) {
    return leftCreative - rightCreative;
  }

  return comparePublishedDesc(left, right);
}

/**
 * Split a sync budget so writing always progresses under a creative backlog.
 * Takes up to writingReserve writing items and creativePrefer creative items,
 * then fills leftovers from the other bucket until maxCaptures.
 * @param {Array<Record<string, unknown>>} pending
 * @param {number} [maxCaptures]
 * @param {{
 *   writingReserve?: number,
 *   creativePrefer?: number,
 * }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function selectScreenshotTargets(pending, maxCaptures, options = {}) {
  const limit =
    typeof maxCaptures === "number"
      ? maxCaptures
      : MAX_WORK_SCREENSHOTS_PER_SYNC;

  if (!Array.isArray(pending) || pending.length === 0 || limit <= 0) {
    return [];
  }

  const defaultWriting = Math.min(
    MAX_WRITING_SCREENSHOTS_PER_SYNC,
    Math.round(
      (limit * MAX_WRITING_SCREENSHOTS_PER_SYNC) /
        MAX_WORK_SCREENSHOTS_PER_SYNC,
    ),
  );
  const writingReserve =
    typeof options.writingReserve === "number" && options.writingReserve >= 0
      ? options.writingReserve
      : defaultWriting;
  const creativePrefer =
    typeof options.creativePrefer === "number" && options.creativePrefer >= 0
      ? options.creativePrefer
      : Math.max(0, limit - writingReserve);

  const writing = pending
    .filter((item) => isWritingScreenshotItem(item))
    .sort(comparePublishedDesc);
  const creative = pending
    .filter((item) => !isWritingScreenshotItem(item))
    .sort(comparePublishedDesc);

  const writingTake = Math.min(writingReserve, writing.length, limit);
  const creativeTake = Math.min(
    creativePrefer,
    creative.length,
    Math.max(0, limit - writingTake),
  );
  /** @type {Array<Record<string, unknown>>} */
  const selected = [
    ...creative.slice(0, creativeTake),
    ...writing.slice(0, writingTake),
  ];

  let remaining = limit - selected.length;

  if (remaining > 0 && creativeTake < creative.length) {
    const extra = creative.slice(creativeTake, creativeTake + remaining);

    selected.push(...extra);
    remaining -= extra.length;
  }

  if (remaining > 0 && writingTake < writing.length) {
    selected.push(...writing.slice(writingTake, writingTake + remaining));
  }

  return selected;
}

/**
 * Resolves when `promise` settles or `timeoutMs` elapses (whichever first).
 * Used so page-side waits cannot strand the Node sync loop.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @returns {Promise<T | undefined>}
 */
async function softRace(promise, timeoutMs) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wait until the page is ready enough for a card poster screenshot.
 * Uses load (not domcontentloaded) so stylesheet/image load events fire,
 * then soft-waits networkidle and incomplete document images. Never throws
 * for settle timeouts—capture whatever rendered within the budget.
 * Host-side races bound every wait so a stuck renderer cannot hang sync.
 * @param {{
 *   waitForLoadState?: (state: string, opts?: { timeout?: number }) => Promise<unknown>,
 *   waitForTimeout?: (ms: number) => Promise<unknown>,
 *   evaluate?: (
 *     fn: ((waitMs: number) => Promise<unknown> | unknown) | (() => Promise<unknown> | unknown),
 *     arg?: number,
 *   ) => Promise<unknown>,
 * }} page
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export async function awaitPageReadyForScreenshot(page, timeoutMs) {
  const budget =
    typeof timeoutMs === "number" && timeoutMs > 0
      ? timeoutMs
      : WORK_SCREENSHOT_TIMEOUT_MS;
  const imageWaitMs = Math.min(budget, WORK_SCREENSHOT_IMAGE_WAIT_MS);

  if (typeof page.waitForLoadState === "function") {
    try {
      await page.waitForLoadState("load", { timeout: budget });
    } catch {
      // goto may already have reached load or timed out; keep settling.
    }

    try {
      await page.waitForLoadState("networkidle", {
        timeout: Math.min(budget, WORK_SCREENSHOT_NETWORKIDLE_MS),
      });
    } catch {
      // Long-polling / analytics often prevent idle; proceed with load assets.
    }
  }

  if (typeof page.evaluate === "function") {
    try {
      // Race on the host: if the page event loop is wedged, in-page setTimeout
      // never fires and an unbounded evaluate would stall nlp:sync for hours.
      await softRace(
        page.evaluate(async (waitMs) => {
          const pending = Array.from(document.images).filter(
            (image) => !image.complete,
          );

          if (pending.length === 0) {
            return;
          }

          await Promise.race([
            Promise.all(
              pending.map(
                (image) =>
                  new Promise((resolve) => {
                    image.addEventListener("load", resolve, { once: true });
                    image.addEventListener("error", resolve, { once: true });
                  }),
              ),
            ),
            new Promise((resolve) => {
              setTimeout(resolve, waitMs);
            }),
          ]);
        }, imageWaitMs),
        imageWaitMs + 500,
      );
    } catch {
      // Ignore evaluate failures on closed or restricted pages.
    }
  }

  if (typeof page.waitForTimeout === "function") {
    await page.waitForTimeout(WORK_SCREENSHOT_SETTLE_MS);
  }
}

/**
 * Writes a viewport screenshot WebP for content still missing posters.
 * @param {Array<Record<string, unknown>>} items
 * @param {{
 *   root?: string,
 *   importPlaywright?: () => Promise<{
 *     chromium: {
 *       launch: (opts?: Record<string, unknown>) => Promise<{
 *         newContext: (opts?: Record<string, unknown>) => Promise<{
 *           newPage: () => Promise<{
 *             goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>,
 *             waitForLoadState?: (state: string, opts?: { timeout?: number }) => Promise<unknown>,
 *             waitForTimeout?: (ms: number) => Promise<unknown>,
 *             evaluate?: (fn: () => Promise<unknown> | unknown) => Promise<unknown>,
 *             screenshot: (opts?: Record<string, unknown>) => Promise<Buffer>,
 *           }>,
 *           close: () => Promise<void>,
 *         }>,
 *         close: () => Promise<void>,
 *       }>,
 *     },
 *   }>,
 *   maxCaptures?: number,
 *   timeoutMs?: number,
 *   robotsGate?: import("../nlp/origin-robots.mjs").OriginRobotsGate,
 *   log?: (message: string) => void,
 * }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function captureMissingWorkScreenshots(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return Array.isArray(items) ? items : [];
  }

  const root = typeof options.root === "string" ? options.root : process.cwd();
  await attachExistingWorkPosters(items, root);

  const robotsGate =
    options.robotsGate ||
    createOriginRobotsGate({
      userAgent: USER_AGENT,
      cache: options.cache,
      fetchPublicText: options.fetchPublicText,
    });
  const pending = [];

  for (const item of items.filter((row) =>
    contentItemNeedsWorkScreenshot(row),
  )) {
    // contentItemNeedsWorkScreenshot already requires a plain https URL.
    const workUrl = String(item.url);

    if (!(await robotsGate.allows(workUrl))) {
      continue;
    }

    pending.push(item);
  }
  const maxCaptures =
    typeof options.maxCaptures === "number" && options.maxCaptures > 0
      ? options.maxCaptures
      : MAX_WORK_SCREENSHOTS_PER_SYNC;

  if (pending.length === 0) {
    return items;
  }

  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : WORK_SCREENSHOT_TIMEOUT_MS;
  const targets = selectScreenshotTargets(pending, maxCaptures);

  let browser;

  try {
    const playwright = await loadPlaywright(options.importPlaywright);
    browser = await playwright.chromium.launch({ headless: true });
  } catch {
    return items;
  }

  let writingCaptured = 0;
  let creativeCaptured = 0;
  /**
   * Progress reporter. Defaults to console.log for sync; tests inject a
   * capture so expected summaries assert green without raw terminal noise.
   * @param {string} message
   */
  const log =
    typeof options.log === "function"
      ? options.log
      : (message) => {
          console.log(message);
        };

  try {
    let index = 0;

    for (const item of targets) {
      if (!contentItemNeedsWorkScreenshot(item)) {
        continue;
      }

      index += 1;
      // contentItemNeedsWorkScreenshot already requires a plain https URL, so
      // posterAssetPath always returns a local asset path here.
      const workUrl = String(item.url);
      const assetPath = posterAssetPath(workUrl);
      const absolute = absolutePosterPath(root, assetPath);
      log(`work screenshot ${index}/${targets.length} ${workUrl}`);

      try {
        await fs.mkdir(path.dirname(absolute), { recursive: true });
        const context = await browser.newContext({
          viewport: {
            width: WORK_SCREENSHOT_WIDTH,
            height: WORK_SCREENSHOT_HEIGHT,
          },
          userAgent: USER_AGENT,
        });

        try {
          const captureBudget = Math.max(
            timeoutMs +
              WORK_SCREENSHOT_NETWORKIDLE_MS +
              WORK_SCREENSHOT_SETTLE_MS,
            WORK_SCREENSHOT_CAPTURE_BUDGET_MS,
          );
          await softRace(
            (async () => {
              const page = await context.newPage();
              await page.goto(workUrl, {
                waitUntil: "load",
                timeout: timeoutMs,
              });
              await awaitPageReadyForScreenshot(page, timeoutMs);
              const png = await page.screenshot({
                type: "png",
                fullPage: false,
                animations: "disabled",
              });
              const webp = await sharp(png)
                .resize(WORK_SCREENSHOT_WIDTH, WORK_SCREENSHOT_HEIGHT, {
                  fit: "cover",
                  position: "top",
                })
                .webp({ quality: 82, effort: 5 })
                .toBuffer();
              await fs.writeFile(absolute, webp);
              const written = await fs.stat(absolute);

              if (written.isFile() && written.size > 0) {
                item.image = assetPath;

                if (isWritingScreenshotItem(item)) {
                  writingCaptured += 1;
                } else {
                  creativeCaptured += 1;
                }
              }
            })(),
            captureBudget,
          );
        } finally {
          await context.close();
        }
      } catch {
        // Keep the draft without a poster; Showcase substance may still pass.
      }
    }
  } finally {
    try {
      await browser.close();
    } catch {
      // Ignore close failures after a partial capture run.
    }
  }

  const remaining = items.filter((item) =>
    contentItemNeedsWorkScreenshot(item),
  ).length;
  const captured = writingCaptured + creativeCaptured;
  const summary = `work screenshots: ${captured} captured (${writingCaptured} writing, ${creativeCaptured} creative); ${remaining} pending remaining`;

  log(summary);

  return items;
}

/**
 * When Showcase still points at a remote/invalid publisher image after
 * download+resize, capture a viewport WebP of the work page and rewrite the
 * card image to that local poster (keyed by the original image URL).
 * @param {Record<string, unknown>} views
 * @param {{
 *   root?: string,
 *   importPlaywright?: () => Promise<{
 *     chromium: {
 *       launch: (opts?: Record<string, unknown>) => Promise<{
 *         newContext: (opts?: Record<string, unknown>) => Promise<{
 *           newPage: () => Promise<{
 *             goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>,
 *             waitForLoadState?: (state: string, opts?: { timeout?: number }) => Promise<unknown>,
 *             waitForTimeout?: (ms: number) => Promise<unknown>,
 *             evaluate?: (fn: () => Promise<unknown> | unknown) => Promise<unknown>,
 *             screenshot: (opts?: Record<string, unknown>) => Promise<Buffer>,
 *           }>,
 *           close: () => Promise<void>,
 *         }>,
 *         close: () => Promise<void>,
 *       }>,
 *     },
 *   }>,
 *   timeoutMs?: number,
 *   robotsGate?: import("../nlp/origin-robots.mjs").OriginRobotsGate,
 *   log?: (message: string) => void,
 *   logError?: (message: string) => void,
 * }} [options]
 * @returns {Promise<number>} Count of Showcase image URLs localized via snapshot.
 */
export async function captureShowcasePosterFallbacks(views, options = {}) {
  const remaining = remainingRemoteShowcasePosters(views);

  if (remaining.length === 0) {
    return 0;
  }

  const root = typeof options.root === "string" ? options.root : process.cwd();
  /**
   * @param {string} message
   */
  const log =
    typeof options.log === "function"
      ? options.log
      : (message) => {
          process.stdout.write(message);
        };
  /**
   * @param {string} message
   */
  const logError =
    typeof options.logError === "function"
      ? options.logError
      : (message) => {
          process.stderr.write(message);
        };
  const robotsGate =
    options.robotsGate ||
    createOriginRobotsGate({
      userAgent: USER_AGENT,
      cache: options.cache,
      fetchPublicText: options.fetchPublicText,
    });
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : WORK_SCREENSHOT_TIMEOUT_MS;

  /** @type {Map<string, { image: string, url: string }>} */
  const byImage = new Map();

  for (const row of remaining) {
    if (!row.image.startsWith("https://") || !posterAssetPath(row.image)) {
      continue;
    }

    if (!row.url.startsWith("https://")) {
      continue;
    }

    if (!byImage.has(row.image)) {
      byImage.set(row.image, row);
    }
  }

  if (byImage.size === 0) {
    return 0;
  }

  let browser;

  try {
    const playwright = await loadPlaywright(options.importPlaywright);
    browser = await playwright.chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`showcase poster snapshot launch failed: ${message}\n`);
    return 0;
  }

  /** @type {Map<string, string>} */
  const localBySource = new Map();
  let captured = 0;

  try {
    for (const [imageUrl, row] of byImage) {
      if (!(await robotsGate.allows(row.url))) {
        logError(
          `showcase poster snapshot skipped (robots): ${row.url} (${imageUrl})\n`,
        );
        continue;
      }

      const assetPath = posterAssetPath(imageUrl);
      const absolute = absolutePosterPath(root, assetPath);

      try {
        await fs.mkdir(path.dirname(absolute), { recursive: true });
        const context = await browser.newContext({
          viewport: {
            width: WORK_SCREENSHOT_WIDTH,
            height: WORK_SCREENSHOT_HEIGHT,
          },
          userAgent: USER_AGENT,
        });

        try {
          const captureBudget = Math.max(
            timeoutMs +
              WORK_SCREENSHOT_NETWORKIDLE_MS +
              WORK_SCREENSHOT_SETTLE_MS,
            WORK_SCREENSHOT_CAPTURE_BUDGET_MS,
          );
          log(`showcase poster snapshot ${row.url}\n`);
          await softRace(
            (async () => {
              const page = await context.newPage();
              await page.goto(row.url, {
                waitUntil: "load",
                timeout: timeoutMs,
              });
              await awaitPageReadyForScreenshot(page, timeoutMs);
              const png = await page.screenshot({
                type: "png",
                fullPage: false,
                animations: "disabled",
              });
              const webp = await sharp(png)
                .resize(WORK_SCREENSHOT_WIDTH, WORK_SCREENSHOT_HEIGHT, {
                  fit: "cover",
                  position: "top",
                })
                .webp({ quality: 82, effort: 5 })
                .toBuffer();
              await fs.writeFile(absolute, webp);
              const written = await fs.stat(absolute);

              if (written.isFile() && written.size > 0) {
                localBySource.set(imageUrl, assetPath);
                captured += 1;
              }
            })(),
            captureBudget,
          );
        } finally {
          await context.close();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(
          `showcase poster snapshot failed ${row.url} (${imageUrl}): ${message}\n`,
        );
      }
    }
  } finally {
    try {
      await browser.close();
    } catch {
      // Ignore close failures after a partial capture run.
    }
  }

  if (localBySource.size > 0) {
    applyPosterAssets(views, localBySource);
  }

  log(
    `showcase poster snapshots: ${captured} captured; ${remainingRemoteShowcasePosters(views).length} still remote\n`,
  );

  return captured;
}
