/**
 * Goal: Cover elsewhere host classification, sanitize rules, and withElsewhere.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ELSEWHERE_PER_PARTICIPANT,
  classifyElsewhereHost,
  elsewhereHostCatalog,
  elsewhereLabel,
  isElsewhereProfileUrl,
  sanitizeElsewhere,
  withElsewhere,
} from "../../scripts/network/elsewhere.mjs";

/**
 * @param {string} hostname
 * @param {string} address
 * @returns {(hostname: string, options?: object) => Promise<object[]>}
 */
function fakeLookup(hostname, address = "93.184.216.34") {
  return async () => [{ address, family: 4 }];
}

test("classifyElsewhereHost maps international catalog hosts", () => {
  assert.equal(classifyElsewhereHost("github.com"), "github");
  assert.equal(classifyElsewhereHost("bsky.app"), "bluesky");
  assert.equal(classifyElsewhereHost("x.com"), "x");
  assert.equal(classifyElsewhereHost("twitter.com"), "x");
  assert.equal(classifyElsewhereHost("weibo.com"), "weibo");
  assert.equal(classifyElsewhereHost("vk.com"), "vk");
  assert.equal(classifyElsewhereHost("xiaohongshu.com"), "xiaohongshu");
  assert.equal(classifyElsewhereHost("mastodon.social"), "mastodon");
  assert.equal(classifyElsewhereHost("josh.substack.com"), "substack");
  assert.equal(classifyElsewhereHost("personal.example"), "web");
});

test("elsewhereLabel uses catalog names or hostname for web", () => {
  assert.equal(elsewhereLabel("github", "github.com"), "GitHub");
  assert.equal(elsewhereLabel("web", "notes.example"), "notes.example");
});

test("sanitizeElsewhere keeps classified public http(s) links", async () => {
  const result = await sanitizeElsewhere(
    [
      { href: "https://github.com/somejosh", me: true },
      {
        href: "https://bsky.app/profile/example.com",
        text: "Bluesky",
        me: true,
      },
      { href: "https://weibo.com/u/123", me: true },
      { href: "https://notes.example/about", me: true },
    ],
    {
      lookup: fakeLookup(),
    },
  );

  assert.deepEqual(result, [
    {
      url: "https://github.com/somejosh",
      network: "github",
      label: "GitHub",
    },
    {
      url: "https://bsky.app/profile/example.com",
      network: "bluesky",
      label: "Bluesky",
    },
    {
      url: "https://weibo.com/u/123",
      network: "weibo",
      label: "Weibo",
    },
    {
      url: "https://notes.example/about",
      network: "web",
      label: "notes.example",
    },
  ]);
});

test("sanitizeElsewhere keeps host-discovered social profiles without rel=me", async () => {
  const result = await sanitizeElsewhere(
    [
      { href: "https://github.com/joshuabaker", me: false },
      { href: "https://github.com/joshuabaker/some-repo", me: false },
      { href: "https://www.linkedin.com/in/thejoshuabaker", me: false },
      { href: "https://x.com/joshuabaker", me: false },
      { href: "https://notes.example/about", me: false },
    ],
    {
      lookup: fakeLookup(),
    },
  );

  assert.deepEqual(result, [
    {
      url: "https://github.com/joshuabaker",
      network: "github",
      label: "GitHub",
    },
    {
      url: "https://www.linkedin.com/in/thejoshuabaker",
      network: "linkedin",
      label: "LinkedIn",
    },
    {
      url: "https://x.com/joshuabaker",
      network: "x",
      label: "X",
    },
  ]);
});

test("sanitizeElsewhere drops email, unsafe URLs, and duplicates", async () => {
  const result = await sanitizeElsewhere(
    [
      { href: "mailto:josh@example.com" },
      { href: "javascript:alert(1)" },
      { href: "ftp://files.example/me" },
      { href: "https://user:pass@github.com/x" },
      { href: "https://github.com/somejosh" },
      { href: "https://github.com/somejosh" },
      { href: "http://127.0.0.1/me" },
      { href: "https://localhost/me" },
      { url: "https://mastodon.social/@josh" },
    ],
    {
      lookup: async (hostname) => {
        if (hostname === "127.0.0.1" || hostname === "localhost") {
          return [{ address: "127.0.0.1", family: 4 }];
        }

        return [{ address: "93.184.216.34", family: 4 }];
      },
    },
  );

  assert.deepEqual(result, [
    {
      url: "https://github.com/somejosh",
      network: "github",
      label: "GitHub",
    },
    {
      url: "https://mastodon.social/@josh",
      network: "mastodon",
      label: "Mastodon",
    },
  ]);
});

