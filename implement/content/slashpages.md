---
layout: default
title: "Slash Pages: Give Your Website a Personality"
description: >-
  Organize an independent website with recognizable URL paths—/now, /uses,
  /blogroll, /slashes, and more—so people and discovery systems can explore
  writing, projects, and personality beyond a conventional blog.
keywords: >-
  slash pages, IndieWeb, /now, /uses, /slashes, slashpages.net, personal
  website, independent web, web publishing
permalink: /implement/content/slashpages/
nav_title: Slash pages
content_id: slashpages
matrix_id: slashpages
seo:
  type: TechArticle
  name: Slash pages
---

# Slash Pages

Slash pages are recognizable URLs that communicate the purpose of a page through its path. A `/now` page describes someone’s current interests and activities. A `/uses` page lists tools and equipment. A `/colophon` explains how the website was built. A `/blogroll` introduces other sites worth visiting.

These conventions grew out of independent-web culture. They let publishers express personality, interests, preferences, and creative work without needing a social media profile or a platform’s fixed set of fields. A personal website can be more than a blog, portfolio, or résumé. Slash pages make room for the material that does not fit neatly into traditional navigation—and for the unconventional pages that make a site feel like a place.

Slash pages are ordinary HTML pages with thoughtful addresses. They work alongside semantic HTML, feeds, sitemaps, and metadata. They are community conventions, not a proprietary Joshternet feature and not a formal Internet standard.

## Where slash pages came from

Paths such as `/about` became familiar across the web because they are easy to remember and share. Independent publishers extended that habit into more personal conventions: `/now` for what is current, `/uses` for tools, `/colophon` for how the site was made, and many others.

Writers and builders across the IndieWeb—including people such as Caleb Hearth, Shellsharks, and Robb Knight—helped popularize and catalog these ideas. The community-maintained directory at [slashpages.net](https://slashpages.net/) collects common slash-page names and examples. It is a shared reference, not a standards organization that grants or withholds permission.

Conventions evolve. You can adopt established names, combine ideas, or invent new pages. Slash pages do not replace HTML, sitemaps, feeds, or structured data. They add an understandable organizational layer that sits beside those standards.

## How slash pages work

A slash page is an ordinary web resource with a meaningful URL. The conventional name `/now` becomes a public address when combined with your site’s origin—for example `https://joshua.example/now/`.

Common patterns on independently hosted sites:

- `/about/` for information about the author or project.
- `/now/` for current activities.
- `/uses/` for software and equipment.
- `/colophon/` for how the website was made.
- `/blogroll/` for recommended websites.

Trailing slashes, redirects, extensionless URLs, and path case sensitivity matter. Depending on the server, `/now`, `/now/`, and `/now.html` can be different resources even when you configure them to resolve to one preferred page. Prefer consistent, stable URLs, self-referencing canonical links where appropriate, and document titles that name the page clearly. See [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }}) for canonicalization detail.

## The slash-page directory

