/**
 * Goal & Constraints:
 * Offline coverage for generalized content screenshot capture. Playwright is
 * injected; no live browser or network. Temp dirs only for written WebP bytes.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { posterAssetPath } from "../../scripts/views/posters.mjs";
import {
  MAX_CREATIVE_SCREENSHOTS_PER_SYNC,
  MAX_WORK_SCREENSHOTS_PER_SYNC,
  MAX_WRITING_SCREENSHOTS_PER_SYNC,
  WORK_SCREENSHOT_IMAGE_WAIT_MS,
  WORK_SCREENSHOT_SETTLE_MS,
  attachExistingWorkPosters,
  awaitPageReadyForScreenshot,
  captureMissingWorkScreenshots,
  captureShowcasePosterFallbacks,
  collectProjectionItemsNeedingPosters,
  compareScreenshotPriority,
  contentItemNeedsWorkScreenshot,
  isScreenshotEligibleContentType,
  isWritingScreenshotItem,
  screenshotContentType,
  selectScreenshotTargets,
} from "../../scripts/views/work-screenshots.mjs";

/**
 * Minimal Playwright page mock for capture tests.
 * @param {{
 *   goto?: (url: string, opts?: Record<string, unknown>) => Promise<void>,
 *   screenshot?: () => Promise<Buffer>,
 *   route?: (pattern: string, handler: Function) => Promise<void>,
 *   url?: () => string,
 * }} [hooks]
 * @returns {Record<string, unknown>}
 */
function mockCapturePage(hooks = {}) {
  /** @type {Record<string, unknown>} */
  const page = {
    goto:
      hooks.goto ||
      (async () => {
        /* no-op */
      }),
    waitForLoadState: async () => {},
    waitForTimeout: async () => {},
    evaluate: async () => {},
    screenshot:
      hooks.screenshot ||
      (async () => {
        throw new Error("screenshot mock missing");
      }),
  };

  if (typeof hooks.route === "function") {
    page.route = hooks.route;
  }

  if (typeof hooks.url === "function") {
    page.url = hooks.url;
  }

  return page;
}

/**
 * Collect progress lines so expected capture summaries assert green without
 * dumping white console output that looks like suite noise.
 * @returns {{ lines: string[], log: (message: string) => void }}
 */
function captureLog() {
  /** @type {string[]} */
  const lines = [];
  return {
    lines,
    log(message) {
      lines.push(String(message));
    },
  };
}

/**
 * Swallow expected progress output in offline screenshot tests.
 * @param {string} _message
 */
function muteLog(_message) {}

/**
 * Fake DNS for offline assertPublicURL. Literal IPs keep their address.
 * @param {string} hostname
 * @returns {Promise<Array<{ address: string, family: number }>>}
 */
async function publicLookup(hostname) {
  const host = String(hostname || "");

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return [{ address: host, family: 4 }];
  }

  if (host.includes(":")) {
    return [{ address: host, family: 6 }];
  }

  return [{ address: "1.1.1.1", family: 4 }];
}

/**
 * Tiny valid PNG via sharp for mock screenshot bytes.
 * @returns {Promise<Buffer>}
 */
async function tinyPng() {
  return sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 20, g: 40, b: 80 },
    },
  })
    .png()
    .toBuffer();
}

