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

test("community page points at #joshternet without embedding chat; footer omits IRC", async () => {
  const community = await read("community.md");
  const layout = await read("_layouts/default.html");

  assert.match(community, /#joshternet/);
  assert.match(community, /https:\/\/web\.libera\.chat\/#joshternet/);
  assert.match(community, /irc\.libera\.chat/);
  assert.match(community, /6697/);
  assert.doesNotMatch(community, /<iframe/i);
  assert.doesNotMatch(layout, /web\.libera\.chat/);
  assert.doesNotMatch(layout, /site-footer__nav[\s\S]*#joshternet/);
  assert.match(layout, /github.com\/joshternet[\s\S]*target="_blank"/);
  assert.match(layout, /site-footer__actions/);
  assert.match(layout, /site-footer__icon-link/);
  assert.match(layout, /site-footer__github-icon/);
  assert.doesNotMatch(
    layout,
    /site-footer[\s\S]*network-card__elsewhere-glyph--github/,
  );
  assert.doesNotMatch(
    layout,
    /site-footer__nav[\s\S]*>GitHub<span aria-hidden="true">↗/,
  );
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
  assert.doesNotMatch(aboutNav, /title: GitHub/);
  assert.doesNotMatch(aboutNav, /github\.com\/joshternet/);
  assert.match(layout, /site-footer__icon-link/);
  assert.match(layout, /site-footer__github-icon/);
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
  assert.match(links, /site-nav-compact-branch\.html/);
  assert.match(
    await read("_includes/site-nav-compact-branch.html"),
    /include site-nav-about-children\.html/,
  );
  assert.match(links, /site-nav__item--implement/);
  assert.match(links, /site-nav__item--network/);
  assert.match(links, /site-nav__item--about/);
  assert.match(styles, /site-nav-secondary/);
  assert.match(links, /label="Implement"/);
  assert.match(links, /label="Network"/);
  assert.match(links, /label="About"/);
  assert.match(links, /aria-current="true"/);
  assert.match(links, /variant == ['"]compact['"]/);
  assert.match(children, /site\.data\.implement_nav/);
  assert.doesNotMatch(data, /title: Guide/);
  assert.doesNotMatch(data, /path: \/implement\/\n/);
  assert.match(data, /path: \/implement\/validate\//);
  assert.match(data, /title: Platforms/);
  assert.match(data, /path: \/implement\/platforms\//);
  assert.doesNotMatch(data, /title: Hosting/);
  assert.doesNotMatch(data, /path: \/implement\/hosting\//);
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
  assert.match(
    styles,
    /\.site-nav--compact\s*\{[^}]*max-height:\s*min\(36rem, calc\(100dvh - 5\.5rem\)\)/,
  );
  assert.match(
    styles,
    /\.site-nav--compact \.site-nav__children\s*\{[^}]*border-inline-start/,
  );
  assert.match(
    styles,
    /\.site-nav--compact \.site-nav__list\s*\{[^}]*align-items:\s*stretch/,
  );
  assert.match(
    styles,
    /\.site-nav--compact \.site-nav__branch > summary\s*\{[^}]*width:\s*100%/,
  );
  assert.match(
    styles,
    /\.site-nav--compact \.site-nav__branch\[open\] > summary::after\s*\{[^}]*transform:\s*rotate\(180deg\)/,
  );
  assert.match(styles, /\.site-nav-menu > summary\s*\{/);
  assert.doesNotMatch(styles, /\.site-nav-menu\[open\] summary\s*\{/);
  assert.match(
    await read("_includes/site-nav-compact-branch.html"),
    /<details/,
  );
  assert.match(
    await read("_includes/site-nav-compact-branch.html"),
    /<summary>\{\{ include\.label \}\}<\/summary>/,
  );
  assert.doesNotMatch(links, /site-nav__branch-row/);
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

/**
 * Platform recipe sources under implement/platforms/.
 * @type {ReadonlyArray<{slug: string, file: string, navTitle: string}>}
 */
const PLATFORM_RECIPES = [
  { slug: "astro", file: "implement/platforms/astro.md", navTitle: "Astro" },
  {
    slug: "eleventy",
    file: "implement/platforms/eleventy.md",
    navTitle: "Eleventy",
  },
  { slug: "ghost", file: "implement/platforms/ghost.md", navTitle: "Ghost" },
  { slug: "hugo", file: "implement/platforms/hugo.md", navTitle: "Hugo" },
  { slug: "jekyll", file: "implement/platforms/jekyll.md", navTitle: "Jekyll" },
  {
    slug: "nextjs",
    file: "implement/platforms/nextjs.md",
    navTitle: "Next.js",
  },
  { slug: "nuxt", file: "implement/platforms/nuxt.md", navTitle: "Nuxt" },
  {
    slug: "sveltekit",
    file: "implement/platforms/sveltekit.md",
    navTitle: "SvelteKit",
  },
  {
    slug: "wordpress",
    file: "implement/platforms/wordpress.md",
    navTitle: "WordPress",
  },
];

/**
 * Asserts the shared documentation contract every platform recipe must satisfy.
 * @param {string} relativePath - Recipe markdown path under the repo root.
 * @param {string} body - Recipe file contents.
 * @param {string} platformsNav - Contents of `_data/platforms_nav.yml`.
 * @returns {void}
 */
function assertPlatformRecipeContract(relativePath, body, platformsNav) {
  const permalink = relativePath
    .replace(/^implement\/platforms\//, "/implement/platforms/")
    .replace(/\.md$/, "/");

  assert.match(
    platformsNav,
    new RegExp(`path: ${permalink.replaceAll("/", "\\/")}`),
    `${relativePath} must appear in platforms_nav.yml`,
  );
  assert.match(
    body,
    new RegExp(`permalink: ${permalink.replaceAll("/", "\\/")}`),
    `${relativePath} must declare its permalink`,
  );
  assert.match(body, /\/\.well-known\/josh/);
  assert.match(
    body,
    /no `?\.json`? extension|without `?\.json`? extension|Do not publish the protocol resource as `\/\.well-known\/josh\.json`/i,
  );
  assert.match(body, /no trailing slash/i);
  assert.doesNotMatch(
    body,
    /The public resource is exactly/,
    `${relativePath} must not lecture the exact-path opener under the title`,
  );
  assert.doesNotMatch(
    body,
    /permalink:\s*\/\.well-known\/josh/,
    `${relativePath} must not use /.well-known/josh as the page permalink`,
  );
  assert.doesNotMatch(
    body,
    /the (?:public|canonical) (?:resource|path) is exactly `\/\.well-known\/josh\//i,
    `${relativePath} must not present /.well-known/josh/ as the canonical resource`,
  );
  assert.match(body, /\/implement\/validate\//);
  assert.match(body, /curl -i https:\/\/example\.invalid\/\.well-known\/josh/);
  assert.match(body, /origin root|root of an origin|belongs at the root/i);
  assert.match(
    body,
    /does not separately notify JoshBot|does not notify JoshBot/i,
  );
  assert.match(body, /## Stop publishing/);
  assert.match(body, /404 Not Found/);
  assert.match(body, /410 Gone/);
  assert.match(body, /## Tested/);
  assert.match(body, /RFC-JOSH-0002 version 1/);
  assert.match(body, /Verified:\s*\d{4}-\d{2}-\d{2}/);
  assert.match(body, /\[implement\]: \/implement\//);
  assert.doesNotMatch(body, /This page is the .+ recipe/);
  assert.doesNotMatch(body, /Other platforms are listed/);
}

test("platform recipes satisfy the shared documentation contract", async () => {
  const guide = await read("implement.md");
  const hubs = await read("implement/platforms.md");
  const platformsNav = await read("_data/platforms_nav.yml");

  assert.match(guide, /\/implement\/platforms\//);
  assert.doesNotMatch(guide, /\/implement\/hosting\//);
  assert.match(guide, /Platforms/);
  assert.doesNotMatch(guide, /\/implement\/eleventy\//);
  assert.doesNotMatch(guide, /\/implement\/jekyll\//);
  assert.doesNotMatch(guide, /addPassthroughCopy/);
  assert.doesNotMatch(guide, /include:\n\s+- \.well-known/);
  assert.doesNotMatch(guide, /include-hidden-files/);

  assert.match(hubs, /permalink: \/implement\/platforms\//);
  assert.match(hubs, /site\.data\.platforms_nav/);
  assert.match(hubs, /Hugo/);

  for (const recipe of PLATFORM_RECIPES) {
    const body = await read(recipe.file);
    assertPlatformRecipeContract(recipe.file, body, platformsNav);
  }
});

test("Eleventy recipe keeps passthrough copy to /.well-known/josh", async () => {
  const eleventy = await read("implement/platforms/eleventy.md");

  assert.match(
    eleventy,
    /addPassthroughCopy\(\{\s*"input\/josh\.json": "\.well-known\/josh",\s*\}\)/,
  );
  assert.match(eleventy, /test -f _site\/\.well-known\/josh/);
  assert.match(eleventy, /include-hidden-files: true/);
  await assertMissing("implement/eleventy.html");
});

test("Jekyll recipe keeps include for .well-known and _site verification", async () => {
  const jekyll = await read("implement/platforms/jekyll.md");
  const config = await read("_config.yml");

  assert.match(jekyll, /\.well-known\/\n\s+josh/);
  assert.match(jekyll, /include:\n\s+- \.well-known/);
  assert.match(jekyll, /test -f _site\/\.well-known\/josh/);
  assert.match(jekyll, /include-hidden-files: true/);
  assert.match(
    jekyll,
    /Including `\.well-known` in Jekyll and preserving `\.well-known` in a later deploy/,
  );
  assert.match(config, /include:\n\s+- \.well-known/);
  await assertMissing("implement/jekyll.html");
});

test("Ghost recipe keeps exact Nginx location and Ghost references", async () => {
  const ghost = await read("implement/platforms/ghost.md");

  assert.match(
    ghost,
    /location = \/\.well-known\/josh \{\s*default_type application\/json;\s*return 200 '{"version":1,"josh":true}';\s*\}/,
  );
  assert.match(ghost, /sudo nginx -t/);
  assert.match(
    ghost,
    /https:\/\/ghost\.org\/docs\/faq\/proxying-https-infinite-loops\//,
  );
  assert.match(ghost, /https:\/\/docs\.ghost\.org\/themes\/routing/);
  assert.match(
    ghost,
    /https:\/\/ghost\.org\/help\/run-ghost-from-a-subdirectory\//,
  );
});

test("Hugo recipe publishes static/.well-known/josh into public/", async () => {
  const hugo = await read("implement/platforms/hugo.md");

  assert.match(hugo, /static\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(hugo, /public\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(hugo, /test -f public\/\.well-known\/josh/);
  assert.match(hugo, /include-hidden-files: true/);
  assert.match(hugo, /source = "static"/);
  assert.match(
    hugo,
    /\[\[headers\]\]\s*for = "\/\.well-known\/josh"[\s\S]*Content-Type = "application\/json"/,
  );
  assert.match(hugo, /static\/_headers/);
});

test("connections crawl page documents sync signals under Implement", async () => {
  const guide = await read("implement.md");
  const page = await read("implement/connections.md");

  assert.match(guide, /\/implement\/connections\//);
  assert.match(page, /permalink: \/implement\/connections\//);
  assert.match(page, /type: TechArticle/);
  assert.match(page, /npm run nlp:sync/);
  assert.doesNotMatch(page, /nlp:probe-directory/);
  assert.doesNotMatch(page, /nlp:scale-probe/);
  assert.doesNotMatch(page, /joshing\.you/);
  assert.doesNotMatch(page, /Local directory probe/);
  assert.match(page, /JoshternetNLP\/1\.0/);
  assert.match(page, /p-category/);
  assert.doesNotMatch(page, /octo:octothorpes/);
  assert.doesNotMatch(page, /Verified Webmention/);
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
    "implement/platforms/astro.md",
    "implement/platforms/eleventy.md",
    "implement/platforms/ghost.md",
    "implement/platforms/hugo.md",
    "implement/platforms/jekyll.md",
    "implement/platforms/nextjs.md",
    "implement/platforms/nuxt.md",
    "implement/platforms/sveltekit.md",
    "implement/platforms/wordpress.md",
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

  for (const relativePath of [
    "implement/platforms/eleventy.md",
    "implement/platforms/ghost.md",
    "implement/platforms/hugo.md",
    "implement/platforms/jekyll.md",
    "implement/platforms/astro.md",
    "implement/platforms/nextjs.md",
    "implement/platforms/nuxt.md",
    "implement/platforms/sveltekit.md",
    "implement/platforms/wordpress.md",
  ]) {
    const page = await read(relativePath);
    assert.doesNotMatch(
      page,
      /The public resource is exactly/,
      `${relativePath} must not lecture the exact-path opener under the title`,
    );
    assert.doesNotMatch(
      page,
      /It does not become `\/\.well-known\/josh\.json`/,
      `${relativePath} must not lecture the .json opener under the title`,
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
