---
layout: default
title: "Links and Relations: The Connections That Make the Web Work"
description: >-
  Connect pages with ordinary hyperlinks and typed relations—canonical URLs,
  alternates, authorship, rel=me, licenses, HTTP Link headers, and IndieWeb
  patterns—using open Web Linking without confusing destination with meaning.
keywords: >-
  Web Linking, RFC 8288, rel, canonical, alternate, rel=me, HTTP Link,
  blogroll, independent web, hyperlinks
permalink: /implement/content/links/
nav_title: Links
content_id: links
matrix_id: links
seo:
  type: TechArticle
  name: Links and relations
---

# Links

A website becomes part of the wider web through its connections to other resources. A link can lead someone to another article, name an author, expose a feed, point at a license, or connect a personal site to another profile.

An ordinary hyperlink establishes a navigable destination. A **link relation** can add meaning: how the current resource relates to that target. Open linking conventions let independently operated sites exchange useful information without sharing the same CMS or a central platform.

A link alone does not prove endorsement, friendship, ownership, or verified identity. Destination and meaning remain separate.

## How links became the foundation of the web

Hyperlinks and URLs made the World Wide Web a web of resources rather than isolated documents. HTML grew `<a>` anchors for people to follow and `<link>` elements for document-level relationships. Applications needed shared conventions to tell an author link from a license, an alternate representation, or a preferred URL.

[RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) (October 2017) is the current Web Linking framework. The [IANA Link Relation Types Registry](https://www.iana.org/assignments/link-relations/) catalogs registered relation names. HTML, search engines, feed readers, and IndieWeb communities add processing rules and conventions on top. Formal specifications, community conventions, and vendor-specific guidance are not the same thing.

## What a link actually describes

RFC 8288 describes four conceptual pieces:

1. **Link context** — the resource from which the relationship is asserted.
2. **Relation type** — the meaning of the connection.
3. **Link target** — the resource being referenced.
4. **Target attributes** — optional extra information about the link or target.

```text
Article
   |
   | relation: author
   |
   v
Author profile
```

The arrow has a direction: the article asserts authorship toward the profile. The same target URL can participate in different relationships in other contexts. A relation is a statement by a publisher or other source of link metadata—not necessarily an independently verified fact.

<ol class="content-discovery-flow" aria-label="How typed links support discovery">
  <li>
    <strong>Publish</strong>
    <span>You connect resources with hrefs and optional relation types.</span>
  </li>
  <li>
    <strong>Advertise</strong>
    <span>HTML, HTTP Link headers, or both expose those relationships.</span>
  </li>
  <li>
    <strong>Resolve</strong>
    <span>Consumers resolve relative targets against the correct base.</span>
  </li>
  <li>
    <strong>Interpret</strong>
    <span>They apply registered, HTML, or convention-specific semantics.</span>
  </li>
  <li>
    <strong>Act</strong>
    <span>They may navigate, discover feeds, prefer a canonical URL, or verify identity.</span>
  </li>
</ol>

## Start with links people can follow

```html
<a href="/notes/">Read my notes</a>
```

Browsers resolve relative URLs against the document’s base URL. Use absolute URLs when you need a stable external target; root-relative (`/notes/`) and document-relative paths for same-site navigation; fragments for in-page targets; query strings when the server expects them. Prefer HTTPS for web resources. `mailto:` and `tel:` are valid schemes for contact; downloadable files need real URLs and honest link text.

Meaningful link text helps people and assistive technologies. Script-only “navigation” without a real `href` is less interoperable than ordinary anchors. Not every hyperlink needs a `rel` attribute.

## The HTML link element

`<a>` creates navigable hyperlinks in content. `<link>` commonly expresses document-level relationships and references external resources, usually in `<head>`:

```html
<link
  rel="canonical"
  href="https://joshua.example/notes/lab/"
>
```

Attributes such as `rel`, `href`, `type`, `hreflang`, `media`, `title`, `sizes`, `crossorigin`, `as`, `imagesrcset`, and `imagesizes` apply depending on the link type—not every attribute belongs on every relation.

| Mechanism | Typical role |
| --- | --- |
| `<a href>` | Human-navigable links in content |
| `<link>` | Document metadata and resource relationships |
| HTTP `Link` | Relationships carried in response headers |

## Tell applications what the link means

`rel` names one or more relation types, separated by ASCII whitespace. Matching of registered tokens is case-insensitive.

```html
<a href="https://joshua.example/about/" rel="author">About the author</a>
```

```html
<a href="https://profiles.joshua.example/avery/" rel="me external">
  My other profile
</a>
```

Each token is interpreted independently. Registered names, HTML-defined processing, and URI-based extension relations (RFC 8288) differ from inventing a short token that nothing understands. Relation types are not MIME types (`type` is separate).

## Registered and extension link relations

The IANA registry documents shared relation names so applications can agree on meaning. Common registered examples include `alternate`, `author`, `bookmark`, `canonical`, `describedby`, `help`, `icon`, `license`, `me`, `next`, `prev`, `search`, and `self`. Verify names against the live registry before treating a token as standardized.

Extension relation types use URI identifiers when a short name is not registered. Community conventions such as `rel="blogroll"` may be useful without being IANA-registered—label them accurately. Registration generally needs a stable, publicly available specification.

## Identify the preferred version of a resource

The `canonical` relation ([RFC 6596](https://www.rfc-editor.org/rfc/rfc6596)) names a preferred URL when several addresses reach the same or overlapping content: HTTP vs HTTPS, www vs bare host, tracking parameters, trailing-slash variants, duplicate routes, print views, or migrated paths.

```html
<link
  rel="canonical"
  href="https://joshua.example/notes/lab/"
>
```

Self-referencing canonicals are common and useful when the preferred URL is the current page. Align canonical declarations with permanent redirects, Open Graph URLs, feeds, and [sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}) where practical. Avoid chains of conflicting canonicals and broken targets. A canonical declaration communicates preference; consumers are not required to adopt it. Canonicalization is not a redirect and does not move visitors by itself. See [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }}).

