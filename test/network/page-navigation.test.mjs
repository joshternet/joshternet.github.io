/**
 * Goal: Settled Playwright navigations recover from redirect races without
 * aborting mid-goto. Page and timers are faked; no live browser.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isNavigationInterruptedError,
  navigateAndSettle,
  PAGE_NAV_NETWORKIDLE_MS,
  PAGE_NAV_SETTLE_MS,
  PAGE_NAV_TIMEOUT_MS,
  sameOriginHref,
  settlePage,
} from "../../scripts/network/page-navigation.mjs";

test("sameOriginHref and interrupt detection helpers", () => {
  assert.equal(
    sameOriginHref("https://a.example/x", "https://a.example/y"),
    true,
  );
  assert.equal(
    sameOriginHref("https://a.example/x", "https://b.example/x"),
    false,
  );
  assert.equal(sameOriginHref("not a url", "https://a.example/"), false);
  assert.equal(
    isNavigationInterruptedError(
      new Error(
        'Navigation to "https://a.example/a" is interrupted by another navigation to "https://a.example/b"',
      ),
    ),
    true,
  );
  assert.equal(isNavigationInterruptedError(new Error("timeout")), false);
  assert.equal(isNavigationInterruptedError(null), false);
  assert.equal(PAGE_NAV_SETTLE_MS, 1_500);
  assert.equal(PAGE_NAV_NETWORKIDLE_MS, 8_000);
  assert.equal(PAGE_NAV_TIMEOUT_MS, 20_000);
});

test("settlePage waits load, soft networkidle, and settle", async () => {
  /** @type {string[]} */
  const states = [];
  let settleMs = 0;

  await settlePage(
    {
      async waitForLoadState(state) {
        states.push(state);
        if (state === "networkidle") {
          throw new Error("never idle");
        }
      },
      async waitForTimeout(ms) {
        settleMs = ms;
      },
    },
    { settleMs: 40, networkIdleMs: 10, timeoutMs: 100 },
  );

  assert.deepEqual(states, ["load", "networkidle"]);
  assert.equal(settleMs, 40);

  await settlePage(
    {
      async waitForLoadState() {
        throw new Error("load missed");
      },
    },
    { settleMs: 0 },
  );

  // Default budgets (including settleMs / networkIdleMs / timeoutMs fallbacks).
  let defaultSettle = 0;
  await settlePage(
    {
      async waitForLoadState() {},
      async waitForTimeout(ms) {
        defaultSettle = ms;
      },
    },
    { timeoutMs: 0, settleMs: -1, networkIdleMs: 0 },
  );
  assert.equal(defaultSettle, PAGE_NAV_SETTLE_MS);

  await settlePage({});

  // settleMs > 0 but no waitForTimeout — skip the pause branch.
  await settlePage(
    {
      async waitForLoadState() {},
    },
    { settleMs: 25 },
  );
});

test("navigateAndSettle settles after a clean goto", async () => {
  /** @type {string[]} */
  const states = [];
  const response = { ok: () => true };

  const result = await navigateAndSettle(
    {
      async goto(url, options) {
        assert.equal(url, "https://a.example/about/");
        assert.equal(options?.waitUntil, "load");
        return response;
      },
      url: () => "https://a.example/about/",
      async waitForLoadState(state) {
        states.push(state);
      },
      async waitForTimeout() {},
    },
    "https://a.example/about/",
    { settleMs: 0, networkIdleMs: 5 },
  );

  assert.equal(result, response);
  assert.deepEqual(states, ["load", "networkidle"]);

  const withDefaults = await navigateAndSettle(
    {
      async goto(_url, options) {
        assert.equal(options?.waitUntil, "load");
        assert.equal(options?.timeout, PAGE_NAV_TIMEOUT_MS);
        return response;
      },
      async waitForLoadState() {},
      async waitForTimeout() {},
    },
    "https://a.example/",
    {
      timeoutMs: 0,
      settleMs: -1,
      waitUntil: "",
      attempts: 0,
    },
  );
  assert.equal(withDefaults, response);

  const customWait = await navigateAndSettle(
    {
      async goto(_url, options) {
        assert.equal(options?.waitUntil, "commit");
        assert.equal(options?.timeout, 12_000);
        return response;
      },
      async waitForLoadState() {},
      async waitForTimeout() {},
    },
    "https://a.example/",
    { settleMs: 0, waitUntil: "commit", timeoutMs: 12_000 },
  );
  assert.equal(customWait, response);

  // Fully default options object (and url() returning a blank string).
  const bare = await navigateAndSettle(
    {
      async goto() {
        return response;
      },
      url: () => "",
      async waitForLoadState() {},
      async waitForTimeout() {},
    },
    "https://a.example/",
  );
  assert.equal(bare, response);
});

