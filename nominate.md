---
layout: default
title: Nominate a Website for JoshBot
description: >-
  Nominate a website you control as a discovery seed for JoshBot.
seo:
  type: WebPage
  name: Nominate a Site
permalink: /nominate/
turnstile: true
seed_nomination: true
script: /assets/js/nominate.js
---

# Nominate a site for JoshBot

Have a site you want JoshBot to explore? Give it a place to start.

A nomination makes your site a **discovery seed**. It does not add the site to the Joshternet, declare anyone to be a Josh, or guarantee that the site will appear in the public Network.

JoshBot still follows its normal rules. It respects `robots.txt`, applies its crawl and network safety limits, and independently checks for a valid `/.well-known/josh` declaration before a site can participate in the Joshternet.

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
      Enter the public address of a site you control, such as https://example.com.
    </p>
    <input
      id="seed-url"
      name="url"
      type="url"
      required
      autocomplete="url"
      inputmode="url"
      spellcheck="false"
      placeholder="https://example.com"
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
    <p>JavaScript is required to submit a seed nomination.</p>
  </noscript>
</form>

## What happens after you nominate a site

The nomination goes into JoshBot's seed nomination queue. When JoshBot processes it, the site is treated the same way as any other discovery seed: it must be publicly reachable, its crawling policy must allow JoshBot to visit it, and the crawl stays within JoshBot's normal limits.

Being crawled and joining the Joshternet are separate things. If the site publishes a valid `/.well-known/josh` declaration, JoshBot can verify that declaration through the normal protocol. If it does not, nomination alone does not create one.

You can read more about how the crawler behaves on the [JoshBot page][joshbot], and the [Joshternet specifications][specifications] define how participation and Josh identity are declared.

[joshbot]: /joshbot/
[specifications]: /specs/
