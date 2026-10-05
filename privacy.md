---
layout: default
title: Privacy and Analytics on joshternet.org
description: >-
  Privacy information for joshternet.org, including how the hub uses
  privacy-focused web analytics, what outbound links send to other sites, and
  what is—and is not—collected about visitors.
keywords: >-
  Joshternet privacy, analytics, Umami, visitor data, independent websites
permalink: /privacy/
---

# Privacy

The Joshternet is a network of independently operated websites. This page describes joshternet.org, the public hub. It does not replace the privacy practices of participating sites.

The hub does not require an account to read this site, browse the Network, or implement the specifications.

## Analytics

joshternet.org uses [Umami Cloud][umami] to understand aggregate website traffic and how people use the hub.

The site uses Umami's standard web analytics tracker and does not use Umami's optional visitor-identification or custom session-data features.

Umami's standard tracker does not use cookies. It records information needed for aggregate traffic analytics, including the page visited, referring URL, browser language, screen dimensions, and website identifier. Umami also reports browser, operating system, device, and geographic information.

Umami's documentation states that sessions are identified anonymously using a hash generated from the visitor's IP address, user agent, and website identifier. joshternet.org does not assign Distinct IDs or send names, email addresses, account identifiers, or other custom visitor information to Umami.

The Joshternet does not use this analytics data for advertising, behavioral targeting, or selling information about visitors.

## Referrers and outbound links

joshternet.org links to participating websites, their feeds and published profiles, and a few project destinations such as GitHub and the #joshternet channel. Those clicks are meant to be visible as Joshternet referrals in the destination's own analytics.

**HTTP `Referer` header.** Cross-origin navigations send the hub origin (`https://joshternet.org`) so destination analytics can see Joshternet without receiving the hub path, query string, or fragment. HTTPS-to-HTTP navigations send no `Referer`. Remote images and Wander iframe previews send no `Referer`.

**URL parameters.** Outbound `https:` links from the hub also append:

- `utm_source=joshternet.org`
- `utm_medium=referral`
- `utm_campaign` — the hub section (for example `network`, `topics`, `search`)
- `utm_content` — the hub page path (for example `/network/`), never the Search query string or Network filter query

Those parameters stay on the destination URL so analytics can attribute which hub page sent the visit. `http:`, `mailto:`, same-origin hub links, and IndieWeb `rel="me"` identity links (the homepage GitHub profile) are not rewritten. Images and Wander iframe previews do not receive UTM parameters.

**Official Joshternet button.** When someone clicks the official button on a participating site, the browser may send that site's origin (not the full page path) as `Referer` to joshternet.org. Umami may record that origin as the referring URL. The button does not add UTM parameters to hub URLs.

Once you leave joshternet.org, that destination's own data practices apply. The Joshternet does not operate members' analytics.

## Independent websites

Participation is declared per origin at `/.well-known/josh`. The hub lists participating sites and publishes derived Network, Topics, Connections, and activity views from public pages and feeds. That listing is not control of those websites.

JoshBot, registries, and other independently operated services have their own practices. Crawler identity and retention for JoshBot are documented on [JoshBot](/joshbot/).

## Questions

Questions about this site's privacy practices may be sent to [hello@joshternet.org](mailto:hello@joshternet.org).

[umami]: https://umami.is/platform
