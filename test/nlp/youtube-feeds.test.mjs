/**
 * Goal: YouTube channel/playlist Atom helpers and podcast episode harvest
 * (fixture-only; no live YouTube).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeYoutubeShowUrl,
  harvestYoutubeShowEpisodes,
  podcastEpisodesFromFeedItems,
  podcastEpisodesFromPlaylistHtmlFallback,
  podcastEpisodesFromYoutubeAtom,
  youtubeFeedUrlForShow,
  youtubePlaylistFeedUrl,
  youtubePlaylistIdFromHref,
  youtubeShowUrlsFromHtml,
  youtubeUploadDateFromHtml,
  youtubeVideoIdsFromPlaylistHtml,
} from "../../scripts/nlp/youtube-feeds.mjs";
import { resolveYoutubeChannelPublishedAt } from "../../scripts/nlp/channel-publish.mjs";

const offlineRobots = {
  allows: async () => true,
  bodyForOrigin: async () => "",
};

test("youtubePlaylistIdFromHref and feed URL builders", () => {
  assert.equal(
    youtubePlaylistIdFromHref(
      "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoABCDEF",
    ),
    "PLPKNYnZ2gXKoABCDEF",
  );
  assert.equal(
    youtubePlaylistIdFromHref("https://www.youtube.com/watch?v=abc"),
    "",
  );
  assert.equal(youtubePlaylistIdFromHref(""), "");
  assert.equal(
    youtubePlaylistFeedUrl("PLPKNYnZ2gXKoABCDEF"),
    "https://www.youtube.com/feeds/videos.xml?playlist_id=PLPKNYnZ2gXKoABCDEF",
  );
  assert.equal(youtubePlaylistFeedUrl(""), "");
});

test("youtubeShowUrlsFromHtml finds playlist channel and handle links", () => {
  const html = `
    <a href="https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoABCDEF">Show</a>
    <a href="https://www.youtube.com/@WatzthisVideo">Channel</a>
    <a href="https://www.youtube.com/channel/UCabc123XYZ">UC</a>
    <p>ignore https://example.com/youtube.com/fake</p>
  `;
  const urls = youtubeShowUrlsFromHtml(html);
  assert.ok(
    urls.some((url) => url.includes("playlist?list=PLPKNYnZ2gXKoABCDEF")),
  );
  assert.ok(urls.some((url) => url.includes("/@WatzthisVideo")));
  assert.ok(urls.some((url) => url.includes("/channel/UCabc123XYZ")));
  assert.deepEqual(youtubeShowUrlsFromHtml(""), []);
});

test("podcastEpisodesFromYoutubeAtom maps dated entries to podcast_episode", () => {
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Fresh Episode</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=fresh"/>
    <published>2026-11-01T12:00:00Z</published>
  </entry>
  <entry>
    <title>Older Episode</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=old"/>
    <published>2026-09-01T12:00:00Z</published>
  </entry>
</feed>`;
  const episodes = podcastEpisodesFromYoutubeAtom(xml, {
    siteOrigin: "https://member.example",
    observedAt: "2026-11-03T00:00:00.000Z",
    showUrl: "https://www.youtube.com/playlist?list=PLshow",
  });
  assert.equal(episodes.length, 2);
  assert.equal(episodes[0].content_type, "podcast_episode");
  assert.equal(episodes[0].site_origin, "https://member.example");
  assert.equal(episodes[0].published_at, "2026-11-01T12:00:00.000Z");
  assert.equal(episodes[0].actions[0].type, "watch");
  assert.deepEqual(podcastEpisodesFromYoutubeAtom("", { siteOrigin: "x" }), []);
});

test("harvestYoutubeShowEpisodes prefers playlist Atom feed", async () => {
  /** @type {string[]} */
  const requested = [];
  const episodes = await harvestYoutubeShowEpisodes(
    [
      "https://www.youtube.com/@OtherChannel",
      "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoABCDEF",
    ],
    {
      siteOrigin: "https://member.example",
      observedAt: "2026-11-03T00:00:00.000Z",
      robotsGate: offlineRobots,
      fetchPublicText: async (href) => {
        requested.push(href);

        if (href.includes("playlist_id=PLPKNYnZ2gXKoABCDEF")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>From Playlist</title>
    <link href="https://www.youtube.com/watch?v=pl1"/>
    <published>2026-11-02T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );

  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].title, "From Playlist");
  assert.ok(requested.some((href) => href.includes("playlist_id=")));
  assert.equal(
    requested.some((href) => href.includes("@OtherChannel")),
    false,
    "successful playlist harvest skips channel siblings",
  );
});

