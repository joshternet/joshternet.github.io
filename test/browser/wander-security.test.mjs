import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const wanderScriptPath = fileURLToPath(
  new URL("../../assets/js/wander.js", import.meta.url),
);

const outboundScriptPath = fileURLToPath(
  new URL("../../assets/js/outbound-referrer.js", import.meta.url),
);

const mainStylesPath = fileURLToPath(
  new URL("../../assets/css/main.css", import.meta.url),
);

const wanderScript = await readFile(wanderScriptPath, "utf8");
const outboundScript = await readFile(outboundScriptPath, "utf8");
const mainStyles = await readFile(mainStylesPath, "utf8");

/**
 * Expected Wander Open / fallback href with Joshternet UTM params.
 * @param {string} href
 * @returns {string}
 */
function wanderOutbound(href) {
  const url = new URL(href);

  url.searchParams.set("utm_source", "joshternet.org");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "wander");
  url.searchParams.set("utm_content", "/wander/");

  return url.href;
}

const fixture = `
<!doctype html>
<html lang="en">
  <head>
    <meta
      http-equiv="Content-Security-Policy"
      content="frame-src https://safe.example https://first.example https://second.example https://joshternet.org"
    >
    <link rel="stylesheet" href="/assets/css/main.css">
  </head>
  <body>
    <p
      data-wander-status
      role="status"
      aria-live="polite"
    ></p>

    <div data-wander-console>
      <button
        type="button"
        data-wander-go
      >
        Go
      </button>

      <input
        type="url"
        data-wander-address
        readonly
      >

      <button
        type="button"
        data-wander-open
        disabled
      >
        Open
      </button>

      <div data-wander-stage style="block-size: 40rem"></div>
    </div>
  </body>
</html>
`;

let browser;

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
});

async function wanderPage(data, { sessionState, prepare } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route("http://joshternet.test/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/wander/") {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: fixture,
      });

      return;
    }

    if (url.pathname === "/assets/css/main.css") {
      await route.fulfill({
        status: 200,
        contentType: "text/css",
        body: mainStyles,
      });

      return;
    }

    if (url.pathname === "/network/data.json") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });

      return;
    }

    await route.abort();
  });

  if (prepare) {
    await prepare(page);
  }

  await page.goto("http://joshternet.test/wander/");

  await page.evaluate((state) => {
    window.__wanderOpenCalls = [];

    window.open = (...arguments_) => {
      window.__wanderOpenCalls.push(arguments_);

      return null;
    };

    if (state) {
      sessionStorage.setItem("joshternet-wander-v2", JSON.stringify(state));
    }
  }, sessionState);

  await page.addScriptTag({
    content: outboundScript,
  });

  await page.addScriptTag({
    content: wanderScript,
  });

  return {
    context,
    page,
  };
}

test("validated HTTPS participant uses the constrained iframe sandbox", async () => {
  const { context, page } = await wanderPage([
    {
      origin: "https://safe.example",
      domain: "safe.example",
      identity: "affirmed",
      title: "Safe Example",
      description: "A valid Wander participant.",
      screenshot: "/assets/network/sites/safe.webp",
      embeddable: true,
      frame_reason: "allowed",
    },
  ]);

  try {
    await page.waitForFunction(() => {
      return (
        document.querySelector("[data-wander-address]")?.value ===
        "https://safe.example"
      );
    });

    const frame = page.locator(".wander-frame");

    assert.equal(await frame.count(), 1);

    assert.equal(await frame.getAttribute("src"), "https://safe.example");

    assert.equal(
      await frame.getAttribute("sandbox"),
      "allow-scripts allow-same-origin",
    );

    assert.equal(await frame.getAttribute("referrerpolicy"), "no-referrer");

    assert.equal(
      await page.locator("[data-wander-link-notice]").isHidden(),
      true,
    );

    assert.equal(
      await page.locator("[data-wander-status]").innerText(),
      "Now viewing Safe Example.",
    );

    assert.equal(await page.locator(".wander-embed__poster").count(), 0);

    assert.equal(await page.locator("[data-wander-open]").isDisabled(), false);

    await page.locator("[data-wander-open]").click();

    const calls = await page.evaluate(() => {
      return window.__wanderOpenCalls;
    });

    assert.deepEqual(calls, [
      [wanderOutbound("https://safe.example/"), "_blank", "noopener"],
    ]);
  } finally {
    await context.close();
  }
});

