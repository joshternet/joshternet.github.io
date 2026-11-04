---
layout: default
title: "Open Graph: Give Your Content a Better Introduction"
description: >-
  Describe pages as Open Graph objects—titles, types, URLs, images, and
  optional article, music, video, and book metadata—so compatible apps can
  build accurate previews of independently hosted content.
keywords: >-
  Open Graph, ogp.me, og:title, og:image, og:type, social preview, RDFa,
  independent web, web publishing
permalink: /implement/content/open-graph/
nav_title: Open Graph
content_id: open-graph
matrix_id: open-graph
seo:
  type: TechArticle
  name: Open Graph
---

# Open Graph

When someone shares a URL, the receiving application often tries to build a preview. Without structured metadata, it may guess which title, image, and description best represent the resource—and guess poorly.

The [Open Graph Protocol](https://ogp.me/) provides a shared vocabulary for describing a web page as an object. Compatible applications can identify the content’s title, type, URL, description, images, and related fields. The protocol originated at Facebook and is now used across many apps and services.

Implementing Open Graph does not transfer ownership of your content to a platform. You still control the page, its metadata, and the resources it references. Consumers may interpret properties differently and are not required to display every field. Valid Open Graph markup does not guarantee a preview, indexing, rankings, or featuring.

## Where Open Graph came from

Open Graph was designed so ordinary web pages could participate in a social graph with enough structured information to represent an object richly. It builds on RDFa-style metadata: namespaced properties expressed as HTML `<meta>` elements, normally in the document `<head>`.

The authoritative specification is published at [ogp.me](https://ogp.me/). It is a protocol specification, not a W3C Recommendation or an IETF RFC. Platform link-preview rules (image sizes, refresh schedules, debugging tools) are separate from the protocol itself. Publishers can implement valid Open Graph and still see different results across consumers.

## Describe a page as an object

Open Graph metadata lives in the HTML of the page that represents the object:

```html
<meta property="og:title" content="Notes from the lab">
```

- `<meta>` carries a property declaration.
- `property` names the Open Graph field (not the HTML `name` attribute used for ordinary descriptions).
- `content` holds the value.
- The `og:` prefix identifies the Open Graph namespace.
- The property name (such as `title`) identifies which field you are setting.

A minimal document:

```html
<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="utf-8">
  <title>Example Site</title>
  <meta property="og:title" content="Example Site">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://joshua.example/">
  <meta
    property="og:image"
    content="https://joshua.example/images/preview.jpg"
  >
</head>
<body>
  <main>
    <h1>Example Site</h1>
    <p>Writing, projects, and other experiments.</p>
  </main>
</body>
</html>
```

The `prefix` attribute declares the Open Graph namespace. The four core properties identify the object. The visible `<h1>` and body remain ordinary HTML for people.

## The foundation of an Open Graph object

The protocol identifies four required properties for every page.

| Property | Role | Example |
| --- | --- | --- |
| `og:title` | Title of the object as it should appear in the graph | `Notes from the lab` |
| `og:type` | Kind of object | `article`, `website`, `music.song` |
| `og:image` | Absolute URL of a representing image | `https://joshua.example/images/workbench.jpg` |
| `og:url` | Canonical object URL / permanent ID in the graph | `https://joshua.example/notes/lab/` |

### og:title

Supplies the object title. It often resembles the HTML `<title>` and visible `<h1>` but need not be identical word for word. Prefer a title for the specific page (article, project, homepage), not a slogan reused everywhere.

### og:type

Identifies the object kind. Use documented types such as `website` and `article`, or specialized types in music and video verticals. Do not invent global types consumers will not recognize.

### og:image

Points at an image that represents the object. Use an absolute `http` or `https` URL, a suitable MIME type, and a publicly reachable resource. Individual applications may impose their own size and aspect preferences.

### og:url

Identifies the canonical URL of the object. Keep it consistent with permanent redirects and with HTML `rel="canonical"` when you publish one. Conflicting URLs confuse consumers about which resource is canonical. See [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }}).

## Provide a more useful description

Optional properties recommended by the protocol include:

