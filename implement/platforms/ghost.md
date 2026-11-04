---
layout: default
title: Publish /.well-known/josh with Ghost
description: >-
  Publish a Joshternet /.well-known/josh declaration from a Ghost site at the
  reverse-proxy layer—exact-match Nginx for self-hosted Ghost, with accurately
  qualified Ghost(Pro) limits.
keywords: >-
  Ghost, Ghost Pro, /.well-known/josh, Joshternet declaration, Nginx, reverse
  proxy
seo:
  type: TechArticle
  name: Ghost
permalink: /implement/platforms/ghost/
nav_title: Ghost
---

# Publish with Ghost

Ghost is a publishing platform for posts, pages, themes, and membership features. A Joshternet declaration is different: a small JSON document at an exact origin-level URL.

For a self-hosted Ghost installation, the simplest reliable approach is usually to let the existing web server or reverse proxy answer that request directly—before Ghost handles the request. That avoids changing Ghost themes, `routes.yaml`, or application code.

You remain in control of your hosting infrastructure and of what the declaration says. Other methods are possible; this guide focuses on the proxy-layer recipe. See the [Platforms](/implement/platforms/) directory for alternatives.

## How is your Ghost site hosted?

| Hosting arrangement | Recommended approach |
| --- | --- |
| Self-hosted Ghost with Nginx | Exact-match Nginx location |
| Self-hosted Ghost with another reverse proxy | Equivalent exact-path response |
| Ghost(Pro) behind a publisher-controlled proxy | Serve the declaration on that proxy |
| Ordinary Ghost(Pro) without control of the response layer | No generally verified direct publishing recipe |
| Ghost beneath `/blog/` | Serve the declaration at the public origin root |

The right solution depends on which system controls incoming HTTP requests. Do not assume root access, Nginx access, or permission to change managed hosting.

## Before you begin (self-hosted)

You should have:

- An existing Ghost installation and a functioning public domain.
- Access to the web-server or reverse-proxy configuration for that hostname.
- Permission to validate and reload the proxy.
- Knowledge of the correct virtual host (especially the HTTPS server block).
- A valid Joshternet declaration and a way to test the public HTTP response.

Ghost-CLI production installs commonly put [Nginx in front of Ghost][ghost-proxy]. Other arrangements exist. Do not reinstall Ghost or change database or publication settings merely to join Joshternet.

## The declaration belongs at the origin root

The required public resource is:

```text
https://joshua.example/.well-known/josh
```

The path has no `.json` extension, no trailing slash, no query string, no fragment, and no application subdirectory prefix. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

A Ghost page at `/josh/` or a file under `/blog/.well-known/josh` is not the required declaration.

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

`josh` is optional and must be a JSON Boolean when supplied. Omission is not the same as `false`. Never infer identity from a name, domain, or published content.

{% include declaration-identity-ref.html %}

## Why not put this in a Ghost theme?

Ghost themes render publication content through Handlebars templates. They are designed for ordinary Ghost routes—not for taking control of arbitrary origin-level HTTP responses. Uploading a JSON file as a theme asset does not guarantee publication at the exact `/.well-known/josh` URL. Do not treat a theme asset URL as the protocol resource.

## Why not use routes.yaml?

Ghost’s [dynamic routing][ghost-routing] in `routes.yaml` maps URLs to templates and data. Trailing slashes are required for dynamic routing to function correctly, and Ghost automatically forces trailing slashes. A custom route can set `content_type` (including JSON), but that route still follows Ghost’s trailing-slash rules.

That yields `/.well-known/josh/` (with a trailing slash), not the required `/.well-known/josh`. The trailing-slash form is not a substitute. This recipe therefore serves the resource at the HTTP server or reverse-proxy layer, not through Ghost routing.

## Serve the declaration before Ghost handles the request

Typical request flow:

```text
Visitor or crawler
        |
        v
   HTTPS request
        |
        v
  Nginx or proxy
        |
        +---- /.well-known/josh ---> JSON response
        |
        +---- Other paths --------> Ghost
```

