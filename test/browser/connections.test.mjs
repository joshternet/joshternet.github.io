/**
 * Goal: Cover /connections/ selection, HTML lists, graph, keyboard, and hostile input.
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
 *   query?: string,
 *   reducedMotion?: boolean,
 *   viewport?: { width: number, height: number },
 * }} [options]
 */
function buildFixture(options = {}) {
  const participants = options.participants || [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "Site A",
      description: "Alpha",
      screenshot: "/assets/network/sites/a.webp",
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "Site B",
      description: "Beta",
      screenshot: "",
    },
    {
      origin: "https://c.example",
      domain: "c.example",
      title: "Site C",
      description: "",
      screenshot: "",
    },
  ];
  const connections = options.connections || [
    {
      from: "https://a.example",
      to: "https://b.example",
      href: "https://b.example/hello",
      text: "Hello B",
      rel: ["noopener", "noreferrer", "me"],
      page: "https://a.example/",
    },
    {
      from: "https://b.example",
      to: "https://a.example",
      href: "https://a.example/",
      text: "Back to A",
      rel: [],
      page: "https://b.example/about",
    },
  ];
  const topic_overlaps = options.topic_overlaps || [];
  const topic_groups = options.topic_groups || [];

  const sections = participants
    .map((participant) => {
      const outbound = connections.filter(
        (edge) => edge.from === participant.origin,
      );
      const inbound = connections.filter(
        (edge) => edge.to === participant.origin,
      );

      return `
        <section
          class="connections-site"
          data-connection-origin="${participant.origin}"
          data-connection-domain="${participant.domain}"
          tabindex="-1"
        >
          <h2>
            <button
              type="button"
              data-connection-select
              data-origin="${participant.origin}"
            >
              ${participant.title}
            </button>
          </h2>
          <div class="connections-site__columns">
            <div>
              <h3>Connects to</h3>
              <ul class="connections-edge-list">
                ${outbound
                  .map(
                    (edge) => `
                  <li class="connections-edge">
                    <a href="${edge.href}">${edge.text || edge.to}</a>
                  </li>`,
                  )
                  .join("")}
              </ul>
            </div>
            <div>
              <h3>Connected from</h3>
              <ul class="connections-edge-list">
                ${inbound
                  .map(
                    (edge) => `
                  <li class="connections-edge">
                    <a href="${edge.href}">${edge.text || edge.from}</a>
                  </li>`,
                  )
                  .join("")}
              </ul>
            </div>
          </div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <style>
      .connections-graph__svg, .connections-graph__link { pointer-events: none; }
      .connections-graph__hit { fill: none; stroke: transparent; stroke-width: 28px; pointer-events: stroke; }
      .connections-graph__edge { fill: none; pointer-events: none; }
      .connections-graph__node { pointer-events: auto; }
      .connections-graph__map { fill: transparent; pointer-events: fill; }
      .connections-graph__viewport {
        position: relative;
        overflow: hidden;
        width: 640px;
        height: 420px;
      }
      .connections-graph__stage, .connections-graph__svg {
        width: 640px;
        height: 420px;
      }
    </style>
  </head>
  <body>
    <div data-connections-shell>
      <section data-connections-graph hidden>
        <div data-connections-graph-stage></div>
        <fieldset data-relation-filters class="connections-graph__filters">
          <legend>Show observed relations</legend>
        </fieldset>
        <div class="connections-graph__key" data-connections-key>
          <p class="connections-graph__key-title">Key</p>
        </div>
      </section>
    </div>
    <div data-connections-list>
      ${sections}
    </div>
    <script type="application/json" id="connections-bootstrap">
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
 * @param {Parameters<typeof buildFixture>[0]} [options]
 */
async function connectionsPage(options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1280, height: 800 },
    reducedMotion: options.reducedMotion ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const fixture = buildFixture(options);
  const path = options.query
    ? `/connections/?${options.query}`
    : "/connections/";

  await page.route("http://joshternet.test/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/connections/" || url.pathname === "/connections") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: fixture,
      });
      return;
    }

    await route.abort();
  });

  await page.goto(`http://joshternet.test${path}`);
  await page.addScriptTag({ content: connectionsScript });
  await page.waitForSelector("[data-connections-graph]:not([hidden])");

  return { context, page };
}

test("HTML relationship lists and reciprocal edges are visible without selection", async () => {
  const { context, page } = await connectionsPage();

  assert.match(
    await page.locator("[data-connections-list]").innerText(),
    /Hello B/,
  );
  assert.match(
    await page.locator("[data-connections-list]").innerText(),
    /Back to A/,
  );
  assert.equal(await page.locator("[data-connection-origin]").count(), 3);
  assert.equal(await page.locator(".connections-graph__node").count(), 2);
  assert.equal(
    await page
      .locator("[data-relation-filters] input[type='checkbox']")
      .count(),
    1,
  );

  await context.close();
});

test("selecting a participant shows outgoing and incoming lists", async () => {
  const { context, page } = await connectionsPage();

  await page
    .locator('[data-connection-select][data-origin="https://a.example"]')
    .click();

  const detail = page.locator("[data-connections-detail]");
  assert.match(await detail.innerText(), /Site A/);
  assert.match(await detail.innerText(), /Connects to/);
  assert.match(await detail.innerText(), /Connected from/);
  assert.match(await detail.innerText(), /Site B/);
  assert.doesNotMatch(await detail.innerText(), /Alpha/);
  assert.doesNotMatch(await detail.innerText(), /a\.example/);
  assert.equal(await detail.locator(".network-wander-action").count(), 0);
  assert.equal(await page.locator(".connections-site.is-selected").count(), 1);

  await context.close();
});

test("one-way links and disconnected sites still render", async () => {
  const { context, page } = await connectionsPage({
    connections: [
      {
        from: "https://a.example",
        to: "https://b.example",
        href: "https://b.example/",
        text: "Only A to B",
        rel: [],
        page: "https://a.example/",
      },
    ],
  });

  await page
    .locator('[data-connection-select][data-origin="https://c.example"]')
    .click();
  const detail = await page.locator("[data-connections-detail]").innerText();
  assert.match(detail, /Site C/);
  assert.doesNotMatch(detail, /Connects to/);
  assert.doesNotMatch(detail, /Connected from/);

  await page
    .locator('[data-connection-select][data-origin="https://b.example"]')
    .click();
  const bDetail = await page.locator("[data-connections-detail]").innerText();
  assert.doesNotMatch(bDetail, /Connects to/);
  assert.match(bDetail, /Connected from/);
  assert.match(bDetail, /Site A/);

  await context.close();
});

test("empty connections and single participant still boot the graph", async () => {
  const { context, page } = await connectionsPage({
    participants: [
      {
        origin: "https://solo.example",
        domain: "solo.example",
        title: "Solo",
        description: "",
        screenshot: "",
      },
    ],
    connections: [],
  });

  assert.equal(await page.locator(".connections-graph__node").count(), 0);
  await page
    .locator('[data-connection-select][data-origin="https://solo.example"]')
    .click();
  assert.match(
    await page.locator("[data-connections-detail]").innerText(),
    /Solo/,
  );

  await context.close();
});

test("keyboard selection and Escape clear work", async () => {
  const { context, page } = await connectionsPage();

  await page.locator(".connections-graph__node").first().focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".connections-site.is-selected").count(), 1);

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.locator(".connections-graph__node").first().click();
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
  assert.equal(
    await page.locator("[data-connections-detail]").isVisible(),
    true,
  );

  await page
    .locator("[data-connections-bubble-close], .connections-bubble__close")
    .click();
  assert.equal(
    await page.locator("[data-connections-detail]").isHidden(),
    true,
  );

  await page.locator(".connections-graph__node").first().focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".connections-site.is-selected").count(), 0);
  assert.equal(
    await page.locator("[data-connections-detail]").isHidden(),
    true,
  );

  await context.close();
});

