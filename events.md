---
# Always built. Network nav "Happening" appears when upcoming events exist
# (past archive is development-only for card/format review).
published: true
layout: default
title: Happening on the Joshternet — events from independent websites
description: >-
  Upcoming events hosted, organized, performed, or presented by independent
  websites participating in the Joshternet. Cards link out to the original
  publisher event page — no in-hub embeds. Education series archives and talks
  also appear on Showcase when indexed.
keywords: >-
  Joshternet events, happening, independent websites, upcoming events
seo:
  type: CollectionPage
  name: Happening on the Joshternet
permalink: /events/
joshternet_analysis: derived
---

{% assign happening_items = site.data.happening.k3a | default: empty %}
{% assign past_items = site.data.past_events.k3a | default: empty %}
{% assign past_group_by_year = site.data.past_events.k2u | default: false %}
{% assign show_past_events = false %}
{% if jekyll.environment == 'development' %}
  {% assign show_past_events = true %}
{% endif %}

# Happening on the Joshternet

Upcoming events from independent websites in the network, in chronological
order by event start—not by when JoshBot noticed them. Follow each card to the
publisher’s own event page for details. Incomplete metadata stays incomplete;
Joshternet does not invent dates or locations.

## Upcoming

{% if happening_items.size > 0 %}
<ol class="activity-list h-feed happening-list">
  {% for item in happening_items %}
    {% include activity-card.html item=item heading_tag="h2" %}
  {% endfor %}
</ol>
{% else %}
<div class="network-empty">
  <p>
    No upcoming events are indexed yet. Visit the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    to find participating sites.
  </p>
</div>
{% endif %}

{% if happening_items.size > 0 %}
<p class="happening-ical">
  <a href="{{ '/assets/events/joshternet.ics' | relative_url }}">Subscribe via iCalendar (.ics)</a>
</p>
{% endif %}

{% if show_past_events and past_items.size > 0 %}
## Past events

Historical appearances with a verified start date, newest first. Date-only
values stay date-only. Local review only — not shown in production.

{% if past_group_by_year %}
  {% assign past_year = '' %}
  {% for item in past_items %}
    {% assign item_year = item.k89 | date: '%Y' %}
    {% if item_year != past_year %}
      {% if past_year != '' %}
</ol>
      {% endif %}
      {% assign past_year = item_year %}
<h3>{{ past_year | escape }}</h3>
<ol class="activity-list h-feed happening-list happening-list--past">
    {% endif %}
    {% include activity-card.html item=item heading_tag="h2" %}
  {% endfor %}
</ol>
{% else %}
<ol class="activity-list h-feed happening-list happening-list--past">
  {% for item in past_items %}
    {% include activity-card.html item=item heading_tag="h2" %}
  {% endfor %}
</ol>
{% endif %}
{% endif %}
