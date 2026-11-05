/**
 * Goal & Constraints:
 * Cached per-origin robots.txt gate for every Joshternet member (and
 * third-party) fetch. A missing robots file (404 or 410) allows. Transport
 * failures, 401, 403, and 429 defer the origin. Disallow skips the URL.
 * Injectable fetch for offline tests.
 */

import {
  classifyTransportError,
  decideRobotsOutcome,
} from "./fetch-outcome.mjs";
import { fetchPublicText, USER_AGENT } from "./lib.mjs";
import { robotsAllowsPath } from "./robots.mjs";

/**
 * @typedef {{
 *   allows: (href: string) => Promise<boolean>,
 *   bodyForOrigin: (origin: string) => Promise<string>,
 *   outcomeForOrigin: (origin: string) => Promise<{ decision: string, reason: string, body: string, status: number | null }>,
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
 *   policyCache?: Map<string, { body: string, bodyComplete?: boolean }>,
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
  const policyCache = options.policyCache || new Map();
  /** @type {Map<string, Promise<{ decision: string, reason: string, body: string, status: number | null }>>} */
  const bodies = new Map();

  /**
   * @param {string} origin
   * @returns {Promise<{ decision: string, reason: string, body: string, status: number | null }>}
   */
  async function loadBody(origin) {
    const cached = policyCache.get(origin) || null;
    try {
      const fetched = await fetchText(`${origin}/robots.txt`, {
        cache,
        accept: "text/plain,*/*;q=0.8",
        captureHttpErrors: true,
      });
      const body = typeof fetched.body === "string" ? fetched.body : undefined;
      const outcome = decideRobotsOutcome({
        status: typeof fetched.status === "number" ? fetched.status : 200,
        errorKind: "none",
        body,
        bodyComplete:
          typeof fetched.body === "string" && fetched.body_complete !== false,
        cached,
      });
      if (outcome.decision === "apply") {
        policyCache.set(origin, { body: outcome.body, bodyComplete: true });
      }
      return outcome;
    } catch (error) {
      return decideRobotsOutcome({
        status: null,
        errorKind: classifyTransportError(error),
        body: "",
        bodyComplete: false,
        cached,
      });
    }
  }

  /**
   * @param {string} origin
   * @returns {Promise<{ decision: string, reason: string, body: string, status: number | null }>}
   */
  function outcomeForOrigin(origin) {
    if (!origin) {
      return Promise.resolve({
        decision: "defer",
        reason: "robots-unavailable",
        body: "",
        status: null,
      });
    }

    let pending = bodies.get(origin);

    if (!pending) {
      pending = loadBody(origin);
      bodies.set(origin, pending);
    }

    return pending;
  }

  /**
   * @param {string} origin
   * @returns {Promise<string>}
   */
  async function bodyForOrigin(origin) {
    const outcome = await outcomeForOrigin(origin);
    return outcome.body;
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
    const outcome = await outcomeForOrigin(origin);
    if (outcome.decision === "absent") {
      return true;
    }
    if (outcome.decision !== "apply") {
      return false;
    }
    return robotsAllowsPath(outcome.body, pathname, userAgent);
  }

  return { allows, bodyForOrigin, outcomeForOrigin };
}
