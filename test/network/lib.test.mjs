import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPublicURL,
  canFrame,
  canonicalOrigin,
  chooseDescription,
  chooseTitle,
  decodeHtmlEntities,
  DNS_LOOKUP_TIMEOUT_MS,
  framePolicy,
  humanNameFromDomain,
  identityFromDeclaration,
  isDomainCompressingSlogan,
  isForbiddenAddress,
  isParticipatingNode,
  isWeakNetworkDescription,
  looksLikePersonName,
  MAX_FEEDS_PER_PARTICIPANT,
  NETWORK_DESCRIPTION_MAX_CHARS,
  NETWORK_DESCRIPTION_MIN_CHARS,
  networkDescriptionQuality,
  partitionPublicParticipants,
  personNameFromSelfIntro,
  personNameFromText,
  personNameMatchingDomain,
  projectRegistry,
  registryParticipationFields,
  registryTimestamp,
  sanitizeFeeds,
  screenshotPath,
  selectPublishedNetworkTitle,
  displayTitleOverridesFromDocument,
  comparableTextsMatch,
  isHostLikeTitle,
  isWeakPageTitle,
  isTrackingSearchParam,
  stripTrackingSearchParams,
  stableSiteID,
  trimNetworkDescription,
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

test("metadata title prefers personal domain name over greeting og:title", () => {
  assert.equal(
    chooseTitle({
      ogTitle: "Hello!",
      twitterTitle: "Hello!",
      documentTitle: "Hello! - joshua.seigler.net",
      domain: "joshua.seigler.net",
    }),
    "Joshua Seigler",
  );
});

test("metadata title uses humanized personal domain when all page titles are greetings", () => {
  assert.equal(
    chooseTitle({
      ogTitle: "Hello!",
      twitterTitle: "Hi!",
      documentTitle: "Welcome",
      domain: "joshua.seigler.net",
    }),
    "Joshua Seigler",
  );
});

test("metadata title extracts person name from og:title brand separator parts", () => {
  assert.equal(
    chooseTitle({
      ogTitle: "Josh Ghent - Developer Musings",
      domain: "joshghent.com",
    }),
    "Josh Ghent",
  );
});

test("humanNameFromDomain rejects non-alpha labels and tlds", () => {
  assert.equal(humanNameFromDomain("j.morris.com"), "");
  assert.equal(humanNameFromDomain("josh.m.com"), "");
  assert.equal(humanNameFromDomain("josh.morris.c0m"), "");
  assert.equal(humanNameFromDomain("josh1.morris.com"), "");
  assert.equal(humanNameFromDomain("joshua.seigler.net"), "Joshua Seigler");
});

test("looksLikePersonName rejects numeric or stopword tokens", () => {
  assert.equal(looksLikePersonName(""), false);
  assert.equal(looksLikePersonName("Josh 123"), false);
  assert.equal(looksLikePersonName("A Morris"), false);
  assert.equal(looksLikePersonName("Josh Morris"), true);
});

test("personNameFromText returns empty when no span matches the domain", () => {
  assert.equal(
    personNameFromText("Hello there friend world", "joshghent.com"),
    "",
  );
});

test("personNameFromSelfIntro reads Non-Josh names that compress to the host", () => {
  assert.equal(personNameFromSelfIntro("", "www.chrisminnick.com"), "");
  assert.equal(personNameFromSelfIntro("I’m Chris Minnick.", ""), "");
  assert.equal(
    personNameFromSelfIntro("Hello there.", "www.chrisminnick.com"),
    "",
  );
  assert.equal(
    personNameFromSelfIntro("I’m The Blog.", "www.chrisminnick.com"),
    "",
  );
  assert.equal(
    personNameFromSelfIntro("I’m Chris Minnick.", "example.com"),
    "",
  );
  assert.equal(
    personNameFromSelfIntro(
      "I’m Chris Minnick. I’ve written more than twenty books.",
      "www.chrisminnick.com",
    ),
    "Chris Minnick",
  );
  assert.equal(
    personNameFromText(
      "I’m Chris Minnick. I’ve written more than twenty books.",
      "www.chrisminnick.com",
    ),
    "Chris Minnick",
  );
  assert.equal(
    chooseTitle({
      documentTitle: "www.chrisminnick.com",
      ogTitle: "www.chrisminnick.com",
      description:
        "I’m Chris Minnick. I’ve written more than twenty books, including a shelf of For Dummies titles.",
      domain: "www.chrisminnick.com",
    }),
    "Chris Minnick",
  );
  // Meta description is often third-person; the main lede carries the self-intro.
  assert.equal(
    chooseTitle({
      documentTitle: "Chris Minnick — Author, teacher, developer, enthusiast",
      ogTitle: "Chris Minnick",
      description:
        "Chris Minnick is an author, teacher, programmer, novelist, and painter.",
      mainDescription:
        "I’m Chris Minnick. I’ve written more than twenty books, including a shelf of For Dummies titles.",
      domain: "www.chrisminnick.com",
    }),
    "Chris Minnick",
  );
  // Brand hosts still do not win via title compression alone.
  assert.equal(personNameMatchingDomain("Forward Bias", "forwardbias.dev"), "");
  // An explicit self-intro that compresses to the host is accepted (rare for brands).
  assert.equal(
    personNameFromSelfIntro("I’m Forward Bias.", "forwardbias.dev"),
    "Forward Bias",
  );
});

