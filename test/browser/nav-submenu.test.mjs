/**
 * Goal: Verify Implement submenu open/close and click paths in a real browser.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright";

const FULL =
  "/var/folders/_r/kbn1191x4jx4fgv05fsx2q1c0000gn/T/cursor-sandbox-cache/80f047044e09314b0fad711907ef582f/playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const HEADLESS =
  "/var/folders/_r/kbn1191x4jx4fgv05fsx2q1c0000gn/T/cursor-sandbox-cache/80f047044e09314b0fad711907ef582f/playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";

const executablePath = existsSync(FULL) ? FULL : HEADLESS;

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
    // Pause longer than the former 160ms item-leave grace in the dead zone.
    await page.waitForTimeout(200);
    assert.equal(
      await secondaryShown(page),
      true,
      `submenu must stay open at gap step ${i}`,
    );
  }
}

test("Implement submenu hover, sticky section, and clicks", async (t) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath });
  } catch (error) {
    t.skip(`Playwright Chromium unavailable: ${error.message}`);
    return;
  }

  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });

  try {
    await page.goto("http://127.0.0.1:4000/community/", {
      waitUntil: "networkidle",
    });
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

    await page.goto("http://127.0.0.1:4000/community/", {
      waitUntil: "networkidle",
    });
    await implement.hover();
    await about.hover();
    await page.waitForTimeout(50);
    assert.equal(await secondaryShown(page), false);

    await page.goto("http://127.0.0.1:4000/implement/platforms/jekyll/", {
      waitUntil: "networkidle",
    });
    assert.equal(await secondaryShown(page), true);

    const mainTop = await page.locator(".site-main").evaluate((el) => {
      return el.getBoundingClientRect().top;
    });
    const headerBottom = await page.locator(".site-header").evaluate((el) => {
      return el.getBoundingClientRect().bottom;
    });
    assert.equal(
      mainTop,
      headerBottom,
      "sticky submenu must overlay without pushing main",
    );

    await about.hover();
    await page.waitForTimeout(220);
    assert.equal(await secondaryShown(page), true);

    await home.click();
    await page.waitForURL((url) => url.pathname === "/");
    assert.equal(new URL(page.url()).pathname, "/");

    await page.goto("http://127.0.0.1:4000/implement/platforms/jekyll/", {
      waitUntil: "networkidle",
    });
    await implement.click();
    await page.waitForURL("**/implement/");
    assert.match(page.url(), /\/implement\/$/);
    assert.doesNotMatch(page.url(), /\/implement\/.+/);
  } finally {
    await browser.close();
  }
});

test("second-level nav right edge matches the top-level nav", async (t) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath });
  } catch (error) {
    t.skip(`Playwright Chromium unavailable: ${error.message}`);
    return;
  }

  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });

  try {
    await page.goto("http://127.0.0.1:4000/about/", {
      waitUntil: "networkidle",
    });

    const primaryRight = await page
      .locator('.site-nav--wide [data-nav-branch="joshbot"] > a')
      .evaluate((el) => el.getBoundingClientRect().right);
    const secondaryRight = await page
      .locator(".site-nav-secondary--about a")
      .last()
      .evaluate((el) => el.getBoundingClientRect().right);

    assert.ok(
      Math.abs(primaryRight - secondaryRight) < 1,
      `second-level right ${secondaryRight} must match top-level right ${primaryRight}`,
    );
  } finally {
    await browser.close();
  }
});

test("touch tap opens the second-level row without requiring hover", async (t) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath });
  } catch (error) {
    t.skip(`Playwright Chromium unavailable: ${error.message}`);
    return;
  }

  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
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
    await page.goto("http://127.0.0.1:4000/wander/", {
      waitUntil: "networkidle",
    });

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
    await browser.close();
  }
});
