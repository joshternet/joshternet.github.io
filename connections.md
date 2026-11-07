---
layout: default
title: Connections
description: >-
  Explore how independent websites around the Joshternet link to one another,
  share interesting work, and sometimes write about the same ideas. Follow the
  connections and see where they lead.
keywords: >-
  Connections, Joshternet, independent websites, observed links, blogrolls,
  shared topics
seo:
  type: CollectionPage
  name: Connections
permalink: /connections/
scripts:
  - /assets/js/crawl-keys.js
  - /assets/js/connections.js
joshternet_analysis: derived
---

# Connections

The internet was built for following links, and some of the best discoveries
happen when one interesting website leads to another. Connections is a look at
how independent websites around the Joshternet link to one another, share
interesting things, and occasionally end up exploring the same ideas.

{% assign network_sites = site.data.network %}
{% assign hub_origin = "https://joshternet.org" %}
{% assign member_sites = "" | split: "" %}
{% assign hub_sites = "" | split: "" %}
{% for network_site in network_sites %}
  {% if network_site.k4b == hub_origin %}
    {% assign hub_sites = hub_sites | push: network_site %}
  {% else %}
    {% assign member_sites = member_sites | push: network_site %}
  {% endif %}
{% endfor %}
{% comment %}
  Chart participants are members only. Hub membership spokes are infrastructure,
  not peer discovery edges worth highlighting on the map.
{% endcomment %}
{% assign ordered_sites = member_sites %}
{% assign connection_edges = site.data.connections.k1y | default: empty %}
{% assign overlap_sites = site.data.connection_topics.k6i | default: empty %}
{% assign overlap_pairs = site.data.connection_topics.k4q | default: empty %}
{% assign overlap_pair_count = overlap_pairs.size | default: 0 %}
{% assign connected_site_count = 0 %}
{% for network_site in network_sites %}
  {% assign site_origin = network_site.k4b %}
  {% assign outbound = 0 %}
  {% assign inbound = 0 %}
  {% assign overlap_count = 0 %}
  {% for edge in connection_edges %}
    {% if edge.k2o == site_origin %}
      {% assign outbound = outbound | plus: 1 %}
    {% endif %}
    {% if edge.k7d == site_origin %}
      {% assign inbound = inbound | plus: 1 %}
    {% endif %}
  {% endfor %}
  {% for overlap_site in overlap_sites %}
    {% if overlap_site.k4b == site_origin %}
      {% assign overlap_count = overlap_site.k7j.size %}
    {% endif %}
  {% endfor %}
  {% if outbound > 0 or inbound > 0 %}
    {% assign connected_site_count = connected_site_count | plus: 1 %}
  {% endif %}
{% endfor %}

{% assign participant_count = ordered_sites.size | default: 0 %}

{% include connections-tally.html %}

{% if participant_count > 0 %}
<div
  class="connections-shell"
  data-connections-shell
  data-connections-mode="full"
  data-connections-bootstrap="connections-bootstrap"
>
  <section
    class="connections-graph"
    data-connections-graph
    aria-label="Directed connections graph"
    hidden
  >
    <div class="connections-graph__viewport" data-connections-viewport>
      <div class="connections-graph__stage" data-connections-graph-stage></div>
      <div class="connections-graph__map-tools" data-connections-map-tools>
        <button type="button" data-connections-zoom-in aria-label="Zoom in">
          +
        </button>
        <button type="button" data-connections-zoom-out aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          data-connections-map-reset
          aria-label="Center Joshternet"
        >
          Center
        </button>
      </div>
    </div>
    <div class="connections-graph__footer">
      <fieldset class="connections-graph__filters" data-relation-filters>
        <legend class="visually-hidden">Show on the graph</legend>
        <span class="connections-filter__label" aria-hidden="true">Show on the graph</span>
        <div class="connections-filter__list" data-relation-filter-list></div>
      </fieldset>
      {% include connections-line-key.html %}
    </div>
  </section>
</div>

