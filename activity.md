---
layout: default
title: What's New from independent Joshternet websites
description: >-
  Recent articles, notes, and projects freshly published by independent websites
  participating in the Joshternet—one latest piece from each site.
keywords: >-
  What's New, Joshternet, recent articles, independent websites, Josh network
seo:
  type: CollectionPage
  name: What's New
permalink: /activity/
joshternet_analysis: derived
---

{% assign primary = site.data.activity.primary | default: empty %}

# What's New

Recent articles from around the Joshternet.

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
