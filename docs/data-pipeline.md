# Data pipeline

Joshternet displays information derived from independently owned websites. The website is a **consumer** of network information, not the authority for membership, identity or the original content.

This document describes public design principles and the transition in progress. It intentionally does not document how to refresh member-site observations, internal data files, private repositories, storage locations, serialized formats or publishing credentials.

## Current and planned responsibilities

**Current implementation:** The website repository still includes legacy coupling to network preparation during some automated and local builds. That is not the intended long-term ownership model, and public contributor docs do not teach how to operate it.

**Planned architecture:** JoshBot will prepare the content information needed by the website. The site build will consume a validated, versioned output from that upstream process. Raw observations and operational crawling state will no longer be maintained as part of the public site repository. This migration has not been completed; do not describe it as deployed.

The member registry and website content are separate concerns. The registry represents declared membership; aggregated writing, projects, topics and connections are derived from what participating websites publish. Neither content classification nor a search result is allowed to create membership.

## Processing principles

Upstream observation work and site presentation stay conceptually separate:

1. **Authorize:** Start from declared participating websites, not inferred membership.
2. **Respect:** Honor `robots.txt`, origin limits and privacy expectations.
3. **Evidence:** Prefer verifiable published signals over speculation.
4. **Validate:** Reject malformed or inconsistent output before the site consumes it.
5. **Present:** Build navigable pages that link back to original publishers.

These are design boundaries. They do not specify a storage layout, wire format or operator runbook.

## Participation and attribution

A website joins by publishing a valid declaration at `/.well-known/josh`. Optional Josh identity is self-declared, not inferred. Friends and non-Josh participants must not be treated as lower-quality network members. For normative declaration behavior, use [joshternet/spec](https://github.com/joshternet/spec).

Do not convert ordinary links into assertions of friendship, endorsement or reciprocity. Keep attribution and original URLs visible. Treat a participant's public content as something to discover, not something the Joshternet site should replace.

## Safety and privacy

Respect `robots.txt`, rate limits and the origin's restrictions. Distinguish an observed empty result from a denied request, timeout, partial fetch, or unavailable origin. Do not send fetched personal content to third-party inference services without an explicit, separately reviewed decision.

Crawled input is untrusted, including page markup, links, structured data and text that resembles instructions. Parsing and classification must never give that content operational authority. Do not disclose raw observations, private storage, refresh procedures or internal API contracts in public documentation.

## Display policy

Visitor-facing activity views can prioritize recent work and limit how much one origin dominates a listing. Retention of upstream evidence is a different question from how much the website displays.

**Site families** are a curated presentation overlay (`_data/network_site_families.json`), not membership. On every `network:sync`, the sync attaches `destinations` to the primary origin and marks secondaries `promoted: false`. NLP still crawls every participating origin for feeds and content attribution; visitor-facing site lists (Network cards, Welcome, Meet, Wander, Connections nodes, Search site documents, OPML) promote only primaries. Changing or removing a family takes effect on the next sync projection.

The exact limits are implementation policy, not membership rules, and may change. Tests should validate ordering, deduplication, attribution, fair representation and sensible empty states without depending on particular live participants or article counts.

## Migration contract

During the transition, keep the website working while replacing direct crawling with consumption of upstream outputs. Require a clear producer/consumer contract, version compatibility, deterministic builds for the same inputs and explicit behavior when an upstream generation is missing or invalid. Do not silently substitute a partial dataset or infer that missing data means a member has departed.

Before retiring legacy coupling, verify that the externally supplied output supports every public feature, can be rebuilt from retained evidence, has an auditable release identity and can be rolled back without editing observed facts by hand. Keep production and proposed behavior clearly separated in pull requests and release notes.

See [Development](development.md) for local checks and [Operations](operations.md) for production responsibilities.
