---
layout: default
title: "SEO Fundamentals: Make Your Website Easier to Find"
description: >-
  Make an independent website easier to discover: titles, descriptions,
  canonical URLs, crawler access, sitemaps, and durable publishing practices
  that help search engines and people find your work.
keywords: >-
  SEO, search engine optimization, meta description, canonical URL,
  robots.txt, sitemaps, indexing, independent web, web publishing
permalink: /implement/content/seo/
nav_title: SEO fundamentals
content_id: seo
matrix_id: seo
seo:
  type: TechArticle
  name: SEO fundamentals
---

# SEO Fundamentals

Search engine optimization is the practice of making published content accessible, understandable, and useful to search engines and to the people who use them. On an independent website, that usually means clear titles, honest summaries, stable addresses, real links, and pages that respond successfully over ordinary HTTP.

Design the site for readers first. Search engines are one way people discover writing, photographs, projects, and other work—not the only audience that matters. The same fundamentals also help feed readers, directories, personal indexes, and independent crawlers make sense of what you publish.

SEO is not a contest for rankings. The durable goal is to make good content easier to find. Metadata and sitemaps can support that goal; they do not replace useful pages, and they do not guarantee indexing, ranking, or traffic.

## How search engines discover your website

Search systems generally move through four stages. Each stage can succeed or fail on its own.

<ol class="content-discovery-flow" aria-label="How search engines process websites">
  <li>
    <strong>Discovery</strong>
    <span>Engines encounter URLs through hyperlinks, sitemaps, feeds, and other public sources.</span>
  </li>
  <li>
    <strong>Crawling</strong>
    <span>Automated clients retrieve permitted resources and follow additional links they find.</span>
  </li>
  <li>
    <strong>Indexing</strong>
    <span>Systems analyze content, identify its subject, and decide whether to store it in an index.</span>
  </li>
  <li>
    <strong>Presentation</strong>
    <span>For a query, the system selects and displays results it considers relevant.</span>
  </li>
</ol>

A discovered URL might never be crawled. A crawled page might never be indexed. An indexed page might never appear prominently for a given query. Submitting a sitemap or adding metadata does not guarantee any of those later steps.

## Publish something worth finding

Search engines and people both benefit from original writing, clear explanations, descriptive headings, and meaningful links. Arbitrary keyword repetition is not a content strategy.

Useful practices include:

- Descriptive page titles that name the actual subject.
- Clear article and project headings that match what the page contains.
- Relevant content organized into readable sections.
- Accurate summaries and descriptions.
- Correct language declarations on the document.
- Internal links that connect related work.
- Content that is publicly reachable when you intend it to be found.
- Updates when the subject requires fresher information.

Copying the same keywords onto every page does not make a site more understandable. It makes every page sound alike.

| Weak | More useful |
| --- | --- |
| Title: `Home` on every URL | Title: `Building a Home Server \| Harbor Notes` |
| Description: `Best tips tips tips for servers` | Description: `Notes on rebuilding an old desktop into a quiet home server.` |
| Heading: `Welcome` for an article about photography | Heading: `Harbor fog studies, October 2026` |

None of these patterns promises a ranking outcome. They help readers and machines recognize what the page is about.

## Help readers recognize your pages

### HTML title

The `<title>` element names the document. It often appears in browser tabs, bookmarks, and search results. Each page should have its own meaningful title. The visible `<h1>` should describe the same content, but the two strings do not have to be identical word for word.

```html
<title>Building a Home Server | Harbor Notes</title>
```

Search engines may generate the title they display from multiple signals rather than reproducing the HTML title exactly.

### Meta description

A meta description provides a concise summary. It may influence how a page is presented in search results, though engines often write their own snippets from page content instead.

```html
<meta
  name="description"
  content="Notes on building a reliable home server
           from an old desktop computer."
>
```

### How titles and descriptions relate

| Signal | Role |
| --- | --- |
| Document `<title>` | Names the HTML document for browsers, bookmarks, and many crawlers. |
| Visible page heading (`<h1>`) | Names the main content people see on the page. |
| Meta description | Summarizes the page for potential snippets and previews. |
| Open Graph title | Supplies a sharing/preview title for apps that read OG tags. |
| Open Graph description | Supplies a sharing/preview summary for those apps. |

These fields should describe the same actual content without necessarily containing identical text. For document structure, see [Semantic HTML]({{ '/implement/content/html/' | relative_url }}). For preview metadata, see [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}).

## Give every page a clear address