The proxy distinguishes the declaration path from ordinary publication traffic. Everything else continues to the existing Ghost application.

## Inspect the existing Nginx configuration

Before editing, identify the active virtual host for the participating hostname:

- Configured domain name.
- HTTP server blocks (often redirects to HTTPS).
- HTTPS server blocks that proxy to Ghost.
- Existing `location` rules and included files.
- Upstream/proxy_pass target.
- TLS termination and redirect behavior.

Do not replace an entire server block with a small example. Preserve the current Ghost proxy configuration, TLS settings, and security rules.

## Exact-match Nginx example

Add an exact-path location that returns the minimum declaration:

```nginx
location = /.well-known/josh {
    default_type application/json;
    return 200 '{"version":1}';
}
```

`location =` matches that URI path exactly. `default_type` sets the JSON media type. `return 200` sends a successful body. The example uses Undeclared Josh Identity.

For Affirmed, change the body to `'{"version":1,"josh":true}'`. For Declined, use `'{"version":1,"josh":false}'`. Do not change the location path.

Another reverse proxy can implement the same exact-path behavior. This guide does not ship unverified snippets for other servers.

### Why the equals sign matters

Contrast:

```nginx
location = /.well-known/josh
```

with:

```nginx
location /.well-known/
```

The first is an exact URI-path match. The second is a broader prefix match that can intercept unrelated well-known resources (for example WebFinger or domain-verification paths). Prefer the narrow rule. Nginx location matching does not, by itself, validate query strings; the canonical declaration has none.

### Put the location in the correct HTTPS server block

Many self-hosted Ghost installs use one HTTP listener to redirect to HTTPS and another server block to proxy secure traffic to Ghost. Add the declaration location to the HTTPS server block that serves the participating hostname—beside the existing Ghost `location /` proxy, not as a replacement for it.

A server-level redirect on HTTP may prevent a location-specific response from running as you expect if you only edit the wrong block. Leave certificate paths and upstream definitions unchanged.

Minimal shape (placeholders for TLS and Ghost proxy details you already have):

```nginx
server {
    listen 443 ssl http2;
    server_name joshua.example;

    # ... existing TLS and Ghost settings ...

    location = /.well-known/josh {
        default_type application/json;
        return 200 '{"version":1}';
    }

    location / {
        # ... existing Ghost proxy_pass and headers ...
    }
}
```

## Leave Ghost’s existing proxy behavior intact

Ghost depends on correct reverse-proxy headers. Ghost’s documented configuration uses headers such as `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`, and `X-Real-IP`. Incorrect HTTPS forwarding can cause redirect loops. See Ghost’s [reverse-proxy guidance][ghost-proxy].

The declaration’s exact-match location should not modify the normal Ghost proxy configuration. Do not replace working Ghost headers with generic examples from unrelated hosting setups.

## Maintain the declaration as a JSON file (optional)

Some publishers prefer not to embed JSON inside Nginx configuration. An optional approach is an extensionless file served through an exact-match location.

Example using a fictional controlled path (adjust ownership and permissions to your host; this optional pattern is documentation-reviewed, not a live-tested deploy in this repository):

```nginx
location = /.well-known/josh {
    default_type application/json;
    alias /var/lib/joshternet/joshua.example/josh;
}
```

Keep the file readable by the Nginx worker user and writable only by administrators who may update the declaration. Do not introduce a separate application merely to serve one static JSON document.

| Approach | Advantage | Consideration |
| --- | --- | --- |
| Inline Nginx response | Few moving parts | Identity changes require editing proxy configuration |
| File-backed response | JSON can be edited separately | File location and permissions must be managed |

Choose the approach that fits your operations. File-backed is optional.

## Check the configuration before reloading

```sh
sudo nginx -t
```

That checks Nginx configuration syntax. It does not prove the public URL serves correct JSON. If the test succeeds, reload using your host’s process. On many systemd hosts:

```sh
sudo systemctl reload nginx
```

Containers and managed environments may differ. Do not restart Ghost for a change confined to Nginx unless your deployment requires it.

