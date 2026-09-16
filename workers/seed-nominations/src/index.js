const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const MAX_REQUEST_BYTES = 4096;
const MAX_URL_LENGTH = 2048;
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.ALLOWED_ORIGIN;

  if (!origin || origin !== allowedOrigin) {
    return {
      Vary: "Origin",
    };
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function originIsAllowed(request, env) {
  return request.headers.get("Origin") === env.ALLOWED_ORIGIN;
}

function validationError(code, message) {
  return {
    ok: false,
    code,
    message,
  };
}

function normalizeSeedOrigin(value) {
  if (typeof value !== "string") {
    return validationError(
      "url_required",
      "A website URL is required.",
    );
  }

  const input = value.trim();

  if (!input || input.length > MAX_URL_LENGTH) {
    return validationError(
      "invalid_url",
      "Enter a valid public website URL.",
    );
  }

  let url;

  try {
    url = new URL(input);
  } catch {
    return validationError(
      "invalid_url",
      "Enter a valid public website URL.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return validationError(
      "unsupported_protocol",
      "Only HTTP and HTTPS websites can be nominated.",
    );
  }

  if (url.username || url.password) {
    return validationError(
      "credentials_not_allowed",
      "Website URLs cannot contain credentials.",
    );
  }

  let hostname = url.hostname.toLowerCase().replace(/\.+$/, "");

  if (!hostname) {
    return validationError(
      "invalid_host",
      "Enter a valid public website URL.",
    );
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".internal")
  ) {
    return validationError(
      "non_public_host",
      "The nominated website must use a public hostname.",
    );
  }

  /*
   * JoshBot performs the authoritative public-network validation before
   * crawling. The intake Worker deliberately does not resolve or fetch the
   * nominated host. IP literals are rejected here so nominations remain
   * ordinary public website origins.
   */
  if (
    hostname.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  ) {
    return validationError(
      "ip_literal_not_allowed",
      "Nominate a website by hostname rather than IP address.",
    );
  }

  const port = url.port ? `:${url.port}` : "";

  return {
    ok: true,
    origin: `${url.protocol}//${hostname}${port}`,
  };
}

async function readJson(request) {
  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return {
      ok: false,
      response: json(
        {
          error: "unsupported_media_type",
          message: "Requests must use application/json.",
        },
        415,
      ),
    };
  }

  const contentLength = Number(request.headers.get("Content-Length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BYTES
  ) {
    return {
      ok: false,
      response: json(
        {
          error: "request_too_large",
          message: "The nomination request is too large.",
        },
        413,
      ),
    };
  }

  const text = await request.text();

  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      response: json(
        {
          error: "request_too_large",
          message: "The nomination request is too large.",
        },
        413,
      ),
    };
  }

  try {
    const value = JSON.parse(text);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("JSON body must be an object");
    }

    return {
      ok: true,
      value,
    };
  } catch {
    return {
      ok: false,
      response: json(
        {
          error: "invalid_json",
          message: "The nomination request is not valid JSON.",
        },
        400,
      ),
    };
  }
}

async function validateTurnstile(request, token, env) {
  if (
    typeof token !== "string" ||
    !token.trim() ||
    token.length > MAX_TURNSTILE_TOKEN_LENGTH
  ) {
    return {
      ok: false,
      code: "turnstile_required",
      message: "Complete the verification before nominating a site.",
    };
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return {
      ok: false,
      code: "turnstile_unavailable",
      message: "Verification is temporarily unavailable.",
    };
  }

  const payload = {
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  };

  const remoteIp = request.headers.get("CF-Connecting-IP");

  if (remoteIp) {
    payload.remoteip = remoteIp;
  }

  let response;
  let result;

  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    result = await response.json();
  } catch {
    return {
      ok: false,
      code: "turnstile_unavailable",
      message: "Verification is temporarily unavailable.",
    };
  }

  if (!response.ok || result.success !== true) {
    return {
      ok: false,
      code: "turnstile_failed",
      message: "Verification failed. Please try again.",
    };
  }

  if (
    env.TURNSTILE_EXPECTED_HOSTNAME &&
    result.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME
  ) {
    return {
      ok: false,
      code: "turnstile_failed",
      message: "Verification failed. Please try again.",
    };
  }

  if (
    env.TURNSTILE_EXPECTED_ACTION &&
    result.action !== env.TURNSTILE_EXPECTED_ACTION
  ) {
    return {
      ok: false,
      code: "turnstile_failed",
      message: "Verification failed. Please try again.",
    };
  }

  return { ok: true };
}

