---
layout: default
title: Search articles from independent Joshternet websites
description: >-
  Search articles and pages from independent websites participating in the
  Joshternet. Find writing by topic, site, or phrase across the open Josh network.
keywords: >-
  search Joshternet, Josh network search, independent websites, topic search
seo:
  type: WebPage
  name: Search
permalink: /search/
joshternet_analysis: derived
robots: noindex
script: /assets/js/search.js
---

# Search

Search from around the Joshternet.

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
  Type a word from a title, domain, or topic.
</p>

<ol class="activity-list h-feed" data-search-results></ol>

<noscript>
  <div class="network-empty">
    <p>
      Search needs JavaScript in this browser. Meanwhile,
      <a href="{{ '/activity/' | relative_url }}">What's New</a>,
      the <a href="{{ '/network/' | relative_url }}">Network</a>,
      and <a href="{{ '/topics/' | relative_url }}">Topics</a>
      are readable without it.
    </p>
  </div>
</noscript>
