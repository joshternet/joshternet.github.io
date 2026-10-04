import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Reads a UTF-8 file relative to the repository root.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<string>} File contents.
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

/**
 * Asserts that a source path under the repo root does not exist.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<void>}
 */
async function assertMissing(relativePath) {
  await assert.rejects(() => access(path.join(root, relativePath)), {
    code: "ENOENT",
  });
}

test("community page and footer point at #joshternet without embedding chat", async () => {
  const community = await read("community.md");
  const layout = await read("_layouts/default.html");

  assert.match(community, /#joshternet/);
  assert.match(community, /https:\/\/web\.libera\.chat\/#joshternet/);
  assert.match(community, /irc\.libera\.chat/);
  assert.match(community, /6697/);
  assert.doesNotMatch(community, /<iframe/i);
  assert.match(layout, /https:\/\/web\.libera\.chat\/#joshternet/);
  assert.match(layout, />#joshternet<span aria-hidden="true">↗<\/span/);
  assert.match(layout, /github.com\/joshternet[\s\S]*target="_blank"/);
  assert.match(layout, /site-footer__button/);
  assert.match(layout, /joshternet-button\.js/);
});

test("primary navigation keeps top-level labels and Implement children", async () => {
  const links = await read("_includes/site-nav-links.html");
  const children = await read("_includes/site-nav-implement-children.html");
  const networkNav = await read("_data/network_nav.yml");
  const aboutNav = await read("_data/about_nav.yml");
  const layout = await read("_layouts/default.html");
  const data = await read("_data/implement_nav.yml");
  const styles = await read("assets/css/main.css");

  for (const label of [
    "Home",
    "About",
    "Network",
    "Wander",
    "Search",
    "Specifications",
    "Implement",
    "JoshBot",
  ]) {
    assert.match(links, new RegExp(`>${label}</a`));
  }

  assert.match(networkNav, /title: Connections/);
  assert.doesNotMatch(networkNav, /title: Nominate/);
  assert.match(await read("_data/joshbot_nav.yml"), /title: Nominate/);
  assert.match(networkNav, /title: Topics/);
  assert.match(aboutNav, /title: Community/);
  assert.match(aboutNav, /title: Governance/);
  assert.match(aboutNav, /title: Privacy/);
  assert.match(aboutNav, /path: \/privacy\//);
  assert.match(aboutNav, /title: Security/);
  assert.match(aboutNav, /path: \/security\//);
  assert.match(aboutNav, /title: Contact/);
  assert.match(aboutNav, /mailto:hello@joshternet\.org/);
  assert.match(aboutNav, /#joshternet/);
  assert.match(aboutNav, /web\.libera\.chat/);
  assert.match(aboutNav, /title: GitHub/);
  assert.match(aboutNav, /github\.com\/joshternet/);
  assert.match(
    await read("_includes/site-nav-about-children.html"),
    /about_nav/,
  );
  assert.match(await read("_includes/site-nav-child-items.html"), /item\.url/);
  assert.match(
    await read("_includes/site-nav-child-items.html"),
    /item\.url contains ':\/\/'[\s\S]*target="_blank"/,
  );
  assert.match(links, /site-nav__item--joshbot/);
  assert.match(links, /JoshBot submenu/);
  assert.match(links, /site-nav__item--implement/);
  assert.match(links, /site-nav__item--network/);
  assert.match(links, /site-nav__item--about/);
  assert.match(links, /site-nav__raindrop/);
  assert.match(links, /Implement submenu/);
  assert.match(links, /Network submenu/);
  assert.match(links, /About submenu/);
  assert.match(links, /aria-current="true"/);
  assert.match(links, /variant == ['"]compact['"]/);
  assert.match(children, /site\.data\.implement_nav/);
  assert.doesNotMatch(data, /title: Guide/);
  assert.doesNotMatch(data, /path: \/implement\/\n/);
  assert.match(data, /path: \/implement\/validate\//);
  assert.match(data, /title: Platforms/);
  assert.match(data, /path: \/implement\/platforms\//);
  assert.doesNotMatch(data, /title: Eleventy/);
  assert.doesNotMatch(data, /title: Jekyll/);
  assert.match(data, /path: \/implement\/buttons\//);
  assert.match(data, /path: \/implement\/connections\//);
  assert.match(data, /title: Connections/);
  const platformsNav = await read("_data/platforms_nav.yml");
  assert.match(platformsNav, /path: \/implement\/platforms\/eleventy\//);
  assert.match(platformsNav, /path: \/implement\/platforms\/ghost\//);
  assert.match(platformsNav, /path: \/implement\/platforms\/jekyll\//);
  assert.match(
    await read("_includes/site-nav-child-items.html"),
    /item\.match == ['"]prefix['"]/,
  );
  assert.match(data, /match: prefix/);
  assert.match(await read("_data/network_nav.yml"), /match: prefix/);
  assert.match(
    await read("_includes/site-nav-links.html"),
    /include site-nav-sections\.html/,
  );
  assert.match(
    await read("_layouts/default.html"),
    /include site-nav-sections\.html/,
  );
  assert.match(
    await read("_includes/site-nav-sections.html"),
    /assign about_section/,
  );
  assert.match(layout, /include csp-https-origin\.html/);
  assert.match(
    await read("_includes/csp-https-origin.html"),
    /csp_https_origin/,
  );
  assert.match(layout, /site-nav-secondary--joshbot/);
  assert.match(layout, /site-nav-secondary--implement/);
  assert.match(layout, /site-nav-secondary--network/);
  assert.match(layout, /site-nav-secondary--about/);
  assert.match(layout, /site-header__top/);
  assert.match(layout, /site-header__motif/);
  assert.match(layout, /variant="compact"/);
  assert.match(layout, /variant="wide"/);
  assert.match(styles, /site-header__top/);
  assert.match(styles, /site-nav-secondary/);
  assert.match(styles, /site-nav__raindrop/);
  assert.match(layout, /site-nav\.js['"] \| relative_url \}\}\?v=/);
  const navScript = await read("assets/js/site-nav.js");
  assert.match(navScript, /pointerenter/);
  assert.match(navScript, /scheduleLeave/);
  assert.match(navScript, /isCoarsePointer/);
  assert.match(navScript, /useHoverSubmenus/);
  assert.match(navScript, /openBeforeGesture/);
  assert.match(navScript, /preventDefault/);
  assert.match(navScript, /aria-expanded/);
  assert.match(navScript, /section-joshbot/);
  // Secondary panel itself stays frameless; link underlines may use box-shadow.
  assert.doesNotMatch(styles, /\.site-nav-secondary\s*\{[^}]*box-shadow/);
  assert.match(
    styles,
    /\.site-nav-secondary a\[aria-current="page"\]\s*\{[^}]*box-shadow/,
  );
  assert.match(
    styles,
    /\.site-nav-secondary__list \{[^}]*padding-inline:\s*var\(--gutter\)/,
  );
  assert.match(styles, /\.site-nav-secondary \{[^}]*padding-inline:\s*0/);
  assert.doesNotMatch(links, /aria-expanded/);
});

test("Eleventy recipe is its own page under Platforms", async () => {
  const guide = await read("implement.md");
  const hubs = await read("implement/platforms.md");
  const platformsNav = await read("_data/platforms_nav.yml");
  const eleventy = await read("implement/platforms/eleventy.md");

  assert.match(guide, /\/implement\/platforms\//);
  assert.doesNotMatch(guide, /\/implement\/eleventy\//);
  assert.doesNotMatch(guide, /addPassthroughCopy/);

  assert.match(hubs, /permalink: \/implement\/platforms\//);
  assert.match(hubs, /site\.data\.platforms_nav/);
  assert.match(platformsNav, /path: \/implement\/platforms\/eleventy\//);
  assert.match(eleventy, /permalink: \/implement\/platforms\/eleventy\//);
  assert.match(
    eleventy,
    /addPassthroughCopy\(\{\s*"input\/josh\.json": "\.well-known\/josh",\s*\}\)/,
  );
  assert.match(
    eleventy,
    /\[\[headers\]\]\s*for = "\/\.well-known\/josh"[\s\S]*Content-Type = "application\/json"/,
  );
  assert.match(eleventy, /\/implement\/validate\//);
  assert.match(
    eleventy,
    /curl -i https:\/\/example\.invalid\/\.well-known\/josh/,
  );
  assert.match(eleventy, /\[implement\]: \/implement\//);
  assert.doesNotMatch(eleventy, /This page is the Eleventy recipe/);
  assert.doesNotMatch(eleventy, /Other platforms are listed/);
  await assertMissing("implement/eleventy.html");
});

test("Jekyll recipe is its own page under Platforms", async () => {
  const guide = await read("implement.md");
  const platformsNav = await read("_data/platforms_nav.yml");
  const jekyll = await read("implement/platforms/jekyll.md");
  const config = await read("_config.yml");

  assert.match(guide, /\/implement\/platforms\//);
  assert.doesNotMatch(guide, /\/implement\/jekyll\//);
  assert.doesNotMatch(guide, /include:\n\s+- \.well-known/);

  assert.match(platformsNav, /path: \/implement\/platforms\/jekyll\//);
  assert.match(jekyll, /permalink: \/implement\/platforms\/jekyll\//);
  assert.match(jekyll, /\.well-known\/\n\s+josh/);
  assert.match(jekyll, /include:\n\s+- \.well-known/);
  assert.match(
    jekyll,
    /\[\[headers\]\]\s*for = "\/\.well-known\/josh"[\s\S]*Content-Type = "application\/json"/,
  );
  assert.match(jekyll, /\/implement\/validate\//);
  assert.match(
    jekyll,
    /curl -i https:\/\/example\.invalid\/\.well-known\/josh/,
  );
  assert.match(jekyll, /\[implement\]: \/implement\//);
  assert.doesNotMatch(jekyll, /This page is the Jekyll recipe/);
  assert.doesNotMatch(jekyll, /Other platforms are listed/);
  assert.match(config, /include:\n\s+- \.well-known/);
  await assertMissing("implement/jekyll.html");
});

test("Ghost recipe is its own page under Platforms", async () => {
  const guide = await read("implement.md");
  const hubs = await read("implement/platforms.md");
  const platformsNav = await read("_data/platforms_nav.yml");
  const ghost = await read("implement/platforms/ghost.md");

  assert.match(guide, /\/implement\/platforms\//);
  assert.match(hubs, /permalink: \/implement\/platforms\//);
  assert.match(hubs, /site\.data\.platforms_nav/);
  assert.match(platformsNav, /path: \/implement\/platforms\/ghost\//);
  assert.match(ghost, /permalink: \/implement\/platforms\/ghost\//);
  assert.match(
    ghost,
    /location = \/\.well-known\/josh \{\s*default_type application\/json;\s*return 200 '{"version":1,"josh":true}';\s*\}/,
  );
  assert.match(ghost, /\/implement\/validate\//);
  assert.match(
    ghost,
    /curl -i https:\/\/example\.invalid\/\.well-known\/josh/,
  );
  assert.match(ghost, /\[implement\]: \/implement\//);
  assert.match(
    ghost,
    /https:\/\/ghost\.org\/docs\/faq\/proxying-https-infinite-loops\//,
  );
  assert.match(ghost, /https:\/\/docs\.ghost\.org\/themes\/routing/);
  assert.match(
    ghost,
    /https:\/\/ghost\.org\/help\/run-ghost-from-a-subdirectory\//,
  );
  assert.doesNotMatch(ghost, /This page is the Ghost recipe/);
  assert.doesNotMatch(ghost, /Other platforms are listed/);
});

test("connections crawl page documents sync signals under Implement", async () => {
  const guide = await read("implement.md");
  const page = await read("implement/connections.md");

  assert.match(guide, /\/implement\/connections\//);
  assert.match(page, /permalink: \/implement\/connections\//);
  assert.match(page, /type: TechArticle/);
  assert.match(page, /npm run nlp:sync/);
  assert.match(page, /JoshternetNLP\/1\.0/);
  assert.match(page, /p-category/);
  assert.match(page, /octo:octothorpes/);
  assert.match(page, /homepage-link/);
  assert.match(page, /content-link/);
  assert.match(page, /\/connections\//);
  assert.match(page, /\/topics\//);
  assert.doesNotMatch(page, /_data\//);
  assert.doesNotMatch(page, /topics\.json/);
  assert.doesNotMatch(page, /connections\.json/);
  assert.doesNotMatch(page, /\.tmp\//);
});

test("visitor pages do not lecture under the title", async () => {
  const pages = [
    "implement.md",
    "implement/connections.md",
    "implement/buttons.md",
    "implement/explore.md",
    "implement/platforms.md",
    "implement/platforms/eleventy.md",
    "implement/platforms/ghost.md",
    "implement/platforms/jekyll.md",
    "implement/validate.md",
    "connections.md",
  ];

  for (const relativePath of pages) {
    const page = await read(relativePath);
    assert.doesNotMatch(
      page,
      /This page explains/,
      `${relativePath} must not lecture under the title`,
    );
    assert.doesNotMatch(
      page,
      /It is practical documentation/,
      `${relativePath} must not lecture under the title`,
    );
    assert.doesNotMatch(
      page,
      /This is a practical, non-normative/,
      `${relativePath} must not lecture under the title`,
    );
    assert.doesNotMatch(
      page,
      /This page is the .+ recipe/,
      `${relativePath} must not lecture under the title`,
    );
    assert.doesNotMatch(
      page,
      /two separate checks/,
      `${relativePath} must not lecture under the title`,
    );
  }
});

test("declaration check keeps paste and origin feedback in separate forms", async () => {
  const page = await read("implement/validate.md");
  const script = await read("assets/js/declaration-check.js");
  const styles = await read("assets/css/main.css");

  const pasteResultAt = page.indexOf("data-declaration-paste-result");
  const pasteInputAt = page.indexOf("data-declaration-text");
  const pasteErrorAt = page.indexOf("data-declaration-paste-error");
  const originResultAt = page.indexOf("data-declaration-origin-result");
  const originInputAt = page.indexOf("data-declaration-origin-input");
  const originErrorAt = page.indexOf("data-declaration-origin-error");

  assert.ok(pasteResultAt > -1 && pasteResultAt < pasteInputAt);
  assert.ok(pasteInputAt < pasteErrorAt);
  assert.ok(originResultAt > -1 && originResultAt < originInputAt);
  assert.ok(originInputAt < originErrorAt);
  assert.match(page, /placeholder='\{\n  "version": 1\n\}'/);
  assert.match(page, /placeholder="https:\/\/example\.invalid"/);
  assert.doesNotMatch(page, /two separate checks/);
  assert.doesNotMatch(page, /This page does not crawl/);
  assert.doesNotMatch(page, /<textarea[^>]*>\s*\{/);
  assert.doesNotMatch(page, /data-declaration-result[^-]/);
  assert.match(script, /markField\(pasteField/);
  assert.match(script, /markField\(originInput/);
  assert.match(styles, /data-field-state="valid"/);
  assert.match(styles, /data-field-state="invalid"/);
  assert.doesNotMatch(script, /pasteInput\.value = body/);
  assert.doesNotMatch(
    script,
    /window\.setTimeout\(checkPaste, PAUSE_MS\);\n\n  pasteInput/,
  );
  assert.match(page, /data-declaration-check-api/);
  assert.match(script, /data-declaration-check-api/);
  assert.match(script, /endpoint\.searchParams\.set\("origin"/);
  assert.doesNotMatch(script, /fetch\(url,/);
});
