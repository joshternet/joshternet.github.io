/**
 * Goal & Constraints:
 * Member-page Playwright navigations must survive client redirects and must
 * not race the next URL. Wait until load, soft-networkidle, then a fixed
 * settle. On "interrupted by another navigation", wait for the winning load
 * and retry once (or accept a same-origin final URL). AbortSignal is honored
 * between attempts, not passed into page.goto, so soft enrichment budgets do
 * not abort mid-flight and leave a half-started navigation.
 */

/** @type {number} Brief pause after load before reading the DOM. */
export const PAGE_NAV_SETTLE_MS = 1_500;

/** @type {number} Soft networkidle budget (analytics often never idle). */
export const PAGE_NAV_NETWORKIDLE_MS = 8_000;

/** @type {number} Default navigation timeout. */
export const PAGE_NAV_TIMEOUT_MS = 20_000;

/**
 * True when both URLs share an origin.
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
export function sameOriginHref(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

/**
 * True when Playwright reports a navigation superseded mid-flight.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isNavigationInterruptedError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /interrupted by another navigation/i.test(message);
}

/**
 * Waits for load + soft networkidle + settle. Never throws for settle timeouts.
 * @param {{
 *   waitForLoadState?: (state: string, opts?: { timeout?: number }) => Promise<unknown>,
 *   waitForTimeout?: (ms: number) => Promise<unknown>,
 * }} page
 * @param {{ timeoutMs?: number, settleMs?: number, networkIdleMs?: number }} [options]
 * @returns {Promise<void>}
 */
export async function settlePage(page, options = {}) {
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : PAGE_NAV_TIMEOUT_MS;
  const settleMs =
    typeof options.settleMs === "number" && options.settleMs >= 0
      ? options.settleMs
      : PAGE_NAV_SETTLE_MS;
  const networkIdleMs =
    typeof options.networkIdleMs === "number" && options.networkIdleMs > 0
      ? options.networkIdleMs
      : PAGE_NAV_NETWORKIDLE_MS;

  if (typeof page.waitForLoadState === "function") {
    try {
      await page.waitForLoadState("load", { timeout: timeoutMs });
    } catch {
      // goto may already have reached load or timed out; keep settling.
    }

    try {
      await page.waitForLoadState("networkidle", {
        timeout: Math.min(timeoutMs, networkIdleMs),
      });
    } catch {
      // Long-polling / analytics often prevent idle.
    }
  }

  if (settleMs > 0 && typeof page.waitForTimeout === "function") {
    await page.waitForTimeout(settleMs);
  }
}

/**
 * @param {AbortSignal | null | undefined} signal
 * @returns {void}
 * @throws {DOMException | Error} When the signal is already aborted.
 */
function throwIfAborted(signal) {
  if (!signal?.aborted) {
    return;
  }

  const reason = signal.reason;
  if (reason instanceof Error) {
    throw reason;
  }

  const error = new Error(
    typeof reason === "string" && reason ? reason : "Aborted",
  );
  error.name = "AbortError";
  throw error;
}

/**
 * Navigates and settles, recovering from client-side redirect races.
 * @param {{
 *   goto: (
 *     url: string,
 *     options?: { waitUntil?: string, timeout?: number },
 *   ) => Promise<unknown>,
 *   url?: () => string,
 *   waitForLoadState?: (state: string, opts?: { timeout?: number }) => Promise<unknown>,
 *   waitForTimeout?: (ms: number) => Promise<unknown>,
 * }} page
 * @param {string} href
 * @param {{
 *   timeoutMs?: number,
 *   settleMs?: number,
 *   networkIdleMs?: number,
 *   waitUntil?: string,
 *   signal?: AbortSignal,
 *   attempts?: number,
 * }} [options]
 * @returns {Promise<unknown>}
 * @throws {Error} When navigation fails after retries (or the signal aborts).
 */
export async function navigateAndSettle(page, href, options = {}) {
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : PAGE_NAV_TIMEOUT_MS;
  const settleMs =
    typeof options.settleMs === "number" && options.settleMs >= 0
      ? options.settleMs
      : PAGE_NAV_SETTLE_MS;
  const waitUntil =
    typeof options.waitUntil === "string" && options.waitUntil
      ? options.waitUntil
      : "load";
  const attempts =
    typeof options.attempts === "number" && options.attempts > 0
      ? options.attempts
      : 2;

  /** @type {unknown} */
  let lastError = new Error(`navigation failed for ${href}`);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    throwIfAborted(options.signal);

    try {
      const response = await page.goto(href, {
        waitUntil,
        timeout: timeoutMs,
      });
      await settlePage(page, {
        timeoutMs,
        settleMs,
        networkIdleMs: options.networkIdleMs,
      });
      return response;
    } catch (error) {
      lastError = error;

      if (!isNavigationInterruptedError(error)) {
        throw error;
      }

      await settlePage(page, {
        timeoutMs,
        settleMs,
        networkIdleMs: options.networkIdleMs,
      });

      const finalUrl =
        typeof page.url === "function" ? String(page.url() || "") : "";

      if (finalUrl && sameOriginHref(finalUrl, href)) {
        return null;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
