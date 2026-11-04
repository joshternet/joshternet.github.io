---
layout: default
title: "Microformats2: Give Your HTML Meaning"
description: >-
  Describe people, articles, notes, feeds, events, and interactions in ordinary
  HTML with Microformats2 class names—so compatible software can parse the same
  content humans read.
keywords: >-
  Microformats2, h-entry, h-card, h-feed, h-event, IndieWeb, structured data,
  HTML, independent web, web publishing
permalink: /implement/content/microformats2/
nav_title: Microformats2
content_id: microformats2
matrix_id: microformats2
seo:
  type: TechArticle
  name: Microformats2
---

# Microformats2

HTML already describes document structure through headings, paragraphs, articles, and links. Microformats2 builds on that foundation with recognized class names that identify types of content and their properties.

A class such as `h-entry` marks a published entry. Classes such as `p-name`, `dt-published`, and `e-content` describe its title, publication date, and body. The markup remains ordinary HTML: visitors read the same content that compatible applications parse into structured data.

Websites built with different frameworks and languages can exchange meaningful information without sharing an application or a centralized database. Microformats2 does not replace [semantic HTML]({{ '/implement/content/html/' | relative_url }}); it adds a layer of machine-readable meaning to existing elements.

## Where Microformats came from

The original Microformats movement aimed to publish useful structured information through existing web conventions rather than parallel metadata files. Early formats such as hCard, hCalendar, and hAtom each carried their own parsing expectations.

Microformats2 separates a **generic parsing syntax** (the prefixes and algorithms) from **individual vocabularies** (`h-card`, `h-entry`, and others). A conforming parser can recognize structured objects without a separate parser for every vocabulary. Classic Microformats and Microformats2 are related but not identical; this chapter covers Microformats2.

