---
layout: default
title: Privacy on Joshternet-operated services
description: >-
  What Joshternet-operated services collect and send: hub analytics, outbound
  referrers, official buttons, nominations, JoshBot, Wander, and providers.
keywords: >-
  Joshternet privacy, analytics, Umami, buttons, Turnstile, JoshBot,
  independent websites
permalink: /privacy/
seo:
  type: WebPage
  name: Privacy
---

# Privacy

## Hub hosting and analytics

joshternet.org is a public website hosted on GitHub Pages. GitHub may see ordinary connection details when you load the site. See the [GitHub Privacy Statement][github-privacy].

The hub uses [Umami Cloud][umami] for overall traffic counts—how many people opened a page, not who they are. Umami’s standard tracker does not use cookies. It records the page opened, the previous site if the browser sends one, browser language, screen size, and which Joshternet site the tracker belongs to. It also reports browser, operating system, device type, and a coarse location.

Umami groups visits with an anonymous hash built from IP address, browser software, and the site identifier. We do not send names, email addresses, account IDs, or other personal labels to Umami. How long Umami Cloud keeps data is their setting, not ours; see [Umami’s platform documentation][umami] and [Umami privacy information][umami-privacy].

The Joshternet does not use this analytics data for advertising, targeting people, or selling information about visitors.

## Official buttons

Some sites show an official Joshternet button. The button service checks whether a website origin, such as `https://example.com`, appears in the public Joshternet registry.

The Button State service receives the normalized website origin. It compares that origin with the public Joshternet registry and returns the appropriate button state.

The Button State service **does not visit** the supplied website and does not retrieve that site’s `/.well-known/josh` resource as part of this lookup.

The Joshternet service may cache registry and state information for approximately five minutes to reduce repeated registry work.

The current Button State application does not write submitted lookup origins to a Joshternet application database. Requests still pass through the infrastructure that operates the service, and infrastructure providers may process or retain ordinary connection, security and operational information under their own policies.

Using the official browser embed or the WordPress plugin’s optional Joshternet button triggers a Button State lookup.

Publishing `/.well-known/josh` by itself does not call the Button State service.

With the official browser embed, the visitor’s browser makes the request.

With the WordPress plugin’s `[joshternet_button]` shortcode, the WordPress server makes the request. The plugin sends the site’s normalized origin and currently caches the returned button state locally in WordPress for up to 15 minutes.

The WordPress plugin serves its bundled button image locally and does not load a remote button image or Joshternet script into the visitor’s page.

Button behavior for site owners is documented on [Buttons](/implement/buttons/).

## When you follow a link

joshternet.org links to participating websites, their feeds and published profiles, and a few project destinations such as GitHub and the #joshternet channel. Those clicks are meant to show up as Joshternet referrals in the other site’s own analytics.

**What the other site can see as the referrer.** When you open a link to another https site, the browser typically tells that site you came from `https://joshternet.org`—the hub as a whole, not which hub page you were on, and not search or filter text. (Some tools label that the `Referer`.) Links from https to plain http send no referrer. Pictures hosted elsewhere and Wander previews also send none.

**Labels on the link.** Outbound https links from the hub also add these tags so analytics can tell which hub page sent the visit:

- `utm_source=joshternet.org`
- `utm_medium=referral`
- `utm_campaign` — the hub section (for example `network`, `topics`, `search`)
- `utm_content` — the hub page path (for example `/network/`), never Search text or Network filters

Ordinary http links, email links, links that stay on this hub, and the homepage GitHub identity link (`rel="me"`) are left alone. Pictures and Wander previews do not get these tags.

**Official Joshternet button clicks.** When someone clicks the official button on a participating site, the browser may tell joshternet.org which **site** they came from, not the full page address. Umami may record that site as the referring URL. The button does not add UTM tags to hub URLs.

Once you leave joshternet.org, that destination’s own data practices apply. The Joshternet does not run members’ analytics.

## Nominating a site

