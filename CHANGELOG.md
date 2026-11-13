# Changelog

Notable changes for Joshternet visitors, publishers, and operators. Internal
engineering notes stay in git history; this file is for people reading the repo.

## Unreleased

### Fixed

- **Network card display titles:** Curated overrides publish Joshua Galinato
  (`galina.to`), Josh Marinacci (`josh.earth`), Josh Leeb (`joshleeb.com`),
  Josh Levinger (`levinger.net`), and Josh Hall (`peira.dev`) instead of host or
  slogan titles, and keep those names on later `network:sync` runs.
- **Path-scoped crawl roots:** Curated `_data/network_crawl_roots.json` points
  network capture and NLP crawl at a participant path (starting with
  `levinger.net` → `/josh/`) while the registry origin stays apex-only.
- **Site-family view projection:** Topic and site views remap secondary origins
  through `promoteNetworkOrigin` (including null signal rows) so family
  primaries keep destination edges and neighborhood membership after sync.
- **Seeking hub dedupe:** Seeking no longer extracts requests from
  joshternet.org’s own `/seeking/` page, which aggregates member listings and
  had duplicated those requests in the Seeking view.
- **Multi-site content attribution:** Aggregate feeds no longer publish another
  participant origin’s URLs under the wrong `site_origin` (for example
  joshwithers.au owning joshwithers.blog / marriedbyjosh.com posts), which had
  tripped `cross-origin-content` during `nlp:sync`. YouTube Atom harvest still
  accepts `youtu.be` entries alongside `youtube.com`.
- **Showcase validate / music indexes:** `nlp:validate` allows Showcase music
  recordings and albums at bare `/sounds`/`/music` paths (same exception as
  Showcase selection), so sync no longer fails on entries like
  `https://joshtronic.com/sounds/`.
- **Connection link hygiene:** Scraped connection targets drop `utm_*` and
  common click-id query params (for example referral tags on friends links) so
  Connections stores clean destination URLs.
- **Network updates:** Scheduled registry refreshes no longer stall when
  installing Chromium for browser checks; the job downloads the browser without
  relying on flaky Ubuntu package mirrors.
- **Network views after sync:** Wander, Connections, and related pages keep
  reading the published network datasets correctly after an encoded crawl
  publish.
- **Network / Topics cross-links:** Network footnote links to Friends; Topics
  footnote links to the Explore content-handbook chapter again.

### Added

- **Network site families:** Curated `_data/network_site_families.json` groups
  multi-site people under one promoted primary (starting with Josh Withers:
  `joshwithers.au` with blog and wedding destinations). Projection re-runs on
  every `network:sync`; secondaries stay crawl participants but are omitted from
  Network, Friends, Welcome, Meet, Wander, Connections nodes, Search site hits,
  and OPML, and appear as “Also in the Network” links on the primary card.
- **JoshBot verified crawler identity:** `/joshbot/` explains that JoshBot is a
  Cloudflare Verified Bot, signs requests with Web Bot Auth, publishes a public
  signing-key directory, and lists identity details in the Cloudflare Radar
  Bots Directory. Privacy and robots handbook pages point to the same
  disclosure.
- **Privacy: Cloudflare hub delivery:** `/privacy/` states that public
  joshternet.org traffic is delivered through Cloudflare before GitHub Pages,
  that Workers share that provider relationship, and that Cloudflare Web
  Analytics is not used on the hub.
- **Friends of the Joshternet:** `/friends/` celebrates Network participants who
  declared they are not Joshes, listed from the same Network data as `/network/`
  with a Friends entry in Network secondary nav.
- **GitHub star CTA:** Header and mobile Menu star control for
  `joshternet/joshternet.github.io`, with a build-time count that can refresh
  from GitHub’s public API when JavaScript is available.
- **Observation platform:** Crawl-derived datasets now share one lifecycle:
  discover → fetch through a central broker → durable source and observation
  stores → extract/reconcile/project → validate a candidate generation → commit
  only after a successful push. Ownership rules, registry fail-closed checks, and
  generation provenance are documented in `docs/data-pipeline.md` and
  `docs/operations.md`.
- **Uses explorer:** Anonymous network `/uses/` comparisons from publisher Uses
  pages—coverage counts, comparable tool slots, accrued history, and handbook
  methodology under `/implement/content/uses/`.
- **Seeking (preview):** Optional `/seeking` discovery for explicit wanted
  listings, with handbook chapter and Network nav. Live production excerpts stay
  behind an explicit publish path.
- **Directories, events, and talks:** Speaking archives and related indexes feed
  Happening (`/events/`), Past (development), iCalendar for upcoming events, and
  Showcase Talks & Presentations.
- **Showcase and What's New:** Creative work, writing, podcasts/live streams, and
  related cards across homepage, `/showcase/`, and `/activity/`, with posters,
  fair-per-origin limits, and Atom/OPML keep-up links.
- **Connections graph:** Peer links and shared-topic overlays on `/connections/`
  and a homepage preview; hub membership is not treated as a peer edge.
- **Local classifier:** When rules leave a Uses claim unsorted, an accepted
  proposal from the locked local model can publish a slot during local sync and
  CI (weights stay out of git).
- **Platform and join guides:** Undeclared-first `/.well-known/josh` recipes for
  major static and CMS hosts, plus Join, Validate, Nominate, JoshBot, Specs,
  Community, and Governance editorial rewrites.
