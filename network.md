---
layout: default
title: The Network
description: >-
  Independent websites participating in the Joshternet, discovered and
  verified by JoshBot.
seo:
  type: WebPage
  name: The Network
permalink: /network/
script: /assets/js/network.js
---

# The Network

Independent websites participating in the Joshternet, discovered and verified by JoshBot.

{% if jekyll.environment == "development" %}
<div class="network-dev-preview">
  <strong>Development preview</strong>
  <span>Fixture cards for Josh, Non-Josh, and Undeclared are appended locally.</span>
</div>
{% endif %}

{% assign network_sites = site.data.network %}
{% if jekyll.environment == "development" %}
  {% assign network_sites = network_sites | concat: site.data.network_dev %}
{% endif %}

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

  <div class="network-toolbar__secondary">
    <label class="network-sort">
      <span>Sort</span>
      <select data-network-sort>
        <option value="asc">A–Z</option>
        <option value="desc">Z–A</option>
      </select>
    </label>

    <a class="network-wander-action" href="{{ '/wander/' | relative_url }}">
      Wander the Joshternet →
    </a>
  </div>
</div>

<p class="network-count" aria-live="polite">
  <strong data-network-count>{{ network_sites | size }}</strong>
  <span data-network-count-label>
    {% if network_sites.size == 1 %}site{% else %}sites{% endif %}
  </span>
</p>

{% if network_sites.size > 0 %}
<div class="network-grid" data-network-grid>
  {% for network_site in network_sites %}
    {% case network_site.identity %}
      {% when "affirmed" %}
        {% assign identity_label = "Josh" %}
      {% when "declined" %}
        {% assign identity_label = "Non-Josh" %}
      {% else %}
        {% assign identity_label = "Undeclared" %}
    {% endcase %}

    <article
      class="network-card network-card--{{ network_site.identity }}"
      data-network-card
      data-identity="{{ network_site.identity }}"
      data-title="{{ network_site.title | default: network_site.domain | downcase | escape }}"
      data-domain="{{ network_site.domain | downcase | escape }}"
    >
      <a
        class="network-card__link"
        href="{{ network_site.origin | escape }}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <div class="network-card__preview">
          {% if network_site.screenshot %}
            <img
              class="network-card__image"
              src="{{ network_site.screenshot | relative_url }}"
              alt="Screenshot of {{ network_site.title | default: network_site.domain | escape }}"
              loading="lazy"
              decoding="async"
            >
          {% else %}
            <div class="network-card__fallback" aria-hidden="true">
              <span>{{ network_site.domain | slice: 0 | upcase }}</span>
            </div>
          {% endif %}
        </div>

        <div class="network-card__body">
          <span class="visually-hidden">
            {{ identity_label }} Joshternet participant.
          </span>

          <h2 class="network-card__title">
            {{ network_site.title | default: network_site.domain | escape }}
            <span aria-hidden="true">↗</span>
          </h2>

          {% if network_site.description and network_site.description != "" %}
            <p class="network-card__description">
              {{ network_site.description | escape }}
            </p>
          {% endif %}

          <span class="network-card__domain">
            {{ network_site.domain | escape }}
          </span>
        </div>
      </a>
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
  <p>JoshBot hasn't found any participating sites to show here yet.</p>
</div>
{% endif %}
