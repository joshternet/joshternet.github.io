# Changelog

## Unreleased

### Removed

- **Wander toolbar extras:** Wander is Go, the member URL, and Open—no Follow or Previous controls.
- **Welcome postcards:** `/welcome/` downloads, Network “Get welcome card” links, and generated welcome artwork are gone. Homepage new-arrivals eligibility is unchanged.

### Added

- **Showcase and Happening crawl:** Comics, study-hall/education, CSS Battles, Watch links, and YouTube/Vimeo/Twitch channel cards from Elsewhere. Past education gatherings can appear in Showcase; upcoming ones stay on Happening. `/events/` stays in Network nav when there is something upcoming.
- **Member project shelves:** First-party apps linked from member project shelves (including off-origin apps) can appear as Showcase projects. Missing posters can be filled with a viewport capture.
- **Card posters when sites omit images:** Articles, notes, and creative works without a usable image get a local poster under `assets/activity/posters/` during sync.
- **Richer creative harvest:** Year photo albums, listen links from music pages, podcast episodes from feed enclosures, Hugo/PaperMod index JSON, and common podcast/listen slash probes.
- **Network screenshot repair:** Missing or empty site screenshots are recaptured on the normal sync cadence without a full refresh-all.
- **Non-Josh peers:** Joined tenure and equal card treatment for every identity; copy makes clear Non-Joshes participate as equals.
- **Crawl manners:** Respects `robots.txt` and sitemap hints; probes common feed paths when pages do not advertise them.

### Changed

- **Showcase titles:** Bare slug titles can pick up short Title Case wording from the summary instead of staying a single path word.
- **Recent channel cards only:** YouTube channel cards show in Showcase and What’s New only when the channel uploaded something in the last 14 days. Quiet channels stay off those surfaces.
- **Poster capture for channels:** Channel cards reuse or capture viewport posters when platforms omit a usable social image.
- **Readable scraped text:** Common HTML entities decode to normal punctuation on cards.
- **What's New window:** Primary Activity is the last **14 days**; older quiet-writer backfill is gone.
- **Network card titles:** Slogan brands that only restate the domain lose to a person-shaped author or GitHub name.
- **Network elsewhere:** Friends/people pages and referral UTMs no longer attach someone else’s social profiles to a member card.
- **Network card layout:** Domain sits under the title/description, left-aligned.
- **Feeds:** Empty note titles fall back to the summary; photo and listening cues type more sensibly; larger feeds and Hugo JSON alternates are accepted.
- **Homepage Creative work:** One newest work per member and kind in a horizontal row (games, projects, photos, music, and so on).
- **Homepage network count:** Meet uses the full Network size; preview cards still omit the hub.
- **Connections cards:** Site titles link out to the member origin; map highlight stays on the screenshot control.
- **Happening:** Upcoming events publish from crawl/schema data; mentioned-only and cancelled items stay off the public calendar.
- **Showcase ordering and cards:** Projects, games, photography, and music lead; sections pluralize when needed; the whole card links to the work; maker name is attribution only.
- **What's New + Showcase:** Recent dated creative works join Activity; undated crawl timestamps do not fake freshness.
- **Showcase UI:** Kind filters, denser cards, local posters required after sync, client case studies excluded, writing trees and site chrome stay out.

### Fixed

- **Formatting gate:** Generated data must pass Prettier before publish; sync formats as it writes.
- **Poster timing:** Screenshots wait for the page to settle so posters are not half-loaded.
- **Network deep link focus:** “Find in the Network” focuses the whole card.
- **Poster backlog fairness:** Writing and creative captures share the sync budget so articles are not starved.
- **Elsewhere icons:** Threads, Discord, and Buttondown hosts map to the right glyphs.
- **Showcase eligibility:** Homepages, writing trees, and bare indexes are not projects; albums stay, individual image pages do not; experiment and portfolio titles clean up for cards.
- **Enrichment budget:** Slow sites return partial enrichment instead of failing the whole refresh.
- **Network nav:** Showcase and Events open the Network second-level row by default.
- **Cross-origin feed junk:** Feed items that point at the hub (or another origin) are dropped.
- **Portfolio markup:** CSS class noise no longer leaks into Showcase summaries.

### Added

- **Showcase (`/showcase/`):** Expanded kind labels (photography, art, music, video, games, apps, software, books, guides, design, project, other) mapped from `content_type` + `categories`. Member attribution and outbound publisher CTAs. Homepage `home-showcase.html` omitted when empty. `_data/showcase.json` from `views:build`.

- **Happening (`/events/`):** New `scripts/nlp/events.mjs` extracts Schema.org Event/MusicEvent/ExhibitionEvent/Hackathon and mf2 h-event from crawled HTML. Fields: url, title, start/end with TZ, venue, location, status, attribution_role, site_origin, language. `collectEvents` emits items with `content_type: "event"`. `buildHappeningItems` in views/lib.mjs filters to upcoming/ongoing only (relative to injectable `now`); sorts chronologically. `_data/happening.json` written by `views:build`. Homepage `home-happening.html` strip (before Showcase, omitted if empty). Optional `assets/events/joshternet.ics` when events exist. Tests: `test/nlp/events.test.mjs` with fixtures under `test/fixtures/events/` including a past hackathon fixture that must NOT appear as upcoming.

