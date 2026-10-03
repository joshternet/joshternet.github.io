/**
 * Goal & Constraints:
 * Public Joshternet membership button service. Registry is the only membership
 * source. Never fetch the supplied origin or /.well-known/josh. Fail closed
 * when the registry cannot be read (never show Join on registry failure).
 *
 * Routes:
 * - GET /embed/joshternet-button.js
 * - GET /api/button-state?origin=
 * - GET /button?origin=  (PNG via ASSETS or 204 when unavailable)
 */

import {
  BUTTON_STATES,
  buttonStateForOrigin,
  buildRegistryIndex,
} from "./button-state.js";
import { buildEmbedScript } from "./embed-script.js";
import { normalizeButtonOrigin } from "./origin.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

const JS_HEADERS = {
  "Content-Type": "application/javascript; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "public, max-age=86400",
};

const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/joshternet/index-data/main/registry.json";

const DEFAULT_SITE_ORIGIN = "https://joshternet.org";
const EMBED_VERSION = "20261003";
const REGISTRY_CACHE_TTL_SECONDS = 300;
const STATE_CACHE_TTL_SECONDS = 300;

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
 * Button state responses are readable from any embedding site.
 * @returns {Record<string, string>}
 */
function publicCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * @param {{
 *   SITE_ORIGIN?: string,
 *   REGISTRY_URL?: string,
 *   EMBED_VERSION?: string,
 * }} env
 * @returns {{ siteOrigin: string, registryURL: string, embedVersion: string }}
 */
function config(env) {
  return {
    siteOrigin: env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN,
    registryURL: env.REGISTRY_URL || DEFAULT_REGISTRY_URL,
    embedVersion: env.EMBED_VERSION || EMBED_VERSION,
  };
}

/**
 * @param {string} siteOrigin
 * @param {string} file
 * @returns {string}
 */
function staticButtonURL(siteOrigin, file) {
  return `${siteOrigin}/assets/buttons/${file}`;
}

/**
 * @param {string} siteOrigin
 * @param {ReturnType<typeof buttonStateForOrigin>} state
 * @returns {string}
 */
function hrefForState(siteOrigin, state) {
  if (state.state === "join") {
    return `${siteOrigin}/implement/`;
  }

  return `${siteOrigin}/network/`;
}

/**
 * @param {Request} request
 * @param {{
 *   SITE_ORIGIN?: string,
 *   REGISTRY_URL?: string,
 *   EMBED_VERSION?: string,
 *   ASSETS?: { fetch: (input: RequestInfo) => Promise<Response> },
 * }} env
 * @param {string} origin
 * @returns {Promise<
 *   | { ok: true, state: ReturnType<typeof buttonStateForOrigin>, imageURL: string, href: string }
 *   | { ok: false, reason: "unavailable" }
 * >}
 */
async function resolveButton(request, env, origin) {
  const { siteOrigin, registryURL } = config(env);

  try {
    const index = await loadRegistryIndex(request, registryURL);
    const state = buttonStateForOrigin(index, origin);

    return {
      ok: true,
      state,
      imageURL: staticButtonURL(siteOrigin, state.file),
      href: hrefForState(siteOrigin, state),
    };
  } catch (error) {
    console.error(
      "Joshternet button registry unavailable:",
      error instanceof Error ? error.message : error,
    );
    return {
      ok: false,
      reason: "unavailable",
    };
  }
}

/**
 * @param {Request} request
 * @param {string} registryURL
 * @returns {Promise<Map<string, "affirmed" | "declined" | "undeclared">>}
 */
