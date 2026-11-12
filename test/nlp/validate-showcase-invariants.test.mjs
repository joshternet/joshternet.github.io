/**
 * Goal & Constraints:
 * Keep nlp:validate showcase gates aligned with Showcase selection
 * (isMadeContentItem), especially music works at bare /sounds|/music paths.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isBareCreativeIndexUrl,
  isMusicIndexWorkItem,
  isSiteHomeUrl,
} from "../../scripts/views/lib.mjs";

/**
 * Mirrors the showcase URL reject predicate in validate-generated.mjs.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
function showcaseUrlRejected(item) {
  const url = typeof item.url === "string" ? item.url : "";

  if (!url) {
    return false;
  }

  return (
    isSiteHomeUrl(url) ||
    (isBareCreativeIndexUrl(url) && !isMusicIndexWorkItem(item))
  );
}

test("validate showcase gate allows music works at bare /sounds/", () => {
  const item = {
    url: "https://joshtronic.com/sounds/",
    title: "loud and bouncy",
    content_type: "music_recording",
  };

  assert.equal(isBareCreativeIndexUrl(item.url), true);
  assert.equal(isMusicIndexWorkItem(item), true);
  assert.equal(showcaseUrlRejected(item), false);
});

test("validate showcase gate still rejects non-music bare creative indexes", () => {
  assert.equal(
    showcaseUrlRejected({
      url: "https://joshua.example/work/",
      title: "Work",
      content_type: "project",
    }),
    true,
  );
  assert.equal(
    showcaseUrlRejected({
      url: "https://joshtronic.com/sounds/",
      title: "Sounds",
      content_type: "article",
    }),
    true,
  );
  assert.equal(
    showcaseUrlRejected({
      url: "https://joshua.example/",
      title: "Home",
      content_type: "project",
    }),
    true,
  );
});
