---
layout: default
title: Happening on the Joshternet — events from independent websites
description: >-
  Upcoming events hosted, organized, or performed by independent websites
  participating in the Joshternet. Cards link out to the original publisher
  event page — no in-hub embeds.
keywords: >-
  Joshternet events, happening, independent websites, upcoming events
seo:
  type: CollectionPage
  name: Happening on the Joshternet
permalink: /events/
joshternet_analysis: derived
---

{% assign happening_items = site.data.happening.items | default: empty %}

# Happening on the Joshternet

Upcoming events from independent websites in the network, in chronological
order. Follow each card to the publisher's own event page for details.

{% if happening_items.size > 0 %}
<ol class="activity-list h-feed happening-list">
  {% for item in happening_items %}
    <li {% if item.lang and item.lang != '' %}lang="{{ item.lang | escape }}"{% endif %}
        {% if item.dir and item.dir != '' %}dir="{{ item.dir | escape }}"{% endif %}>
      {% include activity-card.html item=item heading_tag="h2" %}
      {% if item.start and item.start != '' %}
        <p class="happening-date">
          <time datetime="{{ item.start | escape }}">
            {{- item.start | date: '%b %-d, %Y' -}}
          </time>
          {% if item.end and item.end != '' %}
            &ndash;
            <time datetime="{{ item.end | escape }}">{{ item.end | date: '%b %-d, %Y' }}</time>
          {% endif %}
        </p>
      {% endif %}
      {% if item.venue and item.venue != '' %}
        <p class="happening-venue">{{ item.venue | escape }}
          {% if item.location and item.location != '' %}
            &mdash; {{ item.location | escape }}
          {% endif %}
        </p>
      {% endif %}
    </li>
  {% endfor %}
</ol>
{% else %}
<div class="network-empty">
  <p>
    No upcoming events are indexed yet. Check back later, or browse the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    to find participating sites.
  </p>
</div>
{% endif %}

{% if site.data.happening.items.size > 0 %}
<p class="happening-ical">
  <a href="{{ '/assets/events/joshternet.ics' | relative_url }}">Subscribe via iCalendar (.ics)</a>
</p>
{% endif %}
