---
layout: default
title: Publish /.well-known/josh with a Cloudflare Worker
description: >-
  Serve a Joshternet /.well-known/josh declaration from a Cloudflare Worker
  route without changing your site’s app build—optional for origins already on
  Cloudflare.
keywords: >-
  Cloudflare Worker, /.well-known/josh, Joshternet declaration, Worker route
seo:
  type: TechArticle
  name: Cloudflare Worker
permalink: /implement/platforms/cloudflare-worker/
nav_title: Cloudflare Worker
---

# Publish with a Cloudflare Worker

When Cloudflare already proxies your origin, a small Worker can answer only
`/.well-known/josh` and leave every other path alone. You do not need to migrate
DNS or hosting providers to participate—only to attach this optional route.

Copy the Worker and Wrangler files below into a project you control. Joshternet
does not host or operate this Worker for members.

## Keep the protocol path exact

The public resource is `/.well-known/josh` at the root of an origin. It has no
`.json` extension and no trailing slash.

A participant affirming Josh identity:

```json
{
  "version": 1,
  "josh": true
}
```

`josh` may instead be `false` for Declined Josh Identity, or omitted for
Undeclared Josh Identity. The [implementation guide][implement] defines those
three declarations. Do not invent other values. Publishing any valid version 1
declaration establishes participation according to RFC-JOSH-0002. Do not publish
the protocol resource as `/.well-known/josh.json`.

## Worker module

Save as `src/index.js` (or paste into the Cloudflare dashboard Worker editor):

```js
/**
 * Serves only /.well-known/josh with a valid version 1 Joshternet declaration.
 * All other paths pass through to origin. Identity comes from env.JOSH_IDENTITY
 * (affirmed | declined | undeclared).
 */
function declarationForIdentity(identity) {
  const value = String(identity || "undeclared")
    .trim()
    .toLowerCase();

  if (value === "affirmed") {
    return { version: 1, josh: true };
  }

  if (value === "declined") {
    return { version: 1, josh: false };
  }

  return { version: 1 };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/.well-known/josh") {
      return fetch(request);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "GET, HEAD",
        },
      });
    }

    const body = `${JSON.stringify(declarationForIdentity(env.JOSH_IDENTITY), null, 2)}\n`;
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    };

    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    return new Response(body, { status: 200, headers });
  },
};
```

## Wrangler config

Optional `wrangler.toml` if you deploy with Wrangler:

```toml
name = "josh-declaration"
main = "src/index.js"
compatibility_date = "2024-09-23"

[vars]
# affirmed | declined | undeclared
JOSH_IDENTITY = "undeclared"
```

## Configure identity

Set `JOSH_IDENTITY` (Worker variable or Wrangler `[vars]`) to one of:

| Value | Declaration |
| --- | --- |
| `affirmed` | `{ "version": 1, "josh": true }` |
| `declined` | `{ "version": 1, "josh": false }` |
| `undeclared` (default) | `{ "version": 1 }` |

Never infer identity from a domain name or site title.

The Worker must:

- answer `GET` and `HEAD` for the exact path `/.well-known/josh`
- return `Content-Type: application/json`
- pass through every other path to your origin unchanged

## Attach a route

Deploy the Worker, then add a Cloudflare route that matches only
`/.well-known/josh` on the hostname that should participate—for example
`example.com/.well-known/josh`—and point that route at the Worker.

Confirm unrelated URLs still hit your origin as before. Exact Wrangler and
dashboard steps change over time; follow current Cloudflare documentation for
Worker routes.

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

The Worker route must be on the participating origin root, not under a path
prefix.

## Check the deployed URL

Check the live origin with [Check a declaration](/implement/validate/).

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

Publishing the declaration declares participation. It does not separately notify JoshBot or require registration with joshternet.org.

## Stop publishing

To stop declaring participation, remove or disable the Worker route for
`/.well-known/josh`, then delete or unpublish the Worker if nothing else uses
it. Confirm the live origin no longer serves a valid declaration (or returns
whatever your origin serves instead).

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that
no declaration is currently published. Temporary timeouts, TLS problems, DNS
failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Cloudflare Worker route for `/.well-known/josh` (example Worker)
- Verified: 2026-10-31
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
