/**
 * Goal & Constraints:
 * Public browser helper that reads only `{origin}/.well-known/josh` so the
 * validate page can classify live declarations without publisher CORS.
 *
 * Security (public internet):
 * - Browser Origin must be present and allowlisted (no anonymous callers).
 * - Cloudflare rate limits: per client IP and per target origin.
 * - Fetch only that path; credentials and IP literals rejected.
 * - Redirects are not auto-followed. One same-origin hop to the exact path
 *   is allowed; anything else is unread (SSRF / open-proxy mitigation).
 * - Response bodies capped; fetch timed out.
 *
 * Inputs: GET /v1/declaration-check?origin=https://example.invalid
 * Outputs: JSON for classifyLiveResponse on the site.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const MAX_URL_LENGTH = 2048;
const MAX_BODY_BYTES = 65536;
const FETCH_TIMEOUT_MS = 10000;
const DECLARATION_PATH = "/.well-known/josh";

/**
 * @param {unknown} body
 * @param {number} [status]
 * @param {Record<string, string>} [headers]
 * @returns {Response}
 */
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

/**
 * @param {string | undefined} value
 * @returns {string[]}
 */
function allowedOrigins(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * @param {Request} request
 * @param {{ ALLOWED_ORIGINS?: string }} env
 * @returns {Record<string, string>}
 */
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env.ALLOWED_ORIGINS);

  if (!origin || !allowed.includes(origin)) {
    return {
      Vary: "Origin",
    };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Browser callers must send an allowlisted Origin. Missing Origin is denied
 * so this is not an anonymous open proxy.
 * @param {Request} request
 * @param {{ ALLOWED_ORIGINS?: string }} env
 * @returns {boolean}
 */
function originIsAllowed(request, env) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return false;
  }

  return allowedOrigins(env.ALLOWED_ORIGINS).includes(origin);
}

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ ok: false, code: string, message: string }}
 */
