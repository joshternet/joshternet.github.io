---
layout: default
title: Publish /.well-known/josh with Astro
description: >-
  Publish a Joshternet /.well-known/josh declaration from an existing Astro site
  as a public static file, then verify build output, hosting Content-Type, and
  the live origin URL.
keywords: >-
  Astro, /.well-known/josh, Joshternet declaration, public directory, static
  site recipe, Content-Type
seo:
  type: TechArticle
  name: Astro
permalink: /implement/platforms/astro/
nav_title: Astro
---

# Publish with Astro

Astro makes it straightforward to publish a Joshternet declaration as an ordinary static file. Files in Astro’s public directory are not transformed during the build; they are copied into the generated site. That behavior is a good fit for `/.well-known/josh`.

You remain responsible for ensuring the deployed file is available at the correct public URL on the origin you intend to declare. The recommended implementation needs no Astro component, endpoint, middleware, server adapter, or client-side JavaScript.

Other methods are possible. This guide focuses on the simplest appropriate approach for a conventional Astro deployment. See the [Platforms](/implement/platforms/) directory for alternatives.

## Use Astro’s public directory

Use this approach when:

- The website is already built with Astro.
- You control the site’s deployment.
- Astro’s public assets can be published at the **origin root** for the hostname you mean to declare.
- The hosting service can deliver the declaration as a public resource.

This normally works without changing the website’s rendering model. Do not build an Astro API endpoint when a static resource satisfies the requirement. Do not switch hosting providers merely to join Joshternet.

## Before you begin

You should have:

- An existing Astro project and access to its source files.
- A working Astro build process (typically `npm run build` or the equivalent for your package manager).
- Control over deployment to the intended website.
- A clear choice of which hostname is being declared.
- Permission to configure response headers when the host requires it for extensionless JSON.

Exact Astro versions and `astro.config` settings can change output paths. Inspect the project’s configuration before adding files. Do not create a new Astro project or install unrelated dependencies only for this recipe.

## The public path must be exact

The required public resource is:

```text
https://joshua.example/.well-known/josh
```

The path begins with `/.well-known/`, uses the filename `josh`, has no `.json` extension, has no trailing slash, and sits at the origin root. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

Distinguish the public URL from the path in your Astro source tree:

| Stage | Example |
| --- | --- |
| Astro source | `public/.well-known/josh` |
| Default static build | `dist/.well-known/josh` |
| Public resource | `https://joshua.example/.well-known/josh` |

`public` and `dist` are Astro’s default directory names. Customized projects may use other paths through `publicDir` and `outDir`.

A file at `/blog/.well-known/josh` does not replace the required root-level resource.

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

`true` and `false` are JSON Boolean values, not strings. The `version` value must be the JSON integer token `1`. Values such as `"1"`, `1.0`, and `1e0` are not valid version 1 declarations.

Never infer Josh identity from the website’s domain, author name, or published content.

{% include declaration-identity-ref.html %}

## Create the file

From the Astro project root, create:

```text
public/
└── .well-known/
    └── josh
```

The filename is exactly `josh`. Do not add a `.json` extension to the published filename. The file must contain the complete JSON declaration.

An editor may not recognize an extensionless file as JSON. Configuring language detection is optional and does not change the protocol. Do not introduce a build script merely to rename a JSON file unless your existing workflow already prefers that pattern.

## How Astro’s public directory works

Astro’s [project structure](https://docs.astro.build/en/basics/project-structure/) documents `public/` as the place for assets that do not need processing. During development those files are served at `/`. During `astro build` they are copied into the build output as-is—without bundling, layout wrapping, or conversion into HTML pages.

The declaration should therefore remain a plain file. Do not turn it into a `.astro` route, generated page, or endpoint.

Configuration options such as `publicDir` and `outDir` are documented in Astro’s [configuration reference](https://docs.astro.build/en/reference/configuration-reference/).

## Custom public and build directories

### `publicDir`

If the project already customizes the public-assets directory, place the declaration there instead of assuming `./public`.

Example (illustration only—do not change a working `publicDir` merely to publish the declaration):

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  publicDir: "./assets-public",
});
```

With that setting, the source file would be `assets-public/.well-known/josh`.

### `outDir`

The default build directory is `dist/`. A project may use another path:

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  outDir: "./build",
});
```