test("screenshot helpers classify types and priority", () => {
  assert.equal(screenshotContentType({}), "article");
  assert.equal(screenshotContentType({ content_type: "note" }), "note");
  assert.equal(isScreenshotEligibleContentType("game"), true);
  assert.equal(isScreenshotEligibleContentType("music_album"), true);
  assert.equal(isScreenshotEligibleContentType("article"), true);
  assert.equal(isScreenshotEligibleContentType("oddity"), false);
  assert.equal(MAX_WORK_SCREENSHOTS_PER_SYNC, 48);
  assert.equal(MAX_WRITING_SCREENSHOTS_PER_SYNC, 16);
  assert.equal(MAX_CREATIVE_SCREENSHOTS_PER_SYNC, 32);
  assert.equal(isWritingScreenshotItem({ content_type: "article" }), true);
  assert.equal(isWritingScreenshotItem({ content_type: "project" }), false);

  assert.ok(
    compareScreenshotPriority(
      { content_type: "project", published_at: "2020-01-01T00:00:00.000Z" },
      { content_type: "article", published_at: "2026-01-01T00:00:00.000Z" },
    ) < 0,
  );
  assert.ok(
    compareScreenshotPriority(
      { content_type: "article", published_at: "2026-02-01T00:00:00.000Z" },
      { content_type: "article", published_at: "2026-01-01T00:00:00.000Z" },
    ) < 0,
  );
  assert.equal(
    compareScreenshotPriority(
      { content_type: "game" },
      { content_type: "project" },
    ),
    0,
  );
});

test("contentItemNeedsWorkScreenshot gates card-worthy drafts", () => {
  assert.equal(contentItemNeedsWorkScreenshot(null), false);
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://a.example/post/",
      content_type: "article",
      site_origin: "https://a.example",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://a.example/notes/1/",
      content_type: "note",
      site_origin: "https://a.example",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://a.example/games/x/",
      content_type: "game",
      site_origin: "https://a.example",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://a.example/album/",
      content_type: "music_album",
      site_origin: "https://a.example",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://a.example/post/",
      site_origin: "https://a.example",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
      image: "https://cdn.example/og.png",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
      image: "/assets/activity/posters/abc.webp",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "http://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://exa mple.com/",
      content_type: "project",
      site_origin: "https://joshgr.com",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://user:secret@themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://a.example/odd/",
      content_type: "oddity",
      site_origin: "https://a.example",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://joshternet.org/network/",
      content_type: "article",
      site_origin: "https://joshternet.org",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://joshgr.com/",
      content_type: "project",
      site_origin: "https://joshgr.com",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://joshtronic.com/games/",
      content_type: "project",
      site_origin: "https://joshtronic.com",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsWorkScreenshot({
      url: "https://www.youtube.com/@asite",
      content_type: "video",
      site_origin: "https://a.example",
      source: { kind: "elsewhere-channel" },
    }),
    true,
  );
});