test("pointer click on a chart node or line opens the bubble", async () => {
  const { context, page } = await connectionsPage();
  const node = page.locator(".connections-graph__node").first();
  const box = await node.boundingBox();
  assert.ok(box);
  await page.mouse.click(box.x + box.width / 2, box.y + 14);
  const detail = page.locator("[data-connections-detail]");
  assert.equal(await detail.isVisible(), true);
  assert.match(
    await detail.innerText(),
    /Connects to|Connected from|Shared topics/,
  );

  await page.locator(".connections-bubble__close").click();
  assert.equal(await detail.isHidden(), true);

  const hit = page.locator(".connections-graph__hit").first();
  const hitBox = await hit.boundingBox();
  assert.ok(hitBox);
  await page.mouse.click(
    hitBox.x + hitBox.width / 2,
    hitBox.y + hitBox.height / 2,
  );
  assert.equal(await detail.isVisible(), true);
  assert.match(await detail.innerText(), /→|Linked to|Shared topics/);

  await context.close();
});

test("query site= selects a participant", async () => {
  const { context, page } = await connectionsPage({
    query: "site=b.example",
  });

  assert.equal(
    await page
      .locator(
        '.connections-site.is-selected[data-connection-domain="b.example"]',
      )
      .count(),
    1,
  );
  assert.match(
    await page.locator("[data-connections-detail]").innerText(),
    /Site B/,
  );

  await context.close();
});

