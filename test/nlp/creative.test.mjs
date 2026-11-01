/**
 * Goal: Creative work extraction from Schema, figures, and indexes.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  collectCreativeWorks,
  creativeContentType,
  creativeItemsFromExternalWatchLinks,
  creativeItemsFromFigures,
  creativeItemsFromIndexLinks,
  isCreativeIndexPath,
} from "../../scripts/nlp/creative.mjs";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/creative",
);

/**
 * @param {string} name
 * @returns {string}
 */
function fixture(name) {
  return fs.readFileSync(path.join(fixtures, name), "utf8");
}

test("creativeContentType maps schema and path hints", () => {
  assert.equal(creativeContentType(["Photograph"]), "photograph");
  assert.equal(creativeContentType(["VisualArtwork"]), "visual_artwork");
  assert.equal(creativeContentType(["MusicAlbum"]), "music_album");
  assert.equal(creativeContentType(["MusicRecording"]), "music_recording");
  assert.equal(creativeContentType(["MusicComposition"]), "sheet_music");
  assert.equal(creativeContentType(["VideoObject"]), "video");
  assert.equal(creativeContentType(["Game"]), "game");
  assert.equal(creativeContentType(["ImageGallery"]), "collection");
  assert.equal(
    creativeContentType(["CreativeWork"], "/portfolio/x"),
    "project",
  );
  assert.equal(creativeContentType([], "/music/track"), "music_recording");
  assert.equal(
    creativeContentType([], "/music/It%20Is%20Truly%20Meet.pdf"),
    "sheet_music",
  );
  assert.equal(creativeContentType([], "/docs/readme.pdf"), "project");
});

test("isCreativeIndexPath recognizes creative roots", () => {
  assert.equal(isCreativeIndexPath("/gallery/"), true);
  assert.equal(isCreativeIndexPath("/games"), true);
  assert.equal(isCreativeIndexPath("/blog/"), false);
});

test("collectCreativeWorks: photography gallery without blog", () => {
  const html = fixture("photography-gallery.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://photo.example/gallery/", html, lang: "en" }],
    { siteOrigin: "https://photo.example", observedAt: "2026-10-31T00:00:00Z" },
  );

  assert.ok(items.some((item) => item.content_type === "collection"));
  assert.ok(items.some((item) => item.title === "Tide pool"));
  assert.ok(
    items.every((item) => String(item.url).startsWith("https://photo.example")),
  );
});

test("collectCreativeWorks: musician album preserves language", () => {
  const html = fixture("musician-album.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://music.example/discography/", html, lang: "fr" }],
    { siteOrigin: "https://music.example", observedAt: "2026-10-31T00:00:00Z" },
  );

  const album = items.find((item) => item.title === "Nuits calmes");
  assert.ok(album);
  assert.equal(album.content_type, "music_album");
  assert.equal(album.language, "fr");
});

test("collectCreativeWorks: games index", () => {
  const html = fixture("games-index.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://games.example/games/", html }],
    { siteOrigin: "https://games.example", observedAt: "2026-10-31T00:00:00Z" },
  );

  assert.ok(items.some((item) => item.content_type === "game"));
  assert.ok(items.some((item) => /River Crossing/.test(String(item.title))));
});

test("collectCreativeWorks: RTL visual artwork", () => {
  const html = fixture("multilingual-rtl.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://rtl.example/art/", html, lang: "ar" }],
    { siteOrigin: "https://rtl.example", observedAt: "2026-10-31T00:00:00Z" },
  );

  const work = items.find((item) => item.content_type === "visual_artwork");
  assert.ok(work);
  assert.equal(work.language, "ar");
  assert.match(String(work.title), /ضوء/);
});

test("collectCreativeWorks: static JS shell yields no fabricated works", () => {
  const html = fixture("js-catalog-static.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://js.example/art/", html }],
    { siteOrigin: "https://js.example", observedAt: "2026-10-31T00:00:00Z" },
  );

  assert.equal(items.length, 0);
});

test("collectCreativeWorks: rendered JS fixture extracts schema work", () => {
  const html = fixture("js-catalog-rendered.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://js.example/art/", html }],
    { siteOrigin: "https://js.example", observedAt: "2026-10-31T00:00:00Z" },
  );

  assert.ok(items.some((item) => item.title === "Rendered piece"));
});

test("creativeItemsFromFigures skips bare image files without work links", () => {
  const html = `<figure><img src="/x.jpg" alt="Bare"><figcaption>Bare</figcaption></figure>`;
  const items = creativeItemsFromFigures(
    html,
    "https://a.example/gallery/",
    "https://a.example",
    "t",
  );
  assert.equal(items.length, 0);
});

