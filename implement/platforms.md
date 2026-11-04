---
layout: default
title: Platforms
description: >-
  Find instructions for publishing /.well-known/josh with WordPress, Astro,
  Eleventy, Hugo, Jekyll, Next.js, Nuxt, Quartz, SvelteKit, Ghost, or Cloudflare
  Workers.
keywords: >-
  /.well-known/josh, platform recipes, Astro, Eleventy, Ghost, Hugo, Jekyll,
  Cloudflare Worker, Next.js, Nuxt, Quartz, SvelteKit, WordPress, Joshternet declaration
seo:
  type: CollectionPage
  name: Platforms
permalink: /implement/platforms/
nav_title: Platforms
---

# Platforms

Every website is built a little differently, but joining the Joshternet shouldn't
mean changing the tools you already use. Find your publishing platform below and
follow the guide for making `/.well-known/josh` available on your site.

Some platforms publish it as a static file. Others use a plugin, server
configuration, or route. The result is the same: a valid declaration available at
the required public address. The important result is not where the declaration
lives in your repository. It is what the public website returns when someone
requests the declaration URL.

These pages are practical implementation recipes. They are not new protocol
specifications. Protocol details stay in the
[implementation guide]({{ '/implement/' | relative_url }}). Beginners can start at
[Join]({{ '/join/' | relative_url }}).

## The result is the same on every platform

Publish a valid version 1 declaration at exactly:

```text
https://joshua.example/.well-known/josh
```

There is no trailing slash and no `.json` extension. The minimum valid declaration is:

```json
{
  "version": 1
}
```

The response must be valid JSON, publicly accessible without authentication or client-side script, and served at that extensionless path. A successful response is normally `200 OK` with `Content-Type: application/json`.

The optional `josh` identity property does not change how a platform publishes the declaration. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) is authoritative for participation; see also the [Implement]({{ '/implement/' | relative_url }}) guide.

## Where you configure the declaration may not be where visitors find it

Three layers matter:

1. **Source** — The file, plugin setting, or Worker configuration you maintain.
2. **Build output** — The generated resource that will be deployed (or the route that will answer).
3. **Public response** — What the live website returns for the declaration URL.

```text
Source file or application configuration
                  |
                  v
           Build or routing
                  |
                  v
       /.well-known/josh
                  |
                  v
      Public HTTP response
```

A file can exist locally and still fail to appear in the deployed output. A file can also land at the correct path while the server delivers an unsuitable content type. Check each layer independently.

## Choose your platform

{% assign platform_groups = 'static|framework|cms|edge' | split: '|' %}
{% assign platform_group_labels = 'Static-site generators|Application frameworks|Content management systems|Infrastructure and edge routing' | split: '|' %}

{% for group_key in platform_groups %}
{% assign group_label = platform_group_labels[forloop.index0] %}
<h3>{{ group_label }}</h3>
<ul class="platforms-list">
{% for platform in site.data.platforms_nav %}
{% if platform.group == group_key %}
  <li>
    <a href="{{ platform.path | relative_url }}">{{ platform.title }}</a>
    {% if platform.summary and platform.summary != "" %}
      — {{ platform.summary }}
    {% endif %}
  </li>
{% endif %}
{% endfor %}
</ul>
{% endfor %}

## Which guide should you follow?

Choose the system that actually generates or serves your website. Do not switch hosting providers merely to publish a declaration.

| Your setup | Start here |
| --- | --- |
| Static generator (for example Hugo) on Cloudflare Pages, Netlify, or GitHub Pages | That generator’s recipe, then any host header notes in the same guide |
| WordPress | [WordPress]({{ '/implement/platforms/wordpress/' | relative_url }}) |
| Ghost behind Nginx or another reverse proxy | [Ghost]({{ '/implement/platforms/ghost/' | relative_url }}) (proxy configuration) |
| App already on Cloudflare with a Worker available | [Cloudflare Worker]({{ '/implement/platforms/cloudflare-worker/' | relative_url }}) |

Someone using Hugo and Cloudflare Pages should generally start with Hugo, then follow that guide’s Cloudflare Pages response-header instructions. Someone using WordPress should use the WordPress guide rather than introducing an unrelated static-site build.

## How different platforms publish the declaration

These approaches are alternatives. Use the one that fits your existing website.

### Static asset copying

Platforms such as Astro, Hugo, and Next.js can copy files from a designated `public` or `static` directory into the build output. When the host serves those files as-is, the declaration appears at `/.well-known/josh`.

### Explicit build copying

Some generators need configuration or a post-build copy step to place a source file at an extensionless path. Eleventy’s passthrough copy and Quartz’s post-build copy are examples.

### Dynamic routing

A web application or edge worker can return the JSON directly from a route. The Cloudflare Worker recipe serves the declaration without changing your app build.

### Reverse-proxy routing

A proxy can serve the resource independently of the publishing application. Ghost commonly needs this because its default routing layer treats `/.well-known` differently.

### Plugin integration

A CMS may expose the resource through an installed plugin. WordPress uses the Joshternet plugin for this path.

## Your publishing system and your host have different jobs

Your publishing system may control which files a build produces. Your host controls how those files are served over HTTP—GitHub Pages, Cloudflare Pages, Netlify, reverse proxies, and application servers each apply their own rules.

Serving an extensionless JSON file with the correct content type sometimes needs host configuration. A working local preview does not establish that production uses the same headers or routing. Keep host-specific examples inside the individual platform guides.

