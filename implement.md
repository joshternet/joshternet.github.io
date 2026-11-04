---
layout: default
title: Implement the Joshternet
description: >-
  Publish a valid /.well-known/josh declaration on your own website. Follow
  practical instructions for the version 1 protocol, optional Josh identity,
  validation, and withdrawal.
keywords: >-
  /.well-known/josh, Joshternet declaration, implement Joshternet, indie web protocol,
  join Joshternet, Content Discovery Handbook
permalink: /implement/
seo:
  type: TechArticle
  name: Implement
---

# Implement the Joshternet

Want to connect your own website to the Joshternet? You don't need a new
account, another publishing platform, or a complicated integration. All you need
is a valid JSON declaration available at `/.well-known/josh` on a website you
control.

This guide covers how to publish that declaration, check that it works, and
understand the details that matter when different web servers and hosting
platforms get involved. The current protocol is defined by
[RFC-JOSH-0002][rfc-0002], with optional Josh identity defined by
[RFC-JOSH-0001][rfc-0001].

New here? Start with the [join guide](/join/). The
[Content Discovery Handbook](/implement/content/) is optional publishing guidance
for people who want to make their sites easier to discover—it is not another join
requirement.

## Join the Joshternet

Participation requires publishing a valid version 1 declaration at exactly:

```text
/.well-known/josh
```

There is no trailing slash and no `.json` extension. The minimum valid
declaration is:

```json
{
  "version": 1
}
```

That's enough to declare participation. You don't have to say whether you're a
Josh.

A declaration applies to the origin serving it. For
`https://joshua.example/`, publish at `https://joshua.example/.well-known/josh`.
`https://joshua.example` and `https://www.joshua.example` are different origins.
If both are meant to participate independently, each needs its own valid
declaration.

You can keep the JSON in whatever source file or configuration your publishing
system needs—some recipes use a build-time `josh.json`. What matters to
Joshternet is the public response at `/.well-known/josh`, not the filename used
while building your website.

Full beginner steps live on the [join guide](/join/). Hosting-specific recipes
live under [Platforms](/implement/platforms/). Feeds, Microformats2, Schema.org,
and other metadata are optional and are not participation requirements.

## Choose your declaration

The `josh` property is optional. `true` affirms Josh identity, `false` declines
it, and leaving it out means identity is undeclared. All three are valid ways to
participate. When present, `josh` must be a JSON Boolean. Omitting it is
different from setting it to `false`. Do not invent other values.
[RFC-JOSH-0001][rfc-0001] is authoritative.

| Declaration | Meaning |
| --- | --- |
| `"josh": true` | Affirmed Josh identity |
| `"josh": false` | Declined Josh identity |
| Property omitted | Undeclared Josh identity |

### Undeclared Josh Identity

```json
{
  "version": 1
}
```

### Affirmed Josh Identity

```json
{
  "version": 1,
  "josh": true
}
```

### Declined Josh Identity

```json
{
  "version": 1,
  "josh": false
}
```

Non-Joshes can participate. Publishers who prefer not to declare an identity can
participate too. Do not infer identity from names, domains, language, or
published content.

## Get connected in three steps

1. **Publish the declaration.** Choose a valid declaration, configure your site
   or server to serve it at the exact public path, and deploy the change. Static
   files, server routes, Workers, and other hosting mechanisms all work when the
   live response is correct.
2. **Verify the declaration.** Confirm the live response with
   [declaration validation](/implement/validate/) or `curl` (see Technical
   references). Check that the JSON is valid and the required fields contain the
   correct values.
3. **Explore the network.** Visit the [Network](/network/) directory and discover
   other participating sites. Optionally
   [nominate a site you control](/nominate/) so JoshBot can consider it under its
   normal crawling rules.

Publishing a valid declaration and appearing in a crawler-generated directory are
separate processes. A valid declaration does not guarantee an immediate listing.

## Help the web discover what you publish

Joining Joshternet requires only the declaration. Established open web standards
can still help compatible applications understand your writing, projects,
creative work, and interests.

The [Content Discovery Handbook](/implement/content/) covers semantic HTML and
accessibility, SEO, slash pages and [OPML](/implement/content/opml/),
Microformats2, Open Graph, Schema.org and JSON-LD, feeds and sitemaps, robots and
crawler directives, identity and relationships, creative media, events, uses
pages, content discovery, validation, and specifications.

The handbook index owns the full chapter directory. Optional
`/.well-known/slashpages` OPML can help discovery of pages such as `/now` or
`/projects`; membership still requires only `/.well-known/josh`.

## What joining requires

| Requirement | Needed to join? |
| --- | --- |
| Valid `/.well-known/josh` declaration | Yes |
| Declaring Josh identity | No |
| Personal website content in English | No |
| RSS or Atom feed | No |
| Microformats2 | No |
| Schema.org JSON-LD | No |
| OPML slash-page manifest | No |
| `/uses` or `/now` page | No |
| Webmention or ActivityPub | No |

