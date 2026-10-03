/**
 * Goal: Cover blogroll OPML sanitize, parse, edges, and aggregate OPML.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  blogrollEdges,
  buildJoshternetOpml,
  fetchBlogrollOpml,
  MAX_BLOGROLL_OPML_BYTES,
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
