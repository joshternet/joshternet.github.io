import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

import { extractPageMetadata } from "../../scripts/network/metadata.mjs";

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
    },
  );
});