test("an external link shows the blocked-link bubble and a same-site link does not", async () => {
  const notice =
    "Wander blocks links that leave that site, and Open opens the publisher's site in another tab.";

  const { context, page } = await wanderPage(
    [
      {
        origin: "https://safe.example",
        domain: "safe.example",
        identity: "affirmed",
        title: "Safe Example",
        description: "A valid Wander participant.",
        screenshot: "/assets/network/sites/safe.webp",
        embeddable: true,
        frame_reason: "allowed",
      },
    ],
    {
      prepare: async (readyPage) => {
        await readyPage.route("https://safe.example/**", async (route) => {
          const url = new URL(route.request().url());

          if (url.pathname === "/notes") {
            await route.fulfill({
              status: 200,
              contentType: "text/html",
              body: '<a id="leave" href="https://left.example/" style="position:absolute;left:64px;top:280px">Leave</a>',
            });

            return;
          }

          await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: '<div style="height:2400px"><a id="notes" href="https://safe.example/notes">Notes</a><a id="leave" href="https://left.example/">Leave</a></div>',
          });
        });
      },
    },
  );

  try {
    const framed = page.frameLocator(".wander-frame");

    await framed.locator("#notes").waitFor();

    const siteFrame = page.frames().find((frame) => {
      return frame.url().startsWith("https://safe.example");
    });
    const frameBox = await page.locator(".wander-frame").boundingBox();

    await page.mouse.move(
      frameBox.x + frameBox.width / 2,
      frameBox.y + Math.min(120, frameBox.height / 2),
    );

    const scrollBefore = await siteFrame.evaluate(() => window.scrollY);

    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(200);

    assert.ok((await siteFrame.evaluate(() => window.scrollY)) > scrollBefore);

    await framed.locator("#notes").scrollIntoViewIfNeeded();

    const notesBox = await framed.locator("#notes").boundingBox();

    await page.mouse.click(
      notesBox.x + notesBox.width / 2,
      notesBox.y + notesBox.height / 2,
    );

    await framed.locator("#leave").waitFor();

    assert.equal(
      await page.locator("[data-wander-link-notice]").isHidden(),
      true,
    );

    await page.evaluate(() => {
      document.body.style.minBlockSize = "4000px";
      window.scrollTo(0, 360);
    });

    const scrollBeforeNotice = await page.evaluate(() => window.scrollY);
    const leaveBox = await framed.locator("#leave").boundingBox();

    await page.mouse.click(
      leaveBox.x + leaveBox.width / 2,
      leaveBox.y + leaveBox.height / 2,
    );

    await page.waitForFunction(() => {
      return (
        document.querySelector(".wander-frame")?.getAttribute("src") ===
        "about:blank"
      );
    });

    await framed.locator("#leave").waitFor();

    await page
      .locator("[data-wander-link-notice]")
      .waitFor({ state: "visible" });

    assert.equal(await page.evaluate(() => window.scrollY), scrollBeforeNotice);

    const bubbleBox = await page
      .locator("[data-wander-link-notice]")
      .boundingBox();

    assert.ok(Math.abs(bubbleBox.x - leaveBox.x) < 160);
    assert.ok(Math.abs(bubbleBox.y - leaveBox.y) < 160);

    assert.equal(
      await page.locator("[data-wander-link-notice] p").innerText(),
      notice,
    );

    assert.equal(
      await page.locator("[data-wander-status]").innerText(),
      notice,
    );

    assert.equal(
      await page.locator("[data-wander-dismiss-link]").evaluate((button) => {
        return button === document.activeElement;
      }),
      true,
    );

    assert.equal(
      page
        .frames()
        .some((frame) => frame.url().startsWith("https://left.example")),
      false,
    );

    assert.equal(
      page
        .frames()
        .some((frame) => frame.url().startsWith("https://safe.example/notes")),
      true,
    );

    await page.locator("[data-wander-dismiss-link]").click();

    assert.equal(
      await page.locator("[data-wander-link-notice]").isHidden(),
      true,
    );
  } finally {
    await context.close();
  }
});

