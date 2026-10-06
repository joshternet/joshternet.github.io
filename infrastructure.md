---
layout: default
title: Joshternet Infrastructure Principles
description: >-
  Standards Joshternet uses when selecting infrastructure providers for
  Joshternet-operated services. These principles do not control independently
  operated participating websites.
keywords: >-
  Joshternet infrastructure, providers, privacy, security, hosting, Cloudflare,
  GitHub, Umami
permalink: /infrastructure/
seo:
  type: WebPage
  name: Joshternet Infrastructure Principles
---

# Joshternet Infrastructure Principles

These principles describe how Joshternet selects and retains infrastructure providers for Joshternet-operated services such as joshternet.org, Button State, declaration checks, nominations, analytics, and related operated systems.

## Independent websites stay independent

These principles govern infrastructure selected by Joshternet for Joshternet-operated services. They do not determine which hosting companies, CDNs, analytics services, registrars, email providers, cloud platforms, or other infrastructure an independently operated participating website may use.

A website is not excluded from Joshternet participation merely because Joshternet would not choose that website’s infrastructure provider for Joshternet-operated services.

Do not treat this page as an approved-provider list for participants. Joshternet does not require participants to migrate infrastructure or to disclose their vendors to Joshternet.

## Scope

These principles apply when Joshternet chooses a provider in categories such as:

- hosting
- CDN and edge services
- DNS
- source and deployment hosting
- analytics
- databases
- object storage
- email delivery
- anti-abuse systems
- CAPTCHA or bot protection
- monitoring
- logging
- Webmention infrastructure
- third-party APIs
- future managed infrastructure services

Not every category is in use today. The list describes when the principles apply, not a claim that Joshternet currently buys every service type.

## Principles

### 1. Data minimization

Joshternet should prefer providers that process only the information reasonably necessary to provide the service.

Provider review should consider what data is sent, why it is needed, whether less data could be sent, how long it is retained, and whether Joshternet can control or reduce retention.

Joshternet should avoid providers whose service requires unnecessary collection unrelated to the service being provided.

### 2. No sale or behavioral advertising use

Joshternet should not knowingly choose infrastructure providers whose intended use of Joshternet service data includes selling Joshternet service data, selling visitor profiles created from Joshternet service data, cross-service behavioral advertising based on Joshternet service data, or undisclosed commercial profiling unrelated to providing the service.

This is a selection requirement for Joshternet. It is not a claim about every provider on the Internet.

### 3. AI and model-training use

Joshternet should not intentionally provide private Joshternet service data to an infrastructure provider for training generalized AI or machine-learning models unless Joshternet explicitly agrees to that specific use after review.

This principle applies to data Joshternet intentionally supplies to its infrastructure providers under a provider relationship. It does not claim ownership of independent participant websites, participant-created content, or the public web, and it does not claim to control how the public Internet may be crawled.

Intentionally public Joshternet content remains public.

### 4. Security

Providers should maintain reasonable security appropriate to the service.

Review should consider encryption in transit, authentication, access control, credential handling, vulnerability response, incident response, infrastructure isolation where applicable, and a supported security contact or escalation process.

Joshternet does not prescribe one technical architecture to every provider.

### 5. Incident transparency

Joshternet should prefer providers whose terms or security documentation provide a meaningful process for security or privacy incident notification.

Joshternet should be able to respond when a provider experiences a material incident affecting Joshternet information or services.

This page does not promise notification timing that provider contracts do not guarantee.

### 6. Retention and deletion controls

Joshternet should consider provider retention periods, whether retention can be configured, whether service data can be deleted, whether backups have documented lifecycle behavior, and whether Joshternet can stop future collection when the service is no longer used.

Not all infrastructure data can be immediately or absolutely erased.

### 7. Subprocessor transparency

Where relevant, Joshternet should prefer providers that disclose material subprocessors or categories of subprocessors so Joshternet can understand where Joshternet-operated service data may travel.

Independent participant websites are not required to disclose their vendors to Joshternet.

### 8. Portability and exit

Provider selection should consider whether Joshternet can leave.

Where technically applicable, Joshternet should prefer services that provide reasonable data export, configuration export, standards-based interfaces, migration paths, source portability, or backup capability.

Joshternet should avoid infrastructure choices where practical exit becomes impossible solely because Joshternet cannot retrieve its own data.

### 9. No undisclosed secondary use

Joshternet should avoid knowingly using providers whose terms grant broad, unrelated secondary rights over private Joshternet service data.

Provider rights necessary to host, transmit, cache, secure, back up, or operate the service are expected. Broad unrelated reuse should receive additional scrutiny.

### 10. Abuse protection with minimization

Joshternet-operated services may use rate limiting, bot detection, request filtering, network protections, IP-based abuse detection, origin validation, and security logging when reasonably necessary to protect the service.

Security controls should avoid collecting substantially more information than necessary solely because additional information is technically available.

### 11. Open-web compatibility

Provider terms must not require Joshternet to claim ownership of independent participant websites, participant-created content, public pages merely linked or indexed by Joshternet, or independent implementations of Joshternet specifications.

Providers should not require architectural control that conflicts with the Joshternet’s decentralized design.

### 12. Contact and accountability

Providers used for material Joshternet infrastructure should have a usable support, privacy, security, abuse, or escalation path appropriate to the service.

Joshternet should not depend on a critical provider with no practical means to address a serious security, privacy, or operational problem when reasonable alternatives exist.

## Provider review

### Before adoption

Review the service purpose, required data, privacy policy, terms, security documentation where relevant, data retention, material subprocessors, portability, and compatibility with Joshternet architecture.

Record only enough information to support future maintenance. This is not a compliance bureaucracy.

### During use

Reevaluate a provider when there is a material change in terms, privacy policy, ownership, security posture, service architecture, data usage, breach history, pricing or lock-in conditions that materially affect portability, or functionality that changes Joshternet’s data flow.

### Provider removal

Joshternet may discontinue use of an infrastructure provider when its practices, terms, ownership, security posture, data-use policies, or technical behavior materially conflict with these principles.

Removal need not be instantaneous. Security and migration realities may require an orderly transition.

## Provider disqualification is not network blocking

**Provider disqualification** means Joshternet decides not to use a provider for Joshternet-operated infrastructure. That decision does not bar independently operated sites hosted by that provider from participating in the Joshternet.

**Operational blocking** means Joshternet-operated systems may block or restrict abusive clients, IP addresses, networks, automated tools, API consumers, crawlers, clients bypassing rate limits, clients attacking or probing Joshternet systems, systems impersonating JoshBot, or traffic posing a security risk.

Operational blocking is based on behavior against Joshternet-operated infrastructure. It is not a hosting-provider participation rule.

## Currently used providers

The following relationships are confirmed by current Joshternet repository configuration. This is an inventory of current use, not certification, approval, or endorsement.

| Provider | Joshternet use |
| --- | --- |
| GitHub | Source hosting, Actions, GitHub Pages, public registry files |
| Cloudflare | Edge Workers, Turnstile, nominations D1, Cache API, rate limiting |
| Umami Cloud | Hub analytics |
| IndexNow | Search-engine URL submission after deploy |

Joshternet may add, change, or discontinue providers. Independent participating websites remain free to choose their own.

## Contact

Questions about these principles: [hello@joshternet.org](mailto:hello@joshternet.org).

Effective 5 October 2026. Last updated 5 October 2026.
{: .legal-dates}
