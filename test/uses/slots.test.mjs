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
  sectionSlotId,
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
  assert.equal(study.role, "detail");
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

test("Logitech MX Master mice rank into Mice", async () => {
  const catalog = await loadCatalog();
  const samples = [
    ["Logitech MX Master 2S", "mx-master-2s"],
    ["MX Master 2S", "mx-master-2s"],
    ["3S mice", "mx-master-3s"],
    ["Logitech MX Master 3S", "mx-master-3s"],
    ["MX Master 3S", "mx-master-3s"],
  ];
  for (const [name, toolId] of samples) {
    const classified = classifyClaim({ name, kind: "product" }, catalog);
    assert.equal(classified.role, "ranked", name);
    assert.equal(classified.slot_id, "mouse", name);
    assert.equal(classified.tool_id, toolId, name);
  }
});

test("Linux MacOS and Windows rank into Operating systems", async () => {
  const catalog = await loadCatalog();
  const samples = [
    ["Linux 🐧", "linux"],
    ["Linux", "linux"],
    ["MacOS 🍎", "macos"],
    ["macOS", "macos"],
    ["Windows 🪟", "windows"],
    ["Windows", "windows"],
  ];
  for (const [name, toolId] of samples) {
    const classified = classifyClaim({ name, kind: "product" }, catalog);
    assert.equal(classified.role, "ranked", name);
    assert.equal(classified.slot_id, "operating-system", name);
    assert.equal(classified.tool_id, toolId, name);
  }
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
    ["mac mini m4", "computer", "mac-mini"],
    ["Mac mini M4", "computer", "mac-mini"],
    ["M4 Mac mini", "computer", "mac-mini"],
    ["Apple Mac mini M4", "computer", "mac-mini"],
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

test("Mac Mini keyboard mouse mashup peels into four ranked choices", async () => {
  const catalog = await loadCatalog();
  const mashup = 'Mac Mini ASUS 24" Apple Magic Keyboard Logitech MX Ergo';
  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        { tool_id: "observed:mac-mini-mashup", name: mashup },
      ]),
    ],
    catalog,
  );
  const computers = summary.slots.find((slot) => slot.id === "computer");
  const displays = summary.slots.find((slot) => slot.id === "display");
  const keyboards = summary.slots.find((slot) => slot.id === "keyboard");
  const mice = summary.slots.find((slot) => slot.id === "mouse");
  assert.ok(computers.products.some((tool) => tool.tool_id === "mac-mini"));
  assert.ok(displays.products.some((tool) => tool.tool_id === "asus-24"));
  assert.ok(
    keyboards.products.some((tool) => tool.tool_id === "apple-magic-keyboard"),
  );
  assert.ok(mice.products.some((tool) => tool.tool_id === "logitech-mx-ergo"));
  assert.equal(
    summary.tools.some((tool) => tool.name === mashup),
    false,
  );
});

