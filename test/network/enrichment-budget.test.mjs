/**
 * Goal: Enrichment budget aborts identity probes without a closed-browser cascade.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  enrichmentAbortGraceMS,
  enrichmentBudgetExhausted,
  isEnrichmentAbortError,
  runWithEnrichmentBudget,
  visitIdentityPages,
} from "../../scripts/network/enrichment-budget.mjs";

test("isEnrichmentAbortError: object without name or message fields (L18-19 false branches)", () => {
  // Plain object has no "name" or "message" own/inherited properties → both ternary false paths.
  assert.equal(isEnrichmentAbortError({}), false);
  // Object with name but no message (only name branch hits false)
  assert.equal(isEnrichmentAbortError({ name: "SomeError" }), false);
});

test("visitIdentityPages: non-Error throw is wrapped into Error (L102 false branch)", async () => {
  // Throwing a string (not instanceof Error) → catch wraps it in new Error(String(value)).
  const logged = [];

  const result = await visitIdentityPages(
    ["https://a.example/1/"],
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "string-error"; // non-Error thrown value
    },
    {
      onVisitError(href, err) {
        logged.push(`${href}:${err.message}`);
      },
    },
  );

  assert.equal(result.stoppedEarly, false);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /string-error/);
});

test("isEnrichmentAbortError recognizes abort and closed-browser messages", () => {
  assert.equal(
    isEnrichmentAbortError(new DOMException("Aborted", "AbortError")),
    true,
  );
  assert.equal(
    isEnrichmentAbortError(
      new Error("page.goto: Target page, context or browser has been closed"),
    ),
    true,
  );
  assert.equal(isEnrichmentAbortError(new Error("HTTP 404")), false);
  assert.equal(isEnrichmentAbortError(null), false);
});

test("enrichmentBudgetExhausted follows AbortSignal", () => {
  const controller = new AbortController();
  assert.equal(enrichmentBudgetExhausted(undefined), false);
  assert.equal(enrichmentBudgetExhausted(controller.signal), false);
  controller.abort();
  assert.equal(enrichmentBudgetExhausted(controller.signal), true);
});

test("runWithEnrichmentBudget returns work result under budget", async () => {
  const result = await runWithEnrichmentBudget(
    async (signal) => {
      assert.equal(signal.aborted, false);
      return "ok";
    },
    1_000,
    "fast",
  );
  assert.equal(result, "ok");
});

test("enrichmentAbortGraceMS stays within 1s–10s bounds", () => {
  assert.equal(enrichmentAbortGraceMS(30), 1_000);
  assert.equal(enrichmentAbortGraceMS(5_000), 5_000);
  assert.equal(enrichmentAbortGraceMS(60_000), 10_000);
  assert.equal(enrichmentAbortGraceMS(Number.NaN), 1_000);
});

test("runWithEnrichmentBudget aborts signal then returns partial work result", async () => {
  /** @type {AbortSignal | undefined} */
  let seenSignal;

  const result = await runWithEnrichmentBudget(
    async (signal) => {
      seenSignal = signal;
      await new Promise((resolve) => {
        signal.addEventListener("abort", () => resolve(undefined), {
          once: true,
        });
      });
      return "partial";
    },
    30,
    "https://www.joshuabaker.com enrichment",
  );

  assert.equal(result, "partial");
  assert.ok(seenSignal);
  assert.equal(seenSignal.aborted, true);
});

test("runWithEnrichmentBudget hard-fails only when work ignores abort", async () => {
  await assert.rejects(
    () =>
      runWithEnrichmentBudget(
        async () =>
          new Promise(() => {
            /* never settles, even after abort */
          }),
        20,
        "https://hung.example enrichment",
      ),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /^https:\/\/hung\.example enrichment exceeded 20ms$/,
      );
      return true;
    },
  );
});

test("runWithEnrichmentBudget coerces empty/negative budgets and swallows late rejects", async () => {
  assert.equal(
    await runWithEnrichmentBudget(async () => "zero", 0, "zero-budget"),
    "zero",
  );
  assert.equal(
    await runWithEnrichmentBudget(
      async () => "neg",
      /** @type {any} */ (-5),
      "neg-budget",
    ),
    "neg",
  );
  assert.equal(
    await runWithEnrichmentBudget(
      async () => "nullish",
      /** @type {any} */ (null),
      "null-budget",
    ),
    "nullish",
  );

  await assert.rejects(
    () =>
      runWithEnrichmentBudget(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 1_100));
          throw new Error("late-reject");
        },
        20,
        "https://late.example enrichment",
      ),
    /https:\/\/late\.example enrichment exceeded 20ms/,
  );
  // Soft+grace ≈ 1020ms; late throw at 1100ms must hit the swallowed catch.
  await new Promise((resolve) => setTimeout(resolve, 200));
});

