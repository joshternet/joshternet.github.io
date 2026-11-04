---
layout: default
title: Publish /.well-known/josh with Jekyll
description: >-
  Publish a Joshternet /.well-known/josh declaration from an existing Jekyll site
  via an included static file—covering include lists, host headers, GitHub Pages
  packaging, baseurl, and public verification.
keywords: >-
  Jekyll, /.well-known/josh, Joshternet declaration, include .well-known,
  Content-Type, GitHub Pages
seo:
  type: TechArticle
  name: Jekyll
permalink: /implement/platforms/jekyll/
nav_title: Jekyll
---

# Publish with Jekyll

Jekyll is a static-site generator that can publish ordinary files alongside generated pages. A Joshternet declaration is a small JSON document rather than a page that needs Liquid templates or Markdown rendering.

Jekyll can copy the declaration into the generated website while preserving its exact filename—once the `.well-known` directory is listed in `include`. The build creates the file; the hosting service ultimately determines how the public resource is delivered over HTTP.

This guide is a practical procedure for existing Jekyll sites. Other methods are possible—see the [Platforms](/implement/platforms/) directory.

This repository itself uses the same pattern: `_config.yml` lists `include: [.well-known]`, and [`.well-known/josh`](/.well-known/josh) holds `{ "version": 1 }`. That is source configuration for this project. It does not prove every reader’s host, MIME type, or deploy packaging.

## Use a static file

Use this approach when:

- You already use Jekyll.
- The declaration can live in the site’s source repository.
- The site generates into a static output directory (commonly `_site`).
- The host can publish an extensionless file at the **origin root**.
- You control the intended origin.

This method generally needs no custom plugins, collections, or Liquid for the declaration. Do not replace your site architecture. A reverse proxy or CDN may add response-header controls; that is separate from Jekyll’s static-file copying.

## Before you begin

You should have:

- An existing Jekyll project and a working Jekyll build.
- Access to `_config.yml` (or equivalent) and the project source root.
- Control over deployment and knowledge of the public hostname.
- A way to test the deployed HTTP response.

Do not create a new Jekyll project merely for this recipe. Sites that depend on the `github-pages` gem (including this repository) follow GitHub Pages’ supported Jekyll/plugin set rather than an unconstrained latest standalone Jekyll release—adapt commands to the toolchain you already use.

## The declaration belongs at the origin root

The required public resource is:

```text
https://joshua.example/.well-known/josh
```

The path starts with `/.well-known/`, uses `josh` as the resource name, has no `.json` extension, has no trailing slash, and is not under a collection or `_posts` path. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

| Stage | Default location |
| --- | --- |
| Jekyll source | `.well-known/josh` (with `include`) |
| Jekyll output | `_site/.well-known/josh` |
| Public resource | `https://joshua.example/.well-known/josh` |

Source and destination directories can change through Jekyll configuration. The public protocol path does not.

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
jekyll-site/
├── _config.yml
├── Gemfile
├── _layouts/
└── .well-known/
    └── josh
```

Create the directory and file at the project source root (or under a custom `source` directory if you use one):

```text
.well-known/
  josh
```

The published filename is exactly `josh`. The file contains ordinary JSON despite having no extension. Do not add YAML front matter—Jekyll would treat a front-mattered file as a document to process rather than copying bytes unchanged. Prefer setting your editor’s language mode to JSON for the extensionless file. Avoid publishing a second public path such as `/.well-known/josh.json`; the protocol resource is the extensionless URL.

## How Jekyll publishes static files

Jekyll copies source files without front matter into the destination as static files, generally preserving path shape. Paths that begin with `.`, `_`, `#`, or `~` are skipped unless listed in `include`. See Jekyll’s [directory structure](https://jekyllrb.com/docs/structure/) and [configuration](https://jekyllrb.com/docs/configuration/).

Using a plain static file is preferable to generating this resource through Liquid, data files, or a plugin. Keeping it static avoids coupling to themes and templates. Jekyll does not guarantee that every host assigns `application/json` to an extensionless file.

