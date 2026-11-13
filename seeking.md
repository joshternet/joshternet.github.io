---
published: false
sitemap: false
layout: default
title: What people are looking for
description: >-
  Find requests for help, collaborators and hard-to-find things across the
  Joshternet. Visit the original websites to read more and get in touch.
keywords: >-
  Seeking, Joshternet, requests, collaborators, help, independent websites
seo:
  type: CollectionPage
  name: What people are looking for
robots: max-snippet:160, max-image-preview:large
permalink: /seeking/
nav_title: Seeking
joshternet_analysis: derived
script: /assets/js/seeking.js
---

{% assign seeking = site.data.seeking %}
{% assign seeking_sites = seeking.k6i | default: empty %}
{% assign seeking_categories = seeking.km | default: empty %}
{% assign seeking_status = seeking.k71 | default: 'empty' %}
{% if seeking == nil %}
  {% assign seeking_status = 'empty' %}
{% endif %}
{% assign request_count = seeking.k5p | default: 0 %}
{% assign website_count = seeking.k7z | default: 0 %}

# What people are looking for

Someone is looking for a collaborator, a little help with a project, or the
missing piece of something they’re building. Seeking brings together requests
people have published on their own websites. Have a look around, and follow a
request to its source to see whether you can help.

<div class="seeking" data-seeking data-seeking-status="{{ seeking_status | escape }}">
{% if seeking_status == 'unavailable' %}
<div class="network-empty" role="status" data-seeking-status-message>
  <p>
    Requests aren’t available right now. You can still explore the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    and visit participating websites.
  </p>
</div>
{% elsif seeking_status == 'ok' and seeking_sites.size > 0 %}
{% if seeking_categories.size > 0 %}
<nav class="seeking-filters showcase-filters" aria-label="Browse by topic" data-seeking-filters>
  <button
    class="showcase-filters__button is-active"
    type="button"
    data-seeking-filter="all"
    aria-pressed="true"
  >
    All
  </button>
  {% for category in seeking_categories %}
    <button
      class="showcase-filters__button"
      type="button"
      data-seeking-filter="{{ category | downcase | escape }}"
      aria-pressed="false"
    >
      {{ category | escape }}
    </button>
  {% endfor %}
  <button
    class="showcase-filters__button seeking-filters__clear"
    type="button"
    data-seeking-clear
    hidden
  >
    Clear filters
  </button>
</nav>
{% endif %}

<p class="seeking-counts" data-seeking-counts>
  {% if request_count == 1 %}
    {% if website_count == 1 %}
      1 request from 1 website
    {% else %}
      1 request from {{ website_count }} websites
    {% endif %}
  {% else %}
    {% if website_count == 1 %}
      {{ request_count }} requests from 1 website
    {% else %}
      {{ request_count }} requests from {{ website_count }} websites
    {% endif %}
  {% endif %}
</p>

<h2 id="seeking-results-heading">Requests from around the network</h2>

<div data-seeking-results>
{% for site_group in seeking_sites %}
<section
  class="seeking-site"
  data-seeking-site
  aria-labelledby="seeking-site-{{ forloop.index }}"
>
  <div class="seeking-site__header">
    <h3 id="seeking-site-{{ forloop.index }}" class="seeking-site__title">
      {{ site_group.k6h | default: site_group.k1v | escape }}
    </h3>
    {% if site_group.k1v and site_group.k1v != '' %}
      <p class="seeking-site__domain">{{ site_group.k1v | escape }}</p>
    {% endif %}
  </div>
  <ol class="seeking-list">
    {% for request in site_group.k5s %}
      <li class="seeking-list__item" data-seeking-item>
        {% include seeking-card.html
          request=request
          site_title=site_group.k6h
          site_domain=site_group.k1v
          language=site_group.k3i
        %}
      </li>
    {% endfor %}
  </ol>
</section>
{% endfor %}
</div>

<p class="network-empty" role="status" data-seeking-filter-empty hidden>
  No requests match these filters. Clear them to see the rest.
</p>

<p class="seeking-footnote">
  These requests come from participating websites, and the people who published
  them remain the best source for details. Visit the original page before
  responding, and use the contact method provided there. A listing here is an introduction, not a guarantee that a request is still open.
</p>

<p class="seeking-about">
  <a href="{{ '/implement/content/seeking/' | relative_url }}">About Seeking pages</a>
</p>
{% else %}
<div class="network-empty" role="status" data-seeking-status-message>
  <p>
    No requests to show yet. Explore the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    to see what people are sharing on their own websites.
  </p>
</div>

<p class="seeking-about">
  <a href="{{ '/implement/content/seeking/' | relative_url }}">About Seeking pages</a>
</p>
{% endif %}
</div>
