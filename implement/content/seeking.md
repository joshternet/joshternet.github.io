---
layout: default
title: "Seeking pages"
description: >-
  Optional /seeking pages that list what someone is looking for. Joshternet can
  surface explicitly marked wanted requests while keeping details and replies on
  the original websites.
keywords: >-
  /seeking, h-listing, wanted, Seeking, Joshternet, collaborators, help,
  independent websites
permalink: /implement/content/seeking/
nav_title: Seeking
content_id: seeking
matrix_id: seeking
seo:
  type: TechArticle
  name: Seeking pages
---

# Seeking pages

A Seeking page gives people a place to say what they’re looking for and how
someone else might help. That might be a collaborator, feedback on a project, or
a hard-to-find part. Joshternet can bring those requests together while keeping
the details and conversations on the websites where they belong.

## The convention

Joshternet supports Joshua Morris’s `/seeking` convention. The
[original guide](https://joshuamorris.info/seeking/docs/) explains the page
structure and markup; this chapter covers what Joshternet looks for and how it
displays requests. Publishing a Seeking page is optional and does not change how
your website participates in the network.

The underlying h-listing draft remains unfinished elsewhere on the web. Required
page-level dates and optional request-level dates stay distinct here too—Joshternet
does not treat every observed field as a finalized standard.

## What Joshternet looks for

Publish your requests at `/seeking` or `/seeking/`, using ordinary language and a
visible last-updated date. Mark each request as an `h-listing` with the action
`wanted`, and put the request itself in `e-description`. Give visitors a public
way to respond, either for the whole page or for an individual request.

Categories and additional details can help describe a request, but they are
optional. Joshternet does not turn passing comments in articles into requests for
help. Individual request cards come from explicitly marked requests, with links
back to the page that published them.

See the
[minimal example](https://joshuamorris.info/seeking/docs/#minimal-example)
in the original guide rather than maintaining a second copy here.

| Published information | Joshternet’s use |
| --- | --- |
| `h-listing` and `p-action="wanted"` | Identify an explicit wanted request. |
| `e-description` | Supply the human-readable request statement. |
| Optional `p-category` | Provide publisher-supplied browsing labels. |
| Optional nested `p-item` | Describe the thing sought without replacing the request statement. |
| Page-level update date | Show when the publisher says the page changed. |
| Contact information | Remain available through the original website rather than becoming a Joshternet contact directory. |

A listing’s `u-url` may be a mailto or other contact destination. Joshternet does
not treat that URL as the request’s source permalink. Source links point at the
Seeking page (and a real fragment when the listing element has an `id`).

## Helping people find the page

An ordinary link from your website can help people and crawlers find your Seeking
page. An existing slash-page index can point to it too. You do not need to add
fields to `/.well-known/josh`, and finding the page does not guarantee that every
request will appear in the explorer.

Joshternet looks for the known Seeking paths and links that identify those pages.
It does not treat unrelated `/contact`, `/about`, or blog pages as Seeking sources
merely because they contain words such as “wanted” or “looking.”

## Keeping requests current

Keep a request on your page while you are still seeking it, and remove it when
you are not. Update the page’s visible date when its contents change. Joshternet
refreshes its view as it revisits the source, so changes may not appear
immediately.

Joshternet keeps the source page’s updated time and the time of its own
successful read as crawl metadata. The Seeking explorer does not show those
dates. A failed visit does not mean that a request has been answered or
withdrawn.

After a successful complete check confirms a request is gone, Joshternet removes
it from the current explorer. If markup is unreadable or a crawl is incomplete,
Joshternet records uncertainty rather than claiming the request was fulfilled.
Requests can also leave the current display after 30 days without a successful
complete check of their source. That freshness limit is Joshternet’s display
policy, not a change to the Seeking convention.

## Responding and privacy

Responses happen through the original website, using the contact method its
publisher provides. Joshternet does not send messages, introduce people
automatically or collect applications. Share only the details you intend to make
public, and avoid including someone else’s private information.

A Seeking page is optional, and you can prevent its inclusion without withdrawing
your website from Joshternet. The [crawler-access guidance](/implement/content/robots/)
explains how to restrict access with `robots.txt` Disallow rules for cooperative
crawlers, including Joshternet’s crawler. Changes affect Joshternet’s current
display as its systems update; they cannot recall copies already made elsewhere.

## How Joshternet publishes Seeking today

Seeking support is optional content discovery. Request text is extracted from
eligible pages during network sync and kept out of committed content, topics, and
search datasets. The public explorer at `/seeking/` is prepared for current-only
display: request bodies are not staged into Git with the hourly network update.

Locally, `nlp:sync` writes gitignored `_data/seeking.json` with the current
requests so you can verify `/seeking/` after a crawl. Uses public views also
default on outside CI for the same reason. Production Pages builds from the
committed tree still show an empty Seeking explorer until a separately reviewed
publication path can deploy excerpts without committing them. That reduces
unnecessary archiving; it does not guarantee that public requests can be erased
from visitors’ copies, deployment artifacts, or external archives once they have
been shown.

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
