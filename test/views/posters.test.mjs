/**
 * Goal: Sharp poster resize, local asset paths, and removal when an
 * article is no longer shown. Fetch is injected because it is the HTTP
 * boundary; Sharp and the filesystem run for real.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  POSTER_MAX_HEIGHT,
  POSTER_MAX_WIDTH,
  applyPosterAssets,
  materializeActivityPosters,
  posterAssetPath,
  posterSourcesFromViews,
  removeUnshownPosters,
  resizePoster,
  visitShownPosters,
} from "../../scripts/views/posters.mjs";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.tmp/poster-tests",
);

/**
 * @param {number} width
 * @param {number} height
 * @param {{ r: number, g: number, b: number }} color
 * @returns {Promise<Buffer>}
 */
function solidPng(width, height, color) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

/**
 * @param {Buffer} body
 * @param {number} [status]
 * @returns {(url: string) => Promise<{ ok: boolean, status: number, arrayBuffer: () => Promise<ArrayBuffer> }>}
 */
function fetchBuffer(body, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
}

test("posterAssetPath hashes https URLs and rejects anything else", () => {
  const asset = posterAssetPath("https://cdn.example/social.jpg");

  assert.match(asset, /^\/assets\/activity\/posters\/[a-f0-9]{64}\.webp$/);
  assert.equal(posterAssetPath("https://cdn.example/social.jpg"), asset);
  assert.equal(posterAssetPath("http://cdn.example/social.jpg"), "");
  assert.equal(posterAssetPath("https://user:secret@cdn.example/a.jpg"), "");
  assert.equal(posterAssetPath("https://["), "");
  assert.equal(posterAssetPath(null), "");
});

test("resizePoster fits inside the card size and does not enlarge", async () => {
  const large = await resizePoster(
    await solidPng(1200, 630, { r: 12, g: 80, b: 200 }),
  );
  const largeMeta = await sharp(large).metadata();

  assert.equal(largeMeta.format, "webp");
  assert.ok((largeMeta.width || 0) <= POSTER_MAX_WIDTH);
  assert.ok((largeMeta.height || 0) <= POSTER_MAX_HEIGHT);
  assert.ok((largeMeta.width || 0) < 1200);

  const small = await resizePoster(
    await solidPng(40, 20, { r: 1, g: 2, b: 3 }),
  );
  const smallMeta = await sharp(small).metadata();

  assert.equal(smallMeta.width, 40);
  assert.equal(smallMeta.height, 20);
});

test("posterSourcesFromViews collects shown https posters once", () => {
  const shared = { image: "https://cdn.example/shared.jpg" };
  const views = {
    activity: {
      primary: [
        null,
        { image: "http://cdn.example/nope.jpg" },
        { image: 12 },
        shared,
      ],
    },
    search_index: {
      documents: [{ image: "https://cdn.example/search.jpg" }],
    },
    topic_views: {
      neighborhoods: [
        null,
        {
          recent: [shared],
          members: [
            null,
            {
              articles: [{ image: "https://cdn.example/topic.jpg" }],
              recent: [{ image: "https://cdn.example/topic.jpg" }],
            },
            { articles: "nope", recent: "nope" },
          ],
        },
        { recent: "nope", members: "nope" },
      ],
    },
  };

  assert.deepEqual(posterSourcesFromViews(views).sort(), [
    "https://cdn.example/search.jpg",
    "https://cdn.example/shared.jpg",
    "https://cdn.example/topic.jpg",
  ]);
});

test("visitShownPosters ignores missing collections", () => {
  /** @type {unknown[]} */
  const seen = [];

  visitShownPosters(undefined, (item) => {
    seen.push(item);
  });
  visitShownPosters(
    {
      activity: "nope",
      search_index: null,
      topic_views: { neighborhoods: "nope" },
    },
    (item) => {
      seen.push(item);
    },
  );

  assert.deepEqual(seen, []);
  assert.deepEqual(posterSourcesFromViews(null), []);
});

test("applyPosterAssets rewrites only posters that were written", () => {
  const views = {
    activity: {
      primary: [
        null,
        { image: 5, image_origin: "https://cdn.example" },
        {
          image: "https://cdn.example/kept.jpg",
          image_origin: "https://cdn.example",
        },
        {
          image: "https://cdn.example/remote.jpg",
          image_origin: "https://cdn.example",
        },
      ],
    },
  };
  const local = posterAssetPath("https://cdn.example/kept.jpg");

  applyPosterAssets(views, new Map([["https://cdn.example/kept.jpg", local]]));

  assert.equal(views.activity.primary[2].image, local);
  assert.equal(views.activity.primary[2].image_origin, "");
  assert.equal(
    views.activity.primary[3].image,
    "https://cdn.example/remote.jpg",
  );
});

