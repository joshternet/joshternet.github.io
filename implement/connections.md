---
layout: default
title: How Joshternet gathers connections
description: >-
  Learn how Joshternet discovers links, topics, and published work across
  independent websites. See the difference between publisher declarations,
  observed evidence, and inferred relationships.
keywords: >-
  Joshternet connections, evidence classes, topic communities, crawl notes,
  observed links, heuristic topics
permalink: /implement/connections/
nav_title: Connections
seo:
  type: TechArticle
  name: How Joshternet gathers connections
---

# How Joshternet gathers connections

One of the interesting things about the independent web is how websites connect.
People link to friends, share useful resources, respond to articles, and sometimes
discover they're exploring similar ideas without knowing each other.

Joshternet looks at the information independent websites publish and uses that
evidence to build features such as [Connections](/connections/) and
[Topics](/topics/). This guide explains what the project looks for, how it
interprets the information, and which assumptions it deliberately avoids. It is
the developer reference for evidence classes, pipelines, and build commands—not
another join requirement.

Publishers implementing standards (feeds, microformats, slashpages, Schema.org,
and related): start at the [Content Discovery Handbook](/implement/content/).
This page keeps pipeline-specific maintainer detail.

## Technical details

### One-way pipeline

Joshternet starts with information published by independent websites. It collects
observations, organizes them into consistent evidence, and uses that evidence to
build the public discovery pages. Each stage has a different purpose. A guess
based on text should never be treated as though a publisher explicitly declared
it.

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

Joshternet has to be careful not to confuse its own directory with the
relationships publishers actually created. Otherwise, the directory would
manufacture connections simply by listing websites.

Derived Joshternet pages (`/network/`, `/connections/`, `/topics/**`, `/activity/`,
`/wander/`, generated OPML) must not become new semantic evidence. Hub path
exclusions apply only on `joshternet.org`. Hub homepage republish widgets are also
excluded: Meet the websites cards (`network-card__link`), Network cards, and
What's happening activity cards (`activity-card__link` / `activity-card__media`).
Directory UI must not manufacture a hub-and-spoke graph. Participant sites may
use paths like `/topics/` freely.

Pages generated from discovery data can identify themselves as derived material.
That helps keep generated listings from being treated as new independent
evidence:

```html
<meta name="joshternet-analysis" content="derived" />
```

Ordinary publishers do not need this marker to participate.

### Evidence authority

These distinctions matter because reading something on a website isn't the same
as having the publisher declare it. Joshternet should preserve that difference.

Joshternet uses three evidence classes:

| Class       | Meaning                                     |
| ----------- | ------------------------------------------- |
| `declared`  | Information a publisher explicitly provided |
| `observed`  | A fact Joshternet directly found on a webpage |
| `heuristic` | A possible association inferred from available content |

Normalization and aliasing are **transformations**, not authority classes. A
trimmed RSS category remains `declared`.

A website's categories and metadata help Joshternet understand what it publishes.
They don't make it a Joshternet participant. Participation is declared separately
through `/.well-known/josh`. Publisher-supplied metadata improves topic analysis.
It is **not** a second Joshternet opt-in.

Publishers already describe their work in lots of ordinary web formats.
Joshternet can use those existing signals, rather than asking everyone to create
a special topic profile.

**Declared topic labels** that may qualify immediately:

- RSS / Atom category
- JSON Feed tag
- Microformats `p-category`
- `article:tag` / `article:section`
- Topic-hub child pages
- Portfolio **sectors** (banking, health), not the word “portfolio”

`meta keywords`, Schema.org `keywords` dumps, titles, descriptions, and Open Graph
type stay discovery signals, not membership.

Sometimes a website doesn't publish useful topic categories. Joshternet can still
find subjects in its writing, but those matches must meet additional evidence
requirements before they appear as public topic associations. Heuristic
visible-text analysis may qualify when it clears the quality bar (multiple
eligible pages, repeated occurrence, not boilerplate or parser noise).

### Topics vs candidates