## Include `.well-known`

Jekyll skips source paths that begin with `.` unless they appear in `include`. Add the directory in `_config.yml`:

```yaml
include:
  - .well-known
```

Without that entry, `.well-known/josh` stays out of `_site` and the deployed origin has no declaration.

### Preserve existing include lists

Your site’s `include` array may already list other paths (for example `_pages` or `.htaccess`). A user `include` list **replaces** Jekyll’s default include array rather than merging with it. When you add `.well-known`, keep every path you still need—do not replace a working list with a single-item array that drops prior entries.

Narrow the addition to `.well-known` (or the specific declaration path you intend). Including a broader hidden tree can publish unrelated files. Inspect `.well-known/` for other well-known resources and for anything that must not be public before enabling the include.

### Include versus exclude

`exclude` and `include` solve different problems. Dot-prefixed paths need `include` because of Jekyll’s reading rules; they are not fixed by adding them only to `exclude`. User `exclude` entries are typically added to Jekyll’s defaults; do not remove default excludes casually. Prefer the narrowest `include` that publishes the declaration.

Including `.well-known` in Jekyll and preserving `.well-known` in a later deploy package are separate steps. A successful Jekyll build does not guarantee that every deploy tool keeps hidden directories.

## Generate the declaration

```sh
bundle exec jekyll build
```

This normally writes into `_site/`. Use the Ruby/Bundler workflow your project already uses. Do not invent a new build script for one JSON file. Running Jekyll in the reader’s project is unrelated to this repository’s own production build scripts beyond the shared include pattern described above.

## Check the generated output

Before deploying, confirm that Jekyll produced the exact extensionless file:

```sh
test -f _site/.well-known/josh
cat _site/.well-known/josh
```

The first command confirms the path exists. The second shows contents. Neither proves public HTTP headers or deployment. The output should be an extensionless regular file—not `josh.json` or an HTML page.

The generated site should contain:

```text
_site/
  .well-known/
    josh
```

## Check the resource locally

```sh
bundle exec jekyll serve
```

Then:

```sh
curl -i http://localhost:4000/.well-known/josh
```

Port `4000` is the common default and may change. The development server is not production hosting. Local Content-Type, redirects, and caching may differ. Always repeat the check against the deployed site because production response headers are controlled by the hosting platform.

## Your host must deliver the JSON correctly

RFC-JOSH-0002 associates the declaration with `application/json`. A server SHOULD return:

```text
Content-Type: application/json
```

Jekyll copies the bytes; the host delivers HTTP. An extensionless file may receive a generic MIME type. Keep four checks separate: valid JSON, exact URL, HTTP status, and recommended media type. An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002.

## Netlify hosting

If the Jekyll site is hosted on Netlify, add this to `netlify.toml`:

```toml
[[headers]]
  for = "/.well-known/josh"

  [headers.values]
    Content-Type = "application/json"
```

