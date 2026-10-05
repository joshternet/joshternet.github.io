---
layout: default
title: How Joshternet gathers connections
description: >-
  Non-normative notes on the Joshternet build-time crawl: evidence classes,
  topic communities, observed participant links, and what stays off the public graph.
keywords: >-
  Joshternet connections, evidence classes, topic communities, crawl notes
permalink: /implement/connections/
nav_title: Connections
seo:
  type: TechArticle
  name: How Joshternet gathers connections
---

# How Joshternet gathers connections

Build-time crawl for [Connections](/connections/) and [Topics](/topics/).

## One-way pipeline

```text
AUTHORITATIVE / EXTERNAL INPUT
        ↓
RAW OBSERVATION
        ↓
NORMALIZED EVIDENCE
        ↓
DERIVED MODELS
        ↓
PUBLIC PROJECTIONS
```

Derived Joshternet pages (`/network/`, `/connections/`, `/topics/**`, `/activity/`, `/wander/`,
generated OPML) must not become new semantic evidence. Hub path exclusions apply
only on `joshternet.org`. Participant sites may use paths like `/topics/` freely.
Pages may also mark themselves with:

```html
<meta name="joshternet-analysis" content="derived" />
```

## Evidence authority

Joshternet uses three evidence classes:

| Class       | Meaning                                     |
| ----------- | ------------------------------------------- |
| `declared`  | The publisher explicitly supplied the value |
| `observed`  | Joshternet directly observed a web fact     |
| `heuristic` | Joshternet derived a candidate from text    |

Normalization and aliasing are **transformations**, not authority classes. A
trimmed RSS category remains `declared`.

Publisher-supplied metadata improves topic analysis. It is **not** a second
Joshternet opt-in. Participation is `/.well-known/josh`.

**Declared topic labels** that may qualify immediately:

- RSS / Atom category
- JSON Feed tag
- Microformats `p-category`
- `article:tag` / `article:section`
- Octothorpes
- Topic-hub child pages
- Portfolio **sectors** (banking, health), not the word “portfolio”

`meta keywords`, Schema.org `keywords` dumps, titles, descriptions, and Open Graph type stay discovery signals, not membership.
Heuristic visible-text analysis may qualify when it clears the quality bar
(multiple eligible pages, repeated occurrence, not boilerplate or parser noise).

## Topics vs candidates

Joshternet publishes **public topics** with at least one qualifying member:

1. ≥1 current participating origin
2. That member has qualifying declared **or** heuristic evidence
3. Topic is not denylisted
4. Topic pages only list members that have matching articles

Below-threshold heuristic matches may appear as related discoveries. Qualifying
heuristic evidence is ordinary membership. Profiles describe the **fetched
corpus**, not every page ever published.

## Connections

Joshternet records **observed** directed relations between current
participants:

| Relation                                 | Established by                    |
| ---------------------------------------- | --------------------------------- |
| `homepage-link`                          | Ordinary link from the home page  |
| `content-link`                           | Ordinary link from a content page |
| `blogroll`                               | Explicit publisher blogroll       |
| `mention`                                | Verified Webmention               |
| `reply-to` / `repost-of` / `syndication` | Explicit IndieWeb equivalents     |

Joshternet does **not** invent friendship from shared third-party links, and does
**not** store site-to-site edges from shared topics. [Connections](/connections/)
still shows **topic overlaps** from neighborhoods where two or more participants
have matching articles. Those rows are membership, not a directed link. Generated
hub OPML is a subscription file, not blogroll evidence. Empty collections are
omitted. Registry refresh does not overwrite observed connections; the topic
crawl publishes them.

## Content

Advertised feeds and matching crawled pages. Independent sites remain canonical.
Article bodies are not mirrored.

| Record            | What Joshternet keeps                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Feed entries      | RSS, Atom, JSON Feed; canonical URL identity; cross-feed dedupe; plain-text summaries                                                |
| Matching pages    | `language`, `page_role`, declared topics                                                                                             |
| Portfolio indexes | `/work/`, `/projects/`, `/portfolio/`                                                                 |
| Portfolio rows    | Each work-table row is a `project`; sector labels become declared topics; the index is a portfolio on that origin |
| Case-study URLs   | `/work/example/` stay projects                                                                       |
| Client names      | works, not topics                                                                                    |
| Semantic hashes   | Change detection so a repeat build can leave unchanged data in place                                 |

## Crawl signals

Build-time crawl. User-Agent:

```text
JoshternetNLP/1.0 (+https://joshternet.org; topic-hub build crawl)
```

| Source            | What is read                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Links             | Ordinary links                                                                                                                                                       |
| Visible prose     | Not script, style, or nav chrome                                                                                                                                     |
| Declared labels   | Microformats `p-category`, `article:tag`, feed categories, `rel="octo:octothorpes"`                                                                                  |
| Topic directories | `/topics/`, `/tags/`, `/categories/` even when missing from `sitemap.xml`                                                                                            |
| Writing indexes   | `/notes/`, `/blog/`, `/posts/`, `/now/`, `/friends/`, `/about/`, `/archive/`, and similar, also independent of the sitemap                                            |
| Catalog source    | `joshuamorris.info` while it remains a member, otherwise the origin with the most declared subjects |
| Catalog match     | Other members’ titles and summaries, after every origin is fetched. Sites without Microformats or JSON-LD can still contribute matching articles. |
| Feed cap          | 80 URLs per origin                                                                                                                                                   |
| Heuristic TF–IDF  | Persist as signals; public community enrollment only when the quality bar passes                                                                                     |

## When it runs

`npm run build` is local and the production site build in CI.

| Step                   | What runs                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Refresh the registry   | `network:sync`                                                                                                                                 |
| Rebuild these datasets | `npm run nlp:sync`                                                                                                                             |
| Check them             | `nlp:validate`                                                                                                                                 |
| Build the static site  | Jekyll                                                                                                                                         |
| Also runs              | Registry updates, scheduled sync, and relevant pushes                                                                                          |
| Presentation views     | Published with the graph                                                                                                                       |
| Repeat build           | Unchanged data stays in place when only a timestamp would change                                                                               |

## Local directory probe

`npm run nlp:probe-directory` fetches [joshing.you](https://joshing.you) listings, keeps origins whose `robots.txt` allows `JoshternetNLP/1.0`, samples up to 100 sites, reads homepage feeds, and checks the same content schema as `nlp:validate`. It is a local script, not the hourly registry job, and it does not publish Network data.

`npm run nlp:scale-probe` walks every listing page, harvests robots-allowed member sites (skipping joshing.you itself), then replays the same parsers used by `nlp:sync` thousands of times. Use `--replay-only` after a harvest, or `--harvest` to refresh. It is local-only and does not publish Network data.

See also the main [implementation guide](/implement/), the
[Network](/network/), [Connections](/connections/), and [Topics](/topics/).
