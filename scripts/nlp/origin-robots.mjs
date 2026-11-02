/**
 * Goal & Constraints:
 * Cached per-origin robots.txt gate for every Joshternet member (and
 * third-party) fetch. Missing/unreadable robots.txt allows. Disallow skips
 * the URL—never invent pages or summaries for blocked paths. Injectable
 * fetch for offline tests.
 */

import { fetchPublicText, USER_AGENT } from "./lib.mjs";
import { robotsAllowsPath } from "./robots.mjs";

/**
 * @typedef {{
 *   allows: (href: string) => Promise<boolean>,
 *   bodyForOrigin: (origin: string) => Promise<string>,
 * }} OriginRobotsGate
 */

/**
 * Absolute http(s) origin for a URL, or "".
 * @param {unknown} href
 * @returns {string}
 */
export function originFromHref(href) {
  if (typeof href !== "string" || !href) {
    return "";
  }

  try {
    const parsed = new URL(href);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.origin;
  } catch {
    return "";
  }
}

/**
 * Creates a robots gate that loads each origin's robots.txt once.
 * @param {{
 *   fetchPublicText?: typeof fetchPublicText,
 *   userAgent?: string,
 *   cache?: Map<string, unknown>,
 * }} [options]
 * @returns {OriginRobotsGate}
 */
export function createOriginRobotsGate(options = {}) {
  const fetchText = options.fetchPublicText || fetchPublicText;
  const userAgent =
    typeof options.userAgent === "string" && options.userAgent
      ? options.userAgent
      : USER_AGENT;
  const cache = options.cache || new Map();
  /** @type {Map<string, Promise<string>>} */
  const bodies = new Map();

  /**
   * @param {string} origin
   * @returns {Promise<string>}
   */
  async function loadBody(origin) {
    try {
      const fetched = await fetchText(`${origin}/robots.txt`, {
        cache,
        accept: "text/plain,*/*;q=0.8",
      });
      return typeof fetched.body === "string" ? fetched.body : "";
    } catch {
      return "";
    }
  }

  /**
   * @param {string} origin
   * @returns {Promise<string>}
   */
  function bodyForOrigin(origin) {
    if (!origin) {
      return Promise.resolve("");
    }

    let pending = bodies.get(origin);

    if (!pending) {
      pending = loadBody(origin);
      bodies.set(origin, pending);
    }

    return pending;
  }

  /**
   * True when robots.txt allows this URL for the gate user-agent.
   * @param {string} href
   * @returns {Promise<boolean>}
   */
  async function allows(href) {
    const origin = originFromHref(href);

    if (!origin) {
      return false;
    }

    // originFromHref already parsed href; a second parse cannot fail here.
    const pathname = new URL(href).pathname;
    const body = await bodyForOrigin(origin);
    return robotsAllowsPath(body, pathname, userAgent);
  }

  return { allows, bodyForOrigin };
}
