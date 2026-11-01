---
layout: default
title: "Joshternet: An Open Network for Joshes and Independent Websites"
description: >-
  Joshternet connects independent websites—Joshes and friends of Joshes—through
  a tiny public /.well-known/josh declaration. Anyone can join; your site stays
  yours.
keywords: >-
  Joshternet, Josh network, independent websites, indie web, open web,
  /.well-known/josh, personal websites, join Joshternet
scripts:
  - /assets/js/home-meet.js
  - /assets/js/connections.js
---

# The Joshternet

<p class="home-tagline">An internet full of Joshes. And friends of Joshes.</p>

Independent websites, linked by a tiny public declaration. No accounts. No feed algorithm. Your site stays yours.

<p class="home-invite">
  <strong class="home-invite__lead">Are you a Josh? Get yourself connected.</strong>
  Not named Josh? Join anyway—everyone participates the same way.
</p>

<p class="home-cta">
  <a class="home-cta__primary" href="{{ '/join/' | relative_url }}">Join the Joshternet</a>
  <a class="home-cta__secondary" href="{{ '/wander/' | relative_url }}">Wander the Joshternet</a>
</p>

{% include home-new-arrivals.html %}

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

No signup form. No account. Publish a tiny file on a site you control—Joshes and non-Joshes alike.

The guided walkthrough covers choosing a declaration, your platform, validation, optional discovery, and what to do once JoshBot lists you.

<p class="home-cta home-cta--join-teaser">
  <a class="home-cta__secondary" href="{{ '/join/' | relative_url }}">Start joining</a>
</p>

[The Network][network] · [Implementation guide][implementation] · [platform recipes][platforms] · [declaration checker][validate] · [nominate][nominate]

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
[network]: /network/
[joshbot]: /joshbot/
[community]: /community/
[irc]: https://web.libera.chat/#joshternet
[implementation-josh]: https://joshuamorris.info/.well-known/josh
[implementation-project]: /.well-known/josh
[joshbot-release]: https://github.com/joshternet/joshbot/releases/tag/v1.0.0