Not every possible topic match becomes a public topic. Joshternet needs enough
qualifying evidence before it includes a website in a topic collection. Weaker
matches may remain discovery candidates rather than being presented as
established relationships.

Two websites writing about photography may have something interesting in common
without ever having linked to one another. Shared subjects can make for good
discoveries, but they aren't proof of friendship, collaboration, or endorsement.

Joshternet publishes **public topics** with at least one qualifying member:

1. ≥1 current participating origin
2. That member has qualifying declared **or** heuristic evidence
3. Topic is not denylisted
4. Topic pages only list members that have matching articles

Below-threshold heuristic matches may appear as related discoveries. Qualifying
heuristic evidence is ordinary membership. Profiles describe the **fetched
corpus**, not every page ever published.

Topic pages list members alphabetically and rotate recent articles across
publishers. Related topics are subjects that share an indexed article, plus
broader and related subjects.

### Connections graph evidence

Some connections are more direct. A participating website may link to another
from its homepage, include it in a blogroll, reference it in an article, or
publish a reply. These are things Joshternet can observe rather than guess. A
link from A to B does not prove B links back.

Joshternet records **observed** directed relations between current participants:

| Relation                                 | Established by                    |
| ---------------------------------------- | --------------------------------- |
| `homepage-link`                          | Ordinary link from the home page  |
| `content-link`                           | Ordinary link from a content page |
| `blogroll`                               | Explicit publisher blogroll       |
| `reply-to` / `repost-of` / `syndication` | Explicit IndieWeb equivalents     |

Observed links and shared subjects appear together in the discovery experience,
but they're not stored as the same kind of relationship. A shared topic can help
someone find another website without pretending that either publisher has linked
to the other.

Joshternet does **not** invent friendship from shared third-party links, and does
**not** store site-to-site edges from shared topics. [Connections](/connections/)
still shows **topic overlaps** from neighborhoods where two or more participants
have matching articles. Those rows are membership, not a directed link. Generated
hub OPML is a subscription file, not blogroll evidence. Empty collections are
omitted. Registry refresh does not overwrite observed connections; the topic
crawl publishes them.

### Content

Joshternet also looks for published work worth helping people discover. Feeds,
article pages, project indexes, portfolios, and creative collections can provide
information used by What's New, Showcase, Topics, and Search.

The original websites remain the destinations. Joshternet stores limited
presentation information rather than mirroring complete article bodies.
Independent sites remain canonical. Article bodies are not mirrored. Not every
eligible item appears in every view.

| Record            | What Joshternet keeps                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Feed entries      | RSS, Atom, JSON Feed; canonical URL identity; cross-feed dedupe; plain-text summaries                                                |
| Matching pages    | `language`, `page_role`, declared topics                                                                                             |
| Portfolio indexes | `/work/`, `/projects/`, `/portfolio/`                                                                 |
| Portfolio rows    | Each work-table row is a `project`; sector labels become declared topics; the index is a portfolio on that origin |
| Case-study URLs   | `/work/example/` stay projects                                                                       |
| Client names      | works, not topics                                                                                    |
| Semantic hashes   | Change detection so a repeat build can leave unchanged data in place                                 |

### Crawl signals

Build-time crawl. User-Agent (same crawler identity as [JoshBot](/joshbot/)):

```text
Joshternet-Joshbot (+https://joshternet.org/joshbot)
```

Personal websites often have useful pages tucked away under familiar addresses
such as `/about/`, `/now/`, `/uses/`, `/friends/`, and `/links/`. Joshternet can
use those conventions to discover more about what people publish and where their
websites point. Publishers do not need any particular slash page to participate.

Joshternet may check a limited catalog of known independent-web paths even when a
website doesn't advertise them directly. These checks follow the configured
discovery rules and are not an unrestricted search for arbitrary URLs.

