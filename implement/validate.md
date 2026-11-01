---
layout: default
title: Check a /.well-known/josh declaration
description: >-
  Check whether a pasted file or a live origin is a valid version 1 Joshternet
  /.well-known/josh declaration before publishing participation in the network.
keywords: >-
  validate /.well-known/josh, Joshternet declaration checker, JSON validation
seo:
  type: WebPage
  name: Check a declaration
permalink: /implement/validate/
nav_title: Check a declaration
module: /assets/js/declaration-check.js
declaration_check: true
---

# Check a declaration

<form
  hidden
  data-declaration-check-config
  {% if jekyll.environment == "development" %}
  data-declaration-check-api="http://127.0.0.1:8789/v1/declaration-check"
  {% else %}
  data-declaration-check-api="{{ site.declaration_check.api_origin }}/v1/declaration-check"
  {% endif %}
></form>

## Paste the file

<form class="declaration-check" data-declaration-paste>
  <div
    id="declaration-paste-result"
    class="declaration-result"
    data-declaration-paste-result
    role="status"
    aria-live="polite"
    hidden
  ></div>
  <label for="declaration-text">Declaration JSON</label>
  <div class="declaration-editor" data-declaration-paste-field>
    <pre class="declaration-editor__mirror" data-declaration-mirror aria-hidden="true"></pre>
    <textarea
      id="declaration-text"
      data-declaration-text
      rows="8"
      spellcheck="false"
      placeholder='{
  "version": 1
}'
      aria-describedby="declaration-paste-result"
      aria-errormessage="declaration-paste-error"
    ></textarea>
  </div>
  <p
    id="declaration-paste-error"
    class="declaration-field-error"
    data-declaration-paste-error
    hidden
  ></p>
  <button type="submit">Check this file</button>
</form>

## Check a live origin

<form class="declaration-check" data-declaration-origin>
  <div
    id="declaration-origin-result"
    class="declaration-result"
    data-declaration-origin-result
    role="status"
    aria-live="polite"
    hidden
  ></div>
  <label for="declaration-origin">Origin</label>
  <input
    id="declaration-origin"
    data-declaration-origin-input
    type="url"
    inputmode="url"
    autocomplete="off"
    spellcheck="false"
    placeholder="https://example.invalid"
    aria-describedby="declaration-origin-result"
    aria-errormessage="declaration-origin-error"
  >
  <p
    id="declaration-origin-error"
    class="declaration-field-error"
    data-declaration-origin-error
    hidden
  ></p>
  <button type="submit">Read /.well-known/josh</button>
</form>

<script type="application/json" data-declaration-registry-origins>
[
{%- assign registry_origin_first = true -%}
{%- for network_site in site.data.network -%}
  {%- if network_site.origin and network_site.origin != '' -%}
    {%- unless registry_origin_first -%},{%- endunless -%}
    {{ network_site.origin | jsonify }}
    {%- assign registry_origin_first = false -%}
  {%- endif -%}
{%- endfor -%}
]
</script>

## After a valid check

A valid declaration means the file (or live `/.well-known/josh`) matches version 1 rules. Public registry discovery is separate: JoshBot may list the origin in the [Network]({{ '/network/' | relative_url }}) later, and an optional [nomination]({{ '/nominate/' | relative_url }}) only asks JoshBot to crawl—it does not establish participation by itself. The [join guide]({{ '/join/' | relative_url }}) walks through publishing, validation, discovery, and celebration.

When JavaScript is available, a successful check also shows whether the checked origin appears in the Network snapshot built into this page (as of the last hub publish). That listing state never overrides declaration validity.
