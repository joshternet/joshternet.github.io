---
layout: default
title: "Specifications and Reference: The Content Discovery Handbook"
description: >-
  Authoritative index of open-web publishing specifications, conventions,
  media types, and a verified Joshternet hub crawl support matrix—without
  treating partial extraction as full protocol support.
keywords: >-
  specifications, RFC, Schema.org, Microformats2, feeds, sitemaps, robots,
  IndieWeb, Joshternet support matrix
permalink: /implement/content/reference/
nav_title: Reference
content_id: reference
matrix_id: reference
seo:
  type: TechArticle
  name: Reference
---

# Reference

The open web is built from complementary specifications and conventions—not one universal content-publishing protocol. HTML describes documents. HTTP transfers resources. Feeds announce updates. Sitemaps advertise URLs. Structured data describes entities. Link relations explain relationships. Interaction protocols let independently operated websites communicate.

These mechanisms are maintained by different organizations and communities. Some are formal standards; others are community specifications, industry protocols, living vocabularies, or experimental proposals. This page is a technical index: find the authoritative source, understand what each mechanism requires, and see how Joshternet’s hub crawl relates—without confusing partial extraction with full conformance.

Using every specification is neither necessary nor expected.

<ol class="content-discovery-flow" aria-label="How to use this reference">
  <li>
    <strong>Identify</strong>
    <span>Name the publishing task you need to solve.</span>
  </li>
  <li>
    <strong>Authority</strong>
    <span>Open the primary specification or community document.</span>
  </li>
  <li>
    <strong>Requirements</strong>
    <span>Separate format-required, optional, and consumer-specific rules.</span>
  </li>
  <li>
    <strong>Validate</strong>
    <span>Check syntax and delivery with the Validation chapter’s tools.</span>
  </li>
  <li>
    <strong>Hub limits</strong>
    <span>If relevant, read the Joshternet matrix for crawl behavior—not the web.</span>
  </li>
</ol>

## Find the specification you need

