---
layout: default
title: Publish /.well-known/josh with WordPress
description: >-
  Publish a Joshternet declaration from WordPress using the maintained Joshternet
  plugin at the exact /.well-known/josh path.
keywords: >-
  WordPress, Joshternet plugin, /.well-known/josh, Joshternet declaration
seo:
  type: WebPage
  name: WordPress
permalink: /implement/platforms/wordpress/
nav_title: WordPress
---

# Publish with WordPress

Publish your declaration with the Joshternet plugin for WordPress.

## Install the Joshternet plugin

Install from the project’s [published repository][plugin-source] (release package or development checkout) until the plugin is listed in the WordPress.org directory. After directory acceptance, prefer search-and-install from wp-admin.

Requires WordPress 6.0+ and PHP 7.4+.

1. Install and activate Joshternet.
2. Open **Settings → Joshternet**.
3. Enable participation.
4. Choose Affirmed (`josh: true`), Declined (`josh: false`), or Undeclared (omit `josh`).
5. Save.

A participant affirming Josh identity publishes:

```json
{
  "version": 1,
  "josh": true
}
```

`josh` may instead be `false` for Declined Josh Identity, or omitted for Undeclared Josh Identity. The [implementation guide][implement] defines those three declarations. Do not invent other values. Publishing any valid version 1 declaration establishes participation according to RFC-JOSH-0002.

The plugin does not create a physical `.well-known` file on disk. WordPress answers `/.well-known/josh` itself.

## Check the endpoint

On the settings screen, use the public endpoint URL shown there, or check the live origin with [Check a declaration](/implement/validate/).

Or check the live URL directly:

```sh
curl -i https://example.invalid/.well-known/josh
```

Confirm all of the following:

- `/.well-known/josh` exists at the root of the participating origin
- HTTP `GET` normally returns `200 OK`
- the response uses `Content-Type: application/json`
- the response body is valid JSON
- `version` is the integer `1`
- `josh`, when present, is a JSON Boolean
- the public path has no `.json` extension
- the canonical path has no trailing slash
- any redirect that is followed remains on the same origin
- the resource is readable without authentication or client-side JavaScript

Publishing declares participation. It does not separately notify JoshBot or require registration with joshternet.org.

## Multisite and sites below the origin root

Declarations belong to origins. Subdomain or domain-mapped sites can each declare when they have distinct origins. Path-based subsites that share the main site’s origin share one `/.well-known/josh`.

A well-known URI belongs at the root of an origin. A WordPress site published under a path prefix may need the host to route `/.well-known/josh` into WordPress. That is hosting configuration, not a reason to publish the declaration under the path prefix.

WordPress.com and other managed hosts are only recommended when a live check on that host has been proven. This recipe does not claim those environments yet.

## Stop publishing

To stop declaring participation, deactivate the plugin or disable participation in **Settings → Joshternet**, then confirm the live origin no longer serves a valid declaration.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: WordPress + Joshternet plugin 0.1.1
- Verified: 2026-10-06
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
[plugin-source]: https://github.com/joshternet/wordpress
