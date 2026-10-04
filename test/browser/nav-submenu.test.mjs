/**
 * Goal: Verify Implement submenu open/close and click paths without a live
 * Jekyll server. Fixture HTML + site-nav.js only (no content-coupled URLs).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const siteNavScript = await readFile(
  fileURLToPath(new URL("../../assets/js/site-nav.js", import.meta.url)),
  "utf8",
);

const FIXTURE_CSS = `
  :root { --space-2: 0.5rem; --space-4: 1rem; --gutter: 1rem; --shell-width: 70rem; }
  body { margin: 0; font-family: sans-serif; }
  .site-header { position: relative; }
  .site-header__inner {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-4);
    padding: 0.75rem var(--gutter);
  }
  .site-nav--wide .site-nav__list {
    display: flex;
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 0 var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .site-nav--wide a {
    display: flex;
    min-block-size: 2.75rem;
    align-items: center;
    white-space: nowrap;
    text-decoration: none;
  }
  .site-nav-secondary {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 100%;
    z-index: 4;
    display: block;
    width: 100%;
    margin: 0;
    padding-block: calc(0.24rem + var(--space-2)) var(--space-2);
  }
  .site-nav-secondary[hidden] { display: none; }
  .site-nav-secondary__list {
    display: flex;
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 0 var(--space-4);
    width: 100%;
    max-width: var(--shell-width);
    margin: 0 auto;
    padding: 0 var(--gutter);
    list-style: none;
  }
  .site-nav-secondary a {
    display: flex;
    min-block-size: 2.5rem;
    align-items: center;
    white-space: nowrap;
    text-decoration: none;
  }
  .site-main { min-height: 4rem; }
`;

/**
 * Builds a deterministic nav fixture for one sticky section.
 * @param {{ section?: string, path?: string }} [options]
 * @returns {string}
 */
function buildFixture(options = {}) {
  const section = options.section || "";
  const sectionClass = section ? ` site-header--section-${section}` : "";
  const path = options.path || "/community/";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Nav fixture</title>
    <style>${FIXTURE_CSS}</style>
  </head>
  <body data-path="${path}">
    <header class="site-header${sectionClass}">
      <div class="site-header__inner">
        <a class="site-logo" href="/">Joshternet</a>
        <nav class="site-nav site-nav--wide" aria-label="Primary">
          <ul class="site-nav__list">
            <li class="site-nav__item"><a href="/">Home</a></li>
            <li class="site-nav__item" data-nav-branch="about">
              <a href="/about/">About</a>
            </li>
            <li class="site-nav__item" data-nav-branch="network">
              <a href="/network/">Network</a>
            </li>
            <li class="site-nav__item site-nav__item--implement" data-nav-branch="implement">
              <a href="/implement/">Implement</a>
            </li>
            <li class="site-nav__item" data-nav-branch="joshbot">
              <a href="/joshbot/">JoshBot</a>
            </li>
          </ul>
        </nav>
      </div>
      <nav class="site-nav-secondary site-nav-secondary--about" data-nav-secondary="about" hidden>
        <ul class="site-nav-secondary__list">
          <li><a href="/community/">Community</a></li>
          <li><a href="/governance/">Governance</a></li>
        </ul>
      </nav>
      <nav class="site-nav-secondary site-nav-secondary--network" data-nav-secondary="network" hidden>
        <ul class="site-nav-secondary__list">
          <li><a href="/activity/">What's New</a></li>
          <li><a href="/topics/">Topics</a></li>
        </ul>
      </nav>
      <nav class="site-nav-secondary site-nav-secondary--implement" data-nav-secondary="implement" hidden>
        <ul class="site-nav-secondary__list">
          <li><a href="/implement/validate/">Validate</a></li>
          <li><a href="/implement/platforms/">Platforms</a></li>
        </ul>
      </nav>
      <nav class="site-nav-secondary site-nav-secondary--joshbot" data-nav-secondary="joshbot" hidden>
        <ul class="site-nav-secondary__list">
          <li><a href="/nominate/">Nominate</a></li>
        </ul>
      </nav>
    </header>
    <main class="site-main"><p>Fixture page for ${path}</p></main>
    <button type="button" data-wander-go>Go</button>
    <script>${siteNavScript}</script>
  </body>
</html>`;
}

let browser;
/** @type {string | null} */
let browserSkipReason = null;

before(async () => {
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    browserSkipReason = `Playwright Chromium unavailable: ${error.message}`;
  }
});

after(async () => {
  await browser?.close();
});

/**
 * Opens a routed fixture page.
 * @param {import("playwright").Browser} browserInstance
 * @param {{ section?: string, path?: string, viewport?: { width: number, height: number }, hasTouch?: boolean, isMobile?: boolean }} [options]
 * @returns {Promise<{ context: import("playwright").BrowserContext, page: import("playwright").Page }>}
 */
async function openFixture(browserInstance, options = {}) {
  const path = options.path || "/community/";
  const context = await browserInstance.newContext({
    viewport: options.viewport || { width: 1400, height: 900 },
    hasTouch: options.hasTouch || false,
    isMobile: options.isMobile || false,
  });
  const page = await context.newPage();

  await page.route("http://joshternet.test/**", async (route) => {
    const url = new URL(route.request().url());
    let section = options.section || "";

    if (url.pathname.startsWith("/implement/")) {
      section = "implement";
    } else if (
      url.pathname.startsWith("/about/") ||
      url.pathname === "/community/" ||
      url.pathname === "/governance/"
    ) {
      section = "about";
    } else if (
      url.pathname.startsWith("/network/") ||
      url.pathname === "/activity/" ||
      url.pathname === "/topics/"
    ) {
      section = "network";
    } else if (
      url.pathname.startsWith("/joshbot/") ||
      url.pathname === "/nominate/"
    ) {
      section = "joshbot";
    }

    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: buildFixture({ section, path: url.pathname }),
    });
  });

  await page.goto(`http://joshternet.test${path}`, {
    waitUntil: "domcontentloaded",
  });

  return { context, page };
}