The following groups describe common community conventions. They are not mandatory, and they are not exhaustive. [slashpages.net](https://slashpages.net/) lists many more.

### Identity and personal information

| Path | What visitors often find |
| --- | --- |
| `/about`, `/me`, `/profile` | Who you are and how to understand the site. |
| `/now` | What you are focused on lately. |
| `/next` | Near-term plans. |
| `/why` | Motivations or a short manifesto. |
| `/interests` | Topics you care about. |
| `/languages` | Languages you speak or write in. |
| `/hello` | A welcoming introduction. |
| `/contact` | How to reach you. |
| `/elsewhere`, `/social` | Other places you appear online. |
| `/verify` | Proof of identity across profiles (often with `rel=me`). |

An About page introduces the person or project. A Now page is meant to stay current. A manifesto (`/why`) explains stance. Elsewhere and verify pages connect identities without replacing [Identity and authorship]({{ '/implement/content/identity/' | relative_url }}) patterns such as `h-card` and `rel=me`.

### Website information

| Path | What visitors often find |
| --- | --- |
| `/colophon`, `/site`, `/meta` | How the site is built and why it looks the way it does. |
| `/changelog` | Notable site changes over time. |
| `/style` | Design notes or style decisions. |
| `/slashes` | A human-readable map of slash pages on this site. |
| `/sitemap` | A human HTML sitemap (distinct from XML sitemaps). |
| `/posse` | Notes on Publish (on your) Own Site, Syndicate Elsewhere. |

These pages explain construction, history, design, and publishing practice.

### Tools and everyday life

| Path | What visitors often find |
| --- | --- |
| `/uses`, `/defaults` | Tools, apps, and equipment you rely on. |
| `/carry` | What you keep with you day to day. |
| `/self-hosting`, `/homelab` | Services and hardware you run yourself. |
| `/since` | Habits or streaks with a start date. |
| `/someday`, `/wish` | Aspirations and wish lists. |
| `/nope` | Things you decline or avoid. |

These pages describe practical tools, habits, preferences, and goals. A `/uses` page is site information about tools—not automatic eligibility for creative Showcase surfaces. See [Uses pages]({{ '/implement/content/uses/' | relative_url }}).

### Reading and recommendations

| Path | What visitors often find |
| --- | --- |
| `/links`, `/bookmarks` | Saved or interesting links. |
| `/blogroll` | Websites you recommend. |
| `/podroll`, `/postroll` | Podcasts or posts you recommend. |
| `/canon` | Works you consider foundational. |
| `/books` | Books you have written, read, or recommend—be clear which. |
| `/follow`, `/subscribe` | How to follow your feeds or updates. |

A blogroll of recommended sites differs from a personal bookmarks dump, a podcast recommendation list, or a catalog of books you authored. Label the page so visitors know which.

### Writing and ideas

| Path | What visitors often find |
| --- | --- |
| `/notes`, `/blog`, `/posts`, `/writing` | Indexes of published writing. |
| `/articles`, `/essays`, `/journal` | Longer or more formal collections. |
| `/weeknotes` | Periodic summaries. |
| `/til` | Short “today I learned” notes. |
| `/ideas`, `/questions`, `/predictions` | Speculative or open-ended writing. |

Collection pages help readers browse; individual articles still need stable URLs of their own.

### Creative work and projects

| Path | What visitors often find |
| --- | --- |
| `/work`, `/projects`, `/portfolio` | Professional or personal project indexes. |
| `/photography`, `/photos`, `/gallery`, `/art` | Visual work collections. |
| `/comics`, `/music`, `/podcasts`, `/videos` | Medium-specific indexes. |
| `/games`, `/apps`, `/experiments`, `/design` | Interactive or design work. |

List collections and give each work a meaningful, stable URL. See [Creative media]({{ '/implement/content/media/' | relative_url }}).

### Community and participation

| Path | What visitors often find |
| --- | --- |
| `/friends`, `/people`, `/following` | People and sites you care about. |
| `/webring`, `/community` | Groups and shared rings. |
| `/guestbook` | Visitor notes, if you host them. |
| `/events`, `/performances`, `/concerts`, `/education` | Gatherings and appearances. |

These pages help visitors discover collaborators, communities, and other independent sites. See [Connections]({{ '/implement/content/connections/' | relative_url }}) and [Events]({{ '/implement/content/events/' | relative_url }}).

### Personal and unconventional pages

Examples such as `/ai`, `/hats`, `/hills`, `/top4`, `/shoebox`, `/chipotle`, `/green`, `/glossary`, `/for`, and `/blank` show the range of independent publishing. Unusual pages are part of the charm. You can experiment without waiting for a platform to invent a profile field.

Share only what you intentionally want public. Some conventions invite details about health, location, family, finances, or plans. Discovery systems and directories are not a reason to publish sensitive information. If a page should stay private, keep it off the public web.

## Start with what you want to share

You do not need every slash page. A handful of maintained pages is more useful than dozens of empty placeholders.

Example starting sets (not requirements):

- **Personal websites:** `/about`, `/now`, `/uses`, `/interests`, `/links`
- **Writers:** `/about`, `/writing`, `/notes`, `/books`, `/blogroll`
- **Developers and makers:** `/projects`, `/uses`, `/colophon`, `/experiments`, `/til`
- **Artists and photographers:** `/portfolio`, `/gallery`, `/photography`, `/about`, `/events`
- **Musicians:** `/music`, `/performances`, `/events`, `/about`, `/elsewhere`

Choose paths that match work you actually publish and maintain.

## Create your first slash page

A `/now/` page is a practical first slash page: its purpose is clear, and almost any personal site can use one.

### Step 1: Choose the URL

Pick the conventional path `/now/` (or your host’s equivalent) and decide the stable public address, such as `https://joshua.example/now/`. Redirect alternate spellings to that preferred URL when you can.

### Step 2: Create the HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Now | Example Site</title>
  <meta
    name="description"
    content="What I am focused on this season: writing,
             a small photo project, and keeping the site honest."
  >
  <link rel="canonical" href="https://joshua.example/now/">
</head>
<body>
  <header>
    <p><a href="https://joshua.example/">Example Site</a></p>
    <nav aria-label="Site">
      <a href="https://joshua.example/about/">About</a>
      <a href="https://joshua.example/now/">Now</a>
      <a href="https://joshua.example/slashes/">Slashes</a>
    </nav>
  </header>
  <main>
    <article>
      <h1>Now</h1>
      <p>
        Updated
        <time datetime="2026-11-01">Nov. 1, 2026</time>
      </p>
      <p>
        I am rewriting handbook chapters for independent publishers,
        finishing a short photo series from the harbor, and learning
        to keep this /now page honest instead of aspirational.
      </p>
      <p>
        Related:
        <a href="https://joshua.example/notes/">Notes</a>
        and
        <a href="https://joshua.example/photos/">Photos</a>.
      </p>
    </article>
  </main>
</body>
</html>
```

### Step 3: Add the page to navigation

Link from the homepage, About page, or primary nav with ordinary HTML:

```html
<a href="/now/">Now</a>
```

Visitors should not have to guess the URL.

### Step 4: Publish and verify

Open the URL in a browser and inspect the response:

```bash
curl -i https://joshua.example/now/
```

Confirm a successful status, the expected HTML, and that the canonical URL matches the preferred address.

### Step 5: Maintain the content

Update `/now` when your focus changes. A visible last-updated date helps visitors judge how current the page is.

## Give visitors a map of your slash pages

`/slashes/` is a human-readable directory of the slash pages on your site. Each entry should use a descriptive label and a short explanation—not only a bare path.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Slashes | Example Site</title>
  <link rel="canonical" href="https://joshua.example/slashes/">
</head>
<body>
  <main>
    <h1>Slashes</h1>
    <p>
      A map of the recognizable pages on this site.
      Paths are conventions, not requirements.
    </p>

    <h2>Personal</h2>
    <ul>
      <li>
        <a href="/about/">About</a>
        — who maintains this site.
      </li>
      <li>
        <a href="/now/">Now</a>
        — what I am focused on lately.
      </li>
    </ul>

    <h2>Writing and projects</h2>
    <ul>
      <li>
        <a href="/notes/">Notes</a>
        — short posts and essays.
      </li>
      <li>
        <a href="/projects/">Projects</a>
        — apps and experiments.
      </li>
    </ul>

    <h2>Site</h2>
    <ul>
      <li>
        <a href="/colophon/">Colophon</a>
        — how this site is built.
      </li>
      <li>
        <a href="/uses/">Uses</a>
        — tools and equipment.
      </li>
      <li>
        <a href="/blogroll/">Blogroll</a>
        — sites I recommend.
      </li>
    </ul>
  </main>
</body>
</html>
```

You can maintain the index by hand or generate it with a static-site generator.

`/slashes/` is not an XML sitemap. An HTML sitemap (sometimes at `/sitemap`) is a human overview of many site URLs. An XML sitemap advertises URLs to crawlers ([Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})). The three can complement each other; they serve different jobs. A good `/slashes/` page also helps crawlers that follow ordinary hyperlinks.