- **Enrichment-budget / catalog extensions:** `compactContentItem` passes through `categories`, `availability`, `action_label`, `action_url`, `start`, `end`, `venue`, `location`, `status`, `attribution_role`. New `dirForLanguage` helper returns `"rtl"` for RTL language tags (Phase 6 i18n); `dir` field on compact items. `actionLabelForItem` in creative.mjs derives CTA labels from availability + content_type (Play/Listen/Watch/View for InStock/OnlineOnly items). `visibleCell` in portfolio.mjs falls back to full-cell text when the `text-white` span yields only empty content after tag-stripping.

- **Credit connections (Phase 7):** `isCreativeCreditSourcePage` extended to match `/event/`, `/events/`, and `/portfolio/` paths, so explicit credits on event and portfolio pages yield `credit` edges only with positive evidence (u-credit class, credit rel, or credit keyword). Test wired for `test/fixtures/creative/credits-page.html` fixture.

- `_data/network_preview.json` kept empty again so local `network:sync` / `nlp:sync` crawl only JoshBot registry participants (removed temporary non-registry preview entries).

- **Creative extraction:** Broader Schema.org and index-path support for apps, games, books, guides, music, shows, and events; homepage link and Open Graph fallbacks for creative shelves; offline fixtures cover portfolio and cross-member layouts.

- Creative work discovery: versioned slash-page catalog with blind probes (even when paths are absent from menus), uncapped same-origin crawl (no per-origin page quota), Schema.org/figure/gallery extraction for photographs, art, music, video, games, and collections, `/showcase/` plus homepage fair rotation, search `content_type`, and evidence-based `credit` connections—outbound cards only (no republish, autoplay, or in-hub embeds). Optional Playwright HTML render stays off by default (`scripts/nlp/render.mjs` / `creative.mjs` have dedicated tests; excluded from the global branch-coverage gate like other sync entrypoints).
- Guided `/join/` walkthrough for publishing `/.well-known/josh`, choosing a platform (including Cloudflare Worker), validating, optionally nominating, and celebrating after Network listing—linked from the homepage Join CTA.
- Homepage invitation “Are you a Josh? Get yourself connected.” with Join as the primary hero action and Wander secondary; Network stays in nav.
- Cloudflare Worker platform recipe embeds copy-paste Worker and Wrangler source on `/implement/platforms/cloudflare-worker/` for serving only `/.well-known/josh`.
- Join-funnel Umami events (`join-start`, `join-platform`, `join-declaration-copy`, `join-check-open`, `join-nominate-open`, `join-share-open`) with link-track skip on dedicated CTAs.
- Umami custom events for outbound and internal link clicks, inbound referrer classification (member vs other), and privacy-safe UI signals on Search, Network, Wander, Connections, and nominations—no search query text or form PII.
- Atom feed for What’s New at `/assets/activity/atom.xml`, with Subscribe + autodiscovery on `/activity/` alongside the existing OPML blogroll.

- Homepage “Welcome to the Joshternet!” section highlights up to three recent non-hub participants from the registry (`first_participated_at` within 14 days of build time; daily deploy), with Network deep links and an explicit non-Josh invitation to `/implement/`.
- Homepage Connections preview exposes Zoom in, Zoom out, and Center map controls with drag-pan; wheel still does not trap page scroll.
- Network directory sort control (`?sort=`): Discover (default random), Recently joined, Oldest first, and Alphabetical, independently of identity filters.
- Shareable welcome postcards (SVG + PNG) generated from the registry under `assets/network/welcome/`, with a `/welcome/` download page and Network “Get welcome card” links—separate from the official button.
- Connections graph marks participants whose build-time `recently_joined` flag is true (seven-day window from `site.time`) with a subtle ring (static under `prefers-reduced-motion`) and a “Recently joined” note in the detail bubble.
- Connections shows every verified Network participant as a graph and list node, including sites with no observed links yet, with a “No observed connections yet” empty state and a link to the site.
- Crawl HTML parsing accepts unquoted `href` / `rel` / `class` attributes so minified participant pages contribute real outbound links.
- Content-index crawl seeds include indieweb identity slash pages (`/me/`, `/social/`, `/links/`, `/more/`, `/uses/`, `/site/`, `/people/`, `/blogroll/`, `/elsewhere/`, `/now/`, `/health/`, and related paths); those seeds enqueue before sitemap locs so link directories are not starved. About/identity discovery collects multiple homepage-linked slash pages (`/more/`, `/site/`, `/now/`, `/uses/`, …); network sync visits up to eight of them for elsewhere and connection evidence. NLP outbound links are absolutized and same-origin nav is dropped so member `/site/` pages contribute real Josh-to-Josh edges.
- Homepage Connections preview: compact graph under discovery that reuses `connections.js` in preview mode (no wheel zoom or page-scroll trap), with a lightweight bootstrap of participants, observed links, and shared-topic pairs.
- Homepage discovery sections: Wander and Network CTAs, a Meet the websites preview that shuffles participants at random each visit (no join-date or creator priority; domain order without JavaScript), a What's happening preview from `activity.primary`, and a static Join path with the three identity declaration examples.
- Quartz 5 platform recipe at `/implement/platforms/quartz/`: copy `josh.json` to `public/.well-known/josh` after `npx quartz build`, because Quartz emits `quartz/static` under `/static/` and skips dot directories.

### Fixed

