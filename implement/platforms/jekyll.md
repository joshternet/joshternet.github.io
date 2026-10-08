---
layout: default
title: Publish /.well-known/josh with Jekyll
description: >-
  Publish a Joshternet declaration from a Jekyll site at the extensionless
  /.well-known/josh path, including the include rule Jekyll needs for that directory.
keywords: >-
  Jekyll, /.well-known/josh, Joshternet declaration, include .well-known
seo:
  type: WebPage
  name: Jekyll
permalink: /implement/platforms/jekyll/
nav_title: Jekyll
---

# Publish with Jekyll

Jekyll can publish the declaration as an ordinary static file. joshternet.org does it that way.

## Keep an extensionless static file

Jekyll copies source files without front matter as static files, byte for byte. Put the declaration at the public path in the project source:

```text
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

Where you want editors and validators to treat the file as JSON while you edit, keep a separate `josh.json` for tooling and keep `.well-known/josh` as the published copy of the same object. Jekyll does not rename `josh.json` to an extensionless path the way some other generators can. Do not publish the protocol resource as `/.well-known/josh.json`.

## Include the dot directory

Jekyll skips source paths that begin with `.` unless they appear in `include`. Add the directory in `_config.yml`:

```yaml
include:
  - .well-known
```

Without that entry, `.well-known/josh` stays out of `_site` and the deployed origin has no declaration.

The generated site then contains:

```text
_site/
  .well-known/
    josh
```

The deployed resource is `https://example.invalid/.well-known/josh`.

Including `.well-known` in Jekyll and preserving `.well-known` in a later deploy package are separate steps. A successful Jekyll build does not guarantee that every deploy tool keeps hidden directories.

## Check the Jekyll build

Before deploying, confirm that Jekyll produced the exact extensionless file:

```sh
test -f _site/.well-known/josh
cat _site/.well-known/josh
```

You can also check the local Jekyll server:

```sh
bundle exec jekyll serve
```

Then:

```sh
curl -i http://localhost:4000/.well-known/josh
```

The local check confirms that the resource exists at the expected path. Always repeat the check against the deployed site because production response headers are controlled by the hosting platform.

## Serve it as JSON

RFC-JOSH-0002 associates the declaration with the `application/json` media type. A server SHOULD return:

```text
Content-Type: application/json
```

Jekyll does not choose that media type for an extensionless file. The host does.

### Netlify

On Netlify:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

### Cloudflare Pages

For Cloudflare Pages, place `_headers` where it ends up in the publish directory (for example next to other static assets that Jekyll copies, with an `include` entry if the filename begins with `_`):

```text
/.well-known/josh
  Content-Type: application/json
```

A different host needs its own header rule for the same path. The path and the media type do not change.

## GitHub Pages

Jekyll sites deployed with a custom GitHub Actions workflow that uses `actions/upload-pages-artifact` need one additional check. That action excludes hidden files and directories by default. Because `.well-known` begins with a dot, `_site` may contain the declaration while the deployment artifact silently leaves it out.

Enable hidden files when uploading the Jekyll output:

```yaml
- name: Upload artifact
  uses: actions/upload-pages-artifact@v5
  with:
    path: ./_site
    include-hidden-files: true
```

Before enabling this option, make sure the generated output does not contain hidden files that should remain private.

Not every GitHub Pages site uses this action. joshternet.org’s own Pages path may differ. GitHub Pages also does not currently provide normal per-path custom response-header configuration; inspect the live `Content-Type` when that matters.

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

Jekyll’s `baseurl` does not move the well-known URI. Project sites such as `https://username.github.io/project/` must control the origin root, or use a custom origin, to participate through this protocol.

## Check the deployed URL

Check the live origin with [Check a declaration](/implement/validate/).

Or check the live URL directly (not only the source file):

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

To stop declaring participation from a Jekyll site, remove `.well-known/josh` from the source (and the `include` entry if nothing else under `.well-known` remains), rebuild, and redeploy so the live origin no longer serves a valid declaration. Remove any host header rules that exist only for that path.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Jekyll static `.well-known/josh` with `include`
- Verified: 2026-10-06
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
