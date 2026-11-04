---
layout: default
title: Publish /.well-known/josh with WordPress
description: >-
  Publish a Joshternet /.well-known/josh declaration from WordPress using the
  official Joshternet plugin—covering Settings, the virtual endpoint, Multisite,
  the optional button, and public verification.
keywords: >-
  WordPress, Joshternet plugin, /.well-known/josh, Joshternet declaration,
  Multisite, joshternet_button
seo:
  type: TechArticle
  name: WordPress
permalink: /implement/platforms/wordpress/
nav_title: WordPress
---

# Publish with WordPress

WordPress publishers can participate in Joshternet by installing the officially published Joshternet plugin. The plugin gives an independently operated WordPress site a way to publish its own declaration without creating a physical `.well-known` file or editing the theme, Apache, Nginx, or document root.

WordPress serves the declaration when the plugin is active, participation is enabled, and the request reaches the WordPress application. Installing and activating the plugin alone does **not** declare Josh identity or establish participation—you choose whether to participate and whether to affirm, decline, or leave Josh identity undeclared.

This guide is a practical procedure for existing WordPress sites. Other methods are possible—see the [Platforms](/implement/platforms/) directory. Do not expand this recipe into custom PHP when the maintained plugin already provides the endpoint.

## Before you begin

You should have:

- A WordPress website (WordPress **6.0+**, PHP **7.4+**).
- Permission to install and activate plugins.
- Control of the intended website origin.
- Access to WordPress administration.
- A way to test the public URL.

A conventional installation where WordPress already receives `/.well-known/josh` does not need FTP, SSH, or web-server edits. A host that intercepts that path may still need routing control. Plugin activation does not override every hosting-level restriction.

WordPress.com and other managed hosts are only recommended when a live check on that host has been proven—this recipe does not claim those environments yet.

## Install the Joshternet plugin

Install [Joshternet][plugin-directory] from the WordPress.org plugin directory. In wp-admin, search for Joshternet and install it, or use the directory page. Releases are published on WordPress.org.

The [source repository][plugin-source] remains available. It is not the release channel. Prefer the published WordPress.org package for production; use GitHub for development, issues, and source inspection—not as a substitute release channel when the directory package is available.

Published plugin version **0.1.1** declares minimum WordPress 6.0 and PHP 7.4 (GPLv2 or later). “Tested up to” on WordPress.org is a compatibility claim, not proof of every managed host.

### Install through WordPress administration

1. Sign in to WordPress administration.
2. Open **Plugins → Add Plugin**.
3. Search for Joshternet.
4. Confirm the plugin name and publisher.
5. Install and activate the official plugin.
6. Open **Settings → Joshternet**.
7. Review participation and identity settings.
8. Enable participation.
9. Save the settings.
10. Open the published endpoint and verify the response.

