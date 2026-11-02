/**
 * Goal: Sharp poster resize, local asset paths, and removal when an
 * article is no longer shown. Fetch is injected because it is the HTTP
 * boundary; Sharp and the filesystem run for real.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { dnsCache } from "../helpers/mock-fetch.mjs";

import {
  POSTER_DIRECTORY,
  POSTER_FETCH_ATTEMPTS,
  POSTER_FETCH_USER_AGENT,
  POSTER_MAX_HEIGHT,
  POSTER_MAX_WIDTH,
  applyPosterAssets,
  fetchPosterBytes,
  assertShowcasePostersLocalized,
  materializeActivityPosters,
  materializeSheetMusicPosters,
  posterAssetPath,
  posterCacheSourcesFromViews,
  posterSourcesFromViews,
  remainingRemoteShowcasePosters,
  removeUnshownPosters,
  renderSheetMusicPoster,
  resizePoster,
  sheetMusicPosterAssetPath,
  sheetMusicPreviewSvg,
  visitPriorityPosters,
  visitShownPosters,
} from "../../scripts/views/posters.mjs";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.tmp/poster-tests",
);

/** Offline tests do not load live robots.txt. */
const ALLOW_ALL_ROBOTS = {
  allows: async () => true,
  bodyForOrigin: async () => "",
};

/**
 * Swallow expected soft-fail noise (failed fetches) in offline poster tests.
 * @param {string} _message
 */
function muteLogError(_message) {}

/**
 * Swallow progress logs in offline poster tests.
 * @param {string} _message
 */
function muteLog(_message) {}

/**
 * Collect soft-fail messages so expected materialize skips assert green.
 * @returns {{ lines: string[], logError: (message: string) => void }}
 */
function captureLogError() {
  /** @type {string[]} */
  const lines = [];
  return {
    lines,
    logError(message) {
      lines.push(String(message));
    },
  };
}

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

test("posterSourcesFromViews collects only Activity + Showcase https posters", () => {
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

  assert.deepEqual(posterSourcesFromViews(views), [
    "https://cdn.example/shared.jpg",
  ]);
  assert.deepEqual(posterCacheSourcesFromViews(views).sort(), [
    "https://cdn.example/search.jpg",
    "https://cdn.example/shared.jpg",
    "https://cdn.example/topic.jpg",
  ]);
});

test("visitPriorityPosters and visitShownPosters include showcase items and home", () => {
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

  /** @type {unknown[]} */
  const priority = [];
  visitPriorityPosters(views, (item) => {
    priority.push(item);
  });
  assert.equal(priority.length, 2);
});

