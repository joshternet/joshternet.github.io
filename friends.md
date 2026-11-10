---
layout: default
title: Friends of the Joshternet
description: >-
  Meet independent website owners who participate in the Joshternet while
  proudly declaring that they are not Joshes.
keywords: >-
  Friends of the Joshternet, Non-Josh, Joshternet network, independent websites
seo:
  type: CollectionPage
  name: Friends of the Joshternet
robots: max-snippet:160, max-image-preview:large
permalink: /friends/
joshternet_analysis: derived
---

{% assign friends = site.data.network | where: "k31", "declined" %}
{% if friends == nil %}
  {% assign friends = "" | split: "" %}
{% endif %}
{% assign friends = friends | sort: "k1v" %}

# Friends of the Joshternet

The Joshternet may have started with Joshes, but the independent web is bigger
than one name. These are people who have explicitly declared themselves
non-Joshes while choosing to connect their websites to the Joshternet.

<p class="network-count" aria-live="polite">
  <strong>{{ friends | size }}</strong>
  <span>
    {% if friends.size == 1 %}Friend of the Joshternet{% else %}Friends of the Joshternet{% endif %}
  </span>
</p>

{% if friends.size > 0 %}
<div class="network-grid" data-friends-grid>
  {% for network_site in friends %}
    {% include network-participant-card.html friend_presentation=true %}
  {% endfor %}
</div>
{% else %}
<div class="network-empty">
  <p>
    No Friends are listed here yet. The Joshternet is still wandering the
    independent web. If you have a site of your own and prefer not to declare
    Josh identity, you can still
    <a href="{{ '/join/' | relative_url }}">join the adventure</a>
    by publishing a declaration.
  </p>
</div>
{% endif %}

<p class="network-footnote">
  Have a website of your own? There's room for you here, whether you're a Josh
  or not. The
  <a href="{{ '/join/' | relative_url }}">Join guide</a>
  shows you how to get connected without moving anything or creating another
  account.
</p>