The nominate form sends a website address, a statement that you are allowed to nominate it, and a Cloudflare Turnstile anti-spam token. The service **does not visit** the nominated website. It stores the site address, status, and times. The attestation is required to submit; it is **not stored** as its own field. Cloudflare’s anti-spam check may receive the connecting IP. See Cloudflare’s [Turnstile Privacy Addendum][turnstile-privacy] and [Privacy Policy][cloudflare-privacy].

A stored address may later be considered as a JoshBot discovery seed. That later crawl is JoshBot, not this form.

## Checking a declaration

The [declaration checker](/implement/validate/) may fetch **only** that website’s `/.well-known/josh` file. It is not JoshBot. Visitor IP and the site being checked are used to limit abuse. We do not keep a project database of those checks.

## JoshBot and the public registry

JoshBot is the discovery and registry crawler. Who it is, what is kept, and what is not archived are on [JoshBot](/joshbot/) and in JoshBot’s [retention notes][joshbot-retention]. Short-lived crawl telemetry is cleaned on a limited schedule (about 30 days by default). Lasting participation facts are kept longer. JoshBot is not a web archive and does not train models on crawled pages.

The public registry snapshot is published in [joshternet/index-data][index-data]. It contains information derived from successfully verified declarations. Private discovery, queue, and telemetry state are not published there. License and format-version policy for that repository are documented there.

JoshBot also publishes public keys so other systems can recognize the crawler. That is bot identity, not visitor analytics. Details are on [JoshBot](/joshbot/).

## Wander, images, search, and OPML

Wander opens an embeddable participant site in a preview in your browser. That site follows its own practices. The preview is isolated from this hub: it can run the framed site’s own scripts, but it cannot use this hub’s cookies or storage. Wander remembers which sites you already saw in this browser tab until you close it.

Activity images do not send a referrer. The image host may still see IP address and browser software.

Search uses a list of pages from this same website. It is not a third-party search product.

The hub publishes a public blogroll of participant feed addresses found on public pages.

## Webmentions

Pages may advertise a Webmention endpoint at [webmention.io][webmention] for joshternet.org. Browsing the hub does not send a Webmention. Sending or receiving one is a separate, intentional request handled by that service.

## Independent websites

Participating sites keep their own privacy practices. Participation is declared per website at `/.well-known/josh`. The hub publishes Network, Topics, Connections, and activity views from public pages and feeds.

## Choices

Operators can use `robots.txt` as described on [JoshBot](/joshbot/). A nomination stores the site address for possible later JoshBot consideration.

## Providers

Joshternet chooses infrastructure providers for Joshternet-operated services according to the [Joshternet Infrastructure Principles](/infrastructure/). Those principles guide Joshternet’s own provider relationships; they do not replace each provider’s Terms or Privacy Policy.

We link provider policies rather than copying them:

- [Umami platform][umami] and [Umami privacy][umami-privacy]
- [Cloudflare Privacy Policy][cloudflare-privacy] and [Turnstile Privacy Addendum][turnstile-privacy]
- [GitHub Privacy Statement][github-privacy]
- [webmention.io][webmention]

Third-party software and brand marks used on this hub are listed on [Third-party licenses](/licensing/third-party-licenses/).

Infrastructure operators may keep ordinary connection logs (IP, browser software, timestamps) under their own policies. Joshternet does not publish those logs.

## Questions

[hello@joshternet.org](mailto:hello@joshternet.org). Security reports: [Security](/security/).

Effective 5 October 2026. Last updated 5 October 2026.
{: .legal-dates}

[umami]: https://umami.is/platform
[umami-privacy]: https://umami.is/privacy
[github-privacy]: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement
[turnstile-privacy]: https://www.cloudflare.com/turnstile-privacy-policy/
[cloudflare-privacy]: https://www.cloudflare.com/privacypolicy/
[joshbot-retention]: https://github.com/joshternet/joshbot/blob/main/docs/retention.md
[index-data]: https://github.com/joshternet/index-data
[webmention]: https://webmention.io/joshternet.org/webmention
