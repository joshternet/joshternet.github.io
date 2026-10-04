---
layout: default
title: JoshBot Discovery and Registry Crawler
description: >-
  How JoshBot discovers, verifies, and lists participating websites for the
  Joshternet public registry—what operators can expect from the crawler.
keywords: >-
  JoshBot, Joshternet crawler, registry discovery, /.well-known/josh, verification
seo:
  type: WebPage
  name: JoshBot
permalink: /joshbot/
---

# JoshBot

JoshBot is the discovery, verification, and public registry crawler operated for the Joshternet.

If you found this page after seeing JoshBot in a server log, you are in the right place. The name is silly. The HTTP requests are real.

## Crawler identity

JoshBot sends this exact HTTP user agent:

```text
Joshternet-Joshbot (+https://joshternet.org/joshbot)
```

The product token used when evaluating `robots.txt` is:

```text
Joshternet-Joshbot
```

The crawler’s source code and technical documentation are available in the [JoshBot repository][source].

## Why JoshBot crawls

JoshBot looks for links between independently operated websites.

A crawl may begin from:

- an origin that has already published a valid Joshternet declaration; or
- an origin deliberately configured by the operator as a curated discovery seed.

Starting from an origin does not mean JoshBot considers its owner a Josh or its website part of the Joshternet.

Joshness is declared, never derived.

## Crawling and participation are separate

Permission to crawl a page and participation in the Joshternet are different decisions.

A website’s `robots.txt` policy determines whether JoshBot may retrieve a URI.

Participation is declared separately by publishing a valid resource at:

```text
/.well-known/josh
```

A curated seed may be crawled for discovery when its robots policy permits it, even if that origin does not participate in the Joshternet.

Links found on a page are not automatically trusted. External HTTP or HTTPS links contribute candidate origins that must pass the same declaration verification before they can appear in the public registry.

The [canonical Joshternet specifications][specifications] define participation and Josh identity. They do not require anyone to permit crawling.

## How JoshBot crawls

JoshBot begins at an eligible origin’s root page and may follow same-origin HTTP or HTTPS links within fixed operator limits.

Crawls are bounded by controls including:

- maximum page depth;
- maximum number of pages;
- maximum response-body size;
- delay between requests;
- redirect limits;
- per-page timeouts;
- public-network address validation.

Page requests are sequential within a source crawl.

JoshBot rejects loopback, private, link-local, multicast, shared, unspecified, and other non-public destination addresses. Redirects are subject to the same network and origin checks.

## Robots exclusion

JoshBot retrieves and follows the applicable `robots.txt` policy before requesting pages.

To block all JoshBot crawling, publish this at `/robots.txt`:

```text
User-agent: Joshternet-Joshbot
Disallow: /
```

You can also use ordinary path-specific `Allow` and `Disallow` rules instead of blocking the entire site.

A robots rule that blocks JoshBot prevents the affected URI from being fetched. It does not change previously recorded declaration observations or make a statement about Josh identity.

## Data JoshBot retains

JoshBot retains origin-level semantic and operational data so it can retry work, keep discovery provenance, stay polite, and build the public registry. That includes:

- explicit seed status, automatic-source status, and operator crawl-block status;
- when a source was last attempted;
- source-to-candidate origin relationships with first and latest discovery times;
- declaration observations and effective participant state;
- verification queue and lease state, plus recent verification queue transition history;
- compact per-origin reprobe scheduling state;
- bounded crawl-run summaries and stop reasons;
- sanitized requested and final page URLs without queries, fragments, or credentials;
- per-page HTTP status, duration, response size, media type, redirect count, robots decision, link totals, URLs found or enqueued, typed failure category, bounded outcome, and crawl depth;
- per-run admitted or deferred promotions, blocked or failed pages, URLs found or enqueued, and remaining frontier size at stop;
- worker and discovery service heartbeats with idle, paused, failed, and current-origin state;
- persistent discovery, verification, and automatic-expansion pause state.

Completed crawl telemetry and disposable verification history are cleaned on a limited schedule (default about 30 days). Cleanup keeps the newest observation and newest authoritative declaration observation for each origin when those rows are still needed. Durable participation metadata, discovery provenance, current queue state, and compact reprobe state are not age-deleted the same way. The full table-by-table policy lives in the [JoshBot data retention documentation][retention].

The public registry contains deterministic information derived from successfully verified declarations. Private discovery, queue, and telemetry state are not published there.

## What JoshBot does not archive

JoshBot is not a web archive and does not train models on crawled pages.

It does not retain:

- HTML archives;
- complete page bodies;
- complete declaration bodies;
- page titles;
- anchor text;
- screenshots;
- cookies;
- full response headers;
- query strings or fragments from stored page URLs;
- URL credentials;
- the in-memory crawl frontier;
- arbitrary page content.

## Report a problem

For incorrect crawling, unexpected traffic, robots behavior, or another crawler-specific operational problem, [open a JoshBot crawler report][crawler-report].

For a reproducible software defect that is not specific to crawler behavior, [open a JoshBot bug report][bug-report].

For crawler reports, please include:

- the affected origin or URL;
- the approximate request time and timezone;
- the observed user agent;
- the relevant `robots.txt` rules;
- sanitized log excerpts;
- what you expected JoshBot to do.

Do not include passwords, tokens, private keys, cookies, private database contents, or unrelated personal information.

If the report would disclose a security vulnerability, use [GitHub Private Vulnerability Reporting][security-report] instead of a public issue.

## More information

- [JoshBot source and documentation][source]
- [Canonical Joshternet specification repository][specifications]
- [Joshternet implementation guide][implementation]

[source]: https://github.com/joshternet/joshbot
[retention]: https://github.com/joshternet/joshbot/blob/main/docs/retention.md
[specifications]: https://github.com/joshternet/spec
[implementation]: /implement/
[crawler-report]: https://github.com/joshternet/joshbot/issues/new?template=crawler_report.yml
[bug-report]: https://github.com/joshternet/joshbot/issues/new?template=bug_report.yml
[security-report]: https://github.com/joshternet/joshbot/security/advisories/new
