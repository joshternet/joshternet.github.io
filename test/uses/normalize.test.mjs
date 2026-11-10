/**
 * Goal: Alias collisions and label normalization.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  comparisonLabel,
  contentFingerprint,
  deterministicEventId,
  isArticleShapedLabel,
  isBlogChromeSection,
  isNamedEntity,
  isNonComparableUseLabel,
  isReportableUseLabel,
  isSentenceShapedLabel,
  isUsesSectionLabel,
  peelCatalogLead,
  peelDeclarativeLeadIn,
  peelHardwareSizePrefix,
  publicToolName,
  resolveToolLabel,
  sanitizeLabel,
  separateNameContext,
  splitCompoundName,
  supersededObservedIds,
} from "../../scripts/uses/normalize.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @returns {Promise<object>}
 */
async function catalog() {
  const tools = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/tools.json"), "utf8"),
  );
  const aliases = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/aliases.json"), "utf8"),
  );
  return { tools: tools.tools, aliases: aliases.aliases };
}

test("sanitizeLabel and comparisonLabel fold case and accents", () => {
  assert.equal(sanitizeLabel("  VS   Code\n"), "VS Code");
  assert.equal(comparisonLabel("VS Code"), "vs code");
  assert.equal(comparisonLabel("Café"), "cafe");
  assert.equal(
    comparisonLabel("Observed: Apple Magic Keyboard"),
    "apple magic keyboard",
  );
  assert.equal(comparisonLabel("observed:"), "");
});

test("VS Code maps; Visual Studio stays separate with context", async () => {
  const cat = await catalog();
  const vscode = resolveToolLabel("VS Code", {
    section: "Development",
    excerpt: "everyday development",
    catalog: cat,
  });
  assert.equal(vscode.tool_id, "visual-studio-code");

  const vs = resolveToolLabel("Visual Studio", {
    section: "Windows desktop",
    excerpt: "Visual Studio for Windows desktop apps",
    catalog: cat,
  });
  assert.equal(vs.tool_id, "visual-studio");
});

test("Go and Cursor require programming context", async () => {
  const cat = await catalog();
  const goOk = resolveToolLabel("Go", {
    section: "Programming",
    excerpt: "Go for backend services",
    catalog: cat,
  });
  assert.equal(goOk.tool_id, "go-language");

  const goBad = resolveToolLabel("Go", {
    section: "Games",
    excerpt: "board game of go",
    catalog: cat,
  });
  assert.equal(goBad.tool_id, null);
  assert.equal(goBad.unresolved, true);

  const cursor = resolveToolLabel("Cursor", {
    section: "Programming",
    excerpt: "Cursor as my editor for coding",
    catalog: cat,
  });
  assert.equal(cursor.tool_id, "cursor-editor");

  const cursorBare = resolveToolLabel("Cursor", {
    section: "Misc",
    excerpt: "mouse cursor",
    catalog: cat,
  });
  assert.equal(cursorBare.tool_id, null);
});

test("duplicate observed ids collapse only on a unique catalog match", () => {
  const catalog = {
    tools: [
      { id: "apple-magic-keyboard", name: "Apple Magic Keyboard", aliases: [] },
    ],
    aliases: [],
  };
  const pairs = supersededObservedIds(
    [
      {
        tool_id: "apple-magic-keyboard",
        name: "Apple Magic Keyboard",
        status: "current",
      },
      {
        tool_id: "observed:apple-magic-keyboard",
        name: "Apple Magic Keyboard",
        status: "current",
        section: "Workstation",
        context: "Low-profile",
      },
      {
        tool_id: "observed:custom-board",
        name: "Custom Board",
        status: "current",
      },
    ],
    catalog,
  );
  assert.deepEqual(pairs, [
    {
      observed_id: "observed:apple-magic-keyboard",
      canonical_id: "apple-magic-keyboard",
      name: "Apple Magic Keyboard",
    },
  ]);
  assert.deepEqual(
    supersededObservedIds(
      [
        {
          tool_id: "observed:apple-magic-keyboard",
          name: "Apple Magic Keyboard",
          status: "former",
        },
      ],
      catalog,
      ["apple-magic-keyboard"],
    ),
    [],
  );
  assert.deepEqual(supersededObservedIds(undefined, catalog), []);
  assert.deepEqual(
    supersededObservedIds(
      [
        null,
        { tool_id: "kept" },
        { status: "current" },
        { tool_id: "plain", status: "current" },
        { tool_id: "observed:unnamed", status: "current" },
        {
          tool_id: "observed:apple-magic-keyboard",
          name: "Apple Magic Keyboard",
          status: "current",
        },
      ],
      catalog,
      [""],
    ),
    [],
  );
});

