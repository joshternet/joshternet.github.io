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
  WORK_SCREENSHOT_SETTLE_MS,
  awaitPageReadyForScreenshot,
  captureMissingWorkScreenshots,
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
 * }} [hooks]
 * @returns {Record<string, unknown>}
 */
function mockCapturePage(hooks = {}) {
  return {
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
      evaluate: async (fn) => fn(),
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
      evaluate: async (fn) => fn(),
    });

    globalThis.document = { images: [] };
    await awaitPageReadyForScreenshot({
      waitForLoadState: async () => {},
      waitForTimeout: async () => {},
      evaluate: async (fn) => fn(),
    });

    await awaitPageReadyForScreenshot({
      waitForLoadState: async () => {},
      waitForTimeout: async () => {},
      evaluate: async () => {
        throw new Error("page closed");
      },
    });
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

  await captureMissingWorkScreenshots(items, {
    root,
    maxCaptures: 5,
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

  await captureMissingWorkScreenshots(items, {
    root,
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
