---
layout: default
title: Explore Participating Websites
description: Wander through independent websites participating in the Joshternet.
seo:
  type: WebPage
  name: Wander
permalink: /wander/
script: /assets/js/wander.js
full_bleed: true
allow_frames: true
---

<h1 class="visually-hidden">Wander the Joshternet</h1>

<p
  class="visually-hidden"
  data-wander-status
  role="status"
  aria-live="polite"
></p>

<div data-wander-console>
  <header class="wander-bar">
    <button
      class="wander-bar__go"
      type="button"
      data-wander-go
      aria-label="Go to another random site"
    >
      Go ↻
    </button>

    <label class="wander-bar__address">
      <span class="visually-hidden">Current site address</span>
      <input
        type="url"
        data-wander-address
        aria-label="Current site address"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        placeholder="Finding somewhere to wander…"
        readonly
      >
    </label>

    <button
      class="wander-bar__open"
      type="button"
      data-wander-open
      disabled
    >
      Open ↗
    </button>
  </header>

  <div class="wander-app">
    <section class="wander-stage" data-wander-stage>
      <div class="wander-empty">
        <p>Looking for somewhere to wander.</p>
      </div>
    </section>
  </div>
</div>

<noscript>
  <div class="wander-noscript">
    Wander needs JavaScript to move between sites.
    <a href="{{ '/network/' | relative_url }}">Browse The Network instead.</a>
  </div>
</noscript>
