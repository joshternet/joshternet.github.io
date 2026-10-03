# Joshternet website

The GitHub Pages website for Joshternet. The canonical specifications are maintained in [joshternet/spec](https://github.com/joshternet/spec).

## Requirements

- Ruby 3.3
- Bundler

## Build and test locally

Install dependencies:

```sh
bundle install
npm ci
```

Rebuild datasets from the current registry, then build the site:

```sh
npm run build
```

That always runs `network:sync`, then `nlp:sync`, then `nlp:validate`, then `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter`. Running it again with the same registry and pages does not rewrite a dataset whose only change is a timestamp. `./scripts/build.sh --dry-run` prints those steps without fetching anything.

`nlp:sync` crawls each Network origin (homepage, advertised topic directories and common writing indexes even when they are missing from `sitemap.xml`, sitemap locs, and feed entries), then matches a topic catalog from joshuamorris.info (or the richest remaining member) onto the rest of the network. It also runs `views:build` to write compact UI projections (`activity`, `explore`, `topic_views`, `connection_topics`, `site_views`, `search_index`) without changing canonical graph semantics. Below-threshold heuristic candidates stay under `.tmp/` and are not committed; qualifying heuristic subjects may appear as public community members with `membership: "heuristic"`. `nlp:validate` checks graph invariants plus JSON Schema contracts in `schemas/`. List artifacts are sparse documents: empty arrays are omitted rather than committed as `[]`.

Preview the site with LiveReload and the local Workers (button, declaration check, nominations):

```sh
npm run dev
```

That serves Jekyll on every interface (`http://127.0.0.1:4000/` on this machine, or `http://<this-machine-lan-ip>:4000/` from other devices on the same network) plus the Workers the development CSP already allows (`:8790`, `:8789`, `:8787`). `./scripts/dev.sh --help` lists the ports. `./scripts/dev.sh --dry-run` prints the commands without starting anything.

`npm run build` writes the generated site to `_site/`. Topics and connections are read from `_data/` produced by that same command, not fetched inside Jekyll. Neighborhood pages are ordinary files in `topics/*.md` (`topics/index.md` is the hub). `npm run dev` previews the datasets already on disk and does not refresh the registry.
