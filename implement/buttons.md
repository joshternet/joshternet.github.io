---
layout: default
title: Official Joshternet web buttons and embeds
description: >-
  Official Joshternet web buttons: one embed snippet shows registry state for
  the current site—Verified Josh, Verified Non-Josh, Undeclared, or Join.
keywords: >-
  Joshternet button, web button embed, registry membership, /.well-known/josh
permalink: /implement/buttons/
nav_title: Buttons
---

# Joshternet buttons

One embed shows the registry state for the current site.

## Embed

Add this one line. The script uses `window.location.origin` so you do not hard
code your domain.

{% if jekyll.environment == "development" %}

```html
<script async src="http://127.0.0.1:8790/embed/joshternet-button.js"></script>
```

Start the local stack with `npm run dev` (Jekyll plus this Worker on
`:8790`) so that development embed works.

{% else %}

```html
<script async src="https://joshternet.org/embed/joshternet-button.js"></script>
```

{% endif %}

After JoshBot verifies a declaration and the registry updates, the button
changes automatically. Site owners do not need to edit the embed again.

The graphic is inline SVG created by that script after a registry check. Do
not host or hotlink a standalone button image.

## Button states

The live embed below is the official face for this site’s current registry
state.

{% if jekyll.environment == "development" %}
<script async src="http://127.0.0.1:8790/embed/joshternet-button.js"></script>
{% else %}
<script
  async
  src="https://joshternet.org/embed/joshternet-button.js"
></script>
{% endif %}

The other faces exist only inside that same embed, after a successful lookup:

- **Verified Josh** — registry member with Affirmed Josh Identity.
- **Verified Non-Josh** — registry member with Declined Josh Identity.
- **Undeclared** — registry member with Undeclared Josh Identity.
- **Join the Joshternet** — registry lookup succeeded and the origin is not a
  member.

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
connect-src https://joshternet.org
```

The graphic is inline SVG, so the embed does not need `img-src`.

## Accessibility

Each button ships with state-specific alternative text, for example “Verified
Josh, Joshternet site” or “Join the Joshternet”. The surrounding link has a
matching accessible name. Width and height are always 88 and 31 so the page
does not shift.

## Machine-readable state

```text
GET https://joshternet.org/api/button-state?origin=https://example.invalid
```

Returns JSON for the registry-backed state, including `state`, `href`, `alt`,
and `linkLabel`. It does not include a file URL for a standalone image.
Registry failures return `state: "unavailable"` and must not be treated as
Join.