test("visitShownPosters ignores missing collections", () => {
  /** @type {unknown[]} */
  const seen = [];

  visitShownPosters(undefined, (item) => {
    seen.push(item);
  });
  visitPriorityPosters(undefined, (item) => {
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
  assert.deepEqual(posterCacheSourcesFromViews(null), []);
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

test("fetchPosterBytes skips URLs robots.txt disallows", async () => {
  let calls = 0;

  await assert.rejects(
    () =>
      fetchPosterBytes(
        "https://cdn.example/blocked.jpg",
        async () => {
          calls += 1;
          throw new Error("should not fetch");
        },
        {
          robotsGate: {
            allows: async () => false,
            bodyForOrigin: async () => "",
          },
        },
      ),
    /disallowed by robots\.txt/,
  );
  assert.equal(calls, 0);
});

test("fetchPosterBytes retries and sends the JoshBot User-Agent", async () => {
  /** @type {string[]} */
  const agents = [];
  let calls = 0;
  const png = await solidPng(40, 20, { r: 1, g: 2, b: 3 });

  await assert.rejects(
    () =>
      fetchPosterBytes(
        "https://cdn.example/missing.jpg",
        async () => ({
          ok: false,
          status: 404,
          arrayBuffer: async () => new ArrayBuffer(0),
        }),
        { robotsGate: ALLOW_ALL_ROBOTS },
      ),
    /Poster request failed \(404\)/,
  );

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
    {
      robotsGate: {
        allows: async () => true,
        bodyForOrigin: async () => "",
      },
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
      fetchPosterBytes(
        "https://cdn.example/string-throw.jpg",
        async () => {
          throw "string-fail";
        },
        { robotsGate: ALLOW_ALL_ROBOTS },
      ),
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
        robotsGate: ALLOW_ALL_ROBOTS,
        logError: muteLogError,
        log: muteLog,
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
        robotsGate: ALLOW_ALL_ROBOTS,
        logError: muteLogError,
        log: muteLog,
        fetchImpl: async () => {
          throw new Error("offline");
        },
      }),
    /Showcase poster materialize left 1 remote/,
  );

  assert.equal(remainingRemoteShowcasePosters(views).length, 1);
  await fs.rm(posterRoot, { recursive: true, force: true });
});

test("materializeActivityPosters can soft-skip Showcase gate for snapshot fallback", async () => {
  const posterRoot = path.join(root, `showcase-soft-${Date.now()}`);
  const views = {
    showcase: {
      items: [
        {
          url: "https://joshuadrake.org/projects/turboelectriccessna",
          image: "https://joshuadrake.org/images/cessnatest.gif",
        },
      ],
      home: [],
    },
  };

  await materializeActivityPosters(views, posterRoot, {
    robotsGate: ALLOW_ALL_ROBOTS,
    logError: muteLogError,
    log: muteLog,
    requireLocalizedShowcase: false,
    fetchImpl: async () => {
      throw new Error("Input buffer has corrupt header");
    },
  });

  assert.equal(remainingRemoteShowcasePosters(views).length, 1);
  assert.throws(
    () => assertShowcasePostersLocalized(views, { logError: muteLogError }),
    /capture a page snapshot/,
  );
  await fs.rm(posterRoot, { recursive: true, force: true });
});

test("materializeActivityPosters writes, reuses cache, and drops unshown posters", async () => {
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
  let fetches = 0;
  const countingFetch = async () => {
    fetches += 1;
    return fetchBuffer(png)();
  };

  await materializeActivityPosters(
    views,
    posterRoot,
    // fetch is the HTTP boundary we do not own.
    {
      robotsGate: ALLOW_ALL_ROBOTS,
      logError: muteLogError,
      log: muteLog,
      fetchImpl: countingFetch,
    },
  );

  const asset = views.activity.primary[0].image;
  const filePath = path.join(posterRoot, asset.slice(1));
  const first = readFileSync(filePath);
  const meta = await sharp(first).metadata();

  assert.equal(fetches, 1);
  assert.equal(views.activity.primary[0].image_origin, "");
  assert.equal(meta.format, "webp");
  assert.ok((meta.width || 0) <= POSTER_MAX_WIDTH);

  const orphan = path.join(path.dirname(filePath), "orphan.webp");
  const note = path.join(path.dirname(filePath), "notes.txt");

  await fs.writeFile(orphan, first);
  await fs.writeFile(note, "keep");
  fetches = 0;
  await materializeActivityPosters(
    {
      activity: {
        primary: [{ image: source, image_origin: "https://cdn.example" }],
      },
      search_index: {
        documents: [{ image: source, image_origin: "https://cdn.example" }],
      },
    },
    posterRoot,
    {
      robotsGate: ALLOW_ALL_ROBOTS,
      logError: muteLogError,
      log: muteLog,
      fetchImpl: countingFetch,
    },
  );

  const second = readFileSync(filePath);

  assert.equal(fetches, 0);
  assert.equal(Buffer.compare(first, second), 0);
  await assert.rejects(fs.stat(orphan));
  assert.equal(readFileSync(note, "utf8"), "keep");

  const changed = await solidPng(900, 400, { r: 200, g: 10, b: 10 });
  fetches = 0;

  await materializeActivityPosters(
    {
      activity: {
        primary: [{ image: source, image_origin: "https://cdn.example" }],
      },
    },
    posterRoot,
    {
      robotsGate: ALLOW_ALL_ROBOTS,
      logError: muteLogError,
      log: muteLog,
      fetchImpl: async () => {
        fetches += 1;
        return fetchBuffer(changed)();
      },
    },
  );

  const third = readFileSync(filePath);

  // Cached WebP wins — publisher bytes are not re-downloaded.
  assert.equal(fetches, 0);
  assert.equal(Buffer.compare(first, third), 0);

  await materializeActivityPosters({ activity: { primary: [] } }, posterRoot, {
    robotsGate: ALLOW_ALL_ROBOTS,
    logError: muteLogError,
    log: muteLog,
  });

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
  const softFails = captureLogError();

  await materializeActivityPosters(views, posterRoot, {
    robotsGate: ALLOW_ALL_ROBOTS,
    logError: muteLogError,
    log: muteLog,
    fetchImpl: fetchBuffer(png),
  });

  const saved = views.activity.primary[0].image;

  views.activity.primary[0].image = source;
  views.activity.primary[0].image_origin = "https://cdn.example";

  // Cached file short-circuits the network — offline fetch is never called.
  await materializeActivityPosters(views, posterRoot, {
    robotsGate: ALLOW_ALL_ROBOTS,
    logError: softFails.logError,
    log: muteLog,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });

  assert.equal(views.activity.primary[0].image, saved);
  assert.equal(softFails.lines.length, 0);

  const otherRoot = path.join(root, `bad-${Date.now()}`);
  const badImageFails = captureLogError();

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
    {
      robotsGate: ALLOW_ALL_ROBOTS,
      logError: badImageFails.logError,
      log: muteLog,
      fetchImpl: fetchBuffer(Buffer.from("not-an-image"), 200),
    },
  );

  assert.equal(
    badImage.activity.primary[0].image,
    "https://cdn.example/missing.jpg",
  );
  assert.ok(
    badImageFails.lines.some((line) =>
      line.includes("poster materialize failed"),
    ),
    "expected invalid-image soft-fail was reported",
  );
  await fs.rm(otherRoot, { recursive: true, force: true });

  const afterFails = captureLogError();
  const assetPath = posterAssetPath(source);
  const outputPath = path.join(posterRoot, assetPath.slice(1));
  await fs.rm(outputPath, { force: true });
  views.activity.primary[0].image = source;
  views.activity.primary[0].image_origin = "https://cdn.example";

  // Fetch boundary throws after a prior file appears — keep the on-disk poster.
  const afterFailure = await materializeActivityPosters(
    {
      activity: {
        primary: [{ image: source, image_origin: "https://cdn.example" }],
      },
    },
    posterRoot,
    {
      robotsGate: ALLOW_ALL_ROBOTS,
      logError: afterFails.logError,
      log: muteLog,
      fetchImpl: async () => {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, await resizePoster(png));
        throw new Error("offline after staging");
      },
    },
  );

  assert.equal(afterFailure.activity.primary[0].image, saved);
  assert.ok(
    afterFails.lines.some((line) => line.includes("poster materialize failed")),
    "expected offline soft-fail was reported",
  );

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
      {
        robotsGate: ALLOW_ALL_ROBOTS,
        logError: muteLogError,
        log: muteLog,
        fetchImpl: fetchBuffer(png),
      },
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
    robotsGate: ALLOW_ALL_ROBOTS,
    logError: muteLogError,
    log: muteLog,
    fetchImpl: async () => {
      throw new Error("no remote posters");
    },
  });

  assert.equal(views.showcase.items[0].image, expected);
  await fs.access(path.join(posterRoot, expected.slice(1)));
  await fs.rm(posterRoot, { recursive: true, force: true });
});