test("malformed and hostile network entries cannot become Wander destinations", async () => {
  const hostileTitle = '<img src=x onerror="window.__wanderInjected = true">';

  const hostileDescription = "<script>window.__wanderInjected = true</script>";

  const { context, page } = await wanderPage([
    {
      origin: "javascript:alert(1)",
      domain: "evil.example",
      identity: "affirmed",
      title: "JavaScript URL",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
    {
      origin: "data:text/html,hello",
      domain: "",
      identity: "affirmed",
      title: "Data URL",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
    {
      origin: "https://user:password@evil.example",
      domain: "evil.example",
      identity: "affirmed",
      title: "Credential URL",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
    {
      origin: "https://evil.example/path",
      domain: "evil.example",
      identity: "affirmed",
      title: "Path URL",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
    {
      origin: "https://evil.example?next=https://example.com",
      domain: "evil.example",
      identity: "affirmed",
      title: "Query URL",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
    {
      origin: "https://mismatch.example",
      domain: "different.example",
      identity: "affirmed",
      title: "Mismatched domain",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
    {
      origin: "https://identity.example",
      domain: "identity.example",
      identity: "administrator",
      title: "Invalid identity",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
    {
      origin: "http://insecure.example",
      domain: "insecure.example",
      identity: "affirmed",
      title: "Invalid iframe state",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
    {
      origin: "https://reason.example",
      domain: "reason.example",
      identity: "affirmed",
      title: "Invalid frame reason",
      description: "",
      screenshot: "",
      embeddable: false,
      frame_reason: "javascript:alert(1)",
    },
    {
      origin: "https://safe.example",
      domain: "safe.example",
      identity: "undeclared",
      title: hostileTitle,
      description: hostileDescription,
      screenshot: "https://evil.example/tracker.png",
      embeddable: false,
      frame_reason: "blocked-by-site",
    },
  ]);

  try {
    await page.waitForFunction(() => {
      return (
        document.querySelector("[data-wander-address]")?.value ===
        "https://safe.example"
      );
    });

    assert.equal(
      await page.locator("[data-wander-address]").inputValue(),
      "https://safe.example",
    );

    assert.equal(await page.locator(".wander-frame").count(), 0);

    assert.equal(await page.locator(".network-card__image").count(), 0);

    const renderedTitle = await page
      .locator(".network-card__title")
      .innerText();

    assert.ok(renderedTitle.startsWith(hostileTitle));

    assert.equal(
      await page.locator(".network-card__description").innerText(),
      hostileDescription,
    );

    assert.equal(await page.locator("[data-wander-stage] script").count(), 0);

    assert.equal(await page.locator("[data-wander-stage] img").count(), 0);

    assert.equal(
      await page.evaluate(() => {
        return window.__wanderInjected;
      }),
      undefined,
    );

    const href = await page.locator(".network-card__link").getAttribute("href");

    assert.equal(href, wanderOutbound("https://safe.example"));
  } finally {
    await context.close();
  }
});

test("session state and address tampering cannot create an arbitrary Open destination", async () => {
  const { context, page } = await wanderPage(
    [
      {
        origin: "https://safe.example",
        domain: "safe.example",
        identity: "declined",
        title: "Safe Example",
        description: "",
        screenshot: "",
        embeddable: false,
        frame_reason: "blocked-by-site",
      },
    ],
    {
      sessionState: {
        bag: ["javascript:alert(1)", "https://evil.example"],
        currentOrigin: "https://evil.example",
      },
    },
  );

  try {
    await page.waitForFunction(() => {
      return (
        document.querySelector("[data-wander-address]")?.value ===
        "https://safe.example"
      );
    });

    await page.locator("[data-wander-address]").evaluate((input) => {
      input.value = "https://evil.example";

      input.dispatchEvent(
        new Event("input", {
          bubbles: true,
        }),
      );
    });

    assert.equal(await page.locator("[data-wander-open]").isDisabled(), true);

    await page.locator("[data-wander-address]").press("Enter");

    assert.deepEqual(
      await page.evaluate(() => {
        return window.__wanderOpenCalls;
      }),
      [],
    );

    await page.locator("[data-wander-go]").click();

    await page.waitForFunction(() => {
      return (
        document.querySelector("[data-wander-address]")?.value ===
        "https://safe.example"
      );
    });

    assert.equal(await page.locator("[data-wander-open]").isDisabled(), false);

    await page.locator("[data-wander-open]").click();

    assert.deepEqual(
      await page.evaluate(() => {
        return window.__wanderOpenCalls;
      }),
      [[wanderOutbound("https://safe.example/"), "_blank", "noopener"]],
    );
  } finally {
    await context.close();
  }
});

test("duplicate network origins cannot create duplicate Wander destinations", async () => {
  const { context, page } = await wanderPage([
    {
      origin: "https://safe.example",
      domain: "safe.example",
      identity: "affirmed",
      title: "First",
      description: "",
      screenshot: "",
      embeddable: false,
      frame_reason: "blocked-by-site",
    },
    {
      origin: "https://safe.example",
      domain: "safe.example",
      identity: "declined",
      title: "Duplicate",
      description: "",
      screenshot: "",
      embeddable: false,
      frame_reason: "blocked-by-site",
    },
  ]);

  try {
    await page.waitForFunction(() => {
      return (
        document.querySelector(".network-card__title")?.textContent || ""
      ).includes("First");
    });

    assert.match(
      await page.locator(".network-card__title").innerText(),
      /^First/,
    );

    for (let index = 0; index < 5; index += 1) {
      await page.locator("[data-wander-go]").click();

      assert.match(
        await page.locator(".network-card__title").innerText(),
        /^First/,
      );
    }
  } finally {
    await context.close();
  }
});

test("restored site stays until Go is clicked", async () => {
  const { context, page } = await wanderPage(
    [
      {
        origin: "https://first.example",
        domain: "first.example",
        identity: "affirmed",
        title: "First Example",
        description: "",
        screenshot: "",
        embeddable: true,
        frame_reason: "allowed",
      },
      {
        origin: "https://second.example",
        domain: "second.example",
        identity: "affirmed",
        title: "Second Example",
        description: "",
        screenshot: "",
        embeddable: true,
        frame_reason: "allowed",
      },
    ],
    {
      sessionState: {
        bag: ["https://second.example"],
        currentOrigin: "https://first.example",
      },
    },
  );

  try {
    await page.waitForFunction(() => {
      return (
        document.querySelector("[data-wander-address]")?.value ===
        "https://first.example"
      );
    });

    assert.equal(
      await page.locator("[data-wander-address]").inputValue(),
      "https://first.example",
    );

    await page.locator("[data-wander-go]").click();

    await page.waitForFunction(() => {
      return (
        document.querySelector("[data-wander-address]")?.value ===
        "https://second.example"
      );
    });
  } finally {
    await context.close();
  }
});

test("Joshternet hub uses the self-host fallback instead of a CSP-blocked iframe", async () => {
  const { context, page } = await wanderPage([
    {
      origin: "https://joshternet.org",
      domain: "joshternet.org",
      identity: "undeclared",
      title: "Joshternet",
      description: "",
      screenshot: "",
      embeddable: true,
      frame_reason: "allowed",
    },
  ]);

  try {
    await page.waitForFunction(() => {
      return (
        document.querySelector("[data-wander-address]")?.value ===
        "https://joshternet.org"
      );
    });

    assert.equal(await page.locator(".wander-frame").count(), 0);
    assert.equal(
      await page.locator(".wander-fallback").getAttribute("data-frame-reason"),
      "self",
    );
  } finally {
    await context.close();
  }
});
