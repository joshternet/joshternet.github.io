---
layout: default
title: "Explore: Help People Discover What You Publish"
description: >-
  Make independently published writing and creative work easier to find—through
  navigation, subjects, feeds, stable URLs, and structured metadata—without
  treating discovery as a guarantee.
keywords: >-
  content discovery, topics, categories, tags, feeds, search, Schema.org,
  Microformats2, independent web
permalink: /implement/content/explore/
nav_title: Explore
content_id: explore
matrix_id: explore
seo:
  type: TechArticle
  name: Explore
---

# Explore

Publishing a website makes information available, but availability alone does not make its contents easy to find. Visitors need ways to explore beyond the homepage. Search engines and other discovery tools need links and understandable content. Directories and communities may use publisher-provided information to organize related work.

A website can help people discover its contents through ordinary HTML, descriptive page titles, stable links, feeds, topic indexes, and structured metadata. No single metadata format guarantees discovery. The goal is to make published work understandable and accessible through complementary mechanisms—without requiring a specific platform.

This chapter connects standards taught throughout the Content Discovery Handbook into a practical publishing strategy for independent website owners. It is not a maintainer guide to hub build pipelines.

## From a published page to something people can discover

Discovery is a chain of separate stages. Success at one stage does not guarantee the next.

<ol class="content-discovery-flow" aria-label="Content discovery stages">
  <li>
    <strong>Discovery</strong>
    <span>A crawler, reader, or visitor learns that a URL exists.</span>
  </li>
  <li>
    <strong>Retrieval</strong>
    <span>The client requests the resource and receives a usable response.</span>
  </li>
  <li>
    <strong>Interpretation</strong>
    <span>The client identifies title, language, text, links, and metadata.</span>
  </li>
  <li>
    <strong>Classification</strong>
    <span>The resource appears to be an article, project, gallery, event, or other kind of page.</span>
  </li>
  <li>
    <strong>Organization</strong>
    <span>It may be associated with subjects, collections, or related content.</span>
  </li>
  <li>
    <strong>Presentation</strong>
    <span>It may appear in search results, a topic page, an activity feed, or another browsing experience.</span>
  </li>
</ol>

Each stage can introduce uncertainty or fail independently. A successful crawl does not mean a resource will necessarily be featured or indexed.

## Make your content easy to reach

Ordinary hyperlinks and recognizable structure help human visitors even when no crawler is involved: meaningful homepage navigation, section landing pages, article archives, project and gallery indexes, topic pages, related-content links, stable permalinks, XML sitemaps, and optional slash-page indexes.

```html
<nav aria-label="Primary">
  <ul>
    <li><a href="https://joshua.example/">Home</a></li>
    <li><a href="https://joshua.example/notes/">Writing</a></li>
    <li><a href="https://joshua.example/projects/">Projects</a></li>
    <li><a href="https://joshua.example/photos/">Photography</a></li>
    <li><a href="https://joshua.example/about/">About</a></li>
  </ul>
</nav>
```

Important content should remain reachable without JavaScript-only interactions. See [Semantic HTML]({{ '/implement/content/html/' | relative_url }}), [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}), and [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}).

## Know what each page represents

| Page kind | Typical role |
| --- | --- |
| Homepage | Entry point and overview |
| About | Person or site identity |
| Article | Long-form writing |
| Short note | Brief update |
| Project | A created endeavor |
| Individual creative work | One photograph, recording, or similar |
| Portfolio / gallery | Collection of works |
| Topic index | Subject-based exploration |
| Archive | Chronological or listing container |
| Event | Gathering announcement |
| Documentation | How-to or reference |
| Search results | Query UI, not an article |
| Utility | Legal, error, login, and similar |

A photography gallery is a collection; an individual photograph page describes a particular work. An About page describes a person or site, not an article. A category archive organizes articles and should not be treated as a newly published article itself. Use appropriate HTML and Schema.org types when helpful—without inventing a universal classification every crawler must follow.

## Give important content a stable URL

