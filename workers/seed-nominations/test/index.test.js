import test from "node:test";
import assert from "node:assert/strict";

import worker from "../src/index.js";

const NOMINATION_URL =
  "https://joshternet-seed-nominations.test/v1/seed-nominations";

const ALLOWED_ORIGIN = "https://joshternet.org";

function makeLimiter(results = [true]) {
  const calls = [];
  let index = 0;

  return {
    calls,

    async limit({ key }) {
      calls.push(key);

      const result =
        results[Math.min(index, results.length - 1)];

      index += 1;

      return {
        success: result,
      };
    },
  };
}

function makeDb() {
  const rows = new Map();

  const stats = {
    runCalls: 0,
    firstCalls: 0,
  };

  let nextId = 1;

  return {
    rows,
    stats,

    prepare(sql) {
      if (sql.includes("INSERT OR IGNORE INTO seed_nominations")) {
        return {
          bind(origin) {
            return {
              async run() {
                stats.runCalls += 1;

                if (rows.has(origin)) {
                  return {
                    meta: {
                      changes: 0,
                    },
                  };
                }

                const nomination = {
                  id: nextId,
                  origin,
                  status: "pending",
                  submitted_at: "2026-09-16T00:00:00.000Z",
                };

                nextId += 1;
                rows.set(origin, nomination);

                return {
                  meta: {
                    changes: 1,
                  },
                };
              },
            };
          },
        };
      }

      if (
        sql.includes(
          "SELECT id, origin, status, submitted_at",
        )
      ) {
        return {
          bind(origin) {
            return {
              async first() {
                stats.firstCalls += 1;
                return rows.get(origin) ?? null;
              },
            };
          },
        };
      }

      throw new Error(`Unexpected SQL in test DB: ${sql}`);
    },
  };
}

function makeEnv({
  submissionsEnabled = true,
  routeResults = [true],
  originResults = [true],
  secret = "test-secret",
} = {}) {
  const db = makeDb();
  const routeLimiter = makeLimiter(routeResults);
  const originLimiter = makeLimiter(originResults);

  const env = {
    DB: db,
    NOMINATION_ROUTE_RATE_LIMITER: routeLimiter,
    NOMINATION_ORIGIN_RATE_LIMITER: originLimiter,
    ALLOWED_ORIGIN,
    SUBMISSIONS_ENABLED: submissionsEnabled ? "true" : "false",
    TURNSTILE_SECRET_KEY: secret,
    TURNSTILE_EXPECTED_HOSTNAME: "joshternet.org",
    TURNSTILE_EXPECTED_ACTION: "seed-nomination",
  };

  return {
    env,
    db,
    routeLimiter,
    originLimiter,
  };
}

function nominationRequest({
  origin = ALLOWED_ORIGIN,
  url = "https://example.com",
  ownerAttestation = true,
  token = "turnstile-token",
} = {}) {
  return new Request(NOMINATION_URL, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      owner_attestation: ownerAttestation,
      turnstile_token: token,
    }),
  });
}

async function bodyJson(response) {
  return JSON.parse(await response.text());
}

