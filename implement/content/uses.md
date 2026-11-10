---
layout: default
title: "Uses Pages: Share the Tools Behind Your Work"
description: >-
  Publish a /uses page for the hardware, software, and services behind your
  work—with clear usage status, semantic HTML, optional Schema.org and
  h-product, and honest disclosures.
keywords: >-
  /uses, uses.tech, slashpages, h-product, Schema.org Product,
  SoftwareApplication, tools, independent web
permalink: /implement/content/uses/
nav_title: Uses
content_id: uses
matrix_id: uses
seo:
  type: TechArticle
  name: Uses
---

# Uses

A `/uses` page offers visitors a look at the tools behind someone’s work. People often learn useful things from seeing how others solve practical problems. A writer may share a preferred notebook and editor, a photographer may explain a camera setup, and a developer may describe a computer, tools, and self-hosted services.

A good Uses page is personal. It can describe what works, what does not, and why the author continues using particular tools. Among independent website owners—especially developers and other makers—`/uses` is a common convention. The page remains entirely optional and can be as simple or detailed as its publisher chooses.

This chapter is a guide to that convention and related open standards. It is not documentation of an equipment database or product analytics system.

## Tool mentions are not all the same

| Relationship | Meaning |
| --- | --- |
| Currently using | Part of the author’s active setup |
| Previously used | No longer part of the active setup |
| Testing | Trying it; not yet a settled choice |
| Recommending | Suggesting it to others (optional) |
| Reviewing | Evaluating it in a review |
| Created | Something the author built |
| Owned but unused | In possession without regular use |
| Wishlist | Something the author would like to acquire |

Treat these as distinct. A product name on a page is not automatically a claim of ownership, endorsement, or current use.

<ol class="content-discovery-flow" aria-label="Publish and maintain a Uses page">
  <li>
    <strong>Publish</strong>
    <span>You create a readable /uses page with tools that matter to you.</span>
  </li>
  <li>
    <strong>Organize</strong>
    <span>You group entries by category or activity so people can explore.</span>
  </li>
  <li>
    <strong>Label</strong>
    <span>You mark current, previous, and experimental tools clearly.</span>
  </li>
  <li>
    <strong>Structure</strong>
    <span>You optionally add Schema.org or h-product for product identity.</span>
  </li>
  <li>
    <strong>Update</strong>
    <span>You keep descriptions and last-updated dates honest as setups change.</span>
  </li>
</ol>

## Where the `/uses` convention came from