test("IDE prose and phone mashup land in the right slots", async () => {
  const catalog = await loadCatalog();
  assert.equal(
    classifyClaim(
      { name: "Fira Code", section: "IDE", kind: "product" },
      catalog,
    ).slot_id,
    "font",
  );
  assert.equal(
    classifyClaim(
      { name: "GitHub Copilot", section: "IDE", kind: "product" },
      catalog,
    ).slot_id,
    "ai-assistant",
  );

  const mashup = "Samsung S9+ QCY Earbuds";
  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        { tool_id: "observed:plugins", name: "Plugins" },
        {
          tool_id: "observed:copilot-prose",
          name: "And yes, I have GitHub Copilot, it's…occasionally useful",
        },
        { tool_id: "observed:samsung-s9-qcy", name: mashup },
        { tool_id: "fira-code", name: "Fira Code" },
        { tool_id: "github-copilot", name: "GitHub Copilot" },
      ]),
    ],
    catalog,
  );
  const phones = summary.slots.find((slot) => slot.id === "phone");
  const earbuds = summary.slots.find((slot) => slot.id === "in-ear-monitor");
  const fonts = summary.slots.find((slot) => slot.id === "font");
  const assistants = summary.slots.find((slot) => slot.id === "ai-assistant");
  const editors = summary.slots.find((slot) => slot.id === "editor-ide");
  assert.ok(phones.products.some((tool) => tool.tool_id === "samsung-s9-plus"));
  assert.ok(earbuds.products.some((tool) => tool.tool_id === "qcy-earbuds"));
  assert.ok(fonts.products.some((tool) => tool.tool_id === "fira-code"));
  assert.ok(
    assistants.products.some((tool) => tool.tool_id === "github-copilot"),
  );
  assert.equal(
    phones.products.some((tool) => /qcy/i.test(tool.name)),
    false,
  );
  assert.equal(
    summary.tools.some((tool) => tool.name === mashup),
    false,
  );
  assert.equal(
    summary.tools.some((tool) => /^plugins$/i.test(tool.name)),
    false,
  );
  assert.equal(
    Boolean(
      editors?.products.some((tool) => /plugins|copilot|fira/i.test(tool.name)),
    ),
    false,
  );
});

test("legacy IDE section prose does not rank as Editors", async () => {
  const catalog = await loadCatalog();
  assert.equal(
    classifyClaim(
      {
        name: "And yes, I have GitHub Copilot, it's...occasionally useful",
        section: "IDE",
        kind: "product",
      },
      catalog,
    ).role,
    "rejected",
  );
  assert.equal(
    classifyClaim({ name: "Plugins", section: "IDE", kind: "product" }, catalog)
      .role,
    "rejected",
  );
  assert.equal(
    classifyClaim(
      { name: "My font is Fira Code", section: "IDE", kind: "product" },
      catalog,
    ).role,
    "rejected",
  );

  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        {
          tool_id: "observed:copilot-aside",
          name: "And yes, I have GitHub Copilot, it's...occasionally useful",
          section: "IDE",
          section_path: "IDE",
        },
        {
          tool_id: "observed:plugins",
          name: "Plugins",
          section: "IDE",
          section_path: "IDE",
        },
        {
          tool_id: "observed:my-font",
          name: "My font is Fira Code",
          section: "IDE",
          section_path: "IDE",
        },
      ]),
    ],
    catalog,
  );
  const editors = summary.slots.find((slot) => slot.id === "editor-ide");
  assert.equal(Boolean(editors?.products?.length), false);
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "ai-assistant")
      ?.products.some((tool) => tool.tool_id === "github-copilot"),
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "font")
      ?.products.some((tool) => tool.tool_id === "fira-code"),
  );
});

