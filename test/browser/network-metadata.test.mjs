import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

import { extractPageMetadata } from "../../scripts/network/metadata.mjs";
import { elsewhereHostCatalog } from "../../scripts/network/elsewhere.mjs";

const elsewhereCatalog = elsewhereHostCatalog();

async function withPage(html, callback) {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    await callback(page);
  } finally {
    await browser.close();
  }
}

test("extracts ordinary page metadata", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <title>Home | Example Site</title>
          <meta
            name="description"
            content="An ordinary authored description."
          >
          <meta property="og:site_name" content="Example Site">
          <meta property="og:title" content="Example Site Home">
          <meta
            property="og:description"
            content="An Open Graph description."
          >
          <meta name="twitter:title" content="Example on Twitter">
          <meta
            name="twitter:description"
            content="A Twitter description."
          >
          <meta name="application-name" content="Example App">
        </head>
        <body>
          <main>
            <h1>Example Site</h1>
            <p>
              This is a sufficiently long visible introduction that could
              be used if the page did not provide better authored metadata.
            </p>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.equal(metadata.ogSiteName, "Example Site");
      assert.equal(metadata.applicationName, "Example App");
      assert.equal(metadata.ogTitle, "Example Site Home");
      assert.equal(metadata.twitterTitle, "Example on Twitter");
      assert.equal(metadata.documentTitle, "Home | Example Site");
      assert.equal(metadata.description, "An ordinary authored description.");
      assert.equal(metadata.ogDescription, "An Open Graph description.");
      assert.equal(metadata.twitterDescription, "A Twitter description.");
      assert.match(
        metadata.mainDescription,
        /^This is a sufficiently long visible introduction/,
      );
    },
  );
});

test("extracts Person JSON-LD name and author meta", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://joshghent.com/">
          <title>Josh Ghent — Developer Musings</title>
          <meta name="author" content="Josh Ghent">
          <meta property="og:site_name" content="Developer Musings">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Person",
              "name": "Josh Ghent",
              "url": "https://joshghent.com"
            }
          </script>
        </head>
        <body><main><p>${"x".repeat(90)}</p></main></body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.equal(metadata.jsonLdPersonName, "Josh Ghent");
      assert.equal(metadata.authorName, "Josh Ghent");
      assert.equal(metadata.ogSiteName, "Developer Musings");
    },
  );
});

test("extracts WebSite JSON-LD metadata", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <title>Home</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Structured Example",
              "description": "A description supplied by WebSite JSON-LD."
            }
          </script>
        </head>
        <body>
          <main>
            <h1>Home</h1>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.equal(metadata.jsonLdSiteName, "Structured Example");
      assert.equal(
        metadata.jsonLdDescription,
        "A description supplied by WebSite JSON-LD.",
      );
    },
  );
});

test("extracts WebSite metadata from a JSON-LD graph", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <title>Example</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Person",
                  "name": "Example Person"
                },
                {
                  "@type": "WebSite",
                  "name": "Example Garden",
                  "description": "A little independent place on the web."
                }
              ]
            }
          </script>
        </head>
        <body>
          <main>
            <h1>Example</h1>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.equal(metadata.jsonLdSiteName, "Example Garden");
      assert.equal(
        metadata.jsonLdDescription,
        "A little independent place on the web.",
      );
    },
  );
});

test("ignores malformed JSON-LD and keeps extracting the page", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <title>Still Works</title>
          <script type="application/ld+json">
            { this is not valid json
          </script>
        </head>
        <body>
          <main>
            <h1>Still Works</h1>
            <p>
              This visible introduction is long enough to provide a useful
              fallback even though the structured data above is malformed.
            </p>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.equal(metadata.documentTitle, "Still Works");
      assert.equal(metadata.jsonLdSiteName, "");
      assert.equal(metadata.jsonLdDescription, "");
      assert.match(
        metadata.mainDescription,
        /^This visible introduction is long enough/,
      );
    },
  );
});

test("uses meaningful visible content instead of a short lead", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <title>Shipping Fixes Everything - Joshtronic</title>
        </head>
        <body>
          <main>
            <h1>Hi, I’m Josh</h1>

            <p>I make things.</p>

            <p>
              Code is a medium that found me at an impressionable young age.
              I've been fortunate to make a career out of it, even if I am
              still figuring out what I want to do when I grow up.
            </p>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.equal(
        metadata.documentTitle,
        "Shipping Fixes Everything - Joshtronic",
      );

      assert.match(metadata.mainDescription, /^Code is a medium that found me/);

      assert.doesNotMatch(metadata.mainDescription, /^I make things\.$/);
    },
  );
});

