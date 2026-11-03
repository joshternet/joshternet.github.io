---
layout: default
title: Join the Joshternet
description: >-
  Publish a tiny /.well-known/josh declaration on a site you control, validate
  it, optionally ask JoshBot to look, and celebrate once you appear in the
  Network—Joshes and non-Joshes welcome equally.
keywords: >-
  join Joshternet, /.well-known/josh, participate independent websites,
  Josh identity, indie web declaration
permalink: /join/
seo:
  type: HowTo
  name: Join the Joshternet
script: /assets/js/join.js
---

# Join the Joshternet

**Are you a Josh? Get yourself connected.** Non-Joshes are equally welcome—you declare identity; we never infer it from a name or site.

Publish in any written language. Declaration keys stay exactly `version` and `josh`.

No accounts. No signup form. Your site stays yours. For deeper detail, see [Implement]({{ '/implement/' | relative_url }}).

<ol class="join-steps">
  <li class="join-step" id="identity">
    <h2 class="join-step__title">1. Choose participation identity</h2>
    <p>Copy one version&nbsp;1 declaration.</p>
    <div class="join-declarations" data-join-declarations>
      <div class="join-declarations__option">
        <h3 class="join-declarations__label">Affirmed Josh Identity</h3>
        <p class="join-declarations__path"><code>/.well-known/josh</code></p>
        <pre class="join-declarations__code" id="join-declaration-affirmed"><code>{
  "version": 1,
  "josh": true
}</code></pre>
        <button
          type="button"
          class="join-copy"
          data-join-copy="join-declaration-affirmed"
          data-join-identity="affirmed"
        >
          Copy declaration
        </button>
        <p class="join-declarations__note"><code>josh: true</code></p>
      </div>
      <div class="join-declarations__option">
        <h3 class="join-declarations__label">Declined Josh Identity</h3>
        <p class="join-declarations__path"><code>/.well-known/josh</code></p>
        <pre class="join-declarations__code" id="join-declaration-declined"><code>{
  "version": 1,
  "josh": false
}</code></pre>
        <button
          type="button"
          class="join-copy"
          data-join-copy="join-declaration-declined"
          data-join-identity="declined"
        >
          Copy declaration
        </button>
        <p class="join-declarations__note"><code>josh: false</code>—still a full participant, joshing the Joshes from the day you join.</p>
      </div>
      <div class="join-declarations__option">
        <h3 class="join-declarations__label">Undeclared Josh Identity</h3>
        <p class="join-declarations__path"><code>/.well-known/josh</code></p>
        <pre class="join-declarations__code" id="join-declaration-undeclared"><code>{
  "version": 1
}</code></pre>
        <button
          type="button"
          class="join-copy"
          data-join-copy="join-declaration-undeclared"
          data-join-identity="undeclared"
        >
          Copy declaration
        </button>
        <p class="join-declarations__note">Omit <code>josh</code> to leave identity open.</p>
      </div>
    </div>
    <p class="join-copy-status" data-join-copy-status role="status" aria-live="polite"></p>
  </li>

  <li class="join-step" id="platform">
    <h2 class="join-step__title">2. Platform recipes</h2>
    <p>Open the one that matches your stack, or skip to publish.</p>
    <ul class="join-platforms" data-join-platforms>
      {% for platform in site.data.platforms_nav %}
        <li>
          <a
            href="{{ platform.path | relative_url }}"
            data-join-platform="{{ platform.title | slugify | escape }}"
            data-joshternet-skip-link-track
          >
            {{ platform.title }}
          </a>
          {% if platform.summary and platform.summary != "" %}
            <span class="join-platforms__summary">— {{ platform.summary }}</span>
          {% endif %}
        </li>
      {% endfor %}
      <li>
        <a
          href="#publish"
          data-join-platform="generic-static"
          data-joshternet-skip-link-track
        >
          Generic static website
        </a>
        <span class="join-platforms__summary">
          — serve the file at <code>/.well-known/josh</code> with
          <code>Content-Type: application/json</code>
        </span>
      </li>
    </ul>
  </li>

  <li class="join-step" id="publish">
    <h2 class="join-step__title">3. Publish the declaration</h2>
    <p>
      Serve it at exactly <code>/.well-known/josh</code> on your origin (no trailing slash), preferably as
      <code>Content-Type: application/json</code> with a public <code>200</code>—no login wall, no client-only render.
    </p>
    <p>
      Example: <code>https://example.invalid/</code> →
      <code>https://example.invalid/.well-known/josh</code>. Each origin needs its own file, including
      <code>www</code> when that’s a separate origin.
    </p>
    <p>
      Redirects, caching, and edge cases:
      <a href="{{ '/implement/' | relative_url }}">implementation guide</a>.
    </p>
  </li>

  <li class="join-step" id="validate">
    <h2 class="join-step__title">4. Validate</h2>
    <p>
      Confirm the live file parses. A pass means the declaration is valid when read—not that JoshBot has listed the site yet.
    </p>
    <p>
      <a
        class="join-cta"
        href="{{ '/implement/validate/' | relative_url }}"
        data-join-check-open
        data-joshternet-skip-link-track
      >
        Open the declaration checker
      </a>
    </p>
  </li>

  <li class="join-step" id="nominate">
    <h2 class="join-step__title">5. Request discovery (optional)</h2>
    <p>
      Nomination asks JoshBot to look. It does not establish participation by itself and does not guarantee a
      registry listing.
    </p>
    <p>
      <a
        class="join-cta"
        href="{{ '/nominate/' | relative_url }}"
        data-join-nominate-open
        data-joshternet-skip-link-track
      >
        Nominate a site for JoshBot
      </a>
    </p>
  </li>

  <li class="join-step" id="celebrate">
    <h2 class="join-step__title">6. Celebrate once you're listed</h2>
    <p>
      After you appear in the public Network, these are optional. Completing the steps above alone is not membership success.
    </p>
    <ul class="join-celebrate">
      <li>
        <a
          href="{{ '/network/' | relative_url }}"
          data-join-share="network"
          data-joshternet-skip-link-track
        >
          Find your listing in the Network
        </a>
        — use the site filter or search for your domain.
      </li>
      <li>
        <a
          href="{{ '/implement/buttons/' | relative_url }}"
          data-join-share="button"
          data-joshternet-skip-link-track
        >
          Install the official Joshternet button
        </a>
        — optional; never required.
      </li>
      <li>
        <a
          href="https://web.libera.chat/#joshternet"
          target="_blank"
          rel="noopener"
          data-join-share="irc"
          data-joshternet-skip-link-track
        >
          Say hello in #joshternet
        </a>
        <span aria-hidden="true">↗</span>
        <span class="visually-hidden">(opens off this site)</span>
        — invite friends of Joshes to join the fun if you want.
      </li>
    </ul>
  </li>
</ol>

<p class="join-footer-links">
  <a href="{{ '/implement/' | relative_url }}">Implementation guide</a>
  ·
  <a href="{{ '/implement/platforms/' | relative_url }}">Platform recipes</a>
  ·
  <a href="{{ '/network/' | relative_url }}">The Network</a>
  ·
  <a href="{{ '/community/' | relative_url }}">Community</a>
</p>
