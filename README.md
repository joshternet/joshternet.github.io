# Joshternet website

The GitHub Pages website for Joshternet. The canonical specifications are maintained in [joshternet/spec](https://github.com/joshternet/spec).

## License

Project-owned **code** is [BSD-3-Clause](LICENSE). **Prose and docs** are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). **Brand assets** are not open-licensed. Participant screenshots and third-party material are not relicensed here. Full split: [Licensing](https://joshternet.org/licensing/). Third-party dependency attribution: [Third-party licenses](https://joshternet.org/licensing/third-party-licenses/).

## Documentation examples

Publisher-facing docs and UI samples use the reserved fiction host **`joshua.example`** (for example `https://joshua.example/`). When a second origin is required, use `profiles.joshua.example`, `other.example`, or `friends.joshua.example`—not `example.com`, `example.invalid`, or `harbor.example`.

## SEO and IndieWeb markup

Pages use `jekyll-seo-tag` for canonical/Open Graph/Twitter cards plus page `seo.k7m` front matter. Derived exploration graphs live in [`_includes/derived-jsonld.k2z`](_includes/derived-jsonld.k2z) (CollectionPage/TechArticle/WebPage, Project `about`, capped ItemList, BreadcrumbList). Body markup uses microformats2 (`h-feed` / `h-entry` / `h-card`) on activity, network, connections, topics, and welcome lists. Aggregator listings use `robots: max-snippet:160, max-image-preview:large`. `/search/` stays `robots: noindex` and off the sitemap. Build-time member crawls honor each site’s `robots.txt` (see [Implement → Connections](implement/connections.md#crawling-and-seo-manners)).

## Requirements

- Ruby 3.3
- Bundler

## Build and test locally

Install dependencies:

```sh
bundle install
npm ci
```

### Quality checks

| Script | Purpose |
| --- | --- |
| `npm test` | Library unit tests (`test/network`, `test/nlp`, `test/views`, `test/uses`) with the coverage report printed every run |
| `npm run test:coverage` | Same suites and report; **fails unless** lines/branches/functions are **100%** on the included library surface |
| `npm run test:browser` | Playwright tests with offline HTML fixtures (no live Jekyll server) |
| `npm run test:site` | Source + production `_site` checks (run after `npm run build`) |
| `npm run format:check` | Prettier (fail closed) |
| `npm run validate` | `format:check` then `test:coverage` |

Coverage includes `scripts/{network,nlp,views}/**/*.mjs` and excludes CLI/orchestration entrypoints (`network/sync`, `network/preflight`, `network/generate-elsewhere-glyphs`, `nlp/sync`, `nlp/validate-generated`, `nlp/probe-directory`, `nlp/scale-probe`, `views/build`). Do not assert nightly topic slugs or live participant counts as oracles—use synthetic fixtures. Site CSP tests skip when `_site` is missing or was built with localhost/dev hosts; use `npm run build` for a production `_site`.

`site-quality` and `network-sync` GitHub Actions run `format:check` and `npm run test:coverage` (not plain `npm test`). Network sync stays on hourly cron `17 * * * *` and `repository_dispatch` `joshternet-registry-updated`.

Rebuild datasets from the current registry, then build the site:

```sh
npm run build
```

That always runs `network:sync`, then `nlp:sync`, then `format:data` (strict Prettier on generated sync outputs: `_data/*.json`, network OPML, activity Atom, elsewhere glyphs CSS), then `format:check`, then `nlp:validate`, then `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter`. Sync scripts soft-format those paths before they exit; publish and `build.sh` fail closed on `format:check`. Running build again with the same registry and pages does not rewrite a dataset whose only change is a timestamp. `./scripts/build.sh --dry-run` prints those steps without fetching anything. Hourly `network-sync` runs `format:data` and `format:check` before it commits generated datasets.

`nlp:sync` crawls each Network origin (homepage, advertised topic directories and common writing indexes even when they are missing from `sitemap.xml`, sitemap locs, and feed entries). Each origin is stored as one gitignored file under `data/crawl-sites/` while its HTML is still in memory, then that HTML is dropped and the published datasets are assembled by reading one site file at a time. Every crawl JSON file is written compact with short keys. Jekyll and the page scripts read those keys directly, so a page view does not decode the crawl corpus. The clear-name schema files are not published. It then matches a topic catalog from joshuamorris.info (or the richest remaining member) onto the rest of the network. It **prunes writing older than 30 days from `_data/content.json` before gather**, then merges new items (Showcase creative stays while observed). Local personal sites added by `update:local:nonjoshternet` keep the content already parsed for them, so that local set grows on each run. What’s New / Activity and visitor writing surfaces show the latest **14 days** on live so regular posters are rewarded; member sites remain the archive. Within that window, Activity keeps **at most 2 rows per origin**, and each Showcase kind keeps **at most 2 cards per origin**, so one catalog cannot crowd out peers. The homepage “Things people are making” strip keeps **at most 6** of those cards; `/showcase/` stays uncapped. Same-origin same-title crossposts (blog article vs podcast/video) keep the stronger creative/video variant. Card author lines prefer Network person titles (e.g. “Chris Minnick”) over bare hostnames when a self-intro is available. For local previews, `JEKYLL_ENV=development npm run views:build` (or `JOSHTERNET_ACTIVITY_WINDOW_DAYS=30`) widens Activity to the full **30-day** retention band. Conditional HTTP responses are cached under `.tmp/http-cache/` (not committed); unchanged feeds + sitemap can short-circuit deep HTML crawl. It merges homepage/identity connection observations from `_data/homepage_connections.json` (written by `network:sync`) into `connections.json`, and publishes those NLP artifacts before work-poster screenshots so a hung capture cannot leave stale edges. It also runs `views:build` to write compact UI projections (`activity`, `explore`, `topic_views`, `connection_topics`, `site_views`, `search_index`) without changing canonical graph semantics. Below-threshold heuristic candidates stay under `.tmp/` and are not committed; qualifying heuristic subjects may appear as public community members with `membership: "heuristic"`. `nlp:validate` checks graph invariants plus the crawl JSON shapes in `scripts/nlp/crawl-shape.mjs` after the short keys are read back to clear names. List artifacts are sparse documents: empty arrays are omitted rather than committed as `[]`.

Hourly `network-sync` on `main` owns and commits the crawl/view publish set (`_data/network.json`, `blogrolls`, `connections`, `topics`, `site_signals`, `content`, `data_manifest`, `activity`, `explore`, `topic_views`, `connection_topics`, `site_views`, `search_index`, plus generated `topics/*.md` stubs, `assets/network/*`, and `assets/activity/posters/`). The workflow is a single `sync-and-publish` job (no Actions artifact handoff). Uses Intelligence history under `data/uses/` is written during `nlp:sync`; public uses projections (`_data/uses_summary.json`, `assets/data/uses/`) are staged only when `JOSHTERNET_USES_PUBLISH=1`. Seeking extracts optional `/seeking` wanted listings during `nlp:sync` into gitignored `_data/seeking.json` / `.network-sync/seeking-state.json` and never stages request bodies. Local `nlp:sync` writes real Seeking and Uses public preview files by default so `/seeking/` and `/uses/` can be verified after a crawl; CI stays shadow unless `JOSHTERNET_USES_PUBLISH` / `JOSHTERNET_SEEKING_PUBLISH` opts in. Live production Seeking excerpts still wait for a separately reviewed non-commit publish path. Feature branches may regenerate those files locally for preview, but must not commit them—only code, docs, tests, CHANGELOG, and hand-edited `_data` config. Local-only crawl files (`_data/channel_publish.json`, `_data/homepage_connections.json`, `_data/past_events.json`, `assets/events/joshternet.ics`, `data/classification/run-metrics.json`, `data/classification/quality-baseline.json`) are gitignored. `network-sync` force-adds the past-events file, the calendar when one was written, and the quality baseline. The rest of the publish set stays tracked and is updated on `main` by that workflow, not by a local crawl commit. `node scripts/keep-crawl-local.mjs` marks those tracked files so a crawl on this machine does not show up as changes to commit. Hand-edited files, including `topics/index.md` and `data/uses/catalog/`, stay committable. (`*_nav.yml`, `topic_aliases.json`, `topic_denylist.json`, `network_preview.json`, `network_display_titles.json`). Committing sync artifacts in a PR fights every hourly update. Curated card titles in `network_display_titles.json` are applied on every `network:sync` and again when building Activity / Showcase / search / site views, so rebuilds keep person names with their authored spelling and diacritics (e.g. Chris Minnick, Joshua Stübner) instead of host labels or page shells. See [Implement → Content → Uses](implement/content/uses.md) and [Implement → Content → Seeking](implement/content/seeking.md).

`_data/network_preview.json` can list origins to scrape locally before JoshBot has added them, but it should stay empty for normal work so local `network:sync` / `nlp:sync` match the registry. CI skips the file (`CI` or `GITHUB_ACTIONS`). Only add a preview origin for an explicit pre-registry experiment, and remove it once the registry includes it (or when the experiment ends).

Preview the site with LiveReload and the local Workers (button, declaration check, nominations):

```sh
npm run dev
```

That serves Jekyll on every interface (`http://127.0.0.1:4000/` on this machine, or `http://<this-machine-lan-ip>:4000/` from other devices on the same network) plus the Workers the development CSP already allows (`:8790`, `:8789`, `:8787`). `./scripts/dev.sh --help` lists the ports. `./scripts/dev.sh --dry-run` prints the commands without starting anything.

`npm run build` writes the generated site to `_site/`. Topics and connections are read from `_data/` produced by that same command, not fetched inside Jekyll. Neighborhood pages are ordinary files in `topics/*.md` (`topics/index.md` is the hub). `npm run dev` previews the datasets already on disk and does not refresh the registry. `npm run update:local` prepares the locked Uses model in `.tmp/models` when that cache is missing or stale, then runs `network:sync` and `nlp:sync`. `npm run update:local:nonjoshternet` fetches up to five new personal Uses sites into `data/dev-crawl-cache/` and then runs that same local update for those intake origins plus Joshternet members. Prior local-only sites stay available locally without recrawling the whole cache. Intake crawls use the same public-URL and robots rules as every other site. GitHub Actions does not read that cache, and those sites are left out of a CI crawl. With the dev server already running, Jekyll picks up that crawl. A missing or hash-mismatched model cache fails the Uses step after the crawl has written the other datasets.
