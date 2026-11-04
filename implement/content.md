---
layout: default
title: Content Discovery Handbook
description: >-
  How open web standards help people, publishers, feeds, search engines, and
  independent crawlers find and understand content—without a central platform.
keywords: >-
  content discovery, open web, semantic HTML, feeds, sitemaps, microformats,
  Schema.org, slash pages, OPML, independent web, Joshternet
permalink: /implement/content/
nav_title: Content
seo:
  type: CollectionPage
  name: Content Discovery Handbook
---

# Content Discovery Handbook

Independent websites publish for people first. Search engines, feed readers, directories, and independent crawlers come later—and they only understand what publishers make visible in public HTML, feeds, and related documents.

Open web standards are agreements about how to mark meaning, announce updates, and express access preferences. They let different systems share information without requiring a single company to host everyone’s writing. **Content still belongs to its publisher.** Standards do not transfer ownership; they make it possible for others to find and interpret what you chose to publish.

Joining Joshternet still requires only a valid [`/.well-known/josh`]({{ '/implement/' | relative_url }}) declaration. Everything in this handbook is optional. The same techniques help across the broader web: personal sites, small publications, and creative portfolios that want to stay portable.

## How content discovery works

Discovery is a chain of separate activities. Publishing metadata does not guarantee that any particular system will index, rank, or feature your work.

<ol class="content-discovery-flow" aria-label="Content discovery process">
  <li>
    <strong>Find</strong>
    <span>Crawlers and people discover URLs through hyperlinks, feeds, sitemaps, and indexes.</span>
  </li>
  <li>
    <strong>Retrieve</strong>
    <span>Clients request publicly available resources while respecting applicable access policies.</span>
  </li>
  <li>
    <strong>Understand</strong>
    <span>HTML, metadata, microformats2, and structured data describe what was published.</span>
  </li>
  <li>
    <strong>Connect</strong>
    <span>Authors, topics, related works, and links establish meaningful relationships.</span>
  </li>
  <li>
    <strong>Present</strong>
    <span>Applications may organize what they learned into directories, feeds, search results, graphs, and collections.</span>
  </li>
</ol>

Finding a URL is not the same as understanding a page. Understanding a page is not the same as indexing it. Indexing is not the same as presenting it in a topic neighborhood, What’s New strip, or search hit. Each step can succeed or fail on its own.

## Chapters

{% assign groups = "foundation|discovery|describing|syndication|relationships|publishing|understanding" | split: "|" %}
{% assign group_labels = "Foundation|Discovery and publishing|Describing content|Feeds, sitemaps, and crawlers|Links, identity, and connections|Creative publishing|Understanding and troubleshooting" | split: "|" %}

{% for group_key in groups %}
  {% assign group_label = group_labels[forloop.index0] %}
  {% assign group_heading_id = "handbook-group-" | append: group_key %}
  <h3 class="content-handbook-group__title" id="{{ group_heading_id }}">{{ group_label }}</h3>
  <ul class="content-handbook-list" aria-labelledby="{{ group_heading_id }}">
    {% for chapter in site.data.content_nav %}
      {% if chapter.group == group_key %}
        <li>
          <a href="{{ chapter.path | relative_url }}">{{ chapter.title }}</a>
          {% if chapter.summary and chapter.summary != "" %}
            <p class="content-handbook-list__summary">{{ chapter.summary }}</p>
          {% endif %}
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% endfor %}

## How the specifications work together

Imagine **Harbor Notes**, a fictional independent site run by one person. They publish a long article about rebuilding a workbench and a photography project under `/photos/`.

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }}) marks the article as an article, the photo set as a collection of work, and dates as dates—so browsers and extractors are not guessing from CSS classes alone.
- [Links]({{ '/implement/content/links/' | relative_url }}) and [sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}) make those URLs discoverable from the homepage, related posts, and an explicit URL list.
- [Feeds]({{ '/implement/content/feeds/' | relative_url }}) announce the new article (and later updates) to readers and bots that prefer “what changed” over a full recrawl.
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}) describes the entry, author, and categories in the HTML itself.
- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}) supplies a title, description, and image for previews when the article is shared.
- [Schema.org and JSON-LD]({{ '/implement/content/schema-org/' | relative_url }}) can name the photography project as a creative work with a clearer type than a bare blog post.
- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}) keep `/photos/` (and similar roots) as understandable collections instead of a pile of undated files.
- [OPML and `/.well-known/slashpages`]({{ '/implement/content/opml/' | relative_url }}) can advertise those collections in a machine-readable index.
- [Robots]({{ '/implement/content/robots/' | relative_url }}) express which paths crawlers may fetch; additional AI-agent or content-usage directives may express other preferences where they are supported.

None of these steps replace the others. HTML remains the foundation. Feeds and sitemaps improve discovery. Structured markup improves interpretation. Access policies set boundaries. Presentation layers—Joshternet’s Topics and Showcase included—still choose what to show.

## Recommended implementation path

Adopt standards in an order that matches ordinary site work. You do not need every chapter before your content can be found.

1. **Start with the basics.** Publish [semantic HTML]({{ '/implement/content/html/' | relative_url }}), descriptive titles, real [links]({{ '/implement/content/links/' | relative_url }}), and meaningful URLs ([SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})).
2. **Make content discoverable.** Add [feeds]({{ '/implement/content/feeds/' | relative_url }}), [sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}), and appropriate [crawler policies]({{ '/implement/content/robots/' | relative_url }}).
3. **Describe your work.** Add [microformats2]({{ '/implement/content/microformats2/' | relative_url }}), [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}), or [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}) where the content warrants it—and [identity]({{ '/implement/content/identity/' | relative_url }}) when authorship should travel with the page.
4. **Organize your site.** Introduce [slash pages]({{ '/implement/content/slashpages/' | relative_url }}) and optionally publish an [OPML catalog]({{ '/implement/content/opml/' | relative_url }}).
5. **Connect with others.** Publish meaningful outbound links, blogrolls, and supported [IndieWeb relationships]({{ '/implement/content/connections/' | relative_url }}). Creative [media]({{ '/implement/content/media/' | relative_url }}), [events]({{ '/implement/content/events/' | relative_url }}), and [uses]({{ '/implement/content/uses/' | relative_url }}) pages fit here when they are part of what you publish.
6. **Validate and discover.** Confirm resources and metadata with the [validation]({{ '/implement/content/validation/' | relative_url }}) checklists, then use the [reference]({{ '/implement/content/reference/' | relative_url }}) when you need authoritative links or honest crawl coverage notes. [Explore]({{ '/implement/content/explore/' | relative_url }}) covers how to make published work easier to find—not a guarantee of prominence.

## Also

- [Implement]({{ '/implement/' | relative_url }}) — the declaration
- [Connections crawl]({{ '/implement/connections/' | relative_url }}) — maintainer pipeline
- [JoshBot]({{ '/joshbot/' | relative_url }})
- [Join]({{ '/join/' | relative_url }})
