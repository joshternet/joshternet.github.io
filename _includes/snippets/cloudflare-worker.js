/**
 * Serves only /.well-known/josh with a valid version 1 Joshternet declaration.
 * All other paths pass through to origin. Identity comes from env.JOSH_IDENTITY
 * (affirmed | declined | undeclared). Unknown nonempty values fail closed.
 */

/**
 * Maps a Worker identity setting to a version 1 declaration object.
 * @param {unknown} identity - env.JOSH_IDENTITY value.
 * @returns {object} Success: `{ ok: true, body }` with version 1 declaration;
 *   failure: `{ ok: false, message }`.
 */
export function resolveDeclaration(identity) {
  if (identity == null || String(identity).trim() === "") {
    return { ok: true, body: { version: 1 } };
  }

  const value = String(identity).trim().toLowerCase();

  if (value === "affirmed") {
    return { ok: true, body: { version: 1, josh: true } };
  }

  if (value === "declined") {
    return { ok: true, body: { version: 1, josh: false } };
  }

  if (value === "undeclared") {
    return { ok: true, body: { version: 1 } };
  }

  return {
    ok: false,
    message: "Invalid JOSH_IDENTITY. Use affirmed, declined, or undeclared.",
  };
}

/**
 * Declaration response headers shared by GET and HEAD.
 * @returns {Record<string, string>}
 */
export function declarationHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
}

export default {
  /**
   * @param {Request} request
   * @param {object} env - Worker bindings; may include string `JOSH_IDENTITY`.
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/.well-known/josh") {
      return fetch(request);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "GET, HEAD",
        },
      });
    }

    const resolved = resolveDeclaration(env?.JOSH_IDENTITY);
    if (!resolved.ok) {
      return new Response(resolved.message, {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const headers = declarationHeaders();
    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    const body = `${JSON.stringify(resolved.body, null, 2)}\n`;
    return new Response(body, { status: 200, headers });
  },
};