test("hostile bootstrap values are rejected", async () => {
  const { context, page } = await connectionsPage({
    participants: [
      {
        origin: "https://safe.example",
        domain: "safe.example",
        title: "<img src=x onerror=alert(1)>",
        description: "<script>alert(1)</script>",
        screenshot: "javascript:alert(1)",
      },
      {
        origin: "https://evil.example/path",
        domain: "evil.example",
        title: "Evil",
        description: "",
        screenshot: "",
      },
    ],
    connections: [
      {
        from: "https://safe.example",
        to: "https://safe.example",
        href: "javascript:alert(1)",
        text: "<b>nope</b>",
        rel: [],
        page: "https://safe.example/",
      },
      {
        from: "https://safe.example",
        to: "https://other.example",
        href: "https://other.example/",
        text: "Outside",
        rel: [],
        page: "https://safe.example/",
      },
    ],
  });

  await page
    .locator('[data-connection-select][data-origin="https://safe.example"]')
    .click();
  const detailHTML = await page
    .locator("[data-connections-detail]")
    .innerHTML();

  assert.doesNotMatch(detailHTML, /<script/i);
  assert.doesNotMatch(detailHTML, /javascript:/i);
  assert.doesNotMatch(detailHTML, /<img[^>]+onerror=/i);
  assert.match(detailHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal(await page.locator(".connections-graph__node").count(), 0);

  await context.close();
});

test("reduced motion and narrow viewport still allow selection", async () => {
  const { context, page } = await connectionsPage({
    reducedMotion: true,
    viewport: { width: 360, height: 720 },
  });

  await page
    .locator('[data-connection-select][data-origin="https://a.example"]')
    .click();
  const bubbleText = await page
    .locator("[data-connections-detail]")
    .innerText();
  assert.match(bubbleText, /Connects to/);
  assert.doesNotMatch(bubbleText, /Open site/);
  assert.doesNotMatch(bubbleText, /Alpha/);
  assert.equal(await page.locator(".connections-graph__svg").count(), 1);

  await context.close();
});

test("chart bubble links the other participant, not a second site button", async () => {
  const { context, page } = await connectionsPage();

  await page
    .locator('[data-connection-select][data-origin="https://a.example"]')
    .click();
  const href = await page
    .locator("[data-connections-detail] a")
    .first()
    .getAttribute("href");

  assert.equal(href, "https://b.example/hello");
  assert.equal(
    await page
      .locator("[data-connections-detail] .network-wander-action")
      .count(),
    0,
  );

  await context.close();
});

test("content-link and blogroll between the same sites stay two edges", async () => {
  const { context, page } = await connectionsPage({
    connections: [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
        href: "https://b.example/post",
        text: "Post",
        rel: [],
        page: "https://a.example/now/",
        evidence: [
          {
            page: "https://a.example/now/",
            href: "https://b.example/post",
            text: "Post",
          },
          {
            page: "https://a.example/seeking/",
            href: "https://b.example/",
            text: "B",
          },
        ],
      },
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "blogroll",
        href: "https://a.example/blogroll.opml",
        text: "",
        rel: [],
        page: "https://a.example/",
      },
    ],
  });

  assert.equal(await page.locator(".connections-graph__edge").count(), 2);
  assert.equal(await page.locator(".connections-graph__hit").count(), 2);

  const first = page.locator("[data-edge-key]").nth(0);
  const second = page.locator("[data-edge-key]").nth(1);
  const firstPath = await first
    .locator(".connections-graph__edge")
    .getAttribute("d");
  const secondPath = await second
    .locator(".connections-graph__edge")
    .getAttribute("d");
  assert.notEqual(firstPath, secondPath);
  await first.locator(".connections-graph__hit").evaluate((element) => {
    element.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
  });
  assert.equal(
    await first.locator(".connections-graph__edge").getAttribute("d"),
    firstPath,
  );

  await page.locator("[data-edge-key*='content-link']").evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const detail = await page.locator("[data-connections-detail]").innerText();
  assert.match(detail, /→/);
  assert.match(detail, /Linked to/);
  assert.match(detail, /Post/);
  assert.doesNotMatch(detail, /Read source|Visit /);

  await context.close();
});