Prefer one method (`netlify.toml` or `_headers`), not both without reason. Static header rules do not automatically apply to proxy or function responses. See [Netlify headers](https://docs.netlify.com/manage/routing/headers/).

## Cloudflare Pages hosting

For Cloudflare Pages, place `_headers` where it ends up in the publish directory. Underscore-prefixed filenames are skipped by Jekyll unless listed in `include`. If you keep `_headers` in the Jekyll source, add it to `include` alongside `.well-known` (preserving any other entries you need):

```yaml
include:
  - .well-known
  - _headers
```

Then add:

```text
/.well-known/josh
  Content-Type: application/json
```

Cloudflare Pages applies the rule for static responses. It does not automatically apply to Pages Functions. Do not add a Worker when the static-file approach already works. See [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

## GitHub Pages publishing modes

Distinguish how the site reaches GitHub Pages:

### Jekyll source builds

When GitHub Pages builds Jekyll from a source branch (or an Actions workflow that runs Jekyll on the source), keep `.well-known` in `include` so the build emits `_site/.well-known/josh`. Do **not** add `.nojekyll` merely because you are publishing a normal Jekyll source site—`.nojekyll` disables GitHub’s Jekyll processing for a publishing root that should remain a prebuilt static tree.

### Prebuilt output

When you upload or push prebuilt static assets (already-generated `_site` contents), place `.nojekyll` at the publishing root so GitHub Pages does not run Jekyll over the output. The declaration must already exist in that tree as `.well-known/josh`.

### Existing GitHub Actions workflows

Some workflows use `actions/upload-pages-artifact`. Current versions exclude hidden files and directories by default. Because `.well-known` begins with a dot, `_site` may contain the declaration while the deployment artifact silently leaves it out.

If your workflow already uses that action, enable hidden files when uploading the Jekyll output:

```yaml
- name: Upload artifact
  uses: actions/upload-pages-artifact@v5
  with:
    path: ./_site
    include-hidden-files: true
```

Before enabling this option, make sure the generated output does not contain hidden files that should remain private. Do not introduce a new artifact pipeline merely for this recipe.

### Response-header limitations

GitHub Pages does not provide ordinary per-path custom MIME-type configuration. The extensionless declaration may receive a generic Content-Type. `.nojekyll` does not change Content-Type. Do not rename the resource to `josh.json`. If explicit MIME control is essential, use an existing configurable proxy or host—not a mandatory migration.

## Custom source and destination

Jekyll’s `source` and `destination` can point elsewhere:

```yaml
source: src
destination: dist
```

Then the declaration source is `src/.well-known/josh` (still requiring `include`), and local verification checks `dist/.well-known/josh`. The public URL remains `https://joshua.example/.well-known/josh`. Confirm the host deploys the configured output, not an assumed `_site/`. Do not change working paths solely to match this tutorial.

## Origin-root requirements and project sites

{% include declaration-origin-root-note.html %}

This matters for Jekyll sites hosted as GitHub Pages project sites or anywhere the site is deployed beneath a path prefix.

For example:

```text
https://username.github.io/project/
```

does not make:

```text
https://username.github.io/project/.well-known/josh
```

a Joshternet declaration for that origin.

Jekyll’s `baseurl` does not move the well-known URI. The hosting arrangement must give the site control of:

```text
https://username.github.io/.well-known/josh
```

or the site should use a custom origin (for example `https://joshua.example/`) where it can publish the declaration at the root.

User/organization GitHub Pages sites and custom domains are different setups; a custom domain may provide a separately controlled origin when configured correctly, but it does not automatically fix every routing issue.

## Hostnames

These are distinct origins:

- `https://joshua.example/`
- `https://www.joshua.example/`
- `https://blog.joshua.example/`

Each participating origin needs its own declaration. Cross-origin redirects do not substitute.

## Conflicting outputs

Possible competing sources for the same public path include the Jekyll static copy, a reverse-proxy or CDN rule, a hand-managed deploy overlay, or a second build step that writes into the publish directory. Prefer one authoritative source for `/.well-known/josh`.

If `.well-known/josh` exists in source with a correct `include` but is missing from `_site`: inspect `include`/`exclude`, confirm `source`/`destination`, rebuild, inspect output, then verify deployment. Do not add plugins as the default fix for a missing include.

## Verify the public declaration

```sh
curl -i https://joshua.example/.well-known/josh
```

Inspect origin, status, redirects, final URL, Content-Type, JSON body, integer `version` `1`, optional Boolean `josh`, authentication, and exact path.

{% include declaration-verify-ref.html %}

Ordinary `JSON.parse()` may normalize `1.0` to `1` while the protocol requires the integer token. Use the [declaration checker](/implement/validate/).

Some hosts return HTTP 200 with HTML for missing paths, or redirect to a trailing slash or another hostname. Inspect headers and body. Same-origin redirects differ from cross-origin redirects.

### Regression checks

After publishing—especially after editing `include`—spot-check the homepage, about page, an article, CSS/JS/images, `robots.txt`, sitemap, feeds, and other well-known resources. If a rewritten `include` list dropped previously published paths (for example `.htaccess` or `_headers`), treat that as a regression.

## Updates and caching

1. Edit the source declaration.
2. Validate JSON.
3. Run `bundle exec jekyll build`.
4. Confirm the generated file.
5. Deploy.
6. Verify the public response.
7. Account for caching.

Keep the URL stable—do not invent timestamped declaration filenames.

## Cleanup when removing the declaration

Removing `.well-known/josh` from source should leave other `.well-known` includes intact if those files must remain. Only remove the `include` entry for `.well-known` when nothing under that directory should publish.

Jekyll’s `keep_files` setting preserves listed paths in the destination across builds. Stale deploy layers, CDN caches, or hand-copied publish directories can also keep an old declaration after the source file is gone. Distinguish removing the source, cleaning stale output, generating a new build, replacing deployed assets, and verifying the live response.

{% capture stop_steps %}
1. Remove `.well-known/josh` from the Jekyll source (and the `include` entry for `.well-known` only if nothing else under that directory must remain).
2. Remove host header rules that exist only for that path, if any.
3. Rebuild and confirm `_site/.well-known/josh` (or your custom destination) is gone—or that only the intended sibling well-known files remain.
4. Redeploy so packaging no longer includes the file; check CDN or proxy rules that might still answer the path.
5. Confirm ordinary site pages still work, then request `https://joshua.example/.well-known/josh` and verify the live response.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Security considerations

Deploy only the generated static output—not the whole Jekyll repository. Publishing `.well-known/josh` does not require exposing every hidden file. Review packaging for `.env` files, credentials, private config, debug output, and caches before enabling broad hidden-file inclusion. Inspect the `.well-known` directory itself before listing it in `include`.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Source exists, output missing | Missing or overwritten `include` for `.well-known` |
| Other included paths disappear | `include` list replaced instead of extended |
| Output uses the wrong path | Custom `source`/`destination` or deployment prefix |
| Output contains old JSON | Stale build files or `keep_files` |
| Source removed but declaration remains | Old output, deploy overlay, or caching |
| File exists locally but public URL returns 404 | Deployment omitted `.well-known` |
| HTTP 200 returns HTML | Hosting fallback or rewrite |
| Wrong Content-Type | Host MIME mapping |
| Works in `jekyll serve`, fails publicly | Hosting configuration difference |
| `_headers` missing from `_site` | Underscore path not listed in `include` |
| Declaration appears under `/project/` | Subpath deployment; `baseurl` does not move the protocol path |
| Different results across hostnames | Separate origins or redirects |
| Invalid JSON | Syntax, front matter, or protocol-value error |
| GitHub Pages omits `.well-known` | Missing `include`, publishing mode, or hidden-file filtering |
| Prebuilt tree reprocessed by Jekyll | Missing `.nojekyll` on a static publish root |
| Jekyll source build unexpectedly skipped | `.nojekyll` present where a source build is required |
| Other site resources break | Overbroad `include`/`exclude` change |

Inspect source, build output, packaging, and live `curl` before upgrading gems or themes without evidence.

## Tested

- Platform: Jekyll static `.well-known/josh` with `include`
- Verified: 2026-10-06
- Evidence: recipe and Jekyll documentation review of static-file copying and `include` behavior, plus this repository’s source `_config.yml` / `.well-known/josh` pattern (and build-output checks where applicable)—not every host MIME type verified, and not a live GitHub Pages MIME survey for every publishing mode. Host packaging behavior must still be verified per environment.
- Protocol: RFC-JOSH-0002 version 1

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Jekyll directory structure](https://jekyllrb.com/docs/structure/), [configuration](https://jekyllrb.com/docs/configuration/), [configuration options](https://jekyllrb.com/docs/configuration/options/), [deployment](https://jekyllrb.com/docs/deployment/)
- [GitHub Pages and Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll), [publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Netlify headers](https://docs.netlify.com/manage/routing/headers/), [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