Article, note, project, artwork, and event permalinks support lasting references. Canonical declarations, careful redirects, and migration planning reduce duplicate confusion. A collection page and its individual contents should have different URLs when they represent distinct resources. Stable URLs help readers, archives, search engines, and other sites cite the same work over time. You may update a resource’s contents without changing its identity. See [SEO]({{ '/implement/content/seo/' | relative_url }}) and [Links]({{ '/implement/content/links/' | relative_url }}).

## Help readers understand what they're about to open

Useful context comes from HTML `<title>`, a visible `<h1>`, section headings, meta descriptions, Open Graph descriptions, article summaries, image alternative text, and meaningful link text. “Building a Solar-Powered Weather Station” communicates more than “Project.” Titles and descriptions should match the actual page—not generic promotional language. Compatible applications may generate their own summaries or display titles rather than reproducing publisher metadata exactly.

## Tell people what you write and create about

A site may cover photography, programming, and travel while one article discusses nighttime landscape photography. Subject labels, categories, tags, and topical collections are most useful when they reflect actual published material.

Distinguish broad subjects, narrow subjects, categories, tags, related subjects, topics mentioned only in passing, and subjects associated with a publisher’s interests. A brief mention is not always evidence that the entire page is about that subject. Topics are not certifications, endorsements, or proof of professional expertise.

## Categories versus tags

**Categories** are larger organizational groupings. **Tags** are more specific labels on individual items. That distinction is a common editorial practice—not a universal HTML or feed requirement. An article might use the category “Software” with tags such as “JavaScript,” “Accessibility,” and “Web Components.” Prefer consistency, avoid duplicate labels, and resist unnecessary tag proliferation.

## What you say your content is about matters

| Kind | Meaning | Limitation |
| --- | --- | --- |
| Publisher-declared | Explicit category, topic, tag, or similar | Reflects labeling decisions, not absolute truth |
| Observed | Directly seen content, links, or metadata | Snapshot of what was fetched |
| Inferred | Estimated subjects from interpretation | Can misread ambiguity, satire, quotes, multilingual text, or incidental mentions |

A declared category is evidence of the publisher’s labeling. An inferred topic is another system’s interpretation. Both can be useful; they are not equally authoritative. Automatic classification can be wrong.

## Microformats2 categories

Mark categories on an [h-entry](https://microformats.org/wiki/h-entry) with `p-category` (alongside `p-name`, `dt-published`, `u-url`, and `e-content` as needed):

```html
<article class="h-entry">
  <h1 class="p-name">Building a Small Website</h1>
  <a class="u-url" href="https://joshua.example/notes/small-website/">
    Permalink
  </a>
  <time class="dt-published" datetime="2026-10-15">Oct. 15, 2026</time>
  <p>
    Topics:
    <span class="p-category">Web Development</span>,
    <span class="p-category">Accessibility</span>
  </p>
  <div class="e-content">
    <p>A few notes about building an independent website.</p>
  </div>
</article>
```

Parsed (abridged):

```json
{
  "type": ["h-entry"],
  "properties": {
    "name": ["Building a Small Website"],
    "url": ["https://joshua.example/notes/small-website/"],
    "published": ["2026-10-15"],
    "category": ["Web Development", "Accessibility"],
    "content": [
      {
        "value": "A few notes about building an independent website.",
        "html": "<p>A few notes about building an independent website.</p>"
      }
    ]
  }
}
```

A `p-category` is a declared property of a structured object—not a keyword scraped from anywhere on the page. Full reference: [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}).

## Categories and tags in feeds

Syndicated subjects appear as RSS `<category>`, Atom `<category>`, and JSON Feed `tags`. Keep labels consistent with the HTML article when practical. Feed tags do not establish sitewide expertise. Consumers may normalize labels differently. See [Feeds]({{ '/implement/content/feeds/' | relative_url }}).

```xml
<!-- RSS -->
<item>
  <title>Building a Small Website</title>
  <link>https://joshua.example/notes/small-website/</link>
  <category>Web Development</category>
  <category>Accessibility</category>
</item>
```

```xml
<!-- Atom -->
<entry>
  <title>Building a Small Website</title>
  <link href="https://joshua.example/notes/small-website/" />
  <category term="Web Development" />
  <category term="Accessibility" />
</entry>
```