A single piece of content can sometimes be reached through more than one URL: trailing-slash variants, HTTP and HTTPS, `www` and bare hosts, tracking parameters, copied pages, or migration leftovers. Canonicalization is the practice of identifying the preferred URL for a resource so systems can treat duplicates as one work.

[RFC 6596](https://www.rfc-editor.org/rfc/rfc6596) defines the `canonical` link relation. In HTML:

```html
<link
  rel="canonical"
  href="https://joshua.example/notes/home-server/"
>
```

Practical patterns:

- Prefer a self-referencing canonical on the primary page.
- Point near-duplicate pages at the preferred URL.
- Use permanent HTTP redirects when an old URL should stop being used; a canonical is not a substitute for that move.
- Keep internal links consistent with the preferred form.
- List canonical URLs in sitemaps when you publish a sitemap.
- Cross-domain canonicals can point at the preferred origin after a move, when that is the honest preferred location.
- Non-HTML resources can advertise a canonical via the HTTP `Link` header ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)).
- Multilingual sites should keep language variants clear (for example with `hreflang` where appropriate) and avoid pointing every language at one unrelated URL.
- Avoid conflicting canonicals (different tags, headers, or sitemap entries naming different preferences).

Canonical declarations are signals, not guaranteed instructions. Search engines may ignore a bad or conflicting preference.

Incorrect patterns include canonical URLs that point at a missing page, unrelated content, or a URL that crawlers are blocked from fetching. Vendor guidance on how major engines interpret these signals is published in Google Search Central’s [canonicalization documentation](https://developers.google.com/search/docs/crawling-indexing/canonicalization) (vendor guidance, not a web standard).

## Make sure crawlers can reach your content

When you intend a page to be discovered, it should be publicly reachable with a successful HTTP response that includes meaningful HTML.

Helpful conditions:

- Successful responses for the URLs you care about.
- Primary content present in the HTML the server returns.
- Correct status codes (including redirects that land on the intended page).
- HTTPS with a valid certificate for production sites that use it.
- Navigation built from real anchors with `href` attributes.
- Few broken links; missing pages returning 404 or 410 as appropriate.
- Awareness that content available only after client-side JavaScript runs may be harder for some crawlers to interpret.
- Layouts that remain usable on smaller screens.

A site can “work” in a browser and still be difficult for a crawler if navigation or body text never appear without scripts.

```html
<!-- Ordinary, crawlable navigation -->
<nav>
  <a href="/notes/">Notes</a>
  <a href="/photos/">Photos</a>
</nav>
```

```html
<!-- Harder for many crawlers: no real href until a script runs -->
<nav>
  <button data-go="notes">Notes</button>
  <button data-go="photos">Photos</button>
</nav>
```

See [Semantic HTML]({{ '/implement/content/html/' | relative_url }}) for document structure, regions, and link patterns.

## Help discovery systems find your pages

Internal links form a navigable structure. A home page, section indexes, archives, and related-content links help visitors and crawlers find more of the site. Descriptive anchor text is more useful than “click here.”

XML sitemaps advertise URLs you care about discovering. Sitemap indexes group large sets of sitemaps. The `lastmod` field is useful when it reflects a real change; inventing fresh dates does not create urgency for crawlers. You can declare a sitemap location in `robots.txt`. Prefer listing canonical URLs.

Listing a URL in a sitemap does not guarantee crawling or indexing.

Slash pages, OPML catalogs, and syndication feeds play complementary roles: [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}), [OPML and well-known slashpages]({{ '/implement/content/opml/' | relative_url }}), [Feeds]({{ '/implement/content/feeds/' | relative_url }}), and [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}) each have dedicated chapters. This page introduces how they support discovery; those chapters cover implementation detail.

## Choose what crawlers can access

Controlling crawling is not the same as controlling indexing.

| Mechanism | What it mainly does | What it does not do |
| --- | --- | --- |
| `robots.txt` (`Allow` / `Disallow`, user-agent groups) | Asks cooperating crawlers which paths they may fetch. | Secure private data; reliably remove a URL from search results. |
| `noindex` (meta robots or `X-Robots-Tag`) | Asks cooperating systems not to index a fetched page. | Work if the crawler never fetches the page to see the directive. |
| `nofollow` (on a page or a link, depending on context) | Hints that links should not be treated as endorsements for ranking. | Hide a destination URL that is already known from other sources. |
| Authentication / non-public hosting | Keeps content off the public web. | Substitute for publishing preferences on public URLs. |

