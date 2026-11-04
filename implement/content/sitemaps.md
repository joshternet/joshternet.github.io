---
layout: default
title: "XML Sitemaps: Help the Web Discover Your Content"
description: >-
  Publish XML sitemaps and sitemap indexes so compatible crawlers can discover
  your public URLs—with accurate locs, lastmod, robots advertising, and clear
  limits on what a sitemap can and cannot guarantee.
keywords: >-
  XML sitemap, sitemap index, lastmod, robots.txt Sitemap, sitemaps.org,
  independent web, web publishing
permalink: /implement/content/sitemaps/
nav_title: Sitemaps
content_id: sitemaps
matrix_id: sitemaps
seo:
  type: TechArticle
  name: Sitemaps
---

# Sitemaps

Websites can contain many pages—some deeply nested or rarely linked from the homepage. An XML sitemap is a machine-readable list of URLs the publisher considers relevant for discovery. Compatible crawlers may use it as one source when deciding what to retrieve.

A sitemap does not replace ordinary navigation. Pages should still connect through meaningful hyperlinks. Sitemaps are a widely adopted open-web convention useful beyond any single search engine. Listing a URL advertises it; it does **not** guarantee crawling, indexing, ranking, or featuring.

## How the Sitemap Protocol developed

The [Sitemap Protocol](https://www.sitemaps.org/protocol.html) at sitemaps.org defines a shared XML format for advertising website resources. It is an industry specification, not an IETF RFC or W3C Recommendation. Major search engines and other crawlers adopted it; individual engines also publish **extensions** (images, video, news, multilingual annotations) that are not required of every consumer. A crawler may understand the base format without supporting every extension.

## A map of the resources on your website

<ol class="content-discovery-flow" aria-label="How XML sitemaps support discovery">
  <li>
    <strong>Create</strong>
    <span>You list public resource URLs in a sitemap document.</span>
  </li>
  <li>
    <strong>Publish</strong>
    <span>You host the sitemap at an accessible HTTPS URL.</span>
  </li>
  <li>
    <strong>Advertise</strong>
    <span>You point crawlers at it via robots.txt or other discovery methods.</span>
  </li>
  <li>
    <strong>Retrieve</strong>
    <span>A crawler fetches the sitemap when allowed.</span>
  </li>
  <li>
    <strong>Extract</strong>
    <span>It reads valid, in-scope resource URLs (and child sitemaps from an index).</span>
  </li>
  <li>
    <strong>Schedule</strong>
    <span>It may queue those URLs for later retrieval.</span>
  </li>
  <li>
    <strong>Evaluate</strong>
    <span>It independently judges pages—discovery is not indexing or presentation.</span>
  </li>
</ol>

Sitemap entries should match real public resources: articles, projects, collections, archives, and other pages you intend to advertise.

## Inside an XML sitemap

| Element | Required? | Meaning |
| --- | --- | --- |
| XML declaration | Recommended | Document encoding; protocol expects UTF-8 |
| `<urlset>` | Yes (urlset docs) | Root; namespace `http://www.sitemaps.org/schemas/sitemap/0.9` |
| `<url>` | Yes (per entry) | One listed resource |
| `<loc>` | Yes | Fully qualified URL of the resource |
| `<lastmod>` | No | Last significant modification (W3C date/time) |
| `<changefreq>` | No | Expected change pattern hint |
| `<priority>` | No | Relative importance among URLs on **this** site (0.0–1.0) |

Protocol validity differs from how modern crawlers weigh optional fields. Many engines treat `changefreq` and `priority` as weak or ignored hints.

```xml
<?xml version="1.0" encoding="UTF-8"?>
```

## Create your first XML sitemap

Imagine Harbor Notes with a homepage, About, Notes index, one article, Projects index, one project, and a photography gallery.

1. **Identify public resources** you want discovered.
2. **Choose one canonical URL** per resource.
3. **Create the XML:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://joshua.example/</loc>
  </url>
  <url>
    <loc>https://joshua.example/about/</loc>
  </url>
  <url>
    <loc>https://joshua.example/notes/</loc>
  </url>
  <url>
    <loc>https://joshua.example/notes/lab/</loc>
    <lastmod>2026-10-15</lastmod>
  </url>
  <url>
    <loc>https://joshua.example/projects/</loc>
  </url>
  <url>
    <loc>https://joshua.example/projects/home-server/</loc>
  </url>
  <url>
    <loc>https://joshua.example/photography/</loc>
  </url>
</urlset>
```

4. **Publish** at a public URL such as `https://joshua.example/sitemap.xml`. That path is a common convention, not the only allowed filename.
5. **Verify:**

```bash
curl -i https://joshua.example/sitemap.xml
```

Confirm status 200, XML body, UTF-8, and absolute `loc` values that match live pages.

## List the URLs you actually want discovered

`<loc>` must be a fully qualified URL (scheme, host, path). Prefer HTTPS. Mind hostnames, path case, trailing slashes, query strings, and percent-encoding. Do not list fragments as distinct resources. Prefer **canonical** URLs over duplicates (HTTP vs HTTPS, www vs bare, parameterized copies). Align sitemap locs with `rel="canonical"` and permanent redirects when you use them—sitemaps advertise preference; they do not force a crawler to accept it. See [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }}).

