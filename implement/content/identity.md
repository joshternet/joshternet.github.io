---
layout: default
title: "Identity and Authorship: Be Yourself on Your Own Website"
description: >-
  Publish an independent identity on your own domain—About pages, Microformats2
  h-card, rel=me, authorship, Schema.org Person, IndieAuth, and WebFinger—
  while keeping identity, authorship, authentication, and verification distinct.
keywords: >-
  h-card, rel=me, authorship, IndieAuth, WebFinger, Schema.org Person,
  independent identity, About page, Microformats2
permalink: /implement/content/identity/
nav_title: Identity
content_id: identity
matrix_id: identity
seo:
  type: TechArticle
  name: Identity and authorship
---

# Identity

Many online services identify people through accounts controlled by individual companies. Those accounts can be useful, but they do not need to be the primary home of someone’s online presence.

A personal domain can be a stable address for who you are online: interests, work, and links to other places you participate. The open web offers complementary ways to describe and discover that identity.

Keep these ideas separate:

1. **Identity** — how a person or organization represents itself online.
2. **Authorship** — who created or contributed to a particular work.
3. **Verification** — evidence that someone controls a website, profile, or other resource.

Later sections add a fourth: **authentication** (proving who is signing in) and **authorization** (what an app may do). None of these automatically equals legal identity verification.

<ol class="content-discovery-flow" aria-label="Identity, authorship, and verification">
  <li>
    <strong>Identity</strong>
    <span>You publish who you are on a site you control.</span>
  </li>
  <li>
    <strong>Authorship</strong>
    <span>You attribute articles and works to people or organizations.</span>
  </li>
  <li>
    <strong>Connect</strong>
    <span>You link to other profiles that represent the same identity.</span>
  </li>
  <li>
    <strong>Verify</strong>
    <span>Compatible apps check control—links, challenges, or sign-in protocols.</span>
  </li>
  <li>
    <strong>Authenticate</strong>
    <span>Optional protocols let you sign in with a URL you control.</span>
  </li>
</ol>

## Before every website needed an account

Personal homepages, email addresses, and domains long served as durable online identifiers. Forums, blogs, and social platforms later made usernames and profiles ubiquitous. The IndieWeb idea of using a personal website as a primary identity revived older practices with clearer conventions: XFN, classic hCard, Microformats2, `rel="me"`, and IndieAuth. Interoperability matters when platforms change. No single approach is mandatory.

## An address on the web that belongs to you

A domain and HTTPS origin can become a stable reference for a person or organization: homepage, About page, canonical profile URL, links to other identities, redirects, and migrations over time. Administering a domain is not the same as proving a legal identity. HTTPS authenticates the connection to a host; it does not prove who the person in the About page is in the physical world.

One domain may host many authors; one person may operate many domains. Prefer stable URLs and redirects when names or hosts change. See [Links and relations]({{ '/implement/content/links/' | relative_url }}) for canonicalization.

## Give visitors a place to get to know you

An `/about/` page can introduce a site’s author or organization: name or publishing identity, short introduction, interests, projects, writing links, contact methods, associated websites, and an optional portrait. Everything is optional. A pseudonym is fine; private information is not required for a meaningful public presence.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>About Avery Example — Harbor Notes</title>
    <link rel="canonical" href="https://joshua.example/about/">
  </head>
  <body>
    <main>
      <article>
        <header>
          <h1>About Avery Example</h1>
        </header>
        <p>
          Avery writes short notes about the independent web, photography, and
          small software projects from Harbor Notes.
        </p>
        <p>
          <a href="https://joshua.example/notes/">Notes</a>
          ·
          <a href="https://joshua.example/photography/">Photography</a>
        </p>
        <address>
          Contact:
          <a href="mailto:hello@joshua.example">hello@joshua.example</a>
        </address>
      </article>
    </main>
  </body>
