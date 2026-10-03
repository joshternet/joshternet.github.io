/**
 * Goal: Cover elsewhere host classification, sanitize rules, and withElsewhere.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ELSEWHERE_PER_PARTICIPANT,
  classifyElsewhereHost,
  elsewhereLabel,
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