## XML escaping and URL encoding

URL encoding (percent-encoding) is not the same as XML entity escaping. Inside XML text, an ampersand in a URL must appear as `&amp;`:

```xml
<loc>https://joshua.example/search/?topic=art&amp;year=2026</loc>
```

Escape `&`, `<`, `>`, `"`, and `'` as XML requires. Keep the document UTF-8. Prefer an XML serializer over string concatenation.

## Tell crawlers when something actually changed

Optional `<lastmod>` uses W3C date/time formats:

```xml
<lastmod>2026-10-15</lastmod>
<lastmod>2026-10-15T18:30:00+00:00</lastmod>
```

Use meaningful content updates—not copyright footers, empty redeploys, or “sitemap regenerated” timestamps. Distinguish publication date, last content update, sitemap generation time, deploy time, and crawl time. False freshness makes sitemaps less trustworthy. In a **sitemap index**, `<lastmod>` describes the **child sitemap file**, not every page inside it.

## Change frequency and priority

Allowed `<changefreq>` values: `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`. They describe expected patterns; they are not schedules crawlers must obey.

`<priority>` is relative among URLs on the **same** site (0.0–1.0), not a way to outrank other websites. Google and Bing documentation indicate these hints are not relied on for crawling or ranking. Prefer honest links, canonical URLs, and truthful `lastmod` over stuffing priorities.

## When one sitemap isn't enough

Protocol limits:

- At most **50,000** URLs per sitemap
- At most **50 MiB** uncompressed XML per sitemap
- At most **50,000** sitemap references per index
- At most **50 MiB** uncompressed XML per index

Gzip reduces transfer size; it does **not** raise the uncompressed limit. Split large sites by category or period, avoid duplicate locs across files, and keep naming deterministic for reproducible builds.

## Sitemap indexes

An index lists sitemap documents, not page URLs:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://joshua.example/sitemaps/articles.xml</loc>
    <lastmod>2026-10-15</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://joshua.example/sitemaps/projects.xml</loc>
    <lastmod>2026-10-10</lastmod>
  </sitemap>
</sitemapindex>
```

Each child must be a reachable sitemap. Do not assume unlimited recursive nesting across all consumers.

## Sitemap locations and ownership boundaries

Where a sitemap lives affects which URLs it may represent under the base protocol (typically same host / path ownership rules). Root `/sitemap.xml` is common; subdirectory sitemaps have narrower scope. Subdomains are separate hosts. Some search engines offer additional cross-site submission mechanisms—those are vendor features, not universal. Do not assume every crawler accepts cross-origin locs or indexes.

## Tell crawlers where your sitemap lives

Advertise with the `Sitemap:` directive in [robots.txt]({{ '/implement/content/robots/' | relative_url }}):

```text
User-agent: *
Allow: /

