---
layout: default
title: "Semantic HTML: Give Your Content Meaning"
description: >-
  Learn how to structure a website with semantic HTML so people, browsers,
  assistive technologies, and crawlers like JoshBot can understand your
  writing, projects, and other published work.
keywords: >-
  semantic HTML, HTML Living Standard, accessible HTML, JoshBot,
  structured content, independent web, web publishing
permalink: /implement/content/html/
nav_title: Semantic HTML
content_id: html
matrix_id: html
seo:
  type: TechArticle
  name: Semantic HTML
---

# Semantic HTML

HTML does more than display text and images. It describes what the different parts of a page mean, helping browsers, accessibility tools, search engines, and crawlers understand what you've published. A heading identifies a subject, an article contains a piece of work, a time element identifies a date, and a link connects your page to something else on the web.

Semantic HTML is the foundation of a discoverable website. You don't need a JavaScript framework, specialized publishing software, or a complicated metadata system to get started. A few well-chosen HTML elements can make your existing content much easier to understand.

JoshBot already uses several of these signals when exploring participating websites. This guide explains how to use them, what they mean, and how they help your content find its way into the Joshternet.


## What makes HTML semantic?

Semantic HTML uses elements that describe the purpose of their content rather than simply how it should look.

Consider these two examples:

```html
<div class="title">Notes from the lab</div>
<div class="date">October 1, 2026</div>
<div class="content">
  I finally finished rebuilding my workbench.
</div>
```

A person viewing the page might understand this immediately, but the elements themselves don't explain much. A `div` is a generic container, and its class names have no standardized meaning.

Now consider the same information expressed semantically:

```html
<article>
  <h1>Notes from the lab</h1>

  <p>
    Published
    <time datetime="2026-10-01">Oct. 1, 2026</time>
  </p>

  <p>
    I finally finished rebuilding my workbench.
  </p>
</article>
```

The second example identifies a self-contained article, its heading, and a machine-readable publication date. A browser or crawler can interpret those elements without understanding the author's naming conventions or CSS.

Both examples are valid ways to construct a page, but the semantic version provides more useful information. That information can be consumed by different systems without requiring a custom parser for every website.

## Start with the document itself

Every HTML document should identify its language, provide a meaningful title, and distinguish page metadata from visible content.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1">

  <title>Notes from the lab | Example Site</title>

  <meta name="description"
        content="A few notes about rebuilding my workbench.">
</head>
<body>
  <h1>Notes from the lab</h1>
  <p>I finally finished rebuilding my workbench.</p>
</body>
</html>
```

Several elements are doing important work here.

| Element | Purpose |
| --- | --- |
| `<!doctype html>` | Identifies the document as modern HTML and enables standards-mode rendering. |
| `<html lang="en">` | Declares the document's primary language. |
| `<head>` | Contains document metadata and references to external resources. |
| `<meta charset="utf-8">` | Declares UTF-8 character encoding. |
| `<meta name="viewport">` | Helps pages display appropriately on mobile devices. |
| `<title>` | Identifies the document in browser tabs, bookmarks, and other interfaces. |
| `<meta name="description">` | Supplies a short description that consumers may use when summarizing the page. |
| `<body>` | Contains the document's visible content and interactive elements. |

### Declare your language

Use the `lang` attribute to identify the language in which your content is written. This helps assistive technologies select appropriate pronunciation rules and gives automated systems a reliable language signal.

For example:

```html
<html lang="en">
<html lang="es">
<html lang="de">
<html lang="ja">
```

Use the appropriate BCP 47 language tag for your actual content. If most of a page is in Spanish, declare Spanish rather than English simply because the website participates in an English-language community.

You can also identify changes of language within a document:

```html
<p>
  My favorite German word is
  <span lang="de">Fernweh</span>.
