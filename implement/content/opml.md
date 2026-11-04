---
layout: default
title: "OPML: Give Your Website a Machine-Readable Directory"
description: >-
  Publish an optional OPML 2.0 catalog at /.well-known/slashpages so software
  can find your slash pages—including custom URLs, categories, aliases, and
  includes—without guessing paths.
keywords: >-
  OPML, OPML 2.0, /.well-known/slashpages, slash pages, well-known URI,
  feed subscription lists, independent web, machine-readable directory
permalink: /implement/content/opml/
nav_title: OPML and /.well-known/slashpages
content_id: opml
matrix_id: opml
seo:
  type: TechArticle
  name: OPML and /.well-known/slashpages
---

# OPML

OPML—Outline Processor Markup Language—is an XML format for exchanging hierarchical outlines and collections of links. An outline entry can carry a readable label, a destination URL, categories, and nested children. Feed readers adopted OPML to export and import RSS subscription lists. The same format can describe the [slash pages]({{ '/implement/content/slashpages/' | relative_url }}) on a personal website.

`/.well-known/slashpages` is a predictable place where software can look for that directory without guessing every path. The manifest is optional. It does not replace ordinary navigation, hyperlinks, feeds, or XML sitemaps. Participation in Joshternet still depends only on a valid `/.well-known/josh` declaration.

## Where OPML came from

OPML began in outlining software as a way to move hierarchical notes between applications. Because outlines map cleanly onto lists of named links, feed readers and publishing tools reused OPML for subscription lists: each outline points at a feed, often with a human title and a feed URL.

