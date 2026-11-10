/**
 * Goal: 3D printer facts from crawl fixture HTML via the observation harness.
 * Also covers outline-prose and h-product brand peels used when microformats vary.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runUsesFixturePipeline } from "../../scripts/observation/harness.mjs";
import {
  buildPeriodRollup,
  peel3dPrintersFromContext,
} from "../../scripts/uses/aggregate.mjs";
import { classifyClaim } from "../../scripts/uses/classify.mjs";
import { extractUsesFromHtml } from "../../scripts/uses/extract.mjs";
import {
  is3dPrinterUmbrellaLabel,
  quantityNearLabel,
} from "../../scripts/uses/normalize.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * @returns {Promise<object>}
 */
async function loadCatalog() {
  const base = path.join(root, "data", "uses", "catalog");
  const tools = JSON.parse(
    await readFile(path.join(base, "tools.json"), "utf8"),
  );
  const aliases = JSON.parse(
    await readFile(path.join(base, "aliases.json"), "utf8"),
  );
  const categories = JSON.parse(
    await readFile(path.join(base, "categories.json"), "utf8"),
  );
  return {
    tools: tools.tools,
    aliases: aliases.aliases,
    categories: categories.categories,
  };
}

test("quantityNearLabel reads stated machine counts", () => {
  assert.equal(
    quantityNearLabel(
      "I also have three FLSUN QQ-S Pro delta printers",
      "FLSUN QQ-S Pro",
    ),
    3,
  );
  assert.equal(
    quantityNearLabel("I have a Creality K1 Max", "Creality K1 Max"),
    1,
  );
  assert.equal(quantityNearLabel("", "Creality K1 Max"), 1);
  assert.equal(quantityNearLabel("I have printers", ""), 1);
  assert.equal(
    quantityNearLabel(
      "I also have 3 Creality K1 Max printers",
      "Creality K1 Max",
    ),
    3,
  );
  assert.equal(
    quantityNearLabel(
      "I also have 0 Creality K1 Max printers",
      "Creality K1 Max",
    ),
    1,
  );
  assert.equal(is3dPrinterUmbrellaLabel("3D printers"), true);
  assert.equal(is3dPrinterUmbrellaLabel("Creality K1 Max"), false);
});

test("Creality and FLSUN printers rank as FDM", async () => {
  const catalog = await loadCatalog();
  for (const [name, toolId] of [
    ["Creality K1 Max", "creality-k1-max"],
    ["Creality CR-10 Mini", "creality-cr-10-mini"],
    ["Creality CR-10S", "creality-cr-10s"],
    ["FLSUN QQ-S Pro", "flsun-qq-s-pro"],
    ["Ender 3 v2", "creality-ender-3-v2"],
  ]) {
    const classified = classifyClaim({ name, kind: "product" }, catalog);
    assert.equal(classified.role, "ranked", name);
    assert.equal(classified.slot_id, "3d-printer-fdm", name);
    assert.equal(classified.tool_id, toolId, name);
  }
});

