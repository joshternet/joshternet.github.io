/**
 * Goal & Constraints:
 * Shared SSRF guards for JoshBot/nlp:sync fetch and Playwright paths.
 * Reuse assertPublicURL (single IP policy)—do not invent a second blocklist.
 * Manual redirect hop caps and capped body reads keep crawled sites from
 * steering the Actions runner at private/metadata hosts or multi-GB bodies.
 */

import { assertPublicURL } from "./lib.mjs";

/** Redirect hop ceiling for Node fetch paths (preview/verify parity). */
export const MAX_PUBLIC_FETCH_REDIRECTS = 5;

/**
 * Reads a fetch response body with an absolute byte ceiling.
 * Prefer Content-Length when present; still count streamed chunks.
 * @param {{
 *   headers?: { get?: (name: string) => string | null },
 *   body?: { getReader?: () => {
 *     read: () => Promise<{ done: boolean, value?: Uint8Array | unknown }>,
 *     cancel?: () => Promise<unknown>,
 *   } } | null,
 *   arrayBuffer?: () => Promise<ArrayBuffer>,
 * }} response
 * @param {number} maxBytes
 * @param {{ overflow?: "truncate" | "throw", detail?: { bodyComplete?: boolean, bytesReceived?: number } }} [options]
 * @returns {Promise<Buffer>}
 */
export async function readCappedResponseBytes(
  response,
  maxBytes,
  options = {},
) {
  const overflow = options.overflow === "throw" ? "throw" : "truncate";
  /**
   * @param {Buffer} buffer
   * @param {boolean} bodyComplete
   * @returns {Buffer}
   */
  const finish = (buffer, bodyComplete) => {
    if (options.detail && typeof options.detail === "object") {
      options.detail.bodyComplete = bodyComplete;
      options.detail.bytesReceived = buffer.length;
    }
    return buffer;
  };
  const lengthHeader =
    typeof response.headers?.get === "function"
      ? response.headers.get("content-length")
      : null;
  const contentLength = Number(lengthHeader || "");

  if (
    overflow === "throw" &&
    Number.isFinite(contentLength) &&
    contentLength > maxBytes
  ) {
    throw new Error(`Response exceeds ${maxBytes} bytes (Content-Length)`);
  }

  const body = response.body;

  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    /** @type {Uint8Array[]} */
    const chunks = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!(value instanceof Uint8Array) || value.byteLength === 0) {
        continue;
      }

      if (total + value.byteLength > maxBytes) {
        if (overflow === "throw") {
          if (typeof reader.cancel === "function") {
            try {
              await reader.cancel();
            } catch {
              // Ignore cancel failures after an overflow abort.
            }
          }

          throw new Error(`Response exceeds ${maxBytes} bytes`);
        }

        const remain = maxBytes - total;

        if (remain > 0) {
          chunks.push(value.subarray(0, remain));
        }

        if (typeof reader.cancel === "function") {
          try {
            await reader.cancel();
          } catch {
            // Ignore cancel failures after a truncate abort.
          }
        }

        return finish(
          Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
          false,
        );
      }

      total += value.byteLength;
      chunks.push(value);
    }

    const streamed = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const short =
      Number.isFinite(contentLength) && contentLength > streamed.length;
    return finish(streamed, !short);
  }

  if (typeof response.arrayBuffer !== "function") {
    throw new Error("Response has no readable body");
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length > maxBytes) {
    if (overflow === "throw") {
      throw new Error(`Response exceeds ${maxBytes} bytes`);
    }

    return finish(buffer.subarray(0, maxBytes), false);
  }

  const short = Number.isFinite(contentLength) && contentLength > buffer.length;
  return finish(buffer, !short);
}

/**
 * Continues a Playwright route only when the request URL is public http(s).
 * @param {{
 *   request: () => { url: () => string },
 *   abort: (reason?: string) => Promise<void>,
 *   continue: () => Promise<void>,
 * }} route
 * @param {{
 *   cache?: Map<string, unknown>,
 *   lookup?: unknown,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function continueIfPublicUrl(route, options = {}) {
  try {
    const requestURL = new URL(route.request().url());

    if (requestURL.protocol !== "https:" && requestURL.protocol !== "http:") {
      await route.abort("blockedbyclient");
      return;
    }

    await assertPublicURL(requestURL.href, {
      cache: options.cache,
      lookup: options.lookup,
    });

    await route.continue();
  } catch {
    await route.abort("blockedbyclient");
  }
}

/**
 * Installs a Playwright route filter that aborts non-http(s) and non-public URLs.
 * Same policy as network sync enrichment.
 * @param {{
 *   route: (
 *     pattern: string,
 *     handler: (route: {
 *       request: () => { url: () => string },
 *       abort: (reason?: string) => Promise<void>,
 *       continue: () => Promise<void>,
 *     }) => Promise<void>,
 *   ) => Promise<void>,
 * }} page
 * @param {{
 *   cache?: Map<string, unknown>,
 *   lookup?: unknown,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function installPublicUrlRouteGuard(page, options = {}) {
  await page.route("**/*", async (route) => {
    await continueIfPublicUrl(route, options);
  });
}