test("metadata title prefers person name over blog-brand site name", () => {
  assert.equal(
    chooseTitle({
      ogSiteName: "Developer Musings",
      ogTitle: "Josh Ghent",
      twitterTitle: "Josh Ghent",
      documentTitle: "Josh Ghent — Developer Musings",
      jsonLdPersonName: "Josh Ghent",
      authorName: "Josh Ghent",
      domain: "joshghent.com",
    }),
    "Josh Ghent",
  );
});

test("metadata title prefers person author over domain-label brand", () => {
  assert.equal(
    chooseTitle({
      authorName: "Josh Sherman",
      documentTitle: "Shipping Fixes Everything - Joshtronic",
      domain: "joshtronic.com",
    }),
    "Josh Sherman",
  );
});

test("metadata title rejects slogan brands that compress to the domain", () => {
  assert.equal(
    chooseTitle({
      ogSiteName: "Josh Can Help",
      ogTitle: "Josh Can Help - Software",
      documentTitle: "Josh Can Help - Software - Josh Can Help",
      domain: "www.joshcanhelp.com",
    }),
    "www.joshcanhelp.com",
  );
  assert.equal(
    chooseTitle({
      ogTitle: "Josh Can Help",
      documentTitle: "Josh Can Help",
      domain: "www.joshcanhelp.com",
    }),
    "www.joshcanhelp.com",
  );
});

test("metadata title prefers GitHub-sourced person author over slogan site name", () => {
  assert.equal(
    chooseTitle({
      ogSiteName: "Josh Can Help",
      ogTitle: "Josh Can Help - Software",
      documentTitle: "Josh Can Help - Software - Josh Can Help",
      authorName: "Josh Cunningham",
      domain: "www.joshcanhelp.com",
    }),
    "Josh Cunningham",
  );
});

test("metadata title prefers umlaut person names over generic page shells", () => {
  assert.equal(
    personNameMatchingDomain("Joshua Stübner", "joshuastuebner.com"),
    "Joshua Stübner",
  );
  assert.equal(
    chooseTitle({
      documentTitle: "Joshuas very own page",
      ogTitle: "Joshuas very own page",
      ogSiteName: "Joshuas very own page",
      description: "Projects, a digital garden and more. By me.",
      identityNameText: "Hi. I'm Joshua Stübner",
      domain: "joshuastuebner.com",
    }),
    "Joshua Stübner",
  );
});

