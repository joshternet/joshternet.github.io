/**
 * Goal: Observed relationship contracts; ban /.well-known/josh, friend, topic pairs.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateConnectionEdges,
  carryForwardConnectionEdges,
  connectionEdges,
  connectionObservations,
  friendConnectionObservations,
  indexConnectionsByParticipant,
  isHubDirectoryPage,
  isParticipationDeclarationPath,
  originsFromLinkUrls,
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
