/**
 * One-shot catalog append for names that were unsorted. Deleted after it runs.
 */
import { readFile, writeFile } from "node:fs/promises";

const toolsPath = new URL(
  "../../data/uses/catalog/tools.json",
  import.meta.url,
);

/** @type {Array<{ id: string, name: string, kind: string, category_id: string, aliases?: string[] }>} */
const additions = [
  ["iphone-17-pro", "iPhone 17 Pro", "hardware", "phone"],
  [
    "pixel-9a",
    "Google Pixel 9a",
    "hardware",
    "phone",
    ["Google Pixel 9a phone"],
  ],
  ["apple-magic-mouse", "Apple Magic Mouse", "hardware", "mouse"],
  ["logitech-mx-ergo", "Logitech MX Ergo", "hardware", "mouse"],
  ["mx-master-3s", "MX Master 3S", "hardware", "mouse"],
  ["claude", "Claude", "software", "ai-assistant"],
  ["chatgpt", "ChatGPT", "software", "ai-assistant"],
  ["osaurus", "Osaurus", "software", "ai-assistant"],
  ["claude-code", "Claude Code", "software", "coding-agent"],
  ["codex", "Codex", "software", "coding-agent"],
  ["age-of-empires-2", "Age of Empires 2", "media", "game"],
  ["jackbox", "Jackbox Games", "media", "game"],
  [
    "lovers-in-a-dangerous-spacetime",
    "Lovers in a Dangerous Spacetime",
    "media",
    "game",
  ],
  ["mario-kart-64", "Mario Kart 64", "media", "game"],
  ["outer-wilds", "Outer Wilds", "media", "game"],
  ["spiderheck", "SpiderHeck", "media", "game"],
  ["towerfall", "TowerFall", "media", "game"],
  ["kindle", "Kindle", "software", "reading-app"],
  ["readera", "ReadEra", "software", "reading-app"],
  ["waha", "Waha", "software", "reading-app"],
  ["youversion", "YouVersion", "software", "study-software"],
  ["neomutt", "neomutt", "software", "email-app"],
  ["newsboat", "Newsboat", "software", "feed-reader"],
  ["ocreader", "OCReader", "software", "feed-reader"],
  ["debian", "Debian", "software", "operating-system"],
  ["fedora", "Fedora", "software", "operating-system"],
  ["grapheneos", "GrapheneOS", "software", "operating-system"],
  ["gnome", "GNOME", "software", "desktop"],
  ["php", "PHP", "software", "programming-language"],
  ["python", "Python", "software", "programming-language"],
  ["typescript", "TypeScript", "software", "programming-language"],
  ["mariadb", "MariaDB", "software", "database"],
  [
    "amazon-s3",
    "Amazon S3",
    "service",
    "object-storage",
    ["Amazon Simple Storage Service (S3)"],
  ],
  ["linode", "Linode", "service", "hosting"],
  ["dartnode", "DartNode", "service", "hosting"],
  ["github", "GitHub", "software", "git-forge"],
  ["rose-pine", "Rosé Pine", "software", "theme"],
  ["github-theme", "GitHub theme", "software", "theme"],
  ["victor-mono", "Victor Mono", "software", "font"],
  ["berkeley-mono", "Berkeley Mono", "software", "font"],
  ["vscodium", "VSCodium", "software", "editor-ide"],
  ["sublime-text", "Sublime Text", "software", "editor-ide"],
  [
    "youtube-music",
    "YouTube Music",
    "service",
    "media-service",
    ["Youtube Music"],
  ],
  [
    "intel-nuc",
    "Intel NUC",
    "hardware",
    "computer",
    ["Intel NUC - 32 GB - 4 TB"],
  ],
  ["thinkpad-x1", "Lenovo ThinkPad X1 Carbon", "hardware", "computer"],
  [
    "macbook-pro-14",
    "MacBook Pro 14-inch",
    "hardware",
    "computer",
    ["MacBook Pro - 14-inch"],
  ],
  [
    "minisforum-ms-a2",
    "MINISFORUM MS-A2",
    "hardware",
    "computer",
    ["MINISFORUM AMD Ryzen 9 9955HX MS-A2 Mini PC"],
  ],
  [
    "minisforum-ms-01",
    "MINISFORUM MS-01",
    "hardware",
    "computer",
    ["MINISFORUM Intel i5-12600H MS-01 Mini PC - 64 GB - 12 TB"],
  ],
  [
    "framework-laptop",
    "Framework Laptop",
    "hardware",
    "computer",
    ["Framework laptop (work)"],
  ],
  [
    "lenovo-loq",
    "Lenovo LOQ",
    "hardware",
    "computer",
    ["Lenovo LOQ laptop (personal)"],
  ],
  ["mac-mini-asus-24", 'Mac Mini ASUS 24"', "hardware", "computer"],
  ["miyoo", "Miyoo", "hardware", "game-console"],
  [
    "nintendo-handhelds",
    "Nintendo 3DS XL, Switch OLED, Switch 2",
    "hardware",
    "game-console",
  ],
  ["steam-deck", "Steam Deck OLED", "hardware", "game-console"],
  [
    "anbernic",
    "Anbernic",
    "hardware",
    "game-console",
    ["Various retro consoles from Anbernic"],
  ],
  ["ableton-live", "Ableton Live 11", "software", "music-production"],
  ["fl-studio", "FL Studio", "software", "music-production"],
  ["logic-pro", "Logic Pro", "software", "music-production"],
  [
    "eero-pro-6",
    "Amazon eero Pro 6",
    "hardware",
    "networking",
    ["Amazon eero Pro 6 mesh Wi-Fi 6 system"],
  ],
  [
    "surfboard-sb8200",
    "ARRIS SURFboard SB8200",
    "hardware",
    "networking",
    ["ARRIS SURFboard SB8200 DOCSIS 3.1 Cable Modem"],
  ],
  ["apc-ups", "APC UPS", "hardware", "power"],
  ["autonomous-desk", "Autonomous.ai Desk", "hardware", "desk"],
  [
    "ikea-galant",
    "IKEA GALANT",
    "hardware",
    "desk",
    ["Wide IKEA GALANT desk (discontinued)"],
  ],
  [
    "ikea-chair",
    "IKEA chair",
    "hardware",
    "chair",
    ["In dire need of replacement Ikea chair"],
  ],
  ["hag-capisco", "HÅG Capisco", "hardware", "chair"],
  ["aeron", "Herman Miller Aeron", "hardware", "chair"],
  ["kagi", "Kagi", "service", "search"],
  ["goaccess", "GoAccess", "software", "analytics"],
  ["umami", "Umami", "software", "analytics"],
  ["plausible", "Plausible", "software", "analytics", ["Plausible.io"]],
  ["uptimerobot", "UptimeRobot", "service", "monitoring"],
  ["jujutsu", "Jujutsu", "software", "version-control"],
  ["mise", "Mise", "software", "dev-environment"],
  ["hedgedoc", "HedgeDoc", "software", "notes"],
  ["shaarli", "Shaarli", "software", "bookmark"],
  ["syncthing", "Syncthing", "software", "file-sync", ["SyncThing"]],
  ["bruno", "Bruno", "software", "api-client"],
  ["raycast", "Raycast", "software", "launcher"],
  ["obs", "OBS", "software", "streaming"],
  ["remotion", "Remotion", "software", "video"],
  ["led-light", "High-output LED light", "hardware", "lighting"],
  [
    "ikea-regolit",
    "IKEA REGOLIT",
    "hardware",
    "lighting",
    ["IKEA REGOLIT shade"],
  ],
  [
    "mokose-webcam",
    "MOKOSE CS-lens",
    "hardware",
    "camera",
    ["MOKOSE CS-lens 4k webcam"],
  ],
  ["emeet-s600", "Emeet S600", "hardware", "camera"],
  ["rode-nt1", "Rode NT1", "hardware", "microphone"],
  ["shure-mv7", "Shure MV7", "hardware", "microphone"],
  ["usb-microphone-boom", "USB microphone with boom", "hardware", "microphone"],
  ["focusrite-scarlett", "Focusrite Scarlett", "hardware", "audio-interface"],
  ["maudio-midi", "M-Audio MIDI interface", "hardware", "audio-interface"],
  ["ua-volt-1", "UA Volt 1", "hardware", "audio-interface"],
  [
    "sony-wh1000xm2",
    "Sony WH-1000XM2",
    "hardware",
    "headphones",
    ["Sony WH1000XM2 headphones"],
  ],
  [
    "hd-6xx",
    "Massdrop x Sennheiser HD 6XX",
    "hardware",
    "headphones",
    ["Massdrop X Sennheiser HD 6XX headphones"],
  ],
  [
    "tinhifi-t2",
    "TinHiFi T2 Plus",
    "hardware",
    "headphones",
    ["TinHIFI T2 Plus IEM"],
  ],
  ["unitek-kvm", "Unitek KVM switch", "hardware", "kvm"],
  [
    "toslink-bluetooth",
    "TOSLINK-to-bluetooth adapter",
    "hardware",
    "audio-adapter",
  ],
  ["back-the-fuck-up", "Back the Fuck Up", "software", "backup"],
  ["webhook-deploy", "Webhook", "software", "deploy-hook"],
  ["dell-38", 'Dell 38" Ultrawide', "hardware", "display"],
  [
    "odyssey-g9",
    "Samsung Odyssey G9",
    "hardware",
    "display",
    ["Samsung 49” Odyssey G9"],
  ],
  ["pro-display-xdr", "Pro Display XDR", "hardware", "display"],
  ["tontru", "TONTRU", "hardware", "keyboard", []],
  ["corne", "Corne Keyboard", "hardware", "keyboard"],
  ["atreus", "Keyboard.io Atreus", "hardware", "keyboard"],
  ["apple-numeric-keyboard", "Apple numeric keyboard", "hardware", "keyboard"],
  ["figma", "Figma", "software", "design"],
  ["flighty", "Flighty", "software", "travel"],
];

