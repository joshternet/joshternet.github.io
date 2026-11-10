/**
 * Goal & Constraints:
 * Central fetch broker for coordinated observation runs. Adapters discover and
 * request resources; they never fetch independently. Dedup, robots, budgets,
 * caching, and source retention live here.
 */

import {
  createResourceObservation,
  outcomeMayRetainBody,
} from "./resource-observation.mjs";
import { persistVerifiedSourceBlob } from "./source-store.mjs";

/**
 * @typedef {object} FetchRequest
 * @property {string} url
 * @property {string} [discovery_reason]
 * @property {string} [member_origin]
 * @property {'semantic'|'operational'} [retention_class]
 * @property {string} [coverage]
 */

/**
 * @typedef {object} FetchBrokerOptions
 * @property {string} observation_run_id
 * @property {string} member_origin
 * @property {import('./source-store.mjs').SourceStore} sourceStore
 * @property {import('./observation-store.mjs').ObservationStore} observationStore
 * @property {(url: string, init?: object) => Promise<{
 *   ok: boolean,
 *   status: number,
 *   url: string,
 *   headers?: Headers|Record<string,string>,
 *   body?: string,
 *   error?: Error,
 *   deferred?: boolean,
 *   robots_decision?: string,
 *   unchanged?: boolean,
 * }>} [fetchImpl]
 * @property {number} [maxFetches]
 */

/**
 * Creates a per-member fetch broker for one observation run.
 * @param {FetchBrokerOptions} options
 */
export function createFetchBroker(options) {
  const runId = String(options.observation_run_id || "");
  const memberOrigin = String(options.member_origin || "");
  const maxFetches =
    Number.isFinite(options.maxFetches) && options.maxFetches > 0
      ? Math.floor(options.maxFetches)
      : Number.POSITIVE_INFINITY;

  /** @type {Map<string, import('./resource-observation.mjs').ResourceObservation>} */
  const byUrl = new Map();
  /** @type {FetchRequest[]} */
  const queue = [];
  let fetchCount = 0;
  let budgetExhausted = false;

  /**
   * @param {string} url
   * @returns {string}
   */
  function normalizeUrl(url) {
    const parsed = new URL(String(url || ""), memberOrigin);
    parsed.hash = "";
    return parsed.href;
  }

  /**
   * Enqueues a resource request. Duplicate URLs in the same run are ignored.
   * @param {FetchRequest} request
   * @returns {{ queued: boolean, reason: string }}
   */
  function request(request) {
    const url = normalizeUrl(request.url);
    if (byUrl.has(url)) {
      return { queued: false, reason: "already-fetched" };
    }
    if (queue.some((row) => normalizeUrl(row.url) === url)) {
      return { queued: false, reason: "already-queued" };
    }
    if (budgetExhausted || fetchCount >= maxFetches) {
      budgetExhausted = true;
      return { queued: false, reason: "budget-exhausted" };
    }
    queue.push({
      ...request,
      url,
      member_origin: request.member_origin || memberOrigin,
    });
    return { queued: true, reason: "queued" };
  }

  /**
   * @param {Headers|Record<string,string>|undefined} headers
   * @param {string} name
   * @returns {string}
   */
  function headerValue(headers, name) {
    if (!headers) {
      return "";
    }
    if (typeof headers.get === "function") {
      return String(headers.get(name) || "");
    }
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lower) {
        return String(value || "");
      }
    }
    return "";
  }

  /**
   * Drains the queue once. Newly discovered URLs should be requested between rounds.
   * @returns {Promise<import('./resource-observation.mjs').ResourceObservation[]>}
   */
  async function drain() {
    /** @type {import('./resource-observation.mjs').ResourceObservation[]} */
    const produced = [];
    while (queue.length > 0) {
      if (fetchCount >= maxFetches) {
        budgetExhausted = true;
        const deferred = queue.splice(0, queue.length);
        for (const item of deferred) {
          const observation = createResourceObservation({
            observation_run_id: runId,
            member_origin: item.member_origin || memberOrigin,
            requested_url: item.url,
            outcome: "budget_exhausted",
            defer_reason: "crawl budget exhausted",
            discovery_reason: item.discovery_reason || "adapter-request",
            coverage: "incomplete",
            retention_class: item.retention_class || "operational",
          });
          await options.observationStore.appendResourceObservation(observation);
          byUrl.set(item.url, observation);
          produced.push(observation);
        }
        break;
      }

      const item = queue.shift();
      if (!item) {
        break;
      }
      const url = normalizeUrl(item.url);
      if (byUrl.has(url)) {
        continue;
      }
      fetchCount += 1;

      let response;
      try {
        response = await (options.fetchImpl
          ? options.fetchImpl(url)
          : defaultUnavailableFetch(url));
      } catch (error) {
        response = {
          ok: false,
          status: 0,
          url,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }

      const observation = await materializeObservation({
        item,
        url,
        response,
        runId,
        memberOrigin,
        sourceStore: options.sourceStore,
      });
      await options.observationStore.appendResourceObservation(observation);
      byUrl.set(url, observation);
      produced.push(observation);
    }
    return produced;
  }

  return {
    request,
    drain,
    /**
     * @param {string} url
     * @returns {import('./resource-observation.mjs').ResourceObservation|undefined}
     */
    get(url) {
      return byUrl.get(normalizeUrl(url));
    },
    /**
     * @returns {import('./resource-observation.mjs').ResourceObservation[]}
     */
    list() {
      return [...byUrl.values()];
    },
    /**
     * @returns {boolean}
     */
    isBudgetExhausted() {
      return budgetExhausted;
    },
    /**
     * @returns {number}
     */
    pendingCount() {
      return queue.length;
    },
    headerValue,
  };
}