Exact UI wording may vary by WordPress version. Do not require a ZIP upload when ordinary directory installation is available. See [Manage plugins](https://wordpress.org/documentation/article/manage-plugins/).

## Participation is your decision

Participation is stored in the plugin option `joshternet_enabled` and defaults to **disabled**. Installation and activation alone do not publish a Joshternet declaration.

Enable the setting labeled **Publish the Joshternet declaration for this origin.** When enabled, the plugin can serve the declaration through WordPress. When disabled, the plugin stops publishing its own response. Another server-level handler could still serve the same URL, so public verification remains necessary. Do not equate plugin installation with participation.

Saving the settings publishes the endpoint. No separate build step.

## Choose whether to declare Josh identity

The settings screen provides:

| Setting | Public declaration |
| --- | --- |
| Do not declare Josh identity | `{"version":1}` |
| Affirm Josh identity | `{"version":1,"josh":true}` |
| Decline Josh identity | `{"version":1,"josh":false}` |

Internal WordPress values are `undeclared`, `affirmed`, and `declined`. Those are configuration labels, not JSON protocol values—the plugin converts them into the correct declaration object.

Declined Josh Identity is **not** refusing participation. All three identity states are compatible with active participation.

## Choose your declaration

The minimum valid version 1 declaration is:

```json
{
  "version": 1
}
```

That establishes participation with Undeclared Josh Identity. The plugin publishes this representation when participation is enabled and identity remains undeclared.

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

The `josh` property must be a JSON Boolean when present. The `version` value must be the JSON integer token `1`. Do not invent profile, feed, or verification fields. Never infer Josh identity from a WordPress username, author profile, or domain.

{% include declaration-identity-ref.html %}

## WordPress serves the declaration directly

The plugin does not create a physical `.well-known` file on disk. WordPress answers `/.well-known/josh` itself.

The implementation recognizes the intended request (via WordPress’s `parse_request` hook) and returns JSON through WordPress. That avoids requiring a writable document root. Do not modify the theme or hand-install a PHP route for a conventional setup.

### Exact path

The plugin’s endpoint matches `/.well-known/josh`: exact filename `josh`, no `.json` extension, no trailing slash, no additional path segments. Query-string variants are not the canonical endpoint. A WordPress page at `/josh/` is not equivalent.

### What the endpoint returns

When participation is enabled and the request is eligible, the plugin supports GET and HEAD. A normal GET returns HTTP 200 with JSON, typically:

- `Content-Type: application/json; charset=UTF-8`
- `Cache-Control: public, max-age=300, must-revalidate`
- `X-Content-Type-Options: nosniff`

HEAD returns headers without the body. Unsupported methods that reach the plugin’s handler receive HTTP 405 with an appropriate `Allow` header. Caches, proxies, and hosting rules can still intercept or alter the public response—plugin-level behavior is not a guarantee of every host. An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002.

### No manual permalink configuration is normally required

The plugin does not depend on registering a new permalink rewrite rule for ordinary setup. Do not flush rewrite rules or resave **Settings → Permalinks** as a universal installation step. Resaving permalinks can help some WordPress routing problems, but it is troubleshooting—not required setup. Do not add custom `.htaccess` rewrites without identifying a real host-level routing problem. See [WordPress rewrite](https://developer.wordpress.org/apis/rewrite/).

## How the request reaches the plugin

```text
Visitor or crawler
        |
        v
 HTTPS web server
        |
        v
 WordPress routing
        |
        v
 Joshternet plugin
        |
        v
 JSON declaration
```

The virtual endpoint works only when the host routes the intended request into WordPress. A web server may instead serve a physical file, return 404, redirect, apply a security rule, or send the path elsewhere. The plugin cannot rewrite external hosting configuration.

## Check what WordPress publishes

The settings screen shows the intended endpoint URL and a preview of the declaration. That preview is useful but not sufficient proof of public delivery.

```sh
curl -i https://joshua.example/.well-known/josh
```

Confirm the correct hostname and path (no `.json`, no trailing slash), HTTP status, headers, JSON body, integer `version` `1`, optional Boolean `josh`, no unexpected redirect, no authentication requirement, and no HTML fallback.

{% include declaration-verify-ref.html %}

Use [Check a declaration](/implement/validate/) for protocol-level checks. Publishing declares participation. It does not separately notify JoshBot or require registration with joshternet.org. Ordinary `JSON.parse()` is not complete RFC-JOSH-0002 validation.

{% include declaration-origin-root-note.html %}

## One declaration belongs to one origin

WordPress Multisite can manage multiple sites in one installation. Joshternet declarations belong to web **origins**, not WordPress database site records. See [Multisite](https://developer.wordpress.org/advanced-administration/multisite/) and [domain mapping](https://developer.wordpress.org/advanced-administration/multisite/domain-mapping/).

### Path-based Multisite

Sites such as `https://joshua.example/site-a/` and `https://joshua.example/site-b/` share one origin. The canonical declaration is `https://joshua.example/.well-known/josh`. The plugin detects when a subsite shares the main site’s origin, warns administrators, and does not independently serve a competing origin-root declaration for that child site. Configure the shared declaration on the main site. Do not publish different declarations under each subsite path.

### Subdomains and mapped domains

Distinct hostnames are generally distinct origins (for example `https://josh.joshua.example/` versus `https://www.joshua.example/`). Subdomain and domain-mapped Multisite sites can publish independently when origins differ. Verify that each origin-root request reaches the appropriate WordPress site. Do not infer Josh identity from a mapped domain.

### WordPress installed below the origin root

For a site at `https://joshua.example/blog/`, the required declaration remains `https://joshua.example/.well-known/josh`. The plugin’s settings screen warns when the public homepage uses a subdirectory. The web server must route the origin-root request into WordPress. `https://joshua.example/blog/.well-known/josh` does not replace the canonical resource. Do not move the installation merely to silence the warning.

## WordPress.org, WordPress.com, and managed hosting

**WordPress.org** provides the open-source software and the official plugin directory. **WordPress.com** is a managed service with plan-specific features.

The Joshternet plugin is distributed through WordPress.org. Current WordPress.com documentation allows third-party plugin installation on paid plans (including Personal and above); free plans do not. See [Install a plugin](https://wordpress.com/support/plugins/install-a-plugin/). Eligibility to install a plugin does **not** prove that WordPress.com routes `/.well-known/josh` to the plugin correctly. This recipe does not claim WordPress.com endpoint compatibility without a live verified deploy.

Other managed WordPress hosts (for example WP Engine, Kinsta, Pressable, Cloudways) may impose their own routing, caching, and security. The plugin avoids filesystem and server-config writes to stay portable, but each environment must be validated independently. Do not treat an unverified compatibility matrix as fact.

## Show your Joshternet connection on your website

The plugin includes an optional shortcode:

```text
[joshternet_button]
```

Place it in a post or page (a Shortcode block works). It can display the official Joshternet button when an appropriate registry state is available. The button is **not** required for participation and is not part of RFC-JOSH-0002. Publishing the declaration does not automatically add the shortcode to a theme. See also [Buttons](/implement/buttons/).

### The declaration and the button answer different questions

The declaration answers whether this origin currently publishes a valid participation declaration. The optional button asks the Joshternet registry for the known state of the origin. A valid declaration may exist before the registry has observed it. A temporary registry lookup failure does not prove the declaration was removed. Do not treat a missing button as nonparticipation.

### What happens when you enable the button?

The shortcode uses the Joshternet Button State service at `https://joshternet.org/api/button-state`. When a page with the shortcode renders and there is no usable cached result, WordPress may send a server-side HTTPS GET including the site’s normalized origin and a plugin-identifying User-Agent. Button images are bundled locally—the visitor’s browser does not load a remote Joshternet image or script.

Publishing `/.well-known/josh` does **not** contact joshternet.org. The optional button is the feature that performs this separately disclosed lookup.

### Privacy

Based on the published plugin documentation, the lookup sends the normalized origin (and User-Agent). Ordinary connection metadata such as the WordPress server’s IP may be visible to the service. The documented request does not send WordPress usernames, emails, posts, comments, visitor identities, cookies, analytics IDs, the visitor’s page URL, or the declaration JSON body. Review [Joshternet Privacy](https://joshternet.org/privacy/), [Terms](https://joshternet.org/terms/), and WordPress’s [Privacy Policy Guide](https://developer.wordpress.org/plugins/privacy/suggested-text-for-site-privacy-policy/) suggestions when enabling the button.

### Why the button may not update immediately

Successful Button State results are cached locally for up to six hours; failed or invalid lookups for 15 minutes. Settings changes clear the relevant cache, but the external registry may not yet reflect a new declaration. Do not promise immediate visual updates after saving WordPress settings.

When the service is unavailable or returns an unusable result, the shortcode renders no button—avoiding a misleading Join state. Verify `/.well-known/josh` separately.

## What the plugin does not do

The current plugin does not create a physical `.well-known` file, modify Apache or Nginx, rewrite the document root, register the site with joshternet.org, guarantee crawler discovery, crawl other sites, mirror content, create a Joshternet account, require JavaScript, or send declaration telemetry when publishing the endpoint. The optional button performs its separately disclosed registry lookup.

## Updates and maintenance

Update through WordPress administration from the WordPress.org release channel. After updates, confirm settings, recheck the public declaration, and retest the optional button if used. A GitHub commit is not necessarily a published release. Do not install development ZIPs on production without an explicit testing reason.

## Stop participating while keeping the plugin installed

Open **Settings → Joshternet** and disable participation. The plugin then stops serving its own declaration. That differs from choosing Declined Josh Identity, which still represents participation when the declaration is enabled. Recheck the public endpoint afterward—another handler could still serve a valid declaration.

{% capture stop_steps %}
1. Disable participation in **Settings → Joshternet**, or deactivate the plugin.
2. If uninstalling, delete the plugin through WordPress administration so its options and button cache cleanup can run as documented.
3. Remove any host rules that exist only for `/.well-known/josh`, if any.
4. Confirm ordinary WordPress pages still work.
5. Request `https://joshua.example/.well-known/josh` and verify the live response no longer returns a valid declaration (watch for caches or alternate handlers).
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

Deactivation stops the handler. Uninstall cleanup follows the plugin’s documented option and cache removal. Public verification remains necessary.

## Security considerations

If a security plugin, WAF, CDN, or caching layer intercepts the declaration URL, prefer a narrowly scoped allowance for the public path. Do not disable sitewide security or authentication merely to expose one endpoint. Do not expose private administrative URLs.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| Plugin installed, endpoint missing | Participation not enabled |
| 404 after enabling | Request never reaches WordPress |
| HTML instead of JSON | WordPress or hosting fallback |
| Redirect to trailing slash | Hosting or URL normalization |
| Authentication required | Access-control or security plugin |
| Wrong identity value | Incorrect setting or cached response |
| WordPress.com endpoint unavailable | Managed-host routing (not claimed tested here) |
| Path-based Multisite cannot configure | Origin belongs to main site |
| Subdomain differs | Separate origin or host mapping |
| Site under `/blog/` cannot serve root | Host does not route into WordPress |
| Wrong Content-Type | Response intercepted or modified |
| Old declaration after disabling | Cache or alternate handler |
| Button missing | Registry lookup unavailable |
| Button outdated | Cached registry result or registry freshness |
| Settings not visible | Permissions or plugin not activated |
| Other pages fail | Unrelated routing or hosting issue |

Identify the responsible layer before flushing permalinks, disabling security plugins, or editing `.htaccess`.

## Tested

- Platform: WordPress + Joshternet plugin 0.1.1
- Verified: 2026-10-06
- Evidence: recipe plus published plugin 0.1.1 / WordPress.org listing and documented capability review (settings, virtual endpoint, Multisite origin handling, optional button external-service disclosure)—not a live WordPress.com or managed-host deploy survey, and not a claim that every host routes `/.well-known/josh` into WordPress. Host routing and MIME behavior must still be verified per environment.
- Protocol: RFC-JOSH-0002 version 1

## References

- [Joshternet WordPress plugin (WordPress.org)][plugin-directory]
- [Joshternet WordPress source][plugin-source]
- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [Buttons](/implement/buttons/), [declaration checker](/implement/validate/)
- [Manage plugins](https://wordpress.org/documentation/article/manage-plugins/), [Rewrite API](https://developer.wordpress.org/apis/rewrite/), [Multisite](https://developer.wordpress.org/advanced-administration/multisite/), [Domain mapping](https://developer.wordpress.org/advanced-administration/multisite/domain-mapping/)
- [WordPress.com install a plugin](https://wordpress.com/support/plugins/install-a-plugin/), [Privacy Policy Guide](https://developer.wordpress.org/plugins/privacy/suggested-text-for-site-privacy-policy/)
- [Joshternet Privacy](https://joshternet.org/privacy/), [Terms](https://joshternet.org/terms/)
- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

[implement]: /implement/
[plugin-directory]: https://wordpress.org/plugins/joshternet/
[plugin-source]: https://github.com/joshternet/wordpress/
