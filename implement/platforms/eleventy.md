---
layout: default
title: Publish /.well-known/josh with Eleventy
description: >-
  Keep a Joshternet declaration as josh.json in an Eleventy site and publish it
  at the extensionless /.well-known/josh path with the right Content-Type checks.
keywords: >-
  Eleventy, /.well-known/josh, Joshternet declaration, static site recipe
seo:
  type: WebPage
  name: Eleventy
permalink: /implement/platforms/eleventy/
nav_title: Eleventy
---

# Publish with Eleventy

The public resource is exactly `/.well-known/josh`. It does not become `/.well-known/josh.json`.

## Keep the source as JSON

Put the declaration in the Eleventy input directory as `josh.json`, so editors and validators treat it as JSON:

```text
input/
  josh.json
```

A participant affirming Josh identity:

```json
{
  "version": 1,
  "josh": true
}
```

`josh` may instead be `false` for Declined Josh Identity, or omitted for Undeclared Josh Identity. The [implementation guide][implement] defines those three declarations. Do not invent other values.

## Copy it to the protocol path

Passthrough copy paths are relative to the project root, not the input directory. The object form of `addPassthroughCopy()` sets the published path, so Eleventy writes an extensionless file:

```js
eleventyConfig.addPassthroughCopy({
  "input/josh.json": ".well-known/josh",
});
```

The generated site then contains:

```text
.well-known/
  josh
```

The deployed resource is `https://example.invalid/.well-known/josh`.

## Serve it as JSON

The response should use `Content-Type: application/json`. Eleventy does not choose that media type for an extensionless file. The host does.

On Netlify:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

A different host needs its own header rule for the same path. The path and the media type do not change.

## Check the deployed URL

Check the live origin with [Check a declaration](/implement/validate/).

Or check the live URL directly (not only `josh.json`):

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

[implement]: /implement/
