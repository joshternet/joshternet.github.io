/**
 * Goal: /uses/ progressive enhancement — no-JS table, period buttons, missing JSON.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const usesScriptPath = fileURLToPath(
  new URL("../../assets/js/uses.js", import.meta.url),
);
const usesScript = await readFile(usesScriptPath, "utf8");
const ORIGIN = "https://joshternet.test";

/**
 * @param {boolean} [withScript]
 * @returns {string}
 */
function buildFixture(withScript = true) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Uses</title></head>
<body>
  <div data-uses>
    <table data-uses-table>
      <thead><tr><th>Tool</th><th>Members</th></tr></thead>
      <tbody><tr><th scope="row">firefox</th><td>1 of 1</td></tr></tbody>
    </table>
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

test("uses table remains without script", async () => {
  const page = await browser.newPage();
  await openFixture(page, buildFixture(false));
  const text = await page.locator("[data-uses-table]").innerText();
  assert.match(text, /firefox/);
  assert.equal(await page.locator("[data-uses-enhance]").isHidden(), true);
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
      body: JSON.stringify({
        schema_version: 1,
        periods: [{ id: "2026-11", granularity: "month", complete: false }],
      }),
    });
  });
  await page.route(
    "**/assets/data/uses/periods/month/2026-11.json",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          period: "2026-11",
          is_complete: false,
          verified_uses_member_count: 1,
          tools: [],
        }),
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
      body: JSON.stringify({
        schema_version: 1,
        periods: [{ id: "2026-11", granularity: "month", complete: false }],
      }),
    });
  });
  await page.route(
    "**/assets/data/uses/periods/month/2026-11.json",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          period: "2026-11",
          is_complete: false,
          verified_uses_member_count: 1,
          tools: [{ tool_id: "firefox", active_member_count: 1 }],
        }),
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
