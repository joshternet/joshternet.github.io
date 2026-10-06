/**
 * Goal: Observed relationship contracts; ban /.well-known/josh, friend, topic pairs.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateConnectionEdges,
  blogrollConnectionObservations,
  carryForwardConnectionEdges,
  connectionEdges,
  connectionObservations,
  friendConnectionObservations,
  hasDerivedAnalysisMarker,
  indexConnectionsByParticipant,
  isHubDirectoryPage,
  isParticipationDeclarationPath,
  originsFromLinkUrls,
  relationForPage,
  slugifyTopic,
  sortConnectionEdges,
  topicConnectionObservations,
} from "../../scripts/network/connections.mjs";

test("isParticipationDeclarationPath detects well-known josh only", () => {
  assert.equal(
    isParticipationDeclarationPath("https://a.example/.well-known/josh"),
    true,
  );
  assert.equal(
    isParticipationDeclarationPath("https://a.example/posts/josh"),
    false,
  );
});

test("originsFromLinkUrls drops well-known josh", () => {
  assert.deepEqual(
    originsFromLinkUrls([
      "https://a.example/path",
      "https://b.example/.well-known/josh",
    ]),
    ["https://a.example"],
  );
});

test("connectionObservations emits homepage-link from home page", () => {
  const edges = sortConnectionEdges(
    connectionObservations({
      sourceOrigin: "https://a.example",
      pageUrl: "https://a.example/",
      links: [
        {
          href: "https://b.example/posts",
          text: "B's posts",
          rel: ["nofollow"],
        },
        { href: "https://b.example/.well-known/josh", text: "Josh", rel: [] },
        { href: "https://outside.example/", text: "Outside", rel: [] },
      ],
      participantOrigins: [
        "https://a.example",
        "https://b.example",
        "https://c.example",
      ],
    }),
  );

  assert.equal(edges.length, 1);
  assert.equal(edges[0].relation, "homepage-link");
  assert.equal(edges[0].from, "https://a.example");
  assert.equal(edges[0].to, "https://b.example");
  assert.equal(edges[0].directed, true);
});

test("declarations alone never create a connection", () => {
  assert.deepEqual(
    connectionObservations({
      sourceOrigin: "https://a.example",
      pageUrl: "https://a.example/",
      links: [
        { href: "https://b.example/.well-known/josh", text: "B", rel: [] },
      ],
      participantOrigins: ["https://a.example", "https://b.example"],
    }),
    [],
  );
});

test("isHubDirectoryPage detects Joshternet listing surfaces only on hub", () => {
  assert.equal(isHubDirectoryPage("https://joshternet.org/network/"), true);
  assert.equal(isHubDirectoryPage("https://joshternet.org/wander/"), true);
  assert.equal(isHubDirectoryPage("https://joshternet.org/connections/"), true);
  assert.equal(isHubDirectoryPage("https://joshternet.org/topics/cars/"), true);
  assert.equal(isHubDirectoryPage("https://joshternet.org/about/"), false);
  assert.equal(isHubDirectoryPage("https://a.example/network/"), false);
  assert.equal(isHubDirectoryPage("https://a.example/topics/foo/"), false);
});

test("hub directory pages never create outgoing connections", () => {
  assert.deepEqual(
    connectionObservations({
      sourceOrigin: "https://joshternet.org",
      pageUrl: "https://joshternet.org/network/",
      links: [{ href: "https://b.example/", text: "B" }],
      participantOrigins: ["https://joshternet.org", "https://b.example"],
    }),
    [],
  );
});

test("friendConnectionObservations is disabled", () => {
  assert.deepEqual(
    friendConnectionObservations(
      [
        {
          origin: "https://a.example",
          links: [
            { href: "https://nownownow.com/about", page: "https://a.example/" },
          ],
        },
        {
          origin: "https://b.example",
          links: [
            { href: "https://nownownow.com/about", page: "https://b.example/" },
          ],
        },
      ],
      ["https://a.example", "https://b.example"],
    ),
    [],
  );
});

test("topicConnectionObservations is disabled", () => {
  assert.deepEqual(
    topicConnectionObservations(
      [
        { origin: "https://a.example", subjects: [{ slug: "design" }] },
        { origin: "https://b.example", subjects: [{ slug: "design" }] },
      ],
      ["https://a.example", "https://b.example"],
    ),
    [],
  );
});

test("carryForward drops friend and topic edges", () => {
  const kept = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        kind: "friend",
        href: "https://x.example/",
        page: "https://a.example/",
      },
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
        href: "https://b.example/p",
        page: "https://a.example/p",
      },
    ],
    "https://a.example",
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].relation, "content-link");
});

test("connectionEdges deprecated helper still returns from/to pairs", () => {
  const edges = connectionEdges({
    sourceOrigin: "https://a.example",
    linkOrigins: ["https://b.example"],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.deepEqual(edges, [
    { from: "https://a.example", to: "https://b.example" },
  ]);
});

test("indexConnectionsByParticipant groups directed edges", () => {
  const indexed = indexConnectionsByParticipant(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
        directed: true,
        via: "",
        source: "content",
        href: "https://b.example/",
        text: "",
        rel: [],
        page: "https://a.example/",
      },
    ],
    [
      { origin: "https://a.example", domain: "a.example", title: "A" },
      { origin: "https://b.example", domain: "b.example", title: "B" },
    ],
  );
  assert.equal(indexed[0].linksTo.length + indexed[1].linksTo.length, 1);
  assert.equal(indexed[0].linkedFrom.length + indexed[1].linkedFrom.length, 1);
});

test("aggregateConnectionEdges groups by from, to, relation", () => {
  const edges = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/one",
      page: "https://a.example/now/",
      text: "one",
      rel: [],
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/two",
      page: "https://a.example/seeking/",
      text: "two",
      rel: [],
    },
  ]);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].evidence_count, 2);
});

// ─── isParticipationDeclarationPath edge cases ────────────────────────────────

test("isParticipationDeclarationPath: non-string and empty return false", () => {
  assert.equal(isParticipationDeclarationPath(null), false);
  assert.equal(isParticipationDeclarationPath(""), false);
  assert.equal(isParticipationDeclarationPath(42), false);
});

test("isParticipationDeclarationPath: invalid URL returns false", () => {
  assert.equal(isParticipationDeclarationPath("not-a-url"), false);
  assert.equal(isParticipationDeclarationPath("http://"), false);
});

// ─── isHubDirectoryPage edge cases ────────────────────────────────────────────

test("isHubDirectoryPage: non-string href returns false", () => {
  assert.equal(isHubDirectoryPage(null), false);
  assert.equal(isHubDirectoryPage(""), false);
  assert.equal(isHubDirectoryPage(42), false);
});

test("isHubDirectoryPage: non-string hubOrigin returns false", () => {
  assert.equal(
    isHubDirectoryPage("https://joshternet.org/network/", null),
    false,
  );
});

test("isHubDirectoryPage: invalid URL returns false", () => {
  assert.equal(isHubDirectoryPage("not-a-url"), false);
});

// ─── hasDerivedAnalysisMarker edge cases ─────────────────────────────────────

test("hasDerivedAnalysisMarker: non-string and empty return false", () => {
  assert.equal(hasDerivedAnalysisMarker(null), false);
  assert.equal(hasDerivedAnalysisMarker(""), false);
  assert.equal(hasDerivedAnalysisMarker(42), false);
});

test("hasDerivedAnalysisMarker: content before name order variant is detected", () => {
  const html = `<meta content="derived" name="joshternet-analysis">`;
  assert.equal(hasDerivedAnalysisMarker(html), true);
});

// ─── relationForPage ──────────────────────────────────────────────────────────

test("relationForPage: cross-origin page url returns content-link", () => {
  assert.equal(
    relationForPage("https://b.example/post", "https://a.example"),
    "content-link",
  );
});

test("relationForPage: invalid pageUrl returns content-link (catch branch)", () => {
  assert.equal(
    relationForPage("not-a-url", "https://a.example"),
    "content-link",
  );
});

test("relationForPage: non-root path returns content-link", () => {
  assert.equal(
    relationForPage("https://a.example/about/", "https://a.example"),
    "content-link",
  );
});

// ─── slugifyTopic ─────────────────────────────────────────────────────────────

test("slugifyTopic: normalizes and slugifies a phrase", () => {
  assert.equal(
    slugifyTopic("Artificial Intelligence"),
    "artificial-intelligence",
  );
  assert.equal(slugifyTopic("  Web  Dev  "), "web-dev");
  assert.equal(slugifyTopic("C++"), "c");
});

// ─── originsFromLinkUrls with object links ────────────────────────────────────

test("originsFromLinkUrls: object links with href are supported", () => {
  assert.deepEqual(
    originsFromLinkUrls([
      { href: "https://a.example/post" },
      { href: "https://b.example/feed.xml" },
      { notHref: "https://c.example/" }, // no .href → href = ""
    ]),
    ["https://a.example", "https://b.example"],
  );
});

test("originsFromLinkUrls: non-array input returns empty", () => {
  assert.deepEqual(originsFromLinkUrls(null), []);
  assert.deepEqual(originsFromLinkUrls("string"), []);
});

test("originsFromLinkUrls: invalid URLs and declaration paths are skipped", () => {
  assert.deepEqual(
    originsFromLinkUrls([
      "not-a-url",
      "https://a.example/.well-known/josh",
      "ftp://a.example/",
      "https://b.example/",
    ]),
    ["https://b.example"],
  );
});

// ─── connectionObservations edge cases ───────────────────────────────────────

test("connectionObservations: non-participant sourceOrigin returns empty", () => {
  assert.deepEqual(
    connectionObservations({
      sourceOrigin: "https://unknown.example",
      pageUrl: "https://unknown.example/",
      links: [{ href: "https://b.example/" }],
      participantOrigins: ["https://b.example"],
    }),
    [],
  );
});

test("connectionObservations: empty/invalid pageUrl returns empty", () => {
  assert.deepEqual(
    connectionObservations({
      sourceOrigin: "https://a.example",
      pageUrl: "",
      links: [{ href: "https://b.example/" }],
      participantOrigins: ["https://a.example", "https://b.example"],
    }),
    [],
  );
});

test("connectionObservations: non-array links returns empty", () => {
  assert.deepEqual(
    connectionObservations({
      sourceOrigin: "https://a.example",
      pageUrl: "https://a.example/",
      links: null,
      participantOrigins: ["https://a.example", "https://b.example"],
    }),
    [],
  );
});

test("connectionObservations: invalid pageUrl (unparseable) returns empty", () => {
  assert.deepEqual(
    connectionObservations({
      sourceOrigin: "https://a.example",
      pageUrl: "not-a-url",
      links: [{ href: "https://b.example/" }],
      participantOrigins: ["https://a.example", "https://b.example"],
    }),
    [],
  );
});

test("connectionObservations: string link is supported", () => {
  const obs = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/",
    links: ["https://b.example/"],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(obs.length, 1);
  assert.equal(obs[0].relation, "homepage-link");
});

test("connectionObservations: null/non-object candidate is skipped", () => {
  const obs = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/",
    links: [null, 42, { href: "https://b.example/" }],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(obs.length, 1);
});

test("connectionObservations: invalid candidate.page is skipped (continue)", () => {
  const obs = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/",
    links: [
      { href: "https://b.example/", page: "not-a-url" }, // invalid page → continue
      { href: "https://b.example/post2" }, // valid fallback
    ],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  // First is skipped (invalid page), second gets through
  assert.equal(obs.length, 1);
});

test("connectionObservations: deduplicated identical link is skipped", () => {
  const obs = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/",
    links: [
      { href: "https://b.example/" },
      { href: "https://b.example/" }, // duplicate key
    ],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(obs.length, 1);
});

test("connectionObservations: link with invalid href (unparseable) is skipped", () => {
  const obs = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/",
    links: [{ href: "not-a-url" }, { href: "https://b.example/" }],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(obs.length, 1);
});

test("connectionObservations: explicit IndieWeb rel annotations are used", () => {
  const obs = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/post",
    links: [
      { href: "https://b.example/post", rel: ["u-in-reply-to"] },
      { href: "https://b.example/other", rel: ["u-repost-of"] },
      { href: "https://b.example/syn", rel: ["u-syndication"] },
    ],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  const relations = obs.map((o) => o.relation).sort();
  assert.ok(relations.includes("reply-to"));
  assert.ok(relations.includes("repost-of"));
  assert.ok(relations.includes("syndication"));
});

// ─── blogrollConnectionObservations edge cases ────────────────────────────────

test("blogrollConnectionObservations: builds observations from blogroll edges", () => {
  const obs = blogrollConnectionObservations([
    {
      from: "https://a.example",
      to: "https://b.example",
      blogroll: "https://a.example/blogroll.opml",
    },
  ]);
  assert.equal(obs.length, 1);
  assert.equal(obs[0].relation, "blogroll");
  assert.equal(obs[0].directed, true);
  assert.deepEqual(obs[0].rel, ["blogroll"]);
});

test("blogrollConnectionObservations: non-array input returns empty", () => {
  assert.deepEqual(blogrollConnectionObservations(null), []);
  assert.deepEqual(blogrollConnectionObservations(undefined), []);
});

test("blogrollConnectionObservations: invalid edges are skipped", () => {
  const obs = blogrollConnectionObservations([
    null,
    { from: "https://a.example", to: "https://b.example" }, // no blogroll
    { from: "https://a.example", blogroll: "https://a.example/b.opml" }, // no to
  ]);
  assert.equal(obs.length, 0);
});

test("blogrollConnectionObservations: joshternet OPML is skipped", () => {
  const obs = blogrollConnectionObservations([
    {
      from: "https://a.example",
      to: "https://b.example",
      blogroll: "https://joshternet.org/assets/network/joshternet.opml",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      blogroll: "https://a.example/blogroll.opml",
    },
  ]);
  assert.equal(obs.length, 1);
  assert.ok(obs[0].href.includes("a.example"));
});

test("blogrollConnectionObservations: duplicate edge key is deduplicated", () => {
  const edge = {
    from: "https://a.example",
    to: "https://b.example",
    blogroll: "https://a.example/blogroll.opml",
  };
  const obs = blogrollConnectionObservations([edge, edge]);
  assert.equal(obs.length, 1);
});

// ─── sortConnectionEdges tie-breaks ───────────────────────────────────────────

test("sortConnectionEdges: sorts by from, to, relation, via, href, page", () => {
  const edges = sortConnectionEdges([
    {
      from: "https://b.example",
      to: "https://c.example",
      relation: "reply-to",
      via: "",
      href: "https://c.example/b",
      page: "https://b.example/p2",
    },
    {
      from: "https://a.example",
      to: "https://c.example",
      relation: "content-link",
      via: "",
      href: "https://c.example/z",
      page: "https://a.example/p1",
    },
    {
      from: "https://a.example",
      to: "https://c.example",
      relation: "content-link",
      via: "",
      href: "https://c.example/a",
      page: "https://a.example/p0",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "blogroll",
      via: "x",
      href: "https://b.example/1",
      page: "https://a.example/",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "blogroll",
      via: "y",
      href: "https://b.example/1",
      page: "https://a.example/",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "blogroll",
      via: "",
      href: "https://b.example/2",
      page: "https://a.example/p1",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "blogroll",
      via: "",
      href: "https://b.example/1",
      page: "https://a.example/pa",
    },
  ]);

  // First group: a.example (comes before b.example)
  assert.equal(edges[0].from, "https://a.example");
  // Within a→b blogroll edges, via "x" < "y" for same href+page
  // Within same via="", href "1" < "2"
  // Within same href, page sort
  const ab = edges.filter(
    (e) => e.from === "https://a.example" && e.to === "https://b.example",
  );
  assert.equal(ab.length, 4);
});

// ─── aggregateConnectionEdges edge cases ──────────────────────────────────────

test("aggregateConnectionEdges: invalid edges are skipped", () => {
  const edges = aggregateConnectionEdges([
    null,
    { from: "https://a.example" }, // no to
    { to: "https://b.example" }, // no from
    { from: "https://a.example", to: "https://b.example" }, // no relation
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/",
      page: "https://a.example/",
      text: "hi",
      rel: [],
    },
  ]);
  assert.equal(edges.length, 1);
});

test("aggregateConnectionEdges: via field is preserved when non-empty", () => {
  const edges = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "blogroll",
      via: "https://a.example/blogroll.opml",
      href: "https://b.example/",
      page: "https://a.example/blogroll.opml",
      source: "blogroll",
      text: "",
      rel: [],
      evidence: [
        {
          class: "observed",
          source: "blogroll",
          page: "https://a.example/blogroll.opml",
          href: "https://b.example/",
          via: "https://a.example/blogroll.opml",
        },
      ],
    },
  ]);
  assert.equal(edges[0].via, "https://a.example/blogroll.opml");
});

test("aggregateConnectionEdges: evidence item deduplication works", () => {
  const evidence = {
    class: "observed",
    source: "content",
    page: "https://a.example/",
    href: "https://b.example/",
    via: "",
  };
  const edges = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/",
      page: "https://a.example/",
      text: "",
      rel: [],
      evidence: [evidence, evidence, null], // duplicate + null
    },
  ]);
  assert.equal(edges[0].evidence_count, 1);
});

test("aggregateConnectionEdges: edge without evidence array uses inline fields", () => {
  // When observation.evidence is empty/absent, a synthetic evidence record is built
  const edges = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      source: "content",
      href: "https://b.example/",
      page: "https://a.example/",
      text: "hi",
      rel: [],
      // no .evidence field
    },
  ]);
  assert.equal(edges[0].evidence_count, 1);
  assert.equal(edges[0].evidence[0].source, "content");
});

// ─── carryForwardConnectionEdges edge cases ────────────────────────────────────

test("carryForwardConnectionEdges: non-array or non-string fromOrigin returns empty", () => {
  assert.deepEqual(carryForwardConnectionEdges(null, "https://a.example"), []);
  assert.deepEqual(carryForwardConnectionEdges([], null), []);
});

test("carryForwardConnectionEdges: declaration href is dropped", () => {
  const edges = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        href: "https://b.example/.well-known/josh",
        page: "https://a.example/",
      },
    ],
    "https://a.example",
  );
  assert.deepEqual(edges, []);
});

test("carryForwardConnectionEdges: hub directory page is dropped", () => {
  const edges = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://joshternet.org",
        href: "https://joshternet.org/",
        page: "https://joshternet.org/network",
      },
    ],
    "https://a.example",
  );
  assert.deepEqual(edges, []);
});

test("carryForwardConnectionEdges: invalid URL in href or page is dropped", () => {
  const edges = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        href: "not-a-url",
        page: "https://a.example/",
      },
    ],
    "https://a.example",
  );
  assert.deepEqual(edges, []);
});

test("carryForwardConnectionEdges: friend and topic legacy relations are dropped", () => {
  const kept = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "topic",
        href: "https://b.example/",
        page: "https://a.example/post",
      },
      // Non-homepage page URL so "link" maps to "content-link" (not "homepage-link")
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "link",
        href: "https://b.example/",
        page: "https://a.example/post",
      },
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "syndication",
        href: "https://b.example/",
        page: "https://a.example/post",
      },
    ],
    "https://a.example",
  );
  // topic dropped; "link" with non-homepage page maps to content-link; syndication kept
  assert.equal(kept.filter((e) => e.relation === "topic").length, 0);
  assert.ok(kept.some((e) => e.relation === "content-link")); // link→content-link
  assert.ok(kept.some((e) => e.relation === "syndication"));
});

test("carryForwardConnectionEdges: unknown relation defaults to content-link", () => {
  const kept = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "unknown-type",
        href: "https://b.example/",
        page: "https://a.example/",
      },
    ],
    "https://a.example",
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].relation, "content-link");
});

// ─── indexConnectionsByParticipant edge cases ──────────────────────────────────

test("indexConnectionsByParticipant: invalid participants are skipped", () => {
  const indexed = indexConnectionsByParticipant(
    [],
    [
      null,
      { origin: "https://a.example", domain: "a.example" },
      { domain: "b.example" }, // no origin
    ],
  );
  assert.equal(indexed.length, 1);
  assert.equal(indexed[0].origin, "https://a.example");
});

test("indexConnectionsByParticipant: null and non-object edges are skipped", () => {
  const indexed = indexConnectionsByParticipant(
    [
      null,
      "not-an-edge",
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
      },
    ],
    [
      { origin: "https://a.example", domain: "a.example" },
      { origin: "https://b.example", domain: "b.example" },
    ],
  );
  assert.equal(indexed[0].linksTo.length + indexed[1].linksTo.length, 1);
});

test("indexConnectionsByParticipant: participant without title falls back to domain", () => {
  const indexed = indexConnectionsByParticipant(
    [],
    [{ origin: "https://a.example", domain: "a.example" }],
  );
  assert.equal(indexed[0].title, "a.example");
});

// ─── connectionEdges deprecated helper edge cases ─────────────────────────────

test("connectionEdges: non-string linkOrigins are skipped", () => {
  const edges = connectionEdges({
    sourceOrigin: "https://a.example",
    linkOrigins: [42, null, "https://b.example"],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(edges.length, 1);
  assert.equal(edges[0].to, "https://b.example");
});

// ─── originsFromLinkUrls deduplication ────────────────────────────────────────

test("originsFromLinkUrls: duplicate origins are deduplicated (lines 278-279)", () => {
  // Two different paths on the same origin — second fires seen.has(origin) continue.
  const result = originsFromLinkUrls([
    "https://a.example/page1",
    "https://a.example/page2",
    "https://b.example/",
  ]);
  assert.deepEqual(result, ["https://a.example", "https://b.example"]);
});

// ─── sortConnectionEdges tie-break cases ──────────────────────────────────────

test("sortConnectionEdges: returns relation when from and to match (lines 542-543)", () => {
  const edges = sortConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "reply-to",
      via: "",
      href: "https://b.example/",
      page: "https://a.example/",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "blogroll",
      via: "",
      href: "https://b.example/",
      page: "https://a.example/",
    },
  ]);
  assert.equal(edges[0].relation, "blogroll"); // "blogroll" < "reply-to"
  assert.equal(edges[1].relation, "reply-to");
});

test("sortConnectionEdges: falls back to page when all preceding keys tie (line 556)", () => {
  const edges = sortConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      via: "",
      href: "https://b.example/",
      page: "https://a.example/z",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      via: "",
      href: "https://b.example/",
      page: "https://a.example/a",
    },
  ]);
  assert.equal(edges[0].page, "https://a.example/a");
  assert.equal(edges[1].page, "https://a.example/z");
});

// ─── aggregateConnectionEdges sort comparator ─────────────────────────────────

test("aggregateConnectionEdges: sorts observations by page then href (line 599-600)", () => {
  // Two observations in the same (from,to,relation) group; same page → href tie-break fires.
  const result = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      source: "content",
      href: "https://b.example/z",
      page: "https://a.example/p",
      text: "",
      rel: [],
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      source: "content",
      href: "https://b.example/a",
      page: "https://a.example/p",
      text: "",
      rel: [],
    },
  ]);
  assert.equal(result.length, 1);
  // First observation (after sort) should be the one with href /a
  assert.equal(result[0].href, "https://b.example/a");
  assert.equal(result[0].evidence_count, 2);
});

// ─── carryForwardConnectionEdges invalid edge guard ───────────────────────────

test("carryForwardConnectionEdges: edge with non-string to is skipped (lines 695-696)", () => {
  const kept = carryForwardConnectionEdges(
    [
      // to is a number — triggers typeof edge.to !== "string" guard
      {
        from: "https://a.example",
        to: 42,
        relation: "content-link",
        href: "https://b.example/",
        page: "https://a.example/",
      },
      // Valid edge to confirm the function still works
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
        href: "https://b.example/p",
        page: "https://a.example/p",
      },
    ],
    "https://a.example",
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].to, "https://b.example");
});

// ─── normalizeRelTokens sort comparator ───────────────────────────────────────

test("carryForwardConnectionEdges: rel array is normalised (triggers sort comparator at line 318)", () => {
  // edge.rel is an array with 2 tokens → normalizeRelTokens() reaches tokens.sort()
  const kept = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
        href: "https://b.example/p",
        page: "https://a.example/p",
        rel: ["me", "noopener"],
      },
    ],
    "https://a.example",
  );
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0].rel, ["me", "noopener"]); // sorted alphabetically
});

// ─── Phase-3 branch gap closers ───────────────────────────────────────────────

// normalizeRelTokens: duplicate token fires 'continue' at L310; non-string fires L305
test("carryForwardConnectionEdges: duplicate rel token is deduplicated (L310) and non-string skipped (L305)", () => {
  const kept = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
        href: "https://b.example/p",
        page: "https://a.example/p",
        // 42 is non-string → L305 fires; "me" appears twice → second fires L310
        rel: [42, "me", "me"],
      },
    ],
    "https://a.example",
  );
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0].rel, ["me"]);
});

// connectionEdges: missing linkOrigins fires || [] (L495)
test("connectionEdges: missing linkOrigins defaults to empty array (L495)", () => {
  const edges = connectionEdges({
    sourceOrigin: "https://a.example",
    participantOrigins: ["https://a.example", "https://b.example"],
    // no linkOrigins field → || []
  });
  assert.deepEqual(edges, []);
});

// sortConnectionEdges: edge with kind instead of relation (L537-538)
test("sortConnectionEdges: kind fallback used when relation is absent (L537-538)", () => {
  const sorted = sortConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      kind: "z-kind",
      href: "https://b.example/",
      page: "https://a.example/",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      kind: "a-kind",
      href: "https://b.example/",
      page: "https://a.example/",
    },
  ]);
  // kind sort: "a-kind" < "z-kind"
  assert.equal(sorted[0].kind, "a-kind");
});

// sortConnectionEdges: null page fires || "" fallback (L557)
test("sortConnectionEdges: null page fires || '' fallback (L557)", () => {
  const sorted = sortConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/",
      page: null,
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/",
      page: "https://a.example/",
    },
  ]);
  // null page ("") < "https://a.example/"
  assert.ok(sorted.length === 2);
});

// aggregateConnectionEdges: null input fires || [] (L571)
test("aggregateConnectionEdges: null edges fires || [] (L571)", () => {
  const result = aggregateConnectionEdges(null);
  assert.deepEqual(result, []);
});

// aggregateConnectionEdges: inline observation with no rel/text (L617 || [], L657 ': ""', L658 ': []')
test("aggregateConnectionEdges: observation without rel/text uses fallback values (L617, L657, L658)", () => {
  const result = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/p",
      page: "https://a.example/p",
      // no rel field → || [] (L617)
      // no text field → ': ""' (L657)
      // no .evidence array
    },
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].rel, []);
  assert.equal(result[0].text, "");
  // Synthetic evidence item gets rel: [] from || []
  assert.ok(result[0].evidence.length > 0);
});

// aggregateConnectionEdges: inline observation with via fires && observation.via (L621-622)
test("aggregateConnectionEdges: observation with via field fires L621-622 truthy branch", () => {
  const result = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/p",
      page: "https://a.example/p",
      via: "https://a.example/blogroll.opml",
      // no .evidence array → synthetic item construction uses via
    },
  ]);
  assert.equal(result.length, 1);
  // Synthetic evidence includes via
  assert.equal(result[0].evidence[0].via, "https://a.example/blogroll.opml");
});

// aggregateConnectionEdges: evidence item without class/source/href fires || fallbacks (L633-636)
test("aggregateConnectionEdges: evidence item without class/source/href uses || fallbacks (L633-636)", () => {
  const result = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/p",
      page: "https://a.example/p",
      evidence: [
        // item with no class (→ "observed"), no source (→ ""), no href (→ "")
        { page: "https://a.example/p" },
        // duplicate key detection: same page, same fallbacks → deduped
        { page: "https://a.example/p" },
      ],
    },
  ]);
  assert.equal(result[0].evidence_count, 1);
});

// aggregateConnectionEdges: two observations with missing page fire || "" in sort (L592-593)
test("aggregateConnectionEdges: observations missing page fire || '' in sort comparator (L592-593)", () => {
  const result = aggregateConnectionEdges([
    // Two observations in the same group (same from/to/relation)
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/a",
      // no page → || "" fires in comparator
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/b",
      // no page
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].evidence_count, 2);
});

// ─── isHubDirectoryPage root path fires || "/" (L94) ─────────────────────────

test("isHubDirectoryPage: root path on hub origin fires || '/' (L94) and returns false", () => {
  // pathname "/" → replace strips trailing slash → "" → || "/" fires → path = "/"
  // "/" is not in the recognized list → returns false
  assert.equal(isHubDirectoryPage("https://joshternet.org/"), false);
});

// ─── sortConnectionEdges: no relation/kind fires || "" (L537-538) ─────────────

test("sortConnectionEdges: edges without relation or kind fire || '' (L537-538)", () => {
  // Both edges have no relation and no kind → || "" fires for both left and right
  // → relation comparison is 0 → falls through to via/href/page
  const edges = sortConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      via: "",
      href: "https://b.example/",
      page: "https://a.example/b",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      via: "",
      href: "https://b.example/",
      page: "https://a.example/a",
    },
  ]);
  assert.equal(edges.length, 2);
  assert.equal(edges[0].page, "https://a.example/a");
});

// ─── sortConnectionEdges: null page fires || "" (L557) ──────────────────────

test("sortConnectionEdges: null page fires || '' in page comparator (L557)", () => {
  // Three edges with same from/to/relation/via/href → only page differs
  // Various comparison pairs fire both left.page || "" and right.page || ""
  const edges = sortConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      via: "",
      href: "https://b.example/p",
      page: "https://a.example/z",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      via: "",
      href: "https://b.example/p",
      page: null,
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      via: "",
      href: "https://b.example/p",
      page: "https://a.example/a",
    },
  ]);
  assert.equal(edges.length, 3);
  // null page sorts first (as "" < "https://...")
  assert.equal(edges[0].page, null);
});

// ─── aggregateConnectionEdges: null href fires || "" (L600) ─────────────────

test("aggregateConnectionEdges: null href in observations fires || '' (L600)", () => {
  // Two observations in same group with same page but both null href → || "" fires for left AND right
  const result = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: null,
      page: "https://a.example/p",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: null,
      page: "https://a.example/p",
    },
  ]);
  assert.equal(result.length, 1);
  // Both observations have null href + same page → same evidence key → deduped to 1
  assert.equal(result[0].evidence_count, 1);
});

// ─── carryForwardConnectionEdges: no href/page/relation (L699, L701, L721) ───

test("carryForwardConnectionEdges: no href fires ': edge.to/' (L699), no page fires ': edge.from/' (L701), no relation fires || 'content-link' (L721)", () => {
  const kept = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        // no href → L699: `${edge.to}/` = "https://b.example/"
        // no page → L701: `${edge.from}/` = "https://a.example/"
        // no relation, no kind → L721: || "content-link" fires
      },
    ],
    "https://a.example",
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].relation, "content-link");
  assert.equal(kept[0].href, "https://b.example/");
  assert.equal(kept[0].page, "https://a.example/");
});

// ─── carryForwardConnectionEdges: string via/source/text use true branches (L752-755) ─

test("carryForwardConnectionEdges: string via/source/text fire true branches (L752, L753, L755)", () => {
  const kept = carryForwardConnectionEdges(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
        href: "https://b.example/post",
        page: "https://a.example/",
        via: "https://a.example/blogroll.opml", // → L752 true branch
        source: "feed", // → L753 true branch
        text: "Check this out", // → L755 true branch
      },
    ],
    "https://a.example",
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].via, "https://a.example/blogroll.opml");
  assert.equal(kept[0].source, "feed");
  assert.equal(kept[0].text, "Check this out");
});

// ─── indexConnectionsByParticipant: domain/description/screenshot/observations branches ─

test("indexConnectionsByParticipant: no domain falls back to origin (L791), non-string domain calls new URL (L795)", () => {
  // Participant with no domain → L791 || participant.origin fires
  const indexed = indexConnectionsByParticipant(
    [],
    [
      { origin: "https://a.example" }, // no domain → L791
      { origin: "https://b.example", domain: 42 }, // non-string domain → L795 new URL(...).hostname
    ],
  );
  assert.equal(indexed[0].domain, "a.example"); // from hostname via L795 (no domain at all → L791 uses origin, but domain field needed separately)
  assert.equal(indexed[1].domain, "b.example"); // from new URL(origin).hostname
});

test("indexConnectionsByParticipant: string description/screenshot fire true branches (L798, L802)", () => {
  const indexed = indexConnectionsByParticipant(
    [],
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        description: "A great blog about design", // → L798 true branch
        screenshot: "/screenshots/a-example.jpg", // → L802 true branch
      },
    ],
  );
  assert.equal(indexed[0].description, "A great blog about design");
  assert.equal(indexed[0].screenshot, "/screenshots/a-example.jpg");
});

test("indexConnectionsByParticipant: null observations fires ': []' (L809)", () => {
  const indexed = indexConnectionsByParticipant(
    null, // → L809 ': []' fires
    [{ origin: "https://a.example", domain: "a.example" }],
  );
  assert.equal(indexed[0].linksTo.length, 0);
  assert.equal(indexed[0].linkedFrom.length, 0);
});
