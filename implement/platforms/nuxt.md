---
layout: default
title: Publish /.well-known/josh with Nuxt
description: >-
  Publish a Joshternet /.well-known/josh declaration from an existing Nuxt site
  via public/—covering Nitro, static generate versus server builds, response
  headers, hosting, and public verification.
keywords: >-
  Nuxt 4, /.well-known/josh, Joshternet declaration, public directory, nuxt
  generate, Nitro, Content-Type
seo:
  type: TechArticle
  name: Nuxt
permalink: /implement/platforms/nuxt/
nav_title: Nuxt
---

# Publish with Nuxt

Nuxt is a framework for building websites and applications with Vue. It can produce statically generated sites or run through a server environment powered by Nitro. Both approaches can expose ordinary public files without rendering them as Vue components.

A Joshternet declaration is a small JSON resource at a fixed URL. Nuxt’s `public/` directory is a suitable place for that file. The hosting environment ultimately determines how the HTTP response—especially Content-Type for an extensionless path—is delivered.

This guide is a practical procedure for existing Nuxt publishers. Other methods are possible—see the [Platforms](/implement/platforms/) directory. Do not switch from a working server deployment to static generation—or the reverse—merely to publish the declaration.

## Use Nuxt's public directory

Use this approach when:

- The website already uses Nuxt.
- You control the project’s source files and build.
- Public static assets can be served at the **origin root**.
- You can verify the deployed HTTP response.

A public file is normally simpler than creating a Nitro server endpoint, API route, or database-backed handler. Do not require a hosting migration or extra infrastructure when the static file already works.

## Before you begin

You should have:

- An existing Nuxt project and access to its `public/` directory.
- A working Nuxt build and knowledge of the deployment mode (generate vs Nitro server).
- Control over the intended public hostname.
- Permission to configure HTTP headers when required.
- A way to inspect the deployed resource.

Nuxt projects may use different package managers and configuration formats. Preserve the existing project configuration. Examples below use ordinary JavaScript where practical.

## The public path must be exact

The required public resource is:

```text
https://joshua.example/.well-known/josh
```

The path begins with `/.well-known/`, uses the filename `josh`, has no `.json` extension, has no trailing slash, and sits at the origin root. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

| Stage | Example |
| --- | --- |
| Nuxt source | `public/.well-known/josh` |
| Generated static assets | `.output/public/.well-known/josh` |
| Public resource | `https://joshua.example/.well-known/josh` |

Physical layout can differ across Nitro presets and hosts. The required public URL does not change. This guide follows Nuxt 4 conventions (`public/` and `.output/public/`), not Nuxt 2’s historical `static/` and `dist/` layout.

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

Omission and `false` have different meanings. The `josh` property must be a JSON Boolean when present. The `version` value must be the JSON integer token `1`. Values such as `"1"`, `1.0`, and `1e0` are not valid version 1 declarations. Never infer Josh identity from the domain, site title, or page content.

{% include declaration-identity-ref.html %}

## Create the static file

One possible Nuxt 4 layout:

```text
nuxt-site/
├── app/
├── public/
│   └── .well-known/
│       └── josh
├── nuxt.config.js
└── package.json
```

Vue source may live under other trees; `public/` remains the separate static-asset location. Create:

```text
public/
  .well-known/
    josh
```

The file must contain ordinary JSON—no HTML, Vue components, Markdown, YAML front matter, JavaScript, or JSON comments. Do not rename the public file to `josh.json`.

## How Nuxt serves public assets

Nuxt uses a public asset directory for resources served directly without bundling them as application modules—favicons, `robots.txt`, static images, and similar files. A file at `public/example.txt` is ordinarily available at `/example.txt`. The Joshternet declaration follows the same relationship. Distinguish these assets from files imported into Vue components or processed through the bundler.

## What Nitro does with public files

