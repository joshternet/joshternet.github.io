---
layout: default
title: "Joshternet: An Open Network for Joshes and Independent Websites"
description: >-
  Joshternet connects people who identify as Josh and the independent websites
  they call home—an open, decentralized network built on shared web conventions.
keywords: >-
  Joshternet, Josh network, independent websites, indie web, open web,
  /.well-known/josh, personal websites
scripts:
  - /assets/js/home-meet.js
  - /assets/js/connections.js
---

# The Joshternet

<p class="home-tagline">An internet full of Joshes. And friends of Joshes.</p>

Independent websites, linked by a tiny public declaration. No accounts. No feed algorithm. Your site stays yours.

<p class="home-cta">
  <a class="home-cta__primary" href="{{ '/wander/' | relative_url }}">Wander the Joshternet</a>
  <a class="home-cta__secondary" href="{{ '/network/' | relative_url }}">Explore the network</a>
</p>

<p class="prose-emphasis"><strong>Joshness is declared, never derived.</strong> Non-Joshes are welcome.</p>

{% include home-new-arrivals.html %}

<p class="home-new-arrivals__invite">
  Not named Josh? You're welcome here, too.
  <a href="{{ '/implement/' | relative_url }}">Come josh around.</a>
  Bring your own little corner of the web—your website stays yours.
</p>

## Meet the websites

Real sites, on their own domains.

{% include home-meet-sites.html %}

## What's happening

Fresh posts from around the network.

{% include home-recent-activity.html %}

## See how the Joshternet connects

Independent sites beginning to link—and sometimes covering the same ground.

{% include home-connections.html %}

## How it works

Put a small JSON file on your site:

```text
/.well-known/josh
```

```json
{
  "version": 1,
  "josh": true
}
```

That is participation. Optional `josh: true` or `josh: false` says how you identify; leave `josh` out if you prefer not to say. Details live in [RFC-JOSH-0002][rfc-0002].

[JoshBot][joshbot] can find and list participating sites. The registry helps with discovery—it is not the Joshternet, and it does not decide who is a Josh.

## Join the Joshternet

No signup form. No account. Publish a file on a site you control.

### Pick a declaration

<div class="home-join">
  <div class="home-join__option">
    <h3 class="home-join__label">I'm a Josh</h3>
    <p class="home-join__path">
      <code>/.well-known/josh</code>
    </p>
    <pre class="home-join__code"><code>{
  "version": 1,
  "josh": true
}</code></pre>
    <p>Affirmed Josh Identity, and you're in.</p>
  </div>
  <div class="home-join__option">
    <h3 class="home-join__label">I'm participating, not as a Josh</h3>
    <p class="home-join__path">
      <code>/.well-known/josh</code>
    </p>
    <pre class="home-join__code"><code>{
  "version": 1,
  "josh": false
}</code></pre>
    <p>Declined Josh Identity—still a full participant.</p>
  </div>
  <div class="home-join__option">
    <h3 class="home-join__label">I'm in; leaving identity open</h3>
    <p class="home-join__path">
      <code>/.well-known/josh</code>
    </p>
    <pre class="home-join__code"><code>{
  "version": 1
}</code></pre>
    <p>Undeclared Josh Identity. Participation without the label.</p>
  </div>
</div>

### Next steps

1. Publish `/.well-known/josh` on your origin.
2. Check it with the [declaration checker][validate].
3. Optionally [nominate][nominate] the site so JoshBot knows to look.
4. JoshBot may verify it and add it to the registry.

Publishing means you're participating. It does not automatically notify JoshBot or guarantee a registry listing. Nomination asks for a crawl; it does not itself grant participation.

[Implementation guide][implementation] · [platform recipes][platforms] · [declaration checker][validate]

## Status

The project is **PRE-JOSH**. The RFCs are Drafts.

Live pieces today:

- [joshuamorris.info][implementation-josh] — Affirmed Josh Identity
- joshternet.org — [Undeclared][implementation-project]
- [JoshBot][joshbot] [v1.0.0][joshbot-release] — discovery and registry crawler

None of those is an authority. [Governance][governance] covers how Drafts move.

A few standing rules:

- Joshness is declared, never derived.
- Participation is voluntary.
- Josh identity and participation are separate.
- Non-Joshes may participate without being represented as Joshes.
- Sites stay independently controlled.
- No Josh outranks another Josh.
- Identity and participation do not imply trust.
- Discovery should not require one canonical authority.
- Prefer open, boring web standards.

## Keep going

[About][about] · [Specifications][specifications] · [JoshBot][joshbot] · [spec repo][spec]

Talk in [`#joshternet`][irc], skim the [community principles][community], or open an issue. Bring the weird edge cases—that is how the Drafts get better.

[spec]: https://github.com/joshternet/spec
[rfc-0002]: https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md
[about]: /about/
[specifications]: /specs/
[governance]: /governance/
[implementation]: /implement/
[platforms]: /implement/platforms/
[validate]: /implement/validate/
[nominate]: /nominate/
[joshbot]: /joshbot/
[community]: /community/
[irc]: https://web.libera.chat/#joshternet
[implementation-josh]: https://joshuamorris.info/.well-known/josh
[implementation-project]: /.well-known/josh
[joshbot-release]: https://github.com/joshternet/joshbot/releases/tag/v1.0.0
