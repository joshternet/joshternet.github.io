---
layout: default
title: Joshternet buttons
description: >-
  Official Joshternet web buttons. One embed snippet shows the registry state
  for the current site, or invites the site to join.
permalink: /implement/buttons/
nav_title: Buttons
---

# Joshternet buttons

Official IndieWeb-style web buttons for independent sites. The Joshternet
registry is the only source of truth for which button appears. The embed does
not read `/.well-known/josh` and does not decide Josh identity on its own.

## Embed

Add this one line. The script uses `window.location.origin` so you do not hard
code your domain.

{% if jekyll.environment == "development" %}

```html
<script async src="http://127.0.0.1:8790/embed/joshternet-button.js"></script>
```

Start the button Worker locally with `npm --prefix workers/joshternet-button run
dev` so that development embed works.

{% else %}

```html
<script async src="https://joshternet.org/embed/joshternet-button.js"></script>
```

{% endif %}

After JoshBot verifies a declaration and the registry updates, the button
changes automatically. Site owners do not need to edit the embed again.

## Button states

<div class="button-gallery">
  <figure class="button-gallery__item">
    <img
      src="{{ '/assets/buttons/verified-josh.png' | relative_url }}"
      width="88"
      height="31"
      alt="Verified Josh, Joshternet site"
    >
    <figcaption>
      <strong>Verified Josh</strong>
      Registry member with Affirmed Josh Identity.
    </figcaption>
  </figure>
  <figure class="button-gallery__item">
    <img
      src="{{ '/assets/buttons/verified-non-josh.png' | relative_url }}"
      width="88"
      height="31"
      alt="Verified Non-Josh, Joshternet site"
    >
    <figcaption>
      <strong>Verified Non-Josh</strong>
      Registry member with Declined Josh Identity.
    </figcaption>
  </figure>
  <figure class="button-gallery__item">
    <img
      src="{{ '/assets/buttons/undeclared.png' | relative_url }}"
      width="88"
      height="31"
      alt="Undeclared, Joshternet site"
    >
    <figcaption>
      <strong>Undeclared</strong>
      Registry member with Undeclared Josh Identity.
    </figcaption>
  </figure>
  <figure class="button-gallery__item">
    <img
      src="{{ '/assets/buttons/join-the-joshternet.png' | relative_url }}"
      width="88"
      height="31"
      alt="Join the Joshternet"
    >
    <figcaption>
      <strong>Join the Joshternet</strong>
      Registry lookup succeeded and the origin is not a member.
    </figcaption>
  </figure>
</div>

If the registry cannot be read, the embed renders nothing. A temporary
Joshternet outage must never make an existing member look like they left.

## What each state means

- **Verified Josh** — the origin participates and affirms Josh identity.
- **Verified Non-Josh** — the origin participates and declines Josh identity.
- **Undeclared** — the origin participates without affirming or declining.
- **Join** — the origin is not currently in the registry.

Joining still means publishing a valid `/.well-known/josh` declaration. Start
with the [implementation guide]({{ '/implement/' | relative_url }}).

## Content Security Policy

Sites with a restrictive CSP need to allow Joshternet for the embed:

```text
script-src https://joshternet.org
img-src https://joshternet.org
connect-src https://joshternet.org
```

## Accessibility

Each button ships with state-specific alternative text, for example “Verified
Josh, Joshternet site” or “Join the Joshternet”. The surrounding link has a
matching accessible name. Width and height are always 88 and 31 so the page
does not shift.

## Machine-readable state

```text
GET https://joshternet.org/api/button-state?origin=https://example.invalid
```

Returns JSON for the registry-backed state, including `imageURL`, `href`, and
`alt`. Registry failures return `state: "unavailable"` and must not be treated
as Join.
