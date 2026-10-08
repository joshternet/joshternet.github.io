---
layout: default
title: Platform recipes for /.well-known/josh
description: >-
  Tested, non-normative recipes for publishing a Joshternet /.well-known/josh
  declaration on independent-web site software.
keywords: >-
  /.well-known/josh, platform recipes, Astro, Eleventy, Ghost, Hugo, Jekyll,
  Next.js, Nuxt, SvelteKit, WordPress, Joshternet declaration
seo:
  type: CollectionPage
  name: Platforms
permalink: /implement/platforms/
nav_title: Platforms
---

# Platforms

Recipes for publishing the well-known josh file on your favorite web platform.

<ul class="platforms-list">
{% for platform in site.data.platforms_nav %}
  <li>
    <a href="{{ platform.path | relative_url }}">{{ platform.title }}</a>
    {% if platform.summary and platform.summary != "" %}
      — {{ platform.summary }}
    {% endif %}
  </li>
{% endfor %}
</ul>