</p>
```

Joshternet welcomes content in any language. A website's language does not determine whether its owner may participate, although some of JoshBot's current text analysis is language-specific.

### Give each page its own title

The `<title>` element identifies the document as a whole, while the visible `<h1>` identifies its main subject. They can be similar without needing to be identical.

For example, an article might have the browser title `Building a Home Server | Example Site` and the visible heading `Building a Home Server`. This gives the document a recognizable identity in search results, browser tabs, bookmarks, and crawler data.

Avoid using the same generic title on every page. A site containing dozens of articles called "Home" or "My Website" is harder for visitors and automated systems to navigate.

## Organize the page into meaningful regions

HTML provides elements for describing major regions of a document. These elements are useful to people navigating with assistive technologies and to systems attempting to distinguish actual content from repeated page navigation.

| Element | Use it for |
| --- | --- |
| `<header>` | Introductory content for a page or section, such as a site identity, article heading, or byline. |
| `<nav>` | A significant group of navigation links. |
| `<main>` | The primary content of the current document. |
| `<article>` | A self-contained piece of content, such as a blog post, review, or project write-up. |
| `<section>` | A thematic grouping of related content, normally with a heading. |
| `<aside>` | Supplementary content related to the surrounding page. |
| `<footer>` | Closing information, such as credits, contact links, or related resources. |
| `<div>` | A generic container when no semantic element fits. |

### Identify the main content

The `<main>` element should contain what makes a particular page different from the rest of the website.

```html
<header>
  <a href="/">Example Site</a>

  <nav aria-label="Main navigation">
    <a href="/about/">About</a>
    <a href="/notes/">Notes</a>
    <a href="/projects/">Projects</a>
  </nav>
</header>

<main>
  <h1>My projects</h1>
  <p>Things I've built, broken, and occasionally fixed.</p>
</main>

<footer>
  <p>Made by Avery Example.</p>
</footer>
```

A document must not contain more than one `<main>` element unless any additional ones have the `hidden` attribute. For ordinary websites, one visible main content region is the simplest and clearest implementation.

Navigation, site branding, and repeated footer information generally belong outside `<main>`. That separation gives readers an accessible way to move directly to the content and makes the document easier to interpret.

### Use articles for independent pieces of work

An `<article>` represents content that could reasonably stand on its own. Blog posts, notes, reviews, project descriptions, and individual entries in a feed are common examples.

```html
<main>
  <h1>Recent notes</h1>

  <article>
    <h2>
      <a href="/notes/building-a-server/">
        Building a home server
      </a>
    </h2>

    <p>
      Published
      <time datetime="2026-10-01">Oct. 1, 2026</time>
    </p>

    <p>A few lessons from rebuilding an old computer.</p>
  </article>

  <article>
    <h2>
      <a href="/notes/learning-photography/">
        Learning photography
      </a>
    </h2>

    <p>
      Published
      <time datetime="2026-10-15">Oct. 15, 2026</time>
    </p>

    <p>What I've learned from carrying a camera again.</p>
  </article>
</main>
```

This pattern is useful for personal blogs, archives, and `/notes` pages. Each entry has a meaningful title, its own permalink, and a date that a machine can interpret.

An `<article>` isn't required for every page. An About page or simple contact page may only need `<main>` and a few headings. Choose elements according to the content rather than wrapping everything in articles.

### Use sections for related content

A `<section>` groups content around a particular subject within a document. It normally has a heading that explains what the section contains.

```html
<article>
  <h1>My home server</h1>

  <section>
    <h2>Hardware</h2>
    <p>An old desktop computer with upgraded storage.</p>
  </section>

  <section>
    <h2>Software</h2>
    <p>Debian, Docker, and a collection of self-hosted tools.</p>
  </section>
</article>
```

This structure helps readers understand how the article is organized. It also provides meaningful context to systems analyzing the surrounding text.

Use `<div>` when you only need a layout or styling container. A section without a meaningful subject generally doesn't need to be a `<section>`.

## Headings describe the structure

Headings identify subjects and establish relationships between different parts of a page. The levels, from `<h1>` through `<h6>`, express their relative importance within the document.

A practical hierarchy looks like this:

```html
<h1>Building a home server</h1>

<h2>Choosing the hardware</h2>
<h3>Processor and memory</h3>
<h3>Storage</h3>

<h2>Installing the operating system</h2>
<h3>Network configuration</h3>

<h2>What I learned</h2>
```

Use one clear page-level `<h1>` as a straightforward authoring convention, then descend through heading levels as the content becomes more specific. HTML does not universally prohibit multiple `<h1>` elements, but a predictable hierarchy is easier to navigate and maintain.

Don't choose heading levels based on how large you want the text to appear. Use CSS to control visual presentation, and preserve headings for describing the document's organization.

JoshBot currently extracts text from `<h1>`, `<h2>`, and `<h3>` elements as part of its content analysis. Meaningful headings provide additional context for subjects discussed in articles, notes, and project pages.

## Make dates understandable

Dates are especially important for a website that publishes updates. They help distinguish a new article from an old one and make it possible to present content in chronological order.

The `<time>` element provides a machine-readable value through its `datetime` attribute.

```html
<p>
  Published
  <time datetime="2026-10-01">Oct. 1, 2026</time>