/**
 * @param {import("playwright").Page} page
 * @returns {Promise<boolean>}
 */
function secondaryShown(page) {
  return page.locator(".site-nav-secondary--implement").evaluate((el) => {
    return !el.hidden && getComputedStyle(el).display !== "none";
  });
}

/**
 * Move from Implement toward a child link slowly enough to fail a short leave timer.
 * @param {import("playwright").Page} page
 * @param {import("playwright").Locator} from
 * @param {import("playwright").Locator} to
 * @returns {Promise<void>}
 */
async function moveThroughGapSlowly(page, from, to) {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  assert.ok(fromBox, "from box");
  assert.ok(toBox, "to box");

  const startX = fromBox.x + fromBox.width / 2;
  const startY = fromBox.y + fromBox.height / 2;
  const endX = toBox.x + toBox.width / 2;
  const endY = toBox.y + toBox.height / 2;

  await page.mouse.move(startX, startY);
  const steps = 8;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await page.mouse.move(
      startX + (endX - startX) * t,
      startY + (endY - startY) * t,
    );
    await page.waitForTimeout(200);
    assert.equal(
      await secondaryShown(page),
      true,
      `submenu must stay open at gap step ${i}`,
    );
  }
}

test("Implement submenu hover, sticky section, and clicks", async (t) => {
  if (browserSkipReason || !browser) {
    t.skip(browserSkipReason || "Playwright Chromium unavailable");
    return;
  }

  const { context, page } = await openFixture(browser, {
    path: "/community/",
  });

  try {
    assert.equal(await secondaryShown(page), false);

    const implement = page.locator(
      ".site-nav--wide .site-nav__item--implement > a",
    );
    const about = page.locator(
      ".site-nav--wide .site-nav__list > .site-nav__item > a",
      { hasText: /^About$/ },
    );
    const home = page.locator(
      ".site-nav--wide .site-nav__list > .site-nav__item > a",
      { hasText: /^Home$/ },
    );
    const check = page.locator(
      '.site-nav-secondary--implement a[href="/implement/validate/"]',
    );

    await implement.hover();
    await page.waitForTimeout(50);
    assert.equal(await secondaryShown(page), true);

    await moveThroughGapSlowly(page, implement, check);
    assert.equal(await secondaryShown(page), true);

    await check.click();
    await page.waitForURL("**/implement/validate/**");
    assert.match(page.url(), /\/implement\/validate\/$/);

    await page.goto("http://joshternet.test/community/", {
      waitUntil: "domcontentloaded",
    });
    await implement.hover();
    await about.hover();
    await page.waitForTimeout(50);
    assert.equal(await secondaryShown(page), false);

    await page.goto("http://joshternet.test/implement/platforms/jekyll/", {
      waitUntil: "domcontentloaded",
    });
    assert.equal(await secondaryShown(page), true);

    const secondaryPosition = await page
      .locator(".site-nav-secondary--implement")
      .evaluate((el) => getComputedStyle(el).position);
    assert.equal(
      secondaryPosition,
      "absolute",
      "sticky submenu overlays via absolute positioning",
    );

    await about.hover();
    await page.waitForTimeout(50);
    assert.equal(await secondaryShown(page), false);
    const aboutShownWhileSticky = await page
      .locator(".site-nav-secondary--about")
      .evaluate((el) => !el.hidden && getComputedStyle(el).display !== "none");
    assert.equal(aboutShownWhileSticky, true);

    await home.hover();
    await page.waitForTimeout(220);
    assert.equal(await secondaryShown(page), true);

    await home.click();
    await page.waitForURL((url) => url.pathname === "/");
    assert.equal(new URL(page.url()).pathname, "/");

    await page.goto("http://joshternet.test/implement/platforms/jekyll/", {
      waitUntil: "domcontentloaded",
    });
    await implement.click();
    await page.waitForURL("**/implement/");
    assert.match(page.url(), /\/implement\/$/);
    assert.doesNotMatch(page.url(), /\/implement\/.+/);
  } finally {
    await context.close();
  }
});

