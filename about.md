---
layout: default
title: About
description: >-
  How the Joshternet began, why it starts with Joshes and independent websites,
  and how open standards keep the network decentralized.
seo:
  type: WebPage
  name: About
permalink: /about/
---

# About the Joshternet

The Joshternet is an open network and standards project for connecting people who identify as Josh and the independent websites they call home.

It uses voluntary participation, self-declared Josh identity, open specifications, and ordinary web protocols to connect independently operated places without replacing them with another centralized platform.

## Where it came from

Joshua Morris conceived and started the Joshternet as several ideas came together.

There are a remarkable number of people named Josh or Joshua working in technology and on the web. Many have created notable websites, software, companies, tools, standards, projects, and communities.

The question was straightforward: what would it take to build an actual open network for Joshes?

The natural language around Josh, joshing, and Joshes interacting with other Joshes gives the project a character of its own. That wordplay provides some inherent humor without defining the limits of the technical work.

The Joshternet also grew from an interest in whether recognizable communities can gather through open standards instead of requiring a centralized proprietary platform. Established web mechanisms, including RFC-style specifications and `/.well-known/` resources, provided a practical place to begin.

## Why Joshes?

The project begins specifically with Joshes because Joshua Morris is a Josh and because a visible community of Joshes already builds and publishes things across the web.

That gives the project a real community rather than a hypothetical user base. It creates concrete questions about identity, participation, discovery, interoperability, governance, and trust.

Josh identity remains voluntary:

**Joshness is declared, never derived.**

A name, domain, biography, or third-party assertion does not determine Joshness. A person may affirm Josh identity, decline it, or leave it undeclared.

Non-Joshes may participate without being represented as Joshes. Participation and identity remain separate.

## Why independent websites?

The web already gives people places they can control.

Participants should retain ownership and control of their:

- domains;
- websites;
- content;
- publishing systems;
- hosting;
- infrastructure;
- identity declarations.

The Joshternet adds shared conventions between those places. It does not ask participants to relocate them or become tenants of a Joshternet platform.

The sites remain independent. The connections between them form the network.

## Why open standards?

Open specifications give independently developed websites and services a common basis for participation and interoperability.

The [current specifications][specifications] define the Joshternet’s foundational architecture, its voluntary identity model, and the version 1 declaration published at `/.well-known/josh`. The [implementation guide][implementation] explains how an independently operated origin can publish that declaration today.

The project prefers boring protocols, small representations, existing web standards, understandable implementations, and independently deployable sites. Participation should not depend on proprietary infrastructure or a particular technology stack.

The project remains **PRE-JOSH**. Its three current RFCs are Drafts, and none have been Accepted. The foundational rules are still being defined and tested in public.

## The network is decentralized

No single website, organization, registry, crawler, directory, server, or implementation should be necessary for the Joshternet itself to exist.

joshternet.org documents the project. It is not the network.

The GitHub organization hosts project development. It is not the network.

Joshua Morris started the project. He is not the network.

The network is formed by participating nodes and interoperating infrastructure using shared specifications. Registries, crawlers, validators, and other services may be useful, but they should remain replaceable and must not become authorities over Josh identity.

No Josh outranks another Josh.

[RFC-JOSH-0000][rfc-0000] defines these decentralization principles more formally.

## Build the Josh network first

The project follows a concrete discipline:

Build the Josh network first.

Learn from real participants and implementations.

Generalize only what demonstrated interoperability needs justify.

Actual participation exposes ambiguity, operational constraints, and community needs that an abstract design cannot. The Joshternet should solve those concrete problems before attempting to extract broader conventions.

No generic community-network standard exists today.

## The larger experiment

The Joshternet is exploring whether a recognizable community can define enough shared open conventions to recognize participation, connect independent websites, and evolve without creating another centralized community platform.

Participants should be able to retain control of their domains, publishing systems, infrastructure, content, and identity declarations while still taking part in a larger interoperable network.

If this work produces useful conventions, architectural lessons, or open implementations, another community should be able to study them, adapt them, define its own identity and participation rules, and operate independently.

That community should not need permission from the Joshternet or registration with it. It would not become a subdivision of the Joshternet.

The Joshternet remains specifically the Joshternet. Any broader lessons must be earned through working interoperability here first.

The [Joshternet specification repository][spec] is the canonical source for the current specifications.

[specifications]: /specs/
[implementation]: /implement/
[rfc-0000]: https://github.com/joshternet/spec/blob/main/rfcs/0000-the-joshternet.md
[spec]: https://github.com/joshternet/spec