test("attachExistingWorkPosters reuses on-disk channel posters", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "poster-attach-"));
  const channel = {
    url: "https://www.youtube.com/@asite",
    content_type: "video",
    site_origin: "https://a.example",
  };
  const assetPath = posterAssetPath(channel.url);
  const absolute = path.join(dir, assetPath.replace(/^\//, ""));

  try {
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, await tinyPng());
    const attached = await attachExistingWorkPosters([channel], dir);
    assert.equal(attached, 1);
    assert.equal(channel.image, assetPath);
    assert.equal(await attachExistingWorkPosters([], dir), 0);
    assert.equal(await attachExistingWorkPosters(null, dir), 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("collectProjectionItemsNeedingPosters dedupes Showcase and Activity rows", () => {
  const shared = {
    url: "https://www.youtube.com/@asite",
    content_type: "video",
    title: "A on YouTube",
  };
  const items = collectProjectionItemsNeedingPosters({
    showcase: {
      items: [
        shared,
        null,
        { url: "", content_type: "game" },
        { url: "https://a.example/games/x/", content_type: "game" },
      ],
      home: [shared],
    },
    activity: {
      primary: [
        shared,
        { url: "https://a.example/post/", content_type: "article" },
      ],
    },
  });

  assert.equal(items.length, 3);
  assert.equal(items.filter((item) => item.url === shared.url).length, 1);
  assert.deepEqual(collectProjectionItemsNeedingPosters(null), []);
  assert.deepEqual(collectProjectionItemsNeedingPosters({}), []);
  assert.deepEqual(
    collectProjectionItemsNeedingPosters({
      showcase: { items: "nope", home: null },
      activity: { primary: undefined },
    }),
    [],
  );
});

test("attachExistingWorkPosters skips items that already have images", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "poster-skip-"));

  try {
    const attached = await attachExistingWorkPosters(
      [
        {
          url: "https://www.youtube.com/@filled",
          content_type: "video",
          image: "https://cdn.example/og.png",
        },
        {
          url: "https://www.youtube.com/@missing",
          content_type: "video",
        },
      ],
      dir,
    );
    assert.equal(attached, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("selectScreenshotTargets reserves writing slots under creative backlog", () => {
  /** @type {Array<Record<string, unknown>>} */
  const pending = [];

  for (let index = 0; index < 40; index += 1) {
    pending.push({
      url: `https://a.example/games/${index}/`,
      content_type: "game",
      published_at: `2020-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    });
  }

  pending.push({
    url: "https://joshtronic.com/2026/11/01/open-to-work/",
    content_type: "article",
    published_at: "2026-11-01T00:00:00.000Z",
  });
  pending.push({
    url: "https://joshtronic.com/2026/10/01/older/",
    content_type: "article",
    published_at: "2026-10-01T00:00:00.000Z",
  });

  const selected = selectScreenshotTargets(pending, 48);
  const writing = selected.filter((item) => isWritingScreenshotItem(item));
  const creative = selected.filter((item) => !isWritingScreenshotItem(item));

  assert.equal(selected.length, 42);
  assert.equal(writing.length, 2);
  assert.equal(creative.length, 40);
  assert.equal(
    writing[0].url,
    "https://joshtronic.com/2026/11/01/open-to-work/",
  );

  const capped = selectScreenshotTargets(pending, 48, {
    writingReserve: 16,
    creativePrefer: 32,
  });

  assert.equal(capped.length, 42);
  assert.ok(capped.some((item) => isWritingScreenshotItem(item)));

  const writingOnly = selectScreenshotTargets(
    pending.filter((item) => isWritingScreenshotItem(item)),
    8,
  );

  assert.equal(writingOnly.length, 2);

  const creativeOnly = selectScreenshotTargets(
    pending.filter((item) => !isWritingScreenshotItem(item)),
    8,
  );

  assert.equal(creativeOnly.length, 8);
  assert.equal(selectScreenshotTargets([], 48).length, 0);
  assert.equal(selectScreenshotTargets(null, 48).length, 0);
  assert.equal(selectScreenshotTargets(pending, 0).length, 0);
  assert.equal(
    selectScreenshotTargets(pending).filter((item) =>
      isWritingScreenshotItem(item),
    ).length,
    2,
  );
  assert.equal(
    selectScreenshotTargets(pending, 5, {
      writingReserve: -1,
      creativePrefer: "nope",
    }).length,
    5,
  );

  const writingFill = selectScreenshotTargets(
    [
      {
        url: "https://a.example/a/",
        content_type: "article",
        published_at: "2026-01-01T00:00:00.000Z",
      },
      {
        url: "https://a.example/b/",
        content_type: "article",
        published_at: "2026-02-01T00:00:00.000Z",
      },
      {
        url: "https://a.example/c/",
        content_type: "note",
        published_at: "2026-03-01T00:00:00.000Z",
      },
    ],
    5,
    { writingReserve: 1, creativePrefer: 32 },
  );

  assert.equal(writingFill.length, 3);
  assert.equal(writingFill[0].url, "https://a.example/c/");
});

test("awaitPageReadyForScreenshot waits load then soft networkidle and settle", async () => {
  /** @type {string[]} */
  const states = [];
  let settleMs = 0;

  await awaitPageReadyForScreenshot(
    {
      waitForLoadState: async (state) => {
        states.push(state);

        if (state === "networkidle") {
          throw new Error("still chatting");
        }
      },
      waitForTimeout: async (ms) => {
        settleMs = ms;
      },
      evaluate: async (fn, arg) => fn(arg),
    },
    5_000,
  );

  assert.deepEqual(states, ["load", "networkidle"]);
  assert.equal(settleMs, WORK_SCREENSHOT_SETTLE_MS);

  await awaitPageReadyForScreenshot({});

  const previousDocument = globalThis.document;
  const incompleteLoad = {
    complete: false,
    /**
     * @param {string} type
     * @param {() => void} handler
     */
    addEventListener(type, handler) {
      if (type === "load") {
        queueMicrotask(handler);
      }
    },
  };
  const incompleteError = {
    complete: false,
    /**
     * @param {string} type
     * @param {() => void} handler
     */
    addEventListener(type, handler) {
      if (type === "error") {
        queueMicrotask(handler);
      }
    },
  };
  const neverSettles = {
    complete: false,
    /**
     * @param {string} _type
     * @param {() => void} _handler
     */
    addEventListener(_type, _handler) {
      // Intentionally never fires — hung lazy/broken images must not block sync.
    },
  };

  globalThis.document = {
    images: [incompleteLoad, incompleteError, { complete: true }],
  };

  try {
    await awaitPageReadyForScreenshot({
      waitForLoadState: async (state) => {
        if (state === "load") {
          throw new Error("load timeout");
        }
      },
      waitForTimeout: async () => {},
      evaluate: async (fn, arg) => fn(arg),
    });

    globalThis.document = { images: [] };
    await awaitPageReadyForScreenshot({
      waitForLoadState: async () => {},
      waitForTimeout: async () => {},
      evaluate: async (fn, arg) => fn(arg),
    });

    await awaitPageReadyForScreenshot({
      waitForLoadState: async () => {},
      waitForTimeout: async () => {},
      evaluate: async () => {
        throw new Error("page closed");
      },
    });

    globalThis.document = { images: [neverSettles] };
    assert.ok(WORK_SCREENSHOT_IMAGE_WAIT_MS > 0);
    const hungStarted = Date.now();
    await awaitPageReadyForScreenshot(
      {
        waitForLoadState: async () => {},
        waitForTimeout: async () => {},
        evaluate: async (fn, arg) => fn(arg),
      },
      200,
    );
    assert.ok(
      Date.now() - hungStarted < 1_500,
      "incomplete images without load/error must soft-timeout",
    );
  } finally {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  }
});

test("captureMissingWorkScreenshots writes local poster via mocked Playwright", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-shots-"));
  const png = await tinyPng();
  const items = [
    {
      url: "https://themorning.app/",
      content_type: "project",
      title: "The Morning App",
      site_origin: "https://joshgr.com",
      image: "",
    },
    {
      url: "https://joshgr.com/wizardly-words/",
      content_type: "project",
      title: "Wizardly Words",
      site_origin: "https://joshgr.com",
      image: "https://already.example/og.png",
    },
  ];

  /** @type {string[]} */
  const visited = [];
  /** @type {unknown} */
  let gotoWaitUntil;
  const { lines, log } = captureLog();

  await captureMissingWorkScreenshots(items, {
    root,
    maxCaptures: 5,
    log,
    lookup: publicLookup,
    importPlaywright: async () => ({
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () =>
              mockCapturePage({
                goto: async (url, opts) => {
                  visited.push(url);
                  gotoWaitUntil = opts?.waitUntil;
                },
                screenshot: async () => png,
                url: () => "https://themorning.app/",
                route: async (_pattern, handler) => {
                  await handler({
                    request: () => ({
                      url: () => "https://themorning.app/asset.js",
                    }),
                    abort: async () => {},
                    continue: async () => {},
                  });
                },
              }),
            close: async () => {},
          }),
          close: async () => {},
        }),
      },
    }),
  });

  assert.deepEqual(visited, ["https://themorning.app/"]);
  assert.equal(gotoWaitUntil, "load");
  const asset = posterAssetPath("https://themorning.app/");
  assert.equal(items[0].image, asset);
  const written = await fs.readFile(path.join(root, asset.replace(/^\//, "")));
  assert.ok(written.length > 0);
  assert.equal(items[1].image, "https://already.example/og.png");
  assert.ok(
    lines.some((line) =>
      line.includes("work screenshots: 1 captured (0 writing, 1 creative)"),
    ),
    "expected capture summary was reported",
  );

  await fs.rm(root, { recursive: true, force: true });
});

test("captureMissingWorkScreenshots prioritizes creative over older articles", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-shots-prio-"));
  const png = await tinyPng();
  const items = [
    {
      url: "https://a.example/old-post/",
      content_type: "article",
      site_origin: "https://a.example",
      published_at: "2020-01-01T00:00:00.000Z",
      image: "",
    },
    {
      url: "https://a.example/games/new/",
      content_type: "game",
      site_origin: "https://a.example",
      published_at: "2019-01-01T00:00:00.000Z",
      image: "",
    },
    {
      url: "https://a.example/new-post/",
      content_type: "article",
      site_origin: "https://a.example",
      published_at: "2026-06-01T00:00:00.000Z",
      image: "",
    },
  ];

  /** @type {string[]} */
  const visited = [];

  await captureMissingWorkScreenshots(items, {
    root,
    maxCaptures: 2,
    log: muteLog,
    lookup: publicLookup,
    importPlaywright: async () => ({
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () =>
              mockCapturePage({
                goto: async (url) => {
                  visited.push(url);
                },
                screenshot: async () => png,
              }),
            close: async () => {},
          }),
          close: async () => {},
        }),
      },
    }),
  });

  assert.deepEqual(visited, [
    "https://a.example/games/new/",
    "https://a.example/new-post/",
  ]);
  await fs.rm(root, { recursive: true, force: true });
});

test("captureMissingWorkScreenshots skips URLs robots.txt disallows", async () => {
  let launched = false;
  const items = [
    {
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
      image: "",
    },
  ];

  await captureMissingWorkScreenshots(items, {
    robotsGate: {
      allows: async () => false,
      bodyForOrigin: async () => "",
    },
    lookup: publicLookup,
    importPlaywright: async () => {
      launched = true;
      throw new Error("should not launch");
    },
  });

  assert.equal(launched, false);
  assert.equal(items[0].image, "");
});

test("captureMissingWorkScreenshots no-ops without pending items or on launch failure", async () => {
  assert.deepEqual(await captureMissingWorkScreenshots([]), []);
  assert.deepEqual(await captureMissingWorkScreenshots(null), []);

  const alreadyImaged = [
    {
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
      image: "https://cdn.example/og.png",
    },
  ];

  assert.equal(
    await captureMissingWorkScreenshots(alreadyImaged),
    alreadyImaged,
  );

  const items = [
    {
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
    },
  ];

  await captureMissingWorkScreenshots(items, {
    lookup: publicLookup,
    importPlaywright: async () => {
      throw new Error("no browser");
    },
  });

  assert.equal(items[0].image, undefined);
});

test("captureMissingWorkScreenshots swallows per-URL goto failures", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-shots-fail-"));
  const items = [
    {
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
      image: "",
    },
  ];
  const { lines, log } = captureLog();

  await captureMissingWorkScreenshots(items, {
    root,
    log,
    lookup: publicLookup,
    importPlaywright: async () => ({
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () =>
              mockCapturePage({
                goto: async () => {
                  throw new Error("403");
                },
                screenshot: async () => Buffer.from(""),
              }),
            close: async () => {},
          }),
          close: async () => {
            throw new Error("close failed");
          },
        }),
      },
    }),
  });

  assert.equal(items[0].image, "");
  assert.ok(
    lines.some((line) =>
      line.includes("work screenshots: 0 captured (0 writing, 0 creative)"),
    ),
    "expected soft per-URL failure left zero captures",
  );
  await fs.rm(root, { recursive: true, force: true });
});

test("captureMissingWorkScreenshots respects maxCaptures and skips mid-run filled images", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-shots-cap-"));
  const png = await tinyPng();
  const items = [
    {
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
      image: "",
    },
    {
      url: "https://apps.apple.com/us/app/seedling-daily-planner/id1516093618",
      content_type: "project",
      site_origin: "https://joshgr.com",
      image: "",
    },
  ];

  /** @type {string[]} */
  const visited = [];

  await captureMissingWorkScreenshots(items, {
    root,
    maxCaptures: 2,
    timeoutMs: 5_000,
    log: muteLog,
    lookup: publicLookup,
    importPlaywright: async () => ({
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () =>
              mockCapturePage({
                goto: async (url) => {
                  visited.push(url);
                  items[1].image = "https://cdn.example/seedling.png";
                },
                screenshot: async () => png,
              }),
            close: async () => {},
          }),
          close: async () => {},
        }),
      },
    }),
  });

  assert.equal(visited.length, 1);
  assert.ok(
    String(items[0].image || "").startsWith("/assets/activity/posters/"),
  );
  assert.equal(items[1].image, "https://cdn.example/seedling.png");
  await fs.rm(root, { recursive: true, force: true });
});

test("captureMissingWorkScreenshots defaults log to console.log", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-shots-log-"));
  /** @type {unknown[]} */
  const logged = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logged.push(args.join(" "));
  };

  try {
    await captureMissingWorkScreenshots(
      [
        {
          url: "https://themorning.app/",
          content_type: "project",
          site_origin: "https://joshgr.com",
          image: "",
        },
      ],
      {
        root,
        robotsGate: {
          allows: async () => true,
          bodyForOrigin: async () => "",
        },
        lookup: publicLookup,
        importPlaywright: async () => ({
          chromium: {
            launch: async () => ({
              newContext: async () => ({
                newPage: async () =>
                  mockCapturePage({
                    goto: async () => {
                      throw new Error("offline");
                    },
                    screenshot: async () => Buffer.from(""),
                  }),
                close: async () => {},
              }),
              close: async () => {},
            }),
          },
        }),
      },
    );
  } finally {
    console.log = originalLog;
    await fs.rm(root, { recursive: true, force: true });
  }

  assert.ok(
    logged.some((line) =>
      String(line).includes("work screenshots: 0 captured"),
    ),
    "expected default progress log on console.log",
  );
});

test("captureMissingWorkScreenshots builds a default robots gate", async () => {
  let launched = false;
  const items = [
    {
      url: "https://themorning.app/",
      content_type: "project",
      site_origin: "https://joshgr.com",
      image: "",
    },
  ];

  await captureMissingWorkScreenshots(items, {
    fetchPublicText: async () => ({
      url: "https://themorning.app/robots.txt",
      contentType: "text/plain",
      body: "User-agent: *\nDisallow: /\n",
    }),
    cache: new Map([["themorning.app", [{ address: "1.1.1.1" }]]]),
    lookup: publicLookup,
    importPlaywright: async () => {
      launched = true;
      throw new Error("should not launch when robots disallow");
    },
  });

  assert.equal(launched, false);
  assert.equal(items[0].image, "");
});

test("captureShowcasePosterFallbacks snapshots work pages when images stay remote", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "showcase-fallback-"));
  const png = await tinyPng();
  const imageUrl = "https://joshuadrake.org/images/cessnatest.gif";
  const workUrl = "https://joshuadrake.org/projects/turboelectriccessna";
  const views = {
    showcase: {
      items: [
        {
          url: workUrl,
          title: "Turboelectric Cessna",
          image: imageUrl,
        },
      ],
      home: [
        {
          url: workUrl,
          title: "Turboelectric Cessna",
          image: imageUrl,
        },
      ],
    },
  };
  /** @type {string[]} */
  const visited = [];
  const { lines, log } = captureLog();
  /** @type {string[]} */
  const errLines = [];

  const captured = await captureShowcasePosterFallbacks(views, {
    root,
    log,
    logError: (message) => {
      errLines.push(message);
    },
    robotsGate: { allows: async () => true },
    lookup: publicLookup,
    importPlaywright: async () => ({
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () =>
              mockCapturePage({
                goto: async (url) => {
                  visited.push(url);
                },
                screenshot: async () => png,
              }),
            close: async () => {},
          }),
          close: async () => {},
        }),
      },
    }),
  });

  assert.equal(captured, 1);
  assert.deepEqual(visited, [workUrl]);
  const asset = posterAssetPath(imageUrl);
  assert.equal(views.showcase.items[0].image, asset);
  assert.equal(views.showcase.home[0].image, asset);
  const written = await fs.readFile(path.join(root, asset.replace(/^\//, "")));
  assert.ok(written.length > 0);
  assert.ok(
    lines.some((line) =>
      line.includes("showcase poster snapshots: 1 captured; 0 still remote"),
    ),
  );
  assert.equal(errLines.length, 0);

  await fs.rm(root, { recursive: true, force: true });
});

test("captureShowcasePosterFallbacks no-ops when Showcase is already local", async () => {
  const views = {
    showcase: {
      items: [
        {
          url: "https://a.example/work/",
          image: "/assets/activity/posters/abc.webp",
        },
      ],
      home: [],
    },
  };

  let launched = false;
  const captured = await captureShowcasePosterFallbacks(views, {
    lookup: publicLookup,
    importPlaywright: async () => {
      launched = true;
      throw new Error("should not launch");
    },
  });

  assert.equal(captured, 0);
  assert.equal(launched, false);
});

test("captureShowcasePosterFallbacks skips robots-disallowed work URLs", async () => {
  const views = {
    showcase: {
      items: [
        {
          url: "https://blocked.example/project/",
          image: "https://blocked.example/broken.gif",
        },
      ],
      home: [],
    },
  };
  /** @type {string[]} */
  const errLines = [];
  let launched = false;

  const captured = await captureShowcasePosterFallbacks(views, {
    log: () => {},
    logError: (message) => {
      errLines.push(message);
    },
    robotsGate: { allows: async () => false },
    lookup: publicLookup,
    importPlaywright: async () => {
      launched = true;
      return {
        chromium: {
          launch: async () => ({
            newContext: async () => ({
              newPage: async () => mockCapturePage(),
              close: async () => {},
            }),
            close: async () => {},
          }),
        },
      };
    },
  });

  assert.equal(captured, 0);
  assert.equal(launched, true);
  assert.equal(
    views.showcase.items[0].image,
    "https://blocked.example/broken.gif",
  );
  assert.ok(
    errLines.some((line) => line.includes("showcase poster snapshot skipped")),
  );
});

test("captureShowcasePosterFallbacks skips non-https images and work URLs", async () => {
  let launched = false;
  const captured = await captureShowcasePosterFallbacks(
    {
      showcase: {
        items: [
          {
            url: "https://a.example/work/",
            image: "http://insecure.example/x.gif",
          },
          {
            url: "ftp://a.example/work/",
            image: "https://cdn.example/ok.gif",
          },
          {
            url: "https://a.example/creds/",
            image: "https://user:pass@cdn.example/secret.gif",
          },
        ],
        home: [],
      },
    },
    {
      log: () => {},
      logError: () => {},
      lookup: publicLookup,
      importPlaywright: async () => {
        launched = true;
        throw new Error("should not launch when nothing is capturable");
      },
    },
  );

  assert.equal(captured, 0);
  assert.equal(launched, false);
});

test("captureShowcasePosterFallbacks defaults loggers, robots gate, and launch errors", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "showcase-defaults-"));
  const png = await tinyPng();
  const imageUrl = "https://cdn.example/broken.gif";
  const workUrl = "https://work.example/project/";
  const views = {
    showcase: {
      items: [{ url: workUrl, image: imageUrl }],
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
    const launchFailed = await captureShowcasePosterFallbacks(views, {
      root,
      timeoutMs: 0,
      fetchPublicText: async () => ({
        url: "https://work.example/robots.txt",
        contentType: "text/plain",
        body: "User-agent: *\nAllow: /\n",
      }),
      cache: new Map([["work.example", [{ address: "1.1.1.1" }]]]),
      lookup: publicLookup,
      importPlaywright: async () => {
        throw new Error("launch boom");
      },
    });
    assert.equal(launchFailed, 0);
    assert.ok(
      errLines.some((line) =>
        line.includes("showcase poster snapshot launch failed: launch boom"),
      ),
    );

    errLines.length = 0;
    const launchFailedNonError = await captureShowcasePosterFallbacks(views, {
      root,
      fetchPublicText: async () => ({
        url: "https://work.example/robots.txt",
        contentType: "text/plain",
        body: "User-agent: *\nAllow: /\n",
      }),
      cache: new Map([["work.example", [{ address: "1.1.1.1" }]]]),
      lookup: publicLookup,
      importPlaywright: async () => {
        throw "launch string";
      },
    });
    assert.equal(launchFailedNonError, 0);
    assert.ok(
      errLines.some((line) =>
        line.includes("showcase poster snapshot launch failed: launch string"),
      ),
    );

    errLines.length = 0;
    outLines.length = 0;

    const captured = await captureShowcasePosterFallbacks(views, {
      root,
      timeoutMs: 12_000,
      fetchPublicText: async () => ({
        url: "https://work.example/robots.txt",
        contentType: "text/plain",
        body: "User-agent: *\nAllow: /\n",
      }),
      cache: new Map([["work.example", [{ address: "1.1.1.1" }]]]),
      lookup: publicLookup,
      importPlaywright: async () => ({
        chromium: {
          launch: async () => ({
            newContext: async () => ({
              newPage: async () =>
                mockCapturePage({
                  goto: async () => {},
                  screenshot: async () => png,
                }),
              close: async () => {},
            }),
            close: async () => {
              throw new Error("close failed");
            },
          }),
        },
      }),
    });

    assert.equal(captured, 1);
    assert.equal(views.showcase.items[0].image, posterAssetPath(imageUrl));
    assert.ok(
      outLines.some((line) => line.includes("showcase poster snapshots: 1")),
    );
  } finally {
    process.stderr.write = originalErr;
    process.stdout.write = originalOut;
  }

  await fs.rm(root, { recursive: true, force: true });
});

test("captureShowcasePosterFallbacks logs per-URL snapshot failures", async () => {
  const views = {
    showcase: {
      items: [
        {
          url: "https://work.example/project/",
          image: "https://cdn.example/broken.gif",
        },
      ],
      home: [],
    },
  };
  /** @type {string[]} */
  const errLines = [];

  const captured = await captureShowcasePosterFallbacks(views, {
    log: () => {},
    logError: (message) => {
      errLines.push(message);
    },
    robotsGate: { allows: async () => true },
    lookup: publicLookup,
    importPlaywright: async () => ({
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () =>
              mockCapturePage({
                goto: async () => {
                  throw new Error("navigation interrupted");
                },
              }),
            close: async () => {},
          }),
          close: async () => {},
        }),
      },
    }),
  });

  assert.equal(captured, 0);
  assert.ok(
    errLines.some((line) =>
      line.includes(
        "showcase poster snapshot failed https://work.example/project/",
      ),
    ),
  );
  assert.ok(errLines.some((line) => line.includes("navigation interrupted")));

  errLines.length = 0;
  await captureShowcasePosterFallbacks(views, {
    log: () => {},
    logError: (message) => {
      errLines.push(message);
    },
    robotsGate: { allows: async () => true },
    lookup: publicLookup,
    importPlaywright: async () => ({
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () =>
              mockCapturePage({
                goto: async () => {
                  throw null;
                },
              }),
            close: async () => {},
          }),
          close: async () => {},
        }),
      },
    }),
  });
  assert.ok(
    errLines.some((line) =>
      line.includes(
        "showcase poster snapshot failed https://work.example/project/ (https://cdn.example/broken.gif): null",
      ),
    ),
  );
});