1. [Web foundations](#web-foundations)
2. [Discovery and search](#discovery-and-search)
3. [Structured content](#structured-content)
4. [Feeds and syndication](#feeds-and-syndication)
5. [Identity and relationships](#identity-and-relationships)
6. [Creative media](#creative-media-and-accessibility)
7. [Events and calendars](#events-and-calendars)
8. [Slash-page conventions](#community-conventions)
9. [Crawler access and AI preferences](#ai-usage-preferences-and-emerging-proposals)
10. [Testing and validation](#validation-resources)
11. [Joshternet specifications and hub support](#joshternet-specifications)

## What kind of specification are you reading?

| Classification | Meaning |
| --- | --- |
| IETF RFC | Document in the RFC Series; status is stated by the RFC (not every RFC is an Internet Standard) |
| W3C Recommendation | Specification through the W3C Recommendation process |
| W3C Note | Informative W3C publication, not a Recommendation |
| Living Standard | Continuously revised specification (for example WHATWG HTML) |
| Community specification | Convention or spec developed by a community |
| Industry protocol | Widely deployed technical specification from an industry group |
| Vocabulary | Shared types and properties (for example Schema.org) |
| Internet-Draft | IETF work in progress—not a published RFC |
| Vendor-specific guidance | Rules for a particular product or search feature |
| Joshternet RFC | Project specification for Joshternet behavior |

A document’s acronym does not determine its authority. An Internet-Draft can be active without IETF consensus. A popular community path is not automatically IANA-registered.

## Normative terminology

[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) define **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL**. Normative sections state requirements; informative sections explain. Handbook tutorials may recommend practices that are not format requirements—do not confuse the two.

**Example:** Atom **MUST** include certain entry identifiers for conformance. Adding Open Graph tags is often useful for previews but is not required for a valid Atom feed.

## Authoritative specifications catalog

### Web foundations

| Specification | Purpose | Maintainer | Status | Source | Chapter |
| --- | --- | --- | --- | --- | --- |
| [HTML](https://html.spec.whatwg.org/) | Documents and media | WHATWG | Living Standard | html.spec.whatwg.org | [HTML]({{ '/implement/content/html/' | relative_url }}) |
| [URL](https://url.spec.whatwg.org/) | URL parsing | WHATWG | Living Standard | url.spec.whatwg.org | [SEO]({{ '/implement/content/seo/' | relative_url }}) |
| [Fetch](https://fetch.spec.whatwg.org/) | Fetching resources | WHATWG | Living Standard | fetch.spec.whatwg.org | [Validation]({{ '/implement/content/validation/' | relative_url }}) |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | HTTP semantics | IETF | RFC | rfc-editor.org | [Validation]({{ '/implement/content/validation/' | relative_url }}) |
| [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111) | HTTP caching | IETF | RFC | rfc-editor.org | [Validation]({{ '/implement/content/validation/' | relative_url }}) |
| [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) | URI syntax | IETF | RFC | rfc-editor.org | [Links]({{ '/implement/content/links/' | relative_url }}) |
| [RFC 3987](https://www.rfc-editor.org/rfc/rfc3987) | IRIs | IETF | RFC | rfc-editor.org | [Explore]({{ '/implement/content/explore/' | relative_url }}) |
| [XML 1.0](https://www.w3.org/TR/xml/) | Markup syntax | W3C | Recommendation | w3.org | [Feeds]({{ '/implement/content/feeds/' | relative_url }}) |
| [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) | JSON | IETF | RFC | rfc-editor.org | [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}) |
| [BCP 47](https://www.rfc-editor.org/info/bcp47) | Language tags | IETF | BCP | rfc-editor.org | [Explore]({{ '/implement/content/explore/' | relative_url }}) |
| [IANA media types](https://www.iana.org/assignments/media-types/) | MIME registry | IANA | Registry | iana.org | [Validation]({{ '/implement/content/validation/' | relative_url }}) |

### Structured content

| Specification | Purpose | Maintainer | Status | Source | Chapter |
| --- | --- | --- | --- | --- | --- |
| [Microformats2 parsing](https://microformats.org/wiki/microformats2-parsing) | Parse mf2 HTML | Microformats | Community | microformats.org | [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}) |
| [h-card](https://microformats.org/wiki/h-card) | People/orgs | Microformats | Community | microformats.org | [Identity]({{ '/implement/content/identity/' | relative_url }}) |
| [h-entry](https://microformats.org/wiki/h-entry) | Posts | Microformats | Community | microformats.org | [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}) |
| [h-feed](https://microformats.org/wiki/h-feed) | Feeds in HTML | Microformats | Community | microformats.org | [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}) |
| [h-event](https://microformats.org/wiki/h-event) | Events | Microformats | Community | microformats.org | [Events]({{ '/implement/content/events/' | relative_url }}) |
| [Open Graph](https://ogp.me/) | Link previews | Meta / community | Industry protocol | ogp.me | [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}) |
| [Schema.org](https://schema.org/) | Entity vocabulary | Schema.org | Living vocabulary | schema.org | [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}) |
| [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) | Linked data in JSON | W3C | Recommendation | w3.org | [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}) |
| [RDF 1.1 Concepts](https://www.w3.org/TR/rdf11-concepts/) | Graph data model | W3C | Recommendation | w3.org | [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}) |

### Discovery and search

| Specification | Purpose | Maintainer | Status | Source | Chapter |
| --- | --- | --- | --- | --- | --- |
| [Sitemap Protocol](https://www.sitemaps.org/protocol.html) | Advertise URLs | sitemaps.org | Industry protocol | sitemaps.org | [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}) |
| [RSS 2.0](https://www.rssboard.org/rss-specification) | Syndicated feeds | RSS Advisory Board | Industry protocol | rssboard.org | [Feeds]({{ '/implement/content/feeds/' | relative_url }}) |
| [Atom RFC 4287](https://www.rfc-editor.org/rfc/rfc4287) | Atom feeds | IETF | RFC | rfc-editor.org | [Feeds]({{ '/implement/content/feeds/' | relative_url }}) |
| [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) | JSON feeds | jsonfeed.org | Community | jsonfeed.org | [Feeds]({{ '/implement/content/feeds/' | relative_url }}) |
| [OPML 2.0](https://opml.org/spec2.opml) | Outline lists | OPML | Community / industry | opml.org | [OPML]({{ '/implement/content/opml/' | relative_url }}) |
| [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) | Web Linking | IETF | RFC | rfc-editor.org | [Links]({{ '/implement/content/links/' | relative_url }}) |
| [RFC 6596](https://www.rfc-editor.org/rfc/rfc6596) | Canonical Link Relation | IETF | RFC | rfc-editor.org | [SEO]({{ '/implement/content/seo/' | relative_url }}) |
| [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) | Robots Exclusion | IETF | RFC | rfc-editor.org | [Robots]({{ '/implement/content/robots/' | relative_url }}) |

### Independent-web interactions

| Specification | Purpose | Maintainer | Status | Source | Chapter |
| --- | --- | --- | --- | --- | --- |
| [Webmention](https://www.w3.org/TR/webmention/) | Link notifications | W3C | Recommendation | w3.org | [Connections]({{ '/implement/content/connections/' | relative_url }}) |
| [WebSub](https://www.w3.org/TR/websub/) | Topic update distribution | W3C | Recommendation (02 June 2026) | w3.org | [Connections]({{ '/implement/content/connections/' | relative_url }}) |
| [Micropub](https://www.w3.org/TR/micropub/) | Publishing API | W3C | Recommendation | w3.org | [Connections]({{ '/implement/content/connections/' | relative_url }}) |
| [IndieAuth](https://indieauth.spec.indieweb.org/) | Auth using web identity | IndieWeb | Living Standard | indieauth.spec.indieweb.org | [Identity]({{ '/implement/content/identity/' | relative_url }}) |
| [WebFinger RFC 7033](https://www.rfc-editor.org/rfc/rfc7033) | Account resource discovery | IETF | RFC | rfc-editor.org | [Identity]({{ '/implement/content/identity/' | relative_url }}) |
| [ActivityPub](https://www.w3.org/TR/activitypub/) | Federated social activities | W3C | Recommendation | w3.org | [Connections]({{ '/implement/content/connections/' | relative_url }}) |
| [ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) | Social activity vocabulary | W3C | Recommendation | w3.org | [Connections]({{ '/implement/content/connections/' | relative_url }}) |

### Creative publishing and events

| Specification | Purpose | Maintainer | Status | Source | Chapter |
| --- | --- | --- | --- | --- | --- |
| Schema.org creative types | Works vocabulary | Schema.org | Vocabulary | schema.org | [Creative media]({{ '/implement/content/media/' | relative_url }}) |
| HTML media elements | `img` / `audio` / `video` | WHATWG | Living Standard | html.spec.whatwg.org | [Creative media]({{ '/implement/content/media/' | relative_url }}) |
| [WebVTT](https://www.w3.org/TR/webvtt1/) | Captions/subtitles | W3C | Recommendation | w3.org | [Creative media]({{ '/implement/content/media/' | relative_url }}) |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility | W3C | Recommendation | w3.org | [Creative media]({{ '/implement/content/media/' | relative_url }}) |
| [IPTC Photo Metadata](https://www.iptc.org/standards/photo-metadata/) | Photo metadata | IPTC | Industry | iptc.org | [Creative media]({{ '/implement/content/media/' | relative_url }}) |
| [C2PA](https://c2pa.org/) | Content provenance | C2PA | Industry | c2pa.org | [Creative media]({{ '/implement/content/media/' | relative_url }}) |
| [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) | iCalendar | IETF | RFC | rfc-editor.org | [Events]({{ '/implement/content/events/' | relative_url }}) |
| [RFC 7986](https://www.rfc-editor.org/rfc/rfc7986) | iCalendar extensions | IETF | RFC | rfc-editor.org | [Events]({{ '/implement/content/events/' | relative_url }}) |
| [RFC 4791](https://www.rfc-editor.org/rfc/rfc4791) | CalDAV | IETF | RFC | rfc-editor.org | [Events]({{ '/implement/content/events/' | relative_url }}) |
| [RFC 5546](https://www.rfc-editor.org/rfc/rfc5546) | iTIP | IETF | RFC | rfc-editor.org | [Events]({{ '/implement/content/events/' | relative_url }}) |
| [RFC 6047](https://www.rfc-editor.org/rfc/rfc6047) | iMIP | IETF | RFC | rfc-editor.org | [Events]({{ '/implement/content/events/' | relative_url }}) |

### Community conventions

| Convention | Purpose | Reference | Chapter |
| --- | --- | --- | --- |
| Slash pages | Memorable personal paths | [slashpages.net](https://slashpages.net/) | [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}) |
| `/.well-known/slashpages` | OPML slash-page catalog | [proposal](https://github.com/pfefferle/well-known-slashpages) | [OPML]({{ '/implement/content/opml/' | relative_url }}) |
| Blogroll | Lists of sites you follow | IndieWeb / community | [Links]({{ '/implement/content/links/' | relative_url }}) |
| Uses pages | Tools and equipment | [uses.tech](https://uses.tech/) | [Uses]({{ '/implement/content/uses/' | relative_url }}) |
| POSSE / PESOS | Syndication patterns | [IndieWeb](https://indieweb.org/) | [Connections]({{ '/implement/content/connections/' | relative_url }}) |
| IndieWeb RSVP | Attendance replies | [indieweb.org/rsvp](https://indieweb.org/rsvp) | [Events]({{ '/implement/content/events/' | relative_url }}) |

## Standards and their primary responsibilities

| Need | Primary mechanism |
| --- | --- |
| Publish readable content | HTML |
| Transfer a resource | HTTP |
| Stable page address | URL + canonicalization |
| Person or org profile | h-card or Schema.org Person |
| Article or note | h-entry or Schema.org Article / BlogPosting |
| Link preview | Open Graph |
| Content updates | RSS, Atom, or JSON Feed |
| Advertise URLs | XML Sitemap |
| Organize slash pages | HTML `/slashes/` or optional OPML |
| Crawler access rules | robots.txt (RFC 9309) |
| Indexing preferences | robots meta / `X-Robots-Tag` |
| Relationships | Link relations (RFC 8288) |
| Notify about a link | Webmention |
| Distribute topic updates | WebSub |
| Client publishing API | Micropub |
| Auth with web identity | IndieAuth |
| Federated social activities | ActivityPub |
| Describe an event | h-event or Schema.org Event |
| Exchange calendar entries | iCalendar |

## What is actually required?

**Format-required** — the specification needs it for validity (for example certain Atom entry fields).

**Format-optional** — valid when present, not mandatory (many Schema.org properties).

**Consumer-required** — needed for a particular app or rich-result feature (Google Event rules ≠ Schema.org Event validity).

Open Graph defines four core properties (`og:title`, `og:type`, `og:image`, `og:url`). Schema.org does not impose one mandatory property list for every type. Do not merge unrelated specs into one fictional required-fields table.

## Web resource paths and well-known locations

| Path | Kind | Notes |
| --- | --- | --- |
| `/robots.txt` | Protocol location | RFC 9309 |
| `/sitemap.xml` | Conventional | Discovery may also use robots `Sitemap:` |
| `/feed.xml`, `/rss.xml`, `/atom.xml`, `/feed.json` | Conventional | Prefer autodiscovery links |
| `/about/`, `/now/`, `/uses/`, `/slashes/` | Community conventions | Paths may vary |
| `/.well-known/slashpages` | Community proposal | Not IANA-registered as of Nov. 3, 2026 |
| `/.well-known/webfinger` | Protocol | RFC 7033 |
| `/.well-known/josh` | Joshternet | Project RFCs—not an IANA registration |

[RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) and the [IANA Well-Known URI registry](https://www.iana.org/assignments/well-known-uris/) govern registered suffixes. Using `.well-known` does not create a registration.

## Link relation types

Useful relations discussed in the handbook include registered and HTML-oriented types such as `alternate`, `author`, `canonical`, `describedby`, `help`, `icon`, `license`, `me`, `next`, `prev`, `self`, `search`, `webmention`, `micropub`, `hub`, plus link qualifications such as `nofollow`, `noopener`, `noreferrer`, `sponsored`, and `ugc`. See the [IANA link relations registry](https://www.iana.org/assignments/link-relations/).

`rel="blogroll"` is a **community convention** and was **not** listed in the IANA registry as of Nov. 3, 2026. A relation’s presence does not prove friendship, ownership, or endorsement—verification depends on the protocol.

## Metadata and structured-data families

**HTML:** title, description, `lang`, canonical, robots meta. See [HTML]({{ '/implement/content/html/' | relative_url }}) and [SEO]({{ '/implement/content/seo/' | relative_url }}).

**Microformats2 prefixes:** `h-*` (root), `p-*` (plain text), `u-*` (URL), `dt-*` (datetime), `e-*` (element tree).

**Open Graph:** four core properties plus optional general and article namespaces ([ogp.me](https://ogp.me/)).

**Schema.org:** types and properties for entities—not the same as JSON-LD syntax.

**JSON-LD keywords:** `@context`, `@type`, `@id`, `@graph`, `@value`, `@language`, `@list`, `@set` ([JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)).

## Common Schema.org types

| Type | Definition |
| --- | --- |
| Person | [schema.org/Person](https://schema.org/Person) |
| Organization | [schema.org/Organization](https://schema.org/Organization) |
| WebSite | [schema.org/WebSite](https://schema.org/WebSite) |
| WebPage | [schema.org/WebPage](https://schema.org/WebPage) |
| AboutPage | [schema.org/AboutPage](https://schema.org/AboutPage) |
| CollectionPage | [schema.org/CollectionPage](https://schema.org/CollectionPage) |
| BlogPosting | [schema.org/BlogPosting](https://schema.org/BlogPosting) |
| Article | [schema.org/Article](https://schema.org/Article) |
| CreativeWork | [schema.org/CreativeWork](https://schema.org/CreativeWork) |
| Photograph | [schema.org/Photograph](https://schema.org/Photograph) |
| VisualArtwork | [schema.org/VisualArtwork](https://schema.org/VisualArtwork) |
| ImageObject | [schema.org/ImageObject](https://schema.org/ImageObject) |
| MusicRecording | [schema.org/MusicRecording](https://schema.org/MusicRecording) |
| MusicComposition | [schema.org/MusicComposition](https://schema.org/MusicComposition) |
| MusicAlbum | [schema.org/MusicAlbum](https://schema.org/MusicAlbum) |
| VideoObject | [schema.org/VideoObject](https://schema.org/VideoObject) |
| PodcastEpisode | [schema.org/PodcastEpisode](https://schema.org/PodcastEpisode) |
| SoftwareApplication | [schema.org/SoftwareApplication](https://schema.org/SoftwareApplication) |
| SoftwareSourceCode | [schema.org/SoftwareSourceCode](https://schema.org/SoftwareSourceCode) |
| VideoGame | [schema.org/VideoGame](https://schema.org/VideoGame) |
| Book | [schema.org/Book](https://schema.org/Book) |
| Event | [schema.org/Event](https://schema.org/Event) |
| EventSeries | [schema.org/EventSeries](https://schema.org/EventSeries) |
| Place | [schema.org/Place](https://schema.org/Place) |
| VirtualLocation | [schema.org/VirtualLocation](https://schema.org/VirtualLocation) |
| Product | [schema.org/Product](https://schema.org/Product) |
| Review | [schema.org/Review](https://schema.org/Review) |
| ItemList | [schema.org/ItemList](https://schema.org/ItemList) |

Prefer a specialized type when it fits; use a general type when it does not. Do not invent types to match hub UI categories.

## Current Schema.org version

Verified Nov. 3, 2026 against [schema.org/docs/releases.html](https://schema.org/docs/releases.html):

- **Version:** 30.1
- **Publication date:** Sept. 16, 2026
- **Current summary:** [schema.org/version/latest](https://schema.org/version/latest)

Schema.org is a living vocabulary. Do not rewrite every handbook example solely because a new release appears—verify whether relevant types or properties actually changed.

## Formats and media types

| Resource | Typical content type |
| --- | --- |
| HTML | `text/html` |
| JSON | `application/json` |
| JSON-LD document | `application/ld+json` |
| RSS | `application/rss+xml` |
| Atom | `application/atom+xml` |
| JSON Feed | `application/feed+json` |
| XML sitemap | `application/xml` |
| OPML | `text/x-opml` or XML |
| robots.txt | `text/plain` |
| iCalendar | `text/calendar` |
| JPEG / PNG / WebP | `image/jpeg`, `image/png`, `image/webp` |

A JSON-LD `<script type="application/ld+json">` does not change the HTML document’s `Content-Type`. Prefer correct UTF-8 delivery.

## Dates and identifiers

Publication, modification, feed update, site deployment, crawl observation, and external discovery times are different. HTML `datetime`, RSS `pubDate`, Atom `published`/`updated`, JSON Feed `date_published`/`date_modified`, Schema.org `datePublished`/`dateModified`, iCalendar `DTSTART`/`DTEND`/`UID`, sitemap `lastmod`, feed entry IDs, canonical URLs, and JSON-LD `@id` each name a different job. An event’s start is not a page’s publication time. See [Feeds]({{ '/implement/content/feeds/' | relative_url }}), [Events]({{ '/implement/content/events/' | relative_url }}), and [Validation]({{ '/implement/content/validation/' | relative_url }}).

## Feeds and syndication

| | RSS 2.0 | Atom | JSON Feed 1.1 |
| --- | --- | --- | --- |
| Spec | [rssboard.org](https://www.rssboard.org/rss-specification) | [RFC 4287](https://www.rfc-editor.org/rfc/rfc4287) | [jsonfeed.org](https://www.jsonfeed.org/version/1.1/) |
| Root | `rss` / `channel` | `feed` | JSON object |
| Entries | `item` | `entry` | `items` |
| Stable ID | `guid` (practice) | `id` (required) | `id` (required) |
| Autodiscovery MIME | `application/rss+xml` | `application/atom+xml` | `application/feed+json` |

Pagination: [RFC 5005](https://www.rfc-editor.org/rfc/rfc5005). Media RSS and podcast namespaces are extensions—document separately. Full examples: [Feeds]({{ '/implement/content/feeds/' | relative_url }}).

## Sitemaps and crawler directives

XML Sitemap Protocol (urlset, loc, lastmod, size limits), sitemap indexes, and vendor extensions (image/video/news/hreflang) are distinct from RFC 9309 robots rules and from robots meta / `X-Robots-Tag` indexing directives. Crawl access ≠ indexing ≠ AI usage preferences. See [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}) and [Robots]({{ '/implement/content/robots/' | relative_url }}).

## AI usage preferences and emerging proposals

As of **Nov. 3, 2026**, these remain works in progress or vendor mechanisms—not RFCs unless stated:

| Name | Maintainer | Status | Scope |
| --- | --- | --- | --- |
| [draft-ietf-aipref-vocab](https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/) | IETF AIPREF WG | Internet-Draft (vocab-08) | AI use vocabulary |
| [draft-ietf-aipref-attach](https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/) | IETF AIPREF WG | Internet-Draft (attach-05) | HTTP / robots `Content-Usage` |
| [draft-kelley-aipref-training-preference-signal](https://datatracker.ietf.org/doc/draft-kelley-aipref-training-preference-signal/) | Individual I-D | Internet-Draft (00, Oct. 30, 2026) | Training preference via special UA groups |
| [Content Signals](https://contentsignals.org/) | Vendor/community | Not an IETF RFC | `Content-Signal` preferences |

Do not describe planned RFC status as achieved. Full guidance: [Robots]({{ '/implement/content/robots/' | relative_url }}).

## Identity and relationships

| Protocol | Primary purpose | Maturity |
| --- | --- | --- |
| h-card | Structured profiles | Community vocabulary |
| rel=me | Identity relationships between URLs | HTML / IndieWeb practice |
| WebFinger | Discover account-associated resources | RFC 7033 |
| IndieAuth | Decentralized authentication | IndieWeb Living Standard (distinct from older W3C Note) |
| Webmention | Notify a target of a source link | W3C Recommendation |
| WebSub | Distribute topic updates via hubs | W3C Recommendation (02 June 2026) |
| Micropub | Create/update/delete posts via API | W3C Recommendation |
| ActivityPub | Federated social interactions | W3C Recommendation |

These protocols are not interchangeable. See [Identity]({{ '/implement/content/identity/' | relative_url }}) and [Connections]({{ '/implement/content/connections/' | relative_url }}).

## Creative media and accessibility

HTML images/audio/video, responsive images, WebVTT, WCAG 2.2, Schema.org creative-work types, IPTC, EXIF, XMP, C2PA, Media RSS, and Creative Commons licensing address presentation, description, accessibility, provenance, and rights—different jobs. No single format proves copyright ownership or factual authenticity. See [Creative media]({{ '/implement/content/media/' | relative_url }}).

## Events and calendars

Schema.org Event, h-event, iCalendar (RFC 5545 / 7986), CalDAV, iTIP, iMIP, and IndieWeb RSVP cover description, exchange, subscription, sync, and scheduling separately. Stable UIDs and time zones matter. See [Events]({{ '/implement/content/events/' | relative_url }}).

## Community conventions

`/about`, `/now`, `/uses`, `/blogroll`, `/slashes`, slash-page directories, `/.well-known/slashpages`, blogroll OPML, POSSE, PESOS, and IndieWeb RSVP are useful conventions—not mandated Internet Standards. Publishers may use different URLs. The slash-page catalog is not a set of required routes. See [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}), [Uses]({{ '/implement/content/uses/' | relative_url }}), and [OPML]({{ '/implement/content/opml/' | relative_url }}).

## Joshternet specifications

Authoritative project specs: [github.com/joshternet/spec](https://github.com/joshternet/spec).

| Document | Role |
| --- | --- |
| [RFC-JOSH-0000](https://github.com/joshternet/spec/blob/main/rfcs/0000-the-joshternet.md) | Foundational principles |
| [RFC-JOSH-0001](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md) | Josh identity |
| [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) | `/.well-known/josh` participation |

These govern Joshternet participation. They do not redefine HTML, Microformats2, Schema.org, Open Graph, RSS, Webmention, or other open-web standards. A valid declaration is separate from permitting crawls and from declaring Josh identity. Guides: [Implement]({{ '/implement/' | relative_url }}), [Specs]({{ '/specs/' | relative_url }}), [declaration checker]({{ '/implement/validate/' | relative_url }}).

## A standard can exist even when an application doesn't implement it

Distinguish: (1) the specification, (2) a publisher implementing it, (3) a parser recognizing syntax, (4) an application extracting fields, (5) display or action, (6) relationship verification, (7) a complete conforming implementation.

Recognizing `p-category` is not full Microformats2 conformance. Extracting Schema.org Event is not every Schema.org type. Reading RSS categories is not every RSS extension. Discovering a Webmention endpoint is not sending or receiving Webmentions.

## Joshternet hub crawl support matrix

Hand-maintained in `_data/content_support_matrix.json` and checked by tests. Statuses: `implemented`, `partial`, `not_implemented`, `under_consideration`. **Partial means partial**—not “we support Schema.org.” This matrix describes hub crawl behavior, not the open web.

<p>
  Crawler:
  <code>{{ site.data.content_support_matrix.user_agent }}</code>
  · Matrix verified:
  {{ site.data.content_support_matrix.verified_date }}
</p>

<table>
  <thead>
    <tr>
      <th>Area</th>
      <th>Status</th>
      <th>Published inputs</th>
      <th>Limitations</th>
      <th>Chapter</th>
      <th>Verified</th>
    </tr>
  </thead>
  <tbody>
    {% for row in site.data.content_support_matrix.entries %}
      <tr>
        <td>{{ row.name }}</td>
        <td><code>{{ row.status }}</code></td>
        <td>{{ row.properties_consumed | join: "; " }}</td>
        <td>{{ row.limitations }}</td>
        <td>
          {% if row.chapter_path %}
            <a href="{{ row.chapter_path | relative_url }}">Open</a>
          {% endif %}
        </td>
        <td>{{ row.verified_date }}</td>
      </tr>
    {% endfor %}
  </tbody>
</table>

## Known limitations and nonclaims

- Discovering a page does not guarantee indexing.
- Valid structured data does not guarantee rich results.
- A topic tag does not prove expertise.
- A product mention does not prove usage or ownership.
- A link does not prove friendship.
- An h-card does not verify legal identity.
- A Webmention notification is unverified until its source is checked.
- A feed does not guarantee instant delivery.
- An OPML manifest does not establish Joshternet membership.
- An AI usage preference does not technically prevent copying.
- A Joshternet declaration does not require every optional publishing convention.

## Example reference entries

### RSS 2.0

- **Maintainer:** RSS Advisory Board
- **Status:** Industry protocol (not an IETF RFC)
- **Resource:** Syndicated channel / items
- **Typical type:** `application/rss+xml`
- **Spec:** [rssboard.org/rss-specification](https://www.rssboard.org/rss-specification)
- **Chapter:** [Feeds]({{ '/implement/content/feeds/' | relative_url }})

### Microformats2 h-entry

The [parsing specification](https://microformats.org/wiki/microformats2-parsing) defines how class names become JSON. The [h-entry vocabulary](https://microformats.org/wiki/h-entry) names properties such as `p-name` and `dt-published`. Supporting one property is not full parser conformance. Chapter: [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}).

### Well-known slashpages

- **Proposal:** [pfefferle/well-known-slashpages](https://github.com/pfefferle/well-known-slashpages)
- **Depends on:** [OPML 2.0](https://opml.org/spec2.opml)
- **URI:** `/.well-known/slashpages`
- **IANA:** Not registered as of Nov. 3, 2026
- **Chapters:** [OPML]({{ '/implement/content/opml/' | relative_url }}), [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})

## Specifications change

Check RFC status and errata, obsoletes/updates relationships, W3C document status, Living Standard revisions, Schema.org releases, Internet-Draft revisions and expiration, community revisions, and vendor doc changes. Prefer the current authoritative URL over copying old snapshots. A newer publication is not automatically incompatible with earlier implementations.

## Maintainable references

Each handbook entry should keep a stable name, primary authoritative URL, concise purpose, verified maturity, related chapter, and review date where needed. Avoid duplicate contradictory lists. Link to chapter tutorials instead of copying them. No new code-generation architecture is required to maintain this index.

## Validation resources

| Area | Tool |
| --- | --- |
| HTML | [Nu HTML Checker](https://validator.w3.org/nu/) |
| Accessibility | [WAI tools](https://www.w3.org/WAI/test-evaluate/tools/) |
| Microformats2 | [pin13](https://pin13.net/mf2/), [tests](https://github.com/microformats/tests) |
| Schema.org | [validator.schema.org](https://validator.schema.org/) |
| Google features | [Rich Results Test](https://search.google.com/test/rich-results) |
| RSS / Atom | [Feed validator](https://validator.w3.org/feed/) |
| JSON Feed | Spec + JSON parser checks |
| Webmention / WebSub / Micropub | [webmention.rocks](https://webmention.rocks/), [websub.rocks](https://websub.rocks/), [micropub.rocks](https://micropub.rocks/) |

Full procedures: [Validation]({{ '/implement/content/validation/' | relative_url }}).

## Security and trust

Specifications describe interoperable behavior—not automatic trust. Distinguish authentication from crawler access; treat remote structured data as untrusted; verify identity claims; bound cross-origin fetches (SSRF); parse XML/JSON carefully; watch embedded scripts and privacy-sensitive metadata; respect copyright/licensing and AI preference limits; avoid pasting secrets into third-party validators. See each protocol’s security considerations and [Validation]({{ '/implement/content/validation/' | relative_url }}).

## Which chapter should I read?

| Task | Chapter |
| --- | --- |
| Structure a page | [Semantic HTML]({{ '/implement/content/html/' | relative_url }}) |
| Search discoverability | [SEO]({{ '/implement/content/seo/' | relative_url }}) |
| Personal slash pages | [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}) |
| Slash-page catalog | [OPML]({{ '/implement/content/opml/' | relative_url }}) |
| Articles/people in HTML | [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}) |
| Link previews | [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}) |
| Structured entities | [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}) |
| Subscriptions | [Feeds]({{ '/implement/content/feeds/' | relative_url }}) |
| Advertise URLs | [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}) |
| Crawler access | [Robots]({{ '/implement/content/robots/' | relative_url }}) |
| Resource relationships | [Links]({{ '/implement/content/links/' | relative_url }}) |
| Identity and authorship | [Identity]({{ '/implement/content/identity/' | relative_url }}) |
| Cross-site interactions | [Connections]({{ '/implement/content/connections/' | relative_url }}) |
| Creative work | [Creative media]({{ '/implement/content/media/' | relative_url }}) |
| Events and calendars | [Events]({{ '/implement/content/events/' | relative_url }}) |
| Tools and equipment | [Uses]({{ '/implement/content/uses/' | relative_url }}) |
| Content discovery strategy | [Explore]({{ '/implement/content/explore/' | relative_url }}) |
| Diagnose problems | [Validation]({{ '/implement/content/validation/' | relative_url }}) |
| Handbook hub | [Content Discovery Handbook]({{ '/implement/content/' | relative_url }}) |

## Glossary

**Canonical URL** — Preferred resource URL for duplicates. **Content type** — MIME type of a representation. **Crawling** — Fetching URLs by following links or seeds. **Discoverability** — Ease of finding published work. **Entity** — A thing described by structured data. **Feed** — Syndicated updates. **Identifier** — Stable ID for a resource or entry. **Indexing** — Recording content for retrieval. **Link relation** — Typed relationship (`rel`). **Metadata** — Data about a resource. **Microformats2** — HTML class vocabularies. **MIME type** — Media type label. **Namespace** — Scoped name vocabulary. **Origin** — Scheme + host + port. **OPML** — Outline markup for lists. **Parsing** — Interpreting a format into structure. **Permalink** — Stable public URL. **Provenance** — Origin/history of content. **RDF** — Graph data model. **Schema** — Shared type system (often Schema.org). **Semantic HTML** — Meaningful document structure. **Serialization** — Encoding a model as bytes/text. **Structured data** — Explicit machine-readable description. **Syndication** — Distributing updates. **Vocabulary** — Shared terms. **Webmention** — Link notification protocol. **Well-known URI** — `/.well-known/` path (RFC 8615).

## Authoritative sources

- [RFC Editor](https://www.rfc-editor.org/) · [IETF Datatracker](https://datatracker.ietf.org/)
- [IANA link relations](https://www.iana.org/assignments/link-relations/) · [well-known URIs](https://www.iana.org/assignments/well-known-uris/) · [media types](https://www.iana.org/assignments/media-types/)
- [HTML](https://html.spec.whatwg.org/) · [URL](https://url.spec.whatwg.org/) · [Fetch](https://fetch.spec.whatwg.org/)
- [W3C TR](https://www.w3.org/TR/)
- [Microformats](https://microformats.org/wiki/)
- [Schema.org](https://schema.org/) · [releases](https://schema.org/docs/releases.html)
- [Open Graph](https://ogp.me/)
- [RSS](https://www.rssboard.org/rss-specification) · [JSON Feed](https://www.jsonfeed.org/version/1.1/) · [OPML](https://opml.org/spec2.opml) · [Sitemaps](https://www.sitemaps.org/protocol.html)
- [IndieWeb](https://indieweb.org/)
- [Joshternet specs](https://github.com/joshternet/spec)

Prefer direct links to the document that defines a requirement.

## Continue through the handbook

- [Content Discovery Handbook]({{ '/implement/content/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})

This is the final handbook chapter. Navigation below follows `content_nav` (previous: Validation; no next chapter).

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
