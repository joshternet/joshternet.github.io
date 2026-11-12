---
layout: default
title: "Robots.txt: Decide How Automated Systems Access Your Website"
description: >-
  Publish robots.txt and related directives so cooperative crawlers know which
  paths to request—covering RFC 9309 matching, indexing meta tags, X-Robots-Tag,
  and clearly labeled AI usage preference drafts and vendor signals.
keywords: >-
  robots.txt, RFC 9309, Allow, Disallow, X-Robots-Tag, noindex, Content-Usage,
  Content-Signal, AI preferences, independent web
permalink: /implement/content/robots/
nav_title: Robots
content_id: robots
matrix_id: robots
seo:
  type: TechArticle
  name: Robots.txt
---

# Robots.txt

Websites are visited by more than human readers. Search engines, feed readers, archives, independent discovery services, monitors, and AI-related systems may retrieve publicly accessible resources. Those systems have different purposes: some discover links and index pages, some check for updates, and others retrieve material for automated processing.

`robots.txt` is a long-established way for website operators to publish rules for **cooperative** crawlers. The file communicates expectations about which resources a crawler should request. It is not authentication, authorization, or a substitute for security controls.

Three concepts must stay separate:

1. **Crawling** — whether a crawler should request a resource (`robots.txt` Allow/Disallow).
2. **Indexing and presentation** — whether and how a search engine should represent a resource in results (HTML robots meta tags, HTTP `X-Robots-Tag`).
3. **Content usage** — what the publisher prefers about downstream uses such as AI training or AI-assisted answers (emerging drafts and vendor conventions).

These mechanisms are not interchangeable. Blocking a fetch is not the same as asking not to index a page, and neither is a copyright license.

<ol class="content-discovery-flow" aria-label="Crawl, index, and usage are separate decisions">
  <li>
    <strong>Crawl</strong>
    <span>robots.txt says which paths cooperative crawlers should request.</span>
  </li>
  <li>
    <strong>Index</strong>
    <span>Meta tags and X-Robots-Tag guide how engines may present retrieved pages.</span>
  </li>
  <li>
    <strong>Usage</strong>
    <span>Draft and vendor signals express preferences about AI and related processing.</span>
  </li>
</ol>

## How websites learned to communicate with crawlers

The Robots Exclusion Protocol emerged in 1994 as a simple text file that early web crawlers agreed to consult. A root-level `robots.txt` became a widely recognized coordination point because it was easy to publish and parse.

In September 2022, [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) formalized the protocol: location, encoding, user-agent groups, Allow/Disallow matching, redirects, HTTP status handling, caching, and processing limits. Original conventions, the standardized protocol, and crawler-specific extensions remain distinct. Growth in automated content processing has renewed interest in preferences **beyond** ordinary crawl access—those ideas are drafts or vendor systems unless an RFC says otherwise.

## The Robots Exclusion Protocol

RFC 9309 uses normative language carefully. **MUST** means a requirement for compliant implementations. **SHOULD** is a strong recommendation. **MAY** is optional. Do not treat every SHOULD as a universal law of every commercial crawler.

Key requirements and recommendations:

| Topic | Summary |
| --- | --- |
| Location | Served at `/robots.txt` on the origin (scheme + authority) |
| Encoding | UTF-8 |
| Media type | `text/plain` |
| Groups | One or more `User-agent` lines plus `Allow` / `Disallow` rules |
| Matching | Path prefix rules with longest-match precedence; `*` and `$` in paths |
| Redirects | Follow redirects; rules apply in the context of the initially requested authority |
| Status | Successful, unavailable (e.g. many 4xx), and unreachable (e.g. many 5xx) have different consequences |
| Cache | HTTP caching applies; policies are not instantly global |
| Size | Parsers must process at least the first 500 KiB |

See RFC 9309 for authoritative wording on each point.

## Create your first robots.txt file

### 1. Choose the resource location

Publish at the origin root:

```text
https://joshua.example/robots.txt
```

The filename is lowercase. A file at `/blog/robots.txt` does **not** govern the entire website.

### 2. Create the text file

```text
User-agent: *
Allow: /

Sitemap: https://joshua.example/sitemap.xml
```

`User-agent: *` selects the default group for crawlers without a more specific match. `Allow: /` permits the whole path space for that group. `Sitemap:` advertises an XML sitemap location (widely recognized; not an Allow/Disallow rule).

