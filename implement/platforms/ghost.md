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

Ghost publishes the declaration from the web server or reverse proxy in front of it.

## Self-hosted Ghost

Ghost’s supported self-hosted stack puts [Nginx in front of Ghost][ghost-proxy]. Serve the declaration from Nginx before the request reaches Ghost.

A participant affirming Josh identity:

```json
{
  "version": 1,
  "josh": true
}
```

`josh` may instead be `false` for Declined Josh Identity, or omitted for Undeclared Josh Identity. The [implementation guide][implement] defines those three declarations. Do not invent other values. Publishing any valid version 1 declaration establishes participation according to RFC-JOSH-0002.

Exact-path Nginx example:

```nginx
location = /.well-known/josh {
    default_type application/json;
    return 200 '{"version":1,"josh":true}';
}
```

That block:

- responds only to the exact protocol path
- normally returns `200 OK`
- sets `Content-Type: application/json` via `default_type`
- needs no Ghost theme customization
- needs no client-side JavaScript
- leaves ordinary Ghost requests unchanged

Another reverse proxy can do the same exact-path behavior. This recipe does not include unverified snippets for other servers.

### Check the proxy configuration

After editing Nginx, validate the configuration before reload:

```sh
sudo nginx -t
```

Then reload Nginx according to your host’s usual process, and confirm the path locally if the proxy listens on this machine:

```sh
curl -i http://127.0.0.1/.well-known/josh
```

Local or proxy-layer checks do not replace checking the public origin.

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

## Content-Type ownership

RFC-JOSH-0002 associates the declaration with the `application/json` media type. A server SHOULD return:

```text
Content-Type: application/json
```

On this recipe, the reverse proxy owns that header. The Nginx `default_type application/json` line above is one verified way to set it for the exact path. Do not rely on Ghost’s theme layer for the media type.

## Sites published below the origin root

A well-known URI belongs at the root of an origin.

For a publication whose public URL is:

```text
https://example.invalid/blog/
```

the Joshternet declaration is still:

```text
https://example.invalid/.well-known/josh
```

It is not:

```text
https://example.invalid/blog/.well-known/josh
```

This matters especially for Ghost installed beneath a subdirectory or behind a subdirectory reverse-proxy arrangement. The proxy that terminates the origin must expose `/.well-known/josh` at the origin root, not only under the Ghost path prefix.

## Check the deployed URL

Check the live origin with [Check a declaration](/implement/validate/).

Or check the live URL directly:

```sh
curl -i https://example.invalid/.well-known/josh
```

Confirm all of the following:

- `/.well-known/josh` exists at the root of the participating origin
- HTTP `GET` normally returns `200 OK`
- the response uses `Content-Type: application/json` when the hosting platform permits it
- the response body is valid JSON
- `version` is the integer `1`
- `josh`, when present, is a JSON Boolean
- the public path has no `.json` extension
- the canonical path has no trailing slash
- any redirect that is followed remains on the same origin
- the resource is readable without authentication or client-side JavaScript
- `/.well-known/josh/` is not treated as a substitute for the canonical resource

Publishing the declaration declares participation. It does not separately notify JoshBot or require registration with joshternet.org.

## Stop publishing

To stop declaring participation from a Ghost site, remove the exact-path proxy response for `/.well-known/josh`, validate and reload the proxy (`sudo nginx -t` before reload when using Nginx), and confirm the live origin no longer serves a valid declaration.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Ghost behind Nginx exact-path `location = /.well-known/josh`
- Verified: 2026-10-06
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
[ghost-proxy]: https://ghost.org/docs/faq/proxying-https-infinite-loops/
[ghost-routing]: https://docs.ghost.org/themes/routing
[ghost-pro-proxy]: https://ghost.org/help/run-ghost-from-a-subdirectory/
