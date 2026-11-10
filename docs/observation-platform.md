# Crawl-derived observation platform

Joshternet reconstructs member-derived datasets from coordinated crawl
observations. Humans and AI may change rules, catalogs, parsers, classifiers,
and tests—not observational facts. Fix the machine, not the answers.

## Shared lifecycle

Every crawl-derived family shares one contract:

1. Discover candidate resources (adapters request URLs only).
2. Fetch through the central broker (robots, budgets, dedupe, cache).
3. Persist verified source blobs, then durable resource observations.
4. Extract → reconcile → project per family.
5. Validate a **candidate** reconstruction (committed history + current run).
6. Stage **all** Git-owned generated outputs into one generation commit.
7. Push to `main`, then mark the durable generation `committed` with the new SHA.
8. GitHub Pages rebuilds from that commit—crawler workflows do not publish `_site`.

Families today: articles, showcase, events, uses, seeking, now, reading,
connections. Uses is one adapter under the same contract.

## Fetch broker

Adapters never call the network. They enqueue URLs on `createFetchBroker`. The
broker normalizes URLs, dedupes within a run, records every outcome
(success, unchanged, robots-denied, deferred, timeout, HTTP failure, content-type
reject, budget exhaustion), and retains bodies only after
`persistVerifiedSourceBlob` succeeds. Budget exhaustion means incomplete
coverage—not verified absence.

## Durable stores

Authoritative evidence lives outside Git and outside Actions cache:

| Store | Role | Default local path | Production |
| --- | --- | --- | --- |
| Source store | Content-addressed bodies (`source_hash`) | `data/observation/sources/` | S3-compatible prefix (`JOSHTERNET_SOURCE_STORE_*`) |
| Observation store | Resource/family observations + generation records | `data/observation/store/` | S3-compatible prefix (`JOSHTERNET_OBSERVATION_STORE_*`) |

Git owns reconstructed state and derived projections (`data/uses/state.json`,
`_data/uses_summary.json`, …). Ownership classes are declared in
`data/ownership.json`. CI helper:
`node scripts/observation/check-ownership.mjs [--writer=…] paths…`.

Operational unchanged checks may compact to the latest per URL. Semantic
observations required for supported replay are retained.

## Generation provenance

The Git-owned manifest includes `observation_run_id`, `run_status_at_build:
validated`, timestamps, `base_git_sha`, and version fingerprints—never
`generation_git_sha`. After a successful push, the durable generation record
receives `generation_git_sha`, `committed_at`, and `run_status: committed`.

Published replay uses **committed** generations only. Candidate reconstruction
may include the current run’s observations for validation.

## Registry

Canonical registry reads fail closed on empty, unparseable, or unexpected
shrink. Removed members keep historical observations; re-add resumes the same
origin identity.

## Schedule and concurrency

Production observation cadence: `17 */6 * * *`. Schedule,
`repository_dispatch`, `workflow_dispatch`, and path-triggered production runs
share concurrency group `joshternet-network-sync` with
`cancel-in-progress: false`. Dry/read-only checks may parallelize.

## IndieWeb evidence

Supported mechanisms (mf2, RSS/Atom/JSON Feed, OPML, Schema.org, Open Graph,
rel=me, sitemap, robots, well-known, slash pages) are catalogued in
`scripts/observation/open-web-evidence.mjs`. Webmentions must not mutate
publisher content records.

## Now and Reading

`/now` is evolving-state history: failed fetches preserve the prior verified
state. Reading uses a book-identity ladder (ISBN → canonical book URL →
title+author); title-only matches stay separate.

## Tests and fixtures

Multi-family harness: `scripts/observation/harness.mjs`. Real-member Uses
fixtures live under `test/fixtures/uses/members/` (including
`joshuamorris.info.html` with retrieval metadata in `manifest.json`). Printer
expectations assert on-page facts from that crawl path only.