### 3. Publish

Deploy with ordinary static hosting, or generate the file in a build (Jekyll, Hugo, Eleventy, WordPress, custom servers). Confirm the **live** URL, not only the file in the repository.

### 4. Check the response

```bash
curl -i https://joshua.example/robots.txt
```

Expect HTTP 200, plain text, UTF-8, and the intended body.

### 5. Test the policy

For a given crawler product token and URL path, determine which group applies and which Allow/Disallow rule wins. Test before changing production policies that block large path trees.

## Different crawlers, different rules

Clients send an HTTP `User-Agent` header. In `robots.txt`, `User-agent` lines name **product tokens** (often the first token of that header). Matching is case-insensitive for the product token.

Wildcard group:

```text
User-agent: *
Disallow: /private/
```

Named group:

```text
User-agent: ExampleBot
Disallow: /experiments/
```

A named group is **not** simply stacked on top of every `*` rule. The protocol selects which group(s) apply. Typically a more specific named match is used instead of falling back to `*`. HTTP user-agent strings can be spoofed; they are not authentication. Some operators publish verification mechanisms (IP ranges, reverse DNS, signed tokens)—those are separate from claiming a product token in a header. JoshBot signs requests with Web Bot Auth; see [JoshBot]({{ '/joshbot/' | relative_url }}).

## Allow and Disallow

`Disallow` identifies a path prefix a cooperative crawler must not request:

```text
User-agent: *
Disallow: /drafts/
```

`Allow` can carve an exception from a broader restriction:

```text
User-agent: *
Disallow: /projects/private/
Allow: /projects/private/public-demo/
```

Empty versus root:

```text
Disallow:
```

does not establish a path restriction (no pattern).

```text
Disallow: /
```

matches the entire path space. Accidentally omitting or adding the slash changes the meaning completely.

## How a crawler decides which rule wins

Matching starts from the beginning of the URI path. Among applicable rules, the **longest** matching pattern wins (octet/byte length). Path comparisons are case-sensitive. When Allow and Disallow match with equal length, Allow wins under RFC 9309. Percent-encoding and reserved characters matter; encode patterns carefully when matching literal special characters. Query strings are part of URI handling—follow the RFC rather than inventing search-engine folklore.

`/admin` and `/admin/` can match different URL sets: the trailing slash narrows or expands which paths share the prefix.

| Path tested | Rules | Decision |
| --- | --- | --- |
| `/notes/lab/` | `Allow: /` | Allow |
| `/drafts/essay/` | `Disallow: /drafts/` | Disallow |
| `/projects/private/public-demo/` | `Disallow: /projects/private/` + `Allow: /projects/private/public-demo/` | Allow (longer) |
| `/admin` | `Disallow: /admin` | Disallow |
| `/administration` | `Disallow: /admin` | Disallow (prefix) |
| `/administration` | `Disallow: /admin/` | Allow (no match) |

## Wildcards and end-of-path matching

RFC 9309 defines special characters **inside path patterns**:

- `*` — matches any sequence of characters
- `$` — matches the end of the path

Examples:

```text
User-agent: *
Disallow: /*.pdf$
Allow: /public/*.pdf$
Disallow: /tmp/*
```

A path `*` is not the same as `User-agent: *`. Percent-encode when you need a literal reserved character in a pattern. Always check the RFC; undocumented search-engine quirks are not the protocol.

## Multiple groups and conflicting rules

Consecutive `User-agent` lines before the first Allow/Disallow share one group:

```text
User-agent: ExampleBot
User-agent: OtherBot
Disallow: /lab/
```

RFC 9309 describes how matching groups are selected and how rules combine. Do **not** assume “the first matching group always wins.” Specific named groups typically supersede the wildcard group. Rules that appear outside a group, unknown record names, and legacy parsers may behave differently—prefer clear groups and known field names.

(See the Joshternet note below for how this site’s hub subset differs from full group merging.)

## A policy belongs to a particular origin

`robots.txt` is scoped to one origin: scheme, host, and port. HTTP and HTTPS are different. `www.joshua.example` and `joshua.example` are different. Subdomains each need their own file if you want rules there. Nondefault ports are separate origins. A policy on one host does not automatically govern related domains. Migrations often need redirects **and** correct robots files on each origin that still receives traffic.

