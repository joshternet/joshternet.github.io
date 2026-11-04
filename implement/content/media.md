---
layout: default
title: "Creative Media: Give Your Work a Home on the Web"
description: >-
  Publish photography, music, video, software, games, and books on your own
  site—with stable work URLs, accessible HTML media, Schema.org types, licensing,
  and clear separation of works, pages, files, and previews.
keywords: >-
  Photograph, VideoObject, MusicRecording, VisualArtwork, SoftwareApplication,
  creative media, accessibility, Schema.org, independent web
permalink: /implement/content/media/
nav_title: Creative media
content_id: media
matrix_id: media
seo:
  type: TechArticle
  name: Creative media
---

# Creative media

Creative work deserves more than a temporary social post or a file on someone else’s platform. A personal website can present the work, explain the ideas behind it, preserve its history, and connect visitors to related projects.

A single creation often appears as several resources: a public page, a media file, a thumbnail, a download, and structured metadata. Those resources serve different jobs. Significant works can have permanent URLs so they can be linked, credited, and discovered apart from the gallery that lists them. You control which works you expose, how they look, and what rights you grant.

## What exactly are you publishing?

| Concept | Meaning |
| --- | --- |
| Creative work | The photograph, composition, software project, book, or other creation |
| Work page | The public web page that presents or describes it |
| Media representation | An image, audio, or video file encoding the work |
| Preview | A thumbnail, poster, or excerpt |
| Collection | A gallery, album, or catalog of multiple works |
| Syndicated copy | A representation published elsewhere |

Example: **Morning Light** is a photograph (the work). `https://joshua.example/photography/morning-light/` is its page. `/images/morning-light.webp` is a visual encoding. A smaller grid image is a preview. `/photography/` is a collection. An Instagram post would be a syndicated copy—not the same as the original page.

```text
Photograph (work)
   |
   | described by
   v
Work page  ----preview---->  thumbnail / og:image
   |
   | presents
   v
Media file (JPEG / AVIF / …)
```

Do not conflate these layers.

<ol class="content-discovery-flow" aria-label="Publish a creative work">
  <li>
    <strong>Create</strong>
    <span>You make the work and choose what to publish.</span>
  </li>
  <li>
    <strong>Page</strong>
    <span>You give it a stable URL with human-readable context.</span>
  </li>
  <li>
    <strong>Represent</strong>
    <span>You attach accessible media files and previews.</span>
  </li>
  <li>
    <strong>Describe</strong>
    <span>You add credits, dates, Schema.org, and licenses as needed.</span>
  </li>
  <li>
    <strong>Collect</strong>
    <span>You link it from galleries and indexes without replacing the work page.</span>
  </li>
</ol>

## Give each creation its own address

Stable URLs support linking, discovery, attribution, citation, accessibility, portfolio structure, syndication, preservation, and migrations.

```text
/photography/
/photography/morning-light/
/photography/winter-river/

/music/
/music/first-recording/

/projects/
/projects/clockwork-garden/

/games/
/games/star-courier/
```

These paths are examples, not mandatory. A single gallery page with dozens of unlabeled images offers weaker linking and attribution than dedicated work pages. Decorative site chrome does not need its own work URL.

## Semantic HTML for creative work

Useful elements include `<main>`, `<article>`, `<section>`, `<figure>`, `<figcaption>`, `<img>`, `<picture>`, `<source>`, `<audio>`, `<video>`, `<track>`, `<a>`, `<time>`, `<details>`, and `<summary>`. Prefer meaningful media over purely decorative presentation. See [Semantic HTML]({{ '/implement/content/html/' | relative_url }}).

## Publish photography with context

A photograph page typically needs a title, description, creator, creation and/or publication dates, image representation, caption, alternative text, optional technique notes, collection links, copyright/license, and a canonical URL.

```html
<article>
  <h1>Morning Light</h1>
  <figure>
    <img
      src="https://joshua.example/images/morning-light.webp"
      alt="Sunlight passing through the branches of an oak tree"
      width="1200"
      height="800"
    >
    <figcaption>
      Morning Light, a photograph by Avery Example.
    </figcaption>
  </figure>
  <p>A photograph taken during an early morning walk.</p>
  <p>
    <time datetime="2026-09-15">Sept. 15, 2026</time>
  </p>
  <p>
    <a href="https://joshua.example/photography/">Photography</a>
  </p>
</article>
```

