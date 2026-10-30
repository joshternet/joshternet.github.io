import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const networkScriptPath = fileURLToPath(
  new URL("../../assets/js/network.js", import.meta.url),
);

const networkScript = await readFile(networkScriptPath, "utf8");
const networkStyles = `
.network-card { display: flex; }
.network-card[hidden] { display: none; }
`;

const fixture = `
<!doctype html>
<html lang="en">
  <head>
    <style>${networkStyles}</style>
  </head>
  <body>
    <div data-network-toolbar hidden>
      <button type="button" data-network-filter="all" aria-pressed="true">All</button>
      <button type="button" data-network-filter="declined" aria-pressed="false">Non-Josh</button>
    </div>
    <strong data-network-count>4</strong>
    <span data-network-count-label>sites</span>
    <div data-network-grid>
      <article class="network-card" data-network-card data-identity="affirmed" data-title="aaron" data-domain="aaron.example">Aaron</article>
      <article class="network-card" data-network-card data-identity="affirmed" data-title="blake" data-domain="blake.example">Blake</article>
      <article class="network-card" data-network-card data-identity="declined" data-title="casey" data-domain="casey.example">Casey</article>
      <article class="network-card" data-network-card data-identity="undeclared" data-title="drew" data-domain="drew.example">Drew</article>
      <a class="network-surprise-card" href="/wander/">Wander somewhere</a>
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
 * Opens the network fixture with a fixed random source.
 * Math.random is stubbed because card order is intentionally nondeterministic.
 * @param {number} randomValue
 */
async function networkPage(randomValue) {
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

  await page.goto("http://joshternet.test/network/");
  await page.addScriptTag({ content: networkScript });

  return { context, page };
}

async function visibleTitles(page) {
  return page.locator("[data-network-card]:not([hidden])").allTextContents();
}

test("network cards shuffle once per visit and do not offer A-Z sort", async () => {
  const { context, page } = await networkPage(0);

  assert.equal(await page.locator("[data-network-sort]").count(), 0);
  assert.deepEqual(await visibleTitles(page), [
    "Blake",
    "Casey",
    "Drew",
    "Aaron",
  ]);
  assert.equal(
    await page.locator(".network-surprise-card").textContent(),
    "Wander somewhere",
  );

  await page.locator("[data-network-filter='declined']").click();

  assert.deepEqual(await visibleTitles(page), ["Casey"]);
  assert.equal(await page.locator("[data-network-count]").textContent(), "1");

  const displays = await page
    .locator("[data-network-card]")
    .evaluateAll((cards) =>
      cards.map((card) => ({
        identity: card.dataset.identity,
        hidden: card.hidden,
        display: getComputedStyle(card).display,
      })),
    );

  for (const card of displays) {
    if (card.identity === "declined") {
      assert.equal(card.hidden, false);
      assert.equal(card.display, "flex");
      continue;
    }

    assert.equal(card.hidden, true);
    assert.equal(card.display, "none");
  }

  await context.close();
});

test("a different random source produces a different card order", async () => {
  const { context, page } = await networkPage(0.999999);

  assert.deepEqual(await visibleTitles(page), [
    "Aaron",
    "Blake",
    "Casey",
    "Drew",
  ]);

  await context.close();
});
