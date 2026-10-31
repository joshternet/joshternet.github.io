/**
 * Goal: Welcome card SVG escaping, identity captions, deterministic paths,
 * and orphan cleanup against a real temp filesystem + Sharp PNG render.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  WELCOME_CARD_DIRECTORY,
  buildWelcomeCardSvg,
  escapeXml,
  formatParticipationDate,
  identityCaption,
  materializeWelcomeCards,
  normalizeWelcomeParticipant,
  renderWelcomeCardPng,
  truncateLabel,
  welcomeCardFingerprint,
  welcomeCardPaths,
} from "../../scripts/views/welcome-cards.mjs";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.tmp/welcome-card-tests",
);

test("escapeXml neutralizes markup and quotes", () => {
  assert.equal(
    escapeXml(`<script>"x"&'y'`),
    "&lt;script&gt;&quot;x&quot;&amp;&apos;y&apos;",
  );
});

test("truncateLabel handles empty and long values", () => {
  assert.equal(truncateLabel(null, 10), "");
  assert.equal(truncateLabel("  short  ", 10), "short");
  assert.equal(truncateLabel("abcdefghijklmnop", 8), "abcdefg…");
});

test("identity captions never invent Josh certification", () => {
  assert.equal(identityCaption("affirmed"), "Josh identity: Affirmed.");
  assert.equal(identityCaption("declined"), "Josh identity: Declined.");
  assert.equal(identityCaption("undeclared"), "Josh identity: Undeclared.");
  assert.equal(
    identityCaption(/** @type {any} */ ("mystery")),
    "Josh identity: Undeclared.",
  );
  assert.doesNotMatch(identityCaption("affirmed"), /certified/i);
});

test("formatParticipationDate validates timestamps", () => {
  assert.equal(formatParticipationDate(""), "");
  assert.equal(formatParticipationDate("not-a-date"), "");
  assert.match(formatParticipationDate("2026-10-01T00:00:00.000Z"), /2026/);
});

test("welcomeCardFingerprint tolerates missing fields", () => {
  assert.equal(welcomeCardFingerprint({}), "\n\n\n\n");
  assert.match(
    welcomeCardFingerprint({
      origin: "https://example.com",
      domain: "example.com",
      title: "Example",
      identity: "affirmed",
      first_participated_at: "2026-01-01T00:00:00.000Z",
    }),
    /example\.com/,
  );
});

test("welcomeCardPaths use stableSiteID filenames", () => {
  const first = welcomeCardPaths("https://example.com");
  const second = welcomeCardPaths("https://example.com");
  assert.ok(first);
  assert.deepEqual(first, second);
  assert.match(
    first.svg,
    new RegExp(`^/${WELCOME_CARD_DIRECTORY}/[a-f0-9]{64}\\.svg$`),
  );
  assert.match(
    first.png,
    new RegExp(`^/${WELCOME_CARD_DIRECTORY}/[a-f0-9]{64}\\.png$`),
  );
  assert.equal(welcomeCardPaths("ftp://bad.example"), null);
  assert.equal(welcomeCardPaths("https://example.com/path"), null);
});

