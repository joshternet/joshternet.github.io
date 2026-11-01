/**
 * Goal & Constraints:
 * Optional Playwright HTML render for JS-heavy creative pages. Off by default
 * in sync. When enabled: same-origin fetch only, no forms/login/purchase, no
 * media autoplay, time and subresource guards for process safety—not a page
 * quota. Prefer static HTML + Schema/OG when available.
 */

/** Default wall-clock budget for one rendered page. */
export const RENDER_TIMEOUT_MS = 12_000;

/** Max concurrent rendered resources (images/scripts) to keep the process safe. */
export const RENDER_MAX_SUBRESOURCES = 40;

/**
 * Loads Playwright (injectable for tests).
 * @param {(() => Promise<{ chromium: { launch: (opts: Record<string, unknown>) => Promise<unknown> } }>) | undefined} [importer]
 * @returns {Promise<{ chromium: { launch: (opts: Record<string, unknown>) => Promise<unknown> } }>}
 */
export async function loadPlaywright(importer) {
  if (typeof importer === "function") {
    return importer();
  }

  return import("playwright");
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function positiveNumber(value, fallback) {
  return typeof value === "number" && value > 0 ? value : fallback;
}

/**
 * Whether creative sync may request a browser-rendered DOM snapshot.
 * Requires an explicit opt-in; env and options both default to disabled.
 * @param {{
 *   enabled?: boolean,
 *   env?: Record<string, string | undefined>,
 * }} [options]
 * @returns {boolean}
 */
export function shouldRenderHtml(options = {}) {
  if (options.enabled === true) {
    return true;
  }

  if (options.enabled === false) {
    return false;
  }

  const env =
    options.env && typeof options.env === "object" ? options.env : process.env;
  const raw = env.JOSHTERNET_RENDER_HTML;
  const flag = String(typeof raw === "string" ? raw : "")
    .trim()
    .toLowerCase();

  return ["1", "true", "yes"].includes(flag);
}

/**
 * True when a URL is safe to open in the optional render path.
 * @param {string} url
 * @returns {boolean}
 */
export function isRenderableHttpUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Renders a page to HTML when Playwright is available and rendering is enabled.
 * Inject `browserFactory` in tests; production passes nothing and imports
 * playwright only when enabled.
 * @param {string} url
 * @param {{
 *   enabled?: boolean,
 *   env?: Record<string, string | undefined>,
 *   timeoutMs?: number,
 *   maxSubresources?: number,
 *   browserFactory?: () => Promise<{
 *     newPage: () => Promise<{
 *       goto: (href: string, opts: Record<string, unknown>) => Promise<unknown>,
 *       content: () => Promise<string>,
 *       route?: (pattern: string, handler: (route: {abort: () => Promise<void>, continue: () => Promise<void>}) => Promise<void>) => Promise<void>,
 *       close: () => Promise<void>,
 *     }>,
 *     close: () => Promise<void>,
 *   }>,
 *   importPlaywright?: () => Promise<{ chromium: { launch: (opts: Record<string, unknown>) => Promise<unknown> } }>,
 * }} [options]
 * @returns {Promise<string | null>} Rendered HTML, or null when disabled/unsafe/failed.
 */
export async function renderHtmlForExtraction(url, options = {}) {
  if (!shouldRenderHtml(options)) {
    return null;
  }

  if (!isRenderableHttpUrl(url)) {
    return null;
  }

  const timeoutMs = positiveNumber(options.timeoutMs, RENDER_TIMEOUT_MS);
  const maxSubresources = positiveNumber(
    options.maxSubresources,
    RENDER_MAX_SUBRESOURCES,
  );

  let browser;

  try {
    if (typeof options.browserFactory === "function") {
      browser = await options.browserFactory();
    } else {
      const playwright = await loadPlaywright(options.importPlaywright);
      browser = await playwright.chromium.launch({ headless: true });
    }

    const page = await browser.newPage();
    let subresourceCount = 0;

    if (typeof page.route === "function") {
      await page.route("**/*", async (route) => {
        subresourceCount += 1;

        if (subresourceCount > maxSubresources) {
          await route.abort();
          return;
        }

        await route.continue();
      });
    }

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    const html = await page.content();
    await page.close();
    return typeof html === "string" && html ? html : null;
  } catch {
    return null;
  } finally {
    await closeBrowserQuietly(browser);
  }
}

/**
 * @param {{ close?: () => Promise<void> } | null | undefined} browser
 * @returns {Promise<void>}
 */
async function closeBrowserQuietly(browser) {
  if (!browser || typeof browser.close !== "function") {
    return;
  }

  try {
    await browser.close();
  } catch {
    // Ignore close failures after a render attempt.
  }
}
