---
layout: default
title: Publish /.well-known/josh with Ghost
description: >-
  Publish a Joshternet declaration from a Ghost site at the exact
  /.well-known/josh path using the web server or reverse proxy in front of Ghost.
keywords: >-
  Ghost, Ghost Pro, /.well-known/josh, Joshternet declaration, Nginx
seo:
  type: WebPage
  name: Ghost
permalink: /implement/platforms/ghost/
nav_title: Ghost
---

# Publish with Ghost

## Self-hosted Ghost

Ghost’s supported self-hosted stack puts [Nginx in front of Ghost][ghost-proxy]. Serve the declaration from Nginx before the request reaches Ghost.

A participant affirming Josh identity:

```json
{
  "version": 1,
  "josh": true
}
```

`josh` may instead be `false` for Declined Josh Identity, or omitted for Undeclared Josh Identity. The [implementation guide][implement] defines those three declarations. Do not invent other values.

Exact-path Nginx example:

```nginx
location = /.well-known/josh {
    default_type application/json;
    return 200 '{"version":1,"josh":true}';
}
```

That block:

- responds only to the exact protocol path
- returns `200 OK`
- sets `Content-Type: application/json`
- needs no Ghost theme customization
- needs no client-side JavaScript
- leaves ordinary Ghost requests unchanged

Another reverse proxy can do the same exact-path behavior. This recipe does not include unverified snippets for other servers.

## Why not routes.yaml

Ghost [dynamic routing][ghost-routing] in `routes.yaml` maps URLs to Ghost templates and data. Trailing slashes are required for dynamic routing to function correctly, and Ghost automatically forces trailing slashes. RFC-JOSH-0002 defines `/.well-known/josh` with no trailing slash.

A custom route can set `content_type` (including JSON), but that route still follows Ghost’s trailing-slash rules. It cannot publish the exact extensionless, no-trailing-slash protocol path.

This recipe therefore handles the resource at the HTTP server or reverse-proxy layer, not through a Ghost theme or `routes.yaml`. Ghost can still participate in the Joshternet when the hosting layer exposes the protocol path.

## Ghost(Pro)

Ordinary Ghost(Pro), without a controllable reverse proxy, is not documented here as a supported recipe today. Ghost Admin, themes, and `routes.yaml` are not a way to publish the exact `/.well-known/josh` resource on plain Ghost(Pro).

Ghost documents reverse-proxy setups for Ghost(Pro)—including Nginx, Apache, Cloudflare, CloudFront, Netlify, and Vercel—as subdirectory and proxy setups that are a paid add-on for the Business plan. See [Using Ghost(Pro) with a subdirectory][ghost-pro-proxy] for Ghost’s proxy requirements.

A Ghost(Pro) publication already running behind a supported reverse proxy can participate when that proxy:

1. responds directly to `/.well-known/josh`
2. returns the version 1 JSON declaration with `Content-Type: application/json`
3. proxies ordinary Ghost traffic according to Ghost’s documented proxy rules

Do not paste Ghost’s full reverse-proxy configuration here—follow Ghost’s current help for the Ghost-specific headers and path rules, and add the exact-path declaration response on the same proxy.

## Check the deployed URL

Check the live origin with [Check a declaration](/implement/validate/).

Or check the live URL directly:

```sh
curl -i https://example.invalid/.well-known/josh
```

Confirm all of the following:

- `200 OK`
- `Content-Type: application/json`
- a valid JSON body
- the expected version 1 declaration
- the extensionless path `/.well-known/josh`
- no redirect to a different origin
- `/.well-known/josh/` is not treated as a substitute for the canonical resource

[implement]: /implement/
[ghost-proxy]: https://ghost.org/docs/faq/proxying-https-infinite-loops/
[ghost-routing]: https://docs.ghost.org/themes/routing
[ghost-pro-proxy]: https://ghost.org/help/run-ghost-from-a-subdirectory/
