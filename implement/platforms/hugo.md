---
layout: default
title: Publish /.well-known/josh with Hugo
description: >-
  Publish a Joshternet /.well-known/josh declaration from an existing Hugo site
  via the static directory—covering custom dirs, module mounts, host headers,
  stale build output, and public verification.
keywords: >-
  Hugo, /.well-known/josh, Joshternet declaration, static directory, module
  mounts, Content-Type
seo:
  type: TechArticle
  name: Hugo
permalink: /implement/platforms/hugo/
nav_title: Hugo
---

# Publish with Hugo

Hugo is a static-site generator that can publish ordinary files alongside generated pages. A Joshternet declaration is a small JSON document rather than a page that needs templates or content rendering.

Hugo’s static-file system can copy the declaration into the generated website while preserving its exact filename. The build creates the file; the hosting service ultimately determines how the public resource is delivered over HTTP.

This guide is a practical procedure for existing Hugo sites. Other methods are possible—see the [Platforms](/implement/platforms/) directory.

## Use Hugo’s static directory

Use this approach when:

- You already use Hugo.
- The declaration can live in the site’s source repository.
- The site generates into a static output directory.
- The host can publish an extensionless file at the **origin root**.
- You control the intended origin.

This method generally needs no custom page templates, modules, or extra services. Do not replace your site architecture. A reverse proxy or CDN may add response-header controls; that is separate from Hugo’s static-file copying.

## Before you begin

You should have:

- An existing Hugo project and a working Hugo build.
- Access to project configuration and the effective static source.
- Control over deployment and knowledge of the public hostname.
- A way to test the deployed HTTP response.

Hugo supports TOML, YAML, and JSON configuration. Examples below use TOML; adapt them to your existing format. Do not create a new Hugo project or switch themes merely for this recipe.

## The declaration belongs at the origin root

The required public resource is:

```text
https://joshua.example/.well-known/josh
```

The path starts with `/.well-known/`, uses `josh` as the resource name, has no `.json` extension, has no trailing slash, and is not under a content directory. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

| Stage | Default location |
| --- | --- |
| Hugo source | `static/.well-known/josh` |
| Hugo output | `public/.well-known/josh` |
| Public resource | `https://joshua.example/.well-known/josh` |

The first two locations can change through Hugo configuration. The public protocol path does not.

## Choose your declaration

The minimum valid version 1 declaration is:

```json
{
  "version": 1
}
```

That establishes participation with Undeclared Josh Identity.

### Affirmed

```json
{
  "version": 1,
  "josh": true
}
```

### Declined

```json
{
  "version": 1,
  "josh": false
}
```

Omission and `false` have different meanings. The `version` value must be the JSON integer token `1`. Values such as `"1"`, `1.0`, and `1e0` are not valid version 1 declarations. Never infer Josh identity from the domain, site title, or author name.

{% include declaration-identity-ref.html %}

## Create the static resource

One possible layout:

```text
hugo-site/
├── hugo.toml
├── content/
├── layouts/
└── static/
    └── .well-known/
        └── josh
```

Create the directory and file in the project’s effective static source:

```text
static/
  .well-known/
    josh
```

The published filename is exactly `josh`. The file contains ordinary JSON despite having no extension. A file under `content/` is not equivalent: content processing generates pages, while this declaration must be a specific protocol resource.

## How Hugo publishes static files

Hugo copies files from its static component into the publishing directory. Static files ordinarily bypass content rendering—suitable for `robots.txt`, favicons, and other known URLs.

