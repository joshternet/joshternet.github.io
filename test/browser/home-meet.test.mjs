/**
 * Goal: Homepage Meet preview shuffles participants and shows only three.
 * Math.random is stubbed because order is intentionally nondeterministic.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const homeMeetScriptPath = fileURLToPath(
  new URL("../../assets/js/home-meet.js", import.meta.url),
);

const homeMeetScript = await readFile(homeMeetScriptPath, "utf8");

const fixture = `
<!doctype html>
<html lang="en">
  <body>
    <div class="home-meet__grid" data-home-meet-grid>
      <article data-home-meet-card data-domain="aaron.example">Aaron</article>
      <article data-home-meet-card data-domain="blake.example">Blake</article>
      <article data-home-meet-card data-domain="casey.example">Casey</article>
      <article data-home-meet-card data-domain="drew.example">Drew</article>
      <article data-home-meet-card data-domain="eden.example">Eden</article>
    </div>
  </body>
</html>
`;

let browser;

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
});

/**
 * Opens the homepage Meet fixture with a fixed random source.
 * @param {number} randomValue - Stubbed Math.random return value.
 */
async function homeMeetPage(randomValue) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript((value) => {
    Math.random = () => value;
  }, randomValue);

  await page.route("http://joshternet.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: fixture,
    });
  });

  await page.goto("http://joshternet.test/");
  await page.addScriptTag({ content: homeMeetScript });

  return { context, page };
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>}
 */
async function visibleDomains(page) {
  return page
    .locator("[data-home-meet-card]:not([hidden])")
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("data-domain") || ""),
    );
}

test("Meet preview shows three shuffled participants per visit", async () => {
  const { context, page } = await homeMeetPage(0);

  assert.equal(
    await page
      .locator("[data-home-meet-grid]")
      .getAttribute("data-home-meet-ready"),
    "true",
  );
  assert.equal(
    await page.locator("[data-home-meet-card]:not([hidden])").count(),
    3,
  );
  assert.equal(await page.locator("[data-home-meet-card][hidden]").count(), 2);
  assert.deepEqual(await visibleDomains(page), [
    "blake.example",
    "casey.example",
    "drew.example",
  ]);

  await context.close();
});

test("a different random source produces a different Meet preview", async () => {
  const { context, page } = await homeMeetPage(0.99);

  assert.deepEqual(await visibleDomains(page), [
    "aaron.example",
    "blake.example",
    "casey.example",
  ]);

  await context.close();
});