```json
{
  "title": "Building a Small Website",
  "url": "https://joshua.example/notes/small-website/",
  "tags": ["Web Development", "Accessibility"]
}
```

## Open Graph article subjects

Article-extension properties include `article:section`, `article:tag`, `article:published_time`, and `article:modified_time`. Section membership, topic labels, and dates are distinct. Keep them consistent with visible content and other structured data. See [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}).

```html
<meta property="og:type" content="article" />
<meta property="og:title" content="Building a Small Website" />
<meta property="article:section" content="Software" />
<meta property="article:tag" content="Web Development" />
<meta property="article:tag" content="Accessibility" />
<meta
  property="article:published_time"
  content="2026-10-15T12:00:00-07:00"
/>
```

## Schema.org subjects and relationships

Relevant properties include [`about`](https://schema.org/about), [`mentions`](https://schema.org/mentions), [`keywords`](https://schema.org/keywords), [`genre`](https://schema.org/genre), [`knowsAbout`](https://schema.org/knowsAbout), [`mainEntity`](https://schema.org/mainEntity), [`mainEntityOfPage`](https://schema.org/mainEntityOfPage), [`isPartOf`](https://schema.org/isPartOf), and [`hasPart`](https://schema.org/hasPart).

`about` identifies what a work concerns; `mentions` identifies something referenced within it. `knowsAbout` is principally for Person or Organization and must not be treated as professional credentials. `isPartOf` / `hasPart` describe collection relationships, not ordinary topic tags. Do not turn every Person, Organization, or Product mention into a subject community.

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": "https://joshua.example/notes/small-website/#post",
  "headline": "Building a Small Website",
  "url": "https://joshua.example/notes/small-website/",
  "datePublished": "2026-10-15",
  "about": { "@type": "Thing", "name": "Independent websites" },
  "mentions": { "@type": "SoftwareApplication", "name": "Example Editor" },
  "keywords": ["Web Development", "Accessibility"],
  "isPartOf": {
    "@type": "Blog",
    "name": "Harbor Notes",
    "url": "https://joshua.example/notes/"
  },
  "author": {
    "@type": "Person",
    "@id": "https://joshua.example/#person",
    "name": "Avery Example",
    "knowsAbout": ["Web Development", "Photography"]
  }
}
```

See [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}).

## Give each subject a useful place to explore

Paths such as `/topics/`, `/topics/photography/`, and `/topics/web-accessibility/` are conventions, not globally mandated URLs. A useful topic page offers a heading, short introduction, links to related articles and projects, dates, navigation, and a link back to the topic index—value for a visitor, not keyword stuffing.

```html
<main>
  <article>
    <h1>Web accessibility</h1>
    <p>Notes and projects about making websites usable for more people.</p>
    <ul>
      <li>
        <a href="https://joshua.example/notes/small-website/">
          Building a Small Website
        </a>
        —
        <time datetime="2026-10-15">Oct. 15, 2026</time>
      </li>
    </ul>
    <p><a href="https://joshua.example/topics/">All topics</a></p>
  </article>
</main>
```

## Related content and internal discovery

Related articles, series, reading lists, collection membership, topic indexes, previous/next links, author indexes, and creative-work collections help visitors continue. Editorially chosen related links differ from algorithmic suggestions. Transparent navigation remains useful without a recommendation engine. Two pages sharing a common word are not automatically related.

```html
<aside aria-labelledby="related-heading">
  <h2 id="related-heading">Related</h2>
  <ul>
    <li>
      <a href="https://joshua.example/notes/accessible-forms/">
        Accessible forms
      </a>
      — practical patterns for labels and errors.
    </li>
    <li>
      <a href="https://joshua.example/projects/harbor-notes/">
        Harbor Notes site
      </a>
      — the static site these notes support.
    </li>
  </ul>