## HTTP responses and crawler behavior

### Successful retrieval

A valid 200 response with a parseable body supplies the policy for that origin.

### Redirects

RFC 9309 discusses following redirects (at least five is the documented recommendation). Interpret rules in relation to the authority originally requested—read the RFC section before assuming cross-host redirect semantics.

### Unavailable responses

Many 4xx responses mean the robots resource is unavailable; the RFC’s unavailable rules apply. Do not invent a single meaning for every 4xx.

### Unreachable responses

Server or network failures, including many 5xx responses, are treated as unreachable under the RFC—again, not identical to “file missing.”

### Persistent failures

Unusually long unreachability has additional guidance in the RFC. Commercial crawlers may also apply their own retry policies.

### Parsing failures

Use parseable rules. Do not discard an entire file solely because one line is malformed.

Missing `robots.txt`, 403, 404, and 500 are **not** interchangeable. Distinguish RFC requirements from particular vendor behavior.

## Caching and processing limits

HTTP caching (`Cache-Control`, `ETag`, `Last-Modified`) affects how quickly policy changes propagate. RFC 9309 recommends caching behavior for robots resources. Parsers must process at least the first **500 KiB**; larger files may be truncated by consumers. Stale caches and recovery after failures mean a change is not instantly universal. Keep policies concise.

## Sitemap directives and other extensions

```text
User-agent: *
Allow: /

Sitemap: https://joshua.example/sitemap.xml
```

`Sitemap:` advertises sitemap locations and is widely recognized. It is not part of RFC 9309’s Allow/Disallow access grammar, though many crawlers collect it. Historically deployed records such as `Crawl-delay` and `Host` are **not** standardized in RFC 9309; support varies. Do not claim a crawler implements an extension without current documentation. See [XML Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }}).

## Crawling and indexing are different decisions

Preventing a request is not the same as instructing a search engine not to display a URL.

| Mechanism | Role |
| --- | --- |
| `robots.txt` | Crawl access for cooperative bots |
| HTML robots meta | Indexing/presentation after retrieval |
| `X-Robots-Tag` | Same ideas for non-HTML (and HTML) via HTTP |
| Canonical links | Preferred URL signal |
| HTTP authentication | Real access control |
| Deleting content | Removes the resource itself |

A blocked URL may still appear as a URL-only result if discovered through external links—engines often cannot read `noindex` on a page they are not allowed to fetch. To apply meta robots, the crawler generally must be permitted to retrieve the resource.

## Robots meta tags

Common directives (consumer support varies; verify current engine docs):

- `index` / `noindex`
- `follow` / `nofollow`
- `none` (typically noindex, nofollow)
- `nosnippet`
- `max-snippet`, `max-image-preview`, `max-video-preview`
- `noarchive` (where still supported)
- `notranslate`
- `unavailable_after`

Crawler-specific tags such as `googlebot` exist. Directives may be combined; conflict resolution is consumer-specific.

```html
<meta name="robots" content="noindex">
```

```html
<meta name="robots" content="max-snippet:160">
```

Do not present obsolete or engine-only directives as universally effective. See [Google’s robots meta documentation](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).

## X-Robots-Tag HTTP headers

