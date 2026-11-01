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
  POSTER_DIRECTORY,
  POSTER_FETCH_ATTEMPTS,
  POSTER_FETCH_USER_AGENT,
  POSTER_MAX_HEIGHT,
  POSTER_MAX_WIDTH,
  applyPosterAssets,
  fetchPosterBytes,
  materializeActivityPosters,
  materializeSheetMusicPosters,
  posterAssetPath,
  posterSourcesFromViews,
  remainingRemoteShowcasePosters,
  removeUnshownPosters,
  renderSheetMusicPoster,
  resizePoster,
  sheetMusicPosterAssetPath,
  sheetMusicPreviewSvg,
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

test("visitShownPosters includes showcase items and home", () => {
  const views = {
    showcase: {
      items: [{ image: "https://cdn.example/showcase-item.jpg" }],
      home: [{ image: "https://cdn.example/showcase-home.jpg" }],
    },
  };

  assert.deepEqual(posterSourcesFromViews(views).sort(), [
    "https://cdn.example/showcase-home.jpg",
    "https://cdn.example/showcase-item.jpg",
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

test("fetchPosterBytes retries and sends the Joshternet poster User-Agent", async () => {
  /** @type {string[]} */
  const agents = [];
  let calls = 0;
  const png = await solidPng(40, 20, { r: 1, g: 2, b: 3 });

  const bytes = await fetchPosterBytes(
    "https://cdn.example/retry.jpg",
    async (_url, init) => {
      calls += 1;
      agents.push(
        String(
          init && typeof init === "object" && "headers" in init
            ? /** @type {{ headers?: Record<string, string> }} */ (init)
                .headers?.["User-Agent"]
            : "",
        ),
      );

      if (calls === 1) {
        throw new Error("transient");
      }

      return {
        ok: true,
        arrayBuffer: async () =>
          png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      };
    },
  );

  assert.equal(calls, 2);
  assert.equal(agents[0], POSTER_FETCH_USER_AGENT);
  assert.ok(bytes.length > 0);
  assert.equal(POSTER_FETCH_ATTEMPTS, 2);
});

test("remainingRemoteShowcasePosters covers empty, local, and invalid rows", () => {
  assert.deepEqual(remainingRemoteShowcasePosters(null), []);
  assert.deepEqual(remainingRemoteShowcasePosters({}), []);
  assert.deepEqual(
    remainingRemoteShowcasePosters({
      showcase: { items: "nope", home: null },
    }),
    [],
  );
  assert.deepEqual(
    remainingRemoteShowcasePosters({
      showcase: {
        items: [
          null,
          "skip",
          { image: 42 },
          { url: "https://a.example/x", image: "" },
          {
            url: "https://a.example/local",
            image: `/${POSTER_DIRECTORY}/abc.webp`,
          },
          { image: "https://cdn.example/remote.jpg" },
        ],
        home: [
          {
            url: "https://a.example/home",
            image: "http://insecure.example/a.jpg",
          },
        ],
      },
    }),
    [
      { url: "", image: "https://cdn.example/remote.jpg" },
      {
        url: "https://a.example/home",
        image: "http://insecure.example/a.jpg",
      },
    ],
  );
});

test("fetchPosterBytes and materialize cover non-Error throw paths", async () => {
  await assert.rejects(
    () =>
      fetchPosterBytes("https://cdn.example/string-throw.jpg", async () => {
        throw "string-fail";
      }),
    (error) => {
      assert.equal(error, "string-fail");
      return true;
    },
  );

  const posterRoot = path.join(root, `non-error-${Date.now()}`);
  const views = {
    activity: {
      primary: [{ image: "https://cdn.example/a.jpg" }],
    },
    showcase: {
      items: [{ image: "https://cdn.example/b.jpg" }],
      home: [],
    },
  };

  await assert.rejects(
    () =>
      materializeActivityPosters(views, posterRoot, {
        fetchImpl: async () => {
          throw null;
        },
      }),
    /Showcase poster materialize left 1 remote/,
  );
  await fs.rm(posterRoot, { recursive: true, force: true });
});

test("materializeActivityPosters fails closed when Showcase stays remote", async () => {
  const posterRoot = path.join(root, `showcase-remote-${Date.now()}`);
  const views = {
    showcase: {
      items: [
        {
          url: "https://joshbeard.com/photos/2014/",
          title: "2014",
          image: "https://joshbeard.com/photos/2014/cover.jpg",
        },
      ],
      home: [],
    },
  };

  await assert.rejects(
    () =>
      materializeActivityPosters(views, posterRoot, {
        fetchImpl: async () => {
          throw new Error("offline");
        },
      }),
    /Showcase poster materialize left 1 remote/,
  );

  assert.equal(remainingRemoteShowcasePosters(views).length, 1);
  await fs.rm(posterRoot, { recursive: true, force: true });
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

test("sheet music posters are generated for PDF scores without images", async () => {
  const workUrl =
    "https://joshua.seigler.net/music/It%20Is%20Truly%20Meet%20-%20Macedonian.pdf";
  const expected = sheetMusicPosterAssetPath(workUrl);

  assert.match(expected, /^\/assets\/activity\/posters\/[a-f0-9]{64}\.webp$/);
  assert.match(
    sheetMusicPreviewSvg('Meet & "Macedonian"'),
    /Meet &amp; &quot;Macedonian&quot;/,
  );

  const webp = await renderSheetMusicPoster("It Is Truly Meet");
  const meta = await sharp(webp).metadata();

  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 640);
  assert.equal(meta.height, 480);

  const posterRoot = path.join(root, `sheet-${Date.now()}`);
  const views = {
    showcase: {
      items: [
        {
          url: workUrl,
          title: "It Is Truly Meet - Macedonian",
          content_type: "sheet_music",
          kind: "sheet music",
          image: "",
        },
      ],
      home: [],
    },
  };

  await materializeActivityPosters(views, posterRoot, {
    fetchImpl: async () => {
      throw new Error("no remote posters");
    },
  });

  assert.equal(views.showcase.items[0].image, expected);
  await fs.access(path.join(posterRoot, expected.slice(1)));
  await fs.rm(posterRoot, { recursive: true, force: true });
});

// ─── Additional coverage tests for posters.mjs ───────────────────────────────

test("sheetMusicPreviewSvg: title longer than 42 chars is truncated (L267-268)", () => {
  // truncatePreviewTitle truncates at 42 chars when title exceeds that limit.
  const longTitle = "This Is A Very Long Sheet Music Title Exceeding Limit";
  const svg = sheetMusicPreviewSvg(longTitle);
  // Title in SVG is truncated; must contain the ellipsis character.
  assert.match(svg, /…/);
  // Original full title is not present (truncated).
  assert.ok(!svg.includes(longTitle));
});

test("sheetMusicPreviewSvg: empty title uses 'Sheet music' fallback label (L263 + L298)", () => {
  // title is "" → truncatePreviewTitle("", 42) returns "" (falsy) → || "Sheet music" fires at L298.
  // Also exercises the || "" false branch at L263.
  const svg = sheetMusicPreviewSvg("");
  assert.match(svg, /Sheet music/);
  assert.doesNotMatch(svg, /undefined/);
});

test("sheetMusicPosterAssetPath: invalid workUrl returns empty string (L278-279)", () => {
  // typeof workUrl !== "string" OR !workUrl → return ""
  assert.equal(sheetMusicPosterAssetPath(null), "");
  assert.equal(sheetMusicPosterAssetPath(""), "");
  assert.equal(sheetMusicPosterAssetPath(undefined), "");
});

test("materializeSheetMusicPosters: sheet_music with https image skips generation (L368-369)", async () => {
  // needsSheetMusicPoster: image starts with "https://" → return false → card NOT added to work list.
  const views = {
    showcase: {
      items: [
        {
          url: "https://a.example/music/score.pdf",
          title: "My Score",
          content_type: "sheet_music",
          kind: "sheet music",
          image: "https://publisher.example/og-image.jpg",
        },
      ],
    },
  };
  const keepNames = new Set();
  await materializeSheetMusicPosters(views, "/tmp/test-posters", keepNames);
  // Image was NOT replaced (https image skips generation)
  assert.equal(
    views.showcase.items[0].image,
    "https://publisher.example/og-image.jpg",
  );
  assert.equal(keepNames.size, 0);
});

test("materializeSheetMusicPosters: sheet_music with existing local poster adds to keepNames (L408-411)", async () => {
  // needsSheetMusicPoster: image starts with /assets/activity/posters/ → return false.
  // Then the "else" block adds the basename to keepNames.
  const existingPosterPath = `/${POSTER_DIRECTORY}/abc123.webp`;
  const views = {
    showcase: {
      items: [
        {
          url: "https://a.example/music/score.pdf",
          title: "Existing Score",
          content_type: "sheet_music",
          kind: "sheet music",
          image: existingPosterPath,
        },
      ],
    },
  };
  const keepNames = new Set();
  await materializeSheetMusicPosters(views, "/tmp/test-posters", keepNames);
  // Card already has a poster → keepNames preserves it.
  assert.ok(
    keepNames.has("abc123.webp"),
    "existing poster basename must be in keepNames",
  );
});

test("materializeSheetMusicPosters: null item in visitShownPosters callback is skipped (L395-396)", async () => {
  // visitShownPosters calls the callback; when item is not an object, early return fires.
  // We simulate this by passing views that produce a null entry through visitShownPosters.
  // visitShownPosters iterates over array items; null at a position triggers the guard.
  const views = {
    showcase: {
      items: [null, undefined, "string"],
    },
  };
  const keepNames = new Set();
  // Should complete without throwing even with non-object items.
  await materializeSheetMusicPosters(views, "/tmp/test-posters", keepNames);
  assert.equal(keepNames.size, 0);
});

test("materializeSheetMusicPosters: sheet music with non-string image treated as empty (L368 false branch)", async () => {
  // needsSheetMusicPoster: card.image is not a string → false branch → image = "" → still needs poster.
  const tmpDir = await fs.mkdtemp(path.join(root, "non-str-img-"));
  const keepNames = new Set();
  const views = {
    showcase: {
      items: [
        {
          content_type: "sheet_music",
          image: 42, // non-string → false branch at L368
          url: "https://example.com/non-string-image.pdf",
          title: "Non-String Image Test",
        },
      ],
    },
  };
  await materializeSheetMusicPosters(views, tmpDir, keepNames);
  assert.ok(keepNames.size > 0, "poster should have been generated");
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("materializeSheetMusicPosters: card without title falls back to Sheet music (L422 false branch)", async () => {
  // card.title is undefined → String(undefined || "Sheet music") = "Sheet music" at L422.
  const tmpDir = await fs.mkdtemp(path.join(root, "no-title-"));
  const keepNames = new Set();
  const views = {
    showcase: {
      items: [
        {
          content_type: "sheet_music",
          image: "",
          url: "https://example.com/no-title.pdf",
          // no title field
        },
      ],
    },
  };
  await materializeSheetMusicPosters(views, tmpDir, keepNames);
  assert.ok(
    keepNames.size > 0,
    "poster should have been generated for untitled sheet music",
  );
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("materializeSheetMusicPosters: existing poster with same content is not rewritten (L426 false branch)", async () => {
  // Pre-write the poster; second run finds existing.equals(webp) → skip writeFile at L426.
  const tmpDir = await fs.mkdtemp(path.join(root, "same-content-"));
  const keepNames = new Set();
  const workUrl = "https://example.com/same-content-score.pdf";
  const title = "Same Content Piece";
  const assetPath = sheetMusicPosterAssetPath(workUrl);
  const fileName = path.basename(assetPath);

  // Pre-write the identical poster the function would generate.
  const expectedWebp = await renderSheetMusicPoster(title);
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.writeFile(path.join(tmpDir, fileName), expectedWebp);

  const views = {
    showcase: {
      items: [
        {
          content_type: "sheet_music",
          image: "",
          url: workUrl,
          title,
        },
      ],
    },
  };
  await materializeSheetMusicPosters(views, tmpDir, keepNames);
  // File should be kept and added to keepNames without being overwritten.
  assert.ok(keepNames.has(fileName), "fileName must be in keepNames");
  await fs.rm(tmpDir, { recursive: true, force: true });
});
