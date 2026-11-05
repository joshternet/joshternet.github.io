/**
 * Goal & Constraints:
 * The only retry owner for a member fetch. fetchPublicText stays one attempt
 * so a scheduler cannot multiply retries on top of this helper.
 */

import { fetchPublicText } from "./lib.mjs";
import {
  classifyTransportError,
  parseRetryAfter,
  retryDecision,
} from "./fetch-outcome.mjs";

/**
 * @param {string} href
 * @param {object} [options]
 * @param {number} [options.maxAttempts]
 * @param {number} [options.budgetMs]
 * @param {number} [options.budgetEndsMs]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.now]
 * @returns {Promise<object>}
 */
/**
 * Waits for a retry delay. Tests pass a substitute.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleepMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchMemberText(href, options = {}) {
  const maxAttempts =
    typeof options.maxAttempts === "number" && options.maxAttempts > 0
      ? options.maxAttempts
      : 2;
  const now = options.now || Date.now;
  const sleep = options.sleep || sleepMs;
  const budgetEndsMs =
    typeof options.budgetEndsMs === "number"
      ? options.budgetEndsMs
      : now() +
        (typeof options.budgetMs === "number" ? options.budgetMs : 30_000);

  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await fetchPublicText(href, {
        ...options,
        captureHttpErrors: true,
      });
      const retryAtMs = parseRetryAfter(result.retry_after, now());
      const decision = retryDecision({
        status: result.status,
        errorKind: "none",
        attempt,
        maxAttempts,
        retryAtMs,
        nowMs: now(),
        budgetEndsMs,
      });

      if (decision.retry) {
        const wait = Math.max(0, (decision.retryAtMs ?? now()) - now());
        await sleep(wait);
        continue;
      }

      if (decision.defer) {
        return {
          ...result,
          deferred: true,
          retry_at:
            decision.retryAtMs === null
              ? ""
              : new Date(decision.retryAtMs).toISOString(),
        };
      }

      if (result.status >= 400) {
        throw new Error(`HTTP ${result.status} for ${href}`);
      }

      if (result.body_complete === false) {
        throw new Error(`incomplete body for ${href}`);
      }

      return result;
    } catch (error) {
      if (
        error instanceof Error &&
        (/^HTTP \d+/.test(error.message) ||
          error.message.startsWith("incomplete body"))
      ) {
        throw error;
      }
      const decision = retryDecision({
        status: null,
        errorKind: classifyTransportError(error),
        attempt,
        maxAttempts,
        retryAtMs: null,
        nowMs: now(),
        budgetEndsMs,
      });
      if (!decision.retry) {
        throw error;
      }
      await sleep(0);
    }
  }
}
