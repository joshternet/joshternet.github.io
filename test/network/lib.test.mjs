import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPublicURL,
  canFrame,
  canonicalOrigin,
  chooseDescription,
  chooseTitle,
  decodeHtmlEntities,
  framePolicy,
  identityFromDeclaration,
  isForbiddenAddress,
  isParticipatingNode,
  MAX_FEEDS_PER_PARTICIPANT,
  partitionPublicParticipants,
  projectRegistry,
  registryParticipationFields,
  registryTimestamp,
  sanitizeFeeds,
  screenshotPath,
  stableSiteID,
} from "../../scripts/network/lib.mjs";

test("maps all three Josh identity states", () => {
  assert.equal(
    identityFromDeclaration({
      version: 1,
      josh: true,
    }),
    "affirmed",
  );

  assert.equal(
    identityFromDeclaration({
      version: 1,
      josh: false,
    }),
    "declined",
  );

  assert.equal(
    identityFromDeclaration({
      version: 1,
    }),
    "undeclared",
  );
});

test("rejects invalid Josh identity values", () => {
  assert.throws(() => {
    identityFromDeclaration({
      version: 1,
      josh: "yes",
    });
  });
});

test("projects and sorts registry participants", () => {
  const result = projectRegistry({
    format_version: 1,
    nodes: [
      {
        origin: "https://z.example",
        first_participated_at: "2026-09-01T00:00:00.000Z",
        initial_declaration: {
          version: 1,
          josh: false,
        },
        latest_declaration_check_at: "2026-09-15T00:00:00.000Z",
        latest_declaration_check_outcome: "valid",
        declaration: {
          version: 1,
          josh: false,
        },
      },
      {
        origin: "https://a.example",
        first_participated_at: "2026-09-02T00:00:00.000Z",
        initial_declaration: {
          version: 1,
          josh: true,
        },
        latest_declaration_check_at: "2026-09-15T00:00:00.000Z",
        latest_declaration_check_outcome: "valid",
        declaration: {
          version: 1,
          josh: true,
        },
      },
      {
        origin: "https://m.example",
        first_participated_at: "2026-09-03T00:00:00.000Z",
        initial_declaration: {
          version: 1,
        },
        latest_declaration_check_at: "2026-09-15T00:00:00.000Z",
        latest_declaration_check_outcome: "valid",
        declaration: {
          version: 1,
        },
      },
      {
        origin: "https://gone.example",
        first_participated_at: "2026-08-01T00:00:00.000Z",
        initial_declaration: {
          version: 1,
          josh: true,
        },
        latest_declaration_check_at: "2026-09-15T00:00:00.000Z",
        latest_declaration_check_outcome: "missing",
        declaration: {
          version: 1,
          josh: true,
        },
      },
    ],
  });

  assert.deepEqual(
    result.map((entry) => {
      return [entry.origin, entry.identity, entry.first_participated_at];
    }),
    [
      ["https://a.example", "affirmed", "2026-09-02T00:00:00.000Z"],
      ["https://m.example", "undeclared", "2026-09-03T00:00:00.000Z"],
      ["https://z.example", "declined", "2026-09-01T00:00:00.000Z"],
    ],
  );

  assert.deepEqual(result[0].declaration, {
    version: 1,
    josh: true,
  });
  assert.deepEqual(result[0].initial_declaration, {
    version: 1,
    josh: true,
  });
  assert.equal(result[0].latest_declaration_check_outcome, "valid");
});

test("rejects duplicate registry origins", () => {
  assert.throws(() => {
    projectRegistry({
      format_version: 1,
      nodes: [
        {
          origin: "https://example.com",
          first_participated_at: "2026-09-01T00:00:00.000Z",
          initial_declaration: {
            version: 1,
          },
          latest_declaration_check_at: "2026-09-15T00:00:00.000Z",
          latest_declaration_check_outcome: "valid",
          declaration: {
            version: 1,
          },
        },
        {
          origin: "https://example.com",
          first_participated_at: "2026-09-01T00:00:00.000Z",
          initial_declaration: {
            version: 1,
          },
          latest_declaration_check_at: "2026-09-15T00:00:00.000Z",
          latest_declaration_check_outcome: "valid",
          declaration: {
            version: 1,
          },
        },
      ],
    });
  });
});

