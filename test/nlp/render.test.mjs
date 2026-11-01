/**
 * Goal: Optional Playwright render stays off by default; injected factory covers
 * the enabled path without launching a real browser.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  RENDER_MAX_SUBRESOURCES,
  RENDER_TIMEOUT_MS,
  isRenderableHttpUrl,
  loadPlaywright,
  positiveNumber,
  renderHtmlForExtraction,
  shouldRenderHtml,
} from "../../scripts/nlp/render.mjs";

test("loadPlaywright uses injected importer or real module", async () => {
  const fake = { chromium: { launch: async () => ({}) } };
  assert.equal(await loadPlaywright(async () => fake), fake);
  const real = await loadPlaywright();
  assert.equal(typeof real.chromium.launch, "function");
});

test("positiveNumber keeps positives and falls back otherwise", () => {
  assert.equal(positiveNumber(3, 9), 3);
  assert.equal(positiveNumber(0, 9), 9);
  assert.equal(positiveNumber(-1, 9), 9);
  assert.equal(positiveNumber("3", 9), 9);
});

test("shouldRenderHtml defaults off", () => {
  assert.equal(shouldRenderHtml({ env: {} }), false);
  assert.equal(shouldRenderHtml({ env: null }), false);
  assert.equal(shouldRenderHtml(), false);
  assert.equal(
    shouldRenderHtml({ enabled: false, env: { JOSHTERNET_RENDER_HTML: "1" } }),
    false,
  );
  assert.equal(shouldRenderHtml({ enabled: true }), true);
  assert.equal(
    shouldRenderHtml({ env: { JOSHTERNET_RENDER_HTML: "true" } }),
    true,
  );
  assert.equal(
    shouldRenderHtml({ env: { JOSHTERNET_RENDER_HTML: "yes" } }),
    true,
  );
  assert.equal(
    shouldRenderHtml({ env: { JOSHTERNET_RENDER_HTML: "0" } }),
    false,
  );
});

test("isRenderableHttpUrl accepts http(s) only", () => {
  assert.equal(isRenderableHttpUrl("https://a.example/"), true);
  assert.equal(isRenderableHttpUrl("http://a.example/"), true);
  assert.equal(isRenderableHttpUrl("ftp://a.example/"), false);
  assert.equal(isRenderableHttpUrl("not-a-url"), false);
  assert.equal(isRenderableHttpUrl(""), false);
  assert.equal(isRenderableHttpUrl(null), false);
});

test("renderHtmlForExtraction returns null when disabled", async () => {
  const html = await renderHtmlForExtraction("https://a.example/", {
    enabled: false,
  });
  assert.equal(html, null);
});

test("renderHtmlForExtraction returns null for unsafe urls even when enabled", async () => {
  const html = await renderHtmlForExtraction("javascript:alert(1)", {
    enabled: true,
  });
  assert.equal(html, null);
});

test("renderHtmlForExtraction uses injected browser factory", async () => {
  let routed = 0;
  const html = await renderHtmlForExtraction("https://a.example/art/", {
    enabled: true,
    timeoutMs: 100,
    maxSubresources: 2,
    browserFactory: async () => ({
      async newPage() {
        return {
          async route(_pattern, handler) {
            await handler({
              abort: async () => {
                routed += 1;
              },
              continue: async () => {
                routed += 1;
              },
            });
            await handler({
              abort: async () => {
                routed += 1;
              },
              continue: async () => {
                routed += 1;
              },
            });
            await handler({
              abort: async () => {
                routed += 1;
              },
              continue: async () => {
                routed += 1;
              },
            });
          },
          async goto() {
            return null;
          },
          async content() {
            return "<html><body>rendered</body></html>";
          },
          async close() {},
        };
      },
      async close() {},
    }),
  });

  assert.equal(html, "<html><body>rendered</body></html>");
  assert.ok(routed >= 2);
  assert.ok(RENDER_TIMEOUT_MS > 0);
  assert.ok(RENDER_MAX_SUBRESOURCES > 0);
});

test("renderHtmlForExtraction returns null when factory throws", async () => {
  const html = await renderHtmlForExtraction("https://a.example/", {
    enabled: true,
    browserFactory: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(html, null);
});

test("renderHtmlForExtraction tolerates missing browser.close", async () => {
  const html = await renderHtmlForExtraction("https://a.example/", {
    enabled: true,
    timeoutMs: "nope",
    maxSubresources: "nope",
    browserFactory: async () => ({
      async newPage() {
        return {
          async goto() {},
          async content() {
            return "<html>ok</html>";
          },
          async close() {},
        };
      },
    }),
  });
  assert.equal(html, "<html>ok</html>");
});

test("renderHtmlForExtraction closes browser that throws on close", async () => {
  const html = await renderHtmlForExtraction("https://a.example/", {
    enabled: true,
    browserFactory: async () => ({
      async newPage() {
        return {
          async goto() {},
          async content() {
            return "<html>close-throw</html>";
          },
          async close() {},
        };
      },
      async close() {
        throw new Error("close failed");
      },
    }),
  });
  assert.equal(html, "<html>close-throw</html>");
});

test("renderHtmlForExtraction returns null for empty content", async () => {
  const html = await renderHtmlForExtraction("https://a.example/", {
    enabled: true,
    browserFactory: async () => ({
      async newPage() {
        return {
          async goto() {},
          async content() {
            return "";
          },
          async close() {},
        };
      },
      async close() {
        throw new Error("close failed");
      },
    }),
  });
  assert.equal(html, null);
});

test("renderHtmlForExtraction works when page has no route hook", async () => {
  const html = await renderHtmlForExtraction("https://a.example/", {
    enabled: true,
    browserFactory: async () => ({
      async newPage() {
        return {
          async goto() {},
          async content() {
            return "<html>no-route</html>";
          },
          async close() {},
        };
      },
      async close() {},
    }),
  });
  assert.equal(html, "<html>no-route</html>");
});

test("renderHtmlForExtraction returns null when content() is non-string", async () => {
  const html = await renderHtmlForExtraction("https://a.example/", {
    enabled: true,
    browserFactory: async () => ({
      async newPage() {
        return {
          async goto() {},
          async content() {
            return null;
          },
          async close() {},
        };
      },
      async close() {},
    }),
  });
  assert.equal(html, null);
});

test("renderHtmlForExtraction uses importPlaywright when no browserFactory", async () => {
  const html = await renderHtmlForExtraction("https://a.example/art/", {
    enabled: true,
    timeoutMs: 0,
    maxSubresources: 0,
    importPlaywright: async () => ({
      chromium: {
        async launch() {
          return {
            async newPage() {
              return {
                async goto() {},
                async content() {
                  return "<html>via import</html>";
                },
                async close() {},
              };
            },
            async close() {},
          };
        },
      },
    }),
  });
  assert.equal(html, "<html>via import</html>");
});
