/**
 * Goal: Compact (mobile) accordion — the whole parent row toggles children.
 * Fixture HTML + compact CSS only (no live Jekyll, no site-nav.js).
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const COMPACT_CSS = `
  :root {
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --gutter: 1rem;
    --color-border: #334;
    --color-surface: #10202c;
    --color-accent: #4aa8e8;
    --color-accent-soft: #1a3a55;
    --radius-medium: 0.5rem;
    --radius-small: 0.35rem;
  }
  body { margin: 0; font-family: sans-serif; }
  .site-nav--compact {
    position: relative;
    z-index: 50;
    width: min(22.5rem, calc(100vw - 2rem));
    max-height: min(36rem, calc(100dvh - 5.5rem));
    overflow: auto;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-medium);
    background: var(--color-surface);
  }
  .site-nav--compact .site-nav__list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .site-nav--compact .site-nav__item,
  .site-nav--compact .site-nav__item--branch,
  .site-nav--compact .site-nav__branch {
    display: block;
    width: 100%;
  }
  .site-nav--compact a {
    display: flex;
    width: 100%;
    min-block-size: 2.75rem;
    align-items: center;
    padding-inline: var(--space-3);
    text-decoration: none;
  }
  .site-nav--compact .site-nav__branch > summary {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    min-block-size: 2.75rem;
    align-items: center;
    justify-content: space-between;
    padding-inline: var(--space-3);
    appearance: none;
    border: 0;
    background: transparent;
    list-style: none;
    cursor: pointer;
  }
  .site-nav--compact .site-nav__branch > summary::-webkit-details-marker,
  .site-nav--compact .site-nav__branch > summary::marker {
    display: none;
    content: none;
  }
  .site-nav--compact .site-nav__branch > summary::after { content: "↓"; }
  .site-nav--compact .site-nav__branch[open] > summary::after {
    transform: rotate(180deg);
  }
  .site-nav--compact .site-nav__children {
    width: auto;
    margin: 0;
    margin-inline-start: var(--space-3);
    padding: 0;
    border-inline-start: 2px solid var(--color-accent-soft);
    list-style: none;
  }
  .site-nav--compact .site-nav__children li { display: block; width: 100%; }
  .site-nav--compact .site-nav__children a {
    display: flex;
    width: 100%;
    min-block-size: 2.75rem;
    padding-inline: var(--space-3);
    white-space: normal;
  }
`;

const COMPACT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compact nav fixture</title>
    <style>${COMPACT_CSS}</style>
  </head>
  <body>
    <details class="site-nav-menu" open>
      <summary>Menu</summary>
      <nav class="site-nav site-nav--compact" aria-label="Primary">
        <ul class="site-nav__list">
          <li class="site-nav__item"><a href="/">Home</a></li>
          <li class="site-nav__item site-nav__item--branch site-nav__item--about">
            <details class="site-nav__branch">
              <summary>About</summary>
              <ul class="site-nav__children">
                <li><a href="/about/">About</a></li>
                <li><a href="/community/">Community</a></li>
                <li><a href="/governance/">Governance</a></li>
              </ul>
            </details>
          </li>
          <li class="site-nav__item"><a href="/wander/">Wander</a></li>
        </ul>
      </nav>
    </details>
  </body>
</html>`;

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
 * Opens the compact accordion fixture at a phone-sized viewport.
 * @param {import("playwright").Browser} browserInstance
 * @returns {Promise<{ context: import("playwright").BrowserContext, page: import("playwright").Page }>}
 */
async function openCompact(browserInstance) {
  const context = await browserInstance.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.setContent(COMPACT_HTML, { waitUntil: "domcontentloaded" });
  return { context, page };
}

test("compact accordion opens from a tap anywhere on the parent row", async (t) => {
  if (browserSkipReason || !browser) {
    t.skip(browserSkipReason || "Playwright Chromium unavailable");
    return;
  }

  const { context, page } = await openCompact(browser);

  try {
    const menu = page.locator(".site-nav-menu");
    const panel = page.locator(".site-nav--compact");
    const details = page.locator(".site-nav__item--about .site-nav__branch");
    const summary = page.locator(".site-nav__item--about summary");
    const hub = page.locator('.site-nav__children a[href="/about/"]');
    const child = page.locator('.site-nav__children a[href="/community/"]');

    assert.equal(await page.locator(".site-nav__item--about > a").count(), 0);
    assert.equal(await details.evaluate((el) => el.open), false);
    assert.equal(await child.isVisible(), false);

    const summaryBox = await summary.boundingBox();
    assert.ok(summaryBox, "summary box");
    assert.ok(
      summaryBox.width > (await panel.boundingBox()).width * 0.8,
      "the whole parent row must be the toggle",
    );

    await summary.click({ position: { x: 24, y: summaryBox.height / 2 } });
    assert.equal(await details.evaluate((el) => el.open), true);
    assert.equal(await menu.evaluate((el) => el.open), true);
    assert.equal(await child.isVisible(), true);
    assert.equal(await hub.isVisible(), true);

    const childBox = await child.boundingBox();
    const openSummaryBox = await summary.boundingBox();
    assert.ok(childBox, "child box");
    assert.ok(openSummaryBox, "open summary box");
    assert.ok(
      openSummaryBox.height <= 48,
      "toggle must stay a single row, not stretch over children",
    );
    assert.ok(
      childBox.y >= openSummaryBox.y + openSummaryBox.height - 2,
      "children must sit under the parent row",
    );
    assert.ok(childBox.height >= 40, "child links must be tappable");

    await summary.click({ position: { x: 24, y: openSummaryBox.height / 2 } });
    assert.equal(await details.evaluate((el) => el.open), false);
    assert.equal(await child.isVisible(), false);
    assert.equal(await menu.evaluate((el) => el.open), true);
  } finally {
    await context.close();
  }
});

test("compact accordion summary toggles with keyboard", async (t) => {
  if (browserSkipReason || !browser) {
    t.skip(browserSkipReason || "Playwright Chromium unavailable");
    return;
  }

  const { context, page } = await openCompact(browser);

  try {
    const details = page.locator(".site-nav__item--about .site-nav__branch");
    const summary = page.locator(".site-nav__item--about summary");
    const child = page.locator('.site-nav__children a[href="/community/"]');

    await summary.focus();
    await page.keyboard.press("Enter");
    assert.equal(await details.evaluate((el) => el.open), true);
    assert.equal(await child.isVisible(), true);

    await page.keyboard.press(" ");
    assert.equal(await details.evaluate((el) => el.open), false);
    assert.equal(await child.isVisible(), false);
  } finally {
    await context.close();
  }
});