HTTP response headers can carry the same class of directives for PDFs, images, and other formats:

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
X-Robots-Tag: noindex
```

Configure via the origin server, application middleware, or a CDN. Inspect with:

```bash
curl -I https://joshua.example/files/report.pdf
```

Headers and HTML meta tags are different delivery channels for similar indexing ideas.

## Automated access in the age of AI

Automated systems retrieve content for search indexing, monitoring, archiving, research, retrieval-augmented generation, AI-assisted answers, model training, fine-tuning, and agent-driven browsing. Permission to **retrieve** may differ from preferences about **downstream use**. Standards work is active; consensus is not finished. Publisher preferences and enforceable technical restrictions are not the same thing.

## IETF AI Preferences Working Group

The [IETF AI Preferences (AIPREF) working group](https://datatracker.ietf.org/wg/aipref/about/) aims to standardize machine-readable preferences about automated uses of content. Keep three layers distinct:

1. A **vocabulary** of usage categories and preference values.
2. **Attachment** mechanisms (how preferences bind to HTTP content or robots policies).
3. Existing **robots access** rules (Allow/Disallow).

As of Nov. 3, 2026, both working-group documents remain **Internet-Drafts**, not RFCs:

- [draft-ietf-aipref-vocab-08](https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/) — vocabulary
- [draft-ietf-aipref-attach-05](https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/) — HTTP / robots attachment

Drafts may change, expire, or be replaced before standardization.

## AIPREF vocabulary

Per the current vocabulary draft, categories include:

- `train-ai` — AI training preferences
- `ai-use` — AI use (broader automated AI processing as defined in the draft)
- `search` — search-related processing as defined in the draft

Preference values:

- `y` — preference to allow
- `n` — preference to disallow
- Omitted or unrecognized — preference unknown

Absence of a preference is **not** explicit permission or prohibition.

Draft-labeled example (not a deployment requirement):

```text
train-ai=n, ai-use=y, search=y
```

The draft uses HTTP Structured Fields concepts. Expressing a preference is not the same as enforcing it.

## The proposed Content-Usage mechanism

**Status:** Internet-Draft (`draft-ietf-aipref-attach`) — proposed, subject to change.

HTTP response header (draft syntax):

```http
Content-Usage: train-ai=n
```

The header applies to the representation described by that response.

robots.txt record (draft pattern):

```text
User-agent: *
Allow: /
Content-Usage: train-ai=n
```

Ordinary crawl permission remains separate from content-usage preferences. Path-specific preferences, group selection, retrieval-time binding, and non-retroactive updates are draft topics—read the current attachment document. Do not treat this as identical to Content Signals or the training policy-token proposal.

## AI training policy-token proposal

**Status:** Individual Internet-Draft (not a WG consensus document) — [draft-kelley-aipref-training-preference-signal-00](https://datatracker.ietf.org/doc/draft-kelley-aipref-training-preference-signal/), published Oct. 30, 2026 (Kevin Kelley / Anthropic).

This proposal uses an ordinary robots user-agent group keyed by a special policy token. Allow/Disallow are interpreted as preferences about **AI training**, not ordinary crawler access:

```text
User-agent: __usage_ai-training
Disallow: /
Allow: /press-kit/
```

It introduces no new directive names; it reuses path matching. That differs from the working-group `Content-Usage` approach. Do not combine these syntaxes into one invented standard.

## Content Signals

**Status:** Vendor/community mechanism — [contentsignals.org](https://contentsignals.org/), with documented Cloudflare support via managed robots / Bot Preference Sync. Not an IETF RFC and not the same as `Content-Usage`.

Categories:

- `search` — building a search index and ordinary search results (not AI-generated summaries, per their definition)
- `ai-input` — inputting content into AI models (e.g. RAG / grounding)
- `ai-train` — training or fine-tuning AI models

Values are typically `yes` or `no`. Omission neither grants nor restricts that category via Content Signals.

```text
User-agent: *
Allow: /
Content-Signal: search=yes, ai-input=no, ai-train=no
```

This expresses a preference. It is not a universal crawler instruction. Cloudflare products may inject or manage these lines; that does not mean every crawler on the web honors them.

## Compare the AI preference approaches

| Mechanism | Purpose | Status |
| --- | --- | --- |
| RFC 9309 | Crawler access | Published RFC |
| IETF AIPREF vocabulary | AI use categories | Active Internet-Draft (vocab-08) |
| IETF Content-Usage | Attach preferences to HTTP and robots | Active Internet-Draft (attach-05) |
| AI training policy token | Training preference via special UA groups | Individual Internet-Draft (00) |
| Content Signals | Automated content-use preferences | Vendor/community implementation |
| Search engine robots meta | Indexing and presentation | Consumer-specific directives |

Syntax, scope, semantics, and support differ. They are not all “robots standards.” Some publishers publish more than one mechanism during transitions; avoid contradictory declarations.

## AI crawler user agents

Operators may run separate crawlers for search, training, and user-initiated browsing. Product tokens change—verify against current official documentation before writing named groups. A claimed `User-Agent` string does not prove identity; use provider verification when you need assurance. Independent indexers (including Joshternet’s JoshBot) publish their own tokens.

Examples change often; treat any short list as illustrative, not exhaustive. Check each operator’s current crawler docs before relying on a token.

## Other ways websites communicate with automated agents

Independent proposals include `llms.txt`, `agents.txt`, `AGENTS.md`, and various well-known capability manifests. Purposes and maturity differ. Instructions for coding agents are not a website-wide crawl policy. Guidance for interpreting content is not authorization to fetch or train. None of these replace RFC 9309.

## What these instructions do and do not authorize

| Concept | Role |
| --- | --- |
| Crawling permission | Cooperative fetch expectations |
| Indexing preferences | Search presentation hints |
| AI usage preferences | Downstream-use preferences (draft/vendor) |
| Copyright | Legal ownership of works |
| Licenses (e.g. Creative Commons) | Explicit reuse grants |
| Contracts | Private agreements |
| Technical authorization | Server-enforced access |

A robots directive is not a copyright license. Absence of a restriction does not waive copyright or other obligations. [Creative Commons](https://creativecommons.org/licenses/) and similar licenses are separate. Legal enforceability varies by jurisdiction; this handbook does not give legal advice.

## Robots policies and website security

Do not use `robots.txt` to protect private resources. Authentication, authorization, and server-side controls protect admin interfaces, drafts, personal documents, sensitive APIs, and credential-bearing URLs. Listing a path in `robots.txt` can reveal that the path exists. Noncompliant clients and ordinary browsers may still request it.

A crawl restriction is not an HTTP 401/403/404. Serve appropriate status codes and authentication challenges when a resource must stay private. Obscure URLs and Disallow lines are not security.

## Complete implementation example

### Goals

1. Allow ordinary discovery of public pages.
2. Advertise the XML sitemap.
3. Restrict utility crawl paths.
4. Permit selected public demos under a private tree.
5. Keep designated pages unindexed where supported.
6. Optionally express AI training preferences with a **labeled** proposed mechanism.
7. Keep standardized crawl rules separate from draft preferences.

### RFC 9309-oriented robots.txt

```text
User-agent: *
Allow: /
Disallow: /drafts/
Disallow: /projects/private/
Allow: /projects/private/public-demo/

