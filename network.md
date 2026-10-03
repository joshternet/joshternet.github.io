---
layout: default
title: Participating Independent Websites
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
        </div>
      </a>
      {% assign show_elsewhere = false %}
      {% if network_site.elsewhere and network_site.elsewhere.size > 0 %}
        {% assign show_elsewhere = true %}
      {% endif %}
      {% assign show_feed = false %}
      {% if network_site.feeds and network_site.feeds.size > 0 %}
        {% assign show_feed = true %}
      {% endif %}
      <div class="network-card__footer">
        {% if show_elsewhere or show_feed %}
          <div class="network-card__actions">
            {% if show_feed %}
              {% assign primary_feed = network_site.feeds | first %}
              <a
                class="network-card__feed"
                href="{{ primary_feed.url | escape }}"
                target="_blank"
                rel="noopener noreferrer"
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
                  {{ network_site.title | default: network_site.domain | escape }}
                </span>
              </a>
            {% endif %}
            {% if show_elsewhere %}
              <ul class="network-card__elsewhere">
                {% for elsewhere_link in network_site.elsewhere %}
                  {% assign elsewhere_network = elsewhere_link.network | default: "web" %}
                  <li>
                    <a
                      class="network-card__elsewhere-link"
                      href="{{ elsewhere_link.url | escape }}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span
                        class="network-card__elsewhere-glyph network-card__elsewhere-glyph--{{ elsewhere_network | escape }}"
                        aria-hidden="true"
                      ></span>
                      <span class="visually-hidden">
                        {{ elsewhere_link.label | default: elsewhere_network | escape }}
                        profile linked from this participant site
                      </span>
                    </a>
                  </li>
                {% endfor %}
              </ul>
            {% endif %}
          </div>
        {% endif %}
        <a
          class="network-card__domain"
          href="{{ network_site.origin | escape }}"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ network_site.domain | escape }}
        </a>
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
  <p>JoshBot hasn't found any participating sites to show here yet.</p>
</div>
{% endif %}
