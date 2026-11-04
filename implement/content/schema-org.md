---
layout: default
title: Schema.org and JSON-LD
description: >-
  Typed JSON-LD for creative works, events, and people.
keywords: >-
  Schema.org, JSON-LD, CreativeWork, Event, Joshternet
permalink: /implement/content/schema-org/
nav_title: Schema.org and JSON-LD
content_id: schema-org
matrix_id: schema-org
seo:
  type: TechArticle
  name: Schema.org and JSON-LD
---

# Schema.org and JSON-LD

Put a type on the thing. JoshBot only cares about an allowlist—not the entire Schema.org phone book.


## Do this

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Photograph",
  "name": "Harbor at dusk",
  "url": "https://joshua.example/photos/harbor-at-dusk/",
  "image": "https://joshua.example/media/harbor.jpg",
  "dateCreated": "2026-09-15"
}
</script>
```

Creative allowlist includes `Photograph`, `MusicRecording`, `VideoObject`, `Game`, `SoftwareApplication`, `Book`, `HowTo`, and related family types (`CREATIVE_SCHEMA_TYPES` in hub code). Events need `startDate`. Person/WebSite help Network blurbs; `knowsAbout` can feed Topics.

## Mistakes

- Invented `@type` strings
- Marking the whole site `Article` on every URL

## Specs

- [schema.org](https://schema.org/)
- [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)

Handbook navigation below follows `content_nav` (previous: Open Graph; next: Feeds).

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
