---
layout: default
title: "Feeds: Publish Once, Let Readers Follow Along"
description: >-
  Publish RSS 2.0, Atom, or JSON Feed 1.1 so readers and software can follow
  your writing, notes, podcasts, and projects—with stable IDs, dates,
  autodiscovery, and validation.
keywords: >-
  RSS, Atom, JSON Feed, syndication, feed autodiscovery, podcast enclosure,
  independent web, web publishing
permalink: /implement/content/feeds/
nav_title: Feeds
content_id: feeds
matrix_id: feeds
seo:
  type: TechArticle
  name: Feeds
---

# Feeds

A feed is a machine-readable publication that describes content available from a website. Compatible software can subscribe to that URL and learn about new or changed entries without requiring an account on a social platform.

You control the feed’s address, contents, and the site it describes. Feed readers retrieve and interpret the document—some show summaries with links to the original pages; others can display complete entries. Readers may use different applications while following the same sites, and you can change hosts or generators without forcing everyone onto a new platform.

RSS 2.0, Atom, and JSON Feed 1.1 are three established syndication formats. Feeds are useful beyond blogs: notes, podcasts, videos, photographs, project releases, and other regularly published material can all appear in a feed. Publishing a feed does not guarantee immediate delivery, directory placement, or featuring—applications check on their own schedules and apply their own retention and rendering policies.

## How the web learned to follow itself

RSS made subscription practical for news and blogging by publishing a shared list of recent items. Earlier RSS dialects and RSS 1.0’s RDF lineage differ from the widely deployed **RSS 2.0** channel/item model. **Atom** (RFC 4287) later provided an IETF-standardized XML format with explicit identifiers, update semantics, and content models. **JSON Feed** offers similar capabilities using JSON, which many modern generators find easier to emit.

None of these formats is a universal replacement for the others. Syndication shaped blogging, podcasting, aggregators, and independent publishing by letting people follow sites without living inside one company’s timeline.

## From your website to a reader

<ol class="content-discovery-flow" aria-label="How feed syndication works">
  <li>
    <strong>Publish</strong>
    <span>You publish an article, note, episode, or other work on the site.</span>
  </li>
  <li>
    <strong>Update feed</strong>
    <span>The site regenerates or updates its feed document to include that work.</span>
  </li>
  <li>
    <strong>Discover</strong>
    <span>A reader finds the feed via autodiscovery, a shared URL, or OPML.</span>
  </li>
  <li>
    <strong>Retrieve</strong>
    <span>The reader fetches the feed over HTTP on its own schedule.</span>
  </li>
  <li>
    <strong>Identify</strong>
    <span>It recognizes new or changed entries by stable identifiers and dates.</span>
  </li>
  <li>
    <strong>Present</strong>
    <span>It displays entries and may link people to the original pages.</span>
  </li>
</ol>

