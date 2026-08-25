---
layout: default
title: Governance
description: >-
  How the Joshternet develops Draft specifications in public while keeping
  project governance separate from network control and Josh identity.
permalink: /governance/
---

# Governance

The Joshternet is currently in its **PRE-JOSH** bootstrap phase.

Governance today means maintaining the public project repositories, developing the Draft specifications, reviewing proposals, and documenting the project. It does not mean controlling independent participating websites or deciding who is a Josh.

## Current maintenance

Joshua Morris conceived and started the Joshternet and currently serves as its founding maintainer.

During PRE-JOSH, the founding maintainer maintains the project repositories and may develop and revise the foundational specifications while broader independent participation is still emerging.

[RFC-JOSH-0000][rfc-process] permits founding maintainers to continue the initial work so that the absence of an established community does not prevent the network from being built.

This maintenance role applies to the project repositories, specifications, and documentation. It does not grant authority over another person’s Josh identity, ownership of participating websites, or operational control of the network.

## PRE-JOSH governance

PRE-JOSH is the project’s current bootstrap state.

During this phase:

- the foundational specifications remain Drafts;
- no RFC has been Accepted;
- broad independent participation has not yet been established;
- the founding maintainer can continue developing and revising foundational work;
- proposed changes and repository history remain publicly visible;
- issues, discussion, and pull requests provide the current channels for specification development.

PRE-JOSH is not defined as the permanent governance model.

The canonical repository does not currently define an exit criterion, adoption threshold, participant count, or other formal condition for leaving PRE-JOSH.

## Specification development today

The [Joshternet specification repository][spec] is the canonical home of the Joshternet specifications.

Specification work currently happens by:

- [opening an issue][issues] to identify a problem, ambiguity, or proposal;
- participating in public issue or pull-request discussion;
- [proposing a pull request][pulls] with a concrete change;
- reviewing existing proposals and their effects on interoperability.

Changes should be discussed openly through issues and pull requests before a specification becomes Accepted.

Proposed specifications begin as Drafts. Future RFC numbers are added as specifications are developed rather than reserved in advance.

Repository history keeps published changes and proposals visible. The current process favors transparency, simplicity, interoperability, voluntary participation, and open discussion.

## What Draft means

All three current Joshternet RFCs are Drafts. None are Accepted.

A Draft is real published technical work that remains under development. Its requirements and semantics may change as implementations, review, and participation expose problems or ambiguity.

Draft does not mean that a specification is:

- stable or final;
- universally implemented;
- approved by a broad community;
- formally ratified;
- guaranteed to remain compatible without revision.

The repository does not yet define a precise procedure for moving a Draft specification to Accepted status. No additional lifecycle states are currently defined.

## What has not been established

The Joshternet does not currently have:

- formal membership or member classes;
- ballots, voting thresholds, or quorum rules;
- working groups, steering committees, or technical committees;
- a review board or appeal procedure;
- a formal RFC acceptance procedure;
- defined PRE-JOSH exit criteria;
- a permanent governance structure.

No claim of broad community approval is made for the current Draft specifications.

RFC-JOSH-0000 says that consensus among participating Joshes and contributors should be favored where practical. That is a development principle, not a defined voting system.

## Participation and representation

Governance should grow from real participation rather than simulated consensus.

Independent participants and contributors can bring implementation experience, operational constraints, interoperability requirements, and community concerns into specification development. Those contributions should create real voices in the project as participation develops.

The project does not currently claim that a broader community has approved its decisions, and it does not define a future representation structure.

Josh identity is not required for technical contribution. Non-Joshes may participate in specification development without being represented as Joshes.

## Project governance is not network control

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

The network is formed by independently operated nodes and interoperating infrastructure using shared specifications.

**No Josh outranks another Josh.**

## Identity remains self-declared

Governance of the project does not grant authority over Josh identity.

According to [RFC-JOSH-0001][rfc-identity]:

- Joshness is declared by the person represented;
- participation and identity are separate;
- a registry cannot appoint someone a Josh;
- a crawler cannot appoint someone a Josh;
- an algorithm cannot appoint someone a Josh;
- the Joshternet organization cannot appoint someone a Josh.

A maintainer, contributor, website, registry, or governance process must not override a person’s current authoritative declaration.

**Joshness is declared, never derived.**

## Contribute to the specifications

Start with the [current Draft specifications][specifications] and the canonical [Joshternet specification repository][spec].

Contributors may:

- [open an issue][issues];
- participate in an existing discussion;
- [propose a pull request][pulls];
- review an existing proposal;
- report implementation experience or ambiguity.

There is no Joshternet membership or signup process for contribution. Josh identity is not required.

Specification history, issues, and proposed changes remain public in the canonical repository.

[specifications]: /specs/
[spec]: https://github.com/joshternet/spec
[issues]: https://github.com/joshternet/spec/issues
[pulls]: https://github.com/joshternet/spec/pulls
[rfc-process]: https://github.com/joshternet/spec/blob/main/rfcs/0000-the-joshternet.md#14-specification-process
[rfc-identity]: https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md