Sitemap: https://joshua.example/sitemap.xml
```

### Indexing controls (separate from robots.txt)

```html
<meta name="robots" content="noindex">
```

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
X-Robots-Tag: noindex
```

### Draft IETF Content-Usage example (proposed)

```text
User-agent: *
Allow: /
Content-Usage: train-ai=n
```

### Content Signals example (vendor/community)

```text
User-agent: *
Allow: /
Content-Signal: search=yes, ai-input=no, ai-train=no
```

Do not concatenate contradictory policies into one production file without understanding how each consumer reads them.

## Static hosting and CMS implementation

Handwritten sites can ship a single `robots.txt` in the site root. Jekyll, Hugo, and Eleventy can emit static files from `static/` or `public/`. WordPress and custom apps may generate rules from templates. Reverse proxies and CDNs can override the origin file—verify the edge response. Staging environments sometimes use `Disallow: /` for the whole site; never deploy that template to production by mistake. Always `curl` the live URL.

## Validate robots.txt

1. **Accessibility** — `curl -i` the published URL.
2. **Encoding and type** — UTF-8 / plain text as expected.
3. **Syntax** — groups, directive names, paths, comments.
4. **Precedence** — sample paths and user agents.
5. **Redirects and errors** — confirm expected behavior for missing or failing robots resources.
6. **Indexing** — inspect meta and `X-Robots-Tag` separately.
7. **AI preference syntax** — validate against the exact draft or vendor doc version you copied.
8. **Production** — CDN/proxy must not silently replace your file.

Vendor testing tools help one consumer; they do not guarantee every crawler.

## Worked policy scenarios

### Personal blog

Allow articles and feeds; Disallow `/drafts/` and build-only paths. Verify with curl and a path checklist.

### Photography portfolio

Allow galleries and project pages for discovery. Express AI training preference only with a labeled draft or Content Signals block if you choose—do not assume universal enforcement.

### Software project

Allow `/docs/` and release notes; Disallow staging mirrors and internal tooling paths on that origin.

### Multidomain website

Separate `robots.txt` per origin; do not assume one file covers every hostname.

### Public blog with noindex pages

Keep thank-you or thin utility pages crawlable if you need engines to see `noindex`; block only paths that should never be fetched.

### Website migration

Maintain robots and redirects on both old and new origins until traffic settles.

### AI usage preferences