The image shows the work; `alt` conveys essential visual information; the caption carries credit and context; surrounding prose can narrate. Link back to the collection and sideways to related works.

## Responsive images and efficient delivery

Publish `width`/`height`, `srcset`/`sizes`, and optionally `<picture>` for formats or art direction. Use lazy loading and sensible fetch priority when appropriate. Compress thoughtfully; keep full-resolution downloads separate from grid thumbnails.

```html
<img
  src="https://joshua.example/images/morning-light-800.webp"
  srcset="
    https://joshua.example/images/morning-light-400.webp 400w,
    https://joshua.example/images/morning-light-800.webp 800w,
    https://joshua.example/images/morning-light-1200.webp 1200w
  "
  sizes="(max-width: 40rem) 100vw, 40rem"
  alt="Sunlight passing through the branches of an oak tree"
  width="1200"
  height="800"
  loading="lazy"
>
```

```html
<picture>
  <source
    type="image/avif"
    srcset="https://joshua.example/images/morning-light.avif"
  >
  <img
    src="https://joshua.example/images/morning-light.webp"
    alt="Sunlight passing through the branches of an oak tree"
    width="1200"
    height="800"
  >
</picture>
```

Resolution switching differs from art-directed crops. A thumbnail is not a substitute for a downloadable original. Measure performance; do not invent Core Web Vitals claims.

## Make visual work understandable to more people

- **Alternative text** — essential information or purpose of the image in context ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)).
- **Captions** — authorship, location, narrative that may not belong in `alt`.
- **Extended descriptions** — complex works that need a longer text nearby.
- **Titles** — naming; not a substitute for `alt`.
- **Embedded file metadata** — optional; may be stripped by optimizers.

Decorative images should be marked so assistive tech can skip them. Filename or title alone is often insufficient as `alt`.

## Image metadata: EXIF, IPTC and XMP

**EXIF** often records camera settings and capture times. **IPTC** Photo Metadata commonly carries creator, credit, copyright, and rights text. **XMP** embeds structured metadata in many formats. These can coexist. Embedded file metadata is not the same as webpage Schema.org or visible credits.

Useful fields include creator, credit line, copyright notice, rights statement, description, keywords, capture date, and digital source type. Optimizers may strip metadata. GPS and device identifiers create privacy risk—review before publishing.

## Describe where media came from

