/**
 * Goal: Slot cohorts, details, and names the catalog refuses to guess.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildPeriodRollup } from "../../scripts/uses/aggregate.mjs";
import {
  buildMigrationReport,
  catalogFingerprint,
  classifyClaim,
} from "../../scripts/uses/classify.mjs";
import { extractUsesFromHtml } from "../../scripts/uses/extract.mjs";
import { buildUsesSummary } from "../../scripts/uses/view.mjs";

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

/**
 * @param {object[]} members
 * @param {object} catalog
 * @returns {Promise<object>}
 */
async function rollup(members, catalog) {
  return buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-04T16:00:00.000Z",
    is_complete: true,
    eligible_origins: members.map((member) => member.origin),
    state: { members },
    period_events: [],
    catalog,
  });
}

/**
 * @param {string} origin
 * @param {string} status
 * @param {object[]} tools
 * @returns {object}
 */
function member(origin, status, tools) {
  return {
    origin,
    page_status: status,
    last_valid_observation_at: "2026-11-04T12:00:00.000Z",
    tools: tools.map((tool) => ({
      status: "current",
      use_case_ids: [],
      kind: "product",
      ...tool,
    })),
  };
}

test("editor cohort ignores an assessed page that names no editor", async () => {
  const catalog = await loadCatalog();
  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        { tool_id: "neovim", name: "Neovim" },
        { tool_id: "vim", name: "Vim" },
      ]),
      member("https://profiles.joshua.example", "verified", [
        { tool_id: "neovim", name: "Neovim" },
      ]),
      member("https://other.example", "verified", [
        { tool_id: "zed", name: "Zed" },
      ]),
      member("https://friends.joshua.example", "verified", [
        { tool_id: "visual-studio-code", name: "Visual Studio Code" },
      ]),
      member("https://empty.joshua.example", "verified_empty", []),
    ],
    catalog,
  );
  assert.equal(summary.verified_uses_member_count, 5);
  const editors = summary.slots.find((slot) => slot.id === "editor-ide");
  assert.equal(editors.denominator, 4);
  const neovim = editors.products.find((tool) => tool.tool_id === "neovim");
  assert.equal(neovim.active_member_count, 2);
  assert.equal(neovim.adoption_score, 50);
  const visible = editors.products.filter((tool) =>
    ["neovim", "zed"].includes(tool.tool_id),
  );
  assert.equal(visible.length, 2);
  assert.equal(editors.denominator, 4);
});

test("one site with two editors is one site in the denominator", async () => {
  const catalog = await loadCatalog();
  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        { tool_id: "neovim", name: "Neovim" },
        { tool_id: "vim", name: "Vim" },
      ]),
    ],
    catalog,
  );
  const editors = summary.slots.find((slot) => slot.id === "editor-ide");
  assert.equal(editors.denominator, 1);
  assert.equal(editors.products.length, 2);
  assert.equal(
    editors.products.reduce((sum, tool) => sum + tool.adoption_score, 0) > 100,
    true,
  );
});

test("parts stay with the setup and a nested app stays software", async () => {
  const catalog = await loadCatalog();
  const html = await readFile(
    path.join(root, "test", "fixtures", "uses", "slot-structure.html"),
    "utf8",
  );
  const extracted = extractUsesFromHtml(html);
  const labels = extracted.items.map((item) => item.label);
  assert.ok(labels.includes("Mac mini"));
  assert.ok(labels.includes("32GB DDR5 RAM"));
  assert.ok(labels.includes("1Password"));
  const ram = extracted.items.find((item) => item.label === "32GB DDR5 RAM");
  const app = extracted.items.find((item) => item.label === "1Password");
  assert.ok(ram.list_depth >= 1);
  assert.ok(app.list_depth >= 1);
  assert.match(app.section_path, /Phone/);
  assert.match(app.href, /1password\.com/);

  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        { tool_id: "mac-mini", name: "Mac mini", kind: "product" },
        {
          tool_id: "observed:ram",
          name: "32GB DDR5 RAM",
          kind: "product",
        },
        {
          tool_id: "observed:cpu",
          name: "AMD Ryzen 5 7500X3D",
          kind: "product",
        },
        {
          tool_id: "observed:gpu",
          name: "Radeon graphics card",
          kind: "product",
        },
        {
          tool_id: "code-keyboard",
          name: "CODE Keyboard",
          kind: "product",
        },
        {
          tool_id: "observed:switches",
          name: "Kailh Box switches",
          kind: "product",
        },
        {
          tool_id: "1password",
          name: "1Password",
          kind: "product",
          section: "Phone",
          section_path: "Hardware / Phone",
        },
      ]),
    ],
    catalog,
  );
  assert.equal(
    summary.tools.some((tool) => /ram|ryzen|radeon|kailh/i.test(tool.name)),
    false,
  );
  assert.equal(
    summary.tools.filter((tool) => tool.slot_id === "computer").length,
    1,
  );
  assert.ok(summary.tools.some((tool) => tool.tool_id === "1password"));
  assert.ok(summary.setup.some((item) => item.relation === "component_of"));
});