<div class="connections-list" data-connections-list>
  {% for network_site in ordered_sites %}
    {% assign site_origin = network_site.k4b %}
    {% assign site_domain = network_site.k1v %}
    {% assign site_title = network_site.k7c | default: site_domain %}
    {% assign outbound = 0 %}
    {% assign inbound = 0 %}
    {% assign overlap_topics = nil %}
    {% assign overlap_count = 0 %}
    {% for edge in connection_edges %}
      {% if edge.k2o == site_origin %}
        {% assign outbound = outbound | plus: 1 %}
      {% endif %}
      {% if edge.k7d == site_origin %}
        {% assign inbound = inbound | plus: 1 %}
      {% endif %}
    {% endfor %}
    {% for overlap_site in overlap_sites %}
      {% if overlap_site.k4b == site_origin %}
        {% assign overlap_topics = overlap_site.k7j %}
        {% assign overlap_count = overlap_site.k7j.size %}
      {% endif %}
    {% endfor %}

    <section
      class="connections-site h-card"
      id="connection-{{ site_domain | slugify }}"
      data-connection-origin="{{ site_origin | escape }}"
      data-connection-domain="{{ site_domain | escape }}"
      tabindex="-1"
    >
      <span class="connections-site__keys" data-connection-keys></span>
      <header class="connections-site__header">
        {% if network_site.k63 and network_site.k63 != "" %}
          <button
            type="button"
            class="connections-site__select connections-site__select--shot"
            data-connection-select
            data-origin="{{ site_origin | escape }}"
            aria-label="Highlight {{ site_title | escape }} on the graph"
          >
            <img
              class="connections-site__shot u-photo"
              src="{{ network_site.k63 | relative_url }}"
              alt="Screenshot of {{ site_title | escape }}"
              loading="lazy"
              decoding="async"
              width="576"
              height="360"
            >
          </button>
        {% else %}
          <button
            type="button"
            class="connections-site__select"
            data-connection-select
            data-origin="{{ site_origin | escape }}"
            aria-label="Highlight {{ site_title | escape }} on the graph"
          >
            Highlight on graph
          </button>
        {% endif %}
        <div class="connections-site__identity">
          {% include outbound-href.html url=site_origin %}
          <h2 class="connections-site__title">
            <a
              class="connections-site__title-link p-name u-url"
              href="{{ outbound_href | escape }}"
              target="_blank"
              rel="noopener"
            >
              {{ site_title | escape }}
              <span class="visually-hidden">(opens on the publisher’s site)</span>
            </a>
          </h2>
          <a
            class="connections-site__domain"
            href="{{ outbound_href | escape }}"
            target="_blank"
            rel="noopener"
          >
            {{ site_domain | escape }}
          </a>
          {% if network_site.k1n and network_site.k1n != "" %}
            <p class="connections-site__description p-note">
              {{ network_site.k1n | escape }}
            </p>
          {% endif %}
        </div>
      </header>

      {% if outbound == 0 and inbound == 0 and overlap_count == 0 %}
        <p class="connections-empty-note">
          JoshBot hasn't observed any links to or from this website yet. That
          doesn't mean there's nothing interesting there. Visit
          <a href="{{ outbound_href | escape }}" target="_blank" rel="noopener">{{ site_domain | escape }}</a>
          and see what you find.
        </p>
      {% endif %}

      <div class="connections-site__columns connections-site__columns--with-topics">
        {% if outbound > 0 %}
        <div class="connections-site__column">
          <h3>Links to</h3>
            <ul class="connections-edge-list">
              {% for edge in connection_edges %}
                {% if edge.k2o == site_origin %}
                  {% assign target_title = edge.k7d %}
                  {% assign target_domain = edge.k7d %}
                  {% for candidate in network_sites %}
                    {% if candidate.origin == edge.k7d %}
                      {% assign target_title = candidate.title | default: candidate.domain %}
                      {% assign target_domain = candidate.domain %}
                    {% endif %}
                  {% endfor %}
                  {% assign link_label = edge.k7a %}
                  {% if link_label == nil or link_label == "" %}
                    {% assign link_label = target_title %}
                  {% endif %}
                  {% assign edge_kind = edge.k5l | default: edge.k3c | default: "content-link" %}
                  {% case edge_kind %}
                    {% when "homepage-link" %}
                      {% assign kind_label = "links to from the homepage" %}
                    {% when "blogroll" %}
                      {% assign kind_label = "includes in a blogroll" %}
                    {% when "reply-to" %}
                      {% assign kind_label = "replied to" %}
                    {% when "repost-of" %}
                      {% assign kind_label = "reposted" %}
                    {% when "syndication" %}
                      {% assign kind_label = "syndicated to" %}
                    {% else %}
                      {% assign kind_label = "linked to" %}
                  {% endcase %}
                  <li class="connections-edge" data-connection-kind="{{ edge_kind | escape }}">
                    <span class="connections-edge__direction" aria-hidden="true">→</span>
                    <div class="connections-edge__body">
                      {% if kind_label == "linked to" %}
                        {% include outbound-href.html url=edge.k2y %}
                        <a
                          class="connections-edge__source"
                          href="{{ outbound_href | escape }}"
                          target="_blank"
                          rel="noopener"
                        >
                          {{ target_domain | escape }}
                        </a>
                      {% else %}
                        <span class="connections-edge__kind">{{ kind_label | escape }}</span>
                      {% endif %}
                      {% unless kind_label == "linked to" and target_title == target_domain %}
                        {% include outbound-href.html url=edge.k2y %}
                        <a
                          href="{{ outbound_href | escape }}"
                          target="_blank"
                          rel="noopener"
                        >
                          {% if kind_label == "linked to" %}
                            {{ target_title | escape }}
                          {% else %}
                            {{ link_label | escape }}
                          {% endif %}
                        </a>
                      {% endunless %}
                      <span class="connections-edge__meta">
                        {% assign outbound_meta = false %}
                        {% unless kind_label == "linked to" %}
                          to
                          {% include outbound-href.html url=edge.k7d %}
                          <a
                            href="{{ outbound_href | escape }}"
                            target="_blank"
                            rel="noopener"
                          >
                            {{ target_domain | escape }}
                          </a>
                          {% assign outbound_meta = true %}
                        {% endunless %}
                        {% if edge.via and edge.via != "" %}
                          {% if outbound_meta %} · {% endif %}
                          via
                            {% include outbound-href.html url=edge.via %}
                            <a
                              href="{{ outbound_href | escape }}"
                              target="_blank"
                              rel="noopener"
                            >
                              {{ edge.via | escape }}
                            </a>
                          {% assign outbound_meta = true %}
                        {% endif %}
                        {% if edge.k4i and edge.k4i != "" %}
                          {% if outbound_meta %} · {% endif %}
                          seen on
                          {% include outbound-href.html url=edge.k4i %}
                          {% include connections-page-label.html url=edge.k4i %}
                          <a
                            href="{{ outbound_href | escape }}"
                            target="_blank"
                            rel="noopener"
                          >
                            {{ connections_page_label | escape }}
                          </a>
                          {% assign outbound_meta = true %}
                        {% endif %}
                        {% if edge.k6q and edge.k6q != "" and edge.k6q != "content" %}
                          {% if outbound_meta %} · {% endif %}
                          {{ edge.k6q | escape }}
                          {% assign outbound_meta = true %}
                        {% endif %}
                        {% if edge.k5i and edge.k5i.size > 0 %}
                          {% include connections-visible-rel.html rel=edge.k5i %}
                        {% endif %}
                      </span>
                    </div>
                  </li>
                {% endif %}
              {% endfor %}
            </ul>
        </div>
        {% endif %}

        {% if inbound > 0 %}
        <div class="connections-site__column">
          <h3>Linked from</h3>
            <ul class="connections-edge-list">
              {% for edge in connection_edges %}
                {% if edge.k7d == site_origin %}
                  {% assign source_title = edge.k2o %}
                  {% assign source_domain = edge.k2o %}
                  {% for candidate in network_sites %}
                    {% if candidate.origin == edge.k2o %}
                      {% assign source_title = candidate.title | default: candidate.domain %}
                      {% assign source_domain = candidate.domain %}
                    {% endif %}
                  {% endfor %}
                  {% assign edge_kind = edge.k5l | default: edge.k3c | default: "content-link" %}
                  {% case edge_kind %}
                    {% when "homepage-link" %}
                      {% assign kind_label = "linked from the homepage" %}
                    {% when "blogroll" %}
                      {% assign kind_label = "listed in a blogroll" %}
                    {% when "reply-to" %}
                      {% assign kind_label = "received a reply from" %}
                    {% when "repost-of" %}
                      {% assign kind_label = "was reposted by" %}
                    {% when "syndication" %}
                      {% assign kind_label = "syndicated from" %}
                    {% else %}
                      {% assign kind_label = "linked from" %}
                  {% endcase %}
                  <li class="connections-edge" data-connection-kind="{{ edge_kind | escape }}">
                    <span class="connections-edge__direction" aria-hidden="true">←</span>
                    <div class="connections-edge__body">
                      {% if kind_label == "linked from" %}
                        {% include outbound-href.html url=edge.k2o %}
                        <a
                          class="connections-edge__source"
                          href="{{ outbound_href | escape }}"
                          target="_blank"
                          rel="noopener"
                        >
                          {{ source_domain | escape }}
                        </a>
                      {% else %}
                        <span class="connections-edge__kind">{{ kind_label | escape }}</span>
                      {% endif %}
                      {% unless kind_label == "linked from" and source_title == source_domain %}
                        {% include outbound-href.html url=edge.k2o %}
                        <a
                          href="{{ outbound_href | escape }}"
                          target="_blank"
                          rel="noopener"
                        >
                          {{ source_title | escape }}
                        </a>
                      {% endunless %}
                      <span class="connections-edge__meta">
                        {% assign inbound_meta = false %}
                        {% unless kind_label == "linked from" %}
                          {% if source_domain and source_domain != source_title %}
                            {{ source_domain | escape }}
                            {% assign inbound_meta = true %}
                          {% endif %}
                        {% endunless %}
                        {% if edge.via and edge.via != "" %}
                          {% if inbound_meta %} · {% endif %}
                          via
                            {% include outbound-href.html url=edge.via %}
                            <a
                              href="{{ outbound_href | escape }}"
                              target="_blank"
                              rel="noopener"
                            >
                              {{ edge.via | escape }}
                            </a>
                          {% assign inbound_meta = true %}
                        {% endif %}
                        {% if edge.k4i and edge.k4i != "" %}
                          {% if inbound_meta %} · {% endif %}
                          seen on
                          {% include outbound-href.html url=edge.k4i %}
                          {% include connections-page-label.html url=edge.k4i %}
                          <a
                            href="{{ outbound_href | escape }}"
                            target="_blank"
                            rel="noopener"
                          >
                            {{ connections_page_label | escape }}
                          </a>
                        {% endif %}
                      </span>
                    </div>
                  </li>
                {% endif %}
              {% endfor %}
            </ul>
        </div>
        {% endif %}

        {% if overlap_count > 0 %}
        <div class="connections-site__column connections-site__column--topics">
            <details class="connections-topic__disclosure">
              <summary>
                <h3>Shared topics</h3>
                <span class="connections-topic__count">
                  {{ overlap_count }}
                  {% if overlap_count == 1 %}topic{% else %}topics{% endif %}
                </span>
              </summary>
              <p class="connections-topic__hint">
                These are subjects that this website and other participating
                websites have both published about. Sharing a subject doesn't mean
                the publishers agreed or interacted.
              </p>
              <ul class="connections-topic-list">
                {% for topic in overlap_topics %}
                  {% assign article_count = topic.kc.size | default: 0 %}
                  {% for peer in topic.k6i %}
                    {% assign article_count = article_count | plus: peer.articles.size %}
                  {% endfor %}
                  <li class="connections-topic" data-connection-kind="shared-topic">
                    <span class="connections-topic__label">
                      <a href="{{ '/topics/' | append: topic.k6o | append: '/' | relative_url }}">
                        {{ topic.k3g | escape }}
                      </a>
                    </span>
                    {% if article_count > 0 %}
                      <span class="connections-topic__count">
                        {{ article_count }}
                        {% if article_count == 1 %}article{% else %}articles{% endif %}
                      </span>
                    {% endif %}
                  </li>
                {% endfor %}
              </ul>
            </details>
        </div>
        {% endif %}
      </div>
    </section>
{% endfor %}
</div>

