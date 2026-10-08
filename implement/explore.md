---
layout: default
title: How Joshternet builds explore data views
description: >-
  How Joshternet builds presentation projections for Topics, What's New, and
  Search from crawl evidence—without exposing raw inventories on visitor pages.
keywords: >-
  Joshternet explore views, Topics, What's New, Search, presentation projections
permalink: /implement/explore/
nav_title: Explore
seo:
  type: TechArticle
  name: Explore data views
---

# Explore data views

Presentation projections for Topics, What's New, and Search.

```text
nlp:sync
  → graph
  → views:build
  → Jekyll HTML
```

## Rules

- Public neighborhoods come from published topics, declared article tags, and the combined declared subjects of every participant. One site with matching articles is enough; sites with none are omitted. Members are alphabetical, and recent articles rotate across publishers.
- What's New shows one latest item per origin, then newest first.
- Explore's featured neighborhood is a UTC-date rotation over alphabetical slugs.
- Related topics are co-tags on the same indexed content item, plus curated broader and related links when that subject is public.
- Search ranks title, topics, summary, and domain text only.

## Accessibility

Every exploration page has semantic HTML. Graphs and search enhance that
baseline. Visitors can leave Joshternet on every content destination.

See also [Connections crawl](/implement/connections/).