Defaults are the `static/` directory and `public/` output. Themes and modules can also contribute static files through Hugo’s unified file system. Path shape is usually preserved. See Hugo’s [directory structure](https://gohugo.io/getting-started/directory-structure/) and [configuration](https://gohugo.io/configuration/all/).

Using `static` is preferable to generating this resource through content, data files, layouts, or custom output formats. Keeping it static avoids coupling to themes and templates. Hugo does not guarantee that every host assigns `application/json` to an extensionless file.

## Generate the declaration

```sh
hugo
```

This normally writes into `public/`. Current Hugo documentation also documents `hugo build`; use the command your project already uses. Do not invent a new build script for one JSON file. Running Hugo in the reader’s project is unrelated to the Joshternet repository’s own production build scripts.

## Check the generated output

```sh
test -f public/.well-known/josh
cat public/.well-known/josh
```

The first command confirms the path exists. The second shows contents. Neither proves public HTTP headers or deployment. The output should be an extensionless regular file—not `josh.json` or an HTML page.

The generated site should contain:

```text
public/
  .well-known/
    josh
```

## Check the resource locally

```sh
hugo server
```

Then:

```sh
curl -i http://localhost:1313/.well-known/josh
```

Port `1313` is the common default and may change. The development server is not production hosting. Local Content-Type, redirects, and caching may differ. Do not retune Hugo’s [server configuration](https://gohugo.io/configuration/server/) merely to mimic a particular host—verify the public deployment independently.

## Your host must deliver the JSON correctly

RFC-JOSH-0002 associates the declaration with `application/json`. A server SHOULD return:

```text
Content-Type: application/json
```

Hugo copies the bytes; the host delivers HTTP. An extensionless file may receive a generic MIME type. Keep four checks separate: valid JSON, exact URL, HTTP status, and recommended media type. An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002.

## Netlify hosting

If the Hugo site is hosted on Netlify, add this to `netlify.toml`:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

Prefer one method (`netlify.toml` or `_headers`), not both without reason. Static header rules do not automatically apply to proxy or function responses. See [Netlify headers](https://docs.netlify.com/manage/routing/headers/).

## Cloudflare Pages hosting

For Cloudflare Pages, create or update:

```text
static/_headers
```

and add:

```text
/.well-known/josh
  Content-Type: application/json
```

Hugo copies `_headers` into the generated site with the declaration. Cloudflare Pages applies the rule for static responses. It does not automatically apply to Pages Functions. Do not add a Worker when the static-file approach already works. See [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

## GitHub Pages and dot-prefixed directories

`.well-known` is a hidden directory by convention. A Hugo build may contain the file while packaging omits it—or while packaging includes secrets.

### Branch-based publishing

For a prebuilt Hugo site, publish a branch (or folder) that contains the generated static assets. Place `.nojekyll` at the publishing root so GitHub Pages does not run Jekyll over the output. See [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [Hugo on GitHub Pages](https://gohugo.io/host-and-deploy/deploy-to-github-pages/).

### Existing GitHub Actions workflows

Some workflows use `actions/upload-pages-artifact`. Current versions exclude hidden files and directories by default. Because `.well-known` begins with a dot, `public` may contain the declaration while the artifact silently leaves it out.

If your workflow already uses that action, enable hidden files:

```yaml
- name: Upload artifact
  uses: actions/upload-pages-artifact@v5
  with:
    path: ./public
    include-hidden-files: true
```

Before enabling this option, make sure the generated `public` directory does not contain hidden files that should remain private. A Hugo build output should contain only files intended for publication. Do not introduce a new artifact pipeline merely for this recipe.

### Response-header limitations

GitHub Pages does not provide ordinary per-path custom MIME-type configuration. The extensionless declaration may receive a generic Content-Type. `.nojekyll` does not change Content-Type. Do not rename the resource to `josh.json`. If explicit MIME control is essential, use an existing configurable proxy or host—not a mandatory migration.

## What if your project doesn’t use `static/`?

Hugo’s `staticDir` can point elsewhere:

```toml
staticDir = "site-static"
```

Then the source is `site-static/.well-known/josh`. The public URL remains `https://joshua.example/.well-known/josh`. Do not change a working static directory solely to match this tutorial.

A custom publishing directory:

```toml
publishDir = "dist"
```

means verifying `dist/.well-known/josh` locally while the public URL stays the same. Confirm the host deploys the configured output, not an assumed `public/`.

## Why module mounts can change static-file behavior

Hugo’s unified file system lets themes, modules, and the main project contribute to logical components such as `content`, `layouts`, `assets`, `data`, and `static`. Physical paths and mount targets can differ. A file under project `static/` can fail to appear in the build if custom mounts omit that source.

Defining custom mounts for a component **removes that component’s default mount** unless you restore it. For `static`, omitting the project static directory can prevent `static/.well-known/josh` from publishing.

Illustrative configuration that preserves the project static directory while adding another source:

```toml
[module]
  [[module.mounts]]
    source = "static"
    target = "static"

  [[module.mounts]]
    source = "shared-static"
    target = "static"
```

Do not add custom mounts when the default static directory already works. Hugo’s current docs advise against mixing module mounts with legacy settings such as `staticDir` without understanding the effective FS—inspect mounts instead of layering conflicting legacy config. See [module configuration](https://gohugo.io/configuration/module/).

Do not modify a third-party Hugo theme just to add the declaration. Keep the declaration in the site project so participation stays under your control, survives theme upgrades, and remains reviewable in source control.

## Origin-root requirements and project sites

{% include declaration-origin-root-note.html %}

This matters for Hugo sites hosted as GitHub Pages project sites or anywhere the site is deployed beneath a path prefix.

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

or the site should use a custom origin (for example `https://joshua.example/`) where it can publish the declaration at the root.

User/organization GitHub Pages sites and custom domains are different setups; a custom domain may provide a separately controlled origin when configured correctly, but it does not automatically fix every routing issue.

## Hostnames and multilingual sites

These are distinct origins:

- `https://joshua.example/`
- `https://www.joshua.example/`
- `https://blog.joshua.example/`

Each participating origin needs its own declaration. Cross-origin redirects do not substitute.

Hugo multilingual sites may use language subdirectories or separate hosts. A language section under `/es/` does not need a second declaration merely for language. A separate language subdomain is a different origin. Static mounts in multihost mode can vary—inspect your configuration rather than assuming one shared `public/` layout.

## Conflicting outputs and mount troubleshooting

Possible competing sources for the same public path include the project static directory, a theme’s static files, module mounts, a custom deploy copy step, or a reverse-proxy rule. Prefer one authoritative source for `/.well-known/josh`.

If `static/.well-known/josh` exists in source but is missing from the build: inspect configuration and mounts, confirm the project static directory is included, check collisions with themes/modules, rebuild, inspect output, then verify deployment. Do not patch third-party theme files as the default fix.

## Verify the public declaration

```sh
curl -i https://joshua.example/.well-known/josh
```

Inspect origin, status, redirects, final URL, Content-Type, JSON body, integer `version` `1`, optional Boolean `josh`, authentication, and exact path.

{% include declaration-verify-ref.html %}

Ordinary `JSON.parse()` may normalize `1.0` to `1` while the protocol requires the integer token. Use the [declaration checker](/implement/validate/).

Some hosts return HTTP 200 with HTML for missing paths, or redirect to a trailing slash or another hostname. Inspect headers and body. Same-origin redirects differ from cross-origin redirects.

### Regression checks

After publishing, spot-check the homepage, about page, an article, CSS/JS/images, `robots.txt`, sitemap, feeds, and other well-known resources. If a custom mount dropped previously published static files, treat that as a regression.

## Updates and caching

1. Edit the source declaration.
2. Validate JSON.
3. Run Hugo.
4. Confirm the generated file.
5. Deploy.
6. Verify the public response.
7. Account for caching.

Keep the URL stable—do not invent timestamped declaration filenames.

## A removed source file can leave an old published file behind

Hugo does not ordinarily clear the publishing directory before every build. Removing `static/.well-known/josh` can leave an existing `public/.well-known/josh` from an earlier build, which may still be deployed.

Distinguish removing the source, cleaning stale output, generating a new build, replacing deployed assets, and verifying the live response. A successful rebuild does not automatically prove obsolete files are gone.

Hugo’s [build configuration](https://gohugo.io/configuration/build/) includes `build.cleanDestinationDir` (and `--cleanDestinationDir`). Cleanup can remove stale files, but keep-lists and version-specific behavior matter—and publishers often keep hand-managed files in `public/` (for example `CNAME`). Enabling cleanup is not sufficient evidence that an old `.well-known/josh` disappeared. Prefer verifying the file is absent from the intended deployment output, or building into a fresh destination when testing removal. Do not blindly delete a build directory that holds files managed outside Hugo.

{% capture stop_steps %}
1. Remove the declaration from the effective static source (and any duplicate mounts or theme copies).
2. Remove host header rules that exist only for that path, if any.
3. Rebuild into a clean or carefully verified output so `public/.well-known/josh` (or your `publishDir`) is gone.
4. Redeploy so packaging no longer includes the file; check CDN or proxy rules that might still answer the path.
5. Confirm ordinary site pages still work, then request `https://joshua.example/.well-known/josh` and verify the live response.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Security considerations

Deploy only the generated static output—not the whole Hugo repository. Publishing `.well-known/josh` does not require exposing every hidden file. Review packaging for `.env` files, credentials, private config, debug output, and caches before enabling broad hidden-file inclusion.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Source exists, output missing | Incorrect static directory or module mount |
| Output uses the wrong path | Static mount target or deployment prefix |
| Output contains old JSON | Stale build files |
| Source removed but declaration remains | Old output, duplicate source, or caching |
| File exists locally but public URL returns 404 | Deployment omitted `.well-known` |
| HTTP 200 returns HTML | Hosting fallback or rewrite |
| Wrong Content-Type | Host MIME mapping |
| Works in `hugo server`, fails publicly | Hosting configuration difference |
| Other static files disappear | Custom mount replaced default mount |
| Declaration appears under `/blog/` | Subpath deployment |
| Different results across hostnames | Separate origins or redirects |
| Invalid JSON | Syntax or protocol-value error |
| GitHub Pages omits `.well-known` | Publishing configuration or hidden-file filtering |
| New build retains removed files | Destination cleanup behavior |
| Other site resources break | Overbroad configuration change |

Inspect source, build output, packaging, and live `curl` before upgrading Hugo or themes without evidence.

## Tested

- Platform: Hugo static directory (`static/` → `public/`)
- Verified: 2026-10-06
- Evidence: recipe and Hugo documentation review of static-file copying, mount replacement, and stale-output caveats (not a live Hugo+host deployment in this repository, and not a CI Hugo fixture build). Host MIME and packaging behavior must still be verified per environment.
- Protocol: RFC-JOSH-0002 version 1

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Hugo directory structure](https://gohugo.io/getting-started/directory-structure/), [usage](https://gohugo.io/getting-started/usage/), [configuration](https://gohugo.io/configuration/all/), [modules](https://gohugo.io/configuration/module/), [build](https://gohugo.io/configuration/build/), [server](https://gohugo.io/configuration/server/), [host and deploy](https://gohugo.io/host-and-deploy/), [GitHub Pages](https://gohugo.io/host-and-deploy/deploy-to-github-pages/)
- [Netlify headers](https://docs.netlify.com/manage/routing/headers/), [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
