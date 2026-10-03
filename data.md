---
layout: default
title: Joshternet public data, schemas, and evidence
description: >-
  Public contracts for the Joshternet community data graph: declared, observed,
  and heuristic evidence classes, plus schemas, versions, and how datasets are published.
keywords: >-
  Joshternet data, open data, schemas, evidence classes, independent websites
seo:
  type: Dataset
  name: Data
permalink: /data/
joshternet_analysis: derived
---

{% assign manifest = site.data.data_manifest %}

# Joshternet data

Public contracts for why something appears.

## Evidence classes

<dl class="explore-dl">
  <dt>Declared</dt>
  <dd>
    The publisher labeled the work: Microformats categories, feed categories
    and tags, article tags, keywords, octothorpes. Declared evidence may
    qualify a site for a public topic neighborhood immediately.
  </dd>
  <dt>Observed</dt>
  <dd>
    A relationship Joshternet saw, such as a link, blogroll outline, mention,
    or reply. Connections are observed. They are not follows or endorsements.
  </dd>
  <dt>Heuristic</dt>
  <dd>
    Automatic analysis of visible published content. Strong repeated evidence
    may enroll a site in a public topic neighborhood. Weak incidental terms
    do not. Heuristics never become a connection edge. Provenance stays
    heuristic; it is never rewritten as a publisher declaration.
  </dd>
</dl>

<p>
  Normalized or aliased values are transformations of what a publisher wrote,
  not new claims. Sites remain the houses. Joshternet only draws roads.
</p>

## Public datasets

<ul>
  <li><a href="{{ '/network/data.json' | relative_url }}">network</a> — who participates</li>
  <li><a href="{{ '/connections/data.json' | relative_url }}">connections</a> — observed relationships</li>
  <li><a href="{{ '/search/index.json' | relative_url }}">search index</a> — compact public search documents</li>
</ul>

<p>
  Schemas:
  <a href="{{ '/schemas/network.schema.json' | relative_url }}">network</a>,
  <a href="{{ '/schemas/content.schema.json' | relative_url }}">content</a>,
  <a href="{{ '/schemas/topics.schema.json' | relative_url }}">topics</a>,
  <a href="{{ '/schemas/connections.schema.json' | relative_url }}">connections</a>,
  <a href="{{ '/schemas/blogrolls.schema.json' | relative_url }}">blogrolls</a>,
  <a href="{{ '/schemas/mentions.schema.json' | relative_url }}">mentions</a>,
  <a href="{{ '/schemas/data-manifest.schema.json' | relative_url }}">manifest</a>,
  <a href="{{ '/schemas/site-signals.schema.json' | relative_url }}">site signals</a>.
</p>

<p>
  Internal crawl candidates and debug files are not published. See
  <a href="{{ '/implement/explore/' | relative_url }}">how presentation views are built</a>.
</p>

{% if manifest %}
<details class="explore-disclosure">
  <summary>Dataset versions</summary>
  <p>Manifest schema {{ manifest.schema_version }}{% if manifest.generated_at %}, generated {{ manifest.generated_at | date: "%b %-d, %Y" }}{% endif %}.</p>
  {% if manifest.datasets %}
    <ul>
      {% for pair in manifest.datasets %}
        <li>{{ pair[0] | escape }}: {{ pair[1] | escape }}</li>
      {% endfor %}
    </ul>
  {% endif %}
  {% if manifest.extractors %}
    <p>Extractors</p>
    <ul>
      {% for pair in manifest.extractors %}
        <li>{{ pair[0] | escape }}: {{ pair[1] | escape }}</li>
      {% endfor %}
    </ul>
  {% endif %}
</details>
{% endif %}
