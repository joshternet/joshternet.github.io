---
layout: default
title: Specifications
description: >-
  Explore the Draft Joshternet specifications covering independent website
  participation, voluntary Josh identity, and the /.well-known/josh protocol.
  Read the RFCs and follow their development.
keywords: >-
  Joshternet RFC, specifications, /.well-known/josh, Draft RFCs, open standards,
  PRE-JOSH
permalink: /specs/
seo:
  type: TechArticle
  name: Specifications
---

# Specifications

Joshternet works because independent websites can agree on a few small things
without depending on one central service. The specifications describe those
shared conventions, from how participation works to how someone chooses to
declare Josh identity.

The current RFCs are still Drafts, and the project is learning from real
websites and implementations as it develops. You can read them, use them,
question them, and help improve them. The official text lives in the
[Joshternet specification repository][spec].

This page is a map—not another copy of the RFCs. If a summary here and an RFC
disagree, the RFC controls. None of these documents are IETF standards.

## Where things stand

Joshternet is currently in its PRE-JOSH phase. All three foundational RFCs are
Drafts, which means they're published and available to implement, but their
details may still change as more people participate and problems are discovered.

None has been Accepted yet. The [Governance](/governance/) page explains how the
project is maintained and how specification changes are discussed.

## Current RFCs

| RFC | Status | Classification | Canonical |
| --- | --- | --- | --- |
| **RFC-JOSH-0000: The Joshternet** | Draft | Foundational | [Read RFC-JOSH-0000][rfc-0000] |
| **RFC-JOSH-0001: Josh Identity** | Draft | Foundational | [Read RFC-JOSH-0001][rfc-0001] |
| **RFC-JOSH-0002: `/.well-known/josh`** | Draft | Protocol | [Read RFC-JOSH-0002][rfc-0002] |

### RFC-JOSH-0000: The Joshternet

This is where the larger idea is defined. RFC-JOSH-0000 explains the network's
purpose, its decentralized structure, and the principles that keep independent
websites in control of their own content and identity.

Start here if you want to understand how the pieces fit together and why the
network should not depend on a single registry, crawler, or website.

[Read RFC-JOSH-0000][rfc-0000]

### RFC-JOSH-0001: Josh Identity

Being part of the Joshternet doesn't automatically make somebody a Josh.
RFC-JOSH-0001 defines how people may affirm Josh identity, decline it, or leave
it undeclared. The choice belongs to the person being represented, not a crawler
or an algorithm trying to guess from a name.

Joshness is declared, never derived.

This is the specification to read when you're working with Josh identity or
interpreting the optional `josh` declaration.

[Read RFC-JOSH-0001][rfc-0001]

### RFC-JOSH-0002: `/.well-known/josh`

This RFC defines the small JSON resource that a website publishes to declare
participation in the Joshternet. It covers the exact address, the version 1
format, retrieval rules, optional identity information, and how an origin stops
declaring participation.

Read this one when you're implementing or validating a Joshternet declaration.
Version 1 does not define discovery, trust, feeds, search, or registry
membership.

[Read RFC-JOSH-0002][rfc-0002]

## Which RFC should you read?

Which RFC should you read? That depends on what you're trying to do.

| Reader's goal | Start here |
| --- | --- |
| Understand the network | [RFC-JOSH-0000][rfc-0000] |
| Understand Josh identity | [RFC-JOSH-0001][rfc-0001] |
| Publish or validate a declaration | [RFC-JOSH-0002][rfc-0002] |
| Join without reading an RFC first | [Join guide](/join/) |
| Follow technical instructions | [Implement guide](/implement/) |

A complete technical review often follows 0000 → 0001 → 0002. Implementing
`/.well-known/josh` still needs the identity rules in RFC-JOSH-0001 before
interpreting the optional `josh` member. You do not need to read the entire
specification repository before participating.

## Contribute

Open specifications get better when people actually use them. If you've found an
ambiguity, an implementation problem, or a better way to express something, bring
it to the [specification repository][spec]. Real experience is more useful than
pretending every question has already been answered.

Open an [issue][issues] or [pull request][pulls] to discuss a change. Not every
proposal will be adopted. How Drafts are maintained today: [Governance](/governance/).

[spec]: https://github.com/joshternet/spec
[issues]: https://github.com/joshternet/spec/issues
[pulls]: https://github.com/joshternet/spec/pulls
[rfc-0000]: https://github.com/joshternet/spec/blob/main/rfcs/0000-the-joshternet.md
[rfc-0001]: https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md
[rfc-0002]: https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md