## Check the local proxy

A quick local probe can help, but:

```sh
curl -i http://127.0.0.1/.well-known/josh
```

may hit the wrong virtual host or follow an HTTP-to-HTTPS redirect. For HTTPS configurations, prefer a request that sets the intended Host, for example:

```sh
curl -i --resolve joshua.example:443:127.0.0.1 https://joshua.example/.well-known/josh
```

Bypassing an external CDN tests the origin, not necessarily the final public response. Local success does not replace live verification.

## Verify the live declaration

```sh
curl -i https://joshua.example/.well-known/josh
```

Inspect hostname, status, redirects, final URL, Content-Type, JSON body, integer `version` `1`, optional Boolean `josh`, authentication requirements, and exact pathname.

{% include declaration-verify-ref.html %}

A successful public response matters more than `nginx -t` alone.

### Protocol validation versus ordinary JSON parsing

A valid declaration must be a JSON object with no duplicate member names, include `version` as the integer token `1`, and use a Boolean for `josh` when present. Values such as `"1"`, `1.0`, and `1e0` are not valid version 1 declarations. Use the [declaration checker](/implement/validate/). Do not treat `JSON.parse()` alone as complete protocol validation.

### GET and response headers

RFC-JOSH-0002 defines HTTP GET retrieval. Confirm GET returns the JSON body. HEAD can help with diagnostics but does not replace reading the body. Prefer `Content-Type: application/json`. An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002. Keep additional headers (cache directives, `X-Content-Type-Options: nosniff`) optional and compatible with your existing proxy. Do not disable caching for the entire Ghost site merely to update the declaration.

## What if you’re using Ghost(Pro)?

Ghost(Pro) is managed hosting. Ordinary Ghost Admin access, themes, and `routes.yaml` do not establish control of the web server or reverse-proxy layer that serves the publication. There is no generally verified recipe that publishes the exact `/.well-known/josh` resource from plain Ghost(Pro) Admin alone.

Options depend on plan, domain routing, and external infrastructure. Do not describe ordinary Ghost(Pro) as universally supported or universally impossible—state whether you control a response layer that can answer the exact path.

### Ghost(Pro) with a controlled reverse proxy

If you already operate a reverse proxy or edge layer in front of Ghost(Pro), that layer can answer `/.well-known/josh` while forwarding ordinary publication traffic according to Ghost’s documented proxy requirements (HTTPS, request headers, upstream hostnames, DNS). Follow [Ghost(Pro) subdirectory and proxy help][ghost-pro-proxy] for Ghost-specific rules. Add only the exact-path declaration response on the same proxy. Do not paste Ghost’s full reverse-proxy configuration here or assume a self-hosted Ghost-CLI snippet is correct for Ghost(Pro).

Ghost documents some managed subdirectory and proxy setups as advanced configurations that may be plan-restricted. Do not upgrade a subscription before verifying whether you already control an appropriate response layer. If you lack that control, no generally verified direct recipe is available—do not invent a theme or routes.yaml workaround.

### Serve one resource without rebuilding publication infrastructure

Standing up a complete reverse proxy solely to add one JSON document can affect login, membership, newsletters, media uploads, cookies, redirects, CDN caching, and security controls. Prefer an existing supported edge or proxy when available. Do not introduce a complex proxy as the default for every Ghost(Pro) publisher.

## Ghost installed beneath a subdirectory

{% include declaration-origin-root-note.html %}

This matters especially for Ghost installed beneath a subdirectory or behind a subdirectory reverse-proxy arrangement. The proxy that terminates the origin must expose `/.well-known/josh` at the origin root, not only under the Ghost path prefix. Preserve existing Ghost subdirectory proxy rules while adding the exact declaration location.

## Different hostnames and origins

These are distinct origins:

- `https://joshua.example/`
- `https://www.joshua.example/`
- `https://blog.joshua.example/`

A declaration on one does not establish participation for another. Cross-origin redirects do not substitute for publishing on each origin you intend to declare.

