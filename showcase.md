---
layout: default
title: Showcase creative work from independent Joshternet websites
description: >-
  Photographs, art, music, sheet music, video, games, software, and projects from
  independent websites on the Joshternet. Cards link out to the publisher—no
  embeds or republishing. Joshternet does not claim authorship of participants' work.
keywords: >-
  Joshternet showcase, creative work, photography, music, sheet music, games, independent websites
seo:
  type: CollectionPage
  name: Showcase
permalink: /showcase/
joshternet_analysis: derived
script: /assets/js/showcase.js
---

{% assign showcase_items = site.data.showcase.items | default: empty %}
{% assign showcase_kinds = site.data.showcase.kinds | default: empty %}
{% assign showcase_kind_labels = site.data.showcase.kind_labels | default: empty %}

# Showcase

Creative work made by participants of the Joshternet.

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
    {% assign item_kind = item.kind | default: 'other' %}
    {% if item_kind != current_kind %}
      {% if current_kind != '' %}
  </ol>
</section>
      {% endif %}
      {% assign current_kind = item_kind %}
      {% assign section_label = item.kind_label | default: showcase_kind_labels[item_kind] | default: item_kind | capitalize %}
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
      {% if item.language and item.language != '' %}
        lang="{{ item.language | escape }}"
      {% endif %}
      {% if item.dir and item.dir != '' %}
        dir="{{ item.dir | escape }}"
      {% endif %}
    >
      {% include showcase-card.html item=item %}
    </li>
  {% endfor %}
  </ol>
</section>
{% else %}
<div class="network-empty">
  <p>
    No creative works are indexed yet. Browse the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    or <a href="{{ '/activity/' | relative_url }}">What's New</a>
    meanwhile.
  </p>
</div>
{% endif %}
</div>
