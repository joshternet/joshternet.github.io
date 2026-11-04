---
layout: default
title: Publish /.well-known/josh with Eleventy
description: >-
  Publish a Joshternet /.well-known/josh declaration from an existing Eleventy
  site by passthrough-copying josh.json to an extensionless path, then verify
  build output, hosting Content-Type, and the live origin URL.
keywords: >-
  Eleventy, /.well-known/josh, Joshternet declaration, addPassthroughCopy,
  static site recipe, Content-Type
seo:
  type: TechArticle
  name: Eleventy
permalink: /implement/platforms/eleventy/
nav_title: Eleventy
---

# Publish with Eleventy

Eleventy can publish ordinary files without rendering them as templates. Its [passthrough-copy](https://www.11ty.dev/docs/copy/) API copies a source file into the generated website.

For Joshternet, that means you can keep the declaration in a normal `josh.json` file for editors and validators, while the published resource uses the extensionless path `/.well-known/josh`. The important outcome is the resource returned by the public website, not the internal name of the source file.

This approach fits ordinary static-site publishing. You remain responsible for ensuring the deployed file is available at the correct URL on the origin you intend to declare. The recommended implementation needs no Eleventy shortcode, serverless function, database, or separate API.

Other methods are possible. This guide focuses on passthrough copy for a conventional Eleventy deployment. See the [Platforms](/implement/platforms/) directory for alternatives.

## Use Eleventy’s passthrough copy

Use this approach when:

- You already have an Eleventy website.
- The site builds into a static output directory.
- You want to maintain the declaration as JSON.
- The hosting service can publish the resulting file at the **origin root**.

Passthrough copy is simpler than introducing an application endpoint or serverless function when the site is already statically hosted. Do not change frameworks, move hosting providers, or create new infrastructure merely to join Joshternet.

## Before you begin

You should have:

- An existing Eleventy project and access to its configuration.
- A working production build and control over the published website.
- The ability to inspect the output directory.
- An appropriate deployment process.
- Permission to configure response headers when the host requires it for extensionless JSON.

Eleventy supports different configuration filenames and JavaScript module formats (`eleventy.config.js`, `.eleventy.js`, and others). Update your existing configuration rather than creating a conflicting second config file. Do not create a new Eleventy project only for this recipe.

## Keep the public URL exact

The required public resource is:

```text
https://joshua.example/.well-known/josh
```

The path begins with `/.well-known/`, uses the filename `josh`, has no `.json` extension, has no trailing slash, query string, or fragment, and sits at the origin root. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

Distinguish source filename, generated file, and public URL:

| Stage | Example |
| --- | --- |
| Source | `input/josh.json` |
| Generated file | `_site/.well-known/josh` |
| Public URL | `https://joshua.example/.well-known/josh` |

`input/` and `_site/` are illustrative project directories, not universal Eleventy requirements. Custom `dir.input` and `dir.output` values change local paths only.

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

## Create the source JSON file

One possible project layout:

```text
project/
├── eleventy.config.js
├── package.json
└── input/
    └── josh.json
```

If the site uses `src/` or another input directory, adjust the source path. Keep the declaration in a normal JSON file so editors and validators recognize its syntax. The source filename does not determine the public protocol URL.

## Copy the file without rendering it

Passthrough copy paths are relative to the **project root**, not the input directory. The object form of `addPassthroughCopy()` sets an explicit destination relative to the **output root**, so Eleventy can write an extensionless file:

```js
eleventyConfig.addPassthroughCopy({
  "input/josh.json": ".well-known/josh",
});
```

Without an explicit destination, a simple copy may preserve `josh.json` and publish the wrong filename. With the mapping above, a production build should produce `_site/.well-known/josh`—not `_site/josh.json`, `_site/.well-known/josh.json`, `_site/.well-known/josh/index.html`, or `_site/input/josh.json`.

See Eleventy’s [passthrough copy](https://www.11ty.dev/docs/copy/) and [configuration](https://www.11ty.dev/docs/config/) documentation.

## Complete ESM configuration

For a project that already uses ESM and `input/` as its source directory, add the passthrough mapping to the existing config. Illustrative complete file:

```js
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    "input/josh.json": ".well-known/josh",
  });

  return {
    dir: {
      input: "input",
      output: "_site",
    },
  };
}
```

The source path is relative to the project root. The destination path is relative to the generated site’s output root. The `dir` block is illustrative—reconcile it with plugins, collections, and directories you already use. Do not replace an entire working configuration solely to add this one mapping.

## CommonJS projects

Some Eleventy projects still use CommonJS (for example `.eleventy.js` with `module.exports`). Equivalent configuration:

```js
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    "input/josh.json": ".well-known/josh",
  });

  return {
    dir: {
      input: "input",
      output: "_site",
    },
  };
};
```

Match the module format your project already uses. Do not change the entire project’s module system merely to add passthrough copying. ESM and CommonJS examples must produce the same output path.

## Adapt the recipe to your project

Eleventy supports customized input and output directories. For example:

```text
src/
  josh.json

public-site/
  .well-known/
    josh
```

Mapping for that layout:

```js
eleventyConfig.addPassthroughCopy({
  "src/josh.json": ".well-known/josh",
});
```

With `dir.output: "public-site"`, verify `public-site/.well-known/josh` locally. The public URL remains `https://joshua.example/.well-known/josh`. Inspect your existing Eleventy configuration before copying commands. Do not restructure the website to match documentation examples.

## Generate the declaration

Use the project’s existing build command when one is available:

```sh
npm run build
```

Or invoke Eleventy directly:

```sh
npx @11ty/eleventy
```

With pnpm, Yarn, or another package manager, use the equivalent command. The build must finish successfully before you inspect the output directory.

## Inspect the generated file

With the default output directory:

```sh
test -f _site/.well-known/josh
cat _site/.well-known/josh
```

These commands confirm the file exists and show its contents. They do not verify HTTP response headers, public accessibility, or deployment routing. For a direct passthrough copy, the resulting JSON should remain semantically identical to the source. Do not introduce a transformation step without a demonstrated need.

## Validate the JSON declaration

Successful JSON parsing is necessary but not sufficient for RFC-JOSH-0002 conformance. Check for a JSON object root, no duplicate member names, required `version` as the integer token `1`, and optional Boolean `josh`. Ordinary `JSON.parse()` may normalize `1.0` into the numeric value `1` even though the protocol requires the integer-token form.

Use the [declaration checker](/implement/validate/) for protocol-level validation.

{% include declaration-verify-ref.html %}

## Test the development server

```sh
npx @11ty/eleventy --serve
```

Then:

```sh
curl -i http://localhost:8080/.well-known/josh
```

Port `8080` is the common default and may differ in a configured project. The development server may behave differently from the final static deployment. Do not assume that the Content-Type observed locally matches production.

### Development-server passthrough behavior

Eleventy can optionally **emulate** passthrough copy during `--serve` so referenced files are served without writing every copy into the output directory. That mode is **opt-in** via `setServerPassthroughCopyBehavior("passthrough")`. The default server behavior is `"copy"`. Emulation reverts to normal copying for a standard build or `--watch` without `--serve`.

If your project enables emulation, a local URL check may succeed even when `_site` does not yet contain every passthrough file from a prior serve session. Always verify the actual generated file after a production build. See the [Eleventy Dev Server](https://www.11ty.dev/docs/dev-server/) and [passthrough copy](https://www.11ty.dev/docs/copy/) docs.

## The host determines the final HTTP response

RFC-JOSH-0002 associates the declaration with the media type `application/json`. A server SHOULD return:

```text
Content-Type: application/json
```

An extensionless filename may not be recognized as JSON by a host that maps MIME types from filename extensions. Eleventy copies the bytes; the hosting platform delivers the HTTP response.

An unexpected Content-Type alone does not make otherwise valid declaration JSON invalid under RFC-JOSH-0002, although the recommended media type improves interoperability. Do not rename the public path to `josh.json` as a workaround.

## Netlify hosting

Netlify supports custom response headers through `netlify.toml` or a `_headers` file. Prefer one method. Example using `netlify.toml`:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

The rule must apply to the published static resource. If a function or proxy handles the request, static-file header configuration may not apply. See [Netlify headers](https://docs.netlify.com/manage/routing/headers/).

## Cloudflare Pages hosting

For static files, Cloudflare Pages reads a `_headers` file in the deployed output:

```text
/.well-known/josh
  Content-Type: application/json
```

Ensure `_headers` is included in the publish directory—copy it with an existing passthrough arrangement or an additional `addPassthroughCopy` mapping if it lives outside the output tree. `_headers` rules do not automatically apply to responses generated by Pages Functions. Do not introduce a Cloudflare Worker when ordinary static hosting and a header rule already solve the problem. See [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

## GitHub Pages and hidden files

`.well-known` is a dot-prefixed directory. A successful local Eleventy build may contain the declaration while a later publishing step omits it—or includes it while also packaging secrets.

For a **prebuilt** Eleventy site, prefer GitHub’s [branch-based publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site): publish a branch (or folder) that contains the generated static assets, not a workflow that uploads GitHub Actions artifacts. Place a `.nojekyll` file at the publishing root so GitHub Pages does not run Jekyll over the prebuilt output. That matters for sites that already ship generated HTML and for preserving resources under dot-prefixed directories.

Intended publishing-root shape:

```text
publishing-root/
├── .nojekyll
├── .well-known/
│   └── josh
├── index.html
└── assets/
```

`.nojekyll` is a GitHub Pages convenience, not a Joshternet protocol requirement.

GitHub Pages does not provide ordinary per-path custom Content-Type configuration. Inspect the live `Content-Type` when that matters. Project sites under a repository path prefix still need origin-root authority for `/.well-known/josh` (see below). See also [creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

### Avoid publishing private hidden files

When a deployment includes dot-prefixed directories so `.well-known` is published, do not indiscriminately ship the entire repository. Inspect the publishing directory for `.env` files, credentials, private configuration, temporary files, and build caches. Prefer an explicit Eleventy output (and only that output) over packaging the whole project tree.

## Your Eleventy site may use a path prefix, but the declaration does not

{% include declaration-origin-root-note.html %}

Eleventy’s `pathPrefix` does not change the protocol’s canonical location. Project sites such as `https://username.github.io/project/` must control the origin root—or use a custom origin—to participate through this protocol. Do not publish the declaration only under a project subdirectory and claim origin-level participation.

## Different hostnames and origins

These are distinct origins:

- `https://joshua.example/`
- `https://www.joshua.example/`
- `https://blog.joshua.example/`

Each must publish a valid declaration if it intends to declare independently. Redirects between origins do not automatically establish the declaration for the original origin.

Checklist: choose the public hostname, confirm that hostname’s deploy includes the file, verify `https://that-host/.well-known/josh`, then repeat for any additional origin.

## Existing routes, redirects, and fallbacks

Catch-all rewrites, trailing-slash redirects, hostname redirects, authentication layers, CDN rules, and other `.well-known` resources can interfere. A request that returns HTTP 200 with homepage HTML is not a valid declaration—inspect Content-Type and the body with `curl -i` before changing unrelated routing.

## Verify the public endpoint

After deploy:

```sh
curl -i https://joshua.example/.well-known/josh
```

Confirm the requested origin, status, redirects, final URL, Content-Type, JSON body, integer `version` `1`, optional Boolean `josh`, and public accessibility without client-side JavaScript. The deployed response is authoritative.

### Regression checks

Spot-check the homepage, about page, an article, CSS and JavaScript assets, `robots.txt`, `sitemap.xml`, and other existing well-known resources. Prefer narrowly scoped header rules over global redirects or headers.

## Updates and caching

Edit `josh.json`, run the normal Eleventy build, confirm the copied output file, deploy, and re-check the public URL. Browser and CDN caches can delay visibility. A stale cached response is not evidence of malformed JSON—prefer checking the live endpoint before changing infrastructure.

{% capture stop_steps %}
1. Remove the passthrough mapping (and the `josh.json` source if you no longer need it).
2. Remove host header rules that exist only for that path, if any.
3. Rebuild and redeploy so the publishing directory no longer includes the file.
4. Confirm ordinary site pages still work.
5. Request `https://joshua.example/.well-known/josh` again—older generated output or a leftover host route can still serve a declaration.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Security considerations

The declaration is intentionally public. Do not put credentials or tokens in `josh.json`. Prefer publishing only the Eleventy output directory. Keep authentication off the declaration path. The `josh` property is a public identity preference, not confidential configuration.

## Troubleshooting

| Problem | Possible cause |
| --- | --- |
| Source JSON exists but output is missing | Passthrough configuration incorrect |
| Output remains `josh.json` | Destination mapping not applied |
| Output appears in the wrong directory | Source or target path incorrect |
| No file after development server starts | Emulated passthrough differs from a production build |
| HTTP 404 | Deployment excluded `.well-known` |
| HTTP 200 with HTML | Hosting fallback or rewrite |
| Incorrect Content-Type | Host MIME mapping |
| Works locally but not publicly | Deployment configuration |
| GitHub Pages omits the declaration | Publishing source or hidden-file handling |
| Wrong origin | Hostname or subpath mismatch |
| Invalid declaration | JSON or protocol-value error |
| Old identity state | Stale output or caching |
| Other pages break | Overbroad deployment configuration |

Inspect the relevant stage (source, `_site`, live `curl`) before upgrading frameworks or rewriting the whole site.

## Tested

- Platform: Eleventy `addPassthroughCopy` to `.well-known/josh`
- Verified: 2026-10-06
- Evidence: recipe and Eleventy documentation review of passthrough object mapping for this guide (not a live Eleventy+host deployment in this repository, and not a CI Eleventy fixture build)
- Protocol: RFC-JOSH-0002 version 1

Instructions that depend on stable `addPassthroughCopy` object destinations remain valid against current Eleventy documentation. Host MIME behavior and branch-publishing packaging must still be verified per environment. Do not assume every future Eleventy major release without re-checking the docs for that release.

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Eleventy passthrough copy](https://www.11ty.dev/docs/copy/), [configuration](https://www.11ty.dev/docs/config/), [Dev Server](https://www.11ty.dev/docs/dev-server/), [release history](https://www.11ty.dev/docs/versions/)
- [Netlify headers](https://docs.netlify.com/manage/routing/headers/), [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
