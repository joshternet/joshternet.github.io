---
layout: default
title: Topic neighborhoods across Joshternet websites
description: >-
  Browse topic neighborhoods across the Joshternet—clusters of independent
  websites writing about the same subjects, with evidence for why each site appears.
keywords: >-
  Joshternet topics, topic neighborhoods, independent websites, Josh network
seo:
  type: CollectionPage
  name: Topics
permalink: /topics/
joshternet_analysis: derived
script: /assets/js/topics.js
---

{% assign neighborhoods = site.data.topic_views.neighborhoods | default: empty %}
{% assign community_count = site.data.topic_views.community_count | default: 0 %}

# Topics

Topics from around the Joshternet.

{% if community_count > 0 and neighborhoods.size > 0 %}
<div class="explore-toolbar" data-topics-toolbar>
  <label class="explore-filter-field">
    <span>Find a topic</span>
    <input
      type="search"
      data-topics-filter
      autocomplete="off"
      spellcheck="false"
    >
  </label>
</div>

<p class="visually-hidden" data-topics-status role="status" aria-live="polite"></p>

<ol class="activity-list topics-index h-feed" data-topics-index>
  {% for topic in neighborhoods %}
    <li
      class="activity-card h-entry"
      data-topic-item
      data-label="{{ topic.label | downcase | escape }}"
    >
      <article>
        <div class="activity-card__body">
          <div class="activity-card__heading">
            <h2 class="activity-card__title p-name">
              <a class="u-url" href="{{ '/topics/' | append: topic.slug | append: '/' | relative_url }}">
                {{ topic.label | escape }}
              </a>
            </h2>
          </div>
          <div class="activity-card__footer">
            <p class="activity-card__topics"></p>
            <p class="activity-card__domain">
              {{ topic.occurrence_count | default: 0 }}
              {% if topic.occurrence_count == 1 %}piece{% else %}pieces{% endif %}
              ·
              {{ topic.member_count }}
              {% if topic.member_count == 1 %}site{% else %}sites{% endif %}
            </p>
          </div>
        </div>
      </article>
    </li>
  {% endfor %}
</ol>
{% else %}
<div class="network-empty">
  <p>
    No topics yet. Browse the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    to visit participating sites directly.
  </p>
</div>
{% endif %}