Independent publishers have long shared personal setups, tool collections, and working environments. That habit sits inside the broader [slash-page](https://slashpages.net/) movement of memorable paths such as `/now` and `/uses`. The [uses.tech](https://uses.tech/) directory curates links to independently published Uses pages, especially those describing developer tools and setups. The convention has expanded into photography, art, writing, music, woodworking, and other interests.

`/uses` is a **community convention**, not a formal HTML, IETF, or W3C specification. A widely recognized path does not by itself define standardized machine-readable semantics for “this person uses this product.”

## What belongs on a Uses page?

| Category | Examples |
| --- | --- |
| Computers | Laptops, desktops, tablets, and servers |
| Peripherals | Keyboards, mice, monitors, and docks |
| Software | Editors, browsers, operating systems, and applications |
| Development tools | Languages, frameworks, debuggers, and terminals |
| Hosting and services | Hosting platforms, development services, and productivity tools |
| Creative equipment | Cameras, microphones, instruments, and drawing tablets |
| Workshop tools | Hand tools, machinery, and fabrication equipment |
| Writing tools | Pens, notebooks, word processors, and reference software |
| Everyday equipment | Bags, headphones, bicycles, and other practical items |

Pick categories that match your activities. A musician does not need a programming inventory, and a writer does not need full computer specifications. Reflect what you actually use rather than filling a universal template.

## Tell people why you use it

A list of product names becomes more interesting with personal context. For important tools, a short note can cover what it is, what you use it for, why you chose it, what works well, what could be better, how it fits your workflow, and whether you would choose it again.

**Minimal:** “Example Editor.”

**More useful:** “I use Example Editor for writing and maintaining my website. Its simple interface keeps me focused, although I still use a separate tool for image editing.”

These are personal observations, not formal product reviews. Skip formulaic blurbs for every entry when a name and link are enough.

## Decide how detailed the page should be

**Simple:** A few categories with names and short descriptions.

**Detailed:** Models, versions, links, and explanations.

**Technical:** Configuration notes, versions, peripherals, and workflow relationships.

**Historical:** Current tools beside selected older ones that show how the setup changed.

None of these formats is inherently better. A small, maintained page beats a large inventory of obsolete claims. Start simple and expand when there is something meaningful to explain.

## Organize your tools so people can explore them

A workable outline:

1. Introduction.
2. Computers and hardware.
3. Software.
4. Development or creative tools.
5. Services and hosting.
6. Specialized equipment.
7. Current experiments.
8. Recent changes.
9. Last-updated date.

Readers should understand the setup without drowning in specifications. Use meaningful headings, short descriptions, and links to deeper notes. Group by activity when that is clearer—for example “In the studio,” “On location,” and “Editing” for a photographer.

## Semantic HTML for a Uses page

Use `<main>`, `<article>`, `<section>`, headings, lists, paragraphs, links, optional `<figure>` / `<figcaption>`, and `<time>` for the last-updated date. The page must work without JavaScript.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Uses — Harbor Notes</title>
    <meta
      name="description"
      content="Hardware, software, and services Avery uses for writing and photography."
    />
    <link rel="canonical" href="https://joshua.example/uses/" />
  </head>
  <body>
    <main>
      <article>
        <h1>Uses</h1>
        <p>
          Tools I rely on for Harbor Notes and everyday photography.
          Status labels are editorial notes, not a product catalog.
        </p>
        <p>
          Last updated:
          <time datetime="2026-11-01">Nov. 1, 2026</time>
        </p>

        <section>
          <h2>Computers</h2>
          <ul>
            <li>
              <p>
                <strong>Example Laptop 14</strong>
                — currently using for writing and site maintenance.
              </p>
            </li>
          </ul>
        </section>

        <section>
          <h2>Software</h2>
          <ul>
            <li>
              <p>
                <a href="https://joshua.example/notes/example-editor/">
                  Example Editor
                </a>
                — drafts and Markdown for this site.
              </p>
            </li>
          </ul>
        </section>

        <p><a href="https://joshua.example/">Back to Harbor Notes</a></p>
      </article>
    </main>
  </body>
</html>
```

## Meaningful links to tools

Link to official product sites, project homepages, open-source repositories, documentation, manufacturer pages, relevant reviews, or your own deeper notes. Choose the destination that helps the reader. Linking every product only to a retailer can make a personal page feel like an advertisement. Expect dead links and discontinued products; preserve useful historical references when you keep older entries.

## Make it clear what you're actually using

Tool mentions can represent different states. Prefer human-readable labels such as “Currently using,” “Testing,” “Previously used,” “Retired,” “Replaced,” or “Interested in trying.” These are **editorial labels**, not a standardized Microformats2 or Schema.org usage-status vocabulary.

Do not describe old equipment as part of the current setup merely because it remains on the page. An inactive service, a decommissioned device, and a tool you still use occasionally are different. Add clear dates when describing historical changes.

## Hardware and equipment details

Useful details include manufacturer, brand, product name, model, generation, relevant configuration, purpose, accessories, optional photographs, acquisition date when helpful, and current usage status. Marketing names can be ambiguous across generations and configurations—be accurate when it matters, without publishing serial numbers or other sensitive identifiers. Distinguish manufacturer specifications from your personal configuration.

## Describe software as more than a product name

Useful software notes may include application name, publisher or maintainer, operating system, version when relevant, primary use, integrations, plugins, hosting model, licensing, configuration notes, and alternatives considered.

Distinguish applications from online services; open-source from proprietary; self-hosted from software-as-a-service. Readers often care more about how you use a tool than about its full feature list. Listing a programming language does not establish proficiency. Do not infer installation, usage frequency, or subscription status from a bare textual mention.

## Show how your tools work together

Readable prose can describe relationships that separate product blurbs miss—drafts in one application, photographs in another, then a static-site generator and a host.

```text
Write
  |
Edit
  |
Generate website
  |
Publish
  |
Monitor
```

That diagram describes the author’s process, not a formal dependency or product-compatibility declaration. Do not invent a machine-readable workflow standard for Uses pages.

## Uses pages versus other slash pages

| Page | Purpose |
| --- | --- |
| `/uses` | Tools and equipment someone uses |
| `/carry` | Items someone regularly carries |
| `/defaults` | Default applications and settings |
| `/colophon` | How a website itself was built |
| `/now` | Current activities and interests |
| `/projects` | Things someone has created |
| `/reviews` | Evaluations of products or other things |

Pages can overlap without being duplicates. A colophon may describe the site’s stack while `/uses` covers broader activities. A projects page describes creations, not every tool used to make them. Publishers may combine categories or use different paths—additional slash pages are optional. See [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}).

## Make tool information understandable to software

Optional structured data can describe products and applications more precisely:

- [Schema.org Product](https://schema.org/Product)
- [ProductModel](https://schema.org/ProductModel)
- [SoftwareApplication](https://schema.org/SoftwareApplication)
- [WebApplication](https://schema.org/WebApplication)
- [MobileApplication](https://schema.org/MobileApplication)
- [ItemList](https://schema.org/ItemList)
- Microformats2 [h-product](https://microformats.org/wiki/h-product)

These vocabularies describe entities such as products or software. They do **not** automatically establish that the website’s author uses or owns them. Distinguish product identity from usage relationships. Structured metadata is optional. Do not invent a standardized Schema.org `uses` property or require structured data for every mention.

## Schema.org Product

Common properties include `name`, `description`, `brand`, `manufacturer`, `model`, `image`, `url`, `category`, `mpn`, `gtin`, `sku` where appropriate, `additionalProperty`, and `isRelatedTo`. Manufacturer identifiers differ from merchant-specific SKUs. Include exact identifiers only when accurate and useful—never invent GTINs or part numbers.

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://joshua.example/uses/#example-camera",
  "name": "Example Camera",
  "description": "A compact camera used for everyday photography.",
  "brand": {
    "@type": "Brand",
    "name": "Example Imaging"
  },
  "url": "https://joshua.example/notes/example-camera/",
  "category": "Camera"
}
```

Match the visible page. Validate with [validator.schema.org](https://validator.schema.org/).

## A product description is not proof that someone uses it

Schema.org Product describes a product, not a personal relationship between the author and that product. A Uses page can say “I use this camera for documentary photography” in plain language while Product metadata supplies product identity. Compatible consumers should not assume ownership, current use, or endorsement merely because a Product object appears. General-purpose vocabularies are limited for personal usage relationships. Application-specific extensions require separate documentation—they are not formal Schema.org standards.

## Schema.org SoftwareApplication

Use `SoftwareApplication`, `WebApplication`, or `MobileApplication` as appropriate. [SoftwareSourceCode](https://schema.org/SoftwareSourceCode) describes source, not an installed application instance. Relevant properties include `name`, `description`, `url`, `applicationCategory`, `operatingSystem`, `softwareVersion`, `softwareRequirements`, `softwareHelp`, `license`, `author`, and `publisher`.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Example Editor",
  "description": "A focused writing and Markdown editor.",
  "url": "https://other.example/example-editor/",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "macOS, Linux, Windows",
  "softwareVersion": "4.2"
}
```

A personal Uses page rarely needs every property. Do not describe an installed application as a project you created unless that relationship is explicit. See [Creative media]({{ '/implement/content/media/' | relative_url }}) when you are publishing software you authored.

## Collections using Schema.org ItemList

`ItemList`, `ListItem`, `itemListElement`, `itemListOrder`, `numberOfItems`, and `position` can organize product or software references. Positions matter for ranked lists; ordinary grouped collections need not invent ranking or recommendation semantics.

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Selected tools on Harbor Notes",
  "numberOfItems": 2,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Product",
        "name": "Example Camera",
        "brand": { "@type": "Brand", "name": "Example Imaging" }
      }
    },
    {
      "@type": "ListItem",
      "position": 2,
      "item": {
        "@type": "SoftwareApplication",
        "name": "Example Editor",
        "applicationCategory": "DeveloperApplication"
      }
    }
  ]
}
```

An ItemList of products is still not proof of possession or regular use.

## Describe products within readable HTML

[h-product](https://microformats.org/wiki/h-product) is a Microformats2 draft vocabulary for product information. Root class: `h-product`. Properties include `p-name`, `p-brand`, `p-category`, `u-url`, `u-photo`, `e-description`, `p-price`, and `p-review`. The author’s usage statement in surrounding prose is not a separate h-product property that proves usage.

```html
<div class="h-product">
  <h3 class="p-name">Example Camera</h3>
  <p>
    Manufacturer:
    <span class="p-brand">Example Imaging</span>
  </p>
  <div class="e-description">
    <p>A compact camera I use for everyday photography.</p>
  </div>
  <a class="u-url" href="https://joshua.example/products/camera/">
    Product information
  </a>
</div>
```

Parsed (abridged):

```json
{
  "type": ["h-product"],
  "properties": {
    "name": ["Example Camera"],
    "brand": ["Example Imaging"],
    "description": [
      {
        "value": "A compact camera I use for everyday photography.",
        "html": "<p>A compact camera I use for everyday photography.</p>"
      }
    ],
    "url": ["https://joshua.example/products/camera/"]
  }
}
```

## Using something isn't the same as reviewing it

Distinguish a simple listing, a short personal observation, a recommendation, a comparison, a structured product review, and a commercial listing. [Schema.org Review](https://schema.org/Review) and Microformats2 [h-review](https://microformats.org/wiki/h-review) (draft; often related to h-entry patterns) are for genuine evaluations of identifiable items—author, item reviewed, date, evaluation, positives, negatives, and a rating only when a real rating exists. A Uses page does not need fabricated scores or testimonials.

## Product structured data and search engines

Schema.org validity is not the same as search-engine rich-result eligibility. [Google’s product structured data](https://developers.google.com/search/docs/appearance/structured-data/product) distinguishes product snippets, editorial product reviews, and [merchant listings](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing). Merchant features target eligible pages where products can be purchased. A personal Uses page with product links is not automatically an online store. Do not invent Offer, AggregateRating, or Review data to chase rich results. Structured metadata does not guarantee ranking, indexing, or a rich result.

## Be transparent about how you recommend tools

Some publishers link to manufacturers, some to retailers, and some may earn commissions through affiliate programs. Ordinary editorial links, affiliate links, sponsored products, gifted equipment, referral programs, paid reviews, and manufacturer relationships deserve clear, prominent disclosures when there is a material connection readers should know about. U.S. publishers should review [FTC endorsement guidance](https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews); obligations depend on jurisdiction and circumstances. Where appropriate, [qualify outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) with `rel="sponsored"`—that attribute does not replace a human-readable disclosure. Focus on trust, not monetization.

## Open Graph and page previews

Informative link previews can use `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, and `og:image:alt`. Prefer an image of the workspace or activities when available and appropriate. Represent the page as a general website page—there is no standardized Open Graph `uses` object type. Full reference: [Open Graph]({{ '/implement/content/open-graph/' | relative_url }}).

```html
<meta property="og:title" content="Uses — Harbor Notes" />
<meta
  property="og:description"
  content="Hardware, software, and services Avery uses for writing and photography."
/>
<meta property="og:type" content="website" />
<meta property="og:url" content="https://joshua.example/uses/" />
<meta
  property="og:image"
  content="https://joshua.example/images/workspace.jpg"
/>
<meta property="og:image:alt" content="Desk with laptop and notebook" />
```

## Help people find your Uses page

Advertise the page through main navigation, the About page, a `/slashes/` index, internal links, an XML sitemap, and an optional `/.well-known/slashpages` OPML manifest:

```xml
<outline
  type="link"
  text="The tools I use"
  category="/uses"
  url="https://joshua.example/uses/"
/>
```

The conventional category and the actual resource URL are separate. You can use a custom URL while categorizing the page as `/uses`. Ordinary hyperlinks and clear titles still matter. See [Slash pages]({{ '/implement/content/slashpages/' | relative_url }}) and [OPML]({{ '/implement/content/opml/' | relative_url }}).

## The uses.tech directory

[uses.tech](https://uses.tech/) is an independent directory of Uses pages. External directories have their own submission and moderation rules—verify current policies before submitting. Creating a `/uses` page does **not** automatically list the site. Exploring other publishers’ tools and workflows remains valuable regardless of any directory.

## Keep it useful as your setup changes

A Uses page is often a living document: new tools, retired devices, replaced applications, upgrades, changed workflows, discontinued services, updated recommendations, and historical notes. Publish a meaningful last-updated date. Do not treat a website build timestamp as a change to Uses content. A short changelog can document significant shifts. Historical entries stay useful when clearly labeled.

## The difference between an inventory and a history

A current page describes the present setup. A historical record may note when a tool was adopted, changed, or stopped. A current page alone cannot prove exact adoption or discontinuation dates. Publication time, last-update time, declared start of use, declared end of use, and a crawler’s observation time are not interchangeable. Do not infer a historical change merely because a product was missing from one snapshot.

## Know which tool you're talking about

Product names alone can be ambiguous across brands, models, generations, software versions, operating systems, variants, open-source forks, renames, and discontinued lines. Prefer stable manufacturer or project URLs and accurate descriptions. Merchant URLs with tracking parameters or rotating listings make poor identifiers. Do not guess a model from a photograph or vague description. Do not conflate a software suite with its individual applications.

**Worked example:** “Example Notebook” might mean a paper sketchbook from Example Press or a laptop model from Example Computers. State brand, model, and purpose—“Example Press Notebook A5 for field notes” versus “Example Computers Notebook 14 for travel writing”—instead of inventing identifiers.

## Uses pages and future tool discovery

Accurately identified tools could someday help people find authors who discuss a tool, discover alternatives, explore workflows, find tutorials from practitioners, or find makers who use particular equipment. Those are possible applications of publisher-supplied information—not inherent capabilities of the `/uses` convention. A crawler finding a product name does not establish ownership, expertise, current use, endorsement, or adoption dates. Distinguish direct declarations from text extraction, inferred relationships, and verified metadata. Joshternet’s public [Uses explorer]({{ '/uses/' | relative_url }}) reports **anonymous** slot comparisons (coverage counts and per-choice shares) from published `/uses` pages—not a roster of member setups, and not a complete equipment knowledge graph or product ranking.

## Complete Uses page example

Harbor Notes publishes:

- `/` — home
- `/about/` — who Avery is
- `/uses/` — tools (this chapter’s focus)
- `/colophon/` — how the site is built
- `/projects/` — things Avery created

The Uses page differs from the colophon (site stack) and projects (creations). A condensed Uses page:

```html
<main>
  <article>
    <h1>Uses</h1>
    <p>
      Last updated:
      <time datetime="2026-11-01">Nov. 1, 2026</time>
    </p>

    <section>
      <h2>Hardware</h2>
      <ul>
        <li>
          <strong>Example Laptop 14</strong>
          <span> — currently using for writing and publishing.</span>
        </li>
        <li class="h-product">
          <strong class="p-name">Example Camera</strong>
          <span class="p-brand">Example Imaging</span>
          <span> — currently using for documentary photography.</span>
          <a class="u-url" href="https://joshua.example/notes/example-camera/"
            >Notes</a
          >
        </li>
        <li>
          <strong>Example Tablet</strong>
          <span> — previously used; replaced by the laptop for travel.</span>
        </li>
      </ul>
    </section>

    <section>
      <h2>Software</h2>
      <ul>
        <li>
          <a href="https://other.example/example-editor/">Example Editor</a>
          <span> — drafts and Markdown.</span>
        </li>
        <li>
          <strong>Example Paint</strong>
          <span> — testing for image edits; not yet a settled choice.</span>
        </li>
  </ul>
    </section>
  </article>
</main>
```

Add canonical and Open Graph metadata in `<head>`, and optional Product / SoftwareApplication JSON-LD when helpful. Static hosting is enough.

## Static-site and CMS implementation

Handwritten HTML, Jekyll, Hugo, Eleventy, WordPress, and custom systems can maintain a small Uses page in HTML or Markdown. For larger collections, structured YAML or JSON can drive categories while keeping descriptions as editable prose:

```yaml
tools:
  - name: Example Editor
    category: software
    status: current
    url: https://other.example/example-editor/
    notes: Drafts and Markdown for Harbor Notes.
```

Preserve semantic headings, readable links, and stable URLs. Keep rendering deterministic—avoid unnecessary timestamp churn.

## Accessibility and usability

Use meaningful headings, descriptive links, accessible images with alternative text, readable tables when needed, responsive layouts, keyboard navigation, sufficient contrast, and clear status labels. Prefer simple lists over dense product cards or logo-only rows. Product logos must not be the only way to identify tools.

```html
<li>
  <a href="https://other.example/example-editor/">Example Editor</a>
  — currently using for drafts and Markdown on this site.
</li>
```

## Share the setup, not your secrets

Uses pages can reveal more about technical environments and routines than intended. Avoid publishing internal hostnames, private IP addresses, network topology, exact server configurations, serial numbers, asset tags, device identifiers, private licenses, API credentials, authentication providers, account names, physical locations, security monitoring details, sensitive workplace information, or unpublished projects. Broad product models are often fine; operational maps of private networks are not. A public Uses page must not expose secrets, tokens, or privileged URLs. Not every publicly named technology is a vulnerability—share what helps readers without unnecessary infrastructure detail.

## Trust, accuracy and publisher intent

Distinguish self-reported experience, manufacturer specifications, independent reviews, inferred product identity, observed page content, and historical records. Publishers may describe preferences without proving every claim; consumers should retain uncertainty about unverified statements. Do not turn “I use this” into a verified endorsement or commercial partnership. Opinions and setups change.

## Uses pages and the Joshternet

Uses pages help people learn about participants’ interests, environments, and practical experience. The page remains publisher-controlled content. Product mentions are not automatically verified identities, usage events, or recommendations.

Joshternet’s slash-page catalog recognizes `/uses/` as an identity “tools used daily” convention and may crawl it among identity seeds. Outbound links and host-elsewhere enrichment may apply when allowed; the page role resembles other identity pages for profile-level NLP. The hub does **not** use `/uses/` for Network about blurbs and does **not** harvest it as Showcase creative work. Separately, the public [Uses explorer]({{ '/uses/' | relative_url }}) rebuilds from each crawl into anonymous aggregates: how many eligible network sites have a verified Uses page, and how many of those pages report each comparable choice. Comparable slots render as mosaic cards with coverage charts and choice lists (shares are sites reporting each choice, not exclusive market share). Choices are compared inside a slot, such as editors, keyboards, or Computers (including recognized MacBook Air / Pro family lines), and only when the page’s own words or link support that slot. A URL that only repeats the homepage is not a Uses page. An assessed page with no accepted tools still counts in coverage. Links to other pages on the same site, such as `/now`, `/cv`, or `/links`, are not tools. The item name comes from the heading; the sentence after it is context, not a second tool or a clipped name. Equivalent names share one count. A profile credit is not a tool. Unsorted names, setup details, and stated-use tallies stay on the local development `/uses/` preview only; production shows anonymous coverage and comparable slots. Month, quarter, year, and all-time snapshots replay each origin’s tools as of that period’s UTC end, and completed months are closed so later crawls do not rewrite what sites reported then. The interactive history view needs published `/assets/data/uses/` JSON (`JOSHTERNET_USES_PUBLISH=1` after quality gates in production) and waits until two consecutive months are comparable under the same extractor, aggregation, and catalog hashes—so a coverage or catalog rewrite is not described as people switching tools. Durable evidence stays in private Uses history for rebuilds; local non-Joshternet crawl cache never enters the production ledger. Details: [Reference]({{ '/implement/content/reference/' | relative_url }}).

## How Joshternet observes `/uses` pages

Eligible origins come from the verified JoshBot registry. Josh and non-Josh participants count equally. Evidence is an explicit `/uses` page (or a publisher-declared same-origin equivalent via OPML `category="/uses"` or navigation labels such as “Uses” / “My setup”), not a brand mention on `/now`, `/about`, or a blog post. Generated Joshternet pages marked `joshternet-analysis=derived` never become crawler evidence for this explorer.

## How counts work

| Measure | Meaning |
| --- | --- |
| Active members | Distinct eligible origins with a verified **current** declaration at period end |
| Adoption score | `round(100 * active / sites that named a choice in that slot)`, or null if that slot has no ranked choices |
| Period-ever | Distinct origins that declared the tool at least once inside the period |

A product counts **once per site** inside its slot. A site that names two editors counts once in the editor denominator and once for each editor. A site that names no editor is outside that denominator. A slot is listed when at least one site has named a choice in it, including when no second site has reported that slot yet. Eligible registry sites are not automatically observed `/uses` publishers. An empty slot says “No comparable reports.” Highlighting a choice on a card does not change the slot’s denominator.

## Corrections and recovery

Unknown labels stay unresolved for operator review; they are not guessed into popular products and are not listed on the public explorer. Blog chrome (Recent Posts, Categories), section umbrellas (`Tablet:`, bare Browser/OS), article-shaped titles, and IDE extension or framework names are rejected in extract/normalize so they never pad Unsorted. Real products peel from asides and size prefixes into fine-grained slots. Alias and taxonomy changes bump `taxonomy_version` and rebuild projections from original evidence without inventing older observations. Failed crawls do not emit removals. A tool is removed only after two successful complete parses at least 24 hours apart show it gone. Operators can rebuild with `npm run uses:build -- --dry-run` and validate with `npm run uses:validate`. After catalog or classifier changes, run Uses tests then `nlp:sync` / publish so live Actions regenerate summaries—do not hand-edit `_data/uses_summary.json`. Durable history lives under `data/uses/` (gitignored locally; CI force-adds when Uses publish is on—not Actions artifacts).

## Privacy for observed Uses pages

Joshternet only reads public pages JoshBot is allowed to fetch. Publishing a `/uses` page does not require a new protocol. Publishers may omit `/uses`, block the crawler, or remove the page at any time; historical evidence remains qualified, and current aggregates drop ineligible origins.

## Make sure your Uses page is useful and accurate

1. Validate HTML with the [Nu HTML Checker](https://validator.w3.org/nu/).
2. Verify product, documentation, and project links.
3. Validate optional JSON-LD with [validator.schema.org](https://validator.schema.org/).
4. Parse any h-product markup with a conforming Microformats2 parser (for example [pin13.net/mf2](https://pin13.net/mf2/)).
5. Confirm brand, model, and version against authoritative sources when practical.
6. Check that current, previous, and experimental tools are labeled appropriately.
7. Ensure last-updated dates reflect meaningful page changes.
8. Review headings, links, alternative text, and mobile layout.
9. Scan for unintended infrastructure details, personal data, or secrets.
10. Confirm unchanged content does not acquire false modification dates or unstable identifiers across rebuilds.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Uses page as storefront | Misleading commerce signals | Keep editorial; no fake Offers |
| Names without purpose | Shallow inventory | Add short context |
| Ownership confused with usage | False claims | Label relationships |
| Usage confused with endorsement | Inflated trust | Separate recommend language |
| Mentions as formal reviews | Fake evaluation | Use Review only when genuine |
| Invented ratings | Dishonest scores | Omit ratings |
| Commercial Offers when not selling | Rich-result gaming | No Offer unless selling |
| Ambiguous product names | Wrong tool identity | Brand, model, purpose |
| Suite vs application conflation | Confused software | Name the specific app |
| Outdated gear as current | Stale setup | Status labels + dates |
| Wishlist as currently using | False inventory | Label wishlist separately |
| Deleting useful history | Lost context | Keep labeled archives |
| Inaccurate model numbers | Misidentification | Verify before publishing |
| Broken manufacturer links | Dead ends | Check and update URLs |
| Retailer-only links | Ad-like page | Prefer official/docs when apt |
| Missing affiliate disclosure | Trust / legal risk | Disclose material connections |
| `rel=sponsored` alone | Incomplete disclosure | Pair with visible disclosure |
| Misused Schema.org Product | Wrong entity type | Use Product only for products |
| Unsupported usage properties | Fake standards | Prose for personal usage |
| h-product as ownership proof | Over-interpretation | Product identity ≠ ownership |
| `/uses` = `/colophon` | Mixed purposes | Separate site stack vs tools |
| `/uses` = `/projects` | Creations vs tools | Projects for what you made |
| Private infrastructure details | Security / privacy risk | Share models, not ops maps |
| Serials or credentials | Credential leak | Never publish secrets |
| Logo-only entries | Inaccessible | Text names and links |
| Build stamp as last-updated | False freshness | Update date with real edits |
| Path guarantees uses.tech | False inclusion | Submit per directory rules |
| Mentions invent hub rankings | Spec confusion | Explorer counts only explicit `/uses` declarations |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})
- [OPML]({{ '/implement/content/opml/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Open Graph]({{ '/implement/content/open-graph/' | relative_url }})
- [Schema.org]({{ '/implement/content/schema-org/' | relative_url }})
- [SEO fundamentals]({{ '/implement/content/seo/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Identity and authorship]({{ '/implement/content/identity/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Events; next: Explore).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [Slash pages](https://slashpages.net/) | Community convention |
| [uses.tech](https://uses.tech/) | Uses directory |
| [IndieWeb Wiki](https://indieweb.org/) | IndieWeb practices |
| [HTML Living Standard](https://html.spec.whatwg.org/) | HTML |
| [Schema.org Product](https://schema.org/Product) | Product vocabulary |
| [ProductModel](https://schema.org/ProductModel) | Product models |
| [SoftwareApplication](https://schema.org/SoftwareApplication) | Applications |
| [WebApplication](https://schema.org/WebApplication) | Web apps |
| [MobileApplication](https://schema.org/MobileApplication) | Mobile apps |
| [SoftwareSourceCode](https://schema.org/SoftwareSourceCode) | Source code |
| [ItemList](https://schema.org/ItemList) | Collections |
| [Review](https://schema.org/Review) | Reviews |
| [h-product](https://microformats.org/wiki/h-product) | Microformats2 products |
| [h-review](https://microformats.org/wiki/h-review) | Microformats2 reviews |
| [Microformats2 parsing](https://microformats.org/wiki/microformats2-parsing) | Parsing |
| [Open Graph Protocol](https://ogp.me/) | Link previews |
| [Google product structured data](https://developers.google.com/search/docs/appearance/structured-data/product) | Vendor guidance |
| [Product snippets](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) | Vendor guidance |
| [Merchant listings](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) | Vendor guidance |
| [Outbound link qualifications](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) | Vendor guidance |
| [FTC endorsement guides](https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews) | U.S. guidance |
| [Nu HTML Checker](https://validator.w3.org/nu/) | HTML validation |
| [Schema.org Markup Validator](https://validator.schema.org/) | Structured data |
| [Microformats2 parser](https://pin13.net/mf2/) | mf2 validation |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
