/**
 * Goal: Robots failures stay distinct from a missing file, and retries have
 * one owner.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  classifyTransportError,
  decideRobotsOutcome,
  httpStatusFromError,
  parseRetryAfter,
  retryDecision,
} from "../../scripts/nlp/fetch-outcome.mjs";
import {
  openFetchCache,
  writeFetchCacheEntry,
} from "../../scripts/nlp/fetch-cache.mjs";
import { fetchPublicText } from "../../scripts/nlp/lib.mjs";
import { fetchMemberText, sleepMs } from "../../scripts/nlp/request-policy.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

const cached = {
  body: "User-agent: *\nDisallow: /secret/\n",
  bodyComplete: true,
};

test("robots outcomes stay distinct", () => {
  assert.equal(decideRobotsOutcome({ status: 404 }).decision, "absent");
  assert.equal(decideRobotsOutcome({ status: 410 }).reason, "robots-absent");
  assert.equal(decideRobotsOutcome({ status: 401 }).reason, "robots-forbidden");
  assert.equal(decideRobotsOutcome({ status: 403 }).decision, "defer");
  assert.equal(
    decideRobotsOutcome({ status: 429 }).reason,
    "robots-rate-limited",
  );
  assert.equal(
    decideRobotsOutcome({
      status: 200,
      body: "User-agent: *\nAllow: /\n",
      bodyComplete: true,
    }).decision,
    "apply",
  );
  assert.equal(
    decideRobotsOutcome({ status: 200, body: 1, bodyComplete: false }).reason,
    "robots-unusable",
  );
  assert.equal(
    decideRobotsOutcome({
      status: 200,
      bodyComplete: false,
      cached,
    }).reason,
    "robots-cached",
  );
  assert.equal(
    decideRobotsOutcome({
      status: 503,
      errorKind: "http",
      cached,
    }).reason,
    "robots-cached",
  );
  assert.equal(
    decideRobotsOutcome({
      status: null,
      errorKind: "timeout",
      cached: { body: "User-agent: *\nAllow: /\n", bodyComplete: false },
    }).reason,
    "robots-unavailable",
  );
  assert.equal(
    decideRobotsOutcome({ status: null, errorKind: "dns" }).decision,
    "defer",
  );
  assert.equal(
    decideRobotsOutcome({
      status: 500,
      errorKind: "none",
      cached,
    }).reason,
    "robots-cached",
  );
  assert.equal(
    decideRobotsOutcome({
      status: 500,
      cached: { body: 1, bodyComplete: true },
    }).decision,
    "defer",
  );
  assert.equal(decideRobotsOutcome({}).decision, "defer");
  assert.equal(
    decideRobotsOutcome({ status: 301, errorKind: "none", cached }).decision,
    "defer",
  );
});

test("Retry-After accepts seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter(null, 0), null);
  assert.equal(parseRetryAfter("  ", 0), null);
  assert.equal(parseRetryAfter("5", 1_000), 6_000);
  assert.equal(
    parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT", 0),
    Date.parse("Wed, 21 Oct 2015 07:28:00 GMT"),
  );
  assert.equal(parseRetryAfter("not-a-date", 0), null);
});

test("retry decisions do not multiply and do not outsleep the budget", () => {
  assert.equal(
    retryDecision({
      status: 404,
      attempt: 1,
      maxAttempts: 2,
      nowMs: 0,
    }).reason,
    "not-transient",
  );
  assert.equal(
    retryDecision({
      status: 429,
      attempt: 2,
      maxAttempts: 2,
      nowMs: 0,
    }).reason,
    "retry-exhausted",
  );
  assert.equal(
    retryDecision({
      status: 503,
      attempt: 1,
      maxAttempts: 2,
      retryAtMs: 10_000,
      nowMs: 0,
      budgetEndsMs: 1_000,
    }).reason,
    "delay-exceeds-budget",
  );
  const again = retryDecision({
    errorKind: "timeout",
    attempt: 1,
    maxAttempts: 2,
    nowMs: 50,
  });
  assert.equal(again.retry, true);
  assert.equal(again.retryAtMs, null);
  assert.equal(
    retryDecision({
      errorKind: "dns",
      attempt: 1,
      maxAttempts: 2,
      retryAtMs: 80,
      nowMs: 50,
      budgetEndsMs: 100,
    }).retry,
    true,
  );
});

test("transport errors keep a class and a status", () => {
  assert.equal(
    classifyTransportError(new Error("The operation was aborted")),
    "timeout",
  );
  assert.equal(
    classifyTransportError(new Error("getaddrinfo ENOTFOUND")),
    "dns",
  );
  assert.equal(
    classifyTransportError(new Error("certificate verify failed")),
    "tls",
  );
  assert.equal(classifyTransportError(new Error("HTTP 503 for x")), "http");
  assert.equal(classifyTransportError(new Error("socket hang up")), "network");
  assert.equal(classifyTransportError("dns lookup failed"), "dns");
  assert.equal(classifyTransportError(null), "network");
  assert.equal(httpStatusFromError(new Error("HTTP 429 for x")), 429);
  assert.equal(httpStatusFromError("nope"), null);
  assert.equal(httpStatusFromError(undefined), null);
});

test("fetchPublicText reports truncation and can capture HTTP errors", async () => {
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => Buffer.from("abcdef"),
    });
    const truncated = await fetchPublicText("https://a.example/cap", {
      cache,
      maxBytes: 3,
    });
    assert.equal(truncated.body_complete, false);
    assert.equal(truncated.body, "abc");

    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "2" }),
      arrayBuffer: async () => Buffer.from(""),
    });
    const limited = await fetchPublicText("https://a.example/slow", {
      cache,
      captureHttpErrors: true,
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.retry_after, "2");

    await assert.rejects(
      () =>
        fetchPublicText("https://a.example/late", {
          cache,
          deadlineAt: Date.now() - 1,
        }),
      /deadline exceeded/,
    );
  } finally {
    restore();
  }
});

test("a 304 without a complete cache entry is fetched again", async () => {
  const previous = process.env.NETWORK_REFRESH_ALL;
  delete process.env.NETWORK_REFRESH_ALL;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-304-partial-"));
  const httpCache = await openFetchCache(root);
  const cache = dnsCache(["partial.example"]);
  install();
  try {
    await writeFetchCacheEntry(httpCache, {
      url: "https://partial.example/page",
      body: "old",
      contentType: "text/plain",
      etag: '"old"',
    });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(null, { status: 304 });
      }
      return new Response("fresh", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    };
    const result = await fetchPublicText("https://partial.example/page", {
      cache,
      httpCache,
    });
    assert.equal(result.body, "fresh");
    assert.equal(result.body_complete, true);
    assert.equal(calls, 2);
  } finally {
    restore();
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("fetchMemberText retries a timeout once and defers a long Retry-After", async () => {
  const cache = dnsCache(["a.example"]);
  install();
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("The operation was aborted");
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: async () => Buffer.from("ok"),
      };
    };
    const recovered = await fetchMemberText("https://a.example/page", {
      cache,
      sleep: async () => {},
      now: () => 1_000,
    });
    assert.equal(recovered.body, "ok");
    assert.equal(calls, 2);

    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      headers: new Headers({
        "retry-after": "Wed, 21 Oct 2099 07:28:00 GMT",
      }),
      arrayBuffer: async () => Buffer.from(""),
    });
    const deferred = await fetchMemberText("https://a.example/later", {
      cache,
      sleep: async () => {},
      now: () => Date.parse("2026-01-01T00:00:00.000Z"),
      budgetEndsMs: Date.parse("2026-01-01T00:01:00.000Z"),
    });
    assert.equal(deferred.deferred, true);
    assert.equal(deferred.status, 429);

    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      headers: new Headers(),
      arrayBuffer: async () => Buffer.from(""),
    });
    const quiet = await fetchMemberText("https://a.example/quiet", {
      cache,
      maxAttempts: 1,
      sleep: async () => {},
      now: () => 10,
    });
    assert.equal(quiet.retry_at, "");

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => Buffer.from("hello"),
    });
    await assert.rejects(
      () =>
        fetchMemberText("https://a.example/partial", {
          cache,
          maxBytes: 1,
          sleep: async () => {},
        }),
      /incomplete body/,
    );

    let waited = 0;
    let recoveries = 0;
    globalThis.fetch = async () => {
      recoveries += 1;
      if (recoveries === 1) {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ "retry-after": "1" }),
          arrayBuffer: async () => Buffer.from(""),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: async () => Buffer.from("back"),
      };
    };
    const slept = await fetchMemberText("https://a.example/back", {
      cache,
      sleep: async (ms) => {
        waited = ms;
      },
      now: () => 1_000,
      budgetEndsMs: 10_000,
    });
    assert.equal(slept.body, "back");
    assert.equal(waited, 1000);
  } finally {
    restore();
  }
});

test("sleepMs resolves", async () => {
  await sleepMs(0);
});

test("fetchMemberText does not retry a permanent miss", async () => {
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: new Headers(),
      arrayBuffer: async () => Buffer.from(""),
    });
    await assert.rejects(
      () => fetchMemberText("https://a.example/missing", { cache }),
      /HTTP 404/,
    );
    globalThis.fetch = async () => {
      throw new Error("certificate verify failed");
    };
    await assert.rejects(
      () =>
        fetchMemberText("https://a.example/tls", {
          cache,
          sleep: async () => {},
        }),
      /certificate/,
    );
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      if (attempts === 1) {
        return {
          ok: false,
          status: 503,
          headers: new Headers(),
          arrayBuffer: async () => Buffer.from(""),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: async () => Buffer.from("default-sleep"),
      };
    };
    const defaults = await fetchMemberText("https://a.example/default-sleep", {
      cache,
      budgetMs: 5_000,
    });
    assert.equal(defaults.body, "default-sleep");
  } finally {
    restore();
  }
});