</aside>
```

## Help readers see what's new

Distinguish original publication, significant modification, feed update, site deployment, crawl observation, and discovery by an external system—they are not interchangeable. Use HTML `<time>`, Microformats2 `dt-published` / `dt-updated`, Schema.org `datePublished` / `dateModified`, and feed dates carefully. Do not assign the current build timestamp to every page. Archives may keep older work while an activity feed shows only recent items. Display windows are application choices, not universal standards.

## Activity feeds and content streams

A generic activity stream may mix blog articles, notes, project releases, photography, music, videos, games, books, and events. Recognize content type rather than presenting everything as a blog post. One page may announce a creative work without being identical to the work. A site feed differs from a network-wide aggregate across publishers.

```text
2026-10-15  Note     Building a Small Website     /notes/small-website/
2026-10-12  Photo    Harbor at dusk               /photos/harbor-dusk/
2026-10-01  Project  Harbor Notes 1.2             /projects/harbor-notes/
```

## Help your creative work stand on its own

Project pages, individual photograph pages, galleries, music releases, videos, games, software, and books benefit from stable work URLs, titles, descriptions, creators, dates, representative images, related collections, and structured metadata. Schema.org creative-work types can distinguish a photograph from a software application or music recording. An image embedded in an article is not necessarily a separate creative work. Metadata does not guarantee Showcase inclusion. See [Creative media]({{ '/implement/content/media/' | relative_url }}).

## Search as a discovery mechanism

Useful results typically include an accurate title, descriptive summary, source site, subject, content type, publication date, stable destination URL, language, and clear attribution. Retrieval, indexing, matching, and ranking methods differ across engines—do not treat one proprietary formula as an open standard. Result links should lead to the original publisher’s content. A match does not mean the publisher joined a topic community or endorsed another site.

## Site search versus network search

**Site search** covers content the publisher controls. **Network or directory search** catalogs resources from many independent publishers. They differ in source selection, crawl access, availability, attribution, ranking, duplicates, freshness, privacy, and coverage. A network index may be incomplete or lag behind the live site. Network search is not a live query of every participating website.

## Sharing a topic is not the same as knowing each other

Multiple sites may publish about woodworking—articles, photographs, or planning software—without any relationship between their owners. Distinguish topic association, content similarity, publisher interest, community participation, direct hyperlinks, blogroll references, collaboration, and friendship. Only appropriately supported evidence should establish stronger relationships. Do not infer personal relationships from shared topics or network membership. See [Connections]({{ '/implement/content/connections/' | relative_url }}).

## Make room for the whole web

Describe content in its original language with HTML `lang`, feed language, Schema.org `inLanguage`, language-specific URLs, translation pages when offered, multilingual metadata, Unicode topic labels, internationalized domains, and correct encoding. Automated language identification can be imperfect. Preserve original-language titles and categories rather than forcing English. Language classification is not automatic translation. Discovery systems do not support all languages equally.

```html
<article lang="es" class="h-entry">
  <h1 class="p-name">Construyendo un sitio pequeño</h1>
  <span class="p-category">Accesibilidad</span>