Your website can be written in any language. You don't have to translate your
articles, titles, or categories to participate. The JSON declaration uses the
protocol's fixed member names `version` and optional `josh`.

Optional standards can improve interoperability when you choose them. They do not
guarantee indexing, search placement, or inclusion in a particular Joshternet
presentation view.

## Choose your publishing platform

Your hosting platform determines how you publish the declaration. Pick the guide
for the system your website already uses. Tested, non-normative recipes for
static sites, Jekyll, Hugo, WordPress, and other stacks live on
[Platforms](/implement/platforms/).

Installing a button or adding discovery metadata is not required for
participation.

## Build something with Joshternet

Developers can build integrations, validators, publishing tools, buttons, and
other applications. Normative project specifications differ from practical
recipes:

- [Specifications](/specs/) and the [Joshternet specification repository][spec]
- [RFC-JOSH-0002][rfc-0002] (participation declaration) and [RFC-JOSH-0001][rfc-0001] (Josh identity)
- [Platform recipes](/implement/platforms/)
- [Declaration validation](/implement/validate/)
- [Buttons and embedding](/implement/buttons/)
- [Content Discovery Handbook](/implement/content/)
- [Connect independent websites](/implement/content/connections/) (publisher-facing open web connections)
- [Improve content discovery](/implement/content/explore/) (publisher-facing discovery guide)
- [How Joshternet gathers connections](/implement/connections/) (hub crawl notes)
- [How Joshternet builds Explore views](/implement/explore/) (hub Explore notes)

You do not need to use JoshBot or implement its internal data pipeline to ship a
useful integration.

## Participation and discovery are separate

Your declaration is what establishes participation. JoshBot is a separate
discovery service that may find your website, check the declaration, and include
the participating origin in its public registry.

A site can participate before JoshBot knows about it. You can also
[nominate a website you control](/nominate/) to help JoshBot find it, but
nomination is optional. Being crawled does not establish participation or Josh
identity. Participation does not automatically guarantee a current public
directory listing.

Crawler permissions are separate from the participation declaration: a valid
declaration does not require permitting JoshBot, and allowing a crawl does not
create a declaration. See [JoshBot](/joshbot/) for robots and crawler behavior.

## Technical references

Check a live declaration. Replace the example domain with your own website:

```sh
curl -i https://joshua.example/.well-known/josh
```

A successful public response is normally `200 OK` with a JSON object body. The
server should return `Content-Type: application/json`; prefer that header without
treating every other Content-Type as automatically invalid. Prefer serving the
declaration directly. Consumers may follow same-origin redirects; a cross-origin
redirect does not count for the original origin. Use the
[declaration checker](/implement/validate/) for full interactive validation.

A valid version 1 declaration must contain valid JSON, use a JSON object as the
top-level value, contain no duplicate member names, include `version` set to the
JSON integer token `1`, and use a JSON Boolean for `josh` when that member is
present. These are not valid version tokens: `"1"`, `1.0`, and `1e0`.

Invalid examples (consumers must not coerce these):

```json
{ "version": "1" }
```

```json
{ "version": 1, "josh": "true" }
```

The optional `josh` property must be a JSON Boolean. Values such as `"true"`,
`1`, and `null` are not valid substitutes.

Version 1 declarations may contain members not defined by RFC-JOSH-0002.
Consumers should ignore unknown members unless another supported specification
defines them. Unknown members must not alter `version`, `josh`, or participation
through publication. An unknown member does not by itself make an otherwise valid
declaration invalid.

### Stop publishing a declaration

Leaving doesn't require asking Joshternet for permission. To stop declaring
participation from an origin, stop serving a valid declaration at
`/.well-known/josh`.

An authoritative `404 Not Found` or `410 Gone` response indicates that the
resource is no longer published. Temporary DNS failures, timeouts, or server
errors are different: they may prevent a check without establishing a deliberate
withdrawal. Withdrawal does not promise immediate removal from every independent
registry or cache.

Checklist essentials:

- The declaration is available at the exact public path `/.well-known/josh`
- The response contains valid version 1 JSON with no duplicate member names
- Optional Josh identity uses a Boolean
- The resource can be retrieved publicly without authentication or client-side JavaScript
- The response and redirects follow the protocol's origin rules
- The live declaration passes validation

Authoritative text:

- [RFC-JOSH-0002: `/.well-known/josh`][rfc-0002]
- [RFC-JOSH-0001: Josh Identity][rfc-0001]
- [Joshternet specification repository][spec]

[rfc-0001]: https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md
[rfc-0002]: https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md
[spec]: https://github.com/joshternet/spec