| Property | Purpose |
| --- | --- |
| `og:description` | One- or two-sentence summary of the object |
| `og:site_name` | Name of the overall site when the object is part of a larger site |
| `og:locale` | Locale of the tags, as `language_TERRITORY` (default `en_US`) |
| `og:locale:alternate` | Other locales this page is available in |
| `og:determiner` | Word before the title in a sentence (`a`, `an`, `the`, `""`, `auto`) |
| `og:audio` | URL of audio that accompanies the object |
| `og:video` | URL of video that complements the object |

Describe the **specific page**, not a generic site slogan. Distinguish `og:site_name` (Harbor Notes) from `og:title` (Notes from the lab). Open Graph locales use underscores (`en_US`, `en_GB`); HTML `lang` usually uses BCP 47 tags (`en`, `en-US`). A media URL does not guarantee embedded playback.

## Make your preview images reliable

Structured image properties refine `og:image`:

- `og:image:url` — identical to `og:image`
- `og:image:secure_url` — HTTPS alternate when useful
- `og:image:type` — MIME type
- `og:image:width` / `og:image:height` — actual pixel dimensions
- `og:image:alt` — description of what is in the image (not a caption)

```html
<meta
  property="og:image"
  content="https://joshua.example/images/workbench.jpg"
>
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta
  property="og:image:alt"
  content="A wooden workbench with two monitors and a laptop"
>
```

Dimensions should match the real file. `og:image:alt` is alternative text for the image content, not the filename. **1200×630** is a commonly used preview size among some platforms—not a universal Open Graph requirement. Similar structured properties exist for `og:video` and (partially) `og:audio`.

## What happens when there is more than one value?

Repeat a property to create an array. The first value is preferred when values conflict:

```html
<meta property="og:image" content="https://joshua.example/images/primary.jpg">
<meta property="og:image" content="https://joshua.example/images/secondary.jpg">
```

Structured properties attach to the preceding root. When another root begins, the previous structured group ends.

Correct grouping:

```html
<meta property="og:image" content="https://joshua.example/images/a.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image" content="https://joshua.example/images/b.jpg">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="800">
```

Incorrect: declaring two images, then a single height that consumers may attach only to the last image. Put each image’s structured fields immediately after that image’s root tag.

## Describe what kind of content you're publishing

Object types are either globally defined or namespaced extensions. Global vertical types use a period (`music.song`, `video.movie`). Custom namespaces use CURIEs with colons.

### website

Default treatment for unmarked pages and ordinary site roots. No extra vertical properties beyond the basics.

### article

Writing with optional `article:*` properties (below). Namespace: `https://ogp.me/ns/article#`.

### profile

People-oriented objects with `profile:*` properties. Namespace documented on ogp.me.

### book

Published books with `book:*` properties.

### Music

Namespace `https://ogp.me/ns/music#`. Types include `music.song`, `music.album`, `music.playlist`, and `music.radio_station`, with properties such as `music:duration`, `music:album`, `music:musician`, `music:song`, and `music:release_date`.

### Video

Namespace `https://ogp.me/ns/video#`. Types include `video.movie`, `video.episode`, `video.tv_show`, and `video.other`, with properties such as `video:actor`, `video:director`, `video:duration`, `video:release_date`, `video:tag`, and `video:series`.

Do not invent unsupported globals such as `game`, `photograph`, or `software`. When Open Graph lacks a precise type, use a valid general representation (often `website`) and add [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}) for finer typing.

## Describe published writing

Article properties:

| Property | Meaning |
| --- | --- |
| `article:published_time` | First publication (ISO 8601 datetime) |
| `article:modified_time` | Last change |
| `article:expiration_time` | When the article is considered out of date |
| `article:author` | Author profile URL(s) |
| `article:section` | High-level section (for example Technology) |
| `article:tag` | Topical tags for the article |

`article:tag` describes article topics—not slash-page categories or URL conventions. Visible HTML dates should agree with these fields.