test("Kindle follows the link and BART is not transit", async () => {
  const catalog = await loadCatalog();
  const app = classifyClaim(
    {
      name: "Kindle",
      href: "https://play.google.com/store/apps/details?id=com.amazon.kindle",
      context: "Kindle",
      kind: "product",
    },
    catalog,
  );
  assert.equal(app.role, "ranked");
  assert.equal(app.slot_id, "reading-app");
  assert.equal(app.tool_id, "kindle-app");

  const bare = classifyClaim(
    { name: "Kindle", context: "Kindle", section: "Software", kind: "product" },
    catalog,
  );
  assert.equal(bare.role, "ranked");
  assert.equal(bare.slot_id, "reading-app");
  assert.equal(bare.tool_id, "kindle");

  const hardware = classifyClaim(
    { name: "Kindle Paperwhite", context: "reading", kind: "product" },
    catalog,
  );
  assert.equal(hardware.role, "ranked");
  assert.equal(hardware.slot_id, "reader-hardware");

  const study = classifyClaim(
    {
      name: "BART",
      context: "BART - For Greek/Hebrew Study",
      section: "Software",
      kind: "product",
    },
    catalog,
  );
  assert.equal(study.role, "ranked");
  assert.equal(study.slot_id, "study-software");

  const transit = classifyClaim(
    { name: "BART", context: "BART train station", kind: "product" },
    catalog,
  );
  assert.equal(transit.role, "unsorted");
});

test("a single reported name still lands in a slot", async () => {
  const catalog = await loadCatalog();
  const samples = [
    ["Python", "Programming Languages", "programming-language"],
    ["Debian", "Software", "operating-system"],
    ["Apple Magic Mouse", "Workstation", "mouse"],
    ["Herman Miller Aeron", "Workstation", "chair"],
    ["Waha", "Software", "reading-app"],
    ["Steam Deck OLED", "Entertainment", "game-console"],
    ["Claude Code", "AI", "coding-agent"],
  ];
  for (const [name, section, slotId] of samples) {
    const classified = classifyClaim(
      { name, section, context: name, kind: "product" },
      catalog,
    );
    assert.equal(classified.role, "ranked", name);
    assert.equal(classified.slot_id, slotId, name);
  }
});

test("a game title stays off the Uses page", async () => {
  const catalog = await loadCatalog();
  const game = classifyClaim(
    { name: "Mario Kart 64", context: "Mario Kart 64", kind: "product" },
    catalog,
  );
  assert.equal(game.role, "rejected");
  assert.equal(game.slot_id, "game");
});

test("Things and Things 3 stay distinct and preference is explicit", async () => {
  const catalog = await loadCatalog();
  const things = classifyClaim(
    {
      name: "Things",
      context: "Cultured Code Things for tasks",
      kind: "product",
    },
    catalog,
  );
  const edition = classifyClaim(
    { name: "Things 3", context: "tasks", kind: "product" },
    catalog,
  );
  const vague = classifyClaim(
    { name: "Things", context: "Things", kind: "product" },
    catalog,
  );
  assert.equal(things.tool_id, "things");
  assert.equal(things.slot_id, "tasks");
  assert.equal(edition.tool_id, "things-3");
  assert.notEqual(things.tool_id, edition.tool_id);
  assert.equal(vague.role, "unsorted");

  const favorite = classifyClaim(
    {
      name: "Neovim",
      context: "Neovim is my favorite editor",
      kind: "product",
    },
    catalog,
  );
  const current = classifyClaim(
    { name: "Neovim", context: "I use Neovim", kind: "product" },
    catalog,
  );
  assert.equal(favorite.preference, true);
  assert.equal(current.preference, false);
});