test("materializeActivityPosters keeps pre-localized Playwright posters", async () => {
  const posterRoot = path.join(root, `local-keep-${Date.now()}`);
  const workUrl = "https://themorning.app/";
  const local = posterAssetPath(workUrl);
  const relative = local.replace(/^\//, "");
  const absolute = path.join(posterRoot, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, await solidPng(64, 36, { r: 12, g: 34, b: 56 }));

  const views = {
    showcase: {
      items: [
        null,
        {
          url: workUrl,
          title: "The Morning App",
          content_type: "project",
          image: local,
        },
        { url: "https://joshgr.com/wizardly-words/", image: 7 },
      ],
      home: [],
    },
  };

  await materializeActivityPosters(views, posterRoot, {
    robotsGate: ALLOW_ALL_ROBOTS,
    logError: muteLogError,
    log: muteLog,
    fetchImpl: async () => {
      throw new Error("no remote posters");
    },
  });

  assert.equal(views.showcase.items[1].image, local);
  await fs.access(absolute);
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

test("fetchPosterBytes and materialize create a default robots gate", async () => {
  const png = await solidPng(32, 16, { r: 9, g: 8, b: 7 });
  const fetchPublicText = async () => ({
    url: "https://cdn.example/robots.txt",
    contentType: "text/plain",
    body: "User-agent: *\nAllow: /\n",
  });
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "image/png" }),
    arrayBuffer: async () => png,
  });

  const bytes = await fetchPosterBytes(
    "https://cdn.example/default-gate.jpg",
    fetchImpl,
    { fetchPublicText, cache: dnsCache(["cdn.example"]) },
  );
  assert.ok(bytes.byteLength > 0);

  const posterRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "poster-default-gate-"),
  );
  const views = {
    activity: {
      primary: [
        {
          url: "https://a.example/p/",
          image: "https://cdn.example/default-gate.jpg",
        },
      ],
    },
    showcase: { items: [] },
  };
  await materializeActivityPosters(views, posterRoot, {
    fetchImpl,
    fetchPublicText,
    cache: dnsCache(["cdn.example"]),
    logError: muteLogError,
    log: muteLog,
  });
  assert.match(
    String(views.activity.primary[0].image),
    /\/assets\/activity\/posters\//,
  );
  await fs.rm(posterRoot, { recursive: true, force: true });
});

