---
layout: default
title: Publish /.well-known/josh with Hugo
description: >-
  Publish a Joshternet declaration from a Hugo site at the exact
  /.well-known/josh path using Hugo's static file directory, with deployment
  notes for common hosting platforms.
keywords: >-
  Hugo, Go, /.well-known/josh, Joshternet declaration, static site recipe
seo:
  type: WebPage
  name: Hugo
permalink: /implement/platforms/hugo/
nav_title: Hugo
---

# Publish with Hugo

Hugo can publish the declaration as an ordinary static file.

## Add the declaration

Create this directory and file in the Hugo project's `static` directory:

```text
static/
  .well-known/
    josh
```

For a participant affirming Josh identity, `static/.well-known/josh` contains:

```json
{
  "version": 1,
  "josh": true
}
```

`josh` may instead be `false` for Declined Josh Identity, or omitted for Undeclared Josh Identity. The [implementation guide][implement] defines those three declarations. Do not invent other values. Publishing any valid version 1 declaration establishes participation according to RFC-JOSH-0002.

Hugo copies files from `static` directly into the generated site. After a normal build:

```sh
hugo
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

Using `static` is preferable to generating this resource through Hugo content, data files, layouts, or custom output formats. The declaration is an origin-level protocol resource rather than a rendered page, and keeping it static avoids unnecessary coupling to themes, templates, and content rendering.

## Check the Hugo build

Before deploying, confirm that Hugo produced the exact extensionless file:

```sh
test -f public/.well-known/josh
cat public/.well-known/josh
```

You can also check the local Hugo server:

```sh
hugo server
```

Then:

```sh
curl -i http://localhost:1313/.well-known/josh
```

The local check confirms that the resource exists at the expected path. Always repeat the check against the deployed site because production response headers are controlled by the hosting platform.

## Serve it as JSON

RFC-JOSH-0002 associates the declaration with the `application/json` media type. A server SHOULD return:

```text
Content-Type: application/json
```

Hugo copies the extensionless file into the generated site, but your production web server or hosting platform ultimately determines the HTTP response headers.

### Netlify

If the Hugo site is hosted on Netlify, add this to `netlify.toml`:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

### Cloudflare Pages

For Cloudflare Pages, create or update:

```text
static/_headers
```

and add:

```text
/.well-known/josh
  Content-Type: application/json
```

Hugo will copy `_headers` into the generated site along with the declaration, and Cloudflare Pages will apply the header rule during deployment.

Other hosting platforms should configure the equivalent response header for the same exact path.

## GitHub Pages

Hugo sites deployed through GitHub Actions need one additional check.

Current versions of GitHub's Pages artifact action exclude hidden files and directories by default. Because `.well-known` begins with a dot, the Hugo build may contain the declaration while the deployment artifact silently leaves it out.

If your workflow uses `actions/upload-pages-artifact`, enable hidden files:

```yaml
- name: Upload artifact
  uses: actions/upload-pages-artifact@v5
  with:
    path: ./public
    include-hidden-files: true
```

Before enabling this option, make sure the generated `public` directory does not contain hidden files that should remain private. A Hugo build output should contain only files intended for publication.

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

This matters for Hugo sites hosted as GitHub Pages project sites or anywhere else where the site is deployed beneath a path prefix.

For example:

```text
https://username.github.io/project/
```

does not make:

```text
https://username.github.io/project/.well-known/josh
```

a Joshternet declaration for that origin.

Hugo’s `baseURL` or a path prefix does not move the well-known URI. The hosting arrangement must give the site control of:

```text
https://username.github.io/.well-known/josh
```

or the site should use a custom origin where it can publish the declaration at the root.

## Custom static directories and Hugo module mounts

Most Hugo sites can simply use:

```text
static/.well-known/josh
```

If the project intentionally configures a different static directory, put `.well-known/josh` in that configured static source instead.

Hugo modules also allow directories to be mounted into the `static` component. If the project already defines custom mounts targeting `static`, make sure the project's own static directory remains mounted as well.

For example:

```toml
[module]
  [[module.mounts]]
    source = "static"
    target = "static"

  [[module.mounts]]
    source = "some-other-static-directory"
    target = "static"
```

A custom mount for the `static` component replaces Hugo's default mount for that component, so omitting the project static directory can prevent `static/.well-known/josh` from being published.

Do not modify a third-party Hugo theme just to add the declaration. Keep the declaration in the site project so participation remains under the site's control.

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

To stop declaring participation from a Hugo site, remove `static/.well-known/josh` (and any host header rules that exist only for that path), rebuild, and redeploy so the live origin no longer serves a valid declaration.

A deliberate `404 Not Found` or `410 Gone` at `/.well-known/josh` indicates that no declaration is currently published. Temporary timeouts, TLS problems, DNS failures, and server errors do not mean the participant intentionally left.

## Tested

- Platform: Hugo static directory (`static/` → `public/`)
- Verified: 2026-10-06
- Protocol: RFC-JOSH-0002 version 1

[implement]: /implement/