async function applyNominationRateLimits(origin, env) {
  const routeLimit = await env.NOMINATION_ROUTE_RATE_LIMITER.limit({
    key: "seed-nominations",
  });

  if (!routeLimit.success) {
    return {
      ok: false,
      code: "rate_limited",
      message:
        "Too many seed nominations are being submitted right now. Try again in a minute.",
    };
  }

  const originLimit = await env.NOMINATION_ORIGIN_RATE_LIMITER.limit({
    key: origin,
  });

  if (!originLimit.success) {
    return {
      ok: false,
      code: "origin_rate_limited",
      message:
        "That site has been nominated too many times. Try again in a minute.",
    };
  }

  return { ok: true };
}

async function nominate(request, env) {
  const cors = corsHeaders(request, env);

  if (env.SUBMISSIONS_ENABLED !== "true") {
    return json(
      {
        error: "submissions_disabled",
        message: "Seed nominations are not being accepted yet.",
      },
      503,
      cors,
    );
  }

  const parsed = await readJson(request);

  if (!parsed.ok) {
    const body = await parsed.response.json();

    return json(body, parsed.response.status, cors);
  }

  if (parsed.value.owner_attestation !== true) {
    return json(
      {
        error: "owner_attestation_required",
        message:
          "Confirm that you control the site and are asking JoshBot to crawl it.",
      },
      400,
      cors,
    );
  }

  const normalized = normalizeSeedOrigin(parsed.value.url);

  if (!normalized.ok) {
    return json(
      {
        error: normalized.code,
        message: normalized.message,
      },
      400,
      cors,
    );
  }

  const rateLimit = await applyNominationRateLimits(
    normalized.origin,
    env,
  );

  if (!rateLimit.ok) {
    return json(
      {
        error: rateLimit.code,
        message: rateLimit.message,
      },
      429,
      {
        ...cors,
        "Retry-After": "60",
      },
    );
  }

  const turnstile = await validateTurnstile(
    request,
    parsed.value.turnstile_token,
    env,
  );

  if (!turnstile.ok) {
    return json(
      {
        error: turnstile.code,
        message: turnstile.message,
      },
      turnstile.code === "turnstile_unavailable" ? 503 : 400,
      cors,
    );
  }

  const result = await env.DB.prepare(
    `
      INSERT OR IGNORE INTO seed_nominations (origin)
      VALUES (?)
    `,
  )
    .bind(normalized.origin)
    .run();

  const nomination = await env.DB.prepare(
    `
      SELECT id, origin, status, submitted_at
      FROM seed_nominations
      WHERE origin = ?
    `,
  )
    .bind(normalized.origin)
    .first();

  const inserted = Number(result.meta?.changes || 0) === 1;

  return json(
    {
      status: inserted ? "accepted" : "already_nominated",
      nomination,
    },
    inserted ? 202 : 200,
    cors,
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "joshternet-seed-nominations",
      });
    }

    if (
      request.method === "OPTIONS" &&
      url.pathname === "/v1/seed-nominations"
    ) {
      if (!originIsAllowed(request, env)) {
        return json(
          { error: "origin_not_allowed" },
          403,
          corsHeaders(request, env),
        );
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    if (
      request.method === "POST" &&
      url.pathname === "/v1/seed-nominations"
    ) {
      if (!originIsAllowed(request, env)) {
        return json(
          { error: "origin_not_allowed" },
          403,
          corsHeaders(request, env),
        );
      }

      return nominate(request, env);
    }

    return json({ error: "not_found" }, 404);
  },
};