</p>
```

The visible text can follow your preferred date format while the `datetime` attribute supplies a standardized value.

For a specific date and time, include the time zone when appropriate:

```html
<time datetime="2026-10-01T14:30:00-07:00">
  Oct. 1, 2026, at 2:30 p.m. PDT
</time>
```

A date should also have a clear meaning. A publication date, modification date, event date, and date mentioned within an article are not interchangeable.

```html
<p>
  Published:
  <time datetime="2026-10-01">Oct. 1, 2026</time>
</p>

<p>
  Updated:
  <time datetime="2026-10-15">Oct. 15, 2026</time>
</p>
```

JoshBot can extract valid dates from `<time datetime>` and other supported metadata. More explicit publishing metadata, such as `datePublished` in Schema.org or `article:published_time` in Open Graph, can provide additional information. Avoid contradictory dates across those representations.

Read the [Schema.org guide](/implement/content/schema-org/) and [Open Graph guide](/implement/content/open-graph/) for the complete implementation of those formats.

## Use real links

Links are one of the foundations of the open web. They connect articles, websites, people, projects, and resources without requiring the sites to use the same technology.

Use ordinary anchors with `href` attributes:

```html
<p>
  Read more about my
  <a href="/projects/home-server/">home server project</a>.
</p>

<p>
  I also enjoyed reading
  <a href="https://example.org/notes/">
    another person's notes
  </a>.
</p>
```

An anchor contains a destination that browsers and crawlers can understand directly. Navigation that only works through a JavaScript click handler may be inaccessible to crawlers that don't execute that code.

Use descriptive link text instead of repeating "click here" throughout the page. A link labeled "Read my home server notes" provides more useful context than an isolated "more."

Links also provide evidence for the Joshternet Connections system. When one participating website links to another, JoshBot can observe that relationship, subject to the existing crawling and evidence rules. A link doesn't automatically mean friendship, endorsement, or collaboration.

Learn more in the [Links and relations guide](/implement/content/links/).

## Describe images and other media

Images can contribute important information, but their meaning shouldn't depend entirely on visual interpretation.

Use the `<img>` element with an appropriate `alt` attribute:

```html
<figure>
  <img
    src="/images/workbench.webp"
    alt="A wooden workbench with a laptop and two monitors"
    width="1200"
    height="800"
    loading="lazy"
  >

  <figcaption>
    My workbench after the latest round of changes.
  </figcaption>
</figure>
```

The image alternative describes relevant visual information for people who cannot see the image, while the caption provides accompanying context for all readers. A decorative image that contributes no meaningful information should generally use an empty `alt=""` attribute rather than a redundant description.

The `width` and `height` attributes help the browser reserve space for the image, while `loading="lazy"` can defer images that aren't needed immediately. Avoid lazy-loading an important above-the-fold image without a reason.

For creative work, additional metadata can help distinguish an individual photograph, illustration, game, or music release from an ordinary image embedded in a page. See the [Creative media guide](/implement/content/media/) for Schema.org and Open Graph examples.

## Complete example: A discoverable article

The following example combines the concepts in this guide into a complete HTML document. It includes page metadata, navigation, a clearly identified article, publication information, semantic sections, an image, and links to related content.

The example uses a fictional domain. Replace it, the links, and the image paths with resources from your own site before publishing.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>Notes from the lab | Example Site</title>

  <meta
    name="description"
    content="Notes about rebuilding a home workbench,
             organizing tools, and making things."
  >

  <link
    rel="canonical"
    href="https://joshua.example/notes/lab/"
  >

  <link
    rel="alternate"
    type="application/atom+xml"
    title="Example Site feed"
    href="https://joshua.example/feed.xml"
  >
</head>

<body>
  <a href="#main-content">Skip to main content</a>

  <header>
    <a href="/">Example Site</a>

    <nav aria-label="Main navigation">
      <a href="/about/">About</a>
      <a href="/notes/">Notes</a>
      <a href="/projects/">Projects</a>
    </nav>
  </header>

  <main id="main-content">
    <article>
      <header>
        <h1>Notes from the lab</h1>

        <p>
          By
          <a href="/about/" rel="author">
            Avery Example
          </a>
        </p>

        <p>
          Published
          <time datetime="2026-10-01">
            Oct. 1, 2026
          </time>
        </p>
      </header>

      <p>
        I've spent the past few weeks rebuilding
        my home workbench. Here's what changed,
        what worked, and what I'll try next.
      </p>

      <section aria-labelledby="workspace">
        <h2 id="workspace">The workspace</h2>

        <p>
          I replaced my old desk, added better
          lighting, and moved my development
          machines into a dedicated cabinet.
        </p>

        <figure>
          <img
            src="/images/workbench.webp"
            alt="A wooden workbench with a laptop,
                 monitors, and an adjustable lamp"
            width="1200"
            height="800"
          >

          <figcaption>
            The updated workbench.
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="lessons">
        <h2 id="lessons">What I learned</h2>

        <p>
          A few small changes made the biggest
          difference.
        </p>

        <ul>
          <li>Better lighting reduced glare.</li>
          <li>Cable management made maintenance easier.</li>
          <li>Keeping documentation nearby saved time.</li>
        </ul>
      </section>

      <section aria-labelledby="related">
        <h2 id="related">Related work</h2>

        <p>
          You can read more about the setup on
          my <a href="/projects/home-server/">
            home server project page
          </a>.
        </p>
      </section>
    </article>
  </main>

  <footer>
    <p>
      Made by Avery Example.
      <a href="/contact/">Get in touch</a>.
    </p>
  </footer>
</body>
</html>
```