test("placeholders and dates are rejected", async () => {
  const catalog = await loadCatalog();
  assert.equal(
    classifyClaim({ name: "TODO", kind: "product" }, catalog).role,
    "rejected",
  );
  assert.equal(
    classifyClaim({ name: "Nov 2024", kind: "product" }, catalog).role,
    "rejected",
  );
  assert.equal(
    classifyClaim({ name: "Work Computer", kind: "product" }, catalog).role,
    "rejected",
  );
  assert.equal(
    classifyClaim({ name: "Work Computer:", kind: "product" }, catalog).role,
    "rejected",
  );
  assert.equal(
    classifyClaim({ name: "Gaming Computer:", kind: "product" }, catalog).role,
    "rejected",
  );
});

test("MacBook family lines rank into Computers", async () => {
  const catalog = await loadCatalog();
  const samples = [
    ["2025 MacBook Air M4", "macbook-air"],
    ["MacBook Pro 16-inch 2021", "macbook-pro-16"],
    ['Macbook Pro 14" 2021 M1 Pro for hustle and bustle', "macbook-pro-14"],
    ["macbook pro m2 · 32gb primary workhorse. fans never spin", "macbook-pro"],
    ["MacBook Pro 16-inch, M4 Max, 2024 64GB, Space Black", "macbook-pro-16"],
  ];
  for (const [name, toolId] of samples) {
    const classified = classifyClaim({ name, kind: "product" }, catalog);
    assert.equal(classified.role, "ranked", name);
    assert.equal(classified.slot_id, "computer", name);
    assert.equal(classified.tool_id, toolId, name);
  }
  const memory = classifyClaim(
    { name: "32GB of memory", kind: "product" },
    catalog,
  );
  assert.equal(memory.role, "detail");
  assert.equal(memory.parent_slot, "computer");
});

test("a catalog edit reclassifies the same stored claim", async () => {
  const catalog = await loadCatalog();
  const claim = {
    name: "Zed",
    context: "editor",
    kind: "product",
  };
  assert.equal(classifyClaim(claim, catalog).role, "ranked");
  const retired = {
    ...catalog,
    tools: catalog.tools.map((tool) =>
      tool.id === "zed" ? { ...tool, category_id: "workflow" } : tool,
    ),
  };
  assert.notEqual(catalogFingerprint(catalog), catalogFingerprint(retired));
  assert.equal(classifyClaim(claim, retired).role, "unsorted");
});

test("Cloudflare at the edge is one slot", async () => {
  const catalog = await loadCatalog();
  const edge = classifyClaim(
    {
      name: "Cloudflare",
      context: "Where a lot of my sites live now, at the edge.",
      kind: "product",
    },
    catalog,
  );
  assert.equal(edge.slot_id, "edge-cdn");
  const dns = classifyClaim(
    {
      name: "Cloudflare",
      context: "Cloudflare DNS for the domain",
      kind: "product",
    },
    catalog,
  );
  assert.equal(dns.slot_id, "dns");
});

