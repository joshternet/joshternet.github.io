---
layout: default
title: Publish /.well-known/josh with Nuxt
description: >-
  Publish a Joshternet declaration from Nuxt 4 using public/.well-known/josh
  in a static generate output.
keywords: >-
  Nuxt 4, /.well-known/josh, Joshternet declaration, nuxt generate
seo:
  type: WebPage
  name: Nuxt
permalink: /implement/platforms/nuxt/
nav_title: Nuxt
---

# Publish with Nuxt

Nuxt 4 can publish the declaration as an ordinary static file.

## Add the declaration

Create this directory and file in the Nuxt project’s `public` directory:

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

Nuxt copies files from `public` into the generate output. After a normal generate:

```sh
nuxt generate
```

the output should contain:

```text
.output/public/
  .well-known/
    josh
```

The deployed resource is then:

```text
https://example.invalid/.well-known/josh
```

## Check the Nuxt build

Before deploying, confirm that Nuxt produced the exact extensionless file:

```sh
test -f .output/public/.well-known/josh
cat .output/public/.well-known/josh
```

You can also check a local static preview of that output if your usual Nuxt workflow provides one. The local check confirms that the resource exists at the expected path. Always repeat the check against the deployed site because production response headers are controlled by the hosting platform.

## Serve it as JSON

RFC-JOSH-0002 associates the declaration with the `application/json` media type. A server SHOULD return:

```text
Content-Type: application/json
```

Nuxt does not choose that media type for an extensionless file in the static generate case. The host does.

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

Nuxt `app.baseURL` does not relocate the well-known URI. A site that only controls a path under someone else’s origin cannot declare for that origin through this protocol.

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

To stop declaring participation from a Nuxt site, remove `public/.well-known/josh`, regenerate, and redeploy so the live origin no longer serves a valid declaration. Remove any host header rules that exist only for that path.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Nuxt 4.x (`public/` → `.output/public/` via `nuxt generate`)
- Verified: 2026-10-06
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