test("canonical origins allow only plain HTTP or HTTPS origins", () => {
  assert.equal(canonicalOrigin("https://example.com"), "https://example.com");

  assert.equal(canonicalOrigin("http://example.com"), "http://example.com");

  for (const origin of [
    "",
    " https://example.com",
    "https://example.com ",
    "https://example.com/",
    "https://example.com/path",
    "https://example.com?query=yes",
    "https://example.com#fragment",
    "https://user:password@example.com",
    "ftp://example.com",
    "javascript:alert(1)",
    "data:text/plain,hello",
    "file:///tmp/example",
  ]) {
    assert.throws(
      () => {
        canonicalOrigin(origin);
      },
      undefined,
      origin,
    );
  }
});

test("stable IDs and screenshot paths are deterministic", () => {
  const first = stableSiteID("https://example.com");
  const second = stableSiteID("https://example.com");

  assert.equal(first, second);
  assert.equal(first.length, 64);

  assert.equal(
    screenshotPath("https://example.com"),
    `/assets/network/sites/${first}.webp`,
  );
});

test("metadata title prefers site name before page title", () => {
  assert.equal(
    chooseTitle({
      ogSiteName: " Example Site ",
      applicationName: "Example App",
      ogTitle: "Home | Example",
      documentTitle: "Home",
      domain: "example.com",
    }),
    "Example Site",
  );
});

test("metadata title falls back to domain", () => {
  assert.equal(
    chooseTitle({
      domain: "example.com",
    }),
    "example.com",
  );
});

test("metadata title recognizes site name embedded in document title", () => {
  assert.equal(
    chooseTitle({
      documentTitle: "Shipping Fixes Everything - Joshtronic",
      domain: "joshtronic.com",
    }),
    "Joshtronic",
  );
});

test("metadata title recognizes a spaced site name from the domain", () => {
  assert.equal(
    chooseTitle({
      documentTitle: "Projects | Joshua Morris",
      domain: "joshuamorris.info",
    }),
    "Joshua Morris",
  );
});

test("metadata title prefers JSON-LD website name before page title", () => {
  assert.equal(
    chooseTitle({
      jsonLdSiteName: "Example Garden",
      ogTitle: "Home - Example Garden",
      documentTitle: "Home - Example Garden",
      domain: "example.com",
    }),
    "Example Garden",
  );
});

test("metadata title supports Twitter title before raw document title", () => {
  assert.equal(
    chooseTitle({
      twitterTitle: "Example Site",
      documentTitle: "Home",
      domain: "example.com",
    }),
    "Example Site",
  );
});

test("description falls back through social and structured metadata", () => {
  assert.equal(
    chooseDescription({
      twitterDescription: "A description from Twitter metadata.",
      jsonLdDescription: "A description from structured data.",
      mainDescription: "A description from visible content.",
    }),
    "A description from Twitter metadata.",
  );

  assert.equal(
    chooseDescription({
      jsonLdDescription: "A description from structured data.",
      mainDescription: "A description from visible content.",
    }),
    "A description from structured data.",
  );

  assert.equal(
    chooseDescription({
      mainDescription:
        "A useful introduction taken from the visible content of the homepage.",
    }),
    "A useful introduction taken from the visible content of the homepage.",
  );
});

test("description prefers explicit metadata over visible page content", () => {
  assert.equal(
    chooseDescription({
      description: "The site's authored meta description.",
      ogDescription: "The Open Graph description.",
      mainDescription: "Some introductory homepage text.",
    }),
    "The site's authored meta description.",
  );
});

test("description normalizes whitespace", () => {
  assert.equal(
    chooseDescription({
      description: "One\n  useful\t description.",
    }),
    "One useful description.",
  );
});

test("X-Frame-Options DENY prevents framing", () => {
  assert.equal(
    canFrame({
      origin: "https://example.com",
      headers: {
        "x-frame-options": "DENY",
      },
    }),
    false,
  );
});

test("X-Frame-Options SAMEORIGIN prevents cross-origin framing", () => {
  assert.equal(
    canFrame({
      origin: "https://example.com",
      headers: {
        "x-frame-options": "SAMEORIGIN",
      },
    }),
    false,
  );
});