test("shared topics appear as undirected overlap, not a directed link", async () => {
  const { context, page } = await connectionsPage({
    topic_overlaps: [
      {
        a: "https://a.example",
        b: "https://c.example",
        topics: [{ slug: "ai", label: "AI" }],
      },
    ],
    topic_groups: [
      {
        origin: "https://a.example",
        topics: [
          {
            slug: "ai",
            label: "AI",
            articles: [
              { url: "https://a.example/ai-notes", title: "Notes on AI" },
            ],
            sites: [
              {
                origin: "https://c.example",
                title: "Site C",
                articles: [
                  {
                    url: "https://c.example/thoughts-on-ai",
                    title: "Thoughts on AI",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(await page.locator(".connections-graph__node").count(), 3);
  assert.equal(
    await page
      .locator(".connections-graph__edge[data-connection-kind='shared-topic']")
      .count(),
    1,
  );

  await page
    .locator('[data-connection-select][data-origin="https://a.example"]')
    .click();
  const detailRoot = page.locator("[data-connections-detail]");
  const closed = await detailRoot.innerText();
  assert.match(closed, /Shared topics/);
  assert.match(closed, /AI/);
  assert.doesNotMatch(closed, /Notes on AI/);
  assert.doesNotMatch(closed, /Alpha/);
  assert.equal(await detailRoot.locator(".network-wander-action").count(), 0);

  await page
    .locator("[data-edge-key*='shared-topic'] .connections-graph__hit")
    .evaluate((hit) => {
      hit.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId: 1,
        }),
      );
      hit.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
      );
    });
  const sharedLine = await detailRoot.innerText();
  assert.match(sharedLine, /↔/);
  assert.match(sharedLine, /Shared topics/);
  assert.match(sharedLine, /Site A/);
  assert.match(sharedLine, /Site C/);

  await context.close();
});

test("shared-topic bubble shows one-way link direction between the pair", async () => {
  const { context, page } = await connectionsPage({
    connections: [
      {
        from: "https://a.example",
        to: "https://c.example",
        relation: "content-link",
        href: "https://c.example/",
        text: "C",
        rel: [],
        page: "https://a.example/",
      },
    ],
    topic_overlaps: [
      {
        a: "https://a.example",
        b: "https://c.example",
        topics: [{ slug: "ai", label: "AI" }],
      },
    ],
  });

  await page
    .locator("[data-edge-key*='shared-topic'] .connections-graph__hit")
    .evaluate((hit) => {
      hit.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerId: 1,
        }),
      );
      hit.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
      );
    });
  const detail = await page.locator("[data-connections-detail]").innerText();
  assert.match(detail, /Site A/);
  assert.match(detail, /Site C/);
  assert.match(detail, /→/);
  assert.match(detail, /Linked to/);
  assert.match(detail, /AI/);
  assert.doesNotMatch(detail, /↔/);

  await context.close();
});

test("chart map centers Joshternet, spreads sites, and pans inside the viewport", async () => {
  const { context, page } = await connectionsPage({
    participants: [
      {
        origin: "https://joshternet.org",
        domain: "joshternet.org",
        title: "Joshternet",
        description: "",
        screenshot: "",
      },
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "Site A",
        description: "Alpha",
        screenshot: "",
      },
    ],
    connections: [
      {
        from: "https://joshternet.org",
        to: "https://a.example",
        href: "https://a.example/",
        text: "A",
        rel: [],
        page: "https://joshternet.org/",
      },
    ],
  });

  const hub = page.locator(
    '.connections-graph__node[data-origin="https://joshternet.org"] circle',
  );
  const other = page.locator(
    '.connections-graph__node[data-origin="https://a.example"] circle',
  );
  const hubX = Number(await hub.getAttribute("cx"));
  const hubY = Number(await hub.getAttribute("cy"));
  const otherX = Number(await other.getAttribute("cx"));
  const otherY = Number(await other.getAttribute("cy"));
  assert.equal(hubX, 0);
  assert.equal(hubY, 0);
  assert.ok(Math.hypot(otherX - hubX, otherY - hubY) >= 240);

  /**
   * @param {string | null} value
   * @returns {number[]}
   */
  function viewBoxParts(value) {
    return (value || "")
      .trim()
      .split(/\s+/)
      .map((part) => Number(part));
  }

  const svg = page.locator(".connections-graph__svg");
  const start = viewBoxParts(await svg.getAttribute("viewBox"));
  assert.equal(start.length, 4);
  assert.ok(Math.abs(start[0] + start[2] / 2 - hubX) < 1);
  assert.ok(Math.abs(start[1] + start[3] / 2 - hubY) < 1);

  await page.locator("[data-connections-zoom-in]").evaluate((button) => {
    button.click();
  });
  const zoomed = viewBoxParts(await svg.getAttribute("viewBox"));
  assert.ok(zoomed[2] < start[2]);

  await page.evaluate(() => {
    const stage = document.querySelector("[data-connections-graph-stage]");
    stage.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX: 320,
        clientY: 210,
      }),
    );
    stage.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        buttons: 1,
        clientX: 260,
        clientY: 210,
      }),
    );
    stage.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        clientX: 260,
        clientY: 210,
      }),
    );
  });
  const panned = viewBoxParts(await svg.getAttribute("viewBox"));
  assert.notEqual(panned[0], zoomed[0]);

  await page.locator("[data-connections-map-reset]").evaluate((button) => {
    button.click();
  });
  const reset = viewBoxParts(await svg.getAttribute("viewBox"));
  assert.ok(Math.abs(reset[0] + reset[2] / 2 - hubX) < 1);
  assert.ok(Math.abs(reset[1] + reset[3] / 2 - hubY) < 1);

  await context.close();
});
