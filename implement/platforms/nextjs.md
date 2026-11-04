---
layout: default
title: Publish /.well-known/josh with Next.js
description: >-
  Publish a Joshternet /.well-known/josh declaration from an existing Next.js
  site via public/—covering App and Pages routers, server vs static export,
  response headers, hosting, and public verification.
keywords: >-
  Next.js, /.well-known/josh, Joshternet declaration, public directory, static
  export, Content-Type
seo:
  type: TechArticle
  name: Next.js
permalink: /implement/platforms/nextjs/
nav_title: Next.js
---

# Publish with Next.js

Next.js can serve ordinary files from a project’s `public/` directory alongside application routes. A Joshternet declaration is a small JSON document at a fixed URL rather than a React page that needs rendering.

The declaration can live as a normal static file and be served independently of the component hierarchy. Next.js supports more than one deployment model—development server, production application server, and static export—so the way the public resource is built, hosted, and delivered can differ. Identify the deployment you already use and verify that path; do not change the website’s architecture merely to publish the declaration.

This guide is a practical procedure for existing Next.js sites. Other methods are possible—see the [Platforms](/implement/platforms/) directory.

## Use the public directory

Use this approach when:

- You already use Next.js (App Router or Pages Router).
- The declaration can live in the site’s source repository under `public/`.
- The host can publish an extensionless file at the **origin root**.
- You control the intended origin.

An ordinary static file is sufficient. Do not add a Route Handler, API endpoint, middleware, Proxy, or database when that file already meets the requirement.

## How is your Next.js site deployed?

| Deployment | Recommended approach |
| --- | --- |
| Development server | Serve from `public/` and verify locally |
| Production Next.js server | Serve from `public/`; configure `headers()` when needed |
| Static export | Copy from `public/` into `out/`; configure the static host |
| Vercel | Public file plus one supported header method |
| Netlify | Existing Next.js integration or static host rules |
| Cloudflare | Verify the deployed asset route and host headers |
| Self-hosted application | Verify Next.js and any reverse proxy |
| GitHub Pages | Static export; preserve the extensionless file |

You need only one implementation path. Do not switch from a working server deployment to static export—or the reverse—merely to join Joshternet.

## Before you begin

You should have:

- An existing Next.js application and access to its source files.
- A functioning build or deployment process.
- Control over the public hostname.
- Permission to configure response headers where applicable.
- A way to test the deployed HTTP response.

The static-file method works independently of App Router versus Pages Router. Use the project’s existing package manager and scripts. Do not create a new Next.js application for this recipe.

## The public path must be exact

The required public resource is:

```text
https://joshua.example/.well-known/josh
```

The path starts with `/.well-known/`, uses `josh` as the resource name, has no `.json` extension, has no trailing slash, and sits at the origin root. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

| Stage | Example |
| --- | --- |
| Next.js source | `public/.well-known/josh` |
| Static export | `out/.well-known/josh` |
| Public resource | `https://joshua.example/.well-known/josh` |

Server deployments serve `public/` at request time; they do not necessarily materialize a copy under `.next/.well-known/josh`. Do not treat inspecting `.next/` as the standard verification procedure for the declaration.

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

Omission and `false` have different meanings. The `josh` property must be a JSON Boolean when present. The `version` value must be the JSON integer token `1`. Values such as `"1"`, `1.0`, and `1e0` are not valid version 1 declarations. Never infer Josh identity from the domain, site title, or application content.

{% include declaration-identity-ref.html %}

## Create the static file

One possible layout:

```text
nextjs-site/
├── app/
├── public/
│   └── .well-known/
│       └── josh
├── package.json
└── next.config.mjs
```

The configuration filename may be `next.config.js`, `next.config.mjs`, or `next.config.ts`. A Pages Router project may use `pages/` instead of `app/`. When the project uses a `src/` directory for application code, the normal `public/` directory remains at the project root.

Create:

```text
public/
  .well-known/
    josh
```

The published filename is exactly `josh`. The file contains ordinary JSON—no HTML, front matter, or JavaScript. Do not add `.json` to the public filename.

## How Next.js serves files from public/

