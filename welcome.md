---
layout: default
title: Welcome cards
description: >-
  Optional Joshternet welcome postcards for currently participating independent
  websites. Celebration keepsakes—not membership certificates or button embeds.
keywords: >-
  Joshternet welcome card, participation postcard, independent websites
permalink: /welcome/
joshternet_analysis: derived
seo:
  type: CollectionPage
  name: Welcome cards
---

# Welcome cards

A small keepsake for websites currently participating in the Joshternet. These
cards are optional, generated from the public registry, and are **not** a
replacement for the [official Joshternet button]({{ '/implement/buttons/' | relative_url }}).

Joshness is declared, never derived. Cards reflect each site's current Affirmed,
Declined, or Undeclared declaration—never a personal identity certificate.

{% assign welcome_cards = site.data.welcome_cards.cards %}

{% if welcome_cards and welcome_cards.size > 0 %}
  <ul class="welcome-card-list">
    {% for card in welcome_cards %}
      <li class="welcome-card-list__item h-card" id="{{ card.domain | downcase | slugify | escape }}">
        <h2 class="welcome-card-list__title p-name">{{ card.domain | escape }}</h2>
        <p class="welcome-card-list__identity">
          {% case card.identity %}
            {% when 'affirmed' %}
              Josh identity: Affirmed.
            {% when 'declined' %}
              Josh identity: Declined.
            {% else %}
              Josh identity: Undeclared.
          {% endcase %}
        </p>
        <figure class="welcome-card-list__preview">
          <img
            class="u-photo"
            src="{{ card.svg | relative_url }}"
            alt="Welcome to the Joshternet postcard for {{ card.domain | escape }}"
            width="600"
            height="315"
            loading="lazy"
            decoding="async"
          >
        </figure>
        <p class="welcome-card-list__downloads">
          <a href="{{ card.svg | relative_url }}" download>Download SVG</a>
          ·
          <a href="{{ card.png | relative_url }}" download>Download PNG</a>
          ·
          <a class="u-url" href="{{ card.network_path | relative_url }}">Network entry</a>
        </p>
      </li>
    {% endfor %}
  </ul>
{% else %}
  <div class="network-empty">
    <p>
      Welcome cards appear here after JoshBot publishes the current Network.
      Browse the
      <a href="{{ '/network/' | relative_url }}">Network</a>
      directory, or
      <a href="{{ '/implement/' | relative_url }}">publish a declaration</a>
      on your own site.
    </p>
  </div>
{% endif %}
