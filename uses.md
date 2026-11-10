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

See which tools, software and gear turn up across the Joshternet.

<div data-uses>
{% if summary == nil or summary.k5z == nil %}
<p class="network-empty" role="status">
  Uses data is not available right now. Browse the
  <a href="{{ '/network/' | relative_url }}">Network</a> to explore
  participating websites.
</p>
{% else %}

<section class="uses-table-section" aria-label="Comparable choices" data-uses-snapshot="{{ summary.k6p | escape }}">
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
        <h2 class="uses-kind__title">{{ kind_label | escape }}</h2>
        {% for slot in summary.k6n %}
          {% if slot.k3c == kind_id %}
          {% include uses-slot-card.html heading="h3" %}
          {% endif %}
        {% endfor %}
      </section>
      {% endif %}
    {% endfor %}
    {% comment %}Slots without a known kind still appear so nothing is dropped.{% endcomment %}
    {% for slot in summary.k6n %}
      {% unless slot.k3c == "software" or slot.k3c == "hardware" or slot.k3c == "service" or slot.k3c == "media" or slot.k3c == "practice" %}
      {% include uses-slot-card.html heading="h2" %}
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
  {% assign uses_dev_unsorted = false %}
  {% assign uses_dev_setup = false %}
  {% assign uses_dev_stated = false %}
  {% if summary.k7n and summary.k7n.size > 0 %}
    {% assign uses_dev_unsorted = true %}
  {% endif %}
  {% if summary.k6c and summary.k6c.size > 0 %}
    {% assign uses_dev_setup = true %}
  {% endif %}
  {% if summary.k7p and summary.k7p.size > 0 %}
    {% assign uses_dev_stated = true %}
  {% endif %}
  {% if uses_dev_unsorted or uses_dev_setup or uses_dev_stated %}
  <section class="uses-dev-review" aria-label="Local review only">
    <p class="uses-dev-review__badge">Local review — not published</p>
    {% if uses_dev_unsorted %}
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
    {% if uses_dev_setup %}
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
    {% if uses_dev_stated %}
    <h3>Stated uses</h3>
    <ul class="list-stack">
      {% for entry in summary.k7p %}
      <li>{{ entry.k30 | escape }} — {{ entry.k1b }}</li>
      {% endfor %}
    </ul>
    {% endif %}
  </section>
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

<footer class="uses-footnote">
  {% if summary != nil and summary.k5z != nil %}
  <p class="uses-footnote__coverage">
    {% if summary.k7v == nil or summary.k1z == nil %}
    Coverage is still settling for this snapshot.
    {% else %}
    <strong>{{ summary.k7v }}</strong> of
    <strong>{{ summary.k1z }}</strong> eligible network sites have a verified
    Uses page in this count.
    {% endif %}
  </p>
  {% if summary.k1d %}
  <p class="uses-footnote__note">{{ summary.k1d | escape }}</p>
  {% endif %}
  {% endif %}
  <p class="uses-footnote__note">
    Choice counts are compared across the sites that reported each category.
  </p>
  <p class="uses-footnote__note">Sites can report more than one.</p>
  <p class="uses-howto">
    <a href="{{ summary.k40 | default: '/implement/content/uses/' }}">How this data is collected</a>
  </p>
</footer>
</div>
