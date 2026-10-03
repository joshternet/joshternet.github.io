import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";

const API = "https://joshternet-declaration-check.test/v1/declaration-check";
const ALLOWED = "https://joshternet.org";

function makeLimiter(results = [true]) {
  const calls = [];
  let index = 0;

  return {
    calls,
    async limit({ key }) {
      calls.push(key);
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      return { success: result };
    },
  };
}

function env({
  ipResults = [true],
  originResults = [true],
  allowed = `${ALLOWED},http://127.0.0.1:4000`,
} = {}) {
  return {
    ALLOWED_ORIGINS: allowed,
    DECLARATION_CHECK_IP_RATE_LIMITER: makeLimiter(ipResults),
    DECLARATION_CHECK_ORIGIN_RATE_LIMITER: makeLimiter(originResults),
  };
}

/**
 * @param {string | null} origin
 * @param {RequestInit} [init]
 */
function request(origin, init = {}) {
  const url = new URL(API);

  if (origin) {
    url.searchParams.set("origin", origin);
  }

  return new Request(url, {
    method: "GET",
    headers: {
      Origin: ALLOWED,
      "CF-Connecting-IP": "203.0.113.10",
      ...(init.headers || {}),
    },
    ...init,
  });
}

test("preflight returns CORS for an allowed browser origin", async () => {
  const response = await worker.fetch(
    new Request(API, {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED,
        "Access-Control-Request-Method": "GET",
      },
    }),
    env(),
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ALLOWED);
  assert.match(
    response.headers.get("Access-Control-Allow-Methods") || "",
    /GET/,
  );
});

test("rejects missing or disallowed browser Origin", async () => {
  const missing = await worker.fetch(
    new Request(`${API}?origin=https://joshuamorris.info`, {
      method: "GET",
      headers: {
        "CF-Connecting-IP": "203.0.113.10",
      },
    }),
    env(),
  );

  assert.equal(missing.status, 403);

  const evil = await worker.fetch(
    request("https://joshuamorris.info", {
      headers: {
        Origin: "https://evil.example",
      },
    }),
    env(),
  );

  assert.equal(evil.status, 403);
  assert.equal((await evil.json()).error, "origin_not_allowed");
});

test("rejects private hosts and IP literals", async () => {
  for (const origin of [
    "http://localhost",
    "http://127.0.0.1",
    "https://192.168.1.1",
    "http://metadata.google.internal",
  ]) {
    const response = await worker.fetch(request(origin), env());

    assert.equal(response.status, 400, origin);
  }
});

test("rate limits clients and target origins", async () => {
  const ipLimited = await worker.fetch(
    request("https://joshuamorris.info"),
    env({ ipResults: [false] }),
  );

  assert.equal(ipLimited.status, 429);
  assert.equal((await ipLimited.json()).error, "rate_limited");

  const originLimited = await worker.fetch(
    request("https://joshuamorris.info"),
    env({ originResults: [false] }),
  );

  assert.equal(originLimited.status, 429);
  assert.equal((await originLimited.json()).error, "origin_rate_limited");
});

test("reads a live declaration body for classification", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response('{\n  "version": 1,\n  "josh": true\n}\n', {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

  try {
    const response = await worker.fetch(
      request("https://joshuamorris.info"),
      env(),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.status, 200);
    assert.equal(body.requestedOrigin, "https://joshuamorris.info");
    assert.equal(
      body.declarationURL,
      "https://joshuamorris.info/.well-known/josh",
    );
    assert.match(body.body, /"josh": true/);
    assert.equal(body.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("refuses cross-origin redirects", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;

    return new Response(null, {
      status: 302,
      headers: {
        Location: "http://169.254.169.254/latest/meta-data",
      },
    });
  };

  try {
    const response = await worker.fetch(
      request("https://joshuamorris.info"),
      env(),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, false);
    assert.equal(body.error, "redirect");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("allows one same-origin redirect to the declaration path only", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    urls.push({ url, redirect: init.redirect });

    if (init.redirect === "manual") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "https://joshuamorris.info/.well-known/josh",
        },
      });
    }

    return new Response('{"version":1,"josh":true}', {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  try {
    const response = await worker.fetch(
      request("https://joshuamorris.info"),
      env(),
    );
    const body = await response.json();

    assert.equal(body.ok, true);
    assert.equal(body.status, 200);
    assert.equal(urls[0].redirect, "manual");
    assert.equal(urls[1].redirect, "error");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("network failures are not treated as invalid declarations", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  try {
    const response = await worker.fetch(
      request("https://joshuamorris.info"),
      env(),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, false);
    assert.equal(body.status, null);
    assert.equal(body.body, null);
    assert.equal(body.error, "network");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