```html
<meta property="og:title" content="Notes from the lab">
<meta property="og:type" content="article">
<meta property="og:url" content="https://joshua.example/notes/lab/">
<meta property="og:image" content="https://joshua.example/images/workbench.jpg">
<meta property="og:description" content="Rebuilding a workbench and shipping a cleaner Atom feed.">
<meta property="og:site_name" content="Harbor Notes">
<meta property="article:published_time" content="2026-10-01T09:30:00-07:00">
<meta property="article:modified_time" content="2026-10-03T11:00:00-07:00">
<meta property="article:author" content="https://joshua.example/about/">
<meta property="article:section" content="Lab notes">
<meta property="article:tag" content="indieweb">
<meta property="article:tag" content="woodworking">
```

## Profile metadata

`profile` may use `profile:first_name`, `profile:last_name`, `profile:username`, and `profile:gender` (enum `male` / `female` per the current specification). Treat these as optional. Do not publish personal attributes merely because the protocol defines them.

Profile Open Graph differs from [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}) `h-card`, Schema.org `Person`, and HTML `rel="me"`. Those systems can coexist when they describe the same person consistently.

## Music metadata

Example song on an independent site:

```html
<meta property="og:title" content="Pier Lights">
<meta property="og:type" content="music.song">
<meta property="og:url" content="https://joshua.example/music/pier-lights/">
<meta property="og:image" content="https://joshua.example/images/pier-lights.jpg">
<meta property="og:audio" content="https://joshua.example/audio/pier-lights.mp3">
<meta property="music:duration" content="214">
<meta property="music:musician" content="https://joshua.example/about/">
<meta property="music:release_date" content="2026-09-01">
```

Metadata describes the release; the audio file is a separate resource. Consumers may show a preview without playing audio.

## Video metadata

```html
<meta property="og:title" content="Harbor fog, reel one">
<meta property="og:type" content="video.other">
<meta property="og:url" content="https://joshua.example/videos/harbor-fog/">
<meta property="og:image" content="https://joshua.example/images/harbor-fog-poster.jpg">
<meta property="og:video" content="https://joshua.example/videos/harbor-fog.mp4">
<meta property="og:video:type" content="video/mp4">
<meta property="video:duration" content="180">
<meta property="video:release_date" content="2026-08-12">
<meta property="video:tag" content="documentary">
```

Protocol validity differs from whether an application embeds the video. Prefer public HTTPS media URLs and a clear poster image.

## Books and other published works

```html
<meta property="og:title" content="Notes on Quiet Machines">
<meta property="og:type" content="book">
<meta property="og:url" content="https://joshua.example/books/quiet-machines/">
<meta property="og:image" content="https://joshua.example/images/quiet-machines-cover.jpg">
<meta property="book:author" content="https://joshua.example/about/">
<meta property="book:isbn" content="9780000000000">
<meta property="book:release_date" content="2026-05-01">
<meta property="book:tag" content="essays">
```

Photography, software, games, and digital artwork may lack a dedicated global Open Graph type. Use accurate core properties (often `website` or `article` when appropriate) and add Schema.org types such as `Photograph`, `SoftwareApplication`, or `VideoGame` when you need precision. Do not invent Open Graph types.

## Complete implementation example: A published article

```html
<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Notes from the lab | Harbor Notes</title>
  <meta
    name="description"
    content="Rebuilding a workbench and shipping a cleaner Atom feed."
  >
  <link rel="canonical" href="https://joshua.example/notes/lab/">

  <meta property="og:title" content="Notes from the lab">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://joshua.example/notes/lab/">
  <meta
    property="og:image"
    content="https://joshua.example/images/workbench.jpg"
  >
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta
    property="og:image:alt"
    content="A wooden workbench with two monitors and a laptop"
  >
  <meta
    property="og:description"
    content="Rebuilding a workbench and shipping a cleaner Atom feed."
  >
  <meta property="og:site_name" content="Harbor Notes">
  <meta property="og:locale" content="en_US">
  <meta
    property="article:published_time"
    content="2026-10-01T09:30:00-07:00"
  >
  <meta
    property="article:modified_time"
    content="2026-10-03T11:00:00-07:00"
  >
  <meta property="article:author" content="https://joshua.example/about/">
  <meta property="article:section" content="Lab notes">
  <meta property="article:tag" content="indieweb">
  <meta property="article:tag" content="woodworking">
</head>
<body>
  <header>
    <p><a href="https://joshua.example/">Harbor Notes</a></p>
    <nav aria-label="Site">
      <a href="https://joshua.example/notes/">Notes</a>
      <a href="https://joshua.example/about/">About</a>
    </nav>
  </header>
  <main>
    <article>
      <h1>Notes from the lab</h1>
      <p>
        Published
        <time datetime="2026-10-01T09:30:00-07:00">Oct. 1, 2026</time>
      </p>
      <p>
        I rebuilt my workbench and published a cleaner Atom feed.
      </p>
    </article>
  </main>
</body>
</html>
```

