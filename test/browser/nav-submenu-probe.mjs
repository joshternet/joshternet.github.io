/**
 * Goal: Probe Implement submenu show/hide and clickability with Playwright.
 * Run: node test/browser/nav-submenu-probe.mjs
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const FULL =
  "/var/folders/_r/kbn1191x4jx4fgv05fsx2q1c0000gn/T/cursor-sandbox-cache/80f047044e09314b0fad711907ef582f/playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const HEADLESS =
  "/var/folders/_r/kbn1191x4jx4fgv05fsx2q1c0000gn/T/cursor-sandbox-cache/80f047044e09314b0fad711907ef582f/playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";

const browser = await chromium.launch({
  headless: true,
  executablePath: existsSync(FULL) ? FULL : HEADLESS,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

/**
 * @returns {Promise<{display:string,pe:string,top:number,height:number,width:number,shown:boolean}>}
 */
async function secondaryState() {
  return page.locator(".site-nav-secondary--implement").evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      display: s.display,
      pe: s.pointerEvents,
      top: r.top,
      height: r.height,
      width: r.width,
      shown: s.display !== "none" && r.height > 0,
    };
  });
}

/**
 * @param {string} label
 */
async function report(label) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(await secondaryState()));
}

await page.goto("http://127.0.0.1:4000/community/", {
  waitUntil: "networkidle",
});
await report("community initial");

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

const implBox = await implement.boundingBox();
console.log("implement box", implBox);

await implement.hover();
await page.waitForTimeout(150);
await report("after hover Implement");

const checkBox2 = await check.boundingBox();
console.log("check box after hover", checkBox2);

if (checkBox2 && implBox) {
  for (let i = 1; i <= 10; i += 1) {
    const x =
      implBox.x +
      implBox.width / 2 +
      (checkBox2.x + checkBox2.width / 2 - (implBox.x + implBox.width / 2)) *
        (i / 10);
    const y =
      implBox.y +
      implBox.height / 2 +
      (checkBox2.y + checkBox2.height / 2 - (implBox.y + implBox.height / 2)) *
        (i / 10);
    await page.mouse.move(x, y);
    await page.waitForTimeout(50);
    const shown = (await secondaryState()).shown;
    const hit = await page.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px, py);
        return (
          el && {
            tag: el.tagName,
            text: (el.textContent || "").trim().slice(0, 30),
            cls: el.className.toString().slice(0, 60),
          }
        );
      },
      [x, y],
    );
    console.log(
      `step ${i} (${x.toFixed(0)},${y.toFixed(0)}) shown=${shown} hit=${JSON.stringify(hit)}`,
    );
  }
}

await about.hover();
await page.waitForTimeout(100);
await report("hover About from community (expect hide)");

await page.goto("http://127.0.0.1:4000/implement/platforms/jekyll/", {
  waitUntil: "networkidle",
});
await report("jekyll sticky initial");

const homeBox = await home.boundingBox();
console.log(
  "elementFromPoint Home:",
  await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return (
        el && {
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 40),
          cls: el.className?.toString?.().slice(0, 80),
        }
      );
    },
    { x: homeBox.x + homeBox.width / 2, y: homeBox.y + homeBox.height / 2 },
  ),
);

try {
  await home.click({ timeout: 2000 });
  console.log("Home click OK", page.url());
} catch (error) {
  console.log("Home click FAIL", error.message);
}

await page.goto("http://127.0.0.1:4000/implement/platforms/jekyll/", {
  waitUntil: "networkidle",
});
await about.hover();
await page.waitForTimeout(100);
await report("jekyll + hover About (expect STAY)");

await implement.hover();
await page.waitForTimeout(100);
await report("jekyll + hover Implement");

const cb = await check.boundingBox();
const ib = await implement.boundingBox();
if (cb && ib) {
  for (let i = 1; i <= 10; i += 1) {
    const x =
      ib.x +
      ib.width / 2 +
      (cb.x + cb.width / 2 - (ib.x + ib.width / 2)) * (i / 10);
    const y =
      ib.y +
      ib.height / 2 +
      (cb.y + cb.height / 2 - (ib.y + ib.height / 2)) * (i / 10);
    await page.mouse.move(x, y);
    await page.waitForTimeout(50);
    console.log(
      `jekyll path step ${i} shown=${(await secondaryState()).shown}`,
    );
  }
  try {
    await check.click({ timeout: 2000 });
    console.log("Check click OK", page.url());
  } catch (error) {
    console.log("Check click FAIL", error.message);
  }
}

await browser.close();
