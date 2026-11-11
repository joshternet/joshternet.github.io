---
layout: default
title: JoshBot
description: >-
  Meet JoshBot, the crawler exploring independent websites for the Joshternet.
  Learn how it discovers participating sites, respects crawling rules, verifies
  declarations, and helps build the Network directory.
keywords: >-
  JoshBot, Joshternet crawler, registry discovery, /.well-known/josh, verification,
  robots.txt
seo:
  type: WebPage
  name: JoshBot
permalink: /joshbot/
---

# JoshBot

JoshBot is the little crawler exploring the independent web on behalf of the
Joshternet. It follows links, discovers websites, and checks whether they've
published a valid `/.well-known/josh` declaration. When everything checks out, it
helps build the public Network directory so more people can discover the websites
and the people behind them.

If you've spotted JoshBot wandering through your server logs, you've come to the
right place. The name is silly. The HTTP requests are real.

## What JoshBot does

Finding interesting personal websites shouldn't feel like searching for a needle
in a haystack. JoshBot helps with that by following public links and discovering
independent websites that might want to be part of the Joshternet.

Finding a website doesn't mean its owner is named Josh, and it doesn't mean the
site has joined. JoshBot checks for a valid declaration before adding a
participating origin to the registry. Joshness is declared, never derived.

JoshBot starts with websites it is permitted to explore—an origin that already
published a valid Joshternet declaration, or an origin deliberately configured as
a curated discovery seed. It can find links to other places along the way, but a
link alone doesn't make a website part of the Joshternet. Candidate origins must
pass declaration verification before they can appear in the public registry.

Permission to crawl and participation are different decisions. `robots.txt`
decides whether JoshBot may fetch a URI. Participation is declared separately by
publishing `/.well-known/josh`. The registry helps people find participating
websites. It isn't the network itself, and a website doesn't need to appear in it
before it can participate.

The [canonical Joshternet specifications][specifications] define participation
and Josh identity. They do not require anyone to permit crawling.

## How JoshBot respects robots

Your website, your rules. JoshBot checks `robots.txt` and follows the applicable
crawling instructions. If you don't want JoshBot exploring your site, you can
tell it not to.

JoshBot retrieves and follows the applicable `robots.txt` policy before
requesting pages.

JoshBot sends this exact HTTP user agent:

```text
Joshternet-Joshbot (+https://joshternet.org/joshbot)
```

The product token used when evaluating `robots.txt` is:

```text
Joshternet-Joshbot
```

To block all JoshBot crawling, publish this at `/robots.txt`:

```text
User-agent: Joshternet-Joshbot
Disallow: /
```

You can also use ordinary path-specific `Allow` and `Disallow` rules. A robots
rule that blocks JoshBot prevents the affected URI from being fetched. It does
not change previously recorded declaration observations or make a statement about
Josh identity. Blocking crawling does not automatically withdraw a valid
Joshternet declaration.

## Verified crawler identity

JoshBot is a Cloudflare Verified Bot. Cloudflare has listed it in BotBase, its
public catalog of known bots and agents, since Oct. 19, 2026.