- Portfolio project items no longer hard-code `language: "en"`; language comes from the page or stays unknown.
- Multilingual discovery: missing language is no longer treated as English for heuristics; BCP 47 tags are preserved from HTML/`xml:lang`/feeds into content and search views; non-Latin search queries and declared topics are retained (ASCII slugs when possible, otherwise stable `u-` hashes); IDN origins canonicalize to ACE; activity cards isolate publisher text with `lang`/`dir`; What's New Atom entries carry `xml:lang` when known; Join/Implement copy welcomes any written language without changing declaration keys.
- What's New Atom builder tests cover author-name and malformed-item fallbacks so library coverage stays at 100%.
- Connections excludes hub activity-card author links (`activity-card__author-link` / `p-name u-url`) from observed relationships while keeping independently authored homepage links; the summary “sites with observed links” count no longer includes shared-topic-only sites.
- Connections `connections-select` fires only on deliberate graph/list selections, not `?site=` deep-link initialization.
- Join guide `join-start` Umami event fires once per session on the first intentional onboarding action (copy, platform, checker, or nominate)—not on `/join/` page load.

### Removed

- Unused participant-introductions scaffolding (`_data/introductions.yml`, include, Network/community copy). Welcome cards and other registry features are unchanged.

### Changed

- Topic quality rejects weak generic unigrams (`anything`, `action`, `tool`, and similar) as subjects and surfaces why-here evidence on topic pages.
- `/implement/validate/` shows next steps after a valid check, including independent declaration vs public-registry listing facts from the build-time Network snapshot, plus Network and nominate links—without a second checker.
- NLP crawl improvements for sites without feed tags: BlogPosting/Article JSON-LD and `og:type=article` drive `page_role` so root permalinks get heuristics; Person `knowsAbout` becomes community-eligible declared topics; soft-404 pages that repeat the homepage (canonical to `/` or identity-slash body match) no longer consume the page budget; feed entry URLs enqueue before identity slash seeds; year-prefixed heuristic junk (`2018-gifs`) is dropped.
- SEO and IndieWeb markup: site `author` in `_config.yml`; homepage Project JSON-LD gains `logo` and GitHub `sameAs`; gap pages get `seo.type`; derived JSON-LD adds BreadcrumbList (topics/implement) and capped ItemList (`/network/`, `/activity/`, `/topics/`, `/welcome/`); topic pages nest `h-feed` on article lists only; activity/search author cards gain clean `u-url`; welcome cards and topics index use `h-card`.
- Homepage welcome cards are build-time only for participants within the last 14 days (daily deploy), stacked meta rows, no hidden candidates or runtime eligibility filter.
- Homepage Meet excludes Welcome-featured domains in Liquid (`home-welcome-eligible`); Meet JS only shuffles and shows three cards.
- Connections arrival chrome reads build-time `recently_joined` from bootstrap JSON instead of computing a live date window in JS.
- Connections Line key title and legend items share one horizontal alignment by neutralizing global `li + li` block margins inside `.connections-key__list`.
- NLP reads unquoted `meta` name/property/content attributes, counts discovery-only publisher keywords as declared (still not community-eligible), classifies personal essay/identity paths and `/tips/` for heuristics, and skips per-photo gallery HTML so photography-heavy sites yield real pages/declared/signals instead of an image-page crawl.
- Network/NLP coverage gaps closed: unreachable slash-page dedupe and greeting/title dead branches removed; tests cover connection href failures, GitHub elsewhere edge cases, personal-domain title fallbacks, crawl seed guards, and hub URL parse failures.
- Connections site cards keep the screenshot, identity, connection lists, and empty-state note on one horizontal grid so empty notes and edge lists align with the title column instead of sitting under the thumbnail.
- Connections graph footer keeps filter chips and the line key on one shared row height; the key divider only appears beside filters.
- `network:sync` re-resolves participant titles on every run (including fresh screenshot keeps), using author/Person metadata and linked GitHub profile names, so new registry members and title-rule changes publish without waiting for the 24-hour capture refresh. CI may use authenticated GitHub profile lookups within normal API limits.
- Homepage Connections preview bootstraps the same participants, observed edges, shared-topic pairs, and per-site topic groups as `/connections/`, including descriptions and screenshots, so node selection shows the same datapoints.
- Homepage Meet the websites omits the joshternet.org hub card and counts only member sites.
- What's New / activity primary skips member posts whose URL is the Joshternet hub (for example a “Link: Joshternet…” bookmark), so the hub does not feature itself; the member’s next recent post can surface instead.
- Network titles derived from `firstname.lastname.tld` hosts prefer the personal name (for example `firstname.lastname.tld` → a personal name) instead of greeting-only homepage titles such as “Hello!”.
- Network titles prefer a person name that matches the host (Person JSON-LD, author, description, or page title) over a blog-brand or placeholder site name (when Person JSON-LD or author text matches the host).
- Network titles prefer a person-shaped author or Person JSON-LD name over a host-label brand when those do not compress to the domain (preferring the person name over a host-label brand).
- Network titles reject slogan brands that only compress to the host (for example a slogan that only restates the domain) and prefer a person-shaped GitHub profile name from elsewhere links when the site omits an author.
- Hub homepage Meet cards (`network-card__link`) and What's happening activity cards (`activity-card__link` / `activity-card__media`) are not connection evidence; relative outbound hrefs resolve against the observation page before edges are recorded.
- Homepage Connections preview boots whenever the Network has participants, not only when edges or shared-topic pairs already exist.
- Network identity filters hide cards again. `.network-card { display: flex }` had overridden the browser `[hidden]` rule, so Non-Josh and other filters left every card visible.
- `connections.js` boots every `[data-connections-shell]` with full or preview mode, scoped bootstrap ids, and unique SVG arrow markers.
- Layout pages may list multiple deferred scripts via `scripts:`.
- The homepage leads with discovery and participation, then relocates protocol explanation, PRE-JOSH status, principles, specifications, and community below those sections. Copy stays short and invitational rather than tutorial-heavy. Protocol semantics, CSP, and Wander embedding rules are unchanged.
- The WordPress platform recipe installs from the WordPress.org plugin directory. GitHub remains the source repository; releases ship through WordPress.org.
- The site test expects Wander’s main area to use overflow visible so the blocked-link bubble is not clipped.
- Removed the scheduled Production smoke workflow. It requested the live site every six hours and failed when declaration checks were older than six hours, which is the registry's normal overnight pause. It did not build or publish the site.
- Wander stays on the framed page that was open when a link would leave that site. Browsers that keep a history entry for the blocked navigation, and browsers that do not, stay on that page instead of stepping back to the site root. Showing the blocked-link bubble puts focus on Dismiss and puts the page scroll back if focus moved it. The browser test no longer requires an exact page scroll position for that bubble.
- Plural folding leaves listed exceptions such as devops, analytics, and internet-of-things unchanged, and still folds regular plurals such as topics and laptops. The topic quality report lists merges and plural renames separately from added and removed topics, plus rejection counts, before a dataset is published.
- Feed image and page meta parsing cover an empty itunes:image tag and a non-string meta document.
- Feed posters stay limited to advertised media. An image that only appears inside the article body is not a card poster.
- On a phone, What's New and Search cards put the poster above the title and description. On a tablet, those cards span the page width.
- What's New and Search cards share one poster-column width, so titles and descriptions on cards with a poster line up down the page. A card with no poster spans the page, and its title and description use that full width.
- Ordinary English words such as “almost”, “change”, “use”, and “say” are not public topics. Shared topic lists keep subjects such as privacy, design, and open source.
- [Connections crawl](/implement/connections/) describes the shared topic catalog and how topic pages list members and related subjects. It does not describe local testing or internal pipeline checks.
- Topic validation treats a folded plural slug as the same subject as the publisher's original tag, so a declared member is not rejected after plural folding.
- Topic phrases keep the words that were actually next to each other. Stopwords are not deleted before pairs are built, so “privacy is design” does not become “privacy design”. Regular plurals such as agents and agent share one slug. news, analysis, business, CSS, Windows, Go, Postgres, ethics, economics, politics, and United States are not stemmed. Postgres is an alias of PostgreSQL. Broader and related subjects stay separate and appear on the topic page when that subject is public. No single publisher seeds the topic vocabulary. A topic page lists publishers alphabetically and rotates their articles. Wander loads the member site in the frame and keeps that site’s origin so its pages, scripts, and fonts can load and the visitor can use the site in the console. Wander still does not frame itself. A link that would leave the framed site shows a bubble beside that click explaining that Wander blocks it and that Open continues on the publisher's site. Dismiss takes focus without scrolling the page to that button. That click leaves the framed page where it was instead of reloading the site root. That note is not left on screen otherwise. Sync does not replace the published topic files when the quality check fails.
- What's New and Search cards use a feed-declared poster when the feed names one, otherwise the page Open Graph or Twitter image. In-article pictures are not used. Cards show the article title and the feed or social description beside a poster scaled to the height of that copy. The poster sits flush with the card's left edge so the card's rounded corners clip it, and the copy starts at the poster's right edge. While an article is shown, the build stores a Sharp-resized WebP of that poster in `assets/activity/posters/` and removes the file when the article is no longer shown.
- Removed the Hosting hub, Nginx hosting recipe, and Implement nav Hosting link.
- Removed the Plain HTML platform recipe (page, nav, fixture, and evidence).
- Rewrote new platform recipes in the same developer-facing voice as Eleventy/Hugo/Jekyll (full declaration copy, build trees, Serve it as JSON, deploy checklist). Jekyll opener now explains that joshternet.org itself publishes this way, instead of “This is the layout joshternet.org uses.”
- Connections “seen on” links show the article title (from content or crawl signals) instead of the raw page URL; Octothorpes `octo:*` rel tokens are not shown in connection cards.
- Connected from rows name the linking site (“linked from …”) instead of reusing outbound “linked to” wording aimed at this card’s own site.
- Empty Shared topics and Connected from sections are omitted from connection cards.
- `CHANGELOG.md` is excluded from the Jekyll publish set (repo history only; not an HTML page or sitemap entry).
- Privacy Official buttons distinguishes Joshternet’s ~five-minute Button State cache from the WordPress plugin’s up-to-15-minute local cache, states that the Button State application does not write lookup origins to a Joshternet application database, and documents WordPress local artwork. Terms is labeled Terms of Service and links Infrastructure Principles. Privacy Providers links `/infrastructure/`.