[C2PA](https://spec.c2pa.org/) Content Credentials can record signed provenance assertions about origin and processing history (bindings, edits, verification). Verification may establish integrity of signed claims; it does **not** prove a photograph depicts a true event or that every claim is accurate. Transformations can drop credentials.

As of this chapter’s verification, C2PA Technical Specification **2.4** (April 2026) is widely cited; later revisions (for example 2.5) may supersede it—check [spec.c2pa.org](https://spec.c2pa.org/). C2PA is optional; it is not required to publish creative work.

## Describe images with Schema.org

Relevant types include `CreativeWork`, `Photograph`, `VisualArtwork`, `ImageObject`, `ImageGallery`, and `MediaObject`. A **Photograph** (or VisualArtwork) is the creative work; an **ImageObject** describes a particular image file/encoding.

Useful properties: `name`, `description`, `creator`, `author`, `dateCreated`, `datePublished`, `image`, `contentUrl`, `thumbnailUrl`, `encodingFormat`, `width`, `height`, `caption`, `license`, `copyrightHolder`, `copyrightNotice`, `creditText`, `acquireLicensePage`, `mainEntityOfPage`. Match visible content. Prefer stable `@id` values.

```json
{
  "@context": "https://schema.org",
  "@type": "Photograph",
  "@id": "https://joshua.example/photography/morning-light/#work",
  "name": "Morning Light",
  "description": "Sunlight through oak branches on an early walk.",
  "url": "https://joshua.example/photography/morning-light/",
  "mainEntityOfPage": "https://joshua.example/photography/morning-light/",
  "dateCreated": "2026-09-15",
  "creator": {
    "@type": "Person",
    "name": "Avery Example",
    "url": "https://joshua.example/about/"
  },
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "image": {
    "@type": "ImageObject",
    "@id": "https://joshua.example/images/morning-light.webp#img",
    "contentUrl": "https://joshua.example/images/morning-light.webp",
    "encodingFormat": "image/webp",
    "width": 1200,
    "height": 800,
    "caption": "Morning Light, a photograph by Avery Example."
  }
}
```

## Explain how your images may be used

Distinguish creator attribution, copyright ownership, notices, licenses, permission requests, commercial licensing, public-domain dedications, and Creative Commons deeds. Schema.org licensing properties and IPTC rights fields can agree with a human-readable notice. [Google’s image licensing metadata guidance](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata) is vendor-specific—separate from the Schema.org vocabulary itself. Structured license data does not invent rights you lack; omitting a license does not make a work free to reuse.

## Visual artwork and illustration

Paintings, drawings, digital illustration, and sculpture need title, medium, technique, dates, artist, description, representative image, optional dimensions, collection, exhibition notes, and rights. Types include `VisualArtwork`, `Painting`, `Sculpture`, `CreativeWork`, and `ImageObject`. An image **of** a painting is not the physical artwork—use separate identifiers when both matter.

## Build collections without losing the individual works

Galleries and portfolios need landing copy, individual work links, navigation, dates, series, categories, thumbnails, captions, and canonical URLs. Schema.org helpers: `CollectionPage`, `ImageGallery`, `ItemList`, `ListItem`.

```html
<section>
  <h1>Photography</h1>
  <ul>
    <li>
      <a href="https://joshua.example/photography/morning-light/">
        <img
          src="https://joshua.example/images/morning-light-thumb.webp"
          alt=""
          width="240"
          height="160"
        >
        Morning Light
      </a>
    </li>
  </ul>
</section>
```

Link to work **pages**, not only static files. Not every embedded image is a distinct creative work.

## Give recordings and compositions their own pages

Separate musical **composition**, **recording**, **album**, **playlist**, **performance**, **audio file**, **artist**, and **publisher**. Schema.org types include `MusicComposition`, `MusicRecording`, `MusicAlbum`, `MusicPlaylist`, `AudioObject`, `MusicGroup`, and `Person`. Relate recordings with `recordingOf`, `inAlbum`, `byArtist`, `composer`, `duration`, `audio`, `contentUrl`, `encodingFormat`, and `license` as applicable.

### Native HTML audio

```html
<audio controls preload="metadata">
  <source
    src="https://joshua.example/audio/first-recording.opus"
    type="audio/ogg; codecs=opus"
  >
  <source
    src="https://joshua.example/audio/first-recording.mp3"
    type="audio/mpeg"
  >
  <a href="https://joshua.example/audio/first-recording.mp3">Download MP3</a>
</audio>
```

Offer transcripts for spoken word. Avoid autoplay. The player is not the descriptive page.

### Albums and tracks

Album pages can list ordered tracks that each have their own URLs. Cover art, performers, composers, release dates, and credits belong on the album or track pages. Optional MusicBrainz IDs help interoperability **only** when they identify the real release—never invent catalog numbers.

## Publish video on your own website

Give each video a stable page, title, description, creator, dates, poster, player, captions/transcript, duration, and structured data.

```html
<video
  controls
  poster="https://joshua.example/images/short-film-poster.jpg"
  width="1280"
  height="720"
  preload="metadata"
>
  <source
    src="https://joshua.example/videos/short-film.mp4"
    type="video/mp4"
  >
  <track
    kind="captions"
    src="https://joshua.example/captions/short-film-en.vtt"
    srclang="en"
    label="English"
    default
  >
</video>
```

The poster is a preview, not a separate video work.

### Captions, subtitles and transcripts

Captions, subtitles, transcripts, and audio descriptions serve different audiences ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)). Use [WebVTT](https://www.w3.org/TR/webvtt1/) with `<track>`.

```text
WEBVTT

00:00:01.000 --> 00:00:04.000
Waves against the pier at dawn.

00:00:05.000 --> 00:00:08.000
Avery: The tide table still holds.
```

### VideoObject

Schema.org `VideoObject` may use `name`, `description`, `thumbnailUrl`, `uploadDate`, `duration`, `contentUrl`, `embedUrl`, `creator`, and `publisher`. Do not invent interaction counts. [Google video structured data](https://developers.google.com/search/docs/appearance/structured-data/video) is vendor guidance. See [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}) for video sitemap extensions.

## Podcasts and spoken-word media

Publish series and episode pages with hosts, guests, dates, duration, artwork, audio, transcripts, and feed enclosures. Types: `PodcastSeries`, `PodcastEpisode`, `AudioObject`. The episode page and RSS enclosure complement each other—see [Feeds]({{ '/implement/content/feeds/' | relative_url }}).

## Show people what you've built

Software project pages can include purpose, screenshots, demos, platforms, version, dates, downloads, repository, docs, license, maintainer, and status. Distinguish `SoftwareApplication` / `WebApplication` / `MobileApplication` from `SoftwareSourceCode`. External store or GitHub links do not replace your project page’s identity.

## Games and interactive projects

Describe title, screenshots, poster, trailer, demo, platforms, controls, accessibility notes, dates, creator, downloads, source, and license. Types: `VideoGame`, `Game`, `SoftwareApplication`, `SoftwareSourceCode`. Keep a descriptive HTML page **outside** the playable canvas so visitors (and text consumers) can learn the title and credits without executing the game. JSON-LD does not make a WebGL canvas accessible by itself.

### WebGL and experiments

Surround canvas/WebGL/WebGPU work with title, description, preview, instructions, keyboard support, reduced-motion options, compatibility notes, loading/fallback content, credits, and a stable URL. Launch the experience from a clear link rather than leaving a bare canvas with no context.

## Books, comics and written creative work

Use `Book`, `CreativeWork`, `Article`, `ShortStory`, and—where appropriate—[`ComicStory`](https://schema.org/ComicStory) / related comic types on Schema.org (verify current type docs when publishing). Cover title, creators, publisher, dates, edition, optional ISBN (**never fabricate**), cover image, description, genre, language, series, samples, and purchase/download links. For comics, separate series indexes, installment pages, and panel images.

## Credit the people who made the work

Creator, author, illustrator, photographer, composer, performer, producer, developer, collaborator, publisher, and copyright holder are different roles. Multi-person projects need explicit credits and links to profile pages. Do not infer collaboration from ordinary hyperlinks alone. See [Identity]({{ '/implement/content/identity/' | relative_url }}).

## Tell visitors what they may do with your work

Ownership, attribution, copyright, licensing, and technical access differ. Projects may mix licenses (open-source code with all-rights-reserved art). Publish human-readable notices, machine-readable links, and complete license texts. A downloadable file is not an unrestricted reuse grant. See [Creative Commons](https://creativecommons.org/licenses/).

## Open Graph previews for creative work

Use valid ogp.me properties (`og:title`, `og:type`, `og:url`, `og:description`, `og:image`, `og:image:alt`, and media fields where applicable). Choose a representative preview. Tie it to the canonical work URL. Do **not** invent types like `photograph` or `game`—use documented Open Graph types (often `website` or `article`). See [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}).

## Creative work in feeds and sitemaps

Announce releases via RSS/Atom/JSON Feed (enclosures/attachments/Media RSS as appropriate). List work **pages** in XML sitemaps; image/video sitemap extensions are optional vendor/protocol extensions. Keep identifiers consistent across feed item, page, and sitemap loc. See [Feeds]({{ '/implement/content/feeds/' | relative_url }}) and [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}).

## Slash pages and creative collections

Common collection paths include `/projects/`, `/work/`, `/portfolio/`, `/photography/`, `/gallery/`, `/art/`, `/comics/`, `/music/`, `/videos/`, `/podcasts/`, `/games/`, `/apps/`, `/books/`, `/experiments/`. Conventions help organization; they do not by themselves type every child. Optional OPML slash-page manifests can advertise custom paths—see [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}) and [OPML]({{ '/implement/content/opml/' | relative_url }}). Renaming existing sites is not required.

## Complete creative publishing example

Harbor Notes at `joshua.example` might include a homepage, About, `/work/` index, `/photography/` plus `/photography/morning-light/`, a music release, a video page, a game page, a software project, and a book page. One full photograph document ties the layers together:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Morning Light — Harbor Notes</title>
    <meta
      name="description"
      content="Sunlight through oak branches—a photograph by Avery Example."
    >
    <link
      rel="canonical"
      href="https://joshua.example/photography/morning-light/"
    >
    <meta property="og:title" content="Morning Light">
    <meta property="og:type" content="website">
    <meta
      property="og:url"
      content="https://joshua.example/photography/morning-light/"
    >
    <meta
      property="og:image"
      content="https://joshua.example/images/morning-light.webp"
    >
    <meta
      property="og:image:alt"
      content="Sunlight passing through oak branches"
    >
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Photograph",
        "name": "Morning Light",
        "url": "https://joshua.example/photography/morning-light/",
        "dateCreated": "2026-09-15",
        "creator": {
          "@type": "Person",
          "name": "Avery Example",
          "url": "https://joshua.example/about/"
        },
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "image": "https://joshua.example/images/morning-light.webp"
      }
    </script>
  </head>
  <body>
    <main>
      <article>
        <h1>Morning Light</h1>
        <p>
          By
          <a rel="author" href="https://joshua.example/about/">Avery Example</a>
        </p>
        <figure>
          <img
            src="https://joshua.example/images/morning-light.webp"
            alt="Sunlight passing through the branches of an oak tree"
            width="1200"
            height="800"
          >
          <figcaption>Morning Light, September 2026.</figcaption>
        </figure>
        <p>
          Licensed
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        </p>
        <p>
          <a href="https://joshua.example/photography/">All photography</a>
        </p>
      </article>
    </main>
  </body>