/**
 * @param {string} url
 * @returns {Promise<never>}
 */
async function defaultUnavailableFetch(url) {
  throw new Error(
    `fetch broker has no fetchImpl configured for ${url}; adapters must not fetch directly`,
  );
}

/**
 * @param {object} input
 * @returns {Promise<import('./resource-observation.mjs').ResourceObservation>}
 */
async function materializeObservation(input) {
  const { item, url, response, runId, memberOrigin, sourceStore } = input;
  if (response.deferred) {
    return createResourceObservation({
      observation_run_id: runId,
      member_origin: memberOrigin,
      requested_url: url,
      final_url: response.url || url,
      outcome: "deferred",
      defer_reason: String(response.robots_decision || "deferred"),
      robots_decision: response.robots_decision,
      http_status: response.status || null,
      discovery_reason: item.discovery_reason || "adapter-request",
      coverage: "incomplete",
      retention_class: item.retention_class || "operational",
    });
  }
  if (response.robots_decision === "disallow") {
    return createResourceObservation({
      observation_run_id: runId,
      member_origin: memberOrigin,
      requested_url: url,
      final_url: response.url || url,
      outcome: "robots_disallowed",
      robots_decision: "disallow",
      http_status: response.status || null,
      discovery_reason: item.discovery_reason || "adapter-request",
      coverage: "incomplete",
      retention_class: item.retention_class || "operational",
    });
  }
  if (response.unchanged) {
    return createResourceObservation({
      observation_run_id: runId,
      member_origin: memberOrigin,
      requested_url: url,
      final_url: response.url || url,
      outcome: "unchanged",
      http_status: response.status || 304,
      content_unchanged: true,
      discovery_reason: item.discovery_reason || "adapter-request",
      coverage: "complete",
      retention_class: item.retention_class || "operational",
    });
  }
  if (response.error) {
    const message = response.error.message || String(response.error);
    let outcome = "network_failure";
    if (/timeout|abort/i.test(message)) {
      outcome = "timeout";
    } else if (/ENOTFOUND|dns/i.test(message)) {
      outcome = "dns_failure";
    } else if (/TLS|certificate/i.test(message)) {
      outcome = "tls_failure";
    }
    return createResourceObservation({
      observation_run_id: runId,
      member_origin: memberOrigin,
      requested_url: url,
      final_url: response.url || url,
      outcome,
      failure_reason: message,
      http_status: response.status || null,
      discovery_reason: item.discovery_reason || "adapter-request",
      coverage: "incomplete",
      retention_class: item.retention_class || "operational",
    });
  }
  if (!response.ok) {
    return createResourceObservation({
      observation_run_id: runId,
      member_origin: memberOrigin,
      requested_url: url,
      final_url: response.url || url,
      outcome: "http_failure",
      failure_reason: `HTTP ${response.status}`,
      http_status: response.status,
      discovery_reason: item.discovery_reason || "adapter-request",
      coverage: "incomplete",
      retention_class: item.retention_class || "operational",
    });
  }

  const contentType = headerGet(response.headers, "content-type");
  if (
    contentType &&
    !/^(text\/|application\/(json|xml|atom|rss|opml)|.*\+xml)/i.test(
      contentType,
    )
  ) {
    return createResourceObservation({
      observation_run_id: runId,
      member_origin: memberOrigin,
      requested_url: url,
      final_url: response.url || url,
      outcome: "content_type_rejected",
      failure_reason: contentType,
      content_type: contentType,
      http_status: response.status,
      discovery_reason: item.discovery_reason || "adapter-request",
      coverage: "incomplete",
      retention_class: item.retention_class || "operational",
    });
  }

  let sourceHash;
  if (outcomeMayRetainBody("success") && typeof response.body === "string") {
    sourceHash = await persistVerifiedSourceBlob(sourceStore, response.body);
  }

  return createResourceObservation({
    observation_run_id: runId,
    member_origin: memberOrigin,
    requested_url: url,
    final_url: response.url || url,
    outcome: "success",
    content_type: contentType,
    http_status: response.status,
    etag: headerGet(response.headers, "etag"),
    last_modified: headerGet(response.headers, "last-modified"),
    source_hash: sourceHash,
    discovery_reason: item.discovery_reason || "adapter-request",
    coverage: item.coverage || "complete",
    retention_class: item.retention_class || "semantic",
  });
}

/**
 * @param {Headers|Record<string,string>|undefined} headers
 * @param {string} name
 * @returns {string}
 */
function headerGet(headers, name) {
  if (!headers) {
    return "";
  }
  if (typeof headers.get === "function") {
    return String(headers.get(name) || "");
  }
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      return String(value || "");
    }
  }
  return "";
}
