---
layout: default
title: Publish /.well-known/josh with Quartz
description: >-
  Copy a Joshternet declaration into a Quartz 5 build at the exact
  /.well-known/josh path after npx quartz build, with host headers for common
  static hosts.
keywords: >-
  Quartz, /.well-known/josh, Joshternet declaration, static site recipe
seo:
  type: WebPage
  name: Quartz
permalink: /implement/platforms/quartz/
nav_title: Quartz
---

# Publish with Quartz

Quartz 5 can publish the declaration as an ordinary static file, copied into the build output after `npx quartz build`.

## Keep the source as JSON

Put the declaration at the Quartz project root as `josh.json`, outside `content/` and outside `quartz/static`, so editors and validators treat it as JSON:

```text
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

Do not rely on `quartz/static` or `content/.well-known`. Quartz copies `quartz/static` to `public/static`, so a file kept there is published under `/static/` rather than at `/.well-known/josh`. Quartz also skips directories whose names start with a dot when it collects files, and `npx quartz build` deletes `public/` before it emits. The declaration has to be copied after that build.

## Copy it to the protocol path

After a normal build:

```sh
npx quartz build
mkdir -p public/.well-known
cp josh.json public/.well-known/josh
```

the generated site should contain:

```text
public/
  .well-known/
    josh
```

The deployed resource is then:

```text
https://example.invalid/.well-known/josh
```

Those paths are literal. Repeat the copy after every build, including a rebuild that cleans `public/`.

## Check the Quartz build

Before deploying, confirm that the copy produced the exact extensionless file:

```sh
test -f public/.well-known/josh
cat public/.well-known/josh
```

You can also request the file from the local preview after the copy. `npx quartz build --serve` cleans `public/` when it builds, so copy the declaration after that clean finishes. The preview server can return the file and still omit `Content-Type: application/json`.

```sh
curl -i http://localhost:8080/.well-known/josh
```

Always repeat the check against the deployed site because production response headers are controlled by the hosting platform.

## Serve it as JSON

RFC-JOSH-0002 associates the declaration with the `application/json` media type. A server SHOULD return:

```text
Content-Type: application/json
```

Quartz does not choose that media type for an extensionless file. The host does.

### Netlify

If the Quartz site is hosted on Netlify, add this to `netlify.toml` at the project root. Netlify reads that file from the repository. Append the copy to the build command (`npx quartz plugin install && npx quartz build && mkdir -p public/.well-known && cp josh.json public/.well-known/josh`):

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

### Cloudflare Pages

Cloudflare Pages reads `_headers` from the build output, `public/`. A file placed in `quartz/static` would be emitted under `public/static/` and would not apply. Keep this file at the project root as `josh-cloudflare-headers`:

```text
/.well-known/josh
  Content-Type: application/json
```

Copy it in the same step as the declaration:

```sh
npx quartz build
mkdir -p public/.well-known
cp josh.json public/.well-known/josh
cp josh-cloudflare-headers public/_headers
```

Use that same trailing copy in the Cloudflare build command.

### Nginx

Quartz’s example server uses `try_files $uri $uri.html $uri/ =404`. An exact location sets the media type for the declaration and still serves the copied file from the site root:

```nginx
location = /.well-known/josh {
    default_type application/json;
}
```

Put that location in the same `server` block as `root`, ahead of `location /`.

Other hosting platforms should configure the equivalent response header for the same exact path.

## GitHub Pages

The [Quartz hosting workflow](https://quartz.jzhao.xyz/hosting) uploads `public` with `actions/upload-pages-artifact` and does not set `include-hidden-files`. That action excludes hidden files and directories by default. Because `.well-known` begins with a dot, the copy may succeed while the deployment artifact silently leaves the declaration out.

Copy the declaration after the build, then enable hidden files on the upload step:

```yaml
- name: Publish Joshternet declaration
  run: |
    mkdir -p public/.well-known
    cp josh.json public/.well-known/josh

- name: Upload artifact
  uses: actions/upload-pages-artifact@v3
  with:
    path: public
    include-hidden-files: true
```

Before enabling this option, make sure the generated `public` directory does not contain hidden files that should remain private. A Quartz build output should contain only files intended for publication.

GitHub Pages does not currently provide normal per-path custom response-header configuration. If it serves the extensionless declaration with a different media type, inspect the live response and consider putting a configurable hosting or proxy layer in front of the site when you need explicit `Content-Type: application/json`.

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

This matters for Quartz sites hosted as GitHub Pages project sites or anywhere else where the site is deployed beneath a path prefix.

For example:

```text
https://username.github.io/project/
```

does not make:

```text
https://username.github.io/project/.well-known/josh
```

a Joshternet declaration for that origin.

Quartz’s `baseUrl` does not move the well-known URI. The hosting arrangement must give the site control of:

```text
https://username.github.io/.well-known/josh
```

or the site should use a custom origin where it can publish the declaration at the root.

## Check the deployed URL

After deployment, check the live origin with [Check a declaration](/implement/validate/).

You can also inspect the response directly:

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

To stop declaring participation from a Quartz site, remove `josh.json` and stop copying it to `public/.well-known/josh` (and remove any host header rules that exist only for that path), rebuild, and redeploy so the live origin no longer serves a valid declaration.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Quartz 5.0.0 post-build copy (`josh.json` → `public/.well-known/josh`)
- Verified: 2026-10-10 against Quartz 5.0.0 source (static emitter, glob, build clean, preview server)
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
