---
layout: default
title: Nominate a Site
description: >-
  Ask JoshBot to look at a website you control. Nomination is a discovery
  starting point—it does not join the Joshternet by itself.
keywords: >-
  nominate website, JoshBot seed, Joshternet registry, /.well-known/josh
seo:
  type: WebPage
  name: Nominate a Site
permalink: /nominate/
turnstile: true
seed_nomination: true
script: /assets/js/nominate.js
---

# Nominate a site for JoshBot

If you have a website you control and you'd like JoshBot to take a look, this is
a good place to start. Nomination asks JoshBot to consider your site as a
discovery seed—a starting point for exploration. It does not join the Joshternet
by itself, declare anyone to be a Josh, or guarantee a public Network listing.

Participation still means publishing a valid `/.well-known/josh` on a site you
control—see the [join guide](/join/).

JoshBot still follows its normal rules: it respects `robots.txt`, applies crawl
and network safety limits, and independently checks for a valid declaration
before it can list a site.

<form
  class="seed-nomination-form"
  data-seed-nomination-form
  method="post"
  {% if jekyll.environment == "development" %}
  data-seed-nomination-api="http://127.0.0.1:8787/v1/seed-nominations"
  data-turnstile-sitekey="1x00000000000000000000AA"
  {% else %}
  data-seed-nomination-api="{{ site.seed_nominations.api_origin }}{{ site.seed_nominations.api_path }}"
  data-turnstile-sitekey="{{ site.seed_nominations.turnstile_sitekey }}"
  {% endif %}
>
  <div class="seed-nomination-field">
    <label for="seed-url">Website</label>
    <p id="seed-url-help" class="seed-nomination-help">
      Enter the public address of a website you control, for example, https://joshua.example.
    </p>
    <input
      id="seed-url"
      name="url"
      type="url"
      required
      autocomplete="url"
      inputmode="url"
      spellcheck="false"
      placeholder="https://joshua.example"
      aria-describedby="seed-url-help"
    >
  </div>

  <div class="seed-nomination-attestation">
    <input
      id="seed-owner"
      name="owner_attestation"
      type="checkbox"
      value="yes"
      required
    >
    <label for="seed-owner">
      I control this site and am asking JoshBot to crawl it.
    </label>
  </div>

  <div
    class="seed-nomination-turnstile"
    data-seed-nomination-turnstile
  ></div>

  <button
    class="seed-nomination-submit"
    type="submit"
    disabled
    data-seed-nomination-submit
  >
    Nominate this site
  </button>

  <p
    class="seed-nomination-status"
    data-seed-nomination-status
    role="status"
    aria-live="polite"
    hidden
  ></p>

  <noscript>
    <p>This form needs JavaScript to submit a nomination.</p>
  </noscript>
</form>

## What happens next

Your nomination goes into JoshBot's queue. When JoshBot gets to it, the site is
treated under the same crawling rules as other discovery seeds: it must be
publicly reachable, crawling policy must allow JoshBot, and the crawl stays
within normal limits.

Being crawled is not the same as participating. If the site publishes a valid
`/.well-known/josh`, JoshBot can verify it through the normal protocol. If it
does not, nomination alone does not create one.

You can also publish a declaration without nominating here. JoshBot may still
discover that site through ordinary crawling when another eligible origin links
to it.

More on crawler behavior: [JoshBot][joshbot]. Specifications: [Joshternet specs][specifications].

[joshbot]: /joshbot/
[specifications]: /specs/