Ordinary feeds are **polled**, not pushed to every subscriber (optional [WebSub](https://www.w3.org/TR/websub/) can notify hubs; it is not required for RSS, Atom, or JSON Feed).

A feed is not a website page, not an [XML sitemap]({{ '/implement/content/sitemaps/' | relative_url }}), not a Webmention, and not a social timeline. Availability of a feed does not mean every subscriber sees an update instantly.

## RSS, Atom and JSON Feed compared

| Feature | RSS 2.0 | Atom | JSON Feed 1.1 |
| --- | --- | --- | --- |
| Serialization | XML | XML | JSON |
| Primary document | `rss` / `channel` | `feed` | JSON object |
| Entry container | `item` | `entry` | `items[]` |
| Stable identity | `guid` | `id` | `id` |
| Publication date | `pubDate` | `published` | `date_published` |
| Update date | Extensions / context | `updated` | `date_modified` |
| Categories | `category` | `category` | `tags` |
| Media | Enclosures / extensions | Link relations / content | `attachments` |
| Typical MIME type | `application/rss+xml` | `application/atom+xml` | `application/feed+json` |

You may offer more than one format, but you do not need all three. Prefer a format your publishing system can produce correctly and maintain. Converting between formats may drop extensions.

## RSS 2.0: A familiar way to publish updates

An RSS 2.0 document usually begins with an XML declaration, then `<rss version="2.0">` wrapping a `<channel>`. The channel holds feed metadata and zero or more `<item>` elements.

**Required channel elements:** `title`, `link`, and `description`.

**Useful optional channel elements:** `language`, `copyright`, `pubDate`, `lastBuildDate`, `category`, `image`, `generator`, `docs`, `ttl`, `managingEditor`, `webMaster`.

**Item elements** commonly include `title`, `link`, `description`, `guid`, `pubDate`, `category`, `author`, `comments`, `enclosure`, and `source`. An item must provide at least a `title` or a `description`. Stable `guid` values and item `link` URLs are strongly recommended. `guid` and `link` are related but not interchangeable—`guid` is identity; `link` is where people read the work.

### Complete RSS 2.0 example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Harbor Notes</title>
    <link>https://joshua.example/</link>
    <description>Writing, projects, and experiments.</description>
    <language>en-us</language>
    <lastBuildDate>Thu, 02 Oct 2026 15:00:00 GMT</lastBuildDate>

    <item>
      <title>Notes from the lab</title>
      <link>https://joshua.example/notes/lab/</link>
      <guid isPermaLink="true">https://joshua.example/notes/lab/</guid>
      <pubDate>Thu, 01 Oct 2026 12:00:00 GMT</pubDate>
      <description>Notes about rebuilding my workbench.</description>
      <category>Technology</category>
    </item>

    <item>
      <title>Shipped the new feed</title>
      <link>https://joshua.example/notes/shipped-feed/</link>
      <guid isPermaLink="true">https://joshua.example/notes/shipped-feed/</guid>
      <pubDate>Fri, 02 Oct 2026 15:00:00 GMT</pubDate>
      <description>Atom and JSON Feed are live.</description>
      <category>IndieWeb</category>
    </item>
  </channel>
</rss>
```

Serve with `Content-Type: application/rss+xml` (or a compatible XML type). Escape `&`, `<`, and `"` in text. See the [RSS 2.0 specification](https://www.rssboard.org/rss-specification).

## Atom: A more explicit syndication format

Atom uses the namespace `http://www.w3.org/2005/Atom` with a `<feed>` root and `<entry>` children ([RFC 4287](https://www.rfc-editor.org/rfc/rfc4287)).

**Feed-level elements** include required `id`, `title`, and `updated`, plus common `link`, `author`, `subtitle`, `category`, `contributor`, `generator`, `icon`, `logo`, and `rights`. Author information must appear on the feed or on every entry.

**Entry-level elements** include required `id`, `title`, and `updated`, plus `published`, `link`, `author`, `summary`, `content`, `category`, `contributor`, `rights`, and `source`. An Atom `id` must be a permanent IRI; it need not be dereferenceable. Prefer `rel="alternate"` for the human page and `rel="self"` on the feed document for the feed URL.

Atom text constructs may be `type="text"`, `html`, or `xhtml`. Content rules require a summary or alternate link in certain cases when content is omitted—follow RFC 4287 when mixing summary-only and full-content entries.

### Complete Atom example

```xml
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Harbor Notes</title>
  <id>https://joshua.example/</id>
  <updated>2026-10-02T15:00:00Z</updated>
  <link href="https://joshua.example/" rel="alternate"/>
  <link href="https://joshua.example/atom.xml" rel="self"/>
  <author>
    <name>Avery Example</name>
    <uri>https://joshua.example/about/</uri>
  </author>
  <subtitle>Writing, projects, and experiments.</subtitle>

  <entry>
    <title>Notes from the lab</title>
    <id>https://joshua.example/notes/lab/</id>
    <link href="https://joshua.example/notes/lab/" rel="alternate"/>
    <published>2026-10-01T12:00:00Z</published>
    <updated>2026-10-01T12:00:00Z</updated>
    <summary>Notes about rebuilding my workbench.</summary>
    <category term="technology" label="Technology"/>
  </entry>

  <entry>
    <title>Shipped the new feed</title>
    <id>https://joshua.example/notes/shipped-feed/</id>
    <link href="https://joshua.example/notes/shipped-feed/" rel="alternate"/>
    <published>2026-10-02T15:00:00Z</published>
    <updated>2026-10-02T15:00:00Z</updated>
    <summary>Atom and JSON Feed are live.</summary>
    <category term="indieweb" label="IndieWeb"/>
  </entry>
</feed>
```

Set feed `updated` when the feed’s meaningful contents change—not on every empty static rebuild. When you revise an entry, keep the same `id` and advance `updated`.

## JSON Feed 1.1

[JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) identifies itself with:

`https://jsonfeed.org/version/1.1`

**Top-level fields** include required `version` and `title`, plus `home_page_url`, `feed_url`, `description`, `user_comment`, `next_url`, `icon`, `favicon`, `authors`, `language`, `expired`, and `hubs`.

**Item fields** include required stable `id`, plus `url`, `external_url`, `title`, `content_html`, `content_text`, `summary`, `image`, `banner_image`, `date_published`, `date_modified`, `authors`, `tags`, `language`, and `attachments`. Each item needs at least one of `content_html` or `content_text`. Prefer the plural `authors` array from 1.1 over deprecated singular author fields.

### Complete JSON Feed example

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Harbor Notes",
  "home_page_url": "https://joshua.example/",
  "feed_url": "https://joshua.example/feed.json",
  "description": "Writing, projects, and experiments.",
  "language": "en",
  "authors": [
    {
      "name": "Avery Example",
      "url": "https://joshua.example/about/"
    }
  ],
  "items": [
    {
      "id": "https://joshua.example/notes/lab/",
      "url": "https://joshua.example/notes/lab/",
      "title": "Notes from the lab",
      "content_text": "I rebuilt my workbench.",
      "date_published": "2026-10-01T12:00:00Z",
      "tags": ["technology", "projects"]
    },
    {
      "id": "https://joshua.example/notes/shipped-feed/",
      "url": "https://joshua.example/notes/shipped-feed/",
      "title": "Shipped the new feed",
      "content_text": "Atom and JSON Feed are live.",
      "date_published": "2026-10-02T15:00:00Z",
      "tags": ["indieweb"]
    }
  ]
}
```

Serve with `Content-Type: application/feed+json` when possible.

## Help applications find your feed

Do not rely on visitors guessing `/feed.xml` or `/rss.xml`. Advertise feeds in HTML with `rel="alternate"` and the correct MIME type:

```html
<link
  rel="alternate"
  type="application/rss+xml"
  title="Harbor Notes RSS"
  href="https://joshua.example/rss.xml"
>
<link
  rel="alternate"
  type="application/atom+xml"
  title="Harbor Notes Atom"
  href="https://joshua.example/atom.xml"
>
<link
  rel="alternate"
  type="application/feed+json"
  title="Harbor Notes JSON Feed"
  href="https://joshua.example/feed.json"
>
```

`rel`, `type`, `title`, and `href` identify the relationship, format, human label, and URL. Put these links in **server-delivered** HTML. Distinct titles help when you publish section-specific or language-specific feeds. See [RSS autodiscovery](https://www.rssboard.org/rss-autodiscovery) and the [HTML Living Standard](https://html.spec.whatwg.org/).

## Make sure each publication has a lasting identity

Readers recognize that today’s item is yesterday’s item by comparing stable identifiers:

- RSS: `guid`
- Atom: `id`
- JSON Feed: `id`

Keep IDs stable across rebuilds, hosting moves, edits, and reordering. With RSS, `isPermaLink="true"` means the guid is a URL; `false` means it is an opaque id—do not mark a non-URL guid as a permalink. Prefer permanent article URLs and redirects when paths change.

When you edit an article, **keep the same id** and update modification fields. Regenerating a new guid every build makes posts look “new” forever.

## Tell readers when something happened

Distinguish:

- Original publication date
- Significant modification date
- Feed-level update timestamp
- Feed generation / build time
- Consumer crawl time (not publisher metadata)

| Format | Fields | Convention |
| --- | --- | --- |
| RSS 2.0 | `pubDate`, `lastBuildDate` | RFC 822–style dates as used by RSS |
| Atom | `published`, `updated` | RFC 3339–compatible |
| JSON Feed | `date_published`, `date_modified` | RFC 3339 |

Use explicit time zones or `Z`. Rebuilding a static site must not rewrite every item’s publication date. Editing an old post should update modification metadata while preserving publication time and id.

## How much content should your feed include?

**Summary feeds** point readers to the site; **full-content feeds** include the body in the feed itself.

- RSS: `description`; many publishers also use `content:encoded` (extension)
- Atom: `summary` and/or `content`
- JSON Feed: `summary`, `content_html`, `content_text`

Neither approach is universally required. Full content helps offline reading; summaries keep the feed small and send traffic to pages with complete chrome, media, and comments. Consumers must sanitize untrusted HTML and must not execute scripts from feed content.

## Help readers understand what each entry is about

- RSS / Atom: `category` (Atom may use `term`, `scheme`, `label`)
- JSON Feed: `tags`

Use meaningful publisher-chosen subjects (`Photography`, `Technology`). These are not [slash-page]({{ '/implement/content/slashpages/' | relative_url }}) path names—an article under `/notes/` can still be tagged `Photography`. Categories do not create universal taxonomy membership or guaranteed directory placement. Prefer consistent spelling; avoid stuffing. Related: [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}), [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}).

## Feed authorship and attribution

- RSS: item `author` conventions (often email-oriented historically)
- Atom: `author` / `contributor` on feed or entry
- JSON Feed: `authors` arrays

Feed-level authors can apply when every entry shares a creator; entry-level authors override for multi-author sites. Authorship is not identity verification; it can coexist with an About page, [h-card]({{ '/implement/content/microformats2/' | relative_url }}), or Schema.org `Person`.

## Feeds aren't only for writing

### RSS enclosures

```xml
<enclosure
  url="https://joshua.example/audio/pier-lights.mp3"
  length="5242880"
  type="audio/mpeg"
/>
```

`url`, `length` (bytes), and `type` (MIME) are required for a valid enclosure.

### Atom enclosures

```xml
<link
  rel="enclosure"
  type="audio/mpeg"
  length="5242880"
  href="https://joshua.example/audio/pier-lights.mp3"
/>
```

### JSON Feed attachments

```json
"attachments": [
  {
    "url": "https://joshua.example/audio/pier-lights.mp3",
    "mime_type": "audio/mpeg",
    "title": "Pier Lights",
    "size_in_bytes": 5242880,
    "duration_in_seconds": 214
  }
]
```

**Media RSS**, podcast namespaces, and [Podcasting 2.0](https://github.com/Podcastindex-org/podcast-namespace) add optional capabilities beyond core RSS. Apple’s podcast feed rules are **vendor guidance**, not RSS itself. Independently hosted shows can still reach many listening apps when the core enclosure and episode metadata are correct.

## What happens when a feed grows?

Many sites publish only recent entries in the current feed while keeping archives on the website. [RFC 5005](https://www.rfc-editor.org/rfc/rfc5005) describes complete, paged, and archived feeds and Atom link relations such as `first`, `last`, `previous`, `next`, `prev-archive`, `next-archive`, and `current`—use the relations that match your model. JSON Feed’s `next_url` pages forward; avoid loops. Not all readers follow pagination. A short current feed does not mean older posts vanished from the site.

## Publishing multiple feeds

Offer separate feeds for all posts, articles, notes, photos, projects, podcasts, or languages when useful. Advertise each with a distinct autodiscovery `title`. When the **same** entry appears in two feeds, reuse the **same** stable id. Prefer a simple structure when too many feeds would be hard to maintain.

## Serve your feed reliably

- Public HTTPS URLs and successful responses
- Correct content types
- Stable feed URLs and careful redirects
- `Cache-Control`, `ETag`, `Last-Modified`, and HTTP 304 for conditional requests
- Sensible handling of failures—do not replace a valid feed with empty or HTML output after a broken build
- Awareness of rate limits and file size

A newly generated response is not the same as a newly published entry. Readers may keep old items while a feed is temporarily down.

## Feeds in static-site generators

Handwritten sites, Jekyll, Hugo, Eleventy, WordPress, and custom apps can all emit feeds from the same content that builds HTML pages:

```text
Published content
       |
       +-- HTML pages
       |
       +-- RSS / Atom / JSON Feed
```

Templates loop over posts and emit XML or JSON with escaped values, stable ids, and correct dates. Prefer deterministic output when source content is unchanged. Inspect the **deployed** feed, not only the template.

## Help subscribers follow when your website moves

During domain, host, or generator changes: redirect old feed URLs, preserve item ids, keep canonical entry URLs working, and update autodiscovery. Podcast ecosystems may use `itunes:new-feed-url` as a **vendor** migration hint—not a universal RSS rule. Do not delete the old feed cold without redirects, or subscribers will strand.

## Feeds and other open web standards

| Standard | Role |
| --- | --- |
| Semantic HTML | Describes page content |
| Microformats2 | Structured data in HTML |
| RSS / Atom / JSON Feed | Announces and distributes entries |
| XML sitemap | Lists discoverable page URLs |
| Slash pages | Organizes site by purpose |
| OPML | Outlines / subscription lists |
| Open Graph | Page objects for compatible consumers |
| Schema.org | Broad typed vocabulary |

A feed entry should point at a stable permalink that carries consistent HTML and metadata. An [OPML]({{ '/implement/content/opml/' | relative_url }}) subscription list is not a feed—it can *point at* feeds. WebSub remains optional.

## Feeds and the Joshternet

Feeds help independent discovery systems notice new writing, dates, and publisher-supplied categories across the open web—including on the Joshternet.

Joshternet’s hub consumes a **subset** of feed signals: HTML autodiscovery (and limited path probes), RSS/Atom categories and JSON Feed tags for subjects, and selected entry fields (links, ids, dates, summaries, enclosures/images). It is not a complete feed-reader product and does not define the feed standards. Details belong in [Reference]({{ '/implement/content/reference/' | relative_url }}). Participation still depends only on `/.well-known/josh`.

## Security and privacy

Treat public feeds as public content. Avoid tokens in feed URLs, drafts in summaries, accidental private posts, XXE/external entity risks in XML, script injection in HTML content, unsafe URL schemes, untrusted attachments, tracking pixels, and personal data you did not intend to publish. Robots rules are not an access-control system. Consumers should sanitize content and never execute feed-embedded scripts.

## Complete implementation walkthrough

1. Decide which publications belong in the feed.
2. Choose RSS, Atom, or JSON Feed.
3. Assign stable item identifiers.
4. Add titles, dates, authors, URLs, descriptions, and categories.
5. Generate valid XML or JSON.
6. Advertise with HTML autodiscovery.
7. Serve with the correct content type.
8. Validate the deployed URL.
9. Publish a second item and edit an existing one—confirm ids stay stable.
10. Plan archives, migrations, and long-term compatibility.

## Check that readers can actually subscribe

- **RSS / Atom:** [W3C Feed Validation Service](https://validator.w3.org/feed/) and RFC 4287 checks
- **JSON Feed:** `JSON.parse` plus required 1.1 fields
- **HTTP:** `curl -i` for status and `Content-Type`
- **Autodiscovery:** View Source on the homepage
- **Identifiers / dates / media:** regenerate and confirm stability; verify enclosure URLs
- **Readers:** subscribe in more than one app
- **Repeat builds:** unchanged sources should not invent new ids or pub dates

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Missing required feed/channel metadata | Validators and readers reject or misread the feed | Meet format requirements |
| Wrong MIME type or HTML at the feed URL | Clients cannot parse | Serve the feed document with the right type |
| Unescaped XML / invalid JSON | Parse failures | Escape and validate |
| Unstable guids/ids | Duplicate “new” posts | Derive ids from stable records |
| Wrong `isPermaLink` | Misleading identity | Match guid type to the flag |
| Pub dates rewritten every build | Chronology lies | Store publication time with the post |
| Crawl time as `pubDate` | Wrong ordering | Use publisher dates |
| Broken autodiscovery types | Feeds never found | Use documented MIME types |
| Advertising a robots-blocked feed | Discovery fails | Allow intended fetches |
| Same post, different ids in two feeds | Duplicate items | Reuse one id |
| Bad enclosure length/type | Podcast clients fail | Set accurate bytes and MIME |
| Pagination loops | Reader hangs | Follow RFC 5005 / `next_url` carefully |
| Empty feed after failed build | Subscribers see a wipe | Fail closed; keep last good feed |
| Cold migration without redirects | Lost subscribers | Redirect and preserve ids |
| Assuming feeds equal sitemaps or guarantee featuring | Wrong expectations | Use each tool for its role |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [OPML]({{ '/implement/content/opml/' | relative_url }})
- [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Connections]({{ '/implement/content/connections/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Schema.org and JSON-LD; next: Sitemaps).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [RSS 2.0 Specification](https://www.rssboard.org/rss-specification) | RSS format |
| [RSS Best Practices Profile](https://www.rssboard.org/rss-profile) | Community profile |
| [RSS Autodiscovery](https://www.rssboard.org/rss-autodiscovery) | HTML discovery convention |
| [Atom Syndication Format (RFC 4287)](https://www.rfc-editor.org/rfc/rfc4287) | Atom standard |
| [Feed Paging and Archiving (RFC 5005)](https://www.rfc-editor.org/rfc/rfc5005) | Paged/archived feeds |
| [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) | JSON Feed format |
| [HTML Living Standard](https://html.spec.whatwg.org/) | Link relations / documents |
| [Web Linking (RFC 8288)](https://www.rfc-editor.org/rfc/rfc8288) | Link relation framework |
| [W3C Feed Validation Service](https://validator.w3.org/feed/) | Feed checking tool |
| [Media RSS](https://www.rssboard.org/media-rss) | Optional media extension |
| [WebSub](https://www.w3.org/TR/websub/) | Optional push notifications |
| [Podcasting 2.0 namespace](https://github.com/Podcastindex-org/podcast-namespace) | Optional podcast extensions |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
