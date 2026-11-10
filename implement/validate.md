---
layout: default
title: Check a Declaration
description: >-
  Check your Joshternet declaration before or after publishing it. Validate the
  JSON, inspect a live /.well-known/josh response, and understand what the
  results mean.
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

Made your Joshternet declaration? Let's make sure everything looks right. You
can paste the JSON here to check its contents, or enter your website's address
to see whether the live declaration is being served correctly.

The checker follows the current version 1 rules. It doesn't register your
website or notify JoshBot, but it can help you catch mistakes before you move
on. A valid result means the JSON matches those rules. That is separate from
whether JoshBot has listed the site in the public
[Network]({{ '/network/' | relative_url }}).

<form
  hidden
  data-declaration-check-config
  {% if jekyll.environment == "development" %}
  data-declaration-check-api="http://127.0.0.1:8789/v1/declaration-check"
  {% else %}
  data-declaration-check-api="{{ site.declaration_check.api_origin }}/v1/declaration-check"
  {% endif %}
></form>

## Paste the declaration

Already have your JSON ready? Paste it below and we'll check whether it follows
the version 1 declaration rules. You can do this before publishing anything on
your website.

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
  <button type="submit">Check this declaration</button>
</form>

## Check a live website

Already published your declaration? Enter your website's address and we'll check
the live `/.well-known/josh` resource at that origin. This helps confirm that the
public response is available and follows the current protocol. The checker does
not crawl the rest of your website.

<form class="declaration-check" data-declaration-origin>
  <div
    id="declaration-origin-result"
    class="declaration-result"
    data-declaration-origin-result
    role="status"
    aria-live="polite"
    hidden
  ></div>
  <label for="declaration-origin">Website address</label>
  <p id="declaration-origin-help">
    Enter the address of the website you control, such as https://joshua.example.
    The checker will look for <code>/.well-known/josh</code> at that origin.
  </p>
  <input
    id="declaration-origin"
    data-declaration-origin-input
    type="url"
    inputmode="url"
    autocomplete="off"
    spellcheck="false"
    placeholder="https://joshua.example"
    aria-describedby="declaration-origin-help declaration-origin-result"
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
  {%- if network_site.k4b and network_site.k4b != '' -%}
    {%- unless registry_origin_first -%},{%- endunless -%}
    {{ network_site.k4b | jsonify }}
    {%- assign registry_origin_first = false -%}
  {%- endif -%}
{%- endfor -%}
]
</script>

## After a valid check

If you checked pasted JSON, the next step is to publish it on your website, then
check the live address. If you checked a live website and received a valid
result, the declaration is doing its job.

**Public registry discovery is separate:** JoshBot maintains a separate directory
of verified participating websites. Your declaration can be valid before JoshBot
discovers it, and you can optionally
[nominate]({{ '/nominate/' | relative_url }}) a website you control to help the
crawler find it. Listing never overrides validity. Browse the
[Network]({{ '/network/' | relative_url }}) when you want to explore participating
sites.

| Outcome | Meaning |
| --- | --- |
| **Valid declaration** | Publishing it establishes participation. A pasted-only check does not prove it is live yet. |
| **Invalid declaration** | Fix the JSON or how the site serves it. Common issues: wrong path, trailing slash, string `"1"` instead of integer `1`, or `josh` that is not a Boolean. |
| **Unpublished** | The origin returned an authoritative response such as 404 or 410—no declaration is published at the required path. That is not the same as invalid JSON. |
| **Unreadable** | The checker could not establish validity (timeouts, DNS/TLS problems, service failures, and similar). That is not an invalid declaration. |
| **Public registry listed / not listed** | Whether this hub’s Network snapshot currently includes the checked website. This is not a live registry query. |

The [join guide]({{ '/join/' | relative_url }}) walks through publishing and checking.
