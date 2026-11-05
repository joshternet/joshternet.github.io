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
script: /assets/js/uses.js
---

{% assign summary = site.data.uses_summary %}

# What the Joshternet uses

See which tools, software and gear turn up across the Joshternet. Compare what
participating websites report using, then follow the source pages for a closer
look at the setups behind them.

<div data-uses>
{% if summary == nil or summary.schema_version == nil %}
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
      <span class="uses-summary__value">{% if summary.eligible_member_count == nil %}—{% else %}{{ summary.eligible_member_count }}{% endif %}</span>
    </li>
    <li>
      <span class="uses-summary__label">Sites with verified Uses pages</span>
      <span class="uses-summary__value">{% if summary.verified_uses_member_count == nil %}—{% else %}{{ summary.verified_uses_member_count }}{% endif %}</span>
    </li>
    <li>
      <span class="uses-summary__label">Tools currently reported</span>
      <span class="uses-summary__value">{% if summary.distinct_tool_count == nil %}—{% else %}{{ summary.distinct_tool_count }}{% endif %}</span>
    </li>
  </ul>
</section>

<section class="uses-table-section" aria-labelledby="uses-tools-heading" data-uses-snapshot="{{ summary.snapshot_id | escape }}">
  <h2 id="uses-tools-heading">Comparable choices</h2>
  {% if summary.slots and summary.slots.size > 0 %}
  <div data-uses-slots>
    {% for slot in summary.slots %}
    <section class="uses-slot" id="uses-slot-{{ slot.id | escape }}" data-uses-slot="{{ slot.id | escape }}" data-uses-denominator="{{ slot.denominator }}">
      <h3>{{ slot.name | escape }}</h3>
      {% if slot.denominator == 0 or slot.products == nil or slot.products.size == 0 %}
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
            {% for tool in slot.products %}
            <tr data-uses-product="{{ tool.tool_id | escape }}" data-uses-count="{{ tool.active_member_count }}" data-uses-name="{{ tool.name | default: tool.tool_id | escape }}">
              <th scope="row">
                {% if tool.sources and tool.sources.size > 0 %}
                <details class="uses-evidence">
                  <summary>
                    {% if tool.website and tool.website != "" %}
                    <a href="{{ tool.website | escape }}" target="_blank" rel="noopener">{{ tool.name | default: tool.tool_id | escape }}</a>
                    {% else %}
                    {{ tool.name | default: tool.tool_id | escape }}
                    {% endif %}
                  </summary>
                  <ul class="uses-evidence__list list-stack">
                    {% for source in tool.sources %}
                    <li>
                      <a href="{{ source.page_url | escape }}">{{ source.label | default: source.origin | escape }}</a>
                    </li>
                    {% endfor %}
                  </ul>
                </details>
                {% else %}
                {% if tool.website and tool.website != "" %}
                <a href="{{ tool.website | escape }}" target="_blank" rel="noopener">{{ tool.name | default: tool.tool_id | escape }}</a>
                {% else %}
                {{ tool.name | default: tool.tool_id | escape }}
                {% endif %}
                {% endif %}
              </th>
              <td>{{ tool.active_member_count }} of {{ slot.denominator }}</td>
              <td>
                {% if tool.adoption_score == nil %}
                  —
                {% else %}
                  {{ tool.adoption_score }}%
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
        {% for slot in summary.slots %}
        <tr>
          <th scope="row">{{ slot.name | escape }}</th>
          <td>{{ slot.products.size }}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>
  {% elsif summary.verified_uses_member_count and summary.verified_uses_member_count > 0 %}
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
  {% if summary.unsorted and summary.unsorted.size > 0 %}
  <h3>Unsorted</h3>
  <p>These names are on a Uses page. This catalog does not support a slot for them yet, so they are not in the percentages.</p>
  <ul class="list-stack">
    {% for item in summary.unsorted %}
    <li>
      {{ item.name | escape }}
      — <a href="{{ item.page_url | escape }}">{{ item.label | default: item.origin | escape }}</a>
    </li>
    {% endfor %}
  </ul>
  {% endif %}
  {% if summary.setup and summary.setup.size > 0 %}
  <h3>Setup details</h3>
  <p>Parts, generic gear, and explanations stay with the publisher’s setup. They are not compared as products.</p>
  <ul class="list-stack">
    {% for item in summary.setup %}
    <li>
      {{ item.name | escape }}
      — <a href="{{ item.page_url | escape }}">{{ item.label | default: item.origin | escape }}</a>
    </li>
    {% endfor %}
  </ul>
  {% endif %}
  {% if summary.use_case_counts and summary.use_case_counts.size > 0 %}
  <h3>Stated uses</h3>
  <ul class="list-stack">
    {% for entry in summary.use_case_counts %}
    <li>{{ entry.id | escape }} — {{ entry.count }}</li>
    {% endfor %}
  </ul>
  {% endif %}
</section>

{% if summary.ledger and summary.ledger.size > 0 %}
<section class="uses-ledger" aria-labelledby="uses-ledger-heading">
  <h2 id="uses-ledger-heading">Sources in this count</h2>
  <p>{{ summary.denominator_note | escape }}</p>
  <ul class="list-stack">
    {% for row in summary.ledger %}
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
    {% if summary.trend_ready %}
    Historical views load in the browser.
    {% else %}
    History starts with the first recorded observations. There isn’t enough comparable history to show a trend yet, but you can explore the current snapshot and its sources.
    {% endif %}
  </p>
  <div class="uses-chart" data-uses-chart></div>
</section>

<p class="uses-howto">
  <a href="{{ summary.methodology_url | default: '/implement/content/uses/' }}">How this data is collected</a>
</p>
</div>
