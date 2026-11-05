/**
 * Goal: Structured HTML keeps parent items, nested details, and footer links
 * in the right consumer view.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  blockId,
  connectionLinks,
  documentMeta,
  loadHtml,
  topicPassages,
  usesBlocks,
} from "../../scripts/nlp/structured-html.mjs";

const page = `<!doctype html>
<html lang="en">
  <head>
    <title>Setup</title>
    <meta name="description" content="A desk">
  </head>
  <body>
    <nav><a href="/now">Now</a><a href="javascript:void(0)">Skip</a></nav>
    <main>
      <h2>Desk</h2>
      <ul>
        <li>CODE Keyboard
          <ul><li>Cherry MX Brown switches</li></ul>
        </li>
        <li>I no longer use Sublime Text</li>
        <li><a href="https://neovim.io/">Neovim</a></li>
        <li><a href="javascript:void(0)">Nope</a> Editor</li>
        <li><a href="">Blank</a> Tool</li>
        <li></li>
      </ul>
      <h2>Phone</h2>
      <ul>
        <li>Pixel
          <ul><li><a href="https://kindle.amazon.com/">Kindle</a></li></ul>
        </li>
      </ul>
      <dl><dt>Focusrite Scarlett</dt></dl>
      <table><tr><td>UA Volt 1</td></tr></table>
    </main>
    <footer><a href="https://other.example/">Friend</a><ul><li>Secret</li></ul></footer>
  </body>
</html>`;

test("uses blocks keep nesting without copying child text onto the parent", () => {
  const blocks = usesBlocks(page);
  const keyboard = blocks.find((block) => block.target_text.startsWith("CODE"));
  const switches = blocks.find((block) => block.target_text.includes("Cherry"));
  assert.ok(keyboard);
  assert.ok(switches);
  assert.equal(keyboard.target_text.includes("Cherry"), false);
  assert.equal(switches.parent_block_id, keyboard.block_id);
  assert.deepEqual(keyboard.child_block_ids, [switches.block_id]);
  assert.equal(keyboard.section_path.includes("Desk"), true);
  assert.equal(
    blocks.some((block) => block.target_text.includes("no longer use")),
    true,
  );
  const kindle = blocks.find((block) => block.target_text === "Kindle");
  const pixel = blocks.find((block) => block.target_text.startsWith("Pixel"));
  assert.equal(kindle.parent_block_id, pixel.block_id);
  assert.equal(pixel.target_text.includes("Kindle"), false);
  assert.equal(
    blocks.some((block) => block.target_text === "Focusrite Scarlett"),
    true,
  );
  assert.equal(
    blocks.some((block) => block.target_text === "UA Volt 1"),
    true,
  );
  assert.equal(
    blocks.some((block) => block.target_text === "Friend"),
    false,
  );
  const neovim = blocks.find((block) => block.target_text === "Neovim");
  assert.equal(neovim.relevant_links[0].href, "https://neovim.io/");
  assert.equal(neovim.language, "en");
});

test("a blank heading does not enter the section path", () => {
  const blocks = usesBlocks("<main><h2> </h2><ul><li>Named</li></ul></main>");
  assert.equal(blocks[0].section_path, "");
});

test("a list item that only wraps another list does not become its own block", () => {
  const blocks = usesBlocks("<ul><li><ul><li>Inner only</li></ul></li></ul>");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].target_text, "Inner only");
  assert.equal(blocks[0].parent_block_id, "");
});

test("topic passages keep each article and connection links keep the footer", () => {
  const passages = topicPassages(`
    <article><h2>One</h2><p>Alpha note</p></article>
    <article><p></p></article>
    <article><p>Beta note</p></article>
  `);
  assert.equal(passages.length, 2);
  assert.equal(passages[0].block_type, "article");
  assert.equal(passages[1].target_text, "Beta note");

  const paragraphs = topicPassages(`
    <nav><p>Menu words</p></nav>
    <p>Real words</p>
    <p>   </p>
  `);
  assert.equal(paragraphs.length, 1);
  assert.equal(paragraphs[0].block_type, "paragraph");
  assert.equal(paragraphs[0].target_text, "Real words");

  const links = connectionLinks(page);
  assert.equal(links.find((link) => link.text === "Friend").location, "footer");
  assert.equal(links.find((link) => link.text === "Now").location, "nav");
  assert.equal(
    links.find((link) => link.href === "https://neovim.io/").location,
    "main",
  );
  assert.equal(
    links.some((link) => link.href.startsWith("javascript:")),
    false,
  );
  assert.equal(
    connectionLinks("<a href='https://other.example/a'>Out</a>")[0].location,
    "body",
  );
});

test("document meta reads the description and ignores a missing language", () => {
  const meta = documentMeta(page);
  assert.equal(meta.title, "Setup");
  assert.equal(meta.description, "A desk");
  assert.equal(meta.language, "en");
  const openGraph = documentMeta(
    '<html><head><meta property="og:description" content="Graph"></head><body lang="fr"></body></html>',
  );
  assert.equal(openGraph.description, "Graph");
  assert.equal(openGraph.language, "fr");
  assert.deepEqual(documentMeta(null), {
    title: "",
    description: "",
    language: "",
  });
  assert.equal(usesBlocks(null).length, 0);
  assert.equal(connectionLinks("<a href=''>Empty</a>").length, 0);
  assert.equal(blockId(["a", "b"]), blockId(["a", "b"]));
  assert.equal(typeof loadHtml("<p>Hi</p>"), "function");
});