test("prefers main content over cookie and navigation text", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <title>Example</title>
        </head>
        <body>
          <div class="cookie-banner">
            <p>
              We use cookies and similar technologies to personalize content,
              analyze traffic, remember preferences, and improve your
              experience while using this website.
            </p>
          </div>

          <nav>
            <p>
              This navigation contains enough words that it must never become
              the public description for this participant website.
            </p>
          </nav>

          <main>
            <h1>Example</h1>
            <p>
              This is the real introduction to the independent website and is
              the text that should be considered for the visible description
              fallback when authored metadata is unavailable.
            </p>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.match(metadata.mainDescription, /^This is the real introduction/);

      assert.doesNotMatch(metadata.mainDescription, /^We use cookies/);
    },
  );
});

test("does not invent a visible description when no useful prose exists", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <title>Minimal Site</title>
        </head>
        <body>
          <main>
            <h1>Minimal Site</h1>
            <p>Hello.</p>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.equal(metadata.mainDescription, "");
      assert.deepEqual(metadata.feeds, []);
    },
  );
});

test("extracts advertised RSS, Atom, and JSON Feed links", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://feeds.example/">
          <title>Feeds</title>
          <link
            rel="alternate"
            type="application/rss+xml"
            title="Site RSS"
            href="/rss.xml"
          >
          <link
            rel="alternate stylesheet"
            type="application/atom+xml"
            href="https://feeds.example/atom.xml"
          >
          <link
            rel="alternate"
            type="application/feed+json"
            href="feed.json"
          >
          <link
            rel="alternate"
            type="application/rss+xml"
            href="http://["
          >
          <link
            rel="alternate"
            type="text/html"
            href="https://feeds.example/about"
          >
          <link rel="stylesheet" href="/site.css">
        </head>
        <body>
          <main>
            <h1>Feeds</h1>
            <p>
              This visible introduction is long enough that ordinary metadata
              extraction still works when a feed declaration is broken.
            </p>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.deepEqual(metadata.feeds, [
        {
          href: "https://feeds.example/rss.xml",
          type: "application/rss+xml",
          title: "Site RSS",
        },
        {
          href: "https://feeds.example/atom.xml",
          type: "application/atom+xml",
        },
        {
          href: "https://feeds.example/feed.json",
          type: "application/feed+json",
        },
      ]);
      assert.match(
        metadata.mainDescription,
        /^This visible introduction is long enough/,
      );
    },
  );
});

test("returns an empty feeds array when no alternate feeds are advertised", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <title>No Feeds</title>
          <link rel="stylesheet" href="/site.css">
        </head>
        <body>
          <main>
            <h1>No Feeds</h1>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.deepEqual(metadata.feeds, []);
      assert.deepEqual(metadata.blogrolls, []);
      assert.deepEqual(metadata.links, []);
      assert.deepEqual(metadata.elsewhere, []);
    },
  );
});

test("extracts outbound participant page links", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://a.example/">
          <title>Links</title>
        </head>
        <body>
          <main>
            <h1>Links</h1>
            <a href="https://b.example/posts">B</a>
            <a href="https://b.example/posts#frag">B again</a>
            <a href="/about">Same origin</a>
            <a href="//c.example/path">Protocol relative</a>
            <a rel="nofollow" href="https://d.example/">Nofollow</a>
            <a href="mailto:josh@example.com">Email</a>
            <a href="tel:+15551212">Phone</a>
            <a href="javascript:void(0)">JS</a>
            <a href="data:text/plain,hi">Data</a>
            <a href="#top">Fragment only</a>
            <a href="">Empty</a>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.deepEqual(metadata.links, [
        {
          href: "https://b.example/posts",
          text: "B",
          rel: [],
          classNames: [],
        },
        {
          href: "https://b.example/posts#frag",
          text: "B again",
          rel: [],
          classNames: [],
        },
        {
          href: "https://a.example/about",
          text: "Same origin",
          rel: [],
          classNames: [],
        },
        {
          href: "https://c.example/path",
          text: "Protocol relative",
          rel: [],
          classNames: [],
        },
        {
          href: "https://d.example/",
          text: "Nofollow",
          rel: ["nofollow"],
          classNames: [],
        },
      ]);
    },
  );
});

test("skips Meet grid and activity-card links and captures classNames", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://joshternet.org/">
          <title>Home</title>
        </head>
        <body>
          <div data-home-meet-grid>
            <a class="network-card__link u-url" href="https://b.example/">Meet B</a>
          </div>
          <li class="activity-card">
            <a class="activity-card__link u-url" href="https://c.example/post/">Activity C</a>
          </li>
          <a class="editorial" href="https://d.example/note/">Editorial D</a>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.deepEqual(metadata.links, [
        {
          href: "https://d.example/note/",
          text: "Editorial D",
          rel: [],
          classNames: ["editorial"],
        },
      ]);
    },
  );
});