## Help people and crawlers find your pages

1. Link from primary navigation.
2. Link from relevant articles, projects, and the homepage.
3. Include pages in `/slashes/`.
4. List canonical public URLs in an XML sitemap when you publish one.
5. Use clear titles, descriptions, and [semantic HTML]({{ '/implement/content/html/' | relative_url }}).
6. Optionally publish `/.well-known/slashpages` OPML ([OPML chapter]({{ '/implement/content/opml/' | relative_url }})).
7. Keep intended pages publicly reachable ([SEO]({{ '/implement/content/seo/' | relative_url }}), [Robots]({{ '/implement/content/robots/' | relative_url }})).

Some crawlers recognize common paths such as `/about`, `/now`, and `/uses`. Do not rely only on path guessing. Making a URL discoverable does not guarantee indexing or prominent presentation.

## Machine-readable slash-page catalogs

A human `/slashes/` index and an optional `/.well-known/slashpages` OPML document solve related problems. The HTML index is for people (and link-following crawlers). The OPML manifest can list page URLs and associate them with slash-page categories for machines.

If you use a nonstandard path, you can still advertise a recognized category in the manifest where consumers support it. For example, a current-status page at `/updates/current/` might be categorized as `/now` in OPML while the public URL stays `/updates/current/`.

```xml
<!-- Illustrative fragment only — see the OPML chapter for a full document -->
<outline text="now" type="link" url="https://joshua.example/updates/current/" />
```