test("sticky About section keeps the second-level row open on load", async (t) => {
  if (browserSkipReason || !browser) {
    t.skip(browserSkipReason || "Playwright Chromium unavailable");
    return;
  }

  const { context, page } = await openFixture(browser, {
    path: "/about/",
    section: "about",
  });

  try {
    const aboutShown = await page
      .locator(".site-nav-secondary--about")
      .evaluate((el) => !el.hidden && getComputedStyle(el).display !== "none");
    assert.equal(aboutShown, true);
    assert.equal(await secondaryShown(page), false);
  } finally {
    await context.close();
  }
});

test("touch tap opens the second-level row without requiring hover", async (t) => {
  if (browserSkipReason || !browser) {
    t.skip(browserSkipReason || "Playwright Chromium unavailable");
    return;
  }

  const { context, page } = await openFixture(browser, {
    path: "/wander/",
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  });
  const cdp = await page.context().newCDPSession(page);

  await cdp.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "hover", value: "none" },
      { name: "any-hover", value: "none" },
      { name: "pointer", value: "coarse" },
      { name: "any-pointer", value: "coarse" },
    ],
  });

  /**
   * @param {string} branch
   * @returns {Promise<boolean>}
   */
  function branchShown(branch) {
    return page.locator(`.site-nav-secondary--${branch}`).evaluate((el) => {
      return !el.hidden && getComputedStyle(el).display !== "none";
    });
  }

  try {
    const about = page.locator('.site-nav--wide [data-nav-branch="about"] > a');
    const network = page.locator(
      '.site-nav--wide [data-nav-branch="network"] > a',
    );
    const community = page.locator(
      '.site-nav-secondary--about a[href="/community/"]',
    );

    assert.equal(await branchShown("about"), false);

    await about.tap();
    assert.equal(await branchShown("about"), true);
    assert.match(page.url(), /\/wander\/$/);

    await page.locator("[data-wander-go]").tap();
    assert.equal(await branchShown("about"), false);
    assert.match(page.url(), /\/wander\/$/);

    await about.tap();
    assert.equal(await branchShown("about"), true);

    await network.tap();
    assert.equal(await branchShown("about"), false);
    assert.equal(await branchShown("network"), true);
    assert.match(page.url(), /\/wander\/$/);

    await about.tap();
    assert.equal(await branchShown("about"), true);
    await community.tap();
    await page.waitForURL("**/community/");
    assert.match(page.url(), /\/community\/$/);
  } finally {
    await context.close();
  }
});