test("visitIdentityPages stops on abort without closed-browser cascade logs", async () => {
  const controller = new AbortController();
  const hrefs = Array.from({ length: 40 }, (_, index) => {
    return `https://www.joshuabaker.com/path-${index}/`;
  });
  /** @type {string[]} */
  const visited = [];
  /** @type {string[]} */
  const logged = [];

  const visitPromise = visitIdentityPages(
    hrefs,
    async (href, signal) => {
      visited.push(href);
      if (visited.length === 2) {
        controller.abort();
      }

      if (signal?.aborted) {
        throw new Error(
          "page.goto: Target page, context or browser has been closed",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1));
    },
    {
      signal: controller.signal,
      onVisitError(href, error) {
        logged.push(`${href}:${error.message}`);
      },
    },
  );

  const result = await visitPromise;
  assert.equal(result.stoppedEarly, true);
  assert.ok(visited.length < hrefs.length);
  assert.equal(logged.length, 0);
});

test("visitIdentityPages reports non-abort visit errors once per failure", async () => {
  /** @type {string[]} */
  const logged = [];

  const result = await visitIdentityPages(
    ["https://a.example/about/", "https://a.example/now/"],
    async (href) => {
      if (href.includes("/now/")) {
        throw new Error("HTTP 500");
      }
    },
    {
      onVisitError(href, error) {
        logged.push(`${href}:${error.message}`);
      },
    },
  );

  assert.equal(result.stoppedEarly, false);
  assert.equal(result.visited, 1);
  assert.deepEqual(logged, ["https://a.example/now/:HTTP 500"]);
});

test("visitIdentityPages: pre-check catches already-aborted signal before first visit (L87-90)", async () => {
  // Signal is aborted BEFORE the loop starts → pre-check at L87 fires immediately → stoppedEarly=true.
  const controller = new AbortController();
  controller.abort();
  let visitCount = 0;

  const result = await visitIdentityPages(
    ["https://a.example/1/", "https://a.example/2/"],
    async () => {
      visitCount += 1;
    },
    { signal: controller.signal },
  );

  assert.equal(result.stoppedEarly, true);
  assert.equal(
    visitCount,
    0,
    "visit must not be called when signal is pre-aborted",
  );
});

test("visitIdentityPages: post-visit budget check fires when abort happens inside visit (L95-98)", async () => {
  // visit completes WITHOUT throwing, but aborts the signal during execution.
  // The post-visit check at L95 fires → stoppedEarly = true, visited stays 0.
  const controller = new AbortController();
  let visitCount = 0;

  const result = await visitIdentityPages(
    ["https://a.example/1/", "https://a.example/2/", "https://a.example/3/"],
    async () => {
      visitCount += 1;

      if (visitCount === 1) {
        // Abort during the first visit, but do NOT throw (visit "succeeds")
        controller.abort();
      }
    },
    { signal: controller.signal },
  );

  assert.equal(result.stoppedEarly, true);
  // First visit completed (no throw) but budget exhausted after → visited = 0 due to break before increment
  assert.equal(result.visited, 0);
});

test("short budget plus many identity URLs returns partial and no cascade", async () => {
  /** @type {string[]} */
  const logged = [];
  const hrefs = Array.from({ length: 25 }, (_, index) => {
    return `https://example.com/id-${index}/`;
  });

  const result = await runWithEnrichmentBudget(
    async (signal) => {
      await visitIdentityPages(
        hrefs,
        async (_href, visitSignal) => {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 50);
            visitSignal?.addEventListener(
              "abort",
              () => {
                clearTimeout(timer);
                reject(
                  new Error(
                    "page.goto: Target page, context or browser has been closed",
                  ),
                );
              },
              { once: true },
            );
          });
        },
        {
          signal,
          onVisitError(href, error) {
            logged.push(`${href}:${error.message}`);
          },
        },
      );
      return "done";
    },
    40,
    "https://example.com enrichment",
  );

  assert.equal(result, "done");
  assert.equal(logged.length, 0);
});
