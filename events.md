---
# Always built. Network nav "Happening" appears when happening.item_count > 0.
published: true
layout: default
title: Happening on the Joshternet — events from independent websites
description: >-
  Upcoming events hosted, organized, or performed by independent websites
  participating in the Joshternet. Cards link out to the original publisher
  event page — no in-hub embeds. Education series archives also appear on
  Showcase when past sessions are indexed.
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
    {% include activity-card.html item=item heading_tag="h2" %}
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
