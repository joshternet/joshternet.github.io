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

Eleventy can publish the declaration as an ordinary static file.

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

`josh` may instead be `false` for Declined Josh Identity, or omitted for Undeclared Josh Identity. The [implementation guide][implement] defines those three declarations. Do not invent other values. Publishing any valid version 1 declaration establishes participation according to RFC-JOSH-0002.

## Copy it to the protocol path

Passthrough copy paths are relative to the project root, not the input directory. The object form of `addPassthroughCopy()` sets the published path, so Eleventy writes an extensionless file:

```js
eleventyConfig.addPassthroughCopy({
  "input/josh.json": ".well-known/josh",
});
```

The generated site then contains (default output directory `_site`):

```text
_site/
  .well-known/
    josh
```

The deployed resource is `https://example.invalid/.well-known/josh`.

## Check the Eleventy build

Before deploying, confirm that Eleventy produced the exact extensionless file:

```sh
test -f _site/.well-known/josh
cat _site/.well-known/josh
```

If your project uses a different output directory, check that path instead.

You can also check the local Eleventy server:

```sh
npx @11ty/eleventy --serve
```

Then:

```sh
curl -i http://localhost:8080/.well-known/josh
```

During `--serve`, Eleventy may emulate passthrough copy instead of writing every file into `_site`. The local check confirms the URL path; always repeat the check against the deployed site because production response headers are controlled by the hosting platform.

## Serve it as JSON

RFC-JOSH-0002 associates the declaration with the `application/json` media type. A server SHOULD return:

```text
Content-Type: application/json
```

Eleventy does not choose that media type for an extensionless file. The host does.

### Netlify

On Netlify:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

### Cloudflare Pages

For Cloudflare Pages, put a `_headers` file in the directory that is copied into the deploy output (often the same input tree Eleventy already copies, or the publish directory itself):

```text
/.well-known/josh
  Content-Type: application/json
```

A different host needs its own header rule for the same path. The path and the media type do not change.

## GitHub Pages

Eleventy sites deployed with a custom GitHub Actions workflow that uses `actions/upload-pages-artifact` need one additional check. That action excludes hidden files and directories by default. Because `.well-known` begins with a dot, `_site` may contain the declaration while the deployment artifact silently leaves it out.

Enable hidden files when uploading the Eleventy output:

```yaml
- name: Upload artifact
  uses: actions/upload-pages-artifact@v5
  with:
    path: ./_site
    include-hidden-files: true
```

Before enabling this option, make sure the generated output does not contain hidden files that should remain private.

Not every GitHub Pages site uses this action. Branch-based publishing without `upload-pages-artifact` has a different packaging path. GitHub Pages also does not currently provide normal per-path custom response-header configuration; inspect the live `Content-Type` when that matters.

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

Eleventy’s `pathPrefix` does not move the well-known URI. Project sites such as `https://username.github.io/project/` must control the origin root, or use a custom origin, to participate through this protocol.

## Check the deployed URL

Check the live origin with [Check a declaration](/implement/validate/).

Or check the live URL directly (not only `josh.json`):

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

To stop declaring participation from an Eleventy site, remove the passthrough copy (and the `josh.json` source if you no longer need it), rebuild, and redeploy so the live origin no longer serves a valid declaration. Remove any host header rules that exist only for that path.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Eleventy `addPassthroughCopy` to `.well-known/josh`
- Verified: 2026-10-06
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
