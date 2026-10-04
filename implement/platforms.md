---
layout: default
title: Platform recipes for /.well-known/josh
description: >-
  Tested, non-normative recipes for publishing a Joshternet /.well-known/josh
  declaration on common independent-web platforms such as Eleventy, Ghost, and
  Jekyll.
keywords: >-
  /.well-known/josh, platform recipes, Eleventy, Ghost, Jekyll, Joshternet
  declaration
seo:
  type: CollectionPage
  name: Platforms
permalink: /implement/platforms/
nav_title: Platforms
---

# Platforms

Recipes for publishing `/.well-known/josh`.

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
