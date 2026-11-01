---
layout: default
title: What's New from independent Joshternet websites
description: >-
  Recent writing from the last seven days and the latest Showcase creative works
  from independent websites on the Joshternet.
keywords: >-
  What's New, Joshternet, recent articles, showcase, independent websites, Josh network
seo:
  type: CollectionPage
  name: What's New
permalink: /activity/
joshternet_analysis: derived
---

{% assign primary = site.data.activity.primary | default: empty %}

# What's New

Recent writing from around the Joshternet.

<p class="activity-subscribe">
  <a href="{{ '/assets/activity/atom.xml' | relative_url }}">Subscribe</a>
  to this What’s New collection as Atom, or use the
  <a href="{{ '/assets/network/joshternet.opml' | relative_url }}">OPML blogroll</a>
  to follow individual publishers in a feed reader.
</p>

{% if primary.size > 0 %}
<ol class="activity-list h-feed">
  {% for item in primary %}
    {% include activity-card.html item=item %}
  {% endfor %}
</ol>
{% else %}
<div class="network-empty">
  <p>
    Nothing in the last seven days is indexed yet. Browse the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    to visit participating sites directly.
  </p>
</div>
{% endif %}
