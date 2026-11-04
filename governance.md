---
layout: default
title: Governance
description: >-
  Learn how Joshua Morris maintains the Joshternet during its PRE-JOSH phase,
  how Draft specifications are developed, and how contributors can help shape
  the project while independent websites remain in control.
keywords: >-
  Joshternet governance, RFC process, specifications, open standards, Draft RFCs
permalink: /governance/
seo:
  type: WebPage
  name: Governance
---

# Governance

Joshternet is still a young project, and its governance is developing alongside
the network. Joshua Morris created the Joshternet and currently serves as its founding maintainer. He maintains the project's repositories, documentation, and
foundational specification work during its current bootstrap phase. That gives
him responsibility for the project's development, not authority over the
independent websites or people participating in the network.

The project is currently in its **PRE-JOSH** phase. That simply means the
foundational work is still being developed, and the more formal processes that
might be useful to a larger community have not yet been established.

Want to help today? Open an [issue][issues] or [pull request][pulls] on the
[spec repository][spec], or talk in `#joshternet`. Josh identity is not required
to contribute.

## Current maintenance

During PRE-JOSH, the founding maintainer may develop and revise foundational
specifications while broader independent participation is still emerging.
[RFC-JOSH-0000][rfc-process] permits that so the absence of an established
community does not prevent the network from being built.

This role applies to repositories, specifications, and documentation only.

## Community principles and stewardship

Project governance and community stewardship are related, but they are not the
same thing.

The [Community][community] page describes the kind of community Joshternet
intends to foster, the behavior expected within Joshternet-operated spaces, and
the responsibilities accepted by people entrusted with shared project
infrastructure. That living commitment is not a protocol specification and does
not replace the RFCs.

## PRE-JOSH governance

PRE-JOSH is the project's current bootstrap state. Foundational RFCs are Drafts,
the project is still finding its footing, and a permanent governance structure
has not been defined.

During this phase:

- the foundational specifications remain Drafts;
- no RFC has been Accepted;
- broad independent participation has not yet been established;
- the founding maintainer can continue developing and revising foundational work;
- proposed changes and repository history remain publicly visible;
- issues, discussion, and pull requests provide the current channels for specification development.

PRE-JOSH is not defined as the permanent governance model.

The canonical repository does not currently define an exit criterion, adoption
threshold, participant count, or other formal condition for leaving PRE-JOSH.

## Specification development today

Most of the specification work happens in public. If something is unclear,
doesn't work well in practice, or could be improved, people can raise the issue
and discuss possible changes.

The [Joshternet specification repository][spec] is the canonical home of the
Joshternet specifications.

Specification work currently happens by:

- [opening an issue][issues] to identify a problem, ambiguity, or proposal;
- participating in public issue or pull-request discussion;
- [proposing a pull request][pulls] with a concrete change;
- reviewing existing proposals and their effects on interoperability.

Not every suggestion will be adopted. Changes should be discussed openly through
issues and pull requests before a specification becomes Accepted.

Proposed specifications begin as Drafts. Future RFC numbers are added as
specifications are developed rather than reserved in advance.

Repository history keeps published changes and proposals visible. The current
process favors transparency, simplicity, interoperability, voluntary
participation, and open discussion.

## What Draft means

The Joshternet RFCs are real specifications that people can read and implement,
but they're still Drafts. Their details may change as more websites participate,
implementations expose problems, and contributors work through the unanswered
questions.

All three current Joshternet RFCs are Drafts. None are Accepted. See
[Specifications][specifications] for the current map.

Draft does not mean that a specification is:

- stable or final;
- universally implemented;
- approved by a broad community;
- formally ratified;
- an adopted IETF standard;
- guaranteed to remain compatible without revision.

The repository does not yet define a precise procedure for moving a Draft
specification to Accepted status. No additional lifecycle states are currently
defined.

## What has not been established

Joshternet does not currently have:

- formal membership or member classes;
- ballots, voting thresholds, or quorum rules;
- working groups, steering committees, or technical committees;
- a review board or appeal procedure;
- a formal RFC acceptance procedure;
- defined PRE-JOSH exit criteria;
- a permanent governance structure.

No claim of broad community approval is made for the current Draft
specifications.

RFC-JOSH-0000 says that consensus among participating Joshes and contributors
should be favored where practical. That is a development principle, not a defined
voting system.

## Participation and representation

Publishing a valid `/.well-known/josh` establishes protocol participation. It
does not establish membership in a formal governing body, voting rights, or a
representation structure—none of those have been defined.

Governance should grow from real participation rather than simulated consensus.
Independent participants and contributors can bring implementation experience,
operational constraints, interoperability requirements, and community concerns
into specification development. Those contributions should create real voices in
the project as participation develops.

The project does not currently claim that a broader community has approved its
decisions, and it does not define a future representation structure.

Josh identity is not required for technical contribution. Non-Joshes may
contribute to the project without being represented as Joshes.

## Project governance is not network control

Maintaining the project means taking care of the tools and documentation that
help the network work. It doesn't mean owning the network, deciding who belongs
on somebody else's website, or telling people how they must publish their work.

The project may govern:

- maintenance of its repositories;
- development of its specifications;
- review of proposals;
- publication of project documentation.

That does not confer control over:

- independently operated websites;
- participant domains or content;
- participant hosting or infrastructure;
- participant identity declarations;
- routing between participating nodes;
- whether another participant chooses to interact.

joshternet.org documents the project. It is not the network.

The GitHub organization hosts project development. It is not the network.

A registry or implementation may support the network. It is not the network.

Joshua Morris started and maintains the project. He is not the network.

The network is formed by independently operated nodes and interoperating
infrastructure using shared specifications.

Administrative access exists so maintainers can perform necessary project work.
It does not establish greater Joshness or ownership of the independent network.

<p class="prose-emphasis"><strong>No Josh outranks another Josh.</strong></p>

## Identity remains self-declared

Governance of the project does not grant authority over Josh identity. The
primary statement of that principle lives in [Community][community] and
[RFC-JOSH-0001][rfc-identity].

According to RFC-JOSH-0001:

- Joshness is declared by the person represented;
- participation and identity are separate;
- a registry cannot appoint someone a Josh;
- a crawler cannot appoint someone a Josh;
- an algorithm cannot appoint someone a Josh;
- the Joshternet organization cannot appoint someone a Josh.

A maintainer, contributor, website, registry, or governance process must not
override a person's current authoritative declaration.

<p class="prose-emphasis"><strong>Joshness is declared, never derived.</strong></p>

## Contribute to the specifications

Found something confusing, discovered an edge case, or built an implementation
that works a little differently? That's useful information. Open an issue, join
the discussion, or propose a change in the specification repository. The best way
to improve an open project is to learn from people actually using it.

Start with the [current Draft specifications][specifications] and the canonical
[Joshternet specification repository][spec].

Contributors may:

- [open an issue][issues];
- participate in an existing discussion;
- [propose a pull request][pulls];
- review an existing proposal;
- report implementation experience or ambiguity.

There is no Joshternet membership or signup process for contribution. Josh
identity is not required.

Specification history, issues, and proposed changes remain public in the
canonical repository.

[community]: /community/
[specifications]: /specs/
[spec]: https://github.com/joshternet/spec
[issues]: https://github.com/joshternet/spec/issues
[pulls]: https://github.com/joshternet/spec/pulls
[rfc-process]: https://github.com/joshternet/spec/blob/main/rfcs/0000-the-joshternet.md#14-specification-process
[rfc-identity]: https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md