async function withTurnstile(result, callback) {
  const previousFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      init,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  try {
    const value = await callback();

    return {
      value,
      calls,
    };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test("disabled mode rejects nominations before other work", async () => {
  const {
    env,
    db,
    routeLimiter,
    originLimiter,
  } = makeEnv({
    submissionsEnabled: false,
  });

  const response = await worker.fetch(
    nominationRequest(),
    env,
  );

  assert.equal(response.status, 503);

  assert.deepEqual(await bodyJson(response), {
    error: "submissions_disabled",
    message: "Seed nominations are not being accepted yet.",
  });

  assert.equal(db.stats.runCalls, 0);
  assert.equal(db.stats.firstCalls, 0);
  assert.deepEqual(routeLimiter.calls, []);
  assert.deepEqual(originLimiter.calls, []);
});

test("allowed-origin preflight returns Joshternet CORS headers", async () => {
  const { env } = makeEnv();

  const response = await worker.fetch(
    new Request(NOMINATION_URL, {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    }),
    env,
  );

  assert.equal(response.status, 204);

  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    ALLOWED_ORIGIN,
  );

  assert.equal(
    response.headers.get("Access-Control-Allow-Methods"),
    "POST, OPTIONS",
  );
});

test("foreign origins are rejected before nomination processing", async () => {
  const {
    env,
    db,
    routeLimiter,
    originLimiter,
  } = makeEnv();

  const response = await worker.fetch(
    nominationRequest({
      origin: "https://example.net",
    }),
    env,
  );

  assert.equal(response.status, 403);

  assert.deepEqual(await bodyJson(response), {
    error: "origin_not_allowed",
  });

  assert.equal(db.stats.runCalls, 0);
  assert.deepEqual(routeLimiter.calls, []);
  assert.deepEqual(originLimiter.calls, []);
});

test("owner attestation is required before rate limiting or D1", async () => {
  const {
    env,
    db,
    routeLimiter,
    originLimiter,
  } = makeEnv();

  const response = await worker.fetch(
    nominationRequest({
      ownerAttestation: false,
    }),
    env,
  );

  assert.equal(response.status, 400);

  const body = await bodyJson(response);

  assert.equal(body.error, "owner_attestation_required");
  assert.equal(db.stats.runCalls, 0);
  assert.deepEqual(routeLimiter.calls, []);
  assert.deepEqual(originLimiter.calls, []);
});

test("invalid private-style hostnames are rejected before D1", async () => {
  const {
    env,
    db,
    routeLimiter,
    originLimiter,
  } = makeEnv();

  const response = await worker.fetch(
    nominationRequest({
      url: "http://printer.lan/setup",
    }),
    env,
  );

  assert.equal(response.status, 400);

  const body = await bodyJson(response);

  assert.equal(body.error, "non_public_host");
  assert.equal(db.stats.runCalls, 0);
  assert.deepEqual(routeLimiter.calls, []);
  assert.deepEqual(originLimiter.calls, []);
});

test("route rate limit returns 429 before Turnstile or D1", async () => {
  const {
    env,
    db,
    routeLimiter,
    originLimiter,
  } = makeEnv({
    routeResults: [false],
  });

  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("Turnstile should not be called");
  };

  try {
    const response = await worker.fetch(
      nominationRequest(),
      env,
    );

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");

    const body = await bodyJson(response);

    assert.equal(body.error, "rate_limited");

    assert.deepEqual(
      routeLimiter.calls,
      ["seed-nominations"],
    );

    assert.deepEqual(originLimiter.calls, []);
    assert.equal(db.stats.runCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("normalized-origin rate limit returns 429 before Turnstile or D1", async () => {
  const {
    env,
    db,
    routeLimiter,
    originLimiter,
  } = makeEnv({
    originResults: [false],
  });

  const previousFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("Turnstile should not be called");
  };

  try {
    const response = await worker.fetch(
      nominationRequest({
        url: "https://Example.COM/some/path?hello=Josh#there",
      }),
      env,
    );

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");

    const body = await bodyJson(response);

    assert.equal(body.error, "origin_rate_limited");

    assert.deepEqual(
      routeLimiter.calls,
      ["seed-nominations"],
    );

    assert.deepEqual(
      originLimiter.calls,
      ["https://example.com"],
    );

    assert.equal(db.stats.runCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("failed Turnstile verification never writes to D1", async () => {
  const {
    env,
    db,
  } = makeEnv();

  const { value: response, calls } = await withTurnstile(
    {
      success: false,
      "error-codes": ["invalid-input-response"],
    },
    () =>
      worker.fetch(
        nominationRequest(),
        env,
      ),
  );

  assert.equal(response.status, 400);

  const body = await bodyJson(response);

  assert.equal(body.error, "turnstile_failed");
  assert.equal(calls.length, 1);
  assert.equal(db.stats.runCalls, 0);
  assert.equal(db.stats.firstCalls, 0);
});

test("Turnstile action mismatch never writes to D1", async () => {
  const {
    env,
    db,
  } = makeEnv();

  const { value: response } = await withTurnstile(
    {
      success: true,
      hostname: "joshternet.org",
      action: "something-else",
    },
    () =>
      worker.fetch(
        nominationRequest(),
        env,
      ),
  );

  assert.equal(response.status, 400);

  const body = await bodyJson(response);

  assert.equal(body.error, "turnstile_failed");
  assert.equal(db.stats.runCalls, 0);
});

test("valid nomination normalizes the URL and inserts one pending origin", async () => {
  const {
    env,
    db,
    routeLimiter,
    originLimiter,
  } = makeEnv();

  const { value: response, calls } = await withTurnstile(
    {
      success: true,
      hostname: "joshternet.org",
      action: "seed-nomination",
    },
    () =>
      worker.fetch(
        nominationRequest({
          url: "https://Example.COM/some/page?hello=Josh#there",
        }),
        env,
      ),
  );

  assert.equal(response.status, 202);

  const body = await bodyJson(response);

  assert.equal(body.status, "accepted");
  assert.equal(
    body.nomination.origin,
    "https://example.com",
  );
  assert.equal(body.nomination.status, "pending");

  assert.deepEqual(
    routeLimiter.calls,
    ["seed-nominations"],
  );

  assert.deepEqual(
    originLimiter.calls,
    ["https://example.com"],
  );

  assert.equal(calls.length, 1);
  assert.equal(db.stats.runCalls, 1);
  assert.equal(db.rows.size, 1);
  assert.ok(db.rows.has("https://example.com"));
});

test("duplicate nomination returns already_nominated without creating another row", async () => {
  const {
    env,
    db,
  } = makeEnv();

  const turnstileResult = {
    success: true,
    hostname: "joshternet.org",
    action: "seed-nomination",
  };

  const { value: responses } = await withTurnstile(
    turnstileResult,
    async () => {
      const first = await worker.fetch(
        nominationRequest({
          url: "https://example.com/first",
        }),
        env,
      );

      const second = await worker.fetch(
        nominationRequest({
          url: "https://EXAMPLE.com/second?different=yes",
        }),
        env,
      );

      return {
        first,
        second,
      };
    },
  );

  assert.equal(responses.first.status, 202);
  assert.equal(responses.second.status, 200);

  const secondBody = await bodyJson(responses.second);

  assert.equal(secondBody.status, "already_nominated");
  assert.equal(
    secondBody.nomination.origin,
    "https://example.com",
  );

  assert.equal(db.rows.size, 1);
  assert.equal(db.stats.runCalls, 2);
});

test("successful Turnstile verification sends the configured secret and token", async () => {
  const {
    env,
  } = makeEnv({
    secret: "configured-secret",
  });

  const request = nominationRequest({
    token: "submitted-token",
  });

  const { value: response, calls } = await withTurnstile(
    {
      success: true,
      hostname: "joshternet.org",
      action: "seed-nomination",
    },
    () =>
      worker.fetch(
        request,
        env,
      ),
  );

  assert.equal(response.status, 202);
  assert.equal(calls.length, 1);

  const payload = JSON.parse(calls[0].init.body);

  assert.equal(payload.secret, "configured-secret");
  assert.equal(payload.response, "submitted-token");
});