const travel = {
  id: "travel",
  name: "Travel",
  scope: "",
  kind: "software",
  role: "ranked",
  parent_id: null,
};

const categoriesPath = new URL(
  "../../data/uses/catalog/categories.json",
  import.meta.url,
);
const categories = JSON.parse(await readFile(categoriesPath, "utf8"));
if (!categories.categories.some((slot) => slot.id === "travel")) {
  const terminal = categories.categories.findIndex(
    (slot) => slot.id === "terminal",
  );
  categories.categories.splice(terminal, 0, travel);
  await writeFile(categoriesPath, `${JSON.stringify(categories, null, 2)}\n`);
}

const toolsDoc = JSON.parse(await readFile(toolsPath, "utf8"));
const seen = new Set(toolsDoc.tools.map((tool) => tool.id));
for (const row of additions) {
  const [id, name, kind, category_id, aliases = []] = row;
  if (seen.has(id)) {
    continue;
  }
  toolsDoc.tools.push({
    id,
    name,
    kind,
    category_id,
    vendor: "",
    aliases,
    website: "",
    retired: false,
  });
}

const summary = JSON.parse(
  await readFile(
    new URL("../../_data/uses_summary.json", import.meta.url),
    "utf8",
  ),
);
const covered = new Set();
for (const tool of toolsDoc.tools) {
  covered.add(tool.name);
  for (const alias of tool.aliases || []) {
    covered.add(alias);
  }
}
const tontru = toolsDoc.tools.find((tool) => tool.id === "tontru");
const odyssey = toolsDoc.tools.find((tool) => tool.id === "odyssey-g9");
const macMiniAsus = toolsDoc.tools.find(
  (tool) => tool.id === "mac-mini-asus-24",
);
for (const row of summary.unsorted) {
  if (row.name.startsWith("TONTRU")) {
    tontru.aliases = [row.name];
  }
  if (row.name.includes("Odyssey")) {
    odyssey.aliases = [row.name];
  }
  if (row.name.startsWith("Mac Mini ASUS")) {
    macMiniAsus.name = row.name;
    macMiniAsus.aliases = [];
  }
}

const coveredAfter = new Set();
for (const tool of toolsDoc.tools) {
  coveredAfter.add(tool.name);
  for (const alias of tool.aliases || []) {
    coveredAfter.add(alias);
  }
}
const missing = summary.unsorted
  .map((row) => row.name)
  .filter((name) => !coveredAfter.has(name));
if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}

await writeFile(toolsPath, `${JSON.stringify(toolsDoc, null, 2)}\n`);
