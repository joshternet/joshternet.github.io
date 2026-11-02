/**
 * Goal: /.well-known/slashpages OPML reader stays SSRF-safe and same-origin only for seeds.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SLASHPAGES_INCLUDES,
  MAX_SLASHPAGES_OUTLINES,
  collectSlashpagesCrawlSeeds,
  fetchSlashpagesManifest,
  isSlashpagesIncludeOutline,
  parseSlashpagesOpml,
  slashpagesIncludeUrls,
  splitSlashpagesCategories,
} from "../../scripts/network/slashpages-manifest.mjs";
import { createOriginRobotsGate } from "../../scripts/nlp/origin-robots.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

test("splitSlashpagesCategories trims comma lists", () => {
  assert.deepEqual(splitSlashpagesCategories(""), []);
  assert.deepEqual(splitSlashpagesCategories("   "), []);
  assert.deepEqual(splitSlashpagesCategories(null), []);
  assert.deepEqual(splitSlashpagesCategories(" projects , music "), [
    "projects",
    "music",
  ]);
  assert.equal(isSlashpagesIncludeOutline("", null), false);
  assert.equal(
    isSlashpagesIncludeOutline("", "https://a.example/x.opml"),
    true,
  );
});

test("parseSlashpagesOpml rejects XXE-shaped documents and empty input", () => {
  assert.deepEqual(
    parseSlashpagesOpml("", { baseOrigin: "https://a.example" }),
    [],
  );
  assert.deepEqual(parseSlashpagesOpml("<opml></opml>", undefined), []);
  assert.deepEqual(
    parseSlashpagesOpml('<!DOCTYPE opml [<!ENTITY xxe "x">]><opml></opml>', {
      baseOrigin: "https://a.example",
    }),
    [],
  );
  assert.deepEqual(parseSlashpagesOpml("<opml></opml>", {}), []);
  assert.deepEqual(collectSlashpagesCrawlSeeds({ outlines: null }), []);
});

test("parseSlashpagesOpml keeps same-origin seeds and marks cross-origin", () => {
  const opml = `<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Projects" url="https://a.example/projects/" category="projects,apps" />
    <outline text="Friend" htmlUrl="https://other.example/now/" categories="now" />
    <outline text="Skip" url="javascript:alert(1)" />
    <outline title="Feed only" xmlUrl="https://a.example/feed.xml" />
    <outline />
    <outline text="Bad" url="http://[" />
    <outline text="Ftp" url="ftp://a.example/file" />
  </body>
</opml>`;
  const outlines = parseSlashpagesOpml(opml, {
    baseOrigin: "https://a.example",
  });
  assert.ok(outlines.length >= 2);
  assert.equal(outlines[0].same_origin, true);
  assert.deepEqual(outlines[0].categories, ["projects", "apps"]);
  assert.ok(outlines.some((row) => row.same_origin === false));
  assert.ok(outlines.some((row) => row.text === "Feed only"));
  assert.equal(
    outlines.some((row) => /ftp:/i.test(row.url) || row.text === "Bad"),
    false,
  );
});

test("parseSlashpagesOpml caps outlines at MAX_SLASHPAGES_OUTLINES", () => {
  const rows = Array.from(
    { length: MAX_SLASHPAGES_OUTLINES + 5 },
    (_item, index) =>
      `<outline text="P${index}" url="https://a.example/p/${index}/" />`,
  ).join("\n");
  const outlines = parseSlashpagesOpml(`<opml><body>${rows}</body></opml>`, {
    baseOrigin: "https://a.example",
  });
  assert.equal(outlines.length, MAX_SLASHPAGES_OUTLINES);
});

test("isSlashpagesIncludeOutline and slashpagesIncludeUrls", () => {
  assert.equal(
    isSlashpagesIncludeOutline("include", "https://a.example/x.opml"),
    true,
  );
  assert.equal(
    isSlashpagesIncludeOutline("", "https://a.example/extra.opml"),
    true,
  );
  assert.equal(
    isSlashpagesIncludeOutline("rss", "https://a.example/feed.xml"),
    false,
  );
  const opml = `<opml><body>
    <outline type="include" url="https://a.example/more.opml" />
    <outline type="rss" xmlUrl="https://a.example/feed.xml" />
  </body></opml>`;
  assert.deepEqual(slashpagesIncludeUrls(opml, "https://a.example"), [
    "https://a.example/more.opml",
  ]);
  assert.deepEqual(slashpagesIncludeUrls("", "https://a.example"), []);
});

test("collectSlashpagesCrawlSeeds only returns same-origin outline urls", () => {
  assert.deepEqual(collectSlashpagesCrawlSeeds(null), []);
  assert.deepEqual(
    collectSlashpagesCrawlSeeds({
      outlines: [
        {
          url: "https://a.example/projects/",
          text: "Projects",
          categories: [],
          same_origin: true,
        },
      ],
    }),
    ["https://a.example/projects/"],
  );
});

test("fetchSlashpagesManifest: invalid origin and robots disallow", async () => {
  const bad = await fetchSlashpagesManifest("not-a-url");
  assert.deepEqual(bad.errors, ["invalid_origin"]);

  const cache = dnsCache(["blocked.example"]);
  install();
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () =>
            Buffer.from("User-agent: *\nDisallow: /.well-known/\n"),
        };
      }
      throw new Error(`unexpected ${url}`);
    };
    const result = await fetchSlashpagesManifest("https://blocked.example", {
      cache,
    });
    assert.ok(result.errors.includes("robots_disallow"));
  } finally {
    restore();
  }
});

test("fetchSlashpagesManifest: parses same-origin seeds and ignores cross-origin for crawl", async () => {
  const cache = dnsCache(["studio.example", "other.example"]);
  install();
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from("User-agent: *\nAllow: /\n"),
        };
      }
      if (url.endsWith("/.well-known/slashpages")) {
        const body = `<?xml version="1.0"?>
<opml version="2.0"><body>
  <outline text="Work" url="https://studio.example/work.html" category="projects" />
  <outline text="Else" url="https://other.example/hi/" />
</body></opml>`;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/x-opml" }),
          arrayBuffer: async () => Buffer.from(body),
        };
      }
      throw new Error(`unexpected ${url}`);
    };
    const result = await fetchSlashpagesManifest("https://studio.example", {
      cache,
    });
    assert.deepEqual(collectSlashpagesCrawlSeeds(result), [
      "https://studio.example/work.html",
    ]);
    assert.equal(result.cross_origin.length, 1);
    assert.equal(result.cross_origin[0].url, "https://other.example/hi/");
  } finally {
    restore();
  }
});

test("fetchSlashpagesManifest: include loop detection and count cap", async () => {
  const cache = dnsCache(["loop.example"]);
  let fetches = 0;
  install();
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from("User-agent: *\nAllow: /\n"),
        };
      }
      fetches += 1;
      // Fan out enough unique includes to hit the count cap.
      const includes = Array.from(
        { length: MAX_SLASHPAGES_INCLUDES + 2 },
        (_item, index) =>
          `<outline type="include" url="https://loop.example/inc-${fetches}-${index}.opml" />`,
      ).join("\n");
      const body = `<?xml version="1.0"?><opml version="2.0"><body>
  ${includes}
  <outline text="P" url="https://loop.example/projects/" />
</body></opml>`;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/x-opml" }),
        arrayBuffer: async () => Buffer.from(body),
      };
    };
    const result = await fetchSlashpagesManifest("https://loop.example", {
      cache,
    });
    assert.ok(result.includes_fetched.length <= MAX_SLASHPAGES_INCLUDES);
    assert.ok(result.errors.includes("include_count_cap"));
    assert.ok(
      collectSlashpagesCrawlSeeds(result).includes(
        "https://loop.example/projects/",
      ),
    );
  } finally {
    restore();
  }
});

test("fetchSlashpagesManifest: nested include robots disallow and duplicate queue", async () => {
  const cache = dnsCache(["nest.example"]);
  install();
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () =>
            Buffer.from("User-agent: *\nAllow: /\nDisallow: /secret.opml\n"),
        };
      }
      if (url.endsWith("/.well-known/slashpages")) {
        const body = `<?xml version="1.0"?><opml version="2.0"><body>
  <outline type="include" url="https://nest.example/secret.opml" />
  <outline type="include" url="https://nest.example/secret.opml" />
  <outline text="Ok" url="https://nest.example/projects/" />
</body></opml>`;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/x-opml" }),
          arrayBuffer: async () => Buffer.from(body),
        };
      }
      throw new Error(`unexpected ${url}`);
    };
    const result = await fetchSlashpagesManifest("https://nest.example", {
      cache,
    });
    assert.ok(
      result.errors.some((error) => error.startsWith("robots_disallow:")),
    );
    assert.deepEqual(collectSlashpagesCrawlSeeds(result), [
      "https://nest.example/projects/",
    ]);
  } finally {
    restore();
  }
});

test("fetchSlashpagesManifest: size limit and http errors", async () => {
  const cache = dnsCache(["big.example", "err.example"]);
  install();
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from("User-agent: *\nAllow: /\n"),
        };
      }
      if (url.includes("big.example")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/x-opml" }),
          arrayBuffer: async () => Buffer.alloc(300_000, 0x61),
        };
      }
      return {
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: async () => Buffer.from("nope"),
      };
    };
    const oversized = await fetchSlashpagesManifest("https://big.example", {
      cache,
      maxBytes: 1024,
    });
    assert.ok(
      oversized.errors.some((error) => /exceeds size limit/.test(error)),
    );

    const failed = await fetchSlashpagesManifest("https://err.example", {
      cache,
    });
    assert.ok(failed.errors.some((error) => /failed with 500/.test(error)));
  } finally {
    restore();
  }
});

test("parseSlashpagesOpml: ENTITY reject, single quotes, relative urls, bare include", () => {
  assert.deepEqual(
    parseSlashpagesOpml('<opml><!ENTITY xxe "x"></opml>', {
      baseOrigin: "https://a.example",
    }),
    [],
  );
  const quoted = parseSlashpagesOpml(
    `<opml><body><outline text='' url='/labs/' category='lab' /><outline text='Labs' url='/labs-2/' /></body></opml>`,
    { baseOrigin: "https://a.example" },
  );
  assert.equal(quoted[0]?.url, "https://a.example/labs/");
  assert.equal(quoted[0]?.text, "");
  assert.deepEqual(quoted[0]?.categories, ["lab"]);
  assert.equal(isSlashpagesIncludeOutline("include", ""), true);
  assert.deepEqual(
    collectSlashpagesCrawlSeeds({
      outlines: [{ url: "", text: "", categories: [], same_origin: true }],
    }),
    [],
  );
});

test("fetchSlashpagesManifest: default options and non-Error throw", async () => {
  const cache = dnsCache(["plain.example"]);
  install();
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from("User-agent: *\nAllow: /\n"),
        };
      }
      if (url.endsWith("/.well-known/slashpages")) {
        throw "boom-string";
      }
      throw new Error(`unexpected ${url}`);
    };
    const result = await fetchSlashpagesManifest("https://plain.example", {
      cache,
    });
    assert.ok(result.errors.includes("boom-string"));

    // No cache Map → internal empty Map path (fetch still mocked; DNS unused
    // because robots.txt mock short-circuits before assertPublicURL on success
    // paths that need DNS use the empty map via assertPublicURL lookup).
    const noCache = await fetchSlashpagesManifest("https://plain.example", {});
    assert.ok(Array.isArray(noCache.errors));
  } finally {
    restore();
  }
});

test("fetchSlashpagesManifest: custom fetchImpl without cache option", async () => {
  const cache = dnsCache(["custom.example"]);
  install();
  try {
    const fetchImpl = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from("User-agent: *\nAllow: /\n"),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/x-opml" }),
        arrayBuffer: async () =>
          Buffer.from(
            `<opml version="2.0"><body><outline text="X" url="https://custom.example/x/" /></body></opml>`,
          ),
      };
    };
    const result = await fetchSlashpagesManifest("https://custom.example", {
      cache,
      fetchImpl,
    });
    assert.deepEqual(collectSlashpagesCrawlSeeds(result), [
      "https://custom.example/x/",
    ]);
  } finally {
    restore();
  }
});

test("fetchSlashpagesManifest: include depth cap stops nested follow", async () => {
  const cache = dnsCache(["depth.example"]);
  install();
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from("User-agent: *\nAllow: /\n"),
        };
      }
      if (url.endsWith("/.well-known/slashpages")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/x-opml" }),
          arrayBuffer: async () =>
            Buffer.from(
              `<opml><body><outline type="include" url="https://depth.example/d1.opml" /></body></opml>`,
            ),
        };
      }
      if (url.endsWith("/d1.opml")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/x-opml" }),
          arrayBuffer: async () =>
            Buffer.from(
              `<opml><body><outline type="include" url="https://depth.example/d2.opml" /><outline text="A" url="https://depth.example/a/" /></body></opml>`,
            ),
        };
      }
      if (url.endsWith("/d2.opml")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/x-opml" }),
          arrayBuffer: async () =>
            Buffer.from(
              `<opml><body><outline type="include" url="https://depth.example/d3.opml" /><outline text="B" url="https://depth.example/b/" /></body></opml>`,
            ),
        };
      }
      throw new Error(`unexpected ${url}`);
    };
    const robotsGate = createOriginRobotsGate({
      cache,
      userAgent: "Joshternet-Joshbot (+https://joshternet.org/joshbot)",
    });
    const result = await fetchSlashpagesManifest("https://depth.example", {
      cache,
      robotsGate,
    });
    assert.ok(
      result.includes_fetched.includes("https://depth.example/d2.opml"),
    );
    assert.equal(
      result.includes_fetched.includes("https://depth.example/d3.opml"),
      false,
    );
    assert.ok(
      collectSlashpagesCrawlSeeds(result).includes("https://depth.example/b/"),
    );
  } finally {
    restore();
  }
});
