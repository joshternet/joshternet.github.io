---
layout: default
title: Publish /.well-known/josh with Next.js
description: >-
  Publish a Joshternet declaration from a Next.js app using public/.well-known/josh
  for app server and static export deployments.
keywords: >-
  Next.js, /.well-known/josh, Joshternet declaration, static export
seo:
  type: WebPage
  name: Next.js
permalink: /implement/platforms/nextjs/
nav_title: Next.js
---

# Publish with Next.js

Next.js can publish the declaration as an ordinary static file.

## Add the declaration

Create this directory and file in the Next.js project’s `public` directory:

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

`next dev` and `next start` serve files from `public/` at the site root. With static export (`output: "export"`), a normal build copies them into `out/`. After:

```sh
next build
```

the export should contain:

```text
out/
  .well-known/
    josh
```

The deployed resource is then:

```text
https://example.invalid/.well-known/josh
```

## Check the Next.js build

Before deploying a static export, confirm that Next.js produced the exact extensionless file:

```sh
test -f out/.well-known/josh
cat out/.well-known/josh
```

You can also check the local app server while developing:

```sh
next dev
```

Then:

```sh
curl -i http://localhost:3000/.well-known/josh
```

Treat `next dev`, `next start`, and static export as separate modes when you verify. The local check confirms that the resource exists at the expected path. Always repeat the check against the deployed site because production response headers are controlled by the hosting platform.

## Serve it as JSON

RFC-JOSH-0002 associates the declaration with the `application/json` media type. A server SHOULD return:

```text
Content-Type: application/json
```

`next dev` may serve the extensionless file as `application/octet-stream`. Static export does not apply Next.js `headers` configuration. The host chooses the production media type.

## Sites published below the origin root

A well-known URI belongs at the root of an origin.

For a site whose public URL is:

```text
https://example.invalid/app/
```

the Joshternet declaration is still:

```text
https://example.invalid/.well-known/josh
```

It is not:

```text
https://example.invalid/app/.well-known/josh
```

Next.js `basePath` does not relocate the well-known URI under that prefix. A deployment that only controls a path under someone else’s origin cannot declare for that origin unless the host routes `/.well-known/josh` appropriately.

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

To stop declaring participation from a Next.js site, remove `public/.well-known/josh`, rebuild, and redeploy so the live origin no longer serves a valid declaration. Remove any host header rules that exist only for that path.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Next.js 15 static export (`public/` → `out/`)
- Verified: 2026-10-06
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
