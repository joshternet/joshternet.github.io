# Operations

This guide describes how to maintain the Joshternet website without publishing internal data maps, private infrastructure details or credentials. The live repository workflows are the source of truth for current automation; this guide is intentionally written around responsibilities and safe operating practices.

## System boundaries

The public website is built with Jekyll and served through GitHub Pages, with selected interactive features supported by Cloudflare Workers. Membership is governed outside the site repository. The long-term goal is for JoshBot to own crawling and prepare the information consumed by the site, leaving this repository responsible primarily for presentation and site delivery.

**The migration is planned, not complete.** Until the replacement producer and consumer path is established, treat network observation publication as an authorized operational concern—not something contributors should run or document step by step in public guides.

## GitHub Actions

The repository includes workflows for site quality, formatting and several website services. Consult `.github/workflows/` for the exact trigger and permission configuration rather than copying it into this document.

Normal pull requests should run relevant checks without publishing network state. Treat production deployment and external-service updates as separate, explicitly authorized operations.

## Release process

1. Review the intended code change, test results and any user-visible effects.
2. Confirm the change has not introduced hand-maintained network facts, secrets or private data.
3. Verify the site build and relevant browser, accessibility and security behavior.
4. Merge through the normal reviewed process.
5. Confirm the production site and critical interactive services behave as expected.
6. Record significant changes and any operational follow-up in the changelog or issue tracker.

Do not treat a successful source-code merge as proof that new network observations were published. Site deployment and upstream data publication have different ownership and success criteria.

## Generated information and ownership

Generated content should come from the authorized pipeline, not from manual editing in a feature branch. Development work may change parsers, rules, views and tests; it must not fabricate observations to make a page look correct. When a generated view is wrong, fix the responsible producer or renderer and verify the result with reproducible tests.

Under the planned architecture, upstream systems will own crawl evidence and generated content, while the site will consume a validated release. Preserve this separation even if the two systems are temporarily coupled during migration. Internal filenames, storage backends, private repositories, serialized payload structures and instructions for refreshing member-site observations are deliberately outside this public guide.

## Monitoring and diagnostics

Check the relevant GitHub Actions run and the actual production pages after a change. Useful signals include build failures, unavailable upstream information, unexpected drops in published content, excessive duplicate cards, broken canonical links and degraded browser behavior. Do not use live membership counts or the presence of a specific person's content as fixed correctness tests.

Investigate upstream availability, validation and build status independently. Avoid rerunning expensive workflows repeatedly without understanding the failure.

## Recovery

**Website regression:** Identify the last verified working revision, review the change and use the repository's established revert or redeploy process. Confirm the public website after recovery.

**Upstream data unavailable:** Preserve the last known good site output when safe rather than publishing an empty or incomplete replacement. Investigate the upstream process; do not manufacture missing observations by hand.

**Data integrity failure:** Stop publication of the affected generation, inspect the validation failure and restore a known good generation through the authorized pipeline when needed.

**Credential or access concern:** Revoke or rotate affected access through the responsible service, inspect relevant audit history and review workflow permissions. Never paste tokens or secrets into issues, logs or documentation.

**Worker or interactive feature outage:** Isolate the affected feature where possible and preserve readable, navigable site content. Restore only after the service and its fallback behavior have been checked.

See [Development](development.md) for contributor commands and [Data pipeline](data-pipeline.md) for the processing boundaries.