OPML 2.0 is a general outline format. `/.well-known/slashpages` is a newer publishing convention that uses OPML for slash-page catalogs. The complete walkthrough—properties, parsing rules, and examples—lives in [OPML and `/.well-known/slashpages`]({{ '/implement/content/opml/' | relative_url }}).

## Slash pages and structured metadata

The URL path suggests the general purpose of a page. Semantic HTML and structured metadata describe the specific content.

| Path | Complements |
| --- | --- |
| `/now` | Clear publication or modification dates. |
| `/uses` | Clearly identified products or equipment in readable prose. |
| `/blogroll` | Meaningful outbound links (and related IndieWeb patterns). |
| `/projects` | Individual creative-work pages and metadata. |
| `/events` | Structured event information when you publish gatherings. |
| `/notes` | Microformats2 `h-entry` on entries. |
| `/about` | Optional `h-card` or Schema.org `Person`. |

Feeds, Open Graph, and JSON-LD can describe the same work for other consumers. A conventional path alone is not sufficient evidence for every classification. See [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}), [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}), and [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}).

## Slash pages and the Joshternet

In a network of independently operated websites, recognizable paths help visitors find personal information, projects, writing, creative collections, and links between sites. Joshternet’s discovery systems recognize a reviewed catalog of common slash-page paths—including writing indexes, identity pages, and creative collections—when participants publish them publicly and permit crawling.

Identifying a page as a possible content source is not the same as verifying every item for Topics, Showcase, or other surfaces. A `/uses` page does not automatically make each mentioned product a creative work. A `/gallery` page does not automatically establish that every linked file is a distinct photograph eligible for Showcase. Path recognition is a discovery aid, not a guarantee of indexing or featuring.

## There is room for your own ideas

Slash pages are conventions, not a closed allowlist. Invent pages that reflect your interests, creative practice, or community.

Keep custom pages discoverable with:

- A meaningful URL.
- A descriptive document title.
- Links from navigation and related content.
- An entry in `/slashes/`.
- A sitemap entry when you use sitemaps.
- Optional OPML categorization when an appropriate community category exists.

Do not misrepresent a custom name as a widely recognized convention merely because it appears in your personal catalog. Unconventional pages that are useful, entertaining, or personally meaningful are welcome when you intend them to be public.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Many empty slash pages | Visitors hit placeholders; trust drops. | Publish fewer pages and keep them current. |
| Unclear page titles | Tabs and results do not identify the page. | Use a distinct, descriptive `<title>` and heading. |
| Relying only on crawler URL guessing | Pages stay undiscovered. | Link from nav, content, and `/slashes/`. |
| No navigation links | People never find the pages. | Add ordinary `<a href>` links. |
| Broken or redirected links in `/slashes/` | The map misleads. | Fix links; update the index after moves. |
| Treating `/slashes/` as an XML sitemap | Wrong format for crawler sitemap expectations. | Keep `/slashes/` human; use XML sitemaps separately. |
| Confusing slash categories with blog tags | Organization becomes muddy. | Use slash pages for site sections; tags for post topics. |
| Treating OPML as a prominence guarantee | Expectations exceed what catalogs do. | Treat OPML as an optional machine index. |
| Contradictory canonical URLs | Duplicate signals confuse consumers. | Pick one preferred URL per page. |
| Collections without item URLs | Works cannot be cited or shared stably. | Give each work its own address. |
| Publishing sensitive details by habit | Unintended exposure. | Share only what you mean to make public. |
| Renaming paths without redirects | Old links and bookmarks break. | Add permanent redirects to the new URLs. |

