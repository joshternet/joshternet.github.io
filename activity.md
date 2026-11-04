---
layout: default
title: What's New
description: >-
  See what people across the Joshternet have been writing, building, and
  sharing. Discover recent posts and creative work from independent websites,
  then follow the links to their original publishers.
keywords: >-
  What's New, Joshternet, recent articles, showcase, independent websites, Josh network
seo:
  type: CollectionPage
  name: What's New
robots: max-snippet:160, max-image-preview:large
permalink: /activity/
joshternet_analysis: derived
---

{% assign primary = site.data.activity.primary | default: empty %}

# What's New

There's always something interesting happening in somebody's corner of the internet. People are writing, building things, experimenting with ideas, and sharing whatever has caught their attention lately. Here's a look at a selection of recent writing and creative work from around the Joshternet.

Everything here comes from participating independent websites. Follow something that catches your eye and you'll end up on the publisher's own site, right where it belongs. This is not an exhaustive feed of everything every participant has published—just a recent selection worth browsing.

<p class="activity-subscribe">
  Want to keep up without coming back here every day?
  <a href="{{ '/assets/activity/atom.xml' | relative_url }}">Subscribe to What's New</a>
  in your favorite feed reader, or grab the
  <a href="{{ '/assets/network/joshternet.opml' | relative_url }}">OPML blogroll</a>
  (a list of feeds you can import) to follow participating publishers directly.
  Their websites stay theirs, and you get the updates in a place you choose.
</p>

{% if primary.size > 0 %}
<ol class="activity-list h-feed">
  {% for item in primary %}
    {% include activity-card.html item=item %}
  {% endfor %}
</ol>

<p class="activity-showcase-note">
  Looking for more of what people have made? Explore the
  <a href="{{ '/showcase/' | relative_url }}">Showcase</a>,
  where projects and creative work have a home beyond the latest updates.
</p>

<p class="activity-close">
  Found somebody interesting? Follow their work, explore their website, and see
  where their links lead. There's a lot more to the independent web than any one
  feed can show. There's a good chance you'll find something you weren't looking
  for—that's usually how the best internet rabbit holes start.
</p>
{% else %}
<div class="network-empty">
  <p>
    Nothing new has made it into What's New just yet, but that doesn't mean the
    rest of the internet has gone quiet. Have a wander through the
    <a href="{{ '/network/' | relative_url }}">Network</a>
    or
    <a href="{{ '/wander/' | relative_url }}">Wander</a>
    and see what people are sharing on their own sites.
  </p>
</div>
{% endif %}