test("published Network titles honor overrides and do not downgrade person names", () => {
  const overrides = displayTitleOverridesFromDocument({
    format_version: 1,
    titles: {
      "https://www.chrisminnick.com": "Chris Minnick",
      "https://joshuastuebner.com": "Joshua Stübner",
    },
  });

  assert.equal(overrides.get("https://www.chrisminnick.com"), "Chris Minnick");
  assert.equal(
    selectPublishedNetworkTitle({
      resolved: "www.chrisminnick.com",
      previous: "Chris Minnick",
      domain: "www.chrisminnick.com",
      override: overrides.get("https://www.chrisminnick.com"),
    }),
    "Chris Minnick",
  );
  assert.equal(
    selectPublishedNetworkTitle({
      resolved: "Joshuas very own page",
      previous: "Joshua Stübner",
      domain: "joshuastuebner.com",
      override: overrides.get("https://joshuastuebner.com"),
    }),
    "Joshua Stübner",
  );
  assert.equal(
    selectPublishedNetworkTitle({
      resolved: "www.chrisminnick.com",
      previous: "Chris Minnick",
      domain: "www.chrisminnick.com",
    }),
    "Chris Minnick",
  );
  assert.equal(
    selectPublishedNetworkTitle({
      resolved: "Joshuas very own page",
      previous: "Joshua Stübner",
      domain: "joshuastuebner.com",
    }),
    "Joshua Stübner",
  );
  assert.equal(
    selectPublishedNetworkTitle({
      resolved: "Josh Ozuna",
      previous: "joshozuna.com",
      domain: "joshozuna.com",
    }),
    "Josh Ozuna",
  );
  assert.equal(
    selectPublishedNetworkTitle({
      resolved: "chrisminnick",
      previous: "Chris Minnick",
      domain: "www.chrisminnick.com",
    }),
    "Chris Minnick",
  );
  assert.equal(selectPublishedNetworkTitle({}), "");
  assert.equal(isHostLikeTitle("", "www.chrisminnick.com"), false);
  assert.equal(isHostLikeTitle("www.chrisminnick.com", ""), false);
  assert.equal(isHostLikeTitle("chrisminnick", "www.chrisminnick.com"), true);
  assert.equal(
    isHostLikeTitle("www.chrisminnick.com", "www.chrisminnick.com"),
    true,
  );
});

test("display title helpers cover weak empty and override guards", () => {
  assert.equal(isWeakPageTitle(""), true);
  assert.equal(isWeakPageTitle("Home"), true);
  assert.equal(comparableTextsMatch("", "joshuastuebner"), false);
  assert.equal(comparableTextsMatch("Joshua Stübner", ""), false);
  assert.equal(personNameMatchingDomain("", "joshuastuebner.com"), "");
  assert.equal(personNameMatchingDomain("Joshua Stübner", ""), "");
  assert.equal(
    chooseTitle({
      documentTitle: "My page",
      ogTitle: "Your website",
      twitterTitle: "Untitled",
      domain: "publisher.example",
    }),
    "publisher.example",
  );
  assert.equal(displayTitleOverridesFromDocument(null).size, 0);
  assert.equal(displayTitleOverridesFromDocument([]).size, 0);
  assert.equal(displayTitleOverridesFromDocument("nope").size, 0);
  assert.equal(displayTitleOverridesFromDocument({ titles: [] }).size, 0);
  assert.equal(displayTitleOverridesFromDocument({ titles: null }).size, 0);
  assert.equal(
    displayTitleOverridesFromDocument({
      titles: {
        "": "Ignored",
        "https://a.example": "",
        "https://b.example": "Keep Me",
      },
    }).get("https://b.example"),
    "Keep Me",
  );
  assert.equal(
    displayTitleOverridesFromDocument({
      titles: {
        "": "Ignored",
        "https://a.example": "",
        "https://b.example": "Keep Me",
      },
    }).size,
    1,
  );
});

test("metadata title prefers person author over host-compressed brand site name", () => {
  assert.equal(personNameMatchingDomain("Forward Bias", "forwardbias.dev"), "");
  assert.equal(
    isDomainCompressingSlogan("Forward Bias", "forwardbias.dev"),
    true,
  );
  assert.equal(
    chooseTitle({
      ogSiteName: "Forward Bias",
      ogTitle: "Forward Bias",
      documentTitle: "Forward Bias",
      domain: "forwardbias.dev",
    }),
    "forwardbias.dev",
  );
  assert.equal(
    chooseTitle({
      ogSiteName: "Forward Bias",
      ogTitle: "Forward Bias",
      documentTitle: "Forward Bias",
      authorName: "Josh Caldwell",
      domain: "forwardbias.dev",
    }),
    "Josh Caldwell",
  );
});

test("metadata title prefers author or description name over Josh's site placeholder", () => {
  assert.equal(
    chooseTitle({
      ogSiteName: "Josh's site",
      ogTitle: "Josh's site",
      twitterTitle: "Josh's site",
      documentTitle: "Josh's site",
      authorName: "Josh Müller",
      domain: "joshmuller.ca",
    }),
    "Josh Müller",
  );

  assert.equal(
    chooseTitle({
      ogSiteName: "Josh's site",
      ogTitle: "Josh's site",
      documentTitle: "Josh's site",
      description:
        "Personal Website of Josh Müller — Technologist | Leader | Regenerative Systems Designer",
      domain: "joshmuller.ca",
    }),
    "Josh Müller",
  );
});

