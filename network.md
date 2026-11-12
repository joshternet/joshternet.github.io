---
layout: default
title: The Network
description: >-
  Explore the independent websites JoshBot has discovered across the Joshternet.
  Meet Joshes and Non-Joshes, find interesting projects, and see where the web
  takes you.
keywords: >-
  Joshternet network, participating websites, JoshBot registry, independent websites,
  join Joshternet
seo:
  type: CollectionPage
  name: The Network
permalink: /network/
joshternet_analysis: derived
script: /assets/js/network.js
---

# The Network

Welcome to the Network, where you can explore the independent websites that JoshBot has found and verified so far. Some belong to Joshes, others to Non-Joshes, and some haven't declared Josh identity at all. They are all part of the same adventure, each with their own ideas, projects, and little corners of the internet.

{% assign network_sites = site.data.network %}
{% if network_sites == nil %}
  {% assign network_sites = "" | split: "" %}
{% endif %}
{% comment %}
  No-JS fallback: alphabetical by domain. JavaScript replaces order with Discover
  (random), Recently joined, Oldest first, or Alphabetical while preserving filters.
{% endcomment %}
{% assign network_sites = network_sites | sort: 'k1v' %}

<div class="network-toolbar" data-network-toolbar hidden>
  <div class="network-filters" aria-label="Filter the network">
    <button
      class="network-filter is-active"
      type="button"
      data-network-filter="all"
      aria-pressed="true"
    >
      All
    </button>
    <button
      class="network-filter"
      type="button"
      data-network-filter="affirmed"
      aria-pressed="false"
    >
      Josh
    </button>
    <button
      class="network-filter"
      type="button"
      data-network-filter="declined"
      aria-pressed="false"
    >
      Non-Josh
    </button>
    <button
      class="network-filter"
      type="button"
      data-network-filter="undeclared"
      aria-pressed="false"
    >
      Undeclared
    </button>
  </div>
  <div class="network-sorts" aria-label="Sort the network">
    <button
      class="network-sort is-active"
      type="button"
      data-network-sort="discover"
      aria-pressed="true"
    >
      Discover
    </button>
    <button
      class="network-sort"
      type="button"
      data-network-sort="recent"
      aria-pressed="false"
    >
      Recently joined
    </button>
    <button
      class="network-sort"
      type="button"
      data-network-sort="oldest"
      aria-pressed="false"
    >
      Oldest first
    </button>
    <button
      class="network-sort"
      type="button"
      data-network-sort="alpha"
      aria-pressed="false"
    >
      Alphabetical
    </button>
  </div>
</div>

<p class="network-count" aria-live="polite">
  <strong data-network-count>{{ network_sites | size }}</strong>
  <span data-network-count-label>
    {% if network_sites.size == 1 %}website in this directory{% else %}websites in this directory{% endif %}
  </span>
</p>

{% if network_sites.size > 0 %}
<div class="network-grid" data-network-grid>
  {% for network_site in network_sites %}
    {% include network-participant-card.html %}
  {% endfor %}

  <a class="network-surprise-card" href="{{ '/wander/' | relative_url }}">
    <span class="network-surprise-card__mark" aria-hidden="true">↗</span>
    <strong>Wander somewhere</strong>
    <span>Leave the directory behind and see where the network takes you.</span>
  </a>
</div>
{% else %}
<div class="network-empty">
  <p>
    Nothing to show in the Network just yet. JoshBot is still looking for
    participating websites, and there are plenty of corners of the internet left
    to discover. If you have your own site, you can
    <a href="{{ '/join/' | relative_url }}">join the adventure</a>
    by publishing a declaration.
  </p>
</div>
{% endif %}

<p class="network-footnote">
  Have a website of your own? There's room for you here, whether you're a Josh
  or not. Meet the
  <a href="{{ '/friends/' | relative_url }}">Friends of the Joshternet</a>,
  or use the
  <a href="{{ '/join/' | relative_url }}">Join guide</a>
  to get connected without moving anything or creating another account.
</p>
