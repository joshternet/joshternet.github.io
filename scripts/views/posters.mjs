/**
 * Goal & Constraints:
 * Shown article cards use a local poster sized for the card, not the
 * publisher's full image. Sharp fits each https poster inside 960×540
 * (about 2× a What's New card) without cropping or upscaling, and writes
 * WebP under assets/activity/posters. Files stay while the article is in
 * What's New, Search, or a topic page, then are removed.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/** @type {number} Max poster width in pixels. */
export const POSTER_MAX_WIDTH = 960;

/** @type {number} Max poster height in pixels. */
export const POSTER_MAX_HEIGHT = 540;

/** @type {string} Repo-relative directory of generated posters. */
export const POSTER_DIRECTORY = "assets/activity/posters";

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

  if (!Array.isArray(neighborhoods)) {
    return;
  }

  for (const neighborhood of neighborhoods) {
    const topic =
      neighborhood && typeof neighborhood === "object"
        ? /** @type {{ recent?: unknown, members?: unknown }} */ (neighborhood)
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
 * Downloads, resizes, and rewrites posters for the articles on the site.
 * @param {Record<string, unknown>} views
 * @param {string} root
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<Record<string, unknown>>}
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
      const response = await fetchImpl(source, {
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        throw new Error(`Poster request failed (${response.status})`);
      }

      const webp = await resizePoster(
        Buffer.from(await response.arrayBuffer()),
      );
      const existing = await readFileIfExists(outputPath);

      if (!existing || !existing.equals(webp)) {
        await fs.writeFile(outputPath, webp);
      }

      localBySource.set(source, assetPath);
      keepNames.add(fileName);
    } catch {
      const existing = await readFileIfExists(outputPath);

      if (existing) {
        localBySource.set(source, assetPath);
        keepNames.add(fileName);
      }
    }
  }

  await removeUnshownPosters(directory, keepNames);
  applyPosterAssets(views, localBySource);

  return views;
}