This document is useful without JavaScript, external stylesheets, or a particular website framework. The meaningful content remains available in the HTML delivered by the server.

It also provides a foundation for additional metadata. Microformats2 could describe the article as an `h-entry`, JSON-LD could describe it as a Schema.org `BlogPosting`, and Open Graph could provide a preview image for sharing. Those formats enrich the document rather than replacing its semantic HTML.

## How JoshBot uses semantic HTML

JoshBot doesn't implement every aspect of the HTML Living Standard as a general-purpose semantic parser. It does, however, recognize important document structures and extract information used throughout the Joshternet.

The current content extraction pipeline uses the following signals:

| HTML signal | Current JoshBot behavior |
| --- | --- |
| `<title>` | Extracts the document title as a page identity and content signal. |
| `<html lang>` | Records language information and determines eligibility for some language-specific text analysis. |
| `<h1>`, `<h2>`, `<h3>` | Extracts headings to help identify page subjects. |
| `<main>` | Prioritizes its content when selecting prose for topic analysis. |
| `<article>` | Provides a fallback content region and supports other article-specific extraction paths. |
| `<nav>`, `<header>`, `<footer>`, `<aside>`, `<form>` | Separates these regions from primary topic prose in the current extractor. |
| `<a href>` | Extracts links and link context for discovery and relationship analysis. |
| `<time datetime>` | Can contribute structured publication-date evidence in relevant content extraction paths. |
| `<meta name="description">` | Can contribute page-summary information. |
| Canonical links | Help identify preferred page URLs and avoid some duplicate content. |
| `<meta name="robots" content="noindex">` | Influences eligibility for content-derived topic signals. |

This is not a promise that every HTML element becomes a public Joshternet feature. Different extraction paths have different requirements, and page content must still satisfy the appropriate quality, membership, and crawler access rules.

### Where the information goes

**Topics:** JoshBot combines suitable declared categories with qualifying text-derived subject signals. Clear headings and focused articles make those signals easier to interpret, but HTML structure alone does not guarantee a public topic.

**What's New:** Dated writing can contribute to the activity feed when discovered through supported content sources and when it meets the publication rules. Semantic dates can help, although feeds and other metadata are also important.

**Search:** Titles, page descriptions, and relevant indexed content help visitors discover member websites and published work.

**Network:** Page titles, descriptions, and selected identity information help describe participating sites. Ordinary pages do not establish participation; that still requires a valid `/.well-known/josh` declaration.

**Connections:** Actual hyperlinks can establish observed relationships between participating websites. Shared subjects and similar content do not create fictitious friendship links.

**Showcase:** Creative work requires additional evidence to identify the work and its type. Semantic HTML helps provide context, while supported structured metadata, galleries, and creative indexes can supply more specific information.

## Build for people first

Good semantic HTML isn't about persuading a crawler to give your site a better ranking. It's about publishing information in a form that different people and systems can understand.

An article should still make sense when its CSS is unavailable. A project's main description shouldn't disappear because JavaScript failed to load. Navigation should use ordinary links wherever possible, and important dates, titles, and descriptions should exist in the delivered document.

This matters especially on an independent network. Joshternet members use different publishing platforms, templates, and technologies. Shared HTML conventions make that diversity possible without requiring everyone to install the same software or adopt a centralized content system.