Blocking crawling with `robots.txt` does not reliably prevent a URL from appearing in search results. To observe `noindex`, a crawler generally needs access to the page (or an equivalent HTTP header).

`robots.txt` is not an access-control system. Never rely on it to protect private information.

Emerging AI-content usage preferences and related agent directives belong in the [Robots]({{ '/implement/content/robots/' | relative_url }}) chapter, which covers [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) and related conventions in depth.

## Describe your content more precisely

Standard metadata helps different systems understand what a page represents:

- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}) for sharing previews.
- [Schema.org and JSON-LD]({{ '/implement/content/schema-org/' | relative_url }}) for typed structured data.
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}) for structure in HTML classes.
- Article and creative-work fields, publication and modification dates, author information, and preview images.

These formats complement semantic HTML and the SEO practices on this page. They do not guarantee enhanced search-result features.

```html
<head>
  <title>Building a Home Server | Harbor Notes</title>
  <meta
    name="description"
    content="Notes on rebuilding an old desktop into a quiet home server."
  >
  <link
    rel="canonical"
    href="https://joshua.example/notes/home-server/"
  >
  <meta property="og:title" content="Building a Home Server">
  <meta
    property="og:description"
    content="Rebuilding an old desktop into a quiet home server."
  >
  <meta property="og:type" content="article">
  <meta
    property="og:url"
    content="https://joshua.example/notes/home-server/"
  >
</head>
```

Defer full structured-data recipes to the chapters linked above.

## Images, media and accessibility

Images and other media participate in discovery when they are reachable, described, and associated with real content.

Useful habits:

- Descriptive file names that reflect the subject.
- Alternative text that serves people who cannot see the image.
- Figure captions when a caption adds meaning.
- Accurate dimensions when you declare them.
- Appropriate formats for the content.
- Predictable, publicly reachable media URLs.
- Open Graph preview images that match the page.
- Structured data for media only when it describes what visitors can actually see or hear.

Accessible publishing and discoverable publishing often share the same practices. Compression tricks, keyword-stuffed filenames, and artificial alt text are not durable strategies. See [Creative media]({{ '/implement/content/media/' | relative_url }}) for media-specific guidance.

## Make your website pleasant to use

Responsive layouts, readable typography, efficient assets, reasonable load time, limited unnecessary JavaScript, and stable layout help people use the site. Those qualities also reduce the chance that crawlers and tools struggle with incomplete or fragile pages.

