---
layout: default
title: Topics
description: >-
  Explore ideas and shared interests across independent websites in the
  Joshternet. Find articles, projects, and different perspectives on subjects
  that catch your attention.
keywords: >-
  Topics, Joshternet, independent websites, shared interests, articles, projects
seo:
  type: CollectionPage
  name: Topics
robots: max-snippet:160, max-image-preview:large
permalink: /topics/
joshternet_analysis: derived
script: /assets/js/topics.js
---

{% assign neighborhoods = site.data.topic_views.k44 | default: empty %}
{% assign community_count = site.data.topic_views.kv | default: 0 %}
{% assign neighborhood_count = neighborhoods | size %}

# Topics

One of the interesting things about wandering through independent websites is
discovering how many people are exploring the same ideas in completely different
ways. Someone might be writing about photography, another might be building
software, and somewhere else a person is experimenting with something you never
thought to look for.

{% if neighborhood_count > 0 %}
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
      class="activity-card h-card"
      data-topic-item
      data-label="{{ topic.k3g | downcase | escape }}"
    >
      <article>
        <div class="activity-card__body">
          <div class="activity-card__heading">
            <h2 class="activity-card__title p-name">
              <a class="u-url" href="{{ '/topics/' | append: topic.k6o | append: '/' | relative_url }}">
                {{ topic.k3g | escape }}
              </a>
            </h2>
          </div>
          <div class="activity-card__footer">
            <p class="activity-card__topics"></p>
            <p class="activity-card__domain">
              {{ topic.k4a | default: 0 }}
              {% if topic.k4a == 1 %}work{% else %}works{% endif %}
              ·
              {{ topic.k3u }}
              {% if topic.k3u == 1 %}site{% else %}sites{% endif %}
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
    Nothing has made it into Topics just yet, but there are still plenty of
    interesting websites to explore. Visit the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    and see what people are writing, building, and sharing on their own sites.
  </p>
</div>
{% endif %}

<footer class="topics-footnote">
  <p>
    Topics brings some of those shared interests together. Pick something that
    catches your attention and see what people across the Joshternet have been
    writing, making, and exploring. Think of each topic as a little neighborhood of
    ideas, with different websites contributing their own perspectives.
  </p>
  <p>
    Some topics come from information publishers share about their websites. Others
    are discovered by looking at what they've published. Joshternet uses that
    information to help connect related work, but the labels are not always ones the
    publishers chose themselves. Writing about the same subject doesn't mean two
    people know each other or see things the same way—and a topic link is not an
    endorsement or a claim of expertise. Follow an article that catches your eye and
    you'll end up on the publisher's own website, where the work belongs. Publishers
    who want to make work easier to find can read
    <a href="{{ '/implement/content/explore/' | relative_url }}">Explore</a>
    in the content handbook.
  </p>
</footer>
