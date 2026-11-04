---
layout: default
title: Search
description: >-
  Search independent websites, articles, projects, and topics discovered across
  the Joshternet. Find something interesting and follow it back to the people
  and websites behind it.
keywords: >-
  Search, Joshternet, independent websites, topics, articles, projects
seo:
  type: WebPage
  name: Search
permalink: /search/
joshternet_analysis: derived
robots: noindex
sitemap: false
script: /assets/js/search.js
---

# Search

Looking for something in particular? Search the websites, writing, projects, and
topics that Joshternet has discovered so far. You might find exactly what you
came for, or stumble across something you didn't know you were looking for.

Everything leads back to the independent websites where people publish their
work. Joshternet helps you find the interesting bits, but the websites themselves
remain the destination. Search covers the websites and content Joshternet has
indexed so far. There's always more out there, so a missing result doesn't
necessarily mean the website or work doesn't exist.

<div class="explore-search" role="search">
  <label class="explore-filter-field" for="joshternet-search">
    <span>Search the Joshternet</span>
  </label>
  <input
    id="joshternet-search"
    type="search"
    data-search-input
    autocomplete="off"
    spellcheck="false"
    enterkeyhint="search"
  >
  <fieldset class="explore-search__types">
    <legend class="visually-hidden">Result type</legend>
    <label><input type="radio" name="search-type" value="all" data-search-type checked> All</label>
    <label><input type="radio" name="search-type" value="content" data-search-type> Content</label>
    <label><input type="radio" name="search-type" value="site" data-search-type> Sites</label>
    <label><input type="radio" name="search-type" value="topic" data-search-type> Topics</label>
  </fieldset>
</div>

<p data-search-status role="status" aria-live="polite">
  Try a website name, a subject, or something you're curious about.
</p>

<ol class="activity-list h-feed" data-search-results></ol>

<noscript>
  <div class="network-empty">
    <p>
      Search needs JavaScript to look through the index. You can still explore
      <a href="{{ '/activity/' | relative_url }}">What's New</a>,
      browse the
      <a href="{{ '/network/' | relative_url }}">Network</a>,
      or follow
      <a href="{{ '/topics/' | relative_url }}">Topics</a>
      without it.
    </p>
  </div>
</noscript>