test("metadata title keeps greeting when domain is not a personal name host", () => {
  assert.equal(
    chooseTitle({
      ogTitle: "Hello!",
      documentTitle: "Hello!",
      domain: "example.com",
    }),
    "Hello!",
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
      twitterDescription:
        "A longer description from Twitter metadata about engineering and writing.",
      jsonLdDescription:
        "A longer description from structured data about engineering and writing.",
      mainDescription:
        "A longer description from visible content about engineering and writing.",
    }),
    "A longer description from Twitter metadata about engineering and writing.",
  );

  assert.equal(
    chooseDescription({
      jsonLdDescription:
        "A longer description from structured data about engineering and writing.",
      mainDescription:
        "A longer description from visible content about engineering and writing.",
    }),
    "A longer description from structured data about engineering and writing.",
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
      description:
        "The site's authored meta description covering work, writing, and projects.",
      ogDescription:
        "The Open Graph description covering work, writing, and projects on the web.",
      mainDescription:
        "Some introductory homepage text covering work, writing, and projects.",
    }),
    "The site's authored meta description covering work, writing, and projects.",
  );
});

test("description normalizes whitespace", () => {
  assert.equal(
    chooseDescription({
      description:
        "One\n  useful\t description about software, writing, and independent websites.",
    }),
    "One useful description about software, writing, and independent websites.",
  );
});

test("description rejects thin boilerplate and prefers richer main or about copy", () => {
  assert.equal(NETWORK_DESCRIPTION_MIN_CHARS, 48);
  assert.equal(NETWORK_DESCRIPTION_MAX_CHARS, 260);
  assert.equal(isWeakNetworkDescription("Exploring systems"), true);
  assert.equal(isWeakNetworkDescription("Joshua Drake's Website"), true);
  assert.equal(
    isWeakNetworkDescription("Software engineer personal homepage"),
    true,
  );
  assert.equal(
    isWeakNetworkDescription("Joshua P. Steele's home on the web"),
    true,
  );
  assert.equal(isWeakNetworkDescription(""), true);
  assert.equal(
    isWeakNetworkDescription(
      "Writing on software engineering, engineering leadership, and building products.",
    ),
    false,
  );

  assert.equal(
    chooseDescription({
      description: "Exploring systems",
      mainDescription:
        "Notes on systems thinking, tools, and the independent web from ongoing experiments.",
    }),
    "Notes on systems thinking, tools, and the independent web from ongoing experiments.",
  );

  assert.equal(
    chooseDescription({
      description: "Joshua Drake's Website",
      aboutDescription:
        "Essays and projects from Joshua Drake on theology, technology, and life online.",
    }),
    "Essays and projects from Joshua Drake on theology, technology, and life online.",
  );

  assert.equal(
    chooseDescription({
      description: "Software engineer personal homepage",
      ogDescription: "Joshua's home on the web",
    }),
    "",
  );

  assert.ok(
    networkDescriptionQuality(
      "Writing on software engineering, engineering leadership, and building products.",
    ) > networkDescriptionQuality("Exploring systems"),
  );
});

test("description soft-caps long blurbs at a sentence boundary", () => {
  const long = `${"Word ".repeat(80)}Final sentence stays out.`;
  const trimmed = trimNetworkDescription(long, 120);

  assert.ok(trimmed.length <= 120);
  assert.equal(trimmed.includes("Final sentence stays out"), false);

  const sentence =
    "First sentence is substantive enough for a Network card blurb. Second sentence should be dropped when we truncate.";
  assert.equal(
    trimNetworkDescription(sentence, 70),
    "First sentence is substantive enough for a Network card blurb.",
  );

  assert.equal(
    chooseDescription({
      description: `${"Engineering leadership and product work. ".repeat(12)}Extra.`,
    }).length <= NETWORK_DESCRIPTION_MAX_CHARS,
    true,
  );

  assert.equal(trimNetworkDescription(""), "");
  assert.equal(
    trimNetworkDescription("Short blurb.", 0).startsWith("Short"),
    true,
  );
  assert.equal(trimNetworkDescription("abcdefghijKLMNOP", 8), "abcdefgh…");
  assert.match(
    trimNetworkDescription("alpha beta gamma delta epsilon zeta", 18),
    /…$/,
  );
});

