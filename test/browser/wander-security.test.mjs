import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

const wanderScriptPath = fileURLToPath(
  new URL("../../assets/js/wander.js", import.meta.url),
);

const wanderScript = await readFile(wanderScriptPath, "utf8");

const fixture = `
<!doctype html>
<html lang="en">
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

      <div data-wander-stage></div>
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

async function wanderPage(data, { sessionState } = {}) {
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

    assert.equal(await frame.getAttribute("sandbox"), "allow-scripts");

    assert.equal(await frame.getAttribute("referrerpolicy"), "no-referrer");

    assert.equal(await page.locator("[data-wander-open]").isDisabled(), false);

    await page.locator("[data-wander-open]").click();

    const calls = await page.evaluate(() => {
      return window.__wanderOpenCalls;
    });

    assert.deepEqual(calls, [
      ["https://safe.example/", "_blank", "noopener,noreferrer"],
    ]);
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

    assert.equal(href, "https://safe.example");
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
      [["https://safe.example/", "_blank", "noopener,noreferrer"]],
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