Sitemap: https://joshua.example/sitemap.xml
```

`Sitemap:` is not limited to one user-agent group. You may list multiple sitemaps or an index. Advertising a sitemap is separate from allowing access to the pages it lists.

## Search-engine submission and discovery

Crawlers may find sitemaps via robots.txt, webmaster tools ([Google Search Console](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Bing](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)), APIs, or occasional links. Submission is optional for a valid document. Submission ≠ retrieval ≠ crawl ≠ index. Legacy “ping” endpoints are limited or retired—prefer current vendor docs.

## Image, video, and news extensions

These are **vendor extensions**, mainly documented by Google—not required base protocol elements.

**Images** (`http://www.google.com/schemas/sitemap-image/1.1`): associate `<image:image>` / `<image:loc>` with a page `<url>`. Useful for photographers and galleries. Prefer current documented elements; skip deprecated image-only properties.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://joshua.example/photography/pier/</loc>
    <image:image>
      <image:loc>https://joshua.example/images/pier.jpg</image:loc>
    </image:image>
  </url>
</urlset>
```

**Video:** Google’s video sitemap elements (thumbnail, title, description, content/player loc, duration, publication date, etc.) describe video associated with a page. Relate them to Media RSS and Schema.org `VideoObject` as complementary, not identical. Not all crawlers support the extension.

**News:** Google News sitemaps target timely articles (often limited to recent days). Ordinary blogs usually need a regular sitemap, not a News sitemap.

## Multilingual websites and hreflang

Some consumers understand xhtml link annotations in sitemaps for language alternatives (`http://www.w3.org/1999/xhtml`). Use absolute URLs, reciprocal references, self-references, and `x-default` where appropriate. Each language version generally remains its own canonical. This differs from HTML `lang` and Open Graph locales, and it is consumer-specific—not a universal Sitemap Protocol requirement. See [Google’s localized versions guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://joshua.example/en/notes/lab/</loc>
    <xhtml:link rel="alternate" hreflang="en"
      href="https://joshua.example/en/notes/lab/" />
    <xhtml:link rel="alternate" hreflang="es"
      href="https://joshua.example/es/notes/lab/" />
    <xhtml:link rel="alternate" hreflang="x-default"
      href="https://joshua.example/notes/lab/" />
  </url>
  <url>
    <loc>https://joshua.example/es/notes/lab/</loc>
    <xhtml:link rel="alternate" hreflang="en"
      href="https://joshua.example/en/notes/lab/" />
    <xhtml:link rel="alternate" hreflang="es"
      href="https://joshua.example/es/notes/lab/" />
    <xhtml:link rel="alternate" hreflang="x-default"
      href="https://joshua.example/notes/lab/" />
  </url>
</urlset>
```

## Other sitemap representations

Some engines also accept plain-text URL lists or treat recent [RSS/Atom]({{ '/implement/content/feeds/' | relative_url }}) items as discovery hints. Those are alternatives or supplements—not the same as a full XML sitemap of canonical resources. JSON Feed is not a universally accepted sitemap format.

## Sitemaps for personal websites and creative work

Typical inventories:

- **Personal:** `/`, `/about/`, `/now/`, `/uses/`, `/notes/`, `/colophon/`, …
- **Writer:** articles, essays, notes, archives, books
- **Photographer:** gallery indexes, photo pages (+ image extension if useful)
- **Developer:** projects, apps, docs, releases
- **Musician:** albums, tracks, performances
- **Events:** event pages and archives

Give individual works stable URLs, not only a gallery index. Pair with [slash pages]({{ '/implement/content/slashpages/' | relative_url }}) and [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}) when helpful.

## Let your publishing system maintain the sitemap

Generate from the same content that builds HTML:

```text
Published content
       |
Canonical URL selection
       |
Modification timestamps
       |
XML serialization
       |
Validation
       |
