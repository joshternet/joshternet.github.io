# Changelog

## Unreleased

### Changed

- Privacy Official buttons distinguishes Joshternet’s ~five-minute Button State cache from the WordPress plugin’s up-to-15-minute local cache, states that the Button State application does not write lookup origins to a Joshternet application database, and documents WordPress local artwork. Terms is labeled Terms of Service and links Infrastructure Principles. Privacy Providers links `/infrastructure/`.

### Added

- Joshternet Infrastructure Principles at `/infrastructure/`: provider selection standards for Joshternet-operated services only, independent-site boundary, provider lifecycle and removal, and currently used inventory (GitHub, Cloudflare, Umami, webmention.io, IndexNow, octothorp.es).

### Changed

- About second-level nav drops GitHub; footer GitHub is a plain icon link (inline Simple Icons SVG) beside the JOIN button, with a visually hidden label. Footer drops the #joshternet IRC link (still on Community / About nav).

### Added

- Canonical Privacy (`/privacy/`) and Terms (`/terms/`) for Joshternet-operated services, written for visitors: hub hosting, Umami, official buttons, nominations/Turnstile, declaration checker, JoshBot, public registry, Wander, OPML, Webmentions. Button lookup facts stay (site address only, no visit of that site, brief cache) without API syntax; WordPress shortcode lookups are the site server’s connection, not each visitor’s browser. Avoids raw hub asset paths. Footer is Privacy, Terms, Security, Contact. WordPress.org External services copy stays in `joshternet/wordpress`.
- Explicit hub licensing (#58): project-owned code BSD-3-Clause (`LICENSE`), prose/docs CC BY 4.0, brand marks not open-licensed; participant screenshots and third-party attribution excluded. Policy in `LICENSING.md` and `/licensing/`; README and Terms point at it. Third-party attribution page at `/licensing/third-party-licenses/` (sitemap, not nav); repo file `THIRD_PARTY_LICENSES.md` stays the source list with markdown Source links.

### Added

- Seed-nominations Worker CI workflow (`.github/workflows/seed-nominations.yml`) and operational README: `npm ci` / tests / Wrangler dry-run on PRs and `main`, plus public API, D1 migrations, abuse controls, failure modes, and production smoke (#55).
- Ghost platform recipe at `/implement/platforms/ghost/`: self-hosted Nginx exact-path `/.well-known/josh`, why not `routes.yaml`, and Ghost(Pro) only when a controllable reverse proxy already sits in front.
- `npm run test:coverage` gates `scripts/{network,nlp,views}` library modules at 100% lines/branches/functions (Node `--experimental-test-coverage`; excludes sync/preflight/glyphs/validate/views CLI entrypoints). Expanded offline unit tests and `test/helpers/mock-fetch.mjs`. `site-quality` and `network-sync` run the gate. Workflow contract tests lock hourly cron `17 * * * *`, `joshternet-registry-updated`, and the quality pipeline. Nav submenu browser tests use fixture HTML (no live `:4000`). CSP site tests skip non-production `_site` (localhost/dev hosts). Topic stub checks no longer hardcode a nightly slug. `npm test` and `npm run test:coverage` both print the coverage report to stdout every run.

### Added

- Exploration pages (`/connections/`, `/topics/`, `/activity/`, `/explore/`, `/network/`, `/wander/`) publish CollectionPage JSON-LD that points at the homepage Project, with TechArticle JSON-LD on the connections and explore implementation notes. Topic neighborhood stubs get descriptions and CollectionPage SEO. Lists use `h-feed`; activity and search cards are `h-entry` with `p-author` / `p-category` / `u-photo`; connection and network cards are `h-card`. Search stays `noindex`.
- Portfolio indexes (`/work/`, `/projects/`, `/portfolio/`) are read during `nlp:sync`. Each work-table row becomes a project in `content.json`, the origin records that it has an online portfolio, and sectors such as banking, government, and health become declared topics that can join topic connections.
- `npm run dev` / `./scripts/dev.sh` starts Jekyll with LiveReload on `0.0.0.0:4000` (`http://127.0.0.1:4000/` locally, or this machine’s LAN IP from other devices) plus the local button (`:8790`), declaration-check (`:8789`), and seed-nominations (`:8787`) Workers. `--dry-run` prints the plan; the script does not kill other servers.
- Data integrity layer for topic/connection intelligence: evidence classes (`declared` / `observed` / `heuristic`), community-eligible topic source whitelist, page roles, HTML entity decoding, hub-scoped derived-page exclusions (`joshternet-analysis=derived`), `_data/content.json` feed items with cross-feed identity, `_data/data_manifest.json` + semantic hashes, explicit `topic_aliases` / `topic_denylist`, build-only `.tmp/topic_candidates.json`, JSON Schema contracts under `schemas/` (network, site-signals, content, topics, connections, blogrolls, mentions, data-manifest) validated by Ajv in `npm run nlp:validate`, Members vs Related discoveries on topic pages, blogroll/IndieWeb relations in `connections.json`, and sensitive-heuristic suppression for public participant attachment.
- Implementation guide: [Connections crawl](/implement/connections/) documents evidence authority, public community rules, observed relationship vocabulary, and the one-way pipeline.
- Exploration UI: `/activity/` (What's New, one item per origin), `/search/`, topic neighborhoods with why-here disclosures, connection evidence panels and relation line styles, bounded Wander link trails, and presentation projections from `npm run views:build` (`activity.json`, `explore.json`, `topic_views.json`, `site_views.json`, `search_index.json`).

### Changed

- Outbound hub links keep `noopener` but drop `noreferrer`. Document referrer policy is `strict-origin-when-cross-origin` so cross-origin `Referer` is the hub origin only (no path or query). Outbound `https:` hrefs append `utm_source=joshternet.org`, `utm_medium=referral`, `utm_campaign`, and `utm_content` (hub path, not query strings) for page-level attribution. `rel="me"` GitHub on the homepage is not rewritten. Privacy on `/privacy/` discloses Referer, UTMs, HTTPS-only params, Wander/image exclusions, and button clicks that send a member origin back to hub Umami. The official button embed sends the member site origin (not path) as `Referer` and only follows `href` values on the hub origin. Images and Wander iframe previews still omit referrers.
- Hourly `network-sync` and `npm run build` run `npm run format:data` on generated `_data/*.json` before commit/validate, so Prettier stops failing after Actions rewrites network datasets.
- RSS/Atom category labels unwrap XML CDATA, so tags like Heathcliff are stored as `Heathcliff` instead of `<![CDATA[Heathcliff]]>`. Path-shaped CMS chrome (`feeds/default`, `keywords/Government`) is not a topic. SEO `meta:keywords` / `schema:keywords` and portfolio-index chrome do not enroll communities. Evaluative filler such as `good` is not a topic.
- Content items always publish `summary` as a plain-text string (empty when a feed has no description). Unparseable feed dates stay omitted instead of throwing. Oversized fetches are truncated instead of aborting. `nlp:validate` names the failing item identity. Local `npm run nlp:probe-directory` samples robots-allowed joshing.you sites against the same schema.
- Local `npm run nlp:scale-probe` harvests every member origin listed on joshing.you (not the directory host), runs the topic/content/connection/views pipeline as synthetic members, and replays parsers thousands of times offline. Presentation overlays cap pair/search/co-occurrence size; canonical graph files are not truncated. Does not publish Network data.
- Compact (mobile) Menu uses a full-row accordion: tap About / Network / Implement / JoshBot to reveal indented children. The hub page is the first child. The ↓ rotates when the section is open.
- Local `npm run dev` gives each Worker its own Wrangler inspector port (`9230` / `9231` / `9232`) so the three `wrangler dev` processes do not collide on the default `127.0.0.1:9230`.
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
- Nightly `nlp:sync` builds a topic catalog from joshuamorris.info (or the richest remaining member) and matches it onto other sites’ writing, including sites without Microformats or JSON-LD. Feed crawl follows up to 80 entries per origin.
- Footer and About-nav #joshternet and GitHub links open in a new tab and show an off-site ↗. Those ↗ marks no longer inherit the footer brand circle.
- `/connections/` lists shared topics when two or more participants have matching articles, without writing those overlaps into `connections.json`. NLP crawl also seeds common writing indexes (`/notes/`, `/blog/`, `/posts/`, `/now/`, …) even when they are absent from `sitemap.xml`.

### Removed

- Wander mode chooser (“How should curiosity move?”, Random site / Follow the links).
- `/explore/` hub page. `explore.json` and `views:build` stay.
- HTML redirect stubs for `/implement/eleventy/` and `/implement/jekyll/` (#63). Those paths were never published on production; recipes live only under `/implement/platforms/`.
- Root `/data/` page (`data.md`). Topic neighborhood `/topics/data/` and `_data/` artifacts stay.

### Fixed

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
