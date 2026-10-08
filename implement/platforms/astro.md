---
layout: default
title: Publish /.well-known/josh with Astro
description: >-
  Publish a Joshternet declaration from an Astro site using public/.well-known/josh
  copied into the static build output.
keywords: >-
  Astro, /.well-known/josh, Joshternet declaration, static site recipe
seo:
  type: WebPage
  name: Astro
permalink: /implement/platforms/astro/
nav_title: Astro
---

# Publish with Astro

Astro can publish the declaration as an ordinary static file.

## Add the declaration

Create this directory and file in the Astro project’s `public` directory:

```text
public/
  .well-known/
    josh
```

A participant affirming Josh identity:

```json
{
  "version": 1,
  "josh": true
}
```

`josh` may instead be `false` for Declined Josh Identity, or omitted for Undeclared Josh Identity. The [implementation guide][implement] defines those three declarations. Do not invent other values. Publishing any valid version 1 declaration establishes participation according to RFC-JOSH-0002.

Astro copies files from `public` into the build output. After a normal build:

```sh
astro build
```

the generated site should contain:

```text
dist/
  .well-known/
    josh
```

The deployed resource is then:

```text
https://example.invalid/.well-known/josh
```

## Check the Astro build

Before deploying, confirm that Astro produced the exact extensionless file:

```sh
test -f dist/.well-known/josh
cat dist/.well-known/josh
```

You can also check the local Astro preview server after a build:

```sh
astro preview
```

Then:

```sh
curl -i http://localhost:4321/.well-known/josh
```

The local check confirms that the resource exists at the expected path. Always repeat the check against the deployed site because production response headers are controlled by the hosting platform. Astro’s preview server does not set `Content-Type: application/json` for the extensionless file.

## Serve it as JSON

RFC-JOSH-0002 associates the declaration with the `application/json` media type. A server SHOULD return:

```text
Content-Type: application/json
```

Astro does not choose that media type for an extensionless file. The host does.

## Sites published below the origin root

A well-known URI belongs at the root of an origin.

For a site whose public URL is:

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

Astro’s `base` option does not move the well-known URI. A site that only controls a path under someone else’s origin cannot declare for that origin through this protocol.

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

Publishing the file declares participation. It does not separately notify JoshBot or require registration with joshternet.org.

## Stop publishing

To stop declaring participation from an Astro site, remove `public/.well-known/josh`, rebuild, and redeploy so the live origin no longer serves a valid declaration. Remove any host header rules that exist only for that path.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Astro 5.x (`public/` → `dist/`)
- Verified: 2026-10-06
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
