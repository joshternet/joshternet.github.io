/**
 * Goal: Homepage Connections preview boots without trapping scroll, and
 * still distinguishes observed links from shared topics.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const connectionsScriptPath = fileURLToPath(
  new URL("../../assets/js/connections.js", import.meta.url),
);

const connectionsScript = await readFile(connectionsScriptPath, "utf8");

/**
 * @param {{
 *   participants?: Array<Record<string, unknown>>,
 *   connections?: Array<Record<string, unknown>>,
 *   topic_overlaps?: Array<Record<string, unknown>>,
 *   topic_groups?: Array<Record<string, unknown>>,
 * }} [options]
 */
function buildPreviewFixture(options = {}) {
  const participants = options.participants || [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "Site A",
      description: "About A",
      screenshot: "/assets/network/sites/a.webp",
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "Site B",
      description: "About B",
      screenshot: "/assets/network/sites/b.webp",
    },
  ];
  const connections = options.connections || [
    {
      from: "https://a.example",
      to: "https://b.example",
      href: "https://b.example/hello",
      text: "Hello B",
      relation: "content-link",
      rel: [],
      page: "https://a.example/",
    },
  ];
  const topic_overlaps = options.topic_overlaps || [
    {
      a: "https://a.example",
      b: "https://b.example",
      topics: [{ slug: "privacy", label: "privacy" }],
    },
  ];
  const topic_groups = options.topic_groups || [
    {
      origin: "https://a.example",
      topics: [
        {
          slug: "privacy",
          label: "privacy",
          articles: [{ url: "https://a.example/privacy/", title: "Privacy" }],
          sites: [],
        },
      ],
    },
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <style>
      body { height: 2000px; }
      .connections-graph__svg, .connections-graph__link { pointer-events: none; }
      .connections-graph__hit { fill: none; stroke: transparent; stroke-width: 28px; pointer-events: stroke; }
      .connections-graph__edge { fill: none; pointer-events: none; }
      .connections-graph__node { pointer-events: auto; }
      .connections-graph__map { fill: transparent; pointer-events: fill; }
      .home-connections__viewport {
        position: relative;
        overflow: hidden;
        width: 640px;
        height: 320px;
        touch-action: pan-y;
      }
      .connections-graph__stage, .connections-graph__svg {
        width: 640px;
        height: 320px;
      }
    </style>
  </head>
  <body>
    <div class="home-connections">
      <div
        data-connections-shell
        data-connections-mode="preview"
        data-connections-bootstrap="home-connections-bootstrap"
      >
        <section data-connections-graph hidden>
          <div class="home-connections__viewport" data-connections-viewport>
            <div data-connections-graph-stage></div>
          </div>
        </section>
      </div>
      <a href="/connections/">Explore all connections</a>
    </div>
    <script type="application/json" id="home-connections-bootstrap">
      ${JSON.stringify({ participants, connections, topic_overlaps, topic_groups }).replaceAll("<", "\\u003c")}
    </script>
  </body>
</html>`;
}

let browser;

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
});

/**
 * @param {Parameters<typeof buildPreviewFixture>[0]} [options]
 */
async function previewPage(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const fixture = buildPreviewFixture(options);

  await page.route("http://joshternet.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: fixture,
    });
  });

  await page.goto("http://joshternet.test/");
  await page.addScriptTag({ content: connectionsScript });

  return { context, page };
}

test("homepage connections preview renders nodes with map tools", async () => {
  const { context, page } = await previewPage();

  assert.equal(
    await page.locator("[data-connections-graph]").isHidden(),
    false,
  );
  assert.equal(await page.locator(".connections-graph__node").count(), 2);
  assert.equal(await page.locator("[data-connections-map-tools]").count(), 1);
  assert.equal(await page.locator("[data-connections-zoom-in]").count(), 1);
  assert.equal(await page.locator("[data-connections-zoom-out]").count(), 1);
  assert.equal(await page.locator("[data-connections-map-reset]").count(), 1);
  assert.equal(await page.locator("[data-relation-filters]").count(), 0);
  assert.equal(
    await page.locator('marker[id="home-connections-bootstrap-arrow"]').count(),
    1,
  );
  // Fixture graph has one edge of each kind; the site include also ships a line key.
  assert.equal(
    await page.locator('[data-connection-kind="shared-topic"]').count(),
    1,
  );
  assert.equal(
    await page.locator('[data-connection-kind="content-link"]').count(),
    1,
  );

  await context.close();
});

test("homepage connections preview zoom buttons change the camera", async () => {
  const { context, page } = await previewPage();

  const before = await page
    .locator(".connections-graph__svg")
    .getAttribute("viewBox");
  await page.locator("[data-connections-zoom-in]").click();
  const zoomed = await page
    .locator(".connections-graph__svg")
    .getAttribute("viewBox");
  assert.notEqual(zoomed, before);
  await page.locator("[data-connections-map-reset]").click();
  const centered = await page
    .locator(".connections-graph__svg")
    .getAttribute("viewBox");
  assert.equal(centered, before);

  await context.close();
});

test("homepage connections preview selects a node and links to Connections", async () => {
  const { context, page } = await previewPage();

  await page
    .locator('.connections-graph__node[data-origin="https://a.example"]')
    .click();
  assert.equal(
    await page.locator("[data-connections-detail]").isVisible(),
    true,
  );
  const detail =
    (await page.locator("[data-connections-detail]").innerText()) || "";
  assert.match(detail, /Explore on Connections/);
  assert.match(detail, /Shared topics/);
  assert.match(detail, /privacy/);
  assert.equal(
    await page
      .locator(
        '[data-connections-detail] a[href="/connections/?site=a.example"]',
      )
      .count(),
    1,
  );

  await context.close();
});

test("homepage connections preview does not preventDefault on wheel", async () => {
  const { context, page } = await previewPage();

  const prevented = await page.evaluate(() => {
    const viewport = document.querySelector("[data-connections-viewport]");
    let sawPrevent = false;
    const original = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function patchedPreventDefault() {
      if (this.type === "wheel") {
        sawPrevent = true;
      }
      return original.call(this);
    };

    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 120,
        clientX: 100,
        clientY: 100,
      }),
    );

    Event.prototype.preventDefault = original;
    return sawPrevent;
  });

  assert.equal(prevented, false);

  const before = await page
    .locator(".connections-graph__svg")
    .getAttribute("viewBox");
  await page.locator("[data-connections-viewport]").evaluate((viewport) => {
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 240,
        clientX: 120,
        clientY: 120,
      }),
    );
  });
  const after = await page
    .locator(".connections-graph__svg")
    .getAttribute("viewBox");
  assert.equal(after, before);

  await context.close();
});

test("empty homepage connections payload leaves the graph hidden", async () => {
  const { context, page } = await previewPage({
    participants: [],
    connections: [],
    topic_overlaps: [],
  });

  assert.equal(await page.locator("[data-connections-graph]").isHidden(), true);
  assert.equal(await page.locator(".connections-graph__node").count(), 0);

  await context.close();
});

test("homepage preview marks recently joined participants", async () => {
  const { context, page } = await previewPage({
    participants: [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "Site A",
        description: "About A",
        screenshot: "/assets/network/sites/a.webp",
        first_participated_at: "2026-10-29T00:00:00.000Z",
        recently_joined: true,
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "Site B",
        description: "About B",
        screenshot: "/assets/network/sites/b.webp",
        first_participated_at: "2026-09-01T00:00:00.000Z",
        recently_joined: false,
      },
    ],
  });

  assert.equal(
    await page
      .locator('.connections-graph__node[data-origin="https://a.example"]')
      .getAttribute("data-recently-joined"),
    "true",
  );
  assert.equal(
    await page
      .locator('.connections-graph__node[data-origin="https://b.example"]')
      .getAttribute("data-recently-joined"),
    "false",
  );
  assert.equal(
    await page.locator(".connections-graph__recent-ring").count(),
    1,
  );

  await page
    .locator('.connections-graph__node[data-origin="https://a.example"]')
    .click();
  assert.match(
    (await page.locator("[data-connections-detail]").innerText()) || "",
    /Recently joined the Joshternet/,
  );

  await context.close();
});

test("homepage preview shows isolate participants with zero edges", async () => {
  const { context, page } = await previewPage({
    participants: [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "Site A",
        description: "",
        screenshot: "",
      },
      {
        origin: "https://lonely.example",
        domain: "lonely.example",
        title: "Lonely",
        description: "",
        screenshot: "",
      },
    ],
    connections: [],
    topic_overlaps: [],
  });

  assert.equal(await page.locator(".connections-graph__node").count(), 2);
  await page
    .locator('.connections-graph__node[data-origin="https://lonely.example"]')
    .click();
  const detail = await page.locator("[data-connections-detail]").innerText();
  assert.match(detail, /Lonely/);
  assert.match(detail, /No observed connections yet/);
  assert.match(detail, /Explore on Connections/);

  await context.close();
});
