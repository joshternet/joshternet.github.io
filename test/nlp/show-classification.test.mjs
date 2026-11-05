/**
 * Goal: Podcast-show classification used by the YouTube harvest and activity.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  contentTypeForHarvestedYoutube,
  isCssBattleShowTitle,
  isPodcastShowItem,
} from "../../scripts/nlp/show-classification.mjs";

test("show harvests and CSS Battle videos are podcasts, not activity posts", () => {
  assert.equal(isCssBattleShowTitle(""), false);
  assert.equal(isCssBattleShowTitle("CSSBattle for NOVEMBER 5"), true);
  assert.equal(isPodcastShowItem(null), false);
  assert.equal(isPodcastShowItem(1), false);
  assert.equal(
    isPodcastShowItem({ source_kind: "", source: "nope", title: "Nope" }),
    false,
  );
  assert.equal(isPodcastShowItem({ content_type: "article" }), false);
  assert.equal(
    isPodcastShowItem({
      content_type: "podcast_episode",
      title: "This Morse Game Starts at a Brutal 40 WPM",
      url: "https://www.youtube.com/watch?v=Rn8bsZhlDhQ",
      source: { kind: "youtube-show-fallback" },
    }),
    true,
  );
  assert.equal(
    isPodcastShowItem({
      content_type: "video",
      title: "A channel upload",
      source_kind: "youtube-show-feed",
    }),
    true,
  );
  assert.equal(
    isPodcastShowItem({
      content_type: "video",
      title: "CSSBattle for NOVEMBER 4 (2026)",
      url: "https://www.youtube.com/watch?v=QFPIB-IU_zA",
      source: { kind: "elsewhere-youtube-video" },
    }),
    true,
  );
  assert.equal(
    isPodcastShowItem({
      content_type: "article",
      title: "CSS Battle notes",
      url: "https://joshua.example/blog/css-battle-notes/",
    }),
    false,
  );
  assert.equal(
    isPodcastShowItem({
      content_type: "video",
      title: "JavaScript Game Tutorial",
      url: "https://www.youtube.com/watch?v=QxYg8-mhhhs",
      source: { kind: 12 },
    }),
    false,
  );
  assert.equal(
    isPodcastShowItem({
      title: "CSSBattle live",
      url: "https://youtu.be/abc",
      source: null,
    }),
    true,
  );
  assert.equal(
    contentTypeForHarvestedYoutube(
      "video",
      "youtube-show-fallback",
      "This Morse Game Starts at a Brutal 40 WPM",
    ),
    "video",
  );
  assert.equal(
    contentTypeForHarvestedYoutube(
      "podcast_episode",
      "youtube-show-feed",
      "From Playlist",
    ),
    "video",
  );
  assert.equal(
    contentTypeForHarvestedYoutube(
      "video",
      "elsewhere-youtube-video",
      "CSSBattle for NOVEMBER 4 (2026)",
    ),
    "podcast_episode",
  );
  assert.equal(
    contentTypeForHarvestedYoutube("video", "elsewhere-youtube-video", "Clip"),
    "video",
  );
  assert.equal(
    contentTypeForHarvestedYoutube("", "elsewhere-youtube-video", "Clip"),
    "video",
  );
  assert.equal(
    contentTypeForHarvestedYoutube("video", undefined, "Clip"),
    "video",
  );
});