test("extracts advertised blogroll OPML links", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://blogroll.example/">
          <title>Blogroll</title>
          <link
            rel="blogroll"
            type="text/xml"
            href="/blogroll.opml"
          >
          <link
            rel="blogroll"
            type="application/xml"
            href="/wrong-type.opml"
          >
          <link
            rel="alternate"
            type="text/xml"
            href="/not-a-blogroll.opml"
          >
        </head>
        <body>
          <main>
            <h1>Blogroll</h1>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);

      assert.deepEqual(metadata.blogrolls, [
        {
          href: "https://blogroll.example/blogroll.opml",
          type: "text/xml",
        },
      ]);
    },
  );
});

test("extracts advertised rel=me elsewhere links", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://elsewhere.example/">
          <title>Elsewhere</title>
          <link rel="me" href="https://github.com/somejosh">
          <link rel="noopener" href="https://ignored.example/">
        </head>
        <body>
          <main>
            <h1>Elsewhere</h1>
            <a rel="me" href="https://bsky.app/profile/example.com">Bluesky</a>
            <a rel="me nofollow" href="/about">About</a>
            <a href="https://github.com/not-me">Not me</a>
            <a rel="me" href="mailto:josh@example.com">Email</a>
            <a rel="me" href="">Empty</a>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(
        extractPageMetadata,
        elsewhereCatalog,
      );

      assert.deepEqual(metadata.elsewhere, [
        {
          href: "https://github.com/somejosh",
          me: true,
        },
        {
          href: "https://bsky.app/profile/example.com",
          text: "Bluesky",
          me: true,
        },
        {
          href: "https://elsewhere.example/about",
          text: "About",
          me: true,
        },
        {
          href: "mailto:josh@example.com",
          text: "Email",
          me: true,
        },
        {
          href: "https://github.com/not-me",
          text: "Not me",
          me: false,
        },
      ]);
    },
  );
});

test("extracts catalog social links without rel=me", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://baker.example/">
          <title>Baker</title>
        </head>
        <body>
          <main>
            <a href="https://github.com/joshuabaker">GitHub</a>
            <a href="https://github.com/joshuabaker/site">Repo</a>
            <a href="https://www.linkedin.com/in/thejoshuabaker">LinkedIn</a>
            <a href="https://x.com/joshuabaker">X/Twitter</a>
            <a href="https://friend.example/">Friend</a>
          </main>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(
        extractPageMetadata,
        elsewhereCatalog,
      );

      assert.deepEqual(metadata.elsewhere, [
        {
          href: "https://github.com/joshuabaker",
          text: "GitHub",
          me: false,
        },
        {
          href: "https://github.com/joshuabaker/site",
          text: "Repo",
          me: false,
        },
        {
          href: "https://www.linkedin.com/in/thejoshuabaker",
          text: "LinkedIn",
          me: false,
        },
        {
          href: "https://x.com/joshuabaker",
          text: "X/Twitter",
          me: false,
        },
      ]);
      assert.equal(metadata.aboutPageHref, "");
    },
  );
});

test("extracts same-origin about page href", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://about.example/">
          <title>Home</title>
        </head>
        <body>
          <nav>
            <a href="/blog">Blog</a>
            <a href="/about/">About</a>
          </nav>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(
        extractPageMetadata,
        elsewhereCatalog,
      );

      assert.equal(metadata.aboutPageHref, "https://about.example/about/");
    },
  );
});

test("extracts /me as an about page path", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://me.example/">
          <title>Home</title>
        </head>
        <body>
          <a href="/me/">About</a>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);
      assert.equal(metadata.aboutPageHref, "https://me.example/me/");
      assert.deepEqual(metadata.aboutPageHrefs, ["https://me.example/me/"]);
    },
  );
});

test("extracts joshbeard-style /more and /site identity pages", async () => {
  await withPage(
    `
      <!doctype html>
      <html>
        <head>
          <base href="https://joshbeard.example/">
          <title>Home</title>
        </head>
        <body>
          <a href="/more/">More</a>
          <a href="/now/">Now</a>
          <a href="/uses/">Uses</a>
          <a href="/site/">About This Site</a>
          <a href="/blog/">Blog</a>
        </body>
      </html>
    `,
    async (page) => {
      const metadata = await page.evaluate(extractPageMetadata);
      assert.equal(metadata.aboutPageHref, "https://joshbeard.example/more/");
      assert.ok(
        metadata.aboutPageHrefs.includes("https://joshbeard.example/more/"),
      );
      assert.ok(
        metadata.aboutPageHrefs.includes("https://joshbeard.example/site/"),
      );
      assert.ok(
        metadata.aboutPageHrefs.includes("https://joshbeard.example/now/"),
      );
      assert.ok(
        metadata.aboutPageHrefs.includes("https://joshbeard.example/uses/"),
      );
      assert.ok(
        !metadata.aboutPageHrefs.includes("https://joshbeard.example/blog/"),
      );
    },
  );
});
