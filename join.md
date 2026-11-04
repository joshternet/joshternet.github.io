---
layout: default
title: Join the Joshternet
description: >-
  Bring your own corner of the internet to the Joshternet. Publish a small
  declaration, check that it works, and start discovering other independent
  websites. Joshes and Non-Joshes are equally welcome.
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

**Are you a Josh? Get yourself connected.**

Have your own little corner of the internet? Come join the Joshternet. It started with Joshes looking for other Joshes, but everyone is welcome to join the fun. You don't need an account, a particular name, or permission from anyone to participate.

All you need is a small public declaration on a website you control. It tells the network your site wants to participate, while everything you've built stays right where it is. We'll walk through how to publish it, check that it works, and help other people discover your site.

Publishing a valid declaration establishes participation. JoshBot discovering and listing your website in the Network happens separately.

<ol class="join-steps">
  <li class="join-step" id="declaration">
    <h2 class="join-step__title">1. Choose your declaration</h2>
    <p>
      Everyone joins the same way. The only choice is whether you also want to
      declare Josh identity. You can say yes, say no, or leave that part out
      entirely. Identity is never inferred from a name or site.
    </p>
    <div class="join-declarations" data-join-declarations>
      <div class="join-declarations__option">
        <h3 class="join-declarations__label">Leave Josh identity undeclared</h3>
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
        <p class="join-declarations__note">
          This is all you need to participate. You can leave Josh identity
          undeclared and still be a full member of the network.
        </p>
      </div>
      <div class="join-declarations__option">
        <h3 class="join-declarations__label">Affirm Josh identity</h3>
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
        <p class="join-declarations__note">
          Are you a Josh? Here's your chance to say so. Joshness is declared,
          never derived.
        </p>
      </div>
      <div class="join-declarations__option">
        <h3 class="join-declarations__label">Decline Josh identity</h3>
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
        <p class="join-declarations__note">
          Not a Josh? You can say so and still join the fun. Everyone
          participates on equal terms.
        </p>
      </div>
    </div>
    <p class="join-copy-status" data-join-copy-status role="status" aria-live="polite"></p>
  </li>

  <li class="join-step" id="platform">
    <h2 class="join-step__title">2. Find your website's setup</h2>
    <p>
      Every website is built a little differently. Find the platform you're
      already using, and we'll show you how to publish the declaration without
      changing the rest of your site. You do not need to switch publishing
      systems merely to participate.
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
          — serve the declaration at <code>/.well-known/josh</code> with
          <code>Content-Type: application/json</code>
        </span>
      </li>
    </ul>
  </li>

  <li class="join-step" id="publish">
    <h2 class="join-step__title">3. Put it on your website</h2>
    <p>
      The declaration needs to be available at exactly
      <code>/.well-known/josh</code> on your website. That address stays the same
      no matter which publishing platform you use. Your platform guide explains
      where to place the file or how to serve it—WordPress and Worker setups may
      serve the declaration dynamically without a physical file on disk.
    </p>
    <p>
      Prefer a public <code>200</code> response with
      <code>Content-Type: application/json</code>, no login, and no client-side
      JavaScript required. There is no <code>.json</code> extension and no
      trailing slash on the public URL.
    </p>
    <p>
      Your website can be written in any language. The declaration uses the same
      JSON keys everywhere, but your writing, titles, and content stay in your
      own words.
    </p>
    <p>
      Example: <code>https://joshua.example/</code> publishes at
      <code>https://joshua.example/.well-known/josh</code>. Each origin needs its
      own declaration—including <code>www</code> if that site is separate.
      Subdomains, redirects, Content-Type quirks, and hosting edge cases live in
      the <a href="{{ '/implement/' | relative_url }}">implementation guide</a>.
    </p>
  </li>

  <li class="join-step" id="validate">
    <h2 class="join-step__title">4. Check that it works</h2>
    <p>
      Once your declaration is published, check that the web can actually read
      it. The declaration checker will tell you whether the JSON is valid and
      whether your website is serving it at the right address.
    </p>
    <p>
      Passing the check means your declaration is valid. That is enough to
      participate. It doesn't mean JoshBot has discovered or listed your website
      yet. That part happens separately.
    </p>
    <p>
      <a
        class="join-cta"
        href="{{ '/implement/validate/' | relative_url }}"
        data-join-check-open
        data-joshternet-skip-link-track
      >
        Check your declaration
      </a>
    </p>
  </li>

  <li class="join-step" id="nominate">
    <h2 class="join-step__title">5. Help JoshBot find you (optional)</h2>
    <p>
      Publishing your declaration is enough to participate, but JoshBot still
      needs to discover your website before it can appear in the Network
      directory. You can nominate your site to give it a place to start looking.
    </p>
    <p>
      JoshBot will check your declaration and follow its normal crawling rules.
      Nomination does not establish participation by itself and does not
      guarantee a listing. You don't need to nominate yourself to be part of
      the Joshternet.
    </p>
    <p>
      <a
        class="join-cta"
        href="{{ '/nominate/' | relative_url }}"
        data-join-nominate-open
        data-joshternet-skip-link-track
      >
        Nominate a site
      </a>
    </p>
  </li>

  <li class="join-step" id="next">
    <h2 class="join-step__title">6. You're in. What next?</h2>
    <p>
      If your website is publishing a valid declaration, you're participating in
      the Joshternet. That's it. There's no account to create, no committee to
      impress, and nobody handing out Josh credentials.
    </p>
    <p>
      Your website stays yours. Keep your domain, your publishing tools, and
      everything you've already made. Joshternet simply makes it easier for
      other people to find your corner of the web.
    </p>
    <p>
      Now comes the entertaining part: discovering other websites, meeting their
      owners, and seeing what everyone is making. Once JoshBot verifies and lists
      your site, other visitors can find you in the Network, too.
    </p>
    <ul class="join-celebrate">
      <li>
        <a
          href="{{ '/network/' | relative_url }}"
          data-join-share="network"
          data-joshternet-skip-link-track
        >
          Explore the Network
        </a>
        — browse independent sites, or look for your listing after JoshBot
        verifies you.
      </li>
      <li>
        <a
          href="{{ '/implement/buttons/' | relative_url }}"
          data-join-share="button"
          data-joshternet-skip-link-track
        >
          Display a Joshternet button
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
    <p>
      Maybe you'll meet another Josh. Maybe you'll meet a Non-Josh who makes
      something wonderful. Maybe you'll lose an afternoon wandering through
      somebody's very strange little website. That's part of what makes this fun.
    </p>
  </li>
</ol>

<p class="join-footer-links">
  <a href="{{ '/implement/' | relative_url }}">Implementation guide</a>
  ·
  <a href="{{ '/network/' | relative_url }}">The Network</a>
  ·
  <a href="{{ '/community/' | relative_url }}">Community</a>
</p>
