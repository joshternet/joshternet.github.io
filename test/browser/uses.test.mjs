/**
 * Goal: /uses/ progressive enhancement — no-JS cards, period buttons, missing JSON.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

import { encodeCrawlValue } from "../../scripts/nlp/site-record.mjs";

const usesScriptPath = fileURLToPath(
  new URL("../../assets/js/uses.js", import.meta.url),
);
const usesScript = await readFile(usesScriptPath, "utf8");
const ORIGIN = "https://joshternet.test";

/**
 * @param {boolean} [withScript]
 * @param {{ dual?: boolean }} [options]
 * @returns {string}
 */
function buildFixture(withScript = true, options = {}) {
  const dual = Boolean(options.dual);
  const choices = dual
    ? `<li class="uses-card__choice" data-uses-product="brave" data-uses-count="5" data-uses-name="Brave" data-uses-share="83">
        <span class="uses-card__choice-name">Brave</span>
        <svg class="uses-cov__track" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true"><rect class="uses-cov__fill" x="0" y="0" width="83" height="1"></rect></svg>
        <span class="uses-card__choice-metrics">
          <span class="uses-card__choice-count">5 of 6</span>
          <span class="uses-card__choice-share">83%</span>
        </span>
      </li>
      <li class="uses-card__choice" data-uses-product="firefox" data-uses-count="1" data-uses-name="Firefox" data-uses-share="17">
        <span class="uses-card__choice-name">Firefox</span>
        <svg class="uses-cov__track" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true"><rect class="uses-cov__fill" x="0" y="0" width="17" height="1"></rect></svg>
        <span class="uses-card__choice-metrics">
          <span class="uses-card__choice-count">1 of 6</span>
          <span class="uses-card__choice-share">17%</span>
        </span>
      </li>`
    : `<li class="uses-card__choice" data-uses-product="firefox" data-uses-count="1" data-uses-name="Firefox" data-uses-share="100">
        <span class="uses-card__choice-name">Firefox</span>
        <svg class="uses-cov__track" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true"><rect class="uses-cov__fill" x="0" y="0" width="100" height="1"></rect></svg>
        <span class="uses-card__choice-metrics">
          <span class="uses-card__choice-count">1 of 1</span>
          <span class="uses-card__choice-share">100%</span>
        </span>
      </li>`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Uses</title></head>
<body>
  <div data-uses>
    <div data-uses-slots>
      <section class="uses-slot uses-card" data-uses-slot="browsers" data-uses-denominator="${dual ? 6 : 1}">
        <h3 class="uses-card__title">Browsers</h3>
        <ol class="uses-card__choices">
          ${choices}
        </ol>
      </section>
    </div>
  </div>
  <section data-uses-enhance hidden>
    <div class="uses-toolbar">
      <button type="button" data-uses-period="month" aria-pressed="true">Monthly</button>
      <button type="button" data-uses-period="quarter" aria-pressed="false">Quarterly</button>
    </div>
    <p data-uses-status role="status"></p>
    <div data-uses-chart></div>
  </section>
  ${withScript ? `<script>${usesScript}</script>` : ""}
</body>
</html>`;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} html
 * @returns {Promise<void>}
 */
async function openFixture(page, html) {
  await page.route(
    (url) => url.href === `${ORIGIN}/uses/` || url.href === `${ORIGIN}/uses`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: html,
      });
    },
  );
  await page.goto(`${ORIGIN}/uses/`, { waitUntil: "domcontentloaded" });
}

/** @type {import('playwright').Browser} */
let browser;

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  if (browser) {
    await browser.close();
  }
});

test("uses cards remain without script", async () => {
  const page = await browser.newPage();
  await openFixture(page, buildFixture(false));
  const text = await page.locator("[data-uses-slots]").innerText();
  assert.match(text, /Firefox/i);
  assert.match(text, /100%/);
  assert.equal(await page.locator("[data-uses-enhance]").isHidden(), true);
  await page.close();
});

test("uses slot cards stay calm without hover detail banners", async () => {
  const page = await browser.newPage();
  await page.route("**/assets/data/uses/**", async (route) => {
    await route.fulfill({ status: 404, body: "missing" });
  });
  await openFixture(page, buildFixture(true, { dual: true }));
  await page.waitForSelector('[data-uses-chart-shape="head_to_head"]');
  assert.equal(await page.locator("[data-uses-slot-detail]").count(), 0);
  await page.locator('[data-uses-product="brave"]').hover();
  assert.equal(await page.locator(".uses-card__choice.is-dimmed").count(), 0);
  assert.equal(await page.locator(".uses-card__choice.is-active").count(), 0);
  const text = await page.locator("[data-uses-slots]").innerText();
  assert.match(text, /Brave/);
  assert.match(text, /83%/);
  assert.doesNotMatch(text, /Brave — 5 of 6 sites/);
  assert.equal(await page.locator("[data-uses-multi-note]").count(), 0);
  assert.doesNotMatch(text, /Sites can report more than one/);
  await page.close();
});

test("uses script reveals enhance panel and handles missing JSON", async () => {
  const page = await browser.newPage();
  await page.route("**/assets/data/uses/**", async (route) => {
    await route.fulfill({ status: 404, body: "missing" });
  });
  await openFixture(page, buildFixture(true));
  await page.waitForSelector("[data-uses-enhance]:not([hidden])");
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-uses-status]");
    return /Historical views are not available yet/i.test(
      status ? status.textContent || "" : "",
    );
  });
  const status = await page.locator("[data-uses-status]").innerText();
  assert.match(status, /Historical views are not available yet/i);
  assert.match(status, /Current results are shown above/i);
  await page.locator('[data-uses-period="quarter"]').click();
  assert.equal(
    await page
      .locator('[data-uses-period="quarter"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.close();
});

test("uses empty period reports no observations", async () => {
  const page = await browser.newPage();
  await page.route("**/assets/data/uses/index.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        encodeCrawlValue({
          schema_version: 1,
          periods: [{ id: "2026-11", granularity: "month", complete: false }],
        }),
      ),
    });
  });
  await page.route(
    "**/assets/data/uses/periods/month/2026-11.json",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          encodeCrawlValue({
            period: "2026-11",
            is_complete: false,
            verified_uses_member_count: 1,
            tools: [],
          }),
        ),
      });
    },
  );
  await openFixture(page, buildFixture(true));
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-uses-status]");
    return /No observations are recorded for this period/i.test(
      status ? status.textContent || "" : "",
    );
  });
  await page.close();
});

test("uses keyboard period control updates aria-pressed", async () => {
  const page = await browser.newPage();
  await page.route("**/assets/data/uses/index.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        encodeCrawlValue({
          schema_version: 1,
          trend_ready: true,
          periods: [{ id: "2026-11", granularity: "month", complete: false }],
        }),
      ),
    });
  });
  await page.route(
    "**/assets/data/uses/periods/month/2026-11.json",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          encodeCrawlValue({
            period: "2026-11",
            is_complete: false,
            trend_ready: true,
            verified_uses_member_count: 1,
            tools: [{ tool_id: "firefox", active_member_count: 1 }],
          }),
        ),
      });
    },
  );
  await openFixture(page, buildFixture(true));
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-uses-status]");
    const chart = document.querySelector("[data-uses-chart]");
    const statusText = status ? status.textContent || "" : "";
    const chartText = chart ? chart.textContent || "" : "";
    return /firefox|Showing 2026-11/i.test(statusText + chartText);
  });
  const combined =
    (await page.locator("[data-uses-status]").innerText()) +
    (await page.locator("[data-uses-chart]").innerText());
  assert.match(combined, /firefox|Showing 2026-11/i);
  await page.close();
});

test("uses prefers a complete accrued month over the live incomplete one", async () => {
  const page = await browser.newPage();
  await page.route("**/assets/data/uses/index.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        encodeCrawlValue({
          schema_version: 1,
          trend_ready: true,
          periods: [
            { id: "2026-11", granularity: "month", complete: false },
            { id: "2026-10", granularity: "month", complete: true },
          ],
        }),
      ),
    });
  });
  await page.route(
    "**/assets/data/uses/periods/month/2026-10.json",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          encodeCrawlValue({
            period: "2026-10",
            is_complete: true,
            trend_ready: true,
            verified_uses_member_count: 1,
            tools: [{ tool_id: "neovim", active_member_count: 1 }],
          }),
        ),
      });
    },
  );
  await openFixture(page, buildFixture(true));
  await page.waitForFunction(() => {
    const status = document.querySelector("[data-uses-status]");
    const chart = document.querySelector("[data-uses-chart]");
    const text =
      (status ? status.textContent || "" : "") +
      (chart ? chart.textContent || "" : "");
    return /neovim|Showing 2026-10/i.test(text);
  });
  const combined =
    (await page.locator("[data-uses-status]").innerText()) +
    (await page.locator("[data-uses-chart]").innerText());
  assert.match(combined, /neovim|Showing 2026-10/i);
  await page.close();
});