test("creativeItemsFromIndexLinks accepts unquoted href album cards", () => {
  const html = `<!doctype html><html><body>
    <div class=album-list>
      <a href=/photos/2026/ class=album-in-list-link>
        <img src=/photos/2026/thumbs/x.jpeg alt="An assortment of photos from 2026">
        <span>2026</span>
      </a>
      <a href=/photos/2025/ class=album-in-list-link><span>2025</span></a>
    </div>
  </body></html>`;
  const items = creativeItemsFromIndexLinks(
    html,
    "https://joshbeard.com/photos/",
    "https://joshbeard.com",
    "2026-11-01T00:00:00.000Z",
  );
  assert.ok(items.length >= 2);
  assert.ok(
    items.some((item) => item.url === "https://joshbeard.com/photos/2026/"),
  );
  assert.ok(items.some((item) => item.content_type === "photograph"));
  const album2026 = items.find(
    (item) => item.url === "https://joshbeard.com/photos/2026/",
  );
  assert.equal(
    album2026.image,
    "https://joshbeard.com/photos/2026/thumbs/x.jpeg",
  );
});

test("creativeItemsFromFigures attaches https image on linked works", () => {
  const html = `<figure>
    <a href="/gallery/tide/"><img src="/img/tide.jpg" alt=""></a>
    <figcaption>Tide pool</figcaption>
  </figure>`;
  const items = creativeItemsFromFigures(
    html,
    "https://photos.example/gallery/",
    "https://photos.example",
    "t",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://photos.example/gallery/tide/");
  assert.equal(items[0].image, "https://photos.example/img/tide.jpg");
});

test("creativeItemsFromIndexLinks ignores non-index pages", () => {
  const items = creativeItemsFromIndexLinks(
    `<a href="/blog/post/">Post</a>`,
    "https://a.example/blog/",
    "https://a.example",
    "t",
  );
  assert.equal(items.length, 0);
});

test("collectCreativeWorks: empty inputs", () => {
  assert.deepEqual(collectCreativeWorks([], { siteOrigin: "" }), {
    items: [],
    subjects: [],
  });
  assert.deepEqual(
    collectCreativeWorks([null, { url: "https://a.example/", html: null }], {
      siteOrigin: "https://a.example",
    }),
    { items: [], subjects: [] },
  );
});

test("creativeItemsFromIndexLinks prefers post-link image and paragraph summary", () => {
  const html = fixture("games-index.html");
  const items = creativeItemsFromIndexLinks(
    html,
    "https://games.example/games/",
    "https://games.example",
    "2026-11-01T00:00:00.000Z",
  );
  const river = items.find(
    (item) => item.url === "https://games.example/games/river/",
  );
  const orchard = items.find(
    (item) => item.url === "https://games.example/games/orchard/",
  );
  assert.ok(river);
  assert.equal(river.image, "https://games.example/images/river.png");
  assert.match(String(river.summary), /quiet puzzle/i);
  assert.ok(orchard);
  assert.equal(orchard.image, "https://games.example/images/orchard.png");
  assert.match(String(orchard.summary), /fruit/i);
});

test("comics index harvests same-origin children", () => {
  const html = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/html/indie-comics-index.html",
    ),
    "utf8",
  );
  const items = creativeItemsFromIndexLinks(
    html,
    "https://comics.example/comics/",
    "https://comics.example",
    "2026-11-01T00:00:00.000Z",
  );
  assert.ok(items.some((item) => item.url.endsWith("/comics/use-it/")));
  assert.ok(items.some((item) => item.url.endsWith("/comics/spite-swimming/")));
  assert.equal(isCreativeIndexPath("/comics/"), true);
  assert.equal(isCreativeIndexPath("/cssbattles/"), true);
  assert.equal(isCreativeIndexPath("/study-hall/"), true);
});

test("video indexes harvest external YouTube watch links", () => {
  const html = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/html/indie-videos-cssbattles.html",
    ),
    "utf8",
  );
  const items = creativeItemsFromExternalWatchLinks(
    html,
    "https://videos.example/cssbattles/",
    "https://videos.example",
    "2026-11-01T00:00:00.000Z",
  );
  assert.ok(items.length >= 2);
  assert.equal(items[0].content_type, "video");
  assert.equal(items[0].source.kind, "videos-watch-link");
  assert.equal(items[0].actions[0].label, "Watch");
  assert.match(String(items[0].url), /youtube\.com\/watch/);
});
