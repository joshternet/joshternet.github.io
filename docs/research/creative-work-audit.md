# Creative Work Audit — Joshternet Network

**Audited:** 2026-10-31  
**Auditor:** Research agent (automated evidence + manual analysis)  
**Data sources:** `_data/network.json`, `_data/content.json`, `_data/site_signals.json`, `scripts/nlp/creative.mjs`, `scripts/nlp/portfolio.mjs`, `test/fixtures/creative/`  
**Scope:** All independent origins in `network.json` as of 2026-10-31 plus `joshuakim.studio` (declaration confirmed, not yet indexed). Hub `joshternet.org` noted separately but excluded from content eligibility.

---

## Contents

1. [joshbeard.com](#1-joshbeardcom)
2. [joshghent.com](#2-joshghentcom)
3. [joshmuller.ca](#3-joshmullerca)
4. [joshtronic.com](#4-joshtroniccom)
5. [joshua.seigler.net](#5-joshuaseiglernetwork)
6. [joshuamorris.info](#6-joshuamorrisinfo)
7. [www.joshcanhelp.com](#7-wwwjoshcanhelpcom)
8. [www.joshuabaker.com](#8-wwwjoshuabakercom)
9. [joshuakim.studio](#9-joshuakimstudio)
10. [joshternet.org (hub — noted, not eligible)](#10-joshternet-hub--noted-not-eligible)
11. [Extraction improvements for Phase 3](#extraction-improvements-for-phase-3)

---

## 1. joshbeard.com

**Creator:** Josh Beard  
**Description:** Infrastructure, developer workflows, and software delivery systems  
**First participated:** 2026-10-30  
**Language:** `en`, `en-us`

### Pages / Sources Inspected

- 80 pages crawled (fetch limit reached; bounded-smart selection strategy)
- Schema types observed: `Article`
- Feed: none declared in `network.json`
- Elsewhere: [github.com/joshbeard](https://github.com/joshbeard)

### Work Titles / URLs Known

No confirmed creative work items were extracted into `content.json`.

However, the following **photo section** is confirmed via crawled pages:

| Path pattern | Role (observed) | Notes |
|---|---|---|
| `https://joshbeard.com/photos/` | `unknown` | Gallery index |
| `https://joshbeard.com/photos/all/` | `unknown` | All-photos listing |
| `https://joshbeard.com/photos/{year}/` | `unknown` | Year archives 2014–2026 |
| `https://joshbeard.com/photos/all/{year}/{slug}_jpg.html` | `unknown` | Individual photo HTML pages |
| `https://joshbeard.com/photo/` | `unknown` | Alternate photo root |

Named photo slugs confirmed in crawl (sample): `2020-colorado-pagosa`, `2020-garden-of-the-gods-1`, `2020-garden-of-the-gods-2`, `2019-glen-eyrie-1/2/3`, `2019-labor-day-lift-off-1/2/3`, `2019-cripple-creek-1/2`, `2019-catamount-1–7`, `2019-roadtrip-01–13`, `2019-rolling-stones`, `2018-herman-gulch-01–17+`

### Types + Evidence

- **photograph** — Strongly signaled. Declared topics include: `blog-photos`, `colorado-photos`, `hiking-photos`, `latest-photo`, `personal-photos`, `photo`, `photo-album`, `photo-blog`, `road-trip-photos`. Year-organized `/photos/all/{year}/{slug}_jpg.html` URL pattern is consistent with a self-hosted photo gallery.
- No `music`, `game`, or `visual_artwork` signals observed.

### Portfolio Signals

No portfolio index (`/work/`, `/portfolio/`, `/projects/`) observed. Site is primarily personal/professional with infrastructure focus (community slugs: `devops`, `health`, `social-media`).

### Creator Role

Publisher and photographer (sole author inferred from personal site structure).

### Availability

Site is live, embeddable (`frame_reason: allowed`), captured 2026-10-31. Photos section publicly accessible.

### Events

None observed.

### Already Indexed?

**No.** `content.json` contains zero items for `https://joshbeard.com`.

### Misses + Likely Reasons

1. **No Schema.org `Photograph`, `ImageGallery`, or `VisualArtwork` JSON-LD** detected on photo pages — `creative.mjs` `itemFromJsonLdNode` requires a CREATIVE_SCHEMA_TYPE match; only `Article` schema is present site-wide.
2. **`/photos/` pages classified as `unknown` page role** — the page-role classifier did not identify the photo index as a creative index, so it may not have been passed to creative extraction during crawl.
3. **Individual photo pages (`_jpg.html`) have no `<figcaption>` with same-origin anchor links** — `creativeItemsFromFigures` would need both.
4. **`creativeItemsFromIndexLinks` path check** — `/photos/` is in the `indexRoots` regex, so if the `/photos/` HTML contains same-origin links to sub-pages, those should be picked up; however the links point to `/photos/all/{year}/{slug}_jpg.html` which are served as leaf HTML files with image content, not standard gallery item pages with a title text node that the link parser can use.

### Status Tags

`site reviewed` · `relevant content found` · `eligible for display` · `review incomplete`

---

## 2. joshghent.com

**Creator:** Josh Ghent  
**Description:** Writing on software engineering, engineering leadership, and building products  
**First participated:** 2026-10-04  
**Language:** `en`

### Pages / Sources Inspected

- 80 pages crawled (fetch limit reached)
- Schema types observed: `Article`, `BlogPosting`, `Person`
- Feed: `https://joshghent.com/rss.xml` (Atom, "Developer Musings")
- Elsewhere: [github.com/joshghent](https://github.com/joshghent), Threads

### Work Titles / URLs Known

153 `article` items indexed from feed. Notable items with creative or project character:

| Title | URL | Notes |
|---|---|---|
| Albums I listened to in 2022 | `https://joshghent.com/2022-music/` | Music curation post |
| Allgood — Instant healthcheck API | `https://joshghent.com/allgood/` | Open-source project write-up |
| I created my own status page | `https://joshghent.com/created-my-own-status-page/` | Self-built tool |
| The Art of Good Code Review | `https://joshghent.com/good-code-review/` | Engineering writing |
| How I build products with AI | `https://joshghent.com/how-i-build-products-with-ai/` | Product building |
| Lessons from Open Source | `https://joshghent.com/open-source-lessons/` | Open-source practice |

### Types + Evidence

- **article** — All 153 indexed items are typed `article`. No `project`, `photograph`, `music_recording`, or `game` items extracted.
- Community slug `art` is declared but relates to software craft writing, not visual art.
- No photography, game, or visual creative signals observed.

### Portfolio Signals

No portfolio index page observed. Site is a technical blog. Notable open-source project "Allgood" is described in a post but not surfaced as a `project` type.

### Creator Role

Publisher and author (engineering writing; open-source project author).

### Availability

Live, embeddable. Captured 2026-10-31.

### Events

None observed.

### Already Indexed?

**Yes** — 153 `article` items indexed from RSS feed. No `project` or creative-type items extracted.

### Misses + Likely Reasons

1. **Project posts tagged as articles** — Posts describing software projects (Allgood, status page, CLI tools) are published as blog posts without Schema.org `SoftwareApplication` or `Project` JSON-LD, so they are not elevated to `project` content_type.
2. **Music curation post not typed as music** — "Albums I listened to in 2022" is a text article, not a `MusicAlbum`/`MusicRecording` schema page.
3. **No `/projects/` index or portfolio page** — `creativeItemsFromIndexLinks` has nothing to work from.

### Status Tags

`site reviewed` · `relevant content found` · `extracted` · `eligible for display`

---

## 3. joshmuller.ca

**Creator:** Josh Müller  
**Description:** Technologist | Leader | Regenerative Systems Designer  
**First participated:** 2026-10-12  
**Language:** `en`, `es`, `tr` (trilingual site)

### Pages / Sources Inspected

- 80 pages crawled (fetch limit reached)
- Schema types observed: `Article`, `BlogPosting`, `BreadcrumbList`, `Organization`
- Feeds: `https://joshmuller.ca/index.xml` (RSS), `https://joshmuller.ca/feed` (web)
- Elsewhere: LinkedIn, GitHub, Mastodon, Bluesky, X, Instagram, YouTube, Telegram, Discord

### Work Titles / URLs Known

190 `article` items indexed. Items with creative, audio, or photograph character (sample):

| Title | URL | Type observed | True type |
|---|---|---|---|
| Dad's Anniversary Playlist | `https://joshmuller.ca/dads-service/dads-anniversary-playlist/` | article | music curation |
| [Photo] Northern Lights | `https://joshmuller.ca/writings/2022/photo-northern-lights/` | article | photograph |
| A Song I'm Loving Today | `https://joshmuller.ca/writings/2023/song-im-loving/` | article | music curation |
| Creating an Interlinear Audio Bible with Open Source NLP Models | `https://joshmuller.ca/writings/2024/interlinear-audiobible/` | article | audio project |
| Two New Interlinear Audio Bible Resources | `https://joshmuller.ca/writings/2025/more-interlinears/` | article | audio project |
| How to (Legally) Turn a YouTube Playlist Into a Torrent | `https://joshmuller.ca/writings/2023/how-to-turn-a-youtube-channel-into-a-torrent/` | article | audio/how-to |
| How I Quickly Found a Quote Buried in Dozens of Hours of Audio | `https://joshmuller.ca/writings/2023/search-audio/` | article | audio project |

Recipe collection (all typed `article`): Flapper Pie, Fudgy Brownies, Gluten-Free Chocolate Cake, Graham Crackers, Tahini Cookies, Oatmeal Chocolate Chip Cookies, Protein Pancakes, Ajiaco santafereño (en + es), Super Veggie (en + es), Nutty Pudding, Pumpkin Pie, Pollo a la mantequilla.

### Types + Evidence

- **article** (190 items) — all current content_type; accurate for writing but undersells the audio/photo/recipe nature
- **audio project** signal — community slug `audio`, interlinear audio Bible project, NLP-based audio search
- **photograph** signal — "[Photo] Northern Lights" post title; no `Photograph` schema
- **recipe/food** — significant recipe collection; community slug `food`
- No `music_recording`, `photograph`, or `collection` type items extracted

### Portfolio Signals

No formal portfolio page. Resume site at `https://resume.joshmuller.ca/` listed in `elsewhere`. The YouTube channel (`https://youtube.com/@joshmuller`) may contain video content; not crawled.

### Creator Role

Publisher, author, audio project creator, food writer, photographer (inferred from "[Photo]" post prefix).

### Availability

Live, embeddable. Captured 2026-10-31.

### Events

Memorial service page at `https://joshmuller.ca/dads-service/` with sub-pages (anniversary playlist, mom's reflections). Not a public event but a significant personal collection.

### Already Indexed?

**Yes** — 190 `article` items from RSS feed. No creative/photograph/audio items distinguished.

### Misses + Likely Reasons

1. **Photographs posted as written articles** — "[Photo] Northern Lights" is a post-format photograph with no `Photograph` JSON-LD; classified `article`.
2. **Audio projects published as articles** — Interlinear Audio Bible project posts have no `AudioObject` or `SoftwareApplication` schema; they surface as `article`.
3. **Recipes classified as articles** — No `Recipe` schema type (which is not in CREATIVE_SCHEMA_TYPES anyway); recipe pages have `Article`/`BlogPosting` schema and are correctly `article` by current rules, but are not surfaced as a distinct culinary collection.
4. **Playlist as article** — Music curation post has no `MusicPlaylist` schema.
5. **YouTube content not crawled** — External video content at `youtube.com/@joshmuller` is out of scope for the crawler.

### Status Tags

`site reviewed` · `relevant content found` · `extracted` · `eligible for display`

---

## 4. joshtronic.com

**Creator:** Josh Sherman  
**Description:** "Code is a medium that found me at an impressionable young age."  
**First participated:** 2026-09-25  
**Language:** `en`

### Pages / Sources Inspected

- 80 pages crawled (fetch limit reached)
- Schema types observed: `BreadcrumbList` only
- Feeds: `https://joshtronic.com/rss.xml` (RSS), `https://joshtronic.com/atom.xml` (Atom, "Joshtronic - RSS Feed")
- Elsewhere: `git.sherver.org/joshtronic` (self-hosted Gitea), Victor Mono font GitHub page

### Work Titles / URLs Known

12 `article` items indexed from feeds (recent posts 2026-08 to 2026-10). Site has a much larger archive (posts back to 2008). Creative sections discovered via crawl:

| Path | Role (observed) | Notes |
|---|---|---|
| `https://joshtronic.com/games/` | `unknown` | Games index page |
| `https://joshtronic.com/sounds/` | `unknown` | Sounds/audio index page |
| `https://joshtronic.com/turtle/` | `unknown` | "Turtle" — unknown creative content |
| `https://joshtronic.com/hustles/` | `unknown` | Side projects / hustles index |
| `https://joshtronic.com/ai/` | `unknown` | AI-related content |

Notable historic posts with creative character (from crawled archive):
- "Nonogram PyGTK" (2009-01-19) — puzzle/game project
- "All Music Guide Tagger" (2008-12-24) — music tooling project
- "Halloween Movies Watch List 2026" — annual media curation
- "Halloween Movies Watch List 2025" — annual media curation

Declared topic: `video-game` (evidence class: declared, count 1). Community slug: `video-game`.

### Types + Evidence

- **article** (12 items) — all indexed items; recent posts only
- **game** signal — `/games/` page, `video-game` declared topic
- **audio** signal — `/sounds/` page
- **project** signal — `/hustles/` side projects page
- No `game`, `music_recording`, or `project` items extracted

### Portfolio Signals

`/hustles/` page exists — likely a side-projects/portfolio index. Not classified as portfolio by current signals.

### Creator Role

Publisher, software developer, game maker (historical), audio creator (inferred from `/sounds/`).

### Availability

Live, embeddable. Captured 2026-10-31.

### Events

Annual Halloween movie watch lists (2025, 2026) — consistent recurring curation event.

### Already Indexed?

**Partially** — 12 `article` items from feed (recent posts only). Archive of 70+ additional crawled pages not indexed. Creative sections (`/games/`, `/sounds/`) not indexed.

### Misses + Likely Reasons

1. **`/games/` page classified as `unknown` page role** — The `creativeItemsFromIndexLinks` function checks if the URL pathname starts with `/games?` (included in `indexRoots`); however the page must have been fetched with HTML containing same-origin links under `/games/`. The page role "unknown" means the page did not match any known role classifier, but the creative extractor should still try it via path check. Likely the `/games/` page content uses JavaScript rendering or has no `<a>` links with matching prefixes.
2. **`/sounds/` same issue** as `/games/` — path `/sounds/` is NOT in `indexRoots` (`/tracks/` and `/music/` are, but not `/sounds/`).
3. **`/hustles/` not a recognized portfolio path** — `/hustles/` is not in the `indexRoots` pattern and not in the portfolio detection path list in `portfolio.mjs`.
4. **No Schema.org JSON-LD anywhere** — `BreadcrumbList` only; no `Game`, `AudioObject`, or `SoftwareApplication` schema.
5. **Feed coverage limited to recent posts** — 12 of 80+ crawled pages indexed; archive posts with creative content not in feed window.

### Status Tags

`site reviewed` · `relevant content found` · `eligible for display` · `review incomplete`

---

## 5. joshua.seigler.net

**Creator:** Joshua Seigler  
**Description:** Software engineer personal homepage  
**First participated:** 2026-10-30  
**Language:** `en`

### Pages / Sources Inspected

- 64 pages crawled (fetch limit NOT reached — full site coverage)
- Schema types observed: none (no JSON-LD)
- Feed: `https://joshua.seigler.net/assets/feed-Cyyd5PFg.xml` (Atom, "Hello!")
- Elsewhere: GitHub, YouTube (Vulfmon music link), Medium, Substack

### Work Titles / URLs Known

64 `article` items indexed. Items with creative or project character:

| Title | URL | True type |
|---|---|---|
| Post: I made some Pebble watchfaces | `https://joshua.seigler.net/posts/i-made-some-pebble-watchfaces/` | project (wearable software) |
| Post: I made myself a Recipe Label Generator | `https://joshua.seigler.net/posts/i-made-myself-a-recipe-label-generator/` | project (software tool) |
| Post: Cool musical illusion — tritone paradox | `https://joshua.seigler.net/posts/cool-musical-illusion-tritone-paradox/` | music/audio content |
| Link: MidWord! The world's favorite word guessing game | `https://midword.com/` | external game (link post) |
| Link: Speed Catan | `https://www.seanmcp.com/board-games/speed-catan/` | external game (link post) |
| Link: Vulfmon & Andy Arthur Smith — Merengue alla Turca | `https://www.youtube.com/watch?v=VHRhPItNdIU` | external music (link post) |

Recipe collection (14 recipes, all `article`): Amish Egg Noodles, Bread Pudding with Butter Rum Sauce, Breakfast Strata, Chicken Chili Verde, Corn Casserole, Creamy Chicken Orzo, Curry Bolognese, Luther Salad, Pasta Rosatella, Pear Upside Down Cake, Perfect Homemade Brownies, Red Cabbage Confit, Sloppy Joes, Spanish Style Rice.

Community signals: `audio` (community slug), `boardgame` (community slug), `music` (declared topic), `boardgame` (declared topic).

### Types + Evidence

- **article** (64 items) — all indexed
- **project** signal — Pebble watchfaces post (software creative project), Recipe Label Generator
- **audio/music** signal — tritone paradox post, audio community slug, music declared topic
- **boardgame** signal — community slug and declared topic
- **recipe collection** — 14 recipes; not a creative type but notable as a curated collection

### Portfolio Signals

No formal portfolio page. Project posts are embedded in the blog.

### Creator Role

Publisher, software developer, watchface designer (Pebble platform), food/recipe publisher.

### Availability

Live, embeddable. Full site crawled (64/64 pages).

### Events

None observed.

### Already Indexed?

**Yes** — 64 `article` items (full site). No `project` items distinguished.

### Misses + Likely Reasons

1. **Pebble watchfaces post not typed as project** — Blog post about a creative software project has no `SoftwareApplication` or `Game` JSON-LD; published as an `Article` schema page (if any).
2. **No Schema.org JSON-LD on any page** — Zero schema types observed; all creative extraction paths require either JSON-LD, `<figure>` elements, or creative index paths.
3. **Link posts to external games/music indexed as same-origin items** — Several "Link:" items in content.json point to external URLs (midword.com, youtube.com), which are out-of-scope as Joshternet content items.
4. **Recipes not surfaced as collection** — No `/recipes/` creative index extraction triggered (path IS in `indexRoots` as `projects?` is not, but `photography`/`photos` etc. are; however `/recipes/` is not in the list).

### Status Tags

`site reviewed` · `relevant content found` · `extracted` · `eligible for display`

---

## 6. joshuamorris.info

**Creator:** Joshua Morris  
**Description:** "I build software, write about what I'm learning, and explore ideas that sit at the intersection of technology, freedom, and curiosity."  
**First participated:** 2026-09-06 (founding member)  
**Language:** `en`

### Pages / Sources Inspected

- 80 pages crawled (fetch limit reached)
- Schema types observed: `Article`, `BlogPosting`, `BreadcrumbList`, `CollectionPage`, `CreativeWork`, `ItemList`, `Person`, `ProfilePage`, `WebPage`, `WebSite`
- Feeds: `https://joshuamorris.info/atom.xml` (Atom), `https://joshuamorris.info/feed.xml` (RSS), `https://joshuamorris.info/feed.json` (JSON Feed)
- Elsewhere: GitHub, LinkedIn, X, Bluesky, Twitch, Medium
- Note: `embeddable: false` (blocked by site X-Frame-Options)

### Work Titles / URLs Known

273 `article` items indexed from Atom feed. Experiment items with creative character:

| Title | URL | True type |
|---|---|---|
| Corkboard | `https://joshuamorris.info/experiments/corkboard/` | interactive project |
| Model viewer | `https://joshuamorris.info/experiments/model-viewer/` | interactive project |
| Weird Web October 2026 | `https://joshuamorris.info/experiments/weird-web-october-2026/` | collection / event |
| Analog | `https://joshuamorris.info/experiments/weird-web-october-2026/analog/` | interactive art |
| Fake | `https://joshuamorris.info/experiments/weird-web-october-2026/fake/` | interactive art |
| Organic | `https://joshuamorris.info/experiments/weird-web-october-2026/organic/` | interactive art |
| Plastic | `https://joshuamorris.info/experiments/weird-web-october-2026/plastic/` | interactive art |
| Reveal | `https://joshuamorris.info/experiments/weird-web-october-2026/reveal/` | interactive art |
| Sheet | `https://joshuamorris.info/experiments/weird-web-october-2026/sheet/` | interactive art |
| Skeuomorphism | `https://joshuamorris.info/experiments/weird-web-october-2026/skeuomorphism/` | interactive art |
| Spark | `https://joshuamorris.info/experiments/weird-web-october-2026/spark/` | interactive art |

Declared creative topics (from `declared_topics` in `site_signals.json`): `art` (×5), `creative-coding` (×3), `design` (×4), `digital-art` (×1), `earth-observation` (×1), `experimental-game` (×1), `field-recording` (×1), `game-design` (×1), `interactive-art` (×3), `video-game` (×1), `visualization` (×1).

Community slugs (creative): `art`, `creative-coding`, `design`, `digital-art`, `earth-observation`, `experimental-game`, `field-recording`, `game-design`, `interactive-art`, `video-game`, `visualization`.

### Types + Evidence

- **article** (273 items) — all current content_type (all from Atom feed)
- **project / game / interactive_art** — strong signal from Schema.org `CreativeWork`, `CollectionPage`, `ItemList` schema types on site; declared topics `experimental-game`, `interactive-art`, `creative-coding`
- **collection** — "Weird Web October 2026" is a collection of themed interactive experiments
- **field-recording** — declared topic; audio/sonic creative work implied

### Portfolio Signals

`/experiments/` path functions as a creative work portfolio. `CollectionPage` and `ItemList` schema types present site-wide.

### Creator Role

Publisher, software developer, interactive artist, creative coder, field recorder (inferred from declared topics).

### Availability

Site live but not embeddable (`frame_reason: blocked-by-site`). Captured 2026-10-31.

### Events

**Weird Web October 2026** — themed month-long event/challenge with 9 named interactive art experiments under `/experiments/weird-web-october-2026/`. Appears to be a recurring or community event (name suggests an annual occurrence).

### Already Indexed?

**Partially** — 273 `article` items from Atom feed. All 11 experiment items appear in content.json as `article` (sourced from atom feed, not from creative extraction). No `project`, `game`, or `interactive_art` content_type items extracted.

### Misses + Likely Reasons

1. **`/experiments/` path not in `indexRoots` regex** — `creativeItemsFromIndexLinks` tests against `/gallery`, `/photos`, `/art`, `/music`, `/games/`, `/portfolio`, `/work`, `/projects?` and similar; `/experiments/` is absent, so the experiments index page is not treated as a creative link source.
2. **`CreativeWork` schema present but `itemFromJsonLdNode` requires a URL field** — If the schema nodes on experiment pages have a `url` field pointing to same-origin paths, they should be extracted; however all 273 content items are sourced as `atom`, suggesting the creative/schema extraction path produced no output (likely the experiment pages were not fetched within the 80-page crawl window, or the JSON-LD nodes did not pass the `title && url.startsWith(siteOrigin)` check).
3. **Atom feed classifies all entries as `article`** — The feed-based extraction in `content.mjs` (or wherever feed items are typed) assigns `article` to all feed entries regardless of the content_type that could be inferred from the URL path (`/experiments/` prefix).
4. **Embeddability blocked** — Cannot be iframed on joshternet.org, but content can still be linked and displayed as text cards.

### Status Tags

`site reviewed` · `relevant content found` · `extracted` · `eligible for display` · `review incomplete`

---

## 7. www.joshcanhelp.com

**Creator:** Josh Cunningham  
**Description:** Web professional since 2007; software, digital identity, mindfulness, focus, parenting  
**First participated:** 2026-09-30  
**Language:** `en-us`

### Pages / Sources Inspected

- 80 pages crawled (fetch limit reached)
- Schema types observed: none (no JSON-LD)
- Feed: `https://www.joshcanhelp.com/rss.xml` (Atom, "RSS Feed for joshcanhelp.com")
- Elsewhere: GitHub, LinkedIn, X, Substack (link post), Medium (link post)

### Work Titles / URLs Known

9 `article` items indexed from feed:

| Title | URL | Notes |
|---|---|---|
| Do we need 'agentic identity'? | `https://www.joshcanhelp.com/agentic-identity/` | Identity/AI essay |
| Thoughts on AI | `https://www.joshcanhelp.com/ai/` | AI reflections |
| Fighting for My Data Privacy | `https://www.joshcanhelp.com/data-privacy/` | Privacy essay |
| Goodbye Auth0 | `https://www.joshcanhelp.com/goodbye-auth0/` | Career reflection |
| Building a CLI from scratch with TypeScript and oclif | `https://www.joshcanhelp.com/oclif/` | Technical tutorial/project |
| Personal Data Pipeline Update | `https://www.joshcanhelp.com/personal-data-pipeline-update/` | Technical project |
| Imagining a Personal Data Pipeline | `https://www.joshcanhelp.com/personal-data-pipeline/` | Technical project |
| My Values for Technical Leadership | `https://www.joshcanhelp.com/values/` | Leadership writing |
| Goodbye Vittorio Bertocci | `https://www.joshcanhelp.com/vittorio/` | Memorial tribute |

Pages with possible creative/project character (from crawl): `agentic-identity`, `personal-data-pipeline`, `oclif` (CLI project post). OG poster images visible for several pages: AI (`_images/2025/ai-me-i-guess.png`), Bikes (`_images/2024/bike_frame.jpg`), Data Pipeline (`_images/2024/data-pipeline.png`), oclif (`_images/2024/ts_oclif.png`).

### Types + Evidence

- **article** (9 items) — all indexed items
- **project** signal (weak) — personal data pipeline posts describe a multi-year software project; oclif post describes CLI construction; no `project` content_type extracted
- No photography, game, music, or visual art signals observed
- Community slugs: `ai`, `async-communication`, `auth0`, `digital-identity`, `documentation`, `eleventy`, `focus`, `food-drink`, `health-fitness`, `javascript-typescript`, `obsidian`, `open-source`, `personal-data`, `personal-development`

### Portfolio Signals

No portfolio or projects index observed. Site is a long-form blog focused on writing and reflection.

### Creator Role

Publisher and author (technical and personal essays).

### Availability

Live, embeddable. Captured 2026-10-31.

### Events

None observed.

### Already Indexed?

**Partially** — 9 `article` items from feed. 80 pages crawled; low item-to-page ratio suggests many crawled pages (likely older archive posts) are not in the current feed window and were not extracted via schema or creative paths.

### Misses + Likely Reasons

1. **No Schema.org JSON-LD on any page** — Zero schema types in `site_signals.json`; creative and portfolio extractors have nothing to work from beyond feed items.
2. **Feed coverage limited to recent posts** — 9 items from 80 pages crawled; large archive of posts not reached via feed.
3. **Project posts not typed as projects** — Personal data pipeline and oclif CLI posts are articles with no `SoftwareApplication` or `Project` schema.
4. **`page_role` classification incomplete** — Many pages classified as `unknown`; only 1 page classified as `legal` (data-privacy), which is a false positive.

### Status Tags

`site reviewed` · `relevant content found` · `extracted` · `eligible for display`

---

## 8. www.joshuabaker.com

**Creator:** Joshua Baker  
**Description:** "Software engineer and designer with 20+ years of building, designing, and leading products"  
**First participated:** 2026-09-26  
**Language:** `en`

### Pages / Sources Inspected

- 27 pages crawled (full site coverage — only 27 pages total)
- Schema types observed: `CreativeWork`, `Person`, `ProfilePage`, `WebSite`
- Feed: none declared
- Elsewhere: LinkedIn, GitHub, Instagram, Threads, X, Spotify

### Work Titles / URLs Known

146 `project` items extracted from portfolio table at `https://www.joshuabaker.com/work/`.

Selected projects (sample of named clients/projects):

| Title | Sector | URL |
|---|---|---|
| Aiglon | Education | `https://www.joshuabaker.com/work/?work=aiglon-...` |
| Aldworth James & Bond | Property & Real Estate | `https://www.joshuabaker.com/work/?work=aldworth-james-bond-...` |
| Animade | Creative & Design | `https://www.joshuabaker.com/work/?work=animade-...` |
| Banked · Pay by Bank | Banking / Finance | `https://www.joshuabaker.com/work/banked-pay-by-bank/` |
| Comic Relief Donation Website | Nonprofit / Banking | `https://www.joshuabaker.com/work/?work=comic-relief-...` |
| The Dots | (case study) | `https://www.joshuabaker.com/work/the-dots/` |
| Peer Gynt | Arts & Culture | `https://www.joshuabaker.com/work/?work=peer-gynt-...` |
| Thirty Six Strategy | Government & Policy | `https://www.joshuabaker.com/work/?work=thirty-six-strategy-...` |
| Austin Fraser | Recruitment | `https://www.joshuabaker.com/work/?work=austin-fraser-...` |
| Anthology London — Business Intelligence Platform | Property | `https://www.joshuabaker.com/work/?work=anthology-london-business-intelligence...` |

At least 2 full case-study pages confirmed: `/work/the-dots/` and `/work/banked-pay-by-bank/` (page role: `project`). Remaining 144 projects addressed via query-param URL scheme (`?work=slug`).

Portfolio sectors (from `site_signals.json`): Arts & Culture, Charity & Nonprofit, Communications & PR, Consumer, Creative & Design, Education, Fashion & Retail, Finance, Government & Policy, Property & Real Estate, Recruitment, Technology, Startups, Banking.

Declared topics (creative): `arts-culture` (×5), `creative-design` (×8), `design` (×8), `design-system` (×8), `product-design` (×8), `startup` (×8).

### Types + Evidence

- **project** (146 items) — extracted via `collectPortfolio` from `/work/` portfolio table
- **creative-design** and **product-design** — strongly declared (×8 evidence each)
- **arts-culture** — declared (×5): projects include theater (Peer Gynt), creative agencies (Animade, Aldworth James & Bond), and arts community platforms (The Dots)
- No `photograph`, `music_recording`, or `game` items observed

### Portfolio Signals

Full portfolio index at `https://www.joshuabaker.com/work/` with work count 146 and multi-sector table. This is the richest portfolio among all audited sites.

### Creator Role

Designer and engineer (client work); product lead. Projects represent client delivery, not personal artistic output.

### Availability

Live, embeddable. Captured 2026-10-31.

### Events

None observed.

### Already Indexed?

**Yes** — 146 `project` items extracted. Portfolio extraction is working.

### Misses + Likely Reasons

1. **Summary field malformed** — All 146 project summaries contain CSS class strings (`[&_button>span]:flex-row-reverse [&_button>span]:align-top ...`) instead of descriptive text. The portfolio table's `visibleCell` function is extracting visible text from a Tailwind-heavy JS-rendered row where the text-white span selector matched CSS utility classes instead of content. The `.text-white` class pattern in `visibleCell` is mismatched against the actual DOM.
2. **Query-param URLs not resolvable** — 144 of 146 project URLs use `?work=slug` query parameters; these are not real pages and will 404 for any crawler expecting static HTML.
3. **Case study pages not linked as content items by full URL** — `/work/the-dots/` and `/work/banked-pay-by-bank/` have `project` page roles and OG images but are not surfaced as separate content items in `content.json` (they may be subsumed under the portfolio table entries).
4. **No `project` description** — Because the summary is CSS text, display cards for these projects will show garbage content until the extraction bug is fixed.

### Status Tags

`site reviewed` · `relevant content found` · `extracted` · `eligible for display` (with caveat: summaries are malformed)

---

## 9. joshuakim.studio

**Creator:** Joshua Kim (identity not yet confirmed in `network.json`)  
**First participated:** Declaration confirmed (external source); not yet in `network.json` as of 2026-10-31  
**Language:** Unknown

### Pages / Sources Inspected

No crawl data exists. Origin is absent from:
- `_data/network.json`
- `_data/content.json`
- `_data/site_signals.json`

The string `joshuakim` does not appear in any of the three data files (confirmed via `grep -c`).

### Work Titles / URLs Known

No confirmed works discovered.

### Types + Evidence

Unknown — no crawl evidence available.

### Portfolio Signals

The `.studio` TLD strongly implies a creative/design portfolio or studio practice. No data to confirm.

### Creator Role

Unknown — likely a creative professional or studio given the domain naming convention.

### Availability

Unknown — site not yet crawled.

### Events

Unknown.

### Already Indexed?

**No** — Origin not yet in the network data pipeline.

### Misses + Likely Reasons

Origin has not completed the network onboarding pipeline (not in `network.json`). No crawl has been initiated. Once the declaration is accepted and the origin is added to `network.json`, a full crawl will be needed.

### Status Tags

`review incomplete` · `no qualifying content` (pending crawl)

---

## 10. joshternet.org (Hub — Noted, Not Eligible)

**Description:** Hub/index site for the Joshternet network  
**Identity:** `undeclared` (hub origin, not a personal Josh site)  
**First participated:** 2026-09-06

### Notes

- 31 pages crawled (full site coverage)
- Schema types: `BreadcrumbList`, `CollectionPage`, `HowTo`, `Project`, `TechArticle`, `WebPage`, `WebSite`
- Community slugs: `cloudflare`, `eleventy`, `field-recording`, `github`, `go`, `hosting`, `privacy`, `recipe`, `search`, `security`, `wordpress`
- The `field-recording` and `recipe` community slugs are likely inherited from member topic signals appearing on joshternet.org pages (e.g., network listings), not from hub-authored content.
- 0 content items in `content.json` — correctly excluded from Showcase content pipeline.
- The hub publishes technical documentation (HowTo, TechArticle schema), network governance pages, and integration guides. These are infrastructure, not creative works by a member.

**Status Tags:** `site reviewed` · `no qualifying content` (hub excluded by design)

---

## Extraction Improvements for Phase 3

The following concrete gaps were identified across all audited origins. Addressing these would meaningfully increase creative work coverage in `content.json`.

### 1. Add `/experiments/` (and similar) to `indexRoots` in `creative.mjs`

**Affected:** joshuamorris.info  
**Gap:** The `creativeItemsFromIndexLinks` path pattern does not include `/experiments/`, `/interactive/`, `/sketches/`, `/demos/`, or `/lab/`. These paths are common in creative-coding contexts.  
**Fix:** Extend `indexRoots` regex:
```js
/^\/(gallery|galleries|albums|photography|photos|art|illustration|artwork|music|discography|tracks|videos|film|animation|games?|interactive|experiments?|sketches?|demos?|lab|exhibitions|design|portfolio|work|projects?)(?:\/|$)/i
```

### 2. Add `/sounds/` and `/hustles/` to `indexRoots` and portfolio paths

**Affected:** joshtronic.com  
**Gap:** `/sounds/` is not in the creative index path list (`/tracks/` and `/music/` are); `/hustles/` is not recognized as a portfolio path.  
**Fix:** Add `sounds?`, `hustles?` to `indexRoots`; add `hustles?` to the portfolio path detection in `portfolio.mjs` alongside `work`, `projects?`, `portfolio`.

### 3. Fix `visibleCell` in `portfolio.mjs` for Tailwind/CSS-heavy portfolio tables

**Affected:** www.joshuabaker.com (all 146 project summaries malformed)  
**Gap:** The `.text-white` span selector in `visibleCell` is matching Tailwind utility class strings instead of visible text content, causing CSS class names to appear in `summary` fields.  
**Fix:** Strip all text content from within `[class]` attribute values before extracting visible text, or target the text node directly rather than matching spans by class name. Consider using a stricter visible-text extractor that removes all HTML tags and decodes entities without relying on class-name heuristics.

### 4. Propagate `page_role: unknown` pages to creative extraction for known creative paths

**Affected:** joshbeard.com (`/photos/`, `/photos/all/`), joshtronic.com (`/games/`, `/sounds/`)  
**Gap:** Pages classified as `unknown` may still be creative index pages if their URL path matches `indexRoots`. Currently it is unclear whether the crawl pipeline passes `unknown`-role pages to `collectCreativeWorks`.  
**Fix:** Confirm that `collectCreativeWorks` is called for ALL fetched pages (not just those with a recognized page role). If not, remove the page-role gate.

### 5. Promote `/photos/all/{year}/{slug}_jpg.html` pages to `photograph` content_type

**Affected:** joshbeard.com  
**Gap:** Individual photo HTML pages exist at scale (40+ confirmed in crawl sample) but produce no content items. These pages lack Schema.org JSON-LD and rely on URL path structure.  
**Fix:** Add a URL-pattern-based photographer detection: if a page URL matches `/{photos|photo}/all/{year}/{slug}_{ext}.html` (where `ext` is an image extension), classify it as `content_type: photograph` and extract the title from `<title>` or `<h1>`. Alternatively, encourage adding `Photograph` JSON-LD to the photo page template at joshbeard.com.

### 6. Detect article-style project posts via Open Graph `og:type`

**Affected:** joshghent.com, joshcanhelp.com, joshua.seigler.net, joshmuller.ca  
**Gap:** Project write-up posts (open-source projects, software tools, tutorials describing built things) are published as blog articles without Schema.org `SoftwareApplication` JSON-LD, causing them to be classified as `article`.  
**Fix:** Check `og:type` meta tag (`og:type = "article"` vs. absence), and also apply heuristic signals: if a blog post's title matches patterns like "I made…", "I built…", "I created…", "Building…a [tool/app]", consider tagging as `project` (confidence: medium). Require human review before display.

### 7. Infer `photograph` content_type from title prefix `[Photo]`

**Affected:** joshmuller.ca  
**Gap:** The post "[Photo] Northern Lights" is clearly a photograph but is classified as `article`.  
**Fix:** In feed/article post-processing, if a post title begins with `[Photo]`, `📷`, or similar conventional photograph prefixes, override content_type to `photograph`.

### 8. Infer `music_recording` or `music_curation` from post titles

**Affected:** joshmuller.ca, joshghent.com  
**Gap:** Posts like "Albums I listened to in 2022", "Dad's Anniversary Playlist", "A Song I'm Loving Today" are music curation but classified as `article`.  
**Fix:** Add a lightweight heuristic: if a post title or URL contains `/music/`, `/playlist/`, `/album/`, `song`, `listening-to`, `albums-i-`, apply `content_type: music_album` or a new `music_curation` type with `confidence: heuristic`.

### 9. Surface case-study detail pages as standalone content items

**Affected:** www.joshuabaker.com  
**Gap:** `/work/the-dots/` and `/work/banked-pay-by-bank/` (and any future case-study pages) have `page_role: project`, OG images, and full page content, but are not extracted as distinct content items — they are subsumed by the portfolio table extraction which assigns them query-param URLs.  
**Fix:** After `collectPortfolio` runs, cross-reference case-study URLs against crawled pages with `page_role: project`. For each match, create a separate content item with the actual page URL (not the `?work=` variant), the page title, OG image, and any available description.

### 10. Add `joshuakim.studio` to network.json and initiate first crawl

**Affected:** joshuakim.studio  
**Gap:** Declaration confirmed but origin absent from all data pipelines.  
**Fix:** Complete network onboarding. Once crawled, re-audit based on actual site content. Pay attention to `.studio` domain signal — likely warrants checking for portfolio/creative index paths on first crawl.

### 11. Capture `availability` and `actions` fields for creative works

**Gap (all origins):** No `availability` (free/paid/on-request) or `actions` (play, listen, view, download, buy) fields are populated on any content item. These are valuable for display filtering (e.g., "free to play", "listen on Spotify") and would differentiate Joshternet's creative catalog from generic blog indexes.  
**Fix:** Define an `availability` field (`public` | `free` | `paid` | `on-request` | `unknown`) and an `actions` array (`{ label, url, type }`). Populate from OG metadata, link-to-store patterns (spotify.com, bandcamp.com, itch.io, steam), or explicit text parsing ("free download", "available on", "buy").

### 12. Extract OG image as `poster` on all content items

**Gap (multiple origins):** Poster images are present in `pages[]` entries in `site_signals.json` but inconsistently propagated to `content.json` items. joshuamorris.info pages have rich OG posters per post, but content items sourced from the Atom feed may not carry them.  
**Fix:** When a content item URL matches a crawled page that has a `poster_image`, copy that URL to the item's `image` field during the `sync` or `publish` step.

---

*End of audit. Document generated from data as of 2026-10-31. Re-run after Phase 3 extraction improvements and after joshuakim.studio onboarding.*