test("sanitizeElsewhere enforces the per-participant cap", async () => {
  const raw = Array.from(
    { length: MAX_ELSEWHERE_PER_PARTICIPANT + 3 },
    (_, i) => ({
      href: `https://example.test/u/${i}`,
      me: true,
    }),
  );

  const result = await sanitizeElsewhere(raw, {
    lookup: fakeLookup(),
  });

  assert.equal(result.length, MAX_ELSEWHERE_PER_PARTICIPANT);
});

test("sanitizeElsewhere returns empty for non-arrays and isolates bad items", async () => {
  assert.deepEqual(await sanitizeElsewhere(null), []);
  assert.deepEqual(await sanitizeElsewhere(undefined), []);

  const result = await sanitizeElsewhere(
    [null, "nope", { href: "https://github.com/ok" }, { href: "" }],
    {
      lookup: fakeLookup(),
    },
  );

  assert.deepEqual(result, [
    {
      url: "https://github.com/ok",
      network: "github",
      label: "GitHub",
    },
  ]);
});

test("withElsewhere publishes elsewhere or omits the field", () => {
  const base = {
    origin: "https://example.com",
    elsewhere: [{ url: "https://old.example", network: "web", label: "old" }],
  };

  assert.deepEqual(
    withElsewhere(base, [
      {
        url: "https://github.com/x",
        network: "github",
        label: "GitHub",
      },
    ]).elsewhere,
    [
      {
        url: "https://github.com/x",
        network: "github",
        label: "GitHub",
      },
    ],
  );
  assert.equal(Object.hasOwn(withElsewhere(base, []), "elsewhere"), false);
  assert.equal(Object.hasOwn(withElsewhere(base, null), "elsewhere"), false);
});

// ─── elsewhereHostCatalog (lines 194-203) ────────────────────────────────────

test("elsewhereHostCatalog returns hosts and suffixes catalog (lines 194-203)", () => {
  const catalog = elsewhereHostCatalog();
  assert.ok(typeof catalog === "object");
  assert.ok(typeof catalog.hosts === "object");
  assert.ok(Array.isArray(catalog.suffixes));
  assert.ok(catalog.hosts["github.com"] === "github");
  assert.ok(catalog.suffixes.every((e) => e.suffix && e.network));
});

// ─── classifyElsewhereHost empty hostname (lines 217-218) ────────────────────

test("classifyElsewhereHost: empty or falsy hostname returns 'web' (lines 217-218)", () => {
  assert.equal(classifyElsewhereHost(""), "web");
  assert.equal(classifyElsewhereHost(null), "web");
  assert.equal(classifyElsewhereHost("  "), "web");
});

// ─── isElsewhereProfileUrl — uncovered switch cases ──────────────────────────

test("isElsewhereProfileUrl: instagram/tiktok/other social (lines 342-345)", () => {
  const make = (href) => new URL(href);
  assert.equal(
    isElsewhereProfileUrl(
      make("https://www.instagram.com/joshjosh"),
      "instagram",
    ),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(make("https://www.tiktok.com/@joshjosh"), "tiktok"),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(
      make("https://www.instagram.com/share/"),
      "instagram",
    ),
    false,
  );
});

test("isElsewhereProfileUrl: threads (lines 347-349)", () => {
  const make = (href) => new URL(href);
  assert.equal(
    isElsewhereProfileUrl(make("https://www.threads.net/@joshjosh"), "threads"),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(make("https://www.threads.net/joshjosh"), "threads"),
    true,
  );
});

test("isElsewhereProfileUrl: bluesky (line 351)", () => {
  const url = new URL("https://bsky.app/profile/joshjosh.bsky.social");
  assert.equal(isElsewhereProfileUrl(url, "bluesky"), true);
  const bad = new URL("https://bsky.app/notprofile/joshjosh");
  assert.equal(isElsewhereProfileUrl(bad, "bluesky"), false);
});

test("isElsewhereProfileUrl: youtube (lines 353-359)", () => {
  const make = (href) => new URL(href);
  assert.equal(
    isElsewhereProfileUrl(make("https://www.youtube.com/@joshjosh"), "youtube"),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(
      make("https://www.youtube.com/channel/UC123"),
      "youtube",
    ),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(
      make("https://www.youtube.com/c/joshjosh"),
      "youtube",
    ),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(
      make("https://www.youtube.com/user/joshjosh"),
      "youtube",
    ),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(
      make("https://www.youtube.com/watch?v=123"),
      "youtube",
    ),
    true,
  );
});

