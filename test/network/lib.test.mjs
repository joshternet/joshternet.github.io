import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPublicURL,
  canFrame,
  canonicalOrigin,
  chooseDescription,
  chooseTitle,
  framePolicy,
  identityFromDeclaration,
  isForbiddenAddress,
  partitionPublicParticipants,
  projectRegistry,
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
        declaration: {
          version: 1,
          josh: false,
        },
      },
      {
        origin: "https://a.example",
        declaration: {
          version: 1,
          josh: true,
        },
      },
      {
        origin: "https://m.example",
        declaration: {
          version: 1,
        },
      },
    ],
  });

  assert.deepEqual(
    result.map((entry) => {
      return [entry.origin, entry.identity];
    }),
    [
      ["https://a.example", "affirmed"],
      ["https://m.example", "undeclared"],
      ["https://z.example", "declined"],
    ],
  );
});

test("rejects duplicate registry origins", () => {
  assert.throws(() => {
    projectRegistry({
      format_version: 1,
      nodes: [
        {
          origin: "https://example.com",
          declaration: {
            version: 1,
          },
        },
        {
          origin: "https://example.com",
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