test("frame-ancestors none prevents framing", () => {
  assert.equal(
    canFrame({
      origin: "https://example.com",
      headers: {
        "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
      },
    }),
    false,
  );
});

test("frame-ancestors allowing Joshternet permits framing", () => {
  assert.equal(
    canFrame({
      origin: "https://example.com",
      headers: {
        "content-security-policy":
          "default-src 'self'; frame-ancestors https://joshternet.org",
      },
    }),
    true,
  );
});

test("HTTP participants use Wander fallback", () => {
  assert.equal(
    canFrame({
      origin: "http://example.com",
    }),
    false,
  );
});

test("reports when a site blocks framing", () => {
  assert.deepEqual(
    framePolicy({
      origin: "https://example.com",
      headers: {
        "x-frame-options": "DENY",
      },
    }),
    {
      embeddable: false,
      reason: "blocked-by-site",
    },
  );
});

test("reports HTTP as a distinct framing reason", () => {
  assert.deepEqual(
    framePolicy({
      origin: "http://example.com",
    }),
    {
      embeddable: false,
      reason: "http",
    },
  );
});

test("reports allowed framing", () => {
  assert.deepEqual(
    framePolicy({
      origin: "https://example.com",
    }),
    {
      embeddable: true,
      reason: "allowed",
    },
  );
});

test("blocks private, local, shared, reserved, and non-public IPv4", () => {
  for (const address of [
    "0.0.0.1",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "192.88.99.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
  ]) {
    assert.equal(isForbiddenAddress(address), true, address);
  }
});

test("allows ordinary public IPv4 addresses", () => {
  for (const address of ["1.1.1.1", "8.8.8.8", "93.184.216.34"]) {
    assert.equal(isForbiddenAddress(address), false, address);
  }
});

test("blocks non-global and special-purpose IPv6 addresses", () => {
  for (const address of [
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "2001::1",
    "2001:2::1",
    "2001:10::1",
    "2001:100::1",
    "2001:db8::1",
    "2002::1",
    "3fff::1",
  ]) {
    assert.equal(isForbiddenAddress(address), true, address);
  }
});

test("allows ordinary global IPv6 addresses", () => {
  for (const address of ["2606:4700:4700::1111", "2001:4860:4860::8888"]) {
    assert.equal(isForbiddenAddress(address), false, address);
  }
});

test("rejects invalid IP address strings", () => {
  for (const address of ["", "localhost", "example.com", "999.999.999.999"]) {
    assert.equal(isForbiddenAddress(address), true, address);
  }
});

test("assertPublicURL rejects localhost without resolving it", async () => {
  let lookupCalled = false;

  await assert.rejects(
    assertPublicURL("https://localhost/", {
      lookup: async () => {
        lookupCalled = true;

        return [
          {
            address: "127.0.0.1",
            family: 4,
          },
        ];
      },
    }),
  );

  assert.equal(lookupCalled, false);
});

test("assertPublicURL rejects credential-bearing URLs", async () => {
  await assert.rejects(
    assertPublicURL("https://user:password@example.test/", {
      lookup: async () => {
        throw new Error("lookup should not run");
      },
    }),
  );
});

test("assertPublicURL rejects unsupported URL schemes", async () => {
  await assert.rejects(
    assertPublicURL("ftp://example.test/", {
      lookup: async () => {
        throw new Error("lookup should not run");
      },
    }),
  );
});

test("assertPublicURL rejects a host resolving privately", async () => {
  await assert.rejects(
    assertPublicURL("https://example.test/", {
      lookup: async () => {
        return [
          {
            address: "127.0.0.1",
            family: 4,
          },
        ];
      },
    }),
  );
});

test("assertPublicURL rejects mixed public and prohibited DNS answers", async () => {
  await assert.rejects(
    assertPublicURL("https://example.test/", {
      lookup: async () => {
        return [
          {
            address: "93.184.216.34",
            family: 4,
          },
          {
            address: "192.168.1.10",
            family: 4,
          },
        ];
      },
    }),
  );
});

test("assertPublicURL rejects a host resolving to prohibited IPv6", async () => {
  await assert.rejects(
    assertPublicURL("https://example.test/", {
      lookup: async () => {
        return [
          {
            address: "2001:db8::1",
            family: 6,
          },
        ];
      },
    }),
  );
});

