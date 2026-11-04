---
layout: default
title: Publish /.well-known/josh with SvelteKit
description: >-
  Publish a Joshternet /.well-known/josh declaration from an existing SvelteKit
  site via static/—covering adapter-static versus server adapters, SvelteKit 2
  and 3 configuration, host headers, and public verification.
keywords: >-
  SvelteKit, /.well-known/josh, Joshternet declaration, adapter-static, static
  directory, Content-Type
seo:
  type: TechArticle
  name: SvelteKit
permalink: /implement/platforms/sveltekit/
nav_title: SvelteKit
---

# Publish with SvelteKit

SvelteKit is a framework for building websites and applications with Svelte. It also serves ordinary static files—favicons, images, `robots.txt`, and other resources that must keep exact filenames.

A Joshternet declaration fits that model: a small JSON document at a fixed origin-level URL, independent of Svelte components and application routes. How the site is prepared for production depends on the selected adapter. Identify the deployment you already use; do not convert a working server-rendered application into a static site—or the reverse—merely to publish the declaration.

This guide is a practical procedure for existing SvelteKit sites. Other methods are possible—see the [Platforms](/implement/platforms/) directory.

## Use SvelteKit's static directory

Use this approach when:

- The website already uses SvelteKit.
- You control the source files and deployment.
- Static assets are published through that deployment.
- You control the intended **origin**.

The declaration does not need reactive components or request-time computation. An ordinary file is generally simpler to verify than a programmatic response. Do not install a new adapter solely to publish the declaration.

## Before you begin

You should have:

- An existing SvelteKit project and access to its `static/` directory.
- A functioning development or build command.
- Knowledge of the selected deployment adapter.
- Control over the public hostname and permission to configure response headers when needed.
- A way to inspect the published HTTP response.

Project structure and configuration vary between SvelteKit 2 and 3. Inspect the existing project before changing configuration. Examples use ordinary JavaScript.

## The public path must be exact

The required public resource is:

```text
https://joshua.example/.well-known/josh
```

The path begins with `/.well-known/`, uses the filename `josh`, has no `.json` extension, has no trailing slash, and sits at the origin root. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

| Stage | Example |
| --- | --- |
| SvelteKit source | `static/.well-known/josh` |
| Default adapter-static output | `build/.well-known/josh` |
| Public resource | `https://joshua.example/.well-known/josh` |

The output directory depends on the adapter and its options. The public protocol path does not change.

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

One possible layout (SvelteKit 3-style):

```text
sveltekit-site/
├── src/
│   ├── routes/
│   └── app.html
├── static/
│   └── .well-known/
│       └── josh
├── vite.config.js
└── package.json
```

A SvelteKit 2 project may also use `svelte.config.js`. Create:

```text
static/
  .well-known/
    josh
```

The file must contain ordinary JSON—no HTML, front matter, or JavaScript. Do not add `.json` to the published filename. The declaration belongs in `static/`, not in a Svelte component or page route.

## How SvelteKit serves static files

