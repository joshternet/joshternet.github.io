/**
 * Goal & Constraints: Abortable enrichment budget so SITE_TIMEOUT stops identity
 * slash probes cleanly and still returns partial enrichment instead of failing
 * the whole participant refresh. Inputs: timeout ms, label, async work(signal).
 * Outputs: work result (including post-abort partials). Hard-rejects only when
 * work ignores abort past a short grace window. Acceptance: soft abort before
 * reject; identity loops honor signal; closed-browser after abort is quiet stop;
 * sync “keep” path can apply partial feeds/elsewhere/connections.
 */

/**
 * Grace after soft abort before treating hung work as a hard failure (ms).
 * Bounded so a short test budget still gets a meaningful settle window.
 * @param {number} timeoutMS
 * @returns {number}
 */
export function enrichmentAbortGraceMS(timeoutMS) {
  const budget = Math.max(0, Number(timeoutMS) || 0);
  return Math.min(10_000, Math.max(1_000, budget));
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isEnrichmentAbortError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";

  if (name === "AbortError") {
    return true;
  }

  return (
    /aborted|AbortError/i.test(message) ||
    /Target (page|context|browser) has been closed/i.test(message) ||
    /browser has been closed/i.test(message)
  );
}

/**
 * Whether identity-page probing should stop (deadline fired or caller aborted).
 * @param {AbortSignal | null | undefined} signal
 * @returns {boolean}
 */
export function enrichmentBudgetExhausted(signal) {
  return Boolean(signal?.aborted);
}

/**
 * Runs enrichment work under a shared AbortSignal.
 * Soft deadline: abort the signal so nested identity probes stop and return
 * whatever was collected. Hard ceiling: if work ignores abort, reject so sync
 * cannot hang forever (`${label} exceeded ${timeoutMS}ms`).
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} work - Async enrichment; must honor signal.
 * @param {number} timeoutMS - Soft budget in milliseconds.
 * @param {string} label - Included in the hard-timeout Error message.
 * @returns {Promise<T>}
 * @throws {Error} Only when work ignores abort past the grace window.
 */
export async function runWithEnrichmentBudget(work, timeoutMS, label) {
  const controller = new AbortController();
  const budgetMS = Math.max(0, Number(timeoutMS) || 0);
  const graceMS = enrichmentAbortGraceMS(budgetMS);
  let softTimer;
  let hardTimer;

  const workPromise = Promise.resolve().then(() => work(controller.signal));

  softTimer = setTimeout(() => {
    controller.abort();
  }, budgetMS);

  const hardPromise = new Promise((_, reject) => {
    hardTimer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${budgetMS}ms`));
    }, budgetMS + graceMS);
  });

  try {
    return await Promise.race([workPromise, hardPromise]);
  } finally {
    clearTimeout(softTimer);
    clearTimeout(hardTimer);
    // Hard-path reject can leave work running; swallow a late rejection.
    void workPromise.catch(() => {});
  }
}

/**
 * Visits identity URLs with an optional abort budget. Stops immediately when
 * the signal aborts or a closed-browser/abort error occurs after cancel.
 * @param {string[]} identityHrefs - Absolute same-origin identity page URLs.
 * @param {(href: string, signal: AbortSignal | undefined) => Promise<void>} visit - Per-URL visitor.
 * @param {{
 *   signal?: AbortSignal,
 *   onVisitError?: (href: string, error: Error) => void,
 * }} [options]
 * @returns {Promise<{ visited: number, stoppedEarly: boolean }>}
 */
export async function visitIdentityPages(identityHrefs, visit, options = {}) {
  const signal = options.signal;
  const onVisitError = options.onVisitError;
  let visited = 0;
  let stoppedEarly = false;

  for (const href of identityHrefs) {
    if (enrichmentBudgetExhausted(signal)) {
      stoppedEarly = true;
      break;
    }

    try {
      await visit(href, signal);

      if (enrichmentBudgetExhausted(signal)) {
        stoppedEarly = true;
        break;
      }

      visited += 1;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (enrichmentBudgetExhausted(signal) || isEnrichmentAbortError(err)) {
        stoppedEarly = true;
        break;
      }

      if (typeof onVisitError === "function") {
        onVisitError(href, err);
      }
    }
  }

  return { visited, stoppedEarly };
}