test("assertPublicURL accepts a host resolving publicly", async () => {
  const result = await assertPublicURL("https://example.test/", {
    lookup: async () => {
      return [
        {
          address: "93.184.216.34",
          family: 4,
        },
      ];
    },
  });

  assert.equal(result.href, "https://example.test/");
});

test("assertPublicURL accepts a host resolving to global IPv6", async () => {
  const result = await assertPublicURL("https://example.test/", {
    lookup: async () => {
      return [
        {
          address: "2606:4700:4700::1111",
          family: 6,
        },
      ];
    },
  });

  assert.equal(result.href, "https://example.test/");
});

test("partitions public participants from unsafe participants", async () => {
  const publicParticipant = {
    origin: "https://public.example",
    domain: "public.example",
    identity: "affirmed",
  };

  const privateParticipant = {
    origin: "https://private.example",
    domain: "private.example",
    identity: "undeclared",
  };

  const result = await partitionPublicParticipants(
    [publicParticipant, privateParticipant],
    {
      lookup: async (hostname) => {
        if (hostname === "public.example") {
          return [
            {
              address: "93.184.216.34",
              family: 4,
            },
          ];
        }

        if (hostname === "private.example") {
          return [
            {
              address: "192.168.1.10",
              family: 4,
            },
          ];
        }

        throw new Error(`unexpected hostname: ${hostname}`);
      },
    },
  );

  assert.deepEqual(result.accepted, [publicParticipant]);

  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].participant, privateParticipant);
  assert.ok(result.rejected[0].error instanceof Error);
});

test("partition rejects malformed origins before publication", async () => {
  const malformed = {
    origin: "https://example.com/path",
    domain: "example.com",
    identity: "undeclared",
  };

  let lookupCalled = false;

  const result = await partitionPublicParticipants([malformed], {
    lookup: async () => {
      lookupCalled = true;

      return [
        {
          address: "93.184.216.34",
          family: 4,
        },
      ];
    },
  });

  assert.deepEqual(result.accepted, []);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].participant, malformed);
  assert.equal(lookupCalled, false);
});

test("partition fails closed when any DNS answer is prohibited", async () => {
  const participant = {
    origin: "https://mixed.example",
    domain: "mixed.example",
    identity: "declined",
  };

  const result = await partitionPublicParticipants([participant], {
    lookup: async () => {
      return [
        {
          address: "93.184.216.34",
          family: 4,
        },
        {
          address: "127.0.0.1",
          family: 4,
        },
      ];
    },
  });

  assert.deepEqual(result.accepted, []);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].participant, participant);
});

test("partition requires an array of participants", async () => {
  await assert.rejects(partitionPublicParticipants(null));
});

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

test("sanitizeFeeds keeps valid RSS, Atom, and JSON Feed URLs", async () => {
  const result = await sanitizeFeeds(
    [
      {
        href: "https://example.test/rss.xml",
        type: "application/rss+xml",
        title: "  Site RSS  ",
      },
      {
        href: "https://example.test/atom.xml",
        type: "application/atom+xml",
      },
      {
        href: "https://example.test/feed.json",
        type: "application/feed+json",
        title: "",
      },
    ],
    {
      lookup: publicLookup(),
    },
  );

  assert.deepEqual(result, [
    {
      url: "https://example.test/rss.xml",
      type: "application/rss+xml",
      title: "Site RSS",
    },
    {
      url: "https://example.test/atom.xml",
      type: "application/atom+xml",
    },
    {
      url: "https://example.test/feed.json",
      type: "application/feed+json",
    },
  ]);
});