test("deterministic hashes are stable", () => {
  assert.equal(contentFingerprint("abc"), contentFingerprint("abc"));
  assert.notEqual(contentFingerprint("abc"), contentFingerprint("abd"));
  const a = deterministicEventId({ x: 1, y: 2 });
  const b = deterministicEventId({ y: 2, x: 1 });
  assert.equal(a, b);
});

test("Plugins and sentence leftovers are not reportable products", () => {
  assert.equal(isUsesSectionLabel("Plugins"), true);
  assert.equal(isUsesSectionLabel("Extensions"), true);
  assert.equal(isReportableUseLabel("Plugins"), false);
  assert.equal(
    isReportableUseLabel(
      "And yes, I have GitHub Copilot, it's…occasionally useful",
    ),
    false,
  );
  assert.equal(
    isReportableUseLabel(
      "My font is Fira Code, I use Material Theme and Icons",
    ),
    false,
  );
  assert.equal(isReportableUseLabel("So I have 3 Operating Systems…"), false);
  assert.equal(isReportableUseLabel("3 Operating Systems"), false);
  assert.equal(isReportableUseLabel("Favorite operating systems"), false);
  assert.equal(isReportableUseLabel("macOS operating system"), true);
  assert.equal(isReportableUseLabel("Fira Code"), true);
  assert.equal(isReportableUseLabel("GitHub Copilot"), true);
  assert.equal(
    isReportableUseLabel(
      "Besides my laptop, my e-book reader is probably my favorite device.",
    ),
    false,
  );
  assert.equal(isReportableUseLabel("Choose your own I/O!"), false);
  assert.equal(
    isReportableUseLabel("Every single component is user-replaceable!"),
    false,
  );
  assert.equal(
    isReportableUseLabel(
      "Creating tutorials/explanations that are Windows-only",
    ),
    false,
  );
  assert.equal(isReportableUseLabel("Gaming Computer:"), false);
  assert.equal(isReportableUseLabel("Work Computer:"), false);
  assert.equal(isReportableUseLabel("TODO"), false);
  assert.equal(isReportableUseLabel("Nov 2024"), false);
  assert.equal(isReportableUseLabel("Self-Hosted Services 🖥️"), false);
  assert.equal(isReportableUseLabel("3D Printing 🏗️"), false);
  assert.equal(isReportableUseLabel("GTD"), false);
  assert.equal(
    isReportableUseLabel("TONTRU 101-key mechanical keyboard. It’s affordable"),
    false,
  );
  assert.equal(isReportableUseLabel("Sit-stand desk"), true);
  assert.equal(isReportableUseLabel("3D printers"), true);
});

