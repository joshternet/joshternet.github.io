---
layout: default
title: Connections between independent Joshternet websites
description: >-
  See how participating Joshternet websites link to each other—observed homepage
  and about-page bridges, shared topics, and an optional equal-weight graph.
keywords: >-
  Joshternet connections, website links, independent websites, Josh network graph
seo:
  type: CollectionPage
  name: Connections
permalink: /connections/
script: /assets/js/connections.js
joshternet_analysis: derived
---

# Connections

Connections from around the Joshternet.

{% assign network_sites = site.data.network %}
{% if jekyll.environment == "development" %}
{% assign network_sites = network_sites | concat: site.data.network_dev %}
{% endif %}
{% assign hub_origin = "https://joshternet.org" %}
{% assign member_sites = "" | split: "" %}
{% assign hub_sites = "" | split: "" %}
{% for network_site in network_sites %}
  {% if network_site.origin == hub_origin %}
    {% assign hub_sites = hub_sites | push: network_site %}
  {% else %}
    {% assign member_sites = member_sites | push: network_site %}
  {% endif %}
{% endfor %}
{% assign ordered_sites = member_sites | concat: hub_sites %}
{% assign connection_edges = site.data.connections.edges | default: empty %}
{% assign overlap_sites = site.data.connection_topics.sites | default: empty %}
{% assign overlap_pairs = site.data.connection_topics.pairs | default: empty %}
{% assign overlap_pair_count = overlap_pairs.size | default: 0 %}
{% assign connected_site_count = 0 %}
{% for network_site in network_sites %}
  {% assign site_origin = network_site.origin %}
  {% assign outbound = 0 %}
  {% assign inbound = 0 %}
  {% assign overlap_count = 0 %}
  {% for edge in connection_edges %}
    {% if edge.from == site_origin %}
      {% assign outbound = outbound | plus: 1 %}
    {% endif %}
    {% if edge.to == site_origin %}
      {% assign inbound = inbound | plus: 1 %}
    {% endif %}
  {% endfor %}
  {% for overlap_site in overlap_sites %}
    {% if overlap_site.origin == site_origin %}
      {% assign overlap_count = overlap_site.topics.size %}
    {% endif %}
  {% endfor %}
  {% if outbound > 0 or inbound > 0 or overlap_count > 0 %}
    {% assign connected_site_count = connected_site_count | plus: 1 %}
  {% endif %}
{% endfor %}

<p class="network-count" aria-live="polite">
  <strong data-connections-count>{{ connected_site_count }}</strong>
  <span>
    {% if connected_site_count == 1 %}site with observed links{% else %}sites with observed links{% endif %}
  </span>
  ·
  <strong data-connections-edge-count>{{ connection_edges | size }}</strong>
  <span>
    {% if connection_edges.size == 1 %}observed link{% else %}observed links{% endif %}
  </span>
  ·
  <strong data-connections-topic-count>{{ overlap_pair_count }}</strong>
  <span>
    {% if overlap_pair_count == 1 %}shared topic{% else %}shared topics{% endif %}
  </span>
</p>

{% if connected_site_count > 0 %}
<div class="connections-shell" data-connections-shell>
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
        <div class="connections-filter__list" data-relation-filter-list>
          <span class="connections-filter__label">Show on the graph</span>
        </div>
      </fieldset>
      <div class="connections-graph__key" data-connections-key>
        <p class="connections-graph__key-title">Line key</p>
        <ul class="connections-key__list">
          <li>
            <svg class="connections-key-line" data-connection-kind="content-link" viewBox="0 0 48 10" aria-hidden="true">
              <line x1="2" y1="5" x2="46" y2="5"></line>
            </svg>
            <span>Linked to</span>
          </li>
          <li>
            <svg class="connections-key-line" data-connection-kind="blogroll" viewBox="0 0 48 10" aria-hidden="true">
              <line x1="2" y1="5" x2="46" y2="5"></line>
            </svg>
            <span>Blogroll</span>
          </li>
          <li>
            <svg class="connections-key-line" data-connection-kind="reply-to" viewBox="0 0 48 10" aria-hidden="true">
              <line x1="2" y1="5" x2="46" y2="5"></line>
            </svg>
            <span>Reply, repost, syndication</span>
          </li>
          <li>
            <svg class="connections-key-line" data-connection-kind="shared-topic" viewBox="0 0 48 10" aria-hidden="true">
              <line x1="2" y1="5" x2="46" y2="5"></line>
            </svg>
            <span>Shared topic</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</div>

