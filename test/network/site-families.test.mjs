/**
 * Goal: Exhaust site-family helpers with synthetic origins only. Cover edge
 * branches (invalid docs, empty fields, demotion, remap) without locking live
 * participant catalogs or nav copy.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  applySiteFamilies,
  assertValidSiteFamilies,
  destinationOriginsFromEntry,
  isNetworkEntryPromoted,
  promoteNetworkOrigin,
  secondaryToPrimaryFromNetwork,
  secondaryToPrimaryMap,
  siteFamiliesFromDocument,
} from "../../scripts/network/site-families.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} origin
 * @param {{ title?: string, domain?: string }} [fields]
 * @returns {Record<string, unknown>}
 */
function entry(origin, fields = {}) {
  let domain = fields.domain;
  if (!domain) {
    try {
      domain = new URL(origin).host;
    } catch {
      domain = "";
    }
  }
  return {
    origin,
    domain,
    title: fields.title ?? domain,
  };
}

test("isNetworkEntryPromoted treats missing promoted as true", () => {
  assert.equal(isNetworkEntryPromoted(null), false);
  assert.equal(isNetworkEntryPromoted(undefined), false);
  assert.equal(isNetworkEntryPromoted("nope"), false);
  assert.equal(isNetworkEntryPromoted({}), true);
  assert.equal(isNetworkEntryPromoted({ promoted: true }), true);
  assert.equal(isNetworkEntryPromoted({ promoted: false }), false);
});

test("siteFamiliesFromDocument ignores invalid and empty rows", () => {
  assert.deepEqual(siteFamiliesFromDocument(null), []);
  assert.deepEqual(siteFamiliesFromDocument([]), []);
  assert.deepEqual(siteFamiliesFromDocument({}), []);
  assert.deepEqual(siteFamiliesFromDocument({ families: null }), []);
  assert.deepEqual(
    siteFamiliesFromDocument({
      families: [
        null,
        "skip",
        [],
        { primary: "", destinations: ["https://secondary.example"] },
        { primary: "https://primary.example", destinations: "nope" },
        {
          primary: "https://primary.example",
          destinations: ["https://primary.example", "  "],
        },
        {
          primary: "https://primary.example",
          destinations: [
            "https://secondary.example",
            "https://secondary.example",
          ],
        },
      ],
    }),
    [
      {
        primary: "https://primary.example",
        destinations: ["https://secondary.example"],
      },
    ],
  );
});

test("assertValidSiteFamilies rejects unknown primary and destination equals primary", () => {
  assert.throws(
    () =>
      assertValidSiteFamilies(
        [
          {
            primary: "https://missing.example",
            destinations: ["https://secondary.example"],
          },
        ],
        ["https://secondary.example"],
      ),
    /primary .+ is not a current participant/,
  );

  assert.throws(
    () =>
      assertValidSiteFamilies(
        [
          {
            primary: "https://primary.example",
            destinations: ["https://primary.example"],
          },
        ],
        ["https://primary.example"],
      ),
    /cannot equal its primary/,
  );

  assert.throws(
    () =>
      assertValidSiteFamilies(
        [
          {
            primary: "https://a.example",
            destinations: ["https://b.example"],
          },
          {
            primary: "https://a.example",
            destinations: ["https://c.example"],
          },
        ],
        ["https://a.example", "https://b.example", "https://c.example"],
      ),
    /appears in more than one family/,
  );
});

test("applySiteFamilies projects destinations and demotes secondaries", () => {
  const entries = [
    entry("https://primary.example", { title: "Primary" }),
    entry("https://blog.example", { title: "Blog" }),
    entry("https://shop.example", { title: "Shop" }),
    entry("https://other.example", { title: "Other" }),
    null,
    { domain: "orphan.example" },
  ];

  applySiteFamilies(entries, {
    format_version: 1,
    families: [
      {
        primary: "https://primary.example",
        destinations: ["https://blog.example", "https://shop.example"],
      },
    ],
  });

  const primary = entries.find(
    (row) => row && row.origin === "https://primary.example",
  );
  const blog = entries.find(
    (row) => row && row.origin === "https://blog.example",
  );
  const other = entries.find(
    (row) => row && row.origin === "https://other.example",
  );

  assert.deepEqual(primary?.destinations, [
    {
      origin: "https://blog.example",
      domain: "blog.example",
      title: "Blog",
    },
    {
      origin: "https://shop.example",
      domain: "shop.example",
      title: "Shop",
    },
  ]);
  assert.equal(blog?.promoted, false);
  assert.equal(other?.promoted, undefined);
  assert.equal(isNetworkEntryPromoted(primary), true);
  assert.equal(isNetworkEntryPromoted(blog), false);
});

