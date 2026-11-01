/**
 * Goal: Cover feed path probes for indie sites without rel=alternate feeds.
 * Offline only — inject fetchImpl; never hit the network.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMON_FEED_PATHS,
  FEED_PROBE_WHEN_BELOW,
  probeCommonFeedPaths,
  sniffFeedType,
} from "../../scripts/network/feed-probes.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

test("COMMON_FEED_PATHS lists indie defaults", () => {
  assert.ok(COMMON_FEED_PATHS.includes("/feed/"));
  assert.ok(COMMON_FEED_PATHS.includes("/rss.xml"));
  assert.ok(COMMON_FEED_PATHS.includes("/atom.xml"));
  assert.ok(COMMON_FEED_PATHS.includes("/index.xml"));
  assert.equal(FEED_PROBE_WHEN_BELOW, 1);
});

test("sniffFeedType: recognizes RSS, Atom, and JSON Feed", () => {
  assert.equal(sniffFeedType("application/rss+xml", ""), "application/rss+xml");
  assert.equal(
    sniffFeedType("application/atom+xml", ""),
    "application/atom+xml",
  );
  assert.equal(
    sniffFeedType("application/feed+json", ""),
    "application/feed+json",
  );
  assert.equal(
    sniffFeedType("text/xml", '<rss version="2.0"><channel></channel></rss>'),
    "application/rss+xml",
  );
  assert.equal(
    sniffFeedType(
      "application/xml",
      '<feed xmlns="http://www.w3.org/2005/Atom"><entry></entry></feed>',
    ),
    "application/atom+xml",
  );
  assert.equal(
    sniffFeedType(
      "text/plain",
      '{"version":"https://jsonfeed.org/version/1","items":[]}',
    ),
    "application/feed+json",
  );
  assert.equal(
    sniffFeedType("application/json", '{"version":"1","items":[]}'),
    "application/json",
  );
  assert.equal(sniffFeedType("text/html", "<html></html>"), "");
  assert.equal(
    sniffFeedType(/** @type {any} */ (null), /** @type {any} */ (null)),
    "",
  );
  assert.equal(sniffFeedType(undefined, undefined), "");
});

test("probeCommonFeedPaths: skips probing when feeds already exist", async () => {
  const existing = [
    {
      url: "https://a.example/feed.xml",
      type: "application/rss+xml",
    },
  ];
  let fetches = 0;
  const result = await probeCommonFeedPaths("https://a.example", existing, {
    cache: dnsCache(["a.example"]),
    fetchImpl: async () => {
      fetches += 1;
      throw new Error("should not fetch");
    },
  });
  assert.deepEqual(result, existing);
  assert.equal(fetches, 0);
});

test("probeCommonFeedPaths: discovers /rss.xml when homepage has no feeds", async () => {
  const cache = dnsCache(["a.example"]);
  let fetches = 0;
  const result = await probeCommonFeedPaths("https://a.example", null, {
    cache,
    paths: ["/rss.xml", "/atom.xml"],
    fetchImpl: async (url) => {
      fetches += 1;
      const href = String(url);
      if (href.endsWith("/rss.xml")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/xml" }),
          arrayBuffer: async () =>
            Buffer.from('<rss version="2.0"><channel></channel></rss>'),
        };
      }
      throw new Error("should stop after first feed");
    },
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://a.example/rss.xml");
  assert.equal(result[0].type, "application/rss+xml");
  assert.equal(fetches, 1);
});

test("probeCommonFeedPaths: uses global fetch when fetchImpl omitted", async () => {
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async (url) => {
      assert.match(String(url), /\/feed\/$/);
      return {
        ok: false,
        status: 404,
        headers: new Headers(),
        arrayBuffer: async () => Buffer.from(""),
      };
    };
    const result = await probeCommonFeedPaths("https://a.example", [], {
      cache,
      paths: ["/feed/"],
    });
    assert.deepEqual(result, []);
  } finally {
    restore();
  }
});

test("probeCommonFeedPaths: ignores non-feed responses", async () => {
  const result = await probeCommonFeedPaths("https://a.example", [], {
    cache: dnsCache(["a.example"]),
    paths: ["/rss.xml"],
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: async () =>
        Buffer.from("<html><body>not a feed</body></html>"),
    }),
  });
  assert.deepEqual(result, []);
});

test("sniffFeedType: RDF RSS and Atom feed tags", () => {
  assert.equal(
    sniffFeedType(
      "text/xml",
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF>',
    ),
    "application/rss+xml",
  );
  assert.equal(
    sniffFeedType("text/xml", "<feed><title>x</title></feed>"),
    "application/atom+xml",
  );
});

test("probeCommonFeedPaths: fetch errors and private hosts are skipped", async () => {
  const cache = dnsCache(["a.example"]);
  const result = await probeCommonFeedPaths("https://a.example", [], {
    cache,
    paths: ["/rss.xml", "http://127.0.0.1/rss.xml", "://bad"],
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.deepEqual(result, []);

  const withAtom = await probeCommonFeedPaths("https://a.example", [], {
    cache,
    paths: ["/atom.xml"],
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers({}),
      arrayBuffer: async () =>
        Buffer.from(
          '<feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>',
        ),
    }),
  });
  assert.equal(withAtom.length, 1);
  assert.equal(withAtom[0].type, "application/atom+xml");
});

test("probeCommonFeedPaths: empty paths fall back to COMMON_FEED_PATHS", async () => {
  const cache = dnsCache(["a.example"]);
  const seen = [];
  await probeCommonFeedPaths("https://a.example", [], {
    cache,
    paths: [],
    fetchImpl: async (url) => {
      seen.push(String(url));
      return {
        ok: false,
        status: 404,
        headers: new Headers(),
        arrayBuffer: async () => Buffer.from(""),
      };
    },
  });
  assert.ok(seen.some((href) => href.endsWith("/feed/")));
  assert.ok(seen.some((href) => href.endsWith("/rss.xml")));
});

test("probeCommonFeedPaths: omits cache and uses default Map", async () => {
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/rss+xml" }),
      arrayBuffer: async () =>
        Buffer.from('<rss version="2.0"><channel></channel></rss>'),
    });
    const result = await probeCommonFeedPaths("https://example.com", [], {
      paths: ["/rss.xml"],
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchImpl: globalThis.fetch,
    });
    assert.equal(result.length, 1);
  } finally {
    restore();
  }
});

test("probeCommonFeedPaths: timeout aborts a hung fetch", async () => {
  const cache = dnsCache(["a.example"]);
  const result = await probeCommonFeedPaths("https://a.example", [], {
    cache,
    paths: ["/rss.xml"],
    timeoutMs: 5,
    fetchImpl: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => {
            reject(new Error("aborted"));
          },
          { once: true },
        );
      }),
  });
  assert.deepEqual(result, []);
});
