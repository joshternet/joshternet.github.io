/**
 * Goal: YouTube channel latest-upload publish dates for Showcase gating.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChannelPublishByUrl,
  latestPublishedAtFromYoutubeAtom,
  resolveYoutubeChannelPublishedAt,
  youtubeChannelFeedUrl,
  youtubeChannelIdFromHref,
  youtubeChannelIdFromHtml,
} from "../../scripts/nlp/channel-publish.mjs";

test("youtubeChannelIdFromHref reads /channel/ ids", () => {
  assert.equal(
    youtubeChannelIdFromHref("https://www.youtube.com/channel/UCabc123XYZ"),
    "UCabc123XYZ",
  );
  assert.equal(youtubeChannelIdFromHref("https://www.youtube.com/@handle"), "");
  assert.equal(youtubeChannelIdFromHref(""), "");
  assert.equal(youtubeChannelIdFromHref("not-a-url"), "");
});

test("youtubeChannelIdFromHtml finds channelId markers", () => {
  assert.equal(
    youtubeChannelIdFromHtml(
      '<link rel="canonical" href="https://www.youtube.com/channel/UCfromCanonical">',
    ),
    "UCfromCanonical",
  );
  assert.equal(
    youtubeChannelIdFromHtml('"channelId":"UCfromJson"'),
    "UCfromJson",
  );
  assert.equal(youtubeChannelIdFromHtml("<html></html>"), "");
  assert.equal(youtubeChannelIdFromHtml(""), "");
});

test("youtubeChannelFeedUrl builds the public Atom feed", () => {
  assert.equal(
    youtubeChannelFeedUrl("UCabc"),
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCabc",
  );
  assert.equal(youtubeChannelFeedUrl(""), "");
});

test("latestPublishedAtFromYoutubeAtom picks the newest entry", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Older</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=old"/>
    <published>2026-09-01T00:00:00+00:00</published>
  </entry>
  <entry>
    <title>Newer</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=new"/>
    <published>2026-10-28T15:30:00+00:00</published>
  </entry>
</feed>`;
  assert.equal(
    latestPublishedAtFromYoutubeAtom(xml),
    "2026-10-28T15:30:00.000Z",
  );
  assert.equal(latestPublishedAtFromYoutubeAtom(""), "");
  assert.equal(latestPublishedAtFromYoutubeAtom("<feed></feed>"), "");
  assert.equal(
    latestPublishedAtFromYoutubeAtom(`<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>New</title>
    <link href="https://www.youtube.com/watch?v=1"/>
    <published>2026-10-28T00:00:00Z</published>
  </entry>
  <entry>
    <title>Older later in feed</title>
    <link href="https://www.youtube.com/watch?v=2"/>
    <published>2026-09-01T00:00:00Z</published>
  </entry>
  <entry>
    <title>Undated</title>
    <link href="https://www.youtube.com/watch?v=3"/>
  </entry>
</feed>`),
    "2026-10-28T00:00:00.000Z",
  );
});

test("buildChannelPublishByUrl resolves YouTube handles via mocked fetch", async () => {
  /** @type {string[]} */
  const requested = [];
  const publishByUrl = await buildChannelPublishByUrl(
    [
      {
        url: "https://www.youtube.com/@asite",
        source: { kind: "elsewhere-channel", network: "youtube" },
      },
      {
        url: "https://vimeo.com/x",
        source: { kind: "elsewhere-channel", network: "vimeo" },
      },
      {
        url: "https://www.youtube.com/channel/UCdirect",
        source: { kind: "elsewhere-channel", network: "youtube" },
      },
      null,
    ],
    {
      fetchPublicText: async (href) => {
        requested.push(href);

        if (href.includes("/@asite")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"channelId":"UChandle"',
          };
        }

        if (href.includes("channel_id=UChandle")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Clip</title>
    <link href="https://www.youtube.com/watch?v=1"/>
    <published>2026-10-20T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        if (href.includes("channel_id=UCdirect")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Direct</title>
    <link href="https://www.youtube.com/watch?v=2"/>
    <published>2026-10-22T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        throw new Error(`unexpected fetch ${href}`);
      },
    },
  );

  assert.deepEqual(publishByUrl, {
    "https://www.youtube.com/@asite": "2026-10-20T00:00:00.000Z",
    "https://www.youtube.com/channel/UCdirect": "2026-10-22T00:00:00.000Z",
  });
  assert.ok(requested.some((href) => href.includes("/@asite")));
  assert.deepEqual(await buildChannelPublishByUrl([], {}), {});
});

test("buildChannelPublishByUrl skips failed YouTube lookups", async () => {
  const publishByUrl = await buildChannelPublishByUrl(
    [
      {
        url: "https://www.youtube.com/@gone",
        source: { kind: "elsewhere-channel", network: "youtube" },
      },
    ],
    {
      fetchPublicText: async () => {
        throw new Error("offline");
      },
    },
  );
  assert.deepEqual(publishByUrl, {});
});

test("buildChannelPublishByUrl skips pages without a channel id or feed", async () => {
  const publishByUrl = await buildChannelPublishByUrl(
    [
      {
        url: "https://www.youtube.com/@empty",
        source: { kind: "elsewhere-channel", network: "youtube" },
      },
      {
        url: "https://www.youtube.com/channel/UCfeedfail",
        source: { kind: "elsewhere-channel", network: "youtube" },
      },
      {
        url: "https://www.youtube.com/@ok",
        source: { network: "youtube" },
      },
      { url: 12, source: { network: "youtube" } },
      { url: "https://www.youtube.com/@nosource", source: "youtube" },
    ],
    {
      fetchPublicText: async (href) => {
        if (href.includes("/@empty")) {
          return { url: href, contentType: "text/html", body: "<html></html>" };
        }

        if (href.includes("channel_id=UCfeedfail")) {
          throw new Error("feed down");
        }

        if (href.includes("/@ok")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"channelId":"UCok"',
          };
        }

        if (href.includes("channel_id=UCok")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: "<feed xmlns='http://www.w3.org/2005/Atom'></feed>",
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.deepEqual(publishByUrl, {});
  assert.deepEqual(await buildChannelPublishByUrl(null, {}), {});
});

test("resolveYoutubeChannelPublishedAt uses default fetch when unset", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };

  try {
    assert.equal(
      await resolveYoutubeChannelPublishedAt("https://www.youtube.com/@none"),
      "",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