</article>
```

## Accessibility in discovery interfaces

Use descriptive headings, clear links, meaningful result labels, keyboard navigation, accessible image descriptions, readable dates, language metadata, clear content-type distinctions, landmarks, and avoid color-only cues. Graphs and visualizations should complement ordinary lists and links—not replace them. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the [HTML Living Standard](https://html.spec.whatwg.org/).

## Privacy and publisher control

Public versus private resources, drafts, personal or family information, health-related pages, location, identifying details, machine-readable metadata, cross-site aggregation, and automated inferences all matter. Structured metadata and category indexes can make information more discoverable. Intentionally declaring a subject differs from having a system infer it from incidental or sensitive content. Treat sensitive inferred subjects cautiously. Crawler-access and indexing controls are separate mechanisms—see [Robots]({{ '/implement/content/robots/' | relative_url }}). Removing a category does not secure an otherwise public page.

## Publish for people, not for ranking tricks

Good discovery practices rest on original content, clear headings, meaningful links, honest categories, accurate dates, stable URLs, working navigation, accessible media, public feeds, and relevant structured metadata. Dumping unrelated tags or repeating keywords makes content less useful. No practice promises improved rankings, guaranteed indexing, or automatic placement. See [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }}).

## Complete publishing example

Harbor Notes includes a homepage, About page, notes index, two articles, projects index, one software project, photography collection, one photograph page, topic index, one topic page, a JSON Feed, and an XML sitemap—all static HTML.

A visitor reaches “Building a Small Website” from `/notes/`, finds a related accessibility note via `/topics/web-accessibility/`, and discovers “Harbor at dusk” through `/photos/`. Compatible applications may use page links, titles, publisher-declared categories, feed entries, dates, canonical URLs, Schema.org, and creative-work descriptions. Declared categories and dates are publisher-supplied; whether a page “belongs” in a third-party neighborhood may still require interpretation by that system.

## Make discovery part of publishing

1. **Publish a real resource** — accessible HTML with useful content.
2. **Give it a stable URL** — meaningful permalink and canonical.
3. **Describe it clearly** — accurate title, heading, and summary.
4. **Connect it to the site** — navigation and collection links.
5. **Declare relevant subjects** — categories, tags, or structured properties.
6. **Publish an update** — add the resource to the relevant feed.
7. **Advertise the URL** — maintain the XML sitemap.
8. **Add optional structured metadata** — Microformats2, Open Graph, or Schema.org.
9. **Validate** — HTML, metadata, links, feed, and HTTP responses.
10. **Maintain the resource** — preserve identifiers; update dates when changes matter.

Adopt these practices incrementally.

## How different discovery views work conceptually

| Interface | Role |
| --- | --- |
| Topic browsing | Groups content by subject or category |
| What’s New / Activity | Surfaces recently published or updated material |
| Creative Showcase | Highlights individual works and collections |
| Search | Finds relevant content using text and metadata |

These are presentation approaches, not formal web standards. Selection, freshness, quality, and ordering rules differ by application. Source links, clear labeling, and provenance matter regardless of the interface. Hub-specific window sizes and ranking weights are not universal publishing requirements.

## Keep discovery grounded in what publishers actually published

Preserve the source of information: declared categories, observed content, inferred topics, page URLs, publication timestamps, observation timestamps, original language, attribution, content type, and uncertainty. Normalized aliases (for example grouping “photograph” and “photography” for navigation) do not create additional evidence. Vague labels should not be silently promoted into stronger claims. Publishers need clear paths to report inaccurate classifications.

## Updating, correcting and removing content

New pages, edits, deletions, redirects, changed canonicals, removed tags, corrected authorship, renamed categories, updated feeds and sitemaps, and reclassification by external systems all affect discoverability. Third-party indexes may retain historical observations or caches for a time. Distinguish live content from a third-party’s last observation. Maintain redirects and consistent metadata after changes. Reporting outdated classifications does not promise immediate reindexing.

## Explore and the Joshternet

Joshternet helps visitors discover participants’ work and interests by combining publisher-provided information with observed public content for topic exploration, activity views, creative discovery, and search. Listings link back to original websites rather than treating the directory as the primary publisher. Topic association is not proof of friendship, expertise, or endorsement. Joining Joshternet (`/.well-known/josh`) is separate from optional discovery metadata.

The hub distinguishes declared subjects from heuristic inferences (with quality and sensitivity limits); page roles and indexing directives constrain contributions. Shared topics do not create Connections edges. Featuring is never guaranteed; indexes can lag; quiet sites may not appear in recent-activity views beyond the hub’s own windows. Details: [Reference]({{ '/implement/content/reference/' | relative_url }}) and [Connections crawl notes]({{ '/implement/connections/' | relative_url }}).

## Check whether your content is discoverable

1. Confirm HTTP status and readable HTML.
2. Validate structure with the [Nu HTML Checker](https://validator.w3.org/nu/).
3. Verify important resources via ordinary links.
4. Confirm canonical declarations.
5. Check visible categories and structured category properties.
6. Parse h-entry / `p-category` with a conforming Microformats2 parser.
7. Validate JSON-LD at [validator.schema.org](https://validator.schema.org/).
8. Confirm feed entries have stable IDs and appropriate dates.
9. Verify sitemap URLs and meaningful modification dates.
10. Check creative works have landing pages, descriptions, and media.
11. Test reading order, link names, images, and keyboard access.
12. Confirm no unpublished or sensitive information is exposed unintentionally.

Each step establishes something specific; none guarantees indexing or placement.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| No meaningful title | Opaque results | Specific titles and h1 |
| Unlinked content | Unreachable pages | Ordinary hyperlinks |
| Broken internal navigation | Dead ends | Fix menus and indexes |
| Contradictory canonicals | Split identity | One intended URL |
| No stable permalinks | Fragile citations | Permalinks per item |
| Generic meta descriptions | Useless snippets | Accurate summaries |
| Tags without subjects | Noise | Reflect real content |
| Every word as a topic | Diluted meaning | Editorial judgment |
| Interests as article categories | Wrong aboutness | Separate site vs item |
| Misplaced `p-category` | Lost declared tags | On the h-entry object |
| Invalid feed metadata | Broken consumers | Valid categories/dates |
| Inconsistent dates | Confused freshness | Align HTML and feeds |
| Build stamp as modified | False churn | Real change dates |
| Creative work without a page | Hard to cite | Dedicated work URL |
| Thumbnail as distinct work | False inventory | Separate when intentional |
| Collection as article | Wrong type | Classify containers vs items |
| Broken feed autodiscovery | Missed syndication | Valid alternate links |
| Wrong sitemap URLs | Crawl waste | Canonical absolute URLs |
| Missing language metadata | Misclassification | `lang` / `inLanguage` |
| Force-translated topics | Lost meaning | Keep original labels |
| Shared topic as friendship | False social graph | Evidence for relationships |
| Search match as membership | Overclaim | Match ≠ community |
| Crawler summary as author text | Misattribution | Label generated text |
| Sensitive inferred categories | Privacy harm | Caution + publisher control |
| Expecting instant indexing | Frustration | Indexes lag |
| One system supports every format | False certainty | Partial consumers |
| Hub display rules as web law | Spec confusion | Label Joshternet separately |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})
- [OPML]({{ '/implement/content/opml/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }})
- [Schema.org]({{ '/implement/content/schema-org/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [XML Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Robots]({{ '/implement/content/robots/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Identity and authorship]({{ '/implement/content/identity/' | relative_url }})
- [Connections]({{ '/implement/content/connections/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Events]({{ '/implement/content/events/' | relative_url }})
- [Uses pages]({{ '/implement/content/uses/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Uses; next: Validation).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [HTML Living Standard](https://html.spec.whatwg.org/) | HTML |
| [Microformats2](https://microformats.org/wiki/microformats2) | Community vocabulary |
| [h-entry](https://microformats.org/wiki/h-entry) | Entries |
| [h-feed](https://microformats.org/wiki/h-feed) | Feeds |
| [Microformats2 parsing](https://microformats.org/wiki/microformats2-parsing) | Parsing |
| [Schema.org](https://schema.org/) | Structured data |
| [about](https://schema.org/about) | Subject of a work |
| [mentions](https://schema.org/mentions) | References within a work |
| [keywords](https://schema.org/keywords) | Keywords |
| [knowsAbout](https://schema.org/knowsAbout) | Person/Organization subjects |
| [CollectionPage](https://schema.org/CollectionPage) | Collections |
| [ItemList](https://schema.org/ItemList) | Lists |
| [Open Graph Protocol](https://ogp.me/) | Link previews |
| [RSS 2.0](https://www.rssboard.org/rss-specification) | RSS |
| [Atom (RFC 4287)](https://www.rfc-editor.org/rfc/rfc4287) | Atom |
| [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) | JSON Feed |
| [Sitemap Protocol](https://www.sitemaps.org/protocol.html) | Sitemaps |
| [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) | Robots |
| [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) | Web Linking |
| [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | Vendor guidance |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility |
| [Nu HTML Checker](https://validator.w3.org/nu/) | HTML validation |
| [Schema.org Markup Validator](https://validator.schema.org/) | Structured data |
| [Microformats2 parser](https://pin13.net/mf2/) | mf2 validation |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