| Source            | What is read                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Links             | Ordinary links                                                                                                                                                       |
| Visible prose     | Not script, style, or nav chrome                                                                                                                                     |
| Declared labels   | Microformats `p-category`, `article:tag`, feed categories                                                                                                            |
| Topic directories | `/topics/`, `/tags/`, `/categories/` even when missing from `sitemap.xml`                                                                                            |
| Writing indexes   | `/notes/`, `/blog/`, `/posts/`, `/archive/`, and similar, also independent of the sitemap                                                                              |
| Identity slash pages | Indieweb about / link directories from the reviewed slash-page catalog (`scripts/network/slash-page-catalog.mjs`): `/about/`, `/me/`, `/now/`, `/uses/`, `/more/`, `/site/`, `/social/`, `/links/`, `/people/`, `/friends/`, `/blogroll/`, and related paths. |
| Blind catalog probes | Every catalog path marked `probe: true` is always attempted even when it never appears in menus, sitemaps, or `/slashes`. Soft-404 homepage duplicates are not retained. Only catalogued paths are probed—not an open URL fuzzer. Expansion still prefers advertised links and a published `/slashes` index when present. |
| Slashpages OPML | Optional `/.well-known/slashpages` ([guide](/implement/content/opml/)): same-origin outline URLs seed the crawl (`slashpages-manifest`). Cross-origin outlines are not seeds. Absence of the file does not change participation or other discovery. |
| Creative indexes | Gallery, photography, music, discography, videos, games, exhibitions, portfolio, and related creative paths are catalogued and blind-probed the same way. |
| Catalog source    | Declared subjects from every participant, combined. No single site supplies the vocabulary.                                                                          |
| Catalog match     | Other members’ titles and summaries, after every origin is fetched. Sites without Microformats or JSON-LD can still contribute matching articles.                   |
| Page quota        | None. Crawl drains the queue (homepage, feeds, hubs, indexes, sitemap locs, blind probes, BFS children) subject only to timeouts, size caps, same-origin rules, soft-404 skip, photo-attachment skip, and robots where enforced. |
| Creative content  | Schema.org CreativeWork types, figures, and gallery indexes may publish `content_type` values such as `photograph`, `visual_artwork`, `music_recording`, `music_album`, `sheet_music`, `video`, `game`, `collection`, `project`, and `article`. PDF scores under music/score paths and `MusicComposition` map to `sheet_music` (distinct from audio). Showcase cards link out only—no republish or autoplay. |
| Credit links      | Explicit credit/collaborator markup (or credit language on `/links`, `/credits`, rolls, and similar) may create a `credit` connection. Generic third-party CDN hosts are not participant edges. |
| Heuristic TF–IDF  | Persist as signals; public community enrollment only when the quality bar passes                                                                                     |

### Crawling and SEO manners

Independent websites remain in control of what they publish and how they permit
automated visitors to access it. Joshternet's discovery tools should respect those
choices.

Member fetches (HTML crawl, feeds, OG enrich, posters, screenshots, network
discovery, feed probes, blogroll OPML, optional `/.well-known/slashpages`) honor
each origin’s `robots.txt`. Missing or unreadable robots files allow. Disallowed
URLs are skipped—Joshternet never invents pages or summaries for blocked paths.
Publishing `/.well-known/josh` does not override robots rules.

Joshternet is meant to help people find independent websites, not become a
replacement for them. Hub listings (Activity, Showcase, Topics, homepage
discovery) store title, a capped plain-text summary, and an optional poster only.
Cards, `u-url`, and Atom alternates point at the publisher. The member site
remains canonical; hub pages use `max-snippet` so search engines treat Joshternet
as an outbound aggregator, not a full-text mirror. `/search/` stays `noindex`.

### When it runs

Joshternet's public discovery pages are built from collected and processed
information. The build takes the available evidence, generates the relevant data
views, and publishes those views as part of the static website. The pipeline does
not run live in a visitor's browser.

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

See also the main [implementation guide](/implement/),
[Content handbook](/implement/content/), [Explore projections](/implement/content/explore/),
the [Network](/network/), [Connections](/connections/), and [Topics](/topics/).