## Complete example: A personal website

Imagine **Harbor Notes** at `https://joshua.example/` with this public structure:

| Path | Role |
| --- | --- |
| `/about/` | Who runs the site |
| `/now/` | Current focus |
| `/uses/` | Tools |
| `/notes/` | Writing index |
| `/projects/` | Project index |
| `/blogroll/` | Recommended sites |
| `/colophon/` | How the site is built |
| `/slashes/` | Human map of the above |

Homepage navigation might look like:

```html
<nav aria-label="Site">
  <a href="/about/">About</a>
  <a href="/now/">Now</a>
  <a href="/notes/">Notes</a>
  <a href="/projects/">Projects</a>
  <a href="/slashes/">Slashes</a>
</nav>
```

A complete `/slashes/` page for that site:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Slashes | Harbor Notes</title>
  <meta
    name="description"
    content="A map of the slash pages on Harbor Notes."
  >
  <link rel="canonical" href="https://joshua.example/slashes/">
</head>
<body>
  <header>
    <p><a href="https://joshua.example/">Harbor Notes</a></p>
  </header>
  <main>
    <h1>Slashes</h1>
    <p>Recognizable pages on this site.</p>
    <h2>Personal</h2>
    <ul>
      <li><a href="/about/">About</a> — the person behind Harbor Notes.</li>
      <li><a href="/now/">Now</a> — current projects and focus.</li>
      <li><a href="/uses/">Uses</a> — tools and equipment.</li>
    </ul>
    <h2>Writing and work</h2>
    <ul>
      <li><a href="/notes/">Notes</a> — articles and short posts.</li>
      <li><a href="/projects/">Projects</a> — apps and experiments.</li>
    </ul>
    <h2>Site and recommendations</h2>
    <ul>
      <li><a href="/colophon/">Colophon</a> — how this site is made.</li>
      <li><a href="/blogroll/">Blogroll</a> — sites worth reading.</li>
    </ul>
  </main>
</body>
</html>
```

Notes and project pages can link back to their indexes. Visitors get a map; feed readers still use [feeds]({{ '/implement/content/feeds/' | relative_url }}); search engines and independent crawlers can follow the same links. No client-side JavaScript is required.

## Validate your implementation

### Check the URLs

```bash
curl -i https://joshua.example/now/
curl -i https://joshua.example/slashes/
```

Confirm each slash page returns the intended resource and status.

### Check semantic HTML

Confirm a meaningful title, heading, main content, and readable text ([Nu HTML Checker](https://validator.w3.org/nu/)).

### Check navigation

Verify every public slash page is reachable from the site or `/slashes/` without JavaScript.

### Check canonicalization

Confirm canonical URLs match the preferred public resources.

### Check access permissions

Ensure `robots.txt` does not unintentionally block pages meant to be public.

### Check the slash-page index

Confirm listed links work, descriptions help, and the index does not expose unintended private material.

### Check optional metadata

If you publish XML sitemaps or `/.well-known/slashpages`, verify those declarations match live URLs.

## Continue through the handbook

Slash pages organize a site into understandable places. Machine-readable catalogs and deeper formats build on that organization:

- [OPML and `/.well-known/slashpages`]({{ '/implement/content/opml/' | relative_url }}) — next specialized chapter for manifests
- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Identity and authorship]({{ '/implement/content/identity/' | relative_url }})
- [Connections]({{ '/implement/content/connections/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Uses pages]({{ '/implement/content/uses/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: SEO fundamentals; next: OPML and well-known slashpages).

## Specifications and references

Slash pages are a community convention, not a formal Internet standard. The formats below govern their own technical rules:

- [Slash Pages community directory](https://slashpages.net/) — shared catalog of path ideas
- [IndieWeb wiki](https://indieweb.org/) — independent-web practices
- [HTML Living Standard](https://html.spec.whatwg.org/) — document structure and semantics
- [OPML 2.0 specification](https://opml.org/spec2.opml) — outline format used by slashpages manifests
- [Sitemaps protocol](https://www.sitemaps.org/protocol.html) — XML sitemaps for URL advertisement

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
