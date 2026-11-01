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
      <button type="button" data-network-sort="discover" aria-pressed="true" class="is-active">Discover</button>
      <button type="button" data-network-sort="recent" aria-pressed="false">Recently joined</button>
      <button type="button" data-network-sort="oldest" aria-pressed="false">Oldest first</button>
      <button type="button" data-network-sort="alpha" aria-pressed="false">Alphabetical</button>
    </div>
    <strong data-network-count>4</strong>
    <span data-network-count-label>sites</span>
    <div data-network-grid>
      <article class="network-card" data-network-card data-identity="affirmed" data-title="aaron" data-domain="aaron.example" data-origin="https://aaron.example" data-first-participated-at="2026-01-01T00:00:00.000Z">Aaron</article>
      <article class="network-card" data-network-card data-identity="affirmed" data-title="blake" data-domain="blake.example" data-origin="https://blake.example" data-first-participated-at="2026-03-01T00:00:00.000Z">Blake</article>
      <article class="network-card" data-network-card data-identity="declined" data-title="casey" data-domain="casey.example" data-origin="https://casey.example" data-first-participated-at="2026-02-01T00:00:00.000Z">Casey</article>
      <article class="network-card" data-network-card data-identity="undeclared" data-title="drew" data-domain="drew.example" data-origin="https://drew.example" data-first-participated-at="not-a-date">Drew</article>
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
 * @param {number} randomValue
 * @param {string} [search]
 */
async function networkPage(randomValue, search = "") {
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

  await page.goto(`http://joshternet.test/network/${search}`);
  await page.addScriptTag({ content: networkScript });

  return { context, page };
}

/**
 * @param {import('playwright').Page} page
 */
async function visibleTitles(page) {
  return page.locator("[data-network-card]:not([hidden])").allTextContents();
}

test("network cards shuffle once per visit by default (Discover)", async () => {
  const { context, page } = await networkPage(0);

  assert.equal(await page.locator("[data-network-sort]").count(), 4);
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

test("a different random source produces a different Discover order", async () => {
  const { context, page } = await networkPage(0.999999);

  assert.deepEqual(await visibleTitles(page), [
    "Aaron",
    "Blake",
    "Casey",
    "Drew",
  ]);

  await context.close();
});

test("Recently joined sorts by first_participated_at with invalid dates last", async () => {
  const { context, page } = await networkPage(0);

  await page.locator('[data-network-sort="recent"]').click();
  assert.deepEqual(await visibleTitles(page), [
    "Blake",
    "Casey",
    "Aaron",
    "Drew",
  ]);
  assert.match(page.url(), /sort=recent/);

  await page.locator('[data-network-filter="declined"]').click();
  assert.deepEqual(await visibleTitles(page), ["Casey"]);
  assert.match(page.url(), /identity=declined/);
  assert.match(page.url(), /sort=recent/);

  await context.close();
});

test("Alphabetical sort and Oldest first work with identity filters", async () => {
  const { context, page } = await networkPage(0);

  await page.locator('[data-network-sort="alpha"]').click();
  assert.deepEqual(await visibleTitles(page), [
    "Aaron",
    "Blake",
    "Casey",
    "Drew",
  ]);

  await page.locator('[data-network-sort="oldest"]').click();
  assert.deepEqual(await visibleTitles(page), [
    "Aaron",
    "Casey",
    "Blake",
    "Drew",
  ]);

  await context.close();
});

test("site deep link stays visible when identity filter would hide it", async () => {
  const { context, page } = await networkPage(
    0,
    "?identity=declined&site=blake.example",
  );

  assert.equal(
    await page
      .locator('[data-domain="blake.example"]')
      .evaluate((card) => card.hidden),
    false,
  );
  assert.deepEqual(await visibleTitles(page), ["Blake", "Casey"]);

  await context.close();
});

test("site deep link focuses the card article, not a partial body link", async () => {
  const { context, page } = await networkPage(0, "?site=aaron.example");
  const card = page.locator('[data-domain="aaron.example"]');

  await page.waitForFunction(() => {
    const target = document.querySelector(
      '[data-domain="aaron.example"].is-targeted',
    );

    return Boolean(target && document.activeElement === target);
  });

  assert.equal(await card.getAttribute("tabindex"), "-1");
  assert.equal(
    await page.evaluate(
      () => document.activeElement?.getAttribute("data-domain") || "",
    ),
    "aaron.example",
  );

  await context.close();
});