- **Footer stamps:** Network updated and Site built times in the footer and
  matching meta / JSON-LD fields.

### Changed

- **Seeking unpublished:** Hub `/seeking/` is unpublished and removed from Network nav while duplicate aggregation is sorted out.

- **Topics footnote:** Pitch and discovery disclaimer sit under the topic list as
  a muted page footnote instead of mid-intro body copy.
- **Visitor copy:** Homepage, Network, Wander, Search, Topics, Showcase, What's
  New, Connections, Events, Join, Implement, and related pages use a warmer
  discovery voice without changing protocol or data contracts.
- **Uses presentation:** Comparable slots are kind-banded mosaic cards with
  anonymous counts and shares. Review-only Unsorted / Setup / Stated lists appear
  in development only. Choice names link to project or manufacturer sites when
  known; store URLs are omitted.
- **Crawl publish set:** Published datasets use compact short keys for Liquid and
  progressive scripts. Local crawls stay gitignored; hourly network sync force-adds
  the publish set onto `main`.
- **Local sync scope:** `npm run update:local` crawls the Joshternet registry
  only (non-registry intake paths removed).
- **Happening Past:** Past events list (and Past counting toward Network nav)
  renders only in development; production shows Upcoming and iCal.
- **What's New:** Writing stays on What's New; podcasts and videos stay on
  Showcase where appropriate. Subscribe footnote sits under the cards.
- **Activity and Showcase layout:** Shared card rhythm, poster framing, and
  responsive columns; music/sounds harvests emit per-listen and per-project cards
  instead of blank index shells.
- **Connections UI:** Clearer inbound/outbound rows, graph labels, line key, and
  tally; overlapping domain labels no longer collide.
- **Example fiction domain:** Publisher-facing docs and helpers use
  `joshua.example` (and allowed second origins) consistently.

### Fixed

- **Cold `npm run build` Uses classifier:** `scripts/build.sh` runs
  `node scripts/uses/prepare-model.mjs` before `nlp:sync` so a missing
  `.tmp/models` cache on first run downloads the locked model instead of
  exiting with `nlp uses failed: uses model cache is missing`. After a
  pinned-revision Hub download, prepare promotes
  `modelId/<revision>/…` files into the flat lock paths Transformers.js
  uses for `localModelPath`. Site quality restores the same Actions
  `.tmp/models` cache key as network-sync.
- **Prettier Liquid scope:** `liquid-html` applies only to `_includes/**/*.html`
  and `_layouts/**/*.html`. Other HTML uses Prettier’s built-in `html` parser.
  Harvest fixtures under `test/fixtures/**/*.html` stay ignored—Shopify’s
  `liquid-html` never converges on captured pages with inline `</script>` in JS.
- **Uses aggregate coverage stability:** Replace optional-chaining / compound
  `||` guards in `scripts/uses/aggregate.mjs` with explicit checks so Node’s
  experimental branch coverage stays at 100% across full-suite runs. Drop
  unreachable `slotUnits.get(...) || fallback` denominators and redundant
  `choiceName || displayName` short circuits that flaked at ~99.36% branches
  under parallel coverage merges.
- **Showcase accuracy:** Utility/licensing segments stay out of creative
  harvest; graphics hubs, music indexes, year photo albums, and speaking-archive
  presentations classify and link more reliably. Empty or chrome titles no longer
  become cards; cross-posted twins collapse.
- **Past events hygiene:** Appearance titles drop min-read and year-crumb chrome;
  successful gathers prune stale speaking-archive zombies; empty titles stay off
  listings.
- **Uses classification:** Hardware, OS, editors, printers, finance, hosting, and
  related slots rank more accurately; umbrella lines peel into named products;
  section headings are not treated as products; false positives (games, plugins,
  sentence leftovers, site paths) stay out of rankings.
- **Uses history and validation:** Period close preserves crawl overlays;
  replayed state matches event history; catalog edits reclassify without fake
  adoption; anonymous choice links work again.
- **Crawl encoding contract:** On-disk crawl JSON uses short keys; Liquid and
  page scripts read those keys; missing network data no longer breaks Jekyll
  serve.
- **Topics hub:** Obsolete local snapshot collisions no longer blank `/topics/`.
- **Security and fetch:** Shared public-URL checks, redirect hop limits, body
  ceilings, and poster fetch deadlines harden crawler fetches against private
  targets and hung downloads.
- **Seeking and Uses after short-circuit:** Slash pages are still fetched when
  deep crawl is skipped so explorers do not stay empty.
- **Cards and media:** Summaries no longer glue labels into URLs; posters respect
  robots and size limits; CSP-safe Uses coverage bars; content-discovery stage
  padding no longer collapses against the accent edge.
- **Observation quality:** Platform modules meet the same 100% coverage gate as
  the other library scripts (CLI entrypoints excluded). Generated coverage
  artifacts and sync manifests stay gitignored.

### Removed

- Non-registry local intake scripts and caches (`uses.tech` merge,
  `update:local:nonjoshternet`, preview-only network fixture cards).
- Welcome postcard / participant-introductions scaffolding.
- Duplicate `/implement/uses/` path (methodology lives under Content handbook).
- Plain HTML platform recipe.
- Retired Cloudflare Web Analytics origins from generated CSP/HTML.
