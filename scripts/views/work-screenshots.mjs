/**
 * Goal & Constraints:
 * After OG enrich (and during views:build for channel cards), any card-worthy
 * item still missing a poster (article, note, project, game, music, video
 * channel, …) gets a Playwright viewport screenshot as local WebP under
 * assets/activity/posters keyed by the work URL. Reuse an on-disk poster when
 * present before launching a browser. Never invent works—only screenshot
 * harvested https URLs. Skip hub, member-homepage, and bare creative-index
 * URLs. Reserve writing slots each sync so articles progress when creative
 * backlog is large. Injectable Playwright for offline tests; cap captures
 * per sync.
 */

import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { loadPlaywright } from "../nlp/render.mjs";
import {
  SHOWCASE_CONTENT_TYPES,
  isBareCreativeIndexUrl,
  isJoshternetHubContentUrl,
  isMemberSiteHomeItem,
} from "./lib.mjs";
import { POSTER_DIRECTORY, posterAssetPath } from "./posters.mjs";

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
 * Wait until the page is ready enough for a card poster screenshot.
 * Uses load (not domcontentloaded) so stylesheet/image load events fire,
 * then soft-waits networkidle and incomplete document images. Never throws
 * for settle timeouts—capture whatever rendered within the budget.
 * @param {{
 *   waitForLoadState?: (state: string, opts?: { timeout?: number }) => Promise<unknown>,
 *   waitForTimeout?: (ms: number) => Promise<unknown>,
 *   evaluate?: (fn: () => Promise<unknown> | unknown) => Promise<unknown>,
 * }} page
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export async function awaitPageReadyForScreenshot(page, timeoutMs) {
  const budget =
    typeof timeoutMs === "number" && timeoutMs > 0
      ? timeoutMs
      : WORK_SCREENSHOT_TIMEOUT_MS;

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
      await page.evaluate(async () => {
        const pending = Array.from(document.images).filter(
          (image) => !image.complete,
        );

        if (pending.length === 0) {
          return;
        }

        await Promise.all(
          pending.map(
            (image) =>
              new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              }),
          ),
        );
      });
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
 * }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function captureMissingWorkScreenshots(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return Array.isArray(items) ? items : [];
  }

  const root = typeof options.root === "string" ? options.root : process.cwd();
  await attachExistingWorkPosters(items, root);

  const pending = items.filter((item) => contentItemNeedsWorkScreenshot(item));
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

  try {
    for (const item of targets) {
      if (!contentItemNeedsWorkScreenshot(item)) {
        continue;
      }

      // contentItemNeedsWorkScreenshot already requires a plain https URL, so
      // posterAssetPath always returns a local asset path here.
      const workUrl = String(item.url);
      const assetPath = posterAssetPath(workUrl);
      const absolute = absolutePosterPath(root, assetPath);

      try {
        await fs.mkdir(path.dirname(absolute), { recursive: true });
        const context = await browser.newContext({
          viewport: {
            width: WORK_SCREENSHOT_WIDTH,
            height: WORK_SCREENSHOT_HEIGHT,
          },
          userAgent:
            "JoshternetBot/1.0 (+https://joshternet.org; work screenshot)",
        });

        try {
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

  console.log(
    `work screenshots: ${captured} captured (${writingCaptured} writing, ${creativeCaptured} creative); ${remaining} pending remaining`,
  );

  return items;
}
