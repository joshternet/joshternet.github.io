---
layout: default
title: Wander the Joshternet
description: >-
  Take a wander through the Joshternet and discover independent websites you
  might never have found otherwise. Meet another Josh, find something unexpected,
  and see where the web takes you.
keywords: >-
  Wander, Joshternet, independent websites, discover websites, Josh network
seo:
  type: CollectionPage
  name: Wander
permalink: /wander/
joshternet_analysis: derived
script: /assets/js/wander.js
full_bleed: true
allow_frames: true
footer: false
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
      aria-label="Discover another website"
      title="Discover another website"
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
        placeholder="Finding another corner of the internet to explore…"
        readonly
      >
    </label>

    <button
      class="wander-bar__open"
      type="button"
      data-wander-open
      aria-label="Open this website in a new tab"
      disabled
    >
      Open ↗
    </button>
  </header>

  <div class="wander-app">
    <section class="wander-stage" data-wander-stage>
      <div class="wander-empty">
        <p>Finding another corner of the internet to explore…</p>
      </div>
    </section>
  </div>
</div>

<noscript>
  <div class="wander-noscript">
    Wander needs JavaScript to pick your next destination. You can still
    <a href="{{ '/network/' | relative_url }}">browse the Network</a>
    or explore
    <a href="{{ '/connections/' | relative_url }}">Connections</a>
    and follow the links yourself.
  </div>
</noscript>
