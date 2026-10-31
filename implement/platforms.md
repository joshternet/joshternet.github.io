---
layout: default
title: Platform recipes for /.well-known/josh
description: >-
  Tested recipes for publishing /.well-known/josh on WordPress, Hugo, Jekyll,
  Cloudflare Workers, Astro, Eleventy, Ghost, Next.js, Nuxt, Quartz, SvelteKit,
  and more—so independent sites can join the Joshternet.
keywords: >-
  /.well-known/josh, platform recipes, Astro, Eleventy, Ghost, Hugo, Jekyll,
  Cloudflare Worker, Next.js, Nuxt, Quartz, SvelteKit, WordPress, Joshternet declaration
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