</html>
```

## Semantic HTML for personal identity

Before Microformats2 or JSON-LD, ordinary HTML already helps: `<main>`, `<article>`, `<header>`, headings, paragraphs, portrait images with useful `alt`, navigation, author links, and contact links. `<address>` means contact information for the nearest article or document—not a generic street-address box. See [Semantic HTML]({{ '/implement/content/html/' | relative_url }}).

## Describe yourself using Microformats2

[h-card](https://microformats.org/wiki/h-card) is a Microformats2 vocabulary for people and organizations. The root class is `h-card`. Properties inside describe the subject.

| Property | Purpose |
| --- | --- |
| `p-name` | Name |
| `p-given-name` | Given name |
| `p-family-name` | Family name |
| `p-nickname` | Nickname or handle |
| `u-url` | Profile or homepage URL |
| `u-uid` | Stable identifier |
| `u-photo` | Portrait |
| `u-logo` | Logo |
| `p-note` | Short description |
| `p-org` | Organization |
| `p-job-title` | Job title |
| `u-email` | Email |
| `p-category` | Interests or categories |
| `p-locality` / `p-region` / `p-country-name` | Place (optional) |
| `dt-bday` | Birthday (optional; privacy-sensitive) |
| `u-key` | Public key URL |

Include only what you intend to publish. Person-oriented and organization-oriented cards share the vocabulary with different property mixes.

## Complete h-card implementation

```html
<div class="h-card">
  <img
    class="u-photo"
    src="https://joshua.example/images/avery.jpg"
    alt="Portrait of Avery Example"
    width="160"
    height="160"
  >
  <h1 class="p-name">Avery Example</h1>
  <p class="p-note">
    Writer, photographer and maker of small web projects.
  </p>
  <p>
    Website:
    <a class="u-url" href="https://joshua.example/">joshua.example</a>
  </p>
  <p>
    Contact:
    <a class="u-email" href="mailto:hello@joshua.example">Email Avery</a>
  </p>
</div>
```

The markup remains readable HTML. A conforming parser yields (abridged):

```json
{
  "type": ["h-card"],
  "properties": {
    "photo": [
      {
        "alt": "Portrait of Avery Example",
        "value": "https://joshua.example/images/avery.jpg"
      }
    ],
    "name": ["Avery Example"],
    "note": ["Writer, photographer and maker of small web projects."],
    "url": ["https://joshua.example/"],
    "email": ["mailto:hello@joshua.example"]
  }
}
```

`u-url` associates a URL with the card subject. It does **not** by itself assert `rel="me"`.

## Minimal and extended h-cards

A useful h-card can be tiny:

```html
<a class="h-card p-name u-url" href="https://joshua.example/">
  Avery Example
</a>
```

Parsed:

```json
{
  "type": ["h-card"],
  "properties": {
    "name": ["Avery Example"],
    "url": ["https://joshua.example/"]
  }
}
```

Root class and properties can share one element. Implied properties and nesting exist; more metadata is not automatically better. See [Microformats2]({{ '/implement/content/microformats2/' | relative_url }}).

## People, organizations and affiliations

h-card also describes organizations. Nest an org card inside `p-org` when someone is affiliated with a studio or employer:

```html
<div class="h-card">
  <p class="p-name">Avery Example</p>
  <p class="p-org h-card">
    <a class="p-name u-url" href="https://joshua.example/studio/">
      Harbor Studio
    </a>
  </p>
</div>
```

Parsed `org` becomes a nested h-card. Affiliation, employment, membership, and authorship are different claims—do not infer them from ordinary hyperlinks alone.

## The difference between h-card and hCard

Classic **hCard** used Microformats1 class names (`vcard`, `fn`, `url`). Microformats2 uses `h-card`, `p-name`, `u-url`, and related prefixes. Older sites may still publish classic markup; new sites can use Microformats2. Consumers may support both. The syntaxes are not identical.

## Connect your other online identities

The `me` link relation (XFN / IndieWeb; also listed in the [IANA registry](https://www.iana.org/assignments/link-relations/)) asserts that the target represents the same person or entity as the context:

```html
<a href="https://profiles.joshua.example/avery/" rel="me">
  My other profile
