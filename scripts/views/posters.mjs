/**
 * Goal & Constraints:
 * Shown article and Showcase cards use a local poster sized for the card, not
 * the publisher's full image. Sharp fits each https poster inside 960×540
 * (about 2× a What's New card) without cropping or upscaling, and writes
 * WebP under assets/activity/posters. This runs inside nlp:sync →
 * views:build (GitHub Actions), so the hourly crawl gathers bytes the site
 * can serve without hotlinking. Sheet music without a publisher image gets a
 * generated staff-preview poster (PDF scores are not rasterized). Missing
 * creative https URLs are filled earlier in nlp:sync via
 * enrichContentItemPosters (publisher og:image). Showcase must finish fully
 * localized or materialize throws so CI does not publish remote img srcs.
 * Files stay while the article is in What's New, Search, a topic page, or
 * Showcase, then are removed.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/** @type {number} Max poster width in pixels. */
export const POSTER_MAX_WIDTH = 960;

/** @type {number} Max poster height in pixels. */
export const POSTER_MAX_HEIGHT = 540;

/** @type {number} Sheet-music preview width in pixels. */
export const SHEET_MUSIC_POSTER_WIDTH = 640;

/** @type {number} Sheet-music preview height in pixels. */
export const SHEET_MUSIC_POSTER_HEIGHT = 480;

/** @type {string} Repo-relative directory of generated posters. */
export const POSTER_DIRECTORY = "assets/activity/posters";

/** @type {string} User-Agent for publisher poster downloads during nlp:sync. */
export const POSTER_FETCH_USER_AGENT =
  "JoshternetViews/1.0 (+https://joshternet.org; poster materialize)";

/** @type {number} Per-attempt fetch budget for large photography posters. */
export const POSTER_FETCH_TIMEOUT_MS = 45_000;

/** @type {number} Attempts per poster URL before leaving it remote. */
export const POSTER_FETCH_ATTEMPTS = 2;

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

  const name = crypto.createHash("sha256").update(sourceUrl).digest("hex");

  return `/${POSTER_DIRECTORY}/${name}.webp`;
}

/**
 * Fits a poster inside the card size and encodes WebP.
 * @param {Buffer} input
 * @returns {Promise<Buffer>}
 * @throws {Error} When the bytes are not an image Sharp can read.
 */
export async function resizePoster(input) {
  return sharp(input)
    .resize(POSTER_MAX_WIDTH, POSTER_MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 5,
    })
    .toBuffer();
}

/**
 * Visits article cards that can show a poster.
 * @param {Record<string, unknown> | null | undefined} views
 * @param {(item: unknown) => void} visit
 * @returns {void}
 */
export function visitShownPosters(views, visit) {
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
 * Distinct https poster URLs currently shown.
 * @param {Record<string, unknown> | null | undefined} views
 * @returns {string[]}
 */
export function posterSourcesFromViews(views) {
  /** @type {Set<string>} */
  const sources = new Set();

  visitShownPosters(views, (item) => {
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
    .update(`sheet-music:${workUrl}`)
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
    .webp({
      quality: 82,
      effort: 5,
    })
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
 * Downloads one poster URL with retries, User-Agent, and a generous timeout.
 * @param {string} source
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<Buffer>}
 */
export async function fetchPosterBytes(source, fetchImpl) {
  /** @type {unknown} */
  let lastError = new Error("poster fetch failed");

  for (let attempt = 1; attempt <= POSTER_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(source, {
        headers: {
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          "User-Agent": POSTER_FETCH_USER_AGENT,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(POSTER_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Poster request failed (${response.status})`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
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
 * Downloads, resizes, and rewrites posters for the articles on the site.
 * Part of nlp:sync (GitHub Actions): publisher https images become local
 * `/assets/activity/posters/*.webp` so the static host never hotlinks.
 * @param {Record<string, unknown>} views
 * @param {string} root
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<Record<string, unknown>>}
 * @throws {Error} When Showcase still has remote/invalid images after attempts.
 */
export async function materializeActivityPosters(views, root, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const sources = posterSourcesFromViews(views);
  const directory = path.join(root, POSTER_DIRECTORY);
  /** @type {Map<string, string>} */
  const localBySource = new Map();
  /** @type {Set<string>} */
  const keepNames = new Set();

  await fs.mkdir(directory, { recursive: true });

  for (const source of sources) {
    const assetPath = posterAssetPath(source);
    const fileName = path.basename(assetPath);
    const outputPath = path.join(directory, fileName);

    try {
      const webp = await resizePoster(
        await fetchPosterBytes(source, fetchImpl),
      );
      const existing = await readFileIfExists(outputPath);

      if (!existing || !existing.equals(webp)) {
        await fs.writeFile(outputPath, webp);
      }

      localBySource.set(source, assetPath);
      keepNames.add(fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`poster materialize failed ${source}: ${message}\n`);

      const existing = await readFileIfExists(outputPath);

      if (existing) {
        localBySource.set(source, assetPath);
        keepNames.add(fileName);
      }
    }
  }

  applyPosterAssets(views, localBySource);
  await materializeSheetMusicPosters(views, directory, keepNames);
  await removeUnshownPosters(directory, keepNames);

  const remaining = remainingRemoteShowcasePosters(views);

  if (remaining.length > 0) {
    for (const row of remaining) {
      process.stderr.write(
        `showcase poster not localized: ${row.url || "(missing url)"} (${row.image})\n`,
      );
    }

    throw new Error(
      `Showcase poster materialize left ${remaining.length} remote/invalid image(s); nlp:sync cannot publish until the crawl can fetch them.`,
    );
  }

  return views;
}
