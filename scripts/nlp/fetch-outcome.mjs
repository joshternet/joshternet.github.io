/**
 * Goal & Constraints:
 * Robots and retry decisions stay explicit. A transport failure is not
 * permission to crawl, and a partial robots body is never an empty policy.
 */

/**
 * @param {unknown} error
 * @returns {'timeout'|'dns'|'tls'|'http'|'network'}
 */
export function classifyTransportError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/abort|timeout/i.test(message)) {
    return "timeout";
  }
  if (/ENOTFOUND|getaddrinfo|dns/i.test(message)) {
    return "dns";
  }
  if (/certificate|TLS|UNABLE_TO_VERIFY/i.test(message)) {
    return "tls";
  }
  if (/^HTTP \d+/.test(message)) {
    return "http";
  }
  return "network";
}

/**
 * @param {unknown} error
 * @returns {number|null}
 */
export function httpStatusFromError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  const match = /^HTTP (\d+)/.exec(message);
  return match ? Number(match[1]) : null;
}

/**
 * @typedef {{ body: string, bodyComplete?: boolean }} CachedRobotsPolicy
 */

/**
 * Chooses how a robots.txt retrieval may affect the crawl.
 * 401, 403, and 429 defer by Joshternet policy. RFC 9309 does not require
 * those three choices.
 * @param {{
 *   status?: number | null,
 *   errorKind?: string,
 *   body?: unknown,
 *   bodyComplete?: boolean,
 *   cached?: CachedRobotsPolicy | null,
 * }} input
 * @returns {{ decision: 'apply'|'absent'|'defer', reason: string, body: string, status: number|null }}
 */
export function decideRobotsOutcome(input) {
  const status = typeof input.status === "number" ? input.status : null;
  const errorKind = input.errorKind || "none";
  const usableBody = typeof input.body === "string" ? input.body : "";
  const cached =
    input.cached &&
    input.cached.bodyComplete !== false &&
    typeof input.cached.body === "string"
      ? input.cached
      : null;

  if (status === 404 || status === 410) {
    return { decision: "absent", reason: "robots-absent", body: "", status };
  }

  if (status === 401 || status === 403) {
    return {
      decision: "defer",
      reason: "robots-forbidden",
      body: "",
      status,
    };
  }

  if (status === 429) {
    return {
      decision: "defer",
      reason: "robots-rate-limited",
      body: "",
      status,
    };
  }

  if (status !== null && status >= 200 && status < 300) {
    if (input.bodyComplete === false || typeof input.body !== "string") {
      if (cached) {
        return {
          decision: "apply",
          reason: "robots-cached",
          body: cached.body,
          status,
        };
      }
      return {
        decision: "defer",
        reason: "robots-unusable",
        body: "",
        status,
      };
    }
    return {
      decision: "apply",
      reason: "robots-fetched",
      body: usableBody,
      status,
    };
  }

  if (cached && (errorKind !== "none" || (status !== null && status >= 500))) {
    return {
      decision: "apply",
      reason: "robots-cached",
      body: cached.body,
      status,
    };
  }

  return {
    decision: "defer",
    reason: "robots-unavailable",
    body: "",
    status,
  };
}

/**
 * Parses Retry-After as delay seconds or an HTTP date.
 * @param {string | null | undefined} header
 * @param {number} nowMs
 * @returns {number | null}
 */
export function parseRetryAfter(header, nowMs) {
  if (header == null || String(header).trim() === "") {
    return null;
  }
  const trimmed = String(header).trim();
  if (/^\d+$/.test(trimmed)) {
    return nowMs + Number(trimmed) * 1000;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * One retry owner. Permanent misses and policy denials are not retried.
 * A delay past the job budget is a persisted deferral.
 * @param {{
 *   status?: number | null,
 *   errorKind?: string,
 *   attempt: number,
 *   maxAttempts: number,
 *   retryAtMs?: number | null,
 *   nowMs: number,
 *   budgetEndsMs?: number | null,
 * }} input
 * @returns {{ retry: boolean, defer: boolean, reason: string, retryAtMs: number | null }}
 */
export function retryDecision(input) {
  const status = typeof input.status === "number" ? input.status : null;
  const errorKind = input.errorKind || "none";
  const transient =
    status === 429 ||
    status === 503 ||
    errorKind === "timeout" ||
    errorKind === "dns";
  const retryAtMs =
    typeof input.retryAtMs === "number" ? input.retryAtMs : null;

  if (!transient || input.attempt >= input.maxAttempts) {
    return {
      retry: false,
      defer: status === 429 || status === 503,
      reason: transient ? "retry-exhausted" : "not-transient",
      retryAtMs,
    };
  }

  if (
    retryAtMs !== null &&
    typeof input.budgetEndsMs === "number" &&
    retryAtMs > input.budgetEndsMs
  ) {
    return {
      retry: false,
      defer: true,
      reason: "delay-exceeds-budget",
      retryAtMs,
    };
  }

  return {
    retry: true,
    defer: false,
    reason: "retry",
    retryAtMs,
  };
}