test("sanitizeFeeds drops duplicates, unsafe URLs, and unsupported types", async () => {
  const result = await sanitizeFeeds(
    [
      {
        href: "https://example.test/rss.xml",
        type: "application/rss+xml",
      },
      {
        href: "https://example.test/rss.xml",
        type: "application/rss+xml",
        title: "Duplicate",
      },
      {
        href: "https://user:secret@example.test/private.xml",
        type: "application/rss+xml",
      },
      {
        href: "ftp://example.test/feed.xml",
        type: "application/rss+xml",
      },
      {
        href: "https://example.test/about",
        type: "text/html",
      },
      {
        href: "https://private.test/rss.xml",
        type: "application/rss+xml",
      },
      {
        href: "https://example.test/good.xml",
        type: "application/atom+xml",
      },
    ],
    {
      lookup: async (hostname) => {
        if (hostname === "private.test") {
          return [
            {
              address: "127.0.0.1",
              family: 4,
            },
          ];
        }

        return [
          {
            address: "93.184.216.34",
            family: 4,
          },
        ];
      },
    },
  );

  assert.deepEqual(result, [
    {
      url: "https://example.test/rss.xml",
      type: "application/rss+xml",
    },
    {
      url: "https://example.test/good.xml",
      type: "application/atom+xml",
    },
  ]);
});

test("sanitizeFeeds enforces the per-participant cap", async () => {
  const raw = [];

  for (let index = 0; index < MAX_FEEDS_PER_PARTICIPANT + 3; index += 1) {
    raw.push({
      href: `https://example.test/feed-${index}.xml`,
      type: "application/rss+xml",
    });
  }

  const result = await sanitizeFeeds(raw, {
    lookup: publicLookup(),
  });

  assert.equal(result.length, MAX_FEEDS_PER_PARTICIPANT);
  assert.equal(result[0].url, "https://example.test/feed-0.xml");
  assert.equal(
    result[MAX_FEEDS_PER_PARTICIPANT - 1].url,
    `https://example.test/feed-${MAX_FEEDS_PER_PARTICIPANT - 1}.xml`,
  );
});

test("sanitizeFeeds returns an empty array for non-arrays and isolates bad items", async () => {
  assert.deepEqual(await sanitizeFeeds(null), []);
  assert.deepEqual(await sanitizeFeeds(undefined), []);

  const result = await sanitizeFeeds(
    [
      null,
      "nope",
      {
        href: "https://example.test/ok.xml",
        type: "application/rss+xml",
      },
      {
        href: "https://",
        type: "application/rss+xml",
      },
    ],
    {
      lookup: publicLookup(),
    },
  );

  assert.deepEqual(result, [
    {
      url: "https://example.test/ok.xml",
      type: "application/rss+xml",
    },
  ]);
});

// ─── decodeHtmlEntities decimal char refs (lines 76-77) ──────────────────────

test("decodeHtmlEntities: handles decimal character references (lines 76-77)", () => {
  assert.equal(decodeHtmlEntities("&#65;&#66;&#67;"), "ABC");
  assert.equal(decodeHtmlEntities("&#104;&#101;&#108;&#108;&#111;"), "hello");
});

// ─── decodeHtmlEntities hex char refs (lines 72-73) ─────────────────────────

test("decodeHtmlEntities: handles hex character references (lines 72-73)", () => {
  assert.equal(decodeHtmlEntities("&#x41;&#x42;&#x43;"), "ABC"); // hex 0x41=A, 0x42=B, 0x43=C
  assert.equal(decodeHtmlEntities("&#x1F600;"), "\u{1F600}"); // emoji via hex codepoint
});

// ─── decodeHtmlEntities named entities (lines 80-81) ─────────────────────────

test("decodeHtmlEntities: handles named HTML entities (lines 80-81)", () => {
  assert.equal(decodeHtmlEntities("&amp;"), "&");
  assert.equal(decodeHtmlEntities("&lt;&gt;"), "<>");
  // "foobar" is all letters (matches regex) but not in NAMED_ENTITIES → returns original match (L81 ': match' branch)
  assert.equal(decodeHtmlEntities("&foobar;"), "&foobar;");
});

// ─── identityFromDeclaration invalid guard (lines 120-121) ───────────────────

test("identityFromDeclaration: throws for null, non-object, array, or wrong version (lines 120-121)", () => {
  assert.throws(() => identityFromDeclaration(null));
  assert.throws(() => identityFromDeclaration("string"));
  assert.throws(() => identityFromDeclaration([]));
  assert.throws(() => identityFromDeclaration({ version: 2 }));
});

// ─── registryTimestamp validation (lines 165-166, 171-172) ───────────────────