sitemap.xml
```

Handwritten sites, Jekyll, Hugo, Eleventy, WordPress, and custom apps can all emit sitemaps. Filter drafts, unpublished pages, `noindex` URLs, private paths, redirects-as-locs, and utility pages. Prefer deterministic output—do not advance every `lastmod` because a scheduled build ran.

## Sitemap generation over time

Add new pages, update `lastmod` on real edits, remove deleted URLs, follow migrations with redirects, and grow into indexes when needed. On build failure, avoid replacing a good sitemap with empty or invalid XML. Atomic deploys help. A successful sitemap fetch does not prove every listed URL still works—spot-check locs.

## Sitemaps and independent-web discovery

| Mechanism | Purpose |
| --- | --- |
| HTML navigation | Connects pages for people and crawlers |
| Slash pages / `/slashes/` | Purpose-based organization and human maps |
| OPML | Machine-readable catalogs / subscriptions |
| Feeds | Announces updates |
| XML sitemap | Advertises resource URLs |
| Semantic HTML / Schema.org | Describes content |
| robots.txt | Expresses access policies |

These tools complement each other. A site can remain navigable if one consumer skips sitemaps or feeds.

## Sitemaps and the Joshternet

Public sitemaps can help independent discovery systems find content on participating sites. Joshternet’s hub may use robots `Sitemap:` directives or a conventional `/sitemap.xml`, follow same-origin urlsets and indexes, and enqueue listed URLs subject to robots rules—up to **`MAX_SITEMAP_FILES` (20)** sitemap files. That cap is an implementation resource limit, **not** a Sitemap Protocol rule. The hub does not fully implement image/video/news/hreflang extensions, and `lastmod` is not a ranking signal here. Details: [Reference]({{ '/implement/content/reference/' | relative_url }}).

## Security and privacy

List only URLs you intend to advertise. Avoid drafts, secrets in query strings, private paths, XXE risks, oversized XML, and unsafe schemes. Excluding a URL from a sitemap does not secure it; listing a URL does not bypass authentication.

## Complete implementation walkthrough

1. Inventory public content and canonical URLs.
2. Exclude drafts, private, invalid, and duplicate URLs.
3. Set `lastmod` from real content updates.
4. Generate UTF-8 XML with the correct namespace.
5. Split into an index when size limits approach.
6. Publish over HTTPS.
7. Advertise with `Sitemap:` in robots.txt.
8. Validate XML, HTTP, and sample locs.
9. Add, update, and remove content—confirm the sitemap tracks changes.
10. Rebuild without source changes—confirm no false `lastmod` churn.

## Make sure your sitemap tells the truth

- Validate XML (namespace, escaping, encoding)—e.g. `xmllint`
- Confirm locs resolve and match intent
- Compare with canonical links and redirects
- Check `lastmod` honesty
- Verify index children exist
- Respect URL/size limits
- Check extension markup only if you publish it
- `curl -i` for status and content type
- Use Search Console / Bing tools as optional diagnostics
- Repeat builds for determinism

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Wrong/missing namespace | Parsers reject the file | Use the sitemaps.org 0.9 namespace |
| Unescaped `&` in locs | Invalid XML | Use `&amp;` |
| Relative locs | Entries ignored or broken | Absolute URLs only |
| Duplicate / redirect clutter | Wasted crawl budget | List preferred canonicals |
| Deleted or private URLs | Errors or exposure | Remove or never list them |
| `lastmod` = build time | Distrust | Stamp real content changes |
| Relying on priority/changefreq | False control expectations | Treat as optional hints |
| Exceeding size limits | Truncation or rejection | Split + index |
| Index vs urlset confusion | Wrong document shape | Indexes list sitemaps; urlsets list pages |
| Missing child sitemaps | Broken index | Keep child files published |
| Assuming cross-origin locs always work | Consumer-specific failures | Follow base protocol ownership |
| News sitemap for old blog posts | Irrelevant / rejected | Use ordinary sitemaps |
| Empty overwrite after failed build | Discovery wipe | Fail closed |
| Confusing discovery with indexing | Unmet expectations | Sitemap ≠ guarantee |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})
- [OPML]({{ '/implement/content/opml/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Robots]({{ '/implement/content/robots/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Feeds; next: Robots).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [Sitemap Protocol](https://www.sitemaps.org/protocol.html) | Base XML sitemap format |
| [Sitemaps FAQ](https://www.sitemaps.org/faq.html) | Protocol FAQ |
| [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) | Vendor guidance |
| [Google: Large sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps) | Vendor guidance |
| [Google: Image sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps) | Extension |
| [Google: Video sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps) | Extension |
| [Google: News sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap) | Extension |
| [Google: Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions) | hreflang guidance |
| [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a) | Vendor guidance |
| [XML 1.0](https://www.w3.org/TR/xml/) | Well-formed XML |
| [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) | Robots Exclusion Protocol |
| [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) | URI syntax |
| [W3C Date and Time Formats](https://www.w3.org/TR/NOTE-datetime) | `lastmod` date forms |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