State the same intention three ways only for comparison—RFC crawl rules, draft `Content-Usage`, and Content Signals—without asserting identical support.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Wrong directory or capitalization | File never found | Serve `/robots.txt` at the origin root |
| Wrong type/encoding | Parsers struggle | UTF-8 `text/plain` |
| Wrong product tokens | Named rules never match | Verify current operator tokens |
| Assuming `*` and named always combine | Wrong allow/deny | Follow group selection rules |
| Ignoring multiple matching groups | Incomplete policy read | Read RFC merging; test |
| Bad path matching / trailing slashes | Over- or under-blocking | Test prefixes carefully |
| Misusing `*` / `$` | Unexpected matches | Follow RFC 9309 |
| Percent-encoding errors | Rules miss URLs | Encode reserved literals correctly |
| Empty `Disallow:` vs `Disallow: /` | Accidental open or closed site | Know the difference |
| Disallow-all on production | Site disappears from cooperative crawlers | Gate staging templates |
| Expecting robots to unindex | URL may linger | Use indexing directives + removal tools |
| `noindex` behind Disallow | Engine may never see the tag | Allow fetch when you need meta observed |
| Robots as authentication | Data leaks | Use real access control |
| Listing sensitive paths | Path disclosure | Do not advertise secrets |
| Assuming Crawl-delay is standard | Uneven support | Not in RFC 9309 |
| Assuming all bots honor Content-Signal | False safety | Preference ≠ enforcement |
| Confusing Content-Signal and Content-Usage | Wrong mental model | Keep them separate |
| Calling drafts RFCs | Misleading readers | Label Internet-Draft status |
| Assuming prefs prevent training | False technical guarantee | Preferences are not locks |
| Absence = permission | Legal/policy confusion | Unknown ≠ grant |
| Trusting spoofable UAs | Fake identity | Use verification when needed |
| Expecting instant policy updates | Surprise crawls | Account for caches |
| Contradictory access vs usage lines | Confused consumers | Align declarations |
| Treating `llms.txt` as robots | Wrong tool | Keep REP separate |

## Robots and the Joshternet

A valid Joshternet declaration (`/.well-known/josh`) and crawler-access permission are separate decisions. You can participate while restricting what automated clients may fetch.

JoshBot identifies as:

```text
Joshternet-Joshbot (+https://joshternet.org/joshbot)
```

Product token: `Joshternet-Joshbot`. JoshBot also signs requests with Web Bot Auth so operators can verify crawler identity beyond the user-agent string when their stack supports it. The hub loads each origin’s `/robots.txt`, treats missing or unreadable files as allow, prefers a named group over `*`, and applies **longest prefix** Allow/Disallow (equal length prefers Allow). It uses the **first** matching named group and does **not** implement full RFC path wildcards (`*` / `$`), nor does it interpret `Content-Usage`, `Content-Signal`, or `__usage_ai-training`. Details: [JoshBot]({{ '/joshbot/' | relative_url }}) and [Reference]({{ '/implement/content/reference/' | relative_url }}).

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [XML Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})
- [JoshBot]({{ '/joshbot/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Sitemaps; next: Links and relations).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) | Robots Exclusion Protocol |
| [IETF AIPREF WG](https://datatracker.ietf.org/wg/aipref/about/) | Working group home |
| [draft-ietf-aipref-vocab-08](https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/) | Vocabulary (Internet-Draft) |
| [draft-ietf-aipref-attach-05](https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/) | Content-Usage attachment (Internet-Draft) |
| [draft-kelley-aipref-training-preference-signal-00](https://datatracker.ietf.org/doc/draft-kelley-aipref-training-preference-signal/) | Training policy token (individual I-D, Oct. 30, 2026) |
| [Content Signals](https://contentsignals.org/) | Vendor/community Content-Signal |
| [Cloudflare managed robots / Bot Preference Sync](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) | Cloudflare Content Signals docs |
| [Google robots meta / X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) | Vendor indexing directives |
| [Google robots.txt intro](https://developers.google.com/search/docs/crawling-indexing/robots/intro) | Vendor crawler guidance |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | HTTP semantics |
| [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111) | HTTP caching |
| [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) | URI syntax |
| [Sitemap Protocol](https://www.sitemaps.org/protocol.html) | Sitemap advertising |
| [Creative Commons licenses](https://creativecommons.org/licenses/) | Reuse licensing |

Internet-Drafts may change, expire, or be replaced. Verify status before relying on draft syntax in production.

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