Files in `static/` are delivered without renaming. A file at `static/example.txt` is ordinarily available at `/example.txt`. See [SvelteKit project structure](https://svelte.dev/docs/kit/project-structure). The Joshternet declaration follows the same principle and does not need component rendering or a request-time JSON serializer.

## A declaration is not a SvelteKit page

Distinguish files in `static/` from pages under `src/routes/`, `+server.js` endpoints, prerendered HTML, and adapter-generated server responses. Prefer the static file when contents do not depend on the request. Do not create `src/routes/.well-known/josh/+server.js` when the static file already works. If a project already serves the declaration from a server route, do not add a competing static resource—keep one authoritative source.

## Your adapter determines how the application is deployed

Adapters transform a SvelteKit build for a deployment environment. See [Adapters](https://svelte.dev/docs/kit/adapters).

| Adapter | Intended deployment |
| --- | --- |
| `@sveltejs/adapter-static` | Statically generated websites |
| `@sveltejs/adapter-node` | Node.js servers |
| `@sveltejs/adapter-cloudflare` | Cloudflare environments |
| `@sveltejs/adapter-netlify` | Netlify |
| `@sveltejs/adapter-vercel` | Vercel |
| `@sveltejs/adapter-bun` | Bun servers |
| `@sveltejs/adapter-auto` | Supported automatic targets |

The declaration source path can stay `static/.well-known/josh` while packaging and response handling change. Do not assume every adapter produces a `build/` directory with the same layout.

## Check your SvelteKit version before changing configuration

This recipe’s historical verification used SvelteKit 2 with `@sveltejs/adapter-static`. SvelteKit 3 moved kit options into the Vite plugin. In SvelteKit 3, `svelte.config.js` is **not** supported—configuration belongs in `vite.config.js` as options to `sveltekit()`. Do not mix SK2 and SK3 syntax in one example. The static declaration file itself does not require a framework migration. See [Migrating to SvelteKit 3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3).

### SvelteKit 3 adapter-static (Vite config)

Merge into existing Vite plugins; do not overwrite unrelated settings. Official defaults:

```js
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({
        pages: "build",
        assets: "build",
        fallback: undefined,
        precompress: false,
        strict: true,
      }),
    }),
  ],
});
```

If the project already uses `adapter-static`, no adapter change is necessary for this recipe.

### SvelteKit 2 (legacy svelte.config.js)

Prior to SvelteKit 3, configuration commonly lived in `svelte.config.js` (Vite-based kit config was also available from 2.62). Illustrative SK2 shape:

```js
import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
  },
};

export default config;
```

Keep SK2 projects on the configuration model they already use.

## What adapter-static requires

`adapter-static` produces files for static hosting. Fully prerendered sites ordinarily need relevant routes to be prerenderable—for example in a root `+layout.js`:

```js
export const prerender = true;
```

Prerendering the whole site is a requirement of that static-site approach, **not** of Joshternet. Do not enable global prerendering on a server-rendered app merely to publish `static/.well-known/josh`. See [adapter-static](https://svelte.dev/docs/kit/adapter-static).

### SPA fallback is not the declaration

`adapter-static` can emit a fallback document (for example `200.html` or `404.html`) for routes that are not individually prerendered. The declaration must remain a real static JSON file. A request for `/.well-known/josh` must not return the SPA shell. HTTP 200 with HTML is not a valid Joshternet declaration.

## Build your SvelteKit application

Use the project’s existing script. For a typical npm project:

```sh
npm run build
```

That ordinarily runs Vite/SvelteKit. A direct `npx vite build` (or `vite build`) is fine when that is what the project already uses. Do not replace package scripts merely for the declaration.

## Verify adapter-static output

With default `pages`/`assets` of `build`:

```sh
test -f build/.well-known/josh
cat build/.well-known/josh
```

The generated site should contain:

```text
build/
  .well-known/
    josh
```

Customized `pages` or `assets` options change the local path—inspect the actual adapter options. The public URL remains `https://joshua.example/.well-known/josh`. File existence does not prove host packaging or Content-Type.

## Check the built website locally

```sh
npm run preview
```

Then:

```sh
curl -i http://localhost:4173/.well-known/josh
```

Port `4173` is Vite’s common preview default and may differ. Preview Content-Type and caching may not match Netlify, Cloudflare, Vercel, or a custom server. Always recheck the deployed origin. `vite preview` does not set `Content-Type: application/json` for the extensionless file.

## Static generation is not the only SvelteKit deployment

A server adapter may produce executable application output rather than only publishable static files. Production may include server code, static assets, prerendered pages, and hosting-specific routing. Identify which component handles `/.well-known/josh`. Do not assume dropping a file into a directory named `build/` is sufficient for every adapter.

## SvelteKit on a Node.js server

`@sveltejs/adapter-node` generates a Node.js server. In SvelteKit 3, static assets are registered during the build. Files added to the server output afterward are not automatically served; replaced files can keep stale size/ETag metadata. Keep the declaration in `static/` and rebuild. Only GET and HEAD are served for those assets; other methods may receive 405. See [adapter-node](https://svelte.dev/docs/kit/adapter-node) and the [SvelteKit 3 migration notes](https://svelte.dev/docs/kit/migrating-to-sveltekit-3).

## Which component controls the Content-Type?

Headers come from whichever layer serves the file: Vite, the Node adapter, Cloudflare/Netlify/Vercel static delivery, Nginx, or a CDN. The same bytes may receive different media types in different environments. Do not assume an application-level header setting controls responses already served by the host’s static-asset layer.

RFC-JOSH-0002 associates the declaration with `application/json`. A server SHOULD return:

```text
Content-Type: application/json
```

An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON. Do not rename the public resource to `josh.json`. In the static-adapter case, production media type is chosen by the host, not by SvelteKit.

## Publishing SvelteKit on Netlify

Distinguish `adapter-static` static output from `@sveltejs/adapter-netlify` packages that mix static assets and server responses. For a static declaration, add a narrow rule in `netlify.toml` (or use `_headers`):

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

Static-file header rules do not automatically apply to every function-generated response. Do not create a Netlify Function solely for the declaration. See [Netlify headers](https://docs.netlify.com/manage/routing/headers/) and [adapter-netlify](https://svelte.dev/docs/kit/adapter-netlify).

## Cloudflare Pages hosting

For static asset deployments, use `_headers` in the deployed static output (often from `static/_headers` when the adapter preserves it):

```text
/.well-known/josh
  Content-Type: application/json
```

`_headers` applies to static asset responses, not automatically to Pages Functions. Verify the live response. See [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

SvelteKit’s Cloudflare adapter can change packaging and serving. Follow that adapter’s docs for the deployment you use—do not assume every Cloudflare SvelteKit setup shares one output layout. Do not add an extra Worker when the existing adapter already serves the declaration. See [adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare).

## Vercel hosting

Vercel may serve static resources separately from serverless responses. Prefer `static/.well-known/josh`. Use one supported header method when MIME control is needed. Do not add a second endpoint without demonstrated need. Verify the custom domain, not only a preview hostname. See [adapter-vercel](https://svelte.dev/docs/kit/adapter-vercel).

## Publishing SvelteKit on GitHub Pages

GitHub Pages hosts static files and does not run a persistent SvelteKit Node server. Use a compatible `adapter-static` setup with appropriate prerendering. Account for `.nojekyll` on prebuilt output, custom domains, project-site path prefixes, and packaging that might drop `.well-known`.

GitHub Pages does not provide ordinary per-path custom MIME-type configuration. Do not invent a new Actions artifact pipeline. If existing packaging uses hidden-file filters, verify `.well-known` is included after reviewing the tree for private files.

## Avoid accidental hidden-file exposure

Because `.well-known` begins with a period, some tools exclude it—but enabling indiscriminate hidden-file publication can expose `.env` files, credentials, caches, or repository metadata. Deploy only public resources. Do not publish the entire SvelteKit project tree as the website root.

## The application base path does not move the declaration

{% include declaration-origin-root-note.html %}

For a site at `https://joshua.example/blog/`, the declaration belongs at `https://joshua.example/.well-known/josh`, not at `https://joshua.example/blog/.well-known/josh`.

SvelteKit `paths.base` controls where the application is mounted. It does not redefine the protocol’s origin-level path. Do not change `paths.base` merely to publish the declaration. SvelteKit `paths.base` does not move the well-known URI.

### paths.base versus paths.assets

`paths.assets` can point static application assets at a CDN or alternate prefix. The declaration must still be available at the participating origin’s canonical `/.well-known/josh`. An asset-only URL on a different hostname does not establish participation for the application origin. See [configuration](https://svelte.dev/docs/kit/configuration).

## Distinct origins and trailingSlash

These are distinct origins:

- `https://joshua.example/`
- `https://www.joshua.example/`
- `https://blog.joshua.example/`

Each needs its own declaration. Preview hostnames do not establish production participation. Cross-origin redirects do not declare for the original origin.

SvelteKit’s `trailingSlash` option mainly affects page URLs and prerendered HTML layout. The declaration’s canonical path remains `/.well-known/josh` with no trailing slash. Do not change global trailing-slash policy merely for this resource—still verify the live response, because hosts may normalize URLs independently.

## Keep the declaration public without weakening the application

Hooks, authentication, redirects, hosting rewrites, and `+server.js` routes can intercept requests. The declaration must remain publicly retrievable. Fix path-specific conflicts; do not disable authentication for unrelated routes. Server hooks do not necessarily run for every static asset request in every deployment mode.

## Verify the public declaration

```sh
curl -i https://joshua.example/.well-known/josh
```

Inspect origin, status, redirects, final URL, Content-Type, JSON body, integer `version` `1`, optional Boolean `josh`, public access, and exact path.

{% include declaration-verify-ref.html %}

Ordinary `JSON.parse()` may normalize `1.0` to `1` while the protocol requires the integer token. Use the [declaration checker](/implement/validate/). A correct local `static/` file or `build/` artifact is not sufficient proof of a valid public declaration.

### A 200 response can still be the wrong resource

SPA fallbacks, homepage rewrites, login pages, or custom errors may return HTTP 200 with HTML. That is not a valid declaration. Inspect Content-Type and body.

### Regression checks

After publishing—especially after adapter, header, or auth changes—spot-check the homepage, ordinary routes, CSS/JS, images, APIs, authentication, `robots.txt`, sitemap, and other well-known resources.

## Updates and caching

1. Edit `static/.well-known/josh`.
2. Validate the JSON.
3. Run the normal build.
4. Verify the generated resource.
5. Deploy.
6. Check the public response.
7. Account for caching.

For SvelteKit 3 Node deployments, rebuild from source rather than overwriting registered output assets in place. Keep the URL stable—no fingerprinted protocol paths or immutable caching without invalidation.

{% capture stop_steps %}
1. Remove `static/.well-known/josh` from the project source.
2. Remove host header rules that exist only for that path, if any.
3. Rebuild so the deployable output (and Node asset registration, when applicable) no longer includes the file.
4. Redeploy so packaging no longer serves it; check CDN, proxy, or alternate `+server.js` handlers.
5. Confirm ordinary application routes still work, then request `https://joshua.example/.well-known/josh` and verify the live response.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Security considerations

Deploy only the intended adapter output. Review packaging before enabling broad hidden-file inclusion. Publishing the declaration does not require exposing private project files.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Source exists, build output missing | Adapter or custom `pages`/`assets` path |
| `build/` missing | Different adapter or output directory |
| `adapter-static` build fails | Prerendering or fallback configuration |
| Works locally, fails publicly | Packaging or hosting |
| HTTP 200 returns HTML | SPA fallback or rewrite |
| Wrong Content-Type | Host MIME mapping |
| `_headers` does not apply | Function-generated response |
| File under `/blog/` | `paths.base` confused with origin root |
| Different result on `www` | Separate origin or redirect |
| Login page returned | Auth or hosting interception |
| Post-build file missing on Node | Build-time asset registration |
| Updated file keeps old metadata | Output replaced without rebuild |
| Old identity remains | Cache or stale deployment |
| Conflict with endpoint | Multiple handlers for the same path |
| GitHub Pages omits `.well-known` | Hidden-file packaging |
| Invalid JSON | Syntax or protocol-value error |
| Source deleted, endpoint persists | Old deploy or alternate handler |

Inspect source, build, packaging, and live `curl` before upgrading SvelteKit or changing hosts without evidence.

## Tested

- Platform: SvelteKit 2 + `@sveltejs/adapter-static` (`static/` → `build/`)
- Verified: 2026-10-06
- Evidence: recipe and SvelteKit documentation review of static-directory serving and adapter-static output, including consultation of current SvelteKit 3 docs for Vite-based configuration and Node build-time asset registration—not a live SvelteKit+host deployment in this repository, and not a claim that SvelteKit 3 was live-tested. Host MIME and packaging behavior must still be verified per environment.
- Protocol: RFC-JOSH-0002 version 1

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Project structure](https://svelte.dev/docs/kit/project-structure), [adapters](https://svelte.dev/docs/kit/adapters), [adapter-static](https://svelte.dev/docs/kit/adapter-static), [adapter-node](https://svelte.dev/docs/kit/adapter-node), [adapter-cloudflare](https://svelte.dev/docs/kit/adapter-cloudflare), [adapter-netlify](https://svelte.dev/docs/kit/adapter-netlify), [adapter-vercel](https://svelte.dev/docs/kit/adapter-vercel)
- [Page options](https://svelte.dev/docs/kit/page-options), [Migrating to SvelteKit 3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3), [configuration](https://svelte.dev/docs/kit/configuration)
- [Netlify headers](https://docs.netlify.com/manage/routing/headers/), [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [GitHub Pages publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
