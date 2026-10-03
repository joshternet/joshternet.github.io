---
layout: default
title: Publish /.well-known/josh with Jekyll
description: >-
  How to publish a Joshternet declaration from a Jekyll site at the extensionless
  /.well-known/josh path, including the include rule Jekyll needs for that
  directory.
seo:
  type: WebPage
  name: Jekyll
permalink: /implement/jekyll/
nav_title: Jekyll
---

# Publish with Jekyll

This page is the Jekyll recipe. It is non-normative. [RFC-JOSH-0002][rfc-0002] defines the protocol, and the [implementation guide][implement] explains participation and Josh identity. Jekyll's job is only to publish the declaration at the path the protocol already requires.

The public resource is exactly `/.well-known/josh`. It does not become `/.well-known/josh.json`.

This is the layout joshternet.org uses.

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

`josh` may instead be `false` for Declined Josh Identity, or omitted for Undeclared Josh Identity. The [implementation guide][implement] defines those three declarations. Do not invent other values.

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
.well-known/
  josh
```

The deployed resource is `https://example.invalid/.well-known/josh`.

## Serve it as JSON

The response should use `Content-Type: application/json`. Jekyll does not choose that media type for an extensionless file. The host does.

On Netlify:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

A different host needs its own header rule for the same path. The path and the media type do not change.

## Check the deployed URL

Check the live URL, not only the source file:

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

[rfc-0002]: https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md
[implement]: /implement/