<div class="connections-list" data-connections-list>
  {% for network_site in ordered_sites %}
    {% assign site_origin = network_site.origin %}
    {% assign site_domain = network_site.domain %}
    {% assign site_title = network_site.title | default: site_domain %}
    {% assign outbound = 0 %}
    {% assign inbound = 0 %}
    {% assign overlap_topics = nil %}
    {% assign overlap_count = 0 %}
    {% for edge in connection_edges %}
      {% if edge.from == site_origin %}
        {% assign outbound = outbound | plus: 1 %}
      {% endif %}
      {% if edge.to == site_origin %}
        {% assign inbound = inbound | plus: 1 %}
      {% endif %}
    {% endfor %}
    {% for overlap_site in overlap_sites %}
      {% if overlap_site.origin == site_origin %}
        {% assign overlap_topics = overlap_site.topics %}
        {% assign overlap_count = overlap_site.topics.size %}
      {% endif %}
    {% endfor %}

    {% if outbound > 0 or inbound > 0 or overlap_count > 0 %}
    <section
      class="connections-site h-card"
      id="connection-{{ site_domain | slugify }}"
      data-connection-origin="{{ site_origin | escape }}"
      data-connection-domain="{{ site_domain | escape }}"
      tabindex="-1"
    >
      <span class="connections-site__keys" data-connection-keys></span>
      <header class="connections-site__header">
        {% if network_site.screenshot and network_site.screenshot != "" %}
          <img
            class="connections-site__shot u-photo"
            src="{{ network_site.screenshot | relative_url }}"
            alt="Screenshot of {{ site_title | escape }}"
            loading="lazy"
            decoding="async"
            width="576"
            height="360"
          >
        {% endif %}
        <div class="connections-site__identity">
          <h2 class="connections-site__title p-name">
            <button
              type="button"
              class="connections-site__select"
              data-connection-select
              data-origin="{{ site_origin | escape }}"
            >
              {{ site_title | escape }}
            </button>
          </h2>
          {% include outbound-href.html url=site_origin %}
          <a
            class="connections-site__domain u-url"
            href="{{ outbound_href | escape }}"
            target="_blank"
            rel="noopener"
          >
            {{ site_domain | escape }}
          </a>
          {% if network_site.description and network_site.description != "" %}
            <p class="connections-site__description p-note">
              {{ network_site.description | escape }}
            </p>
          {% endif %}
        </div>
      </header>

      <div class="connections-site__columns connections-site__columns--with-topics">
        {% if outbound > 0 %}
        <div class="connections-site__column">
          <h3>Connects to</h3>
            <ul class="connections-edge-list">
              {% for edge in connection_edges %}
                {% if edge.from == site_origin %}
                  {% assign target_title = edge.to %}
                  {% assign target_domain = edge.to %}
                  {% for candidate in network_sites %}
                    {% if candidate.origin == edge.to %}
                      {% assign target_title = candidate.title | default: candidate.domain %}
                      {% assign target_domain = candidate.domain %}
                    {% endif %}
                  {% endfor %}
                  {% assign link_label = edge.text %}
                  {% if link_label == nil or link_label == "" %}
                    {% assign link_label = target_title %}
                  {% endif %}
                  {% assign edge_kind = edge.relation | default: edge.kind | default: "content-link" %}
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
                      <span class="connections-edge__kind">{{ kind_label | escape }}</span>
                      {% include outbound-href.html url=edge.href %}
                      <a
                        href="{{ outbound_href | escape }}"
                        target="_blank"
                        rel="noopener"
                      >
                        {{ link_label | escape }}
                      </a>
                      <span class="connections-edge__meta">
                        to
                        {% include outbound-href.html url=edge.to %}
                        <a
                          href="{{ outbound_href | escape }}"
                          target="_blank"
                          rel="noopener"
                        >
                          {{ target_domain | escape }}
                        </a>
                        {% if edge.via and edge.via != "" %}
                          · via
                            {% include outbound-href.html url=edge.via %}
                            <a
                              href="{{ outbound_href | escape }}"
                              target="_blank"
                              rel="noopener"
                            >
                              {{ edge.via | escape }}
                            </a>
                        {% endif %}
                        {% if edge.page and edge.page != "" %}
                          · seen on
                          {% include outbound-href.html url=edge.page %}
                          {% include connections-page-label.html url=edge.page %}
                          <a
                            href="{{ outbound_href | escape }}"
                            target="_blank"
                            rel="noopener"
                          >
                            {{ connections_page_label | escape }}
                          </a>
                        {% endif %}
                        {% if edge.source and edge.source != "" and edge.source != "content" %}
                          · {{ edge.source | escape }}
                        {% endif %}
                        {% if edge.rel and edge.rel.size > 0 %}
                          {% include connections-visible-rel.html rel=edge.rel %}
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
          <h3>Connected from</h3>
            <ul class="connections-edge-list">
              {% for edge in connection_edges %}
                {% if edge.to == site_origin %}
                  {% assign source_title = edge.from %}
                  {% assign source_domain = edge.from %}
                  {% for candidate in network_sites %}
                    {% if candidate.origin == edge.from %}
                      {% assign source_title = candidate.title | default: candidate.domain %}
                      {% assign source_domain = candidate.domain %}
                    {% endif %}
                  {% endfor %}
                  {% assign edge_kind = edge.relation | default: edge.kind | default: "content-link" %}
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
                      <span class="connections-edge__kind">{{ kind_label | escape }}</span>
                      {% include outbound-href.html url=edge.from %}
                      <a
                        href="{{ outbound_href | escape }}"
                        target="_blank"
                        rel="noopener"
                      >
                        {{ source_title | escape }}
                      </a>
                      <span class="connections-edge__meta">
                        {% assign inbound_meta = false %}
                        {% if source_domain and source_domain != source_title %}
                          {{ source_domain | escape }}
                          {% assign inbound_meta = true %}
                        {% endif %}
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
                        {% if edge.page and edge.page != "" %}
                          {% if inbound_meta %} · {% endif %}
                          seen on
                          {% include outbound-href.html url=edge.page %}
                          {% include connections-page-label.html url=edge.page %}
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
              <ul class="connections-topic-list">
                {% for topic in overlap_topics %}
                  {% assign article_count = topic.articles.size | default: 0 %}
                  {% for peer in topic.sites %}
                    {% assign article_count = article_count | plus: peer.articles.size %}
                  {% endfor %}
                  <li class="connections-topic" data-connection-kind="shared-topic">
                    <span class="connections-topic__label">
                      <a href="{{ '/topics/' | append: topic.slug | append: '/' | relative_url }}">
                        {{ topic.label | escape }}
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
    {% endif %}
{% endfor %}
</div>

{% capture connections_bootstrap %}
{
"participants": [
{% for network_site in ordered_sites %}
{
"origin": {{ network_site.origin | jsonify }},
"domain": {{ network_site.domain | jsonify }},
"title": {{ network_site.title | default: network_site.domain | jsonify }},
"description": {{ network_site.description | default: "" | jsonify }},
"screenshot": {{ network_site.screenshot | default: "" | jsonify }}
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
    Isolated sites stay on
    <a href="{{ '/network/' | relative_url }}">Network</a>.
  </p>
</div>
{% endif %}

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
    JavaScript can add a selectable graph view. The relationship lists above
    already show every observed link without it.
  </p>
</noscript>
