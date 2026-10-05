---
layout: default
title: Terms of Service for Joshternet-operated services
description: >-
  Terms of Service for joshternet.org and other Joshternet-operated services.
  Independent participating websites keep their own terms. Hub source licensing
  is separate.
keywords: >-
  Joshternet terms of service, joshternet.org, operated services, independent
  websites
permalink: /terms/
seo:
  type: WebPage
  name: Terms of Service
---

# Terms of Service

Use joshternet.org and other Joshternet-operated services under these rules. Independent participating sites keep their own.

## Scope

These terms cover the public hub, the supporting services that run official buttons, declaration checks, nominations, and JoshBot’s public identity, and JoshBot as operated for the Joshternet.

They do not cover independently operated participating websites. Listing a site is not endorsement, partnership, or control. The [Joshternet specifications](https://github.com/joshternet/spec) keep their own licenses; implementing them does not put a site under these terms.

## Use of the hub

The hub is a public directory and documentation site. You may read it, link to it, and use the public services documented on the hub, subject to rate limits and abuse controls.

Do not use Joshternet-operated services to attack, probe, or overload other people’s systems beyond the documented checker and crawler behavior. Do not submit nominations for websites you are not authorized to represent. Do not try to skip the anti-spam check, origin allowlists, or rate limits.

Public information on the hub (Network listings, topics, activity snippets, OPML) is derived from public pages and feeds. Treat it as a snapshot, not a guarantee of completeness or freshness.

## Participation and JoshBot

Participation is declared per website at `/.well-known/josh`. Joshness is declared, never inferred. Nominating a site asks JoshBot to consider that website as a discovery seed; it does not enroll the site as a participant by itself.

JoshBot crawls according to the identity and robots rules on [JoshBot](/joshbot/). Crawling and participation are separate. A robots rule that blocks JoshBot is not a statement about Josh identity.

## Official buttons

The official button asks the hub whether a **website** (not a page) is listed in the public registry. Site owners may use the official embed or the WordPress plugin’s Joshternet button. If that check is down, the button should not claim a verified listing. It is not a license, and you do not need it in order to publish `/.well-known/josh`. Details for site owners are on [Buttons](/implement/buttons/).

## Availability

Services are provided as-is, without uptime promises. Buttons, checks, and nominations may fail, return an empty state, or be turned off. We may change, slow down, or withdraw operated services.

## Infrastructure

Joshternet may choose, change, or discontinue infrastructure providers used to operate Joshternet services. The [Joshternet Infrastructure Principles](/infrastructure/) guide those choices. Those principles apply to Joshternet-operated infrastructure and Joshternet’s own provider relationships. They do not dictate which hosting, CDN, analytics, DNS, email, or other infrastructure independently operated participating websites may use.

## Licenses and third-party material

Project-owned website **code** is BSD-3-Clause. Joshternet-authored **prose and documentation** are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Joshternet **name and brand marks** are not open-licensed; no trademark license is granted. Details are on [Licensing](/licensing/).

Third-party software and brand marks used on this hub are listed on [Third-party licenses](/licensing/third-party-licenses/). Participant websites, screenshots, and their content remain theirs.

Public registry files live in [joshternet/index-data](https://github.com/joshternet/index-data). Reuse terms for that data belong in that repository.

## Privacy and security

Privacy for operated services is described on [Privacy](/privacy/). Vulnerability reporting is on [Security](/security/).

## Contact

[hello@joshternet.org](mailto:hello@joshternet.org)

Effective 5 October 2026. Last updated 5 October 2026.
{: .legal-dates}