Core `og:*` fields identify the object; `article:*` fields add publication context; the body remains readable without JavaScript. Canonical and `og:url` match.

## Examples for other content types

**Homepage (`website`):**

```html
<meta property="og:title" content="Harbor Notes">
<meta property="og:type" content="website">
<meta property="og:url" content="https://joshua.example/">
<meta property="og:image" content="https://joshua.example/images/site.jpg">
<meta property="og:description" content="Writing, photos, and small projects.">
<meta property="og:site_name" content="Harbor Notes">
```

**Photography project:** use strong `og:image` / description / URL with `website` (or `article` if it is a write-up), then Schema.org `Photograph` or `ImageGallery` for specificity.

**Music / video / book:** use the examples in the sections above.

**Software or game:** valid general Open Graph (often `website`) plus Schema.org `SoftwareApplication` or `VideoGame`—not invented `og:type` values.

## How Open Graph complements the page itself

| Metadata | Purpose |
| --- | --- |
| HTML `<title>` | Document identity |
| Meta description | General page summary |
| Canonical link | Preferred resource URL |
| `og:title` | Object title for compatible consumers |
| `og:description` | Object summary |
| `og:image` | Object preview image |
| `og:url` | Canonical object identity |
| `og:type` | Object classification |

Values may differ slightly while describing the same resource. Contradictions—different titles, mismatched dates, or an `og:url` that disagrees with `rel="canonical"`—should be corrected so people and machines see one story.

## Open Graph versus Microformats2 and Schema.org

- **[Microformats2]({{ '/implement/content/microformats2/' | relative_url }})** marks structure in HTML content (entries, authors, dates, relationships).
- **[Schema.org]({{ '/implement/content/schema-org/' | relative_url }})** provides a broad typed vocabulary, often serialized as **JSON-LD**.
- **Open Graph** focuses on the object associated with a page for compatible graph/preview consumers.

The same article can use all three when titles, authors, dates, and URLs stay aligned.

## Open Graph isn't the only preview system

Some services consume Open Graph; others also recognize platform-specific cards. [X (Twitter) Cards](https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards) are not part of the Open Graph Protocol. Properties such as `twitter:card`, `twitter:title`, `twitter:description`, and `twitter:image` are vendor metadata that can coexist with `og:*` tags. Fallback behavior differs by platform—do not assume one mapping.

```html
<meta property="og:title" content="Notes from the lab">
<meta property="og:description" content="Rebuilding a workbench.">
<meta property="og:image" content="https://joshua.example/images/workbench.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Notes from the lab">
<meta name="twitter:image" content="https://joshua.example/images/workbench.jpg">
```

## Making previews reliable

- Public HTTPS page and image URLs
- Successful HTTP status codes
- Reachable images with correct MIME types and accurate dimensions
- Sensible aspect ratios for your audience’s common consumers
- Clear redirect chains that land on the intended resource
- Open Graph tags present in the **server-delivered** HTML
- Canonical / `og:url` consistency
- Robots rules that allow intended fetches
- Awareness that preview caches refresh on consumer schedules

An image that loads in your browser can still fail for a preview bot blocked by hotlink rules, auth walls, or redirects. Updating a page does not always update a cached preview immediately.

## Open Graph and independent publishing

Open Graph lets independently hosted articles, photographs, projects, music, and videos present informative link previews in directories, chats, and social environments—without uploading the originals to a central platform. Metadata stays on the publisher-controlled site. An account on the consuming service is not required to publish the tags.