[OPML 2.0](https://opml.org/spec2.opml) defines that document format independently of slash-page discovery. The newer `/.well-known/slashpages` idea layers community conventions on top of OPML 2.0 so a site can advertise slash-page URLs and categories in one file.

[RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) defines the `.well-known` URI location framework. It does not assign meaning to every possible path under `/.well-known/`. Matthias Pfefferle’s [well-known-slashpages](https://github.com/pfefferle/well-known-slashpages) proposal describes how to publish slash-page catalogs at `/.well-known/slashpages`. As of this writing, **`slashpages` is not listed in the [IANA Well-Known URI Registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)**. Treat the proposal as a developing community specification with a provisional registration intention, not as an IANA-registered standard.

## How an OPML document is organized

### XML declaration

Many OPML files begin with an XML declaration that states the version and character encoding:

```xml
<?xml version="1.0" encoding="UTF-8"?>
```

UTF-8 is the usual choice for public web resources. If you declare an encoding, the bytes you publish must match it.

### `<opml>`

The root element is `<opml>`. For OPML 2.0, set `version="2.0"`:

```xml
<opml version="2.0">
  …
</opml>
```

### `<head>`

The head holds document metadata such as a title and modification date. Useful fields for a slash-page catalog include a clear title and `dateModified` when you maintain it. Outline-editor fields aimed at desktop apps are optional for web catalogs.

### `<body>`

The body contains the outline tree—the entries that matter to consumers.

### `<outline>`

Each outline is an entry. Nested outlines create hierarchy. A minimal linked entry looks like:

```xml
<body>
  <outline text="About" />
</body>
```

That outline has a label but no URL yet. Slash-page catalogs add `type`, `url`, and usually `category`, as shown below.

## Complete OPML property reference

| Attribute | Source | Role |
| --- | --- | --- |
| `text` | OPML 2.0 (required on outlines) | Human-readable label for the node. |
| `type` | OPML 2.0 | Node kind. Slash-page entries use `link`. Feed lists often use `rss`. Includes use `include`. |
| `url` | OPML 2.0 / slashpages proposal | Destination for link-style nodes and include targets. Slash-page catalogs require a usable absolute page URL. |
| `category` | OPML 2.0 | Slash-page convention name(s), such as `/now`. Comma-separated for aliases. |
| `title` | OPML 2.0 | Optional title; feed outlines sometimes use it alongside `text`. |
| `description` | OPML 2.0 | Optional longer description. |
| `xmlUrl` | OPML 2.0 (feeds) | Feed document URL for subscription outlines. |
| `htmlUrl` | OPML 2.0 (feeds) | Related HTML homepage for a feed. |
| `created` | OPML 2.0 | Optional creation timestamp for a node. |
| `isComment` | OPML 2.0 | Marks a node as a comment in outline editors. |
| `isBreakpoint` | OPML 2.0 | Outline-editor breakpoint flag; rarely needed for web catalogs. |

OPML 2.0 requires `text` on outline elements. The slash-page convention additionally expects a usable `url` and `type="link"` for page entries.

Do not treat `url`, `xmlUrl`, and `htmlUrl` as interchangeable. Subscription outlines commonly use `type="rss"` with `xmlUrl` (and often `htmlUrl`). Slash-page catalogs use `type="link"` with `url`. Not every OPML document is a slash-page catalog.

## Create your first OPML document

### Step 1: Decide what to list

Start with real, publicly accessible pages. A fictional site might publish `/about/`, `/now/`, `/uses/`, `/blogroll/`, `/projects/`, and `/colophon/`. Empty placeholders waste readers’ time and confuse crawlers.

### Step 2: Create the OPML file

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Slash pages of joshua.example</title>
    <dateModified>Thu, 01 Oct 2026 12:00:00 GMT</dateModified>
  </head>
  <body>
    <outline
      type="link"
      text="About me"
      category="/about"
      url="https://joshua.example/about/"
    />
    <outline
      type="link"
      text="What I'm doing now"
      category="/now"
      url="https://joshua.example/now/"
    />
    <outline
      type="link"
      text="Tools I use"
      category="/uses"
      url="https://joshua.example/uses/"
    />
    <outline
      type="link"
      text="My blogroll"
      category="/blogroll"
      url="https://joshua.example/blogroll/"
    />
    <outline
      type="link"
      text="Things I've built"
      category="/projects"
      url="https://joshua.example/projects/"
    />
    <outline
      type="link"
      text="How this site is made"
      category="/colophon"
      url="https://joshua.example/colophon/"
    />
  </body>
</opml>
```

Substitute your own absolute HTTPS URLs. The `text` values are labels; `category` names the slash-page convention; `url` is the public page.

### Step 3: Publish the file

Publish the document at:

```text
https://joshua.example/.well-known/slashpages
```

The path is extensionless and does **not** end with a trailing slash.

- **Handwritten static site:** Place the bytes at `.well-known/slashpages` in the published root (configure the host so that path is served without forcing `.opml` or a directory index).
- **Static-site generator:** Keep a source file such as `slashpages.opml` and copy or emit it to the extensionless public path during the build.
- **Dynamic site:** Serve the same path from your router or static asset pipeline with the correct content type.

### Step 4: Set the response type

The slash-page proposal recognizes:

- `text/x-opml` (preferred for a purpose-specific OPML resource)
- `application/xml`
- `text/xml`

### Step 5: Verify the published resource

```bash
curl -i https://joshua.example/.well-known/slashpages
```

Confirm status 200, an appropriate content type, the XML declaration, `<opml version="2.0">`, and outline URLs that match live pages.

## Tell readers what each page represents

The `category` attribute associates a listed URL with a recognizable slash-page convention such as `/about`, `/now`, `/uses`, `/colophon`, `/blogroll`, `/games`, or `/photography`.

Categories name the **role of the page**, not every subject mentioned inside it. A `/uses` page may discuss programming, photography, and music production; its category is still `/uses`. Prefer lowercase conventional names with a leading slash. See [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}) for the broader catalog of common paths.

## Multiple categories and aliases

OPML allows comma-separated category strings. Use them for aliases of the **same** page:

```xml
<outline
  type="link"
  text="Website changelog"
  category="/changelog,/log"
  url="https://joshua.example/log/"
/>
```

Those categories are aliases, not two separate resources. Put the preferred conventional name first when order can communicate preference. Do not attach unrelated conventions to one URL. Watch XML whitespace and escape `&` as `&amp;` inside attribute values.

## Your pages don't have to follow conventional URLs

Established sites need not reorganize paths to adopt the convention. A current-status page at `https://joshua.example/updates/current/` can be described as `/now`:

```xml
<outline
  type="link"
  text="What I'm working on"
  category="/now"
  url="https://joshua.example/updates/current/"
/>
```

The category is the convention; the `url` is the actual resource. The community proposal calls for absolute URLs for portability. Prefer absolute URLs even when a particular parser can resolve relatives. Keep those URLs consistent with your canonical page addresses ([SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})).

## Nested outlines and hierarchical catalogs

OPML supports nesting. Grouping nodes can organize About, Writing, Creative work, and Website information for outline applications:

```xml
<body>
  <outline text="About the author">
    <outline
      type="link"
      text="About"
      category="/about"
      url="https://joshua.example/about/"
    />
  </outline>
  <outline text="Writing">
    <outline
      type="link"
      text="Notes"
      category="/notes"
      url="https://joshua.example/notes/"
    />
  </outline>
</body>
```

Structural grouping nodes typically have `text` without a page `url`. Linked slash-page entries carry `type="link"` and `url`. Some consumers flatten hierarchies or support only certain node types—do not assume every application preserves nesting.

## Organize larger catalogs with includes

OPML 2.0 defines inclusion. An outline with `type="include"` and a `url` pointing at another OPML document can pull in a subtree:

```xml
<outline
  type="include"
  text="Creative work"
  url="https://joshua.example/slashpages/creative.opml"
/>
```

Includes help when directories are large or generated separately. The OPML specification also describes historical behavior for some `type="link"` entries that point at `.opml` resources; individual consumers differ in what they expand. Circular includes, repeated documents, deep nesting, and unnecessary network requests create risk. Keep ordinary manifests simple and use includes only when needed.

## Keep ownership and discovery clear

OPML can list URLs on your site and URLs elsewhere. Cross-origin references may appear in a manifest, but a consumer must not assume those pages are owned by the publisher merely because they are listed.

Distinguish:

- A page on the current website.
- A page on an affiliated domain you control.
- A third-party resource.
- An included OPML document hosted elsewhere.

Consumers may apply different policies to each case. Keep the primary manifest focused on your own slash pages. Use ordinary hyperlinks or [identity]({{ '/implement/content/identity/' | relative_url }}) metadata for external relationships. A cross-origin link does not establish ownership, membership, or Joshternet participation.

## Make OPML available to browser-based tools

Some browser applications need Cross-Origin Resource Sharing (CORS) permission to read a manifest from another origin. The slash-page proposal recommends:

```http
Access-Control-Allow-Origin: *
```

That header allows browser-based clients to read a public resource across origins, subject to normal browser rules. Public server-side crawlers generally do not need CORS to fetch an HTTP resource. Configure headers on your static host or reverse proxy when you care about browser tools. See the [Fetch standard](https://fetch.spec.whatwg.org/) for CORS behavior.

## OPML and ordinary website navigation

A machine-readable manifest supplements human navigation; it does not replace it.

| Resource | Main purpose |
| --- | --- |
| `/slashes/` | Directory of slash pages for people |
| `/.well-known/slashpages` | Machine-readable slash-page catalog |
| `sitemap.xml` | URL list to assist crawler discovery |
| RSS, Atom, JSON Feed | Publish and subscribe to updates |
| HTML navigation | Ordinary links for visitors and crawlers |

A site can publish all five without duplicating roles. Use `/slashes/` for readable explanations, OPML for declared categories and URLs, sitemaps for broad crawl hints, feeds for updates, and HTML links everywhere people browse. See [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}) and [Feeds]({{ '/implement/content/feeds/' | relative_url }}).

## OPML has other useful jobs

OPML remains a common way to export and import feed subscriptions:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Example Site subscriptions</title>
  </head>
  <body>
    <outline
      type="rss"
      text="Harbor Notes"
      title="Harbor Notes"
      xmlUrl="https://joshua.example/feed.xml"
      htmlUrl="https://joshua.example/"
    />
  </body>
</opml>
```

Here `xmlUrl` is the feed, and `htmlUrl` is the related site. Blogrolls and curated directories often use similar outlines. The slash-page convention is one specialized use of a general format. See [Feeds]({{ '/implement/content/feeds/' | relative_url }}) and [Connections]({{ '/implement/content/connections/' | relative_url }}).

## Security and privacy

List only resources you intentionally make public. Do not include unpublished drafts, private endpoints, credentials, or personal information you do not mean to expose.

Be careful with cross-origin links (they are not ownership claims), include loops and deep nesting, oversized documents, unsafe URL schemes, surprising redirects, and robots policies that block pages you still advertise. Secure consumers should disable external XML entity resolution and enforce size and nesting limits so malicious entity expansion cannot become an attack surface. This chapter is about publishing safely—not specifying any particular crawler’s internals.

## Complete implementation example

**Harbor Notes** publishes a human `/slashes/` page and a matching well-known OPML document. Categories include `/about`, `/now`, and `/uses`. A custom status URL is categorized as `/now`. The changelog uses aliases. Creative work is pulled in with an include.

Well-known manifest (illustrative):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Slash pages of joshua.example</title>
    <dateModified>Thu, 01 Oct 2026 12:00:00 GMT</dateModified>
  </head>
  <body>
    <outline
      type="link"
      text="About"
      category="/about"
      url="https://joshua.example/about/"
    />
    <outline
      type="link"
      text="What I'm working on"
      category="/now"
      url="https://joshua.example/updates/current/"
    />
    <outline
      type="link"
      text="Uses"
      category="/uses"
      url="https://joshua.example/uses/"
    />
    <outline
      type="link"
      text="Changelog"
      category="/changelog,/log"
      url="https://joshua.example/log/"
    />
    <outline
      type="include"
      text="Creative work"
      url="https://joshua.example/slashpages/creative.opml"
    />
  </body>
</opml>
```

HTTP expectations for `https://joshua.example/.well-known/slashpages`: status 200, `Content-Type: text/x-opml` (or `application/xml` / `text/xml`), no trailing slash on the path, public access when discovery is intended.

Validate with:

```bash
curl -i https://joshua.example/.well-known/slashpages
curl -i https://joshua.example/updates/current/
curl -i https://joshua.example/slashpages/creative.opml
```

The `/slashes/` HTML page remains the human map; OPML declares the same resources for machines. No JavaScript runtime is required.

## Validate your implementation

### Validate XML syntax

Confirm well-formed XML: quoted attributes, matching tags, correct encoding, and escaped `&`, `<`, and `"` in attribute values. Use a standard XML parser or tool such as `xmllint` when available.

### Validate OPML structure

Check `version="2.0"`, present `head` and `body`, and outline `text` values. For slash-page entries, confirm `type="link"` and absolute `url` values.

### Validate the HTTP response

Confirm status 200, an appropriate MIME type, public accessibility, and the extensionless `/.well-known/slashpages` path (no trailing slash).

### Validate linked pages

Every listed URL should resolve to the intended public resource.

### Validate categories

Categories should name slash-page conventions. Multiple categories should be aliases, not unrelated topics.

### Validate includes

Included OPML documents should resolve, be well formed, and avoid loops.

### Validate browser accessibility

When browser tools matter, check CORS headers.

### Validate crawler access

Confirm [robots]({{ '/implement/content/robots/' | relative_url }}) policies allow the fetches you intend. There is no proprietary JoshBot-only diagnostic required for publishing.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Invalid XML or unescaped `&` | Parsers reject the document. | Produce well-formed XML; escape attribute text. |
| Missing `text` on outlines | Document is not valid OPML 2.0. | Always provide `text`. |
| Missing `url` on slash-page entries | Consumers cannot open the page. | Add an absolute page URL. |
| Confusing `xmlUrl` and `url` | Feeds and pages are misread. | Use `url` for `type="link"`; `xmlUrl` for feeds. |
| Relative URLs in the manifest | Portability and proposal conformance suffer. | Prefer absolute HTTPS URLs. |
| Categories as article topics | Convention semantics break. | Use slash-page names such as `/now`. |
| Aliases treated as separate pages | Duplicate or conflicting interpretations. | One URL; comma-separated aliases. |
| Publishing at `/.well-known/slashpages/` | Wrong endpoint for many clients. | Use the extensionless path without a trailing slash. |
| Returning HTML instead of OPML | Machines cannot parse the catalog. | Serve OPML with a suitable MIME type. |
| Broken or redirecting resource URLs | Seeds and indexes go nowhere useful. | Fix links; update the manifest. |
| Recursive include loops | Fetches fail or waste budget. | Acyclic includes; keep depth small. |
| Cross-origin URLs as ownership claims | False membership assumptions. | Treat external URLs as links, not proof of control. |
| Listing private or inaccessible pages | Accidental exposure or failed fetches. | List only intentional public URLs. |
| Expecting guaranteed indexing or featuring | Unmet expectations. | Treat the manifest as a discovery aid only. |

## Slash-page OPML on the Joshternet

An optional OPML manifest helps Joshternet discovery systems locate declared slash-page resources, including pages that use unconventional URLs. Same-origin outline URLs may become crawl starting points via the hub’s `slashpages-manifest` reader. The file does not establish participation, determine personal identity, or guarantee Topics, Showcase, or other surfaces. Participation still depends only on `/.well-known/josh`.

### Joshternet reader limits (not OPML rules)

The current hub reader in `scripts/network/slashpages-manifest.mjs` applies local limits that are **not** universal OPML requirements:

- Maximum fetched OPML document size: **256 KiB**.
- Include budget: `MAX_SLASHPAGES_INCLUDES` is **4** (fetched-document budget includes the root manifest).
- Maximum include depth: **2**.
- Up to **200** outlines parsed per OPML document.
- Same-origin entries can seed crawling; cross-origin page entries stay evidence-only and are not auto-promoted into participating sites.
- Relative URLs may resolve against the origin in this parser; the community proposal still calls for absolute URLs.
- Includes are recognized for `type="include"` (and empty-type URLs that look like `.opml`). A `type="link"` outline pointing at an `.opml` file is **not** treated as an include by this reader.

## Continue through the handbook

OPML catalogs declare resources. Related chapters cover what those resources contain and how else they are discovered:

- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Robots]({{ '/implement/content/robots/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Slash pages; next: Microformats2).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [OPML 2.0 specification](https://opml.org/spec2.opml) | Format definition for OPML documents |
| [well-known-slashpages proposal](https://github.com/pfefferle/well-known-slashpages) | Community convention for slash-page OPML at a well-known path |
| [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) | Well-Known URI framework |
| [IANA Well-Known URI Registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml) | Registered well-known suffixes (`slashpages` not registered as of this writing) |
| [slashpages.net](https://slashpages.net/) | Community directory of slash-page path ideas |
| [XML 1.0](https://www.w3.org/TR/xml/) | Well-formed XML |
| [Fetch / CORS](https://fetch.spec.whatwg.org/) | Cross-origin browser access to HTTP resources |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