async function loadRegistryIndex(request, registryURL) {
  const cache =
    typeof caches !== "undefined" && caches.default ? caches.default : null;
  const cacheKey = new Request(registryURL, {
    method: "GET",
  });

  if (cache) {
    const cached = await cache.match(cacheKey);

    if (cached) {
      return buildRegistryIndex(await cached.json());
    }
  }

  // Workers only allow redirect "follow" | "manual" (not "error").
  const response = await fetch(registryURL, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Joshternet-Button/1.0 (+https://joshternet.org/implement/buttons/)",
    },
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error(`registry redirected with ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`registry request failed with ${response.status}`);
  }

  const data = await response.json();
  const index = buildRegistryIndex(data);

  if (cache) {
    try {
      const toCache = new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": `public, max-age=${REGISTRY_CACHE_TTL_SECONDS}`,
        },
      });

      await cache.put(cacheKey, toCache);
    } catch (error) {
      console.error(
        "Joshternet button registry cache write skipped:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  void request;
  return index;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @returns {Promise<Response>}
 */
async function handleButtonState(request, env) {
  const url = new URL(request.url);
  const normalized = normalizeButtonOrigin(url.searchParams.get("origin"));

  if (!normalized.ok) {
    return json(
      {
        ok: false,
        code: normalized.code,
        message: normalized.message,
        state: "unavailable",
      },
      400,
      {
        ...publicCorsHeaders(),
        "Cache-Control": "no-store",
      },
    );
  }

  const resolved = await resolveButton(request, env, normalized.origin);

  if (!resolved.ok) {
    return json(
      {
        ok: false,
        state: "unavailable",
        origin: normalized.origin,
        message: "The Joshternet registry could not be read.",
      },
      503,
      {
        ...publicCorsHeaders(),
        "Cache-Control": "no-store",
      },
    );
  }

  const { state, imageURL, href } = resolved;

  return json(
    {
      ok: true,
      origin: normalized.origin,
      state: state.state,
      alt: state.alt,
      linkLabel: state.linkLabel,
      imageURL,
      href,
      member: state.member,
    },
    200,
    {
      ...publicCorsHeaders(),
      "Cache-Control": `public, max-age=${STATE_CACHE_TTL_SECONDS}`,
      Vary: "Origin",
    },
  );
}

/**
 * @param {Request} request
 * @param {Env} env
 * @returns {Promise<Response>}
 */
async function handleButtonImage(request, env) {
  const url = new URL(request.url);
  const normalized = normalizeButtonOrigin(url.searchParams.get("origin"));

  if (!normalized.ok) {
    return new Response(null, {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const resolved = await resolveButton(request, env, normalized.origin);

  if (!resolved.ok) {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (env.ASSETS) {
    const asset = await env.ASSETS.fetch(
      new Request(new URL(`/buttons/${resolved.state.file}`, request.url), {
        method: "GET",
      }),
    );

    if (asset.ok) {
      const headers = new Headers(asset.headers);
      headers.set("Content-Type", "image/png");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set(
        "Cache-Control",
        `public, max-age=${STATE_CACHE_TTL_SECONDS}`,
      );
      headers.set("X-Joshternet-Button-State", resolved.state.state);

      return new Response(asset.body, {
        status: 200,
        headers,
      });
    }
  }

  return Response.redirect(resolved.imageURL, 302);
}

/**
 * @param {Env} env
 * @returns {Response}
 */
function handleEmbedScript(env) {
  const { siteOrigin, embedVersion } = config(env);
  const body = buildEmbedScript({
    version: embedVersion,
    siteOrigin,
  });

  return new Response(body, {
    status: 200,
    headers: {
      ...JS_HEADERS,
      "Cache-Control": `public, max-age=86400`,
      ETag: `"${embedVersion}"`,
    },
  });
}

/**
 * @typedef {{
 *   SITE_ORIGIN?: string,
 *   REGISTRY_URL?: string,
 *   EMBED_VERSION?: string,
 *   ASSETS?: { fetch: (input: RequestInfo) => Promise<Response> },
 * }} Env
 */

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (
        url.pathname === "/api/button-state" ||
        url.pathname === "/button" ||
        url.pathname === "/embed/joshternet-button.js"
      ) {
        return new Response(null, {
          status: 204,
          headers: publicCorsHeaders(),
        });
      }

      return new Response(null, {
        status: 404,
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json(
        {
          ok: false,
          code: "method_not_allowed",
          message: "Only GET is supported.",
        },
        405,
        {
          Allow: "GET, HEAD, OPTIONS",
        },
      );
    }

    if (url.pathname === "/embed/joshternet-button.js") {
      return handleEmbedScript(env);
    }

    if (url.pathname === "/api/button-state") {
      return handleButtonState(request, env);
    }

    if (url.pathname === "/button") {
      return handleButtonImage(request, env);
    }

    if (url.pathname === "/buttons" || url.pathname.startsWith("/buttons/")) {
      if (env.ASSETS) {
        const asset = await env.ASSETS.fetch(request);

        if (asset.ok) {
          const headers = new Headers(asset.headers);
          headers.set("Content-Type", "image/png");
          headers.set("X-Content-Type-Options", "nosniff");
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
          return new Response(asset.body, {
            status: 200,
            headers,
          });
        }
      }
    }

    return json(
      {
        ok: false,
        code: "not_found",
        message: "Not found.",
        states: Object.keys(BUTTON_STATES),
      },
      404,
    );
  },
};
