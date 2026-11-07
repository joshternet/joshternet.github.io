---
layout: default
title: "Joshternet | An Internet Full of Joshes and Friends"
description: >-
  Joshternet began with Joshes finding other Joshes and grew into an open
  network of independent websites. Come explore what people are making, meet
  some interesting folks, or join with your own site.
keywords: >-
  Joshternet, Josh network, independent websites, indie web, open web,
  /.well-known/josh, personal websites, join Joshternet
robots: max-snippet:160, max-image-preview:large
scripts:
  - /assets/js/crawl-keys.js
  - /assets/js/home-meet.js
  - /assets/js/connections.js
---

# The Joshternet

<p class="home-tagline">An internet full of Joshes. And friends of Joshes.</p>

Joshternet began with a simple idea: find other Joshes who have their own little corners of the internet and see what they're making. What started as a funny search for namesakes has grown into a network of independent websites, interesting people, and plenty of places worth exploring. You don't have to be a Josh to join the fun, and nobody has to give up their own website to participate.

<p class="home-invite">
  <strong class="home-invite__lead">Are you a Josh? Get yourself connected.</strong>
  Not a Josh? Come along anyway. Everyone participates on equal terms, and there are plenty more corners of the web to discover.
</p>

<p class="home-cta">
  <a class="home-cta__primary" href="{{ '/join/' | relative_url }}">Join the Joshternet</a>
  <a class="home-cta__secondary" href="{{ '/wander/' | relative_url }}">Wander the Joshternet</a>
</p>

{% include home-new-arrivals.html %}

## Meet the websites

Every website has a person, an idea, or a story behind it. Here are a few places to start exploring. You never know what you'll find.

{% include home-meet-sites.html %}

## What's happening

There's always something interesting happening in someone's corner of the web. Here's a little of what people have been writing and sharing lately.

{% include home-recent-activity.html %}

{% include home-happening.html %}

{% include home-showcase.html %}

## See how the Joshternet connects

An interesting thing happens when you start connecting independent websites: you discover who's linking to whom, and sometimes who's exploring similar ideas without ever having met.

{% include home-connections.html %}

## How to join the fun

No accounts. No signup form. Joshternet doesn't need another place for you to post your work. You keep your website, your domain, and everything you've already built. All you need to participate is a small public declaration at `/.well-known/josh`, which tells the network your site wants to be part of the adventure.

Being named Josh is optional, and so is declaring Josh identity. The [Join][join] guide walks you through publishing the declaration on your own website, checking that it works, and getting discovered. JoshBot can later list sites in the Network—the registry helps with discovery; it is not the Joshternet, and it does not decide who is a Josh.

<p class="home-cta home-cta--join-teaser">
  <a class="home-cta__secondary" href="{{ '/join/' | relative_url }}">Read the Join guide</a>
</p>

## Still exploring

The Joshternet is still a work in progress, which is part of the fun. The network is growing, the specifications are still Drafts, and there are plenty of things left to figure out. The idea is to build with real people and real websites, learn from what works, and keep the door open for whatever interesting connections come next.

The [specifications][specifications] and [governance][governance] documents are public for anyone who wants to dig into the details. You don't need to read them to enjoy exploring the network.

## There's more out there

The web is still full of wonderful, weird, interesting places, and plenty of them are hiding behind an ordinary-looking domain name. Joshternet is one small excuse to go looking for them, meet the people behind them, and maybe make a few new connections along the way.

Take a wander, visit somebody's website, or bring your own corner of the internet into the mix. There are always more Joshes to meet, and more people ready to josh along.

<p class="home-cta">
  <a class="home-cta__secondary" href="{{ '/wander/' | relative_url }}">Wander the Joshternet</a>
  <a class="home-cta__secondary" href="{{ '/about/' | relative_url }}">About the project</a>
  <a class="home-cta__secondary" href="{{ '/join/' | relative_url }}">Join the Joshternet</a>
</p>

[about]: /about/
[specifications]: /specs/
[governance]: /governance/
[join]: /join/