test("applySiteFamilies falls back domain and title when missing", () => {
  const entries = [
    { origin: "https://primary.example", domain: "", title: "" },
    { origin: "https://secondary.example", domain: "", title: "" },
    { origin: "not-a-url", domain: "", title: "" },
    { origin: "   ", domain: "blank.example", title: "Blank" },
  ];

  applySiteFamilies(entries, {
    families: [
      {
        primary: "https://primary.example",
        destinations: ["https://secondary.example", "not-a-url"],
      },
    ],
  });

  assert.deepEqual(entries[0].destinations, [
    {
      origin: "https://secondary.example",
      domain: "secondary.example",
      title: "secondary.example",
    },
    {
      origin: "not-a-url",
      domain: "not-a-url",
      title: "not-a-url",
    },
  ]);
  assert.equal(entries[1].promoted, false);
  assert.equal(entries[2].promoted, false);
});

test("applySiteFamilies is idempotent and clears stale projection", () => {
  const entries = [
    entry("https://primary.example"),
    entry("https://secondary.example"),
  ];
  const families = {
    format_version: 1,
    families: [
      {
        primary: "https://primary.example",
        destinations: ["https://secondary.example"],
      },
    ],
  };

  applySiteFamilies(entries, families);
  applySiteFamilies(entries, families);
  assert.equal(
    /** @type {{ destinations?: unknown[] }} */ (entries[0]).destinations
      ?.length,
    1,
  );

  applySiteFamilies(entries, { format_version: 1, families: [] });
  assert.equal(entries[0].destinations, undefined);
  assert.equal(entries[1].promoted, undefined);

  assert.deepEqual(applySiteFamilies(null, { families: [] }), []);
  assert.throws(
    () => applySiteFamilies([], families),
    /not a current participant/,
  );
});

test("applySiteFamilies rejects unknown and overlapping origins", () => {
  assert.throws(
    () =>
      applySiteFamilies([entry("https://primary.example")], {
        families: [
          {
            primary: "https://primary.example",
            destinations: ["https://missing.example"],
          },
        ],
      }),
    /not a current participant/,
  );

  assert.throws(
    () =>
      applySiteFamilies(
        [
          entry("https://a.example"),
          entry("https://b.example"),
          entry("https://c.example"),
        ],
        {
          families: [
            {
              primary: "https://a.example",
              destinations: ["https://b.example"],
            },
            {
              primary: "https://c.example",
              destinations: ["https://b.example"],
            },
          ],
        },
      ),
    /more than one family/,
  );
});

test("destinationOriginsFromEntry skips invalid destinations", () => {
  assert.deepEqual(destinationOriginsFromEntry(null), []);
  assert.deepEqual(destinationOriginsFromEntry({}), []);
  assert.deepEqual(destinationOriginsFromEntry({ destinations: "nope" }), []);
  assert.deepEqual(
    destinationOriginsFromEntry({
      destinations: [
        null,
        "skip",
        { origin: "" },
        {},
        { origin: "https://secondary.example" },
      ],
    }),
    ["https://secondary.example"],
  );
});

test("secondaryToPrimary helpers remap and skip bad rows", () => {
  assert.equal(promoteNetworkOrigin("", new Map()), "");
  assert.equal(promoteNetworkOrigin("   ", new Map()), "");

  const families = siteFamiliesFromDocument({
    families: [
      {
        primary: "https://primary.example",
        destinations: ["https://secondary.example"],
      },
    ],
  });
  const map = secondaryToPrimaryMap(families);
  assert.equal(
    promoteNetworkOrigin("https://secondary.example", map),
    "https://primary.example",
  );
  assert.equal(
    promoteNetworkOrigin("https://primary.example", map),
    "https://primary.example",
  );

  const fromNetwork = secondaryToPrimaryFromNetwork([
    null,
    { origin: "" },
    { origin: "https://primary.example" },
    {
      origin: "https://primary.example",
      destinations: [
        null,
        "skip",
        { origin: "" },
        { origin: "https://secondary.example" },
      ],
    },
  ]);
  assert.equal(
    fromNetwork.get("https://secondary.example"),
    "https://primary.example",
  );
  assert.equal(secondaryToPrimaryFromNetwork(null).size, 0);
});

test("network sync wires applySiteFamilies before writing network.json", async () => {
  const syncSource = await readFile(
    path.join(root, "scripts/network/sync.mjs"),
    "utf8",
  );

  assert.match(
    syncSource,
    /applySiteFamilies\(nextEntries,\s*siteFamiliesDoc\)/,
  );
  assert.match(syncSource, /DEFAULT_SITE_FAMILIES_PATH/);
  assert.match(
    syncSource,
    /buildJoshternetOpml\(\s*nextEntries\.filter\(\(entry\) => isNetworkEntryPromoted\(entry\)\)/,
  );
});

test("curated families file stays parseable without locking member brands", async () => {
  const doc = JSON.parse(
    await readFile(path.join(root, "_data/network_site_families.json"), "utf8"),
  );
  const families = siteFamiliesFromDocument(doc);
  assert.ok(Array.isArray(families));
  for (const family of families) {
    assert.ok(family.primary.startsWith("https://"));
    assert.ok(family.destinations.length > 0);
  }
});