test("unlike gear does not share a slot", async () => {
  const catalog = await loadCatalog();
  const samples = [
    ["Focusrite Scarlett", "audio-interface", "focusrite-scarlett"],
    ["UA Volt 1", "audio-interface", "ua-volt-1"],
    ["M-Audio MIDI interface", "midi-interface", "maudio-midi"],
    ["TinHiFi T2 Plus", "in-ear-monitor", "tinhifi-t2"],
    ["TinHIFI T2 Plus IEM", "in-ear-monitor", "tinhifi-t2"],
    ["IKEA REGOLIT shade", "lampshade", "ikea-regolit"],
    ["Osaurus", "local-model", "osaurus"],
    ["Claude", "ai-assistant", "claude"],
    ["ChatGPT", "ai-assistant", "chatgpt"],
    ["Sony WH-1000XM2", "headphones", "sony-wh1000xm2"],
    ["Massdrop x Sennheiser HD 6XX", "headphones", "hd-6xx"],
    ["High-output LED light", "lighting", "led-light"],
    ["Mac mini (M4 Pro, 24GB RAM)", "computer", "mac-mini"],
  ];
  for (const [name, slotId, toolId] of samples) {
    const classified = classifyClaim(
      { name, context: name, kind: "product" },
      catalog,
    );
    assert.equal(classified.role, "ranked", name);
    assert.equal(classified.slot_id, slotId, name);
    assert.equal(classified.tool_id, toolId, name);
    assert.equal(Array.isArray(classified), false, name);
  }

  const stored = 'Mac Mini ASUS 24"';
  const oneSlot = classifyClaim(
    { name: stored, context: stored, kind: "product" },
    catalog,
  );
  assert.equal(Array.isArray(oneSlot), false);
  assert.equal(oneSlot.tool_id, null);

  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        { tool_id: "observed:mac-mini-asus-24", name: stored },
        { tool_id: "dell-38", name: 'Dell 38" Ultrawide' },
        { tool_id: "mac-mini", name: "Mac mini (M4 Pro, 24GB RAM)" },
      ]),
    ],
    catalog,
  );
  const computers = summary.slots.find((slot) => slot.id === "computer");
  const displays = summary.slots.find((slot) => slot.id === "display");
  assert.ok(computers.products.some((tool) => tool.tool_id === "mac-mini"));
  assert.equal(
    computers.products.some((tool) => tool.name === stored),
    false,
  );
  assert.equal(
    computers.products.some((tool) => tool.tool_id === "mac-mini-asus-24"),
    false,
  );
  assert.equal(
    displays.products.some((tool) => tool.tool_id === "asus-24"),
    true,
  );
  assert.equal(
    displays.products.find((tool) => tool.tool_id === "asus-24").name,
    'ASUS 24"',
  );
  assert.equal(
    summary.tools.some(
      (tool) => tool.name === stored || tool.tool_id === "mac-mini-asus-24",
    ),
    false,
  );
  assert.equal(computers.products.length, 1);
});

test("summary copies a catalog website and drops a store url", async () => {
  const catalog = await loadCatalog();
  const patched = {
    ...catalog,
    tools: catalog.tools.map((tool) => {
      if (tool.id === "vim") {
        return { ...tool, website: "https://www.amazon.com/vim" };
      }
      if (tool.id === "zed") {
        return {
          ...tool,
          website: "https://play.google.com/store/apps/details?id=dev.zed.Zed",
        };
      }
      return tool;
    }),
  };
  const period = await rollup(
    [
      member("https://joshua.example", "verified", [
        { tool_id: "neovim", name: "Neovim" },
        { tool_id: "vim", name: "Vim" },
        { tool_id: "zed", name: "Zed" },
      ]),
    ],
    patched,
  );
  const summary = buildUsesSummary({
    rollup: period,
    catalog: patched,
    as_of: "2026-11-04T16:00:00.000Z",
    eligible_member_count: 1,
    verified_uses_member_count: period.verified_uses_member_count,
    members: [
      {
        origin: "https://joshua.example",
        page_url: "https://joshua.example/uses/",
        page_status: "verified",
        accepted_count: 3,
      },
    ],
  });
  const editors = summary.slots.find((slot) => slot.id === "editor-ide");
  const neovim = editors.products.find((tool) => tool.tool_id === "neovim");
  const vim = editors.products.find((tool) => tool.tool_id === "vim");
  const zed = editors.products.find((tool) => tool.tool_id === "zed");
  const neovimCatalog = patched.tools.find((tool) => tool.id === "neovim");
  assert.equal(neovim.website, neovimCatalog.website);
  assert.equal(vim.website, "");
  assert.equal(zed.website, "");
  assert.equal(JSON.stringify(editors).includes("amazon.com"), false);
  assert.equal(JSON.stringify(editors).includes("play.google.com"), false);
});

test("migration report keeps unresolved names out of the ranking", async () => {
  const catalog = await loadCatalog();
  const report = buildMigrationReport(
    [
      member("https://joshua.example", "verified", [
        { tool_id: "observed:neovim", name: "Neovim" },
        { tool_id: "observed:todo", name: "TODO" },
        { tool_id: "observed:ram", name: "32GB DDR5 RAM" },
        { tool_id: "observed:mystery", name: "DeskThing" },
      ]),
    ],
    catalog,
  );
  assert.equal(report.slot_assignments[0].tool_id, "neovim");
  assert.equal(report.rejected_fragments[0].name, "TODO");
  assert.equal(report.moved_to_detail[0].name, "32GB DDR5 RAM");
  assert.equal(report.unsorted[0].name, "DeskThing");
  assert.equal(report.merged_identities[0].stored_id, "observed:neovim");
});