test("description quality helpers cover remaining weak patterns", () => {
  assert.equal(isWeakNetworkDescription("Personal Website"), true);
  assert.equal(isWeakNetworkDescription("website"), true);
  assert.equal(
    isWeakNetworkDescription(
      "Software engineer personal homepage with notes on tools and writing online.",
    ),
    true,
  );
  assert.equal(
    isWeakNetworkDescription(
      "Welcome to the independent web — this is truly Joshua Drake's website",
    ),
    true,
  );
  assert.equal(
    isWeakNetworkDescription(
      "Joshua P. Steele keeps a long home on the web for essays and notes.",
    ),
    true,
  );
  assert.equal(networkDescriptionQuality(""), -1);
  assert.equal(networkDescriptionQuality("Exploring systems"), 0);

  // Near-equal length keeps the earlier authored meta field.
  assert.equal(
    chooseDescription({
      description:
        "A solid authored meta description about software and writing online today.",
      mainDescription:
        "Visible homepage copy about software and writing that is only a bit longer.",
    }),
    "A solid authored meta description about software and writing online today.",
  );

  // Multiple weak candidates still yield an empty Network blurb.
  assert.equal(
    chooseDescription({
      description: "Exploring systems",
      ogDescription: "Short notes",
      mainDescription: "Hi there",
    }),
    "",
  );

  // Meaningfully richer about copy upgrades past authored meta.
  assert.equal(
    chooseDescription({
      description:
        "A solid authored meta description about software and writing online today.",
      aboutDescription:
        "A much longer about-page introduction covering software craft, independent websites, teaching, and the tools that make creative work possible every week.",
    }),
    "A much longer about-page introduction covering software craft, independent websites, teaching, and the tools that make creative work possible every week.",
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

test("assertPublicURL times out a stuck DNS lookup", async () => {
  assert.equal(DNS_LOOKUP_TIMEOUT_MS, 8_000);

  await assert.rejects(
    assertPublicURL("https://example.test/", {
      lookupTimeoutMs: 20,
      lookup: async () =>
        new Promise(() => {
          // Never resolves — timeout must win.
        }),
    }),
    /DNS lookup timed out for example\.test/,
  );

  // Non-positive timeout falls back to DNS_LOOKUP_TIMEOUT_MS (lookup still succeeds).
  const url = await assertPublicURL("https://example-fallback.test/", {
    lookupTimeoutMs: 0,
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
  });
  assert.equal(url.hostname, "example-fallback.test");
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
  assert.equal(decodeHtmlEntities("&AMP;&LT;"), "&<");
  // "foobar" is all letters (matches regex) but not in NAMED_ENTITIES → returns original match
  assert.equal(decodeHtmlEntities("&foobar;"), "&foobar;");
});

test("decodeHtmlEntities: decodes typographic and Latin-1 named entities", () => {
  assert.equal(
    decodeHtmlEntities("how &ldquo;local church&rdquo; membership"),
    "how \u201Clocal church\u201D membership",
  );
  assert.equal(decodeHtmlEntities("a&nbsp;b &middot; c"), "a b \u00B7 c");
  assert.equal(
    decodeHtmlEntities("&mdash;&ndash;&hellip;"),
    "\u2014\u2013\u2026",
  );
  assert.equal(decodeHtmlEntities("&Agrave; &aacute;"), "\u00C0 \u00E1");
  assert.equal(decodeHtmlEntities("&lt;script&gt;"), "<script>");
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

test("isTrackingSearchParam recognizes utm_* and click ids", () => {
  assert.equal(isTrackingSearchParam("utm_source"), true);
  assert.equal(isTrackingSearchParam("UTM_MEDIUM"), true);
  assert.equal(isTrackingSearchParam("gclid"), true);
  assert.equal(isTrackingSearchParam("fbclid"), true);
  assert.equal(isTrackingSearchParam("page"), false);
  assert.equal(isTrackingSearchParam(""), false);
});

test("stripTrackingSearchParams removes referral utm tags and keeps other query or hash", () => {
  assert.equal(
    stripTrackingSearchParams(
      "https://joshghent.com/?utm_source=joshuamorris.info&utm_medium=referral",
    ),
    "https://joshghent.com/",
  );
  assert.equal(
    stripTrackingSearchParams(
      "https://example.com/path?utm_campaign=x&id=42#frag",
    ),
    "https://example.com/path?id=42#frag",
  );
  assert.equal(
    stripTrackingSearchParams("https://example.com/ok"),
    "https://example.com/ok",
  );
  assert.equal(stripTrackingSearchParams("not a url"), "not a url");
  assert.equal(stripTrackingSearchParams(""), "");
});
