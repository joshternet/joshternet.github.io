---
layout: default
title: Wander
description: Wander through independent websites participating in the Joshternet.
seo:
  type: WebPage
  name: Wander
permalink: /wander/
script: /assets/js/wander.js
chrome: false
full_bleed: true
allow_frames: true
---

<div class="wander-app" data-wander-console>
  <header class="wander-bar">
    <div class="wander-bar__brand">
      <a href="{{ '/' | relative_url }}">Joshternet</a>
      <span aria-hidden="true">/</span>
      <strong>Wander</strong>
    </div>

    <nav class="wander-bar__navigation" aria-label="Wander navigation">
      <button
        type="button"
        data-wander-previous
        aria-label="Previous site"
        disabled
      >
        ←
        <span>Previous</span>
      </button>

      <button
        type="button"
        data-wander-next
        aria-label="Next site"
      >
        <span>Next</span>
        →
      </button>
    </nav>

    <strong class="wander-bar__domain" data-wander-domain>
      Finding somewhere to wander…
    </strong>

    <div class="wander-bar__tools">
      <label class="wander-bar__filter">
        <span class="visually-hidden">Sites to wander</span>
        <select data-wander-filter aria-label="Sites to wander">
          <option value="all">All sites</option>
          <option value="affirmed">Josh</option>
          <option value="declined">Non-Josh</option>
          <option value="undeclared">Undeclared</option>
        </select>
      </label>

      <a data-wander-network href="{{ '/network/' | relative_url }}">
        Network
      </a>

      <a
        data-wander-open
        href="{{ '/network/' | relative_url }}"
        target="_blank"
        rel="noopener noreferrer"
        hidden
      >
        Open ↗
      </a>
    </div>
  </header>

  <main class="wander-stage" data-wander-stage>
    <div class="wander-empty">
      <p>Looking for somewhere to wander.</p>
    </div>
  </main>
</div>

<noscript>
  <div class="wander-noscript">
    Wander needs JavaScript to move between sites.
    <a href="{{ '/network/' | relative_url }}">Browse The Network instead.</a>
  </div>
</noscript>