</a>
```

`rel="me"` is distinct from the h-card vocabulary even when both appear on one page. See [IndieWeb rel=me](https://indieweb.org/rel-me) and [Links]({{ '/implement/content/links/' | relative_url }}).

## How two websites can confirm a connection

Personal site:

```html
<a href="https://profiles.joshua.example/avery/" rel="me">
  Avery's profile
</a>
```

Profile linking back:

```html
<a href="https://joshua.example/" rel="me">Avery's website</a>
```

A compatible verifier fetches both resources and checks the reciprocal links. That can evidence mutual control or coordination under the verifier’s rules. It does **not** establish government identity, guarantee permanent account control, or prove a trust relationship between the services. Always verify live URLs and content—not only a publisher’s claim. A one-way link alone is not reciprocal verification.

## Rel=me on different platforms

Some services (for example Mastodon profile metadata) support reciprocal verification indicators. Requirements differ: profile fields, exact URL matching, redirect handling, and account migration rules. Not every social network implements `rel=me`. Platform-neutral checklist: publish outbound `rel=me` → ensure the destination exists → add reciprocal `rel=me` where supported → re-check after URL or account changes. Consult each platform’s current docs.

## Rel=me and h-card together

```html
<div class="h-card">
  <a class="p-name u-url" href="https://joshua.example/">Avery Example</a>
  <a rel="me" href="https://profiles.joshua.example/avery/">Other profile</a>
</div>
```

- **h-card** structures information about a person or organization.
- **`u-url`** associates a URL with that subject.
- **`rel="me"`** asserts same-identity between context and target.

They overlap in practice but are not interchangeable. Not every h-card URL is a `rel=me` claim.

## Who wrote this?

Identity describes a person; authorship attributes a work. Authors, creators, contributors, editors, publishers, and copyright holders differ. HTML `rel="author"` associates a document with an author resource:

```html
<article>
  <h1>Notes from the lab</h1>
  <p>
    Written by
    <a href="/about/" rel="author">Avery Example</a>
  </p>
</article>
```

An author link does not prove identity and is not reciprocal verification. Do not use `rel="author"` for unrelated navigation.

## Authorship with Microformats2

```html
<article class="h-entry">
  <h1 class="p-name">Notes from the lab</h1>
  <p>
    By
    <a class="p-author h-card" href="https://joshua.example/about/">
      <span class="p-name">Avery Example</span>
    </a>
  </p>
  <time class="dt-published" datetime="2026-10-15">October 15, 2026</time>
  <div class="e-content"><p>Lab notes.</p></div>
</article>
```

Parsed author is a nested h-card with `name` and `url`. Multiple authors are possible where the vocabulary allows. Reuse a stable About URL instead of duplicating full profiles in every post.

## Authorship with Schema.org

Schema.org types and properties include `Person`, `Organization`, `author`, `creator`, `contributor`, `publisher`, `sameAs`, `mainEntityOfPage`, and `@id`.

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Notes from the lab",
  "datePublished": "2026-10-15",
  "author": {
    "@type": "Person",
    "@id": "https://joshua.example/#person",
    "name": "Avery Example",
    "url": "https://joshua.example/about/",
    "sameAs": ["https://profiles.joshua.example/avery/"]
  }
}
```

`@id` lets many articles reference one Person entity. `sameAs` asserts identity equivalence among URLs; it is not a cryptographic ownership protocol. Keep visible bylines, canonical URLs, and structured data consistent. See [Schema.org]({{ '/implement/content/schema-org/' | relative_url }}).

## Give your identity a lasting address

Stable identifiers matter when work is spread across sites: homepage URLs, canonical About pages, JSON-LD `@id`, Microformats2 `u-uid`, and careful redirects after migrations. A fictional durable id:

`https://joshua.example/#person`

An identifier need not be a separate navigable page, but it should remain meaningful and stable. Changing identifiers without redirects or explicit associations breaks consumers. Stability is separate from proving control.

## Domain ownership and control verification

Systems establish control evidence in different ways:

