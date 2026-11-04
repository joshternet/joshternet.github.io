---
layout: default
title: "Validation and Troubleshooting: Make Sure Your Website Works"
description: >-
  Check that your pages, metadata, feeds, sitemaps, and web interactions work—
  syntax, meaning, delivery, and interoperability—with practical tools and
  troubleshooting steps.
keywords: >-
  HTML validation, feeds, sitemaps, robots.txt, Microformats2, Schema.org,
  Open Graph, troubleshooting, independent web
permalink: /implement/content/validation/
nav_title: Validation
content_id: validation
matrix_id: validation
seo:
  type: TechArticle
  name: Validation
---

# Validation

Publishing a webpage is only the beginning. The page must be reachable, its content must be understandable, and its metadata should accurately represent what you intended. Some problems are obvious—broken links or missing images. Others hide until you look past the rendered browser view: an incorrect canonical URL, malformed JSON-LD, an invalid feed date, or a `robots.txt` rule that blocks the crawler you meant to allow.

Validation examines both the technical representation and the published behavior. Automated tools help, but they cannot decide whether every claim, category, date, or author attribution is correct. Check the boring delivery issues first—robots, MIME types, and 404s—before blaming a crawler or directory.

## What does it mean for a website to work?

| Level | Question | Example |
| --- | --- | --- |
| Syntax | Is the format written correctly? | Valid HTML, XML, or JSON |
| Semantics | Does the information mean what you intend? | An Event date matches the real gathering |
| Delivery | Can a client retrieve the resource correctly? | HTTP 200 and the appropriate content type |
| Interoperability | Can compatible consumers use the information? | A feed reader shows entries without duplicates |

A resource may pass one level and fail another. Valid JSON-LD can name the wrong author. A valid RSS document can be unreachable. A well-formed sitemap can list URLs that no longer exist. Use this framework throughout troubleshooting.

<ol class="content-discovery-flow" aria-label="Validate then troubleshoot">
  <li>
    <strong>Delivery</strong>
    <span>Confirm HTTP status, redirects, and content types for the live URL.</span>
  </li>
  <li>
    <strong>Structure</strong>
    <span>Validate HTML and accessible document shape.</span>
  </li>
  <li>
    <strong>Metadata</strong>
    <span>Check titles, canonicals, Open Graph, Microformats2, and Schema.org.</span>
  </li>
  <li>
    <strong>Syndication</strong>
    <span>Validate feeds, autodiscovery, sitemaps, and robots rules.</span>
  </li>
  <li>
    <strong>Identity</strong>
    <span>Verify links, rel=me, and optional protocols when you implement them.</span>
  </li>
  <li>
    <strong>Interpret</strong>
    <span>Separate errors, warnings, and vendor-specific advice.</span>
  </li>
</ol>

## Test what visitors actually receive

Source Markdown, templates, or local JSON can be valid while the deployed site differs because of rendering, deployment, or caching. Check the **published** URL: HTTP status, redirects, content type, HTML source, title, visible content, canonical URL, navigation, and linked resources.

Use View Source and Developer Tools. JavaScript-rendered content may differ from the HTML the server delivered—many crawlers see only the response body.

## Build a small testing toolkit