## Don’t take over the entire `.well-known` directory

Other standards may already use well-known paths (WebFinger, security contacts, domain verification). Answer only `/.well-known/josh`. Do not introduce a broad `/.well-known/` handler unless you intentionally manage that entire namespace. Verify unrelated well-known URLs after the change.

## Test the Ghost website after the change

After enabling the declaration, spot-check:

- Homepage and an article or static page.
- Ghost Admin.
- Theme assets and images.
- RSS feed and sitemap.
- Login and membership, where applicable.
- Other existing well-known resources.

A successful declaration response is not enough if the proxy change disrupts the publication. Do not change Ghost application settings as a substitute for fixing an Nginx location rule.

## Updates, caching, and security

For inline Nginx JSON, update the `return` body, run `nginx -t`, and reload. For a file-backed file, replace the file (and reload only if your setup requires it). CDN and browser caches may briefly show an older response.

The declaration is deliberately public—do not put secrets in it. Prefer narrow path matching, sensible file permissions, configuration backups, and safe reloads. Do not weaken Ghost’s security configuration to make the declaration accessible.

## Rollback

Before editing, preserve a copy of the working proxy configuration. If testing fails:

1. Restore the previous configuration.
2. Run `sudo nginx -t`.
3. Reload the proxy.
4. Verify Ghost still works.
5. Recheck the declaration URL.
6. Record the failure before trying again.

Do not delete the entire Ghost configuration, reinstall Ghost, or rebuild the server to undo a bad declaration location.

{% capture stop_steps %}
1. Remove the exact-match location (and any file-backed declaration file you no longer need).
2. Remove host rules that exist only for that path, if any.
3. Run `sudo nginx -t`, then reload Nginx by your host’s process.
4. Confirm ordinary Ghost pages and Admin still work.
5. Request `https://joshua.example/.well-known/josh` again—another layer may still answer the path.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| 404 response | Exact location missing or wrong virtual host |
| 301 or 302 to a trailing slash | Ghost or host routing handles the request |
| Homepage HTML returned | Request reaches Ghost instead of the exact handler |
| Wrong Content-Type | Incorrect Nginx response configuration |
| Valid JSON on localhost but not publicly | CDN, proxy, or virtual-host mismatch |
| Wrong identity declaration | Inline JSON or file contains the wrong value |
| Different behavior on `www` | Distinct origin configuration |
| HTTP works but HTTPS fails | Location configured in the wrong server block |
| Ghost redirects repeatedly | Proxy header or HTTPS configuration issue |
| Ghost Admin stops working | Existing proxy rules were modified |
| Other `.well-known` resources fail | Location rule is too broad |
| Ghost(Pro) cannot serve the endpoint | No control of the required response layer |
| Old response remains visible | Cache or stale configuration |
| Invalid JSON | Syntax or protocol-value error |
| Nginx reload fails | Configuration syntax error |

Inspect which layer answered (`curl -i`, CDN vs origin) before changing Ghost application settings.

## Tested

- Platform: Ghost behind Nginx exact-path `location = /.well-known/josh`
- Verified: 2026-10-06
- Evidence: recipe and documentation review of exact-path Nginx responses and Ghost trailing-slash routing (not a live Ghost+Nginx deployment in this repository). Ghost(Pro) is not claimed tested.
- Protocol: RFC-JOSH-0002 version 1

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Ghost reverse proxy / HTTPS loops][ghost-proxy]
- [Ghost dynamic routing][ghost-routing]
- [Ghost(Pro) subdirectory and proxy help][ghost-pro-proxy]
- [Ghost(Pro) plans](https://ghost.org/pricing/)
- [Nginx web server](https://docs.nginx.com/nginx/admin-guide/web-server/web-server/), [HTTP core module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
[ghost-proxy]: https://ghost.org/docs/faq/proxying-https-infinite-loops/
[ghost-routing]: https://docs.ghost.org/themes/routing
[ghost-pro-proxy]: https://ghost.org/help/run-ghost-from-a-subdirectory/