function validationError(code, message) {
  return {
    ok: false,
    code,
    message,
  };
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isBlockedHostname(hostname) {
  if (
    hostname === "localhost" ||
    hostname === "metadata.google.internal" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localdomain")
  ) {
    return true;
  }

  if (hostname.includes(":")) {
    return true;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }

  return false;
}

/**
 * @param {string | null} value
 * @returns {{ ok: true, origin: string, declarationURL: string } | { ok: false, code: string, message: string }}
 */
function normalizeCheckOrigin(value) {
  if (typeof value !== "string") {
    return validationError("origin_required", "An origin URL is required.");
  }

  const input = value.trim();

  if (!input || input.length > MAX_URL_LENGTH) {
    return validationError(
      "invalid_origin",
      "Enter a valid public origin URL.",
    );
  }

  let url;

  try {
    url = new URL(input);
  } catch {
    return validationError(
      "invalid_origin",
      "Enter a valid public origin URL.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return validationError(
      "unsupported_protocol",
      "Only HTTP and HTTPS origins can be checked.",
    );
  }

  if (url.username || url.password) {
    return validationError(
      "credentials_not_allowed",
      "Origin URLs cannot contain credentials.",
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");

  if (!hostname) {
    return validationError("invalid_host", "Enter a valid public origin URL.");
  }

  if (isBlockedHostname(hostname)) {
    return validationError(
      "non_public_host",
      "The origin must use a public hostname.",
    );
  }

  const port = url.port ? `:${url.port}` : "";
  const origin = `${url.protocol}//${hostname}${port}`;

  return {
    ok: true,
    origin,
    declarationURL: `${origin}${DECLARATION_PATH}`,
  };
}

/**
 * @param {string} requestedOrigin
 * @param {string} candidate
 * @returns {boolean}
 */
function isAllowedDeclarationURL(requestedOrigin, candidate) {
  let url;

  try {
    url = new URL(candidate);
  } catch {
    return false;
  }

  if (url.origin !== requestedOrigin) {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  if (url.pathname !== DECLARATION_PATH) {
    return false;
  }

  if (url.search || url.hash) {
    return false;
  }

  if (isBlockedHostname(url.hostname.toLowerCase().replace(/\.+$/, ""))) {
    return false;
  }

  return true;
}

/**
 * @param {Request} request
 * @returns {string}
 */
function clientKey(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * @param {string} client
 * @param {string} targetOrigin
 * @param {{
 *   DECLARATION_CHECK_IP_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> },
 *   DECLARATION_CHECK_ORIGIN_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> }
 * }} env
 * @returns {Promise<{ ok: true } | { ok: false, code: string, message: string }>}
 */
async function applyRateLimits(client, targetOrigin, env) {
  if (
    !env.DECLARATION_CHECK_IP_RATE_LIMITER ||
    !env.DECLARATION_CHECK_ORIGIN_RATE_LIMITER
  ) {
    return {
      ok: false,
      code: "rate_limit_unavailable",
      message: "The live checker is not ready to accept traffic.",
    };
  }

  const ipLimit = await env.DECLARATION_CHECK_IP_RATE_LIMITER.limit({
    key: `ip:${client}`,
  });

  if (!ipLimit.success) {
    return {
      ok: false,
      code: "rate_limited",
      message:
        "Too many live checks from this network right now. Try again in a minute.",
    };
  }

  const originLimit = await env.DECLARATION_CHECK_ORIGIN_RATE_LIMITER.limit({
    key: `origin:${targetOrigin}`,
  });

  if (!originLimit.success) {
    return {
      ok: false,
      code: "origin_rate_limited",
      message:
        "That origin has been checked too many times right now. Try again in a minute.",
    };
  }

  return { ok: true };
}

/**
 * @param {Response} response
 * @returns {Promise<{ contentType: string, body: string | null, error: string | null }>}
 */
async function readBody(response) {
  const contentType = response.headers.get("content-type") || "";
  const buffer = await response.arrayBuffer();

  if (buffer.byteLength > MAX_BODY_BYTES) {
    return {
      contentType,
      body: null,
      error: "response_too_large",
    };
  }

  return {
    contentType,
    body: new TextDecoder().decode(buffer),
    error: null,
  };
}

/**
 * @param {string} declarationURL
 * @param {string} requestedOrigin
 * @returns {Promise<{
 *   finalURL: string | null,
 *   status: number | null,
 *   contentType: string,
 *   body: string | null,
 *   error: string | null
 * }>}
 */
async function readDeclaration(declarationURL, requestedOrigin) {
  try {
    const response = await fetch(declarationURL, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");

      if (!location) {
        return {
          finalURL: declarationURL,
          status: response.status,
          contentType: "",
          body: null,
          error: "redirect",
        };
      }

      let nextURL;

      try {
        nextURL = new URL(location, declarationURL).href;
      } catch {
        return {
          finalURL: declarationURL,
          status: response.status,
          contentType: "",
          body: null,
          error: "redirect",
        };
      }

      if (!isAllowedDeclarationURL(requestedOrigin, nextURL)) {
        return {
          finalURL: nextURL,
          status: response.status,
          contentType: "",
          body: null,
          error: "redirect",
        };
      }

      const redirected = await fetch(nextURL, {
        method: "GET",
        redirect: "error",
        headers: {
          Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      const payload = await readBody(redirected);

      return {
        finalURL: redirected.url || nextURL,
        status: redirected.status,
        contentType: payload.contentType,
        body: payload.body,
        error: payload.error,
      };
    }

    const payload = await readBody(response);

    return {
      finalURL: response.url || declarationURL,
      status: response.status,
      contentType: payload.contentType,
      body: payload.body,
      error: payload.error,
    };
  } catch {
    return {
      finalURL: null,
      status: null,
      contentType: "",
      body: null,
      error: "network",
    };
  }
}

export default {
  /**
   * @param {Request} request
   * @param {{
   *   ALLOWED_ORIGINS?: string,
   *   DECLARATION_CHECK_IP_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> },
   *   DECLARATION_CHECK_ORIGIN_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> }
   * }} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!originIsAllowed(request, env)) {
        return json(
          {
            error: "origin_not_allowed",
            message: "This browser origin is not allowed to use the checker.",
          },
          403,
          cors,
        );
      }

      return new Response(null, {
        status: 204,
        headers: cors,
      });
    }

    if (url.pathname !== "/v1/declaration-check") {
      return json(
        {
          error: "not_found",
          message: "Not found.",
        },
        404,
        cors,
      );
    }

    if (request.method !== "GET") {
      return json(
        {
          error: "method_not_allowed",
          message: "Use GET.",
        },
        405,
        {
          ...cors,
          Allow: "GET, OPTIONS",
        },
      );
    }

    if (!originIsAllowed(request, env)) {
      return json(
        {
          error: "origin_not_allowed",
          message: "This browser origin is not allowed to use the checker.",
        },
        403,
        cors,
      );
    }

    const parsed = normalizeCheckOrigin(url.searchParams.get("origin"));

    if (!parsed.ok) {
      return json(
        {
          error: parsed.code,
          message: parsed.message,
        },
        400,
        cors,
      );
    }

    const rateLimit = await applyRateLimits(
      clientKey(request),
      parsed.origin,
      env,
    );

    if (!rateLimit.ok) {
      return json(
        {
          error: rateLimit.code,
          message: rateLimit.message,
        },
        rateLimit.code === "rate_limit_unavailable" ? 503 : 429,
        {
          ...cors,
          "Retry-After": "60",
        },
      );
    }

    const upstream = await readDeclaration(
      parsed.declarationURL,
      parsed.origin,
    );

    return json(
      {
        ok: upstream.error === null,
        requestedOrigin: parsed.origin,
        declarationURL: parsed.declarationURL,
        finalURL: upstream.finalURL,
        status: upstream.status,
        contentType: upstream.contentType,
        body: upstream.body,
        error: upstream.error,
      },
      200,
      cors,
    );
  },
};