| Tool | Useful for | Does not prove |
| --- | --- | --- |
| Browser + DevTools | Live page, network, console | Every consumer’s parser |
| `curl` | Status, headers, bodies | Semantic accuracy |
| [Nu HTML Checker](https://validator.w3.org/nu/) | HTML syntax/structure | Accessibility or truth |
| [pin13 mf2](https://pin13.net/mf2/) | Microformats2 parse tree | Every app’s vocabulary support |
| [Schema.org validator](https://validator.schema.org/) | Schema.org / JSON-LD | Rich-result eligibility |
| [Rich Results Test](https://search.google.com/test/rich-results) | Google feature eligibility | Ranking or Schema.org completeness |
| [Feed validator](https://validator.w3.org/feed/) | RSS / Atom | JSON Feed |
| XML / JSON parsers | Well-formed documents | Spec conformance beyond syntax |
| Lighthouse / a11y tools | Some perf and a11y issues | Full WCAG conformance |

Start with the browser and `curl`. Add specialized validators as needed—do not install a lab full of apps for a small personal site.

## Check whether the resource is actually available

```sh
curl -i https://joshua.example/about/
```

Inspect status, headers, and body. Common statuses: **200** OK; **301** / **308** permanent redirects; **302** / **307** temporary; **304** Not Modified; **401** / **403** auth; **404** Not Found; **410** Gone; **429** rate limit; **500** / **503** server errors.

Follow the redirect chain:

```sh
curl -IL https://joshua.example/about/
```

HEAD may differ from GET on some servers—use GET when inspecting the delivered resource. Watch HTTPS certificate errors, content negotiation, and caching.

## Inspect the complete redirect chain

HTTP→HTTPS, host canonicalization, trailing slashes, migrated paths, temporary vs permanent redirects, loops, cross-domain hops, and surprising destinations all affect discovery. Clients may stop after unusually long chains. A redirect is not the same as an HTML canonical declaration. Prefer stable permanent URLs and short chains.

## Check the document structure

Validate a public URL or pasted HTML with the [Nu HTML Checker](https://validator.w3.org/nu/). Typical findings: invalid nesting, missing attributes, duplicate IDs, wrong element placement, bad attribute values, malformed metadata. A sample message such as “Element `p` not allowed as child of element `ul`” usually means a list item was omitted—fix nesting, revalidate. Passing Nu does not prove accuracy, accessibility, or universal interoperability. For automation, see the [standalone checker docs](https://validator.github.io/).

## Validate semantic HTML and accessibility

HTML validity is not accessibility certification. Check heading structure, landmarks, navigation, descriptive links, image alternative text, labeled forms, keyboard navigation, focus indication, contrast, responsive layouts, language metadata, and captions/transcripts. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [WAI evaluation tools](https://www.w3.org/WAI/test-evaluate/tools/) help; automated tools miss many issues—also test with keyboard and a screen reader. See [Semantic HTML]({{ '/implement/content/html/' | relative_url }}) and [Creative media]({{ '/implement/content/media/' | relative_url }}).

**Manual spot-check:** Tab through the page; confirm focus is visible; every control is reachable; images have useful alt (or empty alt when decorative); headings outline the document.

## Check what the page says about itself

Verify HTML title, meta description, `lang`, canonical URL, Open Graph properties, author information, publication and modification dates, and feed autodiscovery links. Compare declarations with the visible page—generic site metadata pasted onto every article is a common failure. One wrong canonical can confuse multiple discovery systems.

```html
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Building a Small Website — Harbor Notes</title>
    <meta
      name="description"
      content="Notes on publishing a small independent website."
    />
    <link rel="canonical" href="https://joshua.example/notes/small-website/" />
    <link
      rel="alternate"
      type="application/feed+json"
      href="https://joshua.example/feed.json"
      title="Harbor Notes"
    />
  </head>
</html>
```

## Validate canonical URLs

Check self-referencing canonicals, duplicate URL variants, redirect destinations, cross-domain canonicalization, links to missing pages, HTTP `Link` headers, HTML `rel=canonical`, Open Graph `og:url`, feed entry URLs, and sitemap `loc` values. A classic bug: every article’s canonical points at the homepage—fix it so each resource names itself. Canonicals express a preference; consumers are not forced to obey them. See [SEO]({{ '/implement/content/seo/' | relative_url }}) and [Links]({{ '/implement/content/links/' | relative_url }}).

## See what a Microformats2 parser sees

Submit published HTML or a sample to [pin13.net/mf2](https://pin13.net/mf2/). Compare root `h-*` objects, property names, arrays, nested objects, implied properties, URL resolution, dates, and content values with your intent.

```html
<article class="h-entry">
  <h1 class="p-name">Building a Small Website</h1>
  <a class="u-url" href="https://joshua.example/notes/small-website/">
    Permalink
  </a>
  <time class="dt-published" datetime="2026-10-15">Oct. 15, 2026</time>
  <p class="p-author h-card">
    <a class="p-name u-url" href="https://joshua.example/about/">
      Avery Example
    </a>
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
    "author": [
      {
        "type": ["h-card"],
        "properties": {
          "name": ["Avery Example"],
          "url": ["https://joshua.example/about/"]
        },
        "value": "Avery Example"
      }
    ],
    "content": [
      {
        "value": "A few notes about building an independent website.",
        "html": "<p>A few notes about building an independent website.</p>"
      }
    ]
  }
}
```

Different applications may support different vocabularies even when the core parser is conformant. See [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}).

## Troubleshoot common Microformats2 problems

Missing `h-entry`; `p-category` outside the intended object; bad `dt-published` values; missing or unstable `u-url`; incorrectly nested h-cards; mixing `p-*` and `u-*`; unexpected implied names; content that parses oddly; treating class names like HTML `rel`. Changing a class may not change the visible page—**parse**, do not rely on looks alone. Spec and tests: [microformats2-parsing](https://microformats.org/wiki/microformats2-parsing), [test suite](https://github.com/microformats/tests).

## Check how your page describes itself to other applications

Inspect raw HTML for `og:title`, `og:type`, `og:url`, `og:image`, `og:description`, `og:site_name`, image dimensions/alt, article metadata, and property ordering. Confirm images are public and return the expected media type. Platforms may cache stale previews. Protocol validity differs from any one app’s display. See [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}).

## Test preview images

```sh
curl -sI https://joshua.example/images/workspace.jpg
```

Check URL, status, content type, dimensions, aspect ratio, redirects, authentication, hotlink protection, and unsupported formats. An image that works while you are logged in may fail for an unauthenticated preview crawler. Do not expose private images. See [Creative media]({{ '/implement/content/media/' | relative_url }}).

## Validate Schema.org and JSON-LD

Use [validator.schema.org](https://validator.schema.org/). Check JSON syntax, `@context`, `@type`, `@id`, nesting, `@graph`, property names and types, relationships, and stable URLs.

**Broken:**

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Building a Small Website",
  "datePublished": "not-a-date"
}
```

**Corrected:** use an ISO-8601 date such as `"2026-10-15"` and a matching `url` / `@id`. Passing the validator does not prove the facts are true. Custom vocabularies and remote contexts may be out of scope. See [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}).

## Validate search-engine structured data

The [Rich Results Test](https://search.google.com/test/rich-results) answers a different question. Distinguish: (1) valid JSON, (2) valid JSON-LD, (3) valid Schema.org, (4) eligibility for a supported Google rich-result feature, (5) actual appearance in search. A valid Person or CreativeWork may not qualify for a particular enhancement. Google warnings are not automatically Schema.org errors. A green test is not a ranking guarantee.

## Make sure readers can subscribe

Validate RSS and Atom with the [W3C Feed Validation Service](https://validator.w3.org/feed/). Check feed URL, MIME type, required channel/feed metadata, stable entry identifiers, dates, permalinks, authors, categories, XML escaping, enclosures, and autodiscovery. Invalid dates or duplicate IDs confuse readers—fix the source and regenerate. See [Feeds]({{ '/implement/content/feeds/' | relative_url }}).

## Validate JSON Feed

JSON Feed is not covered by the RSS/Atom validator. Follow [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/): version, required top-level and item fields, stable IDs, URLs, dates, tags, attachments, content. Parse JSON syntax with any JSON tool; then check field requirements. Valid JSON alone is not JSON Feed conformance.

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Harbor Notes",
  "home_page_url": "https://joshua.example/",
  "feed_url": "https://joshua.example/feed.json",
  "items": [
    {
      "id": "https://joshua.example/notes/small-website/",
      "url": "https://joshua.example/notes/small-website/",
      "title": "Building a Small Website",
      "date_published": "2026-10-15T12:00:00-07:00"
    }
  ]
}
```

## Validate feed autodiscovery

```html
<link
  rel="alternate"
  type="application/rss+xml"
  href="https://joshua.example/feed.xml"
  title="Harbor Notes RSS"
/>
<link
  rel="alternate"
  type="application/atom+xml"
  href="https://joshua.example/atom.xml"
  title="Harbor Notes Atom"
/>
<link
  rel="alternate"
  type="application/feed+json"
  href="https://joshua.example/feed.json"
  title="Harbor Notes JSON"
/>
```

Verify `rel="alternate"`, MIME type, URL, useful title, and that the destination validates. Multiple feeds are fine; broken or duplicate discovery links confuse clients.

## Check the URLs you're advertising

Per the [Sitemap Protocol](https://www.sitemaps.org/protocol.html): XML declaration, UTF-8, sitemap namespace, `<urlset>`, `<url>`, `<loc>`, optional `<lastmod>`, escaping, absolute/canonical URLs, size and URL-count limits. Parse with an XML tool, then `curl -I` listed locations. Valid XML does not mean the pages are accessible or indexable. See [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}).

```sh
curl -s https://joshua.example/sitemap.xml | head
curl -I https://joshua.example/notes/small-website/
```

## Validate sitemap indexes and extensions

Check parent indexes, child sitemap URLs, missing children, duplicates, timestamps, and vendor extensions (image/video/news/hreflang). Validate the index and each referenced file. Bound automation—do not recurse forever. Label search-engine extensions as vendor guidance, not base protocol requirements.

## Check crawler access before troubleshooting discovery

Confirm `robots.txt` location, encoding, content type, user-agent groups, Allow/Disallow, path specificity, wildcards, end-of-path matching, redirects, missing files, errors, and caching ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309)). Test several paths and agents. Tools differ on extensions. See [Robots]({{ '/implement/content/robots/' | relative_url }}).

```text
User-agent: *
Allow: /
Disallow: /drafts/
```

Paths under `/drafts/` should be disallowed; `/notes/` should remain allowed for that group.

## Validate indexing directives separately

Inspect HTML robots meta, `X-Robots-Tag`, canonicals, HTTP status, and actual crawl access. Blocking a URL in `robots.txt` while expecting a crawler to read its `noindex` meta is a classic mistake—many crawlers never fetch the page. Optional: Google Search Console URL Inspection for verified owners (live vs already indexed). It is not a universal crawler validator.

## Validate AI-related directives

Standard robots rules, IETF AIPREF drafts, proposed Content-Usage fields, policy tokens, Content Signals, and vendor crawler policies are **not** all the same. An RFC 9309 checker may ignore experimental usage directives. Verify each preference against the draft or vendor that defines it. Syntactic correctness does not mean universal recognition or enforceability. Details: [Robots]({{ '/implement/content/robots/' | relative_url }}).

## Validate slash pages

Check public availability, canonicals, titles, useful content, navigation, `/slashes/` indexes, redirects, empty pages, and soft 404s. HTTP 200 with homepage content for every unknown path is not a meaningful resource—compare titles, headings, and canonicals. Path conventions are not standardized machine classifications. See [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}).

## Validate OPML and well-known slashpages

Follow [OPML 2.0](https://opml.org/spec2.opml): XML, `version="2.0"`, head/body/outline, required `text`, link types, URLs, categories, includes, MIME type, public access. The slash-page convention adds meaning on top of OPML ([well-known slashpages](https://github.com/pfefferle/well-known-slashpages)). Bound include recursion.

```sh
curl -i https://joshua.example/.well-known/slashpages
```

See [OPML]({{ '/implement/content/opml/' | relative_url }}).

## Validate links and identity relationships

Check ordinary hyperlinks, canonical/alternate/author/license links, feed discovery, `rel=me`, blogrolls, and reciprocal verification where claimed. An ordinary link is not friendship, ownership, or endorsement. Compatible `rel=me` verification checks both ends. Watch broken links, redirects, stale accounts, and migrations. See [Identity]({{ '/implement/content/identity/' | relative_url }}) and [Connections]({{ '/implement/content/connections/' | relative_url }}).

## Validate Webmention

Use [webmention.rocks](https://webmention.rocks/) for sender, endpoint discovery, receiver, source verification, update, and deletion tests. Discover endpoints via HTTP `Link` and HTML. Publish the source before a receiver can verify. Do **not** send test notifications to unrelated production endpoints without authorization. Accepting a POST is not the same as verified mention.

## Validate WebSub, Micropub and ActivityPub

Optional advanced protocols: [websub.rocks](https://websub.rocks/), [micropub.rocks](https://micropub.rocks/), and ActivityPub actor/ActivityStreams/inbox-outbox testing. Test roles separately. An ordinary site does not need these protocols to publish valid HTML, feeds, or structured metadata. See [Connections]({{ '/implement/content/connections/' | relative_url }}).

## Validate events, creative media, uses and topics

Events: HTML dates, h-event, Schema.org Event, locations, status, iCalendar UIDs, time zones, recurrence—syntax can pass while local time is wrong ([Events]({{ '/implement/content/events/' | relative_url }})). Media: work URLs vs files, alt text, MIME types, captions, Schema.org types, licensing ([Creative media]({{ '/implement/content/media/' | relative_url }})). Uses/topics: product and category accuracy—valid Product or `knowsAbout` does not prove ownership, expertise, or friendship ([Uses]({{ '/implement/content/uses/' | relative_url }}), [Explore]({{ '/implement/content/explore/' | relative_url }})).

## Make sure every format describes the same thing

For one Harbor Notes article, compare:

| Representation | Expected identity |
| --- | --- |
| Visible title / H1 | Building a Small Website |
| HTML `<title>` | Same article, site brand OK |
| Canonical | `https://joshua.example/notes/small-website/` |
| `og:url` | Same URL |
| h-entry `u-url` | Same URL |
| Schema.org `@id` / `url` | Same resource |
| Feed item link / id | Same stable ID |
| Sitemap `<loc>` | Same URL |

Titles may differ slightly in wording; conflicting identity or facts are problems.

## A website must keep working after the first publication

Test: publish → update → rename + redirect → update metadata/feed/sitemap → keep identity → archive/remove → rebuild without source changes. Regenerating a feed item with a new ID creates duplicates. Publication dates should not move on every build. External caches may lag.

## Browser and cross-platform testing

Try more than one browser or device for important paths. Check responsive layout, JS-disabled behavior, reduced motion, keyboard use, slow networks, caching, accessibility settings, and media format support. A small site does not need a device lab.

## Performance testing

Lab tools (Lighthouse, PageSpeed Insights) report load, LCP, INP, CLS, images, fonts, scripts, requests, and caching. Lab ≠ field; scores are not proof of content quality or discovery success.

## When something doesn't appear where you expect

**Cannot open the page** — DNS, HTTPS, status, redirects (`curl -IL`).

**Crawler cannot retrieve** — robots, auth, 5xx, access policy.

**Retrieved but not understood** — semantic HTML, visible text, structured metadata.

**Recognized incorrectly** — titles, categories, dates, types, canonicals.

**Missing from a feed** — generation, autodiscovery, IDs, publication state.

**Missing from a sitemap** — generation rules, canonicals, deploy.

**Wrong preview** — Open Graph, image URLs, platform cache.

**Missing Webmention** — discovery, delivery, verification, moderation.

**Absent from a third-party directory** — schedules, eligibility, caching, service limits—not every valid page will appear.

## Explain common validator errors

| Finding | Likely cause | Next step |
| --- | --- | --- |
| Invalid HTML nesting | Wrong parent/child | Fix structure; re-run Nu |
| Duplicate IDs | Copy-paste IDs | Make IDs unique |
| Invalid JSON | Trailing comma / quotes | Parse with a JSON tool |
| Bad JSON-LD type/property | Typo or wrong type | Check Schema.org docs |
| Missing OG image | No `og:image` or blocked URL | Fix URL; `curl -I` image |
| Invalid RSS date | Non-RFC822 date | Fix generator |
| Missing Atom `id` | No stable entry ID | Add permanent ID |
| Missing JSON Feed field | Incomplete item | Meet 1.1 required fields |
| Invalid XML entity | Unescaped `&` | Escape text |
| Wrong sitemap namespace | Typo in xmlns | Match protocol |
| Missing OPML `text` | Incomplete outline | Add required attribute |
| Unexpected robots block | Disallow too broad | Narrow rules; retest paths |
| Wrong canonical | Points to home/other | Self-canonical |
| Webmention: source lacks link | Target not in source | Publish correct link |
| Unsupported media type | Wrong Content-Type | Fix server headers |

Errors break requirements; warnings and infos need judgment. Validators label inconsistently—read the relevant spec.

## Errors, warnings and informational findings

**Error** — violates a format requirement or blocks intended behavior. **Warning** — optional, consumer-specific, or potentially problematic. **Informational** — useful observation. Do not rewrite valid content solely to clear every warning.

## Test local changes before deployment

Render locally; check generated HTML, internal links, feeds, XML, JSON, and canonical base URLs. Online validators often cannot reach `localhost`—paste markup or use local CLI tools. Do not expose private development environments publicly just to use a web validator.

## Add validation to the publishing workflow

Automate deterministic checks: HTML, JSON/XML parse, feed shape, internal links, schema where practical, broken images, stable IDs, date consistency, draft leakage. Keep fast local checks separate from broader production validation. Prefer checks that do not depend on fragile third-party APIs. This chapter does not require a new CI architecture.

## Joshternet repository validation

This repository’s maintainer scripts (not independent-site standards) include:

```sh
npm run format:check
npm run test
npm run test:coverage
npm run test:browser
npm run test:site
npm run nlp:validate
npm run build
```

`npm run validate` currently runs `format:check` then `test:coverage`. Passing unit tests does not prove every generated production page is correct. Do not run network sync or regenerate production datasets merely to validate a documentation-only edit.

## Joshternet-specific troubleshooting boundaries

If content is missing from a Joshternet view, first confirm a stable public URL, valid content, accurate dates, and appropriate links or feed metadata. Passing those checks still does **not** guarantee inclusion. Distinguish your site from hub indexing and display policies. Extraction matrices and crawler diagnostics live in [Reference]({{ '/implement/content/reference/' | relative_url }}). Participation still begins with `/.well-known/josh`; optional [declaration checker]({{ '/implement/validate/' | relative_url }}).

Quick delivery smoke (expand as needed):

```sh
curl -i https://joshua.example/.well-known/josh
curl -i https://joshua.example/robots.txt
curl -i https://joshua.example/feed.xml
curl -i https://joshua.example/.well-known/slashpages
```

## Validate safely

Third-party validators may receive the URL or document you submit. Avoid pasting private URLs, drafts, cookies, API keys, credentials, internal hostnames, personal contacts, private IPs, or other secrets. Prefer local validation for confidential material. Do not send unsolicited Webmention/WebSub test traffic to unrelated sites. Authorize active testing against third-party services.

## Make problems easier to reproduce

Report: resource URL; expected vs actual behavior; time observed; HTTP status; relevant headers; validation output; reproduction steps; browser/tool details; screenshots if useful; what you already tried. Omit secrets, cookies, and tokens from public reports.

## Complete end-to-end validation walkthrough

Harbor Notes (homepage, About, article, projects index, one project, JSON Feed, sitemap, robots.txt, optional slashpages OPML):

| Step | Check | Result |
| --- | --- | --- |
| 1 HTTP | `curl -IL` key URLs | 200 / short redirect chain |
| 2 HTML | Nu Checker | No errors (or fixed) |
| 3 Canonical | Self-referencing | Matches intended URL |
| 4 Metadata | title, description, OG | Match visible page |
| 5 Structured | mf2 + Schema.org | Parse / validate clean |
| 6 Feeds | JSON Feed fields + IDs | Stable IDs, dates |
| 7 Sitemap | `loc` vs HTTP | Listed pages respond |
| 8 Robots | Allow public paths | Drafts blocked only |
| 9 Accessibility | Keyboard + headings | Passable manual check |
| 10 Update | Edit article; refresh feed/sitemap | IDs stable; dates intentional |

No Joshternet infrastructure required for this walkthrough.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Testing templates only | Miss deploy bugs | Validate published URLs |
| 200 = useful content | Soft 404s | Compare title/canonical |
| Ignoring redirect chains | Wrong destination | `curl -IL` |
| HEAD-only HTTP tests | Miss body/MIME | Use GET when needed |
| Valid = accurate | Wrong facts ship | Review semantics |
| Nu = accessibility | Missed a11y bugs | Manual + WCAG tools |
| Contradictory canonicals | Split identity | One intended URL |
| Schema.org = rich results | False eligibility | Separate vendor tests |
| One validator for all vocabs | False confidence | Use the right tool |
| Fetch time as published | Wrong freshness | Store real dates |
| New IDs every build | Duplicate feed items | Stable identifiers |
| XML parse = full feed OK | Incomplete conformance | Spec + feed validator |
| Sitemap = indexed | False hope | Sitemap is a hint |
| robots.txt as security | Misplaced trust | Auth elsewhere |
| All AI agents same rules | Overclaim | Label draft/vendor |
| Webmention accept = verified | False mention | Check source link |
| Profile link = ownership | Weak identity | Verify rel=me both ways |
| Ignoring event time zones | Wrong local time | Offset / TZID checks |
| Media file = work page | Confused resources | Separate URLs |
| Secrets in validators | Data leak | Local / redact |
| Unauthorized active tests | Abuse | Get permission |
| Stale cache as live bug | Wrong fix | Re-check after purge |
| Chasing every info warning | Noise | Prioritize errors |
| Blame Joshternet first | Miss site bugs | Standards checks first |

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
- [Explore]({{ '/implement/content/explore/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Explore; next: Reference).

## Specifications and reference tools

| Reference | Authority |
| --- | --- |
| [HTML Living Standard](https://html.spec.whatwg.org/) | HTML |
| [Nu HTML Checker](https://validator.w3.org/nu/) | HTML validation |
| [Nu documentation](https://validator.github.io/) | Checker docs |
| [WAI evaluation tools](https://www.w3.org/WAI/test-evaluate/tools/) | Accessibility |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility |
| [Microformats2 parsing](https://microformats.org/wiki/microformats2-parsing) | Parsing |
| [pin13 mf2](https://pin13.net/mf2/) | mf2 tool |
| [mf2 test suite](https://github.com/microformats/tests) | Conformance |
| [Open Graph Protocol](https://ogp.me/) | Previews |
| [Schema.org](https://schema.org/) | Vocabulary |
| [Schema.org Markup Validator](https://validator.schema.org/) | Structured data |
| [Rich Results Test](https://search.google.com/test/rich-results) | Vendor guidance |
| [URL Inspection docs](https://support.google.com/webmasters/answer/9012289) | Vendor guidance |
| [Feed validator](https://validator.w3.org/feed/) | RSS/Atom |
| [RSS 2.0](https://www.rssboard.org/rss-specification) | RSS |
| [Atom (RFC 4287)](https://www.rfc-editor.org/rfc/rfc4287) | Atom |
| [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) | JSON Feed |
| [Sitemap Protocol](https://www.sitemaps.org/protocol.html) | Sitemaps |
| [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) | Robots |
| [OPML 2.0](https://opml.org/spec2.opml) | OPML |
| [Well-known slashpages](https://github.com/pfefferle/well-known-slashpages) | Convention |
| [Webmention](https://www.w3.org/TR/webmention/) | Mentions |
| [webmention.rocks](https://webmention.rocks/) | WM tests |
| [WebSub](https://www.w3.org/TR/websub/) | PubSubHubbub |
| [websub.rocks](https://websub.rocks/) | WebSub tests |
| [Micropub](https://www.w3.org/TR/micropub/) | Publishing API |
| [micropub.rocks](https://micropub.rocks/) | Micropub tests |
| [ActivityPub](https://www.w3.org/TR/activitypub/) | Federation |
| [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) | iCalendar |
| [Google Search Central](https://developers.google.com/search/docs) | Vendor guidance |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
