---
layout: default
title: Specifications
description: >-
  The three current Draft Joshternet RFCs define the network's architecture,
  voluntary Josh identity, and the /.well-known/josh participation protocol.
permalink: /specs/
---

# Specifications

Joshternet RFCs are versioned documents that describe Joshternet protocols, conventions, processes, and standards.

The canonical RFC text lives in the [Joshternet specification repository][spec]. This page is a map to the specifications, not another copy of them. If a summary here and an RFC ever disagree, the RFC controls.

## Current status

The specification repository is currently **PRE-JOSH**.

All three current RFCs are Drafts. None are Accepted. The foundational specifications are still being developed through public issues, discussion, and pull requests.

## Current RFCs

### RFC-JOSH-0000: The Joshternet

**Status:** Draft<br />
**Category:** Foundational

This RFC defines the Joshternet itself: its purpose, scope, non-goals, foundational principles, terminology, and overall architecture.

Read it when you need to understand what the Joshternet is, what it is not, how Joshternet Nodes and Josh Nodes differ, what counts as a minimum inter-Josh network, or why no registry or service should become the network's central authority. It also establishes the foundational boundaries between identity, participation, discovery, security, and trust.

[Read the canonical RFC-JOSH-0000: The Joshternet][rfc-0000].

### RFC-JOSH-0001: Josh Identity

**Status:** Draft<br />
**Category:** Foundational

This RFC defines voluntary Josh identity.

It establishes Affirmed, Declined, and Undeclared identity; separates identity from participation; permits non-Josh participation; and treats a person's own declaration as the authority for their Joshness. It also covers name and language independence, privacy, impersonation, and the boundary between identity and trust.

Its central rule is simple:

**Joshness is declared, never derived.**

Read this RFC when the question is who may be represented as a Josh, how identity may change, or how Josh identity relates to participation.

[Read the canonical RFC-JOSH-0001: Josh Identity][rfc-0001].

### RFC-JOSH-0002: `/.well-known/josh`

**Status:** Draft<br />
**Category:** Protocol

This RFC defines the current machine-readable declaration used by an origin to participate in the Joshternet.

It specifies the `/.well-known/josh` location, the version 1 JSON representation, the optional `josh` boolean, retrieval requirements, redirect behavior, removal behavior, and validation rules.

This RFC is deliberately narrow. It does not define discovery, registries, profiles, navigation, feeds, trust, reputation, or abuse handling.

Read it when you need to publish, retrieve, or validate a Joshternet declaration.

[Read the canonical RFC-JOSH-0002: `/.well-known/josh`][rfc-0002].

## Reading order

The current specifications build on one another:

1. **RFC-JOSH-0000** establishes the network, principles, architecture, and terminology.
2. **RFC-JOSH-0001** establishes Josh identity semantics.
3. **RFC-JOSH-0002** defines the current participation declaration and uses the identity semantics from RFC-JOSH-0001.

Readers looking for the overall model should begin with RFC-JOSH-0000. Readers implementing `/.well-known/josh` should still understand the identity rules in RFC-JOSH-0001 before interpreting the `josh` member.

## Canonical text and development

The [Joshternet specification repository][spec] is the canonical source for every current RFC.

Specification changes are developed publicly through issues, discussion, and pull requests. Proposed specifications begin as Drafts. No Joshternet RFC has been Accepted yet.

Summaries on joshternet.org are explanatory. The RFC text remains authoritative.

[spec]: https://github.com/joshternet/spec
[rfc-0000]: https://github.com/joshternet/spec/blob/main/rfcs/0000-the-joshternet.md
[rfc-0001]: https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md
[rfc-0002]: https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md
