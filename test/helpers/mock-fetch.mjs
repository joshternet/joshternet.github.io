/**
 * Goal & Constraints:
 * Offline HTTP boundary for unit/integration tests.
 *
 * This module installs and restores globalThis.fetch so test code never hits
 * the real network. It is an external HTTP boundary — real fetch is replaced
 * by a controlled stub that returns pre-registered fixtures.
 *
 * Usage:
 *   import { install, restore, register, dnsCache } from '../helpers/mock-fetch.mjs';
 *
 *   test('...', async () => {
 *     install();
 *     register('https://example.com/feed', { body: '<rss/>', contentType: 'application/rss+xml' });
 *     const result = await myFunction(dnsCache(['example.com']));
 *     restore();
 *   });
 */

/** @type {typeof globalThis.fetch | undefined} */
let _originalFetch;

/**
 * @typedef {{ body?: string, status?: number, contentType?: string }} MockResponse
 */

/** @type {Map<string | RegExp, MockResponse>} */
let _handlers = new Map();

/**
 * Registers an exact-URL handler for mock fetch.
 * @param {string} url
 * @param {MockResponse} response
 */
export function register(url, response) {
  _handlers.set(url, response);
}

/**
 * Registers a regex pattern handler for mock fetch.
 * @param {RegExp} pattern
 * @param {MockResponse} response
 */
export function registerPattern(pattern, response) {
  _handlers.set(pattern, response);
}

/**
 * @param {MockResponse} r
 * @returns {Response}
 */
function buildMockResponse(r) {
  const body = r.body ?? "";
  const status = r.status ?? 200;
  const contentType = r.contentType ?? "text/html";
  const headersInit = new Headers({ "content-type": contentType });

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headersInit,
    /** @returns {Promise<ArrayBuffer>} */
    arrayBuffer: async () => Buffer.from(body),
  };
}

/**
 * Installs the mock fetch as globalThis.fetch.
 * Must be paired with a restore() call to clean up.
 */
export function install() {
  _originalFetch = globalThis.fetch;

  /**
   * @param {string | URL} url
   * @returns {Promise<Response>}
   */
  globalThis.fetch = async (url) => {
    const urlStr = String(url);

    // Exact match first.
    if (_handlers.has(urlStr)) {
      return buildMockResponse(
        /** @type {MockResponse} */ (_handlers.get(urlStr)),
      );
    }

    // Pattern match second.
    for (const [key, response] of _handlers) {
      if (key instanceof RegExp && key.test(urlStr)) {
        return buildMockResponse(response);
      }
    }

    throw new Error(`mock-fetch: no handler registered for ${urlStr}`);
  };
}

/**
 * Restores the original fetch and clears all registered handlers.
 */
export function restore() {
  globalThis.fetch = _originalFetch;
  _handlers = new Map();
  _originalFetch = undefined;
}

/**
 * Creates a DNS cache pre-populated for a list of hostnames with a safe
 * public IP so assertPublicURL skips real DNS lookup.
 * Pass this Map as the `cache` option to fetchPublicText.
 *
 * @param {string[]} hostnames
 * @returns {Map<string, Array<{address: string}>>}
 * @example
 * const cache = dnsCache(['example.com', 'other.example']);
 * await fetchPublicText('https://example.com/feed', { cache });
 */
export function dnsCache(hostnames) {
  const cache = new Map();

  for (const hostname of hostnames) {
    // 1.1.1.1 is Cloudflare's public DNS and is not in any RFC-private range,
    // so assertPublicURL's blocklist check passes. The real fetch is never made
    // because globalThis.fetch is replaced by install().
    cache.set(hostname, [{ address: "1.1.1.1" }]);
  }

  return cache;
}