test("peelDeclarativeLeadIn recovers product names from asides", () => {
  assert.equal(isSentenceShapedLabel(""), false);
  assert.equal(isSentenceShapedLabel("Neovim"), false);
  assert.equal(isSentenceShapedLabel("I have many tools around"), true);
  assert.equal(isSentenceShapedLabel("My editor is Neovim"), true);
  assert.equal(isSentenceShapedLabel("We are using this daily now"), true);
  assert.equal(
    isSentenceShapedLabel("This tool is occasionally useful here"),
    true,
  );
  assert.equal(isNamedEntity("I use Material Theme"), false);
  assert.deepEqual(peelDeclarativeLeadIn(""), { name: "", context: "" });
  assert.deepEqual(peelDeclarativeLeadIn("Neovim"), {
    name: "Neovim",
    context: "",
  });
  assert.deepEqual(
    peelDeclarativeLeadIn(
      "And yes, I have GitHub Copilot, it's…occasionally useful",
    ),
    {
      name: "GitHub Copilot",
      context: "it's…occasionally useful",
    },
  );
  assert.deepEqual(
    peelDeclarativeLeadIn(
      "And yes, I have GitHub Copilot, it's...occasionally useful",
    ),
    {
      name: "GitHub Copilot",
      context: "it's...occasionally useful",
    },
  );
  assert.equal(
    isSentenceShapedLabel(
      "And yes, I have GitHub Copilot, it's...occasionally",
    ),
    true,
  );
  assert.equal(
    isSentenceShapedLabel("Daily GitHub Copilot occasionally"),
    true,
  );
  assert.equal(isSentenceShapedLabel("Neovim Helix Kakoune Zed..."), true);
  assert.equal(publicToolName("Plugins", "observed:plugins"), "");
  assert.equal(
    publicToolName(
      "And yes, I have GitHub Copilot, it's...occasionally useful",
      "observed:and-yes-i-have",
    ),
    "",
  );
  assert.equal(publicToolName("My font is Fira Code", "observed:my-font"), "");
  assert.equal(publicToolName("Neovim", "observed:neovim"), "Neovim");
  assert.equal(publicToolName("home", ""), "home");
  assert.equal(publicToolName("", ""), "");
  assert.deepEqual(peelDeclarativeLeadIn("I play Factorio"), {
    name: "Factorio",
    context: "",
  });
  assert.deepEqual(splitCompoundName("Alpha Board, I use it daily"), [
    "Alpha Board, I use it daily",
  ]);
  assert.deepEqual(separateNameContext("ErgoDox — ortholinear layout"), {
    name: "ErgoDox",
    context: "ortholinear layout",
  });
  assert.deepEqual(
    peelDeclarativeLeadIn(
      "My font is Fira Code, I use Material Theme and Icons",
    ),
    {
      name: "Fira Code",
      context: "I use Material Theme and Icons",
    },
  );
  assert.deepEqual(peelDeclarativeLeadIn("My font is Fira Code"), {
    name: "Fira Code",
    context: "",
  });
  assert.deepEqual(peelDeclarativeLeadIn("So I have 3 Operating Systems…"), {
    name: "3 Operating Systems…",
    context: "",
  });
  assert.deepEqual(peelDeclarativeLeadIn("I have 2 keyboards on the desk"), {
    name: "2 keyboards on the desk",
    context: "",
  });
  assert.deepEqual(peelDeclarativeLeadIn("I use Neovim"), {
    name: "Neovim",
    context: "",
  });
  assert.deepEqual(peelDeclarativeLeadIn("I host Ghost"), {
    name: "Ghost",
    context: "",
  });
  assert.deepEqual(peelDeclarativeLeadIn("My font is plain words here"), {
    name: "plain words here",
    context: "",
  });
  assert.deepEqual(peelDeclarativeLeadIn("My current editor is Neovim"), {
    name: "Neovim",
    context: "",
  });
  assert.deepEqual(splitCompoundName("Fira Code, I use Material Theme"), [
    "Fira Code, I use Material Theme",
  ]);
  assert.deepEqual(splitCompoundName("And yes, I have GitHub Copilot still"), [
    "And yes, I have GitHub Copilot still",
  ]);
  assert.deepEqual(
    splitCompoundName("Nintendo 3DS XL, Switch OLED, Switch 2"),
    ["Nintendo 3DS XL", "Switch OLED", "Switch 2"],
  );
  assert.deepEqual(separateNameContext("Neovim — daily driver"), {
    name: "Neovim",
    context: "daily driver",
  });
  assert.deepEqual(
    separateNameContext(
      "TONTRU 101-key mechanical keyboard. It’s affordable, rigid, and thocky",
    ),
    {
      name: "TONTRU 101-key mechanical keyboard",
      context: "It's affordable, rigid, and thocky",
    },
  );
  assert.deepEqual(separateNameContext("Keyboard, compact layout"), {
    name: "Keyboard",
    context: "compact layout",
  });
});

test("catalog resolves Fira Code and GitHub Copilot", async () => {
  const cat = await catalog();
  assert.equal(
    resolveToolLabel("Fira Code", {
      section: "IDE",
      excerpt: "editor font",
      catalog: cat,
    }).tool_id,
    "fira-code",
  );
  assert.equal(
    resolveToolLabel("FiraCode", {
      section: "Fonts",
      excerpt: "",
      catalog: cat,
    }).tool_id,
    "fira-code",
  );
  assert.equal(
    resolveToolLabel("GitHub Copilot", {
      section: "IDE",
      excerpt: "assistant",
      catalog: cat,
    }).tool_id,
    "github-copilot",
  );
});

