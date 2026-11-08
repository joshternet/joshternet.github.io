---
layout: default
title: What the Joshternet uses
description: >-
  See which tools, software and gear turn up across the Joshternet. Compare
  anonymous counts of what participating websites report using.
keywords: >-
  uses, tools, setup, Joshternet, independent websites, /uses
seo:
  type: CollectionPage
  name: What the Joshternet uses
robots: max-snippet:160, max-image-preview:large
permalink: /uses/
joshternet_analysis: derived
scripts:
  - /assets/js/crawl-keys.js
  - /assets/js/uses.js
---

{% assign summary = site.data.uses_summary %}

# What the Joshternet uses

See which tools, software and gear turn up across the Joshternet. Counts are
anonymous: how many verified Uses pages report each choice, not a roster of
anyone’s setup.

<div data-uses>
{% if summary == nil or summary.k5z == nil %}
<section class="uses-summary" aria-labelledby="uses-network-heading">
  <h2 id="uses-network-heading">Across the network</h2>
  <p class="network-empty" role="status">
    Uses data is not available right now. Browse the
    <a href="{{ '/network/' | relative_url }}">Network</a> to explore
    participating websites.
  </p>
</section>
{% else %}
<section class="uses-summary" aria-labelledby="uses-network-heading">
  <h2 id="uses-network-heading">Across the network</h2>
  <p class="uses-summary__coverage">
    {% if summary.k7v == nil or summary.k1z == nil %}
    Coverage is still settling for this snapshot.
    {% else %}
    <strong>{{ summary.k7v }}</strong> of
    <strong>{{ summary.k1z }}</strong> eligible network sites have a verified
    Uses page in this count.
    {% endif %}
  </p>
  {% if summary.k1d %}
  <p class="uses-summary__note">{{ summary.k1d | escape }}</p>
  {% endif %}
</section>

