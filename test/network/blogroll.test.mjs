/**
 * Goal: Cover blogroll OPML sanitize, parse, edges, and aggregate OPML.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  blogrollEdges,
  buildBlogrollsDocument,
  buildJoshternetOpml,
  carryForwardBlogrollEdges,
  fetchBlogrollOpml,
  isJoshternetGeneratedOpml,
  MAX_BLOGROLL_OPML_BYTES,
  MAX_BLOGROLLS_PER_PARTICIPANT,
  originFromHttpUrl,
  originsFromBlogrollUrls,
  parseOpmlOutlineUrls,
  sanitizeBlogrollUrls,
  sortBlogrollEdges,
  withBlogroll,
} from "../../scripts/network/blogroll.mjs";

function publicLookup() {
  return async () => {
    return [
      {
        address: "93.184.216.34",
        family: 4,
      },
    ];
  };
}

test("sanitizeBlogrollUrls keeps text/xml blogroll advertisements", async () => {
  const result = await sanitizeBlogrollUrls(
    [
      {
        href: "https://example.test/blogroll.opml",
        type: "text/xml",
      },
      {
        href: "https://example.test/other.opml",
        type: "application/xml",
      },
      {
        href: "https://example.test/blogroll.opml",
        type: "text/xml",
      },
    ],
    {
      lookup: publicLookup(),
    },
  );

  assert.deepEqual(result, ["https://example.test/blogroll.opml"]);
});

test("parseOpmlOutlineUrls reads htmlUrl and xmlUrl attributes", () => {
  const urls = parseOpmlOutlineUrls(`
    <?xml version="1.0"?>
    <opml version="2.0">
      <body>
        <outline text="One" htmlUrl="https://one.example/" xmlUrl="https://one.example/feed.xml" />
        <outline text='Two' htmlUrl='https://two.example/' />
        <outline text="Broken" htmlUrl= />
      </body>
    </opml>
  `);

  assert.deepEqual(urls, [
    "https://one.example/",
    "https://one.example/feed.xml",
    "https://two.example/",
  ]);
});

test("blogrollEdges keeps only current participant destinations", () => {
  const edges = sortBlogrollEdges(
    blogrollEdges({
      sourceOrigin: "https://a.example",
      blogrollUrl: "https://a.example/blogroll.opml",
      outlineOrigins: originsFromBlogrollUrls([
        "https://a.example/about",
        "https://b.example/posts",
        "https://b.example/feed.xml",
        "https://outside.example/",
        "https://c.example/",
      ]),
      participantOrigins: [
        "https://a.example",
        "https://b.example",
        "https://c.example",
      ],
    }),
  );

  assert.deepEqual(edges, [
    {
      from: "https://a.example",
      to: "https://b.example",
      blogroll: "https://a.example/blogroll.opml",
    },
    {
      from: "https://a.example",
      to: "https://c.example",
      blogroll: "https://a.example/blogroll.opml",
    },
  ]);
});

test("fetchBlogrollOpml rejects oversized bodies", async () => {
  const big = "x".repeat(MAX_BLOGROLL_OPML_BYTES + 1);

  await assert.rejects(
    fetchBlogrollOpml("https://example.test/blogroll.opml", {
      lookup: publicLookup(),
      fetchImpl: async () => {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from(big),
        };
      },
    }),
    /size limit/,
  );
});

test("buildJoshternetOpml includes feeds and nested blogroll links", () => {
  const opml = buildJoshternetOpml([
    {
      origin: "https://zeta.example",
      domain: "zeta.example",
      title: "Zeta & Co",
    },
    {
      origin: "https://alpha.example",
      domain: "alpha.example",
      title: "Alpha",
      feeds: [
        {
          url: "https://alpha.example/rss.xml",
        },
      ],
      blogroll: "https://alpha.example/blogroll.opml",
    },
  ]);

  assert.match(opml, /<opml version="2.0">/);
  assert.match(opml, /htmlUrl="https:\/\/alpha\.example"/);
  assert.match(opml, /xmlUrl="https:\/\/alpha\.example\/rss\.xml"/);
  assert.match(
    opml,
    /type="link" url="https:\/\/alpha\.example\/blogroll\.opml"/,
  );
  assert.match(opml, /text="Zeta &amp; Co"/);
  assert.ok(opml.indexOf("alpha.example") < opml.indexOf("zeta.example"));
});

test("withBlogroll publishes or omits the advertisement URL", () => {
  const base = {
    origin: "https://example.com",
    blogroll: "https://example.com/old.opml",
  };

  assert.equal(
    withBlogroll(base, "https://example.com/blogroll.opml").blogroll,
    "https://example.com/blogroll.opml",
  );
  assert.equal(Object.hasOwn(withBlogroll(base, ""), "blogroll"), false);
  assert.equal(Object.hasOwn(withBlogroll(base, null), "blogroll"), false);
});

test("carryForwardBlogrollEdges keeps only prior edges for the failed origin", () => {
  const previous = [
    {
      from: "https://alpha.example",
      to: "https://beta.example",
      blogroll: "https://alpha.example/blogroll.opml",
    },
    {
      from: "https://beta.example",
      to: "https://alpha.example",
      blogroll: "https://beta.example/blogroll.opml",
    },
    {
      from: "https://alpha.example",
      to: "https://gamma.example",
      blogroll: "https://alpha.example/blogroll.opml",
    },
    {
      from: "https://alpha.example",
      to: 12,
      blogroll: "https://alpha.example/bad.opml",
    },
  ];

  assert.deepEqual(
    carryForwardBlogrollEdges(previous, "https://alpha.example"),
    [
      {
        from: "https://alpha.example",
        to: "https://beta.example",
        blogroll: "https://alpha.example/blogroll.opml",
      },
      {
        from: "https://alpha.example",
        to: "https://gamma.example",
        blogroll: "https://alpha.example/blogroll.opml",
      },
    ],
  );
  assert.deepEqual(
    carryForwardBlogrollEdges(previous, "https://missing.example"),
    [],
  );
  assert.deepEqual(
    carryForwardBlogrollEdges(null, "https://alpha.example"),
    [],
  );
});

test("isJoshternetGeneratedOpml detects hub subscription OPML", () => {
  assert.equal(
    isJoshternetGeneratedOpml(
      "https://joshternet.org/assets/network/joshternet.opml",
    ),
    true,
  );
  assert.equal(
    isJoshternetGeneratedOpml("https://alpha.example/blogroll.opml"),
    false,
  );
});

test("buildBlogrollsDocument records advertisements and omits empty edges", () => {
  const doc = buildBlogrollsDocument({
    generatedAt: "2026-10-03T00:00:00.000Z",
    edges: [],
    entries: [
      {
        origin: "https://joshternet.org",
        blogroll: "https://joshternet.org/assets/network/joshternet.opml",
      },
      { origin: "https://alpha.example" },
    ],
  });

  assert.equal(doc.schema_version, 1);
  assert.equal(doc.edge_count, 0);
  assert.equal(doc.advertisement_count, 1);
  assert.equal(Object.hasOwn(doc, "edges"), false);
  assert.equal(doc.advertisements[0].source_authority, "joshternet-generated");
  assert.equal(doc.advertisements[0].relationship_evidence, false);
});

test("buildBlogrollsDocument includes publisher edges when present", () => {
  const doc = buildBlogrollsDocument({
    generatedAt: "2026-10-03T00:00:00.000Z",
    edges: [
      {
        from: "https://alpha.example",
        to: "https://beta.example",
        blogroll: "https://alpha.example/blogroll.opml",
      },
    ],
    entries: [
      {
        origin: "https://alpha.example",
        blogroll: "https://alpha.example/blogroll.opml",
      },
    ],
  });

  assert.equal(doc.edge_count, 1);
  assert.equal(doc.edges.length, 1);
  assert.equal(doc.advertisements[0].relationship_evidence, true);
});

// ─── blogroll additional coverage ────────────────────────────────────────────

test("sanitizeBlogrollUrls: accepts url property as alternative to href", async () => {
  const result = await sanitizeBlogrollUrls(
    [
      {
        url: "https://example.test/blogroll.opml", // url, not href
        type: "text/xml",
      },
    ],
    { lookup: publicLookup() },
  );
  assert.deepEqual(result, ["https://example.test/blogroll.opml"]);
});

test("sanitizeBlogrollUrls: non-array input returns empty", async () => {
  assert.deepEqual(await sanitizeBlogrollUrls(null), []);
  assert.deepEqual(await sanitizeBlogrollUrls("string"), []);
});

test("sanitizeBlogrollUrls: non-object entries are skipped", async () => {
  const result = await sanitizeBlogrollUrls(
    [
      null,
      "string",
      42,
      { href: "https://example.test/b.opml", type: "text/xml" },
    ],
    { lookup: publicLookup() },
  );
  assert.deepEqual(result, ["https://example.test/b.opml"]);
});

test("sanitizeBlogrollUrls: candidate with no href or url is skipped", async () => {
  const result = await sanitizeBlogrollUrls(
    [{ type: "text/xml" }], // no href or url
    { lookup: publicLookup() },
  );
  assert.deepEqual(result, []);
});

test("sanitizeBlogrollUrls: URL failing assertPublicURL is skipped (catch branch)", async () => {
  const result = await sanitizeBlogrollUrls(
    [
      {
        href: "https://private.test/blogroll.opml",
        type: "text/xml",
      },
    ],
    {
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    },
  );
  assert.deepEqual(result, []);
});

test("originsFromBlogrollUrls: invalid URLs and non-http schemes are skipped", () => {
  const origins = originsFromBlogrollUrls([
    "not-a-url",
    "ftp://example.test/feed.xml",
    "https://a.example/",
    "https://a.example/other", // same origin → deduplicated
    "https://b.example/",
  ]);
  assert.deepEqual(origins, ["https://a.example", "https://b.example"]);
});

test("originsFromBlogrollUrls: non-array returns empty", () => {
  assert.deepEqual(originsFromBlogrollUrls(null), []);
});

test("fetchBlogrollOpml: returns OPML text on success", async () => {
  const opmlText = `<?xml version="1.0"?><opml><body></body></opml>`;
  const result = await fetchBlogrollOpml("https://example.test/blogroll.opml", {
    lookup: publicLookup(),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from(opmlText),
    }),
  });
  assert.equal(result, opmlText);
});

test("fetchBlogrollOpml: non-OK response throws", async () => {
  await assert.rejects(
    fetchBlogrollOpml("https://example.test/blogroll.opml", {
      lookup: publicLookup(),
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        arrayBuffer: async () => Buffer.from(""),
      }),
    }),
    /403/,
  );
});

test("blogrollEdges: non-participant sourceOrigin returns empty", () => {
  const edges = blogrollEdges({
    sourceOrigin: "https://unknown.example",
    blogrollUrl: "https://unknown.example/b.opml",
    outlineOrigins: ["https://b.example"],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.deepEqual(edges, []);
});

test("isJoshternetGeneratedOpml: non-string or empty returns false", () => {
  assert.equal(isJoshternetGeneratedOpml(null), false);
  assert.equal(isJoshternetGeneratedOpml(""), false);
});

test("isJoshternetGeneratedOpml: non-http URL returns false (catch branch)", () => {
  assert.equal(
    isJoshternetGeneratedOpml("ftp://joshternet.org/joshternet.opml"),
    false,
  );
});

test("buildBlogrollsDocument: entry without origin is skipped", () => {
  const doc = buildBlogrollsDocument({
    generatedAt: "2026-10-03T00:00:00.000Z",
    edges: [],
    entries: [{ blogroll: "https://example.test/b.opml" }], // no origin
  });
  assert.equal(doc.advertisement_count, 0);
  assert.equal(Object.hasOwn(doc, "advertisements"), false);
});

// ─── originFromHttpUrl credential guard (lines 36-37) ────────────────────────

test("originFromHttpUrl: URL with username or password throws (lines 36-37)", () => {
  assert.throws(
    () => originFromHttpUrl("https://user:pass@example.com/"),
    /credentials/,
  );
});

// ─── sanitizeBlogrollUrls cap break (lines 63-64) ────────────────────────────

test("sanitizeBlogrollUrls: breaks after MAX_BLOGROLLS_PER_PARTICIPANT valid entries (lines 63-64)", async () => {
  // Build MAX+1 valid blogroll entries; the last one must be excluded.
  const raw = Array.from(
    { length: MAX_BLOGROLLS_PER_PARTICIPANT + 1 },
    (_, i) => ({
      href: `https://example-${i}.test/b.xml`,
      type: "text/xml",
    }),
  );

  const result = await sanitizeBlogrollUrls(raw, { lookup: publicLookup() });
  assert.equal(result.length, MAX_BLOGROLLS_PER_PARTICIPANT);
});

// ─── parseOpmlOutlineUrls early return (lines 116-117) ───────────────────────

test("parseOpmlOutlineUrls: non-string or empty returns empty array (lines 116-117)", () => {
  assert.deepEqual(parseOpmlOutlineUrls(null), []);
  assert.deepEqual(parseOpmlOutlineUrls(""), []);
  assert.deepEqual(parseOpmlOutlineUrls(42), []);
});

// ─── blogrollEdges deduplication (lines 207-208) ─────────────────────────────

test("blogrollEdges: duplicate (sourceOrigin → target) entries are deduplicated (lines 207-208)", () => {
  // Two outline origins map to the same target — second fires seen.has(key) continue.
  const edges = blogrollEdges({
    sourceOrigin: "https://a.example",
    blogrollUrl: "https://a.example/b.opml",
    outlineOrigins: ["https://b.example", "https://b.example"],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(edges.length, 1);
  assert.equal(edges[0].to, "https://b.example");
});

// ─── sortBlogrollEdges tie-breaks (lines 229-230 and 236-237) ─────────────────

test("sortBlogrollEdges: sorts by from, then to, then blogroll (lines 229-230, 236-237)", () => {
  const edges = sortBlogrollEdges([
    // Different from → return from fires (line 229-230)
    {
      from: "https://b.example",
      to: "https://c.example",
      blogroll: "https://b.example/b.opml",
    },
    {
      from: "https://a.example",
      to: "https://c.example",
      blogroll: "https://a.example/b.opml",
    },
    // Same from, same to, different blogroll → return blogroll fires (line 236-237)
    {
      from: "https://a.example",
      to: "https://b.example",
      blogroll: "https://a.example/z.opml",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      blogroll: "https://a.example/a.opml",
    },
  ]);
  // a.example comes before b.example (from sort)
  assert.equal(edges[0].from, "https://a.example");
  // Within a.example, to="b.example" < to="c.example"
  assert.equal(edges[0].to, "https://b.example");
  // blogroll /a.opml < /z.opml
  assert.equal(edges[0].blogroll, "https://a.example/a.opml");
  assert.equal(edges[1].blogroll, "https://a.example/z.opml");
  // b.example is last
  assert.equal(edges[3].from, "https://b.example");
});

// ─── sanitizeBlogrollUrls: candidate.type non-string fires ': ""' (L71) ──────

test("sanitizeBlogrollUrls: candidate with non-string type fires ': \"\"' (L71)", async () => {
  // type is null → ': ""' fires → type = "" → not "text/xml" → skipped
  const result = await sanitizeBlogrollUrls(
    [{ type: null, href: "https://b.example/b.opml" }],
    { lookup: async () => ({ address: "1.2.3.4" }) },
  );
  assert.deepEqual(result, []);
});

// ─── parseOpmlOutlineUrls: outline with empty attributes fires || "" (L123) ──

test("parseOpmlOutlineUrls: empty outline tag fires || '' in attributes (L123)", () => {
  // <outline> has no attributes → match[1] = "" → "" || "" fires L123
  // Note: <outline/> has "/" captured by ([^>]*), but <outline> captures ""
  const urls = parseOpmlOutlineUrls(
    "<opml><body><outline></outline></body></opml>",
  );
  assert.deepEqual(urls, []); // no urls extracted
});

// ─── buildJoshternetOpml: non-array entries fires ': []' (L327) ──────────────

test("buildJoshternetOpml: non-array entries fires ': []' (L327)", () => {
  const opml = buildJoshternetOpml(null);
  assert.ok(typeof opml === "string");
  assert.ok(opml.includes("<opml"));
});

// ─── buildJoshternetOpml: no-domain entry fires || new URL().host (L329-330) ─

test("buildJoshternetOpml: entry without domain fires || new URL(origin).host in sort (L329, L330)", () => {
  // Both entries have no domain → || new URL(origin).host fires for left and right
  const opml = buildJoshternetOpml([
    { origin: "https://b.example", feeds: [] },
    { origin: "https://a.example", feeds: [] },
  ]);
  // a.example sorts before b.example
  assert.ok(opml.indexOf("a.example") < opml.indexOf("b.example"));
});

// ─── buildJoshternetOpml: empty title falls back to domain/origin (L342) ─────

test("buildJoshternetOpml: empty title fires || domain (L342) and missing domain fires || origin (L342)", () => {
  const opml = buildJoshternetOpml([
    { origin: "https://a.example", domain: "a.example", title: "", feeds: [] }, // empty title → || domain
    { origin: "https://b.example", feeds: [] }, // no title, no domain → || origin
  ]);
  assert.ok(opml.includes("a.example"));
  assert.ok(opml.includes("https://b.example"));
});

// ─── isJoshternetGeneratedOpml: includes but not endsWith fires || (L418) ────

test("isJoshternetGeneratedOpml: path includes assets path but doesn't end with .opml fires || branch (L418)", () => {
  // endsWith("/joshternet.opml") is false but includes("/assets/network/joshternet.opml") is true
  assert.equal(
    isJoshternetGeneratedOpml(
      "https://joshternet.org/assets/network/joshternet.opml/download",
    ),
    true,
  );
});

// ─── buildBlogrollsDocument: null edges/entries fire ': []' / || [] (L439, L443) ─

test("buildBlogrollsDocument: null edges fires ': []' (L439) and null entries fires || [] (L443)", () => {
  const doc = buildBlogrollsDocument({
    generatedAt: "2026-10-03T00:00:00.000Z",
    edges: null, // → L439 ': []' fires
    entries: null, // → L443 || [] fires
  });
  assert.ok(typeof doc === "object");
  assert.equal(doc.advertisement_count, 0);
});