| Method | Often demonstrates | Does not automatically prove |
| --- | --- | --- |
| DNS TXT challenge | DNS configuration control at check time | Authorship of every page; legal identity |
| Well-known URL / file upload | Ability to publish at that path | Permanent ownership after transfer |
| HTML meta verification token | Ability to edit page source | Truth of every claim on the site |
| Reciprocal `rel=me` | Coordinated linking under verifier rules | Government identity |
| OAuth account login | Control of that account session | Control of every linked domain |
| HTTPS certificates | Authenticated host for the connection | Real-world identity of the About page |

A verified site can still publish incorrect authorship. This handbook does not invent a Joshternet-specific verification protocol beyond the published RFCs.

## Use your website to sign in

[IndieAuth](https://indieauth.spec.indieweb.org/) is an identity layer on OAuth 2.0. Users identify with URLs they control. Key ideas: end-user identity URLs, clients, authorization and token endpoints, authorization servers, redirect URIs, authorization codes, access tokens, scopes, and [PKCE](https://www.rfc-editor.org/rfc/rfc7636).

Authenticating a user is not the same as authorizing an application to publish or read private data.

**Status:** The community [IndieAuth Living Standard](https://indieauth.spec.indieweb.org/) is normative for current implementers. The [2018 W3C Working Group Note](https://www.w3.org/TR/indieauth/) is a Note—not a W3C Recommendation. Prefer the Living Standard and [indieauth.rocks](https://indieauth.rocks/) when building servers.

## How IndieAuth authentication works

1. The user enters their personal identity URL.
2. The client discovers the applicable IndieAuth authorization service.
3. The client starts a secure authorization request (state, PKCE, validated redirect URI).
4. The user authenticates with the authorization service.
5. The service returns an authorization response.
6. The client validates the response and exchanges the code as required.
7. The client establishes the verified identity per the protocol.

Modern IndieAuth is distinct from older RelMeAuth-only sign-in. Implementations need not route every login through a third-party social account. Follow the Living Standard for normative details.

## IndieAuth discovery and endpoint metadata

Clients discover services from the identity URL using the link relations and metadata defined by the current Living Standard (authorization endpoint, token endpoint, and related discovery). Distinguish identity URL discovery, endpoint discovery, client metadata, and authorization-server metadata. Do not invent endpoint names; read the current specification for property names and compatibility notes.

## Identity and authorization are separate

Knowing who someone is does not grant an app permission to act. Identity assertions, authentication, OAuth authorization, access tokens, scopes, resource ownership, and application permissions are different layers. A verified identity URL alone does not authorize posting or file access. [Micropub](https://www.w3.org/TR/micropub/) is an example publishing API that may use IndieAuth-issued tokens—see that specification for details.

## Discover identity information from an account address

[WebFinger](https://www.rfc-editor.org/rfc/rfc7033) (RFC 7033) discovers information about an account identifier or URI via `/.well-known/webfinger` and a `resource` query parameter. The `acct:` URI scheme commonly identifies accounts.

```http
GET /.well-known/webfinger?resource=acct%3Aavery%40joshua.example HTTP/1.1
Host: joshua.example
Accept: application/jrd+json
```

Illustrative JRD:

```json
{
  "subject": "acct:avery@joshua.example",
  "aliases": ["https://joshua.example/"],
  "links": [
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "type": "text/html",
      "href": "https://joshua.example/about/"
    }
  ]
}
```

WebFinger is discovery, not authentication. Federated systems such as Mastodon use it heavily; ordinary personal sites need not implement it.

## Identity across federated services

| Ecosystem | Typical identifier | Notes |
| --- | --- | --- |
| Personal domain | `https://joshua.example/` | Publisher-controlled homepage |
| ActivityPub / Mastodon | `acct:` + actor URLs | Often discovered via WebFinger |
| AT Protocol | DIDs / handles | See [AT Proto identity](https://atproto.com/specs/did) |
| Bluesky handles | Domain handles mapped into AT Proto | Platform-specific verification |

Formats, verification, and migration rules differ. One check does not establish identity everywhere. These ecosystems are complementary—not required for Joshternet.

## You decide how much of yourself to share

Publish a legal name, chosen name, pseudonym, handle, artistic identity, organization, or project name. Separate personal and professional sites if you want. A pseudonym does not make a site less independently controlled. Meaningful identity does not require a legal name, postal address, or other private data.

## Multiple authors and collaborative websites

Site ownership, organizational publishing, article authors, editors, guest writers, and collective identities can coexist. Attribute each work accurately—do not assign every article to the domain administrator by default. Contributor pages and stable author URLs help. Represent both an organization and its creators without conflating them.

## Identity and creative ownership

Author, creator, performer, photographer, publisher, rights holder, license holder, and distributor are different roles. Metadata can name contributors without settling copyright. HTML `rel="license"` and Schema.org properties complement bylines; they do not verify ownership. Linking to a project does not establish authorship of every asset inside it.

## Complete personal identity example

Harbor Notes can ship a static site with: homepage, About + h-card, canonical profile URL, outbound `rel=me`, reciprocal profile link, blog post with `rel=author` and h-entry, and Schema.org Person `@id`—without requiring IndieAuth or WebFinger to publish a human-readable identity.

About (excerpt):

```html
<main class="h-card" id="person">
  <h1 class="p-name">Avery Example</h1>
  <p class="p-note">Notes, photography, and small web tools.</p>
  <a class="u-url" href="https://joshua.example/">https://joshua.example/</a>
  <a rel="me" href="https://profiles.joshua.example/avery/">Elsewhere profile</a>
</main>
```

These representations complement one another: HTML for people, h-card for mf2 consumers, `rel=me` for identity linking, Schema.org for JSON-LD graphs.

## Implementing identity metadata in site generators

Handwritten HTML, Jekyll, Hugo, Eleventy, WordPress, and custom generators can emit profile links, h-card, author attribution, and JSON-LD from one author record. Avoid contradictory names or profile URLs across templates. Generated data should reflect the **actual** author of each item, not always the site owner.

## Keep your identity connected as things change

Names change, domains move, profiles vanish, services shut down, projects become organizations, maintainers rotate, and domains expire. Update redirects, `rel=me` pairs, Schema `@id` references, and verification tokens. An old reciprocal link or historical check does not prove current control. Applications should re-verify when evidence ages.

**Migration checklist:** map old→new URLs → permanent redirects → update About/canonical → refresh `rel=me` both ways → update JSON-LD `@id` / `sameAs` → re-run platform verification → spot-check authorship on recent posts.

## Security considerations

Forged claims, spoofed profiles, compromised sites, stolen accounts, expired domains, open redirects, untrusted URLs, malicious WebFinger JRD, SSRF against discovery clients, unsafe OAuth redirects, missing state/PKCE, token leakage, phishing, account takeover, false authorship, and misleading “verified” badges all matter. Transport security (HTTPS) is not identity verification. A badge or metadata field is not proof of a verified real-world identity.

## Privacy considerations

Public email, phone, postal address, birthday, location, employer, photos, social accounts, and family details become easier to scrape and correlate when structured. Publish intentionally and minimally. Separate public identities where appropriate—without promising that technical separation guarantees anonymity. Examples in this chapter use fictional contacts only.

## Identity, authorship and the Joshternet

You may publish h-card, `rel=me`, and authorship metadata without joining Joshternet. You may join Joshternet without a legal name, h-card, IndieAuth endpoint, or social account. Participation is a valid `/.well-known/josh` declaration. The optional `josh` boolean is the publisher’s declared Josh identity (affirmed, declined, or undeclared)—separate from listing. Ordinary author links and external profiles do not prove someone is or is not a Josh.

Joshternet’s hub uses selected Person/WebSite JSON-LD, author meta, about blurbs, and loose h-card name heuristics for Network display titles; `rel=me` feeds Elsewhere. It does **not** implement a full h-card authorship graph, reciprocal verification, IndieAuth, WebFinger, or `sameAs` consumption. Details: [Reference]({{ '/implement/content/reference/' | relative_url }}), [RFC-JOSH-0001](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md), [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md).

## Verify what your website says about you

1. Confirm the About URL is stable and public.
2. Validate HTML ([Nu HTML Checker](https://validator.w3.org/nu/)).
3. Parse h-card with a conforming Microformats2 parser.
4. Check `rel=me` destinations and reciprocity where claimed.
5. Confirm article author links match intended contributors.
6. Validate Schema.org Person/BlogPosting graphs.
7. Check canonical profile URLs and redirects.
8. If you run WebFinger, verify `resource`, HTTPS, and `application/jrd+json`.
9. If you run IndieAuth, use [indieauth.rocks](https://indieauth.rocks/) and current Living Standard checks (redirect, PKCE, state).
10. Review source and parsed JSON for accidental private data.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Domain as legal ID | Overstated assurance | Treat domain as publishing control |
| Profile page as “verified account” | False confidence | Separate page from verification |
| Properties outside h-card root | Parser misses data | Nest properties correctly |
| Wrong mf2 classes | Empty parse | Use `p-` / `u-` / `dt-` / `e-` prefixes |
| Unstable relative ids | Broken references | Prefer absolute canonical profile URLs |
| Every `u-url` as `rel=me` | Wrong semantics | Add `rel=me` only when intended |
| One-way `me` as verified | Incomplete check | Require reciprocity where needed |
| Reciprocal `me` as legal ID | Overclaim | Limit the claim to control evidence |
| Misusing `rel=author` | Noise | Author resources only |
| Authorship = site ownership | Wrong bylines | Attribute the actual creator |
| Every post → domain admin | Misattribution | Per-item authors |
| Inconsistent Person `@id`s | Split entities | One stable id |
| `sameAs` for unrelated sites | False equivalence | Link only same-identity URLs |
| Wrong org affiliations | Misleading graph | Nest org cards carefully |
| Accidental private contact data | Privacy leak | Minimal public disclosure |
| IndieAuth = profile linking | Category error | Linking ≠ sign-in protocol |
| IndieAuth = WebFinger | Mixed protocols | Discovery vs authentication |
| Auth = authorization | Over-permission | Use scopes and tokens deliberately |
| Insecure OAuth redirects/tokens | Account risk | Follow RFC 9700 / Living Standard |
| Stale verification after transfer | Wrong controller | Re-verify after ownership changes |
| No updates after migration | Broken identity graph | Redirects + refreshed links |
| h-card/`me` as Joshternet join | False membership | Publish `/.well-known/josh` |
| Markup as Josh identity | Wrong signal | Use declaration `josh` boolean only |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }})
- [Schema.org]({{ '/implement/content/schema-org/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Connections]({{ '/implement/content/connections/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Links and relations; next: Connections).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [Microformats2 h-card](https://microformats.org/wiki/h-card) | Person/org vocabulary |
| [Microformats2 parsing](https://microformats.org/wiki/microformats2-parsing) | Parsing rules |
| [Microformats rel=me](https://microformats.org/wiki/rel-me) | rel=me definition |
| [IndieWeb rel=me](https://indieweb.org/rel-me) | Practice and verification |
| [IANA link relations](https://www.iana.org/assignments/link-relations/) | Registered relations |
| [HTML Living Standard](https://html.spec.whatwg.org/) | HTML semantics |
| [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) | Web Linking |
| [Schema.org Person](https://schema.org/Person) | Person type |
| [Schema.org Organization](https://schema.org/Organization) | Organization type |
| [Schema.org author](https://schema.org/author) | Authorship property |
| [RFC 7033](https://www.rfc-editor.org/rfc/rfc7033) | WebFinger |
| [IndieAuth Living Standard](https://indieauth.spec.indieweb.org/) | Current IndieAuth |
| [IndieAuth W3C Note](https://www.w3.org/TR/indieauth/) | 2018 WG Note (not a Recommendation) |
| [IndieAuth test suite](https://indieauth.rocks/) | Implementation tests |
| [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) | OAuth 2.0 |
| [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636) | PKCE |
| [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700) | OAuth security BCP |
| [Webmention](https://www.w3.org/TR/webmention/) | Link notifications |
| [AT Protocol identity](https://atproto.com/specs/did) | DID / handle identity |
| [Joshternet identity RFC](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md) | Josh declaration semantics |
| [Joshternet participation RFC](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) | `/.well-known/josh` |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
