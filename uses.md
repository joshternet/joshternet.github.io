---
layout: default
title: What the Joshternet uses
description: >-
  See which tools, software and gear turn up across the Joshternet. Compare what
  participating websites report using, then follow the source pages.
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

See which tools, software and gear turn up across the Joshternet. Compare what
participating websites report using, then follow the source pages for a closer
look at the setups behind them.

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
  <ul class="uses-summary__stats">
    <li>
      <span class="uses-summary__label">Eligible sites</span>
      <span class="uses-summary__value">{% if summary.k1z == nil %}—{% else %}{{ summary.k1z }}{% endif %}</span>
    </li>
    <li>
      <span class="uses-summary__label">Sites with verified Uses pages</span>
      <span class="uses-summary__value">{% if summary.k7v == nil %}—{% else %}{{ summary.k7v }}{% endif %}</span>
    </li>
    <li>
      <span class="uses-summary__label">Tools currently reported</span>
      <span class="uses-summary__value">{% if summary.k1s == nil %}—{% else %}{{ summary.k1s }}{% endif %}</span>
    </li>
  </ul>
</section>

<section class="uses-table-section" aria-labelledby="uses-tools-heading" data-uses-snapshot="{{ summary.k6p | escape }}">
  <h2 id="uses-tools-heading">Comparable choices</h2>
  {% if summary.k6n and summary.k6n.size > 0 %}
  <div data-uses-slots>
    {% for slot in summary.k6n %}
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
              <th scope="row">
                {% if tool.k6x and tool.k6x.size > 0 %}
                <details class="uses-evidence">
                  <summary>
                    {% if tool.k7y and tool.k7y != "" %}
                    <a href="{{ tool.k7y | escape }}" target="_blank" rel="noopener">{{ tool.k42 | default: tool.k7g | escape }}</a>
                    {% else %}
                    {{ tool.k42 | default: tool.k7g | escape }}
                    {% endif %}
                  </summary>
                  <ul class="uses-evidence__list list-stack">
                    {% for source in tool.k6x %}
                    <li>
                      <a href="{{ source.k4m | escape }}">{{ source.k3g | default: source.k4b | escape }}</a>
                    </li>
                    {% endfor %}
                  </ul>
                </details>
                {% else %}
                {% if tool.k7y and tool.k7y != "" %}
                <a href="{{ tool.k7y | escape }}" target="_blank" rel="noopener">{{ tool.k42 | default: tool.k7g | escape }}</a>
                {% else %}
                {{ tool.k42 | default: tool.k7g | escape }}
                {% endif %}
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
    {% endfor %}
  </div>
  <h3>Ranked product rows per slot</h3>
  <p>This counts ranked choices in the current snapshot. It is not a popularity ranking.</p>
  <div class="uses-table-wrap">
    <table class="uses-table" data-uses-slot-chart>
      <thead>
        <tr>
          <th scope="col">Slot</th>
          <th scope="col">Ranked product rows</th>
        </tr>
      </thead>
      <tbody>
        {% for slot in summary.k6n %}
        <tr>
          <th scope="row">{{ slot.k42 | escape }}</th>
          <td>{{ slot.k56.size }}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
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
  {% if summary.k7n and summary.k7n.size > 0 %}
  <h3>Unsorted</h3>
  <p>These names are on a Uses page. This catalog does not support a slot for them yet, so they are not in the percentages.</p>
  <ul class="list-stack">
    {% for item in summary.k7n %}
    <li>
      {{ item.k42 | escape }}
      — <a href="{{ item.k4m | escape }}">{{ item.k3g | default: item.k4b | escape }}</a>
    </li>
    {% endfor %}
  </ul>
  {% endif %}
  {% if summary.k6c and summary.k6c.size > 0 %}
  <h3>Setup details</h3>
  <p>Parts, generic gear, and explanations stay with the publisher’s setup. They are not compared as products.</p>
  <ul class="list-stack">
    {% for item in summary.k6c %}
    <li>
      {{ item.k42 | escape }}
      — <a href="{{ item.k4m | escape }}">{{ item.k3g | default: item.k4b | escape }}</a>
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
</section>

{% if summary.k3p and summary.k3p.size > 0 %}
<section class="uses-ledger" aria-labelledby="uses-ledger-heading">
  <h2 id="uses-ledger-heading">Sources in this count</h2>
  <p>{{ summary.k1m | escape }}</p>
  <ul class="list-stack">
    {% for row in summary.k3p %}
    <li>
      <a href="{{ row.page_url | escape }}">{{ row.label | default: row.origin | escape }}</a>
      — {{ row.outcome | escape }}{% if row.in_denominator %}, {{ row.accepted_count }} accepted{% endif %}.
      {{ row.reason | escape }}
    </li>
    {% endfor %}
  </ul>
</section>
{% endif %}
{% endif %}

<section class="uses-enhance" aria-labelledby="uses-change-heading" data-uses-enhance>
  <h2 id="uses-change-heading">Over time</h2>
  <p>
    Explore the recorded observations by month, quarter, year or across all
    available history. These are snapshots of what participating sites reported,
    not a complete history of anyone’s setup.
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
    History starts with the first recorded observations. There isn’t enough comparable history to show a trend yet, but you can explore the current snapshot and its sources.
    {% endif %}
  </p>
  <div class="uses-chart" data-uses-chart></div>
</section>

<p class="uses-howto">
  <a href="{{ summary.k40 | default: '/implement/content/uses/' }}">How this data is collected</a>
</p>
</div>