test("navigateAndSettle accepts same-origin URL after an interrupt", async () => {
  let calls = 0;

  const result = await navigateAndSettle(
    {
      async goto() {
        calls += 1;
        throw new Error(
          'Navigation to "https://a.example/blogroll/" is interrupted by another navigation to "https://a.example/resources/"',
        );
      },
      url: () => "https://a.example/resources/",
      async waitForLoadState() {},
      async waitForTimeout() {},
    },
    "https://a.example/blogroll/",
    { settleMs: 0, attempts: 2 },
  );

  assert.equal(result, null);
  assert.equal(calls, 1);

  // No page.url() — cannot accept the interrupt as a same-origin landing.
  await assert.rejects(
    () =>
      navigateAndSettle(
        {
          async goto() {
            throw new Error(
              'Navigation to "https://a.example/a" is interrupted by another navigation to "https://a.example/b"',
            );
          },
          async waitForLoadState() {},
          async waitForTimeout() {},
        },
        "https://a.example/a",
        { settleMs: 0, attempts: 1 },
      ),
    /interrupted by another navigation/,
  );
});

test("navigateAndSettle retries once when interrupt leaves a foreign origin", async () => {
  let calls = 0;
  const response = { ok: () => true };

  const result = await navigateAndSettle(
    {
      async goto() {
        calls += 1;
        if (calls === 1) {
          throw new Error(
            'Navigation to "https://a.example/a" is interrupted by another navigation to "https://other.example/"',
          );
        }
        return response;
      },
      url: () =>
        calls === 1 ? "https://other.example/" : "https://a.example/a",
      async waitForLoadState() {},
      async waitForTimeout() {},
    },
    "https://a.example/a",
    { settleMs: 0, attempts: 2 },
  );

  assert.equal(result, response);
  assert.equal(calls, 2);
});

test("navigateAndSettle rethrows non-interrupt failures and honors abort", async () => {
  await assert.rejects(
    () =>
      navigateAndSettle(
        {
          async goto() {
            throw new Error("timeout exceeded");
          },
          async waitForLoadState() {},
          async waitForTimeout() {},
        },
        "https://a.example/",
        { settleMs: 0 },
      ),
    /timeout exceeded/,
  );

  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () =>
      navigateAndSettle(
        {
          async goto() {
            throw new Error("should not run");
          },
        },
        "https://a.example/",
        { signal: controller.signal },
      ),
    (error) => {
      assert.equal(error.name, "AbortError");
      return true;
    },
  );

  const withReason = new AbortController();
  withReason.abort(new Error("budget done"));
  await assert.rejects(
    () =>
      navigateAndSettle({ async goto() {} }, "https://a.example/", {
        signal: withReason.signal,
      }),
    /budget done/,
  );

  const withString = new AbortController();
  withString.abort("string budget");
  await assert.rejects(
    () =>
      navigateAndSettle({ async goto() {} }, "https://a.example/", {
        signal: withString.signal,
      }),
    /string budget/,
  );

  const withEmpty = new AbortController();
  withEmpty.abort("");
  await assert.rejects(
    () =>
      navigateAndSettle({ async goto() {} }, "https://a.example/", {
        signal: withEmpty.signal,
      }),
    (error) => {
      assert.equal(error.name, "AbortError");
      assert.equal(error.message, "Aborted");
      return true;
    },
  );
});

test("navigateAndSettle throws the last interrupt when retries are exhausted", async () => {
  await assert.rejects(
    () =>
      navigateAndSettle(
        {
          async goto() {
            throw new Error(
              'Navigation to "https://a.example/a" is interrupted by another navigation to "https://b.example/"',
            );
          },
          url: () => "https://b.example/",
          async waitForLoadState() {},
          async waitForTimeout() {},
        },
        "https://a.example/a",
        { settleMs: 0, attempts: 1 },
      ),
    /interrupted by another navigation/,
  );

  await assert.rejects(
    () =>
      navigateAndSettle(
        {
          async goto() {
            throw "interrupted by another navigation to elsewhere";
          },
          url: () => "",
        },
        "https://a.example/a",
        { settleMs: 0, attempts: 1 },
      ),
    /interrupted by another navigation/,
  );
});
