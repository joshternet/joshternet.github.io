/**
 * Goal: umami-events.js classifies outbound/internal links and inbound
 * referrers, queues until umami.track exists, and never throws without Umami.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = await readFile(
  fileURLToPath(new URL("../../assets/js/umami-events.js", import.meta.url)),
  "utf8",
);

/**
 * Loads the classic helper against a fake window location.
 * @param {{
 *   pathname?: string,
 *   origin?: string,
 *   referrer?: string,
 *   memberHosts?: string[],
 *   umami?: { track: Function },
 *   autoInit?: boolean,
 * }} [options]
 * @returns {{
 *   joshternetTrack: Function,
 *   joshternetLinkEventFromHref: Function,
 *   joshternetInboundArrivalFromReferrer: Function,
 *   umami?: { track: Function },
 *   context: object,
 * }}
 */
function loadHelper(options = {}) {
  const pathname = options.pathname || "/network/";
  const origin = options.origin || "https://joshternet.org";
  const memberHosts = options.memberHosts || [];
  const listeners = new Map();

  const document = {
    readyState: options.autoInit === false ? "loading" : "complete",
    referrer: options.referrer || "",
    /**
     * @param {string} id
     * @returns {{ textContent: string } | null}
     */
    getElementById(id) {
      if (id !== "joshternet-member-hosts") {
        return null;
      }

      return { textContent: JSON.stringify(memberHosts) };
    },
    /**
     * @param {string} type
     * @param {Function} handler
     * @returns {void}
     */
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
  };

  const context = {
    URL,
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    location: {
      pathname,
      origin,
    },
    document,
    umami: options.umami,
  };

  runInNewContext(source, context);

  if (options.autoInit === false) {
    const readyHandlers = listeners.get("DOMContentLoaded") || [];

    for (const handler of readyHandlers) {
      handler();
    }
  }

  return {
    joshternetTrack: context.joshternetTrack,
    joshternetLinkEventFromHref: context.joshternetLinkEventFromHref,
    joshternetInboundArrivalFromReferrer:
      context.joshternetInboundArrivalFromReferrer,
    umami: context.umami,
    context,
  };
}

/**
 * deepStrictEqual fails across vm realms; compare JSON shapes instead.
 * @param {unknown} actual
 * @param {unknown} expected
 * @returns {void}
 */
function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

test("classifies outbound https clicks with host, path, and campaign", () => {
  const { joshternetLinkEventFromHref } = loadHelper({
    pathname: "/topics/ai/",
  });
  const event = joshternetLinkEventFromHref(
    "https://safe.example/notes?utm_source=joshternet.org#top",
    "noopener",
  );

  assertJsonEqual(event, {
    name: "outbound-link-click",
    data: {
      host: "safe.example",
      path: "/notes",
      campaign: "topics",
    },
  });
});

test("classifies same-origin and relative links as internal", () => {
  const { joshternetLinkEventFromHref } = loadHelper({
    pathname: "/search/",
  });

  assertJsonEqual(
    joshternetLinkEventFromHref("https://joshternet.org/network/", null),
    {
      name: "internal-link-click",
      data: { path: "/network/", from: "/search/" },
    },
  );
  assertJsonEqual(joshternetLinkEventFromHref("/wander/", null), {
    name: "internal-link-click",
    data: { path: "/wander/", from: "/search/" },
  });
});

test("skips rel=me, mailto, and hash-only links", () => {
  const { joshternetLinkEventFromHref } = loadHelper();

  assert.equal(
    joshternetLinkEventFromHref("https://github.com/joshternet", "me noopener"),
    null,
  );
  assert.equal(
    joshternetLinkEventFromHref("mailto:hello@joshternet.org", null),
    null,
  );
  assert.equal(joshternetLinkEventFromHref("#main-content", null), null);
});

test("umami-events skips dedicated join CTA link tracking via data attribute", async () => {
  const source = await readFile(
    fileURLToPath(new URL("../../assets/js/umami-events.js", import.meta.url)),
    "utf8",
  );

  assert.match(source, /data-joshternet-skip-link-track/);
});

test("inbound-arrival classifies member, other, and skips direct or same-origin", () => {
  const { joshternetInboundArrivalFromReferrer } = loadHelper({
    memberHosts: ["joshuamorris.info", "www.joshcanhelp.com"],
  });
  const hosts = new Set(["joshuamorris.info", "joshcanhelp.com"]);

  assertJsonEqual(
    joshternetInboundArrivalFromReferrer(
      "https://www.joshuamorris.info/notes/",
      { origin: "https://joshternet.org" },
      hosts,
    ),
    { host: "www.joshuamorris.info", kind: "member" },
  );
  assertJsonEqual(
    joshternetInboundArrivalFromReferrer(
      "https://news.example/story",
      { origin: "https://joshternet.org" },
      hosts,
    ),
    { host: "news.example", kind: "other" },
  );
  assert.equal(
    joshternetInboundArrivalFromReferrer(
      "",
      { origin: "https://joshternet.org" },
      hosts,
    ),
    null,
  );
  assert.equal(
    joshternetInboundArrivalFromReferrer(
      "https://joshternet.org/network/",
      { origin: "https://joshternet.org" },
      hosts,
    ),
    null,
  );
});

test("joshternetTrack no-ops safely when umami is missing", () => {
  const { joshternetTrack } = loadHelper({ umami: undefined });

  assert.doesNotThrow(() => {
    joshternetTrack("outbound-link-click", { host: "safe.example" });
  });
});

test("joshternetTrack flushes the queue when umami appears", async () => {
  const calls = [];
  const { joshternetTrack, context } = loadHelper({ umami: undefined });

  joshternetTrack("search-query", {
    has_query: true,
    result_count: 2,
    type: "all",
  });

  context.umami = {
    /**
     * @param {string} name
     * @param {Record<string, unknown>} [data]
     * @returns {void}
     */
    track(name, data) {
      calls.push({ name, data });
    },
  };

  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, 120);
  });

  assertJsonEqual(calls, [
    {
      name: "search-query",
      data: { has_query: true, result_count: 2, type: "all" },
    },
  ]);
});

test("inbound-arrival fires once on init for a cross-origin member referrer", () => {
  const calls = [];
  loadHelper({
    referrer: "https://joshuamorris.info/",
    memberHosts: ["joshuamorris.info"],
    umami: {
      /**
       * @param {string} name
       * @param {Record<string, unknown>} [data]
       * @returns {void}
       */
      track(name, data) {
        calls.push({ name, data });
      },
    },
  });

  assertJsonEqual(calls, [
    {
      name: "inbound-arrival",
      data: { host: "joshuamorris.info", kind: "member" },
    },
  ]);
});
