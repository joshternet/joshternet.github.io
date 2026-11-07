---
layout: default
title: Showcase
description: >-
  Explore games, books, art, photography, software, and other creative work
  discovered across the Joshternet. Meet the people behind independent websites
  and see what they've been making.
keywords: >-
  Showcase, Joshternet, creative work, independent websites, games, books, art,
  photography, projects
seo:
  type: CollectionPage
  name: Showcase
robots: max-snippet:160, max-image-preview:large
permalink: /showcase/
joshternet_analysis: derived
script: /assets/js/showcase.js
---

{% assign showcase_items = site.data.showcase.k3a | default: empty %}
{% assign showcase_kinds = site.data.showcase.k3f | default: empty %}
{% assign showcase_kind_labels = site.data.showcase.k3e | default: empty %}

# Showcase

One of the best parts of wandering the internet is discovering what people make
simply because they want to. Games, photographs, books, artwork, software, and
wonderfully strange little projects are scattered across independent websites.
Showcase brings some of those creations together so you can find something
interesting and follow it back to the person who made it.

Everything here leads to the original website, where the work belongs. This is
not every creative project from every participating site—just a selection worth
exploring. Have a look around, discover something new, and see where your
curiosity takes you.

<div class="showcase" data-showcase>
{% if showcase_kinds.size > 0 %}
<nav class="showcase-filters" aria-label="Filter by kind">
  <button
    class="showcase-filters__button is-active"
    type="button"
    data-showcase-filter="all"
    aria-pressed="true"
  >
    All
  </button>
  {% for kind in showcase_kinds %}
    {% assign kind_label = showcase_kind_labels[kind] | default: kind | capitalize %}
    <button
      class="showcase-filters__button"
      type="button"
      data-showcase-filter="{{ kind | escape }}"
      aria-pressed="false"
    >
      {{ kind_label | escape }}
    </button>
  {% endfor %}
</nav>
{% endif %}

{% if showcase_items.size > 0 %}
  {% assign current_kind = '' %}
  {% for item in showcase_items %}
    {% assign item_kind = item.k3c | default: 'other' %}
    {% if item_kind != current_kind %}
      {% if current_kind != '' %}
  </ol>
</section>
      {% endif %}
      {% assign current_kind = item_kind %}
      {% assign section_label = item.k3d | default: showcase_kind_labels[item_kind] | default: item_kind | capitalize %}
<section
  class="showcase-section"
  data-showcase-kind="{{ item_kind | escape }}"
  aria-labelledby="kind-{{ item_kind | slugify }}"
>
  <h2 id="kind-{{ item_kind | slugify }}" class="showcase-section__title">
    {{ section_label | escape }}
  </h2>
  <ol class="showcase-list h-feed">
    {% endif %}
    <li
      class="showcase-list__item"
      {% if item.k3i and item.k3i != '' %}
        lang="{{ item.k3i | escape }}"
      {% endif %}
      {% if item.k1p and item.k1p != '' %}
        dir="{{ item.k1p | escape }}"
      {% endif %}
    >
      {% include showcase-card.html item=item %}
    </li>
  {% endfor %}
  </ol>
</section>

<p class="showcase-close">
  Found something you like? Follow the link, explore the website, and see what
  else its creator has been working on. There's usually more to discover once you
  start wandering.
</p>
{% else %}
<div class="network-empty">
  <p>
    Nothing has made it into Showcase just yet, but there's plenty more to
    explore. Visit the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    to discover participating websites, or stop by
    <a href="{{ '/activity/' | relative_url }}">What's New</a>
    to see what people have been sharing lately.
  </p>
</div>
{% endif %}
</div>
