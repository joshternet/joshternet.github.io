/**
 * Goal & Constraints:
 * Privacy-safe Umami custom events for outbound/internal link clicks,
 * inbound referrer classification, and thin UI hooks via joshternetTrack.
 * Never send search query text, form fields, or other PII. No-ops when
 * window.umami is absent. Does not change UTM decoration or pageviews.
 */
(() => {
  const QUEUE_FLUSH_MS = 50;
  const QUEUE_GIVE_UP_MS = 10000;
  const MEMBER_HOSTS_ID = "joshternet-member-hosts";

  /** @type {Array<{ name: string, data?: Record<string, string | number | boolean> }>} */
  const queue = [];
  /** @type {ReturnType<typeof setInterval> | null} */
  let flushTimer = null;
  /** @type {Set<string>} */
  let memberHosts = new Set();
  let arrivalSent = false;

  /**
   * Lowercases and strips a leading www. for host comparison.
   * @param {string} host
   * @returns {string}
   */
  function normalizeHost(host) {
    return String(host || "")
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
  }

  /**
   * First path segment for campaign, or "home".
   * @param {string} pathname
   * @returns {string}
   */
  function campaignFromPath(pathname) {
    const parts = String(pathname || "/")
      .split("/")
      .filter(Boolean);

    return parts[0] || "home";
  }

  /**
   * True when rel includes the me token (IndieWeb identity URLs).
   * @param {string | null | undefined} rel
   * @returns {boolean}
   */
  function relIncludesMe(rel) {
    return String(rel || "")
      .split(/\s+/)
      .includes("me");
  }

  /**
   * Reads member hostnames from the build-time JSON blob in the layout.
   * @param {Document | null | undefined} doc
   * @returns {Set<string>}
   */
  function loadMemberHosts(doc) {
    const hosts = new Set();
    const root = doc || globalThis.document;

    if (!root || typeof root.getElementById !== "function") {
      return hosts;
    }

    const node = root.getElementById(MEMBER_HOSTS_ID);

    if (!node || !node.textContent) {
      return hosts;
    }

    try {
      const parsed = JSON.parse(node.textContent);

      if (!Array.isArray(parsed)) {
        return hosts;
      }

      for (const value of parsed) {
        const normalized = normalizeHost(String(value || ""));

        if (normalized) {
          hosts.add(normalized);
        }
      }
    } catch {
      return hosts;
    }

    return hosts;
  }

  /**
   * Sends or queues a named Umami event with optional data.
   * @param {string} name
   * @param {Record<string, string | number | boolean>} [data]
   * @returns {void}
   */
  function joshternetTrack(name, data) {
    const eventName = String(name || "").trim();

    if (!eventName) {
      return;
    }

    const payload =
      data && typeof data === "object" && !Array.isArray(data)
        ? data
        : undefined;

    const umami = globalThis.umami;

    if (umami && typeof umami.track === "function") {
      if (payload) {
        umami.track(eventName, payload);
      } else {
        umami.track(eventName);
      }

      return;
    }

    queue.push(
      payload ? { name: eventName, data: payload } : { name: eventName },
    );
    startFlushTimer();
  }

  /**
   * Flushes queued events once umami.track is available.
   * @returns {void}
   */
  function flushQueue() {
    const umami = globalThis.umami;

    if (!umami || typeof umami.track !== "function") {
      return;
    }

    while (queue.length > 0) {
      const item = queue.shift();

      if (!item) {
        continue;
      }

      if (item.data) {
        umami.track(item.name, item.data);
      } else {
        umami.track(item.name);
      }
    }

    stopFlushTimer();
  }

  /**
   * @returns {void}
   */
  function stopFlushTimer() {
    if (flushTimer !== null) {
      globalThis.clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  /**
   * Polls briefly for the deferred Umami script.
   * @returns {void}
   */
  function startFlushTimer() {
    if (flushTimer !== null) {
      return;
    }

    const started = Date.now();

    flushTimer = globalThis.setInterval(() => {
      flushQueue();

      if (queue.length === 0 || Date.now() - started >= QUEUE_GIVE_UP_MS) {
        stopFlushTimer();
        queue.length = 0;
      }
    }, QUEUE_FLUSH_MS);
  }

  /**
   * Classifies an anchor href for link-click events.
   * @param {string} href
   * @param {string | null | undefined} rel
   * @param {{ pathname?: string, origin?: string }} [here]
   * @returns {{ name: string, data: Record<string, string> } | null}
   */
  function joshternetLinkEventFromHref(href, rel, here = {}) {
    const raw = String(href || "").trim();

    if (!raw || raw.startsWith("#")) {
      return null;
    }

    const location = {
      pathname: here.pathname || globalThis.location?.pathname || "/",
      origin: here.origin || globalThis.location?.origin || "",
    };

    let url;

    try {
      url = new URL(raw, location.origin || "https://joshternet.org");
    } catch {
      return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    const sameOrigin =
      Boolean(location.origin) && url.origin === location.origin;

    if (sameOrigin) {
      return {
        name: "internal-link-click",
        data: {
          path: url.pathname,
          from: location.pathname || "/",
        },
      };
    }

    if (relIncludesMe(rel)) {
      return null;
    }

    return {
      name: "outbound-link-click",
      data: {
        host: url.hostname,
        path: url.pathname,
        campaign: campaignFromPath(location.pathname),
      },
    };
  }

  /**
   * Classifies document.referrer for a one-shot inbound-arrival event.
   * @param {string} referrer
   * @param {{ origin?: string }} [here]
   * @param {Set<string>} [hosts]
   * @returns {{ host: string, kind: "member" | "other" } | null}
   */
  function joshternetInboundArrivalFromReferrer(
    referrer,
    here = {},
    hosts = memberHosts,
  ) {
    const raw = String(referrer || "").trim();

    if (!raw) {
      return null;
    }

    let url;

    try {
      url = new URL(raw);
    } catch {
      return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    const origin = here.origin || globalThis.location?.origin || "";

    if (origin && url.origin === origin) {
      return null;
    }

    const host = url.hostname;
    const kind = hosts.has(normalizeHost(host)) ? "member" : "other";

    return { host, kind };
  }

  /**
   * Handles delegated link clicks on the document.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function onDocumentClick(event) {
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }

    const target = event.target;

    if (!target || typeof target.closest !== "function") {
      return;
    }

    const anchor = target.closest("a[href]");

    if (!anchor) {
      return;
    }

    if (anchor.hasAttribute("data-joshternet-skip-link-track")) {
      return;
    }

    const classified = joshternetLinkEventFromHref(
      anchor.getAttribute("href") || "",
      anchor.getAttribute("rel"),
    );

    if (!classified) {
      return;
    }

    joshternetTrack(classified.name, classified.data);
  }

  /**
   * Fires inbound-arrival once when the referrer is cross-origin.
   * @returns {void}
   */
  function maybeTrackInboundArrival() {
    if (arrivalSent) {
      return;
    }

    arrivalSent = true;

    const classified = joshternetInboundArrivalFromReferrer(
      globalThis.document?.referrer || "",
    );

    if (!classified) {
      return;
    }

    joshternetTrack("inbound-arrival", classified);
  }

  /**
   * Binds listeners and loads member hosts.
   * @returns {void}
   */
  function init() {
    memberHosts = loadMemberHosts(globalThis.document);
    maybeTrackInboundArrival();

    const documentRef = globalThis.document;

    if (documentRef && typeof documentRef.addEventListener === "function") {
      documentRef.addEventListener("click", onDocumentClick, true);
    }

    flushQueue();

    if (queue.length > 0) {
      startFlushTimer();
    }
  }

  globalThis.joshternetTrack = joshternetTrack;
  globalThis.joshternetLinkEventFromHref = joshternetLinkEventFromHref;
  globalThis.joshternetInboundArrivalFromReferrer =
    joshternetInboundArrivalFromReferrer;

  const documentRef = globalThis.document;

  if (documentRef) {
    if (documentRef.readyState === "loading") {
      documentRef.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }
})();