test("joshuamorris.info crawl yields FDM printers with QQ-S quantity", async () => {
  const catalog = await loadCatalog();
  const workRoot = await mkdtemp(path.join(os.tmpdir(), "josh-printers-"));
  try {
    const pipeline = await runUsesFixturePipeline({
      workRoot,
      repoRoot: root,
      origin: "https://joshuamorris.info",
      uses_url: "https://joshuamorris.info/uses/",
      fixture_file: "test/fixtures/uses/members/joshuamorris.info.html",
      catalog,
    });
    const labels = pipeline.extracted.items.map((item) => item.label);
    assert.ok(labels.includes("Creality K1 Max"));
    assert.ok(labels.includes("Creality CR-10 Mini"));
    assert.ok(labels.includes("Creality CR-10S"));
    assert.ok(labels.includes("FLSUN QQ-S Pro"));
    assert.equal(labels.includes("3D printers"), false);
    const flsun = pipeline.extracted.items.find(
      (item) => item.label === "FLSUN QQ-S Pro",
    );
    assert.equal(flsun?.quantity, 3);

    const slot = pipeline.summary.slots.find(
      (row) => row.id === "3d-printer-fdm",
    );
    assert.ok(slot);
    assert.equal(slot.count_basis, "units");
    const byId = new Map(slot.products.map((tool) => [tool.tool_id, tool]));
    assert.equal(byId.get("creality-k1-max")?.active_member_count, 1);
    assert.equal(byId.get("creality-cr-10-mini")?.active_member_count, 1);
    assert.equal(byId.get("creality-cr-10s")?.active_member_count, 1);
    assert.equal(byId.get("flsun-qq-s-pro")?.active_member_count, 3);
    assert.equal(
      pipeline.summary.unsorted.some((row) => /3d printers/i.test(row.name)),
      false,
    );
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test("joshmuller.ca crawl yields Ender 3 v2 as FDM", async () => {
  const catalog = await loadCatalog();
  const workRoot = await mkdtemp(path.join(os.tmpdir(), "josh-joshmuller-"));
  try {
    const pipeline = await runUsesFixturePipeline({
      workRoot,
      repoRoot: root,
      origin: "https://joshmuller.ca",
      uses_url: "https://joshmuller.ca/uses/",
      fixture_file: "test/fixtures/uses/members/joshmuller.ca.html",
      catalog,
    });
    const ender = pipeline.extracted.items.find((item) =>
      /ender\s*3\s*v2/i.test(item.label),
    );
    assert.ok(ender, "extract should find Ender 3 v2");
    assert.equal(
      classifyClaim({ name: ender.label, kind: "product" }, catalog).tool_id,
      "creality-ender-3-v2",
    );
    const slot = pipeline.summary.slots.find(
      (row) => row.id === "3d-printer-fdm",
    );
    assert.ok(
      slot?.products.some((tool) => tool.tool_id === "creality-ender-3-v2"),
    );
    assert.equal(
      slot.products.find((tool) => tool.tool_id === "creality-ender-3-v2")
        ?.active_member_count,
      1,
    );
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test("umbrella heading peels named printers from outline prose", () => {
  const html = `<!doctype html><html><body>
    <h2>3D printers</h2>
    <p>Creality Ender 3 V2 plus a Creality K1 Max and three FLSUN QQ-S Pro printers.
    Creality CR-10 Mini and Creality CR-10S stay for larger beds.</p>
  </body></html>`;
  const extracted = extractUsesFromHtml(html, {
    origin: "https://printers.example",
    url: "https://printers.example/uses/",
  });
  const labels = extracted.items.map((item) => item.label);
  assert.ok(labels.includes("Creality K1 Max"));
  assert.ok(labels.includes("FLSUN QQ-S Pro"));
  assert.ok(labels.includes("Creality CR-10 Mini"));
  assert.equal(
    labels.filter((label) => label === "Creality Ender 3 V2").length,
    1,
  );
  assert.equal(labels.includes("3D printers"), false);
  const flsun = extracted.items.find((item) => item.label === "FLSUN QQ-S Pro");
  assert.equal(flsun?.quantity, 3);

  const single = extractUsesFromHtml(
    `<!doctype html><html><body>
      <h2>3D printers</h2>
      <p>Only a Creality K1 Max on this desk.</p>
    </body></html>`,
    {
      origin: "https://printers.example",
      url: "https://printers.example/uses/",
    },
  );
  assert.deepEqual(
    single.items.map((item) => item.label),
    ["Creality K1 Max"],
  );
});

test("h-product brand prefixes a bare product name under 3D printers", () => {
  const html = `<!doctype html><html><body>
    <section>
      <h2>3D printers</h2>
      <div class="h-product">
        <span class="p-brand">Creality</span>
        <a class="p-name" href="https://www.creality.com/k1-max">K1 Max</a>
      </div>
      <div class="h-product">
        <span class="p-brand">FLSUN</span>
      </div>
      <div class="h-product">
        <span class="p-name">and</span>
      </div>
      <div class="h-product">
        <a class="p-name" href="#k1-max-fragment">K1 Max</a>
      </div>
    </section>
  </body></html>`;
  const extracted = extractUsesFromHtml(html, {
    origin: "https://printers.example",
    url: "https://printers.example/uses/",
  });
  const labels = extracted.items.map((item) => item.label);
  assert.ok(labels.includes("Creality K1 Max"));
  assert.ok(labels.includes("FLSUN"));
  assert.equal(labels.includes("and"), false);
  const fragment = extracted.items.find((item) => item.label === "K1 Max");
  assert.equal(fragment?.href, "");
});

test("peel3dPrintersFromContext skips retired, short, and non-printer rows", async () => {
  const catalog = await loadCatalog();
  const hits = peel3dPrintersFromContext(
    "3D printers",
    "Creality K1 Max on the bench",
    catalog,
    { section: "3D printers" },
  );
  assert.ok(hits.some((hit) => hit.classified.tool_id === "creality-k1-max"));

  const edgeCatalog = {
    tools: [
      null,
      {
        id: "retired-k1",
        name: "Retired Printer",
        category_id: "3d-printer-fdm",
        retired: true,
      },
      {
        id: "tiny",
        name: "XY",
        category_id: "3d-printer-fdm",
        aliases: ["ab", null],
      },
      {
        id: "neovim",
        name: "Neovim",
        category_id: "editor-ide",
      },
      {
        id: "no-alias-machine",
        name: "Solo Frame Printer",
        category_id: "3d-printer-fdm",
      },
      {
        id: "alias-only",
        name: "",
        category_id: "3d-printer-fdm",
        aliases: ["Unique Alias Printer"],
      },
      {
        id: "no-category",
        name: "Orphan Printer",
        category_id: null,
      },
      {
        id: "todo-printer",
        name: "TODO",
        category_id: "3d-printer-fdm",
        aliases: ["todo benchy farm"],
      },
      ...catalog.tools,
    ],
    categories: catalog.categories,
    aliases: catalog.aliases || [],
  };
  const edged = peel3dPrintersFromContext(
    "3D printers",
    "Creality K1 Max and a todo benchy farm and Unique Alias Printer and Solo Frame Printer",
    edgeCatalog,
  );
  assert.ok(edged.some((hit) => hit.classified.tool_id === "creality-k1-max"));
  assert.equal(
    edged.some((hit) => hit.classified.tool_id === "todo-printer"),
    false,
  );

  assert.deepEqual(
    peel3dPrintersFromContext("3D printers", "Creality K1 Max", {}),
    [],
  );
  assert.deepEqual(
    peel3dPrintersFromContext("3D printers", "Creality K1 Max", {
      tools: undefined,
    }),
    [],
  );
  assert.deepEqual(
    peel3dPrintersFromContext("3D printers", "   ", { tools: [] }),
    [],
  );
  assert.deepEqual(
    peel3dPrintersFromContext("desk lamp", "Creality K1 Max", catalog),
    [],
  );
});

test("rollup peels umbrella 3D printer rows from context", async () => {
  const catalog = await loadCatalog();
  const fdm = catalog.categories.find((row) => row.id === "3d-printer-fdm") || {
    id: "3d-printer-fdm",
    name: "FDM",
    role: "ranked",
    scope: "Fused deposition printers.",
  };
  const rollup = await buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-15T00:00:00.000Z",
    is_complete: true,
    eligible_origins: ["https://printers.example"],
    state: {
      members: [
        {
          origin: "https://printers.example",
          page_status: "verified",
          last_valid_observation_at: "2026-11-02T00:00:00.000Z",
          tools: [
            {
              tool_id: "observed:3d-printing",
              name: "",
              section: "3D printers",
              status: "current",
              context:
                "Creality K1 Max on the desk and three FLSUN QQ-S Pro in the shop",
              use_case_ids: [],
            },
            {
              tool_id: "observed:printers-heading",
              name: "3D printers",
              section: "Hardware",
              status: "current",
              context:
                "Creality CR-10 Mini for big parts and a todo benchy farm nearby",
              use_case_ids: [],
            },
          ],
        },
      ],
    },
    period_events: [],
    catalog: {
      tools: [
        ...catalog.tools.filter((tool) =>
          String(tool.category_id || "").startsWith("3d-printer"),
        ),
        {
          id: "retired-k1",
          name: "Creality K1 Max",
          category_id: "3d-printer-fdm",
          aliases: ["Retired K1"],
          retired: true,
        },
        {
          id: "tiny-alias",
          name: "XY",
          category_id: "3d-printer-fdm",
          aliases: ["ab"],
        },
        {
          id: "neovim",
          name: "Neovim",
          category_id: "editor-ide",
          aliases: [],
        },
        {
          id: "ambiguous-printer",
          name: "TODO",
          category_id: "3d-printer-fdm",
          aliases: ["todo benchy farm"],
        },
      ],
      categories: [
        fdm,
        {
          id: "editor-ide",
          name: "Editors",
          role: "ranked",
          scope: "Editors.",
        },
      ],
      aliases: catalog.aliases || [],
    },
  });
  assert.ok(
    rollup.tools.some((tool) => tool.tool_id === "creality-k1-max"),
    "empty-name observed:3d-printing peels K1 Max",
  );
  assert.ok(
    rollup.tools.some((tool) => tool.tool_id === "flsun-qq-s-pro"),
    "empty-name observed:3d-printing peels FLSUN",
  );
  assert.ok(
    rollup.tools.some((tool) => tool.tool_id === "creality-cr-10-mini"),
    "named 3D printers heading peels CR-10 Mini",
  );
  assert.equal(
    rollup.unsorted.some((row) => /3d printers/i.test(row.name)),
    false,
    "umbrella heading that peels ranked machines stays out of Unsorted",
  );
});