test("harvestYoutubeShowEpisodes falls back to playlist HTML uploadDate", async () => {
  const episodes = await harvestYoutubeShowEpisodes(
    ["https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoFALLBACK"],
    {
      siteOrigin: "https://member.example",
      observedAt: "2026-11-03T00:00:00.000Z",
      robotsGate: offlineRobots,
      fetchPublicText: async (href) => {
        if (href.includes("playlist_id=")) {
          return {
            url: href,
            contentType: "text/html",
            body: "<html>404</html>",
          };
        }

        if (href.includes("playlist?list=")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"videoId":"abc123XYZ"',
          };
        }

        if (href.includes("watch?v=abc123XYZ")) {
          return {
            url: href,
            contentType: "text/html",
            body: `<title>Fallback Episode - YouTube</title>
              "uploadDate":"2026-11-01T10:00:00-08:00"`,
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );

  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].url, "https://www.youtube.com/watch?v=abc123XYZ");
  assert.equal(episodes[0].title, "Fallback Episode");
  assert.match(String(episodes[0].published_at), /^2026-11-01/);
});

test("youtubeUploadDateFromHtml and video ids from playlist HTML", () => {
  assert.equal(
    youtubeUploadDateFromHtml('"uploadDate":"2026-11-02T10:02:50-08:00"'),
    "2026-11-02T18:02:50.000Z",
  );
  assert.equal(
    youtubeUploadDateFromHtml('"datePublished":"2026-10-15T08:00:00Z"'),
    "2026-10-15T08:00:00.000Z",
  );
  assert.equal(youtubeUploadDateFromHtml('"uploadDate":""'), "");
  assert.equal(youtubeUploadDateFromHtml(""), "");
  assert.deepEqual(
    youtubeVideoIdsFromPlaylistHtml(
      '"videoId":"aaa111","videoId":"aaa111","videoId":"bbb222"',
      5,
    ),
    ["aaa111", "bbb222"],
  );
});

test("youtubeFeedUrlForShow resolves channel handles via page HTML", async () => {
  const feedUrl = await youtubeFeedUrlForShow("https://www.youtube.com/@site", {
    robotsGate: offlineRobots,
    fetchPublicText: async (href) => {
      assert.match(href, /@site/);
      return {
        url: href,
        contentType: "text/html",
        body: '"channelId":"UChandle99"',
      };
    },
  });
  assert.equal(
    feedUrl,
    "https://www.youtube.com/feeds/videos.xml?channel_id=UChandle99",
  );
});

test("resolveYoutubeChannelPublishedAt falls back to watch uploadDate", async () => {
  const published = await resolveYoutubeChannelPublishedAt(
    "https://www.youtube.com/channel/UCfallback",
    {
      robotsGate: offlineRobots,
      fetchPublicText: async (href) => {
        if (href.includes("channel_id=UCfallback")) {
          throw new Error("atom 404");
        }

        if (href.includes("/channel/UCfallback")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"videoId":"watchMe"',
          };
        }

        if (href.includes("watch?v=watchMe")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"uploadDate":"2026-10-28T12:00:00Z"',
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.equal(published, "2026-10-28T12:00:00.000Z");
});

test("podcastEpisodesFromPlaylistHtmlFallback respects robots deny", async () => {
  const episodes = await podcastEpisodesFromPlaylistHtmlFallback(
    "https://www.youtube.com/playlist?list=PLdenied",
    {
      siteOrigin: "https://member.example",
      robotsGate: {
        allows: async () => false,
        bodyForOrigin: async () => "",
      },
    },
  );
  assert.deepEqual(episodes, []);
});

test("youtubePlaylistIdFromHref rejects non-youtube and bad URLs", () => {
  assert.equal(
    youtubePlaylistIdFromHref(
      "https://example.com/playlist?list=PLPKNYnZ2gXKoABCDEF",
    ),
    "",
  );
  assert.equal(
    youtubePlaylistIdFromHref("https://www.youtube.com/playlist?list=short"),
    "",
  );
  assert.equal(youtubePlaylistIdFromHref("not a url :::"), "");
});

test("youtubeShowUrlsFromHtml skips malformed matches", () => {
  assert.deepEqual(youtubeShowUrlsFromHtml(null), []);
  assert.deepEqual(youtubeShowUrlsFromHtml(12), []);
  assert.equal(canonicalizeYoutubeShowUrl(""), "");
  assert.equal(canonicalizeYoutubeShowUrl("not a url"), "");
  assert.equal(
    canonicalizeYoutubeShowUrl(
      "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoABCDEF\\",
    ),
    "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoABCDEF",
  );
});

test("youtubeVideoIdsFromPlaylistHtml empty and limit", () => {
  assert.deepEqual(youtubeVideoIdsFromPlaylistHtml(""), []);
  assert.deepEqual(youtubeVideoIdsFromPlaylistHtml(null), []);
  assert.deepEqual(
    youtubeVideoIdsFromPlaylistHtml(
      '"videoId":"one111","videoId":"two222","videoId":"three3"',
      2,
    ),
    ["one111", "two222"],
  );
});

test("youtubeFeedUrlForShow denies robots and fetch failures", async () => {
  assert.equal(
    await youtubeFeedUrlForShow("https://www.youtube.com/@blocked", {
      robotsGate: {
        allows: async () => false,
        bodyForOrigin: async () => "",
      },
    }),
    "",
  );
  assert.equal(
    await youtubeFeedUrlForShow("https://www.youtube.com/@boom", {
      robotsGate: offlineRobots,
      fetchPublicText: async () => {
        throw new Error("offline");
      },
    }),
    "",
  );
  assert.equal(
    await youtubeFeedUrlForShow(
      "https://www.youtube.com/channel/UCalready",
      {},
    ),
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCalready",
  );
});

test("podcastEpisodesFromFeedItems skips null entries and empty urls", () => {
  assert.deepEqual(
    podcastEpisodesFromFeedItems(
      [{ url: "https://www.youtube.com/watch?v=x" }],
      { siteOrigin: "" },
    ),
    [],
  );
  assert.deepEqual(
    podcastEpisodesFromFeedItems(
      [{ url: "https://www.youtube.com/watch?v=x" }],
      /** @type {any} */ (undefined),
    ),
    [],
  );
  const episodes = podcastEpisodesFromFeedItems(
    [
      null,
      "skip",
      { url: "", title: "Empty" },
      { url: 12, title: 34 },
      {
        url: "https://www.youtube.com/watch?v=ok",
        title: "OK",
        published_at: "2026-11-01T00:00:00Z",
        image: "https://i.ytimg.com/vi/ok/hqdefault.jpg",
      },
      {
        url: "https://www.youtube.com/watch?v=bare",
        title: "   ",
        summary: 9,
        image: "",
      },
    ],
    { siteOrigin: "https://member.example", showUrl: "" },
  );
  assert.equal(episodes.length, 2);
  assert.equal(episodes[0].title, "OK");
  assert.equal(episodes[0].image, "https://i.ytimg.com/vi/ok/hqdefault.jpg");
  assert.equal(episodes[1].title, "https://www.youtube.com/watch?v=bare");
  assert.equal(episodes[1].summary, "");
  assert.equal("published_at" in episodes[1], false);
  assert.equal("image" in episodes[1], false);
  assert.deepEqual(podcastEpisodesFromFeedItems(null, { siteOrigin: "x" }), []);
});

test("podcastEpisodesFromYoutubeAtom skips non-youtube and respects limit", () => {
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Skip</title>
    <link href="https://vimeo.com/1"/>
    <published>2026-11-01T00:00:00Z</published>
  </entry>
  <entry>
    <title>One</title>
    <link href="https://www.youtube.com/watch?v=1"/>
    <published>2026-11-01T00:00:00Z</published>
  </entry>
  <entry>
    <title>Two</title>
    <link href="https://youtu.be/2"/>
    <published>2026-11-02T00:00:00Z</published>
  </entry>
</feed>`;
  const episodes = podcastEpisodesFromYoutubeAtom(xml, {
    siteOrigin: "https://member.example",
    limit: 1,
  });
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].url, "https://www.youtube.com/watch?v=1");
  assert.deepEqual(podcastEpisodesFromYoutubeAtom(xml, { siteOrigin: "" }), []);
  assert.deepEqual(
    podcastEpisodesFromYoutubeAtom(xml, /** @type {any} */ (undefined)),
    [],
  );
});

test("harvestYoutubeShowEpisodes empty origin and channel-only path", async () => {
  assert.deepEqual(
    await harvestYoutubeShowEpisodes(["https://www.youtube.com/@x"], {
      siteOrigin: "",
    }),
    [],
  );

  const episodes = await harvestYoutubeShowEpisodes(
    ["https://www.youtube.com/channel/UCchanOnly"],
    {
      siteOrigin: "https://member.example",
      robotsGate: offlineRobots,
      fetchPublicText: async (href) => {
        if (href.includes("channel_id=UCchanOnly")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Chan</title>
    <link href="https://www.youtube.com/watch?v=c1"/>
    <published>2026-11-01T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].title, "Chan");
});

test("harvestYoutubeShowEpisodes feed fetch error falls back for playlist", async () => {
  const episodes = await harvestYoutubeShowEpisodes(
    ["https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoFEEDERR"],
    {
      siteOrigin: "https://member.example",
      robotsGate: offlineRobots,
      fetchPublicText: async (href) => {
        if (href.includes("playlist_id=")) {
          throw new Error("atom down");
        }

        if (href.includes("playlist?list=")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"videoId":"fb1xyz"',
          };
        }

        if (href.includes("watch?v=fb1xyz")) {
          return {
            url: href,
            contentType: "text/html",
            body: `<title>FB - YouTube</title>"uploadDate":"2026-11-01T00:00:00Z"`,
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].title, "FB");
});

test("podcastEpisodesFromPlaylistHtmlFallback skips denied watch and fetch errors", async () => {
  const episodes = await podcastEpisodesFromPlaylistHtmlFallback(
    "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoWATCHDENY",
    {
      siteOrigin: "https://member.example",
      robotsGate: {
        allows: async (href) => !String(href).includes("watch?v=deny01"),
        bodyForOrigin: async () => "",
      },
      fetchPublicText: async (href) => {
        if (href.includes("playlist?list=")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"videoId":"deny01","videoId":"ok2abc"',
          };
        }

        if (href.includes("watch?v=ok2abc")) {
          throw new Error("watch boom");
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.deepEqual(episodes, []);
});

test("podcastEpisodesFromPlaylistHtmlFallback playlist fetch failure", async () => {
  assert.deepEqual(
    await podcastEpisodesFromPlaylistHtmlFallback(
      "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoPLFAIL",
      {
        siteOrigin: "https://member.example",
        robotsGate: offlineRobots,
        fetchPublicText: async () => {
          throw new Error("playlist down");
        },
      },
    ),
    [],
  );
});

test("podcastEpisodesFromPlaylistHtmlFallback defaults and undated watch pages", async () => {
  const undated = await podcastEpisodesFromPlaylistHtmlFallback(
    "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoDEFAULTS",
    {
      siteOrigin: "https://member.example",
      limit: 0,
      fetchPublicText: async (href) => {
        if (/\/robots\.txt$/i.test(href)) {
          return {
            url: href,
            contentType: "text/plain",
            body: "User-agent: *\nAllow: /\n",
          };
        }

        if (href.includes("playlist?list=")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"videoId":"notitle1"',
          };
        }

        if (href.includes("watch?v=notitle1")) {
          return {
            url: href,
            contentType: "text/html",
            body: "<html><body>no dates here</body></html>",
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.equal(undated.length, 1);
  assert.equal(undated[0].title, "notitle1");
  assert.equal("published_at" in undated[0], false);

  const limited = await podcastEpisodesFromPlaylistHtmlFallback(
    "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoLIMITED",
    {
      siteOrigin: "https://member.example",
      limit: 1,
      robotsGate: offlineRobots,
      fetchPublicText: async (href) => {
        if (href.includes("playlist?list=")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"videoId":"lim001","videoId":"lim002"',
          };
        }

        if (href.includes("watch?v=lim001")) {
          return {
            url: href,
            contentType: "text/html",
            body: `<title>Limited - YouTube</title>"uploadDate":"2026-11-01T00:00:00Z"`,
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.equal(limited.length, 1);
  assert.equal(limited[0].title, "Limited");
});

test("youtubeFeedUrlForShow builds default robots gate when omitted", async () => {
  const feedUrl = await youtubeFeedUrlForShow(
    "https://www.youtube.com/@gated",
    {
      cache: new Map(),
      fetchPublicText: async (href) => {
        if (/\/robots\.txt$/i.test(href)) {
          return {
            url: href,
            contentType: "text/plain",
            body: "User-agent: *\nAllow: /\n",
          };
        }

        if (href.includes("@gated")) {
          return {
            url: href,
            contentType: "text/html",
            body: '"channelId":"UCgated99"',
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.equal(
    feedUrl,
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCgated99",
  );
});

test("harvestYoutubeShowEpisodes uses default fetch/robots when omitted", async () => {
  assert.deepEqual(
    await harvestYoutubeShowEpisodes([], {
      siteOrigin: "https://member.example",
    }),
    [],
  );
  assert.deepEqual(
    await harvestYoutubeShowEpisodes(/** @type {any} */ (null), {
      siteOrigin: "https://member.example",
      robotsGate: offlineRobots,
      fetchPublicText: async () => {
        throw new Error("should not fetch");
      },
    }),
    [],
  );
});

test("harvestYoutubeShowEpisodes dedupes episode URLs across shows", async () => {
  const episodes = await harvestYoutubeShowEpisodes(
    [
      "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoDEDUPA",
      "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoDEDUPB",
    ],
    {
      siteOrigin: "https://member.example",
      robotsGate: offlineRobots,
      // Do not break after first playlist so both shows are harvested.
      fetchPublicText: async (href) => {
        if (href.includes("playlist_id=PLPKNYnZ2gXKoDEDUPA")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Shared</title>
    <link href="https://www.youtube.com/watch?v=same1"/>
    <published>2026-11-01T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        if (href.includes("playlist_id=PLPKNYnZ2gXKoDEDUPB")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Shared again</title>
    <link href="https://www.youtube.com/watch?v=same1"/>
    <published>2026-11-01T00:00:00Z</published>
  </entry>
  <entry>
    <title>Unique</title>
    <link href="https://www.youtube.com/watch?v=uniq2"/>
    <published>2026-11-02T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );

  // First successful playlist breaks the loop — only DEDUPA episodes.
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].url, "https://www.youtube.com/watch?v=same1");
});

test("harvestYoutubeShowEpisodes channel continues after empty playlist feed", async () => {
  const episodes = await harvestYoutubeShowEpisodes(
    [
      "https://www.youtube.com/playlist?list=PLPKNYnZ2gXKoEMPTYYY",
      "https://www.youtube.com/channel/UCafterEmpty",
    ],
    {
      siteOrigin: "https://member.example",
      robotsGate: offlineRobots,
      fetchPublicText: async (href) => {
        if (href.includes("playlist_id=PLPKNYnZ2gXKoEMPTYYY")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: "<feed xmlns='http://www.w3.org/2005/Atom'></feed>",
          };
        }

        if (href.includes("playlist?list=PLPKNYnZ2gXKoEMPTYYY")) {
          return { url: href, contentType: "text/html", body: "<html></html>" };
        }

        if (href.includes("channel_id=UCafterEmpty")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>After empty</title>
    <link href="https://www.youtube.com/watch?v=ae1"/>
    <published>2026-11-01T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].title, "After empty");
});

test("harvestYoutubeShowEpisodes dedupes shared videos across channels", async () => {
  const episodes = await harvestYoutubeShowEpisodes(
    [
      "https://www.youtube.com/channel/UCshareA",
      "https://www.youtube.com/channel/UCshareB",
    ],
    {
      siteOrigin: "https://member.example",
      robotsGate: offlineRobots,
      fetchPublicText: async (href) => {
        if (href.includes("channel_id=UCshareA")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Shared A</title>
    <link href="https://www.youtube.com/watch?v=sharedVid"/>
    <published>2026-11-01T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        if (href.includes("channel_id=UCshareB")) {
          return {
            url: href,
            contentType: "application/atom+xml",
            body: `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Shared B</title>
    <link href="https://www.youtube.com/watch?v=sharedVid"/>
    <published>2026-11-01T00:00:00Z</published>
  </entry>
  <entry>
    <title>Only B</title>
    <link href="https://www.youtube.com/watch?v=onlyB"/>
    <published>2026-11-02T00:00:00Z</published>
  </entry>
</feed>`,
          };
        }

        throw new Error(`unexpected ${href}`);
      },
    },
  );
  assert.equal(episodes.length, 2);
  assert.ok(
    episodes.some(
      (item) => item.url === "https://www.youtube.com/watch?v=sharedVid",
    ),
  );
  assert.ok(
    episodes.some(
      (item) => item.url === "https://www.youtube.com/watch?v=onlyB",
    ),
  );
});