test("materializeActivityPosters writes, reuses, and drops unshown posters", async () => {
  const directory = path.join(root, `write-${Date.now()}`);
  const source = "https://cdn.example/social.jpg";
  const png = await solidPng(1000, 500, { r: 30, g: 90, b: 140 });
  const views = {
    activity: {
      primary: [{ image: source, image_origin: "https://cdn.example" }],
    },
  };

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "assets-marker.txt"), "keep");

  const posterRoot = path.join(directory, "repo");

  await materializeActivityPosters(
    views,
    posterRoot,
    // fetch is the HTTP boundary we do not own.
    { fetchImpl: fetchBuffer(png) },
  );

  const asset = views.activity.primary[0].image;
  const filePath = path.join(posterRoot, asset.slice(1));
  const first = readFileSync(filePath);
  const meta = await sharp(first).metadata();

  assert.equal(views.activity.primary[0].image_origin, "");
  assert.equal(meta.format, "webp");
  assert.ok((meta.width || 0) <= POSTER_MAX_WIDTH);

  const orphan = path.join(path.dirname(filePath), "orphan.webp");
  const note = path.join(path.dirname(filePath), "notes.txt");

  await fs.writeFile(orphan, first);
  await fs.writeFile(note, "keep");
  await materializeActivityPosters(
    {
      activity: {
        primary: [{ image: source, image_origin: "https://cdn.example" }],
      },
    },
    posterRoot,
    { fetchImpl: fetchBuffer(png) },
  );

  const second = readFileSync(filePath);

  assert.equal(Buffer.compare(first, second), 0);
  await assert.rejects(fs.stat(orphan));
  assert.equal(readFileSync(note, "utf8"), "keep");

  const changed = await solidPng(900, 400, { r: 200, g: 10, b: 10 });

  await materializeActivityPosters(
    {
      activity: {
        primary: [{ image: source, image_origin: "https://cdn.example" }],
      },
    },
    posterRoot,
    { fetchImpl: fetchBuffer(changed) },
  );

  const third = readFileSync(filePath);

  assert.notEqual(Buffer.compare(first, third), 0);

  await materializeActivityPosters({ activity: { primary: [] } }, posterRoot);

  await assert.rejects(fs.stat(filePath));
  await fs.rm(directory, { recursive: true, force: true });
});

test("materializeActivityPosters keeps a previous file when the download fails", async () => {
  const posterRoot = path.join(root, `fail-${Date.now()}`);
  const source = "https://cdn.example/social.jpg";
  const png = await solidPng(80, 40, { r: 9, g: 9, b: 9 });
  const views = {
    activity: {
      primary: [{ image: source, image_origin: "https://cdn.example" }],
    },
  };

  await materializeActivityPosters(views, posterRoot, {
    fetchImpl: fetchBuffer(png),
  });

  const saved = views.activity.primary[0].image;

  views.activity.primary[0].image = source;
  views.activity.primary[0].image_origin = "https://cdn.example";

  await materializeActivityPosters(views, posterRoot, {
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  assert.equal(views.activity.primary[0].image, saved);

  const otherRoot = path.join(root, `bad-${Date.now()}`);

  const badImage = await materializeActivityPosters(
    {
      activity: {
        primary: [
          {
            image: "https://cdn.example/missing.jpg",
            image_origin: "https://cdn.example",
          },
        ],
      },
    },
    otherRoot,
    { fetchImpl: fetchBuffer(Buffer.from("not-an-image"), 200) },
  );

  assert.equal(
    badImage.activity.primary[0].image,
    "https://cdn.example/missing.jpg",
  );
  await fs.rm(otherRoot, { recursive: true, force: true });

  const afterFailure = await materializeActivityPosters(
    {
      activity: {
        primary: [{ image: source, image_origin: "https://cdn.example" }],
      },
    },
    posterRoot,
    { fetchImpl: fetchBuffer(png, 404) },
  );

  assert.equal(afterFailure.activity.primary[0].image, saved);

  await fs.rm(posterRoot, { recursive: true, force: true });
});

test("removeUnshownPosters ignores a missing directory and rethrows other errors", async () => {
  await removeUnshownPosters(path.join(root, "missing-dir"), new Set());

  const blocking = path.join(root, `not-a-dir-${Date.now()}`);

  await fs.mkdir(path.dirname(blocking), { recursive: true });
  await fs.writeFile(blocking, "x");
  await assert.rejects(removeUnshownPosters(blocking, new Set()));
  await fs.rm(blocking, { force: true });
});

test("materializeActivityPosters rethrows unexpected read errors", async () => {
  const posterRoot = path.join(root, `eisdir-${Date.now()}`);
  const source = "https://cdn.example/blocked.jpg";
  const asset = posterAssetPath(source);
  const outputPath = path.join(posterRoot, asset.slice(1));
  const png = await solidPng(16, 16, { r: 4, g: 4, b: 4 });

  await fs.mkdir(outputPath, { recursive: true });

  await assert.rejects(
    materializeActivityPosters(
      {
        activity: { primary: [{ image: source }] },
      },
      posterRoot,
      { fetchImpl: fetchBuffer(png) },
    ),
  );

  await fs.rm(posterRoot, { recursive: true, force: true });
});