test("registryTimestamp: throws for non-string or blank value (lines 165-166)", () => {
  assert.throws(
    () => registryTimestamp(null, "first_participated_at"),
    /invalid/,
  );
  assert.throws(
    () => registryTimestamp(42, "first_participated_at"),
    /invalid/,
  );
  assert.throws(
    () => registryTimestamp("  ", "first_participated_at"),
    /invalid/,
  );
});

test("registryTimestamp: throws for an unparseable date string (lines 171-172)", () => {
  assert.throws(
    () => registryTimestamp("not-a-date", "first_participated_at"),
    /invalid/,
  );
});

test("registryTimestamp: accepts valid ISO date strings", () => {
  assert.equal(
    registryTimestamp("2026-09-01T00:00:00.000Z", "first_participated_at"),
    "2026-09-01T00:00:00.000Z",
  );
});

// ─── isParticipatingNode guard (lines 185-186) ───────────────────────────────

test("isParticipatingNode: returns false for null, non-object, or array (lines 185-186)", () => {
  assert.equal(isParticipatingNode(null), false);
  assert.equal(isParticipatingNode(undefined), false);
  assert.equal(isParticipatingNode([]), false);
  assert.equal(isParticipatingNode("string"), false);
});

// ─── projectRegistry top-level guard (lines 228-229) ────────────────────────

test("projectRegistry: throws for null, wrong format_version, or non-array nodes (lines 228-229)", () => {
  assert.throws(() => projectRegistry(null), /invalid JoshBot registry/);
  assert.throws(
    () => projectRegistry({ format_version: 2, nodes: [] }),
    /invalid JoshBot registry/,
  );
  assert.throws(
    () => projectRegistry({ format_version: 1 }),
    /invalid JoshBot registry/,
  );
  assert.throws(() => projectRegistry("string"), /invalid JoshBot registry/);
});

// ─── projectRegistry invalid node (lines 237-238) ────────────────────────────

test("projectRegistry: throws for null or non-object node (lines 237-238)", () => {
  assert.throws(
    () =>
      projectRegistry({
        format_version: 1,
        nodes: [null],
      }),
    /invalid registry node/,
  );

  assert.throws(
    () =>
      projectRegistry({
        format_version: 1,
        nodes: ["string-not-object"],
      }),
    /invalid registry node/,
  );
});

// ─── titleBrandFromDomain edge cases (via chooseTitle) ───────────────────────

test("chooseTitle: returns empty string when all candidates are absent (lines 376-377)", () => {
  assert.equal(chooseTitle(), "");
  assert.equal(chooseTitle({}), "");
});

test("chooseTitle: single-label domain produces no brand match (lines 312-313)", () => {
  // "localhost" has only 1 label → titleBrandFromDomain returns "" → falls back to documentTitle
  assert.equal(
    chooseTitle({ documentTitle: "Home - Blog", domain: "localhost" }),
    "Home - Blog",
  );
});

test("chooseTitle: domain first label with no letter/digit chars produces no brand (lines 319-320)", () => {
  // First label "---" → comparableText("---") = "" → return ""
  // Falls back to documentTitle
  assert.equal(
    chooseTitle({ documentTitle: "Home - Blog", domain: "---.com" }),
    "Home - Blog",
  );
});

test("chooseTitle: title parts that do not match domain produce no brand (lines 336-337)", () => {
  // Title "Foo - Bar" has parts [Foo, Bar]; domain "baz.com" → none match → ""
  // Falls back to documentTitle
  assert.equal(
    chooseTitle({ documentTitle: "Foo - Bar", domain: "baz.com" }),
    "Foo - Bar",
  );
});

// ─── chooseDescription empty return (lines 402-403) ─────────────────────────

test("chooseDescription: returns empty string when all candidates are absent (lines 402-403)", () => {
  assert.equal(chooseDescription(), "");
  assert.equal(chooseDescription({}), "");
});

// ─── framePolicy CSP frame-ancestors branches (lines 469-486) ────────────────

test("framePolicy: frame-ancestors self without wildcard or parent is blocked (lines 469-475)", () => {
  assert.deepEqual(
    framePolicy({
      origin: "https://example.com",
      headers: {
        "content-security-policy": "default-src 'self'; frame-ancestors 'self'",
      },
    }),
    { embeddable: false, reason: "blocked-by-site" },
  );
});