test("product shape beats workstation section for chairs trackpads tablets phones displays", async () => {
  const catalog = await loadCatalog();
  const cases = [
    ["Herman Miller Aeron Chair", "Workstation", "chair", "aeron"],
    ["Apple Magic Trackpad", "Computers", "mouse", "apple-magic-trackpad"],
    ["iPad Air 4", "Hardware", "tablet", "ipad-air-4"],
    ["iPhone 13 mini", "Workstation", "phone", "iphone-13-mini"],
    [
      "iphone 17 pro main camera most of my holiday pics",
      "Hardware",
      "phone",
      "iphone-17-pro",
    ],
    ['dell s3425dw 34"', "Hardware", "display", "dell-s3425dw"],
    ['Samsung 55" TV (Monitor)', "Computers", "display", "samsung-55-tv"],
    ["Lose It!", "Apps", "health-fitness", "lose-it"],
  ];
  for (const [name, section, slotId, toolId] of cases) {
    const classified = classifyClaim(
      { name, section, kind: "product" },
      catalog,
    );
    assert.equal(classified.slot_id, slotId, name);
    assert.equal(classified.tool_id, toolId, name);
    assert.equal(classified.role, "ranked", name);
  }

  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        {
          tool_id: "observed:herman-miller-aeron-chair",
          name: "Herman Miller Aeron Chair",
          section: "Workstation",
          section_path: "Workstation",
        },
        {
          tool_id: "observed:apple-magic-trackpad",
          name: "Apple Magic Trackpad",
          section: "Computers",
          section_path: "Computers",
        },
        {
          tool_id: "observed:ipad-air-4",
          name: "iPad Air 4",
          section: "Hardware",
          section_path: "Hardware",
        },
        {
          tool_id: "observed:iphone-13-mini",
          name: "iPhone 13 mini",
          section: "Workstation",
          section_path: "Workstation",
        },
        {
          tool_id: "observed:samsung-55-tv-monitor",
          name: 'Samsung 55" TV (Monitor)',
          section: "Computers",
          section_path: "Computers",
        },
        {
          tool_id: "lose-it",
          name: "Lose It!",
          section: "Apps",
          section_path: "Apps",
        },
        {
          tool_id: "mac-mini",
          name: "Mac mini",
          section: "Computers",
          section_path: "Computers",
        },
      ]),
    ],
    catalog,
  );
  const computers = summary.slots.find((slot) => slot.id === "computer");
  assert.ok(computers?.products.some((tool) => tool.tool_id === "mac-mini"));
  assert.equal(
    Boolean(
      computers?.products.some((tool) =>
        /aeron|trackpad|ipad|iphone|samsung|lose/i.test(
          `${tool.tool_id} ${tool.name}`,
        ),
      ),
    ),
    false,
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "chair")
      ?.products.some((tool) => tool.tool_id === "aeron"),
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "mouse")
      ?.products.some((tool) => tool.tool_id === "apple-magic-trackpad"),
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "tablet")
      ?.products.some((tool) => tool.tool_id === "ipad-air-4"),
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "phone")
      ?.products.some((tool) => tool.tool_id === "iphone-13-mini"),
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "display")
      ?.products.some((tool) => tool.tool_id === "samsung-55-tv"),
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "health-fitness")
      ?.products.some((tool) => tool.tool_id === "lose-it"),
  );
  assert.equal(
    Boolean(
      summary.slots
        .find((slot) => slot.id === "personal-finance")
        ?.products.some((tool) => tool.tool_id === "lose-it"),
    ),
    false,
  );
});

test("catalog sense: Hugo YNAB Proxmox iTerm2 and Nintendo mashup", async () => {
  const catalog = await loadCatalog();
  assert.equal(
    classifyClaim({ name: "Hugo", kind: "product" }, catalog).slot_id,
    "static-site-generator",
  );
  assert.equal(
    classifyClaim({ name: "YNAB", kind: "product" }, catalog).slot_id,
    "personal-finance",
  );
  assert.equal(
    classifyClaim({ name: "Proxmox", kind: "product" }, catalog).slot_id,
    "virtualization",
  );
  assert.equal(
    classifyClaim({ name: "iTerm", kind: "product" }, catalog).tool_id,
    "iterm-2",
  );
  assert.equal(
    classifyClaim({ name: "BrewBar", kind: "product" }, catalog).slot_id,
    "package-manager",
  );

  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        {
          tool_id: "nintendo-handhelds",
          name: "Nintendo 3DS XL, Switch OLED, Switch 2",
          section: "Hardware",
        },
        { tool_id: "hugo", name: "Hugo", section: "Website" },
        { tool_id: "ynab", name: "YNAB", section: "Apps" },
        { tool_id: "iterm", name: "iTerm", section: "Software" },
      ]),
    ],
    catalog,
  );
  const consoles = summary.slots.find((slot) => slot.id === "game-console");
  assert.ok(
    consoles?.products.some((tool) => tool.tool_id === "nintendo-3ds-xl"),
  );
  assert.ok(
    consoles?.products.some((tool) => tool.tool_id === "nintendo-switch-oled"),
  );
  assert.ok(
    consoles?.products.some((tool) => tool.tool_id === "nintendo-switch-2"),
  );
  assert.equal(
    Boolean(
      consoles?.products.some((tool) => tool.tool_id === "nintendo-handhelds"),
    ),
    false,
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "static-site-generator")
      ?.products.some((tool) => tool.tool_id === "hugo"),
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "personal-finance")
      ?.products.some((tool) => tool.tool_id === "ynab"),
  );
  assert.ok(
    summary.slots
      .find((slot) => slot.id === "terminal-emulator")
      ?.products.some((tool) => tool.tool_id === "iterm-2"),
  );
  assert.equal(
    Boolean(
      summary.slots
        .find((slot) => slot.id === "hosting")
        ?.products.some((tool) => tool.tool_id === "hugo"),
    ),
    false,
  );
  assert.equal(
    Boolean(
      summary.slots
        .find((slot) => slot.id === "tasks")
        ?.products.some((tool) => tool.tool_id === "ynab"),
    ),
    false,
  );
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