Verify the declaration under the configured output location—for this example, `build/.well-known/josh`. Adapter-based deployments may produce different on-disk layouts even when the public URL remains the same. Inspect your existing `astro.config` before adding files.

## Generate the public resource

Use the project’s normal build command. For a typical npm-based Astro project:

```sh
npm run build
```

That script normally invokes Astro’s build through `package.json`. With pnpm, Yarn, or another supported package manager, use the corresponding command. See Astro’s [develop and build](https://docs.astro.build/en/develop-and-build/) guidance.

Running `npm run build` **inside the reader’s Astro project** is unrelated to the Joshternet repository’s own build scripts, which perform network synchronization and other site work. Use the Astro project’s build for this recipe.

## Check the build output

After a successful build with default directories:

```sh
test -f dist/.well-known/josh
cat dist/.well-known/josh
```

The first command confirms the expected file exists. The second prints its contents for inspection. Neither verifies the live public URL or production Content-Type. A successful build does not prove the hosting provider deployed the correct artifact.

## Check the generated site locally

After building, run the project’s preview command:

```sh
npm run preview
```

Then request the declaration:

```sh
curl -i http://localhost:4321/.well-known/josh
```

Inspect the status, body, and Content-Type. Port `4321` is Astro’s common default; project configuration or CLI options may change it.

Astro’s preview server is for local verification of the last build. It is not production hosting. Preview response headers—especially Content-Type for an extensionless file—may differ from the production host. Always repeat checks against the deployed origin.

## Make sure your host serves JSON

RFC-JOSH-0002 associates the declaration with the media type `application/json`. A server SHOULD return that Content-Type.

An extensionless filename may receive a generic media type when the host maps types from file extensions. Astro’s build copies the bytes; production HTTP headers come from the hosting environment.

Keep three checks separate:

1. The body is valid declaration JSON.
2. The resource is at the exact protocol path on the intended origin.
3. The Content-Type is appropriate when the host allows it.

An unexpected Content-Type does not, by itself, make otherwise valid declaration JSON invalid under RFC-JOSH-0002. Serving the recommended type still improves interoperability.

## Cloudflare Pages hosting

For static assets on Cloudflare Pages, a `_headers` file can set response headers for a path. A narrowly scoped example:

```text
/.well-known/josh
  Content-Type: application/json; charset=utf-8
```

Place `_headers` where it is included in the deployed static output. For an ordinary Astro project, `public/_headers` is copied into the build output with other public files. Cloudflare Pages treats `_headers` as deployment configuration rather than an ordinary public document.

`_headers` rules do not automatically apply to responses generated through Pages Functions. If server-side functions handle the path, set the header in that handler instead. See [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Netlify hosting

Netlify supports response headers through a `_headers` file in the deployed output or through header rules in `netlify.toml`. Prefer one method.

A simple `_headers` example:

```text
/.well-known/josh
  Content-Type: application/json; charset=utf-8
```

Ensure the file lands in the directory Netlify publishes. With Astro, `public/_headers` is a typical source location for static builds.

If the project uses an Astro adapter with server-rendered responses, confirm whether `/.well-known/josh` is still a static asset. Netlify’s static-file header rules do not automatically apply to function-generated or proxied responses. See [Netlify headers](https://docs.netlify.com/manage/routing/headers/).

## GitHub Pages hosting

Astro can deploy a static build to GitHub Pages. Project sites often live under a repository path prefix, and Astro’s `base` option is commonly set to match. Custom domains, hidden directories, and Jekyll processing on GitHub Pages need separate attention—many Astro setups add `.nojekyll` so GitHub Pages does not strip or mishandle build output. See [Astro on GitHub Pages](https://docs.astro.build/en/guides/deploy/github/) and [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

GitHub Pages does **not** provide ordinary per-file custom Content-Type configuration. Do not expect a Cloudflare- or Netlify-style `_headers` file to work there.

If the deployed extensionless resource receives a generic MIME type, that is a host limitation. It does not authorize renaming the public path to `josh.json`, and it is not a reason to replace a working deployment workflow solely for MIME customization.

## Other hosting environments

The same static output can be published on conventional Nginx or Apache servers, object storage with a CDN, application servers, or other static hosts. Each environment may treat extensionless files, `.well-known` directories, and response headers differently.

Verify the deployed resource. Do not assume it behaves like Astro preview. Prefer path-specific header rules over global rewrites. Additional recipes live in the [Platforms](/implement/platforms/) directory.

## Static output versus on-demand rendering

Astro supports static builds and [on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/) through adapters. Keep the declaration as a public static file—not a dynamic page.

Adapters, middleware, rewrites, catch-all routes, and host-specific asset routing can still change how that file is exposed. Output layouts are not identical across adapters. Verify the actual deployed HTTP response for your adapter. Do not switch to server rendering merely to publish the declaration.

## Sites published under a base path

{% include declaration-origin-root-note.html %}

Astro’s `base` option sets a path prefix for pages and assets in development and production. Public-directory files are served under that prefix. For example, with `base: '/blog'`, a file at `public/.well-known/josh` is typically available as `/blog/.well-known/josh` in Astro’s own server and build, **not** as origin-root `/.well-known/josh`.

The protocol still requires the origin-root URL. Setting `base` does not move the canonical declaration path, and it does not grant authority to publish at the origin root from a path-prefixed-only deploy (common on GitHub Pages project sites). If you only control `/blog/` on someone else’s origin, this static-file recipe alone cannot declare for that origin unless the host also routes `/.well-known/josh` at the origin root.

## Custom domains and subdomains

Each participating origin must publish its own declaration. These are distinct origins:

- `https://joshua.example/`
- `https://www.joshua.example/`
- `https://blog.joshua.example/`

A file on one hostname does not declare participation for another. Cross-origin redirects are not a substitute for publishing a declaration on each origin you intend to declare.

Checklist:

1. Choose the public hostname people will use.
2. Confirm that hostname’s deployment includes the declaration file.
3. Verify `https://that-host/.well-known/josh` after deploy.
4. Repeat for any additional origin you mean to declare.

Do not copy identity declarations across unrelated origins automatically.

## Avoid conflicts with your website’s routing

Astro apps and hosts may already define redirects, middleware, catch-all routes, authentication layers, endpoints, static-asset handlers, or other `.well-known` resources. Those can interfere with the declaration.

Common failure modes:

| What you see | Likely issue |
| --- | --- |
| Homepage HTML at the declaration URL | Fallback or catch-all route |
| Redirect to `/.well-known/josh/` | Trailing-slash normalization |
| Redirect to another hostname | Host or CDN redirect rules |
| Authentication challenge or login | Access policy covering the path |
| Application JSON or HTML from an endpoint | Framework route won over the static file |

Inspect the live response with `curl -i` before changing unrelated routing. Prefer the narrowest fix that restores the static declaration path.

## Verify the deployment

After deploy:

```sh
curl -i https://joshua.example/.well-known/josh
```

Confirm:

1. The URL identifies the intended origin.
2. HTTP GET returns the resource.
3. The body is valid JSON.
4. `version` is the integer token `1`.
5. `josh`, when present, is a JSON Boolean.
6. The resource is publicly accessible without client-side JavaScript.
7. Content-Type is appropriate when the host allows it.
8. Redirects do not break origin semantics for the declaration.
9. The path is exactly `/.well-known/josh`.

{% include declaration-verify-ref.html %}

Public verification matters more than inspecting the source file alone.

### Protocol validation versus `JSON.parse`

Ordinary JSON parsers may accept or normalize values that RFC-JOSH-0002 rejects. Examples include a string `"1"` for `version`, fractional or exponent-form numbers that JavaScript collapses to `1`, a non-object root, duplicate member names, or an invalid `josh` value. Use the [declaration checker](/implement/validate/) for protocol-level validation. Do not treat `JSON.parse()` alone as complete conformance checking.

### Make sure you are receiving JSON, not your homepage

Some hosts return an HTML fallback with HTTP 200 when a path is missing. Inspect Content-Type, the response body, any HTML doctype, canonical URLs, and redirects. A homepage returned from `/.well-known/josh` is not a valid Joshternet declaration. A 200 status alone does not prove the static file was deployed.

### Regression checks

After publishing the declaration, spot-check representative site resources: homepage, about page, an article, CSS and JavaScript assets, `robots.txt`, `sitemap.xml`, and existing well-known resources. The declaration should not require changing the rest of the site. If a deployment-configuration change breaks another resource, treat that as a defect—prefer path-specific rules over global rewrites or headers.

## Updates and caching

Edit `public/.well-known/josh` (or the configured public directory), rebuild, and redeploy. Then re-check the public URL. Browser caches, CDN caches, and host-specific cache settings can delay visibility of changes. Prefer diagnosing the live response before broad cache purges. External consumers may not observe a change immediately.

{% capture stop_steps %}
1. Remove `public/.well-known/josh` (or the equivalent path under a custom `publicDir`).
2. Remove host header rules that exist only for that path, if any.
3. Rebuild and redeploy so the published artifact no longer includes the file.
4. Confirm ordinary site pages still work.
5. Request `https://joshua.example/.well-known/josh` again—incremental deploys or leftover host rules can leave an old file in place.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Security considerations

The declaration is intentionally public. Do not put credentials, tokens, or unrelated environment details in the file or in example configs committed to source control. Avoid authentication requirements on the declaration path. Prefer narrow header and rewrite rules so you do not expose unintended paths. The `josh` property is a public identity declaration, not confidential configuration—no secret-management system is required for the declaration itself.

## Troubleshooting

| Problem | Possible cause |
| --- | --- |
| 404 response | File not included in build or deployment |
| 200 with HTML | Hosting fallback or catch-all route |
| Wrong content type | Extensionless static-file MIME handling |
| Trailing-slash redirect | Host or routing normalization |
| File exists locally but not publicly | Incorrect deployment artifact |
| Works in Astro preview but not production | Hosting configuration difference |
| Declaration appears under `/blog/` | `base` or deployment-prefix issue |
| Wrong hostname | Custom-domain or origin mismatch |
| Invalid JSON | Incorrect file contents |
| Wrong Josh identity | Incorrect source or stale deployment |
| Unauthorized response | Authentication or access policy |
| Other assets stop working | Overbroad hosting configuration |
| Old response after deployment | Cache or incomplete rollout |

Inspect with `curl -i` and the declaration checker. Do not treat unrelated framework upgrades as the default remedy.

## Tested

- Platform: Astro 5.x (`public/` → `dist/`)
- Verified: 2026-10-06
- Evidence: recipe and Astro documentation review of public-directory copy behavior for this guide (not a live Astro+host deployment in this repository, and not a CI Astro fixture build)
- Protocol: RFC-JOSH-0002 version 1

Instructions that depend on stable public-directory copying remain valid across current Astro documentation for `publicDir`, `outDir`, build, and preview. Adapter-specific deploy layouts and host MIME behavior must still be verified per environment. Do not assume every future Astro major release without re-checking the docs for that release.

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Astro project structure](https://docs.astro.build/en/basics/project-structure/), [configuration reference](https://docs.astro.build/en/reference/configuration-reference/), [develop and build](https://docs.astro.build/en/develop-and-build/), [deploy](https://docs.astro.build/en/guides/deploy/), [on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [Netlify headers](https://docs.netlify.com/manage/routing/headers/)
- [Astro on GitHub Pages](https://docs.astro.build/en/guides/deploy/github/), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