test("unsorted triage filters and peels durable publisher labels", async () => {
  assert.equal(isArticleShapedLabel(""), false);
  assert.equal(isArticleShapedLabel(null), false);
  assert.equal(isArticleShapedLabel("Why me"), false);
  assert.equal(isArticleShapedLabel("Getting by"), false);
  assert.equal(isArticleShapedLabel("Fixing it"), false);
  assert.equal(isArticleShapedLabel("Lets go"), false);
  assert.equal(isArticleShapedLabel("vs me"), false);
  assert.equal(isArticleShapedLabel("How to"), false);
  assert.equal(isArticleShapedLabel("Why did this happen today"), true);
  assert.equal(isArticleShapedLabel("How did this happen today"), true);
  assert.equal(isArticleShapedLabel("Getting comfortable with change"), true);
  assert.equal(isArticleShapedLabel("Fixing my attention deficit"), true);
  assert.equal(isArticleShapedLabel("Lets talk about shipping work"), true);
  assert.equal(isArticleShapedLabel("Let's talk about shipping work"), true);
  assert.equal(
    isArticleShapedLabel("4 lessons I learned while building"),
    true,
  );
  assert.equal(isArticleShapedLabel("3 books worth reading twice"), true);
  assert.equal(isArticleShapedLabel("5 tips for remote work"), true);
  assert.equal(isArticleShapedLabel("2 ways to ship faster"), true);
  assert.equal(isArticleShapedLabel("6 things I changed this year"), true);
  assert.equal(isArticleShapedLabel("7 newsletters I still open"), true);
  assert.equal(
    isArticleShapedLabel("Lessons I learned about remote teams"),
    true,
  );
  assert.equal(isArticleShapedLabel("Chips vs. Ice Cream"), true);
  assert.equal(isArticleShapedLabel("Why I stepped out of management"), true);
  assert.equal(isArticleShapedLabel("Top 5 newsletters"), true);
  assert.equal(isArticleShapedLabel("The week that changed everything"), true);
  assert.equal(isArticleShapedLabel("The highs of shipping alone"), true);
  assert.equal(isArticleShapedLabel("The power of small notes"), true);
  assert.equal(isArticleShapedLabel("The moon is not a product"), true);
  assert.equal(isArticleShapedLabel("The lows of a long release"), true);
  assert.equal(isArticleShapedLabel("The highs & lows of shipping"), true);
  assert.equal(
    isArticleShapedLabel("A month that turned into a quarter of work"),
    true,
  );
  assert.equal(
    isArticleShapedLabel(
      "Weekly 1 on 1 meetings help attention stay comfortable",
    ),
    true,
  );
  assert.equal(
    isArticleShapedLabel("People who stepped away from newsletters forever"),
    true,
  );
  assert.equal(isArticleShapedLabel("Neovim"), false);
  assert.equal(isNonComparableUseLabel(""), false);
  assert.equal(isNonComparableUseLabel("   "), false);
  assert.equal(isNonComparableUseLabel("React"), true);
  assert.equal(isNonComparableUseLabel("Better Comments"), true);
  assert.equal(isNonComparableUseLabel("What I Use"), true);
  assert.equal(
    isNonComparableUseLabel("See my Homelab page for more details"),
    true,
  );
  assert.equal(
    isNonComparableUseLabel("Some software and tools I use regularly:"),
    true,
  );
  assert.equal(isNonComparableUseLabel("I use Material Theme and Icons"), true);
  assert.equal(isNonComparableUseLabel("Alfred"), false);
  assert.equal(isNonComparableUseLabel("1-on-1"), true);
  assert.equal(
    isNonComparableUseLabel("Besides these four other options"),
    true,
  );
  assert.equal(isNonComparableUseLabel("My stack:"), true);
  assert.equal(isNonComparableUseLabel("Choose any one tool"), true);
  assert.equal(isUsesSectionLabel(""), false);
  assert.equal(isUsesSectionLabel("Tablet:"), true);
  assert.equal(isUsesSectionLabel("Monitor:"), true);
  assert.equal(isUsesSectionLabel("Browser"), true);
  assert.equal(isBlogChromeSection("Uses / Recent Posts"), true);
  assert.equal(isBlogChromeSection("Archive / Top 5 newsletters"), true);
  assert.equal(isBlogChromeSection("How to start"), true);
  assert.equal(isBlogChromeSection("Let's talk"), true);
  assert.equal(isBlogChromeSection("Software"), false);
  assert.equal(isReportableUseLabel("Tablet:"), false);
  assert.equal(isReportableUseLabel("React"), false);
  assert.equal(isReportableUseLabel("Top 5 newsletters for engineers"), false);
  assert.deepEqual(peelHardwareSizePrefix(""), {
    name: "",
    context: "",
  });
  assert.deepEqual(peelHardwareSizePrefix("10.9-inch iPad Air"), {
    name: "iPad Air",
    context: "10.9-inch",
  });
  assert.deepEqual(peelHardwareSizePrefix("11-inch MacBook Air"), {
    name: "MacBook Air",
    context: "11-inch",
  });
  assert.deepEqual(peelHardwareSizePrefix("6.1-inch iPhone 13"), {
    name: "iPhone 13",
    context: "6.1-inch",
  });
  assert.deepEqual(peelHardwareSizePrefix("Apple iPhone 13"), {
    name: "Apple iPhone 13",
    context: "",
  });
  assert.deepEqual(peelHardwareSizePrefix('65" curved 4k TV'), {
    name: '65" curved 4k TV',
    context: "",
  });
  assert.equal(
    peelCatalogLead("Apple iPhone 13 always pocket", {
      tools: [
        {
          id: "iphone-13",
          name: "iPhone 13",
          aliases: ["iPhone 13"],
        },
      ],
    }).tool_id,
    "iphone-13",
  );
  assert.equal(
    peelCatalogLead("retiredlauncher primary always", {
      tools: [
        {
          id: "retired-launcher",
          name: "retiredlauncher",
          retired: true,
        },
      ],
    }).tool_id,
    null,
  );
  assert.deepEqual(peelDeclarativeLeadIn("10.9-inch iPad Air"), {
    name: "iPad Air",
    context: "10.9-inch",
  });
  const cat = await catalog();
  const password = peelCatalogLead(
    "1password password manager don't trust people",
    cat,
  );
  assert.equal(password.tool_id, "1password");
  assert.equal(password.name, "1Password");
  const alfred = peelCatalogLead("alfred launcher 6.4 launches apps", cat);
  assert.equal(alfred.tool_id, "alfred");
  const airpods = peelCatalogLead("airpods max usb-c replaced sony", cat);
  assert.equal(airpods.tool_id, "airpods-max");
  const watch = peelCatalogLead("apple watch ultra 2 mainly for workouts", cat);
  assert.equal(watch.tool_id, "apple-watch-ultra-2");
  const iphoneCamera = peelCatalogLead(
    "iphone 17 pro main camera most of my holiday pics",
    cat,
  );
  assert.equal(iphoneCamera.tool_id, "iphone-17-pro");
  assert.equal(iphoneCamera.name, "iPhone 17 Pro");
  const versionAside = peelCatalogLead("Alfred 6.4 launches apps", cat);
  assert.equal(versionAside.tool_id, "alfred");
  const noAside = peelCatalogLead("Alfred Raycast", cat);
  assert.equal(noAside.tool_id, null);
  const emptyPeel = peelCatalogLead("", cat);
  assert.equal(emptyPeel.name, "");
  const noCatalog = peelCatalogLead("Alfred launcher apps", {});
  assert.equal(noCatalog.tool_id, null);
  const aliasOnly = peelCatalogLead("orphanlauncher primary always", {
    aliases: [{ alias: "orphanlauncher", tool_id: "missing-orphan" }],
  });
  assert.equal(aliasOnly.tool_id, "missing-orphan");
  const emptyNameTool = peelCatalogLead("BlankAlias primary always", {
    tools: [
      {
        id: "blank-alias-tool",
        name: "",
        aliases: ["BlankAlias"],
      },
    ],
  });
  assert.equal(emptyNameTool.tool_id, "blank-alias-tool");
  assert.equal(emptyNameTool.name, "BlankAlias");
  const skippedAliasRules = peelCatalogLead("Neovim", {
    tools: [{ id: "neovim", name: "Neovim" }],
    aliases: [
      { alias: "", tool_id: "x" },
      { alias: "ab", tool_id: "" },
      { alias: "a", tool_id: "short" },
      null,
    ],
  });
  assert.equal(skippedAliasRules.tool_id, null);
  const ipad = peelCatalogLead("10.9-inch iPad Air", cat);
  assert.equal(ipad.name, "iPad Air");
  assert.match(ipad.context, /10\.9/);
  assert.equal(
    resolveToolLabel(ipad.name, { section: "", excerpt: "", catalog: cat })
      .tool_id,
    "ipad-air",
  );
  const macMiniChip = peelCatalogLead("Mac mini M4", {
    tools: [
      {
        id: "mac-mini",
        name: "Mac mini",
        category_id: "computer",
        aliases: [],
      },
    ],
    aliases: [],
  });
  assert.equal(macMiniChip.name, "Mac mini");
  assert.match(macMiniChip.context, /M4/i);
  assert.equal(macMiniChip.tool_id, "mac-mini");
  assert.deepEqual(separateNameContext("Neovim: daily driver"), {
    name: "Neovim",
    context: "daily driver",
  });
  assert.equal(
    isReportableUseLabel(
      "Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu",
    ),
    false,
  );
});