## Security and privacy considerations

Metadata is public. Avoid leaking unpublished drafts, sensitive images, profile attributes you did not intend to share, URLs with secrets or tokens, private images referenced from public pages, or metadata that contradicts access controls. Escape attribute values safely. Review Open Graph with the same care as visible content.

## Check how your page is represented

### Inspect the published HTML

View Source and confirm `og:*` properties appear in the delivered head—not only in a client-rendered shell.

### Verify HTTP responses

```bash
curl -i https://joshua.example/notes/lab/
curl -I https://joshua.example/images/workbench.jpg
```

### Inspect metadata and images

Confirm property values, absolute image URLs, content types, and dimensions.

### Check canonical URLs

Compare `og:url`, `rel="canonical"`, and the live address.

### Test previews

Use current platform debuggers where available (for example Facebook’s sharing debugger and other vendor tools). Requirements change—verify the tool you use still applies.

### Cached results and HTML validation

Expect stale previews until a consumer refreshes. The [Nu HTML Checker](https://validator.w3.org/nu/) catches document errors; it does not fully validate the Open Graph object model.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Missing core properties | Weak or empty object representation | Set title, type, image, and url |
| Invented `og:type` values | Consumers ignore or misclassify | Use documented types |
| Relative `og:image` | Broken previews | Use absolute HTTPS URLs |
| Inaccessible images / wrong MIME | Preview fails | Fix hosting and types |
| Wrong dimensions | Misleading layout hints | Match real pixel size |
| Missing `og:image:alt` | Weaker accessibility for the image object | Describe the image content |
| Conflicting canonical and `og:url` | Ambiguous identity | Align permanent URLs |
| Generic metadata on every page | Previews look identical | Per-page titles and descriptions |
| Mis-ordered multi-image structured props | Dimensions attach to the wrong image | Group fields under each root |
| Invalid dates | Time parsing fails | Use ISO 8601 |
| `article:tag` as slash-page names | Wrong layer for site sections | Use tags for topics; OPML for slash conventions |
| `name="og:title"` instead of `property` | Many consumers miss the field | Use `property="og:…"` |
| Assuming all properties render | Surprise omissions | Treat display as consumer-specific |
| Expecting instant cache refresh | Old previews persist | Re-debug / wait for consumer refresh |
| Sensitive data in metadata | Unintended disclosure | Publish only intentional public facts |
| Treating Twitter Card tags as Open Graph | Spec confusion | Keep vendor tags separate |

## Open Graph and the Joshternet

Accurate page metadata helps independent sites present recognizable titles, descriptions, and images across the open web—including surfaces that participate in Joshternet discovery.

Joshternet’s hub crawl consumes a **subset** of Open Graph signals (for example site/page titles and descriptions, selected images, limited type/url usage on creative indexes, and `article:published_time` when present). It is not a complete Open Graph protocol consumer. Properties such as `og:locale`, `og:video`, `og:audio`, and `og:image:alt` are not discovery drivers here today. See [Reference]({{ '/implement/content/reference/' | relative_url }}). Markup does not guarantee indexing or featuring.

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Schema.org and JSON-LD]({{ '/implement/content/schema-org/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Microformats2; next: Schema.org and JSON-LD).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [Open Graph Protocol](https://ogp.me/) | Protocol specification |
| [Open Graph namespace](https://ogp.me/ns) | RDF schema for `og:` |
| [HTML Living Standard](https://html.spec.whatwg.org/) | Document structure and metadata |
| [RDFa Core 1.1](https://www.w3.org/TR/rdfa-core/) | RDFa foundations OG builds on |
| [Schema.org](https://schema.org/) | Broader typed vocabulary |
| [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) | Common Schema.org serialization |
| [Microformats2](https://microformats.org/wiki/microformats2/) | In-HTML structured data |
| [Nu HTML Checker](https://validator.w3.org/nu/) | HTML conformance (not full OG validation) |
| [X Cards documentation](https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards) | Platform-specific preview metadata |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