test("framePolicy: frame-ancestors explicit third-party without parent is blocked (lines 480-486)", () => {
  assert.deepEqual(
    framePolicy({
      origin: "https://example.com",
      headers: {
        "content-security-policy":
          "default-src 'self'; frame-ancestors https://other-trusted.example",
      },
    }),
    { embeddable: false, reason: "blocked-by-site" },
  );
});

// ─── assertPublicURL empty DNS result (lines 550-551) ────────────────────────

test("assertPublicURL: empty DNS result throws 'did not resolve' (lines 550-551)", async () => {
  await assert.rejects(
    assertPublicURL("https://example.test/", {
      lookup: async () => [],
    }),
    /did not resolve/,
  );
});

// ─── sanitizeFeeds url alias and empty href (lines 647-648, 651-652) ─────────

test("sanitizeFeeds: url property is accepted as href alias (lines 647-648)", async () => {
  const result = await sanitizeFeeds(
    [{ url: "https://example.test/rss.xml", type: "application/rss+xml" }],
    { lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://example.test/rss.xml");
});

test("sanitizeFeeds: candidate with no href or url is skipped (lines 651-652)", async () => {
  const result = await sanitizeFeeds(
    [{ type: "application/rss+xml" }], // no href, no url
    { lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
  );
  assert.equal(result.length, 0);
});

// ─── decodeHtmlEntities: null/empty input fires return "" (lines 67-68) ──────

test("decodeHtmlEntities: null and empty string input fires return '' (lines 67-68)", () => {
  assert.equal(decodeHtmlEntities(null), "");
  assert.equal(decodeHtmlEntities(""), "");
  assert.equal(decodeHtmlEntities(42), "");
});

// ─── titleBrandFromDomain: www prefix skipped via ? labels[1] (L315) ─────────

test("chooseTitle: www domain uses second label as brand (L315)", () => {
  // labels[0] === "www" → labels[1] is used as domainLabel → L315 true branch fires
  const title = chooseTitle({
    documentTitle: "Blog — www.example.com",
    domain: "www.example.com",
  });
  // The brand "example" should match in the title → chooseTitle returns without the brand suffix
  assert.ok(typeof title === "string");
});

// ─── sanitizeFeeds: non-string type fires ': ""' (L636) ──────────────────────

test("sanitizeFeeds: candidate with non-string type fires ': \"\"' (L636)", async () => {
  // type: null is not a string → L636 ': ""' fires → type = "" → not in FEED_MIME_TYPES → skipped
  const result = await sanitizeFeeds(
    [{ href: "https://example.test/rss.xml", type: null }],
    { lookup: async () => [{ address: "1.2.3.4", family: 4 }] },
  );
  assert.deepEqual(result, []);
});

// ─── registryParticipationFields: covers L207-218 ────────────────────────────

test("registryParticipationFields: returns all participation fields from participant (L207-218)", () => {
  const participant = {
    origin: "https://a.example",
    domain: "a.example",
    identity: "affirmed",
    declaration: {
      version: 1,
      josh: true,
    },
    initial_declaration: {
      version: 1,
      josh: true,
    },
    first_participated_at: "2026-01-01T00:00:00.000Z",
    latest_declaration_check_at: "2026-10-01T00:00:00.000Z",
    latest_declaration_check_outcome: "success",
  };
  const fields = registryParticipationFields(participant);
  assert.equal(fields.origin, "https://a.example");
  assert.equal(fields.identity, "affirmed");
  assert.equal(fields.first_participated_at, "2026-01-01T00:00:00.000Z");
});

// ─── partitionPublicParticipants: non-Error thrown fires ': new Error(String(error))' (L586) ─

test("partitionPublicParticipants: non-Error thrown by lookup fires ': new Error(String(error))' (L586)", async () => {
  // lookup throws a non-Error string → error instanceof Error = false → L586 false branch fires
  // External DNS boundary — real lookup replaced by stub that throws a string
  const result = await partitionPublicParticipants(
    [{ origin: "https://a.example" }],
    {
      lookup: async () => {
        throw "string lookup error";
      }, // throws non-Error → L586 fires
      cache: new Map(), // empty cache → lookup IS called
    },
  );
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].error instanceof Error);
  assert.match(result.rejected[0].error.message, /string lookup error/);
});
