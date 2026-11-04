---
layout: default
title: "Connections: Let Independent Websites Talk to Each Other"
description: >-
  Connect independent websites with ordinary links, blogrolls, Webmention,
  WebSub, Micropub, and ActivityPub—keeping observed links, declared relations,
  notifications, and verified interactions distinct.
keywords: >-
  Webmention, WebSub, Micropub, blogroll, ActivityPub, IndieWeb, POSSE,
  connections, independent web
permalink: /implement/content/connections/
nav_title: Connections
content_id: connections
matrix_id: connections
seo:
  type: TechArticle
  name: Connections
---

# Connections

The web was designed around resources connected through hyperlinks. A publisher can link to another person’s work, introduce visitors to interesting sites, reply to an article, or credit a collaborator—without sharing a database or joining the same platform.

Publishing content and participating in a conversation are related but not identical. Ordinary hyperlinks connect resources. Metadata can describe those relationships. Protocols such as Webmention can notify another site that a connection exists. A decentralized social web can emerge from many independently controlled sites speaking compatible standards.

You own your content, control the links you publish, and decide whether to receive or display interactions from other websites.

## How websites found and talked to each other

Hyperlinks made the World Wide Web a web. Personal homepages, blogrolls, directories, webrings, and comments helped people find one another. Earlier cross-site notifications—refbacks, trackbacks, and pingbacks—showed the need for verifiable mentions. [Webmention](https://www.w3.org/TR/webmention/) emerged as a simpler W3C Recommendation: notify a target that a source links to it, then verify the link.

The IndieWeb movement emphasizes personal domains as homes for content. Microformats2 describes posts; Webmention notifies; Micropub publishes; IndieAuth authorizes; WebSub delivers updates. [ActivityPub](https://www.w3.org/TR/activitypub/) (2018) is a broader W3C Recommendation for federated social networking. Each specification has its own origin, status, and job—do not treat them as interchangeable.

## Not every connection means the same thing

A link is an observable fact about a published page. Its **meaning** depends on context.

| Connection | What it means |
| --- | --- |
| Ordinary hyperlink | One resource references another |
| Blogroll entry | A publisher lists another website |
| Author link | A work references its author |
| Credit | A resource attributes a contribution |
| Reply | A post responds to another resource |
| Repost | A post represents or references republished content |
| Syndication | A published work has an associated copy |
| Webmention | A notification reports a link between resources |
| WebSub subscription | A subscriber requests updates about a topic |
| Reciprocal `rel=me` | Resources mutually assert an identity relationship |
| Friendship | A social relationship that cannot be established from ordinary linking alone |

Direction matters: a link from A to B does not imply B links to A. Two sites discussing the same topic do not establish a direct connection. Shared interests, common outbound links, or network membership are not proof of friendship.

## A simple link is already a connection

```html
<a href="https://friends.joshua.example/">
  Visit another independent website
</a>
```

Absolute and relative URLs, stable permalinks, and descriptive anchor text help people and crawlers. Prefer linking to individual articles or projects when that is the intended destination—not only homepages. Redirects and broken links change what visitors actually reach. No extra protocol is required for a hyperlink to work. See [Links and relations]({{ '/implement/content/links/' | relative_url }}).

## Recommend the websites worth visiting

Blogrolls introduce visitors to independent writers, artists, and developers. Descriptions beat unlabeled URL dumps.

```html
<section>
  <h2>Sites I read</h2>
  <ul>
    <li>
      <a href="https://friends.joshua.example/">Friend’s Notes</a>
      — short essays on photography and feeds.
    </li>
    <li>
      <a href="https://other.example/">Other Studio</a>
      — tools and open-source experiments.
    </li>
  </ul>
</section>
```

[OPML]({{ '/implement/content/opml/' | relative_url }}) can distribute machine-readable subscription lists. The community `rel="blogroll"` convention advertises a blogroll document; it is **not** an IANA-registered link relation:

```html
<link
  rel="blogroll"
  type="text/x-opml"
  href="https://joshua.example/blogroll.opml"
>
```

Including a site in a blogroll is a publisher-declared listing—not reciprocal friendship, and not proof that the owners have met.

## Webrings and community directories

Webrings, personal directories, blogroll networks, topic indexes, and curated collections organize independent sites without turning them into a single social network. Being listed by a third party differs from explicitly declaring membership. A webring can offer previous / next / random navigation while each site stays independently hosted:

```html
<nav aria-label="Webring">
  <a href="https://other.example/ring/prev?site=joshua.example">Previous</a>
  <a href="https://other.example/ring/">Ring home</a>
  <a href="https://other.example/ring/next?site=joshua.example">Next</a>
</nav>
```

Membership rules belong to each community—not to a universal hyperlink specification.

## Let another website know you linked to it

[Webmention](https://www.w3.org/TR/webmention/) is a W3C Recommendation for notifying a **target** that a **source** contains a link to it. Roles: source, target, endpoint, sender, receiver, discovery, notification, and source verification.

Webmention does not publish the original post—the source already exists. The receiver must verify the link instead of trusting the notification alone.

<ol class="content-discovery-flow" aria-label="Webmention lifecycle">
  <li>
    <strong>Publish</strong>
    <span>The source page links to the target.</span>
  </li>
  <li>
    <strong>Discover</strong>
    <span>The sender finds the target’s Webmention endpoint.</span>
  </li>
  <li>
    <strong>Notify</strong>
    <span>The sender POSTs source and target URLs.</span>
  </li>
  <li>
    <strong>Verify</strong>
    <span>The receiver fetches the source and confirms the link.</span>
  </li>
  <li>
    <strong>Decide</strong>
    <span>The receiver may record, moderate, display, or ignore the mention.</span>
  </li>
</ol>

A successful notification does **not** automatically create a visible comment.

## How Webmention works

1. **Website B** (`friends.joshua.example`) publishes a post linking to an article on **Website A** (`joshua.example`).
2. B retrieves A’s target page and discovers a Webmention endpoint.
3. B sends an HTTP POST with `source` and `target`.
4. A validates the URLs and whether the target is accepted.
5. A retrieves the source and checks that it actually links to the target.
6. A may record, moderate, or display the verified mention.
7. When B updates or deletes the source, B can notify again so A can re-check.

## Discovering a Webmention endpoint

Discovery mechanisms in the Recommendation include HTTP `Link` headers and HTML `<link>` / `<a>` with `rel="webmention"`. Relative endpoint URLs resolve against the target. Preserve query parameters already present on the endpoint. Follow the specification’s precedence when multiple endpoints are advertised.

```html
<link rel="webmention" href="https://joshua.example/webmention">
```

```http
Link: <https://joshua.example/webmention>; rel="webmention"
```

## Sending a Webmention

```http
POST /webmention HTTP/1.1
Host: joshua.example
Content-Type: application/x-www-form-urlencoded

source=https%3A%2F%2Ffriends.joshua.example%2Freplies%2F42%2F&target=https%3A%2F%2Fjoshua.example%2Fnotes%2Flab%2F
```

Use POST with form encoding, `source`, and `target`. Receivers may respond with 200, 201, or 202; a `Location` header can point at a status URL for asynchronous processing.

```bash
curl -i -X POST 'https://joshua.example/webmention' \
  -d 'source=https://friends.joshua.example/replies/42/' \
  -d 'target=https://joshua.example/notes/lab/'
```

Substitute the real endpoint discovered from the target.

## Never trust the notification alone

Receivers should validate schemes, reject identical source and target, confirm the target is an accepted resource, retrieve the source (with bounded redirects), verify the actual link, handle unsupported types, avoid unsafe duplicates, and queue verification. Invalid URLs, missing sources, and surprising redirects should fail closed. Successful verification and rejected notifications are both normal outcomes.

## Webmention updates and deletions

When outbound links change, replies are edited, or source pages disappear (including HTTP 410), senders should re-notify; receivers should re-discover endpoints when needed and not assume a once-verified mention stays forever. Periodic re-verification is optional. Receiving a deletion-related notification is not the same as immediately deleting a local record—apply your retention policy.

## Webmention moderation and presentation

Receiving and displaying are separate decisions. Use moderation queues, spam filters, sender blocks, sanitization, limited quotations, attribution, and privacy review. Presentation models include comments, replies, mentions, likes, reposts, and backlinks. Webmention verifies a **link**; Microformats2 (or similar) classifies the interaction. Not every mention is a comment or endorsement.

## Explain what the connection means

Microformats2 can describe relationships between posts. Common properties: `h-entry`, `u-in-reply-to`, `u-like-of`, `u-repost-of`, `u-syndication`, `p-author`, `u-url`, `dt-published`, `e-content`. These are **property classes**, not IANA-registered HTML `rel` tokens.

```html
<article class="h-entry">
  <a class="u-url" href="https://friends.joshua.example/replies/42/">
    Permalink
  </a>
  <p>
    In reply to
    <a class="u-in-reply-to" href="https://joshua.example/notes/lab/">
      the original article
    </a>
  </p>
  <div class="e-content">
    <p>I enjoyed this article and wanted to add another example.</p>
  </div>
</article>
```

Parsed (abridged):

```json
{
  "type": ["h-entry"],
  "properties": {
    "url": ["https://friends.joshua.example/replies/42/"],
    "in-reply-to": ["https://joshua.example/notes/lab/"],
    "content": [
      {
        "value": "I enjoyed this article and wanted to add another example.",
        "html": "<p>I enjoyed this article and wanted to add another example.</p>"
      }
    ]
  }
}
```

Webmention communicates that the source exists and links; Microformats2 describes *how* it relates. See [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}).

## Reply from your own website

1. Read the original article on `joshua.example`.
2. Write a reply on your site (`friends.joshua.example`).
3. Give it a stable permalink.
4. Link to the original URL.
5. Add `u-in-reply-to` (and author markup as you like).
6. Discover the target’s Webmention endpoint.
7. Send the Webmention.
8. Check whether the receiver accepted and processed it.

If the target has no Webmention endpoint, the reply still lives on your site and the ordinary hyperlink still connects the resources. Lack of Webmention does not block open-web participation.

## Likes, reposts and reactions

A reply adds content; a like expresses appreciation (`u-like-of`); a repost shares or references existing content (`u-repost-of`); a quotation may add commentary; a syndicated copy is a distribution of your own work. Receivers choose how to display them. A repost is not authorship of the original—attribute and respect copyright.

## Syndication: publish on your own site first

**POSSE**—Publish (on your) Own Site, Syndicate Elsewhere—keeps the canonical original on your domain and links out to copies with `u-syndication`. **PESOS**—Publish Elsewhere, Syndicate to Own Site—imports from elsewhere; the original may live off-site. Permalinks, updates, deletes, and attribution differ by strategy. Third-party copies follow that service’s rules and permissions.

## Bring conversations back home

**Backfeed** associates reactions on syndicated copies with the original. Bridges (for example [Bridgy](https://brid.gy/), where current features should be verified against their docs) can connect independent sites with other networks. Matching originals, duplicates, missing URLs, edits, deletes, private content, and identity conflicts are hard. Bridges are optional tools—not standardized parts of Webmention itself. Decide what imported interactions you will display.

## Get notified when published content changes

[WebSub](https://www.w3.org/TR/websub/) is a W3C Recommendation (**02 June 2026**) for delivering updates about a **topic** through a **hub** to **subscribers**. Publishers notify the hub; the hub distributes to callbacks. Subscribers need not poll continuously.

WebSub distributes topic updates. Webmention reports a particular source→target link. They are not the same protocol. The 2026 Recommendation updates security considerations (including XSS-related mitigations)—read that section when implementing.

## WebSub discovery and subscription

Discover hubs and topic self-URLs via `rel="hub"` and `rel="self"` in HTML or HTTP `Link` headers (often on feeds). Subscribers send `hub.mode`, `hub.topic`, and `hub.callback`; hubs verify callbacks, grant leases, support renewal and unsubscription. Optional secrets enable authenticated notifications. See the Recommendation for normative parameter names and security requirements.

## WebSub delivery and failure handling

Publishers ping hubs; hubs fetch updated content and POST to callbacks; subscribers acknowledge; signatures apply when secrets are configured; retries, duplicates, expiration, and malicious payloads need bounded handling. WebSub is not a full historical archive—pair it with stable entry IDs in [feeds]({{ '/implement/content/feeds/' | relative_url }}).

## Publish to your website from another application

[Micropub](https://www.w3.org/TR/micropub/) is a W3C Recommendation for a client-to-server API that creates, updates, and deletes posts. Roles: client, server, Micropub endpoint, authenticated user, and optional media endpoint. Micropub manages posts; Webmention reports links; WebSub delivers subscriptions.

## Micropub endpoint discovery and configuration

```html
<link rel="micropub" href="https://joshua.example/micropub">
```

HTTP `Link` headers may also advertise the endpoint. Configuration queries and media-endpoint discovery are defined by the Recommendation. A discovery link does **not** make a static site accept posts—something must handle authenticated requests.

## Creating, updating and deleting Micropub posts

Create posts with form-encoded bodies (and JSON where supported), typically describing h-entry properties, using an `Authorization` bearer token from IndieAuth/OAuth. Updates use JSON `replace` / `add` / `delete` operations where implemented. Delete (and optional undelete) are specification actions. Media endpoints are optional. Do not treat every optional feature as required of every server.

```http
POST /micropub HTTP/1.1
Host: joshua.example
Authorization: Bearer REPLACE_WITH_ACCESS_TOKEN
Content-Type: application/x-www-form-urlencoded

h=entry&content=Hello+from+a+Micropub+client&name=Hello
```

## IndieAuth and authorization

Knowing who someone is does not authorize publishing. IndieAuth (see [Identity]({{ '/implement/content/identity/' | relative_url }})) helps obtain access tokens with scopes for Micropub clients. Cover identity URLs, authorization endpoints, tokens, scopes, validation, expiration, and revocation. Follow the [IndieAuth Living Standard](https://indieauth.spec.indieweb.org/) and [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700).

## Federated social networking

[ActivityPub](https://www.w3.org/TR/activitypub/) (W3C Recommendation, 2018) and [ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) support decentralized social networking: client-to-server and server-to-server federation; actors, objects, activities, inboxes, outboxes, followers, following, collections, delivery, and audience addressing. Mastodon and compatible apps exchange activities across servers. Operating an ActivityPub server is not the same as adding Schema.org JSON-LD to a blog. Ordinary personal sites do not automatically federate.

## ActivityPub interactions and delivery

Core activities include `Create`, `Update`, `Delete`, `Follow`, `Accept`, `Reject`, `Like`, `Announce`, and `Undo`. Actors publish and receive activities with stable identifiers; inboxes need deduplication and careful delivery. Authentication and addressing often involve additional profiles. ActivityPub is not a drop-in Webmention replacement.

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "actor": "https://friends.joshua.example/actors/avery",
  "object": {
    "type": "Note",
    "content": "A short federated note.",
    "id": "https://friends.joshua.example/notes/1"
  }
}
```

## Compare the interaction protocols

| Mechanism | Primary purpose |
| --- | --- |
| Ordinary HTML links | Connect resources |
| Blogrolls and OPML | Curate sites and subscriptions |
| Microformats2 | Describe posts and relationships |
| Webmention | Notify a target about a source link |
| WebSub | Deliver topic updates via hubs |
| Micropub | Create and manage posts via an API |
| IndieAuth | Decentralized authentication and authorization |
| ActivityPub | Exchange activities across federated systems |
| RSS, Atom, JSON Feed | Publish subscribable updates |
| WebFinger | Discover account-related resources |

Implement what your publishing goals need—not a checklist for Joshternet.

## Start with links, add interaction when you need it

1. **Publish ordinary links** — stable permalinks and meaningful hrefs.
2. **Share recommendations** — blogroll, links page, or webring nav.
3. **Describe interactions** — Microformats2 for replies, likes, syndication.
4. **Send Webmentions** — notify compatible targets.
5. **Receive Webmentions** — endpoint, verification, moderation.
6. **Publish via clients** — Micropub + authorization.
7. **Distribute or federate** — WebSub or ActivityPub when justified.

These are adoption stages, not mandatory dependencies. Operational cost rises with each layer.

## Complete website implementation example

**A** (`joshua.example`) publishes `/notes/lab/` and advertises `rel="webmention"`. **B** (`friends.joshua.example`) publishes `/replies/42/` with `u-in-reply-to`, discovers A’s endpoint, and POSTs source/target. A validates, fetches B’s HTML, verifies the link, reads Microformats2, queues moderation, and may display the reply. Later B edits or deletes the reply and re-notifies; A re-verifies. Optionally B authored the reply through Micropub—not required for the Webmention path.

## Static-site implementation considerations

Static generators (Jekyll, Hugo, Eleventy, custom) can emit permalinks, Microformats2, and outbound Webmention sends at build or deploy time. Receiving Webmentions or running Micropub needs a dynamic endpoint or external service, plus storage and moderation before approved interactions re-enter the next build. Deduplicate submissions across deploys.

## Moderation, privacy and publisher control

Spam, harassment, unwanted mentions, blocks, sanitization, link rot, copyright, consent, retention, and visitor privacy are operational realities. You are not obligated to display every verified mention. Prefer linking to originals over republishing restricted remote content.

## Security considerations

Treat remote data as untrusted: SSRF, private IPs, DNS rebinding, redirect abuse, oversized responses, parser bombs, HTML/JS injection, CSRF, unsafe schemes, spoofed mentions, fake authorship, replays, duplicates, unsafe WebSub callbacks, missing signatures, OAuth token leakage, ActivityPub auth gaps, rate limits, and timeouts. Webmention receivers must verify the source link before acting. WebSub subscribers should verify signed deliveries when secrets are used. Micropub must enforce authorization and scopes. Follow each specification’s security sections.

## Know why a connection exists

Useful provenance: source site, source URL, target URL, relation type, evidence type, observed time, verification status, last checked, updated/removed. Categories such as **observed**, **publisher-declared**, **protocol-verified**, **reciprocally verified**, and **manually confirmed** help readers—without inventing a universal trust system. An observed link is stronger than a shared topic and still not friendship.

## Connections and the Joshternet

Links among member sites help visitors explore people, projects, and publications. Outbound hyperlinks, blogrolls, replies, reposts, syndication, and credits are different signals—not interchangeable with shared topics, Josh identity, or participation.

Joshternet’s hub records **observed, directed edges between current participants** only: `homepage-link`, `content-link`, `blogroll`, `reply-to`, `repost-of`, `syndication`, and `credit`, with `observed` evidence. Blogroll ads use `<link rel="blogroll" type="text/xml">` (caps apply). It does **not** infer friendship or topic edges, does not create edges from `/.well-known/josh`, and does **not** send or receive Webmention, WebSub, Micropub, IndieAuth, or ActivityPub. Credit typing may use link-text heuristics—not independently verified collaboration. The public [Connections]({{ '/connections/' | relative_url }}) view is evidence, not a follow graph. Details: [Implement → Connections]({{ '/implement/connections/' | relative_url }}), [Reference]({{ '/implement/content/reference/' | relative_url }}).

## Validate Webmention implementations

Use the Recommendation and [webmention.rocks](https://webmention.rocks/): discovery variants, relative endpoints, query preservation, form encoding, responses, invalid URLs, redirects, source verification, duplicates, updates, and deletes. Passing one sender test does not prove a secure receiver.

## Validate WebSub implementations

Use [websub.rocks](https://websub.rocks/) (verify availability) against the **June 2026** Recommendation: hub/self discovery, subscribe/verify/renew/unsubscribe, delivery, signatures, duplicates, and HTTP requirements.

## Validate Micropub implementations

Use [micropub.rocks](https://micropub.rocks/): discovery, authorization, form/JSON create, Location headers, update/delete where supported, media endpoints, configuration, scopes, and errors. Never treat anonymous posts as success.

## Validate ActivityPub implementations

Actor documents, AS2 JSON-LD, inbox/outbox, identifiers, collections, federation delivery, deduplication, audience, auth, and update/delete behavior all matter. A valid actor document alone is not a full federated server. Use the W3C Recommendation and available interop tests.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Every link as friendship | False social claims | Separate evidence levels |
| Blogroll as reciprocal | Assumed mutuality | Listing ≠ reply link |
| Topic co-mention as edge | Invented graph | Require directed links |
| Identity links as content interactions | Mixed semantics | Keep `rel=me` vs replies apart |
| Trust WM before verify | Spoofed comments | Fetch and check source |
| Notify before source is live | Failed verification | Publish source first |
| Drop endpoint query params | Wrong endpoint | Preserve queries |
| Bad relative endpoints | Broken discovery | Resolve against target |
| Ignore redirects | Missed or unsafe fetches | Bound and validate |
| Unsanitized remote HTML | XSS | Sanitize / quote carefully |
| Like = reply = repost | Wrong UI | Use mf2 classes distinctly |
| mf2 classes as HTML `rel` | Spec confusion | Keep vocabularies separate |
| Spam duplicate WM | Noise | Dedupe by source/target |
| Ignore updates/deletes | Stale mentions | Re-notify and re-check |
| Republish private remote content | Consent breach | Link out; respect audience |
| WM as automatic comments | Wrong expectation | Moderation is separate |
| WebSub replaces feeds | Incomplete archives | Keep feeds + IDs |
| WebSub = Webmention | Wrong protocol | Topic updates vs link notify |
| Micropub as notification | Category error | Micropub publishes posts |
| Micropub without auth | Open write hole | Tokens + scopes |
| IndieAuth = publish rights | Over-permission | Authorization distinct |
| JSON-LD as ActivityPub | False federation | Need real AP server behavior |
| Syndication as original | Attribution loss | Canonical + `u-syndication` |
| Heuristic credit as verified collab | Overclaim | Label evidence class |
| Unsafe remote fetches | SSRF | Allowlists, blocks, timeouts |
| No rate limits | Abuse | Bound processing |
| No deletion/moderation policy | Sticky harm | Define retention rules |
| All protocols required | Barrier to entry | Progressive optional stages |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})
- [OPML]({{ '/implement/content/opml/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Identity and authorship]({{ '/implement/content/identity/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Identity and authorship; next: Creative media).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [Webmention](https://www.w3.org/TR/webmention/) | W3C Recommendation |
| [Webmention Rocks](https://webmention.rocks/) | Test suite |
| [WebSub](https://www.w3.org/TR/websub/) | W3C Recommendation (02 June 2026) |
| [WebSub Rocks](https://websub.rocks/) | Test suite |
| [Micropub](https://www.w3.org/TR/micropub/) | W3C Recommendation |
| [Micropub Rocks](https://micropub.rocks/) | Test suite |
| [ActivityPub](https://www.w3.org/TR/activitypub/) | W3C Recommendation |
| [ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) | Core model |
| [Activity Vocabulary](https://www.w3.org/TR/activitystreams-vocabulary/) | Activity types |
| [IndieAuth Living Standard](https://indieauth.spec.indieweb.org/) | Auth for publishing clients |
| [Microformats2](https://microformats.org/wiki/microformats2) | Structured HTML |
| [h-entry](https://microformats.org/wiki/h-entry) | Posts |
| [IndieWeb reply](https://indieweb.org/reply) | Reply practice |
| [POSSE](https://indieweb.org/POSSE) | Syndicate from your site |
| [PESOS](https://indieweb.org/PESOS) | Import to your site |
| [u-syndication](https://indieweb.org/u-syndication) | Syndicated copies |
| [OPML 2.0](https://opml.org/spec2.opml) | Outlines / blogrolls |
| [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) | Web Linking |
| [HTML Living Standard](https://html.spec.whatwg.org/) | HTML |
| [RFC 7033](https://www.rfc-editor.org/rfc/rfc7033) | WebFinger |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | HTTP semantics |
| [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700) | OAuth security BCP |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