JoshBot uses [Web Bot Auth][web-bot-auth] to cryptographically sign its requests.
Supported infrastructure can check that traffic identifying itself as JoshBot
actually comes from JoshBot, rather than relying on the `User-Agent` string
alone. The public signing-key directory is at
[https://joshternet.org/.well-known/http-message-signatures-directory][signatures-directory].

Verification does not give JoshBot permission to ignore a website's preferences.
JoshBot still retrieves and follows the applicable `robots.txt` policy, respects
crawl restrictions, and operates within its documented request limits.

Identity, operator, access classification, and verification details are public
in the [Cloudflare Radar entry for Joshternet-Joshbot][radar-joshbot].

## Report a problem

JoshBot should be a polite visitor. If something about its behavior looks wrong,
please let us know. A clear report makes it easier to understand what happened
and fix the problem.

For incorrect crawling, unexpected traffic, robots behavior, or another
crawler-specific operational problem, [open a JoshBot crawler report][crawler-report].

For a reproducible software defect that is not specific to crawler behavior,
[open a JoshBot bug report][bug-report].

For crawler reports, please include:

- the affected origin or URL;
- the approximate request time and timezone;
- the observed user agent;
- the relevant `robots.txt` rules;
- sanitized log excerpts;
- what you expected JoshBot to do.

Do not include passwords, tokens, private keys, cookies, private database
contents, or unrelated personal information.

If the report would disclose a security vulnerability, use
[GitHub Private Vulnerability Reporting][security-report] instead of a public
issue.

## Technical details

### Crawler identity and source

Visitor-facing Verified Bot and Web Bot Auth details are under
[Verified crawler identity](#verified-crawler-identity) above. The crawler's
source code and technical documentation are available in the
[JoshBot repository][source].

### How JoshBot crawls

JoshBot doesn't roam around a website without limits. It follows a set of rules
designed to keep crawling predictable, respectful and reasonably lightweight.

JoshBot begins at an eligible origin's root page and may follow same-origin HTTP
or HTTPS links within fixed operator limits.

Crawls are bounded by controls including:

- maximum page depth;
- maximum number of pages;
- maximum response-body size;
- delay between requests;
- redirect limits (Node `nlp:sync` / JoshBot fetch paths cap hops and re-check
  each `Location`);
- per-page timeouts;
- public-network address validation.

Page requests are sequential within a source crawl. JoshBot rejects loopback,
private, link-local, multicast, shared, unspecified, and other non-public
destination addresses. Redirects are subject to the same network checks. Poster
downloads, feed probes, and Playwright enrichment/screenshot routes use the same
`assertPublicURL` gate so a crawled site cannot steer the runner at metadata or
RFC1918 addresses via open redirects or subresources.

### Data JoshBot retains

JoshBot needs to remember where it has been, what it discovered, and whether a
website's declaration could be verified. It also keeps limited operational
information to manage crawling, respect site rules, and investigate problems when
something goes wrong.

JoshBot retains origin-level semantic and operational data so it can retry work,
keep discovery provenance, stay polite, and build the public registry. That
includes:

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

Completed crawl telemetry and disposable verification history are cleaned on a
limited schedule (default about 30 days). Cleanup keeps the newest observation
and newest authoritative declaration observation for each origin when those rows
are still needed. Durable participation metadata, discovery provenance, current
queue state, and compact reprobe state are not age-deleted the same way. The full
table-by-table policy lives in the
[JoshBot data retention documentation][retention].

JoshBot's retained crawler and verification records are separate from the public
registry and from presentation assets on the Joshternet website. On the hub
itself, Joshternet keeps about **30 days** of member writing in
`_data/content.json` for crawl merge, and **displays** the latest **14 days** on
What's New / Activity (regular posters). Showcase creative works stay while still
observed. Older posts remain on each member's own site—Joshternet is not a web
archive of full site history. Hub screenshots used for Network cards are
presentation assets for the website, not part of JoshBot's crawl archive.

The public registry contains deterministic information derived from successfully
verified declarations. Private discovery, queue, and telemetry state are not
published there.

### What JoshBot does not archive

JoshBot isn't trying to make a copy of the internet. The websites it visits
remain the places where the original work lives.

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

## More information

- [Content Discovery Handbook][content] — what hub crawl extractors consume (standards for publishers)
- [JoshBot source and documentation][source]
- [Canonical Joshternet specification repository][specifications]
- [Joshternet implementation guide][implementation]
- [Join the Joshternet][join]

[content]: /implement/content/
[source]: https://github.com/joshternet/joshbot
[retention]: https://github.com/joshternet/joshbot/blob/main/docs/retention.md
[specifications]: https://github.com/joshternet/spec
[implementation]: /implement/
[join]: /join/
[crawler-report]: https://github.com/joshternet/joshbot/issues/new?template=crawler_report.yml
[bug-report]: https://github.com/joshternet/joshbot/issues/new?template=bug_report.yml
[security-report]: https://github.com/joshternet/joshbot/security/advisories/new
[web-bot-auth]: https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/
[signatures-directory]: https://joshternet.org/.well-known/http-message-signatures-directory
[radar-joshbot]: https://radar.cloudflare.com/bots/directory/Joshternet-Joshbot
