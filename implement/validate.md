---
layout: default
title: Check a /.well-known/josh declaration
description: >-
  Check whether a pasted file or a live origin is a valid version 1
  Joshternet declaration.
seo:
  type: WebPage
  name: Check a declaration
permalink: /implement/validate/
nav_title: Check a declaration
module: /assets/js/declaration-check.js
declaration_check: true
---

# Check a declaration

These are two separate checks. Paste a file to see whether the text itself is a valid version 1 declaration. Enter an origin to ask Joshternet to read that origin's `/.well-known/josh` for you. The rules are the version 1 rules in the [implementation guide](/implement/). This page does not crawl the site or decide registry membership.

A valid document is not invalid only because `Content-Type` is missing or different. Publishers should still send `application/json`. A live check shows the type that was actually returned.

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