test("assertShowcasePostersLocalized defaults logError to stderr", () => {
  const views = {
    showcase: {
      items: [
        {
          url: "https://a.example/work/",
          image: "https://cdn.example/gone.jpg",
        },
      ],
      home: [],
    },
  };
  /** @type {string[]} */
  const errLines = [];
  const originalErr = process.stderr.write.bind(process.stderr);
  process.stderr.write = /** @type {typeof process.stderr.write} */ (
    (chunk, encoding, callback) => {
      errLines.push(String(chunk));
      if (typeof encoding === "function") {
        encoding();
        return true;
      }
      if (typeof callback === "function") {
        callback();
      }
      return true;
    }
  );

  try {
    assert.throws(
      () => assertShowcasePostersLocalized(views),
      /Showcase poster materialize left 1 remote/,
    );
  } finally {
    process.stderr.write = originalErr;
  }

  assert.ok(
    errLines.some((line) => line.includes("showcase poster not localized")),
  );
});

test("assertShowcasePostersLocalized no-ops when Showcase is local", () => {
  assert.doesNotThrow(() =>
    assertShowcasePostersLocalized({
      showcase: {
        items: [
          {
            url: "https://a.example/work/",
            image: "/assets/activity/posters/abc.webp",
          },
        ],
        home: [],
      },
    }),
  );
});

test("materializeActivityPosters defaults logError to stderr and log to stdout", async () => {
  const posterRoot = path.join(root, `stderr-log-${Date.now()}`);
  const views = {
    showcase: {
      items: [
        {
          url: "https://a.example/work/",
          image: "https://cdn.example/gone.jpg",
        },
      ],
      home: [],
    },
  };
  /** @type {string[]} */
  const errLines = [];
  /** @type {string[]} */
  const outLines = [];
  const originalErr = process.stderr.write.bind(process.stderr);
  const originalOut = process.stdout.write.bind(process.stdout);
  /**
   * @param {string[]} sink
   * @returns {typeof process.stderr.write}
   */
  const captureWrite = (sink) =>
    /** @type {typeof process.stderr.write} */ (
      (chunk, encoding, callback) => {
        sink.push(String(chunk));
        if (typeof encoding === "function") {
          encoding();
          return true;
        }
        if (typeof callback === "function") {
          callback();
        }
        return true;
      }
    );
  process.stderr.write = captureWrite(errLines);
  process.stdout.write = captureWrite(outLines);

  try {
    await assert.rejects(
      () =>
        materializeActivityPosters(views, posterRoot, {
          robotsGate: ALLOW_ALL_ROBOTS,
          fetchImpl: async () => {
            throw new Error("offline");
          },
        }),
      /Showcase poster materialize left 1 remote/,
    );
  } finally {
    process.stderr.write = originalErr;
    process.stdout.write = originalOut;
  }

  assert.ok(
    errLines.some((line) => line.includes("poster materialize failed")),
    "expected materialize failure on stderr",
  );
  assert.ok(
    errLines.some((line) => line.includes("showcase poster not localized")),
    "expected localization warning on stderr",
  );
  assert.ok(
    outLines.some((line) => line.includes("posters:")),
    "expected progress on stdout",
  );
  await fs.rm(posterRoot, { recursive: true, force: true });
});
