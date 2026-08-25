---
layout: default
title: Joshternet
---

# Joshternet

The Joshternet is an open, decentralized network for people who identify as Josh and the independent websites they call home.

**Joshness is declared, never derived.**

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

## PRE-JOSH

The Joshternet is currently **PRE-JOSH**.

There are three Draft RFCs. None have been accepted yet. The foundational rules are still being defined, tested, and argued with where necessary.

There is [one known operational implementation of RFC-JOSH-0002][implementation]. It demonstrates that the declaration can be published. It does not make that site an authority or privileged node, and it does not mean that a functioning inter-Josh network has arrived.

PRE-JOSH is not a failure state. It is an honest description of where the project is.

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

## The current RFCs

The current specification set contains three Draft RFCs:

- [RFC-JOSH-0000: The Joshternet][rfc-0000] defines the network, its scope, terminology, and foundational principles.
- [RFC-JOSH-0001: Josh Identity][rfc-0001] defines voluntary Josh identity and keeps identity separate from participation.
- [RFC-JOSH-0002: `/.well-known/josh`][rfc-0002] defines the version 1 declaration for participation and optional Josh identity.

These summaries are introductions. The RFCs are authoritative.

## The larger experiment

We are starting with Joshes because there is already a recognizable community of Joshes maintaining independent websites.

Starting with a real, specific community lets us test how people can declare participation voluntarily, remain on their own sites, discover one another, interoperate without a central platform, and develop conventions and governance from actual participation.

The Joshternet remains specifically the Joshternet.

If the experiment works, other well-known communities may be able to study and reuse what we learn. That does not mean a generic community-network standard already exists.

It does not.

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
[rfc-0000]: https://github.com/joshternet/spec/blob/main/rfcs/0000-the-joshternet.md
[rfc-0001]: https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md
[rfc-0002]: https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md
[implementation]: https://joshuamorris.info/.well-known/josh