Authoritative documentation lives on the [Microformats wiki](https://microformats.org/wiki/microformats2), including the [parsing specification](https://microformats.org/wiki/microformats2-parsing) and vocabulary pages.

## Five prefixes, one parsing model

| Prefix | Meaning | Example |
| --- | --- | --- |
| `h-*` | Root object / vocabulary type | `h-entry`, `h-card` |
| `p-*` | Plain-text property | `p-name`, `p-summary` |
| `u-*` | URL property | `u-url`, `u-photo` |
| `dt-*` | Date, time, or duration | `dt-published`, `dt-start` |
| `e-*` | Embedded markup content | `e-content` |

These are standardized parsing conventions, not arbitrary CSS class names. A stylesheet may style them, but their meaning comes from the Microformats2 parsing rules.

### Root classes

An `h-*` class establishes the boundary and type of a structured object:

```html
<article class="h-entry">
  <h1 class="p-name">Notes from the lab</h1>
  <time class="dt-published" datetime="2026-10-01">Oct. 1, 2026</time>
  <div class="e-content"><p>I rebuilt my workbench.</p></div>
</article>
```

### Plain-text properties

`p-*` properties extract text. On some elements, attribute values take precedence according to the parsing specification (for example certain `title` or `value` patterns).

```html
<p class="p-summary">A short note about the rebuild.</p>
```

### URL properties

`u-*` properties extract URLs from anchors, images, and related elements. Relative URLs resolve against the document URL and any applicable HTML base URL.

```html
<a class="u-url" href="/notes/lab/">Permalink</a>
<img class="u-photo" src="/images/avery.jpg" alt="">
```

### Date and time properties

`dt-*` properties prefer machine-readable values such as a `datetime` attribute on `<time>`:

```html
<time class="dt-published" datetime="2026-10-01T09:30:00-07:00">
  Oct. 1, 2026, 9:30 a.m. PDT
</time>
```

Vague phrases such as “next Tuesday” do not reliably identify an absolute time.

### Embedded content

`e-content` captures both an HTML representation and derived text, which matters when the body includes markup you want consumers to preserve.

```html
<div class="e-content">
  <p>I rebuilt my <strong>workbench</strong>.</p>
</div>
```

## What a Microformats2 parser actually does

A conforming parser roughly:

1. Reads an HTML document.
2. Finds elements with recognized root classes (`h-*`).
3. Collects properties that belong to each root.
4. Extracts values according to prefixes and element types.
5. Resolves relevant URLs.
6. Processes nested Microformats objects.
7. Applies implied properties when appropriate.
8. Returns a structured representation—commonly JSON.

Publishers do **not** hand-author that JSON. It is the output of parsing the HTML.

### Parsed JSON structure

Typical fields include:

- `items` — top-level parsed objects
- `type` — vocabulary identifiers such as `["h-entry"]`
- `properties` — named property arrays
- `children` — nested objects that are not attached as a property value
- Property values as arrays (even for a single value)
- Nested objects for embedded Microformats
- For `e-*`, an object that may include `html` and `value`

Example HTML:

```html
<article class="h-entry">
  <h1 class="p-name">Notes from the lab</h1>
  <time class="dt-published" datetime="2026-10-01">Oct. 1, 2026</time>
  <div class="e-content"><p>I rebuilt my workbench.</p></div>
  <a class="u-url" href="https://joshua.example/notes/lab/">Permalink</a>
</article>
```

Illustrative parsed shape (conforming parsers may differ in whitespace and exact `e-content` text normalization):

```json
{
  "items": [
    {
      "type": ["h-entry"],
      "properties": {
        "name": ["Notes from the lab"],
        "published": ["2026-10-01"],
        "url": ["https://joshua.example/notes/lab/"],
        "content": [
          {
            "value": "I rebuilt my workbench.",
            "html": "<p>I rebuilt my workbench.</p>"
          }
        ]
      }
    }
  ]
}
```

Validated against a conforming Microformats2 parser (`microformats-parser`). You can also check pages with [pin13.net/mf2](https://pin13.net/mf2/).

## Property extraction and implied properties

Common extraction patterns include:

- Anchor `href` for `u-*`
- Image `src` and sometimes `alt` for photos/names
- `<time datetime>` for `dt-*`
- `data` / `value` class patterns
- `abbr title`
- Ordinary element text for `p-*`
- Inner HTML for `e-*`

The **value-class pattern** lets you mark a specific child as the parsed value when the visible text should stay human-friendly. See the [parsing specification](https://microformats.org/wiki/microformats2-parsing) for the exact rules.

### Implied properties

When certain explicit properties are absent, a conforming parser may imply `name`, `photo`, and/or `url` from a root element’s content—for example an `h-card` that is only a linked image. Implied properties are deterministic parsing rules, not general-purpose AI inference.

Prefer explicit `p-name`, `u-url`, and `u-photo` when clarity and interoperability matter.

Explicit:

```html
<a class="h-card" href="https://joshua.example/">
  <img class="u-photo" src="/images/avery.jpg" alt="">
  <span class="p-name">Avery Example</span>
</a>
```

Implied-friendly (parser may infer name and url from the anchor and text):

```html
<a class="h-card" href="https://joshua.example/">Avery Example</a>
```

## Describe relationships between things

A property may contain another structured object. An article can identify its author with an embedded `h-card`:

```html
<article class="h-entry">
  <h1 class="p-name">Notes from the lab</h1>

  <p>
    Written by
    <a class="p-author h-card" href="https://joshua.example/about/">
      <span class="p-name">Avery Example</span>
    </a>
  </p>

  <time class="dt-published" datetime="2026-10-01">
    Oct. 1, 2026
  </time>

  <div class="e-content">
    <p>I rebuilt my workbench.</p>
  </div>
</article>
```

The author is both a property of the entry (`author`) and a structured `h-card`. Parsers attach nested roots used as property values under that property; independent nested roots may appear as `children` depending on markup. Illustrative JSON fragment:

```json
{
  "type": ["h-entry"],
  "properties": {
    "name": ["Notes from the lab"],
    "published": ["2026-10-01"],
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
        "value": "I rebuilt my workbench.",
        "html": "<p>I rebuilt my workbench.</p>"
      }
    ]
  }
}
```

## h-card: People and organizations

`h-card` describes people, organizations, and independent identities. Important properties include:

- `p-name`, `p-given-name`, `p-family-name`, `p-nickname`
- `u-url`, `u-photo`
- `p-note`, `p-org`, `p-job-title`
- `u-email`
- `p-locality`, `p-country-name`

See the authoritative [h-card](https://microformats.org/wiki/h-card) definition for the full property list and status.

About-page example:

```html
<section class="h-card">
  <h1 class="p-name">Avery Example</h1>
  <img class="u-photo" src="/images/avery.jpg" alt="">
  <p class="p-note">Writer and woodworker in Cascadia.</p>
  <p>
    <a class="u-url" href="https://joshua.example/">joshua.example</a>
  </p>
  <p class="p-org">Harbor Notes</p>
  <p>
    <span class="p-locality">Port Example</span>,
    <span class="p-country-name">USA</span>
  </p>
</section>
```

Embed h-cards inside entries and events for authorship and hosts. Publish email addresses, precise locations, and other personal details only when you intend them to be public. A published h-card is not automatically a verified identity declaration—see [Identity and authorship]({{ '/implement/content/identity/' | relative_url }}).

## h-entry: Articles, posts and notes

`h-entry` covers articles, blog posts, short notes, and other independently published entries. Important properties include:

- `p-name`, `p-summary`, `e-content`
- `dt-published`, `dt-updated`
- `p-author`, `p-category`
- `u-url`, `u-uid`, `u-photo`
- `u-syndication`, `u-in-reply-to`, `u-like-of`, `u-repost-of`

Authoritative definition: [h-entry](https://microformats.org/wiki/h-entry).

### Complete article example

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Notes from the lab | Example Site</title>
  <link rel="canonical" href="https://joshua.example/notes/lab/">
</head>
<body>
  <article class="h-entry">
    <h1 class="p-name">Notes from the lab</h1>
    <p class="p-summary">Rebuilding a workbench and shipping a new feed.</p>
    <p>
      <a class="p-author h-card" href="https://joshua.example/about/">
        Avery Example
      </a>
    </p>
    <time class="dt-published" datetime="2026-10-01T09:30:00-07:00">
      Oct. 1, 2026
    </time>
    <p>
      <span class="p-category">indieweb</span>
      <span class="p-category">woodworking</span>
    </p>
    <div class="e-content">
      <p>I rebuilt my workbench and published a cleaner Atom feed.</p>
    </div>
    <a class="u-url" href="https://joshua.example/notes/lab/">Permalink</a>
  </article>
</body>
</html>
```

### Short-note example

Notes without a traditional title often rely on implied name behavior from content:

```html
<article class="h-entry">
  <div class="e-content"><p>Shipped the new feed.</p></div>
  <time class="dt-published" datetime="2026-10-02"></time>
  <a class="u-url" href="https://joshua.example/notes/shipped-feed/"></a>
</article>
```

### Multiple categories and dates

Repeat `p-category` for multiple values. Use `dt-published` for first publication and `dt-updated` when the entry materially changes. Pair with [semantic HTML]({{ '/implement/content/html/' | relative_url }}) and [feeds]({{ '/implement/content/feeds/' | relative_url }}) for syndication.

## h-feed: Collections of entries

`h-feed` represents a collection of `h-entry` objects—a blog homepage, notes archive, or recent-posts list in HTML.

```html
<section class="h-feed">
  <h1 class="p-name">Recent notes</h1>
  <a class="p-author h-card" href="https://joshua.example/about/">
    Avery Example
  </a>

  <article class="h-entry">
    <h2 class="p-name">
      <a class="u-url" href="https://joshua.example/notes/lab/">
        Notes from the lab
      </a>
    </h2>
    <time class="dt-published" datetime="2026-10-01">Oct. 1, 2026</time>
  </article>

  <article class="h-entry">
    <h2 class="p-name">
      <a class="u-url" href="https://joshua.example/notes/shipped-feed/">
        Shipped the new feed
      </a>
    </h2>
    <time class="dt-published" datetime="2026-10-02">Oct. 2, 2026</time>
  </article>
</section>
```

Microformats2-aware clients can extract entries from the HTML. RSS, Atom, and JSON Feed remain complementary syndication formats—you need not choose only one. Implied h-feed behavior is consumer-dependent; prefer an explicit `h-feed` when you want a clear collection. See [h-feed](https://microformats.org/wiki/h-feed) and the [Feeds]({{ '/implement/content/feeds/' | relative_url }}) chapter.

## h-event: Publishing events

`h-event` describes gatherings. Important properties include `p-name`, `p-summary`, `dt-start`, `dt-end`, `dt-duration`, `p-location`, `u-url`, and `p-category`.

```html
<article class="h-event">
  <h1 class="p-name">Harbor Notes open studio</h1>
  <time class="dt-start" datetime="2026-11-15T18:00:00-08:00">
    Nov. 15, 2026, 6:00 p.m. PST
  </time>
  <time class="dt-end" datetime="2026-11-15T20:00:00-08:00">
    8:00 p.m. PST
  </time>
  <p class="p-location h-adr">
    <span class="p-street-address">12 Pier Road</span>,
    <span class="p-locality">Port Example</span>
  </p>
  <a class="u-url" href="https://joshua.example/events/open-studio/">
    Event page
  </a>
</article>
```

Use machine-readable start and end times with time zones. Location may nest `h-adr`. RSVPs are typically separate `h-entry` posts that reference the event—see [Events]({{ '/implement/content/events/' | relative_url }}) and [h-event](https://microformats.org/wiki/h-event).

## Other Microformats2 vocabularies

| Vocabulary | Purpose |
| --- | --- |
| `h-product` | Products and attributes |
| `h-review` | Reviews and evaluations |
| `h-review-aggregate` | Aggregated review information |
| `h-recipe` | Recipes and instructions |
| `h-adr` | Postal addresses |
| `h-geo` | Geographic coordinates |
| `h-resume` | Résumé information |
| `h-listing` | Listings and classifieds |
| `h-item` | Generic items |

Vocabularies differ in maturity and adoption. Do not assume every property is equally stable, and do not assume every consumer—including Joshternet—supports every vocabulary.

```html
<div class="h-product">
  <h2 class="p-name">Folding rule</h2>
  <img class="u-photo" src="/images/rule.jpg" alt="">
  <p class="p-description">A two-meter wooden folding rule.</p>
</div>

<div class="h-review">
  <h2 class="p-name">Reliable and pocketable</h2>
  <p class="p-item h-product"><span class="p-name">Folding rule</span></p>
  <data class="p-rating" value="5">5 out of 5</data>
  <div class="e-content"><p>Stays true after years in the shop bag.</p></div>
</div>

<article class="h-recipe">
  <h1 class="p-name">Harbor oat pancakes</h1>
  <p class="p-ingredient">1 cup rolled oats</p>
  <p class="p-ingredient">1 cup milk</p>
  <div class="e-instructions"><p>Blend, rest, cook on a hot griddle.</p></div>
</article>
```

Authoritative pages: [h-product](https://microformats.org/wiki/h-product), [h-review](https://microformats.org/wiki/h-review), [h-recipe](https://microformats.org/wiki/h-recipe).

## Let websites interact with one another

IndieWeb practice often publishes interactions on a site the author controls.

### Replies

```html
<article class="h-entry">
  <p>
    In reply to
    <a class="u-in-reply-to" href="https://friend.example/notes/1/">
      this note
    </a>
  </p>
  <div class="e-content"><p>Glad the feed shipped.</p></div>
  <a class="u-url" href="https://joshua.example/notes/reply-1/"></a>
</article>
```

### Likes and reposts

```html
<a class="u-like-of" href="https://friend.example/notes/1/">Like</a>
<a class="u-repost-of" href="https://friend.example/notes/1/">Repost</a>
```

### Syndication

```html
<a class="u-syndication" href="https://social.example/status/123">
  Also posted elsewhere
</a>
```

These properties describe relationships between resources. They do not by themselves deliver notifications. [Webmention](https://www.w3.org/TR/webmention/) is a separate protocol that can communicate that a link exists. Microformats2 alone does not send Webmentions or create a distributed social network. See [Connections]({{ '/implement/content/connections/' | relative_url }}).

## Microformats2 and independent identity

Personal websites can act as primary online identities. An `h-card` profile, author attribution on entries, and stable profile URLs help compatible software understand who published what.

`rel="me"` is an HTML link relationship, not an `h-*` vocabulary, and it can coexist with h-card:

```html
<a class="u-url" rel="me" href="https://joshua.example/">Avery Example</a>
<a rel="me" href="https://github.com/example">GitHub</a>
```

Microformats2 authorship and Joshternet participation are separate systems. Neither h-card nor `rel=me` establishes Josh identity or joins a site to the Joshternet. See [Identity and authorship]({{ '/implement/content/identity/' | relative_url }}).

## How Microformats2 fits with other web standards

| System | Where data lives | Typical role |
| --- | --- | --- |
| Semantic HTML | Elements and document structure | Accessibility and baseline meaning |
| Microformats2 | Class names on HTML | Content objects and relationships |
| Open Graph | `meta` / `property` tags | Sharing previews |
| Schema.org JSON-LD | JSON in a script element | Typed graph data for many consumers |
| RSS / Atom / JSON Feed | Separate feed documents | Subscription and updates |
| Link relations | `rel` on links | Relationships such as canonical, alternate, me |

Publishers need not choose one format exclusively. A post can use semantic HTML, Microformats2, Open Graph, and JSON-LD together when dates, authors, and URLs stay consistent. See [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}) and [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}).

## Complete personal website example

Harbor Notes at `https://joshua.example/` might publish:

1. `/about/` — `h-card`
2. `/notes/lab/` — `h-entry` article with author and categories
3. `/notes/` — `h-feed` of recent notes
4. `/events/open-studio/` — `h-event`
5. `/notes/reply-1/` — reply with `u-in-reply-to`
6. The article also listing `u-syndication` to a public copy elsewhere

Link the resources with ordinary URLs and structured properties. The site remains static HTML—no Microformats-specific JavaScript runtime is required. Parse each URL with a conforming parser to confirm `items` and nested `author` / `location` objects match intent.

## Working with static sites and content management systems

Any system that emits HTML can emit Microformats2 classes: handwritten pages, Jekyll and Hugo templates, WordPress themes, and custom publishers. A plugin is not mandatory.

Example mapping in a blog template:

```html
<article class="h-entry">
  <h1 class="p-name">{{ title }}</h1>
  <time class="dt-published" datetime="{{ published_iso }}">{{ published_label }}</time>
  <div class="e-content">{{ content_html }}</div>
  <a class="u-url" href="{{ permalink }}">Permalink</a>
</article>
```

Inspect the **rendered** HTML. Template source that never reaches the browser cannot be parsed.

## Check what a parser actually sees

### Validate the HTML

Use the [Nu HTML Checker](https://validator.w3.org/nu/) for nesting and attribute errors.

### Parse the published page

Submit a public URL or HTML sample to [pin13.net/mf2](https://pin13.net/mf2/) and inspect the JSON.

### Inspect the JSON

Identify root `items`, `type`, `properties` arrays, nested objects, and `e-content` representations.

### Verify URLs, dates, and nesting

Check permalinks, relative resolution, author links, syndication targets, publication/update times, event start/end offsets, and nested cards or addresses.

### Compare consumers

A general-purpose parser may recognize markup that a particular product ignores. Official tests live at [github.com/microformats/tests](https://github.com/microformats/tests).

**Checklist:** root `h-*` present; properties inside the intended root; categories, dates, and URLs correct for h-card / h-entry / h-feed / h-event as applicable.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Missing root `h-*` | Nothing parses as an object. | Add the vocabulary root on the container. |
| Properties outside the root | Values attach to the wrong object or are dropped. | Nest properties inside the intended root. |
| Wrong prefix (`p-*` vs `u-*` vs `dt-*` vs `e-*`) | Wrong value type extracted. | Match prefix to the property kind. |
| Arbitrary CSS classes treated as mf2 | No structured data appears. | Use documented prefixes and vocabularies. |
| Ambiguous nesting | Authors/locations mis-attached. | Use explicit property + nested root patterns. |
| Missing or unstable permalinks | Consumers cannot cite the entry. | Publish a stable `u-url`. |
| Visible dates without machine-readable values | Time parsing fails or drifts. | Use `datetime` on `<time>`. |
| Confusing article dates with event dates | Wrong calendaring. | Use `dt-published` on entries; `dt-start` on events. |
| Contradictory author information | Conflicting identity signals. | Keep author mf2, OG, and JSON-LD aligned. |
| Empty property elements | Empty or useless values. | Omit empty properties or fill them. |
| `p-category` for slash-page names | Wrong layer for site sections. | Use OPML/`/slashes/` for slash conventions. |
| Confusing `rel=me` with `h-*` classes | Identity links mis-modeled. | Keep `rel=me` as a link relation. |
| Assuming markup sends notifications | No Webmentions fire. | Send Webmentions separately if desired. |
| Assuming all consumers support all vocabularies | Surprise gaps. | Validate with target consumers. |
| Publishing personal details by habit | Unintended exposure. | Share only intentional public data. |

## Microformats2 and the Joshternet

Recognizable content structures and explicit categories help compatible discovery systems interpret articles, notes, events, and relationships on independently hosted sites.

Joshternet’s hub crawl uses **selected** extractors—not a full generic Microformats2 parser. In practice it may consume `p-category` for topics, selected `h-entry` fields for activity, `h-event` with `dt-start` for events, and certain reply/repost/syndication link patterns for connections. A full `h-card` graph is not treated as crawl input today. Details belong in the [Reference]({{ '/implement/content/reference/' | relative_url }}) chapter. Markup does not guarantee indexing or featuring, and Microformats2 is not required for participation.

## Continue through the handbook

Microformats2 describes content inside HTML. Related chapters cover other layers:

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }})
- [Schema.org and JSON-LD]({{ '/implement/content/schema-org/' | relative_url }})
- [Identity and authorship]({{ '/implement/content/identity/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Connections]({{ '/implement/content/connections/' | relative_url }})
- [Events]({{ '/implement/content/events/' | relative_url }})
- [OPML and well-known slashpages]({{ '/implement/content/opml/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: OPML and well-known slashpages; next: Open Graph).

## Specifications and references

- [Microformats2 overview](https://microformats.org/wiki/microformats2)
- [Microformats2 parsing specification](https://microformats.org/wiki/microformats2-parsing)
- [Microformats2 prefixes](https://microformats.org/wiki/microformats2-prefixes)
- [h-card](https://microformats.org/wiki/h-card)
- [h-entry](https://microformats.org/wiki/h-entry)
- [h-feed](https://microformats.org/wiki/h-feed)
- [h-event](https://microformats.org/wiki/h-event)
- [h-product](https://microformats.org/wiki/h-product)
- [h-review](https://microformats.org/wiki/h-review)
- [h-recipe](https://microformats.org/wiki/h-recipe)
- [pin13 Microformats2 parser](https://pin13.net/mf2/)
- [Microformats test suite](https://github.com/microformats/tests)
- [HTML Living Standard](https://html.spec.whatwg.org/)
- [Webmention](https://www.w3.org/TR/webmention/)

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
