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

  assert.match(community, /^title: Community$/m);
  assert.match(community, /^# Community$/m);
  assert.match(community, /join in the joshing/);
  assert.match(community, /independent websites remain independent/i);
  assert.match(community, /protections are not cut for length/);
  assert.match(
    community,
    /Stewardship is responsibility for the project\. It is not ownership of the network\./,
  );
  assert.match(community, /Joshness is declared, never derived\./);
  assert.match(community, /No Josh outranks another Josh/);
  assert.match(
    community,
    /Interoperability does not require interaction, and freedom of expression does not require compelled amplification\./,
  );
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

test("governance page keeps founding maintainer PRE-JOSH and Draft boundaries", async () => {
  const governance = await read("governance.md");

  assert.match(governance, /^title: Governance$/m);
  assert.match(governance, /^# Governance$/m);
  assert.match(
    governance,
    /Joshua Morris created the Joshternet and currently serves as its founding maintainer/,
  );
  assert.match(governance, /\*\*PRE-JOSH\*\*/);
  assert.match(governance, /None are Accepted/);
  assert.match(governance, /What has not been established/);
  assert.match(governance, /formal membership or member classes/);
  assert.match(governance, /\[Community\]\[community\]/);
  assert.match(governance, /Joshness is declared, never derived\./);
  assert.match(governance, /No Josh outranks another Josh/);
  assert.match(governance, /Josh identity is not required/);
  assert.match(governance, /https:\/\/github\.com\/joshternet\/spec\/issues/);
  assert.match(governance, /https:\/\/github\.com\/joshternet\/spec\/pulls/);
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
    "Join",
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
  assert.doesNotMatch(data, /title: Join the Joshternet/);
  assert.doesNotMatch(data, /path: \/join\//);
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
  assert.match(data, /title: Content handbook/);
  assert.match(data, /path: \/implement\/content\//);
  assert.doesNotMatch(data, /title: Slashpages/);
  assert.doesNotMatch(data, /path: \/implement\/slashpages\//);
  assert.doesNotMatch(data, /title: Explore notes/);
  assert.doesNotMatch(data, /path: \/implement\/explore\//);
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
    slug: "cloudflare-worker",
    file: "implement/platforms/cloudflare-worker.md",
    navTitle: "Cloudflare Worker",
  },
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
  { slug: "quartz", file: "implement/platforms/quartz.md", navTitle: "Quartz" },
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
    /no `?\.json`? extension|without `?\.json`? extension|Do not publish the protocol resource as `\/\.well-known\/josh\.json`|declaration-identity-ref\.html|declaration-verify-ref\.html/i,
  );
  assert.match(body, /no trailing slash|declaration-verify-ref\.html/i);
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
  assert.match(body, /\/implement\/validate\/|declaration-verify-ref\.html/);
  assert.match(
    body,
    /curl -i https:\/\/joshua\.example\/\.well-known\/josh|declaration-verify-ref\.html/,
  );
  assert.match(
    body,
    /origin root|root of an origin|belongs at the root|declaration-origin-root-note\.html/i,
  );
  assert.match(
    body,
    /does not separately notify JoshBot|does not notify JoshBot|declaration-verify-ref\.html/i,
  );
  assert.match(body, /## Stop publishing|declaration-stop-publishing\.html/);
  assert.match(body, /404 Not Found|declaration-stop-publishing\.html/);
  assert.match(body, /410 Gone|declaration-stop-publishing\.html/);
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
  assert.match(hubs, /^title: Platforms$/m);
  assert.match(hubs, /site\.data\.platforms_nav/);
  assert.match(hubs, /Hugo/);
  assert.match(hubs, /joining the Joshternet shouldn't/);
  assert.match(hubs, /## The result is the same on every platform/);
  assert.match(hubs, /## Choose your platform/);
  assert.match(hubs, /## Check the deployed declaration/);
  assert.match(hubs, /## You remain in control/);
  assert.match(hubs, /## Don't see your platform\?/);
  assert.match(hubs, /joshua\.example/);
  assert.match(hubs, /curl -i https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.match(hubs, /\/implement\/validate\//);
  assert.match(hubs, /\/implement\/content\//);
  assert.match(hubs, /platform\.group == group_key/);
  assert.match(hubs, /<h3>\{\{\s*group_label\s*\}\}<\/h3>/);
  assert.match(hubs, /assign platform_groups = 'static\|framework\|cms\|edge'/);
  assert.doesNotMatch(hubs, /example\.invalid/);
  assert.doesNotMatch(hubs, /content-joshbot-status/);

  assert.match(
    platformsNav,
    /summary: Use the Joshternet plugin to serve the declaration/,
  );
  assert.match(
    platformsNav,
    /summary: Serve the declaration through a Worker route without changing your website's build/,
  );

  for (const group of ["static", "framework", "cms", "edge"]) {
    assert.match(platformsNav, new RegExp(`group: ${group}\\b`));
  }
  for (const recipe of PLATFORM_RECIPES) {
    assert.match(
      platformsNav,
      new RegExp(
        `path: ${recipe.file
          .replace(/^implement\/platforms\//, "/implement/platforms/")
          .replace(/\.md$/, "/")}`,
      ),
    );
  }

  for (const recipe of PLATFORM_RECIPES) {
    const body = await read(recipe.file);
    assertPlatformRecipeContract(recipe.file, body, platformsNav);
  }
});

test("WordPress recipe installs from the plugin directory", async () => {
  const wordpress = await read("implement/platforms/wordpress.md");

  assert.match(wordpress, /https:\/\/wordpress\.org\/plugins\/joshternet\//);
  assert.match(wordpress, /https:\/\/github\.com\/joshternet\/wordpress/);
  assert.match(wordpress, /Releases are published on WordPress\.org/);
  assert.match(wordpress, /It is not the release channel/);
  assert.doesNotMatch(wordpress, /until the plugin is listed/);
  assert.doesNotMatch(wordpress, /After directory acceptance/);
});

test("Eleventy recipe keeps passthrough copy to /.well-known/josh", async () => {
  const eleventy = await read("implement/platforms/eleventy.md");

  assert.match(
    eleventy,
    /addPassthroughCopy\(\{\s*"input\/josh\.json": "\.well-known\/josh",\s*\}\)/,
  );
  assert.match(eleventy, /test -f _site\/\.well-known\/josh/);
  assert.match(eleventy, /\.nojekyll/);
  assert.match(eleventy, /branch-based publishing|publishing sources/i);
  assert.doesNotMatch(eleventy, /upload-pages-artifact/);
  assert.doesNotMatch(eleventy, /include-hidden-files/);
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
    /location = \/\.well-known\/josh \{\s*default_type application\/json;\s*return 200 '{"version":1}';\s*\}/,
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

test("Quartz recipe copies josh.json into public/.well-known/josh after the build", async () => {
  const quartz = await read("implement/platforms/quartz.md");

  assert.match(quartz, /mkdir -p public\/\.well-known/);
  assert.match(quartz, /cp josh\.json public\/\.well-known\/josh/);
  assert.match(quartz, /test -f public\/\.well-known\/josh/);
  assert.match(quartz, /include-hidden-files: true/);
  assert.match(quartz, /Quartz copies `quartz\/static` to `public\/static`/);
  assert.doesNotMatch(
    quartz,
    /quartz\/static\/\.well-known\/josh` is the deployed resource/,
  );
});

test("connections crawl page documents sync signals under Implement", async () => {
  const guide = await read("implement.md");
  const page = await read("implement/connections.md");

  assert.match(guide, /\/implement\/connections\//);
  assert.match(guide, /How Joshternet gathers connections/);
  assert.match(page, /permalink: \/implement\/connections\//);
  assert.match(page, /type: TechArticle/);
  assert.match(page, /how websites connect/i);
  assert.match(page, /`declared`/);
  assert.match(page, /`observed`/);
  assert.match(page, /`heuristic`/);
  assert.match(page, /aren't proof of friendship/i);
  assert.match(page, /npm run nlp:sync/);
  assert.doesNotMatch(page, /nlp:probe-directory/);
  assert.doesNotMatch(page, /nlp:scale-probe/);
  assert.doesNotMatch(page, /joshing\.you/);
  assert.doesNotMatch(page, /Local directory probe/);
  assert.match(
    page,
    /Joshternet-Joshbot \(\+https:\/\/joshternet\.org\/joshbot\)/,
  );
  assert.match(page, /p-category/);
  assert.doesNotMatch(page, /octo:octothorpes/);
  assert.doesNotMatch(page, /Verified Webmention/);
  assert.match(page, /homepage-link/);
  assert.match(page, /content-link/);
  assert.match(page, /\/connections\//);
  assert.match(page, /\/topics\//);
  assert.match(page, /\/\.well-known\/slashpages/);
  assert.match(page, /slashpages-manifest/);
  assert.match(page, /\/implement\/content\/opml\//);
  assert.doesNotMatch(page, /_data\//);
  assert.doesNotMatch(page, /topics\.json/);
  assert.doesNotMatch(page, /connections\.json/);
  assert.doesNotMatch(page, /\.tmp\//);
});

test("implement landing is a join and handbook gateway", async () => {
  const guide = await read("implement.md");

  assert.match(guide, /permalink: \/implement\//);
  assert.match(guide, /title: Implement the Joshternet/);
  assert.match(guide, /Publish a valid \/\.well-known\/josh declaration/);
  assert.match(guide, /## Join the Joshternet/);
  assert.match(guide, /## Choose your declaration/);
  assert.match(guide, /## Get connected in three steps/);
  assert.match(guide, /## Help the web discover what you publish/);
  assert.match(guide, /## What joining requires/);
  assert.match(guide, /## Choose your publishing platform/);
  assert.match(guide, /## Build something with Joshternet/);
  assert.match(guide, /## Participation and discovery are separate/);
  assert.match(guide, /## Technical references/);
  assert.match(guide, /### Stop publishing a declaration/);
  assert.match(guide, /\{\s*"version":\s*1\s*\}/);
  assert.match(guide, /"josh": true/);
  assert.match(guide, /"josh": false/);
  assert.match(guide, /Property omitted/);
  assert.match(guide, /\/join\//);
  assert.match(guide, /\/implement\/validate\//);
  assert.match(guide, /\/network\//);
  assert.match(guide, /\/nominate\//);
  assert.match(guide, /\/joshbot\//);
  assert.match(guide, /\/implement\/content\//);
  assert.match(guide, /\/implement\/platforms\//);
  assert.match(guide, /\/implement\/buttons\//);
  assert.match(guide, /\/specs\//);
  assert.match(guide, /Connect independent websites/);
  assert.match(guide, /\/implement\/content\/connections\//);
  assert.match(guide, /Improve content discovery/);
  assert.match(guide, /\/implement\/content\/explore\//);
  assert.match(guide, /How Joshternet gathers connections/);
  assert.match(guide, /\/implement\/connections\//);
  assert.match(guide, /How Joshternet builds Explore views/);
  assert.match(guide, /\/implement\/explore\//);
  assert.match(guide, /Needed to join\?/);
  assert.match(guide, /joshua\.example/);
  assert.match(guide, /curl -i https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.match(guide, /\{ "version": "1" \}/);
  assert.match(guide, /\{ "version": 1, "josh": "true" \}/);
  assert.match(guide, /JSON integer token `1`/);
  assert.match(guide, /404 Not Found/);
  assert.match(guide, /410 Gone/);
  assert.match(guide, /RFC-JOSH-0001/);
  assert.match(guide, /RFC-JOSH-0002/);
  assert.doesNotMatch(guide, /example\.invalid/);
  assert.doesNotMatch(guide, /content-joshbot-status/);
  assert.doesNotMatch(guide, /Optional: Help Joshternet explore your website/);
});

test("specs page maps Draft RFCs without becoming a second Implement guide", async () => {
  const specs = await read("specs.md");

  assert.match(specs, /permalink: \/specs\//);
  assert.match(specs, /^title: Specifications$/m);
  assert.match(specs, /^# Specifications$/m);
  assert.match(specs, /type: TechArticle/);
  assert.match(specs, /## Where things stand/);
  assert.match(specs, /PRE-JOSH/);
  assert.match(specs, /None has been Accepted yet/);
  assert.match(specs, /\/governance\//);
  assert.match(specs, /Joshness is declared, never derived\./);
  assert.match(specs, /## Which RFC should you read\?/);
  assert.match(specs, /\/join\//);
  assert.match(specs, /\/implement\//);
  assert.match(
    specs,
    /https:\/\/github\.com\/joshternet\/spec\/blob\/main\/rfcs\/0000-the-joshternet\.md/,
  );
  assert.match(
    specs,
    /https:\/\/github\.com\/joshternet\/spec\/blob\/main\/rfcs\/0001-josh-identity\.md/,
  );
  assert.match(
    specs,
    /https:\/\/github\.com\/joshternet\/spec\/blob\/main\/rfcs\/0002-well-known-josh\.md/,
  );
  assert.match(specs, /https:\/\/github\.com\/joshternet\/spec\/issues/);
  assert.doesNotMatch(specs, /example\.invalid/);
});

test("slashpages OPML guide lives in the content handbook", async () => {
  const guide = await read("implement.md");
  const stub = await read("implement/slashpages.md");
  const page = await read("implement/content/opml.md");

  assert.match(guide, /\/implement\/content\/opml\//);
  assert.match(guide, /Help the web discover what you publish/);
  assert.match(stub, /permalink: \/implement\/slashpages\//);
  assert.match(stub, /\/implement\/content\/opml\//);
  assert.match(page, /permalink: \/implement\/content\/opml\//);
  assert.match(page, /\/\.well-known\/slashpages/);
  assert.match(page, /OPML 2\.0/);
  assert.match(page, /type="link"/);
  assert.match(page, /category="\/now"/);
  assert.match(page, /joshua\.example/);
  assert.match(page, /slashpages-manifest/);
  assert.match(page, /github\.com\/pfefferle\/well-known-slashpages/);
  assert.match(page, /opml\.org\/spec2\.opml/);
  assert.match(page, /slashpages\.net/);
  assert.match(page, /Participation still depends only/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("visitor pages do not lecture under the title", async () => {
  const pages = [
    "implement.md",
    "implement/connections.md",
    "implement/slashpages.md",
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
    "implement/platforms/quartz.md",
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
    "implement/platforms/quartz.md",
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
  assert.match(page, /placeholder="https:\/\/joshua\.example"/);
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