<section class="uses-table-section" aria-labelledby="uses-tools-heading" data-uses-snapshot="{{ summary.k6p | escape }}">
  <h2 id="uses-tools-heading">Comparable choices</h2>
  {% if summary.k6n and summary.k6n.size > 0 %}
  {% assign uses_kind_ids = "software,hardware,service,media,practice" | split: "," %}
  {% assign uses_kind_labels = "Software,Hardware,Service,Media,Practice" | split: "," %}
  <div data-uses-slots>
    {% for kind_id in uses_kind_ids %}
      {% assign kind_label = uses_kind_labels[forloop.index0] %}
      {% assign kind_has_slots = false %}
      {% for slot in summary.k6n %}
        {% if slot.k3c == kind_id %}
          {% assign kind_has_slots = true %}
        {% endif %}
      {% endfor %}
      {% if kind_has_slots %}
      <section class="uses-kind" data-uses-kind="{{ kind_id | escape }}">
        <h3 class="uses-kind__title">{{ kind_label | escape }}</h3>
        {% for slot in summary.k6n %}
          {% if slot.k3c == kind_id %}
          <section class="uses-slot" id="uses-slot-{{ slot.k30 | escape }}" data-uses-slot="{{ slot.k30 | escape }}" data-uses-denominator="{{ slot.k1l }}">
            <h4>{{ slot.k42 | escape }}</h4>
            {% if slot.k1l == 0 or slot.k56 == nil or slot.k56.size == 0 %}
            <p>No comparable reports.</p>
            {% else %}
            <div class="uses-table-wrap">
              <table class="uses-table" data-uses-table>
                <thead>
                  <tr>
                    <th scope="col">Choice</th>
                    <th scope="col">Sites in this slot</th>
                    <th scope="col">Share of this slot</th>
                  </tr>
                </thead>
                <tbody>
                  {% for tool in slot.k56 %}
                  <tr data-uses-product="{{ tool.k7g | escape }}" data-uses-count="{{ tool.k4 }}" data-uses-name="{{ tool.k42 | default: tool.k7g | escape }}">
                    <th scope="row">
                      {% if tool.k7y and tool.k7y != "" %}
                      <a href="{{ tool.k7y | escape }}" target="_blank" rel="noopener">{{ tool.k42 | default: tool.k7g | escape }}</a>
                      {% else %}
                      {{ tool.k42 | default: tool.k7g | escape }}
                      {% endif %}
                    </th>
                    <td>{{ tool.k4 }} of {{ slot.k1l }}</td>
                    <td>
                      {% if tool.k6 == nil %}
                        —
                      {% else %}
                        {{ tool.k6 }}%
                      {% endif %}
                    </td>
                  </tr>
                  {% endfor %}
                </tbody>
              </table>
            </div>
            {% endif %}
          </section>
          {% endif %}
        {% endfor %}
      </section>
      {% endif %}
    {% endfor %}
    {% comment %}Slots without a known kind still appear so nothing is dropped.{% endcomment %}
    {% for slot in summary.k6n %}
      {% unless slot.k3c == "software" or slot.k3c == "hardware" or slot.k3c == "service" or slot.k3c == "media" or slot.k3c == "practice" %}
      <section class="uses-slot" id="uses-slot-{{ slot.k30 | escape }}" data-uses-slot="{{ slot.k30 | escape }}" data-uses-denominator="{{ slot.k1l }}">
        <h3>{{ slot.k42 | escape }}</h3>
        {% if slot.k1l == 0 or slot.k56 == nil or slot.k56.size == 0 %}
        <p>No comparable reports.</p>
        {% else %}
        <div class="uses-table-wrap">
          <table class="uses-table" data-uses-table>
            <thead>
              <tr>
                <th scope="col">Choice</th>
                <th scope="col">Sites in this slot</th>
                <th scope="col">Share of this slot</th>
              </tr>
            </thead>
            <tbody>
              {% for tool in slot.k56 %}
              <tr data-uses-product="{{ tool.k7g | escape }}" data-uses-count="{{ tool.k4 }}" data-uses-name="{{ tool.k42 | default: tool.k7g | escape }}">
                <th scope="row">{{ tool.k42 | default: tool.k7g | escape }}</th>
                <td>{{ tool.k4 }} of {{ slot.k1l }}</td>
                <td>{% if tool.k6 == nil %}—{% else %}{{ tool.k6 }}%{% endif %}</td>
              </tr>
              {% endfor %}
            </tbody>
          </table>
        </div>
        {% endif %}
      </section>
      {% endunless %}
    {% endfor %}
  </div>
  {% elsif summary.k7v and summary.k7v > 0 %}
  <p class="network-empty" role="status">
    No comparable choices are available in this view yet.
  </p>
  {% else %}
  <p class="network-empty" role="status">
    No verified Uses pages are included in this view yet. Browse the
    <a href="{{ '/network/' | relative_url }}">Network</a> to explore
    participating websites.
  </p>
  {% endif %}
  {% if jekyll.environment == 'development' %}
  {% if summary.k7n and summary.k7n.size > 0 %}
  <h3>Unsorted</h3>
  <p>These names are on a Uses page. This catalog does not support a slot for them yet, so they are not in the percentages.</p>
  <ul class="list-stack">
    {% for item in summary.k7n %}
    <li>
      {% if item.k6x and item.k6x.size > 1 %}
      <details class="uses-evidence">
        <summary>{{ item.k42 | escape }} — {{ item.k6x.size }} sites</summary>
        <ul class="uses-evidence__list list-stack">
          {% for source in item.k6x %}
          <li>
            <a href="{{ source.k4m | escape }}">{{ source.k3g | default: source.k4b | escape }}</a>
          </li>
          {% endfor %}
        </ul>
      </details>
      {% elsif item.k6x and item.k6x.size == 1 %}
      {% assign uses_one_source = item.k6x | first %}
      {{ item.k42 | escape }}
      — <a href="{{ uses_one_source.k4m | escape }}">{{ uses_one_source.k3g | default: uses_one_source.k4b | escape }}</a>
      {% else %}
      {{ item.k42 | escape }}
      — <a href="{{ item.k4m | escape }}">{{ item.k3g | default: item.k4b | escape }}</a>
      {% endif %}
    </li>
    {% endfor %}
  </ul>
  {% endif %}
  {% if summary.k6c and summary.k6c.size > 0 %}
  <h3>Setup details</h3>
  <p>Parts, generic gear, and explanations stay with publisher setups. They are not compared as products. Counts stay anonymous.</p>
  <ul class="list-stack">
    {% for item in summary.k6c %}
    <li>
      {{ item.k42 | escape }}{% if item.k8d and item.k8d > 0 %} — {{ item.k8d }} site{% if item.k8d != 1 %}s{% endif %}{% endif %}
    </li>
    {% endfor %}
  </ul>
  {% endif %}
  {% if summary.k7p and summary.k7p.size > 0 %}
  <h3>Stated uses</h3>
  <ul class="list-stack">
    {% for entry in summary.k7p %}
    <li>{{ entry.k30 | escape }} — {{ entry.k1b }}</li>
    {% endfor %}
  </ul>
  {% endif %}
  {% endif %}
</section>
{% endif %}

<section class="uses-enhance" aria-labelledby="uses-change-heading" data-uses-enhance>
  <h2 id="uses-change-heading">Over time</h2>
  <p>
    Explore anonymous snapshots by month, quarter, year or across all available
    history. These are counts of what participating sites reported, not a
    complete history of anyone’s setup.
  </p>
  <div class="explore-toolbar uses-toolbar" role="group" aria-label="Period">
    <button type="button" class="showcase-filters__button is-active" data-uses-period="month" aria-pressed="true">Monthly</button>
    <button type="button" class="showcase-filters__button" data-uses-period="quarter" aria-pressed="false">Quarterly</button>
    <button type="button" class="showcase-filters__button" data-uses-period="year" aria-pressed="false">Yearly</button>
    <button type="button" class="showcase-filters__button" data-uses-period="all-time" aria-pressed="false">All time</button>
  </div>
  <p class="uses-status" data-uses-status role="status">
    {% if summary.k7l %}
    Historical views load in the browser.
    {% else %}
    History starts with the first recorded observations. There isn’t enough comparable history to show a trend yet, but you can explore the current anonymous snapshot.
    {% endif %}
  </p>
  <div class="uses-chart" data-uses-chart></div>
</section>

<p class="uses-howto">
  <a href="{{ summary.k40 | default: '/implement/content/uses/' }}">How this data is collected</a>
</p>
</div>