Next.js makes files in `public/` available at corresponding URL paths. A file at `public/example.txt` is ordinarily available at `/example.txt`. See the [App Router public folder](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder) and [Pages Router public folder](https://nextjs.org/docs/pages/api-reference/file-conventions/public-folder) documentation.

The Joshternet declaration follows the same model: filename and path shape are preserved, no React rendering is required, and the resource is reachable by a direct HTTP request in development, on a production Next.js server, and—when configured—in a static export under `out/`.

## You don't need to care which router your site uses

Next.js supports the App Router (`app/`) and the Pages Router (`pages/`). Application routes live in those trees. Ordinary static files live in `public/`.

Do not create an App Router page, Route Handler, or Pages Router API route merely to serve the declaration. The same `public/.well-known/josh` source works for both routers.

## Do not define the same URL twice

Next.js does not support conflicting public files and page resources that resolve to the same URL. Before adding the file, inspect the application for:

- An App Router Route Handler for the same path
- A Pages Router page or API route mapping to the path
- A custom server route
- A hosting rewrite pointing elsewhere

Prefer one authoritative response source. Do not add both a static file and a Route Handler for `/.well-known/josh`.

## A Route Handler is usually unnecessary

A Route Handler is useful when the application must generate an HTTP response programmatically. The version 1 declaration does not normally require dynamic generation. A static file keeps deployment simple, avoids request-time computation, stays easy to review in source control, and produces stable contents.

A Route Handler remains a possible alternative in specialized deployments. It is not the recommended default, and this guide does not provide a second full implementation.

## Build and run your existing application

Most projects define scripts in `package.json`. Typical commands include:

```sh
npm run dev
npm run build
npm run start
```

Those scripts usually invoke `next dev`, `next build`, and `next start`. Use the package manager and script names the project already uses (npm, pnpm, Yarn, or another). Do not replace `package.json` with a generic example.

## Test the development server

```sh
npm run dev
```

Then:

```sh
curl -i http://localhost:3000/.well-known/josh
```

Port `3000` is the common default and may differ. Confirm the body is the intended JSON. Development mode may return a generic Content-Type for an extensionless file—`next dev` may serve it as `application/octet-stream`. Local behavior is not evidence of production hosting. Always recheck the deployed origin.

## Verify the production server separately

For a deployment that runs a Next.js application server:

```sh
npm run build
npm run start
```

These commands apply to server deployments, not to an already generated static export alone. Request the declaration through the local production server and inspect status, headers, body, routing, and redirects. A reverse proxy, CDN, or managed host may still change the final public response.

## Publishing a static Next.js site

Next.js supports static exports through `output: 'export'` in configuration. Integrate the setting into existing config rather than replacing unrelated options. Example for `next.config.mjs`:

```js
const nextConfig = {
  output: "export",
};

export default nextConfig;
```

A CommonJS `next.config.js` uses equivalent `module.exports` syntax. The standalone `next export` command was removed in Next.js 14 in favor of `output: "export"`. Do not use the obsolete command.

After `next build` with static export enabled, a typical output directory is `out/`.

## Verify the static export

```sh
test -f out/.well-known/josh
cat out/.well-known/josh
```

The generated site should contain:

```text
out/
  .well-known/
    josh
```

The exported file should remain extensionless. Distinguish `out/` from the `.next/` build directory. An application configured only for server deployment will not produce `out/` unless static export is enabled.

## Static export and response headers

Next.js documents custom `headers()` configuration as **unsupported** for static export, along with rewrites, redirects, and Proxy. A static export produces files, not a Next.js application server that can apply runtime response-header rules.

Therefore a static host must supply the appropriate HTTP media type for the extensionless `josh` resource. Do not add `headers()` to `next.config` and claim it sets Content-Type on a static export. Use the hosting instructions below.

## Serve the declaration as JSON

RFC-JOSH-0002 associates the declaration with `application/json`. A server SHOULD return:

```text
Content-Type: application/json
```

An extensionless file may receive a generic MIME type when the server maps types from filename extensions. Keep four checks separate: valid JSON, exact URL, HTTP status, and recommended media type. An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002.

## Next.js server header configuration

For server deployments that support `next.config` response headers, merge a path-specific rule into existing configuration:

```js
const nextConfig = {
  async headers() {
    return [
      {
        source: "/.well-known/josh",
        headers: [
          {
            key: "Content-Type",
            value: "application/json; charset=utf-8",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

Do not replace existing security headers, redirects, or rewrites. Headers are evaluated before matching the filesystem, including `public/` files—verify the live response anyway. A proxy or CDN may still alter headers. For applications using `basePath`, inspect Next.js’s documented automatic path-prefix handling before relying on a root-level rule alone.

## Publishing on Vercel

Vercel supports Next.js deployments and configurable response headers through `next.config` and, when needed, [project configuration](https://vercel.com/docs/project-configuration/vercel-json) such as `vercel.json`. Prefer one method compatible with the deployment instead of redundant header rules in several places.

Verify the public declaration on the actual custom domain. A successful deploy on a `vercel.app` preview hostname does not establish participation for a different production origin.

## Netlify deployment

Distinguish a Next.js application deployment from a plain static export of `out/`.

For static hosting, a narrowly scoped `_headers` example:

```text
/.well-known/josh
  Content-Type: application/json
```

The file must appear in the deployed static output (for example from `public/_headers` when that directory is published). Static-file header rules do not automatically apply to responses generated through Netlify’s Next.js runtime or functions. When the app uses server-rendered routes, verify the supported integration and the actual response. See [Netlify headers](https://docs.netlify.com/manage/routing/headers/).

## Cloudflare hosting

Whether the deployment serves a static export or uses server-side execution changes the correct header method.

For a static export, use Cloudflare Pages `_headers`:

```text
/.well-known/josh
  Content-Type: application/json
```

The configuration file must appear in the published output. Cloudflare Pages `_headers` rules do not automatically apply to Pages Functions. For adapter-based or server-rendered deployments, follow the supported adapter and verify the resulting response. Do not assume every Next.js mode on Cloudflare behaves identically. See [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Next.js behind your own web server

Distinguish running `next start`, deploying a standalone server build, serving a static export, and placing Nginx or another reverse proxy in front. For a normal application server, Next.js may serve the public file. For a static export, the web server serves the generated resource. A reverse proxy may intercept or rewrite the request. Verify that the public URL reaches the intended handler. Do not add a reverse proxy when the existing deployment already works.

## Standalone output deployments

`output: "standalone"` packages a minimal Node server and is **not** the same as `output: "export"`. The standalone artifact does not automatically include all public assets; Next.js documents copying `public/` (and `.next/static`) into the standalone folder when the minimal server should serve them. Inspect your packaging process and confirm the deployed application contains or otherwise serves `public/.well-known/josh`.

## GitHub Pages static export

GitHub Pages does not run a persistent Next.js application server. Use a static export (`out/`), publish the prebuilt tree, and add `.nojekyll` at the publishing root when appropriate so GitHub does not run Jekyll over the output. Account for custom domains, project-site path prefixes, and dot-prefixed directories.

GitHub Pages does not provide ordinary per-path custom MIME-type configuration. Do not invent a new Actions artifact pipeline merely for the declaration. If an existing packaging step excludes hidden files, treat that as a packaging problem and verify the live tree includes `.well-known/josh`.

## The application base path does not define the protocol location

{% include declaration-origin-root-note.html %}

For an application published at `https://joshua.example/app/`, the declaration belongs at `https://joshua.example/.well-known/josh`, not at `https://joshua.example/app/.well-known/josh`.

Next.js `basePath` controls application path prefixes. It does not grant a path-prefixed-only deployment control over the origin root, and it does not relocate the well-known URI under that prefix for protocol purposes. If the deployment only has authority over `/app/`, the hosting arrangement must provide a root-level route for the declaration. Do not set or remove `basePath` without considering existing routing.

## Different origins and hostnames

These are distinct origins:

- `https://joshua.example/`
- `https://www.joshua.example/`
- `https://blog.joshua.example/`

Each participating origin needs its own declaration. Custom domains, default platform domains, and preview environments differ. A declaration on a temporary preview hostname does not establish participation for production.

## Next.js trailing-slash configuration

By default, Next.js generally redirects trailing-slash page URLs to counterparts without a trailing slash. When `trailingSlash: true` is enabled, Next.js documents exceptions for static file URLs and **any paths under `.well-known/`**—those paths are not forced to gain a trailing slash.

The declaration must remain accessible at exactly `/.well-known/josh`. Do not change the application’s global trailing-slash policy merely to publish the declaration. Still verify behavior against your Next.js version and host.

## Middleware, Proxy, and route interception

Application-level request handling can rewrite, redirect, or challenge a request before the public file is returned. In Next.js 16, Middleware is renamed to **Proxy**; older applications may still use a `middleware` file. Rewrites, redirects, authentication, catch-all routes, internationalization, and hosting-level routing can all interfere.

The declaration must remain publicly retrievable. Exclude the exact pathname `/.well-known/josh` from inappropriate authentication or rewrite matchers when necessary. Do not disable application security globally.

## Don't break the application to expose one file

Inspect existing routes and rewrites before changing them. Prefer a path-specific correction over a broad rule such as `/.well-known/:path*` when only one resource needs to be served. After changes, confirm the homepage, application routes, API endpoints, static assets, authentication, `robots.txt`, sitemap, and other well-known resources still behave correctly.

## Caching and public assets

Next.js describes a conservative default caching policy for files in `public/` because those files may change. CDN and host caches can still retain older bodies. When updating optional Josh identity:

1. Edit `public/.well-known/josh`.
2. Validate the JSON.
3. Run the normal build when required.
4. Deploy.
5. Verify the public response.
6. Account for caching.

Keep the URL stable. Do not fingerprint the declaration filename or apply immutable long-term caching without a deliberate invalidation strategy.

## Verify the public declaration

```sh
curl -i https://joshua.example/.well-known/josh
```

Inspect origin, status, redirects, final URL, Content-Type, JSON body, integer `version` `1`, optional Boolean `josh`, public access, and exact path.

{% include declaration-verify-ref.html %}

Ordinary `JSON.parse()` may normalize `1.0` to `1` while the protocol requires the integer token. Use the [declaration checker](/implement/validate/). Confirming the file in source is not enough—test the public URL.

### A successful status can still be the wrong resource

Hosts may return HTTP 200 with an HTML homepage, login page, SPA fallback, or custom error page for an unknown URL. That is not a valid Joshternet declaration. Inspect Content-Type and body.

### Regression checks

After publishing, spot-check the homepage, a regular page, static assets, an API endpoint if any, authentication flows, `robots.txt`, sitemap, and other well-known resources. A working declaration does not justify broken application routes.

## Updates and caching

Follow the edit → validate → build → deploy → verify sequence above. Do not assume a source change has reached production until the deployed response is checked.

{% capture stop_steps %}
1. Remove `public/.well-known/josh` from the project source.
2. Remove host or `next.config` header rules that exist only for that path, if any.
3. Rebuild (and regenerate `out/` when using static export) so the declaration is absent from the artifact.
4. Redeploy so packaging no longer includes the file; check CDN, proxy, or alternate Route Handler copies.
5. Confirm ordinary application routes still work, then request `https://joshua.example/.well-known/josh` and verify the live response.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Security considerations

Deploy only the intended application or static output—not private source trees or secrets. Publishing `.well-known/josh` does not require exposing every hidden file. Review packaging for `.env` files, credentials, and debug output before enabling broad hidden-file inclusion on any host.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Source exists, URL returns 404 | Static asset not served or not deployed |
| Static export missing declaration | Incorrect build output or packaging |
| `out/` is missing | Project not configured for static export |
| Looking under `.next/` for the file | Incorrect expectation about server build output |
| HTTP 200 returns HTML | Fallback route, rewrite, or SPA catch-all |
| Wrong Content-Type | Runtime or hosting MIME mapping |
| `headers()` works locally but not after export | Runtime headers unsupported on static export |
| Wrong URL under a base path | Application prefix confused with origin root |
| Redirect to login | Middleware, Proxy, or authentication matcher |
| Unexpected trailing-slash redirect | Routing or host behavior |
| Wrong result on `www` | Separate origin or redirect |
| Works on preview, fails on production | Custom-domain or deployment configuration |
| Public file conflicts with a route | Duplicate URL ownership |
| Old identity remains | Cache or stale deployment |
| Other routes fail | Overbroad rewrite or config change |
| Invalid JSON | Syntax or protocol-value error |
| File removed but declaration persists | Previous deploy or alternative handler |
| Standalone deploy missing declaration | `public/` not copied into standalone output |

Inspect source, build output, packaging, and live `curl` before upgrading Next.js or changing hosts without evidence.

## Tested

- Platform: Next.js 15 static export (`public/` → `out/`)
- Verified: 2026-10-06
- Evidence: recipe and Next.js documentation review of public-folder serving, static-export unsupported features (including `headers`), `basePath`, `trailingSlash` `.well-known` exceptions, and related deployment notes—including consultation of current Next.js docs for the Proxy rename—not a live Next.js+host deployment in this repository, and not a claim that every deploy mode was live-tested. Host MIME and packaging behavior must still be verified per environment.
- Protocol: RFC-JOSH-0002 version 1

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Next.js public folder (App)](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder), [Pages](https://nextjs.org/docs/pages/api-reference/file-conventions/public-folder)
- [Static exports](https://nextjs.org/docs/app/guides/static-exports), [headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers), [basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath), [trailingSlash](https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash), [Proxy](https://nextjs.org/docs/app/getting-started/proxy), [output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [deploying](https://nextjs.org/docs/app/getting-started/deploying)
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Netlify headers](https://docs.netlify.com/manage/routing/headers/), [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
