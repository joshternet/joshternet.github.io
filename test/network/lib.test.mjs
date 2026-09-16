import assert from "node:assert/strict";
import test from "node:test";

import {
    assertPublicURL,
    canFrame,
    chooseDescription,
    chooseTitle,
    framePolicy,
    identityFromDeclaration,
    isForbiddenAddress,
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
            return [
                entry.origin,
                entry.identity,
            ];
        }),
        [
            [
                "https://a.example",
                "affirmed",
            ],
            [
                "https://m.example",
                "undeclared",
            ],
            [
                "https://z.example",
                "declined",
            ],
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
                "content-security-policy":
                    "default-src 'self'; frame-ancestors 'none'",
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

test("blocks common private and reserved IPv4 ranges", () => {
    for (const address of [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.1.1",
        "100.64.0.1",
        "224.0.0.1",
    ]) {
        assert.equal(
            isForbiddenAddress(address),
            true,
            address,
        );
    }
});

test("allows ordinary public IPv4 addresses", () => {
    assert.equal(
        isForbiddenAddress("8.8.8.8"),
        false,
    );

    assert.equal(
        isForbiddenAddress("1.1.1.1"),
        false,
    );
});

test("blocks loopback, unique-local, link-local, and multicast IPv6", () => {
    for (const address of [
        "::1",
        "fc00::1",
        "fd00::1",
        "fe80::1",
        "ff02::1",
    ]) {
        assert.equal(
            isForbiddenAddress(address),
            true,
            address,
        );
    }
});

test("assertPublicURL rejects a host resolving privately", async () => {
    await assert.rejects(
        assertPublicURL(
            "https://example.test/",
            {
                lookup: async () => {
                    return [
                        {
                            address: "127.0.0.1",
                            family: 4,
                        },
                    ];
                },
            },
        ),
    );
});

test("assertPublicURL accepts a host resolving publicly", async () => {
    const result = await assertPublicURL(
        "https://example.test/",
        {
            lookup: async () => {
                return [
                    {
                        address: "93.184.216.34",
                        family: 4,
                    },
                ];
            },
        },
    );

    assert.equal(
        result.href,
        "https://example.test/",
    );
});