test("normalizeWelcomeParticipant rejects bad rows and fills defaults", () => {
  assert.equal(normalizeWelcomeParticipant(null), null);
  assert.equal(normalizeWelcomeParticipant([]), null);
  assert.equal(normalizeWelcomeParticipant({ origin: "nope" }), null);
  const normalized = normalizeWelcomeParticipant({
    origin: "https://plain.example",
    identity: "weird",
  });
  assert.equal(normalized?.domain, "plain.example");
  assert.equal(normalized?.title, "plain.example");
  assert.equal(normalized?.identity, "undeclared");
  assert.equal(normalized?.first_participated_at, "");

  const affirmed = normalizeWelcomeParticipant({
    origin: "https://josh.example",
    domain: "josh.example",
    title: "Josh Example",
    identity: "affirmed",
    first_participated_at: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(affirmed?.identity, "affirmed");
  assert.equal(affirmed?.title, "Josh Example");

  const whitespace = normalizeWelcomeParticipant({
    origin: "https://space.example",
    domain: "   ",
    title: "   ",
    identity: "declined",
  });
  assert.equal(whitespace?.domain, "space.example");
  assert.equal(whitespace?.title, "space.example");
  assert.equal(whitespace?.identity, "declined");
});

test("renderWelcomeCardPng produces a PNG buffer", async () => {
  const svg = buildWelcomeCardSvg({
    origin: "https://example.com",
    domain: "example.com",
    title: "Example",
    identity: "undeclared",
  });
  const png = await renderWelcomeCardPng(svg);
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, "png");
});

test("buildWelcomeCardSvg escapes titles and stays self-contained", () => {
  const svg = buildWelcomeCardSvg({
    origin: "https://example.com",
    domain: "example.com",
    title: `Josh <&> "Site"`,
    identity: "declined",
    first_participated_at: "2026-10-01T00:00:00.000Z",
  });

  assert.doesNotMatch(svg, /Josh <&>/);
  assert.match(svg, /Josh &lt;&amp;&gt; &quot;Site&quot;/);
  assert.match(svg, /Josh identity: Declined\./);
  assert.match(svg, /Joshness is declared, never derived\./);
  assert.doesNotMatch(svg, /https?:\/\/fonts/);
  assert.doesNotMatch(svg, /<script/i);

  const withoutDate = buildWelcomeCardSvg({
    origin: "https://example.com",
    domain: "example.com",
    identity: "affirmed",
  });
  assert.match(withoutDate, /Participating in the Joshternet/);

  const fallbacks = buildWelcomeCardSvg({
    origin: "https://example.com",
    domain: "",
    title: "",
    identity: "undeclared",
  });
  assert.match(fallbacks, /Welcome to the Joshternet/);

  assert.equal(truncateLabel("ab", 0), "…");
  assert.throws(() => buildWelcomeCardSvg({ origin: "bad", domain: "bad" }));
});

test("materializeWelcomeCards writes assets, manifest, and removes orphans", async () => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(path.join(root, "_data"), { recursive: true });

  const orphanDir = path.join(root, WELCOME_CARD_DIRECTORY);
  await fs.mkdir(orphanDir, { recursive: true });
  await fs.writeFile(path.join(orphanDir, "deadbeef.svg"), "<svg></svg>");
  await fs.writeFile(path.join(orphanDir, "deadbeef.png"), "png");

  const network = [
    {
      origin: "https://alpha.example",
      domain: "alpha.example",
      title: "Alpha",
      identity: "affirmed",
      first_participated_at: "2026-10-01T00:00:00.000Z",
    },
    {
      origin: "https://beta.example",
      domain: "beta.example",
      title: "Beta",
      identity: "undeclared",
      first_participated_at: "2026-09-01T00:00:00.000Z",
    },
  ];

  const first = await materializeWelcomeCards(network, root);
  assert.equal(first.cards.length, 2);

  const alpha = welcomeCardPaths("https://alpha.example");
  const alphaSvg = path.join(root, alpha.svg.slice(1));
  const alphaPng = path.join(root, alpha.png.slice(1));
  assert.equal(
    await fs.readFile(alphaSvg, "utf8").then((text) => text.includes("Alpha")),
    true,
  );

  const pngMeta = await sharp(await fs.readFile(alphaPng)).metadata();
  assert.equal(pngMeta.format, "png");
  assert.equal(pngMeta.width, 1200);
  assert.equal(pngMeta.height, 630);

  assert.equal(
    await fs.access(path.join(orphanDir, "deadbeef.svg")).then(
      () => "present",
      () => "missing",
    ),
    "missing",
  );

  await fs.writeFile(
    path.join(root, "_data/welcome_cards.json"),
    JSON.stringify(
      {
        generated_at: first.generated_at,
        cards: [
          ...first.cards,
          { origin: 42, fingerprint: "ignore-me" },
          { origin: "https://alpha.example", fingerprint: 99 },
          null,
        ],
      },
      null,
      2,
    ),
  );

  const fingerprint = welcomeCardFingerprint(
    normalizeWelcomeParticipant(network[0]),
  );
  assert.equal(first.cards[0].fingerprint, fingerprint);

  // Unchanged fingerprint with files present should skip rewrite.
  const skipped = await materializeWelcomeCards(network, root);
  assert.equal(skipped.cards.length, 2);

  const second = await materializeWelcomeCards([network[0]], root);
  assert.equal(second.cards.length, 1);
  assert.equal(second.cards[0].origin, "https://alpha.example");

  const beta = welcomeCardPaths("https://beta.example");
  assert.equal(
    await fs.access(path.join(root, beta.svg.slice(1))).then(
      () => "present",
      () => "missing",
    ),
    "missing",
  );

  await fs.writeFile(
    path.join(root, "_data/welcome_cards.json"),
    JSON.stringify(second, null, 2),
  );
  await fs.unlink(alphaPng);
  const regenerated = await materializeWelcomeCards([network[0]], root);
  assert.equal(regenerated.cards.length, 1);
  assert.equal(
    await fs.access(alphaPng).then(
      () => "present",
      () => "missing",
    ),
    "present",
  );

  const empty = await materializeWelcomeCards(null, root);
  assert.equal(empty.cards.length, 0);

  const withInvalid = await materializeWelcomeCards(
    [{ origin: "not-canonical" }, network[0]],
    root,
  );
  assert.equal(withInvalid.cards.length, 1);

  await fs.writeFile(
    path.join(root, "_data/welcome_cards.json"),
    JSON.stringify({ generated_at: "x" }),
  );
  const noCardsField = await materializeWelcomeCards([network[0]], root);
  assert.equal(noCardsField.cards.length, 1);

  await fs.writeFile(path.join(orphanDir, "notes.txt"), "keep me");
  await materializeWelcomeCards([network[0]], root);
  assert.equal(
    await fs.access(path.join(orphanDir, "notes.txt")).then(
      () => "present",
      () => "missing",
    ),
    "present",
  );
});