[Core Web Vitals](https://web.dev/articles/vitals) are performance and experience measurements used in Google’s ecosystem. They are not universal ranking laws for the entire web. Small independent sites can offer an excellent experience without elaborate infrastructure. Prefer established performance guidance over framework fashion.

## Search engines and the independent web

Discoverability extends beyond conventional search engines. Ordinary web standards also support feed readers, website directories, blogrolls, personal indexes, independent crawlers, webrings, content-discovery communities, and networks such as the Joshternet.

Participating in one network should not require optimizing exclusively for that network. Publish for people on your own site; let compatible systems reuse the public signals you choose to expose. JoshBot may encounter public pages during discovery when a site participates and permits crawling—publication timing and surface inclusion are separate decisions, not promises attached to any single metadata field.

## Complete implementation example

The following static HTML document demonstrates the ideas on this page. It needs no JavaScript to be readable.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>Building a Home Server | Harbor Notes</title>
  <meta
    name="description"
    content="Notes on rebuilding an old desktop into a quiet home server."
  >
  <link
    rel="canonical"
    href="https://joshua.example/notes/home-server/"
  >

  <meta property="og:title" content="Building a Home Server">
  <meta
    property="og:description"
    content="Rebuilding an old desktop into a quiet home server."
  >
  <meta property="og:type" content="article">
  <meta
    property="og:url"
    content="https://joshua.example/notes/home-server/"
  >
  <meta
    property="og:image"
    content="https://joshua.example/images/home-server-desk.jpg"
  >

  <link
    rel="alternate"
    type="application/atom+xml"
    title="Harbor Notes"
    href="https://joshua.example/feed.xml"
  >
</head>
<body>
  <header>
    <p><a href="https://joshua.example/">Harbor Notes</a></p>
    <nav aria-label="Site">
      <a href="https://joshua.example/notes/">Notes</a>
      <a href="https://joshua.example/photos/">Photos</a>
    </nav>
  </header>

  <main>
    <article>
      <h1>Building a Home Server</h1>
      <p>
        Published
        <time datetime="2026-10-12">Oct. 12, 2026</time>
      </p>
      <p>
        I rebuilt an aging desktop into a quiet home server for
        backups, photo storage, and a few small services.
      </p>
      <figure>
        <img
          src="https://joshua.example/images/home-server-desk.jpg"
          width="1280"
          height="800"
          alt="A small desktop computer under a wooden desk,
               with a single Ethernet cable attached."
        >
        <figcaption>
          The finished machine under the workbench.
        </figcaption>
      </figure>
      <p>
        Related:
        <a href="https://joshua.example/notes/network-closet/">
          Notes from the network closet
        </a>
      </p>
    </article>
  </main>
</body>
</html>
```

Why the important pieces are there:

- `lang`, charset, and viewport establish a readable document.
- Unique `<title>` and meta description name and summarize the page.
- `rel="canonical"` identifies the preferred URL.
- Semantic `<article>`, heading, and `<time>` mark the work and its date.
- Real internal links and descriptive `alt` text keep people and crawlers oriented.
- Open Graph tags support sharing previews; feed autodiscovery advertises updates.

## Validate your implementation

### Inspect HTTP responses

```bash
curl -i https://joshua.example/notes/home-server/
```

Confirm the status code, content type, and any redirects land on the intended URL.

### Inspect page source

View the delivered HTML and verify that titles, descriptions, canonical links, and meaningful body content are present without waiting on a script.

### Validate HTML

Check the document with the [Nu HTML Checker](https://validator.w3.org/nu/).

### Test crawl and indexing behavior

Review `robots.txt` and on-page or header indexing directives. Search-engine webmaster tools can be useful diagnostics; they are optional and not required for publication.

### Inspect canonicalization

Confirm the canonical URL resolves, does not fight permanent redirects, and matches the resource you intend.

### Test on mobile

Resize the viewport or use a phone: the page should remain readable and navigable.

### Check structured data

Use appropriate validators when you publish structured data. A green test does not guarantee a rich result in any search product.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Same title on every page | Pages are hard to tell apart in tabs and results. | Give each document a distinct, accurate `<title>`. |
| Misleading meta descriptions | Trust erodes when the snippet does not match the page. | Summarize the actual content. |
| Keyword stuffing | Text becomes less useful to people and easier to discount. | Write for clarity; repeat terms only when natural. |
| Canonical to a missing or unrelated URL | Duplicate signals become confusing or useless. | Point at the live preferred resource. |
| Conflicting HTTP and HTTPS canonicals | Engines receive mixed preferences. | Pick one preferred origin and redirect consistently. |
| Blocking important pages in `robots.txt` | Crawlers may never fetch pages you want discovered. | Allow paths you intend to be crawled. |
| Using `noindex` without understanding it | Pages may disappear from indexes unexpectedly. | Apply `noindex` only where exclusion is intentional. |
| Expecting a sitemap to guarantee indexing | Frustration when listed URLs stay unindexed. | Treat sitemaps as hints, not contracts. |
| JavaScript-only navigation | Crawlers and some users never see the links. | Use real `<a href>` navigation. |
| Essential content behind authentication | Public discovery systems cannot reach it. | Publish public copies when discovery is desired. |
| Incorrect dates | Chronology and freshness signals become unreliable. | Use accurate `<time datetime>` and metadata. |
| Broken internal links | Discovery paths dead-end. | Fix or remove broken links; redirect moved URLs. |
| Structured data that does not match visible content | Validators may pass while humans are misled. | Describe only what the page actually presents. |
| Assuming search indexing equals Joshternet discovery | Expectations diverge across systems. | Treat each discovery surface as separate. |

## Continue through the handbook

SEO fundamentals help systems recognize and reach your pages. Specialized chapters go deeper on the formats and policies introduced here:

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})
- [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Robots]({{ '/implement/content/robots/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }})
- [Schema.org]({{ '/implement/content/schema-org/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Semantic HTML; next: Slash pages).

## Specifications and references

Formal specifications:

- [HTML Living Standard](https://html.spec.whatwg.org/) — Document metadata and semantics.
- [RFC 6596](https://www.rfc-editor.org/rfc/rfc6596) — The `canonical` link relation.
- [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) — Web Linking.
- [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) — Robots Exclusion Protocol.
- [Sitemaps protocol](https://www.sitemaps.org/protocol.html) — XML sitemaps.

Vendor and practical guidance (not web standards):

- [Google Search Central SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google Search Central canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization)
- [Google Search Central titles and snippets](https://developers.google.com/search/docs/appearance/title-link)
- [web.dev Core Web Vitals](https://web.dev/articles/vitals)

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