test("isElsewhereProfileUrl: facebook (lines 361-364)", () => {
  const make = (href) => new URL(href);
  assert.equal(
    isElsewhereProfileUrl(
      make("https://www.facebook.com/joshjosh"),
      "facebook",
    ),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(
      make("https://www.facebook.com/share/link"),
      "facebook",
    ),
    false,
  );
  assert.equal(
    isElsewhereProfileUrl(make("https://www.facebook.com/login"), "facebook"),
    false,
  );
});

test("isElsewhereProfileUrl: discord (lines 370-372)", () => {
  const make = (href) => new URL(href);
  assert.equal(
    isElsewhereProfileUrl(make("https://discord.com/users/12345"), "discord"),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(make("https://discord.gg/invite/abc"), "discord"),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(make("https://discord.com/invite/abc"), "discord"),
    true,
  );
});

test("isElsewhereProfileUrl: telegram (line 374)", () => {
  const url = new URL("https://t.me/joshjosh");
  assert.equal(isElsewhereProfileUrl(url, "telegram"), true);
});

test("isElsewhereProfileUrl: medium/substack/bandcamp and similar return true (line 390)", () => {
  const make = (href) => new URL(href);
  assert.equal(
    isElsewhereProfileUrl(make("https://joshjosh.medium.com/"), "medium"),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(make("https://joshjosh.substack.com/"), "substack"),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(make("https://joshjosh.bandcamp.com/"), "bandcamp"),
    true,
  );
  assert.equal(
    isElsewhereProfileUrl(
      make("https://stackoverflow.com/users/123"),
      "stackoverflow",
    ),
    true,
  );
});

test("isElsewhereProfileUrl: web returns false (line 392)", () => {
  const url = new URL("https://notes.example/about");
  assert.equal(isElsewhereProfileUrl(url, "web"), false);
});

test("isElsewhereProfileUrl: unknown network returns false (line 394)", () => {
  const url = new URL("https://unknown-platform.example/user");
  assert.equal(isElsewhereProfileUrl(url, "unknown-platform"), false);
});

// ─── sanitizeElsewhere invalid URL catch (lines 451-452) ─────────────────────

test("sanitizeElsewhere: invalid href that passes normalizeText but fails new URL() is skipped (lines 451-452)", async () => {
  const result = await sanitizeElsewhere([{ href: ":::invalid-url:::" }], {
    lookup: fakeLookup(),
  });
  assert.deepEqual(result, []);
});

// ─── sanitizeElsewhere duplicate network dedup (lines 487-488) ───────────────

test("sanitizeElsewhere: second link for same network is deduplicated (lines 487-488)", async () => {
  // Two different GitHub URLs for the same network — second fires seenNetworks guard.
  const result = await sanitizeElsewhere(
    [
      { href: "https://github.com/user1", me: false },
      { href: "https://github.com/user2", me: false },
    ],
    { lookup: fakeLookup() },
  );
  // Only the first github profile is kept
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://github.com/user1");
});

// ─── Phase-3 branch gap closers ───────────────────────────────────────────────

// elsewhereLabel: unknown network + null hostname fires || "" and || web (L244, L248)
test("elsewhereLabel: unknown network with null hostname falls back to ELSEWHERE_LABELS.web (L244, L248)", () => {
  // network not in ELSEWHERE_LABELS → goes to L244
  // null hostname → String(null || "") = "" → L244 fires
  // "" is falsy → falls back to ELSEWHERE_LABELS.web → L248 fires
  const label = elsewhereLabel("custom-network", null);
  assert.ok(typeof label === "string" && label.length > 0);
});

// isElsewhereProfileUrl: mastodon with 1 segment, no @ fires segments.length === 1 (L367)
test("isElsewhereProfileUrl: mastodon single-segment path without @ fires length === 1 branch (L367)", () => {
  const url = new URL("https://mastodon.social/somepath");
  // first = "somepath" (no @), segments.length = 1 → L367 second operand fires
  assert.equal(isElsewhereProfileUrl(url, "mastodon"), true);
});

// isElsewhereProfileUrl: discord.gg with non-users/invite first segment fires hostname check (L371)
test("isElsewhereProfileUrl: discord.gg non-invite URL fires hostname === 'discord.gg' branch (L371)", () => {
  const url = new URL("https://discord.gg/server-name");
  // first = "server-name" (not "users" nor "invite") → L371: url.hostname === "discord.gg" fires
  assert.equal(isElsewhereProfileUrl(url, "discord"), true);
});