[Nitro](https://nitro.build/docs/assets) is the server engine Nuxt uses. It supports public asset directories, copying assets into production output, runtime serving, static hosting output, deployment presets, response headers, and caching.

Nitro can copy public assets into `.output/public/` while also generating server output for applicable modes. The existence of `.output/public/` does **not** mean the site was deployed as a completely static website. Server builds can include that directory as well. Always identify the deployment mode you actually use.

## Static generation and server builds are different

| Mode | Command | Typical result |
| --- | --- | --- |
| Development | `nuxt dev` | Development server |
| Production build | `nuxt build` | Nitro application output |
| Static generation | `nuxt generate` | Prerendered assets for static hosting |
| Production preview | `nuxt preview` | Local preview of production output |

These commands are not interchangeable. A generate workflow does not require a production application server. A server-rendered deployment may execute handlers at runtime. Use the scripts already defined in the project’s `package.json` (illustrative names: `dev`, `build`, `generate`, `preview`) with the package manager you already use.

## Check the declaration locally

```sh
npm run dev
```

Then:

```sh
curl -i http://localhost:3000/.well-known/josh
```

Port `3000` is a common default and may be customized. Inspect status, body, Content-Type, exact path, and authentication. Development MIME types may differ from production. Do not treat a local response as proof of the deployed origin.

## Publishing a static Nuxt website

Nuxt supports prerendering through `nuxt generate` (similar to `nuxt build` with Nitro static/prerender options). See [Nuxt prerendering](https://nuxt.com/docs/4.x/getting-started/prerendering) and the [`generate` command](https://nuxt.com/docs/4.x/api/commands/generate).

```sh
npx nuxt generate
```

Or, when the project defines a matching script:

```sh
npm run generate
```

Nuxt’s current documentation identifies `.output/public` as the directory to deploy to static hosting. Do not confuse that with Nuxt 2’s historical `dist/` output.

## Verify the generated files

```sh
test -f .output/public/.well-known/josh
cat .output/public/.well-known/josh
```

The generated site should contain:

```text
.output/public/
  .well-known/
    josh
```

The first command confirms the path exists. The second shows contents. Neither proves HTTP headers, public accessibility, or successful deployment. Hosts do not automatically publish every generated file.

## The declaration does not need to be prerendered

Nitro prerendering generates responses for application routes. Ordinary public assets are a different mechanism. Keep the declaration as a copied static file. Do not add it to a prerender route list, Vue page, server API endpoint, or custom rendering pipeline when `public/.well-known/josh` already provides the resource.

## Publishing with a running Nitro server

`nuxt build` creates production output for the configured Nitro deployment preset. In a standard Node.js deployment, that often includes a server entry such as `.output/server/index.mjs`, with public assets under `.output/public/`. The production server and any reverse proxy determine how requests reach those assets.

When the Node preset applies and your project uses that entry point:

```sh
node .output/server/index.mjs
```

Prefer the project’s normal preview or start command when it differs. Then:

```sh
curl -i http://localhost:3000/.well-known/josh
```

A CDN or reverse proxy may still change the public response. Local success does not prove the external hostname is configured correctly.

## Nitro deployment presets

Nitro can target Node.js servers, static hosting, Cloudflare, Netlify, Vercel, and other environments. Presets affect generated output, asset serving, routing, headers, and packaging. Identify the preset your project actually uses. Do not assume identical output paths or runtime behavior across every preset. Keep the main recipe centered on `public/.well-known/josh`.

## What if your project customizes public assets?

Nitro’s `publicAssets` configuration can register additional directories, URL prefixes, caching (`maxAge`), fallthrough, and ignore patterns. A custom layout may differ from the default `public/` example. Ensure the declaration is still exposed at origin-root `/.well-known/josh`. Do not modify `publicAssets` when the default public directory already works. See [Nitro public assets](https://nitro.build/docs/assets).

### `noPublicDir`

Nitro’s `noPublicDir` option, when enabled, disables `.output/public` creation, skips copying `public/`, and disables prerendering. That can prevent the declaration from appearing in the expected output. Inspect existing Nitro/Nuxt configuration for this setting. If it is intentional, determine how the deployment currently serves public assets before changing it—do not disable it blindly.

## Keep one authoritative declaration resource

Competing sources for the same path—`public/.well-known/josh`, a Nitro server route, an API endpoint, a reverse proxy, a CDN rule, a hosting rewrite, or a stale deploy—make responses inconsistent. Prefer one authoritative source. Do not add a Nitro route handler when the public asset already works. If infrastructure already serves a valid declaration, a duplicate Nuxt file may be unnecessary.

## The public response should identify JSON

RFC-JOSH-0002 associates the declaration with `application/json`. A server SHOULD return:

```text
Content-Type: application/json
```

The final response may come from Nitro, a reverse proxy, a CDN, or a static host. An extensionless file may receive a generic MIME type. Keep JSON syntax, protocol validity, URL, status, and Content-Type as separate checks. An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002. Nuxt does not choose `application/json` for an extensionless file in the static generate case—the host does.

## Using route rules in server deployments

Nitro `routeRules` can set headers for matching paths. Illustrative Nuxt configuration:

```js
export default defineNuxtConfig({
  routeRules: {
    "/.well-known/josh": {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  },
});
```

This is an example to evaluate, not a guarantee in every preset. Verify that the public asset request actually receives the header. If a CDN or static host serves the file directly, runtime route rules may not control the response. See [Nitro routing](https://nitro.build/docs/routing).

## Why runtime headers may not apply

Route rules in `nuxt.config` may appear to work in a local Nitro preview while a static host delivers `.output/public/.well-known/josh` without running Nitro. In that arrangement the hosting platform owns response headers. Verify the public response independently after every deployment transformation.

## Publishing Nuxt on Netlify

### Static generation

Netlify serves the generated static output. Use `netlify.toml` or `_headers` for the declaration. Prefer one method:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

### Server-rendered Nuxt

Netlify’s Nuxt integration may use serverless or edge execution. Static-file header rules do not automatically apply to every function-generated response. Verify which layer serves the declaration. Do not add a new function when the public static asset works. See [Netlify headers](https://docs.netlify.com/manage/routing/headers/).

## Cloudflare Pages hosting

For static generation, Cloudflare Pages `_headers` can set the media type:

```text
/.well-known/josh
  Content-Type: application/json
```

Place `_headers` so it lands in deployment output—often `public/_headers`, which Nitro may copy into `.output/public`. Verify the generated tree. `_headers` rules do not automatically affect Pages Functions. Do not create a Worker when static hosting already works. See [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

Some Nuxt deployments use a Worker or adapter runtime rather than ordinary Pages static hosting. Static asset responses, Nitro-generated responses, and Worker responses can differ for header control. Follow the adapter or preset documentation you actually use.

## Vercel hosting

Nuxt on Vercel may combine static assets and server-generated routes. Prefer the simplest public-resource path: `public/.well-known/josh`. Use one supported header method when MIME control is needed. Do not introduce a second endpoint merely for Content-Type. Verify the custom domain, not only a preview hostname.

## Nuxt behind your own server or reverse proxy

A common arrangement:

```text
Public HTTPS request
        |
        v
   Nginx or proxy
        |
        v
    Nitro server
```

The proxy might serve files from `.output/public` directly or forward to Nitro. Identify which component returns the declaration. Apply path-specific Content-Type rules only when needed. Do not replace a working reverse-proxy architecture.

## GitHub Pages static hosting

GitHub Pages cannot run a persistent Nitro application server. Use static generation and publish `.output/public`. Account for `.nojekyll` where appropriate, custom domains, project path prefixes, and packaging that might drop dot-prefixed directories.

GitHub Pages does not provide ordinary per-path custom MIME-type configuration. Do not invent a new Actions artifact pipeline. Verify that the existing process preserves `.well-known`.

## Your application base path does not change the declaration URL

{% include declaration-origin-root-note.html %}

For an application at `https://joshua.example/blog/`, the declaration belongs at `https://joshua.example/.well-known/josh`, not at `https://joshua.example/blog/.well-known/josh`.

Nuxt’s `app.baseURL` changes how application URLs are generated and served. It does **not** relocate the protocol-defined declaration path and does not grant a path-prefixed-only deploy authority over the origin root. Do not change `app.baseURL` merely to publish the declaration.

## Distinct origins and redirects

These are distinct origins:

- `https://joshua.example/`
- `https://www.joshua.example/`
- `https://blog.joshua.example/`

Each needs its own declaration for independent participation. Preview hostnames do not establish production participation. Same-origin redirects differ from cross-origin redirects; a cross-origin redirect must not be treated as a declaration for the requested origin. The canonical path has no trailing slash.

## Make the declaration public without weakening the application

Nuxt apps may use server middleware, route middleware, authentication, and hosting access controls. The declaration must remain publicly retrievable. Exempt only the necessary path when a default deny policy would intercept it. Preserve protections for admin routes, private APIs, and accounts. Do not disable authentication globally.

Route rules help with routing and response behavior. They are not a substitute for authentication on protected resources. Do not weaken unrelated access controls to publish one JSON file.

## Verify the public declaration

```sh
curl -i https://joshua.example/.well-known/josh
```

Inspect origin, status, redirects, final URL, Content-Type, JSON body, integer `version` `1`, optional Boolean `josh`, public access, and exact path.

{% include declaration-verify-ref.html %}

Ordinary `JSON.parse()` may normalize `1.0` to `1` while the protocol requires the integer token. Use the [declaration checker](/implement/validate/). A file in `.output/public` is useful evidence, not sufficient proof of a valid deployed declaration.

### A successful status can still contain the wrong resource

Static Nuxt builds may emit SPA fallbacks such as `200.html` and `404.html`. Hosts may return those HTML pages for unknown paths. HTTP 200 with HTML is not a valid Joshternet declaration. Inspect Content-Type and body, and confirm the extensionless file is actually deployed.

### Regression checks

After publishing—especially after changing route rules, middleware, or rewrites—spot-check the homepage, a regular page, static assets, APIs, authentication, `robots.txt`, sitemap, other well-known resources, and client-side navigation.

## Updates and caching

1. Edit `public/.well-known/josh`.
2. Validate the JSON.
3. Run the normal build or generate.
4. Inspect the generated resource.
5. Deploy.
6. Verify the public response.
7. Account for Nitro, CDN, and browser caches.

Keep the URL stable. Do not fingerprint the filename or apply immutable long-term caching without an invalidation strategy.

{% capture stop_steps %}
1. Remove `public/.well-known/josh` from the Nuxt source.
2. Remove host or `routeRules` header rules that exist only for that path, if any.
3. Regenerate or rebuild so `.output/public/.well-known/josh` is gone.
4. Redeploy so packaging no longer includes the file; check CDN, proxy, or Nitro route copies.
5. Confirm ordinary application routes still work, then request `https://joshua.example/.well-known/josh` and verify the live response.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Security considerations

Deploy only the intended `.output` artifact—not private source trees or secrets. Review packaging before enabling broad hidden-file inclusion. Publishing the declaration does not require exposing every project file.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Source exists, output missing | Custom `publicAssets` or `noPublicDir` |
| `.output/public` missing | Different build mode or `noPublicDir` |
| Wrong generated path | Public asset `baseURL` configuration |
| Generate works, public URL fails | Hosting or packaging |
| Dev works, production fails | Different runtime or serving layer |
| HTTP 200 returns HTML | SPA fallback (`200.html`/`404.html`) or rewrite |
| Wrong Content-Type | Nitro or host MIME mapping |
| Route-rule headers local only | CDN or static host serves the asset |
| File under `/blog/` | `app.baseURL` confused with origin root |
| Wrong hostname | Custom domain or redirect mismatch |
| Authentication blocks declaration | Middleware or access-control interception |
| Conflict with server route | Duplicate resource handlers |
| GitHub Pages omits `.well-known` | Deployment packaging |
| Old identity remains | Cache or stale output |
| Source removed, endpoint remains | Previous deploy or alternate handler |
| Other routes break | Overbroad middleware or route-rule change |
| Invalid declaration | JSON syntax or protocol-value error |

Inspect source, output, packaging, and live `curl` before upgrading Nuxt or changing hosts without evidence.

## Tested

- Platform: Nuxt 4.x (`public/` → `.output/public/` via `nuxt generate`)
- Verified: 2026-10-06
- Evidence: recipe and Nuxt/Nitro documentation review of public assets, generate output under `.output/public`, routeRules header limitations on static hosts, and related configuration—not a live Nuxt+host deployment in this repository, and not a claim that every Nitro preset or host MIME type was live-tested. Host packaging behavior must still be verified per environment.
- Protocol: RFC-JOSH-0002 version 1

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Nuxt deployment](https://nuxt.com/docs/4.x/getting-started/deployment), [prerendering](https://nuxt.com/docs/4.x/getting-started/prerendering), [generate](https://nuxt.com/docs/4.x/api/commands/generate), [nuxt.config](https://nuxt.com/docs/4.x/api/nuxt-config), [providers](https://nuxt.com/deploy)
- [Nitro public assets](https://nitro.build/docs/assets), [asset config](https://nitro.build/config), [routing / route rules](https://nitro.build/docs/routing), [prerendering](https://nitro.build/docs/prerendering)
- [Netlify headers](https://docs.netlify.com/manage/routing/headers/), [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
