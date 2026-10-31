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

**Are you a Josh? Get yourself connected.** People who aren't named Josh are equally welcome—Joshness is declared, never derived, and non-Joshes participate fully.

No accounts. No signup form. Your website stays yours. This page guides the existing process; [Implement]({{ '/implement/' | relative_url }}) remains the technical guide.

<ol class="join-steps">
  <li class="join-step" id="identity">
    <h2 class="join-step__title">1. Choose participation identity</h2>
    <p>Pick one valid version&nbsp;1 declaration. Identity is never inferred from a name or site.</p>
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
        <p class="join-declarations__note"><code>josh: false</code>—still a full participant.</p>
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
    <h2 class="join-step__title">2. Choose a website platform</h2>
    <p>
      Use a tested recipe when you can. Instructions stay on the platform pages—this list only points there.
    </p>
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
      Serve the JSON at exactly <code>/.well-known/josh</code> on your origin (no trailing slash). Prefer
      <code>Content-Type: application/json</code> and a public <code>200</code> response without login or client script.
    </p>
    <p>
      For example, <code>https://example.invalid/</code> publishes at
      <code>https://example.invalid/.well-known/josh</code>. Each origin needs its own file—including
      <code>www</code> if that origin is separate.
    </p>
    <p>
      Details, redirects, and caching notes live in the
      <a href="{{ '/implement/' | relative_url }}">implementation guide</a>.
    </p>
  </li>

  <li class="join-step" id="validate">
    <h2 class="join-step__title">4. Validate</h2>
    <p>
      Check the file you published. A successful check means the declaration is valid when read—not that JoshBot has listed the site yet.
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
      Nomination asks JoshBot to crawl. It does not establish participation by itself and does not guarantee a
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
      When JoshBot lists your site in the public Network, these optional next steps are yours to take—or skip.
      Completing the steps above alone is not membership success.
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
          href="{{ '/welcome/' | relative_url }}"
          data-join-share="welcome"
          data-joshternet-skip-link-track
        >
          Download your welcome card
        </a>
        — optional postcard art generated for registry members.
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