</html>
```

Static hosting is enough—no required app JavaScript.

## Hosting and performance considerations

Serve correct media types, caching headers, ETags, and Range support for large files. Prefer CDNs or object storage when needed, without locking into one vendor. Do not auto-load every original into a collection grid. Provide fallbacks for unsupported codecs. Inspect with `curl -I`.

## Help your work outlive the platform that hosts it

Keep durable permalinks, redirects, original archives, backups, open formats, credit/license records, and dates. External embeds can vanish. Preserve descriptive pages even if a player moves. **Migration checklist:** inventory works → map URLs → redirect → move media → verify MIME/alt/JSON-LD → update feeds/sitemaps → spot-check OG images.

## Security and privacy

Review EXIF/IPTC for GPS and private details; respect faces and locations; keep drafts private; verify upload types (not just extensions); treat SVG and untrusted media carefully; limit hotlinking abuse; distinguish publishing from authorizing automated reuse. For crawler and AI-preference signals, see [Robots]({{ '/implement/content/robots/' | relative_url }}).

## Creative media and the Joshternet

Independently published works help people explore photography, music, video, games, software, and books across member sites. Stable work pages, accurate types, and collection links assist compatible discovery systems. No HTML pattern guarantees Showcase placement.

Joshternet may harvest allowlisted Schema.org creative types, figures, creative-index links, and Open Graph on some index paths. It prefers **work page** URLs and excludes raw media-file URLs (and common upload trees). Chrome paths such as `/uses/` and `/about/` are not treated as creative works. Harvest is not Showcase: posters, dating rules, fairness caps, and kind filters still apply. Details: [Reference]({{ '/implement/content/reference/' | relative_url }}).

## Make sure your creative work can be understood

1. Validate HTML ([Nu HTML Checker](https://validator.w3.org/nu/)).
2. Validate Schema.org JSON-LD.
3. Check Open Graph fields and image reachability.
4. Review alt text, captions, keyboard access, and contrast.
5. `curl -I` media for status and MIME type.
6. Follow collection links to real work pages.
7. Align creation vs publication dates.
8. Confirm credits and licenses.
9. Inspect embedded file metadata for privacy.
10. Spot-check mobile and slow networks.
11. Rebuild unchanged works—URLs and dates should stay stable.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Every image as a work | Noise and mis-attribution | Reserve work pages for intentional creations |
| Thumbnails without work pages | Weak linking | Dedicated URLs + captions |
| Shared canonical for many works | Duplicate confusion | One preferred URL per work |
| Broken media links | Empty presentation | Verify absolute URLs |
| File URL as the “page” | Lost context | Publish an HTML work page |
| Missing creator credit | Attribution failure | Visible + structured credits |
| Wrong Schema.org type | Misleading graph | Photograph vs ImageObject, etc. |
| Invented OG types | Invalid previews | Use ogp.me types |
| Weak/missing `alt` | Accessibility failure | Contextual alternative text |
| Caption as `alt` substitute | Wrong roles | Use both appropriately |
| Video without captions | Excludes deaf/hard-of-hearing users | WebVTT tracks |
| Bare canvas, no prose | Undiscoverable experiment | Surround with HTML context |
| Wrong MIME / codecs | Playback failure | Correct types + fallbacks |
| Full originals in grids | Slow pages | Thumbnails + optional download |
| Missing dimensions | Layout shift | width/height |
| Contradictory dates | Distrust | Separate created vs published |
| Misleading licenses | Legal confusion | Accurate notices |
| Stripped rights metadata | Lost credits | Preserve or restate on page |
| Leaked GPS EXIF | Privacy harm | Strip or review before publish |
| Embed as ownership proof | False claim | Host or license the work |
| Fake reviews/IDs/offers | Policy risk | Never invent identifiers |
| JSON-LD as discovery magic | False hope | Still need real pages + links |
| Assuming Showcase placement | Broken expectations | Harvest ≠ feature guarantee |
| Only external platforms | Link rot | Keep a durable home page |
| Breaking work URLs | Dead citations | Redirects on redesign |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }})
- [Schema.org]({{ '/implement/content/schema-org/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [XML Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Identity and authorship]({{ '/implement/content/identity/' | relative_url }})
- [Connections]({{ '/implement/content/connections/' | relative_url }})
- [Events]({{ '/implement/content/events/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Connections; next: Events).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [HTML Living Standard](https://html.spec.whatwg.org/) | HTML media elements |
| [MDN: Images & multimedia](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements) | Element reference |
| [Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images) | srcset / picture |
| [HTML audio](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio) | Audio element |
| [HTML video](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video) | Video element |
| [HTML track](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track) | Text tracks |
| [WebVTT](https://www.w3.org/TR/webvtt1/) | Captions format |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility |
| [Schema.org CreativeWork](https://schema.org/CreativeWork) | Base creative type |
| [Photograph](https://schema.org/Photograph) | Photographs |
| [VisualArtwork](https://schema.org/VisualArtwork) | Visual art |
| [ImageObject](https://schema.org/ImageObject) | Image encodings |
| [MediaObject](https://schema.org/MediaObject) | Media encodings |
| [MusicRecording](https://schema.org/MusicRecording) | Recordings |
| [MusicComposition](https://schema.org/MusicComposition) | Compositions |
| [VideoObject](https://schema.org/VideoObject) | Video |
| [PodcastEpisode](https://schema.org/PodcastEpisode) | Episodes |
| [SoftwareApplication](https://schema.org/SoftwareApplication) | Applications |
| [VideoGame](https://schema.org/VideoGame) | Games |
| [Book](https://schema.org/Book) | Books |
| [ComicStory](https://schema.org/ComicStory) | Comics (verify current docs) |
| [Open Graph](https://ogp.me/) | Link previews |
| [IPTC Photo Metadata](https://iptc.org/standards/photo-metadata/) | Embedded photo rights |
| [C2PA specifications](https://spec.c2pa.org/) | Content Credentials |
| [Creative Commons licenses](https://creativecommons.org/licenses/) | Reuse licenses |
| [CC technical marking](https://wiki.creativecommons.org/wiki/Marking_Works_Technical) | Marking guidance |
| [Google image licensing metadata](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata) | Vendor guidance |
| [Google video structured data](https://developers.google.com/search/docs/appearance/structured-data/video) | Vendor guidance |
| [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) | Feed attachments |
| [RSS 2.0](https://www.rssboard.org/rss-specification) | Enclosures |
| [XML Sitemaps](https://www.sitemaps.org/protocol.html) | URL advertising |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