### Added

- Local registry preview (`_data/network_preview.json`) so `network:sync` can scrape an origin that already publishes `/.well-known/josh` before JoshBot records it. CI ignores the file. The preview list is empty, so local data comes from the JoshBot registry.
- `npm run declaration:verify` checks a live `/.well-known/josh` response. Temporary platform fixtures and recipe-evidence notes used to proof the pages were removed after the recipes were written (#50 remains open).
- Platform recipes: Astro, Next.js, SvelteKit, Nuxt 4, WordPress (plugin-first; lab-verified).

### Changed

- About second-level nav drops GitHub; footer GitHub is a plain icon link (inline Simple Icons SVG) beside the JOIN button, with a visually hidden label. Footer drops the #joshternet IRC link (still on Community / About nav).

### Added

- Canonical Privacy (`/privacy/`) and Terms (`/terms/`) for Joshternet-operated services, written for visitors: hub hosting, Umami, official buttons, nominations/Turnstile, declaration checker, JoshBot, public registry, Wander, OPML. Button lookup facts stay (site address only, no visit of that site, brief cache) without API syntax; WordPress shortcode lookups are the site server’s connection, not each visitor’s browser. Avoids raw hub asset paths. Footer is Privacy, Terms, Security, Contact. WordPress.org External services copy stays in `joshternet/wordpress`.
- Explicit hub licensing (#58): project-owned code BSD-3-Clause (`LICENSE`), prose/docs CC BY 4.0, brand marks not open-licensed; participant screenshots and third-party attribution excluded. Policy in `LICENSING.md` and `/licensing/`; README and Terms point at it. Third-party attribution page at `/licensing/third-party-licenses/` (sitemap, not nav); repo file `THIRD_PARTY_LICENSES.md` stays the source list with markdown Source links.

### Added

- Seed-nominations Worker CI workflow (`.github/workflows/seed-nominations.yml`) and operational README: `npm ci` / tests / Wrangler dry-run on PRs and `main`, plus public API, D1 migrations, abuse controls, failure modes, and production smoke (#55).
- Ghost platform recipe at `/implement/platforms/ghost/`: self-hosted Nginx exact-path `/.well-known/josh`, why not `routes.yaml`, and Ghost(Pro) only when a controllable reverse proxy already sits in front.
- `npm run test:coverage` gates `scripts/{network,nlp,views}` library modules at 100% lines/branches/functions (Node `--experimental-test-coverage`; excludes sync/preflight/glyphs/validate/views CLI entrypoints). Expanded offline unit tests and `test/helpers/mock-fetch.mjs`. `site-quality` and `network-sync` run the gate. Workflow contract tests lock hourly cron `17 * * * *`, `joshternet-registry-updated`, and the quality pipeline. Nav submenu browser tests use fixture HTML (no live `:4000`). CSP site tests skip non-production `_site` (localhost/dev hosts). Topic stub checks no longer hardcode a nightly slug. `npm test` and `npm run test:coverage` both print the coverage report to stdout every run.

### Added

- Exploration pages (`/connections/`, `/topics/`, `/activity/`, `/explore/`, `/network/`, `/wander/`) publish CollectionPage JSON-LD that points at the homepage Project, with TechArticle JSON-LD on the connections and explore implementation notes. Topic neighborhood stubs get descriptions and CollectionPage SEO. Lists use `h-feed`; activity and search cards are `h-entry` with `p-author` / `p-category` / `u-photo`; connection and network cards are `h-card`. Search stays `noindex`.
- Portfolio indexes (`/work/`, `/projects/`, `/portfolio/`) are read during `nlp:sync`. Each work-table row becomes a project in `content.json`, the origin records that it has an online portfolio, and sectors such as banking, government, and health become declared topics that can join topic connections.
- `npm run dev` / `./scripts/dev.sh` starts local Jekyll with LiveReload plus the local button, declaration-check, and seed-nominations Workers. `--dry-run` prints the plan; the script does not kill other servers.
- Data integrity layer for topic/connection intelligence: evidence classes (`declared` / `observed` / `heuristic`), community-eligible topic source whitelist, page roles, HTML entity decoding, hub-scoped derived-page exclusions (`joshternet-analysis=derived`), `_data/content.json` feed items with cross-feed identity, `_data/data_manifest.json` + semantic hashes, explicit `topic_aliases` / `topic_denylist`, build-only `.tmp/topic_candidates.json`, JSON Schema contracts under `schemas/` (network, site-signals, content, topics, connections, blogrolls, data-manifest) validated by Ajv in `npm run nlp:validate`, Members vs Related discoveries on topic pages, blogroll/IndieWeb relations in `connections.json`, and sensitive-heuristic suppression for public participant attachment.
- Implementation guide: [Connections crawl](/implement/connections/) documents evidence authority, public community rules, observed relationship vocabulary, and the one-way pipeline.
- Exploration UI: `/activity/` (What's New, one item per origin), `/search/`, topic neighborhoods with why-here disclosures, connection evidence panels and relation line styles, bounded Wander link trails, and presentation projections from `npm run views:build` (`activity.json`, `explore.json`, `topic_views.json`, `site_views.json`, `search_index.json`).

### Changed

- Outbound hub links keep `noopener` but drop `noreferrer`. Document referrer policy is `strict-origin-when-cross-origin` so cross-origin `Referer` is the hub origin only (no path or query). Outbound `https:` hrefs append `utm_source=joshternet.org`, `utm_medium=referral`, `utm_campaign`, and `utm_content` (hub path, not query strings) for page-level attribution. `rel="me"` GitHub on the homepage is not rewritten. Privacy on `/privacy/` discloses Referer, UTMs, HTTPS-only params, Wander/image exclusions, and button clicks that send a member origin back to hub Umami. The official button embed sends the member site origin (not path) as `Referer` and only follows `href` values on the hub origin. Images and Wander iframe previews still omit referrers.
- Hourly `network-sync` and `npm run build` run `npm run format:data` on generated `_data/*.json` before commit/validate, so Prettier stops failing after Actions rewrites network datasets.
- RSS/Atom category labels unwrap XML CDATA, so tags like Heathcliff are stored as `Heathcliff` instead of `<![CDATA[Heathcliff]]>`. Path-shaped CMS chrome (`feeds/default`, `keywords/Government`) is not a topic. SEO `meta:keywords` / `schema:keywords` and portfolio-index chrome do not enroll communities. Evaluative filler such as `good` is not a topic.
- Content items always publish `summary` as a plain-text string (empty when a feed has no description). Unparseable feed dates stay omitted instead of throwing. Oversized fetches are truncated instead of aborting. `nlp:validate` names the failing item identity. Local probe tools can sample robots-allowed public sites against the same schema.
- Local `npm run nlp:scale-probe` can stress-test the topic/content/connection/views pipeline offline against public registry-style member lists. Presentation overlays stay capped; canonical graph files are not truncated. Does not publish Network data.
- Compact (mobile) Menu uses a full-row accordion: tap About / Network / Implement / JoshBot to reveal indented children. The hub page is the first child. The ↓ rotates when the section is open.
- Local `npm run dev` gives each Worker its own Wrangler inspector port so the three `wrangler dev` processes do not collide.
- Official Joshternet buttons render as registry-validated inline SVG from the one-line embed. `/api/button-state` keeps `ok`, `state`, `href`, `alt`, and `linkLabel` and no longer returns `imageURL`. Worker image routes and `/assets/buttons/` files are gone (#59).
- `/joshbot/` retention disclosure aligned to JoshBot v1.1.0 using the JoshBot README, `docs/crawler.md`, `docs/retention.md`, and crawl telemetry schema: sanitized crawl telemetry and durable ops state are stated; false “no page depth / page history” claims removed; default ~30-day cleanup called out; still not a web archive (#54).
- Feature PRs no longer ship regenerated crawl/view `_data` JSON; hourly `network-sync` owns that publish set on `main` (hand-edited nav/config under `_data/` still belongs in PRs).
- Ghost platform recipe fact-hardening: `routes.yaml` trailing-slash rules (required + forced), `content_type` cannot satisfy the exact path, Ghost(Pro) subdirectory/proxy as a paid Business-plan add-on, and citations to Ghost reverse-proxy, routing, and subdirectory help. Dropped the after-title “exact path / not `.json`” lecture; title and recipe steps already carry that.
- Site tests stop matching visitor-facing prose (recipe leads, UI labels, marketing blurbs). They lock permalinks, nav paths, snippets, selectors, microformats, and forbidden-pattern bans instead.
- Platform recipes (Eleventy, Ghost, Jekyll) lead deploy checks with `/implement/validate/` and keep the curl checklist as the direct alternative.
- Page SEO titles, descriptions, and keywords are sized for search results: topic stubs use ~50–60 character titles and ~120–160 character descriptions, main pages carry matching meta, the layout emits `keywords`, and document titles skip a duplicate `| Joshternet` when the page title already names the brand.
- Nav current-state matching is exact by default; Platforms and Topics opt into prefix match. Section flags live in one include. CSP only allows https host origins for activity images. IndexNow tracks platform recipe paths. `/explore/` was never on production, so it is omitted rather than redirected.
- After-title lecture copy is gone on Implement, Platforms, Buttons, Connections crawl notes, and Explore notes. Pages keep a short lead or go straight into the work.
- Implement second-level nav keeps a single Platforms link. Eleventy and Jekyll recipes live under `/implement/platforms/` and are listed from `_data/platforms_nav.yml`. Old `/implement/eleventy/` and `/implement/jekyll/` URLs were never on production, so they are omitted rather than redirected.
- Second-level nav on tablet/touch opens with a tap (first tap shows the row, a second tap on the same top-level item follows its link). Hover on a fine pointer is unchanged.
- Nominate lives under the JoshBot top-level item (`_data/joshbot_nav.yml`), not Network. The Network row is What’s New, Topics, Connections.
- The Topics hub packs neighborhood cards into a compact mosaic grid instead of full-width rows with empty title-to-count space.
- Connection chart bubble uses even padding, a reserved column for the close control, stacked pair titles, and matching section/list rows so labels and links share one alignment. The bubble grows with its content instead of scrolling inside the card. Shared-topic bubbles place an arrow and relation between the two names (→ one-way, ↔ both ways or topic-only). Topic chips ignore global list indent and sibling top-margin so both columns of a row sit on the same line.
- Connection chart lines between the same sites sit on separate rest curves with a wider invisible hit path so each stroke can be clicked. Single lines stay still; they do not slide on hover. Clicking a circle or line still opens the chart bubble; map pan only starts after the pointer actually moves.
- The connections chart is a map viewport: Joshternet stays in the center on load, participating sites sit farther apart, and the framed area pans and zooms so a larger network can extend beyond what is visible.
- `npm run build` refreshes datasets from the current registry (`network:sync`, `nlp:sync`, `nlp:validate`) and then builds the static site. Repeat runs leave a dataset file in place when only its timestamp changed. The registry sync also publishes the view datasets (`activity`, `explore`, `topic_views`, `connection_topics`, `site_views`, `search_index`).
- Generated graph files are sparse documents (`schema_version`, counts, omitted empty lists) instead of root `[]`. `blogrolls.json` records OPML advertisements and marks hub-generated OPML as non-evidence. `network:sync` no longer overwrites `connections.json` (published by `nlp:sync`).
- Integrity follow-up: connections aggregate to `(from, to, relation)` with `evidence[]`; site_signals evidence is keyed and timestamped (or omitted); canonical `score` is gone; content summaries are plain text and join page declarations/`language`/`page_role`; `data_manifest` hashes include `network` and `blogrolls`; `site_signals` declares `schema_version`.
- Observed participant connections (#36/#45): network enrichment records homepage and already-fetched about-page `<a href>` bridges between current registry participants into `_data/connections.json` as `{from,to,href,text,rel,page}` observations (no weights, trust, popularity, or inferred meaning). Same-origin, non-participant, mailto/tel/javascript/data, and malformed links are dropped; exact duplicates collapse; edges disappear when a link or participant leaves. `/connections/` shows an HTML-first directed relationship list plus an optional equal-weight selectable graph, cross-linked with Network and Wander. Does not change JoshBot or `/.well-known/josh`.
- Official Joshternet web buttons (#32): four pixel-art PNGs, a Cloudflare Worker on joshternet.org (`/embed/joshternet-button.js`, `/button`, `/api/button-state`) that maps JoshBot registry membership to Verified Josh / Verified Non-Josh / Undeclared / Join (failing closed when the registry is unavailable), a one-line async embed, docs at `/implement/buttons/`, and the matching button in the site footer.
- Joshes Elsewhere (#37): network enrichment discovers homepage and same-origin about-page `rel="me"` links and catalog social profile links (even without `rel`), publishes an optional `elsewhere` array on participants (email, unsafe URLs, and non-profile paths like GitHub repos dropped), and shows those profiles as icon links on taller Network cards. Icons use brand marks on a single `/assets/icons/elsewhere-sprite.svg` sheet (CSS mask-position)—Simple Icons CC0 paths plus the LinkedIn brand-guidelines mark, with a first-party `web` glyph—documented in `THIRD_PARTY_LICENSES.md`. Marks identify participant-published links only. Feed and elsewhere icons share a compact bottom-left grid. Every network sync (including keep-path / hourly) refreshes elsewhere so cards stay current without a full screenshot recapture.
- Network enrichment discovers advertised blogroll OPML (`rel=blogroll` `text/xml`), publishes participant-to-participant edges to `_data/blogrolls.json`, and writes `/assets/network/joshternet.opml` listing every current Network site (with primary feed and nested blogroll link when available). Refreshed on every network sync.
- Site-wide `<head>` advertises the aggregate blogroll with `<link rel="blogroll" type="text/xml" href="/assets/network/joshternet.opml">` so feed readers can discover it from any page. The Network page no longer shows a duplicate body subscribe link.
- Network enrichment discovers advertised RSS, Atom, and JSON Feed `link[rel=alternate]` declarations during homepage capture and publishes an optional `feeds` array on Network participants. Every network sync refreshes feeds for the current registry membership (including kept screenshots); the hourly job always runs so cards stay aligned as the network grows and shrinks.
- Network cards show an RSS control that opens the participant's primary advertised feed when `feeds` is present.
- Implementation guide: Jekyll recipe for publishing `.well-known/josh`, including the `include` rule and Content-Type / curl checks.
- Primary nav: Implement second-level links (validate, Eleventy, Jekyll) in a frameless row under the header circle-dot motif on tablet/desktop, with raindrop disclosures in the mobile Menu. The Implement item itself opens `/implement/`.

### Changed

- Site footer keeps Privacy / Security / Contact / chat / GitHub links flush against the Joshternet button on the right instead of floating in the middle.
- Tablet primary nav matches the desktop top-row pattern instead of the three-column chip grid.
- Implement second-level links overlay under the circle-dot rule without a panel background or page shift; the current section stays visible unless another top-level branch with its own subnav is hovered.
- Search is a top-level primary nav item. Network’s second-level row is What’s New, Topics, Connections. Duplicate in-page path toolbars on What’s New, Topics, Connections, Network, and topic pages are gone.
- What's New cards stack title with the date on the right, then author, summary, topics, and the domain in the bottom-right. Feed-advertised https images still appear when the publisher included them.
- What's New has no type or site filters. Intro: “Recent articles from around the Joshternet.”
- Topics intro: “Topics from around the Joshternet.”
- Connections cards put a larger screenshot on the left, with name, domain, and description beside it. Relation marks sit in the top-right of the card. Empty Connects to sections are omitted from a card. Shared topics is one collapsed accordion whose summary shows the topic count; opening it lists each topic name and article count, without a “Topic:” prefix. Connects to and Connected from stay side by side; shared topics span the width under them. The graph footer keeps Show on the graph (toggles only) separate from the Line key (stroke samples only), both on one short row under the chart. The chart draws the same observed links and shared-topic relations as the cards, on separate strokes when both exist between a pair. Clicking a circle or line explains that connection in a bubble on the chart, without the site description, domain, or extra actions. The page does not jump, and the old “Select a participating site” panel is gone. The Joshternet hub card is always last. NLP crawl no longer aborts a whole origin on a `mailto:` feed or page URL.
- Connections graph footer: relation filters on the bottom left, colored line-style key on the bottom right. The redundant “Select a site or a link” prompt is gone.
- Search intro: “Search from around the Joshternet.”
- Search results use the same activity cards as What’s New.
- Neighborhood pages are ordinary Jekyll pages in `topics/*.md` (hub at `topics/index.md`) so `/topics/:slug/` is emitted on watch and production builds.
- Topics hub uses cards sorted by how often the subject appears across articles and sites, not by site count alone. Filler unigrams such as “another” are not subjects. One site with matching articles is enough to list a topic. Topic pages omit sites with no related articles.
- NLP crawl seeds publisher topic directories (`/topics/`, `/tags/`, `/categories/`) even when those URLs are absent from `sitemap.xml`, and treats hub links as declared subjects.
- Nightly `nlp:sync` builds a topic catalog from the richest remaining member and matches it onto other sites’ writing, including sites without Microformats or JSON-LD. Feed crawl follows up to 80 entries per origin.
- Footer and About-nav #joshternet and GitHub links open in a new tab and show an off-site ↗. Those ↗ marks no longer inherit the footer brand circle.
- `/connections/` lists shared topics when two or more participants have matching articles, without writing those overlaps into `connections.json`. NLP crawl also seeds common writing indexes (`/notes/`, `/blog/`, `/posts/`, `/now/`, …) even when they are absent from `sitemap.xml`.

### Removed

- Wander mode chooser (“How should curiosity move?”, Random site / Follow the links).
- `/explore/` hub page. `explore.json` and `views:build` stay.
- HTML redirect stubs for `/implement/eleventy/` and `/implement/jekyll/` (#63). Those paths were never published on production; recipes live only under `/implement/platforms/`.
- Root `/data/` page (`data.md`). Topic neighborhood `/topics/data/` and `_data/` artifacts stay.

### Fixed

- Latest-posts / activity cards share a wide 46% poster column (full card height, `object-fit: contain`) so thumbnails line up at the original width without heavy cropping; the old JS media-width fitter is removed.
- Filler `thought`/`thoughts` cannot become public heuristic topics after plural fold; heuristic membership now requires page-bearing evidence so empty-evidence signals cannot fail `nlp:sync` with `heuristic-without-evidence` (for example “Thoughts on …” titles without pages).
- Search topic results only link to Topics-hub neighborhoods (communities with matching article members), so Search no longer points at empty `/topics/{slug}/` URLs that 404 (#61). Topic-hub link text with trailing counts (e.g. `privacy 45`) no longer invents `/topics/privacy-45/` slugs; views no longer invent page-less topic URLs from content tags alone.
- `/search/` stays `robots: noindex` and is excluded from `sitemap.xml` via `sitemap: false` (#62).
- Filler unigrams such as `two`, `less`, `find`, `real`, `built`, and `making` are non-subjects, so they do not become public topic neighborhoods or search topic hits (#64).

- Topic schema and `nlp:validate` accept single-member public communities again (one qualifying site is enough). The old ≥2-site rule was left behind after Topics started listing declared single-site subjects, which broke CI `npm run build`.
- Declared-only topic communities no longer advertise `visible-text` / `nlp` in `sources` when the only heuristic evidence was below the membership threshold (related discovery). That mismatch also failed `nlp:validate`.
- Catalog matching no longer leaves stale `evidence_count` values when it upgrades or attaches heuristic evidence. It merges and dedupes evidence, then sets `evidence_count` to the array length so `nlp:validate` stays green after a fresh sync.
- Wander keeps a desktop gap under the top nav matching the second-level row, so that overlay has a place to sit above the wander bar without covering Go / Open.
- Wander bar draws a top border so the blue nav gap meets the white toolbar.
- Local Wander no longer iframes `joshternet.org` (CSP omits the hub), so it uses the self-host fallback instead of a blank frame.
- Inline `code` tokens such as `/.well-known/josh` stay on one line instead of wrapping at the hyphen.
- Network cards no longer list topic neighborhoods, recent posts, or crawl transparency. Screenshot, title, description, feed, elsewhere, and domain stay.
- Topic communities no longer require a publisher tag opt-in. `/.well-known/josh` participation is the only Joshternet-specific election. Declared labels still qualify immediately; strong heuristic evidence may also enroll, with provenance preserved. Weak incidental overlap, parser artifacts, and boilerplate still do not.
- Connections cards hide browser `rel` tokens (`noopener`, `noreferrer`) and list only sites that already have an observed participant link. Isolated sites remain on Network.
- What's New shows at most one feed item per origin from the last seven days.

- Connections ignore Joshternet directory pages (`/network/`, `/wander/`, `/connections/`, `/topics/…`) as evidence, so republished participant feeds and elsewhere profiles no longer create `link` or `friend` bridges.
- Secondary nav current-page underline uses an inset box-shadow reserved on every item, so the active label no longer shifts up relative to its row neighbors.
- Joshternet button Worker route for `/button` uses a trailing `*` so requests with `?origin=` match Cloudflare Worker routes (exact `/button` only matches URLs without a query string).
- Joshternet button Worker registry fetch uses `redirect: "manual"` (Workers reject `redirect: "error"`), so local and edge registry reads succeed instead of failing closed with 503.
- Development CSP allows Joshternet button images from `https://joshternet.org` and the local Worker on `:8790` so the footer embed can paint during `jekyll serve`.
- Button embed loads artwork from the Worker `/button` route (same origin as the script) so local previews do not depend on production Pages assets.
- Review follow-ups for #51: live declaration checks treat non-404/410 HTTP failures (401/403/429/etc.) as unread instead of invalid; network sync retains prior blogroll edges when enrichment or capture fails; orphan `declaration-*.mjs` twins removed; declaration-check Worker tests run in CI; elsewhere glyph mask positions are generated from `elsewhere-sprite-order.json` into `assets/css/elsewhere-glyphs.css`; PR keeps existing Network screenshot webps instead of recaptures; declaration-check allowlist includes `https://www.joshternet.org`.
- Drop jekyll-seo-tag advertisements from rendered HTML: the `generator` meta tag and the Begin/End Jekyll SEO HTML comments.
- Implement submenu: keep the hover path open across the gap under the circle-dot rule by treating the whole header as the open zone, dismiss immediately when another top-level item is entered, and keep sticky overlay behavior on Implement section pages without pushing page content.
- Declaration check has no lecture under the title. Paste and live-origin forms start empty with placeholders, keep feedback between the heading and the field, and color each field for valid or invalid.
- Live origin checks read `/.well-known/josh` through a Joshternet Worker so valid declarations are not blocked by missing publisher CORS headers. The Worker requires an allowlisted browser Origin, rate-limits by client IP and target origin, and does not follow cross-origin redirects.
- Network sync consumes JoshBot registry participation metadata (`first_participated_at`, declarations, latest check time/outcome) and publishes only currently participating origins.
