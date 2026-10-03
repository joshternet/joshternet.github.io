/**
 * Goal: Search input is labeled and empty query does not dump the corpus.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const searchScript = await readFile(
  fileURLToPath(new URL("../../assets/js/search.js", import.meta.url)),
  "utf8",
);

let browser;

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
});

test("search requires a query and announces status", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route("https://joshternet.test/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/search/index.json")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          documents: [
            {
              type: "content",
              title: "Corkboard",
              summary: "pins",
              domain: "a.example",
              origin: "https://a.example",
              url: "https://a.example/corkboard/",
              topics: ["experiments"],
              site_title: "Example Site",
              published_at: "2026-10-01T00:00:00.000Z",
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Joshternet</title>",
    });
  });

  await page.goto("https://joshternet.test/");
  await page.setContent(`<!doctype html>
    <label for="joshternet-search">Search the Joshternet</label>
    <input id="joshternet-search" data-search-input>
    <p data-search-status role="status"></p>
    <ol data-search-results></ol>
    <script>${searchScript}</script>
  `);

  await page.getByText("Type a word from a title, domain, or topic.").waitFor();
  assert.equal(await page.locator("[data-search-results] li").count(), 0);

  await page.locator("[data-search-input]").fill("corkboard");
  await page.locator("[data-search-results] li").waitFor();
  assert.match(
    await page.locator("[data-search-status]").innerText(),
    /1 matching/,
  );
  assert.equal(await page.locator("[data-search-results] li").count(), 1);
  assert.equal(await page.locator(".activity-card").count(), 1);
  assert.match(
    await page.locator(".activity-card__title").innerText(),
    /Corkboard/,
  );
  assert.equal(
    await page
      .locator(".activity-card__title [aria-hidden='true']")
      .innerText(),
    "↗",
  );
  assert.equal(
    await page.locator(".activity-card__author").innerText(),
    "Example Site",
  );
  assert.equal(await page.locator(".activity-card.h-entry").count(), 1);
  assert.equal(
    await page.locator(".p-author.h-card .p-name").innerText(),
    "Example Site",
  );
  assert.equal(await page.locator(".p-category").innerText(), "experiments");
  assert.equal(
    await page.locator(".activity-card__summary").innerText(),
    "pins",
  );
  assert.equal(
    await page.locator(".activity-card__topics").innerText(),
    "experiments",
  );
  assert.equal(
    await page.locator(".activity-card__domain").innerText(),
    "a.example",
  );
  assert.equal(
    await page.locator(".activity-card__title a").getAttribute("target"),
    "_blank",
  );

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot();
  }

  await context.close();
});