{% assign recently_joined_now_s = site.time | date: '%s' | plus: 0 %}
{% assign recently_joined_window_s = 7 | times: 24 | times: 60 | times: 60 %}
{% assign recently_joined_cutoff_s = recently_joined_now_s | minus: recently_joined_window_s %}
{% capture connections_bootstrap %}
{
"participants": [
{% for network_site in ordered_sites %}
{% assign site_recently_joined = false %}
{% if network_site.k2j and network_site.k2j != '' %}
{% assign site_joined_at_s = network_site.k2j | date: '%s' | plus: 0 %}
{% if site_joined_at_s >= recently_joined_cutoff_s and site_joined_at_s <= recently_joined_now_s %}
{% assign site_recently_joined = true %}
{% endif %}
{% endif %}
{
"origin": {{ network_site.k4b | jsonify }},
"domain": {{ network_site.k1v | jsonify }},
"title": {{ network_site.k7c | default: network_site.k1v | jsonify }},
"description": {{ network_site.k1n | default: "" | jsonify }},
"screenshot": {{ network_site.k63 | default: "" | jsonify }},
"first_participated_at": {{ network_site.k2j | default: "" | jsonify }},
"recently_joined": {% if site_recently_joined %}true{% else %}false{% endif %}
}{% unless forloop.last %},{% endunless %}
{% endfor %}
],
"connections": {{ connection_edges | jsonify }},
"topic_overlaps": {{ overlap_pairs | jsonify }},
"topic_groups": {{ overlap_sites | jsonify }}
}
{% endcapture %}
<script type="application/json" id="connections-bootstrap">
{{ connections_bootstrap | replace: "<", "\u003c" }}
</script>
{% else %}
<div class="network-empty">
  <p>
    Nothing has made it into Connections just yet. Browse the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    and see what people are sharing on their own sites.
  </p>
</div>
{% endif %}

<p class="connections-close">
  The best part of following links is that you never really know where they'll
  lead. Find a website that catches your eye, see who it links to, and keep
  wandering. That's how a lot of the good internet has always worked.
</p>

<div class="connections-howto">
  <p class="connections-howto__note">
    <span class="connections-howto__links">
      <a href="{{ '/implement/connections/' | relative_url }}"
        >How Joshternet gathers connections</a
      >
    </span>
  </p>
</div>

<noscript>
  <p class="connections-noscript">
    The interactive graph needs JavaScript, but you can still explore the
    observed links in the lists above. The websites and their connections don't
    disappear just because the circles do.
  </p>
</noscript>