## Hidden directories and extensionless files

### Hidden directories

Some build tools exclude directories that begin with a period unless you configure them to include those directories. Jekyll’s need to include `.well-known` is a documented example.

### Extensionless files

Some servers infer content types from filename extensions. A file named `josh` may need explicit response-header configuration to return `application/json`.

These are separate problems. A directory can copy correctly while the file still receives an unsuitable content type. Platforms and hosts do not all behave the same way.

## The declaration belongs to the website's origin

Publish the declaration at the root of the origin you intend to declare:

```text
https://joshua.example/.well-known/josh
```

That differs from a path under an application prefix:

```text
https://joshua.example/blog/.well-known/josh
```

Evaluate custom domains, `www` versus non-`www` hosts, subdomains, sites deployed under a path prefix, reverse proxies, routing conflicts, and cross-origin redirects. Consumers may follow same-origin redirects; a cross-origin redirect does not count for the original origin. Declare the origin you mean—not only where your source files live.

## Identity is separate from hosting

Every platform uses the same declaration structure. Identity states are Affirmed Josh identity (`"josh": true`), Declined Josh identity (`"josh": false`), and Undeclared Josh identity (property omitted). Omitting `josh` is not the same as `false`.

See the [Implement]({{ '/implement/' | relative_url }}) guide for complete examples. WordPress, Cloudflare, and other platforms do not redefine the meaning of the `josh` field.

## Check the deployed declaration

After you deploy, inspect the live resource:

```sh
curl -i https://joshua.example/.well-known/josh
```

Check HTTP status, final URL, redirect behavior, content type, response body, and JSON values. Use the [declaration checker]({{ '/implement/validate/' | relative_url }}) for a browser-based check.

The public response is the final authority for whether the hosting recipe worked. A successful local build or file on disk is not enough by itself.

## Common problems

| Problem | Common cause |
| --- | --- |
| 404 response | File not copied or route missing |
| Homepage returned | Catch-all routing or fallback |
| Redirect to a different origin | Host or routing configuration |
| Incorrect content type | Server MIME mapping |
| Invalid JSON | Source content or serialization error |
| Works locally, fails publicly | Deployment or host configuration |
| Trailing-slash redirect | Framework or server URL normalization |
| Permission denied | Authentication or access policy |
| Old declaration returned | Cache or deployment mismatch |

Confirm the failure with `curl` or the declaration checker, then use the troubleshooting section in your platform guide. Avoid speculative routing changes that could break unrelated paths.

## Conflicts with existing routes

Many sites already use `.well-known` resources or application routes. Watch for conflicts with existing `.well-known` directories, framework catch-alls, reverse-proxy rules, CDN redirects, authentication middleware, static asset handlers, WordPress rewrites, and security filters.

Add the Joshternet declaration without breaking unrelated well-known endpoints. Do not replace an existing `.well-known` directory wholesale.

## Caching and updates

Browsers, proxies, and CDNs may cache the declaration. Normal HTTP caching, `Cache-Control`, `ETag`, deployment propagation, stale responses, and revalidation all affect what clients see after you change a file or identity value.

Deployment completion and independent verification are separate events. After an update, re-check the public URL rather than assuming every client already has the new body. Keep behavior consistent with RFC-JOSH-0002 and the declaration checker.

## What you'll find in each guide

A complete platform recipe should cover:

1. Supported platform and version.
2. Prerequisites.
3. Source file or configuration location.
4. Exact implementation steps.
5. Local verification.
6. Build-output verification, when relevant.
7. Required host-specific configuration.
8. Public URL verification.
9. Known limitations.
10. How to stop publishing the declaration.
11. Evidence of testing.

That list describes recipe quality. It does not add requirements for joining Joshternet beyond a valid declaration.

## What “tested” means

A plausible example is not the same as a tested recipe. Credible verification should include the relevant platform version, build or runtime mode, expected generated path, actual public route, HTTP status, content type, JSON validation, and any host-specific limitations.

Each guide’s own **Tested** section records its evidence. This index does not invent timestamps or claim every recipe has been revalidated against the latest platform release. Gaps belong in the individual guide reviews that follow.

## You remain in control

You may stop declaring participation by removing or disabling the valid resource—removing a static file, disabling a plugin endpoint, removing a Worker route, or removing a reverse-proxy rule.

Prefer intentionally ceasing to publish a valid declaration over deliberately serving malformed JSON. Temporary DNS, TLS, timeout, and server errors do not establish intentional withdrawal.

Authoritative participation semantics stay on the [Implement]({{ '/implement/' | relative_url }}) guide.

## Don't see your platform?

That's all right. Joshternet doesn't depend on a particular framework or
publishing system. The main [implementation guide]({{ '/implement/' | relative_url }})
explains the public declaration and HTTP requirements, so you can use the
approach that works for your website. That does not promise every host will let
you control the origin-root path required by the protocol.

## Related documentation

- [Implement the Joshternet]({{ '/implement/' | relative_url }})
- [Join]({{ '/join/' | relative_url }})
- [Declaration checker]({{ '/implement/validate/' | relative_url }})
- [Content Discovery Handbook]({{ '/implement/content/' | relative_url }}) — optional open web publishing standards, not platform join requirements
- [Joshternet specification repository](https://github.com/joshternet/spec)
