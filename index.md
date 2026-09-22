---
layout: default
title: "Joshternet: An Open Network for Joshes and Independent Websites"
---

# Joshternet

The Joshternet is an open, decentralized network for people who identify as Josh and the independent websites they call home.

<p class="prose-emphasis"><strong>Joshness is declared, never derived.</strong></p>

The work begins with a focused goal: help Joshes find one another, visit each other's sites, and see what they are making without moving everyone onto another platform.

The Joshternet is not a social network, identity provider, ranking system, or central publishing service. It connects independent places on the web. It does not own them.

## Why this exists

The web is full of Joshes.

Some of them write, make art, build software, document projects, or maintain personal websites for reasons known only to themselves.

Those sites should be able to connect without an algorithm deciding which Josh is important and without asking anyone to surrender control of their domain, content, or infrastructure.

The Joshternet uses shared conventions and ordinary web technologies to make those connections possible.

## Participation today

A website's origin declares participation by publishing valid JSON at:

```text
/.well-known/josh
```

A participating Josh might publish:

```json
{
  "version": 1,
  "josh": true
}
```

Publishing a valid resource declares participation. The optional `josh` member declares Josh identity:

- `josh: true` means **Affirmed Josh Identity**.
- `josh: false` means **Declined Josh Identity**.
- Omitting `josh` means **Undeclared Josh Identity**.

These states are not interchangeable.

Undeclared does not mean Declined. Participation does not mean Affirmed. A valid declaration without a `josh` member still declares participation.

A person's name, domain, biography, or page content does not establish Joshness. The person does.

[RFC-JOSH-0002][rfc-0002] is the authoritative definition of this protocol.

## Current state

The Joshternet is currently **PRE-JOSH**. Its three current RFCs are Drafts, and none have been Accepted.

Working implementations now exist alongside the Draft specifications:

- [joshuamorris.info][implementation-josh] participates according to RFC-JOSH-0002 with Affirmed Josh Identity;
- [joshternet.org][implementation-project] participates according to RFC-JOSH-0002 with Undeclared Josh Identity;
- [JoshBot][joshbot] [v1.0.0][joshbot-release] is the first supported release of the Joshternet discovery, verification, and public registry crawler.

These implementations let the project test the separation between participation, identity, discovery, and registry infrastructure in practice. Neither participating origin is an authority or privileged node, and JoshBot does not define participation or Josh identity.

PRE-JOSH remains the project's bootstrap state while the foundational specifications and governance continue to develop. The [Governance page][governance] explains the current process.

## Principles

The Joshternet starts with a few rules:

- Joshness is declared, never derived.
- Participation is voluntary.
- Josh identity and participation are separate.
- Non-Joshes may participate without being represented as Joshes.
- Participating websites remain independently controlled.
- No Josh outranks another Josh.
- Josh identity does not imply trust.
- Participation does not imply trust.
- Discovery should not require one canonical authority.
- Open and boring web standards are preferred.

A registry may help people find participating sites. It is not the Joshternet, and it does not get to decide who is a Josh.

## Learn more

The [About page][about] explains where the Joshternet came from, why it starts with Joshes and independent websites, and the larger experiment behind it.

The [Specifications page][specifications] maps the current RFCs and their reading order. The [Governance page][governance] documents how the Draft specifications are maintained today.

If you want to participate, the [implementation guide][implementation] explains how to publish a `/.well-known/josh` declaration. The [JoshBot page][joshbot] documents the current discovery, verification, and registry crawler.

## Help define it

If you are a Josh with an independent website:

- read the Draft RFCs;
- publish a `/.well-known/josh` declaration;
- test the protocol;
- find the ambiguous parts;
- find the broken assumptions;
- bring what you learn back to the specification discussions.

There is no central signup form or account to create. That would rather miss the point.

Non-Joshes may also participate, contribute, operate compatible infrastructure, and help test the specifications without being represented as Joshes.

The [Joshternet specification repository][spec] is the canonical project source. Specifications are developed publicly through issues, discussion, and pull requests.

[spec]: https://github.com/joshternet/spec
[rfc-0002]: https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md
[about]: /about/
[specifications]: /specs/
[governance]: /governance/
[implementation]: /implement/
[joshbot]: /joshbot/
[implementation-josh]: https://joshuamorris.info/.well-known/josh
[implementation-project]: https://joshternet.org/.well-known/josh
[joshbot-release]: https://github.com/joshternet/joshbot/releases/tag/v1.0.0