## Canonical links in HTTP headers

Non-HTML resources can advertise a preferred URL with an HTTP `Link` header (subject to consumer support):

```http
Link: <https://joshua.example/docs/guide/>; rel="canonical"
```

Useful for PDFs and generated representations. Verify support rather than assuming every crawler treats HTTP canonicals like HTML `<link rel="canonical">`.

## One resource, different ways to read it

`alternate` points at another representation of the same or closely related resource: feeds, languages, media types, or alternate page forms.

```html
<link
  rel="alternate"
  type="application/atom+xml"
  title="Harbor Notes feed"
  href="https://joshua.example/atom.xml"
>
```

`rel`, `type`, `title`, and `href` work together for feed autodiscovery. A MIME hint helps consumers; the actual HTTP response type still matters. See [Feeds]({{ '/implement/content/feeds/' | relative_url }}).

## Connect translations and language alternatives

```html
<link
  rel="alternate"
  hreflang="en"
  href="https://joshua.example/en/notes/lab/"
>
<link
  rel="alternate"
  hreflang="de"
  href="https://joshua.example/de/notes/lab/"
>
```

Use [BCP 47](https://www.rfc-editor.org/rfc/rfc5646) language tags. Prefer reciprocal alternates, self-references, and `x-default` where your consumers expect them. Each language version usually keeps its own canonical. HTML `lang` on the page is not the same as alternate-link metadata. Search engines may impose more specific rules than general Web Linking; `hreflang` does not force a particular result to appear. Sitemap multilingual annotations are complementary—see the Sitemaps chapter.

## Authorship and attribution

```html
<a rel="author" href="https://joshua.example/about/">Avery Example</a>
```

Author, creator, publisher, contributor, copyright holder, and website owner are different roles. Microformats2 and Schema.org can express related facts in content. Links are publisher declarations—not independent proof of authorship or legal ownership.

## Connect the places where you exist online

`rel="me"` comes from XFN and IndieWeb identity practice. The publisher asserts that the target is another representation of the same person or entity:

```html
<a rel="me" href="https://profiles.joshua.example/avery/">My other profile</a>
```

Supporting services often require **reciprocal** links before treating the claim as verified. A one-way link alone does not establish ownership. Personal domains, social profiles, IndieAuth flows, and link-based checks have limits. `rel="me"` is not `rel="author"`. Neither establishes Josh identity or Joshternet participation. See [Identity and authorship]({{ '/implement/content/identity/' | relative_url }}).

## Tell readers how your work may be reused

```html
<link
  rel="license"
  href="https://creativecommons.org/licenses/by/4.0/"
>
```

Licenses may be sitewide or per work. Software licenses, Creative Commons deeds, and media-specific terms differ. A license link should match the rights you intend to grant; linking to a license does not grant rights you do not have. A license URL is not merely a copyright notice.

## Navigation relationships

Relations such as `next`, `prev`, `first`, `last`, `contents`, `bookmark`, and (where defined) `up` help machines and people move through series, archives, and book-like collections. They differ from unrelated cross-links. Consumers may ignore them. Pagination relations do not automatically consolidate search indexing. Pair with feeds when you announce updates.

## Links don't have to live inside HTML

RFC 8288 serializes relationships in the HTTP `Link` header:

```http
Link: <https://joshua.example/feed.xml>; rel="alternate"; type="application/atom+xml"
```

Targets appear in angle brackets; parameters are semicolon-separated; `rel` is required. Optional parameters include `anchor`, `hreflang`, `type`, `media`, `title`, and `title*`. The `anchor` parameter changes the link context—do not ignore it when present. Relative URI resolution for Link headers follows Web Linking rules and is not identical to HTML `<base>` behavior. HTML and HTTP may carry equivalent relationships; consumers need not process every representation the same way.

## Multiple HTTP Link values and parsing

One `Link` field may contain several link-values separated by commas. Multiple `Link` header lines may also appear. Commas inside quoted parameter values are not separators. Naïve “split on every comma or semicolon” parsers break on titles and encoded parameters. Watch URI-references, quoting, multiple relation names, duplicate parameters, `title*` ([RFC 8187](https://www.rfc-editor.org/rfc/rfc8187)), unknown parameters, and relative targets. Prefer a real Link-header parser over ad hoc string splits.

## Resource hints and browser processing

Relations such as `preload`, `modulepreload`, `preconnect`, `dns-prefetch`, `prefetch`, `stylesheet`, and `icon` primarily guide loading and presentation. They are not substitutes for semantic discovery relations. Unnecessary preload or preconnect can hurt performance. Follow the [HTML Living Standard](https://html.spec.whatwg.org/multipage/links.html) and related Fetch/preload specs—do not sprinkle hints merely to look “machine-readable.”

## Link safely to other websites

`target="_blank"` opens a new browsing context. Use `rel="noopener"` (and understand current browser defaults) so the new page cannot manipulate `window.opener`. `rel="noreferrer"` affects referrer disclosure and opener behavior. `rel="opener"` explicitly allows the opposite where needed. Referrer policies further control what destinations learn about the source URL. New-tab links do not authenticate or vouch for the target. Be careful with untrusted user-generated URLs and exotic schemes.

## Nofollow, sponsored and user-generated links

Search engines document outbound-link qualifications such as `nofollow`, `sponsored`, and `ugc` for paid placements, affiliates, ads, comments, and forums. Treat them as consumer-specific **hints**, not authentication or a universal crawl ban. Do not slap `nofollow` on every external editorial link by reflex. See [Google’s outbound-link guidance](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) and HTML link types.

## Share the websites you enjoy

Blogrolls help people discover independent publishers. An HTML list of recommended sites with short descriptions is enough for humans. Machine-readable OPML subscription lists and the modern `rel="blogroll"` convention advertise a blogroll document:

```html
<link
  rel="blogroll"
  type="text/x-opml"
  href="https://joshua.example/blogroll.opml"
>
```

`rel="blogroll"` is a **community convention** ([OPML blogroll](https://opml.org/blogroll.opml)); it is not an IANA-registered link relation as of this chapter’s verification date. An HTML blogroll, an OPML file, and a `/.well-known/slashpages` directory serve different jobs. Listing a site expresses the publisher’s choice—not reciprocity or mutual acquaintance. See [OPML]({{ '/implement/content/opml/' | relative_url }}) and [Connections]({{ '/implement/content/connections/' | relative_url }}).

## Describe conversations across websites

Independent publishers reply, repost, like, syndicate, cite, and credit work across origins. Microformats2 uses property classes such as `u-in-reply-to`, `u-repost-of`, `u-like-of`, and `u-syndication`—these are **not** automatically IANA HTML `rel` tokens.

```html
<article class="h-entry">
  <p class="p-name">Thanks for the pier notes</p>
  <a class="u-in-reply-to" href="https://other.example/notes/pier/">
    Original note
  </a>
  <div class="e-content">
    <p>The tide timing tip helped.</p>
  </div>
</article>
```

[Webmention](https://www.w3.org/TR/webmention/) notifies a target that a source linked to it; the receiver must verify the source document. A reply link does not notify by itself. See [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}).

## Links and the IndieWeb

Independent domains, stable article URLs, profile links, blogrolls, replies, Webmentions, syndication, attribution, and webrings all rely on ordinary linking plus typed relationships. Each site remains responsible for its own content. Observed links, declared relations, and verified reciprocal relationships are different levels of evidence.

## Link relations and structured metadata

| Technology | Role |
| --- | --- |
| Ordinary hyperlinks | Connect navigable resources |
| HTML `rel` | Describe relationships and some processing behavior |
| HTTP `Link` | Express relationships in HTTP metadata |
| Microformats2 | Structured content and interactions |
| Schema.org | Entities and properties |
| Open Graph | Object represented by a page |
| RSS / Atom / JSON Feed | Distribute entries |
| OPML | Outlines and subscription collections |
| XML sitemaps | Advertise resource URLs |

These can point at the same URLs while carrying different information. Prefer consistent identifiers across canonical, author, feed, Open Graph, and Microformats2 markup on one article.

## Complete implementation example

Harbor Notes wants: navigation people can follow, an About page, a stable article permalink, canonical and feed discovery, author and license links, a `rel=me` profile, a blogroll document, a citation to another writer, an optional reply, and an equivalent HTTP Link example.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Notes from the lab — Harbor Notes</title>
    <link rel="canonical" href="https://joshua.example/notes/lab/">
    <link
      rel="alternate"
      type="application/atom+xml"
      title="Harbor Notes"
      href="https://joshua.example/atom.xml"
    >
    <link
      rel="license"
      href="https://creativecommons.org/licenses/by/4.0/"
    >
    <link
      rel="blogroll"
      type="text/x-opml"
      href="https://joshua.example/blogroll.opml"
    >
    <link rel="me" href="https://profiles.joshua.example/avery/">
  </head>
  <body>
    <header>
      <a href="https://joshua.example/">Harbor Notes</a>
      <nav>
        <a href="https://joshua.example/notes/">Notes</a>
        <a href="https://joshua.example/about/">About</a>
      </nav>
    </header>
    <article class="h-entry">
      <h1 class="p-name">Notes from the lab</h1>
      <p>
        By
        <a class="p-author h-card" rel="author" href="https://joshua.example/about/">
          Avery Example
        </a>
      </p>
      <div class="e-content">
        <p>
          Building on
          <a href="https://other.example/essays/tides/">Tide tables</a>.
        </p>
      </div>
    </article>
  </body>
</html>
```

Equivalent feed discovery via HTTP (illustrative):

```http
Link: <https://joshua.example/atom.xml>; rel="alternate"; type="application/atom+xml"; title="Harbor Notes"
```

Each relationship has a different job: canonical prefers one URL; alternate exposes the feed; author and license describe people and terms; `me` asserts identity elsewhere; blogroll lists recommended sites; the citation is an ordinary hyperlink unless you add further structured markup.

## Links in static-site generators and CMS platforms

Handwritten HTML, Jekyll, Hugo, Eleventy, WordPress, and custom apps can emit consistent `<link>` and `<a rel>` markup from templates. Prefer absolute canonical and feed URLs in production. Shared templates reduce contradictory metadata across pages. Relative links are fine for in-site navigation when the base URL is correct.

## Help your links survive website changes

Stable permalinks keep inbound references alive. Domain migrations need redirects, updated canonicals, corrected internal links, and feed identity continuity. Broken-link checks and honest 404 or 410 responses help. Replacing a popular URL without a redirect breaks other people’s citations. A canonical link does not redirect visitors—configure HTTP redirects when the location actually moved.

**Migration checklist:** inventory permalinks → map old→new → set permanent redirects → update canonicals and sitemaps → verify feeds → spot-check inbound URLs.

## Internationalization and URL handling

URIs ([RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)) and IRIs ([RFC 3987](https://www.rfc-editor.org/rfc/rfc3987)) interact with percent-encoding, internationalized domain names, and Unicode path segments. Relative resolution, HTML `<base>`, and Link-header serialization have different rules—do not mix them casually. Relation **names** are separate from human-readable link text; keep the publisher’s language in visible labels when that is the authentic presentation.

## Security, privacy and trust

Untrusted targets, open redirects, unsafe schemes, `javascript:` URLs, credentials in URLs, sensitive query strings, referrer leakage, user-generated links, spoofed identity claims, misleading canonicals, and false relationship metadata all create risk. Consumers that fetch arbitrary destinations need SSRF protections. Ordinary links do not authorize access to private resources. Do not treat link metadata as proof of an external fact without verification.

## Links and the Joshternet

Ordinary links, blogrolls, and explicit web relationships help people discover other independent sites. A homepage link, a content citation, a blogroll entry, a reply, a syndicated copy, and a verified identity relationship are different signals. Two sites mentioning the same topic does not create a friendship edge.

Joshternet’s hub observes a **subset** of HTML relationships among participants—not full RFC 8288. It uses outbound `<a>` bridges (with selected reply/repost/syndication/credit tokens), HTML `rel="canonical"` for crawl hygiene, feed `rel="alternate"` discovery, `rel="me"` for Elsewhere profiles (not Josh identity or Connections edges), and blogroll documents advertised as `<link rel="blogroll" type="text/xml" href="…">` (caps apply). It does not parse HTTP `Link` headers, does not implement every IANA relation, and does not treat `nofollow` as suppressing observed bridges. Participation still requires only `/.well-known/josh`. Details: [Connections]({{ '/implement/content/connections/' | relative_url }}), [Identity]({{ '/implement/content/identity/' | relative_url }}), [Reference]({{ '/implement/content/reference/' | relative_url }}).

## Verify that your links say what you intend

1. Validate HTML ([Nu HTML Checker](https://validator.w3.org/nu/)).
2. Resolve destinations and confirm they match intent.
3. Compare canonical declarations with redirects and the live URL.
4. Check feed alternate URL, MIME type, and format.
5. Test reciprocal `rel=me` before claiming verification.
6. Confirm license URLs match the work.
7. Inspect HTTP Link headers with `curl -I` / `curl -i`.
8. Verify `hreflang` reciprocity and language tags.
9. Check reply/repost/syndication markup against the actual content.
10. Review new-tab safety and untrusted destinations.
11. After migrations, test redirects and updated canonicals.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Empty or vague destinations | Broken navigation | Real `href`s and clear text |
| Script-only navigation | Poor interoperability | Prefer real anchors |
| Bad relative URLs | Wrong targets | Check base URL and paths |
| Broken fragments / encoding | Dead jumps | Valid fragments and percent-encoding |
| Missing or conflicting canonicals | Duplicate confusion | One preferred absolute URL |
| Canonical to missing page | Wasted trust | Point at a live preferred URL |
| Treating canonical as redirect | Visitors stay put | Configure HTTP redirects separately |
| Wrong `rel` separators | Tokens misparsed | ASCII whitespace between tokens |
| Invented “standard” relations | False confidence | Check IANA / HTML / label conventions |
| Confusing rel with MIME type | Wrong discovery | Use `type` for media types |
| Weak feed autodiscovery | Feeds missed | `alternate` + feed MIME + href |
| Bad language tags / non-reciprocal hreflang | Weak language signals | BCP 47 + reciprocal sets |
| One-way `rel=me` as “verified” | False ownership | Reciprocal checks where required |
| `author` as identity proof | Wrong claim | Separate authorship from `me` |
| Inbound links as ownership | Spoof risk | Control your origin’s outbound claims |
| Treating `blogroll` as IANA-registered | Mislabeling | Call it a community convention |
| mf2 classes as HTML `rel` | Spec confusion | Keep Microformats2 properties distinct |
| Naïve Link-header splits | Parse bugs | Honor quoting and RFC 8288 |
| Ignoring `anchor` | Wrong context | Apply anchor when present |
| Hint spam (preload everywhere) | Worse performance | Hint only measured needs |
| Blanket `nofollow` | Pointless dilution | Use qualifications where they apply |
| Unsafe untrusted links | Tabnabbing / leakage | noopener, policy, sanitization |
| Assuming new tabs imply trust | False safety | Judge destinations separately |
| Broken URLs after migration | Lost citations | Redirects + updated metadata |
| Secrets in query strings | Leakage | Keep tokens out of public links |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [XML Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Identity and authorship]({{ '/implement/content/identity/' | relative_url }})
- [Connections]({{ '/implement/content/connections/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Robots; next: Identity and authorship).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) | Web Linking |
| [IANA Link Relation Types](https://www.iana.org/assignments/link-relations/) | Registered relations |
| [HTML links](https://html.spec.whatwg.org/multipage/links.html) | HTML link processing |
| [HTML `link` element](https://html.spec.whatwg.org/multipage/semantics.html#the-link-element) | Document-level links |
| [RFC 6596](https://www.rfc-editor.org/rfc/rfc6596) | Canonical link relation |
| [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) | URI syntax |
| [RFC 3987](https://www.rfc-editor.org/rfc/rfc3987) | IRIs |
| [RFC 5646](https://www.rfc-editor.org/rfc/rfc5646) | Language tags |
| [RFC 8187](https://www.rfc-editor.org/rfc/rfc8187) | Encoded parameter values |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | HTTP semantics |
| [IndieWeb rel=me](https://indieweb.org/rel-me) | Identity linking practice |
| [Microformats rel=me](https://microformats.org/wiki/rel-me) | rel=me definition |
| [OPML blogroll](https://opml.org/blogroll.opml) | Blogroll convention |
| [Microformats2](https://microformats.org/wiki/microformats2) | Structured HTML properties |
| [Webmention](https://www.w3.org/TR/webmention/) | Link notification protocol |
| [Google: canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | Vendor guidance |
| [Google: outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) | Vendor qualifications |
| [Nu HTML Checker](https://validator.w3.org/nu/) | HTML validation |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
