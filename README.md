# Joshternet website

The GitHub Pages website for Joshternet. The canonical specifications are maintained in [joshternet/spec](https://github.com/joshternet/spec).

## License

Project-owned **code** is [BSD-3-Clause](LICENSE). **Prose and docs** are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). **Brand assets** are not open-licensed. Participant screenshots and third-party material are not relicensed here. Full split: [Licensing](https://joshternet.org/licensing/). Third-party dependency attribution: [Third-party licenses](https://joshternet.org/licensing/third-party-licenses/).

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
| `npm test` | Library unit tests (`test/network`, `test/nlp`, `test/views`) with the coverage report printed every run |
| `npm run test:coverage` | Same suites and report; **fails unless** lines/branches/functions are **100%** on the included library surface |
| `npm run test:browser` | Playwright tests with offline HTML fixtures (no live Jekyll server) |
| `npm run test:site` | Source + production `_site` checks (run after `npm run build`) |
| `npm run format:check` | Prettier |

Coverage includes `scripts/{network,nlp,views}/**/*.mjs` and excludes CLI/orchestration entrypoints (`network/sync`, `network/preflight`, `network/generate-elsewhere-glyphs`, `nlp/sync`, `nlp/validate-generated`, `nlp/probe-directory`, `nlp/scale-probe`, `views/build`). Do not assert nightly topic slugs or live participant counts as oracles—use synthetic fixtures. Site CSP tests skip when `_site` is missing or was built with localhost/dev hosts; use `npm run build` for a production `_site`.

`site-quality` and `network-sync` GitHub Actions run `npm run test:coverage` (not plain `npm test`). Network sync stays on hourly cron `17 * * * *` and `repository_dispatch` `joshternet-registry-updated`.

Rebuild datasets from the current registry, then build the site:

```sh
npm run build
```

That always runs `network:sync`, then `nlp:sync`, then `format:data` (Prettier on `_data/*.json`), then `nlp:validate`, then `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter`. Running it again with the same registry and pages does not rewrite a dataset whose only change is a timestamp. `./scripts/build.sh --dry-run` prints those steps without fetching anything. Hourly `network-sync` runs the same `format:data` step before it commits generated datasets.

`nlp:sync` crawls each Network origin (homepage, advertised topic directories and common writing indexes even when they are missing from `sitemap.xml`, sitemap locs, and feed entries), then matches a topic catalog from joshuamorris.info (or the richest remaining member) onto the rest of the network. It also runs `views:build` to write compact UI projections (`activity`, `explore`, `topic_views`, `connection_topics`, `site_views`, `search_index`) without changing canonical graph semantics. Below-threshold heuristic candidates stay under `.tmp/` and are not committed; qualifying heuristic subjects may appear as public community members with `membership: "heuristic"`. `nlp:validate` checks graph invariants plus JSON Schema contracts in `schemas/`. List artifacts are sparse documents: empty arrays are omitted rather than committed as `[]`.

Hourly `network-sync` on `main` owns and commits the crawl/view publish set (`_data/network.json`, `blogrolls`, `connections`, `topics`, `site_signals`, `mentions`, `content`, `data_manifest`, `activity`, `explore`, `topic_views`, `connection_topics`, `site_views`, `search_index`, plus generated `topics/*.md` stubs and `assets/network/*`). Feature branches may regenerate those files locally for preview, but must not commit them—only code, docs, tests, CHANGELOG, and hand-edited `_data` config (`*_nav.yml`, `topic_aliases.json`, `topic_denylist.json`, `network_dev.json`). Committing sync artifacts in a PR fights every hourly update.

Preview the site with LiveReload and the local Workers (button, declaration check, nominations):

```sh
npm run dev
```

That serves Jekyll on every interface (`http://127.0.0.1:4000/` on this machine, or `http://<this-machine-lan-ip>:4000/` from other devices on the same network) plus the Workers the development CSP already allows (`:8790`, `:8789`, `:8787`). `./scripts/dev.sh --help` lists the ports. `./scripts/dev.sh --dry-run` prints the commands without starting anything.

`npm run build` writes the generated site to `_site/`. Topics and connections are read from `_data/` produced by that same command, not fetched inside Jekyll. Neighborhood pages are ordinary files in `topics/*.md` (`topics/index.md` is the hub). `npm run dev` previews the datasets already on disk and does not refresh the registry.
