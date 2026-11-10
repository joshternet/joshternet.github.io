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

Pick a website that catches your eye and have a look around. You might find a great article, an unusual project, a wonderful piece of art, or something you didn't know you were looking for. That's part of the fun of wandering the web.

This is the part of the Joshternet that JoshBot has found and checked so far. There may be plenty of other participating websites still waiting to be discovered. Participation starts by publishing a valid declaration at `/.well-known/josh`—you do not need to appear here first ([Join]({{ '/join/' | relative_url }})).

{% assign network_sites = site.data.network %}
{% if network_sites == nil %}
  {% assign network_sites = "" | split: "" %}
{% endif %}
{% comment %}
  No-JS fallback: alphabetical by domain. JavaScript replaces order with Discover
  (random), Recently joined, Oldest first, or Alphabetical while preserving filters.
{% endcomment %}
{% assign network_sites = network_sites | sort: 'k1v' %}

<p class="network-toolbar-lede">
  Looking for a fellow Josh? Curious who's joined the fun without being one? Use the filters to explore, or leave them on All and see where you end up. Undeclared means the publisher has not declared Josh identity—it does not mean verification failed. Discover mixes things up so you don't always start in the same place. Recently joined and Oldest first follow when JoshBot first recorded participation in the registry.
</p>

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
    {% case network_site.k31 %}
      {% when "affirmed" %}
        {% assign identity_label = "Josh" %}
      {% when "declined" %}
        {% assign identity_label = "Non-Josh" %}
      {% else %}
        {% assign identity_label = "Undeclared" %}
    {% endcase %}

    <article
      class="network-card network-card--{{ network_site.k31 }} h-card"
      data-network-card
      data-identity="{{ network_site.k31 }}"
      data-title="{{ network_site.k7c | default: network_site.k1v | downcase | escape }}"
      data-domain="{{ network_site.k1v | downcase | escape }}"
      data-origin="{{ network_site.k4b | escape }}"
      data-first-participated-at="{{ network_site.k2j | escape }}"
    >
      {% include outbound-href.html url=network_site.k4b %}
      <a
        class="network-card__link u-url"
        href="{{ outbound_href | escape }}"
        target="_blank"
        rel="noopener"
      >
        <div class="network-card__preview">
          {% if network_site.k63 %}
            <img
              class="network-card__image u-photo"
              src="{{ network_site.k63 | relative_url }}"
              alt="Screenshot of {{ network_site.k7c | default: network_site.k1v | escape }}"
              loading="lazy"
              decoding="async"
            >
          {% else %}
            <div class="network-card__fallback" aria-hidden="true">
              <span>{{ network_site.k1v | slice: 0 | upcase }}</span>
            </div>
          {% endif %}
        </div>

        <div class="network-card__body">
          {% include network-card-a11y.html %}
          <span class="visually-hidden">{{ identity_a11y }}</span>

          <h2 class="network-card__title p-name">
            {{ network_site.k7c | default: network_site.k1v | escape }}
            <span aria-hidden="true">↗</span>
          </h2>

          {% if network_site.k1n and network_site.k1n != "" %}
            <p class="network-card__description p-note">
              {{ network_site.k1n | escape }}
            </p>
          {% endif %}
        </div>
      </a>
      {% assign show_elsewhere = false %}
      {% if network_site.k20 and network_site.k20.size > 0 %}
        {% assign show_elsewhere = true %}
      {% endif %}
      {% assign show_feed = false %}
      {% if network_site.k2g and network_site.k2g.size > 0 %}
        {% assign show_feed = true %}
      {% endif %}
      <div class="network-card__footer">
        {% if show_elsewhere or show_feed %}
          <div class="network-card__actions">
            {% if show_feed %}
              {% assign primary_feed = network_site.k2g | first %}
              {% include outbound-href.html url=primary_feed.k7o %}
              <a
                class="network-card__feed"
                href="{{ outbound_href | escape }}"
                target="_blank"
                rel="noopener"
              >
                <svg
                  class="network-card__feed-icon"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    fill="currentColor"
                    d="M2.5 12.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0-5.5a7 7 0 0 1 7 7h-2a5 5 0 0 0-5-5v-2Zm0-5.5A12.5 12.5 0 0 1 15 13.5h-2A10.5 10.5 0 0 0 2.5 3.5v-2Z"
                  />
                </svg>
                <span class="visually-hidden">
                  Open feed for
                  {{ network_site.k7c | default: network_site.k1v | escape }}
                </span>
              </a>
            {% endif %}
            {% if show_elsewhere %}
              <ul class="network-card__elsewhere">
                {% for elsewhere_link in network_site.k20 %}
                  {% assign elsewhere_network = elsewhere_link.k45 | default: "web" %}
                  <li>
                    {% include outbound-href.html url=elsewhere_link.k7o %}
                    <a
                      class="network-card__elsewhere-link"
                      href="{{ outbound_href | escape }}"
                      target="_blank"
                      rel="noopener"
                    >
                      <span
                        class="network-card__elsewhere-glyph network-card__elsewhere-glyph--{{ elsewhere_network | escape }}"
                        aria-hidden="true"
                      ></span>
                      <span class="visually-hidden">
                        {{ elsewhere_link.k3g | default: elsewhere_network | escape }}
                        profile linked from this participant site
                      </span>
                    </a>
                  </li>
                {% endfor %}
              </ul>
            {% endif %}
          </div>
        {% endif %}
        {% include outbound-href.html url=network_site.k4b %}
        <a
          class="network-card__domain u-url"
          href="{{ outbound_href | escape }}"
          target="_blank"
          rel="noopener"
        >
          {{ network_site.k1v | escape }}
        </a>
        {% include network-card-joined.html %}
      </div>
    </article>
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

<p class="network-join-invite">
  Have a website of your own? There's room for you here, whether you're a Josh
  or not. The
  <a href="{{ '/join/' | relative_url }}">Join guide</a>
  shows you how to get connected without moving anything or creating another
  account.
</p>