test("MacBook family falls back when catalog omits the tool row", () => {
  const classified = classifyClaim(
    { name: "MacBook Pro 16-inch", kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(classified.role, "ranked");
  assert.equal(classified.tool_id, "macbook-pro-16");
  assert.equal(classified.slot_id, "computer");
});

test("MacBook family uses catalog row when aliases do not exact-match", () => {
  const classified = classifyClaim(
    { name: "MacBook Pro 16 M3 Max workstation build", kind: "product" },
    {
      tools: [
        {
          id: "macbook-pro-16",
          name: "MacBook Pro 16-inch",
          category_id: "computer",
          aliases: [],
        },
      ],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(classified.role, "ranked");
  assert.equal(classified.tool_id, "macbook-pro-16");
  assert.equal(classified.rule, "macbook-family");

  const air = classifyClaim(
    { name: "MacBook Air M3 travel machine", kind: "product" },
    {
      tools: [
        {
          id: "macbook-air",
          name: "MacBook Air",
          category_id: "computer",
          aliases: [],
        },
      ],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(air.tool_id, "macbook-air");
  assert.equal(air.rule, "macbook-family");

  const barePro = classifyClaim(
    { name: "MacBook Pro M2 workstation build", kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(barePro.tool_id, "macbook-pro");
  assert.equal(barePro.rule, "macbook-family");

  const pro14 = classifyClaim(
    { name: "MacBook Pro 14 M3 workstation build", kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(pro14.tool_id, "macbook-pro-14");
  assert.equal(pro14.rule, "macbook-family");

  const pro14Alt = classifyClaim(
    { name: 'MacBook Pro 14" silver build', kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(pro14Alt.tool_id, "macbook-pro-14");

  const pro14Named = classifyClaim(
    { name: "MacBook Pro 14-inch workstation build", kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(pro14Named.tool_id, "macbook-pro-14");

  const pro16Alt = classifyClaim(
    { name: "MacBook Pro 16 workstation build", kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(pro16Alt.tool_id, "macbook-pro-16");

  const inch14Only = classifyClaim(
    { name: "14-inch MacBook Pro build", kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(inch14Only.tool_id, "macbook-pro-14");

  const quote14Only = classifyClaim(
    { name: 'MacBook Pro size 14" laptop', kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(quote14Only.tool_id, "macbook-pro-14");

  const inch16Only = classifyClaim(
    { name: "16-inch MacBook Pro build", kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(inch16Only.tool_id, "macbook-pro-16");

  const quote16Only = classifyClaim(
    { name: 'MacBook Pro size 16" laptop', kind: "product" },
    {
      tools: [],
      categories: [{ id: "computer", role: "ranked", name: "Computers" }],
    },
  );
  assert.equal(quote16Only.tool_id, "macbook-pro-16");
});

test("component and preference branches cover classify helpers", () => {
  /** @type {Array<[string, string]>} */
  const components = [
    ["Mac RAM kit", ""],
    ["Laptop stand screws", ""],
    ["Mini PC power brick", ""],
    ["NUC wifi card", ""],
    ["Computer PSU fan", ""],
    ["32GB DDR5 stick", "computer"],
    ["16GB SODIMM RAM", "computer"],
    ["32GB of memory", "computer"],
    ["AMD Ryzen 9 7950X", "computer"],
    ["Intel Core i7-13700K", "computer"],
    ["NVIDIA graphics card", "computer"],
    ["Radeon RX 7800", "computer"],
    ["GeForce RTX 4090", "computer"],
    ["Discrete GPU cooler", "computer"],
    ["Key switches set", "keyboard"],
    ["Kailh Box Jade", "keyboard"],
  ];
  for (const [name, parent] of components) {
    const classified = classifyClaim(
      { name, kind: "product" },
      {
        tools: [],
        categories: [],
      },
    );
    if (parent) {
      assert.equal(classified.role, "detail", name);
      assert.equal(classified.parent_slot, parent, name);
    } else {
      assert.notEqual(classified.rule, "component", name);
    }
  }

  assert.equal(
    classifyClaim(
      {
        name: "Neovim",
        context: "favourite editor",
        kind: "product",
      },
      {
        tools: [{ id: "neovim", name: "Neovim", category_id: "editor-ide" }],
        categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
      },
    ).preference,
    true,
  );
  assert.equal(
    classifyClaim(
      {
        name: "Neovim",
        context: "preferred daily driver",
        kind: "product",
      },
      {
        tools: [{ id: "neovim", name: "Neovim", category_id: "editor-ide" }],
        categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
      },
    ).preference,
    true,
  );
  assert.equal(
    classifyClaim(
      {
        name: "Neovim",
        context: "prefers Neovim for rust",
        kind: "product",
      },
      {
        tools: [{ id: "neovim", name: "Neovim", category_id: "editor-ide" }],
        categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
      },
    ).preference,
    true,
  );
  assert.equal(
    classifyClaim(
      {
        name: "Neovim",
        context: "I prefer Neovim",
        kind: "product",
      },
      {
        tools: [{ id: "neovim", name: "Neovim", category_id: "editor-ide" }],
        categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
      },
    ).preference,
    true,
  );

  const slotRule = classifyClaim(
    {
      name: "SharedTool",
      context: "mobile phone daily",
      kind: "product",
    },
    {
      tools: [
        {
          id: "shared-tool",
          name: "SharedTool",
          category_id: "editor-ide",
          slot_rules: [
            { slot_id: "ignored", require_context: "not-an-array" },
            { slot_id: "phone", require_context: ["mobile", "phone"] },
          ],
        },
      ],
      categories: [
        { id: "editor-ide", role: "ranked", name: "Editors" },
        { id: "phone", role: "ranked", name: "Phones" },
      ],
    },
  );
  assert.equal(slotRule.slot_id, "phone");

  const pathSection = classifyClaim(
    {
      name: "MysteryPathEditor",
      section_path: "Hardware / Editors",
      kind: "product",
    },
    {
      tools: [],
      categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
    },
  );
  assert.equal(pathSection.rule, "section");
  assert.equal(pathSection.slot_id, "editor-ide");

  const missingSlot = classifyClaim(
    { name: "GhostTool", kind: "product" },
    {
      tools: [
        {
          id: "ghost-tool",
          name: "GhostTool",
          category_id: "missing-slot",
        },
      ],
      categories: [],
    },
  );
  assert.equal(missingSlot.role, "unsorted");
  assert.equal(missingSlot.rule, "abstain");

  const urlNameAgree = classifyClaim(
    {
      name: "Neovim nightly build",
      href: "https://neovim.io/",
      kind: "product",
    },
    {
      tools: [
        {
          id: "neovim",
          name: "Neovim",
          category_id: "editor-ide",
          website: "https://neovim.io/",
        },
      ],
      categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
    },
  );
  assert.equal(urlNameAgree.tool_id, "neovim");
  assert.equal(urlNameAgree.rule, "approved-url");

  const shorterName = classifyClaim(
    {
      name: "Neovim",
      href: "https://neovim.io/",
      kind: "product",
    },
    {
      tools: [
        {
          id: "neovim",
          name: "Neovim nightly",
          category_id: "editor-ide",
          website: "https://neovim.io/",
        },
      ],
      categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
    },
  );
  assert.equal(shorterName.tool_id, "neovim");

  const noCategory = classifyClaim(
    {
      name: "OrphanSite",
      href: "https://orphansite.example/",
      kind: "product",
    },
    {
      tools: [
        null,
        {
          id: "no-site",
          name: "NoSite",
        },
        {
          id: "orphan-site",
          name: "OrphanSite",
          website: "https://orphansite.example/",
        },
        {
          id: "blank-named",
          name: "@@@",
          category_id: "editor-ide",
          website: "https://orphansite.example/other",
        },
      ],
      categories: [null, { id: "editor-ide", role: "ranked", name: "Editors" }],
    },
  );
  assert.equal(noCategory.role, "unsorted");
  assert.equal(noCategory.rule, "abstain");

  assert.notEqual(
    classifyClaim(
      {
        name: "Kindle Paperwhite",
        href: "https://play.google.com/store/apps/details?id=com.amazon.kindle",
        kind: "product",
      },
      {
        tools: [
          {
            id: "kindle-app",
            name: "Kindle",
            category_id: "reading-app",
            website:
              "https://play.google.com/store/apps/details?id=com.amazon.kindle",
          },
        ],
        categories: [
          { id: "reading-app", role: "ranked", name: "Reading apps" },
        ],
      },
    ).rule,
    "approved-url",
  );

  const namelessSlot = sectionSlotId("custom-slot", [
    { id: "custom-slot", role: "ranked" },
  ]);
  assert.equal(namelessSlot, "custom-slot");
  assert.equal(
    sectionSlotId("Weird Slot", [
      { id: "weird-slot", name: "Weird Slot", role: "ranked" },
    ]),
    "weird-slot",
  );
  assert.equal(
    sectionSlotId("Editors", [
      null,
      { id: "other", name: "Other", role: "detail" },
      { role: "ranked" },
      { id: "editor-ide", name: "Editors", role: "ranked" },
    ]),
    "editor-ide",
  );
  assert.equal(
    sectionSlotId("Laptops", [{ id: "phone", name: "Phones", role: "ranked" }]),
    null,
  );
  assert.equal(sectionSlotId("Editors", null), null);
  assert.equal(sectionSlotId("Editors", undefined), null);
  assert.equal(
    classifyClaim(
      { name: "2024", kind: "product" },
      { tools: [], categories: [] },
    ).role,
    "rejected",
  );
  assert.equal(
    classifyClaim(
      { name: "Foo 2024", kind: "product" },
      { tools: [], categories: [] },
    ).role,
    "unsorted",
  );
  assert.equal(
    classifyClaim(
      { name: "/cv", kind: "product" },
      { tools: [], categories: [] },
    ).role,
    "rejected",
  );
  assert.equal(
    classifyClaim(
      {
        name: "GhostNamed",
        href: "https://ghostnamed.example/",
        kind: "product",
      },
      {
        tools: [
          {
            id: "ghost-named",
            name: "!!!",
            category_id: "editor-ide",
            website: "https://ghostnamed.example/",
          },
        ],
        categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
      },
    ).rule,
    "unresolved",
  );

  const report = buildMigrationReport(
    [
      {
        origin: "https://joshua.example",
        tools: [
          { name: "Neovim with Friends" },
          { name: "Desk and Chair set" },
          { name: "TODO" },
        ],
      },
    ],
    {
      tools: [],
      categories: [],
    },
  );
  assert.ok(report.split_compounds.length >= 2);
  assert.ok(report.rejected_fragments.some((row) => row.name === "TODO"));
});

test("IDE extension names rank as editor details", () => {
  const classified = classifyClaim(
    { name: "Gremlins tracker", kind: "product" },
    {
      tools: [],
      categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
    },
  );
  assert.equal(classified.role, "detail");
  assert.equal(classified.rule, "extension");
  assert.equal(classified.parent_slot, "editor-ide");
});

test("browser extension names rank as browser details", () => {
  const classified = classifyClaim(
    { name: "uBlock Origin", kind: "product" },
    {
      tools: [],
      categories: [{ id: "browser", role: "ranked", name: "Browsers" }],
    },
  );
  assert.equal(classified.role, "detail");
  assert.equal(classified.rule, "extension");
  assert.equal(classified.parent_slot, "browser");
});

test("section ranking tolerates non-string tool ids", async () => {
  const catalog = await loadCatalog();
  const classified = classifyClaim(
    {
      name: "MysteryEditorZ",
      section: "Editors",
      tool_id: 42,
      kind: "product",
    },
    catalog,
  );
  assert.equal(classified.role, "ranked");
  assert.equal(classified.slot_id, "editor-ide");
  assert.equal(classified.tool_id, null);

  const emptyId = classifyClaim(
    {
      name: "MysteryEditorW",
      section: "Editors",
      tool_id: "",
      kind: "product",
    },
    catalog,
  );
  assert.equal(emptyId.tool_id, null);
});

test("catalog peel with a missing tool id falls through to resolve", () => {
  const classified = classifyClaim(
    { name: "orphanlauncher primary always", kind: "product" },
    {
      tools: [],
      aliases: [{ alias: "orphanlauncher", tool_id: "missing-orphan" }],
      categories: [{ id: "launcher", role: "ranked", name: "Launchers" }],
    },
  );
  assert.equal(classified.role, "unsorted");
});

test("classifyClaim accepts label-only claims and ambiguous aliases", () => {
  assert.equal(
    classifyClaim(null, { tools: [], categories: [] }).role,
    "rejected",
  );
  assert.equal(
    classifyClaim(undefined, { tools: [], categories: [] }).role,
    "rejected",
  );
  const labeled = classifyClaim(
    { label: "Neovim", kind: "product" },
    {
      tools: [
        {
          id: "neovim",
          name: "Neovim",
          category_id: "editor-ide",
        },
      ],
      categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
    },
  );
  assert.equal(labeled.tool_id, "neovim");

  const ambiguous = classifyClaim(
    { name: "TwinTool", kind: "product" },
    {
      tools: [
        {
          id: "twin-a",
          name: "Twin A",
          aliases: ["TwinTool"],
          category_id: "editor-ide",
        },
        {
          id: "twin-b",
          name: "Twin B",
          aliases: ["TwinTool"],
          category_id: "editor-ide",
        },
      ],
      categories: [{ id: "editor-ide", role: "ranked", name: "Editors" }],
    },
  );
  assert.equal(ambiguous.role, "unsorted");
  assert.equal(ambiguous.rule, "ambiguous");

  const abstain = classifyClaim(
    {
      name: "Go",
      kind: "product",
      section: "Notes",
      excerpt: "board game night",
    },
    {
      tools: [
        {
          id: "go-language",
          name: "Go",
          category_id: "programming-language",
          aliases: [],
        },
      ],
      aliases: [
        {
          alias: "Go",
          tool_id: "go-language",
          require_context: ["programming", "golang"],
        },
      ],
      categories: [
        { id: "programming-language", role: "ranked", name: "Languages" },
      ],
    },
  );
  assert.equal(abstain.role, "unsorted");
  assert.equal(abstain.rule, "abstain");
});

test("section synonym ranks an unresolved name with a stored tool id", async () => {
  const catalog = await loadCatalog();
  const classified = classifyClaim(
    {
      name: "MysteryEditorX",
      section: "Editors",
      tool_id: "observed:mystery-editor-x",
      kind: "product",
    },
    catalog,
  );
  assert.equal(classified.role, "ranked");
  assert.equal(classified.slot_id, "editor-ide");
  assert.equal(classified.tool_id, "observed:mystery-editor-x");
  assert.equal(classified.rule, "section");

  const withoutStoredId = classifyClaim(
    {
      name: "MysteryEditorY",
      section: "Editors",
      kind: "product",
    },
    catalog,
  );
  assert.equal(withoutStoredId.role, "ranked");
  assert.equal(withoutStoredId.slot_id, "editor-ide");
  assert.equal(withoutStoredId.rule, "section");
  assert.equal(withoutStoredId.tool_id, null);
});

test("unsorted triage callouts classify into fine-grained slots", async () => {
  const catalog = await loadCatalog();
  /** @type {Array<[string, string, string]>} */
  const cases = [
    [
      "1password password manager don't trust people",
      "1password",
      "password-manager",
    ],
    ["alfred launcher 6.4 launches apps", "alfred", "launcher"],
    ["Adobe Photoshop", "adobe-photoshop", "design"],
    ["airpods max usb-c replaced sony", "airpods-max", "headphones"],
    ["apple watch ultra 2 mainly for workouts", "apple-watch-ultra-2", "watch"],
    ["10.9-inch iPad Air", "ipad-air", "tablet"],
    ["Docker", "docker", "containers"],
    ["Discord", "discord", "chat"],
    ["NordVPN", "nordvpn", "vpn"],
    ["Postman", "postman", "api-client"],
    ["TablePlus", "tableplus", "db-client"],
    ["Calibre", "calibre", "reading-app"],
    ["Dropbox", "dropbox", "file-sync"],
    ["EleTab Dual Arm", "eletab-dual-arm", "mount"],
    ["firefox browser blink sucks", "firefox", "browser"],
    ["vscode primary mostly neovim", "visual-studio-code", "editor-ide"],
  ];
  for (const [name, toolId, slotId] of cases) {
    const classified = classifyClaim({ name, kind: "product" }, catalog);
    assert.equal(classified.role, "ranked", name);
    assert.equal(classified.tool_id, toolId, name);
    assert.equal(classified.slot_id, slotId, name);
  }
  assert.equal(
    classifyClaim({ name: "React", kind: "product" }, catalog).role,
    "rejected",
  );
  assert.equal(
    classifyClaim(
      { name: "4 lessons I learned while building", kind: "product" },
      catalog,
    ).role,
    "rejected",
  );
  assert.equal(
    classifyClaim({ name: "Better Comments", kind: "product" }, catalog).role,
    "rejected",
  );
  assert.equal(
    classifyClaim({ name: "Tablet:", kind: "product" }, catalog).role,
    "rejected",
  );

  const summary = await rollup(
    [
      member("https://joshua.example", "verified", [
        {
          tool_id: "observed:1password-aside",
          name: "1password password manager don't trust people",
        },
        { tool_id: "observed:docker", name: "Docker" },
        { tool_id: "observed:ipad", name: "10.9-inch iPad Air" },
        { tool_id: "observed:react", name: "React" },
      ]),
    ],
    catalog,
  );
  const unsortedNames = (summary.unsorted || []).map((row) => row.name);
  assert.ok(!unsortedNames.some((name) => /1password/i.test(name)));
  assert.ok(!unsortedNames.some((name) => /docker/i.test(name)));
  assert.ok(!unsortedNames.some((name) => /ipad/i.test(name)));
  assert.ok(!unsortedNames.some((name) => /^react$/i.test(name)));
  const passwords = summary.slots.find(
    (slot) => slot.id === "password-manager",
  );
  assert.ok(passwords.products.some((tool) => tool.tool_id === "1password"));
  const tablets = summary.slots.find((slot) => slot.id === "tablet");
  assert.ok(tablets.products.some((tool) => tool.tool_id === "ipad-air"));
  const containers = summary.slots.find((slot) => slot.id === "containers");
  assert.ok(containers.products.some((tool) => tool.tool_id === "docker"));
});