## Validate your HTML

Before publishing, check that your document is valid, accessible, and understandable without relying on how it happens to look in one browser.

### 1. Check the document structure

Use the [Nu HTML Checker](https://validator.w3.org/nu/) to inspect your markup. It can identify structural problems, invalid element nesting, missing required attributes, and other issues with HTML conformance.

Check the resulting messages and correct the underlying markup rather than suppressing warnings without understanding them. A successful check is useful, but it doesn't by itself establish accessibility or correct content semantics.

### 2. Inspect the HTML delivered by your server

Open your page using the browser's View Source feature, or request it directly:

```sh
curl -i https://joshua.example/notes/lab/
```

Replace the fictional address with the actual published URL. Confirm that the server returns the expected HTML document and that the title, headings, article content, links, and publication date appear in the response.

If the important content only appears after JavaScript executes, a crawler that reads the server response may not discover it. Server-rendered or statically generated HTML is a reliable foundation for independent publishing.

### 3. Check your links

Visit the article's canonical URL, internal links, images, and feed links. Make sure they point to real resources and that relative paths resolve as expected.

A sitemap or metadata document cannot compensate for links that lead to missing pages. If an article has moved, use an appropriate redirect and update references where practical.

### 4. Review accessibility

Navigate the page using a keyboard, check heading order, and make sure links have meaningful text. Confirm that images have suitable alternatives and that the main content can be reached without navigating through the entire site repeatedly.

Semantic HTML provides many accessibility benefits by default, but it must still be used correctly. The meaning of the content, not just the presence of semantic tags, determines whether the page works well.

### 5. Check the result on Joshternet

Once your website participates in the Joshternet and permits crawling, JoshBot can encounter its public content during scheduled discovery and enrichment. Publication is not necessarily immediate, and the presence of valid HTML does not guarantee inclusion in every Joshternet view.

If something is missing, check the page's public accessibility, robots rules, links, metadata, and relevant content source first. The other guides in this handbook cover the more specialized signals used by each discovery system.

## Common mistakes

| Mistake | Better approach |
| --- | --- |
| Every page has the same title. | Give each document a distinct, descriptive `<title>`. |
| Headings are only styled `<div>` elements. | Use actual headings with a logical hierarchy. |
| Multiple visible `<main>` elements. | Use one visible main content region. |
| Every content block is an `<article>`. | Reserve `<article>` for content that stands independently. |
| Dates are unstructured prose. | Use `<time datetime>` when a meaningful date can be represented. |
| Publication and update dates are confused. | Label them separately and use consistent metadata. |
| Navigation only works through JavaScript. | Use ordinary `<a href>` links that work without scripts. |
| Images have no meaningful alternative. | Provide appropriate `alt` text, including empty alt text for decorative images. |
| Page language is missing or incorrect. | Declare the actual language using `lang`. |
| All important content is injected after loading. | Deliver meaningful primary content in the HTML response. |
| A canonical URL points to an unrelated page. | Identify the correct preferred resource URL. |
| A page has metadata but no useful content. | Publish meaningful, readable content and use metadata to describe it. |

## Continue through the handbook

Semantic HTML gives your website its structure. The other specifications build upon that foundation, providing ways to describe content more precisely and help different systems discover it.

Continue with [SEO fundamentals](/implement/content/seo/) to learn how page metadata, canonical URLs, and search discovery work. The [microformats2 guide](/implement/content/microformats2/) explains how to describe posts, people, events, and relationships directly in HTML. You can also explore [Open Graph](/implement/content/open-graph/) and [Schema.org](/implement/content/schema-org/) for richer page and creative-work descriptions.

No single specification does everything. Used together, they make the information on your own website easier to find, interpret, and share while keeping the site under your control.

## Specifications and references

- [HTML Living Standard](https://html.spec.whatwg.org/) — The authoritative, continuously maintained HTML specification.
- [HTML: The elements of HTML](https://html.spec.whatwg.org/multipage/semantics.html) — Document metadata and semantic element definitions.
- [HTML content sectioning](https://html.spec.whatwg.org/multipage/sections.html) — Document sections, headings, and page structure.
- [BCP 47 language tags (RFC 5646)](https://www.rfc-editor.org/rfc/rfc5646) — Language identification used by HTML's `lang` attribute.
- [Nu HTML Checker](https://validator.w3.org/nu/) — HTML conformance checking.
- [MDN HTML element reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements) — Practical explanations and examples of HTML elements.

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
